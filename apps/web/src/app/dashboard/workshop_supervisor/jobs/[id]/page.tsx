'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import QCChecklist from '@/components/supervisor/QCChecklist';
import MechanicAssignmentModal from '@/components/supervisor/MechanicAssignmentModal';
import ReassignMechanicModal from '@/components/supervisor/ReassignMechanicModal';
import ExtraWorkModal from '@/components/supervisor/ExtraWorkModal';
import PhotoValidationModal from '@/components/supervisor/PhotoValidationModal';
import SendBackModal from '@/components/supervisor/SendBackModal';
import ServicePackageChangeModal from '@/components/supervisor/ServicePackageChangeModal';
import BeforeInspectionUpload from '@/components/mechanic/BeforeInspectionUpload';
import AfterServiceUpload from '@/components/mechanic/AfterServiceUpload';
import JobCardSection from '@/components/lead-detail/JobCardSection';
import InternalAssignment from '@/components/lead-detail/InternalAssignment';
import InvoiceSection from '@/components/lead-detail/InvoiceSection';
import MediaSection from '@/components/lead-detail/MediaSection';
import { formatDateDMY, formatDateTime } from "@/lib/utils";
import { 
  ArrowLeft, Clock, User, Car, Calendar, Wrench, 
  CheckCircle, AlertTriangle, Image as ImageIcon, Package,
  DollarSign, FileText, MessageSquare, History, Loader2, Save,
  XCircle, ArrowLeftCircle, Camera, Edit
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type MasterPartSuggestion = {
  id: string;
  name: string;
  part_number: string | null;
};

export default function SupervisorJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQC, setShowQC] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedExtraCharge, setSelectedExtraCharge] = useState<any>(null);
  const [showPhotoValidation, setShowPhotoValidation] = useState(false);
  const [showSendBack, setShowSendBack] = useState(false);
  const [showServicePackageModal, setShowServicePackageModal] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [parts, setParts] = useState<any[]>([]);
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [editingPart, setEditingPart] = useState<any>(null);
  const [partForm, setPartForm] = useState({
    part_name: '',
    part_code: '',
    quantity_issued: 1,
    part_notes: ''
  });

  // Master parts autocomplete (super admin Product Master)
  const [partSuggestions, setPartSuggestions] = useState<MasterPartSuggestion[]>([]);
  const [partSuggestionsOpen, setPartSuggestionsOpen] = useState(false);
  const [partSuggestionsLoading, setPartSuggestionsLoading] = useState(false);
  const partSuggestFetchSeq = useRef(0);
  const partSuggestHideTimer = useRef<number | null>(null);

  const partNameQuery = useMemo(() => (partForm.part_name || '').trim(), [partForm.part_name]);

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
    }

    // Real-time updates for service_leads status changes
    const supabase = createClient();
    const channel = supabase
      .channel(`job-${jobId}-realtime`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'service_leads',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          console.log('Real-time status update received:', payload);
          // Immediately update status if it changed
          if (payload.new && payload.new.status) {
            setLead((prevLead: any) => {
              if (!prevLead) return prevLead;
              const newStatus = payload.new.status;
              let displayStatus = newStatus;
              
              // Always prioritize mechanic_status over lead status
              if (prevLead.mechanic_status === 'COMPLETED') {
                // If mechanic completed, check QC status
                if (prevLead.qc_status === 'PASSED' || newStatus === 'READY_FOR_BILLING' || newStatus === 'QC_APPROVED') {
                  // QC already approved - show READY_FOR_BILLING or QC_APPROVED
                  displayStatus = newStatus === 'READY_FOR_BILLING' ? 'READY_FOR_BILLING' : (newStatus === 'QC_APPROVED' ? 'QC_APPROVED' : 'READY_FOR_BILLING');
                } else {
                  // Mechanic completed but QC not approved yet - show COMPLETED
                  displayStatus = 'COMPLETED';
                }
              } else if (prevLead.mechanic_status === 'IN_PROGRESS') {
                // If mechanic is working, show IN_PROGRESS
                displayStatus = 'IN_PROGRESS';
              } else {
                // Otherwise use the new status
                displayStatus = newStatus;
              }
              
              return {
                ...prevLead,
                status: newStatus,
                display_status: displayStatus,
                sla_status: payload.new.sla_status || prevLead.sla_status,
                priority: payload.new.priority || prevLead.priority,
                updated_at: payload.new.updated_at || prevLead.updated_at
              };
            });
          }
          // Also refetch full details to ensure consistency
          setTimeout(() => {
            fetchJobDetails();
          }, 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_jobs',
          filter: `lead_id=eq.${jobId}`
        },
        (payload) => {
          console.log('Mechanic job updated, refreshing...', payload);
          // Update display status based on mechanic_status changes
          if (payload.new && (payload.new as any).mechanic_status) {
            const mechanicStatus = (payload.new as any).mechanic_status;
            setLead((prevLead: any) => {
              if (!prevLead) return prevLead;
              let displayStatus = prevLead.status;
              
              // Priority 1: If mechanic put job on HOLD, show HOLD
              if (mechanicStatus === 'HOLD' || mechanicStatus === 'ON_HOLD') {
                displayStatus = 'HOLD';
              }
              // Priority 2: If mechanic is working, show IN_PROGRESS
              else if (mechanicStatus === 'IN_PROGRESS') {
                displayStatus = 'IN_PROGRESS';
              }
              // Priority 3: If mechanic completed, show COMPLETED
              else if (mechanicStatus === 'COMPLETED' && (prevLead.status === 'COMPLETED' || prevLead.status === 'QC_PENDING' || prevLead.status === 'WORK_COMPLETED')) {
                displayStatus = 'COMPLETED';
              } else if (mechanicStatus === 'COMPLETED') {
                // If mechanic completed, always show COMPLETED regardless of current status
                displayStatus = 'COMPLETED';
              }
              
              return {
                ...prevLead,
                display_status: displayStatus,
                mechanic_status: mechanicStatus
              };
            });
          }
          fetchJobDetails();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_checklists',
          filter: `lead_id=eq.${jobId}`
        },
        () => {
          // Refresh when checklist is updated (e.g., mechanic ticks items)
          fetchJobDetails();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_job_photos',
          filter: `lead_id=eq.${jobId}`
        },
        () => {
          // Refresh when photos are uploaded
          fetchJobDetails();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_media',
          filter: `lead_id=eq.${jobId}`
        },
        () => {
          // Refresh when media is uploaded
          fetchJobDetails();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_parts_usage',
          filter: `lead_id=eq.${jobId}`
        },
        () => {
          // Refresh when parts are added/updated
          fetchJobDetails();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_extra_charges',
          filter: `lead_id=eq.${jobId}`
        },
        () => {
          fetchJobDetails();
        }
      )
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  // Autocomplete for Part Name -> master_products (type=PART)
  useEffect(() => {
    if (!showAddPartModal) return;
    if (!partNameQuery) {
      setPartSuggestions([]);
      setPartSuggestionsOpen(false);
      setPartSuggestionsLoading(false);
      return;
    }

    // When editing an existing part, don't auto-open suggestions unless user types further
    // (still safe to search if they change text)
    setPartSuggestionsLoading(true);
    setPartSuggestionsOpen(true);

    const seq = ++partSuggestFetchSeq.current;
    const supabase = createClient();
    const handle = window.setTimeout(async () => {
      try {
        // Search only PART type (super admin product master)
        const { data, error } = await supabase
          .from('master_products')
          .select('id, name, part_number')
          .eq('type', 'PART')
          .ilike('name', `%${partNameQuery}%`)
          .order('name', { ascending: true })
          .limit(10);

        if (seq !== partSuggestFetchSeq.current) return; // stale
        if (error) {
          console.error('Error searching master parts:', error);
          setPartSuggestions([]);
          return;
        }
        setPartSuggestions((data || []) as MasterPartSuggestion[]);
      } catch (e) {
        if (seq !== partSuggestFetchSeq.current) return;
        console.error('Error searching master parts:', e);
        setPartSuggestions([]);
      } finally {
        if (seq === partSuggestFetchSeq.current) setPartSuggestionsLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [partNameQuery, showAddPartModal]);

  function selectPartSuggestion(s: MasterPartSuggestion) {
    setPartForm((prev) => ({
      ...prev,
      part_name: s.name || prev.part_name,
      part_code: s.part_number || prev.part_code || '',
    }));
    setPartSuggestionsOpen(false);
  }

  async function fetchJobDetails() {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      // Fetch complete job details
      const { data, error: fetchError } = await supabase
        .from('service_leads')
        .select(`
          *,
          mechanic:assigned_mechanic_id(id, full_name, profile_image),
          supervisor:assigned_supervisor_id(id, full_name),
          pickup_boy:assigned_pickup_boy_id(id, full_name),
          extra_charges:lead_extra_charges(*, requester:requested_by(full_name)),
          media:lead_media(*),
          events:lead_events(*, created_by_user:created_by(full_name))
        `)
        .eq('id', jobId)
        .single();

      if (fetchError) throw fetchError;
      
      // Fetch service type names if service_type_ids exists
      // Parse service_type_ids if it's a string (JSONB from Supabase)
      let serviceTypeIds = data.service_type_ids;
      if (typeof serviceTypeIds === 'string') {
        try {
          serviceTypeIds = JSON.parse(serviceTypeIds);
        } catch (e) {
          console.error('Failed to parse service_type_ids:', e);
        }
      }
      
      if (serviceTypeIds && Array.isArray(serviceTypeIds) && serviceTypeIds.length > 0) {
        const { data: serviceTypes } = await supabase
          .from('service_types')
          .select('id, name')
          .in('id', serviceTypeIds);
        
        if (serviceTypes && serviceTypes.length > 0) {
          data.service_type_names = serviceTypes.map((st: any) => st.name);
        }
      }

      // Fetch service addon names if subservice_ids exists
      let subserviceIds = data.subservice_ids;
      if (typeof subserviceIds === 'string') {
        try {
          subserviceIds = JSON.parse(subserviceIds);
        } catch (e) {
          console.error('Failed to parse subservice_ids:', e);
        }
      }
      
      if (subserviceIds && Array.isArray(subserviceIds) && subserviceIds.length > 0) {
        const { data: serviceAddons } = await supabase
          .from('service_addons')
          .select('id, name, price')
          .in('id', subserviceIds);
        
        if (serviceAddons && serviceAddons.length > 0) {
          data.service_addon_names = serviceAddons.map((sa: any) => ({
            name: sa.name,
            price: sa.price
          }));
        }
      }
      
      // Fetch mechanic_jobs to get mechanic_id, job id, and mechanic_status
      const { data: mechanicJob, error: mechanicJobError } = await supabase
        .from('mechanic_jobs')
        .select('id, mechanic_id, mechanic_status, started_at')
        .eq('lead_id', jobId)
        .maybeSingle();
      
      if (mechanicJobError) {
        console.error('Error fetching mechanic_jobs:', mechanicJobError);
        // Don't throw - continue without mechanic job data
      }
      
      // Store mechanic job id for BeforeInspectionUpload component
      if (mechanicJob) {
        (data as any).mechanic_job_id = mechanicJob.id;
        (data as any).mechanic_status = mechanicJob.mechanic_status;
        (data as any).mechanic_started_at = mechanicJob.started_at;
        
        // Override lead status based on mechanic_status - prioritize mechanic_status over lead status
        if (mechanicJob.mechanic_status === 'HOLD' || mechanicJob.mechanic_status === 'ON_HOLD') {
          // If mechanic put job on HOLD, show HOLD
          data.display_status = 'HOLD';
        } else if (mechanicJob.mechanic_status === 'IN_PROGRESS') {
          // Update the displayed status to reflect mechanic is working
          data.display_status = 'IN_PROGRESS';
        } else if (mechanicJob.mechanic_status === 'COMPLETED') {
          // If mechanic completed, check QC status
          if (data.qc_status === 'PASSED' || data.status === 'READY_FOR_BILLING' || data.status === 'QC_APPROVED') {
            // QC already approved - show READY_FOR_BILLING or QC_APPROVED
            data.display_status = data.status === 'READY_FOR_BILLING' ? 'READY_FOR_BILLING' : (data.status === 'QC_APPROVED' ? 'QC_APPROVED' : 'READY_FOR_BILLING');
          } else {
            // Mechanic completed but QC not approved yet - ALWAYS show COMPLETED
            // Override any other status (like READY_FOR_BILLING) if QC is not approved
            data.display_status = 'COMPLETED';
          }
        } else {
          // Use lead status as display status
          data.display_status = data.status;
        }
      } else {
        // No mechanic job, use lead status
        data.display_status = data.status;
      }

      setLead(data);
      setInternalNotes(data.notes_internal || '');

      // Fetch parts if mechanic is assigned
      if (mechanicJob?.mechanic_id) {
        const { data: partsData, error: partsError } = await supabase
          .from('mechanic_parts_usage')
          .select('*')
          .eq('lead_id', jobId)
          .order('created_at', { ascending: false });

        if (!partsError && partsData) {
          setParts(partsData || []);
        }
      }
    } catch (err: any) {
      console.error('Error fetching job details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveInternalNotes() {
    try {
      setSavingNotes(true);
      const supabase = createClient();

      const { error } = await supabase
        .from('service_leads')
        .update({
          notes_internal: internalNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) throw error;

      // Log supervisor action
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userProfile } = await supabase
          .from('users_login')
          .select('id')
          .eq('email', user.email)
          .single();

        await supabase
          .from('supervisor_actions')
          .insert({
            supervisor_id: userProfile?.id,
            lead_id: jobId,
            action_type: 'INTERNAL_NOTES_UPDATED',
            action_description: 'Updated internal supervisor notes',
            notes: internalNotes
          });
      }

      alert('Internal notes saved successfully');
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  }

  async function changeJobStatus(newStatus: string) {
    if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/supervisor/jobs/${jobId}/change-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_status: newStatus,
          notes: `Status changed to ${newStatus} by supervisor`
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change status');
      }

      alert(`Status changed to ${newStatus} successfully!`);
      fetchJobDetails();
    } catch (error: any) {
      console.error('Error changing status:', error);
      alert(`Failed to change status: ${error.message || 'Unknown error'}`);
    }
  }

  async function savePart() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get mechanic_id from mechanic_jobs
      const { data: mechanicJob } = await supabase
        .from('mechanic_jobs')
        .select('mechanic_id')
        .eq('lead_id', jobId)
        .single();

      if (!mechanicJob?.mechanic_id) {
        alert('Mechanic not assigned to this job');
        return;
      }

      if (editingPart) {
        // Update existing part in mechanic_parts_usage
        const { error } = await supabase
          .from('mechanic_parts_usage')
          .update({
            part_name: partForm.part_name,
            part_code: partForm.part_code || null,
            quantity: partForm.quantity_issued,
            notes: partForm.part_notes || null
          })
          .eq('id', editingPart.id);

        if (error) throw error;

        // Also update in job_card_parts if it exists
        const { data: jobCard } = await supabase
          .from('job_cards')
          .select('id')
          .eq('lead_id', jobId)
          .maybeSingle();

        if (jobCard) {
          // Find matching part in job_card_parts by part_name
          const { data: jobCardPart } = await supabase
            .from('job_card_parts')
            .select('id')
            .eq('job_card_id', jobCard.id)
            .eq('part_name', editingPart.part_name)
            .maybeSingle();

          if (jobCardPart) {
            // Get existing unit_price to recalculate total_price
            const { data: existingPart } = await supabase
              .from('job_card_parts')
              .select('unit_price')
              .eq('id', jobCardPart.id)
              .single();

            const unitPrice = existingPart?.unit_price || 0;
            const totalPrice = unitPrice * partForm.quantity_issued;

            // Update job_card_parts
            await supabase
              .from('job_card_parts')
              .update({
                part_name: partForm.part_name,
                part_number: partForm.part_code || null,
                quantity: partForm.quantity_issued,
                total_price: totalPrice
              })
              .eq('id', jobCardPart.id);
          }
        }

        alert('Part updated successfully');
      } else {
        // Add new part to mechanic_parts_usage
        const { error } = await supabase
          .from('mechanic_parts_usage')
          .insert({
            lead_id: jobId,
            mechanic_id: mechanicJob.mechanic_id,
            part_name: partForm.part_name,
            part_code: partForm.part_code || null,
            quantity: partForm.quantity_issued,
            notes: partForm.part_notes || null
          });

        if (error) throw error;

        // Also add to job_card_parts automatically (for billing)
        const { data: jobCard } = await supabase
          .from('job_cards')
          .select('id')
          .eq('lead_id', jobId)
          .maybeSingle();

        if (jobCard) {
          // Check if part already exists in job_card_parts
          const { data: existingPart } = await supabase
            .from('job_card_parts')
            .select('id')
            .eq('job_card_id', jobCard.id)
            .eq('part_name', partForm.part_name)
            .maybeSingle();

          if (!existingPart) {
            // Add to job_card_parts with default unit_price (can be updated later)
            await supabase
              .from('job_card_parts')
              .insert({
                job_card_id: jobCard.id,
                part_name: partForm.part_name,
                part_number: partForm.part_code || null,
                quantity: partForm.quantity_issued,
                unit_price: 0, // Default, can be updated later
                total_price: 0 // Will be calculated when unit_price is set
              });
          }
        }

        alert('Part assigned successfully');
      }

      setShowAddPartModal(false);
      setEditingPart(null);
      setPartForm({ part_name: '', part_code: '', quantity_issued: 1, part_notes: '' });
      fetchJobDetails();
    } catch (error: any) {
      console.error('Error saving part:', error);
      alert(`Failed to save part: ${error.message}`);
    }
  }

  async function deletePart(partId: string) {
    if (!confirm('Are you sure you want to delete this part?')) return;

    try {
      const supabase = createClient();
      
      // Get part details before deleting
      const { data: partToDelete } = await supabase
        .from('mechanic_parts_usage')
        .select('part_name')
        .eq('id', partId)
        .single();

      // Delete from mechanic_parts_usage
      const { error } = await supabase
        .from('mechanic_parts_usage')
        .delete()
        .eq('id', partId);

      if (error) throw error;

      // Also delete from job_card_parts if it exists
      if (partToDelete) {
        const { data: jobCard } = await supabase
          .from('job_cards')
          .select('id')
          .eq('lead_id', jobId)
          .maybeSingle();

        if (jobCard) {
          await supabase
            .from('job_card_parts')
            .delete()
            .eq('job_card_id', jobCard.id)
            .eq('part_name', partToDelete.part_name);
        }
      }

      alert('Part deleted successfully');
      fetchJobDetails();
    } catch (error: any) {
      console.error('Error deleting part:', error);
      alert(`Failed to delete part: ${error.message}`);
    }
  }

  const getSLAColor = (status: string) => {
    switch (status) {
      case 'ON_TIME': return 'bg-green-100 text-green-700 border-green-200';
      case 'AT_RISK': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'BREACHED': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'NEW': 'bg-blue-100 text-blue-700',
      'ASSIGNED': 'bg-purple-100 text-purple-700',
      'IN_PROGRESS': 'bg-green-100 text-green-700',
      'MECHANIC_WORKING': 'bg-green-100 text-green-700',
      'VEHICLE_DROPPED_AT_WORKSHOP': 'bg-blue-100 text-blue-700',
      'WORK_COMPLETED': 'bg-teal-100 text-teal-700',
      'QC_PENDING': 'bg-yellow-100 text-yellow-700',
      'QC_APPROVED': 'bg-green-100 text-green-700',
      'QC_FAILED': 'bg-red-100 text-red-700',
      'HOLD': 'bg-orange-100 text-orange-700',
      'ON_HOLD': 'bg-orange-100 text-orange-700', // Support both for backward compatibility
      'COMPLETED': 'bg-teal-100 text-teal-700',
      'READY_FOR_DELIVERY': 'bg-indigo-100 text-indigo-700',
      'DELIVERED': 'bg-purple-100 text-purple-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="flex items-center justify-center min-h-[300px] sm:min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 animate-spin text-brand-primary mx-auto mb-3 sm:mb-4" />
            <p className="text-gray-600 text-xs sm:text-sm md:text-base">Loading job details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !lead) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="card bg-red-50 border-red-200 p-4 sm:p-5 md:p-6">
          <p className="text-red-600 text-sm sm:text-base">Error loading job details</p>
          <button onClick={() => router.back()} className="btn btn-primary mt-3 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
            Go Back
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const pendingExtraCharges = (lead.extra_charges || []).filter((c: any) => c.status === 'PENDING');

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="space-y-4 sm:space-y-5 md:space-y-6 p-3 sm:p-4 md:p-5 lg:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <button
              onClick={() => router.back()}
              className="btn btn-outline flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading truncate">{lead.lead_number}</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Job Details & Progress</p>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-1.5 sm:gap-2">
            {lead.mechanic && (
              <button
                onClick={() => setShowSendBack(true)}
                className="btn bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
              >
                <ArrowLeftCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Send Back</span>
                <span className="sm:hidden">Back</span>
              </button>
            )}
            
            {lead.media && lead.media.length > 0 && (
              <button
                onClick={() => setShowPhotoValidation(true)}
                className="btn btn-primary flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
              >
                <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Validate Photos</span>
                <span className="sm:hidden">Photos</span>
              </button>
            )}
          </div>
        </div>

        {/* Section 1: Job Summary */}
        <div className="card">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Job Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-600">Status</p>
              <span className={`inline-block px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs md:text-sm font-semibold mt-0.5 sm:mt-1 ${getStatusColor(lead.display_status || lead.status)}`}>
                {(lead.display_status || lead.status) === 'WORK_COMPLETED' ? 'Mechanic Work Completed' :
                 (lead.display_status || lead.status) === 'QC_PENDING' ? 'QC Pending' :
                 (lead.display_status || lead.status) === 'MECHANIC_WORKING' ? 'Mechanic Working' :
                 (lead.display_status || lead.status) === 'IN_PROGRESS' ? 'In Progress' :
                 (lead.display_status || lead.status) === 'VEHICLE_DROPPED_AT_WORKSHOP' ? 'Vehicle at Workshop' :
                 (lead.display_status || lead.status) === 'HOLD' ? 'HOLD' :
                 (lead.display_status || lead.status) === 'ON_HOLD' ? 'HOLD' :
                 (lead.display_status || lead.status).replace(/_/g, ' ')}
              </span>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600">SLA Status</p>
              <span className={`inline-block px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg border text-[10px] sm:text-xs md:text-sm font-semibold mt-0.5 sm:mt-1 ${getSLAColor(lead.sla_status)}`}>
                {lead.sla_status}
              </span>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600">Priority</p>
              <p className="font-semibold mt-0.5 sm:mt-1 text-xs sm:text-sm md:text-base">{lead.priority}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600">Created</p>
              <p className="font-semibold mt-0.5 sm:mt-1 text-xs sm:text-sm md:text-base">{formatDateDMY(lead.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Section 2: Customer & Vehicle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          <div className="card">
            <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
              <User className="w-4 h-4 sm:w-5 sm:h-5" />
              Customer Details
            </h3>
            <div className="space-y-1.5 sm:space-y-2">
              <p className="text-xs sm:text-sm"><span className="text-gray-600">Name:</span> <strong>{lead.customer_name}</strong></p>
              <p className="text-xs sm:text-sm"><span className="text-gray-600">Phone:</span> <strong>{lead.customer_phone}</strong></p>
              {lead.customer_email && (
                <p className="text-xs sm:text-sm"><span className="text-gray-600">Email:</span> {lead.customer_email}</p>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
              <Car className="w-4 h-4 sm:w-5 sm:h-5" />
              Vehicle Details
            </h3>
            <div className="space-y-1.5 sm:space-y-2">
              <p className="text-xs sm:text-sm"><span className="text-gray-600">Number:</span> <strong>{lead.vehicle_number}</strong></p>
              <p className="text-xs sm:text-sm"><span className="text-gray-600">Make/Model:</span> {lead.vehicle_make} {lead.vehicle_model}</p>
              {lead.vehicle_year && (
                <p className="text-xs sm:text-sm"><span className="text-gray-600">Year:</span> {lead.vehicle_year}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Service Details */}
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
            <h3 className="text-base sm:text-lg font-semibold flex items-center gap-1.5 sm:gap-2">
              <Package className="w-4 h-4 sm:w-5 sm:h-5" />
              Service Request
            </h3>
            {/* Show edit button only if mechanic hasn't started work yet */}
            {(!lead.mechanic || lead.status === 'ACCEPTED' || lead.status === 'VEHICLE_DROPPED_AT_WORKSHOP') && (
              <button
                onClick={() => setShowServicePackageModal(true)}
                className="btn btn-outline flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 self-start sm:self-auto"
              >
                <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Change Package</span>
                <span className="sm:hidden">Change</span>
              </button>
            )}
          </div>
          
          {/* Service Types */}
          {lead.service_type_names && lead.service_type_names.length > 0 ? (
            <div className="mb-3 sm:mb-4">
              <p className="text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2 font-medium">Service Types:</p>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {lead.service_type_names.map((serviceName: string, index: number) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 text-blue-800 rounded-full text-[10px] sm:text-xs md:text-sm font-medium"
                  >
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full"></span>
                    {serviceName}
                  </span>
              ))}
              </div>
            </div>
          ) : (
            <div className="mb-3 sm:mb-4">
            <p className="text-xs sm:text-sm md:text-base text-gray-700">{lead.service_type || 'General Service'}</p>
            </div>
          )}

          {/* Service Addons */}
          {lead.service_addon_names && lead.service_addon_names.length > 0 && (
            <div className="mb-3 sm:mb-4">
              <p className="text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2 font-medium">Service Addons:</p>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {lead.service_addon_names.map((addon: any, index: number) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 bg-green-100 text-green-800 rounded-full text-[10px] sm:text-xs md:text-sm font-medium"
                  >
                    <Package className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    {addon.name}
                    {addon.price && (
                      <span className="text-[9px] sm:text-xs font-semibold">(₹{addon.price.toLocaleString()})</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {lead.problem_description && (
            <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-600 font-semibold">Problem Description:</p>
              <p className="text-xs sm:text-sm text-gray-700 mt-0.5 sm:mt-1">{lead.problem_description}</p>
            </div>
          )}
          {lead.issue_description && (
            <p className="text-xs sm:text-sm text-gray-600 mt-1.5 sm:mt-2">{lead.issue_description}</p>
          )}
        </div>

        {/* Section 4: Internal Assignment */}
        {lead.status !== 'NEW' && lead.status !== 'REJECTED' && (
          <InternalAssignment lead={lead} onUpdate={fetchJobDetails} />
        )}

        {/* Section 5: Before Inspection Photos */}
        <div className="card border-2 border-blue-300">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Camera className="w-6 h-6 text-blue-600" />
            Before Work Photos (Required)
          </h2>
          <BeforeInspectionUpload
            leadId={jobId}
            jobId={(lead as any).mechanic_job_id || ''}
            onUploadComplete={() => {
              fetchJobDetails();
            }}
          />
        </div>

        {/* Section 5.5: After Work Photos */}
        <div className="card border-2 border-green-300">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Camera className="w-6 h-6 text-green-600" />
            After Work Photos (Required)
          </h2>
          <AfterServiceUpload
            leadId={jobId}
            jobId={(lead as any).mechanic_job_id || ''}
            onUploadComplete={() => {
              fetchJobDetails();
            }}
          />
        </div>

        {/* Section 5.7: Job Card & Parts */}
        {lead.status !== 'NEW' && lead.status !== 'REJECTED' && (
          <JobCardSection lead={lead} onUpdate={fetchJobDetails} />
        )}

        {/* Section 6: Extra Charges */}
        {pendingExtraCharges.length > 0 && (
          <div className="card bg-orange-50 border-orange-200">
            <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
              Pending Additional Jobs Approval
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {pendingExtraCharges.map((charge: any) => (
                <div key={charge.id} className="bg-white p-3 sm:p-4 rounded-lg border border-orange-200">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm sm:text-base">{charge.description}</p>
                      <p className="text-xl sm:text-2xl font-bold text-brand-primary mt-0.5 sm:mt-1">
                        ₹{charge.amount.toLocaleString()}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">{charge.reason}</p>
                    </div>
                    <button
                      onClick={() =>
                        setSelectedExtraCharge({
                          ...charge,
                          requested_by_name: (charge as any)?.requester?.full_name || (charge as any)?.requested_by_name,
                        })
                      }
                      className="btn bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 self-start sm:self-auto"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 6: Media */}
        {lead.media && lead.media.length > 0 && (
          <div className="card">
            <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
              <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              Media ({lead.media.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
              {lead.media.map((item: any) => (
                <div key={item.id} className="relative">
                  <img
                    src={item.file_url}
                    alt={item.media_type}
                    className="w-full h-24 sm:h-28 md:h-32 object-cover rounded-lg cursor-pointer hover:opacity-90"
                  />
                  <span className="absolute top-1 sm:top-2 left-1 sm:left-2 bg-black bg-opacity-70 text-white text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                    {item.media_type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 7: Mechanic Parts Assignment */}
        {lead.mechanic && (
          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold flex items-center gap-1.5 sm:gap-2">
                <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                Mechanic Parts Assignment ({parts.length})
              </h3>
              <button
                onClick={() => {
                  setEditingPart(null);
                  setPartForm({ part_name: '', part_code: '', quantity_issued: 1, part_notes: '' });
                  setShowAddPartModal(true);
                }}
                className="btn btn-primary flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 self-start sm:self-auto"
              >
                <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Add Part
              </button>
            </div>

            {parts.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-gray-500">
                <Package className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-1.5 sm:mb-2 opacity-30" />
                <p className="text-xs sm:text-sm">No parts assigned yet</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {parts.map((part) => (
                  <div key={part.id} className="p-3 sm:p-4 border rounded-lg bg-gray-50">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm sm:text-base md:text-lg">{part.part_name}</p>
                        {part.part_code && (
                          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">Code: {part.part_code}</p>
                        )}
                        <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
                          Quantity: {part.quantity || 0}
                        </p>
                        {part.notes && (
                          <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">{part.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-1.5 sm:gap-2 self-start">
                        <button
                          onClick={() => {
                            setEditingPart(part);
                            setPartForm({
                              part_name: part.part_name,
                              part_code: part.part_code || '',
                              quantity_issued: part.quantity || 1,
                              part_notes: part.notes || ''
                            });
                            setShowAddPartModal(true);
                          }}
                          className="btn btn-outline text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deletePart(part.id)}
                          className="btn bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section 8: Internal Notes */}
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            Internal Supervisor Notes
          </h3>
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Add your private notes here... (visible only to supervisors and admins)"
            className="input w-full text-xs sm:text-sm"
            rows={4}
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mt-2 sm:mt-3">
            <p className="text-[10px] sm:text-xs text-gray-600">
              These notes are internal and not visible to mechanics or customers
            </p>
            <button
              onClick={saveInternalNotes}
              disabled={savingNotes}
              className="btn btn-primary flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 self-start sm:self-auto"
            >
              {savingNotes ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Save Notes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Invoice Section - should stay visible through billing/payment/delivery */}
        {[
          'WORK_COMPLETED',
          'COMPLETED',
          'QC_APPROVED',
          'READY_FOR_BILLING',
          'INVOICE_GENERATED',
          'AWAITING_PAYMENT',
          'PARTIAL_PAYMENT',
          'PAID',
          'COD_PENDING',
          'READY_FOR_DELIVERY',
          'DELIVERED_TO_CUSTOMER',
          'DELIVERED',
          'CLOSED',
        ].includes(lead.status) && (
          <InvoiceSection lead={lead} onUpdate={fetchJobDetails} />
        )}

        {/* Media Section (Adviser can upload; owner upload removed elsewhere) */}
        <MediaSection lead={lead} onUpdate={fetchJobDetails} canUpload={true} />

        {/* Section 8: Status Management */}
        {(lead.status === 'DELIVERED' || lead.status === 'IN_PROGRESS' || lead.status === 'INSPECTED' || lead.status === 'QC_PENDING' || lead.status === 'COMPLETED' || lead.status === 'WORK_COMPLETED') && (
          <div className="card bg-purple-50 border-purple-200">
            <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">Change Job Status</h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
              Update the job status based on your inspection and validation
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
              {(lead.status === 'DELIVERED' || lead.status === 'IN_PROGRESS') && (
                <button
                  onClick={() => changeJobStatus('IN_PROGRESS')}
                  className="btn bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Mark as IN PROGRESS</span>
                  <span className="sm:hidden">IN PROGRESS</span>
                </button>
              )}
              {(lead.status === 'DELIVERED' || lead.status === 'IN_PROGRESS') && (
                <button
                  onClick={() => changeJobStatus('INSPECTED')}
                  className="btn bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Mark as INSPECTED</span>
                  <span className="sm:hidden">INSPECTED</span>
                </button>
              )}
              {(lead.status === 'INSPECTED' || lead.status === 'WORK_COMPLETED' || lead.status === 'QC_PENDING') && (
                <button
                  onClick={() => changeJobStatus('QC_APPROVED')}
                  className="btn bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">QC APPROVED</span>
                  <span className="sm:hidden">QC OK</span>
                </button>
              )}
              {lead.status === 'QC_APPROVED' && (
                <button
                  onClick={() => changeJobStatus('READY_FOR_DELIVERY')}
                  className="btn bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">READY FOR DELIVERY</span>
                  <span className="sm:hidden">Ready</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Section 9: QC Section */}
        {['WORK_COMPLETED', 'QC_PENDING'].includes(lead.status) && lead.qc_status === 'PENDING' && !showQC && (
          <div className="card bg-purple-50 border-purple-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  Quality Control Required
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">This job is ready for quality inspection</p>
              </div>
              <button
                onClick={() => setShowQC(true)}
                className="btn bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 self-start sm:self-auto"
              >
                Perform QC
              </button>
            </div>
          </div>
        )}

        {showQC && (
          <QCChecklist
            leadId={lead.id}
            leadNumber={lead.lead_number}
            onSuccess={() => {
              setShowQC(false);
              fetchJobDetails();
            }}
            onCancel={() => setShowQC(false)}
          />
        )}

        {/* Section 10: Activity Timeline */}
        {lead.events && lead.events.length > 0 && (
          <div className="card">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
              <History className="w-4 h-4 sm:w-5 sm:h-5" />
              Activity Timeline
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {lead.events.slice(0, 10).map((event: any) => (
                <div key={event.id} className="flex gap-2 sm:gap-3 pb-2 sm:pb-3 border-b border-gray-200 last:border-0">
                  <div className="flex-shrink-0 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-brand-primary mt-1.5 sm:mt-2"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium">{event.event_description}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                      {formatDateTime(event.created_at)}
                      {event.created_by_user && ` • by ${event.created_by_user.full_name}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAssignModal && (
        <MechanicAssignmentModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          leadId={lead.id}
          leadNumber={lead.lead_number}
          onSuccess={() => {
            setShowAssignModal(false);
            fetchJobDetails();
          }}
        />
      )}

      {showReassignModal && lead.mechanic && (
        <ReassignMechanicModal
          isOpen={showReassignModal}
          onClose={() => setShowReassignModal(false)}
          leadId={lead.id}
          leadNumber={lead.lead_number}
          currentMechanicId={lead.mechanic.id}
          currentMechanicName={lead.mechanic.full_name}
          onSuccess={() => {
            setShowReassignModal(false);
            fetchJobDetails();
          }}
        />
      )}

      {selectedExtraCharge && (
        <ExtraWorkModal
          isOpen={!!selectedExtraCharge}
          onClose={() => setSelectedExtraCharge(null)}
          leadId={lead.id}
          leadNumber={lead.lead_number}
          extraCharge={selectedExtraCharge}
          onSuccess={() => {
            setSelectedExtraCharge(null);
            fetchJobDetails();
          }}
        />
      )}

      {showPhotoValidation && (
        <PhotoValidationModal
          isOpen={showPhotoValidation}
          onClose={() => setShowPhotoValidation(false)}
          leadId={lead.id}
          leadNumber={lead.lead_number}
          onSuccess={() => {
            setShowPhotoValidation(false);
            fetchJobDetails();
          }}
        />
      )}

      {showSendBack && lead.mechanic && (
        <SendBackModal
          isOpen={showSendBack}
          onClose={() => setShowSendBack(false)}
          leadId={lead.id}
          leadNumber={lead.lead_number}
          currentMechanicName={lead.mechanic.full_name}
          onSuccess={() => {
            setShowSendBack(false);
            fetchJobDetails();
          }}
        />
      )}

      {/* Service Package Change Modal */}
      {showServicePackageModal && (
        <ServicePackageChangeModal
          leadId={jobId}
          currentServiceTypeIds={lead.service_type_ids ? (typeof lead.service_type_ids === 'string' ? JSON.parse(lead.service_type_ids) : lead.service_type_ids) : []}
          currentSubserviceIds={lead.subservice_ids ? (typeof lead.subservice_ids === 'string' ? JSON.parse(lead.subservice_ids) : lead.subservice_ids) : []}
          onClose={() => setShowServicePackageModal(false)}
          onUpdate={fetchJobDetails}
        />
      )}

      {/* Add/Edit Part Modal */}
      {showAddPartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-5 md:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-bold">
                {editingPart ? 'Edit Part' : 'Add Part'}
              </h2>
              <button
                onClick={() => {
                  setShowAddPartModal(false);
                  setEditingPart(null);
                  setPartForm({ part_name: '', part_code: '', quantity_issued: 1, part_notes: '' });
                }}
                className="btn btn-outline p-1.5 sm:p-2"
              >
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1">
                  Part Name <span className="text-red-500">*</span>
                </label>
                <div
                  className="relative"
                  onMouseDown={() => {
                    // prevent blur-close when clicking inside dropdown
                    if (partSuggestHideTimer.current) {
                      window.clearTimeout(partSuggestHideTimer.current);
                      partSuggestHideTimer.current = null;
                    }
                  }}
                >
                  <input
                    type="text"
                    value={partForm.part_name}
                    onChange={(e) => setPartForm({ ...partForm, part_name: e.target.value })}
                    onFocus={() => {
                      if ((partForm.part_name || '').trim()) setPartSuggestionsOpen(true);
                    }}
                    onBlur={() => {
                      // small delay so click on suggestion works
                      partSuggestHideTimer.current = window.setTimeout(() => {
                        setPartSuggestionsOpen(false);
                      }, 120);
                    }}
                    className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                    placeholder="e.g., Oil Filter, Brake Pads"
                    required
                    autoComplete="off"
                  />

                  {partSuggestionsOpen && (partSuggestionsLoading || partSuggestions.length > 0) && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {partSuggestionsLoading ? (
                        <div className="px-3 py-2 text-xs sm:text-sm text-gray-500">
                          Searching…
                        </div>
                      ) : (
                        <div className="max-h-56 overflow-y-auto">
                          {partSuggestions.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => selectPartSuggestion(s)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-start justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-semibold text-gray-800 truncate">
                                  {s.name}
                                </div>
                                {s.part_number && (
                                  <div className="text-[10px] sm:text-xs text-gray-500 font-mono truncate">
                                    {s.part_number}
                                  </div>
                                )}
                              </div>
                              <div className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">
                                Select
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1">Part Code</label>
                <input
                  type="text"
                  value={partForm.part_code}
                  onChange={(e) => setPartForm({ ...partForm, part_code: e.target.value })}
                  className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                  placeholder="e.g., OF-12345"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1">
                  Quantity Issued <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={partForm.quantity_issued}
                  onChange={(e) => setPartForm({ ...partForm, quantity_issued: parseInt(e.target.value) || 1 })}
                  className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={partForm.part_notes}
                  onChange={(e) => setPartForm({ ...partForm, part_notes: e.target.value })}
                  className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                  rows={3}
                  placeholder="Additional notes about this part..."
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowAddPartModal(false);
                    setEditingPart(null);
                    setPartForm({ part_name: '', part_code: '', quantity_issued: 1, part_notes: '' });
                  }}
                  className="btn btn-outline flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={savePart}
                  disabled={!partForm.part_name || partForm.quantity_issued < 1}
                  className="btn btn-primary flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  {editingPart ? 'Update' : 'Add'} Part
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

