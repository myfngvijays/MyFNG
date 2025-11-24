'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { TrendingUp, TrendingDown, Users, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

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
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-heading">Performance Analytics</h1>
          <p className="text-text-body mt-2">Track team performance and identify areas for improvement</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-8 h-8 text-blue-600" />
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm text-gray-600">Total Completed</p>
            <p className="text-3xl font-bold text-blue-600">{stats.total_jobs_completed}</p>
            <p className="text-xs text-green-600 mt-1">All time</p>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 text-green-600" />
              <span className="text-xs text-gray-600">avg</span>
            </div>
            <p className="text-sm text-gray-600">Completion Time</p>
            <p className="text-3xl font-bold text-green-600">{stats.avg_completion_time}h</p>
            <p className="text-xs text-gray-600 mt-1">Per job</p>
          </div>

          <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-purple-600" />
              <span className={`text-xs ${stats.sla_compliance_rate >= 80 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.sla_compliance_rate >= 80 ? '↑' : '↓'}
              </span>
            </div>
            <p className="text-sm text-gray-600">SLA Compliance</p>
            <p className="text-3xl font-bold text-purple-600">{stats.sla_compliance_rate}%</p>
            <p className="text-xs text-gray-600 mt-1">On-time completion</p>
          </div>
        </div>

        {/* Period Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <h3 className="font-semibold text-gray-600 mb-2">This Week</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.jobs_this_week}</p>
                <p className="text-sm text-gray-600">Jobs Completed</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-600 mb-2">This Month</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.jobs_this_month}</p>
                <p className="text-sm text-gray-600">Jobs Completed</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-600 mb-2">Customer Satisfaction</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.customer_satisfaction}%</p>
                <p className="text-sm text-gray-600">Average Rating</p>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-bold mb-4">Performance Insights</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 mt-1" />
                <div>
                  <p className="font-semibold text-green-800">Excellent SLA Performance</p>
                  <p className="text-sm text-gray-600">
                    {stats.sla_compliance_rate}% of jobs completed on time
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <p className="font-semibold text-blue-800">Productivity Trend</p>
                  <p className="text-sm text-gray-600">
                    Average {stats.avg_completion_time} hours per job completion
                  </p>
                </div>
              </div>

              {stats.sla_compliance_rate < 80 && (
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-1" />
                  <div>
                    <p className="font-semibold text-red-800">Improvement Needed</p>
                    <p className="text-sm text-gray-600">
                      SLA compliance below target. Consider team training.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full btn btn-outline text-left">
                <Users className="w-5 h-5 inline mr-2" />
                Schedule Team Meeting
              </button>
              <button className="w-full btn btn-outline text-left">
                <TrendingUp className="w-5 h-5 inline mr-2" />
                View Detailed Reports
              </button>
              <button className="w-full btn btn-outline text-left">
                <Clock className="w-5 h-5 inline mr-2" />
                Set Performance Goals
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

