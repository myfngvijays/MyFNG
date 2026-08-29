'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateTime } from "@/lib/utils";
import { 
  Wrench, Clock, CheckCircle, Camera, AlertCircle, 
  TrendingUp, Package, AlertTriangle, Calendar, 
  PlayCircle, PauseCircle, ImagePlus
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getStatusColor as getLeadStatusColor, getStatusLabel as getLeadStatusLabel } from '@/lib/services/leadStatusService';
import toast from 'react-hot-toast';

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
  service_addon_names: string[];
  mechanic_status: string;
  lead_status?: string;
  job_priority: string;
  sla_remaining_minutes: number;
  pickup_status: string;
  // Pickup/Visit photos (uploaded by pickup boy) are stored in lead_media (BEFORE_* categories).
  pickup_visit_images_count: number;
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
  const [startingLeadId, setStartingLeadId] = useState<string | null>(null);
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

  async function startJobFromDashboard(leadId: string) {
    if (!leadId) return;
    setStartingLeadId(leadId);
    try {
      const response = await fetch(`/api/mechanic/jobs/${leadId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'IN_PROGRESS',
          notes: 'Started from mechanic dashboard',
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error((json as any)?.error || 'Failed to start job');
        return;
      }

      // Optimistic UI update (realtime + refetch will also correct if needed)
      setJobs((prev) =>
        prev.map((j) =>
          j.lead_id === leadId
            ? { ...j, mechanic_status: 'IN_PROGRESS', lead_status: 'IN_PROGRESS' }
            : j
        )
      );

      toast.success('Job started');
      router.push(`/dashboard/workshop_mechanic/jobs/${leadId}`);
    } catch (e) {
      console.error('Start job error:', e);
      toast.error('Failed to start job');
    } finally {
      setStartingLeadId(null);
    }
  }

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
            subservice_ids,
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

      // Fetch service addon IDs from all leads
      const allAddonIds = new Set<string>();
      (mechanicJobs || []).forEach((mj: any) => {
        if (mj.lead?.subservice_ids) {
          let ids: string[] = [];
          if (typeof mj.lead.subservice_ids === 'string') {
            try {
              ids = JSON.parse(mj.lead.subservice_ids);
            } catch {
              try {
                const unescaped = mj.lead.subservice_ids.replace(/\\"/g, '"').replace(/^"|"$/g, '');
                ids = JSON.parse(unescaped);
              } catch {
                ids = [];
              }
            }
          } else {
            ids = mj.lead.subservice_ids;
          }
          ids.forEach((id: string) => allAddonIds.add(id));
        }
      });

      // Fetch service addon names
      const addonNamesMap = new Map<string, string>();
      if (allAddonIds.size > 0) {
        const { data: addonsData } = await supabase
          .from('service_addons')
          .select('id, name')
          .in('id', Array.from(allAddonIds))
          .eq('is_active', true);

        if (addonsData) {
          addonsData.forEach((addon: any) => {
            addonNamesMap.set(addon.id, addon.name);
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

        // Parse and get service addon names
        let addonIds: string[] = [];
        if (mj.lead?.subservice_ids) {
          if (typeof mj.lead.subservice_ids === 'string') {
            try {
              addonIds = JSON.parse(mj.lead.subservice_ids);
            } catch {
              try {
                const unescaped = mj.lead.subservice_ids.replace(/\\"/g, '"').replace(/^"|"$/g, '');
                addonIds = JSON.parse(unescaped);
              } catch {
                addonIds = [];
              }
            }
          } else {
            addonIds = mj.lead.subservice_ids;
          }
        }
        
        const addonNames = addonIds
          .map((id: string) => addonNamesMap.get(id))
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
          service_addon_names: addonNames, // Add addon names for display
          problem_description: mj.lead?.problem_description || '',
          mechanic_status: mj.mechanic_status,
          lead_status: mj.lead?.status || undefined,
          job_priority: mj.job_priority,
          assigned_at: mj.assigned_at,
          started_at: mj.started_at,
          completed_at: mj.completed_at,
          sla_remaining_minutes: mj.sla_remaining_minutes,
          checklist_completed: mj.checklist_completed,
          pickup_visit_images_count: 0,
          progress_images_count: mj.progress_images_count || 0,
          after_images_count: mj.after_images_count || 0,
          pickup_status: mj.lead?.pickup_status || 'NOT_REQUIRED',
          pickup_required: mj.lead?.pickup_required || false,
          has_pending_extra_work: false, // Will be calculated separately
          has_parts_assigned: false, // Will be calculated separately
        };
      });

      // Pickup/Visit images count from lead_media via server API (service role) to avoid RLS issues.
      const leadIds = dashboardData.map((j: any) => j.lead_id).filter((id: any) => id);
      if (leadIds.length > 0) {
        try {
          const res = await fetch('/api/leads/media-counts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead_ids: leadIds }),
          });
          const json = await res.json().catch(() => ({}));
          const counts = (json as any)?.counts || {};
          dashboardData.forEach((job: any) => {
            const c = counts[String(job.lead_id || '').trim()];
            job.pickup_visit_images_count = Number(c?.required_uploaded || 0) || 0;
          });
        } catch (e) {
          console.error('Error fetching pickup/visit images:', e);
        }
      }

      // Check for pending additional job and parts
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
          console.error('Error fetching additional job/parts:', err);
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
        console.error('Error fetching additional job requests:', approvalError);
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

  function getMechanicStatusLabel(status: string) {
    switch (status) {
      case 'COMPLETED':
        // Mechanic-side "completed" means work submitted for QC, not end-to-end completion.
        return 'Work Submitted (QC Pending)';
      case 'WAITING_APPROVAL':
        return 'Need Approval';
      default:
        return status.replace(/_/g, ' ');
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
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg mb-4 sm:mb-5 md:mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-300 drop-shadow-lg">🔧 Mechanic Dashboard</h1>
              <p className="text-white text-sm sm:text-base font-medium mt-0.5 sm:mt-1">Your assigned jobs and tasks</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs sm:text-sm text-white/90">Performance Score</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-300">{performanceStats.performance_score.toFixed(0)}%</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="flex items-center gap-2 sm:gap-3">
              <Calendar className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-brand-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-text-body">Assigned Today</p>
                <p className="text-xl sm:text-2xl font-bold text-text-heading">{stats.assigned_today}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100">
            <div className="flex items-center gap-2 sm:gap-3">
              <Clock className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-text-body">In Progress</p>
                <p className="text-xl sm:text-2xl font-bold text-text-heading">{stats.in_progress}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-center gap-2 sm:gap-3">
              <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-text-body">Completed Today</p>
                <p className="text-xl sm:text-2xl font-bold text-text-heading">{stats.completed_today}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-orange-50 to-orange-100">
              <div className="flex items-center gap-2 sm:gap-3">
              <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-orange-600 flex-shrink-0" />
                <div className="min-w-0">
                <p className="text-xs sm:text-sm text-text-body">Need Approval</p>
                <p className="text-xl sm:text-2xl font-bold text-text-heading">{stats.need_approval}</p>
              </div>
            </div>
                </div>

          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 sm:gap-3">
              <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-brand-secondary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-text-body">SLA Success</p>
                <p className="text-xl sm:text-2xl font-bold text-text-heading">{performanceStats.sla_success_rate.toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 overflow-x-auto">
          {(['ALL', 'ASSIGNED', 'IN_PROGRESS', 'HOLD', 'COMPLETED', 'NEED_APPROVAL'] as FilterType[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap flex-shrink-0 ${
                activeFilter === filter
                  ? 'bg-brand-primary text-white shadow-md hover:bg-brand-primary-hover'
                  : 'bg-white text-text-body border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {filter.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Jobs Table */}
          {filteredJobs.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead #</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Images</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLA</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredJobs.map((job) => (
                    <tr 
                key={job.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/dashboard/workshop_mechanic/jobs/${job.lead_id}`)}
              >
                      {/* Lead Number */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs sm:text-sm font-medium text-gray-900">#{job.lead_number}</span>
                          <div className="flex flex-wrap gap-1">
                            {job.job_priority !== 'NORMAL' && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${getPriorityColor(job.job_priority)}`}>
                                {job.job_priority}
                              </span>
                            )}
                            {job.has_pending_extra_work && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-semibold">
                                Extra Work
                              </span>
                            )}
                            {job.has_parts_assigned && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">
                                Parts
                              </span>
                            )}
                            {job.checklist_completed && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-semibold">
                                ✓ Checklist
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-500">
                            {formatDateTime(job.assigned_at)}
                          </span>
                        </div>
                      </td>

                      {/* Vehicle */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[120px]">
                            {job.vehicle_number}
                          </div>
                          <div className="text-[10px] sm:text-xs text-gray-500 truncate">
                            {job.vehicle_make} {job.vehicle_model}
                          </div>
                        </div>
                      </td>

                      {/* Service */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div>
                          <div className="text-xs sm:text-sm text-gray-900 truncate max-w-[150px]">
                            {job.service_type_names && job.service_type_names.length > 0
                              ? job.service_type_names.join(', ')
                              : job.service_types?.join(', ') || 'N/A'}
                          </div>
                          {job.service_addon_names && job.service_addon_names.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {job.service_addon_names.slice(0, 2).map((addon, idx) => (
                                <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                                  {addon}
                                </span>
                              ))}
                              {job.service_addon_names.length > 2 && (
                                <span className="text-[10px] text-gray-500">+{job.service_addon_names.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                      {job.mechanic_status ? (
                          <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold ${getStatusColor(job.mechanic_status)}`}>
                          {getMechanicStatusLabel(job.mechanic_status)}
                        </span>
                      ) : job.lead_status ? (
                          <span className={[
                            'text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold border',
                            getLeadStatusColor(job.lead_status).bg,
                            getLeadStatusColor(job.lead_status).text,
                            getLeadStatusColor(job.lead_status).border,
                          ].join(' ')}>
                          {getLeadStatusLabel(job.lead_status)}
                        </span>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </td>

                      {/* Images */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5">
                    {job.pickup_visit_images_count > 0 ? (
                              <CheckCircle className="w-3 h-3 text-green-600" />
                    ) : (
                              <Camera className="w-3 h-3 text-gray-300" />
                    )}
                            <span className="text-[10px] text-gray-600">PV</span>
                  </div>
                          <div className="flex items-center gap-0.5">
                            {job.progress_images_count > 0 ? (
                              <CheckCircle className="w-3 h-3 text-green-600" />
                            ) : (
                              <Camera className="w-3 h-3 text-gray-300" />
                            )}
                            <span className="text-[10px] text-gray-600">P</span>
                    </div>
                          <div className="flex items-center gap-0.5">
                            {job.after_images_count > 0 ? (
                              <CheckCircle className="w-3 h-3 text-green-600" />
                            ) : (
                              <Camera className="w-3 h-3 text-gray-300" />
                            )}
                            <span className="text-[10px] text-gray-600">A</span>
                    </div>
                    </div>
                      </td>

                      {/* SLA */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="text-xs sm:text-sm">
                          {formatSLA(job.sla_remaining_minutes)}
                </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex flex-col gap-1">
                  {job.mechanic_status === 'ASSIGNED' && (
                    <button 
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded font-medium transition-colors flex items-center justify-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        void startJobFromDashboard(job.lead_id);
                      }}
                              disabled={startingLeadId === job.lead_id}
                    >
                              <PlayCircle className="w-3 h-3" />
                              {startingLeadId === job.lead_id ? 'Starting...' : 'Start'}
                      </button>
                    )}
                  {job.mechanic_status === 'IN_PROGRESS' && (
                    <button 
                              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded font-medium transition-colors flex items-center justify-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/workshop_mechanic/jobs/${job.lead_id}?action=upload`);
                      }}
                    >
                              <ImagePlus className="w-3 h-3" />
                              Upload
                  </button>
                  )}
                  <button 
                            className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded font-medium transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/workshop_mechanic/jobs/${job.lead_id}`);
                    }}
                  >
                            View
                  </button>
                  </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          ) : (
            <div className="card text-center py-8 sm:py-10 md:py-12">
              <AlertCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">No jobs found for this filter</p>
            </div>
          )}

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
