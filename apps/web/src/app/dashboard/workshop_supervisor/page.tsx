'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { Users, Wrench, Clock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';

export default function WorkshopSupervisorDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({
    total_mechanics: 0,
    active_jobs: 0,
    completed_today: 0,
    pending_qc: 0,
    overdue_jobs: 0
  });
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();

    // Setup realtime subscription
    const supabase = createClient();
    const channel = supabase
      .channel('supervisor-dashboard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_jobs'
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          fetchDashboardData();
        }
      )
      .subscribe((status) => {
        console.log('Supervisor dashboard realtime subscription status:', status);
      });

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchDashboardData() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found');
        return;
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('users_login')
        .select('id, workshop_id')
        .eq('email', user.email)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        setLoading(false);
        return;
      }

      if (!userProfile || !userProfile.workshop_id) {
        console.error('No workshop_id found for user');
        setLoading(false);
        return;
      }

      console.log('User profile:', userProfile);

      // Fetch mechanics in this workshop (filter by role)
      const { data: mechanicsData, error: mechanicsError } = await supabase
        .from('users_login')
        .select(`
          id, 
          full_name, 
          email,
          role:role_id(role_code)
        `)
        .eq('workshop_id', userProfile.workshop_id);

      if (mechanicsError) {
        console.error('Error fetching mechanics:', mechanicsError);
      } else {
        // Filter only mechanics (not admins, supervisors, etc)
        const onlyMechanics = (mechanicsData || []).filter((user: any) => 
          user.role?.role_code === 'WORKSHOP_MECHANIC'
        );
        console.log('Total users in workshop:', mechanicsData?.length || 0);
        console.log('Mechanics only:', onlyMechanics.length);
        
        // Update stats with mechanics count
        setMechanics(onlyMechanics);
      }

      // Fetch active jobs from mechanic_dashboard view for this workshop
      const { data: jobsData, error: jobsError } = await supabase
        .from('mechanic_jobs')
        .select(`
          *,
          service_leads:lead_id(lead_number, customer_name, vehicle_number),
          mechanic:mechanic_id(full_name, workshop_id)
        `)
        .in('mechanic_status', ['ASSIGNED', 'IN_PROGRESS', 'HOLD'])
        .order('assigned_at', { ascending: false })
        .limit(20);

      if (jobsError) {
        console.error('Error fetching jobs:', jobsError);
      } else {
        console.log('Jobs fetched:', jobsData?.length || 0);
        // Filter jobs by workshop
        const workshopJobs = jobsData?.filter(job => 
          job.mechanic?.workshop_id === userProfile.workshop_id
        ) || [];
        console.log('Workshop jobs:', workshopJobs.length);
        setRecentJobs(workshopJobs.slice(0, 10));
      }

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const completedToday = jobsData?.filter(job => {
        if (job.completed_at && job.mechanic?.workshop_id === userProfile.workshop_id) {
          const completedDate = new Date(job.completed_at);
          completedDate.setHours(0, 0, 0, 0);
          return completedDate.getTime() === today.getTime();
        }
        return false;
      }).length || 0;

      const workshopJobs = jobsData?.filter(job => 
        job.mechanic?.workshop_id === userProfile.workshop_id
      ) || [];

      const overdueJobs = workshopJobs.filter(job => 
        job.sla_remaining_minutes !== null && job.sla_remaining_minutes < 0
      ).length || 0;

      setStats({
        total_mechanics: mechanics.length || 0,
        active_jobs: workshopJobs.length || 0,
        completed_today: completedToday,
        pending_qc: 0,
        overdue_jobs: overdueJobs
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
          <h1 className="text-3xl font-bold mb-2">👨‍💼 Supervisor Dashboard</h1>
          <p className="text-blue-100">Oversee team performance and quality control</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-brand-primary" />
              <div>
                <p className="text-sm text-text-body">Total Mechanics</p>
                <p className="text-2xl font-bold text-text-heading">{stats.total_mechanics}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100">
            <div className="flex items-center gap-3">
              <Wrench className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-sm text-text-body">Active Jobs</p>
                <p className="text-2xl font-bold text-text-heading">{stats.active_jobs}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-text-body">Completed Today</p>
                <p className="text-2xl font-bold text-text-heading">{stats.completed_today}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-text-body">Pending QC</p>
                <p className="text-2xl font-bold text-text-heading">{stats.pending_qc}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-red-50 to-red-100">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm text-text-body">Overdue Jobs</p>
                <p className="text-2xl font-bold text-text-heading">{stats.overdue_jobs}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/dashboard/workshop_supervisor/job-assignments')}
            className="card hover:shadow-lg transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Wrench className="w-6 h-6 text-brand-primary" />
              <div className="text-left">
                <p className="font-semibold">Job Assignments</p>
                <p className="text-sm text-gray-600">Assign and monitor jobs</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/workshop_supervisor/team-overview')}
            className="card hover:shadow-lg transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-brand-primary" />
              <div className="text-left">
                <p className="font-semibold">Team Overview</p>
                <p className="text-sm text-gray-600">View team performance</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/workshop_supervisor/performance')}
            className="card hover:shadow-lg transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-brand-primary" />
              <div className="text-left">
                <p className="font-semibold">Performance</p>
                <p className="text-sm text-gray-600">Analyze metrics</p>
              </div>
            </div>
          </button>
        </div>

        {/* Recent Jobs */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Recent Jobs</h2>
          <div className="space-y-3">
            {recentJobs.slice(0, 5).map((job) => (
              <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-semibold">{job.service_leads?.lead_number}</p>
                  <p className="text-sm text-gray-600">
                    {job.mechanic?.full_name} - {job.service_leads?.customer_name}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  job.mechanic_status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                  job.mechanic_status === 'ASSIGNED' ? 'bg-green-100 text-green-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {job.mechanic_status}
                </span>
              </div>
            ))}
            {recentJobs.length === 0 && (
              <p className="text-center text-gray-500 py-4">No active jobs</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
