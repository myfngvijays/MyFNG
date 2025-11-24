'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  ArrowLeft, PlayCircle, PauseCircle, CheckCircle, Camera, 
  Package, AlertTriangle, MessageSquare, FileText, Clock,
  Upload, X, Save, Send, Plus, Minus
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface JobDetail {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_variant: string;
  vehicle_year: number;
  odometer_reading: number;
  fuel_type: string;
  problem_description: string;
  service_types: string[];
  mechanic_status: string;
  job_priority: string;
  sla_remaining_minutes: number;
  assigned_at: string;
  started_at: string;
  expected_completion_time: string;
  work_notes: string;
  checklist_completed: boolean;
  before_images_count: number;
  progress_images_count: number;
  after_images_count: number;
  min_before_images: number;
  min_progress_images: number;
  min_after_images: number;
}

interface ChecklistItem {
  id: string;
  name: string;
  status: string;
  notes: string;
  mandatory: boolean;
  completed_at: string;
}

interface MediaItem {
  id: string;
  media_url: string;
  media_category: string;
  description: string;
  uploaded_at: string;
}

interface PartsItem {
  id: string;
  part_name: string;
  quantity_issued: number;
  quantity_used: number;
  usage_status: string;
  part_notes: string;
}

export default function MechanicJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = params?.id as string;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [parts, setParts] = useState<PartsItem[]>([]);
  const [extraWorkRequests, setExtraWorkRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Form states
  const [workNotes, setWorkNotes] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('BEFORE');
  const [showExtraWorkForm, setShowExtraWorkForm] = useState(false);
  const [extraWorkForm, setExtraWorkForm] = useState({
    issue_description: '',
    additional_work_required: '',
    estimated_cost: ''
  });

  useEffect(() => {
    if (leadId) {
      fetchJobDetails();

      // Setup realtime subscription for this specific job
      const supabase = createClient();
      const channel = supabase
        .channel(`job-${leadId}-changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'mechanic_jobs',
            filter: `lead_id=eq.${leadId}`
          },
          (payload) => {
            console.log('Job updated in real-time:', payload);
            fetchJobDetails();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'service_checklists',
            filter: `lead_id=eq.${leadId}`
          },
          (payload) => {
            console.log('Checklist updated in real-time:', payload);
            fetchJobDetails();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'mechanic_media',
            filter: `lead_id=eq.${leadId}`
          },
          (payload) => {
            console.log('Media updated in real-time:', payload);
            fetchJobDetails();
          }
        )
        .subscribe((status) => {
          console.log('Job detail realtime subscription status:', status);
        });

      // Cleanup on unmount
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [leadId]);

  useEffect(() => {
    const action = searchParams?.get('action');
    if (action === 'upload') {
      setActiveTab('media');
    }
  }, [searchParams]);

  async function fetchJobDetails() {
    const supabase = createClient();

    try {
      console.log('Fetching job details for lead_id:', leadId);
      
      // Get job details
      const { data: jobData, error: jobError } = await supabase
        .from('mechanic_jobs')
        .select(`
          *,
          service_leads:lead_id (
            lead_number,
            customer_name,
            customer_phone,
            vehicle_number,
            vehicle_make,
            vehicle_model,
            vehicle_variant,
            vehicle_fuel_type,
            problem_description,
            service_type_ids,
            subservice_ids
          )
        `)
        .eq('lead_id', leadId)
        .single();

      if (jobError) {
        console.error('Error fetching job from mechanic_jobs:', jobError);
      }

      console.log('Job data received:', jobData);

      if (jobData) {
        const jobDetail: JobDetail = {
          id: jobData.id,
          lead_id: jobData.lead_id,
          lead_number: jobData.service_leads?.lead_number || '',
          customer_name: jobData.service_leads?.customer_name || '',
          vehicle_number: jobData.service_leads?.vehicle_number || '',
          vehicle_make: jobData.service_leads?.vehicle_make || '',
          vehicle_model: jobData.service_leads?.vehicle_model || '',
          vehicle_variant: jobData.service_leads?.vehicle_variant || '',
          vehicle_year: 0,
          odometer_reading: 0,
          fuel_type: jobData.service_leads?.vehicle_fuel_type || '',
          problem_description: jobData.service_leads?.problem_description || '',
          service_types: jobData.service_leads?.service_type_ids || jobData.service_leads?.subservice_ids || [],
          mechanic_status: jobData.mechanic_status,
          job_priority: jobData.job_priority,
          sla_remaining_minutes: jobData.sla_remaining_minutes ?? calculateSLARemaining(jobData.expected_completion_time),
          assigned_at: jobData.assigned_at,
          started_at: jobData.started_at,
          expected_completion_time: jobData.expected_completion_time ?? calculateExpectedCompletion(jobData.assigned_at, jobData.job_priority),
          work_notes: jobData.work_notes || '',
          checklist_completed: jobData.checklist_completed,
          before_images_count: jobData.before_images_count,
          progress_images_count: jobData.progress_images_count,
          after_images_count: jobData.after_images_count,
          min_before_images: jobData.min_before_images,
          min_progress_images: jobData.min_progress_images,
          min_after_images: jobData.min_after_images
        };
        setJob(jobDetail);
        setWorkNotes(jobDetail.work_notes);
      }

      // Get checklist
      const { data: checklistData, error: checklistError } = await supabase
        .from('service_checklists')
        .select('*')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (checklistError) {
        console.error('Checklist error:', checklistError);
      }

      if (checklistData && checklistData.checklist_items) {
        setChecklist(checklistData.checklist_items);
      }

      // Get media
      const { data: mediaData, error: mediaError } = await supabase
        .from('mechanic_media')
        .select('*')
        .eq('lead_id', leadId)
        .order('uploaded_at', { ascending: false });

      if (mediaError) {
        console.error('Media error:', mediaError);
      }

      setMedia(mediaData || []);

      // Get parts
      const { data: partsData, error: partsError } = await supabase
        .from('mechanic_parts_usage')
        .select('*')
        .eq('lead_id', leadId);

      if (partsError) {
        console.error('Parts error:', partsError);
      }

      setParts(partsData || []);

      // Get extra work requests
      const { data: extraWorkData, error: extraWorkError } = await supabase
        .from('mechanic_extra_work_requests')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (extraWorkError) {
        console.error('Extra work error:', extraWorkError);
      }

      setExtraWorkRequests(extraWorkData || []);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching job details:', error);
      setLoading(false);
    }
  }

  async function updateJobStatus(newStatus: string) {
    console.log('Updating job status to:', newStatus);
    const supabase = createClient();
    
    if (!job || !leadId) {
      console.error('No job or leadId available');
      return;
    }

    const updates: any = {
      mechanic_status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (newStatus === 'IN_PROGRESS' && !job?.started_at) {
      updates.started_at = new Date().toISOString();
    }

    if (newStatus === 'COMPLETED') {
      updates.completed_at = new Date().toISOString();
    }

    console.log('Updating mechanic_jobs with:', updates);

    const { data, error } = await supabase
      .from('mechanic_jobs')
      .update(updates)
      .eq('lead_id', leadId)
      .select();

    if (error) {
      console.error('Error updating job status:', error);
      alert('Failed to update job status: ' + error.message);
    } else {
      console.log('Job status updated successfully:', data);
      fetchJobDetails();
    }
  }

  async function updateChecklistItem(itemId: string, status: string, notes: string = '') {
    const supabase = createClient();

    const updatedChecklist = checklist.map(item =>
      item.id === itemId
        ? { ...item, status, notes, completed_at: status === 'COMPLETED' ? new Date().toISOString() : item.completed_at }
        : item
    );

    const { error } = await supabase
      .from('service_checklists')
      .update({
        checklist_items: updatedChecklist,
        updated_at: new Date().toISOString()
      })
      .eq('lead_id', leadId);

    if (!error) {
      setChecklist(updatedChecklist);
      
      // Trigger completion calculation
      await supabase.rpc('update_checklist_completion', {
        p_checklist_id: (await supabase
          .from('service_checklists')
          .select('id')
          .eq('lead_id', leadId)
          .single()).data?.id
      });
    }
  }

  async function handleMediaUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingMedia(true);
    const supabase = createClient();

    try {
      for (const file of Array.from(files)) {
        // Upload to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${leadId}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `mechanic_media/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('service-media')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('service-media')
          .getPublicUrl(filePath);

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        // Save to database
        await supabase
          .from('mechanic_media')
          .insert({
            lead_id: leadId,
            mechanic_id: user?.id,
            media_url: publicUrl,
            media_category: selectedCategory,
            media_type: 'IMAGE',
            file_size_kb: Math.round(file.size / 1024)
          });
      }

      fetchJobDetails();
    } catch (error) {
      console.error('Error uploading media:', error);
    } finally {
      setUploadingMedia(false);
    }
  }

  async function saveWorkNotes() {
    const supabase = createClient();

    await supabase
      .from('mechanic_jobs')
      .update({
        work_notes: workNotes,
        updated_at: new Date().toISOString()
      })
      .eq('lead_id', leadId);
  }

  async function submitExtraWorkRequest() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('mechanic_extra_work_requests')
      .insert({
        lead_id: leadId,
        mechanic_id: user?.id,
        issue_description: extraWorkForm.issue_description,
        additional_work_required: extraWorkForm.additional_work_required,
        estimated_cost: extraWorkForm.estimated_cost ? parseFloat(extraWorkForm.estimated_cost) : null,
        status: 'PENDING'
      });

    if (!error) {
      setShowExtraWorkForm(false);
      setExtraWorkForm({ issue_description: '', additional_work_required: '', estimated_cost: '' });
      fetchJobDetails();
      
      // Update job status to WAITING_APPROVAL
      await updateJobStatus('WAITING_APPROVAL');
    }
  }

  async function updatePartUsage(partId: string, field: string, value: any) {
    const supabase = createClient();

    await supabase
      .from('mechanic_parts_usage')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', partId);

    fetchJobDetails();
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

  if (!job) {
    return (
      <DashboardLayout role="workshop_mechanic">
        <div className="text-center py-12">
          <p className="text-gray-500 text-xl mb-2">Job not found</p>
          <p className="text-sm text-gray-400 mb-4">Lead ID: {leadId}</p>
          <p className="text-sm text-gray-400 mb-4">
            Check console for details or verify the mechanic_jobs entry exists for this lead.
          </p>
          <button onClick={() => router.back()} className="btn btn-primary mt-4">
            Go Back
          </button>
          <button 
            onClick={() => window.location.reload()} 
            className="btn btn-outline mt-4 ml-2"
          >
            Refresh Page
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ASSIGNED': return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'HOLD':
      case 'WAITING_APPROVAL': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  function getServiceTypeName(serviceTypeId: string): string {
    const serviceTypeMap: { [key: string]: string } = {
      'd0000001-0001-0001-0001-000000000001': 'General Service',
      'd0000001-0001-0001-0001-000000000002': 'AC Service',
      'd0000001-0001-0001-0001-000000000006': 'Car Wash',
      'e0000001-0001-0001-0001-000000000002': 'Filter Replacement',
      'e0000001-0001-0001-0001-000000000007': 'Brake Pad Replacement',
    };
    return serviceTypeMap[serviceTypeId] || 'Service';
  }

  function calculateExpectedCompletion(assignedAt: string | null, priority: string): string | null {
    if (!assignedAt) return null;
    const assigned = new Date(assignedAt);
    const hoursToAdd = priority === 'URGENT' ? 2 : priority === 'HIGH' ? 4 : priority === 'LOW' ? 24 : 8;
    return new Date(assigned.getTime() + hoursToAdd * 60 * 60 * 1000).toISOString();
  }

  function calculateSLARemaining(expectedCompletionTime: string | null): number | null {
    if (!expectedCompletionTime) return null;
    const now = new Date();
    const expected = new Date(expectedCompletionTime);
    return Math.floor((expected.getTime() - now.getTime()) / (1000 * 60));
  }

  const canStartJob = job.mechanic_status === 'ASSIGNED';
  const canCompleteJob = job.mechanic_status === 'IN_PROGRESS' && 
                         job.checklist_completed && 
                         job.before_images_count >= job.min_before_images &&
                         job.after_images_count >= job.min_after_images;

  return (
    <DashboardLayout role="workshop_mechanic">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="btn btn-outline">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold">{job.lead_number}</h1>
              <p className="text-gray-600">Job Details</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-4 py-2 rounded-lg font-semibold ${getStatusColor(job.mechanic_status)}`}>
              {job.mechanic_status.replace('_', ' ')}
            </span>
            {job.job_priority !== 'NORMAL' && (
              <span className="px-4 py-2 rounded-lg font-semibold bg-red-100 text-red-800 border border-red-300">
                {job.job_priority}
              </span>
            )}
          </div>
        </div>

        {/* SLA Timer */}
        <div className="card bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">SLA Remaining</p>
                <p className="text-2xl font-bold">
                  {job.sla_remaining_minutes !== null && job.sla_remaining_minutes !== undefined ? (
                    job.sla_remaining_minutes < 0 ? (
                      <span className="text-red-600">Overdue by {Math.abs(job.sla_remaining_minutes)}m</span>
                    ) : job.sla_remaining_minutes < 60 ? (
                      <span className="text-orange-600">{job.sla_remaining_minutes} minutes</span>
                    ) : (
                      <span className="text-green-600">
                        {Math.floor(job.sla_remaining_minutes / 60)}h {job.sla_remaining_minutes % 60}m
                      </span>
                    )
                  ) : (
                    <span className="text-gray-500">No SLA set</span>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Expected Completion</p>
              <p className="font-semibold">
                {job.expected_completion_time ? (
                  new Date(job.expected_completion_time).toLocaleString()
                ) : (
                  <span className="text-gray-500">Not set</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {canStartJob && (
            <button 
              onClick={() => updateJobStatus('IN_PROGRESS')}
              className="btn bg-blue-500 hover:bg-blue-600 text-white"
            >
              <PlayCircle className="w-5 h-5" />
              Start Job
            </button>
          )}
          
          {job.mechanic_status === 'IN_PROGRESS' && (
            <>
              <button 
                onClick={() => updateJobStatus('HOLD')}
                className="btn btn-outline"
              >
                <PauseCircle className="w-5 h-5" />
                Put on Hold
              </button>

              {canCompleteJob && (
                <button 
                  onClick={() => updateJobStatus('COMPLETED')}
                  className="btn bg-green-500 hover:bg-green-600 text-white"
                >
                  <CheckCircle className="w-5 h-5" />
                  Mark Completed
                </button>
              )}
            </>
          )}

          <button 
            onClick={() => setShowExtraWorkForm(true)}
            className="btn bg-orange-500 hover:bg-orange-600 text-white"
          >
            <AlertTriangle className="w-5 h-5" />
            Request Extra Work
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-4">
            {['overview', 'checklist', 'media', 'parts', 'notes'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium capitalize border-b-2 transition ${
                  activeTab === tab
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Job Summary */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Job Summary</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Assigned At</p>
                  <p className="font-semibold">{new Date(job.assigned_at).toLocaleString()}</p>
                </div>
                {job.started_at && (
                  <div>
                    <p className="text-sm text-gray-600">Started At</p>
                    <p className="font-semibold">{new Date(job.started_at).toLocaleString()}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Service Types</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {job.service_types && job.service_types.length > 0 ? (
                      job.service_types.map((type, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                          {getServiceTypeName(type)}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500">No service type specified</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Customer & Vehicle */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Customer & Vehicle</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-semibold">{job.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Vehicle</p>
                  <p className="font-semibold">{job.vehicle_number}</p>
                  <p className="text-sm">{job.vehicle_make} {job.vehicle_model} {job.vehicle_variant}</p>
                  <p className="text-sm text-gray-600">Year: {job.vehicle_year} | Fuel: {job.fuel_type}</p>
                </div>
                {job.odometer_reading > 0 && (
                  <div>
                    <p className="text-sm text-gray-600">Odometer Reading</p>
                    <p className="font-semibold">{job.odometer_reading} km</p>
                  </div>
                )}
                {job.problem_description && (
                  <div>
                    <p className="text-sm text-gray-600">Customer Complaint</p>
                    <p className="text-sm bg-yellow-50 p-3 rounded border border-yellow-200">{job.problem_description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Status */}
            <div className="card col-span-full">
              <h2 className="text-xl font-bold mb-4">Progress Status</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Camera className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                  <p className="text-sm text-gray-600">Before Images</p>
                  <p className="text-2xl font-bold">
                    {job.before_images_count} / {job.min_before_images}
                  </p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <Camera className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
                  <p className="text-sm text-gray-600">Progress Images</p>
                  <p className="text-2xl font-bold">
                    {job.progress_images_count} / {job.min_progress_images}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <Camera className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <p className="text-sm text-gray-600">After Images</p>
                  <p className="text-2xl font-bold">
                    {job.after_images_count} / {job.min_after_images}
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                  <p className="text-sm text-gray-600">Checklist</p>
                  <p className="text-2xl font-bold">
                    {job.checklist_completed ? '✓' : '✗'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'checklist' && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Service Checklist</h2>
            <div className="space-y-3">
              {checklist.map((item) => (
                <div key={item.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.status === 'COMPLETED'}
                          onChange={(e) => updateChecklistItem(item.id, e.target.checked ? 'COMPLETED' : 'PENDING')}
                          className="w-5 h-5"
                        />
                        <span className={`font-medium ${item.status === 'COMPLETED' ? 'text-green-600 line-through' : ''}`}>
                          {item.name}
                        </span>
                        {item.mandatory && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">Required</span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-sm text-gray-600 mt-2 ml-7">{item.notes}</p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded text-sm ${
                      item.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      item.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'media' && (
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Upload Media</h2>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="input w-full"
                  >
                    <option value="BEFORE">Before Work</option>
                    <option value="PROGRESS">Work in Progress</option>
                    <option value="AFTER">After Work</option>
                    <option value="EXTRA_WORK_PROOF">Extra Work Proof</option>
                    <option value="DAMAGE_FOUND">Damage Found</option>
                    <option value="PARTS_USED">Parts Used</option>
                  </select>
                </div>
                <div>
                  <label className="btn btn-primary cursor-pointer">
                    <Upload className="w-5 h-5" />
                    {uploadingMedia ? 'Uploading...' : 'Upload Photos'}
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleMediaUpload}
                      disabled={uploadingMedia}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Media Grid */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Uploaded Media</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {media.map((item) => (
                  <div key={item.id} className="border rounded-lg overflow-hidden">
                    <img src={item.media_url} alt="Job media" className="w-full h-48 object-cover" />
                    <div className="p-2">
                      <p className="text-xs font-semibold">{item.media_category.replace('_', ' ')}</p>
                      <p className="text-xs text-gray-500">{new Date(item.uploaded_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
              {media.length === 0 && (
                <p className="text-center text-gray-500 py-8">No media uploaded yet</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'parts' && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Parts Management</h2>
            <div className="space-y-3">
              {parts.map((part) => (
                <div key={part.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-semibold text-lg">{part.part_name}</p>
                      <p className="text-sm text-gray-600">Issued: {part.quantity_issued}</p>
                    </div>
                    <span className={`px-3 py-1 rounded text-sm ${
                      part.usage_status === 'USED' ? 'bg-green-100 text-green-800' :
                      part.usage_status === 'NOT_NEEDED' ? 'bg-gray-100 text-gray-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {part.usage_status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Quantity Used</label>
                      <input
                        type="number"
                        value={part.quantity_used}
                        onChange={(e) => updatePartUsage(part.id, 'quantity_used', parseInt(e.target.value))}
                        className="input w-full"
                        min="0"
                        max={part.quantity_issued}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Status</label>
                      <select
                        value={part.usage_status}
                        onChange={(e) => updatePartUsage(part.id, 'usage_status', e.target.value)}
                        className="input w-full"
                      >
                        <option value="ISSUED">Issued</option>
                        <option value="USED">Used</option>
                        <option value="NOT_NEEDED">Not Needed</option>
                        <option value="ADDITIONAL_REQUIRED">Additional Required</option>
                      </select>
                    </div>
                  </div>
                  {part.part_notes && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-gray-600">{part.part_notes}</p>
                    </div>
                  )}
                </div>
              ))}
              {parts.length === 0 && (
                <p className="text-center text-gray-500 py-8">No parts assigned for this job</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Work Notes</h2>
            <textarea
              value={workNotes}
              onChange={(e) => setWorkNotes(e.target.value)}
              rows={10}
              className="input w-full"
              placeholder="Add your work notes, observations, complications, hidden damage found, etc..."
            />
            <button 
              onClick={saveWorkNotes}
              className="btn btn-primary mt-4"
            >
              <Save className="w-5 h-5" />
              Save Notes
            </button>
          </div>
        )}

        {/* Extra Work Request Modal */}
        {showExtraWorkForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Request Additional Work</h2>
                <button onClick={() => setShowExtraWorkForm(false)} className="btn btn-outline">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Issue Found</label>
                  <textarea
                    value={extraWorkForm.issue_description}
                    onChange={(e) => setExtraWorkForm({ ...extraWorkForm, issue_description: e.target.value })}
                    rows={4}
                    className="input w-full"
                    placeholder="Describe the issue you found..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Additional Work Required</label>
                  <textarea
                    value={extraWorkForm.additional_work_required}
                    onChange={(e) => setExtraWorkForm({ ...extraWorkForm, additional_work_required: e.target.value })}
                    rows={4}
                    className="input w-full"
                    placeholder="What additional work is needed?"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Estimated Cost (Optional)</label>
                  <input
                    type="number"
                    value={extraWorkForm.estimated_cost}
                    onChange={(e) => setExtraWorkForm({ ...extraWorkForm, estimated_cost: e.target.value })}
                    className="input w-full"
                    placeholder="Enter estimated cost"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Please upload proof images in the Media tab before submitting this request.
                    Your job status will change to "Waiting for Approval" until the admin reviews this request.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={submitExtraWorkRequest}
                    disabled={!extraWorkForm.issue_description || !extraWorkForm.additional_work_required}
                    className="btn btn-primary flex-1"
                  >
                    <Send className="w-5 h-5" />
                    Submit Request
                  </button>
                  <button onClick={() => setShowExtraWorkForm(false)} className="btn btn-outline">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Extra Work Requests List */}
        {extraWorkRequests.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Extra Work Requests</h2>
            <div className="space-y-3">
              {extraWorkRequests.map((request) => (
                <div key={request.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-semibold">{request.issue_description}</p>
                      <p className="text-sm text-gray-600 mt-1">{request.additional_work_required}</p>
                      {request.estimated_cost && (
                        <p className="text-sm font-medium text-green-600 mt-2">
                          Estimated: ₹{request.estimated_cost}
                        </p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded text-sm ml-4 ${
                      request.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      request.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {request.status}
                    </span>
                  </div>
                  {request.review_notes && (
                    <div className="pt-3 border-t">
                      <p className="text-sm text-gray-600">
                        <strong>Review Notes:</strong> {request.review_notes}
                      </p>
                    </div>
                  )}
                  <div className="pt-2 border-t mt-2 text-xs text-gray-500">
                    Requested: {new Date(request.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

