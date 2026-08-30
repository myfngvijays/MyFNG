'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateDMY } from '@/lib/utils';
import {
  TrendingUp, Clock, CheckCircle, XCircle,
  Award, Target, BarChart3, Activity
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  WorkshopPageHeader,
  WorkshopPageShell,
  WorkshopStatTile,
} from '@/components/workshop/WorkshopUi';
import WorkshopDateFilter, { isoInRange } from '@/components/workshop/WorkshopDateFilter';
import { istYmd, resolveCrmDateRange, type CrmDatePreset } from '@/lib/telecaller/crmDateRange';

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
  const [allMetrics, setAllMetrics] = useState<PerformanceMetrics[]>([]);
  const [jobRows, setJobRows] = useState<any[]>([]);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>('today');
  const [customStart, setCustomStart] = useState(istYmd());
  const [customEnd, setCustomEnd] = useState(istYmd());
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

      const { data: allData } = await supabase
        .from('mechanic_performance_metrics')
        .select('*')
        .eq('mechanic_id', userProfile.id)
        .order('date', { ascending: false })
        .limit(365);
      setAllMetrics(allData || []);

      const { data: jobs } = await supabase
        .from('mechanic_jobs')
        .select('mechanic_status, assigned_at, started_at, completed_at, created_at, estimated_completion_time, actual_work_duration, efficiency_score')
        .eq('mechanic_id', userProfile.id)
        .limit(300);
      setJobRows(jobs || []);

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

  const dateRange = resolveCrmDateRange(datePreset, customStart, customEnd);
  const currentMetrics =
    datePreset === 'today' && todayMetrics
      ? [todayMetrics]
      : datePreset === 'last_7_days'
        ? weeklyMetrics
        : datePreset === 'all_time'
          ? allMetrics
          : monthlyMetrics;

  const scopedJobs = jobRows.filter((j: any) =>
    isoInRange(
      j.completed_at || j.started_at || j.assigned_at || j.created_at,
      dateRange.start,
      dateRange.end,
      dateRange.allTime,
    ),
  );
  const doneJobs = scopedJobs.filter((j: any) =>
    ['COMPLETED', 'READY_FOR_DELIVERY'].includes(String(j.mechanic_status || '').toUpperCase()),
  );
  const timedJobs = doneJobs.filter((j: any) => j.started_at && j.completed_at);
  const jobOnTime = timedJobs.filter((j: any) => {
    if (!j.estimated_completion_time) return (Number(j.efficiency_score) || 0) >= 80;
    return new Date(j.completed_at).getTime() <= new Date(j.estimated_completion_time).getTime();
  }).length;
  const jobFallback = {
    assigned: scopedJobs.length,
    completed: doneJobs.length,
    inProgress: scopedJobs.filter((j: any) => String(j.mechanic_status).toUpperCase() === 'IN_PROGRESS').length,
    onHold: scopedJobs.filter((j: any) =>
      ['HOLD', 'WAITING_APPROVAL'].includes(String(j.mechanic_status).toUpperCase()),
    ).length,
    avgHours: timedJobs.length
      ? timedJobs.reduce(
          (sum: number, j: any) =>
            sum + (new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()),
          0,
        ) /
        timedJobs.length /
        3600000
      : 0,
    onTime: timedJobs.length ? (jobOnTime / timedJobs.length) * 100 : 0,
    quality: doneJobs.length
      ? doneJobs.reduce((s: number, j: any) => s + (Number(j.efficiency_score) || 0), 0) / doneJobs.length
      : 0,
  };

  const jobOverall =
    jobFallback.assigned > 0
      ? Math.round(
          (jobFallback.completed / jobFallback.assigned) * 100 * 0.4 +
            jobFallback.onTime * 0.3 +
            jobFallback.quality * 0.3,
        )
      : 0;
  const metricsEmpty = currentMetrics.length === 0;
  const avgPerformanceScore = metricsEmpty ? jobOverall : calculateAverage(currentMetrics, 'performance_score');
  const avgSLARate = metricsEmpty ? jobFallback.onTime : calculateAverage(currentMetrics, 'sla_success_rate');
  const totalCompleted = metricsEmpty ? jobFallback.completed : calculateSum(currentMetrics, 'total_jobs_completed');
  const totalAssigned = metricsEmpty ? jobFallback.assigned : calculateSum(currentMetrics, 'total_jobs_assigned');
  const avgDuration = metricsEmpty ? jobFallback.avgHours * 60 : calculateAverage(currentMetrics, 'avg_repair_duration');
  const totalReworks = calculateSum(currentMetrics, 'rework_count');

  const performanceGrade = getPerformanceGrade(avgPerformanceScore);
  const completionRate = totalAssigned > 0 ? (totalCompleted / totalAssigned * 100) : 0;

  if (loading) {
    return (
      <DashboardLayout role="workshop_mechanic">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#004AAD]"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_mechanic">
      <WorkshopPageShell>
        <WorkshopPageHeader
          eyebrow="Workshop Mechanic"
          title="Performance Dashboard"
          subtitle="Track your work metrics and KPIs"
          right={
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#004AAD]/70">Overall Grade</p>
              <p className={`text-2xl font-extrabold ${performanceGrade.color || 'text-[#023D95]'}`}>{performanceGrade.grade}</p>
              <p className="text-xs text-slate-500">{avgPerformanceScore.toFixed(1)}%</p>
            </div>
          }
        />

        <WorkshopDateFilter
          preset={datePreset}
          customStart={customStart}
          customEnd={customEnd}
          onChange={({ datePreset: next, customStart: s, customEnd: e }) => {
            setDatePreset(next);
            setCustomStart(s);
            setCustomEnd(e);
          }}
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <WorkshopStatTile label="Jobs completed" value={totalCompleted} tone="from-green-50" />
          <WorkshopStatTile label="Assigned" value={totalAssigned} tone="from-blue-50" />
          <WorkshopStatTile label="SLA / On-time" value={`${avgSLARate.toFixed(0)}%`} />
          <WorkshopStatTile
            label="Avg repair"
            value={avgDuration >= 60 ? `${(avgDuration / 60).toFixed(1)}h` : `${avgDuration.toFixed(0)}m`}
            tone="from-purple-50"
          />
        </div>

        {metricsEmpty ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <WorkshopStatTile label="In progress" value={jobFallback.inProgress} tone="from-yellow-50" />
            <WorkshopStatTile label="On hold" value={jobFallback.onHold} tone="from-orange-50" />
            <WorkshopStatTile label="Quality" value={`${jobFallback.quality.toFixed(0)}%`} tone="from-green-50" />
            <WorkshopStatTile label="Overall" value={`${jobOverall}%`} />
          </div>
        ) : null}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
          {/* Jobs Completed */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm bg-gradient-to-br from-green-50 to-green-100 p-3 sm:p-4 md:p-5">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 text-green-600 flex-shrink-0" />
              <span className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">{totalCompleted}</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600">Jobs Completed</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">out of {totalAssigned} assigned</p>
            <div className="mt-1.5 sm:mt-2">
              <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                <div
                  className="bg-green-600 h-1.5 sm:h-2 rounded-full transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1">{completionRate.toFixed(0)}% completion rate</p>
            </div>
          </div>

          {/* SLA Success Rate */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 p-3 sm:p-4 md:p-5">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <Clock className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 text-blue-600 flex-shrink-0" />
              <span className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600">{avgSLARate.toFixed(0)}%</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600">SLA Success Rate</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
              {calculateSum(currentMetrics, 'sla_success_count')} on-time / {' '}
              {calculateSum(currentMetrics, 'sla_breach_count')} breached
            </p>
          </div>

          {/* Avg Repair Time */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm bg-gradient-to-br from-purple-50 to-purple-100 p-3 sm:p-4 md:p-5">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <Activity className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 text-purple-600 flex-shrink-0" />
              <span className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-600">{avgDuration.toFixed(0)}m</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600">Avg Repair Time</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">minutes per job</p>
          </div>

          {/* Quality Score */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm bg-gradient-to-br from-orange-50 to-orange-100 p-3 sm:p-4 md:p-5">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <Award className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 text-orange-600 flex-shrink-0" />
              <span className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-600">
                {totalCompleted > 0 ? ((totalCompleted - totalReworks) / totalCompleted * 100).toFixed(0) : 0}%
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600">Quality Score</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">{totalReworks} reworks needed</p>
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          {/* Work Distribution */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3 sm:p-4 md:p-5">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-brand-primary flex-shrink-0" />
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
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3 sm:p-4 md:p-5">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
              <Target className="w-5 h-5 sm:w-6 sm:h-6 text-brand-primary flex-shrink-0" />
              Quality Control
            </h2>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between p-3 sm:p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 sm:gap-3">
                  <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">QC Passed</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">
                      {calculateSum(currentMetrics, 'qc_pass_count')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 sm:p-4 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2 sm:gap-3">
                  <XCircle className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">QC Failed (Rework)</p>
                    <p className="text-xl sm:text-2xl font-bold text-red-600">
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

        {/* Additional Jobs Stats */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3 sm:p-4 md:p-5">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Additional Work Requests</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg">
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600">
                {calculateSum(currentMetrics, 'extra_work_requests_count')}
              </p>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Total Requests</p>
            </div>

            <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg">
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">
                {calculateSum(currentMetrics, 'extra_work_approved_count')}
              </p>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Approved</p>
            </div>

            <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg">
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-600">
                {calculateSum(currentMetrics, 'extra_work_requests_count') > 0
                  ? (
                      (calculateSum(currentMetrics, 'extra_work_approved_count') /
                        calculateSum(currentMetrics, 'extra_work_requests_count')) *
                      100
                    ).toFixed(0)
                  : 0}%
              </p>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Approval Rate</p>
            </div>
          </div>
        </div>

        {/* Performance Trend */}
        {currentMetrics.length > 1 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3 sm:p-4 md:p-5">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-brand-primary flex-shrink-0" />
              Performance Trend
            </h2>
            <div className="space-y-2 sm:space-y-3">
              {[...currentMetrics].reverse().map((metric, index) => (
                <div key={index} className="flex items-center gap-2 sm:gap-3 md:gap-4">
                  <div className="w-16 sm:w-20 md:w-24 text-xs sm:text-sm text-gray-600 flex-shrink-0">
                    {formatDateDMY(metric.date)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
                      <div
                        className={`h-2 sm:h-3 rounded-full ${
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
                  <div className="w-12 sm:w-14 md:w-16 text-right flex-shrink-0">
                    <span className="text-xs sm:text-sm font-semibold">{metric.performance_score.toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements & Goals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm bg-gradient-to-br from-yellow-50 to-yellow-100 border-l-4 border-yellow-500 p-3 sm:p-4 md:p-5">
            <h3 className="font-bold text-base sm:text-lg mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
              <Award className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 flex-shrink-0" />
              Achievements
            </h3>
            <ul className="space-y-1.5 sm:space-y-2">
              {avgSLARate >= 90 && (
                <li className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                  <span>90%+ SLA Success Rate</span>
                </li>
              )}
              {totalCompleted >= 10 && (
                <li className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                  <span>Completed {totalCompleted} jobs</span>
                </li>
              )}
              {totalReworks === 0 && totalCompleted > 0 && (
                <li className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                  <span>Zero Rework - Perfect Quality!</span>
                </li>
              )}
              {avgPerformanceScore >= 90 && (
                <li className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                  <span>Top Performer (A+ Grade)</span>
                </li>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500 p-3 sm:p-4 md:p-5">
            <h3 className="font-bold text-base sm:text-lg mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
              <Target className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />
              Goals & Targets
            </h3>
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
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
      </WorkshopPageShell>
    </DashboardLayout>
  );
}

