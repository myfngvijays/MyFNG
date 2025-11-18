'use client';

/**
 * Workshop Admin Reports & Analytics Dashboard
 * Phase 3 - Task 3.2: Reporting Dashboard
 * 
 * Metrics:
 * - Average lead acceptance time
 * - Average repair time
 * - Pending pickups/charges
 * - Completed jobs count
 * - Audit pass rate
 * - 7 & 30 day performance stats
 */

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Wrench,
  Calendar,
  Download,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [metrics, setMetrics] = useState<any>(null);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [acceptanceTimeData, setAcceptanceTimeData] = useState<any[]>([]);
  const [dailyLeadsData, setDailyLeadsData] = useState<any[]>([]);

  useEffect(() => {
    fetchReportsData();
  }, [dateRange]);

  async function fetchReportsData() {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's workshop
      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('id', user.id)
        .single();

      if (!userProfile?.workshop_id) return;

      // Calculate date range
      const daysAgo = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Fetch all leads in date range
      const { data: leads } = await supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', userProfile.workshop_id)
        .gte('created_at', startDate.toISOString());

      if (!leads) return;

      // Calculate metrics
      const totalLeads = leads.length;
      const acceptedLeads = leads.filter(l => l.status !== 'NEW' && l.status !== 'REJECTED');
      const completedLeads = leads.filter(l => l.status === 'CLOSED' || l.status === 'DELIVERED');
      const rejectedLeads = leads.filter(l => l.status === 'REJECTED');

      // Average acceptance time (NEW to ACCEPTED)
      const acceptanceTimes = leads
        .filter(l => l.accepted_at && l.created_at)
        .map(l => {
          const created = new Date(l.created_at).getTime();
          const accepted = new Date(l.accepted_at).getTime();
          return (accepted - created) / (1000 * 60); // minutes
        });
      
      const avgAcceptanceTime = acceptanceTimes.length > 0
        ? Math.round(acceptanceTimes.reduce((a, b) => a + b, 0) / acceptanceTimes.length)
        : 0;

      // Average repair time (ACCEPTED to COMPLETED)
      const repairTimes = leads
        .filter(l => l.accepted_at && (l.status === 'CLOSED' || l.status === 'DELIVERED'))
        .map(l => {
          const accepted = new Date(l.accepted_at).getTime();
          const completed = new Date(l.updated_at).getTime();
          return (completed - accepted) / (1000 * 60 * 60); // hours
        });
      
      const avgRepairTime = repairTimes.length > 0
        ? Math.round(repairTimes.reduce((a, b) => a + b, 0) / repairTimes.length)
        : 0;

      // Pending items
      const pendingPickups = leads.filter(l => 
        l.pickup_required && !l.assigned_pickup_boy_id
      ).length;

      // Fetch extra charges
      const { data: extraCharges } = await supabase
        .from('lead_extra_charges')
        .select('*')
        .in('lead_id', leads.map(l => l.id))
        .eq('status', 'PENDING');

      const pendingExtraCharges = extraCharges?.length || 0;

      // Fetch audits
      const { data: audits } = await supabase
        .from('audits')
        .select('*')
        .in('lead_id', completedLeads.map(l => l.id))
        .eq('audit_status', 'COMPLETED');

      const auditPassRate = audits && audits.length > 0
        ? Math.round((audits.length / completedLeads.length) * 100)
        : 0;

      // SLA compliance
      const slaCompliant = leads.filter(l => 
        l.sla_status === 'ON_TIME' || !l.sla_status
      ).length;
      const slaComplianceRate = totalLeads > 0
        ? Math.round((slaCompliant / totalLeads) * 100)
        : 0;

      setMetrics({
        totalLeads,
        acceptedLeads: acceptedLeads.length,
        completedLeads: completedLeads.length,
        rejectedLeads: rejectedLeads.length,
        avgAcceptanceTime,
        avgRepairTime,
        pendingPickups,
        pendingExtraCharges,
        auditPassRate,
        slaComplianceRate,
      });

      // Status distribution for pie chart
      const statusCounts: any = {};
      leads.forEach(lead => {
        const status = lead.status || 'UNKNOWN';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const statusChartData = Object.entries(statusCounts).map(([status, count]) => ({
        name: status.replace(/_/g, ' '),
        value: count as number,
      }));

      setStatusData(statusChartData);

      // Acceptance time trend (daily)
      const dailyAcceptance: any = {};
      leads
        .filter(l => l.accepted_at && l.created_at)
        .forEach(l => {
          const day = new Date(l.accepted_at).toLocaleDateString();
          const created = new Date(l.created_at).getTime();
          const accepted = new Date(l.accepted_at).getTime();
          const minutes = (accepted - created) / (1000 * 60);
          
          if (!dailyAcceptance[day]) {
            dailyAcceptance[day] = { total: 0, count: 0 };
          }
          dailyAcceptance[day].total += minutes;
          dailyAcceptance[day].count += 1;
        });

      const acceptanceChartData = Object.entries(dailyAcceptance)
        .map(([date, data]: [string, any]) => ({
          date,
          avgMinutes: Math.round(data.total / data.count),
        }))
        .slice(-14); // Last 14 days

      setAcceptanceTimeData(acceptanceChartData);

      // Daily leads count
      const dailyCounts: any = {};
      leads.forEach(l => {
        const day = new Date(l.created_at).toLocaleDateString();
        dailyCounts[day] = (dailyCounts[day] || 0) + 1;
      });

      const dailyChartData = Object.entries(dailyCounts)
        .map(([date, count]) => ({ date, count }))
        .slice(-14); // Last 14 days

      setDailyLeadsData(dailyChartData);

    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  }

  function exportReport() {
    if (!metrics) return;

    const csvContent = `
Workshop Performance Report
Date Range: ${dateRange}
Generated: ${new Date().toLocaleString()}

Key Metrics:
Total Leads,${metrics.totalLeads}
Accepted Leads,${metrics.acceptedLeads}
Completed Leads,${metrics.completedLeads}
Rejected Leads,${metrics.rejectedLeads}
Avg Acceptance Time (mins),${metrics.avgAcceptanceTime}
Avg Repair Time (hrs),${metrics.avgRepairTime}
Pending Pickups,${metrics.pendingPickups}
Pending Extra Charges,${metrics.pendingExtraCharges}
Audit Pass Rate (%),${metrics.auditPassRate}
SLA Compliance Rate (%),${metrics.slaComplianceRate}
    `.trim();

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workshop-report-${dateRange}-${Date.now()}.csv`;
    a.click();
  }

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  return (
    <DashboardLayout role="WORKSHOP_ADMIN">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-600 mt-1">Workshop performance insights and metrics</p>
          </div>
          <div className="flex gap-3">
            {/* Date Range Filter */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>

            <button
              onClick={exportReport}
              disabled={loading}
              className="btn btn-primary"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Leads */}
              <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">Total Leads</p>
                    <p className="text-4xl font-bold mt-2">{metrics?.totalLeads || 0}</p>
                  </div>
                  <TrendingUp className="w-12 h-12 opacity-80" />
                </div>
              </div>

              {/* Completed Leads */}
              <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">Completed</p>
                    <p className="text-4xl font-bold mt-2">{metrics?.completedLeads || 0}</p>
                  </div>
                  <CheckCircle className="w-12 h-12 opacity-80" />
                </div>
              </div>

              {/* Avg Acceptance Time */}
              <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm">Avg Accept Time</p>
                    <p className="text-4xl font-bold mt-2">{metrics?.avgAcceptanceTime || 0}<span className="text-lg">m</span></p>
                  </div>
                  <Clock className="w-12 h-12 opacity-80" />
                </div>
              </div>

              {/* SLA Compliance */}
              <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm">SLA Compliance</p>
                    <p className="text-4xl font-bold mt-2">{metrics?.slaComplianceRate || 0}%</p>
                  </div>
                  <AlertCircle className="w-12 h-12 opacity-80" />
                </div>
              </div>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card">
                <div className="flex items-center gap-3 mb-2">
                  <Wrench className="w-5 h-5 text-brand-primary" />
                  <h3 className="font-semibold">Avg Repair Time</h3>
                </div>
                <p className="text-3xl font-bold">{metrics?.avgRepairTime || 0} hrs</p>
              </div>

              <div className="card">
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  <h3 className="font-semibold">Pending Pickups</h3>
                </div>
                <p className="text-3xl font-bold">{metrics?.pendingPickups || 0}</p>
              </div>

              <div className="card">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <h3 className="font-semibold">Audit Pass Rate</h3>
                </div>
                <p className="text-3xl font-bold">{metrics?.auditPassRate || 0}%</p>
              </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Distribution Pie Chart */}
              <div className="card">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-brand-primary" />
                  Lead Status Distribution
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Daily Leads Bar Chart */}
              <div className="card">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-brand-primary" />
                  Daily Leads (Last 14 Days)
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyLeadsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="card">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-brand-primary" />
                Acceptance Time Trend (Last 14 Days)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={acceptanceTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="avgMinutes" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    name="Avg Acceptance Time (min)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Performance Summary */}
            <div className="card">
              <h3 className="text-lg font-bold mb-4">Performance Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Accepted Rate</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {metrics?.totalLeads > 0 
                      ? Math.round((metrics.acceptedLeads / metrics.totalLeads) * 100)
                      : 0}%
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Completion Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {metrics?.acceptedLeads > 0 
                      ? Math.round((metrics.completedLeads / metrics.acceptedLeads) * 100)
                      : 0}%
                  </p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-600">Pending Charges</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {metrics?.pendingExtraCharges || 0}
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">Rejected Rate</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {metrics?.totalLeads > 0 
                      ? Math.round((metrics.rejectedLeads / metrics.totalLeads) * 100)
                      : 0}%
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

