'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { TrendingUp, CheckCircle, Clock, AlertTriangle, BarChart3, Download } from 'lucide-react';
import { AdvisorPageHeader } from '@/components/advisor/AdvisorPageHeader';

export default function SupervisorAnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      const response = await fetch(`/api/supervisor/analytics?days=${days}`);
      const result = await response.json();
      if (result.success) {
        setAnalytics(result.data);
      }
    } catch (error) {
      console.error('Analytics fetch error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !analytics) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="text-center py-8 sm:py-10 md:py-12">Loading analytics...</div>
      </DashboardLayout>
    );
  }

  const { kpis } = analytics;

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-3 overflow-x-hidden pb-8 sm:space-y-4">
        <AdvisorPageHeader
          title="Analytics"
          subtitle="KPIs and team performance"
          href="/dashboard/workshop-advisor/analytics"
          right={
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <select
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value))}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800"
              >
                <option value={7} className="text-slate-900">Last 7 days</option>
                <option value={30} className="text-slate-900">Last 30 days</option>
                <option value={90} className="text-slate-900">Last 90 days</option>
              </select>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#023D95] px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#012f73]"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          }
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-blue-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Total Jobs</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold">{kpis.totalJobs}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-green-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Completed</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold">{kpis.completedJobs}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-[#004AAD] flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Avg Time</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold">{kpis.avgCompletionTime}h</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-teal-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">QC Pass Rate</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold">{kpis.qcPassRate}%</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-orange-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">SLA Compliance</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold">{kpis.slaCompliance}%</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-red-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Pending</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold">{kpis.pendingApprovals}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 md:p-5">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Job Status Distribution</h3>
            <div className="h-48 sm:h-56 md:h-64 flex items-center justify-center bg-gray-50 rounded">
              <p className="text-gray-500 text-xs sm:text-sm">Pie Chart - Status Distribution</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 md:p-5">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Daily Throughput</h3>
            <div className="h-48 sm:h-56 md:h-64 flex items-center justify-center bg-gray-50 rounded">
              <p className="text-gray-500 text-xs sm:text-sm">Line Chart - Daily Jobs</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

