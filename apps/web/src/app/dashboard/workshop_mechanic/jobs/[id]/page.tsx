'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateTime } from '@/lib/utils';
import {
  ArrowLeft, PlayCircle, PauseCircle, CheckCircle, Camera, 
  Package, AlertTriangle, MessageSquare, FileText, Clock,
  Upload, X, Save, Send, RefreshCw
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import DuringServiceUpload from '@/components/mechanic/DuringServiceUpload';
import AfterServiceUpload from '@/components/mechanic/AfterServiceUpload';
import PartsUsedUpload from '@/components/mechanic/PartsUsedUpload';
import { getStatusColor as getLeadStatusColor, getStatusLabel as getLeadStatusLabel } from '@/lib/services/leadStatusService';

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
  lead_status: string;
  qc_status?: string;
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

type AdditionalMasterItem = {
  id: string;
  name: string;
  category: string | null;
  oem_price?: number | null;
  workshop_id?: string | null;
};

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
  const [extraWorkCompletionRemarkById, setExtraWorkCompletionRemarkById] = useState<Record<string, string>>({});
  const [completingExtraWorkById, setCompletingExtraWorkById] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeChecklistItem, setActiveChecklistItem] = useState<string | null>(null);
  
  // Form states
  const [workNotes, setWorkNotes] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('PROGRESS');
  const [selectedPhotoType, setSelectedPhotoType] = useState<string>('');
  // Additional jobs request is handled inline in the "Additional Jobs" tab
  const [extraWorkForm, setExtraWorkForm] = useState({
    issue_description: '',
    additional_work_required: '',
    estimated_cost: ''
  });
  const [additionalMasterItems, setAdditionalMasterItems] = useState<AdditionalMasterItem[]>([]);
  const [additionalMasterLoading, setAdditionalMasterLoading] = useState(false);
  const [additionalMasterQuery, setAdditionalMasterQuery] = useState('');
  const [additionalMasterCategory, setAdditionalMasterCategory] = useState<string>('');
  // Mechanic selection: only selected jobs should be shown (not the full master list)
  const [selectedAdditionalJobIds, setSelectedAdditionalJobIds] = useState<string[]>([]);
  const [rowPriority, setRowPriority] = useState<Record<string, 'HIGH' | 'MEDIUM' | 'LOW'>>({});
  const [rowNote, setRowNote] = useState<Record<string, string>>({});
  const [rowCost, setRowCost] = useState<Record<string, string>>({});
  const [submittingJobIds, setSubmittingJobIds] = useState<Record<string, boolean>>({});
  const [zoomedMedia, setZoomedMedia] = useState<MediaItem | null>(null);
  const [beforePhotoTypes, setBeforePhotoTypes] = useState<string[]>([]);
  const [missingBeforePhotos, setMissingBeforePhotos] = useState<string[]>([]);
  const [serviceTypeNames, setServiceTypeNames] = useState<string[]>([]);
  const [serviceAddonNames, setServiceAddonNames] = useState<string[]>([]);
  const [supervisorObservation, setSupervisorObservation] = useState<{
    text: string;
    updatedAt: string | null;
    byName: string | null;
  }>({ text: '', updatedAt: null, byName: null });

  // Prevent "stuck loading" on first navigation by timing out long awaits
  const fetchSeqRef = useRef(0);

  const hasCustomService = useMemo(() => {
    const fromNames = (serviceTypeNames || []).map((s) => String(s || '').toLowerCase());
    const fromJob = (job?.service_types || []).map((s) => String(s || '').toLowerCase());
    const all = fromNames.length ? fromNames : fromJob;
    return all.some((s) => s.includes('custom'));
  }, [serviceTypeNames, job?.service_types]);

  const withTimeout = async <T,>(p: Promise<T>, ms: number, label: string): Promise<T> => {
    return await new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms);
      p.then((v) => {
        clearTimeout(t);
        resolve(v);
      }).catch((e) => {
        clearTimeout(t);
        reject(e);
      });
    });
  };

  useEffect(() => {
    if (leadId) {
      fetchJobDetails({ silent: false });

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
            fetchJobDetails({ silent: true });
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
            fetchJobDetails({ silent: true });
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
            // If status changed to IN_PROGRESS (sent back), refresh immediately
            if (payload.new && payload.new.status === 'IN_PROGRESS') {
              fetchJobDetails({ silent: true });
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
            fetchJobDetails({ silent: true });
          }
        )
        .subscribe((status) => {
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

  useEffect(() => {
    if (activeTab === 'extra-work') {
      // In-tab checklist: load master list (best-effort)
      fetchAdditionalJobsMaster().catch(() => {});
    } else {
      setAdditionalMasterQuery('');
      setAdditionalMasterCategory('');
      setSelectedAdditionalJobIds([]);
      setRowPriority({});
      setRowNote({});
      setRowCost({});
      setSubmittingJobIds({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function getMechanicProfileForWorkshop(supabase: ReturnType<typeof createClient>, user: any) {
    const email = (user?.email || '').trim();
    const phone = (user?.phone || '').trim();

    const selectProfile = 'id, email, phone, workshop_id';
    const { data: byEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null };
    const { data: byPhone } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null };

    return (byEmail || byPhone) as { id: string; workshop_id: string | null } | null;
  }

  async function fetchAdditionalJobsMaster() {
    try {
      setAdditionalMasterLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profile = await getMechanicProfileForWorkshop(supabase, user);
      const workshopId = profile?.workshop_id || null;

      let query = supabase
        .from('additional_jobs_master')
        .select('id, name, category, oem_price, workshop_id')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('category', { ascending: true })
        .order('name', { ascending: true })
        .limit(500);

      if (workshopId) {
        // show workshop-wise + global
        query = query.or(`workshop_id.eq.${workshopId},workshop_id.is.null`);
      } else {
        query = query.is('workshop_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Prefer workshop-specific rows if name collides with global seed
      const byName = new Map<string, AdditionalMasterItem>();
      const list = (data || []) as AdditionalMasterItem[];
      for (const it of list) {
        const key = (it.name || '').trim().toLowerCase();
        const existing = byName.get(key);
        if (!existing) {
          byName.set(key, it);
          continue;
        }
        // prefer workshop_id-specific over global
        if (!existing.workshop_id && it.workshop_id) {
          byName.set(key, it);
        }
      }

      setAdditionalMasterItems(Array.from(byName.values()));
    } catch (e) {
      console.error('Failed to fetch additional jobs master:', e);
      setAdditionalMasterItems([]);
    } finally {
      setAdditionalMasterLoading(false);
    }
  }

  const additionalMasterCategories = useMemo(() => {
    const set = new Set<string>();
    for (const it of additionalMasterItems) {
      const c = (it.category || '').trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [additionalMasterItems]);

  const filteredAdditionalMasterItems = useMemo(() => {
    const q = additionalMasterQuery.trim().toLowerCase();
    return additionalMasterItems
      .filter((it) => {
        if (additionalMasterCategory && (it.category || '').trim() !== additionalMasterCategory) return false;
        if (!q) return true;
        return (
          (it.name || '').toLowerCase().includes(q) ||
          (it.category || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 120);
  }, [additionalMasterCategory, additionalMasterItems, additionalMasterQuery]);

  const selectedAdditionalItems = useMemo(() => {
    const byId = new Map<string, AdditionalMasterItem>();
    for (const it of additionalMasterItems) byId.set(it.id, it);
    return selectedAdditionalJobIds.map((id) => byId.get(id)).filter(Boolean) as AdditionalMasterItem[];
  }, [additionalMasterItems, selectedAdditionalJobIds]);

  const searchResults = useMemo(() => {
    const selected = new Set(selectedAdditionalJobIds);
    return filteredAdditionalMasterItems.filter((it) => !selected.has(it.id)).slice(0, 20);
  }, [filteredAdditionalMasterItems, selectedAdditionalJobIds]);

  function addSelectedAdditionalJob(it: AdditionalMasterItem) {
    setSelectedAdditionalJobIds((prev) => (prev.includes(it.id) ? prev : [...prev, it.id]));
    // Default row values
    setRowPriority((p) => (p[it.id] ? p : { ...p, [it.id]: 'MEDIUM' }));
  }

  function removeSelectedAdditionalJob(id: string) {
    setSelectedAdditionalJobIds((prev) => prev.filter((x) => x !== id));
    setRowPriority((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
    setRowNote((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
    setRowCost((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
    setSubmittingJobIds((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
  }

  async function submitSingleAdditionalJob(it: AdditionalMasterItem) {
    const priority = rowPriority[it.id] || 'MEDIUM';
    const note = (rowNote[it.id] || '').trim();
    if (priority === 'HIGH' && !note) {
      alert('High priority selected. Please add a note.');
      return;
    }

    const costStr = (rowCost[it.id] || '').trim();
    const fallbackCost = it.oem_price && Number(it.oem_price) > 0 ? Number(it.oem_price) : 0;
    const cost = costStr ? Number.parseFloat(costStr) : fallbackCost;

    try {
      setSubmittingJobIds((p) => ({ ...p, [it.id]: true }));
      const priorityLine = `Priority: ${priority}`;
      const noteLine = note ? `Note: ${note}` : '';
      const reason = [priorityLine, noteLine].filter(Boolean).join('\n');

      const res = await fetch(`/api/mechanic/jobs/${leadId}/request-extra-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: it.name,
          reason,
          estimated_cost: Number.isFinite(cost) ? cost : 0,
          category: 'ADDITIONAL_JOB',
          is_urgent: priority === 'HIGH',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed');

      // Clear row inputs after submit
      setRowPriority((p) => {
        const next = { ...p };
        delete next[it.id];
        return next;
      });
      setRowNote((p) => {
        const next = { ...p };
        delete next[it.id];
        return next;
      });
      setRowCost((p) => {
        const next = { ...p };
        delete next[it.id];
        return next;
      });

      await fetchJobDetails();
      // Advisor/Supervisor will see immediately via their listing; mechanic sees it below in requests list.
      alert('Request submitted!');
      // Remove from selected list after successful submit
      setSelectedAdditionalJobIds((prev) => prev.filter((x) => x !== it.id));
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Failed'}`);
    } finally {
      setSubmittingJobIds((p) => ({ ...p, [it.id]: false }));
    }
  }

  async function submitSelectedAdditionalJobs() {
    const selected = selectedAdditionalItems;
    if (!selected.length) {
      alert('Please add at least 1 additional job first.');
      return;
    }

    // Validate: High priority requires note
    for (const it of selected) {
      const pr = rowPriority[it.id] || 'MEDIUM';
      const note = (rowNote[it.id] || '').trim();
      if (pr === 'HIGH' && !note) {
        alert(`High priority selected for "${it.name}". Please add a note.`);
        return;
      }
    }

    try {
      // Mark all rows busy
      setSubmittingJobIds((p) => {
        const next = { ...p };
        for (const it of selected) next[it.id] = true;
        return next;
      });

      const results = await Promise.all(
        selected.map(async (it) => {
          const priority = rowPriority[it.id] || 'MEDIUM';
          const note = (rowNote[it.id] || '').trim();
          const priorityLine = `Priority: ${priority}`;
          const noteLine = note ? `Note: ${note}` : '';
          const reason = [priorityLine, noteLine].filter(Boolean).join('\n');

          // Cost hidden in UI: default to master OEM price (or 0)
          const costNum = it.oem_price && Number(it.oem_price) > 0 ? Number(it.oem_price) : 0;

          const res = await fetch(`/api/mechanic/jobs/${leadId}/request-extra-work`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: it.name,
              reason,
              estimated_cost: Number.isFinite(costNum) ? costNum : 0,
              category: 'ADDITIONAL_JOB',
              is_urgent: priority === 'HIGH',
            }),
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, error: data?.error, id: it.id };
        })
      );

      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        alert(failed[0]?.error || `Failed to submit ${failed.length} request(s).`);
        return;
      }

      // Clear selection + inputs
      setSelectedAdditionalJobIds([]);
      setRowPriority({});
      setRowNote({});
      setRowCost({});

      await fetchJobDetails();
      alert('Requests submitted!');
    } finally {
      // Clear busy flags
      setSubmittingJobIds({});
    }
  }

  async function fetchJobDetails(opts?: { silent?: boolean }) {
    const silent = opts?.silent ?? true;
    const runId = ++fetchSeqRef.current;
    const supabase = createClient();

    if (!silent && !job) setLoading(true);

    const run = async () => {
      
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
            vehicle_year,
            vehicle_odometer,
            vehicle_fuel_type,
            problem_description,
            service_type_ids,
            subservice_ids,
            status,
            qc_status,
            supervisor_observation,
            supervisor_observation_updated_at,
            supervisor_observation_by_user:supervisor_observation_by(full_name)
          )
        `)
        .eq('lead_id', leadId)
        // Avoid 406 on first open if row isn't visible yet
        .maybeSingle();

      if (jobError) {
        console.error('Error fetching job from mechanic_jobs:', jobError);
      }


      if (jobData) {
        const vehicleYear = Number((jobData.service_leads as any)?.vehicle_year ?? 0) || 0;

        // Odometer: prefer service_leads.vehicle_odometer, fallback to legacy/pickup tracking
        let odometerReading = Number((jobData.service_leads as any)?.vehicle_odometer ?? 0) || 0;
        if (odometerReading <= 0) {
          // 1) Legacy column on service_leads (schema varies, so guard)
          try {
            const { data } = await supabase
              .from('service_leads')
              .select('odometer_km')
              .eq('id', leadId)
              .maybeSingle();
            const legacy = Number((data as any)?.odometer_km ?? 0) || 0;
            if (legacy > 0) odometerReading = legacy;
          } catch {
            // ignore (missing column/table)
          }

          // 2) Pickup tracking odometer
          if (odometerReading <= 0) {
            try {
              const { data: tracking } = await supabase
                .from('pickup_tracking')
                .select('pickup_odometer_reading')
                .eq('lead_id', leadId)
                .maybeSingle();
              const picked = Number((tracking as any)?.pickup_odometer_reading ?? 0) || 0;
              if (picked > 0) odometerReading = picked;
            } catch {
              // ignore
            }
          }
        }

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
          vehicle_year: vehicleYear,
          odometer_reading: odometerReading,
          fuel_type: jobData.service_leads?.vehicle_fuel_type || '',
          problem_description: jobData.service_leads?.problem_description || '',
          service_types: serviceTypeIds,
          mechanic_status: jobData.mechanic_status,
          lead_status: jobData.service_leads?.status || '',
          qc_status: jobData.service_leads?.qc_status || undefined,
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

        // Supervisor/Advisor Observation (read-only for mechanic)
        setSupervisorObservation({
          text: String(jobData.service_leads?.supervisor_observation || ''),
          updatedAt: (jobData.service_leads as any)?.supervisor_observation_updated_at || null,
          byName: (jobData.service_leads as any)?.supervisor_observation_by_user?.full_name || null,
        });
        
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
          // REMOVED: Auto-activate first incomplete category
          // User requirement: Initially ALL categories should be open (no blur)
          // Category becomes active only when first checkbox is ticked
          // const firstIncompleteCategory = categories.find((cat: string) => {
          //   const categoryItems = items.filter((item: ChecklistItem) => item.category === cat);
          //   return categoryItems.some((item: ChecklistItem) => item.status !== 'COMPLETED');
          // });
          // if (firstIncompleteCategory && !activeCategory) {
          //   setActiveCategory(firstIncompleteCategory);
          // }
        } else {
          
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
                      
                      // REMOVED: Auto-set active category
                      // User requirement: Initially ALL categories should be open (no blur)
                      // Category becomes active only when first checkbox is ticked
                      // const categories = Array.from(new Set(items.map((item: ChecklistItem) => item.category).filter(Boolean))) as string[];
                      // const firstIncompleteCategory = categories.find((cat: string) => {
                      //   const categoryItems = items.filter((item: ChecklistItem) => item.category === cat);
                      //   return categoryItems.some((item: ChecklistItem) => item.status !== 'COMPLETED');
                      // });
                      // if (firstIncompleteCategory && !activeCategory) {
                      //   setActiveCategory(firstIncompleteCategory);
                      // }
                      return; // Exit early since we got the checklist
                    } else {
                      // If checklist was created but has no items, wait a bit and refetch
                      setTimeout(() => {
                        fetchJobDetails();
                      }, 1000);
                    }
                  } else {
                    // If checklist already exists or backend returned success without checklist, don't spam logs.
                    if (!response.ok) {
                      console.error('Error generating checklist:', result.error, result.details);
                    }
                    // Don't retry automatically - let user click the button manually
                  }
                } catch (error) {
                  console.error('Error calling generate-checklist API:', error);
                }
              } else {
              }
            } catch (error) {
              console.error('Error in auto-generate checklist:', error);
            }
          } else {
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

        const requiredTypes = ['BEFORE_FRONT', 'BEFORE_REAR', 'BEFORE_LEFT', 'BEFORE_RIGHT', 'BEFORE_DASHBOARD', 'BEFORE_ENGINE_BAY'];
        const uploadedFromJob = (beforePhotos || []).map((p: any) => String(p.photo_type || '').toUpperCase()).filter(Boolean);

        // Also consider supervisor/pickup uploads stored in lead_media (Pickup/Visit)
        let uploadedFromLead: string[] = [];
        try {
          const res = await fetch(`/api/leads/${leadId}/media`, { method: 'GET' });
          const data = await res.json().catch(() => ({}));
          const media = Array.isArray(data?.media) ? data.media : [];
          uploadedFromLead = media
            .map((m: any) => {
              const t = String(m?.photo_type || m?.category || '').toUpperCase().trim();
              if (t) return t;
              const fn = String(m?.file_name || '');
              const mm = fn.match(/^(BEFORE_[A-Z0-9_]+)__+/);
              if (mm?.[1]) return (mm[1] || '').toUpperCase();
              const url = String(m?.file_url || '');
              const mu = url.match(/(BEFORE_[A-Z0-9_]+)_\d{4,}/);
              return (mu?.[1] || '').toUpperCase();
            })
            .filter((t: string) => requiredTypes.includes(t));
        } catch {
          uploadedFromLead = [];
        }

        const combinedSet = new Set<string>([...uploadedFromJob, ...uploadedFromLead]);
        const combinedUploadedTypes = Array.from(combinedSet);
        setBeforePhotoTypes(combinedUploadedTypes);

        const missing = requiredTypes.filter((type) => !combinedSet.has(type));
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
            // Count required slots satisfied (max 6), so UI shows 6/6 when lead_media has them
            before_images_count: requiredTypes.filter((t) => combinedSet.has(t)).length,
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

      // Get additional job requests
      // NOTE: Requests are stored in `lead_extra_charges` (approved/rejected by supervisor/admin).
      // The previous `mechanic_extra_work_requests` source caused "Additional Jobs" to not show.
      const { data: extraWorkData, error: extraWorkError } = await supabase
        .from('lead_extra_charges')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (extraWorkError) {
        console.error('Extra work error:', extraWorkError);
      }

      setExtraWorkRequests(extraWorkData || []);
    };

    try {
      // Hard guard: never keep spinner forever (first-open sometimes hangs until refresh)
      await withTimeout(run(), 12000, 'fetchJobDetails');
    } catch (error) {
      console.error('Error fetching job details:', error);
      // If mechanic_jobs row is created asynchronously right after lead creation, do one quick retry.
      if (!silent && !job) {
        setTimeout(() => {
          if (runId === fetchSeqRef.current) fetchJobDetails({ silent: true });
        }, 800);
      }
    } finally {
      if (!silent && runId === fetchSeqRef.current) setLoading(false);
    }
  }

  async function updateJobStatus(newStatus: string) {
    
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
      
      // Refresh job details to show updates
      await fetchJobDetails();
      alert(`Job status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating job status:', error);
      alert('Failed to update job status. Please try again.');
    }
  }

  async function markExtraWorkCompleted(extraWorkId: string) {
    if (!leadId) return;
    const remark = String(extraWorkCompletionRemarkById[extraWorkId] || '').trim();
    try {
      setCompletingExtraWorkById((p) => ({ ...p, [extraWorkId]: true }));
      const res = await fetch(`/api/mechanic/jobs/${leadId}/extra-work/${extraWorkId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(String(data?.error || data?.details || 'Failed to mark completed'));
        return;
      }

      // Refresh list (silent)
      await fetchJobDetails({ silent: true });
    } catch (e: any) {
      alert(e?.message || 'Failed to mark completed');
    } finally {
      setCompletingExtraWorkById((p) => ({ ...p, [extraWorkId]: false }));
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
        const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB (videos can be large)
        if (file.size > MAX_FILE_SIZE) {
          const mb = (file.size / (1024 * 1024)).toFixed(2);
          alert(`File ${file.name} is too large (${mb}MB). Maximum size is 100MB.`);
          continue;
        }

        // Upload to storage
        const fileExt = file.name.split('.').pop() || (file.type.startsWith('image') ? 'jpg' : 'mp4');
        const safeCategory = String(selectedCategory || 'OTHER').replace(/[^A-Z0-9_]+/gi, '_');
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `mechanic_media/${leadId}/${safeCategory}/${fileName}`;

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
      // allow re-selecting same file(s)
      event.target.value = '';
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
      alert('Work notes saved successfully!');
    } catch (error) {
      console.error('Error saving work notes:', error);
      alert('Failed to save work notes. Please try again.');
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
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!job) {
    return (
      <DashboardLayout role="workshop_mechanic">
        <div className="text-center py-8 sm:py-10 md:py-12 px-3 sm:px-4">
          <p className="text-gray-500 text-base sm:text-lg md:text-xl mb-1.5 sm:mb-2">Job not found</p>
          <p className="text-xs sm:text-sm text-gray-400 mb-2 sm:mb-3 md:mb-4">Lead ID: {leadId}</p>
          <p className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">
            Check console for details or verify the mechanic_jobs entry exists for this lead.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
            <button onClick={() => router.back()} className="btn btn-primary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
              Go Back
            </button>
            <button 
              onClick={() => window.location.reload()} 
              className="btn btn-outline text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
            >
              Refresh Page
            </button>
          </div>
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

  const getMechanicStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        // Mechanic-side "completed" means work submitted for QC, not end-to-end completion.
        return 'Work Submitted (QC Pending)';
      case 'WAITING_APPROVAL':
        return 'Need Approval';
      default:
        return status.replace(/_/g, ' ');
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

  const pendingExtraWorkCount = extraWorkRequests.filter((r: any) => r?.status === 'PENDING').length;
  const latestExtraWorkStatus = extraWorkRequests[0]?.status as string | undefined;

  return (
    <DashboardLayout role="workshop_mechanic">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
            <button onClick={() => router.back()} className="btn btn-outline p-1.5 sm:p-2 flex-shrink-0">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">{job.lead_number}</h1>
              <p className="text-gray-600 text-xs sm:text-sm">Job Details</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {/* Show mechanic status if available; otherwise fall back to lead status */}
            {job.mechanic_status ? (
              <span
                className={`px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm ${getStatusColor(
                  job.mechanic_status
                )}`}
                title={job.qc_status ? `QC: ${job.qc_status}` : undefined}
              >
                {getMechanicStatusLabel(job.mechanic_status)}
              </span>
            ) : job.lead_status ? (
              <span
                className={[
                  'px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm border',
                  getLeadStatusColor(job.lead_status).bg,
                  getLeadStatusColor(job.lead_status).text,
                  getLeadStatusColor(job.lead_status).border,
                ].join(' ')}
                title={job.qc_status ? `QC: ${job.qc_status}` : undefined}
              >
                {getLeadStatusLabel(job.lead_status)}
              </span>
            ) : null}
            {job.job_priority !== 'NORMAL' && (
              <span className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg font-semibold bg-red-100 text-red-800 border border-red-300 text-xs sm:text-sm">
                {job.job_priority}
              </span>
            )}
          </div>
        </div>

        {/* SLA Timer */}
        <div className="card bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-500 p-3 sm:p-4 md:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Clock className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-orange-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">SLA Remaining</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold">
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
            <div className="text-left sm:text-right w-full sm:w-auto">
              <p className="text-xs sm:text-sm text-gray-600">Expected Completion</p>
              <p className="font-semibold text-xs sm:text-sm">
                {job.expected_completion_time ? (
                  formatDateTime(job.expected_completion_time)
                ) : (
                  <span className="text-gray-500">Not set</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {canStartJob && (
            <button 
              onClick={async () => {
                // Always call updateJobStatus - it will validate and show proper error
                await updateJobStatus('IN_PROGRESS');
              }}
              className="btn bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
            >
              <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Start Job</span>
              <span className="sm:hidden">Start</span>
            </button>
          )}
          
          {job.mechanic_status === 'IN_PROGRESS' && (
            <>
              <button 
                onClick={() => updateJobStatus('HOLD')}
                className="btn btn-outline flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
              >
                <PauseCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Put on Hold</span>
                <span className="sm:hidden">Hold</span>
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
                      const ok = window.confirm('Are you sure you want to mark this job as complete?');
                      if (!ok) return;
                      updateJobStatus('COMPLETED');
                    }
                  }}
                  className={`btn text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 ${
                    job.checklist_completed && job.after_images_count >= job.min_after_images
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-gray-400 hover:bg-gray-500 cursor-not-allowed'
                  }`}
                  disabled={!job.checklist_completed || job.after_images_count < job.min_after_images}
                >
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">
                    {!job.checklist_completed 
                      ? 'Complete Checklist First'
                      : job.after_images_count < job.min_after_images
                      ? `Complete (${job.after_images_count}/${job.min_after_images} photos)`
                      : 'Mark Completed'}
                  </span>
                  <span className="sm:hidden">Complete</span>
                </button>
              )}
            </>
          )}

          {job.mechanic_status === 'HOLD' && (
            <button 
              onClick={() => updateJobStatus('IN_PROGRESS')}
              className="btn bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
            >
              <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Resume Job</span>
              <span className="sm:hidden">Resume</span>
            </button>
          )}

          <button 
            onClick={() => {
              setActiveTab('extra-work');
              setTimeout(() => {
                document.getElementById('extra-work-request-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 0);
            }}
            className="btn bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
          >
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Request Additional Job</span>
            <span className="sm:hidden">Additional Jobs</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between gap-2">
            <div className="overflow-x-auto">
          <div className="flex gap-2 sm:gap-3 md:gap-4 min-w-max">
            {([
              { key: 'overview', label: 'Overview' },
              { key: 'checklist', label: 'Checklist' },
              { key: 'media', label: 'Media' },
              { key: 'parts', label: 'Parts' },
              { key: 'notes', label: 'Notes' },
              { key: 'supervisor-observation', label: 'Supervisor Observation' },
              { key: 'extra-work', label: 'Additional Jobs' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 font-medium border-b-2 transition whitespace-nowrap text-xs sm:text-sm ${
                  activeTab === tab.key
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>{tab.label}</span>
                {tab.key === 'extra-work' && pendingExtraWorkCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold border border-orange-200">
                    {pendingExtraWorkCount}
                  </span>
                )}
              </button>
            ))}
              </div>
            </div>

            {/* Additional job requested indicator (shows when mechanic has submitted a request) */}
            {extraWorkRequests.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('extra-work');
                  // allow tab content to render, then scroll
                  setTimeout(() => {
                    document.getElementById('extra-work-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 0);
                }}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold border whitespace-nowrap ${
                  pendingExtraWorkCount > 0
                    ? 'bg-orange-50 text-orange-800 border-orange-200'
                    : 'bg-green-50 text-green-800 border-green-200'
                }`}
                title="Scroll to additional job requests"
              >
                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {pendingExtraWorkCount > 0
                  ? `Additional Jobs Pending (${pendingExtraWorkCount})`
                  : `Additional Jobs: ${String(latestExtraWorkStatus || 'UPDATED')}`}
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
            {/* Job Summary */}
            <div className="card p-3 sm:p-4 md:p-5">
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Job Summary</h2>
              <div className="space-y-2 sm:space-y-3">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Assigned At</p>
                  <p className="font-semibold text-xs sm:text-sm">{formatDateTime(job.assigned_at)}</p>
                </div>
                {job.started_at && (
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Started At</p>
                    <p className="font-semibold text-xs sm:text-sm">{formatDateTime(job.started_at)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Service Types</p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1">
                    {serviceTypeNames.length > 0 ? (
                      serviceTypeNames.map((name, idx) => (
                        <span key={idx} className="px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 text-blue-800 rounded-full text-xs sm:text-sm">
                          {name}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 text-xs sm:text-sm">No service types</span>
                    )}
                  </div>
                </div>
                {serviceAddonNames.length > 0 && (
                  <div className="mt-2 sm:mt-3">
                    <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">Service Addons</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {serviceAddonNames.map((name, idx) => (
                        <span key={idx} className="px-2 sm:px-3 py-0.5 sm:py-1.5 bg-green-100 text-green-800 rounded-full text-xs sm:text-sm font-medium border border-green-200">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Customer & Vehicle */}
            <div className="card p-3 sm:p-4 md:p-5">
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Customer & Vehicle</h2>
              <div className="space-y-2 sm:space-y-3">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Customer</p>
                  <p className="font-semibold text-xs sm:text-sm">{job.customer_name}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Vehicle</p>
                  <p className="font-semibold text-xs sm:text-sm">{job.vehicle_number}</p>
                  <p className="text-xs sm:text-sm">{job.vehicle_make} {job.vehicle_model} {job.vehicle_variant}</p>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Year: {job.vehicle_year || '—'} | Fuel: {job.fuel_type || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Odometer Reading</p>
                  <p className="font-semibold text-xs sm:text-sm">
                    {job.odometer_reading > 0 ? `${job.odometer_reading.toLocaleString()} km` : '—'}
                  </p>
                </div>
                {job.problem_description && (
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Customer Complaint</p>
                    <p className="text-xs sm:text-sm bg-yellow-50 p-2 sm:p-3 rounded border border-yellow-200">{job.problem_description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Status */}
            <div className="card col-span-full p-3 sm:p-4 md:p-5">
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Progress Status</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
                <div className="text-center p-3 sm:p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
                  <Camera className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 mx-auto mb-1.5 sm:mb-2 text-yellow-600" />
                  <p className="text-xs sm:text-sm text-gray-600">Progress Images</p>
                  <p className="text-xl sm:text-2xl font-bold text-yellow-700">
                    {job.progress_images_count}
                  </p>
                </div>
                <div className={`text-center p-3 sm:p-4 rounded-lg border-2 ${
                  job.after_images_count >= job.min_after_images 
                    ? 'bg-green-50 border-green-300' 
                    : 'bg-green-50 border-green-300'
                }`}>
                  <Camera className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 mx-auto mb-1.5 sm:mb-2 text-green-600" />
                  <p className="text-xs sm:text-sm text-gray-600">After Images</p>
                  <p className={`text-xl sm:text-2xl font-bold ${
                    job.after_images_count >= job.min_after_images ? 'text-green-700' : 'text-green-700'
                  }`}>
                    {job.after_images_count}
                  </p>
                </div>
                <div className={`text-center p-3 sm:p-4 rounded-lg border-2 sm:col-span-2 md:col-span-1 ${
                  job.checklist_completed 
                    ? 'bg-green-50 border-green-300' 
                    : 'bg-purple-50 border-purple-300'
                }`}>
                  <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 mx-auto mb-1.5 sm:mb-2 text-purple-600" />
                  <p className="text-xs sm:text-sm text-gray-600">Checklist</p>
                  <p className={`text-xl sm:text-2xl font-bold ${
                    job.checklist_completed ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {job.checklist_completed ? '✓' : '✗'}
                  </p>
                </div>
              </div>

              {/* Detailed Requirements Section */}
              {canStartJob && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 sm:p-4 md:p-5 border-2 border-blue-300">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                    <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 flex-shrink-0" />
                    Before Starting Job - Required Actions
                  </h3>
                  <div className="space-y-2 sm:space-y-3">
                    <div className={`p-2.5 sm:p-3 rounded-lg border-2 ${
                      job.before_images_count >= 6
                        ? 'bg-green-50 border-green-300'
                        : 'bg-orange-50 border-orange-300'
                    }`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                        <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                          {job.before_images_count >= 6 ? (
                            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">1</span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-xs sm:text-sm">Upload Pickup/Visit Photos</p>
                            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
                              Required: 6 photos (Front, Rear, Left, Right, Dashboard, Engine Bay)
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                              Current: {job.before_images_count} / 6 uploaded
                            </p>
                            {missingBeforePhotos.length > 0 && (
                              <div className="mt-1.5 sm:mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                <p className="text-[10px] sm:text-xs font-semibold text-red-800 mb-0.5 sm:mb-1">⚠️ Missing Required Photo Types:</p>
                                <div className="flex flex-wrap gap-1">
                                  {missingBeforePhotos.map((type) => (
                                    <span key={type} className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-red-100 text-red-700 rounded">
                                      {type.replace('BEFORE_', '').replace('_', ' ')}
                                    </span>
                                  ))}
                                </div>
                                <p className="text-[10px] sm:text-xs text-red-600 mt-0.5 sm:mt-1">
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
                            className="btn btn-primary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex-shrink-0 cursor-pointer w-full sm:w-auto"
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
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 sm:p-4 md:p-5 border-2 border-green-300 mt-3 sm:mt-4">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                    <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0" />
                    Before Completing Job - Required Actions
                  </h3>
                  <div className="space-y-2 sm:space-y-3">
                    <div className={`p-2.5 sm:p-3 rounded-lg border-2 ${
                      job.checklist_completed
                        ? 'bg-green-50 border-green-300'
                        : 'bg-orange-50 border-orange-300'
                    }`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                        <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                          {job.checklist_completed ? (
                            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">1</span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-xs sm:text-sm">Complete Checklist</p>
                            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
                              All checklist items must be marked as completed
                            </p>
                          </div>
                        </div>
                        {!job.checklist_completed && (
                          <button
                            onClick={() => setActiveTab('checklist')}
                            className="btn-primary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 cursor-pointer w-full sm:w-auto"
                          >
                            View Checklist
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={`p-2.5 sm:p-3 rounded-lg border-2 ${
                      job.after_images_count >= job.min_after_images
                        ? 'bg-green-50 border-green-300'
                        : 'bg-orange-50 border-orange-300'
                    }`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                        <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                          {job.after_images_count >= job.min_after_images ? (
                            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">2</span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-xs sm:text-sm">Upload After Service Photos</p>
                            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
                              Required: {job.min_after_images} photos (Front, Rear, Left, Right, Engine Bay, Old Parts)
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                              Uploaded: {job.after_images_count}
                            </p>
                          </div>
                        </div>
                        {job.after_images_count < job.min_after_images && (
                          <button
                      onClick={(e) => {
                        e.preventDefault();
                        router.push(`/dashboard/workshop_mechanic/jobs/${leadId}/manage`);
                      }}
                      className="btn btn-primary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 cursor-pointer w-full sm:w-auto"
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
          <div className="card p-3 sm:p-4 md:p-5">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-bold">Checklist</h2>
            </div>
            
            {checklist.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-gray-500">
                <p className="mb-2 sm:mb-4 text-xs sm:text-sm">No checklist available for this job.</p>
                <p className="text-xs sm:text-sm">Checklist will be automatically generated when a mechanic is assigned.</p>
              </div>
            ) : (
              /* Group by category if categories exist */
              (() => {
                const hasCategories = checklist.some(item => item.category);
                
                return hasCategories ? (
              <div className="space-y-4">
                {(() => {
                  const allCategories = Array.from(new Set(checklist.map(item => item.category).filter(Boolean)));
                  
                  
                  return (
                    <>
                      {/* Category Summary Banner - Shows all categories */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 sm:p-3 mb-3 sm:mb-4">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-semibold text-blue-800">Categories:</span>
                          {allCategories.map((cat) => {
                            const items = checklist.filter(item => item.category === cat);
                            const completed = items.filter(item => item.status === 'COMPLETED').length;
                            const isActive = activeCategory === cat;
                            const allDone = items.every(item => item.status === 'COMPLETED');
                            return (
                              <span
                                key={cat}
                                className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                                  isActive ? 'bg-blue-600 text-white' :
                                  allDone ? 'bg-green-500 text-white' :
                                  'bg-white text-blue-700 border border-blue-300'
                                }`}
                              >
                                {cat} ({completed}/{items.length})
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Render all categories */}
                      {allCategories.map((category) => {
                    if (!category) return null;
                    const categoryItems = checklist.filter(item => item.category === category);
                    if (categoryItems.length === 0) {
                      return null;
                    }
                    
                    const allCompleted = categoryItems.every(item => item.status === 'COMPLETED');
                    const isActive = activeCategory === category;
                    
                    // Category blur logic:
                    // - If no active category: all categories are open (not blurred)
                    // - If active category exists: blur all OTHER categories EXCEPT completed ones
                    // - Completed categories are never blurred (can always be re-opened)
                    // - Mechanic can click on any category header to switch (freedom to choose)
                    const shouldBlurCategory = activeCategory !== null && activeCategory !== category && !allCompleted;
                    
                  
                  // IMPORTANT: Always render all categories, just apply blur styling
                  // Mechanic can click on ANY category header to switch (freedom to choose)
                  return (
                    <div 
                      key={category}
                      data-category-name={category}
                      className={`border rounded-lg p-3 sm:p-4 transition-all relative ${
                        shouldBlurCategory ? 'opacity-50 blur-sm bg-gray-50' : 
                        isActive ? 'border-blue-500 bg-blue-50 shadow-md' : 
                        allCompleted ? 'border-green-300 bg-green-50' :
                        'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                      style={{
                        // Ensure blurred categories are still visible
                        display: 'block',
                        visibility: 'visible'
                      }}
                    >
                      {/* Clickable Header - Always on top */}
                      <div 
                        className={`flex items-center justify-between mb-2 sm:mb-3 ${
                          shouldBlurCategory 
                            ? 'cursor-pointer hover:opacity-80 hover:bg-gray-100 rounded px-2 py-1 -mx-2 -mt-1' 
                            : 'cursor-pointer hover:bg-blue-50 rounded px-2 py-1 -mx-2 -mt-1'
                        } transition-all`}
                        onClick={(e) => {
                          // Stop event propagation to prevent any parent handlers
                          e.stopPropagation();
                          e.preventDefault();
                          
                          // Mechanic has FREEDOM to choose ANY category by clicking header
                          // Clicking on blurred category header switches to that category
                          const clickedCategory = String(category);
                          setActiveCategory(clickedCategory);
                        }}
                        onMouseDown={(e) => {
                          // Prevent any default behavior
                          e.stopPropagation();
                        }}
                        style={{
                          // Ensure header is always clickable and above table
                          pointerEvents: 'auto',
                          position: 'relative',
                          zIndex: 20,
                          userSelect: 'none'
                        }}
                      >
                        <h3 className={`text-base sm:text-lg font-semibold ${
                          shouldBlurCategory ? 'text-gray-400' : 
                          isActive ? 'text-blue-700 hover:text-blue-800' : 
                          allCompleted ? 'text-green-700' :
                          'text-gray-700 hover:text-blue-600'
                        }`}>
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
                      
                      {/* Table-like layout for compact display - Desktop */}
                      {/* When blurred, disable interaction with items (only header clickable) */}
                      <div className={`hidden lg:block overflow-x-auto ${shouldBlurCategory ? 'pointer-events-none' : ''}`}>
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-2 w-12">✓</th>
                              <th className="text-left py-2 px-3 font-semibold text-xs sm:text-sm text-gray-700">Point Name</th>
                              <th className="text-left py-2 px-3 font-semibold text-xs sm:text-sm text-gray-700">Remark</th>
                              <th className="text-center py-2 px-3 font-semibold text-xs sm:text-sm text-gray-700 w-32">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categoryItems.map((item, idx) => {
                              // No item-level blur - category-level blur only
                              return (
                              <tr 
                                key={item.id} 
                                className={`border-b border-gray-100 transition ${
                                  shouldBlurCategory ? '' : 'hover:bg-gray-50'
                                } ${
                                  item.status === 'COMPLETED' ? 'bg-green-50/30' : ''
                                }`}
                              >
                                {/* Checkbox */}
                                <td className="py-2 sm:py-3 px-2">
                                  <input
                                    type="checkbox"
                                    id={`checklist-item-${item.id}`}
                                    checked={item.status === 'COMPLETED'}
                                    disabled={shouldBlurCategory}
                                    onChange={(e) => {
                                      const newStatus = e.target.checked ? 'COMPLETED' : 'PENDING';
                                      
                                      // Set this category as active when first checkbox is checked
                                      if (e.target.checked && activeCategory !== category) {
                                        setActiveCategory(category);
                                      }
                                      
                                      updateChecklistItem(item.id, newStatus, item.notes || '', item.remark || '');
                                      
                                      // Update local state immediately for UI responsiveness
                                      const updatedChecklist = checklist.map(i =>
                                        i.id === item.id ? { ...i, status: newStatus } : i
                                      );
                                      setChecklist(updatedChecklist);
                                      
                                      // Check if all items in THIS category are completed
                                      const updatedCategoryItems = updatedChecklist.filter(i => i.category === category);
                                      const allDone = updatedCategoryItems.every(i => i.status === 'COMPLETED');
                                      
                                      // When category completes, unlock all categories (set activeCategory to null)
                                      if (allDone && activeCategory === category) {
                                        setActiveCategory(null);
                                      }
                                      
                                      // If unchecking and this was the active category, check if any items are still checked
                                      // If no items are checked in this category, make it inactive (allow switching)
                                      if (!e.target.checked && activeCategory === category) {
                                        const hasAnyChecked = updatedCategoryItems.some(i => i.status === 'COMPLETED');
                                        if (!hasAnyChecked) {
                                          setActiveCategory(null);
                                        }
                                      }
                                    }}
                                    className="w-4 h-4 sm:w-5 sm:h-5 cursor-pointer"
                                  />
                                </td>
                                
                                {/* Point Name */}
                                <td className="py-2 sm:py-3 px-2 sm:px-3">
                                  <label htmlFor={`checklist-item-${item.id}`} className="cursor-pointer flex items-center gap-1.5 sm:gap-2">
                                    <span className={`font-medium text-xs sm:text-sm ${
                                      item.status === 'COMPLETED' ? 'text-green-700 line-through' : 'text-gray-800'
                                    }`}>
                                      {item.name}
                                    </span>
                                    {item.mandatory && (
                                      <span className="px-1.5 sm:px-2 py-0.5 bg-red-100 text-red-800 text-[10px] sm:text-xs rounded font-semibold">
                                        Required
                                      </span>
                                    )}
                                  </label>
                                </td>
                                
                                {/* Remark Input */}
                                <td className="py-2 sm:py-3 px-2 sm:px-3">
                                  <input
                                    type="text"
                                    value={item.remark || ''}
                                    disabled={shouldBlurCategory}
                                    onChange={(e) => {
                                      const updatedChecklist = checklist.map(i =>
                                        i.id === item.id ? { ...i, remark: e.target.value } : i
                                      );
                                      setChecklist(updatedChecklist);
                                    }}
                                    onBlur={(e) =>
                                      updateChecklistItem(item.id, item.status, item.notes || '', (e.target as HTMLInputElement).value)
                                    }
                                    placeholder="Enter remark..."
                                    className={`w-full px-2 sm:px-3 py-1 sm:py-1.5 border border-gray-300 rounded text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                      shouldBlurCategory ? 'bg-gray-100 cursor-not-allowed' : ''
                                    }`}
                                  />
                                </td>
                                
                                {/* Status */}
                                <td className="py-2 sm:py-3 px-2 sm:px-3 text-center">
                                  <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
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

                      {/* Mobile Cards View */}
                      <div className={`lg:hidden space-y-2 sm:space-y-3 ${shouldBlurCategory ? 'pointer-events-none opacity-50' : ''}`}>
                        {categoryItems.map((item) => (
                          <div 
                            key={item.id}
                            className={`border rounded-lg p-2.5 sm:p-3 transition ${
                              item.status === 'COMPLETED' ? 'bg-green-50/30 border-green-200' : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-start gap-2 sm:gap-3">
                              <input
                                type="checkbox"
                                id={`checklist-item-${item.id}`}
                                checked={item.status === 'COMPLETED'}
                                disabled={shouldBlurCategory}
                                onChange={(e) => {
                                  const newStatus = e.target.checked ? 'COMPLETED' : 'PENDING';
                                  if (e.target.checked && activeCategory !== category) {
                                    setActiveCategory(category);
                                  }
                                  updateChecklistItem(item.id, newStatus, item.notes || '', item.remark || '');
                                  const updatedChecklist = checklist.map(i =>
                                    i.id === item.id ? { ...i, status: newStatus } : i
                                  );
                                  setChecklist(updatedChecklist);
                                  const updatedCategoryItems = updatedChecklist.filter(i => i.category === category);
                                  const allDone = updatedCategoryItems.every(i => i.status === 'COMPLETED');
                                  if (allDone && activeCategory === category) {
                                    setActiveCategory(null);
                                  }
                                  if (!e.target.checked && activeCategory === category) {
                                    const hasAnyChecked = updatedCategoryItems.some(i => i.status === 'COMPLETED');
                                    if (!hasAnyChecked) {
                                      setActiveCategory(null);
                                    }
                                  }
                                }}
                                className="w-4 h-4 sm:w-5 sm:h-5 cursor-pointer mt-0.5 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
                                  <label htmlFor={`checklist-item-${item.id}`} className="cursor-pointer flex items-center gap-1.5 sm:gap-2 min-w-0">
                                    <span className={`font-medium text-xs sm:text-sm truncate ${
                                      item.status === 'COMPLETED' ? 'text-green-700 line-through' : 'text-gray-800'
                                    }`}>
                                      {item.name}
                                    </span>
                                    {item.mandatory && (
                                      <span className="px-1.5 sm:px-2 py-0.5 bg-red-100 text-red-800 text-[10px] sm:text-xs rounded font-semibold">
                                        Required
                                      </span>
                                    )}
                                  </label>
                                  <span className={`flex-shrink-0 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold ${
                                    item.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                    item.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {item.status === 'COMPLETED' ? 'COMPLETE' : 'PENDING'}
                                  </span>
                                </div>
                                <input
                                  type="text"
                                  value={item.remark || ''}
                                  disabled={shouldBlurCategory}
                                  onChange={(e) => {
                                    const updatedChecklist = checklist.map(i =>
                                      i.id === item.id ? { ...i, remark: e.target.value } : i
                                    );
                                    setChecklist(updatedChecklist);
                                  }}
                                  onBlur={(e) =>
                                    updateChecklistItem(item.id, item.status, item.notes || '', (e.target as HTMLInputElement).value)
                                  }
                                  placeholder="Enter remark..."
                                  className={`w-full px-2 sm:px-3 py-1 sm:py-1.5 border border-gray-300 rounded text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    shouldBlurCategory ? 'bg-gray-100 cursor-not-allowed' : ''
                                  }`}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                  })}
                    </>
                  );
                })()}
              </div>
            ) : (
              /* Fallback: No categories - show table format */
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 w-12">✓</th>
                        <th className="text-left py-2 px-3 font-semibold text-xs sm:text-sm text-gray-700">Point Name</th>
                        <th className="text-left py-2 px-3 font-semibold text-xs sm:text-sm text-gray-700">Remark</th>
                        <th className="text-center py-2 px-3 font-semibold text-xs sm:text-sm text-gray-700 w-32">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checklist.map((item) => {
                        // No categories - no blur logic needed
                        // Mechanic can freely work on any item
                        return (
                        <tr 
                          key={item.id} 
                          className={`border-b border-gray-100 hover:bg-gray-50 transition ${
                            item.status === 'COMPLETED' ? 'bg-green-50/30' : ''
                          }`}
                        >
                          <td className="py-2 sm:py-3 px-2">
                            <input
                              type="checkbox"
                              id={`checklist-item-${item.id}`}
                              checked={item.status === 'COMPLETED'}
                              onChange={(e) => {
                                const newStatus = e.target.checked ? 'COMPLETED' : 'PENDING';
                                updateChecklistItem(item.id, newStatus, item.notes || '', item.remark || '');
                              }}
                              className="w-4 h-4 sm:w-5 sm:h-5 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-3">
                            <label htmlFor={`checklist-item-${item.id}`} className="cursor-pointer flex items-center gap-1.5 sm:gap-2">
                              <span className={`font-medium text-xs sm:text-sm ${
                                item.status === 'COMPLETED' ? 'text-green-700 line-through' : 'text-gray-800'
                              }`}>
                                {item.name}
                              </span>
                              {item.mandatory && (
                                <span className="px-1.5 sm:px-2 py-0.5 bg-red-100 text-red-800 text-[10px] sm:text-xs rounded font-semibold">
                                  Required
                                </span>
                              )}
                            </label>
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-3">
                            <input
                              type="text"
                              value={item.remark || ''}
                              onChange={(e) => {
                              const updatedChecklist = checklist.map(i =>
                                i.id === item.id ? { ...i, remark: e.target.value } : i
                              );
                              setChecklist(updatedChecklist);
                            }}
                            onBlur={(e) =>
                              updateChecklistItem(item.id, item.status, item.notes || '', (e.target as HTMLInputElement).value)
                            }
                            placeholder="Enter remark..."
                            className="w-full px-2 sm:px-3 py-1 sm:py-1.5 border border-gray-300 rounded text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-3 text-center">
                          <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
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

              {/* Mobile Cards View - No Categories */}
              <div className="lg:hidden space-y-2 sm:space-y-3">
                {checklist.map((item) => (
                  <div 
                    key={item.id}
                    className={`border rounded-lg p-2.5 sm:p-3 transition ${
                      item.status === 'COMPLETED' ? 'bg-green-50/30 border-green-200' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <input
                        type="checkbox"
                        id={`checklist-item-${item.id}`}
                        checked={item.status === 'COMPLETED'}
                        onChange={(e) => {
                          const newStatus = e.target.checked ? 'COMPLETED' : 'PENDING';
                          updateChecklistItem(item.id, newStatus, item.notes || '', item.remark || '');
                        }}
                        className="w-4 h-4 sm:w-5 sm:h-5 cursor-pointer mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
                          <label htmlFor={`checklist-item-${item.id}`} className="cursor-pointer flex items-center gap-1.5 sm:gap-2 min-w-0">
                            <span className={`font-medium text-xs sm:text-sm truncate ${
                              item.status === 'COMPLETED' ? 'text-green-700 line-through' : 'text-gray-800'
                            }`}>
                              {item.name}
                            </span>
                            {item.mandatory && (
                              <span className="px-1.5 sm:px-2 py-0.5 bg-red-100 text-red-800 text-[10px] sm:text-xs rounded font-semibold">
                                Required
                              </span>
                            )}
                          </label>
                          <span className={`flex-shrink-0 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold ${
                            item.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            item.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {item.status === 'COMPLETED' ? 'COMPLETE' : 'PENDING'}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={item.remark || ''}
                          onChange={(e) => {
                            const updatedChecklist = checklist.map(i =>
                              i.id === item.id ? { ...i, remark: e.target.value } : i
                            );
                            setChecklist(updatedChecklist);
                          }}
                          onBlur={(e) =>
                            updateChecklistItem(item.id, item.status, item.notes || '', (e.target as HTMLInputElement).value)
                          }
                          placeholder="Enter remark..."
                          className="w-full px-2 sm:px-3 py-1 sm:py-1.5 border border-gray-300 rounded text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </>
            );
            })()
            )}
          </div>
        )}

        {activeTab === 'media' && (
          <div className="space-y-4 sm:space-y-5 md:space-y-6">
            {/* Category Dropdown */}
            <div className="card p-3 sm:p-4 md:p-5">
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Upload Media</h2>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end">
                  <div className="flex-1">
                    <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Category</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value);
                        setSelectedPhotoType('');
                      }}
                      className="input w-full text-xs sm:text-sm"
                    >
                      <option value="PROGRESS">Work in Progress</option>
                      <option value="CAR_SCANNING_BEFORE">Car Scanning (Before)</option>
                      <option value="CAR_SCANNING_AFTER">Car Scanning (After)</option>
                      {hasCustomService && <option value="CUSTOM_SERVICE">Custom Service</option>}
                      <option value="AFTER">After Service</option>
                      <option value="PARTS_USED">Parts Used</option>
                    </select>
                  </div>
                </div>

                {/* PROGRESS Category - During Service Upload */}
                {selectedCategory === 'PROGRESS' && job && job.id && (
                  <div className="card border-2 border-orange-300 p-3 sm:p-4 md:p-5">
                    <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
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

                {/* CAR SCANNING BEFORE Category */}
                {selectedCategory === 'CAR_SCANNING_BEFORE' && (
                  <div className="card border-2 border-sky-300 p-3 sm:p-4 md:p-5">
                    <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                      <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-sky-700 flex-shrink-0" />
                      Car Scanning (Before)
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                      Upload multiple car scanning photos/videos taken before service.
                    </p>
                    <div>
                      <label className="btn btn-primary cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                        <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                        {uploadingMedia ? 'Uploading...' : 'Upload Scanning Photos (Before)'}
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

                {/* CAR SCANNING AFTER Category */}
                {selectedCategory === 'CAR_SCANNING_AFTER' && (
                  <div className="card border-2 border-teal-300 p-3 sm:p-4 md:p-5">
                    <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                      <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-teal-700 flex-shrink-0" />
                      Car Scanning (After)
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                      Upload multiple car scanning photos/videos taken after service completion.
                    </p>
                    <div>
                      <label className="btn btn-primary cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                        <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                        {uploadingMedia ? 'Uploading...' : 'Upload Scanning Photos (After)'}
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

                {/* CUSTOM SERVICE Category (multiple uploads) */}
                {selectedCategory === 'CUSTOM_SERVICE' && hasCustomService && (
                  <div className="card border-2 border-fuchsia-300 p-3 sm:p-4 md:p-5">
                    <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                      <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-fuchsia-700 flex-shrink-0" />
                      Custom Service Photos
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                      Upload multiple photos/videos for the custom service work performed.
                    </p>
                    <div>
                      <label className="btn btn-primary cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                        <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                        {uploadingMedia ? 'Uploading...' : 'Upload Custom Service Photos'}
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

                {/* AFTER Category - After Service Upload */}
                {selectedCategory === 'AFTER' && job && job.id && (
                  <div className="card border-2 border-green-300 p-3 sm:p-4 md:p-5">
                    <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                      <Camera className="w-6 h-6 text-green-700" />
                      After Service Photos
                    </h2>
                    <AfterServiceUpload
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
                  <div className="card border-2 border-purple-300 p-3 sm:p-4 md:p-5">
                    <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                      <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 flex-shrink-0" />
                      Additional Jobs Proof
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                      Upload photos as proof of additional job performed (e.g., additional repairs, part replacements).
                    </p>
                    <div>
                      <label className="btn btn-primary cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                        <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
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
                  <div className="card border-2 border-red-300 p-3 sm:p-4 md:p-5">
                    <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                      <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0" />
                      Damage Found
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                      Upload photos of any damages or issues found during inspection or service.
                    </p>
                    <div>
                      <label className="btn btn-primary cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                        <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
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
                  <div className="card border-2 border-indigo-300 p-3 sm:p-4 md:p-5">
                    <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                      <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 flex-shrink-0" />
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
            <div className="card p-3 sm:p-4 md:p-5">
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Other Media ({media.length})</h2>
              <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                General media uploads (not used for before/after inspection validation)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                {media.map((item) => (
                  <div key={item.id} className="border rounded-lg overflow-hidden group relative">
                    {/* Image or Video */}
                    {item.media_type === 'VIDEO' || item.file_url.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                      <div className="relative w-full h-32 sm:h-40 md:h-48 bg-black">
                        <video 
                          src={item.file_url} 
                          className="w-full h-32 sm:h-40 md:h-48 object-contain"
                          controls
                          preload="metadata"
                        />
                        <div className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-red-600 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
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
                          className="w-full h-32 sm:h-40 md:h-48 object-cover group-hover:opacity-90 transition-opacity" 
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                          <Camera className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    )}
                    
                    <div className="p-1.5 sm:p-2 bg-gray-50">
                      <p className="text-[10px] sm:text-xs font-semibold text-blue-600">
                        {item.media_category.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-500">
                        {formatDateTime(item.uploaded_at || item.created_at)}
                      </p>
                      {item.caption && (
                        <p className="text-[10px] sm:text-xs text-gray-700 mt-0.5 sm:mt-1">{item.caption}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {media.length === 0 && (
                <div className="text-center text-gray-500 py-8 sm:py-10 md:py-12 bg-gray-50 rounded-lg">
                  <Camera className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-2 sm:mb-3 text-gray-400" />
                  <p className="font-medium text-xs sm:text-sm">No media uploaded yet</p>
                  <p className="text-xs sm:text-sm mt-0.5 sm:mt-1">Upload photos or videos to document your work</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'parts' && (
          <div className="card p-3 sm:p-4 md:p-5">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Parts Management</h2>
            <div className="space-y-2 sm:space-y-3">
              {parts.map((part) => (
                <div key={part.id} className="p-3 sm:p-4 border rounded-lg">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base sm:text-lg">{part.part_name}</p>
                      {part.part_code && (
                        <p className="text-xs sm:text-sm text-gray-600">Code: {part.part_code}</p>
                      )}
                      <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
                        Quantity Assigned: {part.quantity || 0} {part.unit || 'piece'}
                      </p>
                      {part.unit_price && (
                        <p className="text-xs sm:text-sm text-gray-600">
                          Unit Price: ₹{part.unit_price.toFixed(2)}
                          {part.total_price && ` | Total: ₹${part.total_price.toFixed(2)}`}
                        </p>
                      )}
                      {part.supplier && (
                        <p className="text-xs sm:text-sm text-gray-600">Supplier: {part.supplier}</p>
                      )}
                    </div>
                  </div>
                  {part.notes && (
                    <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t">
                      <p className="text-xs sm:text-sm text-gray-600">
                        <strong>Notes:</strong> {part.notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
              {parts.length === 0 && (
                <div className="text-center py-6 sm:py-8">
                  <Package className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-2 sm:mb-3 text-gray-400" />
                  <p className="text-gray-500 font-medium mb-1.5 sm:mb-2 text-xs sm:text-sm">No parts assigned for this job</p>
                  <p className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">
                    Parts are assigned by Admin/Supervisor. Contact them to request parts for this job.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 max-w-md mx-auto">
                    <p className="text-xs sm:text-sm text-blue-800 font-semibold mb-1">💡 How to request parts:</p>
                    <ul className="text-[10px] sm:text-xs text-blue-700 text-left space-y-0.5 sm:space-y-1 list-disc list-inside">
                      <li>Contact your Supervisor or Admin</li>
                      <li>Use "Request Additional Job" button if additional parts are needed</li>
                      <li>Parts will appear here once assigned</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="card p-3 sm:p-4 md:p-5">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Work Notes</h2>
            <textarea
              value={workNotes}
              onChange={(e) => setWorkNotes(e.target.value)}
              rows={8}
              className="input w-full text-xs sm:text-sm"
              placeholder="Add your work notes, observations, complications, hidden damage found, etc..."
            />
            <button 
              onClick={saveWorkNotes}
              className="btn btn-primary mt-3 sm:mt-4 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto"
            >
              <Save className="w-4 h-4 sm:w-5 sm:h-5" />
              Save Notes
            </button>
          </div>
        )}

        {activeTab === 'supervisor-observation' && (
          <div className="card p-3 sm:p-4 md:p-5">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Supervisor/Advisor Observation
            </h2>

            <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
              <div className="text-sm text-gray-900 whitespace-pre-wrap">
                {supervisorObservation.text.trim() ? supervisorObservation.text : 'No observation from supervisor yet.'}
              </div>
              {(supervisorObservation.updatedAt || supervisorObservation.byName) && (
                <div className="mt-3 text-xs text-gray-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {supervisorObservation.byName && (
                    <span>
                      By: <strong className="text-gray-800">{supervisorObservation.byName}</strong>
                    </span>
                  )}
                  {supervisorObservation.updatedAt && (
                    <span>
                      Last updated:{' '}
                      <strong className="text-gray-800">{formatDateTime(supervisorObservation.updatedAt)}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'extra-work' && (
          <div className="space-y-4">
            {/* In-tab Additional Job Request (Checklist style) */}
            <div id="extra-work-request-form" className="card p-3 sm:p-4 md:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3 sm:mb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold">Request Additional Job</h2>
                    {selectedAdditionalItems.length > 0 && (
                      <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[10px] sm:text-xs font-semibold">
                        {selectedAdditionalItems.length} selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 leading-relaxed">
                    Select required jobs from master list, set priority, and add notes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchAdditionalJobsMaster().catch(() => {})}
                  className="btn btn-outline text-xs sm:text-sm inline-flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-center"
                  disabled={additionalMasterLoading}
                  title="Refresh list"
                >
                  <RefreshCw className={`w-4 h-4 ${additionalMasterLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div>
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between mb-2">
                    <label className="block text-xs sm:text-sm font-medium">Find Additional Jobs</label>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <input
                        value={additionalMasterQuery}
                        onChange={(e) => setAdditionalMasterQuery(e.target.value)}
                        className="input text-xs sm:text-sm w-full sm:w-72"
                        placeholder="Search (e.g., Brake Pads)"
                      />
                      <select
                        className="input text-xs sm:text-sm w-full sm:w-56"
                        value={additionalMasterCategory}
                        onChange={(e) => setAdditionalMasterCategory(e.target.value)}
                        title="Filter by category"
                      >
                        <option value="">All Categories</option>
                        {additionalMasterCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Search results (do not show full list; only show when searching) */}
                  {(additionalMasterQuery.trim() || additionalMasterCategory) && (
                    <div className="border rounded-lg overflow-hidden bg-white">
                      {additionalMasterLoading ? (
                        <div className="p-3 text-xs sm:text-sm text-gray-500">Loading…</div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-3 text-xs sm:text-sm text-gray-500">No matching jobs found.</div>
                      ) : (
                        <div className="divide-y max-h-72 overflow-auto">
                          {searchResults.map((it) => {
                            const isSelected = selectedAdditionalJobIds.includes(it.id);
                            return (
                              <div key={it.id} className="p-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-semibold text-gray-900 truncate">{it.name}</div>
                                  <div className="text-[10px] sm:text-xs text-gray-500 truncate">{it.category || '-'}</div>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-outline text-xs sm:text-sm whitespace-nowrap"
                                  onClick={() => addSelectedAdditionalJob(it)}
                                  disabled={isSelected}
                                  title={isSelected ? 'Already selected' : 'Add to selected'}
                                >
                                  {isSelected ? 'Added' : 'Add'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selected jobs only */}
                  <div className="mt-3 border rounded-lg overflow-hidden bg-white">
                    {selectedAdditionalItems.length === 0 ? (
                      <div className="p-3 text-xs sm:text-sm text-gray-500">
                        No additional jobs selected. Search and add jobs above — only selected jobs will show here.
                      </div>
                    ) : (
                      <>
                        {/* Mobile: cards (no horizontal scroll) */}
                        <div className="sm:hidden divide-y">
                          {selectedAdditionalItems.map((it) => {
                            const pr = rowPriority[it.id] || 'MEDIUM';
                            const note = rowNote[it.id] || '';
                            const busy = Boolean(submittingJobIds[it.id]);
                            const noteMissing = pr === 'HIGH' && !note.trim();
                            return (
                              <div key={it.id} className="p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-semibold text-gray-900 leading-tight">{it.name}</div>
                                    <div className="text-[10px] text-gray-500 truncate">{it.category || '-'}</div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeSelectedAdditionalJob(it.id)}
                                    className="btn btn-outline px-3 py-1.5 text-xs whitespace-nowrap"
                                    disabled={busy}
                                    title="Remove from selected"
                                  >
                                    Remove
                                  </button>
                                </div>

                                <div className="mt-2 grid grid-cols-1 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-gray-600 mb-1">Priority</label>
                                    <select
                                      className="input w-full text-xs"
                                      value={pr}
                                      onChange={(e) =>
                                        setRowPriority((p) => ({ ...p, [it.id]: e.target.value as any }))
                                      }
                                    >
                                      <option value="HIGH">High</option>
                                      <option value="MEDIUM">Medium</option>
                                      <option value="LOW">Low</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-semibold text-gray-600 mb-1">Remark / Note</label>
                                    <textarea
                                      rows={2}
                                      className={`input w-full text-xs ${noteMissing ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
                                      value={note}
                                      onChange={(e) => setRowNote((p) => ({ ...p, [it.id]: e.target.value }))}
                                      placeholder={pr === 'HIGH' ? 'High priority note required…' : 'Optional note…'}
                                    />
                                    {noteMissing && (
                                      <p className="mt-1 text-[10px] text-red-600 font-semibold">
                                        Note required for High priority.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Desktop/tablet: table */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full text-left text-xs sm:text-sm">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                <th className="p-3 font-semibold text-gray-700 whitespace-nowrap">Job</th>
                                <th className="p-3 font-semibold text-gray-700">Remark / Note</th>
                                <th className="p-3 font-semibold text-gray-700 whitespace-nowrap">Priority</th>
                                <th className="p-3 font-semibold text-gray-700 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {selectedAdditionalItems.map((it) => {
                                const pr = rowPriority[it.id] || 'MEDIUM';
                                const note = rowNote[it.id] || '';
                                const busy = Boolean(submittingJobIds[it.id]);
                                const noteMissing = pr === 'HIGH' && !note.trim();
                                return (
                                  <tr key={it.id} className="hover:bg-gray-50">
                                    <td className="p-3">
                                      <div className="font-semibold text-gray-900">{it.name}</div>
                                      <div className="text-[10px] sm:text-xs text-gray-500">{it.category || '-'}</div>
                                    </td>
                                    <td className="p-3">
                                      <textarea
                                        rows={2}
                                        className={`input w-full text-xs sm:text-sm ${noteMissing ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
                                        value={note}
                                        onChange={(e) => setRowNote((p) => ({ ...p, [it.id]: e.target.value }))}
                                        placeholder={pr === 'HIGH' ? 'High priority note required…' : 'Optional note…'}
                                      />
                                      {noteMissing && (
                                        <p className="mt-1 text-[10px] sm:text-xs text-red-600 font-semibold">
                                          Note required for High priority.
                                        </p>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      <select
                                        className="input w-full text-xs sm:text-sm"
                                        value={pr}
                                        onChange={(e) =>
                                          setRowPriority((p) => ({ ...p, [it.id]: e.target.value as any }))
                                        }
                                      >
                                        <option value="HIGH">High</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="LOW">Low</option>
                                      </select>
                                    </td>
                                    <td className="p-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => removeSelectedAdditionalJob(it.id)}
                                        className="btn btn-outline px-3 py-1.5 text-xs sm:text-sm"
                                        disabled={busy}
                                        title="Remove from selected"
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center sm:justify-between">
                  <div className="text-[10px] sm:text-xs text-gray-500">
                    {selectedAdditionalItems.length > 0
                      ? `You’re about to submit ${selectedAdditionalItems.length} request(s).`
                      : 'Select jobs above to enable submit.'}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={submitSelectedAdditionalJobs}
                    disabled={selectedAdditionalItems.length === 0 || Object.values(submittingJobIds).some(Boolean)}
                    className="btn btn-primary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto flex items-center justify-center gap-1.5 sm:gap-2"
                    title="Submit all selected additional jobs"
                  >
                    <Send className="w-4 h-4" />
                    {Object.values(submittingJobIds).some(Boolean)
                      ? 'Submitting…'
                      : `Submit Selected${selectedAdditionalItems.length ? ` (${selectedAdditionalItems.length})` : ''}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdditionalMasterQuery('');
                      setAdditionalMasterCategory('');
                      setSelectedAdditionalJobIds([]);
                      setRowPriority({});
                      setRowNote({});
                      setRowCost({});
                    }}
                    className="btn btn-outline text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto"
                  >
                    Clear
                  </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Existing requests */}
            <div id="extra-work-requests" className="card p-3 sm:p-4 md:p-5">
              <div className="flex items-start justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-bold">Additional Job Requests</h2>
              </div>

            {extraWorkRequests.length === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-gray-400" />
                <p className="text-gray-600 font-semibold text-xs sm:text-sm">No additional job requests yet</p>
                <p className="text-gray-400 text-[10px] sm:text-xs mt-1">
                  If you find additional work needed, submit a request for approval.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left py-2 px-3">Job</th>
                      <th className="text-left py-2 px-3 whitespace-nowrap">Priority</th>
                      <th className="text-left py-2 px-3">Note</th>
                      <th className="text-left py-2 px-3 whitespace-nowrap">Status</th>
                      <th className="text-left py-2 px-3 whitespace-nowrap">Done</th>
                      <th className="text-left py-2 px-3 whitespace-nowrap">Completion Remark</th>
                      <th className="text-left py-2 px-3 whitespace-nowrap">Completed</th>
                      <th className="text-left py-2 px-3 whitespace-nowrap">Requested</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {extraWorkRequests.map((request: any) => {
                      const status = String(request.status || 'PENDING').toUpperCase();
                      const byCustomer = Boolean(request.customer_approved_at);
                      const customerApproved = Boolean(request.customer_approved);
                      const isOverrideApproved = status === 'APPROVED' && byCustomer && !customerApproved;
                      const decisionLabel =
                        status === 'REJECTED'
                          ? byCustomer
                            ? 'REJECTED • Customer'
                            : 'REJECTED • Advisor'
                          : status === 'APPROVED'
                            ? customerApproved && byCustomer
                              ? `APPROVED • Customer (${String(request.part_price_type || 'OEM').toUpperCase()})`
                              : isOverrideApproved
                                ? `APPROVED • Override (${String(request.part_price_type || 'OEM').toUpperCase()})`
                                : 'APPROVED • Advisor'
                            : 'PENDING';

                      const priority = request.is_urgent ? 'HIGH' : 'MEDIUM';
                      const reviewNotes =
                        request.supervisor_approval_notes ||
                        (status === 'REJECTED' && byCustomer
                          ? `Customer: ${request.rejection_reason || ''}`
                          : request.rejection_reason);

                      const isApproved = status === 'APPROVED';
                      const isWorkCompleted = Boolean(request.work_completed || request.work_completed_at);
                      const busy = Boolean(completingExtraWorkById[request.id]);
                      const completionRemark =
                        extraWorkCompletionRemarkById[request.id] !== undefined
                          ? extraWorkCompletionRemarkById[request.id]
                          : String(request.work_completion_remark || '');

                      return (
                        <tr
                          key={request.id}
                          className={
                            status === 'APPROVED'
                              ? 'bg-green-50/30'
                              : status === 'REJECTED'
                                ? 'bg-red-50/30'
                                : 'bg-yellow-50/20'
                          }
                        >
                          <td className="py-3 px-3 align-top">
                            <div className="font-semibold text-gray-900">{request.description}</div>
                          </td>
                          <td className="py-3 px-3 align-top">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                request.is_urgent ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {priority}
                            </span>
                          </td>
                          <td className="py-3 px-3 align-top min-w-[260px]">
                            <div className="text-gray-700 whitespace-pre-line text-xs sm:text-sm">
                              {request.reason || '—'}
                            </div>
                            {reviewNotes && (
                              <div className="mt-1 text-[10px] sm:text-xs text-gray-600">
                                <strong>Review Notes:</strong> {String(reviewNotes)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 align-top">
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                                status === 'APPROVED'
                                  ? isOverrideApproved
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-green-100 text-green-800'
                                  : status === 'REJECTED'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {decisionLabel}
                            </span>
                          </td>
                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <input
                              type="checkbox"
                              className="w-4 h-4"
                              checked={isWorkCompleted}
                              disabled={!isApproved || isWorkCompleted || busy}
                              onChange={(e) => {
                                if (e.target.checked) markExtraWorkCompleted(request.id);
                              }}
                              title={
                                !isApproved
                                  ? 'Can be completed after approval'
                                  : isWorkCompleted
                                    ? 'Already completed'
                                    : 'Mark this additional job as completed'
                              }
                            />
                          </td>
                          <td className="py-3 px-3 align-top min-w-[260px]">
                            <input
                              type="text"
                              className="input w-full text-xs sm:text-sm"
                              value={completionRemark}
                              disabled={!isApproved || isWorkCompleted || busy}
                              onChange={(e) =>
                                setExtraWorkCompletionRemarkById((p) => ({ ...p, [request.id]: e.target.value }))
                              }
                              placeholder="Optional remark (e.g. done / replaced / checked)"
                            />
                            {isWorkCompleted && String(request.work_completion_remark || '').trim() ? (
                              <div className="mt-1 text-[10px] sm:text-xs text-gray-600">
                                Saved: {String(request.work_completion_remark)}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 px-3 align-top whitespace-nowrap text-xs text-gray-600">
                            {isWorkCompleted && request.work_completed_at ? formatDateTime(request.work_completed_at) : '—'}
                          </td>
                          <td className="py-3 px-3 align-top whitespace-nowrap text-xs text-gray-600">
                            {formatDateTime(request.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </div>
        )}

        {/* Additional Job Requests List is in "Additional Jobs" tab */}
      </div>

      {/* Image Zoom Modal */}
      {zoomedMedia && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-2 sm:p-3 md:p-4"
          onClick={() => setZoomedMedia(null)}
        >
          <div className="relative max-w-7xl max-h-full" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={() => setZoomedMedia(null)}
              className="absolute -top-8 sm:-top-10 md:-top-12 right-0 sm:right-2 text-white hover:text-gray-300 transition-colors p-1 sm:p-2"
            >
              <X className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
            </button>
            
            {/* Image */}
            <img 
              src={zoomedMedia.file_url} 
              alt="Zoomed media"
              className="max-w-full max-h-[85vh] sm:max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            
            {/* Info Bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent text-white p-2 sm:p-3 md:p-4 rounded-b-lg">
              <p className="font-semibold text-xs sm:text-sm md:text-base">{zoomedMedia.media_category.replace(/_/g, ' ')}</p>
              <p className="text-[10px] sm:text-xs md:text-sm text-gray-300">
                {formatDateTime(zoomedMedia.uploaded_at || zoomedMedia.created_at)}
              </p>
              {zoomedMedia.caption && (
                <p className="text-[10px] sm:text-xs md:text-sm mt-1 sm:mt-2">{zoomedMedia.caption}</p>
              )}
            </div>
            
            {/* Download Button */}
            <a
              href={zoomedMedia.file_url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-0 right-8 sm:right-10 md:right-12 bg-white text-gray-800 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">Download</span>
            </a>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

