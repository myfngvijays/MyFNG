'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  BarChart3, TrendingUp, Users, Clock, Star, DollarSign,
  CheckCircle, XCircle, AlertTriangle, Download, Calendar
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface WorkshopMetrics {
  totalLeads: number;
  completedLeads: number;
  pendingLeads: number;
  rejectedLeads: number;
  avgCompletionTime: number;
  avgSatisfactionScore: number;
  totalRevenue: number;
  teamPerformance: Array<{
    member_name: string;
    role: string;
    assigned_jobs: number;
    completed_jobs: number;
    avg_rating: number;
  }>;
  leadsByMonth: Array<{
    month: string;
    total: number;
    completed: number;
    revenue: number;
  }>;
}

export default function WorkshopReportsPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<WorkshopMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchWorkshopMetrics();
  }, [dateRange]);

  async function fetchWorkshopMetrics() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      if (!userProfile?.workshop_id) {
        toast.error('Workshop not found');
        return;
      }

      const now = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
      }

      // Fetch leads for this workshop
      const { data: workshopLeads, error: leadsError } = await supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', userProfile.workshop_id)
        .gte('created_at', startDate.toISOString());

      if (leadsError) {
        console.error('Error fetching leads:', leadsError);
        toast.error('Failed to fetch metrics');
        return;
      }

      const totalLeads = workshopLeads?.length || 0;
      const completedLeads = workshopLeads?.filter(l => l.status === 'CLOSED').length || 0;
      const pendingLeads = workshopLeads?.filter(l => 
        !['CLOSED', 'REJECTED', 'CANCELLED'].includes(l.status)
      ).length || 0;
      const rejectedLeads = workshopLeads?.filter(l => l.status === 'REJECTED').length || 0;

      const totalRevenue = workshopLeads?.reduce((sum, l) => sum + (l.invoice_amount || 0), 0) || 0;

      // Calculate completion time
      const completedWithTime = workshopLeads?.filter(l => 
        l.status === 'CLOSED' && l.final_closure_at && l.accepted_at
      ) || [];
      
      const avgCompletionTime = completedWithTime.length > 0
        ? completedWithTime.reduce((sum, l) => {
            const start = new Date(l.accepted_at).getTime();
            const end = new Date(l.final_closure_at).getTime();
            return sum + (end - start);
          }, 0) / completedWithTime.length / (1000 * 60 * 60 * 24) // Convert to days
        : 0;

      // Calculate avg satisfaction
      const leadsWithSatisfaction = workshopLeads?.filter(l => l.customer_satisfaction_score) || [];
      const avgSatisfactionScore = leadsWithSatisfaction.length > 0
        ? leadsWithSatisfaction.reduce((sum, l) => sum + (l.customer_satisfaction_score || 0), 0) / leadsWithSatisfaction.length
        : 0;

      setMetrics({
        totalLeads,
        completedLeads,
        pendingLeads,
        rejectedLeads,
        avgCompletionTime,
        avgSatisfactionScore,
        totalRevenue,
        teamPerformance: [],
        leadsByMonth: []
      });

    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }

  const exportReport = () => {
    toast.success('Export feature will download Excel/PDF report');
  };

  if (loading) {
    return (
      <DashboardLayout role="workshop_admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const conversionRate = metrics && metrics.totalLeads > 0 
    ? (metrics.completedLeads / metrics.totalLeads) * 100 
    : 0;

  const rejectionRate = metrics && metrics.totalLeads > 0 
    ? (metrics.rejectedLeads / metrics.totalLeads) * 100 
    : 0;

  return (
    <DashboardLayout role="workshop_admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg flex items-center gap-3">
                <BarChart3 className="w-8 h-8" />
                Workshop Performance Reports
              </h1>
              <p className="text-white font-medium mt-1">Track your workshop's key metrics and performance</p>
            </div>
            <button
              onClick={exportReport}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-2 transition"
            >
              <Download className="w-5 h-5" />
              Export
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="card">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Period:</span>
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  dateRange === range
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>

        {metrics && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-10 h-10 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Leads</p>
                    <p className="text-3xl font-bold text-gray-800">{metrics.totalLeads}</p>
                  </div>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-green-50 to-green-100">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-10 h-10 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="text-3xl font-bold text-gray-800">{metrics.completedLeads}</p>
                    <p className="text-xs text-gray-600">{conversionRate.toFixed(1)}% rate</p>
                  </div>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100">
                <div className="flex items-center gap-3">
                  <Clock className="w-10 h-10 text-yellow-600" />
                  <div>
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-3xl font-bold text-gray-800">{metrics.pendingLeads}</p>
                  </div>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-red-50 to-red-100">
                <div className="flex items-center gap-3">
                  <XCircle className="w-10 h-10 text-red-600" />
                  <div>
                    <p className="text-sm text-gray-600">Rejected</p>
                    <p className="text-3xl font-bold text-gray-800">{metrics.rejectedLeads}</p>
                    <p className="text-xs text-gray-600">{rejectionRate.toFixed(1)}% rate</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card">
                <div className="flex items-center gap-3 mb-3">
                  <Clock className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Avg Completion Time</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {metrics.avgCompletionTime.toFixed(1)} days
                    </p>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Target: 5 days
                </div>
              </div>

              <div className="card">
                <div className="flex items-center gap-3 mb-3">
                  <Star className="w-8 h-8 text-yellow-600" />
                  <div>
                    <p className="text-sm text-gray-600">Avg Satisfaction</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {metrics.avgSatisfactionScore.toFixed(1)}/5
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star} 
                      className={`w-4 h-4 ${
                        star <= Math.round(metrics.avgSatisfactionScore) 
                          ? 'fill-yellow-400 text-yellow-400' 
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="flex items-center gap-3 mb-3">
                  <DollarSign className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-800">
                      ₹{(metrics.totalRevenue / 1000).toFixed(1)}K
                    </p>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Avg: ₹{metrics.totalLeads > 0 ? (metrics.totalRevenue / metrics.totalLeads).toFixed(0) : 0} per lead
                </div>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="card">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-brand-primary" />
                Lead Status Breakdown
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">{metrics.completedLeads}</p>
                  <p className="text-sm text-gray-600 mt-1">Completed</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-3xl font-bold text-yellow-600">{metrics.pendingLeads}</p>
                  <p className="text-sm text-gray-600 mt-1">In Progress</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-3xl font-bold text-red-600">{metrics.rejectedLeads}</p>
                  <p className="text-sm text-gray-600 mt-1">Rejected</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-3xl font-bold text-blue-600">
                    {conversionRate.toFixed(0)}%
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Success Rate</p>
                </div>
              </div>
            </div>

            {/* Insights & Recommendations */}
            <div className="card bg-blue-50 border-l-4 border-blue-500">
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-blue-600" />
                Performance Insights
              </h3>
              <div className="space-y-2 text-sm">
                {conversionRate >= 80 && (
                  <p className="text-green-700">✅ Excellent conversion rate! Keep up the good work.</p>
                )}
                {conversionRate < 50 && (
                  <p className="text-red-700">⚠️ Conversion rate is below target. Consider reviewing lead quality and team performance.</p>
                )}
                {metrics.avgCompletionTime > 7 && (
                  <p className="text-orange-700">⚠️ Average completion time exceeds target. Look for bottlenecks in the workflow.</p>
                )}
                {metrics.avgSatisfactionScore >= 4 && (
                  <p className="text-green-700">✅ Customer satisfaction is excellent!</p>
                )}
                {metrics.avgSatisfactionScore < 3 && (
                  <p className="text-red-700">⚠️ Customer satisfaction needs improvement. Review CSE feedback and quality issues.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
