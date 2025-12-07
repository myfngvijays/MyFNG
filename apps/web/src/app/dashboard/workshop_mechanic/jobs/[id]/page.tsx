'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  ArrowLeft, PlayCircle, PauseCircle, CheckCircle, Camera, 
  Package, AlertTriangle, MessageSquare, FileText, Clock,
  Upload, X, Save, Send, Minus
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import DuringServiceUpload from '@/components/mechanic/DuringServiceUpload';
import PartsUsedUpload from '@/components/mechanic/PartsUsedUpload';

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
  remark?: string;
  category?: string;
  mandatory: boolean;
  completed_at: string;
}

interface MediaItem {
  id: string;
  file_url: string;
  media_url?: string;
  media_type?: string;
  media_category: string;
  caption?: string;
  description?: string;
  uploaded_at?: string;
  created_at: string;
}

interface PartsItem {
  id: string;
  part_name: string;
  part_code: string | null;
  quantity: number;
  notes: string | null;
  unit: string | null;
  unit_price: number | null;
  total_price: number | null;
  supplier: string | null;
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
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeChecklistItem, setActiveChecklistItem] = useState<string | null>(null);
  
  // Form states
  const [workNotes, setWorkNotes] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('PROGRESS');
  const [selectedPhotoType, setSelectedPhotoType] = useState<string>('');
  const [showExtraWorkForm, setShowExtraWorkForm] = useState(false);
  const [extraWorkForm, setExtraWorkForm] = useState({
    issue_description: '',
    additional_work_required: '',
    estimated_cost: ''
  });
  const [zoomedMedia, setZoomedMedia] = useState<MediaItem | null>(null);
  const [beforePhotoTypes, setBeforePhotoTypes] = useState<string[]>([]);
  const [missingBeforePhotos, setMissingBeforePhotos] = useState<string[]>([]);
  const [serviceTypeNames, setServiceTypeNames] = useState<string[]>([]);
  const [serviceAddonNames, setServiceAddonNames] = useState<string[]>([]);

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
            event: 'UPDATE',
            schema: 'public',
            table: 'service_leads',
            filter: `id=eq.${leadId}`
          },
          (payload) => {
            console.log('Lead status updated in real-time:', payload);
            // If status changed to IN_PROGRESS (sent back), refresh immediately
            if (payload.new && payload.new.status === 'IN_PROGRESS') {
              fetchJobDetails();
            }
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
        // Parse service_type_ids if it's a string (JSONB from Supabase)
        let serviceTypeIds = jobData.service_leads?.service_type_ids || jobData.service_leads?.subservice_ids || [];
        if (typeof serviceTypeIds === 'string') {
          try {
            serviceTypeIds = JSON.parse(serviceTypeIds);
          } catch (e) {
            console.error('Failed to parse service_type_ids:', e);
            serviceTypeIds = [];
          }
        }
        
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
          service_types: serviceTypeIds,
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
        
        // Fetch service type names from database
        if (jobDetail.service_types && jobDetail.service_types.length > 0) {
          await fetchServiceTypeNames(jobDetail.service_types);
        }

        // Fetch service addons (subservices) from database
        const subserviceIds = jobData.service_leads?.subservice_ids || [];
        let parsedSubserviceIds = subserviceIds;
        if (typeof subserviceIds === 'string') {
          try {
            parsedSubserviceIds = JSON.parse(subserviceIds);
          } catch (e) {
            console.error('Failed to parse subservice_ids:', e);
            parsedSubserviceIds = [];
          }
        }
        
        if (parsedSubserviceIds && Array.isArray(parsedSubserviceIds) && parsedSubserviceIds.length > 0) {
          await fetchServiceAddonNames(parsedSubserviceIds);
        }
      }

      // Get checklist - fetch by lead_id and mechanic_id
      if (jobData && jobData.mechanic_id) {
        const { data: checklistData, error: checklistError } = await supabase
          .from('service_checklists')
          .select('*')
          .eq('lead_id', leadId)
          .eq('mechanic_id', jobData.mechanic_id)
          .maybeSingle();

        if (checklistError) {
          console.error('Checklist error:', checklistError);
        }

        if (checklistData && checklistData.checklist_items) {
          // Parse checklist_items if it's a string (JSONB)
          let items = checklistData.checklist_items;
          if (typeof items === 'string') {
            try {
              items = JSON.parse(items);
            } catch (e) {
              console.error('Failed to parse checklist_items:', e);
              items = [];
            }
          }
          
          setChecklist(items);
          
          // Auto-set active category to first incomplete category
          const categories = Array.from(new Set(items.map((item: ChecklistItem) => item.category).filter(Boolean))) as string[];
          const firstIncompleteCategory = categories.find((cat: string) => {
            const categoryItems = items.filter((item: ChecklistItem) => item.category === cat);
            return categoryItems.some((item: ChecklistItem) => item.status !== 'COMPLETED');
          });
          if (firstIncompleteCategory && !activeCategory) {
            setActiveCategory(firstIncompleteCategory);
          }
        } else {
          console.log('No checklist found for lead_id:', leadId, 'mechanic_id:', jobData.mechanic_id);
          
          // Auto-generate checklist if it doesn't exist
          // Try to get service type from multiple sources
          let serviceTypeIds = jobData.service_leads?.service_type_ids;
          const legacyServiceType = jobData.service_leads?.service_type;
          
          // Parse service_type_ids if it's a string (JSONB from Supabase)
          if (typeof serviceTypeIds === 'string') {
            try {
              serviceTypeIds = JSON.parse(serviceTypeIds);
            } catch (e) {
              console.error('Failed to parse service_type_ids:', e);
              serviceTypeIds = null;
            }
          }
          
          if (serviceTypeIds || legacyServiceType) {
            try {
              // Get service type name
              let serviceTypeName = '';
              
              if (serviceTypeIds && Array.isArray(serviceTypeIds) && serviceTypeIds.length > 0) {
                // Fetch service type name from database
                const { data: serviceType, error: serviceTypeError } = await supabase
                  .from('service_types')
                  .select('name')
                  .eq('id', serviceTypeIds[0])
                  .single();
                
                if (serviceTypeError) {
                  console.error('Error fetching service type:', serviceTypeError);
                }
                
                if (serviceType?.name) {
                  serviceTypeName = serviceType.name;
                }
              }
              
              // Fallback to legacy service_type column
              if (!serviceTypeName && legacyServiceType) {
                serviceTypeName = legacyServiceType;
              }
              
              if (serviceTypeName) {
                console.log('Auto-generating checklist for service type:', serviceTypeName);
                
                // Call API endpoint to generate checklist
                try {
                  const response = await fetch(`/api/mechanic/jobs/${leadId}/generate-checklist`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  });
                  
                  const result = await response.json();
                  
                  if (response.ok && result.checklist) {
                    console.log('Checklist generated successfully');
                    
                    // Parse checklist items
                    let items = result.checklist.checklist_items;
                    if (typeof items === 'string') {
                      try {
                        items = JSON.parse(items);
                      } catch (e) {
                        console.error('Failed to parse checklist_items:', e);
                        items = [];
                      }
                    }
                    
                    if (items && items.length > 0) {
                      setChecklist(items);
                      
                      // Auto-set active category
                      const categories = Array.from(new Set(items.map((item: ChecklistItem) => item.category).filter(Boolean))) as string[];
                      const firstIncompleteCategory = categories.find((cat: string) => {
                        const categoryItems = items.filter((item: ChecklistItem) => item.category === cat);
                        return categoryItems.some((item: ChecklistItem) => item.status !== 'COMPLETED');
                      });
                      if (firstIncompleteCategory && !activeCategory) {
                        setActiveCategory(firstIncompleteCategory);
                      }
                      return; // Exit early since we got the checklist
                    } else {
                      // If checklist was created but has no items, wait a bit and refetch
                      setTimeout(() => {
                        fetchJobDetails();
                      }, 1000);
                    }
                  } else {
                    console.error('Error generating checklist:', result.error, result.details);
                    // Don't retry automatically - let user click the button manually
                  }
                } catch (error) {
                  console.error('Error calling generate-checklist API:', error);
                }
              } else {
                console.log('Service type name not found, cannot auto-generate checklist', {
                  service_type_ids: serviceTypeIds,
                  service_type: legacyServiceType
                });
              }
            } catch (error) {
              console.error('Error in auto-generate checklist:', error);
            }
          } else {
            console.log('No service type information found for this lead');
          }
          
          setChecklist([]);
        }
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

      // Fetch image counts from mechanic_job_photos table
      if (jobData && jobData.id) {
        // Get before photos
        const { data: beforePhotos } = await supabase
          .from('mechanic_job_photos')
          .select('photo_type')
          .eq('job_id', jobData.id)
          .eq('photo_category', 'before');

        const uploadedTypes = (beforePhotos || []).map((p: any) => p.photo_type);
        setBeforePhotoTypes(uploadedTypes);

        // Check for missing required types
        const requiredTypes = ['BEFORE_FRONT', 'BEFORE_REAR', 'BEFORE_LEFT', 'BEFORE_RIGHT', 'BEFORE_DASHBOARD', 'BEFORE_ENGINE_BAY'];
        const missing = requiredTypes.filter(type => !uploadedTypes.includes(type));
        setMissingBeforePhotos(missing);

        // Get progress photos count
        const { count: progressCount } = await supabase
          .from('mechanic_job_photos')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', jobData.id)
          .eq('photo_category', 'during');

        // Get after photos count
        const { count: afterCount } = await supabase
          .from('mechanic_job_photos')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', jobData.id)
          .eq('photo_category', 'after');

        // Update job state with actual counts
        setJob((prevJob) => {
          if (!prevJob) return prevJob;
          return {
            ...prevJob,
            before_images_count: beforePhotos?.length || 0,
            progress_images_count: progressCount || 0,
            after_images_count: afterCount || 0,
          };
        });
      }

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
    
    if (!job || !leadId) {
      console.error('No job or leadId available');
      return;
    }

    try {
      // Call API to update status (it will handle all validations and updates)
      const response = await fetch(`/api/mechanic/jobs/${leadId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          notes: `Status changed to ${newStatus}`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error updating status:', errorData);
        
        let errorMessage = errorData.error || 'Failed to update status';
        
        // Show detailed error if available
        if (errorData.details) {
          if (errorData.details.missing_photos && errorData.details.missing_photos.length > 0) {
            const missingPhotoNames = errorData.details.missing_photos.map((type: string) => 
              type.replace('BEFORE_', '').replace('AFTER_', '').replace('_', ' ')
            ).join(', ');
            errorMessage += `\n\nMissing required photos: ${missingPhotoNames}`;
            errorMessage += `\n\nPlease go to "Manage" tab and upload these specific photos with correct types.`;
          }
          if (errorData.details.photo_count !== undefined) {
            errorMessage += `\n\nCurrent: ${errorData.details.photo_count} photos uploaded`;
            errorMessage += `\nRequired: ${errorData.details.min_required} photos`;
          }
        }
        
        alert(errorMessage);
        
        // Navigate to manage page if photos are missing
        if (errorData.details?.missing_photos && errorData.details.missing_photos.length > 0) {
          router.push(`/dashboard/workshop_mechanic/jobs/${leadId}/manage`);
        }
        return;
      }

      const result = await response.json();
      console.log('Status updated successfully:', result);
      
      // Refresh job details to show updates
      await fetchJobDetails();
      alert(`Job status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating job status:', error);
      alert('Failed to update job status. Please try again.');
    }
  }

  async function updateChecklistItem(itemId: string, status: string, notes: string = '', remark: string = '') {
    try {
      // Call API to update checklist item (it will handle completion calculation)
      const response = await fetch(`/api/mechanic/jobs/${leadId}/checklist`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          item_id: itemId,
          status,
          notes,
          remark
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error updating checklist:', errorData);
        alert(`Failed to update checklist: ${errorData.error}`);
        return;
      }

      const result = await response.json();
      console.log('Checklist updated successfully:', result);
      
      // Update local state
    const updatedChecklist = checklist.map(item =>
      item.id === itemId
        ? { ...item, status, notes, remark: remark !== undefined ? remark : item.remark, completed_at: status === 'COMPLETED' ? new Date().toISOString() : item.completed_at }
        : item
    );
      setChecklist(updatedChecklist);
      
      // Refresh job details to show updated completion status
      await fetchJobDetails();
    } catch (error) {
      console.error('Error updating checklist item:', error);
      alert('Failed to update checklist item. Please try again.');
    }
  }

  async function handleMediaUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingMedia(true);
    const supabase = createClient();

    try {
      for (const file of Array.from(files)) {
        // Validate file
        if (file.size > 10 * 1024 * 1024) {
          alert(`File ${file.name} is too large. Maximum size is 10MB.`);
          continue;
        }

        // Upload to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${leadId}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `mechanic_media/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('service-media')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          alert(`Failed to upload ${file.name}`);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('service-media')
          .getPublicUrl(filePath);

        // Call API to save media record (this will update counts automatically)
        const response = await fetch(`/api/mechanic/jobs/${leadId}/media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            media_url: publicUrl,
            media_category: selectedCategory,
            media_type: file.type.startsWith('image') ? 'IMAGE' : 'VIDEO',
            file_size_kb: Math.round(file.size / 1024),
            description: ''
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error saving media:', errorData);
          alert(`Failed to save ${file.name}: ${errorData.error}`);
        }
      }

      // Refresh data to show new media
      await fetchJobDetails();
      alert('Media uploaded successfully!');
    } catch (error) {
      console.error('Error uploading media:', error);
      alert('Error uploading media. Please try again.');
    } finally {
      setUploadingMedia(false);
    }
  }

  async function saveWorkNotes() {
    try {
      // Call API to save work notes
      const response = await fetch(`/api/mechanic/jobs/${leadId}/notes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          work_notes: workNotes
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error saving notes:', errorData);
        alert(`Failed to save notes: ${errorData.error}`);
        return;
      }

      const result = await response.json();
      console.log('Notes saved successfully:', result);
      alert('Work notes saved successfully!');
    } catch (error) {
      console.error('Error saving work notes:', error);
      alert('Failed to save work notes. Please try again.');
    }
  }

  async function submitExtraWorkRequest() {
    if (!extraWorkForm.issue_description || !extraWorkForm.additional_work_required) {
      alert('Please fill in all required fields');
      return;
    }

    try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('User not authenticated');
        return;
      }

      // Get mechanic profile
      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userProfile) {
        alert('User profile not found');
        return;
      }

      // Insert into lead_extra_charges table
    const { error } = await supabase
        .from('lead_extra_charges')
      .insert({
        lead_id: leadId,
          requested_by: userProfile.id,
          description: extraWorkForm.additional_work_required,
          reason: extraWorkForm.issue_description,
          amount: extraWorkForm.estimated_cost ? parseFloat(extraWorkForm.estimated_cost) : 0,
          category: 'ADDITIONAL_SERVICE',
          is_urgent: false,
        status: 'PENDING'
      });

      if (error) {
        console.error('Error submitting extra work request:', error);
        alert(`Failed to submit request: ${error.message}`);
        return;
      }

      alert('Extra work request submitted successfully!');
      setShowExtraWorkForm(false);
      setExtraWorkForm({ issue_description: '', additional_work_required: '', estimated_cost: '' });
      fetchJobDetails();
      
      // Update job status to HOLD (waiting for approval)
      await updateJobStatus('HOLD');
    } catch (error) {
      console.error('Error submitting extra work request:', error);
      alert('Failed to submit extra work request. Please try again.');
    }
  }

  async function updatePartUsage(partId: string, field: string, value: any) {
    try {
      // Call API to update part usage
      const response = await fetch(`/api/mechanic/jobs/${leadId}/parts`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          part_id: partId,
          [field]: value
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error updating part:', errorData);
        alert(`Failed to update part: ${errorData.error}`);
        return;
      }

      const result = await response.json();
      console.log('Part updated successfully:', result);
      
      // Refresh job details to show updated parts
      await fetchJobDetails();
    } catch (error) {
      console.error('Error updating part usage:', error);
      alert('Failed to update part usage. Please try again.');
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

  // Fetch service type names from database
  async function fetchServiceAddonNames(addonIds: string[]) {
    if (!addonIds || addonIds.length === 0) {
      setServiceAddonNames([]);
      return;
    }

    try {
      const supabase = createClient();
      const { data: addonsData, error } = await supabase
        .from('service_addons')
        .select('id, name')
        .in('id', addonIds)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching service addons:', error);
        setServiceAddonNames([]);
        return;
      }

      const names = (addonsData || []).map((addon: any) => addon.name);
      setServiceAddonNames(names);
    } catch (error) {
      console.error('Error fetching service addon names:', error);
      setServiceAddonNames([]);
    }
  }

  async function fetchServiceTypeNames(serviceTypeIds: string[]) {
    if (!serviceTypeIds || serviceTypeIds.length === 0) {
      setServiceTypeNames([]);
      return;
    }

    try {
      const supabase = createClient();
      const { data: serviceTypesData, error } = await supabase
        .from('service_types')
        .select('id, name')
        .in('id', serviceTypeIds);

      if (error) {
        console.error('Error fetching service types:', error);
        setServiceTypeNames([]);
      } else if (serviceTypesData) {
        setServiceTypeNames(serviceTypesData.map(st => st.name));
      }
    } catch (e) {
      console.error('Error fetching service types:', e);
      setServiceTypeNames([]);
    }
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
              onClick={async () => {
                // Always call updateJobStatus - it will validate and show proper error
                await updateJobStatus('IN_PROGRESS');
              }}
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
                  onClick={() => {
                    if (!job.checklist_completed) {
                      alert('Please complete all checklist items before marking job as complete.');
                      setActiveTab('checklist');
                    } else if (job.after_images_count < job.min_after_images) {
                      alert(`Please upload all required after service photos (${job.min_after_images} required, ${job.after_images_count} uploaded). Go to Manage tab to upload photos.`);
                      router.push(`/dashboard/workshop_mechanic/jobs/${leadId}/manage`);
                    } else {
                      updateJobStatus('COMPLETED');
                    }
                  }}
                  className={`btn text-white ${
                    job.checklist_completed && job.after_images_count >= job.min_after_images
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-gray-400 hover:bg-gray-500 cursor-not-allowed'
                  }`}
                  disabled={!job.checklist_completed || job.after_images_count < job.min_after_images}
                >
                  <CheckCircle className="w-5 h-5" />
                  {!job.checklist_completed 
                    ? 'Complete Checklist First'
                    : job.after_images_count < job.min_after_images
                    ? `Complete (${job.after_images_count}/${job.min_after_images} photos)`
                    : 'Mark Completed'}
                </button>
              )}
            </>
          )}

          {job.mechanic_status === 'HOLD' && (
            <button 
              onClick={() => updateJobStatus('IN_PROGRESS')}
              className="btn bg-blue-500 hover:bg-blue-600 text-white"
            >
              <PlayCircle className="w-5 h-5" />
              Resume Job
            </button>
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
                    {serviceTypeNames.length > 0 ? (
                      serviceTypeNames.map((name, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                          {name}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 text-sm">No service types</span>
                    )}
                  </div>
                </div>
                {serviceAddonNames.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Service Addons</p>
                    <div className="flex flex-wrap gap-2">
                      {serviceAddonNames.map((name, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-medium border border-green-200">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
                  <Camera className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
                  <p className="text-sm text-gray-600">Progress Images</p>
                  <p className="text-2xl font-bold text-yellow-700">
                    {job.progress_images_count} / {job.min_progress_images}
                  </p>
                </div>
                <div className={`text-center p-4 rounded-lg border-2 ${
                  job.after_images_count >= job.min_after_images 
                    ? 'bg-green-50 border-green-300' 
                    : 'bg-green-50 border-green-300'
                }`}>
                  <Camera className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <p className="text-sm text-gray-600">After Images</p>
                  <p className={`text-2xl font-bold ${
                    job.after_images_count >= job.min_after_images ? 'text-green-700' : 'text-green-700'
                  }`}>
                    {job.after_images_count} / {job.min_after_images}
                  </p>
                  {job.after_images_count < job.min_after_images && (
                    <p className="text-xs text-red-600 mt-1 font-semibold">
                      {job.min_after_images - job.after_images_count} more needed
                    </p>
                  )}
                </div>
                <div className={`text-center p-4 rounded-lg border-2 ${
                  job.checklist_completed 
                    ? 'bg-green-50 border-green-300' 
                    : 'bg-purple-50 border-purple-300'
                }`}>
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                  <p className="text-sm text-gray-600">Checklist</p>
                  <p className={`text-2xl font-bold ${
                    job.checklist_completed ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {job.checklist_completed ? '✓' : '✗'}
                  </p>
                </div>
              </div>

              {/* Detailed Requirements Section */}
              {canStartJob && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 border-2 border-blue-300">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-orange-600" />
                    Before Starting Job - Required Actions
                  </h3>
                  <div className="space-y-3">
                    <div className={`p-3 rounded-lg border-2 ${
                      job.before_images_count >= 6
                        ? 'bg-green-50 border-green-300'
                        : 'bg-orange-50 border-orange-300'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {job.before_images_count >= 6 ? (
                            <CheckCircle className="w-6 h-6 text-green-600" />
                          ) : (
                            <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">1</span>
                          )}
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800">Upload Before Inspection Photos</p>
                            <p className="text-sm text-gray-600 mt-1">
                              Required: 6 photos (Front, Rear, Left, Right, Dashboard, Engine Bay)
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Current: {job.before_images_count} / 6 uploaded
                            </p>
                            {missingBeforePhotos.length > 0 && (
                              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                <p className="text-xs font-semibold text-red-800 mb-1">⚠️ Missing Required Photo Types:</p>
                                <div className="flex flex-wrap gap-1">
                                  {missingBeforePhotos.map((type) => (
                                    <span key={type} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                                      {type.replace('BEFORE_', '').replace('_', ' ')}
                                    </span>
                                  ))}
                                </div>
                                <p className="text-xs text-red-600 mt-1">
                                  Please upload these specific photos with correct types in the "Manage" tab.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        {(job.before_images_count < 6 || missingBeforePhotos.length > 0) && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              router.push(`/dashboard/workshop_mechanic/jobs/${leadId}/manage`);
                            }}
                            className="btn btn-primary text-sm px-4 py-2 flex-shrink-0 cursor-pointer"
                          >
                            Upload Photos
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {job.mechanic_status === 'IN_PROGRESS' && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-5 border-2 border-green-300 mt-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    Before Completing Job - Required Actions
                  </h3>
                  <div className="space-y-3">
                    <div className={`p-3 rounded-lg border-2 ${
                      job.checklist_completed
                        ? 'bg-green-50 border-green-300'
                        : 'bg-orange-50 border-orange-300'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {job.checklist_completed ? (
                            <CheckCircle className="w-6 h-6 text-green-600" />
                          ) : (
                            <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">1</span>
                          )}
                          <div>
                            <p className="font-semibold text-gray-800">Complete Service Checklist</p>
                            <p className="text-sm text-gray-600 mt-1">
                              All checklist items must be marked as completed
                            </p>
                          </div>
                        </div>
                        {!job.checklist_completed && (
                          <button
                            onClick={() => setActiveTab('checklist')}
                            className="btn-primary text-sm px-4 py-2"
                          >
                            View Checklist
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={`p-3 rounded-lg border-2 ${
                      job.after_images_count >= job.min_after_images
                        ? 'bg-green-50 border-green-300'
                        : 'bg-orange-50 border-orange-300'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {job.after_images_count >= job.min_after_images ? (
                            <CheckCircle className="w-6 h-6 text-green-600" />
                          ) : (
                            <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">2</span>
                          )}
                          <div>
                            <p className="font-semibold text-gray-800">Upload After Service Photos</p>
                            <p className="text-sm text-gray-600 mt-1">
                              Required: {job.min_after_images} photos (Front, Rear, Left, Right, Engine Bay, Old Parts)
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Current: {job.after_images_count} / {job.min_after_images} uploaded
                            </p>
                          </div>
                        </div>
                        {job.after_images_count < job.min_after_images && (
                          <button
                      onClick={(e) => {
                        e.preventDefault();
                        router.push(`/dashboard/workshop_mechanic/jobs/${leadId}/manage`);
                      }}
                      className="btn btn-primary text-sm px-4 py-2 cursor-pointer"
                          >
                            Upload Photos
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'checklist' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Service Checklist</h2>
            </div>
            
            {checklist.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-4">No checklist available for this job.</p>
                <p className="text-sm">Checklist will be automatically generated when a mechanic is assigned.</p>
              </div>
            ) : (
              /* Group by category if categories exist */
              checklist.some(item => item.category) ? (
              <div className="space-y-4">
                {Array.from(new Set(checklist.map(item => item.category).filter(Boolean))).map((category) => {
                  if (!category) return null;
                  const categoryItems = checklist.filter(item => item.category === category);
                  if (categoryItems.length === 0) return null;
                  
                  const allCompleted = categoryItems.every(item => item.status === 'COMPLETED');
                  const isActive = activeCategory === category;
                  // Lock other categories if a category is active and not completed
                  // But allow completed categories to be unlocked
                  const isLocked = activeCategory !== null && activeCategory !== category && !allCompleted;
                  
                  // Allow clicking on category header to activate it (if not locked)
                  const canActivate = !isLocked && (activeCategory === null || allCompleted || activeCategory === category);
                  
                  return (
                    <div 
                      key={category} 
                      className={`border rounded-lg p-4 transition-all ${
                        isLocked ? 'opacity-50 pointer-events-none bg-gray-50' : 
                        isActive ? 'border-blue-500 bg-blue-50' : 
                        'border-gray-200 bg-white'
                      }`}
                    >
                      <div 
                        className="flex items-center justify-between mb-3 cursor-pointer"
                        onClick={() => {
                          // Allow activating category if not locked
                          if (!isLocked && (activeCategory === null || allCompleted)) {
                            setActiveCategory(category || null);
                          }
                        }}
                      >
                        <h3 className={`text-lg font-semibold ${canActivate ? 'text-gray-700 hover:text-blue-600' : 'text-gray-500'}`}>
                          {category} ({categoryItems.length})
                        </h3>
                        {allCompleted && (
                          <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                            ✓ Complete
                          </span>
                        )}
                        {isActive && !allCompleted && (
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      
                      {/* Table-like layout for compact display */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-2 w-12">✓</th>
                              <th className="text-left py-2 px-3 font-semibold text-sm text-gray-700">Point Name</th>
                              <th className="text-left py-2 px-3 font-semibold text-sm text-gray-700">Remark</th>
                              <th className="text-center py-2 px-3 font-semibold text-sm text-gray-700 w-32">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categoryItems.map((item, idx) => {
                              // Determine if this item should be blurred
                              const hasActiveItem = categoryItems.some(i => i.status === 'IN_PROGRESS' || (i.status !== 'COMPLETED' && activeChecklistItem === i.id));
                              const isThisItemActive = activeChecklistItem === item.id;
                              const shouldBlur = hasActiveItem && !isThisItemActive && item.status !== 'COMPLETED';
                              
                              return (
                              <tr 
                                key={item.id} 
                                className={`border-b border-gray-100 hover:bg-gray-50 transition ${
                                  item.status === 'COMPLETED' ? 'bg-green-50/30' : ''
                                } ${shouldBlur ? 'opacity-30 blur-[2px] pointer-events-none' : ''}`}
                              >
                                {/* Checkbox */}
                                <td className="py-3 px-2">
                                  <input
                                    type="checkbox"
                                    checked={item.status === 'COMPLETED'}
                                    onChange={(e) => {
                                      const newStatus = e.target.checked ? 'COMPLETED' : 'PENDING';
                                      
                                      // If checking a box, set this item as active
                                      if (e.target.checked) {
                                        setActiveChecklistItem(item.id);
                                        if (activeCategory !== category) {
                                          setActiveCategory(category);
                                        }
                                      }
                                      
                                      updateChecklistItem(item.id, newStatus, item.notes || '', item.remark || '');
                                      
                                      // Update local state immediately for UI responsiveness
                                      const updatedChecklist = checklist.map(i =>
                                        i.id === item.id ? { ...i, status: newStatus } : i
                                      );
                                      setChecklist(updatedChecklist);
                                      
                                      // When item completes, clear active item (unblur all)
                                      if (newStatus === 'COMPLETED') {
                                        setActiveChecklistItem(null);
                                      }
                                      
                                      // Check if all items in category are completed
                                      const updatedCategoryItems = updatedChecklist.filter(i => i.category === category);
                                      const allDone = updatedCategoryItems.every(i => i.status === 'COMPLETED');
                                      
                                      if (allDone && activeCategory === category) {
                                        // Find next incomplete category
                                        const categories = Array.from(new Set(updatedChecklist.map(i => i.category).filter(Boolean)));
                                        const nextCategory = categories.find(cat => {
                                          const items = updatedChecklist.filter(i => i.category === cat);
                                          return items.some(i => i.status !== 'COMPLETED');
                                        });
                                        setActiveCategory(nextCategory || null);
                                      }
                                    }}
                                    disabled={isLocked}
                                    className="w-5 h-5 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                </td>
                                
                                {/* Point Name */}
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`font-medium text-sm ${
                                      item.status === 'COMPLETED' ? 'text-green-700 line-through' : 'text-gray-800'
                                    }`}>
                                      {item.name}
                                    </span>
                                    {item.mandatory && (
                                      <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded font-semibold">
                                        Required
                                      </span>
                                    )}
                                  </div>
                                </td>
                                
                                {/* Remark Input */}
                                <td className="py-3 px-3">
                                  <input
                                    type="text"
                                    value={item.remark || ''}
                                    onChange={(e) => {
                                      const updatedChecklist = checklist.map(i =>
                                        i.id === item.id ? { ...i, remark: e.target.value } : i
                                      );
                                      setChecklist(updatedChecklist);
                                    }}
                                    onBlur={() => updateChecklistItem(item.id, item.status, item.notes || '', item.remark || '')}
                                    placeholder="Enter remark..."
                                    disabled={isLocked}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                  />
                                </td>
                                
                                {/* Status */}
                                <td className="py-3 px-3 text-center">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                                    item.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                    item.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {item.status === 'COMPLETED' ? 'COMPLETE' : 'PENDING'}
                                  </span>
                                </td>
                              </tr>
                            );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Fallback: No categories - show table format */
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 w-12">✓</th>
                      <th className="text-left py-2 px-3 font-semibold text-sm text-gray-700">Point Name</th>
                      <th className="text-left py-2 px-3 font-semibold text-sm text-gray-700">Remark</th>
                      <th className="text-center py-2 px-3 font-semibold text-sm text-gray-700 w-32">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checklist.map((item) => {
                      // Determine if this item should be blurred
                      const hasActiveItem = checklist.some(i => i.status === 'IN_PROGRESS' || (i.status !== 'COMPLETED' && activeChecklistItem === i.id));
                      const isThisItemActive = activeChecklistItem === item.id;
                      const shouldBlur = hasActiveItem && !isThisItemActive && item.status !== 'COMPLETED';
                      
                      return (
                      <tr 
                        key={item.id} 
                        className={`border-b border-gray-100 hover:bg-gray-50 transition ${
                          item.status === 'COMPLETED' ? 'bg-green-50/30' : ''
                        } ${shouldBlur ? 'opacity-30 blur-[2px] pointer-events-none' : ''}`}
                      >
                        <td className="py-3 px-2">
                          <input
                            type="checkbox"
                            checked={item.status === 'COMPLETED'}
                            onChange={(e) => {
                              const newStatus = e.target.checked ? 'COMPLETED' : 'PENDING';
                              
                              // Set this item as active when checked
                              if (e.target.checked) {
                                setActiveChecklistItem(item.id);
                              }
                              
                              updateChecklistItem(item.id, newStatus, item.notes || '', item.remark || '');
                              
                              // When completed, clear active item (unblur all)
                              if (newStatus === 'COMPLETED') {
                                setActiveChecklistItem(null);
                              }
                            }}
                            className="w-5 h-5 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium text-sm ${
                              item.status === 'COMPLETED' ? 'text-green-700 line-through' : 'text-gray-800'
                            }`}>
                              {item.name}
                            </span>
                            {item.mandatory && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded font-semibold">
                                Required
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={item.remark || ''}
                            onChange={(e) => {
                              const updatedChecklist = checklist.map(i =>
                                i.id === item.id ? { ...i, remark: e.target.value } : i
                              );
                              setChecklist(updatedChecklist);
                            }}
                            onBlur={() => updateChecklistItem(item.id, item.status, item.notes || '', item.remark || '')}
                            placeholder="Enter remark..."
                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                            item.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            item.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {item.status === 'COMPLETED' ? 'COMPLETE' : 'PENDING'}
                          </span>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
            )}
          </div>
        )}

        {activeTab === 'media' && (
          <div className="space-y-6">
            {/* Category Dropdown */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Upload Media</h2>
              <div className="space-y-4">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-2">Category</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value);
                        setSelectedPhotoType('');
                      }}
                      className="input w-full"
                    >
                      <option value="PROGRESS">Work in Progress</option>
                      <option value="PARTS_USED">Parts Used</option>
                    </select>
                  </div>
                </div>

                {/* PROGRESS Category - During Service Upload */}
                {selectedCategory === 'PROGRESS' && job && job.id && (
                  <div className="card border-2 border-orange-300">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <Camera className="w-6 h-6 text-orange-600" />
                      Work in Progress Photos
                    </h2>
                    <DuringServiceUpload
                      leadId={leadId}
                      jobId={job.id}
                      onUploadComplete={() => {
                        fetchJobDetails();
                      }}
                    />
                  </div>
                )}

                {/* EXTRA_WORK_PROOF Category */}
                {selectedCategory === 'EXTRA_WORK_PROOF' && (
                  <div className="card border-2 border-purple-300">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <Camera className="w-6 h-6 text-purple-600" />
                      Extra Work Proof
                    </h2>
                    <p className="text-sm text-gray-600 mb-4">
                      Upload photos as proof of extra work performed (e.g., additional repairs, part replacements).
                    </p>
                    <div>
                      <label className="btn btn-primary cursor-pointer">
                        <Upload className="w-5 h-5" />
                        {uploadingMedia ? 'Uploading...' : 'Upload Proof Photos'}
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          onChange={handleMediaUpload}
                          disabled={uploadingMedia}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* DAMAGE_FOUND Category */}
                {selectedCategory === 'DAMAGE_FOUND' && (
                  <div className="card border-2 border-red-300">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <Camera className="w-6 h-6 text-red-600" />
                      Damage Found
                    </h2>
                    <p className="text-sm text-gray-600 mb-4">
                      Upload photos of any damages or issues found during inspection or service.
                    </p>
                    <div>
                      <label className="btn btn-primary cursor-pointer">
                        <Upload className="w-5 h-5" />
                        {uploadingMedia ? 'Uploading...' : 'Upload Damage Photos'}
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          onChange={handleMediaUpload}
                          disabled={uploadingMedia}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* PARTS_USED Category */}
                {selectedCategory === 'PARTS_USED' && job && job.id && (
                  <div className="card border-2 border-indigo-300">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <Camera className="w-6 h-6 text-indigo-600" />
                      Parts Used Photos
                    </h2>
                    <PartsUsedUpload
                      leadId={leadId}
                      jobId={job.id}
                      onUploadComplete={() => {
                        fetchJobDetails();
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Media Grid */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Other Media ({media.length})</h2>
              <p className="text-sm text-gray-600 mb-4">
                General media uploads (not used for before/after inspection validation)
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {media.map((item) => (
                  <div key={item.id} className="border rounded-lg overflow-hidden group relative">
                    {/* Image or Video */}
                    {item.media_type === 'VIDEO' || item.file_url.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                      <div className="relative w-full h-48 bg-black">
                        <video 
                          src={item.file_url} 
                          className="w-full h-48 object-contain"
                          controls
                          preload="metadata"
                        />
                        <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                          VIDEO
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="relative cursor-pointer"
                        onClick={() => setZoomedMedia(item)}
                      >
                        <img 
                          src={item.file_url} 
                          alt="Job media" 
                          className="w-full h-48 object-cover group-hover:opacity-90 transition-opacity" 
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                          <Camera className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    )}
                    
                    <div className="p-2 bg-gray-50">
                      <p className="text-xs font-semibold text-blue-600">
                        {item.media_category.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(item.uploaded_at || item.created_at).toLocaleString()}
                      </p>
                      {item.caption && (
                        <p className="text-xs text-gray-700 mt-1">{item.caption}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {media.length === 0 && (
                <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-lg">
                  <Camera className="w-16 h-16 mx-auto mb-3 text-gray-400" />
                  <p className="font-medium">No media uploaded yet</p>
                  <p className="text-sm mt-1">Upload photos or videos to document your work</p>
                </div>
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
                      {part.part_code && (
                        <p className="text-sm text-gray-600">Code: {part.part_code}</p>
                      )}
                      <p className="text-sm text-gray-600 mt-1">
                        Quantity Assigned: {part.quantity || 0} {part.unit || 'piece'}
                      </p>
                      {part.unit_price && (
                        <p className="text-sm text-gray-600">
                          Unit Price: ₹{part.unit_price.toFixed(2)}
                          {part.total_price && ` | Total: ₹${part.total_price.toFixed(2)}`}
                        </p>
                      )}
                      {part.supplier && (
                        <p className="text-sm text-gray-600">Supplier: {part.supplier}</p>
                      )}
                    </div>
                  </div>
                  {part.notes && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-gray-600">
                        <strong>Notes:</strong> {part.notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
              {parts.length === 0 && (
                <div className="text-center py-8">
                  <Package className="w-16 h-16 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500 font-medium mb-2">No parts assigned for this job</p>
                  <p className="text-sm text-gray-400 mb-4">
                    Parts are assigned by Admin/Supervisor. Contact them to request parts for this job.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-sm text-blue-800 font-semibold mb-1">💡 How to request parts:</p>
                    <ul className="text-xs text-blue-700 text-left space-y-1 list-disc list-inside">
                      <li>Contact your Supervisor or Admin</li>
                      <li>Use "Request Extra Work" button if additional parts are needed</li>
                      <li>Parts will appear here once assigned</li>
                    </ul>
                  </div>
                </div>
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

      {/* Image Zoom Modal */}
      {zoomedMedia && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setZoomedMedia(null)}
        >
          <div className="relative max-w-7xl max-h-full" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={() => setZoomedMedia(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            
            {/* Image */}
            <img 
              src={zoomedMedia.file_url} 
              alt="Zoomed media"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            
            {/* Info Bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent text-white p-4 rounded-b-lg">
              <p className="font-semibold">{zoomedMedia.media_category.replace(/_/g, ' ')}</p>
              <p className="text-sm text-gray-300">
                {new Date(zoomedMedia.uploaded_at || zoomedMedia.created_at).toLocaleString()}
              </p>
              {zoomedMedia.caption && (
                <p className="text-sm mt-2">{zoomedMedia.caption}</p>
              )}
            </div>
            
            {/* Download Button */}
            <a
              href={zoomedMedia.file_url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-0 right-12 bg-white text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

