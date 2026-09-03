import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  BackHandler,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ENV } from '../../../config/environment';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { fetchMechanicJobs } from '../../../lib/mechanicJobs';
import { parseServiceChecklistItems, sortServiceChecklistItems } from '../../../lib/serviceChecklist';
import { apiFetch } from '../../../lib/api';
import {
  mechanicStatusColors,
  mechanicStatusLabel,
  resolveMechanicDisplayStatus,
} from '../../../lib/mechanicJobStatus';

interface JobDetail {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_variant: string;
  problem_description: string;
  service_types: string[];
  service_type_ids?: string[];
  mechanic_status: string;
  job_priority: string;
  sla_remaining_minutes: number;
  assigned_at: string;
  expected_completion_time: string;
  checklist_completed: boolean;
  before_images_count: number;
  progress_images_count: number;
  after_images_count: number;
  min_before_images: number;
  min_progress_images: number;
  min_after_images: number;
  lead_status?: string;
  qc_status?: string | null;
}

interface ChecklistItem {
  id: string;
  name: string;
  status: string;
  notes?: string;
  remark?: string;
  category?: string;
  mandatory: boolean;
  completed_at?: string;
}

interface ExtraProofItem {
  id: string;
  extraWorkId: string;
  uri: string;
  isVideo: boolean;
}

interface ExtraWorkRequest {
  id: string;
  description: string;
  reason?: string;
  amount: number;
  category?: string;
  is_urgent?: boolean;
  status: string;
  created_at?: string;
  work_completed?: boolean;
  work_completed_at?: string | null;
  work_completion_remark?: string | null;
}

