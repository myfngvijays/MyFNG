import React, { useState, useEffect } from 'react';
import { formatDateTime } from '@/lib/dateFormat';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { ENV } from '../../../config/environment';
import { parseServiceChecklistItems } from '../../../lib/serviceChecklist';
import { useRoute, useNavigation } from '@react-navigation/native';
import { COLORS } from '../../../constants/theme';
import { AC } from '../../../components/workshop/advisorCrmUi';
import { FLOOR_DONE_STATUSES, isQcPassed, latestMechanicJobForLead } from '../../../lib/workshopJobFlow';

interface JobDetail {
  id: string;
  lead_id: {
    id: string;
    lead_number: string;
    customer_name: string;
    vehicle_number: string;
    service_type: string;
    estimated_amount: number;
  };
  mechanic_id: { full_name: string };
  status: string;
  priority: string;
  estimated_completion_time: string;
  started_at: string;
  completed_at: string;
  work_notes: string;
  qc_status?: string;
  lead_status?: string;
}

const LEAD_FIELDS =
  'id, lead_number, customer_name, vehicle_number, service_type, estimated_amount, status, qc_status, priority';

function chargeTitle(charge: any) {
  return String(
    charge?.description || charge?.issue_found || charge?.category_label || charge?.category || 'Additional work',
  ).trim();
}

function chargeReason(charge: any) {
  return String(charge?.reason || charge?.work_needed || '').trim();
}

