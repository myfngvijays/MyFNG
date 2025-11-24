'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { User, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function TeamOverviewPage() {
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamData();

    // Setup realtime subscription for team updates
    const supabase = createClient();
    const channel = supabase
      .channel('team-overview-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_jobs'
        },
        (payload) => {
          console.log('Team performance update:', payload);
          fetchTeamData();
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
          console.log('Performance metrics update:', payload);
          fetchTeamData();
        }
      )
      .subscribe((status) => {
        console.log('Team overview realtime subscription:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchTeamData() {
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

      // Fetch mechanics with their job stats (only mechanics, not all users)
      const { data: mechanicsData } = await supabase
        .from('users_login')
        .select(`
          id, 
          full_name, 
          email, 
          phone,
          created_at,
          role:role_id(role_code)
        `)
        .eq('workshop_id', userProfile.workshop_id);

      // Filter only mechanics (not admin, supervisor, pickup boy, etc)
      const onlyMechanics = (mechanicsData || []).filter((user: any) =>
        user.role?.role_code === 'WORKSHOP_MECHANIC'
      );

      console.log('Total users in workshop:', mechanicsData?.length || 0);
      console.log('Mechanics only:', onlyMechanics.length);

      // For each mechanic, fetch their job stats
      const mechanicsWithStats = await Promise.all(
        onlyMechanics.map(async (mechanic) => {
          const { count: totalJobs } = await supabase
            .from('mechanic_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('mechanic_id', mechanic.id);

          const { count: activeJobs } = await supabase
            .from('mechanic_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('mechanic_id', mechanic.id)
            .in('mechanic_status', ['ASSIGNED', 'IN_PROGRESS']);

          const { count: completedJobs } = await supabase
            .from('mechanic_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('mechanic_id', mechanic.id)
            .eq('mechanic_status', 'COMPLETED');

          // Get today's performance
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const { data: performanceData } = await supabase
            .from('mechanic_performance_metrics')
            .select('*')
            .eq('mechanic_id', mechanic.id)
            .eq('date', today.toISOString().split('T')[0])
            .maybeSingle();

          return {
            ...mechanic,
            total_jobs: totalJobs || 0,
            active_jobs: activeJobs || 0,
            completed_jobs: completedJobs || 0,
            performance_score: performanceData?.performance_score || 0,
            sla_compliance: performanceData?.sla_compliance_rate || 0
          };
        })
      );

      setMechanics(mechanicsWithStats);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching team data:', error);
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
          <h1 className="text-3xl font-bold text-text-heading">Team Overview</h1>
          <p className="text-text-body mt-2">Monitor your team's performance and workload</p>
        </div>

        {/* Team Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card bg-blue-50">
            <p className="text-sm text-gray-600">Total Mechanics</p>
            <p className="text-2xl font-bold text-blue-600">{mechanics.length}</p>
          </div>
          <div className="card bg-green-50">
            <p className="text-sm text-gray-600">Active Jobs</p>
            <p className="text-2xl font-bold text-green-600">
              {mechanics.reduce((sum, m) => sum + m.active_jobs, 0)}
            </p>
          </div>
          <div className="card bg-purple-50">
            <p className="text-sm text-gray-600">Completed Jobs</p>
            <p className="text-2xl font-bold text-purple-600">
              {mechanics.reduce((sum, m) => sum + m.completed_jobs, 0)}
            </p>
          </div>
          <div className="card bg-yellow-50">
            <p className="text-sm text-gray-600">Avg Performance</p>
            <p className="text-2xl font-bold text-yellow-600">
              {mechanics.length > 0 
                ? Math.round(mechanics.reduce((sum, m) => sum + m.performance_score, 0) / mechanics.length)
                : 0}%
            </p>
          </div>
        </div>

        {/* Mechanics List */}
        <div className="space-y-4">
          {mechanics.map((mechanic) => (
            <div key={mechanic.id} className="card hover:shadow-lg transition">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-primary rounded-full flex items-center justify-center text-white text-xl font-bold">
                    {mechanic.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{mechanic.full_name}</h3>
                    <p className="text-sm text-gray-600">{mechanic.email}</p>
                    {mechanic.phone && (
                      <p className="text-sm text-gray-600">{mechanic.phone}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-2xl font-bold text-green-600">
                      {mechanic.performance_score}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">Performance Score</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <p className="text-sm text-gray-600">Total Jobs</p>
                  </div>
                  <p className="text-xl font-bold text-blue-600">{mechanic.total_jobs}</p>
                </div>

                <div className="p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <p className="text-sm text-gray-600">Active Jobs</p>
                  </div>
                  <p className="text-xl font-bold text-yellow-600">{mechanic.active_jobs}</p>
                </div>

                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-gray-600">Completed</p>
                  </div>
                  <p className="text-xl font-bold text-green-600">{mechanic.completed_jobs}</p>
                </div>

                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                    <p className="text-sm text-gray-600">SLA Compliance</p>
                  </div>
                  <p className="text-xl font-bold text-purple-600">{mechanic.sla_compliance}%</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t text-xs text-gray-500">
                Joined: {new Date(mechanic.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}

          {mechanics.length === 0 && (
            <div className="card text-center py-12">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No mechanics in your team</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

