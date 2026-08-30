'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Wrench, Clock, Camera, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getStatusColor as getLeadStatusColor, getStatusLabel as getLeadStatusLabel } from '@/lib/services/leadStatusService';
import { formatDateTime } from "@/lib/utils";
import toast from 'react-hot-toast';
import {
  WorkshopPageHeader,
  WorkshopPageShell,
  WorkshopStatTile,
  WorkshopEmpty,
} from '@/components/workshop/WorkshopUi';

export default function MechanicJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ASSIGNED' | 'IN_PROGRESS' | 'HOLD' | 'COMPLETED'>('ALL');

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userProfile) {
        setLoading(false);
        return;
      }

      // Fetch from mechanic_jobs table directly with proper joins
      const { data: mechanicJobs, error: jobsError } = await supabase
        .from('mechanic_jobs')
        .select(`
          *,
          lead:service_leads(
            id,
            lead_number,
            customer_name,
            customer_phone,
            vehicle_number,
            vehicle_make,
            vehicle_model,
            service_type,
            service_type_ids,
            problem_description,
            status,
            pickup_required
          )
        `)
        .eq('mechanic_id', userProfile.id)
        .order('assigned_at', { ascending: false });

      if (jobsError) {
        console.error('Error fetching mechanic jobs:', jobsError);
        setJobs([]);
        setLoading(false);
        return;
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

      // Transform data to match expected format
      const jobsData = (mechanicJobs || []).map((mj: any) => {
        // Parse service_type_ids (JSONB array) or use service_type (string)
        let serviceTypeIds: string[] = [];
        if (mj.lead?.service_type_ids) {
          if (typeof mj.lead.service_type_ids === 'string') {
            try {
              serviceTypeIds = JSON.parse(mj.lead.service_type_ids);
            } catch {
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
          job_id: mj.id,
          lead_id: mj.lead_id,
          lead_number: mj.lead?.lead_number || 'N/A',
          customer_name: mj.lead?.customer_name || 'N/A',
          customer_phone: mj.lead?.customer_phone || '',
          vehicle_number: mj.lead?.vehicle_number || 'N/A',
          vehicle_make: mj.lead?.vehicle_make || '',
          vehicle_model: mj.lead?.vehicle_model || '',
          service_types: serviceTypeIds,
          service_type_names: serviceNames,
          problem_description: mj.lead?.problem_description || '',
          mechanic_status: mj.mechanic_status,
          lead_status: mj.lead?.status || '',
          job_priority: mj.job_priority,
          assigned_at: mj.assigned_at,
          started_at: mj.started_at,
          completed_at: mj.completed_at,
          pickup_visit_images_count: 0,
          progress_images_count: mj.progress_images_count || 0,
          after_images_count: mj.after_images_count || 0,
        };
      });

      // Pickup/Visit images count from lead_media via server API (service role) to avoid RLS issues.
      const leadIds = jobsData.map((j: any) => j.lead_id).filter((id: any) => id);
      if (leadIds.length > 0) {
        try {
          const res = await fetch('/api/leads/media-counts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead_ids: leadIds }),
          });
          const json = await res.json().catch(() => ({}));
          const counts = (json as any)?.counts || {};
          jobsData.forEach((job: any) => {
            const c = counts[String(job.lead_id || '').trim()];
            job.pickup_visit_images_count = Number(c?.required_uploaded || 0) || 0;
          });
        } catch (e) {
          console.error('Error fetching pickup/visit images:', e);
        }
      }
      
      setJobs(jobsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
      setLoading(false);
    }
  }

  async function updateJobStatus(leadId: string, newStatus: string) {
    try {
      const response = await fetch(`/api/mechanic/jobs/${leadId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          notes: `Status changed to ${newStatus}`,
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error((json as any)?.error || 'Failed to update status');
        return;
      }

      toast.success('Status updated');
      fetchJobs();
    } catch (e) {
      console.error('Error updating job status:', e);
      toast.error('Failed to update status');
    }
  }

  const getStatusColor = (job: any) => {
    if (job.mechanic_status === 'IN_PROGRESS') return 'bg-blue-100 text-blue-700';
    if (job.mechanic_status === 'HOLD' || job.mechanic_status === 'ON_HOLD') return 'bg-orange-100 text-orange-700';
    if (job.mechanic_status === 'COMPLETED') return 'bg-purple-100 text-purple-700';
    return 'bg-green-100 text-green-700';
  };

  const getStatusLabel = (job: any) => {
    if (job.mechanic_status === 'IN_PROGRESS') return 'In Progress';
    if (job.mechanic_status === 'HOLD' || job.mechanic_status === 'ON_HOLD') return 'On Hold';
    if (job.mechanic_status === 'COMPLETED') return 'Completed';
    return 'Assigned';
  };

  const filteredJobs = jobs.filter((j) => {
    if (filter === 'ALL') return true;
    if (filter === 'HOLD') return j.mechanic_status === 'HOLD' || j.mechanic_status === 'ON_HOLD' || j.mechanic_status === 'WAITING_APPROVAL';
    return j.mechanic_status === filter;
  });

  if (loading) {
    return (
      <DashboardLayout role="workshop_mechanic">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-[#004AAD]"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_mechanic">
      <WorkshopPageShell>
        <WorkshopPageHeader
          eyebrow="Workshop Mechanic"
          title="My Jobs"
          subtitle="Manage your assigned service jobs"
          right={
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="w-full min-[900px]:w-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-[#023D95] shadow-sm"
            >
              {(['ALL', 'ASSIGNED', 'IN_PROGRESS', 'HOLD', 'COMPLETED'] as const).map((id) => (
                <option key={id} value={id}>
                  {id === 'IN_PROGRESS' ? 'In progress' : id === 'ALL' ? 'All' : id.replace('_', ' ')}
                </option>
              ))}
            </select>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <WorkshopStatTile label="All jobs" value={jobs.length} icon={<Wrench className="w-6 h-6 text-blue-600" />} tone="from-blue-50 to-blue-100" />
          <WorkshopStatTile label="Assigned" value={jobs.filter(j => j.mechanic_status === 'ASSIGNED').length} icon={<CheckCircle className="w-6 h-6 text-green-600" />} tone="from-green-50 to-green-100" />
          <WorkshopStatTile label="In Progress" value={jobs.filter(j => j.mechanic_status === 'IN_PROGRESS').length} icon={<Clock className="w-6 h-6 text-amber-600" />} tone="from-yellow-50 to-yellow-100" />
          <WorkshopStatTile label="Completed" value={jobs.filter(j => j.mechanic_status === 'COMPLETED').length} tone="from-purple-50" />
        </div>

        {filteredJobs.length > 0 ? (
          <>
          <div className="space-y-2 lg:hidden">
            {filteredJobs.map((job) => (
              <button
                key={job.job_id || job.lead_id}
                type="button"
                onClick={() => {
                  if (job.lead_id) router.push(`/dashboard/workshop_mechanic/jobs/${job.lead_id}`);
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm sm:p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#023D95] truncate">{job.customer_name || 'Customer'}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {[job.vehicle_number, `${job.vehicle_make || ''} ${job.vehicle_model || ''}`.trim()]
                        .filter(Boolean)
                        .join(' · ') || 'Vehicle'}
                    </p>
                  </div>
                  {job.mechanic_status ? (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${getStatusColor(job)}`}>
                      {getStatusLabel(job)}
                    </span>
                  ) : job.lead_status ? (
                    <span className={[
                      'px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border',
                      getLeadStatusColor(job.lead_status).bg,
                      getLeadStatusColor(job.lead_status).text,
                      getLeadStatusColor(job.lead_status).border,
                    ].join(' ')}>
                      {getLeadStatusLabel(job.lead_status)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-slate-600">
                  {job.service_type_names?.length
                    ? job.service_type_names.join(', ')
                    : job.service_types?.length
                      ? job.service_types.join(', ')
                      : 'N/A'}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="inline-flex items-center gap-0.5">
                      {job.pickup_visit_images_count > 0 ? <CheckCircle className="w-3 h-3 text-green-600" /> : <Camera className="w-3 h-3 text-gray-300" />}
                      PV
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      {job.progress_images_count > 0 ? <CheckCircle className="w-3 h-3 text-green-600" /> : <Camera className="w-3 h-3 text-gray-300" />}
                      P
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      {job.after_images_count > 0 ? <CheckCircle className="w-3 h-3 text-green-600" /> : <Camera className="w-3 h-3 text-gray-300" />}
                      A
                    </span>
                  </div>
                  {job.mechanic_status === 'ASSIGNED' ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        if (job.lead_id) updateJobStatus(job.lead_id, 'IN_PROGRESS');
                      }}
                      className="inline-flex min-h-9 items-center rounded-xl bg-[#004AAD] px-3 text-xs font-bold text-white"
                    >
                      Start
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
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead #</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Images</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredJobs.map((job) => {
                    const getStatusColor = () => {
                      if (job.mechanic_status === 'IN_PROGRESS') return 'bg-blue-100 text-blue-700';
                      if (job.mechanic_status === 'HOLD' || job.mechanic_status === 'ON_HOLD') return 'bg-orange-100 text-orange-700';
                      if (job.mechanic_status === 'COMPLETED') return 'bg-purple-100 text-purple-700';
                      return 'bg-green-100 text-green-700';
                    };

                    const getStatusLabel = () => {
                      if (job.mechanic_status === 'IN_PROGRESS') return 'In Progress';
                      if (job.mechanic_status === 'HOLD' || job.mechanic_status === 'ON_HOLD') return 'On Hold';
                      if (job.mechanic_status === 'COMPLETED') return 'Completed';
                      return 'Assigned';
                    };

                    return (
                      <tr 
                        key={job.job_id || job.lead_id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          if (job.lead_id) {
                            router.push(`/dashboard/workshop_mechanic/jobs/${job.lead_id}`);
                          }
                        }}
                      >
                        {/* Lead Number */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs sm:text-sm font-medium text-gray-900">#{job.lead_number || 'N/A'}</span>
                  {job.problem_description && (
                              <span className="text-[10px] sm:text-xs text-gray-500 truncate max-w-[150px]">
                                {job.problem_description}
                              </span>
                  )}
                            {job.assigned_at && (
                              <span className="text-[10px] text-gray-400">
                                {formatDateTime(job.assigned_at)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div>
                            <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[120px]">
                              {job.customer_name || 'N/A'}
                            </div>
                            {job.customer_phone && (
                              <div className="text-[10px] sm:text-xs text-gray-500 truncate">
                                {job.customer_phone}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Vehicle */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div>
                            <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[120px]">
                              {job.vehicle_number || 'N/A'}
                            </div>
                            {(job.vehicle_make || job.vehicle_model) && (
                              <div className="text-[10px] sm:text-xs text-gray-500 truncate">
                                {job.vehicle_make || ''} {job.vehicle_model || ''}
                              </div>
                  )}
                </div>
                        </td>

                        {/* Service */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="text-xs sm:text-sm text-gray-900 truncate max-w-[150px]">
                            {job.service_type_names && job.service_type_names.length > 0
                              ? job.service_type_names.join(', ')
                              : job.service_types && Array.isArray(job.service_types) && job.service_types.length > 0
                                ? job.service_types.join(', ')
                                : 'N/A'}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                {job.mechanic_status ? (
                            <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold ${getStatusColor()}`}>
                              {getStatusLabel()}
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

                        {/* Actions */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex flex-col gap-1">
                {job.mechanic_status === 'ASSIGNED' && (
                  <button
                                onClick={(e) => {
                                  e.stopPropagation();
                      if (job.lead_id) {
                        updateJobStatus(job.lead_id, 'IN_PROGRESS');
                      }
                    }}
                                className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#004AAD] px-2 py-1 text-xs font-bold text-white"
                  >
                                <Wrench className="w-3 h-3" />
                                Start
                  </button>
                )}
                {job.mechanic_status === 'IN_PROGRESS' && (
                  <>
                    <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                        if (job.lead_id) {
                          router.push(`/dashboard/workshop_mechanic/jobs/${job.lead_id}?action=upload`);
                        }
                      }}
                                  className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded font-medium transition-colors flex items-center justify-center gap-1"
                    >
                                  <Camera className="w-3 h-3" />
                                  Upload
                    </button>
                    <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                        if (job.lead_id) {
                          const ok = window.confirm('Are you sure you want to mark this job as complete?');
                          if (!ok) return;
                          updateJobStatus(job.lead_id, 'COMPLETED');
                        }
                      }}
                                  className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded font-medium transition-colors flex items-center justify-center gap-1"
                    >
                                  <CheckCircle className="w-3 h-3" />
                                  Complete
                    </button>
                  </>
                )}
                <button
                              onClick={(e) => {
                                e.stopPropagation();
                    if (job.lead_id) {
                      router.push(`/dashboard/workshop_mechanic/jobs/${job.lead_id}`);
                    }
                  }}
                              className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded font-medium transition-colors"
                >
                              View
                </button>
              </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <WorkshopEmpty>{jobs.length ? 'No jobs in this filter' : 'No jobs assigned to you'}</WorkshopEmpty>
          </div>
        )}
      </WorkshopPageShell>
    </DashboardLayout>
  );
}

