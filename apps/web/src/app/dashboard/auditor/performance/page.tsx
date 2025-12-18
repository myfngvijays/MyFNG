'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { formatDateDMY } from "@/lib/utils";
import { 
  TrendingUp, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Target,
  BarChart3,
  Calendar,
  Loader2,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AuditorPerformancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    fetchPerformance();
  }, [period]);

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const params = new URLSearchParams();
      params.append('period', period);

      const response = await fetch(`/api/auditor/performance?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch performance data');
      }

      const data = await response.json();
      setMetrics(data);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching performance:', error);
      toast.error('Failed to load performance data');
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <DashboardLayout role="auditor">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
              <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-indigo-600 flex-shrink-0" />
              <span>Performance Metrics</span>
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">Track your audit performance and KPIs</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 sm:h-64">
            <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-indigo-600" />
          </div>
        ) : metrics ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow border-l-4 border-indigo-500">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <div className="text-xs sm:text-sm text-gray-600">Completion Rate</div>
                  <Target className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 flex-shrink-0" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {metrics.metrics.completion_rate.toFixed(1)}%
                </div>
                <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                  {metrics.metrics.audits_completed} / {metrics.metrics.audits_scheduled} audits
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow border-l-4 border-green-500">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <div className="text-xs sm:text-sm text-gray-600">Audits Completed</div>
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {metrics.metrics.audits_completed}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                  {metrics.metrics.audits_per_day.toFixed(1)} per day
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow border-l-4 border-blue-500">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <div className="text-xs sm:text-sm text-gray-600">Avg Duration</div>
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {formatDuration(metrics.metrics.avg_audit_duration)}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                  {formatDuration(metrics.metrics.total_audit_time)} total
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow border-l-4 border-purple-500 sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <div className="text-xs sm:text-sm text-gray-600">Workshops Passed</div>
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500 flex-shrink-0" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {metrics.metrics.workshops_passed}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                  {metrics.metrics.workshops_failed} failed
                </div>
              </div>
            </div>

            {/* Detailed Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
              {/* Audit Statistics */}
              <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow">
                <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 flex-shrink-0" />
                  Audit Statistics
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">Scheduled</span>
                    <span className="text-base sm:text-lg font-semibold">{metrics.metrics.audits_scheduled}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">Completed</span>
                    <span className="text-base sm:text-lg font-semibold text-green-600">{metrics.metrics.audits_completed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">In Progress</span>
                    <span className="text-base sm:text-lg font-semibold text-blue-600">{metrics.metrics.audits_in_progress}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">Cancelled</span>
                    <span className="text-base sm:text-lg font-semibold text-gray-600">{metrics.metrics.audits_cancelled}</span>
                  </div>
                </div>
              </div>

              {/* Quality Metrics */}
              <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow">
                <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                  <Target className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 flex-shrink-0" />
                  Quality Metrics
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">Workshops Passed</span>
                    <span className="text-base sm:text-lg font-semibold text-green-600">{metrics.metrics.workshops_passed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">Workshops Failed</span>
                    <span className="text-base sm:text-lg font-semibold text-red-600">{metrics.metrics.workshops_failed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">Follow-ups Required</span>
                    <span className="text-base sm:text-lg font-semibold text-yellow-600">{metrics.metrics.follow_ups_required}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">Critical Issues</span>
                    <span className="text-base sm:text-lg font-semibold text-red-600">{metrics.metrics.critical_issues_identified}</span>
                  </div>
                </div>
              </div>

              {/* Action Items */}
              <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow">
                <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 flex-shrink-0" />
                  Action Items
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">Created</span>
                    <span className="text-base sm:text-lg font-semibold">{metrics.metrics.action_items_created}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">Verified</span>
                    <span className="text-base sm:text-lg font-semibold text-green-600">{metrics.metrics.action_items_verified}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">Verification Rate</span>
                    <span className="text-base sm:text-lg font-semibold">
                      {metrics.metrics.action_items_created > 0
                        ? ((metrics.metrics.action_items_verified / metrics.metrics.action_items_created) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Trends */}
              <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow">
                <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 flex-shrink-0" />
                  Trends
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">Audits Completed Trend</span>
                    <div className="flex items-center gap-1">
                      {metrics.trends.audits_completed > 0 ? (
                        <>
                          <ArrowUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                          <span className="text-base sm:text-lg font-semibold text-green-600">
                            +{metrics.trends.audits_completed.toFixed(1)}%
                          </span>
                        </>
                      ) : (
                        <>
                          <ArrowDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600 flex-shrink-0" />
                          <span className="text-base sm:text-lg font-semibold text-red-600">
                            {metrics.trends.audits_completed.toFixed(1)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-500">
                    Compared to previous period
                  </div>
                </div>
              </div>
            </div>

            {/* Period Info */}
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>
                  Period: {formatDateDMY(metrics.period.start)} - {formatDateDMY(metrics.period.end)} ({metrics.period.days} days)
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 sm:py-10 md:py-12">
            <p className="text-gray-600 text-sm sm:text-base">No performance data available</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

