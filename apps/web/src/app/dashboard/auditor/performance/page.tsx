'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-indigo-600" />
              Performance Metrics
            </h1>
            <p className="text-gray-600 mt-1">Track your audit performance and KPIs</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : metrics ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-600">Completion Rate</div>
                  <Target className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {metrics.metrics.completion_rate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {metrics.metrics.audits_completed} / {metrics.metrics.audits_scheduled} audits
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-600">Audits Completed</div>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {metrics.metrics.audits_completed}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {metrics.metrics.audits_per_day.toFixed(1)} per day
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-600">Avg Duration</div>
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {formatDuration(metrics.metrics.avg_audit_duration)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatDuration(metrics.metrics.total_audit_time)} total
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-600">Workshops Passed</div>
                  <CheckCircle className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {metrics.metrics.workshops_passed}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {metrics.metrics.workshops_failed} failed
                </div>
              </div>
            </div>

            {/* Detailed Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Audit Statistics */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Audit Statistics
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Scheduled</span>
                    <span className="text-lg font-semibold">{metrics.metrics.audits_scheduled}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Completed</span>
                    <span className="text-lg font-semibold text-green-600">{metrics.metrics.audits_completed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">In Progress</span>
                    <span className="text-lg font-semibold text-blue-600">{metrics.metrics.audits_in_progress}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Cancelled</span>
                    <span className="text-lg font-semibold text-gray-600">{metrics.metrics.audits_cancelled}</span>
                  </div>
                </div>
              </div>

              {/* Quality Metrics */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-600" />
                  Quality Metrics
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Workshops Passed</span>
                    <span className="text-lg font-semibold text-green-600">{metrics.metrics.workshops_passed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Workshops Failed</span>
                    <span className="text-lg font-semibold text-red-600">{metrics.metrics.workshops_failed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Follow-ups Required</span>
                    <span className="text-lg font-semibold text-yellow-600">{metrics.metrics.follow_ups_required}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Critical Issues</span>
                    <span className="text-lg font-semibold text-red-600">{metrics.metrics.critical_issues_identified}</span>
                  </div>
                </div>
              </div>

              {/* Action Items */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-indigo-600" />
                  Action Items
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Created</span>
                    <span className="text-lg font-semibold">{metrics.metrics.action_items_created}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Verified</span>
                    <span className="text-lg font-semibold text-green-600">{metrics.metrics.action_items_verified}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Verification Rate</span>
                    <span className="text-lg font-semibold">
                      {metrics.metrics.action_items_created > 0
                        ? ((metrics.metrics.action_items_verified / metrics.metrics.action_items_created) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Trends */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  Trends
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Audits Completed Trend</span>
                    <div className="flex items-center gap-1">
                      {metrics.trends.audits_completed > 0 ? (
                        <>
                          <ArrowUp className="w-4 h-4 text-green-600" />
                          <span className="text-lg font-semibold text-green-600">
                            +{metrics.trends.audits_completed.toFixed(1)}%
                          </span>
                        </>
                      ) : (
                        <>
                          <ArrowDown className="w-4 h-4 text-red-600" />
                          <span className="text-lg font-semibold text-red-600">
                            {metrics.trends.audits_completed.toFixed(1)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Compared to previous period
                  </div>
                </div>
              </div>
            </div>

            {/* Period Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>
                  Period: {new Date(metrics.period.start).toLocaleDateString()} - {new Date(metrics.period.end).toLocaleDateString()} ({metrics.period.days} days)
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600">No performance data available</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

