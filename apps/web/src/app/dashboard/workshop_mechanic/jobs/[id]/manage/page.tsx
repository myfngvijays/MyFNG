'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  PlayCircle, CheckCircle, Camera, AlertTriangle, DollarSign,
  Upload, Clock, User, Car, MapPin, FileText, Wrench, ArrowLeft
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import BeforeInspectionUpload from '@/components/mechanic/BeforeInspectionUpload';
import AfterServiceUpload from '@/components/mechanic/AfterServiceUpload';

export default function ManageJobPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [beforeImages, setBeforeImages] = useState<any[]>([]);
  const [afterImages, setAfterImages] = useState<any[]>([]);
  const [beforeInspectionComplete, setBeforeInspectionComplete] = useState(false);
  
  // Action states
  const [showStartModal, setShowStartModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showExtraWorkModal, setShowExtraWorkModal] = useState(false);
  
  // Form states
  const [startNotes, setStartNotes] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [workSummary, setWorkSummary] = useState('');
  
  // Extra work form
  const [extraWorkDescription, setExtraWorkDescription] = useState('');
  const [extraWorkReason, setExtraWorkReason] = useState('');
  const [extraWorkCost, setExtraWorkCost] = useState('');
  const [extraWorkCategory, setExtraWorkCategory] = useState('PARTS_REPLACEMENT');
  const [isUrgent, setIsUrgent] = useState(false);
  
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  async function fetchJobDetails() {
    const supabase = createClient();
    setLoading(true);

    try {
      // Fetch lead details
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        .select('*')
        .eq('id', jobId)
        .single();

      if (leadError || !leadData) {
        toast.error('Job not found');
        router.push('/dashboard/workshop_mechanic');
        return;
      }

      setLead(leadData);

      // Fetch mechanic job
      const { data: jobData } = await supabase
        .from('mechanic_jobs')
        .select('*')
        .eq('lead_id', jobId)
        .single();

      if (jobData) {
        setJob(jobData);
        setBeforeInspectionComplete(jobData.before_inspection_complete || false);

        const { data: beforeImgs } = await supabase
          .from('mechanic_job_photos')
          .select('*')
          .eq('job_id', jobData.id)
          .eq('photo_category', 'before')
          .order('created_at', { ascending: false });

      const { data: afterImgs } = await supabase
          .from('mechanic_job_photos')
        .select('*')
          .eq('job_id', jobData.id)
          .eq('photo_category', 'after')
          .order('created_at', { ascending: false });

      setBeforeImages(beforeImgs || []);
      setAfterImages(afterImgs || []);
      }

    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load job details');
    } finally {
      setLoading(false);
    }
  }

  async function handleStartJob() {
    setProcessing(true);

    try {
      const response = await fetch(`/api/mechanic/jobs/${jobId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: startNotes })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to start job');
        return;
      }

      toast.success('Job started successfully!');
      setShowStartModal(false);
      fetchJobDetails();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to start job');
    } finally {
      setProcessing(false);
    }
  }

  async function handleCompleteJob() {
    setProcessing(true);

    try {
      const response = await fetch(`/api/mechanic/jobs/${jobId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          notes: completionNotes,
          work_summary: workSummary 
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to complete job');
        return;
      }

      toast.success('Job completed successfully!');
      setShowCompleteModal(false);
      router.push('/dashboard/workshop_mechanic');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to complete job');
    } finally {
      setProcessing(false);
    }
  }

  async function handleRequestExtraWork() {
    if (!extraWorkDescription || !extraWorkReason || !extraWorkCost) {
      toast.error('Please fill all required fields');
      return;
    }

    const cost = parseFloat(extraWorkCost);
    if (isNaN(cost) || cost <= 0) {
      toast.error('Please enter a valid cost');
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(`/api/mechanic/jobs/${jobId}/request-extra-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: extraWorkDescription,
          reason: extraWorkReason,
          estimated_cost: cost,
          category: extraWorkCategory,
          is_urgent: isUrgent
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to request extra work');
        return;
      }

      toast.success('Extra work request submitted!');
      setShowExtraWorkModal(false);
      setExtraWorkDescription('');
      setExtraWorkReason('');
      setExtraWorkCost('');
      setIsUrgent(false);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to request extra work');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_mechanic">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout role="workshop_mechanic">
        <div className="card text-center py-12">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700">Job not found</h3>
        </div>
      </DashboardLayout>
    );
  }

  const canStart = ['TEAM_ASSIGNED', 'DELIVERED', 'ACCEPTED'].includes(lead.status);
  const canComplete = lead.status === 'IN_PROGRESS';
  const canRequestExtraWork = lead.status === 'IN_PROGRESS';

  return (
    <DashboardLayout role="workshop_mechanic">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex gap-2">
            {canStart && (
              <button
                onClick={() => setShowStartModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <PlayCircle className="w-5 h-5" />
                Start Job
              </button>
            )}
            {canRequestExtraWork && (
              <button
                onClick={() => setShowExtraWorkModal(true)}
                className="btn-secondary bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2"
              >
                <DollarSign className="w-5 h-5" />
                Request Extra Work
              </button>
            )}
            {canComplete && (
              <button
                onClick={() => setShowCompleteModal(true)}
                className="btn-primary bg-green-600 hover:bg-green-700 flex items-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Complete Job
              </button>
            )}
          </div>
        </div>

        {/* Status Banner */}
        <div className={`p-4 rounded-lg border-l-4 ${
          lead.status === 'IN_PROGRESS' ? 'bg-blue-50 border-blue-500' :
          lead.status === 'TEAM_ASSIGNED' ? 'bg-yellow-50 border-yellow-500' :
          'bg-gray-50 border-gray-500'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Current Status</p>
              <p className="text-xl font-bold">{lead.status.replace(/_/g, ' ')}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Lead Number</p>
              <p className="text-xl font-bold">{lead.lead_number}</p>
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Customer Info */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-brand-primary" />
              Customer Information
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-semibold">{lead.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Phone:</span>
                <span className="font-semibold">{lead.customer_phone}</span>
              </div>
              {lead.customer_email && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-semibold">{lead.customer_email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Vehicle Info */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Car className="w-5 h-5 text-brand-primary" />
              Vehicle Information
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Number:</span>
                <span className="font-semibold">{lead.vehicle_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Make/Model:</span>
                <span className="font-semibold">{lead.vehicle_make} {lead.vehicle_model}</span>
              </div>
              {lead.vehicle_fuel_type && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Fuel Type:</span>
                  <span className="font-semibold">{lead.vehicle_fuel_type}</span>
                </div>
              )}
              {lead.vehicle_odometer && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Odometer:</span>
                  <span className="font-semibold">{lead.vehicle_odometer} km</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Problem Description */}
        {lead.problem_description && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-primary" />
              Problem Description
            </h3>
            <p className="text-gray-700">{lead.problem_description}</p>
          </div>
        )}

        {/* After Service Photos - Show when job is in progress */}
        {canComplete && job && (
          <div className="card shadow-lg border-2 border-green-200">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 rounded-t-lg -m-6 mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <CheckCircle className="w-6 h-6" />
                After Service Completion (Mandatory)
              </h3>
              <p className="text-sm text-green-100 mt-1">
                Complete all requirements before marking job as complete
              </p>
            </div>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800 mb-1">
                    ⚠️ Completion Requirements:
                  </p>
                  <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                    <li>Minimum 6 after service photos (Front, Rear, Left, Right, Engine Bay, Old Parts)</li>
                    <li>Final odometer reading must be captured</li>
                    <li>All checklist items must be completed</li>
                    <li>Parts used must be recorded in system</li>
                    <li>Work notes must be entered</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <AfterServiceUpload
              leadId={jobId}
              jobId={job.id}
              onUploadComplete={() => {
                fetchJobDetails();
              }}
            />
          </div>
        )}

        {/* Images Gallery - Show when job is completed */}
        {lead.status === 'COMPLETED' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Before Images */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5 text-brand-primary" />
              Before Images ({beforeImages.length})
            </h3>
            {beforeImages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Camera className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No before images uploaded yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                  {beforeImages.map((img: any) => (
                    <div key={img.id} className="relative aspect-square group">
                    <img
                        src={img.photo_url}
                        alt={img.photo_type || 'Before'}
                        className="w-full h-full object-cover rounded cursor-pointer hover:opacity-80 transition"
                    />
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b">
                        {img.photo_type?.replace('BEFORE_', '') || 'Photo'}
                      </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* After Images */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5 text-green-600" />
              After Images ({afterImages.length})
            </h3>
            {afterImages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Camera className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No after images uploaded yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                  {afterImages.map((img: any) => (
                    <div key={img.id} className="relative aspect-square group">
                    <img
                        src={img.photo_url}
                        alt={img.photo_type || 'After'}
                        className="w-full h-full object-cover rounded cursor-pointer hover:opacity-80 transition"
                    />
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b">
                        {img.photo_type?.replace('AFTER_', '') || 'Photo'}
                      </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        )}

        {/* Before Inspection Section - Show if job not started */}
        {canStart && job && (
          <div className="card shadow-lg border-2 border-blue-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-t-lg -m-6 mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Camera className="w-6 h-6" />
                Before Inspection (Mandatory)
              </h3>
              <p className="text-sm text-blue-100 mt-1">
                Complete all required photos before starting repair work
              </p>
            </div>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800 mb-1">
                    ⚠️ Mandatory Requirements:
                  </p>
                  <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                    <li>Minimum 6 photos required (Front, Rear, Left, Right, Dashboard, Engine Bay)</li>
                    <li>Odometer reading must be clearly visible in dashboard photo</li>
                    <li>GPS location recommended for verification</li>
                    <li>All photos must be uploaded before "Start Job" button is enabled</li>
                  </ul>
                </div>
          </div>
        </div>
            
            <BeforeInspectionUpload
              leadId={jobId}
              jobId={job.id}
              onUploadComplete={() => {
                fetchJobDetails();
              }}
            />
          </div>
        )}

        {/* Start Job Modal */}
        {showStartModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4 text-blue-600">Start Job</h3>
              {beforeImages.filter((img: any) => img.photo_category === 'before').length < 6 && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                  <p className="text-sm text-red-700">
                    ⚠️ Before inspection incomplete. Please upload all required photos first.
                  </p>
                </div>
              )}
              <p className="text-gray-700 mb-4">
                You are about to start working on lead <strong>{lead.lead_number}</strong>.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Notes (Optional)
                </label>
                <textarea
                  value={startNotes}
                  onChange={(e) => setStartNotes(e.target.value)}
                  className="input w-full"
                  rows={3}
                  placeholder="Any initial observations or notes..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleStartJob}
                  disabled={processing || beforeImages.filter((img: any) => img.photo_category === 'before').length < 6}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Starting...' : 'Start Job'}
                </button>
                <button
                  onClick={() => setShowStartModal(false)}
                  disabled={processing}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complete Job Modal */}
        {showCompleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4 text-green-600">Complete Job</h3>
              
              {/* Validation warnings */}
              {beforeImages.filter((img: any) => img.photo_category === 'before').length < 6 && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                  <p className="text-sm text-red-700">⚠️ Before inspection incomplete (minimum 6 photos required)</p>
                </div>
              )}
              {afterImages.filter((img: any) => img.photo_category === 'after').length < 6 && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                  <p className="text-sm text-red-700">⚠️ After service photos incomplete (minimum 6 photos required)</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Work Summary <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={workSummary}
                    onChange={(e) => setWorkSummary(e.target.value)}
                    className="input w-full"
                    rows={3}
                    placeholder="Describe the work completed..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    className="input w-full"
                    rows={2}
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCompleteJob}
                  disabled={
                    processing || 
                    beforeImages.filter((img: any) => img.photo_category === 'before').length < 6 ||
                    afterImages.filter((img: any) => img.photo_category === 'after').length < 6 ||
                    !workSummary.trim()
                  }
                  className="btn-primary bg-green-600 hover:bg-green-700 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Completing...' : 'Complete Job'}
                </button>
                <button
                  onClick={() => setShowCompleteModal(false)}
                  disabled={processing}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Extra Work Request Modal */}
        {showExtraWorkModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4 text-orange-600">Request Extra Work Approval</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={extraWorkDescription}
                    onChange={(e) => setExtraWorkDescription(e.target.value)}
                    className="input w-full"
                    rows={3}
                    placeholder="Describe the additional work required..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={extraWorkReason}
                    onChange={(e) => setExtraWorkReason(e.target.value)}
                    className="input w-full"
                    rows={2}
                    placeholder="Why is this work necessary?"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Cost (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={extraWorkCost}
                    onChange={(e) => setExtraWorkCost(e.target.value)}
                    className="input w-full"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={extraWorkCategory}
                    onChange={(e) => setExtraWorkCategory(e.target.value)}
                    className="input w-full"
                  >
                    <option value="PARTS_REPLACEMENT">Parts Replacement</option>
                    <option value="ADDITIONAL_SERVICE">Additional Service</option>
                    <option value="URGENT_REPAIR">Urgent Repair</option>
                    <option value="EXTENDED_WORK">Extended Work</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="urgent"
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="urgent" className="text-sm font-medium text-gray-700">
                    Mark as Urgent (requires immediate supervisor approval)
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleRequestExtraWork}
                  disabled={processing}
                  className="btn-secondary bg-orange-600 hover:bg-orange-700 text-white flex-1"
                >
                  {processing ? 'Submitting...' : 'Submit Request'}
                </button>
                <button
                  onClick={() => setShowExtraWorkModal(false)}
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

