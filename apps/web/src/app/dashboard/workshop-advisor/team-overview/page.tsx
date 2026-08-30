'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { User, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { formatDateDMY } from "@/lib/utils";
import { AdvisorPageHeader } from '@/components/advisor/AdvisorPageHeader';

const TEAM_ROLES = [
  { code: 'WORKSHOP_ADMIN', label: 'Owner', color: '#023D95' },
  { code: 'WORKSHOP_SUPERVISOR', label: 'Advisor', color: '#0284C7' },
  { code: 'WORKSHOP_MECHANIC', label: 'Mechanic', color: '#059669' },
  { code: 'WORKSHOP_PICKUP_BOY', label: 'Pickup', color: '#EA580C' },
] as const;

function roleMeta(code?: string) {
  return TEAM_ROLES.find((r) => r.code === code) || { code: code || '', label: 'Staff', color: '#64748B' };
}

export default function TeamOverviewPage() {
  const [members, setMembers] = useState<any[]>([]);
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

      const { data: teamData } = await supabase
        .from('users_login')
        .select(`
          id, 
          full_name, 
          email, 
          phone,
          created_at,
          is_active,
          role:role_id(role_code, role_name)
        `)
        .eq('workshop_id', userProfile.workshop_id)
        .eq('is_active', true);

      const roleRank = (code?: string) => {
        const idx = TEAM_ROLES.findIndex((r) => r.code === code);
        return idx === -1 ? 99 : idx;
      };

      const membersWithStats = await Promise.all(
        (teamData || []).map(async (person: any) => {
          const roleCode = person.role?.role_code;
          if (roleCode !== 'WORKSHOP_MECHANIC') {
            return {
              ...person,
              total_jobs: 0,
              active_jobs: 0,
              completed_jobs: 0,
              performance_score: 0,
              sla_compliance: 0,
            };
          }

          const { count: totalJobs } = await supabase
            .from('mechanic_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('mechanic_id', person.id);

          const { count: activeJobs } = await supabase
            .from('mechanic_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('mechanic_id', person.id)
            .in('mechanic_status', ['ASSIGNED', 'IN_PROGRESS']);

          const { count: completedJobs } = await supabase
            .from('mechanic_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('mechanic_id', person.id)
            .eq('mechanic_status', 'COMPLETED');

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const { data: performanceData } = await supabase
            .from('mechanic_performance_metrics')
            .select('*')
            .eq('mechanic_id', person.id)
            .eq('date', today.toISOString().split('T')[0])
            .maybeSingle();

          return {
            ...person,
            total_jobs: totalJobs || 0,
            active_jobs: activeJobs || 0,
            completed_jobs: completedJobs || 0,
            performance_score: performanceData?.performance_score || 0,
            sla_compliance: performanceData?.sla_compliance_rate || 0,
          };
        })
      );

      membersWithStats.sort((a, b) => roleRank(a.role?.role_code) - roleRank(b.role?.role_code));
      setMembers(membersWithStats);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching team data:', error);
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
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-3 overflow-x-hidden pb-8 sm:space-y-4">
        <AdvisorPageHeader
          title="Team"
          subtitle="Who is free, who is on a job, and how the floor is performing"
          href="/dashboard/workshop-advisor/team-overview"
        />

        {/* Team Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <p className="text-xs sm:text-sm text-gray-600">Total Team</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{members.length}</p>
          </div>
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <p className="text-xs sm:text-sm text-gray-600">Active Jobs</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">
              {members.reduce((sum, m) => sum + (m.active_jobs || 0), 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-[#F0F7FF] p-4 shadow-sm">
            <p className="text-xs sm:text-sm text-gray-600">Completed Jobs</p>
            <p className="text-xl sm:text-2xl font-bold text-[#004AAD]">
              {members.reduce((sum, m) => sum + (m.completed_jobs || 0), 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm sm:col-span-2 lg:col-span-1">
            <p className="text-xs sm:text-sm text-gray-600">Avg Performance</p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-600">
              {members.filter((m) => m.role?.role_code === 'WORKSHOP_MECHANIC').length > 0
                ? Math.round(
                    members
                      .filter((m) => m.role?.role_code === 'WORKSHOP_MECHANIC')
                      .reduce((sum, m) => sum + (m.performance_score || 0), 0) /
                      members.filter((m) => m.role?.role_code === 'WORKSHOP_MECHANIC').length
                  )
                : 0}
              %
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {TEAM_ROLES.map((role) => (
            <div
              key={role.code}
              className="rounded-xl px-2 py-2 text-center text-xs sm:text-sm font-extrabold text-white"
              style={{ backgroundColor: role.color }}
            >
              {role.label}
            </div>
          ))}
        </div>

        <div className="space-y-3 sm:space-y-4">
          {members.map((member) => {
            const role = roleMeta(member.role?.role_code);
            const isMechanic = member.role?.role_code === 'WORKSHOP_MECHANIC';
            return (
              <div
                key={member.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                style={{ borderLeft: `6px solid ${role.color}` }}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold flex-shrink-0"
                      style={{ backgroundColor: role.color }}
                    >
                      {member.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg sm:text-xl font-bold truncate">{member.full_name}</h3>
                      <p className="text-xs sm:text-sm font-bold" style={{ color: role.color }}>
                        {role.label}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">{member.email}</p>
                    </div>
                  </div>
                  {isMechanic ? (
                    <div className="text-left sm:text-right flex-shrink-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                        <span className="text-xl sm:text-2xl font-bold text-green-600">
                          {member.performance_score}%
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600">Performance Score</p>
                    </div>
                  ) : null}
                </div>

                {isMechanic ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                      <div className="p-2 sm:p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                          <p className="text-xs sm:text-sm text-gray-600">Total Jobs</p>
                        </div>
                        <p className="text-lg sm:text-xl font-bold text-blue-600">{member.total_jobs}</p>
                      </div>
                      <div className="p-2 sm:p-3 bg-yellow-50 rounded-lg">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                          <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-600 flex-shrink-0" />
                          <p className="text-xs sm:text-sm text-gray-600">Active Jobs</p>
                        </div>
                        <p className="text-lg sm:text-xl font-bold text-yellow-600">{member.active_jobs}</p>
                      </div>
                      <div className="p-2 sm:p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                          <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                          <p className="text-xs sm:text-sm text-gray-600">Completed</p>
                        </div>
                        <p className="text-lg sm:text-xl font-bold text-green-600">{member.completed_jobs}</p>
                      </div>
                      <div className="p-2 sm:p-3 bg-[#F0F7FF] rounded-lg">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                          <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#004AAD] flex-shrink-0" />
                          <p className="text-xs sm:text-sm text-gray-600">SLA Compliance</p>
                        </div>
                        <p className="text-lg sm:text-xl font-bold text-[#004AAD]">{member.sla_compliance}%</p>
                      </div>
                    </div>
                    <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t text-[10px] sm:text-xs text-gray-500">
                      Joined: {formatDateDMY(member.created_at)}
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] sm:text-xs text-gray-500">
                    Joined: {formatDateDMY(member.created_at)}
                  </div>
                )}
              </div>
            );
          })}

          {members.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white py-10 text-center shadow-sm sm:py-12">
              <User className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-500 text-sm sm:text-base">No team members found</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

