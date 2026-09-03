'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
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
import {
  WorkshopPageHeader,
  WorkshopPageShell,
  WorkshopStatTile,
  WorkshopFilterPill,
  WorkshopEmpty,
} from '@/components/workshop/WorkshopUi';
import WorkshopDateFilter, { isoInRange } from '@/components/workshop/WorkshopDateFilter';
import { isMechanicJobFinished, isMechanicJobInProgress, resolveMechanicDisplayStatus } from '@/lib/workshop/mechanicJobStatus';

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
  completed_at?: string;
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
  const [datePreset, setDatePreset] = useState<CrmDatePreset>('today');
  const [customStart, setCustomStart] = useState(istYmd());
  const [customEnd, setCustomEnd] = useState(istYmd());
  const dateRange = useMemo(
    () => resolveCrmDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd],
  );
  const assignedInRange = useMemo(
    () => jobs.filter((j) => isoInRange(j.assigned_at, dateRange.start, dateRange.end, dateRange.allTime)).length,
    [jobs, dateRange.start, dateRange.end, dateRange.allTime],
  );
  const completedInRange = useMemo(
    () =>
      jobs.filter((j) => {
        if (!isMechanicJobFinished(j.mechanic_status)) return false;
        return isoInRange(j.completed_at || j.assigned_at, dateRange.start, dateRange.end, dateRange.allTime);
      }).length,
    [jobs, dateRange.start, dateRange.end, dateRange.allTime],
  );

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

      // Fallback via API when RLS blocks direct client reads (auth.uid vs users_login.id)
      if (!mechanicJobs?.length) {
        try {
          const res = await fetch('/api/mechanic/jobs');
          const json = await res.json().catch(() => ({}));
          if (res.ok && Array.isArray(json.jobs) && json.jobs.length > 0) {
            setJobs(json.jobs);
            setStats({
              assigned_today: json.jobs.filter((j: any) => {
                if (!j.assigned_at) return false;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const d = new Date(j.assigned_at);
                d.setHours(0, 0, 0, 0);
                return d.getTime() === today.getTime();
              }).length,
              in_progress: json.jobs.filter((j: any) =>
                isMechanicJobInProgress(j.mechanic_status, j.checklist_done, j.checklist_total),
              ).length,
              pending_pickups: 0,
              completed_today: json.jobs.filter((j: any) => {
                if (!j.completed_at) return false;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const d = new Date(j.completed_at);
                d.setHours(0, 0, 0, 0);
                return d.getTime() === today.getTime();
              }).length,
              need_approval: json.jobs.filter((j: any) => j.has_pending_extra_work).length,
            });
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Mechanic jobs API fallback failed:', e);
        }
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

        try {
          const { data: checklistRows } = await supabase
            .from('service_checklists')
            .select('lead_id, completed_items, total_items')
            .in('lead_id', leadIds)
            .eq('mechanic_id', userProfile.id);

          const checklistMap = new Map<string, { done: number; total: number }>();
          (checklistRows || []).forEach((row: any) => {
            checklistMap.set(row.lead_id, {
              done: Number(row.completed_items) || 0,
              total: Number(row.total_items) || 0,
            });
          });
          dashboardData.forEach((job: any) => {
            const c = checklistMap.get(job.lead_id);
            if (c) {
              job.checklist_done = c.done;
              job.checklist_total = c.total;
            }
          });
        } catch (err) {
          console.error('Error fetching checklist stats:', err);
        }
      }

      // Set jobs data
      const enriched = dashboardData.map((job: any) => ({
        ...job,
        display_status: resolveMechanicDisplayStatus(
          job.mechanic_status,
          job.checklist_done,
          job.checklist_total,
        ),
      }));

      setJobs(enriched);

      // Calculate stats from the fetched data
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const assignedToday = dashboardData.filter((job: any) => {
        if (!job.assigned_at) return false;
        const assignedDate = new Date(job.assigned_at);
        assignedDate.setHours(0, 0, 0, 0);
        return assignedDate.getTime() === today.getTime();
      }).length;

      const inProgress = enriched.filter((job: any) =>
        isMechanicJobInProgress(job.mechanic_status, job.checklist_done, job.checklist_total),
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
        filtered = jobs.filter(j => isMechanicJobFinished(j.mechanic_status));
        break;
      case 'NEED_APPROVAL':
        filtered = jobs.filter(j => j.has_pending_extra_work);
        break;
      case 'ALL':
      default:
        filtered = jobs.filter(j => !isMechanicJobFinished(j.mechanic_status));
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

  function jobHref(job: { lead_id: string; has_pending_extra_work?: boolean }) {
    const extra = activeFilter === 'NEED_APPROVAL' || job.has_pending_extra_work ? '?tab=extra-work' : '';
    return `/dashboard/workshop_mechanic/jobs/${job.lead_id}${extra}`;
  }

  function formatSLA(minutes: number) {
    if (minutes < 0) return <span className="text-red-600 font-semibold">Overdue</span>;
    if (minutes < 60) return <span className="text-orange-600">{minutes}m remaining</span>;
    const hours = Math.floor(minutes / 60);
    return <span className="text-green-600">{hours}h {minutes % 60}m</span>;
  }

  return (
    <DashboardLayout role="workshop_mechanic">
      <WorkshopPageShell>
        <WorkshopPageHeader
          eyebrow="Workshop Mechanic"
          title="Dashboard"
          subtitle="Your assigned jobs and tasks"
          right={
            <a href="/dashboard/workshop_mechanic/performance" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left min-[900px]:text-right block">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#004AAD]/70">Performance</p>
              <p className="text-xl font-extrabold text-[#023D95]">{loading ? '—' : `${performanceStats.performance_score.toFixed(0)}%`}</p>
              <p className="text-[10px] font-semibold text-[#004AAD]">View details</p>
            </a>
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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <WorkshopStatTile label="Assigned" value={assignedInRange} icon={<Calendar className="w-6 h-6 text-blue-600" />} tone="from-blue-50 to-blue-100" loading={loading} />
          <WorkshopStatTile label="In Progress" value={stats.in_progress} icon={<Clock className="w-6 h-6 text-amber-600" />} tone="from-yellow-50 to-yellow-100" loading={loading} />
          <WorkshopStatTile label="Completed" value={completedInRange} icon={<CheckCircle className="w-6 h-6 text-green-600" />} tone="from-green-50 to-green-100" loading={loading} />
          <WorkshopStatTile label="Need Approval" value={stats.need_approval} icon={<AlertTriangle className="w-6 h-6 text-orange-600" />} tone="from-orange-50 to-orange-100" loading={loading} onClick={() => setActiveFilter('NEED_APPROVAL')} />
          <WorkshopStatTile label="SLA Success" value={`${performanceStats.sla_success_rate.toFixed(0)}%`} icon={<TrendingUp className="w-6 h-6 text-purple-600" />} tone="from-purple-50 to-purple-100" loading={loading} />
        </div>

        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
          {(['ALL', 'ASSIGNED', 'IN_PROGRESS', 'HOLD', 'COMPLETED', 'NEED_APPROVAL'] as FilterType[]).map((filter) => (
            <WorkshopFilterPill key={filter} active={activeFilter === filter} onClick={() => setActiveFilter(filter)}>
              {filter.replace('_', ' ')}
            </WorkshopFilterPill>
          ))}
        </div>

        {filteredJobs.length > 0 ? (
          <>
          <div className="space-y-2 lg:hidden">
            {filteredJobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => router.push(jobHref(job))}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#023D95] truncate">{job.customer_name || 'Customer'}</p>
                    <p className="text-xs text-slate-500 truncate">{job.vehicle_number} · {job.vehicle_make} {job.vehicle_model}</p>
                  </div>
                  {job.mechanic_status ? (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${getStatusColor(job.mechanic_status)}`}>
                      {getMechanicStatusLabel(job.mechanic_status)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-slate-600">
                  {job.service_type_names?.length ? job.service_type_names.join(', ') : 'N/A'}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">{formatSLA(job.sla_remaining_minutes)}</span>
                  {job.mechanic_status === 'ASSIGNED' ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        void startJobFromDashboard(job.lead_id);
                      }}
                      className="inline-flex min-h-9 items-center rounded-xl bg-[#004AAD] px-3 text-xs font-bold text-white"
                    >
                      {startingLeadId === job.lead_id ? 'Starting…' : 'Start'}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-blue-700">View</span>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
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
                onClick={() => router.push(jobHref(job))}
              >
                      {/* Lead Number */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs sm:text-sm font-medium text-gray-900">{job.customer_name || 'Customer'}</span>
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
                      router.push(jobHref(job));
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
          </>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white py-10 text-center shadow-sm">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <WorkshopEmpty>No jobs found for this filter</WorkshopEmpty>
            </div>
          )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-blue-50/70 p-4 shadow-sm sm:p-5">
            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#004AAD]" />
              Photo Upload Requirements
            </h3>
            <ul className="text-sm text-slate-700 space-y-2">
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

          <div className="rounded-2xl border border-slate-200 bg-green-50/70 p-4 shadow-sm sm:p-5">
            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Today&apos;s Performance
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Avg Repair Time:</span>
                <span className="font-semibold text-slate-900">{performanceStats.avg_duration} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Jobs Completed:</span>
                <span className="font-semibold text-slate-900">{performanceStats.total_completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">SLA Success Rate:</span>
                <span className="font-semibold text-green-600">{performanceStats.sla_success_rate.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Performance Score:</span>
                <span className="font-semibold text-[#004AAD]">{performanceStats.performance_score.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      </WorkshopPageShell>
    </DashboardLayout>
  );
}
