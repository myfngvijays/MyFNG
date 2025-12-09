'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CheckCircle, Clock, Eye, Camera, AlertCircle, User, Car } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface QCJob {
  id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  mechanic_name: string;
  mechanic_completed_at: string;
  before_images_count: number;
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
        .not('status', 'eq', 'REJECTED')
        .not('status', 'eq', 'CANCELLED')
        .not('status', 'eq', 'CLOSED')
        .not('status', 'eq', 'QC_APPROVED')
        .not('status', 'eq', 'READY_FOR_BILLING')
        .order('mechanic_completed_at', { ascending: true, nullsFirst: false });

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
              const statusOk = !['REJECTED', 'CANCELLED', 'CLOSED', 'QC_APPROVED', 'READY_FOR_BILLING'].includes(lead.status);
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
        return dateA - dateB;
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
      const jobsWithDetails = await Promise.all((qcJobs || []).map(async (job) => {
        // Get mechanic name
        const { data: mechanic } = await supabase
          .from('users_login')
          .select('full_name')
          .eq('id', job.assigned_mechanic_id)
          .maybeSingle();

        // Get image counts from lead_media table
        const { count: beforeCount } = await supabase
          .from('lead_media')
          .select('*', { count: 'exact', head: true })
          .eq('lead_id', job.id)
          .eq('category', 'BEFORE');

        const { count: afterCount } = await supabase
          .from('lead_media')
          .select('*', { count: 'exact', head: true })
          .eq('lead_id', job.id)
          .eq('category', 'AFTER');

        // Also check mechanic_media table as fallback
        const { count: beforeCountMechanic } = await supabase
          .from('mechanic_media')
          .select('*', { count: 'exact', head: true })
          .eq('lead_id', job.id)
          .eq('media_category', 'BEFORE');

        const { count: afterCountMechanic } = await supabase
          .from('mechanic_media')
          .select('*', { count: 'exact', head: true })
          .eq('lead_id', job.id)
          .eq('media_category', 'AFTER');

        return {
          ...job,
          mechanic_name: mechanic?.full_name || 'Unknown',
          before_images_count: (beforeCount || 0) + (beforeCountMechanic || 0),
          after_images_count: (afterCount || 0) + (afterCountMechanic || 0),
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
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-300 drop-shadow-lg">✅ Quality Check Queue</h1>
          <p className="text-white font-medium text-sm sm:text-base mt-0.5 sm:mt-1">Review and approve completed jobs</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100">
            <div className="flex items-center gap-2 sm:gap-3">
              <Clock className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-yellow-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Pending QC</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">{jobs.length}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-center gap-2 sm:gap-3">
              <CheckCircle className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-green-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">With Images</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">
                  {jobs.filter(j => j.before_images_count > 0 && j.after_images_count > 0).length}
                </p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-red-50 to-red-100 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 sm:gap-3">
              <AlertCircle className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-red-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Missing Images</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">
                  {jobs.filter(j => j.before_images_count === 0 || j.after_images_count === 0).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Jobs List */}
        {jobs.length === 0 ? (
          <div className="card text-center py-8 sm:py-10 md:py-12">
            <CheckCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-green-500 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-1.5 sm:mb-2">All Clear!</h3>
            <p className="text-gray-500 text-sm sm:text-base">No jobs pending quality check.</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="card hover:shadow-xl transition-shadow border-l-4 border-yellow-500">
                <div className="space-y-3 sm:space-y-4">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="badge-blue text-sm sm:text-base md:text-lg">{job.lead_number}</span>
                      <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
                        Completed: {new Date(job.mechanic_completed_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => router.push(`/dashboard/workshop_supervisor/jobs/${job.id}/review`)}
                        className="btn-secondary flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex-1 sm:flex-initial"
                      >
                        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Review
                      </button>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                        <span className="font-semibold text-sm sm:text-base truncate">{job.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-xs sm:text-sm truncate">{job.vehicle_make} {job.vehicle_model} - {job.vehicle_number}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Mechanic:</p>
                        <p className="font-semibold text-sm sm:text-base truncate">{job.mechanic_name}</p>
                      </div>
                      <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
                        <div className={`flex items-center gap-1 ${
                          job.before_images_count > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          Before: {job.before_images_count}
                        </div>
                        <div className={`flex items-center gap-1 ${
                          job.after_images_count > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          After: {job.after_images_count}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Work Summary */}
                  {job.work_summary && (
                    <div className="bg-gray-50 p-2.5 sm:p-3 rounded">
                      <p className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Work Summary:</p>
                      <p className="text-xs sm:text-sm text-gray-600">{job.work_summary}</p>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <button
                      onClick={() => router.push(`/dashboard/workshop_supervisor/jobs/${job.id}/review`)}
                      className="btn-primary flex-1 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                    >
                      <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Review
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

