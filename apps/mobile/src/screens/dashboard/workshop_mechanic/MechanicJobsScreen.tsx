import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../../../context/NotificationContext';
import { AC } from '../../../components/workshop/advisorCrmUi';
import { COLORS, SHADOWS } from '../../../constants/theme';

interface Job {
  id: string;
  lead_id: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  service_types: string[];
  mechanic_status: string;
  job_priority: string;
  sla_remaining_minutes: number;
  before_images_count: number;
  progress_images_count: number;
  after_images_count: number;
  has_pending_extra_work: boolean;
  checklist_completed: boolean;
  assigned_at: string;
}

const FILTERS = ['ALL', 'ASSIGNED', 'IN_PROGRESS', 'HOLD', 'NEED_APPROVAL', 'COMPLETED'] as const;

function filterLabel(id: string) {
  if (id === 'NEED_APPROVAL') return 'Need approval';
  if (id === 'IN_PROGRESS') return 'In progress';
  return id.replace(/_/g, ' ');
}

export default function MechanicJobsScreen({ navigation, embedInShell = false }: any) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const { user } = useAuth();
  const { jobRefreshTick } = useNotifications();

  useEffect(() => {
    if (embedInShell) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [embedInShell, navigation]);

  const fetchJobs = useCallback(async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', authUser.email)
        .maybeSingle();
      const mechanicId = profile?.id || user?.id || authUser.id;
      if (!mechanicId) return;

      const { data, error } = await supabase
        .from('mechanic_dashboard')
        .select('*')
        .eq('mechanic_id', mechanicId)
        .order('assigned_at', { ascending: false });

      if (error) {
        const { data: fallback } = await supabase
          .from('mechanic_jobs')
          .select(
            `
            id, lead_id, mechanic_status, job_priority, sla_remaining_minutes,
            assigned_at, has_pending_extra_work, checklist_completed,
            before_images_count, progress_images_count, after_images_count,
            service_leads:lead_id (customer_name, vehicle_number, vehicle_make, vehicle_model, service_type)
          `,
          )
          .eq('mechanic_id', mechanicId)
          .order('assigned_at', { ascending: false });
        const mapped = (fallback || []).map((row: any) => {
          const lead = Array.isArray(row.service_leads) ? row.service_leads[0] : row.service_leads;
          return {
            id: row.id,
            lead_id: row.lead_id,
            customer_name: lead?.customer_name || 'Customer',
            vehicle_number: lead?.vehicle_number || '',
            vehicle_make: lead?.vehicle_make || '',
            vehicle_model: lead?.vehicle_model || '',
            service_types: lead?.service_type ? [lead.service_type] : [],
            mechanic_status: row.mechanic_status || 'ASSIGNED',
            job_priority: row.job_priority || 'NORMAL',
            sla_remaining_minutes: row.sla_remaining_minutes || 0,
            before_images_count: row.before_images_count || 0,
            progress_images_count: row.progress_images_count || 0,
            after_images_count: row.after_images_count || 0,
            has_pending_extra_work: !!row.has_pending_extra_work,
            checklist_completed: !!row.checklist_completed,
            assigned_at: row.assigned_at,
          } as Job;
        });
        setJobs(mapped);
        return;
      }

      setJobs((data || []) as Job[]);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchJobs();
    if (!user?.id) return;
    const channel = supabase
      .channel(`mechanic-jobs-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_jobs',
          filter: `mechanic_id=eq.${user.id}`,
        },
        () => fetchJobs(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchJobs]);

  useEffect(() => {
    if (!user?.id) return;
    fetchJobs();
  }, [jobRefreshTick, user?.id, fetchJobs]);

  useEffect(() => {
    if (activeFilter === 'ALL') {
      setFilteredJobs(jobs);
    } else if (activeFilter === 'NEED_APPROVAL') {
      setFilteredJobs(jobs.filter((job) => job.has_pending_extra_work));
    } else if (activeFilter === 'HOLD') {
      setFilteredJobs(
        jobs.filter((job) => job.mechanic_status === 'HOLD' || job.mechanic_status === 'WAITING_APPROVAL'),
      );
    } else {
      setFilteredJobs(jobs.filter((job) => job.mechanic_status === activeFilter));
    }
  }, [activeFilter, jobs]);

  const counts: Record<string, number> = {
    ALL: jobs.length,
    ASSIGNED: jobs.filter((j) => j.mechanic_status === 'ASSIGNED').length,
    IN_PROGRESS: jobs.filter((j) => j.mechanic_status === 'IN_PROGRESS').length,
    HOLD: jobs.filter((j) => j.mechanic_status === 'HOLD' || j.mechanic_status === 'WAITING_APPROVAL').length,
    NEED_APPROVAL: jobs.filter((j) => j.has_pending_extra_work).length,
    COMPLETED: jobs.filter((j) => j.mechanic_status === 'COMPLETED').length,
  };

  function getStatusColor(status: string) {
    switch (status) {
      case 'ASSIGNED':
        return '#059669';
      case 'IN_PROGRESS':
        return '#0284C7';
      case 'HOLD':
      case 'WAITING_APPROVAL':
        return '#D97706';
      case 'COMPLETED':
        return '#6D28D9';
      default:
        return '#64748B';
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'URGENT':
      case 'CRITICAL':
        return '#DC2626';
      case 'HIGH':
        return '#EA580C';
      default:
        return '#004AAD';
    }
  }

  function formatSLA(minutes: number) {
    if (minutes < 0) return `Overdue ${Math.abs(minutes)}m`;
    if (minutes < 60) return `${minutes}m left`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m left`;
  }

  function renderJob({ item }: { item: Job }) {
    const slaColor =
      item.sla_remaining_minutes < 0 ? '#DC2626' : item.sla_remaining_minutes < 60 ? '#D97706' : '#059669';
    return (
      <TouchableOpacity
        style={[AC.listCard, { borderLeftColor: getPriorityColor(item.job_priority) }]}
        onPress={() => navigation.navigate('JobDetail', { jobId: item.lead_id, leadId: item.lead_id })}
        activeOpacity={0.8}
      >
        <View style={styles.jobHeader}>
          <Text style={[AC.name, { flex: 1 }]} numberOfLines={1}>
            {item.customer_name || 'Customer'}
          </Text>
          <View style={[AC.statusPill, { backgroundColor: getStatusColor(item.mechanic_status) }]}>
            <Text style={AC.statusPillTxt}>
              {String(item.mechanic_status || 'ASSIGNED').replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        {item.job_priority && item.job_priority !== 'NORMAL' ? (
          <Text style={[styles.priority, { color: getPriorityColor(item.job_priority) }]}>
            {item.job_priority}
          </Text>
        ) : null}

        <Text style={AC.meta}>
          {[item.vehicle_number, `${item.vehicle_make || ''} ${item.vehicle_model || ''}`.trim()]
            .filter(Boolean)
            .join(' · ') || 'Vehicle'}
        </Text>
        {item.service_types?.length ? (
          <Text style={AC.meta} numberOfLines={1}>
            {item.service_types.join(', ')}
          </Text>
        ) : null}

        <View style={styles.slaRow}>
          <Text style={styles.slaLabel}>SLA</Text>
          <Text style={[styles.slaValue, { color: slaColor }]}>{formatSLA(item.sla_remaining_minutes || 0)}</Text>
        </View>

        <View style={styles.photoRow}>
          <Text style={styles.photoChip}>Before {item.before_images_count || 0}</Text>
          <Text style={styles.photoChip}>Progress {item.progress_images_count || 0}</Text>
          <Text style={styles.photoChip}>After {item.after_images_count || 0}</Text>
        </View>

        {item.has_pending_extra_work ? (
          <Text style={styles.warn}>Additional job pending approval</Text>
        ) : null}
        {item.checklist_completed ? <Text style={styles.ok}>Checklist completed</Text> : null}
      </TouchableOpacity>
    );
  }

  return (
    <View style={AC.page}>
      <View style={styles.topRow}>
        <Text style={styles.subText} numberOfLines={1}>
          {filteredJobs.length} {activeFilter === 'ALL' ? 'jobs assigned to you' : filterLabel(activeFilter).toLowerCase()}
        </Text>
        <View style={styles.dropWrap}>
          <TouchableOpacity
            style={styles.dropBtn}
            onPress={() => setFilterOpen((v) => !v)}
            activeOpacity={0.85}
          >
            <Text style={styles.dropBtnTxt} numberOfLines={1}>
              {filterLabel(activeFilter)} ({counts[activeFilter] || 0})
            </Text>
            <Ionicons name={filterOpen ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.primary} />
          </TouchableOpacity>
          {filterOpen ? (
            <View style={styles.dropMenu}>
              {FILTERS.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.dropItem, activeFilter === item && styles.dropItemOn]}
                  onPress={() => {
                    setActiveFilter(item);
                    setFilterOpen(false);
                  }}
                >
                  <Text style={[styles.dropItemTxt, activeFilter === item && styles.dropItemTxtOn]}>
                    {filterLabel(item)} ({counts[item] || 0})
                  </Text>
                  {activeFilter === item ? <Ionicons name="checkmark" size={16} color={COLORS.primary} /> : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      </View>
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id || item.lead_id}
        renderItem={renderJob}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJobs(); }} colors={[COLORS.primary]} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={AC.empty}>
            <Text style={AC.emptyTxt}>No jobs found</Text>
            <Text style={AC.emptySub}>New assignments will show here</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    zIndex: 8,
  },
  subText: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  dropWrap: { minWidth: 148, maxWidth: '52%', zIndex: 9 },
  dropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    ...SHADOWS.small,
  },
  dropBtnTxt: { flex: 1, fontSize: 13, fontWeight: '800', color: '#023D95' },
  dropMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    zIndex: 20,
    elevation: 12,
    ...SHADOWS.small,
  },
  dropItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  dropItemOn: { backgroundColor: '#EFF6FF' },
  dropItemTxt: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  dropItemTxtOn: { color: COLORS.primary, fontWeight: '800' },
  listContainer: { paddingBottom: 32 },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  priority: { fontSize: 11, fontWeight: '800', marginBottom: 4 },
  slaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  slaLabel: { fontSize: 12, fontWeight: '800', color: '#64748B', marginRight: 8 },
  slaValue: { fontSize: 13, fontWeight: '800' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  photoChip: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  warn: { marginTop: 8, fontSize: 12, fontWeight: '700', color: '#B45309' },
  ok: { marginTop: 6, fontSize: 12, fontWeight: '700', color: '#047857' },
});
