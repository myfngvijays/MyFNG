'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, 
  Award, Target, Calendar, BarChart3, Activity
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface PerformanceMetrics {
  date: string;
  total_jobs_assigned: number;
  total_jobs_completed: number;
  jobs_in_progress: number;
  jobs_on_hold: number;
  avg_repair_duration: number;
  sla_success_count: number;
  sla_breach_count: number;
  sla_success_rate: number;
  extra_work_requests_count: number;
  extra_work_approved_count: number;
  rework_count: number;
  qc_fail_count: number;
  qc_pass_count: number;
  performance_score: number;
  service_type_stats: any;
}

export default function MechanicPerformancePage() {
  const [todayMetrics, setTodayMetrics] = useState<PerformanceMetrics | null>(null);
  const [weeklyMetrics, setWeeklyMetrics] = useState<PerformanceMetrics[]>([]);
  const [monthlyMetrics, setMonthlyMetrics] = useState<PerformanceMetrics[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  async function fetchPerformanceData() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userProfile) return;

      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Today's metrics
      const { data: todayData } = await supabase
        .from('mechanic_performance_metrics')
        .select('*')
        .eq('mechanic_id', userProfile.id)
        .eq('date', today)
        .single();

      setTodayMetrics(todayData);

      // Weekly metrics
      const { data: weeklyData } = await supabase
        .from('mechanic_performance_metrics')
        .select('*')
        .eq('mechanic_id', userProfile.id)
        .gte('date', weekAgo)
        .order('date', { ascending: false });

      setWeeklyMetrics(weeklyData || []);

      // Monthly metrics
      const { data: monthlyData } = await supabase
        .from('mechanic_performance_metrics')
        .select('*')
        .eq('mechanic_id', userProfile.id)
        .gte('date', monthAgo)
        .order('date', { ascending: false });

      setMonthlyMetrics(monthlyData || []);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching performance data:', error);
      setLoading(false);
    }
  }

  function calculateAverage(metrics: PerformanceMetrics[], field: keyof PerformanceMetrics) {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + (Number(m[field]) || 0), 0);
    return sum / metrics.length;
  }

  function calculateSum(metrics: PerformanceMetrics[], field: keyof PerformanceMetrics) {
    return metrics.reduce((acc, m) => acc + (Number(m[field]) || 0), 0);
  }

  function getPerformanceGrade(score: number) {
    if (score >= 90) return { grade: 'A+', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (score >= 80) return { grade: 'A', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (score >= 70) return { grade: 'B', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    if (score >= 60) return { grade: 'C', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    return { grade: 'D', color: 'text-red-600', bgColor: 'bg-red-100' };
  }

  const currentMetrics = selectedPeriod === 'today' && todayMetrics
    ? [todayMetrics]
    : selectedPeriod === 'week'
    ? weeklyMetrics
    : monthlyMetrics;

  const avgPerformanceScore = calculateAverage(currentMetrics, 'performance_score');
  const avgSLARate = calculateAverage(currentMetrics, 'sla_success_rate');
  const totalCompleted = calculateSum(currentMetrics, 'total_jobs_completed');
  const totalAssigned = calculateSum(currentMetrics, 'total_jobs_assigned');
  const avgDuration = calculateAverage(currentMetrics, 'avg_repair_duration');
  const totalReworks = calculateSum(currentMetrics, 'rework_count');

  const performanceGrade = getPerformanceGrade(avgPerformanceScore);
  const completionRate = totalAssigned > 0 ? (totalCompleted / totalAssigned * 100) : 0;

  if (loading) {
    return (
      <DashboardLayout role="workshop_mechanic">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_mechanic">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-text-heading">Performance Dashboard</h1>
            <p className="text-text-body mt-2">Track your work metrics and KPIs</p>
          </div>
          
          {/* Performance Grade */}
          <div className={`px-6 py-4 rounded-xl ${performanceGrade.bgColor} border-2 border-current ${performanceGrade.color}`}>
            <p className="text-sm font-medium">Overall Grade</p>
            <p className="text-4xl font-bold">{performanceGrade.grade}</p>
            <p className="text-sm">{avgPerformanceScore.toFixed(1)}%</p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex gap-3">
          {(['today', 'week', 'month'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-6 py-3 rounded-lg font-medium capitalize transition ${
                selectedPeriod === period
                  ? 'bg-brand-primary text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {period === 'today' ? 'Today' : period === 'week' ? 'Last 7 Days' : 'Last 30 Days'}
            </button>
          ))}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Jobs Completed */}
          <div className="card bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-center justify-between mb-3">
              <CheckCircle className="w-10 h-10 text-green-600" />
              <span className="text-3xl font-bold text-green-600">{totalCompleted}</span>
            </div>
            <p className="text-sm text-gray-600">Jobs Completed</p>
            <p className="text-xs text-gray-500 mt-1">out of {totalAssigned} assigned</p>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">{completionRate.toFixed(0)}% completion rate</p>
            </div>
          </div>

          {/* SLA Success Rate */}
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="flex items-center justify-between mb-3">
              <Clock className="w-10 h-10 text-blue-600" />
              <span className="text-3xl font-bold text-blue-600">{avgSLARate.toFixed(0)}%</span>
            </div>
            <p className="text-sm text-gray-600">SLA Success Rate</p>
            <p className="text-xs text-gray-500 mt-1">
              {calculateSum(currentMetrics, 'sla_success_count')} on-time / {' '}
              {calculateSum(currentMetrics, 'sla_breach_count')} breached
            </p>
          </div>

          {/* Avg Repair Time */}
          <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
            <div className="flex items-center justify-between mb-3">
              <Activity className="w-10 h-10 text-purple-600" />
              <span className="text-3xl font-bold text-purple-600">{avgDuration.toFixed(0)}m</span>
            </div>
            <p className="text-sm text-gray-600">Avg Repair Time</p>
            <p className="text-xs text-gray-500 mt-1">minutes per job</p>
          </div>

          {/* Quality Score */}
          <div className="card bg-gradient-to-br from-orange-50 to-orange-100">
            <div className="flex items-center justify-between mb-3">
              <Award className="w-10 h-10 text-orange-600" />
              <span className="text-3xl font-bold text-orange-600">
                {totalCompleted > 0 ? ((totalCompleted - totalReworks) / totalCompleted * 100).toFixed(0) : 0}%
              </span>
            </div>
            <p className="text-sm text-gray-600">Quality Score</p>
            <p className="text-xs text-gray-500 mt-1">{totalReworks} reworks needed</p>
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Work Distribution */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-brand-primary" />
              Work Distribution
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Completed</span>
                  <span className="font-semibold text-green-600">{totalCompleted}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full"
                    style={{ width: `${totalAssigned > 0 ? (totalCompleted / totalAssigned * 100) : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">In Progress</span>
                  <span className="font-semibold text-blue-600">
                    {calculateSum(currentMetrics, 'jobs_in_progress')}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full"
                    style={{
                      width: `${totalAssigned > 0 ? (calculateSum(currentMetrics, 'jobs_in_progress') / totalAssigned * 100) : 0}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">On Hold</span>
                  <span className="font-semibold text-yellow-600">
                    {calculateSum(currentMetrics, 'jobs_on_hold')}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-yellow-500 h-3 rounded-full"
                    style={{
                      width: `${totalAssigned > 0 ? (calculateSum(currentMetrics, 'jobs_on_hold') / totalAssigned * 100) : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quality Control */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Target className="w-6 h-6 text-brand-primary" />
              Quality Control
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">QC Passed</p>
                    <p className="text-2xl font-bold text-green-600">
                      {calculateSum(currentMetrics, 'qc_pass_count')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <XCircle className="w-8 h-8 text-red-600" />
                  <div>
                    <p className="text-sm text-gray-600">QC Failed (Rework)</p>
                    <p className="text-2xl font-bold text-red-600">
                      {calculateSum(currentMetrics, 'qc_fail_count')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600 mb-2">First-Time Pass Rate</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-green-500 h-3 rounded-full"
                        style={{
                          width: `${
                            totalCompleted > 0
                              ? ((totalCompleted - totalReworks) / totalCompleted * 100)
                              : 0
                          }%`
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-lg font-bold text-green-600">
                    {totalCompleted > 0
                      ? ((totalCompleted - totalReworks) / totalCompleted * 100).toFixed(0)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Extra Work Stats */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Additional Work Requests</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">
                {calculateSum(currentMetrics, 'extra_work_requests_count')}
              </p>
              <p className="text-sm text-gray-600 mt-1">Total Requests</p>
            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-600">
                {calculateSum(currentMetrics, 'extra_work_approved_count')}
              </p>
              <p className="text-sm text-gray-600 mt-1">Approved</p>
            </div>

            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-3xl font-bold text-purple-600">
                {calculateSum(currentMetrics, 'extra_work_requests_count') > 0
                  ? (
                      (calculateSum(currentMetrics, 'extra_work_approved_count') /
                        calculateSum(currentMetrics, 'extra_work_requests_count')) *
                      100
                    ).toFixed(0)
                  : 0}%
              </p>
              <p className="text-sm text-gray-600 mt-1">Approval Rate</p>
            </div>
          </div>
        </div>

        {/* Performance Trend */}
        {currentMetrics.length > 1 && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-brand-primary" />
              Performance Trend
            </h2>
            <div className="space-y-3">
              {[...currentMetrics].reverse().map((metric, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-gray-600">
                    {new Date(metric.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${
                          metric.performance_score >= 80
                            ? 'bg-green-500'
                            : metric.performance_score >= 60
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${metric.performance_score}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right">
                    <span className="text-sm font-semibold">{metric.performance_score.toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements & Goals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100 border-l-4 border-yellow-500">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <Award className="w-6 h-6 text-yellow-600" />
              Achievements
            </h3>
            <ul className="space-y-2">
              {avgSLARate >= 90 && (
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>90%+ SLA Success Rate</span>
                </li>
              )}
              {totalCompleted >= 10 && (
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Completed {totalCompleted} jobs</span>
                </li>
              )}
              {totalReworks === 0 && totalCompleted > 0 && (
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Zero Rework - Perfect Quality!</span>
                </li>
              )}
              {avgPerformanceScore >= 90 && (
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Top Performer (A+ Grade)</span>
                </li>
              )}
            </ul>
          </div>

          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <Target className="w-6 h-6 text-blue-600" />
              Goals & Targets
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span>SLA Success Target:</span>
                <span className="font-semibold">90%</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Daily Job Target:</span>
                <span className="font-semibold">5 jobs</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Quality Target:</span>
                <span className="font-semibold">&lt;10% rework</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Performance Target:</span>
                <span className="font-semibold">80%+</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

