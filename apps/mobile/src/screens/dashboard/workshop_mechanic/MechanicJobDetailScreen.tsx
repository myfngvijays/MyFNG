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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ENV } from '../../../config/environment';
import { fetchMechanicJobs } from '../../../lib/mechanicJobs';
import { parseServiceChecklistItems, sortServiceChecklistItems } from '../../../lib/serviceChecklist';
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

export default function MechanicJobDetailScreen({
  hideChrome = false,
  embedInShell = false,
}: {
  hideChrome?: boolean;
  embedInShell?: boolean;
}) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = (route.params || {}) as { jobId?: string; leadId?: string };
  const jobId = params.jobId || params.leadId;
  const [job, setJob] = useState<JobDetail | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
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
    fetchJobDetail();

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
        service_type_ids
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
  const displayStatus = resolveMechanicDisplayStatus(job.mechanic_status, checklistDone, checklistTotal);
  const statusColors = mechanicStatusColors(displayStatus);
  const canStartJob = displayStatus === 'ASSIGNED' && checklistDone === 0;
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

      <View style={[styles.actionsContainer, inShell && styles.actionsContainerCompact]}>
        {canStartJob ? (
          <TouchableOpacity
            style={[styles.actionOutline, styles.actionPrimary]}
            onPress={() => navigation.navigate('BeforeInspection', { jobId: job.id, leadId: job.lead_id })}
          >
            <Text style={styles.actionPrimaryText}>Before Inspection</Text>
          </TouchableOpacity>
        ) : null}
        {displayStatus === 'IN_PROGRESS' ? (
          <TouchableOpacity
            style={[styles.actionOutline, styles.actionSecondary]}
            onPress={() => navigation.navigate('AfterServicePhotos', { jobId: job.id, leadId: job.lead_id })}
          >
            <Text style={styles.actionSecondaryText}>After Photos</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.actionOutline, styles.actionAccent]}
          onPress={() => navigation.navigate('MechanicExtraWorkRequest', { leadId: job.lead_id })}
        >
          <Text style={styles.actionAccentText}>Extra Work</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentSheet}>
        <View style={styles.tabsContainer}>
          {([
            { id: 'overview', label: 'Overview' },
            {
              id: 'checklist',
              label: checklistTotal > 0 ? `Checklist (${checklistDone}/${checklistTotal})` : 'Checklist',
            },
            { id: 'notes', label: 'Notes' },
          ] as const).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                  {tab.label}
                </Text>
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
                <View style={[styles.progressCard, styles.progressCardBefore]}>
                  <Text style={styles.progressTitle}>Before</Text>
                  <Text style={styles.progressValue}>
                    {job.before_images_count}/{job.min_before_images}
                  </Text>
                </View>
                <View style={[styles.progressCard, styles.progressCardMid]}>
                  <Text style={styles.progressTitle}>During</Text>
                  <Text style={styles.progressValue}>
                    {job.progress_images_count}/{job.min_progress_images || '—'}
                  </Text>
                </View>
                <View style={[styles.progressCard, styles.progressCardAfter]}>
                  <Text style={styles.progressTitle}>After</Text>
                  <Text style={styles.progressValue}>
                    {job.after_images_count}/{job.min_after_images}
                  </Text>
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
  actionOutline: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
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
  actionAccent: {
    backgroundColor: '#fff',
    borderColor: '#F59E0B',
  },
  actionAccentText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '800',
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
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
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
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: {
    borderBottomColor: '#004AAD',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#004AAD',
    fontWeight: '800',
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

