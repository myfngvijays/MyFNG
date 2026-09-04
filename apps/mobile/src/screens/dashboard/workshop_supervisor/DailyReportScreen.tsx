import { formatDateDMY } from "@/lib/dateFormat";
/**
 * Daily Report Screen - Workshop Supervisor
 * End of day summary and reports
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, BackHandler, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SPACING, SHADOWS } from '../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { AC } from '../../../components/workshop/advisorCrmUi';
import { apiFetch } from '../../../lib/api';
import { istYmd, shiftIstYmd } from '../../../lib/crmDateRange';

type MechanicRow = {
  id: string;
  name: string;
  assigned: number;
  completed: number;
  active: number;
};

type PickupRow = {
  id: string;
  name: string;
  assigned: number;
  completed: number;
  active: number;
};

type LeadRow = {
  id: string;
  lead_number?: string;
  customer_name?: string;
  vehicle_number?: string;
  status?: string;
  qc_status?: string;
  qc_passed_today?: boolean;
  completed_today?: boolean;
};

export default function DailyReportScreen() {
  const navigation = useNavigation<any>();
  const todayYmd = istYmd();
  const [selectedDate, setSelectedDate] = useState(todayYmd);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    overdue: 0,
    qcPassed: 0,
    extraPending: 0,
  });
  const [mechanics, setMechanics] = useState<MechanicRow[]>([]);
  const [pickupBoys, setPickupBoys] = useState<PickupRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [listFilter, setListFilter] = useState<'all' | 'completed' | 'qc'>('all');
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const fetchDailyReport = useCallback(async (ymd: string) => {
    try {
      const json = await apiFetch<{
        report?: {
          total: number;
          completed: number;
          pending: number;
          overdue: number;
          qcPassed: number;
          extraPending: number;
        };
        mechanics?: MechanicRow[];
        pickupBoys?: PickupRow[];
        leads?: LeadRow[];
      }>(`/api/supervisor/daily-report?date=${ymd}`);

      const next = json.report || {
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
        qcPassed: 0,
        extraPending: 0,
      };
      setReport({
        total: next.total || 0,
        completed: next.completed || 0,
        pending: next.pending || 0,
        overdue: next.overdue || 0,
        qcPassed: next.qcPassed || 0,
        extraPending: next.extraPending || 0,
      });
      setMechanics(Array.isArray(json.mechanics) ? json.mechanics : []);
      setPickupBoys(Array.isArray(json.pickupBoys) ? json.pickupBoys : []);
      setLeads(Array.isArray(json.leads) ? json.leads : []);

      const nextInsights: string[] = [];
      if ((next.overdue || 0) > 0) nextInsights.push(`${next.overdue} job(s) overdue — check mechanic workload.`);
      if ((next.extraPending || 0) > 0) nextInsights.push(`${next.extraPending} extra job request(s) still pending.`);
      if ((next.qcPassed || 0) > 0) nextInsights.push(`${next.qcPassed} QC pass — billing / payment next.`);
      if ((next.total || 0) > 0 && (next.completed || 0) < (next.total || 0) * 0.5) {
        nextInsights.push('Completion rate is low for this day. Review hold / unassigned work.');
      }
      if (nextInsights.length === 0) nextInsights.push('All clear for now. Keep the floor moving.');
      setInsights(nextInsights);
      setLoadError(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not load daily report';
      setLoadError(msg);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyReport(selectedDate);
  }, [selectedDate, fetchDailyReport]);

  const isToday = selectedDate === todayYmd;
  const dateLabel = formatDateDMY(`${selectedDate}T12:00:00+05:30`);

  const shiftDate = (delta: number) => {
    const next = shiftIstYmd(selectedDate, delta);
    if (next > todayYmd) return;
    setListFilter('all');
    setSelectedDate(next);
  };

  const visibleLeads = leads.filter((lead) => {
    if (listFilter === 'completed') return Boolean(lead.completed_today);
    if (listFilter === 'qc') return Boolean(lead.qc_passed_today);
    return true;
  });

  const kpis = [
    { key: 'all' as const, label: 'Total', value: report.total, color: '#004AAD', icon: 'briefcase-outline' as const },
    { key: 'completed' as const, label: 'Completed', value: report.completed, color: '#10B981', icon: 'checkmark-circle' as const },
    { key: 'all' as const, label: 'Pending', value: report.pending, color: '#F59E0B', icon: 'time' as const },
    { key: 'all' as const, label: 'Overdue', value: report.overdue, color: '#EF4444', icon: 'alert-circle' as const },
    { key: 'qc' as const, label: 'QC Passed', value: report.qcPassed, color: '#0284C7', icon: 'shield-checkmark' as const },
    { key: 'all' as const, label: 'Extra pending', value: report.extraPending, color: '#7C3AED', icon: 'add-circle' as const },
  ];

  return (
    <ScrollView
      style={AC.page}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchDailyReport(selectedDate);
          }}
        />
      }
    >
      <View style={styles.dateRow}>
        <TouchableOpacity
          style={styles.dateNavBtn}
          onPress={() => shiftDate(-1)}
          accessibilityLabel="Previous day"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.dateCenter}>
          <Text style={styles.dateTitle}>{dateLabel}</Text>
          <Text style={AC.meta}>
            {isToday ? 'Today · end of day snapshot' : 'Past day · end of day snapshot'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.dateNavBtn, isToday && styles.dateNavDisabled]}
          onPress={() => shiftDate(1)}
          disabled={isToday}
          accessibilityLabel="Next day"
        >
          <Ionicons name="chevron-forward" size={22} color={isToday ? '#94A3B8' : COLORS.primary} />
        </TouchableOpacity>
      </View>

      {!isToday ? (
        <TouchableOpacity style={styles.todayChip} onPress={() => setSelectedDate(todayYmd)}>
          <Text style={styles.todayChipTxt}>Jump to today</Text>
        </TouchableOpacity>
      ) : null}

      {loadError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Daily report load nahi hua</Text>
          <Text style={styles.errorBody}>{loadError}</Text>
          <Text style={styles.errorHint}>
            Dev app localhost:3000 pe jaati hai. Next.js (`apps/web`) chal raha hona chahiye, ya EXPO_PUBLIC_API_URL production pe set karo.
          </Text>
        </View>
      ) : null}

      <View style={AC.kpiRow}>
        {kpis.map((kpi) => (
          <TouchableOpacity
            key={kpi.label}
            style={[AC.kpiThird, listFilter === kpi.key && kpi.key !== 'all' ? { borderWidth: 1.5, borderColor: kpi.color } : null]}
            onPress={() => setListFilter(kpi.key === listFilter ? 'all' : kpi.key)}
            activeOpacity={0.85}
          >
            <Ionicons name={kpi.icon} size={18} color={kpi.color} />
            <Text style={[AC.kpiVal, { color: kpi.color }]}>{kpi.value}</Text>
            <Text style={AC.kpiLab}>{kpi.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={AC.section}>
        {listFilter === 'completed'
          ? 'Completed that day'
          : listFilter === 'qc'
            ? 'QC passed that day'
            : isToday
              ? "Today's leads"
              : 'Leads that day'}
      </Text>
      {visibleLeads.length === 0 ? (
        <View style={AC.whiteCard}>
          <Text style={AC.meta}>
            {loadError
              ? 'Server se list nahi aayi. Pull to refresh after API is up.'
              : 'Is date pe koi lead nahi mili. Pull to refresh.'}
          </Text>
        </View>
      ) : (
        visibleLeads.map((lead) => (
          <TouchableOpacity
            key={lead.id}
            style={[AC.listCard, lead.qc_passed_today ? { borderLeftColor: '#10B981', borderLeftWidth: 4 } : null]}
            onPress={() => navigation.navigate('JobDetail', { jobId: lead.id, leadId: lead.id })}
            activeOpacity={0.85}
          >
            <Text style={AC.name}>{lead.customer_name || lead.lead_number || 'Lead'}</Text>
            <Text style={AC.meta}>
              {lead.lead_number}
              {lead.vehicle_number ? ` · ${lead.vehicle_number}` : ''}
            </Text>
            {lead.qc_passed_today ? (
              <Text style={styles.nextHint}>QC Passed · Next: Open Order Summary</Text>
            ) : lead.status ? (
              <Text style={AC.meta}>{String(lead.status).replace(/_/g, ' ')}</Text>
            ) : null}
          </TouchableOpacity>
        ))
      )}

      <Text style={AC.section}>Mechanic performance</Text>
      {mechanics.length === 0 ? (
        <View style={AC.whiteCard}>
          <Text style={AC.meta}>No mechanics on this workshop yet.</Text>
        </View>
      ) : (
        mechanics.map((m) => (
          <View key={m.id} style={AC.listCard}>
            <Text style={AC.name}>{m.name}</Text>
            <Text style={AC.meta}>
              Assigned {m.assigned} · Completed {m.completed} · Active {m.active}
            </Text>
          </View>
        ))
      )}

      <Text style={AC.section}>Pickup performance</Text>
      {pickupBoys.length === 0 ? (
        <View style={AC.whiteCard}>
          <Text style={AC.meta}>No pickup boys on this workshop yet.</Text>
        </View>
      ) : (
        pickupBoys.map((p) => (
          <View key={p.id} style={AC.listCard}>
            <Text style={AC.name}>{p.name}</Text>
            <Text style={AC.meta}>
              Assigned {p.assigned} · Completed {p.completed} · Active {p.active}
            </Text>
          </View>
        ))
      )}

      <Text style={AC.section}>Insights</Text>
      {insights.map((line) => (
        <View key={line} style={AC.whiteCard}>
          <Text style={AC.meta}>{line}</Text>
        </View>
      ))}

      <View style={{ height: SPACING.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.md, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: SIZES.xxl, fontWeight: 'bold' },
  date: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  dateNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  dateNavDisabled: { backgroundColor: '#F1F5F9' },
  dateCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  dateTitle: { fontSize: 16, fontWeight: '800', color: COLORS.heading },
  todayChip: {
    alignSelf: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
  },
  todayChipTxt: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  errorCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorTitle: { fontSize: 14, fontWeight: '800', color: '#991B1B' },
  errorBody: { marginTop: 4, fontSize: 13, fontWeight: '600', color: '#B91C1C' },
  errorHint: { marginTop: 6, fontSize: 12, color: '#7F1D1D', lineHeight: 16 },
  nextHint: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    justifyContent: 'space-between',
    rowGap: 10,
  },
  card: {
    width: '48.5%',
    backgroundColor: COLORS.white,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderLeftWidth: 4,
    ...SHADOWS.small,
  },
  value: { fontSize: 26, fontWeight: '800', marginTop: 8, color: COLORS.textHeading },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginTop: 2 },
});
