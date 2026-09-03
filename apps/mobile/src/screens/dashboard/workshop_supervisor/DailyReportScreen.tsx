import { formatDateDMY } from "@/lib/dateFormat";
/**
 * Daily Report Screen - Workshop Supervisor
 * End of day summary and reports
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, BackHandler, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SPACING, SHADOWS } from '../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { AC } from '../../../components/workshop/advisorCrmUi';
import { apiFetch } from '../../../lib/api';
import { istYmd } from '../../../lib/crmDateRange';

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
    fetchDailyReport();
  }, []);

  const fetchDailyReport = async () => {
    try {
      const json = await apiFetch<{
        report?: typeof report;
        mechanics?: MechanicRow[];
        pickupBoys?: PickupRow[];
        leads?: LeadRow[];
      }>(`/api/supervisor/daily-report?date=${istYmd()}`);

      const next = json.report || report;
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
      if ((next.qcPassed || 0) > 0) nextInsights.push(`${next.qcPassed} QC pass today — billing / payment next.`);
      if ((next.total || 0) > 0 && (next.completed || 0) < (next.total || 0) * 0.5) {
        nextInsights.push('Completion rate is low for today. Review hold / unassigned work.');
      }
      if (nextInsights.length === 0) nextInsights.push('All clear for now. Keep the floor moving.');
      setInsights(nextInsights);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
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
            fetchDailyReport();
          }}
        />
      }
    >
      <Text style={AC.sub}>{formatDateDMY(new Date().toISOString())} · end of day snapshot</Text>

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
          ? 'Completed today'
          : listFilter === 'qc'
            ? 'QC passed today'
            : "Today's leads"}
      </Text>
      {visibleLeads.length === 0 ? (
        <View style={AC.whiteCard}>
          <Text style={AC.meta}>Is date pe koi lead nahi mili. Pull to refresh.</Text>
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

      <Text style={AC.section}>Mechanic performance today</Text>
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

      <Text style={AC.section}>Pickup performance today</Text>
      {pickupBoys.length === 0 ? (
        <View style={AC.whiteCard}>
          <Text style={AC.meta}>No pickup boys on this workshop yet.</Text>
        </View>
      ) : (
        pickupBoys.map((p) => (
          <View key={p.id} style={[AC.listCard, { borderLeftColor: '#EA580C', borderLeftWidth: 4 }]}>
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
