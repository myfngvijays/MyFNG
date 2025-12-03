'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CheckCircle, XCircle, Clock, Eye, Camera, AlertCircle, User, Car } from 'lucide-react';
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
  const [selectedJob, setSelectedJob] = useState<QCJob | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  const [approvalNotes, setApprovalNotes] = useState('');
  const [qualityScore, setQualityScore] = useState(5);
  
  const [rejectionReason, setRejectionReason] = useState('');
  const [failedItems, setFailedItems] = useState<string[]>([]);
  
  const [processing, setProcessing] = useState(false);

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
          table: 'mechanic_job_photos'
        },
        (payload) => {
          console.log('Photos updated:', payload);
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
      // AND status is not final states
      
      // First: Get jobs from service_leads with mechanic_completed_at set
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
        .not('mechanic_completed_at', 'is', null)
        .or('qc_status.is.null,qc_status.eq.PENDING')
        .not('status', 'eq', 'REJECTED')
        .not('status', 'eq', 'CANCELLED')
        .not('status', 'eq', 'COMPLETED')
        .not('status', 'eq', 'CLOSED')
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
              const statusOk = !['REJECTED', 'CANCELLED', 'COMPLETED', 'CLOSED'].includes(lead.status);
              return qcOk && statusOk;
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

        // Get image counts from mechanic_job_photos table
        const { count: beforeCount } = await supabase
          .from('mechanic_job_photos')
          .select('*', { count: 'exact', head: true })
          .eq('lead_id', job.id)
          .eq('photo_category', 'before');

        const { count: afterCount } = await supabase
          .from('mechanic_job_photos')
          .select('*', { count: 'exact', head: true })
          .eq('lead_id', job.id)
          .eq('photo_category', 'after');

        return {
          ...job,
          mechanic_name: mechanic?.full_name || 'Unknown',
          before_images_count: beforeCount || 0,
          after_images_count: afterCount || 0,
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

  async function handleApprove() {
    if (!selectedJob) return;

    setProcessing(true);

    try {
      const response = await fetch(`/api/supervisor/jobs/${selectedJob.id}/approve-qc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: approvalNotes,
          quality_score: qualityScore
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to approve QC');
        return;
      }

      toast.success('QC approved successfully!');
      setShowApproveModal(false);
      setSelectedJob(null);
      setApprovalNotes('');
      setQualityScore(5);
      fetchQCQueue();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to approve QC');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!selectedJob || !rejectionReason) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(`/api/supervisor/jobs/${selectedJob.id}/reject-qc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectionReason,
          failed_checklist_items: failedItems,
          notes: approvalNotes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to reject QC');
        return;
      }

      toast.success('QC rejected - Job sent back to mechanic');
      setShowRejectModal(false);
      setSelectedJob(null);
      setRejectionReason('');
      setFailedItems([]);
      setApprovalNotes('');
      fetchQCQueue();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to reject QC');
    } finally {
      setProcessing(false);
    }
  }

  const checklistItems = [
    'Before images uploaded',
    'After images uploaded',
    'Progress images uploaded',
    'All parts documented',
    'Service completed as requested',
    'No warning lights',
    'Test drive completed',
    'Car cleaned',
    'Documents ready',
    'No additional issues found'
  ];

  if (loading) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-6 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg">✅ Quality Check Queue</h1>
          <p className="text-white font-medium mt-1">Review and approve completed jobs</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100">
            <div className="flex items-center gap-3">
              <Clock className="w-10 h-10 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">Pending QC</p>
                <p className="text-3xl font-bold text-gray-800">{jobs.length}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-10 h-10 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">With Images</p>
                <p className="text-3xl font-bold text-gray-800">
                  {jobs.filter(j => j.before_images_count > 0 && j.after_images_count > 0).length}
                </p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-red-50 to-red-100">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-10 h-10 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Missing Images</p>
                <p className="text-3xl font-bold text-gray-800">
                  {jobs.filter(j => j.before_images_count === 0 || j.after_images_count === 0).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Jobs List */}
        {jobs.length === 0 ? (
          <div className="card text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">All Clear!</h3>
            <p className="text-gray-500">No jobs pending quality check.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="card hover:shadow-xl transition-shadow border-l-4 border-yellow-500">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="badge-blue text-lg">{job.lead_number}</span>
                      <p className="text-sm text-gray-600 mt-1">
                        Completed: {new Date(job.mechanic_completed_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/dashboard/workshop_supervisor/jobs/${job.id}/review`)}
                        className="btn-secondary flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Review
                      </button>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="font-semibold">{job.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-gray-500" />
                        <span>{job.vehicle_make} {job.vehicle_model} - {job.vehicle_number}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-gray-600">Mechanic:</p>
                        <p className="font-semibold">{job.mechanic_name}</p>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div className={`flex items-center gap-1 ${
                          job.before_images_count > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <Camera className="w-4 h-4" />
                          Before: {job.before_images_count}
                        </div>
                        <div className={`flex items-center gap-1 ${
                          job.after_images_count > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <Camera className="w-4 h-4" />
                          After: {job.after_images_count}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Work Summary */}
                  {job.work_summary && (
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm font-medium text-gray-700 mb-1">Work Summary:</p>
                      <p className="text-sm text-gray-600">{job.work_summary}</p>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <button
                      onClick={() => {
                        setSelectedJob(job);
                        setShowApproveModal(true);
                      }}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                      disabled={job.before_images_count === 0 || job.after_images_count === 0}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve QC
                    </button>
                    <button
                      onClick={() => {
                        setSelectedJob(job);
                        setShowRejectModal(true);
                      }}
                      className="btn-secondary bg-red-600 hover:bg-red-700 text-white flex-1 flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject QC
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Approve Modal */}
        {showApproveModal && selectedJob && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4 text-green-600">Approve Quality Check</h3>
              <p className="text-gray-700 mb-4">
                Lead: <strong>{selectedJob.lead_number}</strong>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quality Score (1-5)
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        onClick={() => setQualityScore(score)}
                        className={`flex-1 py-2 rounded border-2 font-semibold transition ${
                          qualityScore === score
                            ? 'border-green-600 bg-green-50 text-green-700'
                            : 'border-gray-300 hover:border-green-400'
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Approval Notes (Optional)
                  </label>
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    className="input w-full"
                    rows={3}
                    placeholder="Any notes or feedback..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="btn-primary bg-green-600 hover:bg-green-700 flex-1"
                >
                  {processing ? 'Approving...' : 'Approve & Continue'}
                </button>
                <button
                  onClick={() => {
                    setShowApproveModal(false);
                    setSelectedJob(null);
                    setApprovalNotes('');
                    setQualityScore(5);
                  }}
                  disabled={processing}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && selectedJob && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4 text-red-600">Reject Quality Check</h3>
              <p className="text-gray-700 mb-4">
                Lead: <strong>{selectedJob.lead_number}</strong>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="input w-full"
                    rows={3}
                    placeholder="Explain what needs to be fixed..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Failed Checklist Items
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {checklistItems.map((item) => (
                      <label key={item} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={failedItems.includes(item)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFailedItems([...failedItems, item]);
                            } else {
                              setFailedItems(failedItems.filter(i => i !== item));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    className="input w-full"
                    rows={2}
                    placeholder="Additional feedback for mechanic..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleReject}
                  disabled={processing || !rejectionReason}
                  className="btn-secondary bg-red-600 hover:bg-red-700 text-white flex-1"
                >
                  {processing ? 'Rejecting...' : 'Reject & Send Back'}
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedJob(null);
                    setRejectionReason('');
                    setFailedItems([]);
                    setApprovalNotes('');
                  }}
                  disabled={processing}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

