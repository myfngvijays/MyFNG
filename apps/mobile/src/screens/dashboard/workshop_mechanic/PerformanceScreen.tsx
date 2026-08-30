import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { formatDateDMY } from '../../../lib/dateFormat';
import { AC } from '../../../components/workshop/advisorCrmUi';
import { COLORS } from '../../../constants/theme';
import WorkshopDateFilter, { isoInRange } from '../../../components/workshop/WorkshopDateFilter';
import { istYmd, resolveCrmDateRange, type CrmDatePreset } from '../../../lib/crmDateRange';

function statusOf(job: any) {
  return String(job.mechanic_status || job.status || '').toUpperCase();
}

function isDone(job: any) {
  const s = statusOf(job);
  return s === 'COMPLETED' || s === 'READY_FOR_DELIVERY';
}

export default function PerformanceScreen({ hideChrome = false }: { hideChrome?: boolean }) {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>('today');
  const [customStart, setCustomStart] = useState(istYmd());
  const [customEnd, setCustomEnd] = useState(istYmd());
  const [jobs, setJobs] = useState<any[]>([]);

  const fetchPerformanceData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();
      const mechanicId = userProfile?.id || user.id;
      if (!mechanicId) return;

      const { data, error } = await supabase
        .from('mechanic_jobs')
        .select(
          `
          id, lead_id, mechanic_status, status, assigned_at, started_at, completed_at, created_at,
          estimated_completion_time, actual_work_duration, efficiency_score,
          service_leads:lead_id (customer_name, vehicle_number, vehicle_make, vehicle_model)
        `,
        )
        .eq('mechanic_id', mechanicId)
        .order('assigned_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  const metrics = useMemo(() => {
    const range = resolveCrmDateRange(datePreset, customStart, customEnd);
    const scoped = jobs.filter((j) =>
      isoInRange(
        j.completed_at || j.started_at || j.assigned_at || j.created_at,
        range.start,
        range.end,
        range.allTime,
      ),
    );
    const completed = scoped.filter(isDone);
    const inProgress = scoped.filter((j) => statusOf(j) === 'IN_PROGRESS').length;
    const onHold = scoped.filter((j) => {
      const s = statusOf(j);
      return s === 'HOLD' || s === 'WAITING_APPROVAL';
    }).length;

    const withTime = completed.filter((j) => j.started_at && j.completed_at);
    let avgHours = 0;
    if (withTime.length > 0) {
      const totalMs = withTime.reduce((sum, j) => {
        const start = new Date(j.started_at).getTime();
        const end = new Date(j.completed_at).getTime();
        return sum + Math.max(0, end - start);
      }, 0);
      avgHours = totalMs / withTime.length / (1000 * 60 * 60);
    } else {
      const mins = completed.reduce((sum, j) => sum + (Number(j.actual_work_duration) || 0), 0);
      avgHours = completed.length ? mins / completed.length / 60 : 0;
    }

    const onTimeJobs = withTime.filter((j) => {
      if (!j.estimated_completion_time) return (Number(j.efficiency_score) || 0) >= 80;
      return new Date(j.completed_at).getTime() <= new Date(j.estimated_completion_time).getTime();
    }).length;
    const onTime = withTime.length > 0 ? (onTimeJobs / withTime.length) * 100 : 0;
    const completionRate = scoped.length > 0 ? (completed.length / scoped.length) * 100 : 0;
    const quality =
      completed.length > 0
        ? completed.reduce((sum, j) => sum + (Number(j.efficiency_score) || 0), 0) / completed.length
        : 0;
    const overall = Math.round((completionRate * 0.4 + onTime * 0.3 + quality * 0.3) || 0);

    return {
      assigned: scoped.length,
      completed: completed.length,
      inProgress,
      onHold,
      avgHours,
      onTime,
      completionRate,
      quality,
      overall: Math.min(100, overall),
      recent: scoped.slice(0, 8),
    };
  }, [jobs, datePreset, customStart, customEnd]);

  const grade =
    metrics.overall >= 90
      ? { label: 'Excellent', color: '#059669' }
      : metrics.overall >= 75
        ? { label: 'Good', color: '#0284C7' }
        : metrics.overall >= 60
          ? { label: 'Average', color: '#D97706' }
          : { label: 'Needs work', color: '#DC2626' };

  if (loading) {
    return (
      <View style={AC.page}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#004AAD" />
          <Text style={styles.loadingText}>Loading performance...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={AC.page}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPerformanceData();
            }}
            colors={['#004AAD']}
          />
        }
      >
        {hideChrome ? <Text style={AC.sub}>Your jobs, SLA, and quality for the selected dates</Text> : null}

        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <WorkshopDateFilter
            preset={datePreset}
            customStart={customStart}
            customEnd={customEnd}
            onPreset={setDatePreset}
            onCustomStart={setCustomStart}
            onCustomEnd={setCustomEnd}
          />
        </View>

        <View style={[styles.scoreCard, { borderLeftColor: grade.color }]}>
          <Text style={styles.scoreLabel}>Overall score</Text>
          <Text style={[styles.scoreValue, { color: grade.color }]}>{metrics.overall}%</Text>
          <Text style={styles.scoreSub}>{grade.label} · based on completion, on-time, and quality</Text>
        </View>

        <Text style={AC.section}>Key metrics</Text>
        <View style={styles.grid}>
          {[
            { label: 'Assigned', value: metrics.assigned, accent: '#004AAD' },
            { label: 'Completed', value: metrics.completed, accent: '#059669' },
            { label: 'In progress', value: metrics.inProgress, accent: '#D97706' },
            { label: 'On hold', value: metrics.onHold, accent: '#EA580C' },
            { label: 'Avg time', value: `${metrics.avgHours.toFixed(1)}h`, accent: '#0284C7' },
            { label: 'On-time', value: `${Math.round(metrics.onTime)}%`, accent: '#6D28D9' },
          ].map((tile) => (
            <View key={tile.label} style={[AC.kpiWide, styles.tile, { borderLeftColor: tile.accent }]}>
              <Text style={[AC.kpiVal, { color: tile.accent }]}>{tile.value}</Text>
              <Text style={AC.kpiLab}>{tile.label}</Text>
            </View>
          ))}
        </View>

        <Text style={AC.section}>Indicators</Text>
        <View style={AC.whiteCard}>
          <ProgressRow label="Completion rate" value={metrics.completionRate} color="#004AAD" />
          <ProgressRow label="On-time delivery" value={metrics.onTime} color="#059669" />
          <ProgressRow label="Quality score" value={metrics.quality} color="#0284C7" />
        </View>

        <View style={styles.sectionHead}>
          <Text style={[AC.section, { paddingHorizontal: 0, marginTop: 0 }]}>Recent jobs</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MechanicJobs')}>
            <Text style={styles.viewAll}>View jobs</Text>
          </TouchableOpacity>
        </View>
        {metrics.recent.length === 0 ? (
          <View style={AC.empty}>
            <Text style={AC.emptyTxt}>No jobs in this period</Text>
            <Text style={AC.emptySub}>Change the date filter or wait for new assignments</Text>
          </View>
        ) : (
          metrics.recent.map((job) => {
            const lead = Array.isArray(job.service_leads) ? job.service_leads[0] : job.service_leads;
            const status = statusOf(job).replace(/_/g, ' ') || 'ASSIGNED';
            return (
              <TouchableOpacity
                key={job.id}
                style={AC.listCard}
                onPress={() =>
                  navigation.navigate('JobDetail', { jobId: job.lead_id, leadId: job.lead_id })
                }
                activeOpacity={0.8}
              >
                <View style={styles.jobRow}>
                  <Text style={[AC.name, { flex: 1 }]} numberOfLines={1}>
                    {lead?.customer_name || 'Customer'}
                  </Text>
                  <View style={[AC.statusPill, { backgroundColor: statusColor(statusOf(job)) }]}>
                    <Text style={AC.statusPillTxt}>{status}</Text>
                  </View>
                </View>
                <Text style={AC.meta}>
                  {[lead?.vehicle_number, `${lead?.vehicle_make || ''} ${lead?.vehicle_model || ''}`.trim()]
                    .filter(Boolean)
                    .join(' · ') || 'Vehicle'}
                </Text>
                <Text style={AC.meta}>{formatDateDMY(job.completed_at || job.assigned_at || job.created_at)}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function ProgressRow({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <View style={styles.progressBlock}>
      <View style={styles.progressHead}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={[styles.progressVal, { color }]}>{pct.toFixed(0)}%</Text>
      </View>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function statusColor(status: string) {
  if (status === 'COMPLETED' || status === 'READY_FOR_DELIVERY') return '#059669';
  if (status === 'IN_PROGRESS') return '#0284C7';
  if (status === 'HOLD' || status === 'WAITING_APPROVAL') return '#D97706';
  if (status === 'ASSIGNED') return '#004AAD';
  return '#64748B';
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
  scoreCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    alignItems: 'center',
  },
  scoreLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  scoreValue: { fontSize: 40, fontWeight: '800', marginVertical: 2 },
  scoreSub: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    rowGap: 8,
    marginBottom: 8,
  },
  tile: { width: '48.5%', marginHorizontal: 0, borderLeftWidth: 4 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  viewAll: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBlock: { marginBottom: 12 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  progressVal: { fontSize: 13, fontWeight: '800' },
  progressBg: { height: 8, borderRadius: 4, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
});
