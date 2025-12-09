'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, FileText, 
  Star, Clock, CheckCircle, XCircle, BarChart3, Download
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface AnalyticsData {
  overview: {
    totalLeads: number;
    leadsThisMonth: number;
    leadsGrowth: number;
    conversionRate: number;
    avgLeadValue: number;
    totalRevenue: number;
    revenueGrowth: number;
    avgCompletionTime: number;
  };
  leadsByStatus: Array<{ status: string; count: number; percentage: number }>;
  leadsByWorkshop: Array<{ workshop_name: string; total_leads: number; completed: number; revenue: number }>;
  topPerformers: Array<{ name: string; role: string; leads_completed: number; avg_rating: number }>;
  satisfactionTrends: Array<{ month: string; avg_score: number; total_surveys: number }>;
  revenueByMonth: Array<{ month: string; revenue: number; leads_count: number }>;
}

export default function SuperAdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange]);

  async function fetchAnalyticsData() {
    const supabase = createClient();
    setLoading(true);

    try {
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
        case '1y':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      // Fetch all leads data
      const { data: allLeads, error: leadsError } = await supabase
        .from('service_leads')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (leadsError) {
        console.error('Error fetching leads:', leadsError);
        toast.error('Failed to fetch analytics data');
        return;
      }

      // Calculate overview metrics
      const totalLeads = allLeads?.length || 0;
      const completedLeads = allLeads?.filter(l => l.status === 'CLOSED').length || 0;
      const conversionRate = totalLeads > 0 ? (completedLeads / totalLeads) * 100 : 0;
      
      const totalRevenue = allLeads?.reduce((sum, l) => sum + (l.invoice_amount || 0), 0) || 0;
      const avgLeadValue = totalLeads > 0 ? totalRevenue / totalLeads : 0;

      // Calculate completion time
      const completedWithTime = allLeads?.filter(l => l.status === 'CLOSED' && l.final_closure_at && l.created_at) || [];
      const avgCompletionTime = completedWithTime.length > 0
        ? completedWithTime.reduce((sum, l) => {
            const start = new Date(l.created_at).getTime();
            const end = new Date(l.final_closure_at).getTime();
            return sum + (end - start);
          }, 0) / completedWithTime.length / (1000 * 60 * 60 * 24) // Convert to days
        : 0;

      // Leads by status
      const statusCounts: Record<string, number> = {};
      allLeads?.forEach(l => {
        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
      });

      const leadsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: (count / totalLeads) * 100
      }));

      // Mock growth data (in production, compare with previous period)
      const leadsGrowth = 15.5;
      const revenueGrowth = 22.3;

      setData({
        overview: {
          totalLeads,
          leadsThisMonth: totalLeads,
          leadsGrowth,
          conversionRate,
          avgLeadValue,
          totalRevenue,
          revenueGrowth,
          avgCompletionTime
        },
        leadsByStatus,
        leadsByWorkshop: [], // Would fetch from workshops table
        topPerformers: [],
        satisfactionTrends: [],
        revenueByMonth: []
      });

    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  const exportReport = () => {
    toast.success('Report export feature coming soon!');
  };

  if (loading) {
    return (
      <DashboardLayout role="super_admin">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-300 drop-shadow-lg flex items-center gap-2 sm:gap-3">
                <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex-shrink-0" />
                <span className="truncate">Analytics & Reports</span>
              </h1>
              <p className="text-white font-medium text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">Comprehensive business intelligence dashboard</p>
            </div>
            <button
              onClick={exportReport}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-1.5 sm:gap-2 transition text-xs sm:text-sm w-full sm:w-auto justify-center"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Export Report</span>
              <span className="sm:hidden">Export</span>
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="card p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm font-medium text-gray-700">Time Period:</span>
            <div className="flex flex-wrap gap-2">
              {(['7d', '30d', '90d', '1y'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
                    dateRange === range
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {range === '7d' ? 'Last 7 Days' :
                   range === '30d' ? 'Last 30 Days' :
                   range === '90d' ? 'Last 90 Days' :
                   'Last Year'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Overview Metrics */}
        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
              {/* Total Leads */}
              <div className="card bg-gradient-to-br from-blue-50 to-blue-100 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <FileText className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-blue-600 flex-shrink-0" />
                  <div className={`flex items-center gap-1 text-xs sm:text-sm font-semibold ${
                    data.overview.leadsGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {data.overview.leadsGrowth >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                    {Math.abs(data.overview.leadsGrowth).toFixed(1)}%
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-gray-600">Total Leads</p>
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800">{data.overview.totalLeads}</p>
              </div>

              {/* Conversion Rate */}
              <div className="card bg-gradient-to-br from-green-50 to-green-100 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <CheckCircle className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-green-600 flex-shrink-0" />
                </div>
                <p className="text-xs sm:text-sm text-gray-600">Conversion Rate</p>
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800">{data.overview.conversionRate.toFixed(1)}%</p>
              </div>

              {/* Total Revenue */}
              <div className="card bg-gradient-to-br from-purple-50 to-purple-100 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <DollarSign className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-purple-600 flex-shrink-0" />
                  <div className={`flex items-center gap-1 text-xs sm:text-sm font-semibold ${
                    data.overview.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {data.overview.revenueGrowth >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                    {Math.abs(data.overview.revenueGrowth).toFixed(1)}%
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800">₹{(data.overview.totalRevenue / 1000).toFixed(1)}K</p>
              </div>

              {/* Avg Lead Value */}
              <div className="card bg-gradient-to-br from-orange-50 to-orange-100 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <Star className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-orange-600 flex-shrink-0" />
                </div>
                <p className="text-xs sm:text-sm text-gray-600">Avg Lead Value</p>
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800">₹{data.overview.avgLeadValue.toFixed(0)}</p>
              </div>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
              <div className="card p-4 sm:p-5">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <Clock className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-600">Avg Completion Time</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-800">
                      {data.overview.avgCompletionTime.toFixed(1)} days
                    </p>
                  </div>
                </div>
              </div>

              <div className="card p-4 sm:p-5">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <Users className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-green-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-600">Active Workshops</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-800">12</p>
                  </div>
                </div>
              </div>

              <div className="card p-4 sm:p-5">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <Star className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-600">Avg Satisfaction</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-800">4.2/5</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Leads by Status */}
            <div className="card p-4 sm:p-5 md:p-6">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-brand-primary flex-shrink-0" />
                <span>Leads by Status</span>
              </h3>
              <div className="space-y-2 sm:space-y-3">
                {data.leadsByStatus.sort((a, b) => b.count - a.count).slice(0, 8).map((item) => (
                  <div key={item.status} className="space-y-1">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="font-medium truncate">{item.status.replace(/_/g, ' ')}</span>
                      <span className="text-gray-600 flex-shrink-0 ml-2">{item.count} ({item.percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                      <div
                        className="bg-brand-primary h-1.5 sm:h-2 rounded-full transition-all"
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Charts Placeholder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
              <div className="card p-4 sm:p-5 md:p-6">
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Revenue Trend</h3>
                <div className="h-48 sm:h-56 md:h-64 flex items-center justify-center bg-gray-50 rounded">
                  <p className="text-gray-500 text-xs sm:text-sm md:text-base">Chart visualization coming soon</p>
                </div>
              </div>

              <div className="card p-4 sm:p-5 md:p-6">
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Workshop Performance</h3>
                <div className="h-48 sm:h-56 md:h-64 flex items-center justify-center bg-gray-50 rounded">
                  <p className="text-gray-500 text-xs sm:text-sm md:text-base">Chart visualization coming soon</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

