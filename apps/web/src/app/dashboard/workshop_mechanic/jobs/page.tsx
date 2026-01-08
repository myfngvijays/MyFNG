'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Wrench, Clock, Camera, CheckCircle, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getStatusColor as getLeadStatusColor, getStatusLabel as getLeadStatusLabel } from '@/lib/services/leadStatusService';
import { formatDateTime } from "@/lib/utils";

export default function MechanicJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
          before_images_count: mj.before_images_count || 0,
          progress_images_count: mj.progress_images_count || 0,
          after_images_count: mj.after_images_count || 0,
        };
      });
      
      setJobs(jobsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
      setLoading(false);
    }
  }

  async function updateJobStatus(leadId: string, newStatus: string) {
    const supabase = createClient();
    
    const updates: any = {
      mechanic_status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (newStatus === 'IN_PROGRESS') {
      updates.started_at = new Date().toISOString();
    }

    if (newStatus === 'COMPLETED') {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('mechanic_jobs')
      .update(updates)
      .eq('lead_id', leadId);

    if (error) {
      console.error('Error updating job status:', error);
    } else {
      fetchJobs();
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_mechanic">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_mechanic">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading">My Jobs</h1>
          <p className="text-text-body text-xs sm:text-sm mt-1 sm:mt-2">Manage your assigned service jobs</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="card">
            <p className="text-xs sm:text-sm text-gray-600">Total Assigned</p>
            <p className="text-xl sm:text-2xl font-bold">{jobs.length}</p>
          </div>
          <div className="card">
            <p className="text-xs sm:text-sm text-gray-600">In Progress</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">
              {jobs.filter(j => j.mechanic_status === 'IN_PROGRESS').length}
            </p>
          </div>
          <div className="card sm:col-span-1">
            <p className="text-xs sm:text-sm text-gray-600">Ready to Start</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">
              {jobs.filter(j => j.mechanic_status === 'ASSIGNED').length}
            </p>
          </div>
        </div>

        {/* Jobs Table */}
        {jobs.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
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
                  {jobs.map((job) => {
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
                              {job.before_images_count > 0 ? (
                                <CheckCircle className="w-3 h-3 text-green-600" />
                              ) : (
                                <Camera className="w-3 h-3 text-gray-300" />
                              )}
                              <span className="text-[10px] text-gray-600">B</span>
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
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded font-medium transition-colors flex items-center justify-center gap-1"
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
        ) : (
            <div className="card text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No jobs assigned to you</p>
            </div>
          )}
      </div>
    </DashboardLayout>
  );
}