function chargeAmount(charge: any) {
  const n = Number(charge?.amount ?? charge?.estimated_cost ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function chargeStatus(charge: any) {
  return String(charge?.status || charge?.approval_status || 'PENDING').toUpperCase();
}

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

function prettyLabel(raw: string) {
  return String(raw || '')
    .replace(/_/g, ' ')
    .trim();
}

function resolveDisplayStatus(job: JobDetail) {
  const qc = String(job.qc_status || '').toUpperCase();
  const leadSt = String(job.lead_status || '').toUpperCase();
  if (qc === 'PASSED' || qc === 'APPROVED') {
    if (leadSt && leadSt !== 'COMPLETED') return leadSt;
    return 'QC_PASSED';
  }
  if (FLOOR_DONE_STATUSES.has(leadSt) && leadSt !== 'COMPLETED') return leadSt;
  return job.status;
}

function statusColor(status: string) {
  const key = String(status || '').toUpperCase();
  if (['QC_PASSED', 'PASSED', 'APPROVED', 'COMPLETED', 'DELIVERED', 'PAID'].includes(key)) return '#10B981';
  if (['PAYMENT_AWAITING', 'AWAITING_PAYMENT', 'READY_FOR_BILLING', 'INVOICE_GENERATED'].includes(key)) return '#0284C7';
  if (key === 'IN_PROGRESS' || key === 'ASSIGNED') return key === 'IN_PROGRESS' ? '#004AAD' : '#F59E0B';
  if (key === 'HOLD' || key === 'ON_HOLD' || key === 'FAILED' || key === 'REJECTED') return '#EF4444';
  return '#64748B';
}

function chargeStatusStyle(status: string) {
  if (status === 'APPROVED') return { bg: '#DCFCE7', fg: '#166534' };
  if (status === 'REJECTED') return { bg: '#FEE2E2', fg: '#991B1B' };
  return { bg: '#FEF3C7', fg: '#92400E' };
}

export default function JobDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const params = route.params as { jobId?: string; leadId?: string };
  const lookupId = params.leadId || params.jobId;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [mechanicJobId, setMechanicJobId] = useState<string | null>(null);
  const [assignedMechanicId, setAssignedMechanicId] = useState<string | null>(null);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [extraCharges, setExtraCharges] = useState<any[]>([]);
  const [showAllChecklist, setShowAllChecklist] = useState(false);
  const [loading, setLoading] = useState(true);

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
    if (lookupId) {
      fetchJobDetail();
    }
  }, [lookupId]);

  useEffect(() => {
    if (!lookupId || !job?.lead_id?.id) return;

    const channel = supabase
      .channel(`job-detail-${lookupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_jobs',
          filter: mechanicJobId ? `id=eq.${mechanicJobId}` : `lead_id=eq.${lookupId}`,
        },
        () => {
          fetchJobDetail();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_checklists',
          filter: `lead_id=eq.${lookupId}`,
        },
        () => {
          fetchJobDetail();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'service_leads',
          filter: `id=eq.${job.lead_id.id}`,
        },
        () => {
          fetchJobDetail();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lookupId, job?.lead_id?.id, mechanicJobId]);

  async function loadServiceChecklist(leadId: string, mechanicId: string | null) {
    if (!mechanicId) {
      setChecklistItems([]);
      return;
    }

    let { data: checklistData } = await supabase
      .from('service_checklists')
      .select('checklist_items')
      .eq('lead_id', leadId)
      .eq('mechanic_id', mechanicId)
      .maybeSingle();

    let items = parseServiceChecklistItems(checklistData?.checklist_items);
    if (items.length === 0) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          const response = await fetch(`${ENV.API_URL}/api/leads/${leadId}/ensure-checklist`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'x-mobile-client': 'true',
            },
          });
          const result = await response.json().catch(() => ({}));
          if (response.ok) {
            if (Array.isArray(result.items) && result.items.length > 0) {
              items = parseServiceChecklistItems(result.items);
            } else {
              const { data: refreshed } = await supabase
                .from('service_checklists')
                .select('checklist_items')
                .eq('lead_id', leadId)
                .eq('mechanic_id', mechanicId)
                .maybeSingle();
              items = parseServiceChecklistItems(refreshed?.checklist_items);
            }
          }
        }
      } catch (e) {
        console.warn('ensure-checklist failed:', e);
      }
    }

    if (items.length === 0 && checklistData?.checklist_items) {
      items = parseServiceChecklistItems(checklistData.checklist_items);
    }

    setChecklistItems(items);
  }

  const fetchJobDetail = async () => {
    if (!lookupId) return;
    try {
      setLoading(true);

      let jobData: any = null;

      const byLead = await latestMechanicJobForLead(supabase, lookupId);
      if (byLead.data?.id) {
        const hydrated = await supabase
          .from('mechanic_jobs')
          .select(`*, lead_id(${LEAD_FIELDS}), mechanic:mechanic_id(id, full_name)`)
          .eq('id', byLead.data.id)
          .maybeSingle();
        jobData = hydrated.data;
      }

      if (!jobData) {
        const byId = await supabase
          .from('mechanic_jobs')
          .select(`*, lead_id(${LEAD_FIELDS}), mechanic:mechanic_id(id, full_name)`)
          .eq('id', lookupId)
          .maybeSingle();
        jobData = byId.data;
      }

      if (jobData) {
        const mechanicUuid = jobData.mechanic_id as string;
        setMechanicJobId(jobData.id);
        setAssignedMechanicId(mechanicUuid || jobData.mechanic?.id || null);
        setJob({
          ...jobData,
          mechanic_id: jobData.mechanic || { full_name: 'Unassigned' },
          status: jobData.mechanic_status || jobData.status || 'ASSIGNED',
          qc_status: jobData.lead_id?.qc_status,
          lead_status: jobData.lead_id?.status,
          priority: jobData.priority || jobData.lead_id?.priority || 'NORMAL',
        });
        const leadRef = jobData.lead_id?.id || lookupId;
        await loadServiceChecklist(leadRef, mechanicUuid || jobData.mechanic?.id || null);
        const { data: chargesData } = await supabase
          .from('lead_extra_charges')
          .select('*')
          .eq('lead_id', leadRef)
          .order('created_at', { ascending: false });
        setExtraCharges(chargesData || []);
        return;
      }

      const { data: lead, error: leadError } = await supabase
        .from('service_leads')
        .select(`${LEAD_FIELDS}, assigned_mechanic_id, mechanic:assigned_mechanic_id(full_name)`)
        .eq('id', lookupId)
        .is('deleted_at', null)
        .maybeSingle();

      if (leadError || !lead) {
        setJob(null);
        return;
      }

      setMechanicJobId(null);
      setAssignedMechanicId(lead.assigned_mechanic_id || null);
      let mechanicStatus = 'UNASSIGNED';
      if (lead.assigned_mechanic_id) {
        const st = String(lead.status || '').toUpperCase();
        if (st === 'IN_PROGRESS') mechanicStatus = 'IN_PROGRESS';
        else if (st === 'COMPLETED' || FLOOR_DONE_STATUSES.has(st)) mechanicStatus = 'COMPLETED';
        else mechanicStatus = 'ASSIGNED';
      }

      setJob({
        id: lead.id,
        lead_id: {
          id: lead.id,
          lead_number: lead.lead_number,
          customer_name: lead.customer_name,
          vehicle_number: lead.vehicle_number,
          service_type: lead.service_type,
          estimated_amount: lead.estimated_amount,
        },
        mechanic_id: { full_name: (lead as any).mechanic?.full_name || 'Unassigned' },
        status: mechanicStatus,
        priority: lead.priority || 'NORMAL',
        estimated_completion_time: '',
        started_at: '',
        completed_at: '',
        work_notes: '',
        qc_status: lead.qc_status,
        lead_status: lead.status,
      });
      await loadServiceChecklist(lead.id, lead.assigned_mechanic_id || null);
      const { data: chargesData } = await supabase
        .from('lead_extra_charges')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });
      setExtraCharges(chargesData || []);
    } catch (error) {
      console.error('Error fetching job detail:', error);
      Alert.alert('Error', 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = () => {
    if (checklistItems.length === 0) return 0;
    const completed = checklistItems.filter((item) => item.is_completed).length;
    return (completed / checklistItems.length) * 100;
  };

  const calculateSLARemaining = () => {
    if (!job?.estimated_completion_time) return null;
    const now = new Date().getTime();
    const deadline = new Date(job.estimated_completion_time).getTime();
    const remaining = deadline - now;
    return Math.floor(remaining / (1000 * 60 * 60));
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#004AAD" />
          <Text style={styles.loadingText}>Loading job details...</Text>
        </View>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#94A3B8" />
          <Text style={styles.errorText}>Job not found</Text>
        </View>
      </View>
    );
  }

  const slaHours = calculateSLARemaining();
  const progress = calculateProgress();
  const doneCount = checklistItems.filter((i) => i.is_completed).length;
  const visibleChecklist = showAllChecklist ? checklistItems : checklistItems.slice(0, 10);
  const displayStatus = resolveDisplayStatus(job);
  const badgeColor = statusColor(displayStatus);
  const qcDone = isQcPassed({ qc_status: job.qc_status, status: job.lead_status });
  const extraTotal = extraCharges.reduce((sum, row) => sum + chargeAmount(row), 0);
  const floorDone = FLOOR_DONE_STATUSES.has(String(job.lead_status || displayStatus || '').toUpperCase());
  const pendingExtra = extraCharges.some((row) => chargeStatus(row) === 'PENDING');
  const showExtraWorkChip = pendingExtra || !floorDone;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={AC.whiteCard}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              {job.lead_id.lead_number ? (
                <Text style={styles.leadNumber}>{job.lead_id.lead_number}</Text>
              ) : null}
              <Text style={styles.customerName} numberOfLines={2}>
                {job.lead_id.customer_name || 'Customer'}
              </Text>
              <Text style={styles.vehicle}>{job.lead_id.vehicle_number || '—'}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: badgeColor }]}>
              <Text style={styles.statusText}>{prettyLabel(displayStatus)}</Text>
            </View>
          </View>
          <View style={styles.chipRow}>
            {qcDone ? (
              <TouchableOpacity
                style={styles.chip}
                onPress={() => navigation.navigate('AdvisorBilling', { leadId: job.lead_id.id })}
              >
                <Text style={styles.chipTxt}>Order Summary</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.chip}
              onPress={() =>
                navigation.navigate('QCReview' as never, { jobId: job.lead_id.id, leadId: job.lead_id.id } as never)
              }
            >
              <Text style={styles.chipTxt}>QC Review</Text>
            </TouchableOpacity>
            {showExtraWorkChip ? (
              <TouchableOpacity style={styles.chip} onPress={() => navigation.navigate('ExtraWorkApproval')}>
                <Text style={styles.chipTxt}>{pendingExtra ? 'Extra work pending' : 'Extra work'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {qcDone ? (
          <View style={[AC.whiteCard, styles.nextCard]}>
            <Text style={styles.nextEyebrow}>QC passed · next step</Text>
            <Text style={styles.nextTitle}>Order Summary / Billing</Text>
            <Text style={styles.nextBody}>
              Bill check karo, finalize karo, phir payment. Delivery uske baad.
            </Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('AdvisorBilling', { leadId: job.lead_id.id })}
            >
              <Text style={styles.actionButtonText}>Open Order Summary</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {slaHours !== null && slaHours < 2 && job.status !== 'COMPLETED' && !qcDone && (
          <View
            style={[styles.slaWarning, { backgroundColor: slaHours < 0 ? '#FEE2E2' : '#FEF3C7' }]}
          >
            <Text style={[styles.slaText, { color: slaHours < 0 ? '#DC2626' : '#D97706' }]}>
              {slaHours < 0 ? 'SLA breached' : `SLA at risk: ${slaHours}h remaining`}
            </Text>
          </View>
        )}

        <View style={AC.whiteCard}>
          <Text style={styles.sectionTitle}>Job Progress</Text>
          <View style={styles.progressHead}>
            <Text style={styles.progressPercent}>{progress.toFixed(0)}%</Text>
            <Text style={styles.progressText}>
              {doneCount} of {checklistItems.length} tasks
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(0, progress))}%` }]} />
          </View>
        </View>

        <View style={AC.whiteCard}>
          <Text style={styles.sectionTitle}>Job Information</Text>
          <InfoRow label="Service type" value={job.lead_id.service_type || '—'} />
          <InfoRow label="Mechanic" value={job.mechanic_id.full_name} />
          <InfoRow label="Priority" value={prettyLabel(job.priority || 'NORMAL')} />
          {job.started_at ? <InfoRow label="Started" value={formatDateTime(job.started_at)} /> : null}
          {job.estimated_completion_time ? (
            <InfoRow label="ETA" value={formatDateTime(job.estimated_completion_time)} />
          ) : null}
        </View>

        {checklistItems.length > 0 ? (
          <View style={AC.whiteCard}>
            <View style={styles.checkHead}>
              <Text style={styles.sectionTitle}>Checklist ({checklistItems.length})</Text>
              {checklistItems.length > 10 ? (
                <TouchableOpacity
                  onPress={() => setShowAllChecklist((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.viewAllTxt}>{showAllChecklist ? 'Show less' : 'View all'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.checkGrid}>
              {Array.from({ length: Math.ceil(visibleChecklist.length / 2) }, (_, row) => {
                const pair = visibleChecklist.slice(row * 2, row * 2 + 2);
                return (
                  <View key={row} style={styles.checkPair}>
                    {pair.map((item, col) => {
                      const index = row * 2 + col;
                      const done = Boolean(item.is_completed);
                      return (
                        <View key={item.id || index} style={[styles.checkRow, done && styles.checkRowDone]}>
                          <View style={[styles.checkNumBadge, done && styles.checkNumBadgeDone]}>
                            <Text style={[styles.checkNum, done && styles.checkNumDone]}>{index + 1}</Text>
                          </View>
                          <Text style={[styles.checkTxt, done && styles.checkTxtDone]} numberOfLines={3}>
                            {item.item_name || item.name || `Item ${index + 1}`}
                          </Text>
                        </View>
                      );
                    })}
                    {pair.length === 1 ? <View style={styles.checkRowSpacer} /> : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : assignedMechanicId && job.status !== 'UNASSIGNED' ? (
          <View style={AC.whiteCard}>
            <Text style={styles.sectionTitle}>Service Checklist</Text>
            <Text style={styles.muted}>
              Checklist points load ho rahe hain. Pull to refresh ya thodi der baad dubara kholen.
            </Text>
          </View>
        ) : null}

        {extraCharges.length > 0 ? (
          <View style={AC.whiteCard}>
            <View style={styles.checkHead}>
              <Text style={styles.sectionTitle}>Extra work ({extraCharges.length})</Text>
              {extraTotal > 0 ? <Text style={styles.extraTotal}>{formatInr(extraTotal)}</Text> : null}
            </View>
            {extraCharges.map((charge, index) => {
              const st = chargeStatus(charge);
              const tone = chargeStatusStyle(st);
              const reason = chargeReason(charge);
              return (
                <View key={charge.id || index} style={styles.chargeItem}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.chargeTitle}>{chargeTitle(charge)}</Text>
                    {reason ? <Text style={styles.chargeDesc}>{reason}</Text> : null}
                    {Array.isArray(charge.parts_breakdown) && charge.parts_breakdown.length > 0 ? (
                      <Text style={styles.chargeDesc}>
                        {charge.parts_breakdown
                          .map((p: any) => `${p.name}${p.qty ? ` ×${p.qty}` : ''}`)
                          .join(' · ')}
                      </Text>
                    ) : null}
                    <View style={[styles.chargeStatus, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.chargeStatusText, { color: tone.fg }]}>{prettyLabel(st)}</Text>
                    </View>
                  </View>
                  <Text style={styles.chargeAmount}>{formatInr(chargeAmount(charge))}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {job.work_notes ? (
          <View style={AC.whiteCard}>
            <Text style={styles.sectionTitle}>Work Notes</Text>
            <Text style={styles.notesText}>{job.work_notes}</Text>
          </View>
        ) : null}
      </ScrollView>

      {job.status === 'IN_PROGRESS' || (job.status === 'COMPLETED' && !qcDone) ? (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              navigation.navigate('QCReview' as never, { jobId: job.lead_id.id, leadId: job.lead_id.id } as never)
            }
          >
            <Text style={styles.actionButtonText}>Open QC Review</Text>
          </TouchableOpacity>
        </View>
      ) : qcDone ? (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('AdvisorBilling', { leadId: job.lead_id.id })}
          >
            <Text style={styles.actionButtonText}>Open Order Summary</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 110,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  chipTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  leadNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 4,
  },
  vehicle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 140,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  slaWarning: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
  },
  slaText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 10,
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressPercent: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
  },
  progressBarBg: {
    width: '100%',
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.heading,
    flex: 1.4,
    textAlign: 'right',
  },
  checkHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  viewAllTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 10,
  },
  checkGrid: {
    gap: 8,
  },
  checkPair: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  checkRow: {
    flex: 1,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  checkRowSpacer: {
    flex: 1,
  },
  checkRowDone: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  checkNumBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  checkNumBadgeDone: {
    borderColor: '#86EFAC',
    backgroundColor: '#DCFCE7',
  },
  checkNum: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  checkNumDone: {
    color: '#166534',
  },
  checkTxt: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  checkTxtDone: {
    color: '#166534',
  },
  extraTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 10,
  },
  chargeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  chargeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.heading,
    marginBottom: 4,
  },
  chargeDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  chargeStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  chargeStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  chargeAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.heading,
    marginLeft: 4,
  },
  notesText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  muted: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  nextCard: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  nextEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
    textTransform: 'uppercase',
  },
  nextTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.heading,
  },
  nextBody: {
    marginTop: 6,
    marginBottom: 12,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textPrimary,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    backgroundColor: '#004AAD',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