function formatExtraCategory(category?: string) {
  const raw = String(category || '').trim();
  if (!raw) return 'Extra work';
  if (raw.toUpperCase().startsWith('OTHER:')) {
    return raw.slice(6).trim() || 'Other';
  }
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MechanicJobDetailScreen({
  hideChrome = false,
  embedInShell = false,
}: {
  hideChrome?: boolean;
  embedInShell?: boolean;
}) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = (route.params || {}) as { jobId?: string; leadId?: string; tab?: string };
  const jobId = params.jobId || params.leadId;
  const [job, setJob] = useState<JobDetail | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [extraWork, setExtraWork] = useState<ExtraWorkRequest[]>([]);
  const [extraRemarkById, setExtraRemarkById] = useState<Record<string, string>>({});
  const [completingExtraId, setCompletingExtraId] = useState<string | null>(null);
  const [extraProof, setExtraProof] = useState<ExtraProofItem[]>([]);
  const [uploadingProofId, setUploadingProofId] = useState<string | null>(null);
  const [workVideos, setWorkVideos] = useState<Array<{ id: string; uri: string }>>([]);
  const [uploadingWorkVideo, setUploadingWorkVideo] = useState(false);
  const [workNotes, setWorkNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedRemarkId, setExpandedRemarkId] = useState<string | null>(null);
  const [serviceTypeNames, setServiceTypeNames] = useState<string[]>([]);
  const { user } = useAuth();

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [navigation]);

  useEffect(() => {
    if (jobId) {
      // Setup realtime subscription for job updates
      const channel = supabase
        .channel(`mechanic-job-${jobId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'mechanic_jobs',
            filter: `lead_id=eq.${jobId}`
          },
          () => {
            console.log('Mechanic job updated in real-time');
            fetchJobDetail();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'service_leads',
            filter: `id=eq.${jobId}`
          },
          (payload) => {
            console.log('Lead status updated in real-time:', payload);
            // If status changed to IN_PROGRESS (sent back), refresh immediately
            if (payload.new && payload.new.status === 'IN_PROGRESS') {
              fetchJobDetail();
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'service_checklists',
            filter: `lead_id=eq.${jobId}`,
          },
          async () => {
            const mechanicId = await resolveMechanicId();
            await loadChecklist(mechanicId);
          },
        )
        .subscribe((status) => {
          console.log('Mechanic job subscription status:', status);
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [jobId]);

  useFocusEffect(
    React.useCallback(() => {
      if (jobId) {
        fetchJobDetail();
      }
    }, [jobId]),
  );

  useEffect(() => {
    if (params.tab === 'extra' || params.tab === 'extra-work') {
      setActiveTab('extra');
    }
  }, [params.tab]);

  async function resolveMechanicId() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;
    const { data: profile } = await supabase
      .from('users_login')
      .select('id')
      .ilike('email', authUser.email || '')
      .maybeSingle();
    return profile?.id || user?.id || authUser.id;
  }

  function mapRawChecklistItems(raw: unknown): ChecklistItem[] {
    let parsed = raw;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = [];
      }
    }
    if (!Array.isArray(parsed)) {
      return sortServiceChecklistItems(
        parseServiceChecklistItems(raw).map((item) => ({
          id: item.id,
          name: item.item_name,
          status: item.is_completed ? 'COMPLETED' : 'PENDING',
          mandatory: true,
          remark: '',
          category: item.category,
        })),
      );
    }
    return sortServiceChecklistItems(
      parsed.map((item: any, index: number) => {
        const status = String(item?.status || '').toUpperCase();
        return {
          id: String(item?.id ?? index + 1),
          name: String(item?.name || item?.item_name || `Task ${index + 1}`),
          status: status === 'COMPLETED' || status === 'DONE' ? 'COMPLETED' : 'PENDING',
          mandatory: item?.mandatory !== false,
          remark: String(item?.remark || ''),
          category: item?.category ? String(item.category) : undefined,
          notes: item?.notes ? String(item.notes) : undefined,
          completed_at: item?.completed_at ? String(item.completed_at) : undefined,
        };
      }),
    );
  }

  async function loadChecklist(mechanicId: string | null) {
    if (!jobId || !mechanicId) {
      setChecklist([]);
      return;
    }

    let { data: checklistData } = await supabase
      .from('service_checklists')
      .select('checklist_items')
      .eq('lead_id', jobId)
      .eq('mechanic_id', mechanicId)
      .maybeSingle();

    let items = mapRawChecklistItems(checklistData?.checklist_items);
    if (items.length === 0) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const response = await fetch(`${ENV.API_URL}/api/leads/${jobId}/ensure-checklist`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'x-mobile-client': 'true',
            },
          });
          const result = await response.json().catch(() => ({}));
          if (response.ok) {
            if (Array.isArray(result.items) && result.items.length > 0) {
              items = mapRawChecklistItems(result.items);
            } else {
              const { data: refreshed } = await supabase
                .from('service_checklists')
                .select('checklist_items')
                .eq('lead_id', jobId)
                .eq('mechanic_id', mechanicId)
                .maybeSingle();
              items = mapRawChecklistItems(refreshed?.checklist_items);
            }
          }
        }
      } catch (e) {
        console.warn('ensure-checklist failed:', e);
      }
    }

    setChecklist(items);
  }

  async function loadExtraWork(leadId: string) {
    try {
      const json = await apiFetch<{ requests?: ExtraWorkRequest[] }>(
        `/api/mechanic/jobs/${leadId}/request-extra-work`,
      );
      setExtraWork(Array.isArray(json?.requests) ? json.requests : []);
    } catch (error) {
      console.warn('Failed to load extra work requests:', error);
      setExtraWork([]);
    }
    try {
      const photos = await apiFetch<{ data?: Array<{ id: string; photo_url: string; photo_type?: string; notes?: string }> }>(
        `/api/mechanic/jobs/${leadId}/upload-photos?category=extra`,
      );
      const rows = Array.isArray(photos?.data) ? photos.data : [];
      setExtraProof(
        rows.map((row) => {
          const type = String(row.photo_type || '');
          const fromType = type.toUpperCase().startsWith('EXTRA_WORK-') ? type.slice('EXTRA_WORK-'.length) : '';
          const extraWorkId = String(row.notes || fromType || '').trim();
          const uri = String(row.photo_url || '');
          return {
            id: String(row.id),
            extraWorkId,
            uri,
            isVideo: /\.(mp4|mov|m4v|webm|3gp)(\?|$)/i.test(uri) || type.toUpperCase().includes('VIDEO'),
          };
        }),
      );
    } catch {
      setExtraProof([]);
    }
  }

  async function loadWorkVideos(leadId: string) {
    try {
      const photos = await apiFetch<{ data?: Array<{ id: string; photo_url: string; photo_type?: string }> }>(
        `/api/mechanic/jobs/${leadId}/upload-photos?category=after_video`,
      );
      const rows = Array.isArray(photos?.data) ? photos.data : [];
      setWorkVideos(
        rows.map((row) => ({
          id: String(row.id),
          uri: String(row.photo_url || ''),
        })),
      );
    } catch {
      setWorkVideos([]);
    }
  }

  async function pickServiceVideos() {
    if (!job?.lead_id) return;
    try {
      setUploadingWorkVideo(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission', 'Gallery access chahiye video add karne ke liye.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });
      if (result.canceled || !result.assets?.length) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      for (const [index, asset] of result.assets.entries()) {
        const formData = new FormData();
        // @ts-ignore React Native FormData file
        formData.append('file', {
          uri: asset.uri,
          name: `work-video-${Date.now()}-${index}.mp4`,
          type: 'video/mp4',
        });
        formData.append('photo_type', `AFTER_VIDEO-${Date.now()}-${index}`);
        formData.append('photo_category', 'after_video');
        const response = await fetch(`${ENV.API_URL}/api/mechanic/jobs/${job.lead_id}/upload-photos`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json?.error || 'Failed to upload video');
      }
      await loadWorkVideos(job.lead_id);
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message || 'Could not upload video');
    } finally {
      setUploadingWorkVideo(false);
    }
  }

  async function fetchJobDetail() {
    try {
      setLoading(true);
      const mechanicId = await resolveMechanicId();

      const leadSelect = `
        lead_number,
        customer_name,
        vehicle_number,
        vehicle_make,
        vehicle_model,
        vehicle_variant,
        problem_description,
        service_type,
        service_type_ids,
        status,
        qc_status
      `;

      let jobData: any = null;

      if (mechanicId) {
        const { data, error } = await supabase
          .from('mechanic_jobs')
          .select(`*, service_leads:lead_id (${leadSelect})`)
          .eq('lead_id', jobId)
          .eq('mechanic_id', mechanicId)
          .maybeSingle();

        if (!error && data) {
          jobData = data;
        }
      }

      if (!jobData) {
        const { data, error } = await supabase
          .from('mechanic_jobs')
          .select(`*, service_leads:lead_id (${leadSelect})`)
          .eq('lead_id', jobId)
          .maybeSingle();

        if (!error && data) {
          jobData = data;
        }
      }

      if (!jobData) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const jobs = await fetchMechanicJobs(session.access_token);
            const match = jobs.find((j) => j.lead_id === jobId);
            if (match) {
              jobData = {
                id: match.id,
                lead_id: match.lead_id,
                mechanic_status: match.mechanic_status,
                job_priority: match.job_priority || 'NORMAL',
                sla_remaining_minutes: match.sla_remaining_minutes || 0,
                assigned_at: match.assigned_at,
                expected_completion_time: null,
                checklist_completed: match.checklist_completed,
                before_images_count: match.before_images_count || 0,
                progress_images_count: match.progress_images_count || 0,
                after_images_count: match.after_images_count || 0,
                min_before_images: 6,
                min_progress_images: 0,
                min_after_images: 4,
                work_notes: '',
                service_leads: {
                  lead_number: match.lead_number || '',
                  customer_name: match.customer_name,
                  vehicle_number: match.vehicle_number,
                  vehicle_make: match.vehicle_make,
                  vehicle_model: match.vehicle_model,
                  vehicle_variant: '',
                  problem_description: '',
                  service_type: match.service_type || match.service_types?.[0] || 'General Service',
                  service_type_ids: [],
                },
              };
            }
          }
        } catch (apiError) {
          console.warn('Mechanic job API fallback failed:', apiError);
        }
      }

      if (!jobData) {
        setJob(null);
        setChecklist([]);
        return;
      }

      const lead = jobData.service_leads || {};
      const serviceTypeLabel = lead.service_type || 'General Service';

      const detail: JobDetail = {
        id: jobData.id,
        lead_id: jobData.lead_id,
        lead_number: lead.lead_number || '',
        customer_name: lead.customer_name || '',
        vehicle_number: lead.vehicle_number || '',
        vehicle_make: lead.vehicle_make || '',
        vehicle_model: lead.vehicle_model || '',
        vehicle_variant: lead.vehicle_variant || '',
        problem_description: lead.problem_description || '',
        service_types: serviceTypeLabel ? [serviceTypeLabel] : [],
        service_type_ids: lead.service_type_ids || [],
        mechanic_status: jobData.mechanic_status || 'ASSIGNED',
        job_priority: jobData.job_priority || 'NORMAL',
        sla_remaining_minutes: jobData.sla_remaining_minutes || 0,
        assigned_at: jobData.assigned_at,
        expected_completion_time: jobData.expected_completion_time,
        checklist_completed: !!jobData.checklist_completed,
        before_images_count: jobData.before_images_count || 0,
        progress_images_count: jobData.progress_images_count || 0,
        after_images_count: jobData.after_images_count || 0,
        min_before_images: jobData.min_before_images || 6,
        min_progress_images: jobData.min_progress_images || 0,
        min_after_images: jobData.min_after_images || 4,
        lead_status: lead.status || '',
        qc_status: lead.qc_status || null,
      };
      setJob(detail);
      setWorkNotes(jobData.work_notes || '');

      if (lead.service_type_ids) {
        try {
          const serviceIds = Array.isArray(lead.service_type_ids)
            ? lead.service_type_ids
            : JSON.parse(lead.service_type_ids || '[]');

          if (Array.isArray(serviceIds) && serviceIds.length > 0) {
            const { data: serviceTypesData } = await supabase
              .from('service_types')
              .select('id, name')
              .in('id', serviceIds);

            if (serviceTypesData?.length) {
              setServiceTypeNames(serviceTypesData.map((st) => st.name));
            } else {
              setServiceTypeNames([serviceTypeLabel]);
            }
          } else {
            setServiceTypeNames([serviceTypeLabel]);
          }
        } catch {
          setServiceTypeNames([serviceTypeLabel]);
        }
      } else {
        setServiceTypeNames([serviceTypeLabel]);
      }

      await loadChecklist(mechanicId);
      await Promise.all([
        loadExtraWork(jobData.lead_id || jobId),
        loadWorkVideos(jobData.lead_id || jobId),
      ]);
    } catch (error) {
      console.error('Error fetching job detail:', error);
      Alert.alert('Error', 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  }

  async function updateJobStatus(newStatus: string) {
    if (!jobId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      if (newStatus === 'COMPLETED') {
        const response = await fetch(`${ENV.API_URL}/api/mechanic/jobs/${jobId}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ notes: `Status changed to ${newStatus}` }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.error || 'Failed to complete job');
      } else {
        const response = await fetch(`${ENV.API_URL}/api/mechanic/jobs/${jobId}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ status: newStatus, notes: `Status changed to ${newStatus}` }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.error || 'Failed to update status');
      }

      Alert.alert('Success', `Job status updated to ${newStatus}`);
      fetchJobDetail();
    } catch (error: any) {
      console.error('Error updating status:', error);
      Alert.alert('Error', error?.message || 'Failed to update job status');
    }
  }

  async function markExtraWorkDone(extraWorkId: string) {
    if (!job?.lead_id) return;
    try {
      setCompletingExtraId(extraWorkId);
      await apiFetch(`/api/mechanic/jobs/${job.lead_id}/extra-work/${extraWorkId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark: String(extraRemarkById[extraWorkId] || '').trim() }),
      });
      await loadExtraWork(job.lead_id);
      Alert.alert('Done', 'Additional job marked as completed');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to mark extra work done');
    } finally {
      setCompletingExtraId(null);
    }
  }

  async function uploadExtraProofFile(extraWorkId: string, uri: string, isVideo: boolean) {
    if (!job?.lead_id) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');

    const formData = new FormData();
    const ext = isVideo ? 'mp4' : 'jpg';
    // @ts-ignore React Native FormData file
    formData.append('file', {
      uri,
      name: `extra-${extraWorkId}.${ext}`,
      type: isVideo ? 'video/mp4' : 'image/jpeg',
    });
    formData.append('photo_type', `EXTRA_WORK-${extraWorkId}`);
    formData.append('photo_category', 'extra');
    formData.append('notes', extraWorkId);

    const response = await fetch(`${ENV.API_URL}/api/mechanic/jobs/${job.lead_id}/upload-photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.details || result?.error || 'Failed to upload');
  }

  async function pickExtraProof(extraWorkId: string) {
    try {
      setUploadingProofId(extraWorkId);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission', 'Gallery access chahiye photo / video add karne ke liye.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });
      if (result.canceled || !result.assets?.length) return;
      for (const asset of result.assets) {
        const isVideo = asset.type === 'video' || /\.(mp4|mov|m4v|webm|3gp)$/i.test(asset.uri || '');
        await uploadExtraProofFile(extraWorkId, asset.uri, isVideo);
      }
      await loadExtraWork(job?.lead_id || '');
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message || 'Could not upload photo / video');
    } finally {
      setUploadingProofId(null);
    }
  }

  async function updateChecklistItem(itemId: string, status: string, remark?: string) {
    try {
      // Get current item
      const currentItem = checklist.find(item => item.id === itemId);
      if (!currentItem) return;

      // Update local state first
      const updatedChecklist = checklist.map(item =>
        item.id === itemId
          ? { 
              ...item, 
              status, 
              remark: remark !== undefined ? remark : item.remark,
              completed_at: status === 'COMPLETED' ? new Date().toISOString() : item.completed_at 
            }
          : item
      );
      setChecklist(updatedChecklist);

      if (status === 'COMPLETED' && job?.mechanic_status === 'ASSIGNED') {
        setJob((prev) => (prev ? { ...prev, mechanic_status: 'IN_PROGRESS' } : prev));
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const response = await fetch(`${ENV.API_URL}/api/mechanic/jobs/${jobId}/checklist`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          item_id: itemId,
          status,
          notes: currentItem.notes || '',
          remark: remark !== undefined ? remark : currentItem.remark || ''
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update checklist');
      }
    } catch (error: any) {
      console.error('Error updating checklist:', error);
      Alert.alert('Error', error.message || 'Failed to update checklist');
      // Revert local state on error
      fetchJobDetail();
    }
  }

  async function saveWorkNotes() {
    try {
      const { error } = await supabase
        .from('mechanic_jobs')
        .update({
          work_notes: workNotes,
          updated_at: new Date().toISOString()
        })
        .eq('lead_id', jobId);

      if (error) throw error;

      Alert.alert('Success', 'Work notes saved');
    } catch (error) {
      console.error('Error saving notes:', error);
      Alert.alert('Error', 'Failed to save work notes');
    }
  }

  if (loading) {
    const LoadingShell: any = hideChrome || embedInShell ? View : SafeAreaView;
    return (
      <LoadingShell style={styles.container} {...(hideChrome || embedInShell ? {} : { edges: ['top'] })}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </LoadingShell>
    );
  }

  if (!job) {
    const ErrorShell: any = hideChrome || embedInShell ? View : SafeAreaView;
    return (
      <ErrorShell style={styles.container} {...(hideChrome || embedInShell ? {} : { edges: ['top'] })}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Job not found</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ErrorShell>
    );
  }

  const checklistDone = checklist.filter((i) => i.status === 'COMPLETED').length;
  const checklistTotal = checklist.length;
  const checklistPct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;
  const pendingExtra = extraWork.filter((r) => String(r.status || '').toUpperCase() === 'PENDING');
  const displayStatus = resolveMechanicDisplayStatus(
    job.mechanic_status,
    checklistDone,
    checklistTotal,
    pendingExtra.length > 0,
  );
  const statusColors = mechanicStatusColors(displayStatus);
  const qcPending =
    ['PENDING', 'REWORK', 'REWORK_REQUIRED'].includes(String(job.qc_status || '').toUpperCase()) ||
    ['WORK_COMPLETED', 'QC_PENDING', 'REWORK_REQUIRED'].includes(String(job.lead_status || '').toUpperCase());
  const jobNotDone = displayStatus !== 'COMPLETED' || qcPending;
  const workUnderway =
    displayStatus === 'IN_PROGRESS' ||
    displayStatus === 'HOLD' ||
    displayStatus === 'WAITING_APPROVAL' ||
    checklistDone > 0;
  const showBeforePhotos = jobNotDone;
  const showDuringPhotos = workUnderway || qcPending;
  const showAfterPhotos = workUnderway || qcPending;
  const canCompleteJob = displayStatus === 'IN_PROGRESS' &&
                         job.checklist_completed &&
                         job.before_images_count >= job.min_before_images &&
                         job.after_images_count >= job.min_after_images;
  const inShell = hideChrome || embedInShell;
  const Shell: any = inShell ? View : SafeAreaView;
  const shellProps = inShell
    ? { style: styles.container }
    : { style: styles.container, edges: ['top'] as const };

  const slaUrgent = job.sla_remaining_minutes < 60;
  const slaOverdue = job.sla_remaining_minutes < 0;
  const slaHeroText = slaOverdue
    ? `${Math.abs(job.sla_remaining_minutes)}m over`
    : slaUrgent
    ? `${job.sla_remaining_minutes}m left`
    : `${Math.floor(job.sla_remaining_minutes / 60)}h ${job.sla_remaining_minutes % 60}m`;

  function heroStatusBadgeStyle(status: string): { bg: string; fg: string } {
    const s = String(status || '').toUpperCase();
    if (s === 'IN_PROGRESS') return { bg: '#2563EB', fg: '#FFFFFF' };
    if (s === 'ASSIGNED') return { bg: '#059669', fg: '#FFFFFF' };
    if (s === 'HOLD' || s === 'WAITING_APPROVAL') return { bg: '#F59E0B', fg: '#FFFFFF' };
    if (s === 'COMPLETED') return { bg: '#7C3AED', fg: '#FFFFFF' };
    return { bg: 'rgba(255,255,255,0.22)', fg: '#FFFFFF' };
  }
  const heroStatus = heroStatusBadgeStyle(displayStatus);

  function renderChecklistRow(item: ChecklistItem, index: number) {
    const done = item.status === 'COMPLETED';
    return (
      <View key={item.id} style={styles.checklistRowWrap}>
        <TouchableOpacity
          style={[styles.checklistRow, done && styles.checklistRowDone]}
          onPress={() =>
            updateChecklistItem(item.id, done ? 'PENDING' : 'COMPLETED', item.remark)
          }
          activeOpacity={0.7}
        >
          <Text style={styles.checklistIndex}>{index + 1}</Text>
          <View style={[styles.checkbox, done && styles.checkboxDone]}>
            {done ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <View style={styles.checklistContent}>
            <Text style={[styles.checklistText, done && styles.checklistTextCompleted]} numberOfLines={2}>
              {item.name}
            </Text>
            {item.mandatory ? (
              <Text style={styles.requiredDot}>Required</Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => setExpandedRemarkId(expandedRemarkId === item.id ? null : item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.remarkToggle}>{expandedRemarkId === item.id ? '−' : '+'}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
        {expandedRemarkId === item.id ? (
          <TextInput
            style={styles.remarkInputCompact}
            value={item.remark || ''}
            onChangeText={(text) => {
              setChecklist((prev) =>
                prev.map((i) => (i.id === item.id ? { ...i, remark: text } : i)),
              );
            }}
            onBlur={() => updateChecklistItem(item.id, item.status, item.remark)}
            placeholder="Remark (optional)"
          />
        ) : null}
      </View>
    );
  }

  function renderChecklistTab() {
    if (checklistTotal === 0) {
      return (
        <View style={styles.emptyChecklist}>
          <Text style={styles.emptyChecklistTitle}>Checklist loading…</Text>
          <Text style={styles.emptyChecklistSub}>General Service points yahan dikhenge</Text>
        </View>
      );
    }

    return (
      <View style={styles.checklistPanel}>
        <View style={styles.checklistProgressHead}>
          <Text style={styles.checklistProgressLabel}>
            {checklistDone} / {checklistTotal} done ({checklistPct}%)
          </Text>
          <View style={styles.checklistProgressTrack}>
            <View style={[styles.checklistProgressFill, { width: `${checklistPct}%` }]} />
          </View>
        </View>

        {checklist.map((item, index) => renderChecklistRow(item, index))}
      </View>
    );
  }

  return (
    <Shell {...shellProps}>
      {!inShell ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.leadNumber} numberOfLines={1}>{job.customer_name || 'Job'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.fg }]}>
            <Text style={styles.statusText}>{mechanicStatusLabel(displayStatus)}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.heroCard}>
          <View style={styles.heroAccent} />
          <View style={styles.heroAccentSm} />
          <View style={styles.heroBody}>
            <View style={styles.compactTitleRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.compactName} numberOfLines={1}>{job.customer_name}</Text>
                <Text style={styles.compactVehicle} numberOfLines={1}>
                  {job.vehicle_number} · {job.vehicle_make} {job.vehicle_model}
                </Text>
                {job.lead_number ? (
                  <Text style={styles.compactLeadNo}>{job.lead_number}</Text>
                ) : null}
              </View>
              <View style={[styles.statusBadgeHero, { backgroundColor: heroStatus.bg }]}>
                <Text style={[styles.statusTextHero, { color: heroStatus.fg }]}>
                  {mechanicStatusLabel(displayStatus).toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.heroChipsRow}>
              <View style={[
                styles.heroChip,
                slaOverdue ? styles.heroChipOverdue : slaUrgent ? styles.heroChipWarn : styles.heroChipOk,
              ]}>
                <Text style={[
                  styles.heroChipText,
                  slaOverdue ? styles.heroChipTextOverdue : slaUrgent ? styles.heroChipTextWarn : null,
                ]}>
                  SLA {slaHeroText}
                </Text>
              </View>
              {checklistTotal > 0 ? (
                <View style={[styles.heroChip, styles.heroChipChecklist]}>
                  <Text style={styles.heroChipTextChecklist}>
                    {checklistDone}/{checklistTotal} checklist
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      )}

      {!inShell ? (
        <View style={[
          styles.slaContainer,
          { backgroundColor: job.sla_remaining_minutes < 0 ? '#fee2e2' : job.sla_remaining_minutes < 60 ? '#fef3c7' : '#d1fae5' },
        ]}>
          <Text style={styles.slaLabel}>SLA</Text>
          <Text style={[
            styles.slaValue,
            { color: job.sla_remaining_minutes < 0 ? '#991b1b' : job.sla_remaining_minutes < 60 ? '#78350f' : '#065f46' },
          ]}>
            {job.sla_remaining_minutes < 0
              ? `Overdue ${Math.abs(job.sla_remaining_minutes)}m`
              : job.sla_remaining_minutes < 60
              ? `${job.sla_remaining_minutes}m left`
              : `${Math.floor(job.sla_remaining_minutes / 60)}h ${job.sla_remaining_minutes % 60}m`}
          </Text>
        </View>
      ) : null}

      <View style={styles.contentSheet}>
        <View style={styles.actionsRow}>
          {showBeforePhotos ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary]}
              onPress={() => navigation.navigate('BeforeInspection', { jobId: job.id, leadId: job.lead_id })}
              activeOpacity={0.85}
            >
              <Text style={styles.actionPrimaryText} numberOfLines={1}>Before</Text>
            </TouchableOpacity>
          ) : null}
          {showDuringPhotos ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionDuring]}
              onPress={() =>
                navigation.navigate('DuringServicePhotos', {
                  jobId: job.id,
                  leadId: job.lead_id,
                  leadNumber: job.lead_number,
                  customerName: job.customer_name,
                })
              }
              activeOpacity={0.85}
            >
              <Text style={styles.actionDuringText} numberOfLines={1}>During</Text>
            </TouchableOpacity>
          ) : null}
          {showAfterPhotos ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionSecondary]}
              onPress={() =>
                navigation.navigate('AfterServicePhotos', {
                  jobId: job.id,
                  leadId: job.lead_id,
                  leadNumber: job.lead_number,
                  customerName: job.customer_name,
                })
              }
              activeOpacity={0.85}
            >
              <Text style={styles.actionSecondaryText} numberOfLines={1}>After Photos</Text>
            </TouchableOpacity>
          ) : null}
          {showAfterPhotos ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionVideo]}
              onPress={() => void pickServiceVideos()}
              activeOpacity={0.85}
              disabled={uploadingWorkVideo}
            >
              <Text style={styles.actionVideoText} numberOfLines={1}>
                {uploadingWorkVideo ? 'Uploading...' : 'Videos'}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionAccent]}
            onPress={() => navigation.navigate('MechanicExtraWorkRequest', { leadId: job.lead_id })}
            activeOpacity={0.85}
          >
            <Text style={styles.actionAccentText} numberOfLines={1}>Extra Work</Text>
          </TouchableOpacity>
        </View>

        {extraWork.length > 0 ? (
          <TouchableOpacity
            style={styles.extraBanner}
            onPress={() => setActiveTab('extra')}
            activeOpacity={0.85}
          >
            <Text style={styles.extraBannerTitle}>
              {pendingExtra.length > 0
                ? `Additional job pending (${pendingExtra.length})`
                : 'Additional job requested'}
            </Text>
            <Text style={styles.extraBannerSub} numberOfLines={2}>
              {pendingExtra[0]?.description || extraWork[0]?.description}
              {pendingExtra[0]?.amount || extraWork[0]?.amount
                ? ` · ₹${Number(pendingExtra[0]?.amount || extraWork[0]?.amount).toLocaleString('en-IN')}`
                : ''}
            </Text>
            <Text style={styles.extraBannerLink}>View request</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.tabsContainer}>
          {([
            { id: 'overview', label: 'Overview' },
            { id: 'checklist', label: 'Checklist' },
            { id: 'extra', label: 'Extra' },
            { id: 'notes', label: 'Notes' },
          ] as const).map((tab) => {
            const active = activeTab === tab.id;
            const extraCount = tab.id === 'extra' ? pendingExtra.length || extraWork.length : 0;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {tab.id === 'extra' && extraCount > 0 ? (
                  <View style={[styles.tabBadge, pendingExtra.length > 0 && styles.tabBadgeWarn]}>
                    <Text style={[styles.tabBadgeTxt, pendingExtra.length > 0 && styles.tabBadgeTxtWarn]}>
                      {extraCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 'overview' && (
          <View style={styles.tabPanel}>
            <View style={styles.section}>
              <Text style={styles.sectionEyebrow}>Vehicle</Text>
              <Text style={styles.sectionMainText}>
                {job.vehicle_number}
              </Text>
              <Text style={styles.detailText}>
                {[job.vehicle_make, job.vehicle_model, job.vehicle_variant].filter(Boolean).join(' · ')}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionEyebrow}>Service</Text>
              <View style={styles.tagsContainer}>
                {(serviceTypeNames.length > 0 ? serviceTypeNames : job.service_types).map((type, idx) => (
                  <View key={idx} style={styles.tag}>
                    <Text style={styles.tagText}>{type}</Text>
                  </View>
                ))}
              </View>
            </View>

            {job.problem_description ? (
              <View style={styles.section}>
                <Text style={styles.sectionEyebrow}>Customer complaint</Text>
                <Text style={styles.detailText}>{job.problem_description}</Text>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionEyebrow}>Work progress</Text>
              <View style={styles.progressGrid}>
                <TouchableOpacity
                  style={[styles.progressCard, styles.progressCardBefore]}
                  onPress={() => navigation.navigate('BeforeInspection', { jobId: job.id, leadId: job.lead_id })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.progressTitle}>Before</Text>
                  <Text style={styles.progressValue}>
                    {job.before_images_count}/{job.min_before_images}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.progressCard, styles.progressCardMid]}
                  onPress={() =>
                    navigation.navigate('DuringServicePhotos', {
                      jobId: job.id,
                      leadId: job.lead_id,
                      leadNumber: job.lead_number,
                      customerName: job.customer_name,
                    })
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.progressTitle}>During</Text>
                  <Text style={styles.progressValue}>
                    {job.progress_images_count}/{job.min_progress_images || '—'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.progressCard, styles.progressCardAfter]}
                  onPress={() =>
                    navigation.navigate('AfterServicePhotos', {
                      jobId: job.id,
                      leadId: job.lead_id,
                      leadNumber: job.lead_number,
                      customerName: job.customer_name,
                    })
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.progressTitle}>After</Text>
                  <Text style={styles.progressValue}>
                    {job.after_images_count}/{job.min_after_images}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.serviceVideoBox}>
                <Text style={styles.serviceVideoTitle}>Service videos</Text>
                <Text style={styles.serviceVideoHint}>
                  Extra work alag hai. Yahan regular service ka video add karo — QC pe Work videos mein dikhega.
                </Text>
                <View style={styles.extraProofRow}>
                  {workVideos.map((clip) => (
                    <View key={clip.id} style={styles.extraProofThumb}>
                      <View style={styles.extraProofVideo}>
                        <Text style={styles.extraProofVideoTxt}>VIDEO</Text>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[styles.extraProofBtn, { flex: 1, minWidth: 120 }, uploadingWorkVideo && { opacity: 0.6 }]}
                    onPress={() => void pickServiceVideos()}
                    disabled={uploadingWorkVideo}
                  >
                    <Text style={styles.extraProofBtnTxt}>
                      {uploadingWorkVideo ? 'Uploading...' : 'Add service video'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {checklistTotal > 0 ? (
                <View style={styles.overviewChecklistBar}>
                  <View style={styles.overviewChecklistTrack}>
                    <View style={[styles.overviewChecklistFill, { width: `${checklistPct}%` }]} />
                  </View>
                  <Text style={styles.overviewChecklistLabel}>
                    Checklist {checklistDone} of {checklistTotal} ({checklistPct}%)
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {activeTab === 'checklist' && (
          <View style={styles.tabPanel}>{renderChecklistTab()}</View>
        )}

        {activeTab === 'extra' && (
          <View style={styles.tabPanel}>
            <TouchableOpacity
              onPress={() => setActiveTab('overview')}
              style={styles.inPageBack}
              activeOpacity={0.7}
            >
              <Text style={styles.inPageBackText}>← Back to job</Text>
            </TouchableOpacity>
            {extraWork.length === 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionEyebrow}>Additional job</Text>
                <Text style={styles.detailText}>
                  No extra work requested yet. Use Extra Work if you find additional repairs.
                </Text>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={() => navigation.navigate('MechanicExtraWorkRequest', { leadId: job.lead_id })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.saveButtonText}>Request extra work</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
              <View style={styles.section}>
                <Text style={styles.sectionEyebrow}>Additional job</Text>
                <Text style={styles.detailText}>
                  After advisor approval, do the extra work then tap Mark work done on the card. After photos stay on After Photos.
                </Text>
              </View>
              {extraWork.map((req) => {
                const status = String(req.status || 'PENDING').toUpperCase();
                const workDone = Boolean(req.work_completed || req.work_completed_at);
                const busy = completingExtraId === req.id;
                return (
                  <View key={req.id} style={styles.extraCard}>
                    <View style={styles.extraCardTop}>
                      <Text style={styles.extraCardTitle} numberOfLines={2}>{req.description}</Text>
                      <View style={[
                        styles.extraStatus,
                        status === 'APPROVED' && styles.extraStatusOk,
                        status === 'REJECTED' && styles.extraStatusBad,
                      ]}>
                        <Text style={styles.extraStatusTxt}>
                          {workDone ? 'DONE' : status.replace(/_/g, ' ')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.extraMeta}>{formatExtraCategory(req.category)}</Text>
                    {req.reason ? (
                      <Text style={styles.detailText}>{req.reason}</Text>
                    ) : null}
                    <Text style={styles.extraAmount}>
                      ₹{Number(req.amount || 0).toLocaleString('en-IN')}
                      {req.is_urgent ? '  ·  Urgent' : ''}
                    </Text>
                    {status === 'PENDING' ? (
                      <Text style={styles.extraWait}>Waiting for advisor approval</Text>
                    ) : null}
                    {status === 'APPROVED' || workDone ? (
                      <View style={styles.extraProofBox}>
                        <Text style={styles.extraCompleteHint}>Photos / videos of this extra work</Text>
                        <View style={styles.extraProofRow}>
                          {extraProof.filter((p) => p.extraWorkId === req.id).map((p) => (
                            <View key={p.id} style={styles.extraProofThumb}>
                              {p.isVideo ? (
                                <View style={styles.extraProofVideo}>
                                  <Text style={styles.extraProofVideoTxt}>VIDEO</Text>
                                </View>
                              ) : (
                                <Image source={{ uri: p.uri }} style={styles.extraProofImg} />
                              )}
                            </View>
                          ))}
                        </View>
                        <TouchableOpacity
                          style={[styles.extraProofBtn, uploadingProofId === req.id && { opacity: 0.6 }]}
                          disabled={uploadingProofId === req.id}
                          onPress={() => pickExtraProof(req.id)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.extraProofBtnTxt}>
                            {uploadingProofId === req.id ? 'Uploading...' : 'Add photo / video'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    {status === 'APPROVED' && !workDone ? (
                      <View style={styles.extraCompleteBox}>
                        <Text style={styles.extraCompleteHint}>
                          Do this extra work, then mark it done here. After photos stay on After Photos.
                        </Text>
                        <TextInput
                          style={styles.extraRemark}
                          value={extraRemarkById[req.id] ?? ''}
                          onChangeText={(text) =>
                            setExtraRemarkById((prev) => ({ ...prev, [req.id]: text }))
                          }
                          placeholder="Remark (optional) e.g. replaced, checked"
                          placeholderTextColor="#94A3B8"
                        />
                        <TouchableOpacity
                          style={[styles.saveButton, busy && { opacity: 0.6 }]}
                          disabled={busy}
                          onPress={() => markExtraWorkDone(req.id)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.saveButtonText}>
                            {busy ? 'Saving...' : 'Mark work done'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    {workDone ? (
                      <Text style={styles.extraDone}>
                        Work completed
                        {req.work_completion_remark ? ` · ${req.work_completion_remark}` : ''}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
              </>
            )}
          </View>
        )}

        {activeTab === 'notes' && (
          <View style={styles.tabPanel}>
            <View style={styles.section}>
              <Text style={styles.sectionEyebrow}>Work notes</Text>
              <Text style={styles.notesHint}>Observations, complications, parts used…</Text>
              <TextInput
                style={styles.textArea}
                value={workNotes}
                onChangeText={setWorkNotes}
                placeholder="Type your notes here…"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />
              <TouchableOpacity style={styles.saveButton} onPress={saveWorkNotes} activeOpacity={0.85}>
                <Text style={styles.saveButtonText}>Save notes</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
      </View>
    </Shell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF2F7',
  },
  heroCard: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 0,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#023D95',
    shadowColor: '#023D95',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  heroAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.07)',
    transform: [{ translateX: 40 }, { translateY: -40 }],
  },
  heroAccentSm: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroBody: {
    padding: 16,
    paddingBottom: 14,
  },
  heroChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  heroChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroChipOk: {
    backgroundColor: 'rgba(167, 243, 208, 0.18)',
    borderColor: 'rgba(167, 243, 208, 0.35)',
  },
  heroChipWarn: {
    backgroundColor: 'rgba(254, 243, 199, 0.22)',
    borderColor: 'rgba(253, 224, 71, 0.4)',
  },
  heroChipOverdue: {
    backgroundColor: 'rgba(254, 202, 202, 0.22)',
    borderColor: 'rgba(248, 113, 113, 0.45)',
  },
  heroChipChecklist: {
    backgroundColor: 'rgba(219, 234, 254, 0.22)',
    borderColor: 'rgba(147, 197, 253, 0.45)',
  },
  heroChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ECFDF5',
  },
  heroChipTextWarn: {
    color: '#FEF3C7',
  },
  heroChipTextOverdue: {
    color: '#FECACA',
  },
  heroChipTextChecklist: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DBEAFE',
  },
  statusBadgeHero: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusTextHero: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  compactLeadNo: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.62)',
    marginTop: 3,
    fontWeight: '600',
  },
  actionBtn: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '46%',
    minWidth: 96,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  actionPrimary: {
    backgroundColor: '#004AAD',
    borderColor: '#004AAD',
  },
  actionPrimaryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  actionSecondary: {
    backgroundColor: '#fff',
    borderColor: '#6366F1',
  },
  actionSecondaryText: {
    color: '#4338CA',
    fontSize: 12,
    fontWeight: '800',
  },
  actionDuring: {
    backgroundColor: '#fff',
    borderColor: '#EA580C',
  },
  actionDuringText: {
    color: '#C2410C',
    fontSize: 12,
    fontWeight: '800',
  },
  actionAccent: {
    backgroundColor: '#fff',
    borderColor: '#F59E0B',
  },
  actionAccentText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '800',
  },
  actionVideo: {
    backgroundColor: '#fff',
    borderColor: '#0F172A',
  },
  actionVideoText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  serviceVideoBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  serviceVideoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  serviceVideoHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
  },
  leadNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  slaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
  },
  slaLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  slaValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  actionsContainerCompact: {
    paddingTop: 0,
  },
  actionBtnCompact: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  buttonTextCompact: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  compactTop: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  compactTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  compactName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  compactVehicle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 3,
    fontWeight: '500',
  },
  slaContainerCompact: {
    marginHorizontal: 12,
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#3b82f6',
  },
  uploadButton: {
    backgroundColor: '#8b5cf6',
  },
  completeButton: {
    backgroundColor: '#10b981',
  },
  extraWorkButton: {
    backgroundColor: '#f59e0b',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  contentSheet: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    overflow: 'hidden',
    shadowColor: '#023D95',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    paddingHorizontal: 2,
  },
  tab: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: {
    borderBottomColor: '#004AAD',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#004AAD',
    fontWeight: '800',
  },
  tabBadge: {
    backgroundColor: '#EEF2F7',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tabBadgeWarn: {
    backgroundColor: '#FFEDD5',
  },
  tabBadgeTxt: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
  },
  tabBadgeTxtWarn: {
    color: '#C2410C',
  },
  extraBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  extraBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9A3412',
  },
  extraBannerSub: {
    fontSize: 12,
    color: '#9A3412',
    marginTop: 3,
  },
  extraBannerLink: {
    fontSize: 12,
    fontWeight: '800',
    color: '#004AAD',
    marginTop: 6,
  },
  extraCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  extraCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  extraCardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#023D95',
  },
  extraStatus: {
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  extraStatusOk: { backgroundColor: '#059669' },
  extraStatusBad: { backgroundColor: '#DC2626' },
  extraStatusTxt: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  extraMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 6,
    marginBottom: 4,
  },
  extraAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#004AAD',
    marginTop: 8,
  },
  extraWait: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C2410C',
    marginTop: 6,
  },
  extraCompleteBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FED7AA',
  },
  extraCompleteHint: {
    fontSize: 12,
    color: '#9A3412',
    lineHeight: 16,
    marginBottom: 8,
  },
  extraRemark: {
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
    marginBottom: 8,
  },
  extraDone: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
    marginTop: 8,
  },
  extraProofBox: {
    marginTop: 10,
  },
  extraProofRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  extraProofThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  extraProofImg: {
    width: 64,
    height: 64,
  },
  extraProofVideo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    width: 64,
    height: 64,
  },
  extraProofVideoTxt: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  extraProofBtn: {
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  extraProofBtnTxt: {
    color: '#004AAD',
    fontWeight: '800',
    fontSize: 13,
  },
  inPageBack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  inPageBackText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#004AAD',
  },
  tabPanel: {
    paddingTop: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 32,
  },
  section: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  sectionMainText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#023D95',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#023D95',
    marginBottom: 10,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  tagText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  progressGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  progressCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    borderTopWidth: 3,
  },
  progressCardBefore: { borderTopColor: '#6366F1' },
  progressCardMid: { borderTopColor: '#F59E0B' },
  progressCardAfter: { borderTopColor: '#10B981' },
  overviewChecklistBar: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  overviewChecklistTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  overviewChecklistFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 999,
  },
  overviewChecklistLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  notesHint: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#004AAD',
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  progressTitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  progressValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  checklistPanel: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  checklistProgressHead: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    backgroundColor: '#FFFFFF',
  },
  checklistProgressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#023D95',
    marginBottom: 6,
  },
  checklistProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  checklistProgressFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 999,
  },
  categoryBlock: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  checklistRowWrap: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#fff',
  },
  checklistIndex: {
    width: 22,
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    textAlign: 'right',
  },
  checklistRowDone: {
    backgroundColor: '#f0fdf4',
  },
  remarkToggle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#94a3b8',
    width: 24,
    textAlign: 'center',
  },
  remarkInputCompact: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
  },
  requiredDot: {
    fontSize: 10,
    color: '#b45309',
    fontWeight: '600',
    marginTop: 2,
  },
  emptyChecklist: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyChecklistTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#023D95',
  },
  emptyChecklistSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  checkboxDone: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 6,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  checklistContent: {
    flex: 1,
  },
  checklistText: {
    fontSize: 14,
    color: '#111827',
  },
  checklistTextCompleted: {
    color: '#6b7280',
  },
  requiredBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  requiredText: {
    fontSize: 10,
    color: '#991b1b',
    fontWeight: '600',
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: '#f8fafc',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    minHeight: 160,
    color: '#0F172A',
    lineHeight: 21,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
  },
});

