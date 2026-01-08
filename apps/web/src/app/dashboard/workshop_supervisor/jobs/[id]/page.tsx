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
import InternalAssignment from '@/components/lead-detail/InternalAssignment';
import InvoiceSection from '@/components/lead-detail/InvoiceSection';
import MediaSection from '@/components/lead-detail/MediaSection';
import { formatDateDMY, formatDateTime } from "@/lib/utils";
import { 
  ArrowLeft, Clock, User, Car, Calendar, Wrench, 
  CheckCircle, AlertTriangle, Image as ImageIcon, Package,
  DollarSign, FileText, MessageSquare, History, Loader2, Save,
  XCircle, ArrowLeftCircle, Camera, Edit, MapPin, AlertCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type MasterPartSuggestion = {
  id: string;
  name: string;
  part_number: string | null;
};

const ADVISOR_QC_ITEMS: Array<{ serial: number; question: string }> = [
  { serial: 15, question: 'Is the Engine Compartment washed properly?' },
  { serial: 16, question: 'Are there any signs of oil or coolant leakage in the Engine Compartment?' },
  { serial: 17, question: 'Are all the Wheel Arcs washed properly?' },
  { serial: 18, question: 'Are there any signs of dust in the cabin?' },
  { serial: 19, question: 'Is the dashboard and the door trims polished properly?' },
  { serial: 20, question: 'Do the door trims or seats have any marks of grease or oil left by technicians?' },
  { serial: 21, question: 'Are the floor mats washed properly?' },
  { serial: 22, question: 'Have the floor carpets, the seats and door crevices vacuumed properly?' },
  { serial: 23, question: 'Has the Glove Box been vacuumed properly?' },
  { serial: 24, question: 'Have all the glasses been wiped properly inside and outside?' },
  { serial: 25, question: 'Are there any signs of oil or grease on the car exterior?' },
  { serial: 26, question: 'Have the tyres been polished? (Only for Premium & Platinum Service)' },
  { serial: 27, question: 'Are all the wheel caps in place and washed properly?' },
  { serial: 28, question: 'Is the AC Disinfectant sprayed? (Only for Premium & Platinum Service)' },
  { serial: 29, question: 'Has the Battery Terminal Spray been applied? (Only for Premium & Platinum Service)' },
  { serial: 30, question: 'Has the Next Service Due sticker been put on the door sleeve and with proper figures?' },
  { serial: 31, question: 'Has the SERVICE CENTER sticker been put on the rear of the car?' },
  { serial: 32, question: 'Has the Service Light and/or Service KMs been reset in the car?' },
  { serial: 33, question: 'Has the Clock & Radio been set?' },
  { serial: 34, question: 'Is the Car checked for any leftover Tools, Nuts, Bolts or any other items?' },
  { serial: 35, question: 'Is car wash task completed?' },
];

export default function SupervisorJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  type MainTab = 'overview' | 'service' | 'photos' | 'billing' | 'parts' | 'workflow' | 'additional-jobs' | 'qc';

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQC, setShowQC] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>('overview');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedExtraCharge, setSelectedExtraCharge] = useState<any>(null);
  const [showPhotoValidation, setShowPhotoValidation] = useState(false);
  const [showSendBack, setShowSendBack] = useState(false);
  const [showServicePackageModal, setShowServicePackageModal] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [observationText, setObservationText] = useState('');
  const [savingObservation, setSavingObservation] = useState(false);
  const [enablingPickup, setEnablingPickup] = useState(false);
  const [showAddPickupForm, setShowAddPickupForm] = useState(false);
  const [pickupFormAddress, setPickupFormAddress] = useState('');
  const [pickupFormDate, setPickupFormDate] = useState(''); // YYYY-MM-DD
  const [pickupFormTimeSlot, setPickupFormTimeSlot] = useState(''); // "10:00 AM - 12:00 PM"
  const PICKUP_TIME_SLOTS = useMemo(
    () => [
      '09:00 AM - 11:00 AM',
      '10:00 AM - 12:00 PM',
      '11:00 AM - 01:00 PM',
      '12:00 PM - 02:00 PM',
      '01:00 PM - 03:00 PM',
      '02:00 PM - 04:00 PM',
      '03:00 PM - 05:00 PM',
      '04:00 PM - 06:00 PM',
      '05:00 PM - 07:00 PM',
      '06:00 PM - 08:00 PM',
      'Anytime (Today)',
      'Anytime (Tomorrow)',
    ],
    []
  );

  const [parts, setParts] = useState<any[]>([]);
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [editingPart, setEditingPart] = useState<any>(null);
  const [partForm, setPartForm] = useState({
    part_name: '',
    part_code: '',
    quantity_issued: 1,
    part_notes: ''
  });

  // QC Tab Data - Mechanic Checklist, Advisor QC, and Proof Images
  const [mechanicChecklist, setMechanicChecklist] = useState<any[]>([]);
  const [advisorQcData, setAdvisorQcData] = useState<{
    answered?: Record<number, 'YES' | 'NO'>;
    proof_required_serials?: number[];
    proof_uploads?: Record<number, string[]>;
    reviewed_at?: string;
  } | null>(null);
  const [proofImages, setProofImages] = useState<Record<number, string[]>>({});

  const qcProofRows = useMemo(() => {
    const media = Array.isArray((lead as any)?.media) ? ((lead as any).media as any[]) : [];
    const qcMedia = media.filter((m) => {
      const cat = String(m?.category || '').toUpperCase();
      const fn = String(m?.file_name || '').toUpperCase();
      return cat === 'QC_PROOF' || fn.startsWith('QC_PROOF');
    });

    const parsed = qcMedia
      .map((m) => {
        const desc = String(m?.description || '');
        const pMatch = desc.match(/point\s*=\s*(\d+)/i);
        const sMatch = desc.match(/serial\s*=\s*(\d+)/i);
        const point = pMatch?.[1] ? parseInt(pMatch[1], 10) : null;
        const serial = sMatch?.[1] ? parseInt(sMatch[1], 10) : null;
        const url = String(m?.file_url || '').trim();
        return {
          id: String(m?.id || `${url}__${m?.created_at || ''}`),
          url,
          created_at: String(m?.created_at || ''),
          point,
          serial,
        };
      })
      .filter((x) => !!x.url);

    // Group by serial (preferred) else point. Keep latest-first.
    parsed.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    const bySerial = new Map<number, { serial: number; point: number | null; urls: string[]; latestAt: string }>();
    const byPoint = new Map<number, { point: number; urls: string[]; latestAt: string }>();

    for (const r of parsed) {
      if (r.serial && Number.isFinite(r.serial)) {
        const prev = bySerial.get(r.serial) || { serial: r.serial, point: r.point, urls: [], latestAt: r.created_at };
        if (!prev.point && r.point) prev.point = r.point;
        if (!prev.urls.includes(r.url)) prev.urls.push(r.url);
        if (!prev.latestAt) prev.latestAt = r.created_at;
        bySerial.set(r.serial, prev);
      } else if (r.point && Number.isFinite(r.point)) {
        const prev = byPoint.get(r.point) || { point: r.point, urls: [], latestAt: r.created_at };
        if (!prev.urls.includes(r.url)) prev.urls.push(r.url);
        if (!prev.latestAt) prev.latestAt = r.created_at;
        byPoint.set(r.point, prev);
      }
    }

    const fromDb = Array.isArray(advisorQcData?.proof_required_serials)
      ? advisorQcData!.proof_required_serials.filter((n) => Number.isFinite(n)).slice(0, 3)
      : [];

    // Pick the 3 points asked (serial-based). Fallback to latest 3 serial groups, else latest 3 point groups.
    const chosenSerials =
      fromDb.length > 0
        ? fromDb
        : Array.from(bySerial.values())
            .sort((a, b) => String(b.latestAt).localeCompare(String(a.latestAt)))
            .map((x) => x.serial)
            .slice(0, 3);

    if (chosenSerials.length > 0) {
      return chosenSerials
        .map((s) => {
          const g = bySerial.get(s);
          if (!g) return null;
          const q = ADVISOR_QC_ITEMS.find((it) => it.serial === s);
          return {
            key: `S${s}`,
            point: g.point,
            serial: s,
            name: q?.question || `Serial ${s}`,
            urls: g.urls.slice(0, 3),
            date: g.latestAt,
          };
        })
        .filter(Boolean) as Array<{ key: string; point: number | null; serial: number; name: string; urls: string[]; date: string }>;
    }

    return Array.from(byPoint.values())
      .sort((a, b) => String(b.latestAt).localeCompare(String(a.latestAt)))
      .slice(0, 3)
      .map((g) => ({
        key: `P${g.point}`,
        point: g.point,
        serial: NaN,
        name: `Point ${g.point}`,
        urls: g.urls.slice(0, 3),
        date: g.latestAt,
      }));
  }, [lead, advisorQcData]);

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

  // NOTE: Billing view is handled inside `InvoiceSection` (OS/CI/TI tabs),
  // so we intentionally don't keep a separate billingMode state here.

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
          qc_performed_by_user:qc_performed_by(id, full_name, email),
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

      // Fetch pickup tracking data to get pickup_odometer_reading
      if (data.pickup_required) {
        const { data: pickupTracking, error: pickupTrackingError } = await supabase
          .from('pickup_tracking')
          .select('pickup_odometer_reading, drop_odometer_reading')
          .eq('lead_id', jobId)
          .maybeSingle();
        
        if (!pickupTrackingError && pickupTracking) {
          (data as any).pickup_odometer_reading = pickupTracking.pickup_odometer_reading;
          (data as any).drop_odometer_reading = pickupTracking.drop_odometer_reading;
        }
      }

      // Fetch mechanic job photos (mechanic uploaded photos)
      if (mechanicJob?.id) {
        const { data: mechanicPhotos, error: mechanicPhotosError } = await supabase
          .from('mechanic_job_photos')
          .select('*')
          .eq('job_id', mechanicJob.id)
          .order('created_at', { ascending: false });

        if (!mechanicPhotosError && mechanicPhotos) {
          (data as any).mechanic_job_photos = mechanicPhotos;
        }
      }

      setLead(data);
      setInternalNotes(data.notes_internal || '');
      setObservationText(String((data as any)?.supervisor_observation || ''));

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

        // Fetch mechanic checklist items
        const { data: checklistData, error: checklistError } = await supabase
          .from('service_checklists')
          .select('checklist_items')
          .eq('lead_id', jobId)
          .eq('mechanic_id', mechanicJob.mechanic_id)
          .maybeSingle();

        if (!checklistError && checklistData?.checklist_items) {
          let items = checklistData.checklist_items;
          if (typeof items === 'string') {
            try {
              items = JSON.parse(items);
            } catch (e) {
              items = [];
            }
          }
          setMechanicChecklist(Array.isArray(items) ? items : []);
        } else {
          setMechanicChecklist([]);
        }
      }

      // Fetch QC checks data for advisor checklist and proof images
      let qcChecklistData: any = null;
      try {
        const { data: qcCheckData, error: qcCheckError } = await supabase
          .from('qc_checks')
          .select('checklist_data')
          .eq('lead_id', jobId)
          .maybeSingle();

        if (!qcCheckError && qcCheckData?.checklist_data) {
          qcChecklistData = qcCheckData.checklist_data;
        }
      } catch {
        // ignore; fallback below
      }

      // Fallback (server route) to avoid client-side RLS issues
      if (!qcChecklistData) {
        try {
          const res = await fetch(`/api/leads/${jobId}/qc-status`, { method: 'GET' });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json?.data?.checklist_data) {
            qcChecklistData = json.data.checklist_data;
          }
        } catch {
          // ignore
        }
      }

      // Reset QC-tab derived states each fetch
      setAdvisorQcData(null);
      setProofImages({});

      if (qcChecklistData && typeof qcChecklistData === 'object') {
        const advisorReview = (qcChecklistData as any)?.advisor_review;
        if (advisorReview) {
          setAdvisorQcData(advisorReview);
          const rawUploads = advisorReview?.proof_uploads || {};
          const normalized: Record<number, string[]> = {};
          if (rawUploads && typeof rawUploads === 'object') {
            for (const [k, v] of Object.entries(rawUploads as any)) {
              const n = parseInt(String(k), 10);
              if (!Number.isFinite(n)) continue;
              const arr = Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
              normalized[n] = arr;
            }
          }
          setProofImages(normalized);
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

  async function savePickupObservation() {
    const text = (observationText || '').trim();
    if (!text) {
      alert('Please enter an observation');
      return;
    }
    try {
      setSavingObservation(true);
      const res = await fetch(`/api/pickup/tasks/${jobId}/observation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observation: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || (data as any)?.details || 'Failed to save observation');
      setShowObservationModal(false);
      fetchJobDetails();
      alert('Observation saved');
    } catch (e: any) {
      alert(`Failed to save observation: ${e?.message || 'Unknown error'}`);
    } finally {
      setSavingObservation(false);
    }
  }

  async function enablePickupForLead() {
    try {
      setEnablingPickup(true);
      const addr =
        (pickupFormAddress || '').trim() ||
        (lead?.customer_address || lead?.address || '')?.toString().trim() ||
        null;

      const response = await fetch(`/api/supervisor/jobs/${jobId}/enable-pickup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickup_address: addr,
          preferred_date: (pickupFormDate || '').trim() || null,
          preferred_time_slot: (pickupFormTimeSlot || '').trim() || null,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any)?.error || 'Failed to enable pickup');
      }

      alert((data as any)?.message || 'Pickup enabled');
      setShowAddPickupForm(false);
      fetchJobDetails();
    } catch (error: any) {
      console.error('Error enabling pickup:', error);
      alert(`Failed to enable pickup: ${error?.message || 'Unknown error'}`);
    } finally {
      setEnablingPickup(false);
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
  const mediaCount = Array.isArray(lead?.media) ? lead.media.length : 0;
  const eventsCount = Array.isArray(lead?.events) ? lead.events.length : 0;
  const qcPending = ['WORK_COMPLETED', 'QC_PENDING'].includes(lead.status) && lead.qc_status === 'PENDING';
  const invoiceGenerated =
    Boolean((lead as any)?.invoice_id) ||
    [
      'INVOICE_GENERATED',
      'AWAITING_PAYMENT',
      'PARTIAL_PAYMENT',
      'PAID',
      'COD_PENDING',
      'READY_FOR_DELIVERY',
      'DELIVERED_TO_CUSTOMER',
      'DELIVERED',
      'CLOSED',
    ].includes(String(lead.status || '').toUpperCase());
  const effectivePickupStatus =
    (lead?.pickup_status as string | undefined) ||
    (lead?.pickup_otp_verified_at ? 'VEHICLE_IN_TRANSIT' : null) ||
    (lead?.pickup_otp ? 'IN_PROGRESS' : null) ||
    (lead?.assigned_pickup_boy_id ? 'ASSIGNED' : null) ||
    'NOT_ASSIGNED';
  // After pickup OTP is verified, pickup details should not be editable from supervisor/advisor.
  const pickupLocked = Boolean(lead?.pickup_otp_verified_at);

  const tabBtn = (tab: MainTab) => {
    const base = 'btn !px-4 !py-2 text-xs sm:text-sm';
    return activeTab === tab ? `${base} btn-primary` : `${base} btn-outline bg-white`;
  };

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

        {/* Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 1. Overview */}
          <button type="button" className={tabBtn('overview')} onClick={() => setActiveTab('overview')}>
            Overview
          </button>
          {/* 2. Service */}
          <button type="button" className={tabBtn('service')} onClick={() => setActiveTab('service')}>
            Service
          </button>
          {/* 3. Parts */}
          <button type="button" className={tabBtn('parts')} onClick={() => setActiveTab('parts')}>
            Parts {parts.length > 0 && <span className="ml-1">({parts.length})</span>}
          </button>
          {/* 4. Photos */}
          <button type="button" className={tabBtn('photos')} onClick={() => setActiveTab('photos')}>
            Photos {mediaCount > 0 && <span className="ml-1">({mediaCount})</span>}
          </button>
          {/* 5. Additional Jobs */}
          <button
            type="button"
            className={tabBtn('additional-jobs')}
            onClick={() => setActiveTab('additional-jobs' as any)}
          >
            Additional Jobs
            {pendingExtraCharges.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold border border-orange-200">
                {pendingExtraCharges.length}
              </span>
            )}
          </button>
          {/* 6. QC */}
          <button type="button" className={tabBtn('qc')} onClick={() => setActiveTab('qc')}>
            QC
            {qcPending && <span className="ml-1 text-yellow-700 font-semibold">(Pending)</span>}
            {lead.qc_status === 'PASSED' && <span className="ml-1 text-green-700 font-semibold">(Passed)</span>}
            {lead.qc_status === 'FAILED' && <span className="ml-1 text-red-700 font-semibold">(Failed)</span>}
          </button>
          {/* 7. Billing */}
          <button type="button" className={tabBtn('billing')} onClick={() => setActiveTab('billing')}>
            Billing {pendingExtraCharges.length > 0 && <span className="ml-1">({pendingExtraCharges.length})</span>}
          </button>
          {/* 8. Workflow & Timeline */}
          <button type="button" className={tabBtn('workflow')} onClick={() => setActiveTab('workflow')}>
            Workflow &amp; Timeline
            {qcPending && <span className="ml-1 text-yellow-700 font-semibold">(QC)</span>}
            {eventsCount > 0 && <span className="ml-1">({eventsCount})</span>}
          </button>
        </div>

        {activeTab === 'overview' && (
        <>
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
              {lead.vehicle_odometer && (
                <p className="text-xs sm:text-sm">
                  <span className="text-gray-600">Odometer:</span>{' '}
                  <strong>{Number(lead.vehicle_odometer).toLocaleString()} km</strong>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2.5: Pickup Details */}
        <div className="card border border-orange-200 bg-orange-50">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold flex items-center gap-1.5 sm:gap-2">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                Pickup Details
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-600 mt-0.5">
                Pickup info shows only when pickup is enabled on the lead.
              </p>
            </div>

            {!pickupLocked && (
              <button
                onClick={() => {
                  // Prefill from lead if available
                  if (!showAddPickupForm) {
                    const prefill = (lead?.pickup_address || lead?.customer_address || lead?.address || '') as string;
                    setPickupFormAddress((prefill || '').toString());
                    setPickupFormDate((lead?.preferred_date || '') as string);
                    setPickupFormTimeSlot((lead?.preferred_time_slot || '') as string);
                  }
                  setShowAddPickupForm((v) => !v);
                }}
                className={
                  lead.pickup_required
                    ? 'btn btn-outline text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 self-start'
                    : 'btn bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 self-start'
                }
              >
                {showAddPickupForm ? 'Close' : lead.pickup_required ? 'Update Pickup Details' : 'Add Pickup'}
              </button>
            )}
          </div>

          {/* Pickup Boy Observation */}
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-xs sm:text-sm font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-700" />
                Pickup Boy Observation
                </p>
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap break-words">
                {String((lead as any)?.pickup_observation || '').trim() ? (lead as any).pickup_observation : 'No observation from pickup boy yet.'}
                </p>
                {(lead as any)?.pickup_observation_updated_at && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    Last updated: {formatDateTime((lead as any).pickup_observation_updated_at)}
                  </p>
                )}
              </div>
          </div>

          {/* Supervisor/Advisor Observation */}
          <div className="mb-3 p-3 bg-white border border-orange-200 rounded-lg">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-xs sm:text-sm font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-700" />
                Supervisor/Advisor Observation
              </p>
              <div className="flex gap-2">
              <button
                type="button"
                  className="btn bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                onClick={() => {
                    setObservationText('');
                    setShowObservationModal(true);
                  }}
                >
                  Add New
                </button>
                {String((lead as any)?.supervisor_observation || '').trim() && (
                  <button
                    type="button"
                    className="btn btn-outline text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                    onClick={() => {
                      setObservationText(String((lead as any)?.supervisor_observation || ''));
                  setShowObservationModal(true);
                }}
              >
                Edit
              </button>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap break-words">
                {String((lead as any)?.supervisor_observation || '').trim() ? (lead as any).supervisor_observation : 'No observation added yet.'}
              </p>
              {(lead as any)?.supervisor_observation_updated_at && (
                <p className="text-[11px] text-gray-500 mt-1">
                  Last updated: {formatDateTime((lead as any).supervisor_observation_updated_at)}
                </p>
              )}
            </div>
          </div>

          {/* Ask pickup details right here (enable/update) */}
          {showAddPickupForm && (
            <div className="p-3 sm:p-4 bg-white border border-orange-200 rounded-lg mb-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Pickup Address
                  </label>
                  <textarea
                    value={pickupFormAddress}
                    onChange={(e) => setPickupFormAddress(e.target.value)}
                    rows={3}
                    className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-2"
                    placeholder="Enter pickup address (house/area/landmark)"
                  />
                  {!!(pickupFormAddress || '').trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          pickupFormAddress.trim()
                        )}`;
                        window.open(url, '_blank');
                      }}
                      className="text-[11px] sm:text-xs text-brand-primary hover:underline mt-1"
                    >
                      Open in Google Maps
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Pickup Date</label>
                  <input
                    type="date"
                    value={pickupFormDate}
                    onChange={(e) => setPickupFormDate(e.target.value)}
                    className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-2"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Pickup Time Slot</label>
                  <input
                    type="text"
                    value={pickupFormTimeSlot}
                    onChange={(e) => setPickupFormTimeSlot(e.target.value)}
                    className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-2"
                    placeholder="e.g. 10:00 AM - 12:00 PM"
                    list="pickup-time-slots"
                  />
                  <datalist id="pickup-time-slots">
                    {PICKUP_TIME_SLOTS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>

                  {/* Quick suggestions */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {PICKUP_TIME_SLOTS.slice(0, 6).map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setPickupFormTimeSlot(slot)}
                        className="px-2.5 py-1 rounded-full text-[11px] sm:text-xs border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-800"
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => setShowAddPickupForm(false)}
                  className="btn btn-outline text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                  disabled={enablingPickup}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={enablePickupForLead}
                  disabled={enablingPickup || !(pickupFormAddress || '').trim()}
                  className="btn bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  {enablingPickup ? 'Saving…' : lead.pickup_required ? 'Save Pickup Details' : 'Save & Enable Pickup'}
                </button>
              </div>
            </div>
          )}

          {lead.pickup_required ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* Pickup Status */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-500 w-1/3">
                      Pickup Status
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                  {String(effectivePickupStatus).toUpperCase() === 'COMPLETED' ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="font-semibold text-green-700">Completed</span>
                    </>
                  ) : String(effectivePickupStatus).toUpperCase() === 'VEHICLE_DROPPED_AT_WORKSHOP' ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                            <span className="font-semibold text-emerald-700">Dropped at Workshop</span>
                    </>
                  ) : String(effectivePickupStatus).toUpperCase() === 'VEHICLE_IN_TRANSIT' ? (
                    <>
                      <Clock className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold text-blue-700">Vehicle In Transit</span>
                    </>
                  ) : String(effectivePickupStatus).toUpperCase() === 'IN_PROGRESS' || String(effectivePickupStatus).toUpperCase() === 'ON_THE_WAY' ? (
                    <>
                      <Clock className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold text-blue-700">
                        {String(effectivePickupStatus).toUpperCase() === 'ON_THE_WAY' ? 'On The Way' : 'In Progress'}
                      </span>
                    </>
                  ) : String(effectivePickupStatus).toUpperCase() === 'ASSIGNED' ? (
                    <>
                      <User className="w-4 h-4 text-yellow-600" />
                            <span className="font-semibold text-yellow-700">Assigned</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-gray-500" />
                            <span className="font-semibold text-gray-700">Not Assigned</span>
                    </>
                  )}
                </div>
                    </td>
                  </tr>

                  {/* Pickup Address */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-500">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        Pickup Address
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-gray-900 break-words">
                      {lead.pickup_address || lead.customer_address || lead.address || '—'}
                        </span>
                    {(lead.pickup_address || lead.customer_address || lead.address) && (
                      <button
                        type="button"
                        onClick={() => {
                          const addr = (lead.pickup_address || lead.customer_address || lead.address || '').toString();
                          const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
                          window.open(url, '_blank');
                        }}
                            className="text-[11px] sm:text-xs text-brand-primary hover:underline w-fit"
                      >
                        Open in Google Maps
                      </button>
                    )}
                  </div>
                    </td>
                  </tr>

                  {/* Pickup Scheduled */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-500">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        Pickup Scheduled
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm">
                {lead.preferred_date || lead.preferred_time_slot ? (
                        <span className="font-semibold text-gray-900">
                    {lead.preferred_date ? formatDateDMY(lead.preferred_date) : '—'}
                    {lead.preferred_time_slot ? ` • ${lead.preferred_time_slot}` : ''}
                        </span>
                ) : (
                        <span className="text-gray-700">
                    Not set.
                    {!pickupLocked && (
                            <> Click <strong>Update Pickup Details</strong> and add date/time.</>
                    )}
                        </span>
                )}
                    </td>
                  </tr>

                  {/* Assigned Pickup Boy */}
              {lead.pickup_boy && (
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-500">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          Assigned Pickup Boy
                </div>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm font-semibold text-gray-900">
                        {lead.pickup_boy.full_name}
                      </td>
                    </tr>
              )}

                  {/* Pickup Assigned At */}
              {lead.pickup_assigned_at && (
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-500">
                        Pickup Assigned At
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm font-semibold text-gray-900">
                        {formatDateTime(lead.pickup_assigned_at)}
                      </td>
                    </tr>
                  )}

                  {/* Odometer Reading */}
                  {(lead.vehicle_odometer || (lead as any)?.pickup_odometer_reading) && (
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-500">
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-gray-400" />
                          Odometer Reading
                </div>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm">
                        <span className="font-semibold text-gray-900">
                          {Number(lead.vehicle_odometer || (lead as any)?.pickup_odometer_reading || 0).toLocaleString()} km
                        </span>
                        {(lead as any)?.pickup_odometer_reading && lead.vehicle_odometer && (lead as any).pickup_odometer_reading !== lead.vehicle_odometer && (
                          <span className="text-[10px] text-gray-500 ml-2">
                            (from pickup tracking)
                          </span>
                        )}
                      </td>
                    </tr>
              )}

                  {/* Pickup OTP */}
              {lead.pickup_otp && String(effectivePickupStatus).toUpperCase() !== 'COMPLETED' && (
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-500">
                        Pickup OTP
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <span className="font-mono text-xl sm:text-2xl font-bold text-orange-700 tracking-wider">
                    {lead.pickup_otp}
                        </span>
                      </td>
                    </tr>
              )}

                  {/* Not Assigned Warning */}
              {!lead.assigned_pickup_boy_id && (String(effectivePickupStatus).toUpperCase() === 'NOT_ASSIGNED') && (
                    <tr>
                      <td colSpan={2} className="px-4 md:px-6 py-3 md:py-4">
                        <div className="p-3 sm:p-4 bg-white border border-orange-200 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
                      <p className="text-xs sm:text-sm text-gray-700">
                        <strong>Pickup not assigned.</strong> Assign a pickup boy from Pickup & Delivery.
                      </p>
                    </div>
                    <button
                      onClick={() => router.push('/dashboard/workshop_supervisor/pickup-delivery')}
                      className="btn btn-outline text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 self-start sm:self-auto"
                    >
                      Open Pickup & Delivery
                    </button>
                  </div>
                </div>
                      </td>
                    </tr>
              )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs sm:text-sm text-gray-700">
                Pickup is not enabled for this lead. Supervisor can add pickup with address + schedule.
              </div>
            </div>
          )}
        </div>
        </>
        )}

        {/* Pickup Observation Modal */}
        {showObservationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 md:p-6">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-800">
                {observationText.trim() ? 'Edit Supervisor Observation' : 'Add New Supervisor Observation'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mb-3">
                {observationText.trim() 
                  ? 'Update your observation for this lead. This is separate from pickup boy observation.'
                  : 'Add a new observation for this lead. This is separate from pickup boy observation.'}
              </p>
              <textarea
                value={observationText}
                onChange={(e) => setObservationText(e.target.value)}
                className="input w-full min-h-[140px] text-sm"
                placeholder="Write observation..."
              />
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
                <button
                  type="button"
                  onClick={savePickupObservation}
                  disabled={savingObservation || !observationText.trim()}
                  className="btn bg-orange-600 hover:bg-orange-700 text-white flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  {savingObservation ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowObservationModal(false)}
                  disabled={savingObservation}
                  className="btn btn-outline flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'service' && (
        <>
        {/* Section 3: Service Details */}
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-4">
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
          
          {/* Service Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Name</th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
          {/* Service Types */}
          {lead.service_type_names && lead.service_type_names.length > 0 ? (
                  lead.service_type_names.map((serviceName: string, index: number) => (
                    <tr key={`service-type-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          <span className="text-xs sm:text-sm font-medium text-gray-900">{serviceName}</span>
              </div>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-blue-100 text-blue-800">
                          Service Type
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <span className="text-xs sm:text-sm text-gray-500">Included</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <span className="text-xs sm:text-sm font-medium text-gray-900">{lead.service_type || 'General Service'}</span>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-blue-100 text-blue-800">
                        Service Type
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <span className="text-xs sm:text-sm text-gray-500">Included</span>
                    </td>
                  </tr>
          )}

          {/* Service Addons */}
          {lead.service_addon_names && lead.service_addon_names.length > 0 && (
                  lead.service_addon_names.map((addon: any, index: number) => (
                    <tr key={`service-addon-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex items-center gap-2">
                          <Package className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                          <span className="text-xs sm:text-sm font-medium text-gray-900">{addon.name}</span>
              </div>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-green-100 text-green-800">
                          Addon
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        {addon.price ? (
                          <span className="text-xs sm:text-sm font-semibold text-green-600">
                            ₹{addon.price.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs sm:text-sm text-gray-500">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Problem Description */}
          {lead.problem_description && (
            <div className="mt-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-600 font-semibold mb-1">Problem Description:</p>
              <p className="text-xs sm:text-sm text-gray-700">{lead.problem_description}</p>
            </div>
          )}
          {lead.issue_description && (
            <div className="mt-3 p-3 sm:p-4 bg-gray-50 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-600 font-semibold mb-1">Issue Description:</p>
              <p className="text-xs sm:text-sm text-gray-700">{lead.issue_description}</p>
            </div>
          )}
        </div>

        {/* Section 4: Internal Assignment */}
        {lead.status !== 'NEW' && lead.status !== 'REJECTED' && (
          <InternalAssignment lead={lead} onUpdate={fetchJobDetails} />
        )}
        </>
        )}

        {activeTab === 'photos' && (
        <>
        {/* Section 5: Pickup/Visit Photos */}
        <div className="card border-2 border-blue-300">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Camera className="w-6 h-6 text-blue-600" />
            Pickup/Visit Photos (Required)
          </h2>
          <BeforeInspectionUpload
            leadId={jobId}
            jobId={(lead as any).mechanic_job_id || ''}
            mode="LEAD_MEDIA"
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
        </>
        )}

        {/* Job Card section hidden as requested */}

        {/* Billing UI is rendered by `InvoiceSection` below (single source of truth for OS/CI/TI). */}

        {/* Section 6: Extra Charges - Additional Jobs Tab */}
        {activeTab === 'additional-jobs' && (
          <div className="space-y-4">
            {/* Pending Additional Jobs */}
            {pendingExtraCharges.length > 0 && (
              <div id="pending-additional-jobs" className="card bg-orange-50 border-orange-200">
                <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                  Pending Additional Jobs Approval ({pendingExtraCharges.length})
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

            {/* All Additional Jobs (Approved/Rejected) */}
            {lead.extra_charges && lead.extra_charges.length > 0 && (
              <div className="card">
                <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                  All Additional Jobs ({lead.extra_charges.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {lead.extra_charges.map((charge: any) => (
                        <tr key={charge.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{charge.description}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{charge.reason || '—'}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {(charge as any)?.requester?.full_name || 'Unknown'}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900">
                            ₹{Number(charge.amount || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              charge.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                              charge.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {charge.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(!lead.extra_charges || lead.extra_charges.length === 0) && (
              <div className="card text-center py-8">
                <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-500">No additional jobs requested</p>
              </div>
            )}
          </div>
        )}

        {/* Section 6: Extra Charges - Also show in Billing tab */}
        {activeTab === 'billing' && pendingExtraCharges.length > 0 && (
          <div id="pending-additional-jobs" className="card bg-orange-50 border-orange-200">
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
        {activeTab === 'photos' && lead.media && lead.media.length > 0 && (
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
        {activeTab === 'parts' && lead.mechanic && (
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Part</th>
                      <th className="px-4 py-3 text-left font-semibold">Code</th>
                      <th className="px-4 py-3 text-right font-semibold w-24">Qty</th>
                      <th className="px-4 py-3 text-left font-semibold">Notes</th>
                      <th className="px-4 py-3 text-right font-semibold w-36">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {parts.map((part) => (
                      <tr key={part.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{part.part_name}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{part.part_code || '—'}</td>
                        <td className="px-4 py-3 text-right font-medium">{part.quantity || 0}</td>
                        <td className="px-4 py-3 text-gray-700">
                          <div className="max-w-[520px] whitespace-pre-wrap break-words">{part.notes || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
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
                              className="btn btn-outline text-xs sm:text-sm px-3 py-1.5"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deletePart(part.id)}
                              className="btn bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm px-3 py-1.5"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Section 8: Internal Notes */}
        {activeTab === 'workflow' && (
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
        )}

        {/* Invoice Section - should stay visible through billing/payment/delivery */}
        {activeTab === 'billing' && [
          'WORK_COMPLETED',
          'COMPLETED',
          'QC_APPROVED',
          'READY_FOR_BILLING',
          'PAYMENT_AWAITING',
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

        {/* Mechanic Uploaded Photos Section */}
        {activeTab === 'photos' && (lead as any)?.mechanic_job_photos && (lead as any).mechanic_job_photos.length > 0 && (
          <div className="card border-2 border-purple-300">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Camera className="w-6 h-6 text-purple-600" />
              Mechanic Uploaded Photos ({(lead as any).mechanic_job_photos.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {(lead as any).mechanic_job_photos.map((photo: any) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.photo_url}
                    alt={photo.photo_type || 'Mechanic Photo'}
                    className="w-full h-32 sm:h-40 md:h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 border border-gray-200"
                    onClick={() => window.open(photo.photo_url, '_blank')}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-2 rounded-b-lg">
                    <p className="text-xs font-medium truncate">{photo.photo_type?.replace(/_/g, ' ') || 'Photo'}</p>
                    <p className="text-[10px] text-gray-300 mt-0.5">
                      {photo.photo_category === 'before' ? 'Before' : photo.photo_category === 'after' ? 'After' : photo.photo_category === 'during' ? 'During' : photo.photo_category}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Media Section (Adviser can upload; owner upload removed elsewhere) */}
        {activeTab === 'photos' && (
          <MediaSection
            lead={lead}
            onUpdate={fetchJobDetails}
            canUpload={true}
            // Hide legacy slot categories like BEFORE_ENGINE_BAY/BEFORE_DASHBOARD which are
            // already handled by the dedicated Pickup/Visit/After upload sections above.
            hideLegacySlotCategories
          />
        )}

        {/* Section 8: Status Management */}
        {activeTab === 'workflow' && (lead.status === 'DELIVERED' || lead.status === 'IN_PROGRESS' || lead.status === 'INSPECTED' || lead.status === 'QC_PENDING' || lead.status === 'COMPLETED' || lead.status === 'WORK_COMPLETED') && (
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

        {/* Section 9: QC Section - QC Tab */}
        {activeTab === 'qc' && (
          <>
            {/* QC Pending - Show QC Checklist */}
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

            {/* QC Checklist Form */}
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

            {/* QC Results - Show if QC is already performed */}
            {lead.qc_status === 'PASSED' && lead.qc_performed_at && (
              <div className="card bg-green-50 border-green-200">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  QC Approved
                </h3>
                <div className="space-y-3">
                  {(lead as any).qc_performed_by_user && (
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">QC Performed By</p>
                      <p className="text-sm sm:text-base font-semibold text-gray-900">
                        {(lead as any).qc_performed_by_user?.full_name || 'Unknown'}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">QC Performed At</p>
                    <p className="text-sm sm:text-base font-semibold text-gray-900">
                      {formatDateTime(lead.qc_performed_at)}
                    </p>
                  </div>
                  {lead.qc_notes && (
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">QC Notes</p>
                      <div className="mt-1 p-3 bg-white rounded-lg border border-green-200">
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{lead.qc_notes}</p>
                      </div>
                    </div>
                  )}
                  {lead.qc_score !== null && lead.qc_score !== undefined && (
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">QC Score</p>
                      <p className="text-2xl font-bold text-green-700">{lead.qc_score}/100</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mechanic Checklist (Table) */}
            {mechanicChecklist.length > 0 && (
              <div className="card">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  Mechanic Checklist
                </h3>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold w-16">#</th>
                        <th className="px-4 py-3 text-left font-semibold">Item</th>
                        <th className="px-4 py-3 text-left font-semibold w-28">Required</th>
                        <th className="px-4 py-3 text-left font-semibold w-32">Status</th>
                        <th className="px-4 py-3 text-left font-semibold w-48">Remark</th>
                        <th className="px-4 py-3 text-left font-semibold w-56">Completed At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {mechanicChecklist.map((item: any, idx: number) => {
                        const status = String(item?.status || 'PENDING').toUpperCase();
                        const required = !!item?.mandatory;
                        return (
                          <tr key={item?.id || idx} className="align-top">
                            <td className="px-4 py-3 text-gray-700 font-semibold">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-gray-900">{item?.name || item?.item_name || `Item ${idx + 1}`}</div>
                              {item?.notes && <div className="text-xs text-gray-600 mt-1">{String(item.notes)}</div>}
                            </td>
                            <td className="px-4 py-3">
                              {required ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">YES</span>
                              ) : (
                                <span className="text-xs text-gray-500">NO</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                                  status === 'COMPLETED'
                                    ? 'bg-green-100 text-green-700'
                                    : status === 'PENDING'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-700">{String(item?.remark || item?.notes || '—')}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-700">{item?.completed_at ? formatDateTime(item.completed_at) : '—'}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Advisor Checklist (Table) */}
            {advisorQcData && advisorQcData.answered && Object.keys(advisorQcData.answered).length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-semibold flex items-center gap-1.5 sm:gap-2">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                    Advisor Checklist Points
                  </h3>
                  {advisorQcData.reviewed_at && (
                    <p className="text-xs text-gray-500">Reviewed: {formatDateTime(advisorQcData.reviewed_at)}</p>
                  )}
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold w-14">#</th>
                        <th className="px-4 py-3 text-left font-semibold">Point</th>
                        <th className="px-4 py-3 text-left font-semibold w-28">YES/NO</th>
                        <th className="px-4 py-3 text-left font-semibold w-[360px]">Proof</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {ADVISOR_QC_ITEMS.map((item, idx) => {
                        const answer = advisorQcData.answered?.[item.serial];
                        const imgs = proofImages[item.serial] || [];
                        return (
                          <tr key={item.serial} className="align-top">
                            <td className="px-4 py-3 text-gray-700 font-semibold">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-gray-900">{item.question}</div>
                              <div className="mt-1 text-xs text-gray-500">serial: {item.serial}</div>
                            </td>
                            <td className="px-4 py-3">
                              {answer ? (
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                                    answer === 'YES' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {answer}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {imgs.length === 0 ? (
                                <span className="text-xs text-gray-500">—</span>
                              ) : (
                                <div className="grid grid-cols-3 gap-2">
                                  {imgs.slice(0, 3).map((u) => (
                                    <div key={u} className="relative group">
                                      <img
                                        src={u}
                                        alt="Proof"
                                        className="w-full h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                                        onClick={() => window.open(u, '_blank')}
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* QC PROOF (3) - show exactly like Photos tab, but with point name + table format */}
            {qcProofRows.length > 0 && (
              <div className="card">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                  <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  QC PROOF ({qcProofRows.length})
                </h3>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold w-24">Point</th>
                        <th className="px-4 py-3 text-left font-semibold w-24">Serial</th>
                        <th className="px-4 py-3 text-left font-semibold">Point Name</th>
                        <th className="px-4 py-3 text-left font-semibold w-[420px]">Images</th>
                        <th className="px-4 py-3 text-left font-semibold w-44">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {qcProofRows.map((r) => (
                        <tr key={r.key} className="align-top">
                          <td className="px-4 py-3 font-semibold text-gray-900">{r.point ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-700">{Number.isFinite(r.serial) ? r.serial : '—'}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">{r.name}</div>
                            <div className="mt-1 text-xs text-gray-500">
                              QC Proof | point={r.point ?? '—'}
                              {Number.isFinite(r.serial) ? ` | serial=${r.serial}` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {r.urls.length === 0 ? (
                              <span className="text-xs text-gray-500">—</span>
                            ) : (
                              <div className="grid grid-cols-3 gap-2">
                                {r.urls.slice(0, 3).map((u) => (
                                  <div key={u} className="relative group">
                                    <img
                                      src={u}
                                      alt="QC Proof"
                                      className="w-full h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                      onClick={() => window.open(u, '_blank')}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{r.date ? formatDateTime(r.date) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* QC Failed */}
            {lead.qc_status === 'FAILED' && lead.qc_performed_at && (
              <div className="card bg-red-50 border-red-200">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                  QC Failed
                </h3>
                <div className="space-y-3">
                  {(lead as any).qc_performed_by_user && (
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">QC Performed By</p>
                      <p className="text-sm sm:text-base font-semibold text-gray-900">
                        {(lead as any).qc_performed_by_user?.full_name || 'Unknown'}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">QC Performed At</p>
                    <p className="text-sm sm:text-base font-semibold text-gray-900">
                      {formatDateTime(lead.qc_performed_at)}
                    </p>
                  </div>
                  {lead.qc_notes && (
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">QC Notes</p>
                      <div className="mt-1 p-3 bg-white rounded-lg border border-red-200">
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{lead.qc_notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No QC Status */}
            {!['WORK_COMPLETED', 'QC_PENDING'].includes(lead.status) && lead.qc_status !== 'PASSED' && lead.qc_status !== 'FAILED' && (
              <div className="card text-center py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-500">QC not available yet. Job must be completed first.</p>
              </div>
            )}
          </>
        )}

        {/* Section 9: QC Section - Also in Workflow tab for backward compatibility */}
        {activeTab === 'workflow' && ['WORK_COMPLETED', 'QC_PENDING'].includes(lead.status) && lead.qc_status === 'PENDING' && !showQC && (
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
                onClick={() => {
                  setActiveTab('qc');
                  setShowQC(true);
                }}
                className="btn bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 self-start sm:self-auto"
              >
                Go to QC Tab
              </button>
            </div>
          </div>
        )}

        {/* Section 10: Activity Timeline (merged into Workflow tab) */}
        {activeTab === 'workflow' && lead.events && lead.events.length > 0 && (
          <div className="card">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
              <History className="w-4 h-4 sm:w-5 sm:h-5" />
              Activity Timeline
            </h3>
            <div className="max-h-[420px] overflow-y-auto pr-1">
              <div className="space-y-2 sm:space-y-3">
                {lead.events.map((event: any) => (
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

