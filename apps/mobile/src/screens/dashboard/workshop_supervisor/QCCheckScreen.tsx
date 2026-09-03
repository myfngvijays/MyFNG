import React, { useState, useEffect } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Image,
  BackHandler,
  Linking,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { AC } from '../../../components/workshop/advisorCrmUi';
import AdvisorFilterBar from '../../../components/workshop/AdvisorFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { isPendingQc, qcQueueTab } from '../../../lib/workshopJobFlow';
import { ENV } from '../../../config/environment';
import { apiFetch } from '../../../lib/api';

interface QCJob {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  mechanic_name: string;
  service_types: string[];
  mechanic_status: string;
  status?: string;
  completed_at: string;
  checklist_completed: boolean;
  before_images_count: number;
  after_images_count: number;
  qc_status?: string;
}

interface ChecklistItem {
  id: string;
  item_name: string;
  is_completed: boolean;
  notes?: string;
}

interface QcMedia {
  id: string;
  url: string;
  label: string;
  isVideo?: boolean;
}

interface ExtraWorkRow {
  id: string;
  label: string;
  status: string;
  amount?: number | null;
}

export default function QCCheckScreen({ navigation }: any) {
  const { userProfile } = useAuth();
  const [jobs, setJobs] = useState<QCJob[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<QCJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<QCJob | null>(null);
  const [showQCModal, setShowQCModal] = useState(false);
  const [qcChecklist, setQcChecklist] = useState<ChecklistItem[]>([]);
  const [showAllQcChecklist, setShowAllQcChecklist] = useState(false);
  const [qcNotes, setQcNotes] = useState('');
  const [qcStatus, setQcStatus] = useState<'PASS' | 'FAIL' | 'REWORK'>('PASS');
  const [qcLoading, setQcLoading] = useState(false);
  const [workSummary, setWorkSummary] = useState('');
  const [serviceLabel, setServiceLabel] = useState('');
  const [leadNumber, setLeadNumber] = useState('');
  const [vehicleLine, setVehicleLine] = useState('');
  const [extraWorkRows, setExtraWorkRows] = useState<ExtraWorkRow[]>([]);
  const [photoBuckets, setPhotoBuckets] = useState<{
    before: QcMedia[];
    during: QcMedia[];
    after: QcMedia[];
    videos: QcMedia[];
    extra: QcMedia[];
  }>({ before: [], during: [], after: [], videos: [], extra: [] });
  const [filter, setFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    fetchQCJobs();

    const channel = supabase
      .channel('qc-queue-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mechanic_jobs',
      }, () => {
        fetchQCJobs();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'service_leads',
      }, () => {
        fetchQCJobs();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'qc_checks',
      }, () => {
        fetchQCJobs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.workshop_id]);

  useFocusEffect(
    React.useCallback(() => {
      fetchQCJobs();
    }, [userProfile?.workshop_id]),
  );

  useEffect(() => {
    filterJobs();
  }, [jobs, filter]);

  async function resolveWorkshopId() {
    if (userProfile?.workshop_id) return userProfile.workshop_id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('users_login')
      .select('workshop_id')
      .eq('id', user.id)
      .maybeSingle();

    return data?.workshop_id || null;
  }

  async function fetchQCJobs() {
    try {
      const workshopId = await resolveWorkshopId();
      if (!workshopId) {
        setJobs([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { data: leads, error } = await supabase
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
        .eq('workshop_id', workshopId)
        .is('deleted_at', null)
        .order('mechanic_completed_at', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('❌ Error fetching QC queue:', error);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const leadIds = (leads || []).map((lead) => lead.id);
      const { data: mechanicJobs } = leadIds.length
        ? await supabase
            .from('mechanic_jobs')
            .select('lead_id, completed_at, mechanic_status')
            .in('lead_id', leadIds)
        : { data: [] as any[] };

      const completedAtByLead = new Map<string, string>();
      (mechanicJobs || []).forEach((job: any) => {
        if (job?.lead_id && job?.completed_at && !completedAtByLead.has(job.lead_id)) {
          completedAtByLead.set(job.lead_id, job.completed_at);
        }
      });

      const qcLeads = (leads || [])
        .map((lead) => ({
          ...lead,
          mechanic_completed_at:
            lead.mechanic_completed_at || completedAtByLead.get(lead.id) || null,
        }))
        .filter((lead) => {
          const tab = qcQueueTab(lead);
          return tab === 'PENDING' || tab === 'PASSED' || tab === 'FAILED' || tab === 'REWORK';
        });

      const mechanicIds = [
        ...new Set(qcLeads.map((lead) => lead.assigned_mechanic_id).filter(Boolean)),
      ] as string[];
      const { data: mechanics } = mechanicIds.length
        ? await supabase.from('users_login').select('id, full_name').in('id', mechanicIds)
        : { data: [] as any[] };
      const mechanicNameById = new Map(
        (mechanics || []).map((m: any) => [m.id, m.full_name]),
      );

      const qcLeadIds = qcLeads.map((lead) => lead.id);
      const { data: mediaRows } = qcLeadIds.length
        ? await supabase
            .from('mechanic_media')
            .select('lead_id, media_category')
            .in('lead_id', qcLeadIds)
            .in('media_category', ['BEFORE', 'AFTER'])
        : { data: [] as any[] };

      const mediaCounts = new Map<string, { before: number; after: number }>();
      (mediaRows || []).forEach((row: any) => {
        const prev = mediaCounts.get(row.lead_id) || { before: 0, after: 0 };
        if (row.media_category === 'BEFORE') prev.before += 1;
        if (row.media_category === 'AFTER') prev.after += 1;
        mediaCounts.set(row.lead_id, prev);
      });

      const jobsWithDetails: QCJob[] = qcLeads.map((job) => {
        const counts = mediaCounts.get(job.id) || { before: 0, after: 0 };
        return {
          id: job.id,
          lead_id: job.id,
          lead_number: job.lead_number,
          customer_name: job.customer_name,
          vehicle_number: job.vehicle_number,
          vehicle_make: job.vehicle_make || '',
          vehicle_model: job.vehicle_model || '',
          mechanic_name: mechanicNameById.get(job.assigned_mechanic_id) || 'Unknown',
          service_types: [],
          mechanic_status: 'COMPLETED',
          status: job.status,
          completed_at: job.mechanic_completed_at,
          checklist_completed: true,
          before_images_count: counts.before,
          after_images_count: counts.after,
          qc_status: job.qc_status,
        };
      });

      setJobs(jobsWithDetails);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching QC jobs:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }

  function jobTab(job: QCJob) {
    return qcQueueTab({
      status: job.status,
      qc_status: job.qc_status,
      mechanic_completed_at: job.completed_at,
    });
  }

  function filterJobs() {
    if (filter === 'ALL') {
      setFilteredJobs(jobs);
      return;
    }
    setFilteredJobs(jobs.filter((job) => jobTab(job) === filter));
  }

  function resetQcModal() {
    setShowQCModal(false);
    setSelectedJob(null);
    setQcNotes('');
    setQcStatus('PASS');
    setQcChecklist([]);
    setWorkSummary('');
    setServiceLabel('');
    setLeadNumber('');
    setVehicleLine('');
    setExtraWorkRows([]);
    setPhotoBuckets({ before: [], during: [], after: [], videos: [], extra: [] });
  }

  function parseChecklistItems(raw: unknown): ChecklistItem[] {
    let parsed: any = raw;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = [];
      }
    }
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: any, index: number) => {
      const status = String(item?.status || '').toUpperCase();
      const done =
        item?.is_completed === true ||
        status === 'COMPLETED' ||
        status === 'DONE' ||
        status === 'YES';
      return {
        id: String(item?.id ?? index + 1),
        item_name: String(item?.name || item?.item_name || `Item ${index + 1}`),
        is_completed: done,
        notes: String(item?.notes || item?.remark || '').trim() || undefined,
      };
    });
  }

  function bucketPhotos(rows: any[]) {
    const before: QcMedia[] = [];
    const during: QcMedia[] = [];
    const after: QcMedia[] = [];
    const videos: QcMedia[] = [];
    const extra: QcMedia[] = [];

    (rows || []).forEach((row: any) => {
      const url = String(row?.photo_url || '');
      if (!url) return;
      const type = String(row?.photo_type || '').toUpperCase();
      const cat = String(row?.photo_category || '').toLowerCase();
      const isVideo =
        type.startsWith('AFTER_VIDEO') ||
        type.includes('VIDEO') ||
        /\.(mp4|mov|m4v|webm|3gp)(\?|$)/i.test(url);
      const media: QcMedia = {
        id: String(row.id),
        url,
        label: type || cat || 'PHOTO',
        isVideo,
      };
      if (type.startsWith('EXTRA_WORK')) extra.push(media);
      else if (isVideo) videos.push(media);
      else if (cat === 'before') before.push(media);
      else if (cat === 'during') during.push(media);
      else after.push(media);
    });

    return { before, during, after, videos, extra };
  }

  async function openQCModal(job: QCJob) {
    setSelectedJob(job);
    setQcLoading(true);
    setShowQCModal(true);
    setShowAllQcChecklist(false);

    try {
      const leadId = job.lead_id || job.id;
      const { data: lead } = await supabase
        .from('service_leads')
        .select(
          'id, lead_number, notes, service_type, vehicle_make, vehicle_model, assigned_mechanic_id',
        )
        .eq('id', leadId)
        .maybeSingle();

      setLeadNumber(lead?.lead_number || job.lead_number || '');
      setWorkSummary(String(lead?.notes || '').trim());
      setServiceLabel(String(lead?.service_type || 'General Service'));
      setVehicleLine(
        [job.vehicle_number, lead?.vehicle_make || job.vehicle_make, lead?.vehicle_model || job.vehicle_model]
          .filter(Boolean)
          .join(' · '),
      );

      try {
        const evidence = await apiFetch<{
          photos?: {
            before?: QcMedia[];
            during?: QcMedia[];
            after?: QcMedia[];
            videos?: QcMedia[];
            extra?: QcMedia[];
          };
          extraWork?: ExtraWorkRow[];
        }>(`/api/supervisor/jobs/${leadId}/qc-evidence`);
        setPhotoBuckets({
          before: evidence.photos?.before || [],
          during: evidence.photos?.during || [],
          after: evidence.photos?.after || [],
          videos: evidence.photos?.videos || [],
          extra: evidence.photos?.extra || [],
        });
        setExtraWorkRows(
          (evidence.extraWork || []).map((row: any) => ({
            id: String(row.id),
            label: String(row.label || 'Additional work'),
            status: String(row.status || ''),
            amount: row.amount,
          })),
        );
      } catch {
        setPhotoBuckets({ before: [], during: [], after: [], videos: [], extra: [] });
        setExtraWorkRows([]);
      }

      const mechanicId = lead?.assigned_mechanic_id;
      let checklistQuery = supabase
        .from('service_checklists')
        .select('checklist_items')
        .eq('lead_id', leadId);
      if (mechanicId) checklistQuery = checklistQuery.eq('mechanic_id', mechanicId);
      const { data: checklistData } = await checklistQuery.maybeSingle();
      setQcChecklist(parseChecklistItems(checklistData?.checklist_items));
    } catch (error) {
      console.error('Error loading QC evidence:', error);
    } finally {
      setQcLoading(false);
    }
  }

  async function submitQC() {
    if (!selectedJob) return;
    const leadId = selectedJob.lead_id || selectedJob.id;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      if (qcStatus === 'PASS') {
        const response = await fetch(`${ENV.API_URL}/api/supervisor/jobs/${leadId}/approve-qc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ notes: qcNotes, quality_score: 5 }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Failed to approve QC');
      } else {
        const reason =
          qcNotes.trim() ||
          (qcStatus === 'REWORK' ? 'Rework required after QC' : 'QC failed');
        const response = await fetch(`${ENV.API_URL}/api/supervisor/jobs/${leadId}/reject-qc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            reason,
            notes: qcNotes,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Failed to submit QC');
      }

      Alert.alert(
        'Success',
        qcStatus === 'PASS'
          ? 'QC passed'
          : qcStatus === 'FAIL'
            ? 'QC failed — sent back to mechanic'
            : 'Sent for rework',
        [
          {
            text: 'OK',
            onPress: () => {
              resetQcModal();
              fetchQCJobs();
            },
          },
        ],
      );
    } catch (error: any) {
      console.error('Error submitting QC:', error);
      Alert.alert('Error', error?.message || 'Failed to submit QC. Please try again.');
    }
  }

  function onRefresh() {
    setRefreshing(true);
    fetchQCJobs();
  }

  function renderMediaStrip(title: string, items: QcMedia[]) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {title} ({items.length})
        </Text>
        {items.length === 0 ? (
          <Text style={styles.emptyHint}>None uploaded</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.mediaThumb}
                onPress={() => item.isVideo && item.url ? Linking.openURL(item.url) : undefined}
                activeOpacity={item.isVideo ? 0.8 : 1}
              >
                {item.isVideo ? (
                  <View style={styles.videoThumb}>
                    <Text style={styles.videoThumbTxt}>VIDEO</Text>
                  </View>
                ) : (
                  <Image source={{ uri: item.url }} style={styles.mediaImage} />
                )}
                {item.label ? (
                  <Text style={styles.mediaLabel} numberOfLines={1}>
                    {item.label.replace(/_/g, ' ')}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  function renderJob({ item }: { item: QCJob }) {
    const pending = isPendingQc({
      status: item.status,
      qc_status: item.qc_status,
      mechanic_completed_at: item.completed_at,
    });
    return (
      <View style={AC.navy}>
        <View style={AC.navyRow}>
          <Text style={AC.navyName} numberOfLines={1}>
            {item.customer_name || 'Customer'}
          </Text>
          <View style={AC.navyBadge}>
            <Text style={AC.navyBadgeTxt}>{pending ? 'PENDING' : (item.qc_status || 'PENDING')}</Text>
          </View>
        </View>
        <Text style={AC.navyMeta} numberOfLines={1}>
          {item.vehicle_number}
          {item.mechanic_name ? ` · ${item.mechanic_name}` : ''}
        </Text>
        {item.completed_at ? (
          <Text style={AC.navyMeta}>{formatDateTime(item.completed_at)}</Text>
        ) : null}
        <View style={AC.navyBtnRow}>
          <TouchableOpacity
            style={AC.navyBtn}
            onPress={() => openQCModal(item)}
            disabled={!pending}
          >
            <Text style={AC.navyBtnTxt}>{pending ? 'Start QC' : 'QC done'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={AC.navyBtnGhost}
            onPress={() => navigation.navigate('QCReview', { jobId: item.lead_id || item.id })}
          >
            <Text style={AC.navyBtnGhostTxt}>Review</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const stats = {
    pending: jobs.filter((j) => jobTab(j) === 'PENDING').length,
    passed: jobs.filter((j) => jobTab(j) === 'PASSED').length,
    failed: jobs.filter((j) => jobTab(j) === 'FAILED').length,
    rework: jobs.filter((j) => jobTab(j) === 'REWORK').length,
  };

  return (
    <View style={AC.page}>
      <AdvisorFilterBar
        subtitle={`${stats.pending} jobs pending QC`}
        kpis={[
          { label: 'Pending', value: stats.pending, color: '#004AAD' },
          { label: 'Passed', value: stats.passed, color: '#10B981' },
          { label: 'Failed', value: stats.failed, color: '#EF4444' },
          { label: 'Rework', value: stats.rework, color: '#F59E0B' },
        ]}
        chips={[
          { key: 'PENDING', label: 'PENDING' },
          { key: 'PASSED', label: 'PASSED' },
          { key: 'FAILED', label: 'FAILED' },
          { key: 'REWORK', label: 'REWORK' },
          { key: 'ALL', label: 'ALL' },
        ]}
        activeChip={filter}
        onChip={setFilter}
      />

      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#004AAD']} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={AC.empty}>
            <Text style={AC.emptyTxt}>No jobs for QC</Text>
          </View>
        }
      />

      {/* QC Modal */}
      <Modal
        visible={showQCModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowQCModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Quality Control Check</Text>

              {selectedJob && (
                <View style={styles.selectedJobInfo}>
                  {leadNumber ? (
                    <Text style={styles.leadChip}>#{leadNumber}</Text>
                  ) : null}
                  <Text style={styles.selectedJobNumber}>
                    {selectedJob.customer_name || 'Customer'}
                  </Text>
                  <Text style={styles.selectedJobCustomer}>
                    {vehicleLine || selectedJob.vehicle_number}
                  </Text>
                  <Text style={styles.selectedJobMechanic}>
                    Mechanic: {selectedJob.mechanic_name}
                  </Text>
                  {serviceLabel ? (
                    <Text style={styles.selectedJobMechanic}>Service: {serviceLabel}</Text>
                  ) : null}
                </View>
              )}

              {qcLoading ? (
                <Text style={styles.emptyHint}>Loading job details…</Text>
              ) : (
                <>
                  {workSummary ? (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Work summary</Text>
                      <Text style={styles.bodyText}>{workSummary}</Text>
                    </View>
                  ) : null}

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      Extra work ({extraWorkRows.length})
                    </Text>
                    {extraWorkRows.length === 0 ? (
                      <Text style={styles.emptyHint}>No extra work on this job</Text>
                    ) : (
                      extraWorkRows.map((row) => (
                        <View key={row.id} style={styles.extraRow}>
                          <Text style={styles.checklistItemName}>{row.label}</Text>
                          <Text style={styles.extraMeta}>
                            {row.status}
                            {row.amount != null ? ` · ₹${row.amount}` : ''}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>

                  {renderMediaStrip('Pickup / Before photos', photoBuckets.before)}
                  {renderMediaStrip('During photos', photoBuckets.during)}
                  {renderMediaStrip('After photos', photoBuckets.after)}
                  {renderMediaStrip('Work videos', photoBuckets.videos)}
                  {renderMediaStrip('Extra work proof', photoBuckets.extra)}

                  <View style={styles.section}>
                    <View style={styles.checkHead}>
                      <Text style={styles.sectionTitle}>
                        Mechanic checklist ({qcChecklist.length})
                      </Text>
                      {qcChecklist.length > 10 ? (
                        <TouchableOpacity onPress={() => setShowAllQcChecklist((v) => !v)}>
                          <Text style={styles.viewAllTxt}>
                            {showAllQcChecklist ? 'Show less' : 'View all'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    {qcChecklist.length === 0 ? (
                      <Text style={styles.emptyHint}>No checklist items recorded</Text>
                    ) : (
                      <View style={styles.checklistGrid}>
                        {Array.from(
                          {
                            length: Math.ceil(
                              (showAllQcChecklist ? qcChecklist : qcChecklist.slice(0, 10)).length / 2,
                            ),
                          },
                          (_, row) => {
                          const visible = showAllQcChecklist ? qcChecklist : qcChecklist.slice(0, 10);
                          const pair = visible.slice(row * 2, row * 2 + 2);
                          return (
                            <View key={row} style={styles.checklistPair}>
                              {pair.map((item, col) => {
                                const index = row * 2 + col;
                                return (
                                  <View key={item.id} style={styles.checklistItem}>
                                    <View
                                      style={[
                                        styles.checklistNumBadge,
                                        item.is_completed
                                          ? styles.checklistNumBadgeOn
                                          : styles.checklistNumBadgeOff,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.checklistNum,
                                          item.is_completed ? styles.checklistNumOn : styles.checklistNumOff,
                                        ]}
                                      >
                                        {index + 1}
                                      </Text>
                                    </View>
                                    <View style={styles.checklistItemContent}>
                                      <Text style={styles.checklistItemName} numberOfLines={3}>
                                        {item.item_name}
                                      </Text>
                                      {item.notes ? (
                                        <Text style={styles.checklistItemNotes} numberOfLines={2}>
                                          {item.notes}
                                        </Text>
                                      ) : null}
                                    </View>
                                  </View>
                                );
                              })}
                              {pair.length === 1 ? <View style={styles.checklistItemSpacer} /> : null}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>QC Decision</Text>
                <View style={styles.qcOptions}>
                  <TouchableOpacity
                    style={[
                      styles.qcOption,
                      styles.qcOptionPass,
                      qcStatus === 'PASS' && styles.qcOptionActive,
                    ]}
                    onPress={() => setQcStatus('PASS')}
                  >
                    <Text
                      style={[
                        styles.qcOptionText,
                        qcStatus === 'PASS' && styles.qcOptionTextActive,
                      ]}
                    >
                      PASS
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.qcOption,
                      styles.qcOptionRework,
                      qcStatus === 'REWORK' && styles.qcOptionActive,
                    ]}
                    onPress={() => setQcStatus('REWORK')}
                  >
                    <Text
                      style={[
                        styles.qcOptionText,
                        qcStatus === 'REWORK' && styles.qcOptionTextActive,
                      ]}
                    >
                      REWORK
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.qcOption,
                      styles.qcOptionFail,
                      qcStatus === 'FAIL' && styles.qcOptionActive,
                    ]}
                    onPress={() => setQcStatus('FAIL')}
                  >
                    <Text
                      style={[
                        styles.qcOptionText,
                        qcStatus === 'FAIL' && styles.qcOptionTextActive,
                      ]}
                    >
                      FAIL
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>QC Notes</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Enter your observations and notes..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={4}
                  value={qcNotes}
                  onChangeText={setQcNotes}
                />
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={submitQC}>
                <Text style={styles.submitButtonText}>Submit QC Check</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalCloseButton} onPress={resetQcModal}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#023D95',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  filterContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  filterButtonActive: {
    backgroundColor: '#004AAD',
    borderColor: '#004AAD',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  jobHeader: {
    marginBottom: 12,
  },
  jobInfo: {
    gap: 4,
  },
  leadNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#023D95',
  },
  customerName: {
    fontSize: 16,
    color: '#374151',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  jobDetails: {
    marginBottom: 12,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
  },
  detailLabel: {
    fontSize: 13,
    color: '#6b7280',
    width: 90,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    color: '#023D95',
  },
  qcIndicators: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  indicatorIcon: {
    fontSize: 16,
  },
  indicatorText: {
    fontSize: 12,
    color: '#6b7280',
  },
  qcButton: {
    backgroundColor: '#004AAD',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  qcButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  qcButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  viewDetailsButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  viewDetailsText: {
    fontSize: 13,
    color: '#004AAD',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#023D95',
    marginBottom: 16,
  },
  selectedJobInfo: {
    backgroundColor: '#EAF2FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  selectedJobNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#023D95',
  },
  selectedJobCustomer: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  selectedJobMechanic: {
    fontSize: 13,
    color: '#004AAD',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#023D95',
    marginBottom: 12,
  },
  checkHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  viewAllTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#004AAD',
    marginBottom: 12,
  },
  checklistGrid: {
    gap: 8,
  },
  checklistPair: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  checklistItem: {
    flex: 1,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checklistItemSpacer: {
    flex: 1,
  },
  checklistNumBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  checklistNumBadgeOn: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  checklistNumBadgeOff: {
    backgroundColor: '#fff',
    borderColor: '#CBD5E1',
  },
  checklistIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  checklistItemContent: {
    flex: 1,
  },
  checklistItemName: {
    fontSize: 13,
    color: '#023D95',
    fontWeight: '500',
    lineHeight: 18,
  },
  checklistItemNotes: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  qcOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  qcOption: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.45,
  },
  qcOptionPass: {
    backgroundColor: '#16A34A',
  },
  qcOptionRework: {
    backgroundColor: '#EA580C',
  },
  qcOptionFail: {
    backgroundColor: '#DC2626',
  },
  qcOptionActive: {
    opacity: 1,
  },
  qcOptionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.4,
  },
  qcOptionTextActive: {
    fontSize: 14,
  },
  emptyHint: {
    fontSize: 13,
    color: '#6b7280',
  },
  bodyText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  leadChip: {
    fontSize: 12,
    fontWeight: '700',
    color: '#004AAD',
    marginBottom: 4,
  },
  extraRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  extraMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  checklistNum: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  checklistNumOn: {
    color: '#166534',
  },
  checklistNumOff: {
    color: '#64748B',
  },
  mediaThumb: {
    width: 92,
    marginRight: 8,
  },
  mediaImage: {
    width: 92,
    height: 92,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  videoThumb: {
    width: 92,
    height: 92,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoThumbTxt: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  mediaLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#023D95',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#004AAD',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    paddingVertical: 14,
    backgroundColor: '#6b7280',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

