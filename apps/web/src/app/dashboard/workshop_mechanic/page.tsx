'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Wrench, Clock, CheckCircle, Camera, AlertCircle, 
  TrendingUp, Package, AlertTriangle, Calendar, 
  PlayCircle, PauseCircle, ImagePlus
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type FilterType = 'ALL' | 'ASSIGNED' | 'IN_PROGRESS' | 'HOLD' | 'COMPLETED' | 'NEED_APPROVAL';

interface JobCardData {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  service_types: string[];
  service_type_names: string[];
  mechanic_status: string;
  job_priority: string;
  sla_remaining_minutes: number;
  pickup_status: string;
  before_images_count: number;
  progress_images_count: number;
  after_images_count: number;
  has_pending_extra_work: boolean;
  has_parts_assigned: boolean;
  checklist_completed: boolean;
  assigned_at: string;
}

export default function WorkshopMechanicDashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobCardData[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobCardData[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [stats, setStats] = useState({
    assigned_today: 0,
    in_progress: 0,
    pending_pickups: 0,
    completed_today: 0,
    need_approval: 0
  });
  const [performanceStats, setPerformanceStats] = useState({
    total_completed: 0,
    avg_duration: 0,
    sla_success_rate: 0,
    performance_score: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMechanicData();

    // Setup realtime subscription for mechanic_jobs
    const supabase = createClient();
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userProfile) return;

      // Subscribe to changes in mechanic_dashboard view (filtered by mechanic_id)
      channel = supabase
        .channel('mechanic-jobs-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'mechanic_jobs',
            filter: `mechanic_id=eq.${userProfile.id}`
          },
          (payload) => {
            // Refresh data when any change occurs
            fetchMechanicData();
          }
        )
        .subscribe((status) => {
          // Subscription status
        });
    };

    setupRealtimeSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  useEffect(() => {
    filterJobs(activeFilter);
  }, [activeFilter, jobs]);

  async function fetchMechanicData() {
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

      // Fetch jobs from mechanic_jobs table directly (more reliable than view)
      const { data: mechanicJobs, error: jobsError } = await supabase
        .from('mechanic_jobs')
        .select(`
          *,
          lead:service_leads(
            id,
            lead_number,
            customer_name,
            vehicle_number,
            vehicle_make,
            vehicle_model,
            service_type,
            service_type_ids,
            problem_description,
            status,
            pickup_required,
            pickup_status
          )
        `)
        .eq('mechanic_id', userProfile.id)
        .order('assigned_at', { ascending: false })
        .order('created_at', { ascending: false }); // Also order by created_at as fallback

      if (jobsError) {
        console.error('Error fetching mechanic jobs:', jobsError);
      }

      // Fetch service names for all leads
      const allServiceTypeIds = new Set<string>();
      (mechanicJobs || []).forEach((mj: any) => {
        if (mj.lead?.service_type_ids) {
          let ids: string[] = [];
          if (typeof mj.lead.service_type_ids === 'string') {
            try {
              ids = JSON.parse(mj.lead.service_type_ids);
            } catch {
              // Try parsing as escaped JSON string
              try {
                const unescaped = mj.lead.service_type_ids.replace(/\\"/g, '"').replace(/^"|"$/g, '');
                ids = JSON.parse(unescaped);
              } catch {
                ids = [];
              }
            }
          } else {
            ids = mj.lead.service_type_ids;
          }
          ids.forEach((id: string) => allServiceTypeIds.add(id));
        } else if (mj.lead?.service_type) {
          allServiceTypeIds.add(mj.lead.service_type);
        }
      });

      // Fetch service names
      const serviceNamesMap = new Map<string, string>();
      if (allServiceTypeIds.size > 0) {
        const { data: serviceTypesData } = await supabase
          .from('service_types')
          .select('id, name')
          .in('id', Array.from(allServiceTypeIds));

        if (serviceTypesData) {
          serviceTypesData.forEach((st: any) => {
            serviceNamesMap.set(st.id, st.name);
          });
        }
      }

      // Transform data to match dashboard format
      const dashboardData = (mechanicJobs || []).map((mj: any) => {
        // Parse service_type_ids
        let serviceTypeIds: string[] = [];
        if (mj.lead?.service_type_ids) {
          if (typeof mj.lead.service_type_ids === 'string') {
            try {
              serviceTypeIds = JSON.parse(mj.lead.service_type_ids);
            } catch {
              // Try parsing as escaped JSON string
              try {
                const unescaped = mj.lead.service_type_ids.replace(/\\"/g, '"').replace(/^"|"$/g, '');
                serviceTypeIds = JSON.parse(unescaped);
              } catch {
                serviceTypeIds = [];
              }
            }
          } else {
            serviceTypeIds = mj.lead.service_type_ids;
          }
        } else if (mj.lead?.service_type) {
          serviceTypeIds = [mj.lead.service_type];
        }

        // Get service names
        const serviceNames = serviceTypeIds
          .map((id: string) => serviceNamesMap.get(id))
          .filter((name): name is string => !!name);

        return {
          id: mj.id,
          job_id: mj.id,
          lead_id: mj.lead_id,
          lead_number: mj.lead?.lead_number || 'N/A',
          customer_name: mj.lead?.customer_name || 'N/A',
          vehicle_number: mj.lead?.vehicle_number || 'N/A',
          vehicle_make: mj.lead?.vehicle_make || '',
          vehicle_model: mj.lead?.vehicle_model || '',
          service_types: serviceTypeIds, // Keep IDs for reference
          service_type_names: serviceNames, // Add names for display
          problem_description: mj.lead?.problem_description || '',
          mechanic_status: mj.mechanic_status,
          job_priority: mj.job_priority,
          assigned_at: mj.assigned_at,
          started_at: mj.started_at,
          completed_at: mj.completed_at,
          sla_remaining_minutes: mj.sla_remaining_minutes,
          checklist_completed: mj.checklist_completed,
          before_images_count: mj.before_images_count || 0,
          progress_images_count: mj.progress_images_count || 0,
          after_images_count: mj.after_images_count || 0,
          pickup_status: mj.lead?.pickup_status || 'NOT_REQUIRED',
          pickup_required: mj.lead?.pickup_required || false,
          has_pending_extra_work: false, // Will be calculated separately
          has_parts_assigned: false, // Will be calculated separately
        };
      });

      // Check for pending extra work and parts
      const leadIds = dashboardData.map((j: any) => j.lead_id).filter((id: any) => id);
      if (leadIds.length > 0) {
        try {
          const { data: extraWork } = await supabase
            .from('mechanic_extra_work_requests')
            .select('lead_id')
            .in('lead_id', leadIds)
            .eq('status', 'PENDING')
            .eq('mechanic_id', userProfile.id);

          const { data: partsUsage } = await supabase
            .from('mechanic_parts_usage')
            .select('lead_id')
            .in('lead_id', leadIds);

          const extraWorkLeadIds = new Set(extraWork?.map((ew: any) => ew.lead_id) || []);
          const partsLeadIds = new Set(partsUsage?.map((p: any) => p.lead_id) || []);

          dashboardData.forEach((job: any) => {
            job.has_pending_extra_work = extraWorkLeadIds.has(job.lead_id);
            job.has_parts_assigned = partsLeadIds.has(job.lead_id);
          });
        } catch (err) {
          console.error('Error fetching extra work/parts:', err);
        }
      }

      // Set jobs data
      setJobs(dashboardData);

      // Calculate stats from the fetched data
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const assignedToday = dashboardData.filter((job: any) => {
        if (!job.assigned_at) return false;
        const assignedDate = new Date(job.assigned_at);
        assignedDate.setHours(0, 0, 0, 0);
        return assignedDate.getTime() === today.getTime();
      }).length;

      const inProgress = dashboardData.filter((job: any) => 
        job.mechanic_status === 'IN_PROGRESS'
      ).length;

      const completedToday = dashboardData.filter((job: any) => {
        if (job.completed_at) {
          const completedDate = new Date(job.completed_at);
          completedDate.setHours(0, 0, 0, 0);
          return completedDate.getTime() === today.getTime();
        }
        return false;
      }).length;

      const pendingPickups = dashboardData.filter((job: any) => 
        job.pickup_required && (job.pickup_status === 'NOT_ASSIGNED' || job.pickup_status === 'PENDING')
      ).length;

      // Get need approval count
      const { count: needApproval, error: approvalError } = await supabase
        .from('mechanic_extra_work_requests')
        .select('*', { count: 'exact', head: true })
        .eq('mechanic_id', userProfile.id)
        .eq('status', 'PENDING');

      if (approvalError) {
        console.error('Error fetching extra work requests:', approvalError);
      }

      setStats({
        assigned_today: assignedToday,
        in_progress: inProgress,
        pending_pickups: pendingPickups,
        completed_today: completedToday,
        need_approval: needApproval || 0
      });

      // Get performance metrics
      const { data: performanceData, error: performanceError } = await supabase
        .from('mechanic_performance_metrics')
        .select('*')
        .eq('mechanic_id', userProfile.id)
        .eq('date', today.toISOString().split('T')[0])
        .maybeSingle();

      if (performanceError) {
        console.error('Error fetching performance metrics:', performanceError);
      }
      
      if (performanceData) {
        setPerformanceStats({
          total_completed: performanceData.total_jobs_completed || 0,
          avg_duration: performanceData.avg_repair_duration || 0,
          sla_success_rate: performanceData.sla_success_rate || 0,
          performance_score: performanceData.performance_score || 0
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching mechanic data:', error);
      setLoading(false);
    }
  }

  function filterJobs(filter: FilterType) {
    let filtered = [...jobs];
    
    switch (filter) {
      case 'ASSIGNED':
        filtered = jobs.filter(j => j.mechanic_status === 'ASSIGNED');
        break;
      case 'IN_PROGRESS':
        filtered = jobs.filter(j => j.mechanic_status === 'IN_PROGRESS');
        break;
      case 'HOLD':
        filtered = jobs.filter(j => j.mechanic_status === 'HOLD' || j.mechanic_status === 'WAITING_APPROVAL');
        break;
      case 'COMPLETED':
        filtered = jobs.filter(j => j.mechanic_status === 'COMPLETED');
        break;
      case 'NEED_APPROVAL':
        filtered = jobs.filter(j => j.has_pending_extra_work);
        break;
      case 'ALL':
      default:
        filtered = jobs;
    }
    
    setFilteredJobs(filtered);
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'URGENT':
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'ASSIGNED':
        return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'HOLD':
      case 'WAITING_APPROVAL':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function formatSLA(minutes: number) {
    if (minutes < 0) return <span className="text-red-600 font-semibold">Overdue</span>;
    if (minutes < 60) return <span className="text-orange-600">{minutes}m remaining</span>;
    const hours = Math.floor(minutes / 60);
    return <span className="text-green-600">{hours}h {minutes % 60}m</span>;
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_mechanic">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-text-body">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_mechanic">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-6 rounded-lg shadow-lg -mx-6 -mt-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg">🔧 Mechanic Dashboard</h1>
              <p className="text-white font-medium mt-1">Your assigned jobs and tasks</p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm text-gray-600">Performance Score</p>
                <p className="text-2xl font-bold text-brand-primary">{performanceStats.performance_score.toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-brand-primary" />
              <div>
                <p className="text-sm text-text-body">Assigned Today</p>
                <p className="text-2xl font-bold text-text-heading">{stats.assigned_today}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-sm text-text-body">In Progress</p>
                <p className="text-2xl font-bold text-text-heading">{stats.in_progress}</p>
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

          <div className="card bg-gradient-to-br from-orange-50 to-orange-100">
              <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-orange-600" />
                <div>
                <p className="text-sm text-text-body">Need Approval</p>
                <p className="text-2xl font-bold text-text-heading">{stats.need_approval}</p>
              </div>
            </div>
                </div>

          <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-brand-secondary" />
              <div>
                <p className="text-sm text-text-body">SLA Success</p>
                <p className="text-2xl font-bold text-text-heading">{performanceStats.sla_success_rate.toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'ASSIGNED', 'IN_PROGRESS', 'HOLD', 'COMPLETED', 'NEED_APPROVAL'] as FilterType[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeFilter === filter
                  ? 'bg-brand-primary text-white shadow-md hover:bg-brand-primary-hover'
                  : 'bg-white text-text-body border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {filter.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          {filteredJobs.length > 0 ? (
            filteredJobs.map((job) => (
              <div 
                key={job.id} 
                className="card hover:shadow-lg transition-shadow cursor-pointer border-l-4"
                style={{
                  borderLeftColor: job.job_priority === 'URGENT' || job.job_priority === 'CRITICAL' ? '#ef4444' : 
                                  job.job_priority === 'HIGH' ? '#f97316' : '#3b82f6'
                }}
                onClick={() => router.push(`/dashboard/workshop_mechanic/jobs/${job.lead_id}`)}
              >
                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold">{job.lead_number}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(job.mechanic_status)}`}>
                        {job.mechanic_status.replace('_', ' ')}
                      </span>
                      {job.job_priority !== 'NORMAL' && (
                        <span className={`px-2 py-1 rounded text-xs font-semibold border ${getPriorityColor(job.job_priority)}`}>
                          {job.job_priority}
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                      <div>
                        <p className="text-sm text-gray-600">Vehicle</p>
                        <p className="font-semibold">{job.vehicle_number}</p>
                        <p className="text-sm text-gray-600">{job.vehicle_make} {job.vehicle_model}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-600">Service Type</p>
                        <p className="font-semibold">
                          {job.service_type_names && job.service_type_names.length > 0
                            ? job.service_type_names.join(', ')
                            : job.service_types?.join(', ') || 'N/A'}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-600">SLA Remaining</p>
                        <p className="font-semibold">{formatSLA(job.sla_remaining_minutes)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Indicators */}
                <div className="flex flex-wrap gap-3 pt-3 border-t">
                  {/* Media upload status */}
                  <div className="flex items-center gap-2 text-sm">
                    <Camera className="w-4 h-4 text-gray-500" />
                    <span className={job.before_images_count > 0 ? 'text-green-600' : 'text-gray-500'}>
                      📷 Before: {job.before_images_count}
                    </span>
                    <span className={job.progress_images_count > 0 ? 'text-green-600' : 'text-gray-500'}>
                      Progress: {job.progress_images_count}
                    </span>
                    <span className={job.after_images_count > 0 ? 'text-green-600' : 'text-gray-500'}>
                      After: {job.after_images_count}
                    </span>
                  </div>

                  {/* Checklist status */}
                  {job.checklist_completed && (
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      Checklist Complete
                    </div>
                  )}

                  {/* Parts assigned */}
                  {job.has_parts_assigned && (
                    <div className="flex items-center gap-1 text-sm text-blue-600">
                      <Package className="w-4 h-4" />
                      Parts Assigned
                    </div>
                  )}

                  {/* Extra work pending */}
                  {job.has_pending_extra_work && (
                    <div className="flex items-center gap-1 text-sm text-orange-600">
                      <AlertTriangle className="w-4 h-4" />
                      Extra Work Pending
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  {job.mechanic_status === 'ASSIGNED' && (
                    <button 
                      className="btn bg-brand-primary hover:bg-brand-primary-hover text-white text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/workshop_mechanic/jobs/${job.lead_id}`);
                      }}
                    >
                      <PlayCircle className="w-4 h-4" />
                        Start Job
                      </button>
                    )}
                  {job.mechanic_status === 'IN_PROGRESS' && (
                    <button 
                      className="btn btn-outline text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/workshop_mechanic/jobs/${job.lead_id}?action=upload`);
                      }}
                    >
                      <ImagePlus className="w-4 h-4" />
                    Upload Photos
                  </button>
                  )}
                  <button 
                    className="btn btn-primary text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/workshop_mechanic/jobs/${job.lead_id}`);
                    }}
                  >
                    View Details
                  </button>
                  </div>

                <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                  Assigned: {new Date(job.assigned_at).toLocaleString()}
                </div>
            </div>
            ))
          ) : (
            <div className="card text-center py-12">
              <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No jobs found for this filter</p>
            </div>
          )}
          </div>

        {/* Quick Actions Guide */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card bg-blue-50 border-l-4 border-brand-primary">
          <h3 className="font-semibold text-text-heading mb-3 flex items-center gap-2">
            <Camera className="w-5 h-5 text-brand-primary" />
              Photo Upload Requirements
          </h3>
          <ul className="text-sm text-gray-700 space-y-2">
            <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                <span>Take BEFORE photos when starting work (minimum 3)</span>
            </li>
            <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                <span>Document PROGRESS during repair (minimum 2)</span>
            </li>
            <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                <span>Take AFTER photos upon completion (minimum 3)</span>
            </li>
          </ul>
          </div>

          <div className="card bg-green-50 border-l-4 border-green-500">
            <h3 className="font-semibold text-text-heading mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Today's Performance
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-body">Avg Repair Time:</span>
                <span className="font-semibold text-text-heading">{performanceStats.avg_duration} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-body">Jobs Completed:</span>
                <span className="font-semibold text-text-heading">{performanceStats.total_completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-body">SLA Success Rate:</span>
                <span className="font-semibold text-green-600">{performanceStats.sla_success_rate.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-body">Performance Score:</span>
                <span className="font-semibold text-brand-primary">{performanceStats.performance_score.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
