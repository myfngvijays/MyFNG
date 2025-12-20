'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateTime } from '@/lib/utils';
import {
  ArrowLeft, Clock, User, Car, CheckCircle, XCircle, 
  Camera, Package, FileText, Loader2, AlertTriangle, Image as ImageIcon
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import PhotoUpload from '@/components/PhotoUpload';

type YesNo = 'YES' | 'NO' | null;

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

export default function QCReviewPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'photos' | 'qc'>('details');
  const [activePhotoTab, setActivePhotoTab] = useState<'pickup' | 'during' | 'after'>('pickup');
  
  // QC Form state
  const [qualityScore, setQualityScore] = useState(5);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [failedItems, setFailedItems] = useState<string[]>([]);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Advisor checklist review gating
  const [showAdvisorReviewModal, setShowAdvisorReviewModal] = useState(false);
  const [advisorAnswers, setAdvisorAnswers] = useState<Record<number, YesNo>>(() => {
    const init: Record<number, YesNo> = {};
    ADVISOR_QC_ITEMS.forEach(i => { init[i.serial] = null; });
    return init;
  });
  const [advisorMarkedReviewed, setAdvisorMarkedReviewed] = useState(false);
  const [proofRequiredSerials, setProofRequiredSerials] = useState<number[]>([]);
  const [proofUploads, setProofUploads] = useState<Record<number, string[]>>({});
  const [proofExpiryAt, setProofExpiryAt] = useState<Record<number, number>>({});
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  
  // Data state
  const [beforePhotos, setBeforePhotos] = useState<any[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<any[]>([]);
  const [duringPhotos, setDuringPhotos] = useState<any[]>([]);
  const [showAllBeforePhotos, setShowAllBeforePhotos] = useState(false);
  const [showAllDuringPhotos, setShowAllDuringPhotos] = useState(false);
  const [showAllAfterPhotos, setShowAllAfterPhotos] = useState(false);
  const [partsUsed, setPartsUsed] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [mechanic, setMechanic] = useState<any>(null);

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

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
    }
  }, [jobId]);

  useEffect(() => {
    // Reset review state per job
    const init: Record<number, YesNo> = {};
    ADVISOR_QC_ITEMS.forEach(i => { init[i.serial] = null; });
    setAdvisorAnswers(init);
    setProofUploads({});
    setProofRequiredSerials([]);
    setProofExpiryAt({});
    setAdvisorMarkedReviewed(false);
  }, [jobId]);

  useEffect(() => {
    if (!showAdvisorReviewModal) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [showAdvisorReviewModal]);

  async function fetchJobDetails() {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      
      const inferSlotKey = (row: any): string => {
        const direct = String(row?.photo_type || row?.category || '').trim().toUpperCase();
        if (direct) return direct;
        const fn = String(row?.file_name || '').trim();
        const m = fn.match(/^(BEFORE_[A-Z0-9_]+)__+/);
        if (m?.[1]) return String(m[1]).toUpperCase();
        return '';
      };

      // NOTE:
      // In Next.js dev (React StrictMode), useEffect can run twice.
      // Avoid setState(prev => [...prev, ...]) merges which can cause duplicate keys.
      const dedupePhotos = (list: any[]) => {
        const seen = new Set<string>();
        const out: any[] = [];
        for (const p of list || []) {
          const url = String(p?.photo_url || p?.file_url || p?.media_url || '');
          const id = String(p?.id || '');
          const key = `${id}__${url}`;
          if (!url && !id) continue;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(p);
        }
        return out;
      };

      // Fetch lead details
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        .select(`
          *,
          mechanic:assigned_mechanic_id(id, full_name, profile_image),
          supervisor:assigned_supervisor_id(id, full_name)
        `)
        .eq('id', jobId)
        .single();

      if (leadError) throw leadError;
      
      // Fetch service type names from service_types table (using service_type_ids JSONB)
      if (leadData?.service_type_ids) {
        try {
          let serviceTypeIds = leadData.service_type_ids;
          
          // Parse if it's a string
          if (typeof serviceTypeIds === 'string') {
            serviceTypeIds = JSON.parse(serviceTypeIds);
          }
          
          // Ensure it's an array and has data
          if (Array.isArray(serviceTypeIds) && serviceTypeIds.length > 0) {
            const { data: serviceTypes } = await supabase
              .from('service_types')
              .select('id, name')
              .in('id', serviceTypeIds);
            
            leadData.service_type_names = serviceTypes?.map(st => st.name) || [];
          }
        } catch (e) {
          console.error('Error parsing service_type_ids:', e);
          leadData.service_type_names = [];
        }
      }
      
      // Fetch sub-service names from service_addons table (using subservice_ids JSONB)
      if (leadData?.subservice_ids) {
        try {
          let subserviceIds = leadData.subservice_ids;
          
          // Parse if it's a string
          if (typeof subserviceIds === 'string') {
            subserviceIds = JSON.parse(subserviceIds);
          }
          
          // Ensure it's an array and has data
          if (Array.isArray(subserviceIds) && subserviceIds.length > 0) {
            const { data: subservices } = await supabase
              .from('service_addons')
              .select('id, name')
              .in('id', subserviceIds);
            
            leadData.subservice_names = subservices?.map(ss => ss.name) || [];
          }
        } catch (e) {
          console.error('Error parsing subservice_ids:', e);
          leadData.subservice_names = [];
        }
      }
      
      setLead(leadData);

      // Fetch mechanic details
      if (leadData?.assigned_mechanic_id) {
        const { data: mechanicData } = await supabase
          .from('users_login')
          .select('id, full_name, profile_image')
          .eq('id', leadData.assigned_mechanic_id)
          .single();
        setMechanic(mechanicData);
      }

      // Collect photos from multiple sources, then set state once (de-duped).
      const beforeCollected: any[] = [];
      const afterCollected: any[] = [];
      const duringCollected: any[] = [];

      // Fetch photos from mechanic_job_photos table (primary source)
      // IMPORTANT: In this codebase mechanic_job_photos is keyed by job_id (see mechanic manage page),
      // so querying by lead_id may return partial results.
      const { data: mechJob } = await supabase
        .from('mechanic_jobs')
        .select('id, lead_id')
        .eq('lead_id', jobId)
        .maybeSingle();

      const jobIdForPhotos = mechJob?.id || null;

      const { data: jobPhotosData, error: jobPhotosError } = jobIdForPhotos
        ? await supabase
            .from('mechanic_job_photos')
            .select('*')
            .eq('job_id', jobIdForPhotos)
            .order('created_at', { ascending: false })
        : await supabase
            .from('mechanic_job_photos')
            .select('*')
            .eq('lead_id', jobId)
            .order('created_at', { ascending: false });

      if (!jobPhotosError && jobPhotosData) {
        beforeCollected.push(...jobPhotosData.filter((p: any) => p.photo_category === 'before'));
        afterCollected.push(...jobPhotosData.filter((p: any) => p.photo_category === 'after'));
        duringCollected.push(...jobPhotosData.filter((p: any) => p.photo_category === 'during'));
      }

      // Also try fetching from lead_media table as fallback
      const { data: photosData, error: photosError } = await supabase
        .from('lead_media')
        .select('*')
        .eq('lead_id', jobId)
        .order('created_at', { ascending: false });

      if (!photosError && photosData) {
        const beforeFromLeadMedia = photosData
          .filter((p: any) => {
            const pc = String(p?.photo_category || '').toLowerCase();
            const slot = inferSlotKey(p);
            const cat = String(p?.category || '').toUpperCase();
            const type = String(p?.photo_type || p?.media_category || '').toUpperCase();
            // "Pickup/Visit" photos can be stored as BEFORE_* or PICKUP_* in lead_media depending on flow.
            return (
              pc === 'before' ||
              pc === 'pickup' ||
              pc === 'visit' ||
              slot.startsWith('BEFORE_') ||
              slot.startsWith('PICKUP_') ||
              type.startsWith('PICKUP_') ||
              cat === 'BEFORE' ||
              cat === 'PICKUP' ||
              cat === 'VISIT'
            );
          })
          .map((p: any) => ({
            ...p,
            photo_url: p.file_url,
            photo_type: inferSlotKey(p) || p.photo_type || p.category || 'PICKUP/BEFORE',
          })); // Map file_url to photo_url + infer slot key
        const afterFromLeadMedia = photosData
          .filter(p => p.category === 'AFTER')
          .map(p => ({ ...p, photo_url: p.file_url }));
        const duringFromLeadMedia = photosData
          .filter(p => p.category === 'PROGRESS' || p.category === 'DURING')
          .map(p => ({ ...p, photo_url: p.file_url }));
        
        beforeCollected.push(...beforeFromLeadMedia);
        afterCollected.push(...afterFromLeadMedia);
        duringCollected.push(...duringFromLeadMedia);
      }

      // Also try fetching from mechanic_media table as additional fallback
      const { data: mechanicMediaData, error: mechanicMediaError } = await supabase
        .from('mechanic_media')
        .select('*')
        .eq('lead_id', jobId)
        .order('uploaded_at', { ascending: false });

      if (!mechanicMediaError && mechanicMediaData) {
        const beforeFromMechanic = mechanicMediaData
          .filter((p: any) => {
            const mc = String(p?.media_category || '').toUpperCase();
            const slot = inferSlotKey(p);
            return mc === 'BEFORE' || mc === 'PICKUP' || mc === 'VISIT' || slot.startsWith('BEFORE_') || slot.startsWith('PICKUP_');
          })
          .map(p => ({ ...p, photo_url: p.media_url })); // Map media_url to photo_url
        const afterFromMechanic = mechanicMediaData
          .filter(p => p.media_category === 'AFTER')
          .map(p => ({ ...p, photo_url: p.media_url }));
        const duringFromMechanic = mechanicMediaData
          .filter(p => p.media_category === 'PROGRESS' || p.media_category === 'DURING')
          .map(p => ({ ...p, photo_url: p.media_url }));
        
        beforeCollected.push(...beforeFromMechanic);
        afterCollected.push(...afterFromMechanic);
        duringCollected.push(...duringFromMechanic);
      }

      // Set final de-duped lists once
      setBeforePhotos(dedupePhotos(beforeCollected));
      setAfterPhotos(dedupePhotos(afterCollected));
      setDuringPhotos(dedupePhotos(duringCollected));

      // Fetch parts used
      const { data: partsData, error: partsError } = await supabase
        .from('mechanic_parts_usage')
        .select('*')
        .eq('lead_id', jobId)
        .order('created_at', { ascending: false });

      if (!partsError && partsData) {
        setPartsUsed(partsData);
      }

      // Fetch checklist
      if (leadData?.assigned_mechanic_id) {
        const { data: checklistData, error: checklistError } = await supabase
          .from('service_checklists')
          .select('*')
          .eq('lead_id', jobId)
          .eq('mechanic_id', leadData.assigned_mechanic_id)
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
          setChecklist(items);
        }
      }
    } catch (err: any) {
      console.error('Error fetching job details:', err);
      setError(err.message);
      toast.error('Failed to load job details');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!lead) {
      toast.error('Lead data not loaded');
      return;
    }

    const advisorAnsweredAll = ADVISOR_QC_ITEMS.every(i => advisorAnswers[i.serial] === 'YES' || advisorAnswers[i.serial] === 'NO');
    const advisorProofsOk = proofRequiredSerials.every(s => {
      // Proof is required only when the answer is YES.
      if (advisorAnswers[s] !== 'YES') return true;
      return (proofUploads[s]?.length || 0) > 0;
    });
    if (!advisorAnsweredAll || !advisorProofsOk) {
      toast.error('Please complete Advisor Checklist Review (including required proof uploads) before QC.');
      setActiveTab('qc');
      return;
    }
    const anyNo = ADVISOR_QC_ITEMS.some(i => advisorAnswers[i.serial] === 'NO');
    if (anyNo) {
      toast.error('Advisor checklist has NO items. Please Reject QC instead of Approve.');
      return;
    }

    console.log('Approving QC for job:', jobId, {
      qualityScore,
      approvalNotes,
      leadStatus: lead.status,
      qcStatus: lead.qc_status
    });

    setProcessing(true);

    try {
      const response = await fetch(`/api/supervisor/jobs/${jobId}/approve-qc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: approvalNotes,
          quality_score: qualityScore,
          checklist_data: {
            advisor_review: {
              answered: advisorAnswers,
              proof_required_serials: proofRequiredSerials,
              proof_uploads: proofUploads,
              reviewed_at: new Date().toISOString(),
            },
          },
        })
      });

      const data = await response.json();
      console.log('Approve QC response:', { status: response.status, data });

      if (!response.ok) {
        const errorMsg = data.error || data.details || 'Failed to approve QC';
        console.error('QC approval failed:', { status: response.status, error: errorMsg, data });
        throw new Error(errorMsg);
      }

      toast.success('QC approved successfully!');
      router.push('/dashboard/workshop_supervisor/qc-queue');
    } catch (error: any) {
      console.error('Error approving QC:', error);
      toast.error(error.message || 'Failed to approve QC');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!lead || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    const advisorAnsweredAll = ADVISOR_QC_ITEMS.every(i => advisorAnswers[i.serial] === 'YES' || advisorAnswers[i.serial] === 'NO');
    const advisorProofsOk = proofRequiredSerials.every(s => {
      if (advisorAnswers[s] !== 'YES') return true;
      return (proofUploads[s]?.length || 0) > 0;
    });
    if (!advisorAnsweredAll || !advisorProofsOk) {
      toast.error('Please complete Advisor Checklist Review (including required proof uploads) before QC.');
      setActiveTab('qc');
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(`/api/supervisor/jobs/${jobId}/reject-qc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectionReason,
          failed_checklist_items: failedItems,
          notes: approvalNotes,
          checklist_data: {
            advisor_review: {
              answered: advisorAnswers,
              proof_required_serials: proofRequiredSerials,
              proof_uploads: proofUploads,
              reviewed_at: new Date().toISOString(),
            },
          },
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject QC');
      }

      toast.success('QC rejected - Job sent back to mechanic');
      router.push('/dashboard/workshop_supervisor/qc-queue');
    } catch (error: any) {
      console.error('Error rejecting QC:', error);
      toast.error(error.message || 'Failed to reject QC');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !lead) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-600">Error loading job details: {error}</p>
          <button onClick={() => router.back()} className="btn btn-primary mt-3">
            Go Back
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const photosTotal = beforePhotos.length + duringPhotos.length + afterPhotos.length;
  const advisorAnsweredAll = ADVISOR_QC_ITEMS.every(i => advisorAnswers[i.serial] === 'YES' || advisorAnswers[i.serial] === 'NO');
  const advisorProofsOk = proofRequiredSerials.every(s => {
    if (advisorAnswers[s] !== 'YES') return true;
    return (proofUploads[s]?.length || 0) > 0;
  });
  const advisorReviewReady = advisorMarkedReviewed && advisorAnsweredAll && advisorProofsOk;
  const advisorAnyNo = ADVISOR_QC_ITEMS.some(i => advisorAnswers[i.serial] === 'NO');
  const proofSet = new Set(proofRequiredSerials);
  const newSerialForOld = (oldSerial: number) => {
    const idx = ADVISOR_QC_ITEMS.findIndex(i => i.serial === oldSerial);
    return idx >= 0 ? idx + 1 : null;
  };
  const proofRequiredNewSerials = proofRequiredSerials
    .map(s => newSerialForOld(s))
    .filter((n): n is number => typeof n === 'number');

  const tabButtonClass = (tab: 'details' | 'photos' | 'qc') => {
    const base = 'btn !px-4 !py-2 text-sm';
    return activeTab === tab ? `${base} btn-primary` : `${base} btn-outline bg-white`;
  };

  const photoTabButtonClass = (tab: 'pickup' | 'during' | 'after') => {
    const base = 'btn !px-4 !py-2 text-sm';
    return activePhotoTab === tab ? `${base} btn-primary` : `${base} btn-outline bg-white`;
  };

  const photoUrlFor = (photo: any) => photo?.photo_url || photo?.file_url || photo?.media_url || '';

  const setAnswer = (serial: number, v: Exclude<YesNo, null>) => {
    setAdvisorAnswers(prev => ({ ...prev, [serial]: v }));
  };

  const requestProofForSerial = (serial: number) => {
    // Do not request proof for excluded items
    if ([28, 33, 34].includes(serial)) return;
    setProofRequiredSerials(prev => {
      if (prev.includes(serial)) return prev;
      if (prev.length >= 3) return prev;
      return [...prev, serial];
    });
    // Start/Restart 60s timer
    setProofExpiryAt(prev => ({ ...prev, [serial]: Date.now() + 60_000 }));
  };

  const maybeRequestProofOnYes = (serial: number) => {
    // Only ever request up to 3 proofs total
    if (proofRequiredSerials.length >= 3) return;
    if ([28, 33, 34].includes(serial)) return;
    if (proofRequiredSerials.includes(serial)) return;

    // Bias: old serial #35 is asked 80% of the time (when it is answered YES).
    if (serial === 35) {
      if (Math.random() < 0.8) requestProofForSerial(serial);
      return;
    }

    // For other items, request randomly (keeps it unpredictable), but we will fill any missing
    // requirements when user clicks "Mark as Reviewed".
    if (Math.random() < 0.25) requestProofForSerial(serial);
  };

  const addProofUrls = (serial: number, urls: string[]) => {
    setProofUploads(prev => {
      const existing = prev[serial] || [];
      const merged = Array.from(new Set([...existing, ...(urls || [])])).filter(Boolean);
      return { ...prev, [serial]: merged };
    });
  };

  const removeProofUrl = (serial: number, url: string) => {
    setProofUploads(prev => {
      const existing = prev[serial] || [];
      return { ...prev, [serial]: existing.filter(u => u !== url) };
    });
  };

  const YesNoToggle = ({ value, onChange }: { value: YesNo; onChange: (v: Exclude<YesNo, null>) => void }) => {
    // Visually default to NO even when value is null (but it won't count as answered until clicked)
    const effective = value ?? 'NO';
    const base = 'px-4 py-2 text-xs font-semibold transition';
    return (
      <div className="inline-flex rounded-lg overflow-hidden border border-gray-300 bg-white">
        <button
          type="button"
          onClick={() => onChange('NO')}
          className={`${base} ${effective === 'NO' ? 'bg-red-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          NO
        </button>
        <button
          type="button"
          onClick={() => onChange('YES')}
          className={`${base} ${effective === 'YES' ? 'bg-green-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          YES
        </button>
      </div>
    );
  };

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="btn btn-outline flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-text-heading">QC Review: {lead.lead_number}</h1>
              <p className="text-sm text-gray-600 mt-1">Review and approve completed work</p>
            </div>
          </div>
        </div>

        {/* Job Summary */}
        <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Customer</p>
              <p className="font-bold text-lg">{lead.customer_name}</p>
              <p className="text-sm text-gray-600">{lead.customer_phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Vehicle</p>
              <p className="font-bold text-lg">{lead.vehicle_number}</p>
              <p className="text-sm text-gray-600">{lead.vehicle_make} {lead.vehicle_model}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Mechanic</p>
              <p className="font-bold text-lg">{mechanic?.full_name || 'Unknown'}</p>
              {lead.mechanic_completed_at && (
                <p className="text-sm text-gray-600">
                  Completed: {formatDateTime(lead.mechanic_completed_at)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" className={tabButtonClass('details')} onClick={() => setActiveTab('details')}>
            Details
          </button>
          <button type="button" className={tabButtonClass('photos')} onClick={() => setActiveTab('photos')}>
            Photos ({photosTotal})
          </button>
          <button type="button" className={tabButtonClass('qc')} onClick={() => setActiveTab('qc')}>
            QC Decision {!advisorReviewReady && <span className="ml-2 text-xs font-semibold text-yellow-700">(Locked)</span>}
          </button>
        </div>

        {/* Tab Content: Details */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Service Details */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-3">Service Details</h3>
              <div className="space-y-2">
                {/* Display Service Types */}
                {lead.service_type_names && lead.service_type_names.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mt-2"></span>
                    <div>
                      <p className="text-gray-900 font-semibold">Service Types:</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {lead.service_type_names.map((name: string, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Display Sub-Services/Addons */}
                {lead.subservice_names && lead.subservice_names.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full mt-2"></span>
                    <div>
                      <p className="text-gray-900 font-semibold">Add-ons / Sub-Services:</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {lead.subservice_names.map((name: string, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Fallback: Display raw service_type if names not available */}
                {(!lead.service_type_names || lead.service_type_names.length === 0) && !lead.subservice_names && (
                  <p className="text-gray-700">{lead.service_type || 'General Service'}</p>
                )}
              </div>
              {lead.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-semibold text-gray-700 mb-1">Work Summary:</p>
                  <p className="text-sm text-gray-600">{lead.notes}</p>
                </div>
              )}
            </div>

            {/* Checklist */}
            {checklist.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-3">Service Checklist</h3>
                <div className="space-y-2">
                  {checklist.map((item: any, index: number) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-2 rounded ${
                        item.status === 'COMPLETED' ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      {item.status === 'COMPLETED' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                      )}
                      <span className={`flex-1 ${
                        item.status === 'COMPLETED' ? 'text-green-800' : 'text-gray-700'
                      }`}>
                        {item.name || item.item_name || `Item ${index + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parts Used */}
            {partsUsed.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Parts Used ({partsUsed.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Part Name</th>
                        <th className="text-left p-2">Part Code</th>
                        <th className="text-right p-2">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partsUsed.map((part: any) => (
                        <tr key={part.id} className="border-b">
                          <td className="p-2">{part.part_name}</td>
                          <td className="p-2 text-gray-600">{part.part_code || '-'}</td>
                          <td className="p-2 text-right">{part.quantity || 1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Photos */}
        {activeTab === 'photos' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" className={photoTabButtonClass('pickup')} onClick={() => setActivePhotoTab('pickup')}>
                Pickup/Visit ({beforePhotos.length})
              </button>
              <button type="button" className={photoTabButtonClass('during')} onClick={() => setActivePhotoTab('during')}>
                During ({duringPhotos.length})
              </button>
              <button type="button" className={photoTabButtonClass('after')} onClick={() => setActivePhotoTab('after')}>
                After ({afterPhotos.length})
              </button>
            </div>

            {/* Pickup/Visit Photos */}
            {activePhotoTab === 'pickup' && (
              <div className="card border-2 border-blue-300">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-blue-700">
                  <Camera className="w-5 h-5" />
                  Pickup/Visit Photos ({beforePhotos.length})
                </h3>
                {beforePhotos.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllBeforePhotos(v => !v)}
                    className="text-xs text-blue-700 underline mb-2"
                  >
                    {showAllBeforePhotos ? 'Show less' : 'Show all'}
                  </button>
                )}
                {beforePhotos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {(showAllBeforePhotos ? beforePhotos : beforePhotos.slice(0, 4)).map((photo: any, idx: number) => {
                      const url = photoUrlFor(photo);
                      return (
                        <div key={photo?.id || url || idx} className="relative">
                          <img
                            src={url}
                            alt="Pickup/Visit"
                            className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-90"
                            onClick={() => url && window.open(url, '_blank')}
                          />
                          <p className="text-xs text-gray-500 mt-1 truncate">{photo.photo_type}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No pickup/visit photos</p>
                  </div>
                )}
              </div>
            )}

            {/* During Photos */}
            {activePhotoTab === 'during' && (
              <div className="card border-2 border-orange-300">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-orange-700">
                  <Camera className="w-5 h-5" />
                  During Photos ({duringPhotos.length})
                </h3>
                {duringPhotos.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllDuringPhotos(v => !v)}
                    className="text-xs text-orange-700 underline mb-2"
                  >
                    {showAllDuringPhotos ? 'Show less' : 'Show all'}
                  </button>
                )}
                {duringPhotos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {(showAllDuringPhotos ? duringPhotos : duringPhotos.slice(0, 4)).map((photo: any, idx: number) => {
                      const url = photoUrlFor(photo);
                      return (
                        <div key={photo?.id || url || idx} className="relative">
                          <img
                            src={url}
                            alt="During"
                            className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-90"
                            onClick={() => url && window.open(url, '_blank')}
                          />
                          <p className="text-xs text-gray-500 mt-1 truncate">{photo.photo_type}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No during photos</p>
                  </div>
                )}
              </div>
            )}

            {/* After Photos */}
            {activePhotoTab === 'after' && (
              <div className="card border-2 border-green-300">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-green-700">
                  <Camera className="w-5 h-5" />
                  After Photos ({afterPhotos.length})
                </h3>
                {afterPhotos.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllAfterPhotos(v => !v)}
                    className="text-xs text-green-700 underline mb-2"
                  >
                    {showAllAfterPhotos ? 'Show less' : 'Show all'}
                  </button>
                )}
                {afterPhotos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {(showAllAfterPhotos ? afterPhotos : afterPhotos.slice(0, 4)).map((photo: any, idx: number) => {
                      const url = photoUrlFor(photo);
                      return (
                        <div key={photo?.id || url || idx} className="relative">
                          <img
                            src={url}
                            alt="After"
                            className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-90"
                            onClick={() => url && window.open(url, '_blank')}
                          />
                          <p className="text-xs text-gray-500 mt-1 truncate">{photo.photo_type}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No after photos</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* QC Approval Form */}
        {activeTab === 'qc' && (
        <div className="card bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
          <h3 className="text-xl font-bold mb-4 text-green-800">Quality Check Review</h3>

          {/* Advisor Checklist Review Gate */}
          <div className="mb-5 p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <ImageIcon className="w-6 h-6 text-brand-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">Advisor Checklist Review</p>
                  <p className="text-sm text-gray-600">
                    Complete YES/NO review + upload proof for <strong>3 randomly selected</strong> points.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`px-2 py-1 rounded-full font-semibold ${advisorAnsweredAll ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                      Answers: {advisorAnsweredAll ? 'Done' : 'Pending'}
                    </span>
                    <span className={`px-2 py-1 rounded-full font-semibold ${advisorProofsOk ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                      Proofs: {advisorProofsOk ? 'Done' : 'Pending'}
                    </span>
                    <span className={`px-2 py-1 rounded-full font-semibold ${advisorMarkedReviewed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                      Reviewed: {advisorMarkedReviewed ? 'Yes' : 'No'}
                    </span>
                    {advisorAnyNo && (
                      <span className="px-2 py-1 rounded-full font-semibold bg-gray-200 text-gray-800">
                        Contains NO → Approve disabled
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvisorReviewModal(true)}
                className="btn btn-outline whitespace-nowrap"
              >
                <Camera className="w-4 h-4" />
                Review Checklist
              </button>
            </div>
          </div>
          
          {/* Quality Score */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quality Score (1-5)
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  onClick={() => setQualityScore(score)}
                  className={`flex-1 py-3 rounded-lg border-2 font-semibold transition ${
                    qualityScore === score
                      ? 'border-green-600 bg-green-100 text-green-700'
                      : 'border-gray-300 hover:border-green-400'
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>

          {/* Approval Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Approval Notes (Optional)
            </label>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              rows={3}
              placeholder="Any notes or feedback..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={processing || !advisorReviewReady || advisorAnyNo}
              className="btn bg-green-600 hover:bg-green-700 text-white flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Approve QC
                </>
              )}
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={processing || !advisorReviewReady}
              className="btn bg-red-600 hover:bg-red-700 text-white flex-1 flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Reject QC
            </button>
          </div>

          {!advisorReviewReady && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ QC is locked until Advisor Checklist Review is completed (YES/NO + required proof uploads).
              </p>
            </div>
          )}

          {(beforePhotos.length === 0 || afterPhotos.length === 0) && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Missing photos: Pickup/Visit ({beforePhotos.length}), After ({afterPhotos.length})
              </p>
            </div>
          )}
        </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4 text-red-600">Reject Quality Check</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleReject}
                  disabled={processing || !rejectionReason.trim()}
                  className="btn bg-red-600 hover:bg-red-700 text-white flex-1"
                >
                  {processing ? 'Rejecting...' : 'Reject & Send Back'}
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                    setFailedItems([]);
                  }}
                  disabled={processing}
                  className="btn btn-outline flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Advisor Review Modal */}
        {showAdvisorReviewModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-text-heading">Advisor Checklist Review</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Answer all items (YES/NO). Proof is required for <strong>3</strong> random points.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAdvisorReviewModal(false)}
                >
                  Close
                </button>
              </div>

              {/* Proof Required Summary */}
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  Proof will be requested <strong>randomly when you select YES</strong> (total 3 points).
                </p>
              </div>

              {/* Questions */}
              <div className="space-y-3">
                {ADVISOR_QC_ITEMS.map((item, idx) => (
                  <div key={item.serial} className="p-4 border border-gray-200 rounded-lg bg-white">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-gray-800">{idx + 1}.</span>
                          <span className="text-sm font-semibold text-gray-800">{item.question}</span>
                          {proofSet.has(item.serial) && (
                            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                              Proof Required
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <YesNoToggle
                            value={advisorAnswers[item.serial]}
                            onChange={(v) => {
                              setAnswer(item.serial, v);
                              if (v === 'YES') {
                                maybeRequestProofOnYes(item.serial);
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Proof upload area */}
                    {proofSet.has(item.serial) && advisorAnswers[item.serial] === 'YES' && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-gray-800">Upload proof photos</p>
                          <span className={`text-xs font-semibold ${((proofUploads[item.serial]?.length || 0) > 0) ? 'text-green-700' : 'text-red-600'}`}>
                            {(proofUploads[item.serial]?.length || 0) > 0 ? 'Uploaded' : 'Required'}
                          </span>
                        </div>

                        {(() => {
                          const expiry = proofExpiryAt[item.serial] || 0;
                          const remaining = Math.max(0, Math.ceil((expiry - nowTick) / 1000));
                          const expired = expiry > 0 && remaining === 0 && (proofUploads[item.serial]?.length || 0) === 0;
                          if (!expiry) return null;
                          return (
                            <div className="mt-2 flex items-center justify-between gap-3">
                              {!expired ? (
                                <p className="text-xs text-gray-600">
                                  Time left to upload: <strong>{remaining}s</strong>
                                </p>
                              ) : (
                                <p className="text-xs text-red-600 font-semibold">
                                  Time over. Please retry to continue uploading.
                                </p>
                              )}
                              {expired && (
                                <button
                                  type="button"
                                  className="btn btn-outline !px-3 !py-2 text-xs"
                                  onClick={() => requestProofForSerial(item.serial)}
                                >
                                  Retry
                                </button>
                              )}
                            </div>
                          );
                        })()}

                        {(proofUploads[item.serial]?.length || 0) > 0 && (
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-2">
                            {(proofUploads[item.serial] || []).map((u) => (
                              <div key={u} className="relative group">
                                <img src={u} alt="Proof" className="w-full h-16 object-cover rounded border" />
                                <button
                                  type="button"
                                  className="absolute top-1 right-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition"
                                  onClick={() => removeProofUrl(item.serial, u)}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {(() => {
                          const expiry = proofExpiryAt[item.serial] || 0;
                          const remaining = Math.max(0, Math.ceil((expiry - nowTick) / 1000));
                          const expired = expiry > 0 && remaining === 0 && (proofUploads[item.serial]?.length || 0) === 0;
                          if (expired) return null;
                          return (
                            <div className="mt-3">
                              <PhotoUpload
                                label={`Proof for point #${idx + 1}`}
                                maxPhotos={3}
                                uploadEndpoint={`/api/leads/${jobId}/upload-qc-proof`}
                                extraFormFields={{ point: String(idx + 1), serial: String(item.serial) }}
                                onUpload={(urls) => addProofUrls(item.serial, urls)}
                                required
                              />
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Status: <strong>{advisorAnsweredAll && advisorProofsOk ? 'Ready' : 'Incomplete'}</strong>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowAdvisorReviewModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!(advisorAnsweredAll && advisorProofsOk)}
                    onClick={() => {
                      // Ensure we ended up with 3 proof points (chosen only among YES answers, excluding 28/33/34)
                      const excluded = new Set([28, 33, 34]);
                      const yesSerials = ADVISOR_QC_ITEMS
                        .map(i => i.serial)
                        .filter(s => advisorAnswers[s] === 'YES' && !excluded.has(s));
                      let required = [...proofRequiredSerials];

                      // Prefer 35 with 80% probability if eligible and not already required
                      if (yesSerials.includes(35) && !required.includes(35) && required.length < 3 && Math.random() < 0.8) {
                        required = [...required, 35];
                        requestProofForSerial(35);
                      }

                      // Fill remaining slots randomly from YES answers
                      const candidates = yesSerials.filter(s => !required.includes(s));
                      while (required.length < 3 && candidates.length > 0) {
                        const pick = candidates[Math.floor(Math.random() * candidates.length)];
                        required = [...required, pick];
                        requestProofForSerial(pick);
                        candidates.splice(candidates.indexOf(pick), 1);
                      }

                      // Block close if any required YES item still missing uploads (after filling)
                      const finalRequired = Array.from(new Set(required)).slice(0, 3);
                      const finalProofsOk = finalRequired.every(s => {
                        if (advisorAnswers[s] !== 'YES') return true;
                        return (proofUploads[s]?.length || 0) > 0;
                      });
                      if (!finalProofsOk || !(advisorAnsweredAll && advisorProofsOk)) {
                        toast.error('Please upload proof for the requested YES points.');
                        return;
                      }

                      setAdvisorMarkedReviewed(true);
                      setShowAdvisorReviewModal(false);
                      toast.success('Advisor checklist review completed');
                    }}
                  >
                    Mark as Reviewed
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

