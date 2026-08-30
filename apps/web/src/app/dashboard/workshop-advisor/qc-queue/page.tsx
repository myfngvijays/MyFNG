'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CheckCircle, Clock, Eye, Camera, AlertCircle, User, Car } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { formatDateTime } from "@/lib/utils";
import { AdvisorPageHeader } from '@/components/advisor/AdvisorPageHeader';

interface QCJob {
  id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  mechanic_name: string;
  mechanic_completed_at: string;
  pv_images_count: number;
  after_images_count: number;
  work_summary: string;
  status: string;
}

export default function QCQueuePage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<QCJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQCQueue();
    
    // Setup real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel('qc-queue-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads'
        },
        (payload) => {
          console.log('QC Queue updated:', payload);
          fetchQCQueue();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_media'
        },
        (payload) => {
          console.log('Photos updated:', payload);
          fetchQCQueue();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_media'
        },
        (payload) => {
          console.log('Mechanic media updated:', payload);
          fetchQCQueue();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_job_photos'
        },
        (payload) => {
          console.log('Mechanic job photos updated:', payload);
          fetchQCQueue();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  async function fetchQCQueue() {
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
        .select('workshop_id, id')
        .eq('email', user.email)
        .single();

      if (!userProfile?.workshop_id) {
        toast.error('Workshop not found');
        return;
      }

      // Fetch jobs pending QC - jobs where mechanic has completed work
      // Check both service_leads.mechanic_completed_at AND mechanic_jobs.completed_at
      // AND qc_status is NULL/PENDING (not yet QC'd)
      // AND status is WORK_COMPLETED or other valid states
      
      // First: Get jobs from service_leads with WORK_COMPLETED status OR mechanic_completed_at set
      const { data: qcJobsFromLeads, error: leadsError } = await supabase
        .from('service_leads')
        .select(`
          id,
          lead_number,
          customer_name,
          vehicle_number,
          vehicle_make,
          vehicle_model,
          mechanic_completed_at,
          notes,
          status,
          qc_status,
          assigned_mechanic_id
        `)
        .eq('workshop_id', userProfile.workshop_id)
        .or('status.eq.WORK_COMPLETED,mechanic_completed_at.not.is.null')
        .or('qc_status.is.null,qc_status.eq.PENDING')
        .is('deleted_at', null)
        .not('status', 'eq', 'REJECTED')
        .not('status', 'eq', 'CANCELLED')
        .not('status', 'eq', 'CLOSED')
        .not('status', 'eq', 'QC_APPROVED')
        .not('status', 'eq', 'READY_FOR_BILLING')
        .not('status', 'eq', 'PAYMENT_AWAITING')
        // Latest first
        .order('mechanic_completed_at', { ascending: false, nullsFirst: false });

      // Second: Get jobs from mechanic_jobs table where completed_at is set
      // Then fetch the corresponding service_leads
      const { data: completedMechanicJobs, error: mjError } = await supabase
        .from('mechanic_jobs')
        .select('lead_id, completed_at')
        .not('completed_at', 'is', null);

      let qcJobsFromMechanicJobs: any[] = [];
      
      if (completedMechanicJobs && completedMechanicJobs.length > 0) {
        const leadIds = completedMechanicJobs.map(job => job.lead_id);
        console.log('Found mechanic jobs with completed_at, lead_ids:', leadIds);
        
        // Fetch the corresponding service_leads - first get all, then filter client-side
        const { data: leadsFromJobs, error: leadsFromJobsError } = await supabase
          .from('service_leads')
          .select(`
            id,
            lead_number,
            customer_name,
            vehicle_number,
            vehicle_make,
            vehicle_model,
            mechanic_completed_at,
            notes,
            status,
            qc_status,
            assigned_mechanic_id
          `)
          .eq('workshop_id', userProfile.workshop_id)
          .in('id', leadIds);

        console.log('Leads from mechanic_jobs:', leadsFromJobs);

        if (leadsFromJobs) {
          // Filter client-side: only include if qc_status is null/pending and status is not final
          qcJobsFromMechanicJobs = leadsFromJobs
            .filter(lead => {
              const qcOk = !lead.qc_status || lead.qc_status === 'PENDING';
              const statusOk = !['REJECTED', 'CANCELLED', 'CLOSED', 'QC_APPROVED', 'READY_FOR_BILLING', 'PAYMENT_AWAITING'].includes(lead.status);
              // Include WORK_COMPLETED status for QC
              const isWorkCompleted = lead.status === 'WORK_COMPLETED';
              return qcOk && (statusOk || isWorkCompleted);
            })
            .map(lead => {
              const mechanicJob = completedMechanicJobs.find(mj => mj.lead_id === lead.id);
              return {
                ...lead,
                mechanic_completed_at: lead.mechanic_completed_at || mechanicJob?.completed_at
              };
            });
          
          console.log('Filtered QC jobs from mechanic_jobs:', qcJobsFromMechanicJobs.length);
        }
      }

      // Combine and deduplicate results
      const allJobs = [...(qcJobsFromLeads || []), ...qcJobsFromMechanicJobs];
      const uniqueJobs = allJobs.filter((job, index, self) => 
        index === self.findIndex((j) => j.id === job.id)
      );

      const qcJobs = uniqueJobs.sort((a, b) => {
        const dateA = a.mechanic_completed_at ? new Date(a.mechanic_completed_at).getTime() : 0;
        const dateB = b.mechanic_completed_at ? new Date(b.mechanic_completed_at).getTime() : 0;
        // Latest first
        return dateB - dateA;
      });

      if (leadsError) {
        console.error('Error fetching QC queue from leads:', leadsError);
      }
      if (mjError) {
        console.error('Error fetching mechanic jobs:', mjError);
      }

      console.log('QC Jobs found:', qcJobs?.length || 0, qcJobs);
      
      // Debug: Check if there are any leads with mechanic_completed_at at all
      if (!qcJobs || qcJobs.length === 0) {
        console.log('No QC jobs found. Checking all leads...');
        
        // Check all leads in workshop
        const { data: allLeads, error: debugError } = await supabase
          .from('service_leads')
          .select('id, lead_number, mechanic_completed_at, qc_status, status, assigned_mechanic_id, assigned_supervisor_id')
          .eq('workshop_id', userProfile.workshop_id)
          .limit(20);
        console.log('Sample leads in workshop:', allLeads);
        
        // Check mechanic_jobs table separately
        const { data: mechanicJobs, error: mjError } = await supabase
          .from('mechanic_jobs')
          .select('lead_id, completed_at, mechanic_status')
          .not('completed_at', 'is', null)
          .limit(10);
        console.log('Mechanic jobs with completed_at:', mechanicJobs);
        
        // Check if there are any IN_PROGRESS leads that might be ready for QC
        const { data: inProgressLeads, error: ipError } = await supabase
          .from('service_leads')
          .select('id, lead_number, status, assigned_mechanic_id, mechanic_completed_at')
          .eq('workshop_id', userProfile.workshop_id)
          .eq('status', 'IN_PROGRESS')
          .limit(10);
        console.log('IN_PROGRESS leads:', inProgressLeads);
      }

      // Fetch mechanic names and image counts from mechanic_job_photos
      const leadIdsForCounts = (qcJobs || []).map((j: any) => j.id);

      // Map lead_id -> mechanic_jobs.id (job_id) so we can count mechanic_job_photos
      const { data: mechanicJobsForLeads } = leadIdsForCounts.length
        ? await supabase
            .from('mechanic_jobs')
            .select('id, lead_id')
            .in('lead_id', leadIdsForCounts)
        : { data: [] as any[] };

      const leadIdToJobId = new Map<string, string>();
      (mechanicJobsForLeads || []).forEach((mj: any) => {
        if (mj?.lead_id && mj?.id) leadIdToJobId.set(mj.lead_id, mj.id);
      });

      const jobIds = Array.from(new Set(Array.from(leadIdToJobId.values())));

      // Batch fetch photo rows to compute counts client-side (fast + avoids N queries)
      const { data: jobPhotos } = jobIds.length
        ? await supabase
            .from('mechanic_job_photos')
            .select('job_id, photo_category')
            .in('job_id', jobIds)
        : { data: [] as any[] };

      const jobPhotoCounts = new Map<string, { before: number; after: number }>();
      (jobPhotos || []).forEach((p: any) => {
        const jobId = p?.job_id;
        const cat = p?.photo_category;
        if (!jobId || (cat !== 'before' && cat !== 'after')) return;
        const prev = jobPhotoCounts.get(jobId) || { before: 0, after: 0 };
        if (cat === 'before') prev.before += 1;
        if (cat === 'after') prev.after += 1;
        jobPhotoCounts.set(jobId, prev);
      });

      // Batch fetch legacy media rows too (some older flows still use these)
      const { data: leadMediaRows } = leadIdsForCounts.length
        ? await supabase
            .from('lead_media')
            .select('lead_id, category')
            .in('lead_id', leadIdsForCounts)
            .in('category', ['BEFORE', 'AFTER'])
        : { data: [] as any[] };

      // PV counts (Pickup/Visit) come from lead_media BEFORE_* slots.
      // Use service-role backed API (schema + RLS tolerant).
      let pvCounts: Record<string, { required_uploaded: number; required_total: number }> = {};
      try {
        if (leadIdsForCounts.length > 0) {
          const pvRes = await fetch('/api/leads/media-counts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead_ids: leadIdsForCounts }),
          });
          const pvJson = await pvRes.json().catch(() => ({}));
          if (pvRes.ok && (pvJson as any)?.success) {
            pvCounts = ((pvJson as any)?.counts || {}) as any;
          }
        }
      } catch {
        pvCounts = {};
      }

      const { data: mechanicMediaRows } = leadIdsForCounts.length
        ? await supabase
            .from('mechanic_media')
            .select('lead_id, media_category')
            .in('lead_id', leadIdsForCounts)
            .in('media_category', ['BEFORE', 'AFTER'])
        : { data: [] as any[] };

      const mechanicMediaCounts = new Map<string, { before: number; after: number }>();
      (mechanicMediaRows || []).forEach((m: any) => {
        const leadId = m?.lead_id;
        const cat = m?.media_category;
        if (!leadId || (cat !== 'BEFORE' && cat !== 'AFTER')) return;
        const prev = mechanicMediaCounts.get(leadId) || { before: 0, after: 0 };
        if (cat === 'BEFORE') prev.before += 1;
        if (cat === 'AFTER') prev.after += 1;
        mechanicMediaCounts.set(leadId, prev);
      });

      const jobsWithDetails = await Promise.all((qcJobs || []).map(async (job) => {
        // Get mechanic name
        const { data: mechanic } = await supabase
          .from('users_login')
          .select('full_name')
          .eq('id', job.assigned_mechanic_id)
          .maybeSingle();

        const legacyMechanic = mechanicMediaCounts.get(job.id) || { before: 0, after: 0 };

        const mjId = leadIdToJobId.get(job.id);
        const jobPhoto = mjId ? (jobPhotoCounts.get(mjId) || { before: 0, after: 0 }) : { before: 0, after: 0 };
        const pv = pvCounts[String(job.id || '').trim()];
        const pvUploaded = Number(pv?.required_uploaded || 0) || 0;

        return {
          ...job,
          mechanic_name: mechanic?.full_name || 'Unknown',
          pv_images_count: pvUploaded,
          // After: keep existing aggregation (mechanic media + mechanic_job_photos)
          after_images_count: legacyMechanic.after + jobPhoto.after,
          work_summary: job.notes || 'No summary provided'
        };
      }));

      setJobs(jobsWithDetails);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load QC queue');
    } finally {
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
          title="QC Queue"
          subtitle="Approve or reject completed jobs"
          href="/dashboard/workshop-advisor/qc-queue"
        />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-3">
              <Clock className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-yellow-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Pending QC</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">{jobs.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-3">
              <CheckCircle className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-green-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">With Images</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">
                  {jobs.filter(j => j.pv_images_count > 0 && j.after_images_count > 0).length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100 p-4 shadow-sm sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 sm:gap-3">
              <AlertCircle className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-red-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Missing Images</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">
                  {jobs.filter(j => j.pv_images_count === 0 || j.after_images_count === 0).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Jobs Table */}
        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-10 text-center shadow-sm sm:py-12">
            <CheckCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-green-500 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-1.5 sm:mb-2">All Clear!</h3>
            <p className="text-gray-500 text-sm sm:text-base">No jobs pending quality check.</p>
          </div>
        ) : (
          <>
          <div className="space-y-3 lg:hidden">
            {jobs.map((job) => (
              <div key={job.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-blue-700">#{job.lead_number}</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">{job.customer_name}</p>
                <p className="truncate text-xs text-slate-500">{job.vehicle_number} · {job.vehicle_make} {job.vehicle_model}</p>
                <p className="mt-1 text-xs text-slate-500">Mechanic: {job.mechanic_name || '—'}</p>
                <p className="mt-1 text-xs text-slate-500">PV {job.pv_images_count}/6 · After {job.after_images_count}</p>
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/workshop-advisor/jobs/${job.id}/review`)}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white"
                >
                  <Eye className="h-4 w-4" />
                  Review
                </button>
              </div>
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
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mechanic</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Images</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Work Summary</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      {/* Lead Number */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="text-sm font-medium text-blue-600">#{job.lead_number}</div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                            {job.customer_name}
                          </span>
                        </div>
                      </td>

                      {/* Vehicle */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                              {job.vehicle_number}
                            </div>
                            <div className="text-xs text-gray-500 truncate max-w-[150px]">
                              {job.vehicle_make} {job.vehicle_model}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Mechanic */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="text-sm text-gray-900 truncate max-w-[120px]">
                          {job.mechanic_name}
                        </div>
                      </td>

                      {/* Images */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            {job.pv_images_count > 0 ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <Camera className="w-4 h-4 text-red-500" />
                            )}
                            <span className={`text-xs font-medium ${
                              job.pv_images_count > 0 ? 'text-green-700' : 'text-red-700'
                            }`}>
                              PV: {job.pv_images_count}/6
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {job.after_images_count > 0 ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <Camera className="w-4 h-4 text-red-500" />
                            )}
                            <span className={`text-xs font-medium ${
                              job.after_images_count > 0 ? 'text-green-700' : 'text-red-700'
                            }`}>
                              After: {job.after_images_count}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Completed At */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="text-xs sm:text-sm text-gray-700">
                          {job.mechanic_completed_at ? formatDateTime(job.mechanic_completed_at) : 'N/A'}
                        </div>
                      </td>

                      {/* Work Summary */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="text-xs sm:text-sm text-gray-700 truncate max-w-[200px]" title={job.work_summary}>
                          {job.work_summary || '—'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => router.push(`/dashboard/workshop-advisor/jobs/${job.id}/review`)}
                          className="btn btn-primary flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                        >
                          <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}

      </div>
    </DashboardLayout>
  );
}

