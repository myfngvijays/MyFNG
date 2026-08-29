'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { formatDateDMY } from '@/lib/utils';
import { AdvisorPageHeader } from '@/components/advisor/AdvisorPageHeader';
import {
  Calendar, Clock, User, AlertTriangle, TrendingUp, 
  Wrench, CheckCircle, ArrowUpDown, Filter, Save
} from 'lucide-react';

interface JobWithPriority {
  id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  service_type: string;
  status: string;
  assigned_mechanic: any;
  sla_remaining_minutes: number | null;
  estimated_duration: number;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  is_vip_customer: boolean;
  is_repeat_complaint: boolean;
  parts_available: boolean;
  created_at: string;
  supervisor_notes?: string;
}

export default function DayPlanningPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobWithPriority[]>([]);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'sla' | 'priority' | 'duration'>('priority');
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false);

  useEffect(() => {
    fetchData();
    
    // Real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel('day-planning-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [sortBy, showOnlyUnassigned]);

  async function fetchData() {
    try {
      setLoading(true);
      const supabase = createClient();

      // Get user's workshop
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      if (!userProfile?.workshop_id) return;

      // Fetch today's jobs
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let query = supabase
        .from('service_leads')
        .select(`
          id,
          lead_number,
          customer_name,
          vehicle_number,
          service_type,
          status,
          assigned_mechanic_id,
          priority,
          is_vip_customer,
          is_repeat_complaint,
          created_at,
          sla_deadline,
          estimated_duration,
          supervisor_notes,
          mechanic:assigned_mechanic_id(id, full_name, profile_image)
        `)
        .eq('workshop_id', userProfile.workshop_id)
        .in('status', ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'HOLD']);

      if (showOnlyUnassigned) {
        query = query.is('assigned_mechanic_id', null);
      }

      const { data: jobsData } = await query;

      // Calculate SLA remaining for each job
      const jobsWithSLA = (jobsData || []).map(job => {
        let slaRemaining = null;
        if (job.sla_deadline) {
          const now = new Date().getTime();
          const deadline = new Date(job.sla_deadline).getTime();
          slaRemaining = Math.floor((deadline - now) / (1000 * 60)); // minutes
        }

        return {
          ...job,
          sla_remaining_minutes: slaRemaining,
          assigned_mechanic: job.mechanic,
          parts_available: true, // TODO: Check actual parts availability
        };
      });

      // Sort jobs based on selected criteria
      const sortedJobs = jobsWithSLA.sort((a, b) => {
        if (sortBy === 'sla') {
          return (a.sla_remaining_minutes || 999999) - (b.sla_remaining_minutes || 999999);
        } else if (sortBy === 'priority') {
          const priorityOrder: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
          return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
        } else if (sortBy === 'duration') {
          return (a.estimated_duration || 0) - (b.estimated_duration || 0);
        }
        return 0;
      });

      setJobs(sortedJobs);

      // Fetch mechanics
      const { data: mechanicsData } = await supabase
        .from('users_login')
        .select(`
          id,
          full_name,
          profile_image,
          roles!inner(role_code)
        `)
        .eq('workshop_id', userProfile.workshop_id)
        .eq('roles.role_code', 'WORKSHOP_MECHANIC')
        .eq('is_active', true);

      // Get active jobs count for each mechanic
      const mechanicsWithJobs = await Promise.all(
        (mechanicsData || []).map(async (mechanic) => {
          const { count } = await supabase
            .from('service_leads')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_mechanic_id', mechanic.id)
            .in('status', ['ASSIGNED', 'IN_PROGRESS']);

          return {
            ...mechanic,
            activeJobs: count || 0
          };
        })
      );

      setMechanics(mechanicsWithJobs);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleJobSelection(jobId: string) {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  }

  async function assignJobsToMechanic(mechanicId: string) {
    if (selectedJobs.size === 0) return;

    // Find mechanic name for confirmation
    const mechanic = mechanics.find((m) => m.id === mechanicId);
    const mechanicName = mechanic?.full_name || 'selected mechanic';
    const jobIds = Array.from(selectedJobs);

    // Show confirmation dialog with mechanic name and job count
    const confirmed = confirm(`Assign ${jobIds.length} job(s) to mechanic: ${mechanicName}?`);
    if (!confirmed) {
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('service_leads')
        .update({ 
          assigned_mechanic_id: mechanicId,
          status: 'ASSIGNED',
          updated_at: new Date().toISOString()
        })
        .in('id', jobIds);

      if (error) throw error;

      alert(`Successfully assigned ${jobIds.length} job(s) to mechanic`);
      setSelectedJobs(new Set());
      fetchData();
    } catch (error) {
      console.error('Error assigning jobs:', error);
      alert('Failed to assign jobs');
    }
  }

  async function updateJobPriority(jobId: string, newPriority: string) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('service_leads')
        .update({ priority: newPriority })
        .eq('id', jobId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error updating priority:', error);
    }
  }

  async function saveSupervisorNotes(jobId: string, notes: string) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('service_leads')
        .update({ supervisor_notes: notes })
        .eq('id', jobId);

      if (error) throw error;
      alert('Notes saved successfully');
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes');
    }
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      URGENT: 'bg-red-100 text-red-700 border-red-300',
      HIGH: 'bg-orange-100 text-orange-700 border-orange-300',
      NORMAL: 'bg-blue-100 text-blue-700 border-blue-300',
      LOW: 'bg-gray-100 text-gray-700 border-gray-300'
    };
    return colors[priority] || colors.NORMAL;
  };

  const getSLAColor = (minutes: number | null) => {
    if (minutes === null) return 'text-gray-500';
    if (minutes < 0) return 'text-red-600';
    if (minutes < 60) return 'text-orange-600';
    if (minutes < 120) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const urgentJobs = jobs.filter(j => j.priority === 'URGENT' || (j.sla_remaining_minutes && j.sla_remaining_minutes < 60));
  const vipJobs = jobs.filter(j => j.is_vip_customer);
  const repeatJobs = jobs.filter(j => j.is_repeat_complaint);

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-3 overflow-x-hidden pb-8 sm:space-y-4">
        <AdvisorPageHeader
          title="Day Planning"
          subtitle={`Plan today's workload · ${jobs.length} jobs`}
          href="/dashboard/workshop-advisor/day-planning"
          right={
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-wide text-[#004AAD]/70">Today</p>
              <p className="text-sm font-extrabold text-[#023D95]">{formatDateDMY(new Date())}</p>
            </div>
          }
        />

        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Urgent Jobs</p>
                <p className="text-2xl sm:text-3xl font-bold text-red-600">{urgentJobs.length}</p>
              </div>
              <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-red-600 flex-shrink-0" />
            </div>
          </div>

          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">VIP Customers</p>
                <p className="text-2xl sm:text-3xl font-bold text-yellow-600">{vipJobs.length}</p>
              </div>
              <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow-600 flex-shrink-0" />
            </div>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Repeat Complaints</p>
                <p className="text-2xl sm:text-3xl font-bold text-orange-600">{repeatJobs.length}</p>
              </div>
              <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-orange-600 flex-shrink-0" />
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Selected Jobs</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">{selectedJobs.size}</p>
              </div>
              <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-600 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Mechanics Overview */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
            <Wrench className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            Available Mechanics ({mechanics.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {mechanics.map((mechanic) => (
              <div 
                key={mechanic.id}
                className={`p-2.5 sm:p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                  mechanic.activeJobs === 0 ? 'bg-green-50 border-green-300' :
                  mechanic.activeJobs <= 2 ? 'bg-yellow-50 border-yellow-300' :
                  'bg-red-50 border-red-300'
                }`}
                onClick={() => selectedJobs.size > 0 && assignJobsToMechanic(mechanic.id)}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  {mechanic.profile_image ? (
                    <img 
                      src={mechanic.profile_image} 
                      alt={mechanic.full_name}
                      className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full bg-brand-primary flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs sm:text-sm truncate">{mechanic.full_name}</p>
                    <p className="text-[10px] sm:text-xs text-gray-600">
                      {mechanic.activeJobs} active job{mechanic.activeJobs !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {selectedJobs.size > 0 && (
                    <button className="btn btn-primary btn-sm text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 flex-shrink-0">
                      Assign {selectedJobs.size}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ArrowUpDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="input input-sm text-xs sm:text-sm flex-1 sm:flex-initial"
              >
                <option value="priority">Priority</option>
                <option value="sla">SLA Urgency</option>
                <option value="duration">Est. Duration</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyUnassigned}
                  onChange={(e) => setShowOnlyUnassigned(e.target.checked)}
                  className="checkbox"
                />
                <span className="text-xs sm:text-sm">Show only unassigned</span>
              </label>
            </div>

            {selectedJobs.size > 0 && (
              <button
                onClick={() => setSelectedJobs(new Set())}
                className="btn btn-outline btn-sm text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 ml-auto sm:ml-0"
              >
                Clear Selection
              </button>
            )}
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-2 sm:space-y-3">
          {jobs.map((job) => (
            <div 
              key={job.id}
              className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
                selectedJobs.has(job.id) ? 'ring-2 ring-brand-primary' : ''
              }`}
            >
              <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedJobs.has(job.id)}
                  onChange={() => toggleJobSelection(job.id)}
                  className="checkbox mt-1 flex-shrink-0"
                />

                {/* Job Info */}
                <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4">
                  {/* Column 1: Basic Info */}
                  <div className="min-w-0">
                    <p className="font-semibold text-xs sm:text-sm text-gray-600">#{job.lead_number}</p>
                    <p className="font-bold text-sm sm:text-base truncate">{job.customer_name}</p>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">{job.vehicle_number}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {job.is_vip_customer && (
                        <span className="inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 bg-yellow-100 text-yellow-700 text-[10px] sm:text-xs font-semibold rounded">
                          VIP
                        </span>
                      )}
                      {job.is_repeat_complaint && (
                        <span className="inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 bg-orange-100 text-orange-700 text-[10px] sm:text-xs font-semibold rounded">
                          REPEAT
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Column 2: Service */}
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Service Type</p>
                    <p className="font-semibold text-xs sm:text-sm truncate">{job.service_type}</p>
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1.5 sm:mt-2">Est. Duration</p>
                    <p className="text-xs sm:text-sm">{job.estimated_duration || 'N/A'} min</p>
                  </div>

                  {/* Column 3: Priority & SLA */}
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Priority</p>
                    <select
                      value={job.priority}
                      onChange={(e) => updateJobPriority(job.id, e.target.value)}
                      className={`input input-sm text-xs sm:text-sm w-full ${getPriorityColor(job.priority)}`}
                    >
                      <option value="URGENT">URGENT</option>
                      <option value="HIGH">HIGH</option>
                      <option value="NORMAL">NORMAL</option>
                      <option value="LOW">LOW</option>
                    </select>
                    
                    {job.sla_remaining_minutes !== null && (
                      <div className="mt-1.5 sm:mt-2">
                        <p className="text-[10px] sm:text-xs text-gray-600">SLA Remaining</p>
                        <p className={`text-xs sm:text-sm font-semibold ${getSLAColor(job.sla_remaining_minutes)}`}>
                          {job.sla_remaining_minutes < 0 
                            ? `OVERDUE by ${Math.abs(job.sla_remaining_minutes)} min` 
                            : `${Math.floor(job.sla_remaining_minutes / 60)}h ${job.sla_remaining_minutes % 60}m`
                          }
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Column 4: Assignment */}
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Assigned Mechanic</p>
                    {job.assigned_mechanic ? (
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="text-xs sm:text-sm font-semibold truncate">{job.assigned_mechanic.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-xs sm:text-sm text-red-600 font-semibold">UNASSIGNED</span>
                    )}
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1.5 sm:mt-2">Status: {job.status}</p>
                  </div>

                  {/* Column 5: Notes & Actions */}
                  <div className="min-w-0 lg:col-span-1">
                    <textarea
                      placeholder="Supervisor notes..."
                      value={job.supervisor_notes || ''}
                      onChange={(e) => {
                        const updatedJobs = jobs.map(j =>
                          j.id === job.id ? { ...j, supervisor_notes: e.target.value } : j
                        );
                        setJobs(updatedJobs);
                      }}
                      onBlur={(e) => saveSupervisorNotes(job.id, e.target.value)}
                      className="input input-sm text-xs sm:text-sm w-full"
                      rows={2}
                    />
                    <button
                      onClick={() => router.push(`/dashboard/workshop-advisor/jobs/${job.id}`)}
                      className="btn btn-outline btn-sm w-full mt-1.5 sm:mt-2 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {jobs.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white py-10 text-center shadow-sm sm:py-12">
            <CheckCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-green-600 mx-auto mb-3 sm:mb-4" />
            <p className="text-lg sm:text-xl font-semibold text-gray-700">All Clear! 🎉</p>
            <p className="text-gray-600 text-sm sm:text-base mt-1.5 sm:mt-2">No jobs requiring planning for today</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

