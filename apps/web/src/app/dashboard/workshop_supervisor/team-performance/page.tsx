'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Users, Star, TrendingUp, Trophy, Clock, CheckCircle,
  Award, Target, BarChart3
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  total_assigned: number;
  total_completed: number;
  avg_completion_time: number;
  avg_quality_score: number;
  completion_rate: number;
  active_jobs: number;
}

export default function TeamPerformancePage() {
  const router = useRouter();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mechanics' | 'pickup_boys'>('all');

  useEffect(() => {
    fetchTeamPerformance();
  }, [filter]);

  async function fetchTeamPerformance() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      if (!userProfile?.workshop_id) {
        toast.error('Workshop not found');
        return;
      }

      // Fetch team members with role information
      const { data: allTeamData } = await supabase
        .from('users_login')
        .select(`
          id, 
          full_name,
          role:role_id(role_code)
        `)
        .eq('workshop_id', userProfile.workshop_id)
        .eq('is_active', true);

      // Filter based on role_code
      let teamData = allTeamData || [];
      if (filter === 'mechanics') {
        teamData = teamData.filter((user: any) => user.role?.role_code === 'WORKSHOP_MECHANIC');
      } else if (filter === 'pickup_boys') {
        teamData = teamData.filter((user: any) => user.role?.role_code === 'WORKSHOP_PICKUP_BOY');
      } else {
        teamData = teamData.filter((user: any) => 
          user.role?.role_code === 'WORKSHOP_MECHANIC' || 
          user.role?.role_code === 'WORKSHOP_PICKUP_BOY'
        );
      }

      if (!teamData || teamData.length === 0) {
        console.log('No team members found');
        setTeamMembers([]);
        setLoading(false);
        return;
      }

      // For each team member, calculate their metrics
      const teamMetrics = await Promise.all(teamData.map(async (member: any) => {
        const isPickupBoy = member.role?.role_code === 'WORKSHOP_PICKUP_BOY';
        
        // Fetch assigned jobs
        const assignedField = isPickupBoy ? 'assigned_pickup_boy_id' : 'assigned_mechanic_id';
        
        const { data: assignedJobs } = await supabase
          .from('service_leads')
          .select('*')
          .eq(assignedField, member.id);

        const totalAssigned = assignedJobs?.length || 0;
        
        const completedJobs = assignedJobs?.filter(j => 
          isPickupBoy 
            ? j.pickup_status === 'DELIVERED' 
            : j.status === 'WORK_COMPLETED' || j.status === 'QC_APPROVED'
        ) || [];

        const totalCompleted = completedJobs.length;

        // Calculate avg completion time
        const jobsWithTime = completedJobs.filter(j => {
          if (isPickupBoy) {
            return j.pickup_start_time && j.pickup_arrival_time;
          } else {
            return j.mechanic_started_at && j.mechanic_completed_at;
          }
        });

        const avgCompletionTime = jobsWithTime.length > 0
          ? jobsWithTime.reduce((sum, j) => {
              const start = new Date(isPickupBoy ? j.pickup_start_time : j.mechanic_started_at).getTime();
              const end = new Date(isPickupBoy ? j.pickup_arrival_time : j.mechanic_completed_at).getTime();
              return sum + (end - start);
            }, 0) / jobsWithTime.length / (1000 * 60 * 60) // Convert to hours
          : 0;

        // Calculate avg quality score (for mechanics only)
        let avgQualityScore = 0;
        if (!isPickupBoy) {
          const jobsWithQC = completedJobs.filter(j => j.qc_quality_score);
          avgQualityScore = jobsWithQC.length > 0
            ? jobsWithQC.reduce((sum, j) => sum + (j.qc_quality_score || 0), 0) / jobsWithQC.length
            : 0;
        }

        const completionRate = totalAssigned > 0 ? (totalCompleted / totalAssigned) * 100 : 0;

        const activeJobs = assignedJobs?.filter(j => {
          if (isPickupBoy) {
            return ['PICKUP_SCHEDULED', 'IN_TRANSIT'].includes(j.pickup_status);
          } else {
            return ['TEAM_ASSIGNED', 'IN_PROGRESS'].includes(j.status);
          }
        }).length || 0;

        return {
          id: member.id,
          name: member.full_name || 'Unknown',
          role: member.role?.role_code || 'UNKNOWN',
          total_assigned: totalAssigned,
          total_completed: totalCompleted,
          avg_completion_time: avgCompletionTime,
          avg_quality_score: avgQualityScore,
          completion_rate: completionRate,
          active_jobs: activeJobs
        };
      }));

      setTeamMembers(teamMetrics);

    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load team performance');
    } finally {
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

  // Sort by completion rate
  const sortedTeam = [...teamMembers].sort((a, b) => b.completion_rate - a.completion_rate);
  const topPerformer = sortedTeam[0];

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-6 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg flex items-center gap-3">
            <Users className="w-8 h-8" />
            Team Performance Dashboard
          </h1>
          <p className="text-white font-medium mt-1">Track individual and team metrics</p>
        </div>

        {/* Filter */}
        <div className="card">
          <div className="flex items-center gap-2 flex-wrap">
            <Users className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Team:</span>
            {(['all', 'mechanics', 'pickup_boys'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === f
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? 'All Team' : f === 'mechanics' ? 'Mechanics' : 'Pickup Boys'}
              </button>
            ))}
          </div>
        </div>

        {/* Top Performer Highlight */}
        {topPerformer && (
          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-400">
            <div className="flex items-center gap-4">
              <Trophy className="w-16 h-16 text-yellow-600" />
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-semibold">🏆 Top Performer</p>
                <p className="text-2xl font-bold text-gray-800">{topPerformer.name}</p>
                <p className="text-sm text-gray-600">{topPerformer.role.replace(/_/g, ' ')}</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-yellow-600">{topPerformer.completion_rate.toFixed(0)}%</p>
                <p className="text-sm text-gray-600">Completion Rate</p>
              </div>
            </div>
          </div>
        )}

        {/* Team Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="flex items-center gap-3">
              <Users className="w-10 h-10 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Team Members</p>
                <p className="text-3xl font-bold text-gray-800">{teamMembers.length}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-10 h-10 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Total Completed</p>
                <p className="text-3xl font-bold text-gray-800">
                  {teamMembers.reduce((sum, m) => sum + m.total_completed, 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100">
            <div className="flex items-center gap-3">
              <Target className="w-10 h-10 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">Active Jobs</p>
                <p className="text-3xl font-bold text-gray-800">
                  {teamMembers.reduce((sum, m) => sum + m.active_jobs, 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
            <div className="flex items-center gap-3">
              <Star className="w-10 h-10 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Avg Quality</p>
                <p className="text-3xl font-bold text-gray-800">
                  {(teamMembers.reduce((sum, m) => sum + m.avg_quality_score, 0) / teamMembers.length || 0).toFixed(1)}/5
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Individual Performance Cards */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold">Individual Performance</h3>
          {sortedTeam.length === 0 ? (
            <div className="card text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No team members found</p>
            </div>
          ) : (
            sortedTeam.map((member, index) => (
              <div 
                key={member.id} 
                className={`card hover:shadow-xl transition-all ${
                  index === 0 ? 'border-2 border-yellow-400' : ''
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* Member Info */}
                  <div className="flex items-center gap-3">
                    {index === 0 && <Trophy className="w-6 h-6 text-yellow-600" />}
                    {index === 1 && <Award className="w-6 h-6 text-gray-400" />}
                    {index === 2 && <Award className="w-6 h-6 text-orange-600" />}
                    <div>
                      <p className="font-bold text-lg">{member.name}</p>
                      <p className="text-sm text-gray-600">{member.role.replace(/_/g, ' ')}</p>
                    </div>
                  </div>

                  {/* Assigned */}
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-800">{member.total_assigned}</p>
                    <p className="text-xs text-gray-600">Total Assigned</p>
                  </div>

                  {/* Completed */}
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{member.total_completed}</p>
                    <p className="text-xs text-gray-600">Completed</p>
                  </div>

                  {/* Completion Rate */}
                  <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="#e5e7eb"
                          strokeWidth="6"
                          fill="none"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke={member.completion_rate >= 80 ? '#10b981' : member.completion_rate >= 50 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="6"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 28}`}
                          strokeDashoffset={`${2 * Math.PI * 28 * (1 - member.completion_rate / 100)}`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold">{member.completion_rate.toFixed(0)}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Success Rate</p>
                  </div>

                  {/* Additional Metrics */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span>{member.avg_completion_time.toFixed(1)}h avg</span>
                    </div>
                    {member.avg_quality_score > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span>{member.avg_quality_score.toFixed(1)}/5</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Target className="w-4 h-4 text-blue-500" />
                      <span>{member.active_jobs} active</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

