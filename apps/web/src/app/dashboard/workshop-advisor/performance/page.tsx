'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { TrendingUp, TrendingDown, Users, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { AdvisorPageHeader } from '@/components/advisor/AdvisorPageHeader';

export default function PerformancePage() {
  const [stats, setStats] = useState({
    total_jobs_completed: 0,
    avg_completion_time: 0,
    sla_compliance_rate: 0,
    customer_satisfaction: 0,
    jobs_this_week: 0,
    jobs_this_month: 0
  });
  const [weeklyTrend, setWeeklyTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformanceData();

    // Setup realtime subscription for performance updates
    const supabase = createClient();
    const channel = supabase
      .channel('performance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_jobs'
        },
        (payload) => {
          console.log('Performance data update:', payload);
          fetchPerformanceData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_performance_metrics'
        },
        (payload) => {
          console.log('Metrics update:', payload);
          fetchPerformanceData();
        }
      )
      .subscribe((status) => {
        console.log('Performance analytics realtime subscription:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchPerformanceData() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id, workshop_id')
        .eq('email', user.email)
        .single();

      if (!userProfile || !userProfile.workshop_id) return;

      // Get all completed jobs count
      const { count: totalCompleted } = await supabase
        .from('mechanic_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('mechanic_status', 'COMPLETED');

      // Get this week's jobs
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const { count: thisWeek } = await supabase
        .from('mechanic_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('mechanic_status', 'COMPLETED')
        .gte('completed_at', weekStart.toISOString());

      // Get this month's jobs
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { count: thisMonth } = await supabase
        .from('mechanic_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('mechanic_status', 'COMPLETED')
        .gte('completed_at', monthStart.toISOString());

      // Calculate average metrics
      const { data: completedJobs } = await supabase
        .from('mechanic_jobs')
        .select('started_at, completed_at, sla_remaining_minutes')
        .eq('mechanic_status', 'COMPLETED')
        .not('started_at', 'is', null)
        .not('completed_at', 'is', null)
        .limit(100);

      let avgCompletionTime = 0;
      let slaCompliance = 0;

      if (completedJobs && completedJobs.length > 0) {
        const totalTime = completedJobs.reduce((sum, job) => {
          const start = new Date(job.started_at!);
          const end = new Date(job.completed_at!);
          return sum + (end.getTime() - start.getTime());
        }, 0);
        avgCompletionTime = Math.round((totalTime / completedJobs.length) / (1000 * 60 * 60)); // Convert to hours

        const onTimeJobs = completedJobs.filter(job => 
          job.sla_remaining_minutes === null || job.sla_remaining_minutes >= 0
        ).length;
        slaCompliance = Math.round((onTimeJobs / completedJobs.length) * 100);
      }

      setStats({
        total_jobs_completed: totalCompleted || 0,
        avg_completion_time: avgCompletionTime,
        sla_compliance_rate: slaCompliance,
        customer_satisfaction: 85, // TODO: Implement customer feedback
        jobs_this_week: thisWeek || 0,
        jobs_this_month: thisMonth || 0
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching performance data:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="w-full max-w-full min-w-0 space-y-4 sm:space-y-5">
        <AdvisorPageHeader
          title="Performance"
          subtitle="Team output, SLA, and areas to improve"
          href="/dashboard/workshop-advisor/analytics"
        />

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 p-3 sm:p-4 md:p-5">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-600 flex-shrink-0" />
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
            </div>
            <p className="text-xs sm:text-sm text-gray-600">Total Completed</p>
            <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.total_jobs_completed}</p>
            <p className="text-[10px] sm:text-xs text-green-600 mt-0.5 sm:mt-1">All time</p>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100 p-3 sm:p-4 md:p-5">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <Clock className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-green-600 flex-shrink-0" />
              <span className="text-[10px] sm:text-xs text-gray-600">avg</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600">Completion Time</p>
            <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.avg_completion_time}h</p>
            <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1">Per job</p>
          </div>

          <div className="card bg-gradient-to-br from-purple-50 to-purple-100 p-3 sm:p-4 md:p-5 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-purple-600 flex-shrink-0" />
              <span className={`text-[10px] sm:text-xs ${stats.sla_compliance_rate >= 80 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.sla_compliance_rate >= 80 ? '↑' : '↓'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600">SLA Compliance</p>
            <p className="text-2xl sm:text-3xl font-bold text-purple-600">{stats.sla_compliance_rate}%</p>
            <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1">On-time completion</p>
          </div>
        </div>

        {/* Period Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="card p-3 sm:p-4">
            <h3 className="font-semibold text-gray-600 mb-1.5 sm:mb-2 text-xs sm:text-sm">This Week</h3>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xl sm:text-2xl font-bold">{stats.jobs_this_week}</p>
                <p className="text-xs sm:text-sm text-gray-600">Jobs Completed</p>
              </div>
            </div>
          </div>

          <div className="card p-3 sm:p-4">
            <h3 className="font-semibold text-gray-600 mb-1.5 sm:mb-2 text-xs sm:text-sm">This Month</h3>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xl sm:text-2xl font-bold">{stats.jobs_this_month}</p>
                <p className="text-xs sm:text-sm text-gray-600">Jobs Completed</p>
              </div>
            </div>
          </div>

          <div className="card p-3 sm:p-4 sm:col-span-2 lg:col-span-1">
            <h3 className="font-semibold text-gray-600 mb-1.5 sm:mb-2 text-xs sm:text-sm">Customer Satisfaction</h3>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xl sm:text-2xl font-bold">{stats.customer_satisfaction}%</p>
                <p className="text-xs sm:text-sm text-gray-600">Average Rating</p>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          <div className="card p-3 sm:p-4 md:p-5">
            <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">Performance Insights</h3>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mt-0.5 sm:mt-1 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-green-800 text-xs sm:text-sm md:text-base">Excellent SLA Performance</p>
                  <p className="text-xs sm:text-sm text-gray-600">
                    {stats.sla_compliance_rate}% of jobs completed on time
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 bg-blue-50 rounded-lg">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 sm:mt-1 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-blue-800 text-xs sm:text-sm md:text-base">Productivity Trend</p>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Average {stats.avg_completion_time} hours per job completion
                  </p>
                </div>
              </div>

              {stats.sla_compliance_rate < 80 && (
                <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 mt-0.5 sm:mt-1 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-red-800 text-xs sm:text-sm md:text-base">Improvement Needed</p>
                    <p className="text-xs sm:text-sm text-gray-600">
                      SLA compliance below target. Consider team training.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card p-3 sm:p-4 md:p-5">
            <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">Quick Actions</h3>
            <div className="space-y-2 sm:space-y-3">
              <button className="w-full btn btn-outline text-left text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span>Schedule Team Meeting</span>
              </button>
              <button className="w-full btn btn-outline text-left text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span>View Detailed Reports</span>
              </button>
              <button className="w-full btn btn-outline text-left text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span>Set Performance Goals</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

