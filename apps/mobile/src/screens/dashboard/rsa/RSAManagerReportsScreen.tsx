import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';
import { apiFetch } from '../../../lib/api';

export default function RSAManagerReportsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState<Date>(new Date(Date.now() - 7 * 24 * 3600 * 1000));
  const [to, setTo] = useState<Date>(new Date());
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);
  const [report, setReport] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>(`/api/rsa/manager-performance?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
      setReport(data || null);
    } catch (e) {
      console.error('rsa manager report load failed', e);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleBack = () => {
    if (typeof navigation?.canGoBack === 'function' && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (typeof navigation?.goBack === 'function') {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.('RSAManagerDashboard');
  };

  return (
    <View style={styles.container}>
      <DashboardHeader title="RSA Reports" onBack={handleBack} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Date Range</Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowFrom(true)}>
                <Text style={styles.secondaryBtnText}>From: {from.toLocaleDateString()}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowTo(true)}>
                <Text style={styles.secondaryBtnText}>To: {to.toLocaleDateString()}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={load}>
              <Text style={styles.primaryBtnText}>Refresh Report</Text>
            </TouchableOpacity>
          </View>

          {!report || Object.keys(report).length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Performance Snapshot</Text>
              <Text style={styles.subtle}>No data available for selected range.</Text>
            </View>
          ) : (
            <>
              <View style={styles.statsGrid}>
                <MetricCard label="Avg First Action (min)" value={formatMetric(report?.avgFirstActionMinutes)} />
                <MetricCard label="Mechanic Assigned (SLA %)" value={formatPercent(report?.mechanicAssignmentWithinSlaPercent)} />
                <MetricCard label="Mechanic Assigned Total" value={formatMetric(report?.mechanicAssignedTotal)} />
                <MetricCard label="Repeat Contact Count" value={formatMetric(report?.repeatContactCount)} />
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Pending Aging Buckets</Text>
                {Array.isArray(report?.pendingAgingBuckets) && report.pendingAgingBuckets.length > 0 ? (
                  report.pendingAgingBuckets.map((bucket: any, idx: number) => (
                    <View key={`bucket-${idx}`} style={styles.itemRow}>
                      <Text style={styles.key}>{bucket?.label || bucket?.key || `Bucket ${idx + 1}`}</Text>
                      <Text style={styles.value}>{String(bucket?.count ?? 0)} leads</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.subtle}>No pending aging data.</Text>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Top Delay Reasons</Text>
                {Array.isArray(report?.topDelayReasons) && report.topDelayReasons.length > 0 ? (
                  report.topDelayReasons.map((reason: any, idx: number) => (
                    <View key={`reason-${idx}`} style={styles.itemRow}>
                      <Text style={styles.key}>{reason?.name || reason?.reason || `Reason ${idx + 1}`}</Text>
                      <Text style={styles.value}>{String(reason?.count ?? 0)} cases</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.subtle}>No delay reasons found.</Text>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Audit Snapshot</Text>
                <View style={styles.itemRow}>
                  <Text style={styles.key}>Audited Calls</Text>
                  <Text style={styles.value}>{formatMetric(report?.auditSnapshot?.auditedCount)}</Text>
                </View>
                <View style={styles.itemRow}>
                  <Text style={styles.key}>Average Score</Text>
                  <Text style={styles.value}>{formatMetric(report?.auditSnapshot?.avgScore)}</Text>
                </View>
                <View style={styles.itemRow}>
                  <Text style={styles.key}>Low Score Calls</Text>
                  <Text style={styles.value}>{Array.isArray(report?.auditSnapshot?.lowScoreCalls) ? String(report.auditSnapshot.lowScoreCalls.length) : '0'}</Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Needs Attention</Text>
                {Array.isArray(report?.needsAttention) && report.needsAttention.length > 0 ? (
                  report.needsAttention.map((entry: any, idx: number) => (
                    <View key={`attention-${idx}`} style={styles.itemRow}>
                      <Text style={styles.key}>{entry?.label || entry?.name || `Issue ${idx + 1}`}</Text>
                      <Text style={styles.value}>{entry?.value != null ? String(entry.value) : entry?.message || 'Open'}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.subtle}>No critical items.</Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {showFrom && (
        <DateTimePicker
          value={from}
          mode="date"
          onChange={(_, d) => {
            setShowFrom(false);
            if (d) setFrom(d);
          }}
        />
      )}
      {showTo && (
        <DateTimePicker
          value={to}
          mode="date"
          onChange={(_, d) => {
            setShowTo(false);
            if (d) setTo(d);
          }}
        />
      )}
    </View>
  );
}

function formatMetric(value: any): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  return String(value);
}

function formatPercent(value: any): string {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric.toFixed(1)}%`;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
  card: { backgroundColor: COLORS.white, borderRadius: 10, padding: SPACING.sm, gap: SPACING.xs },
  sectionTitle: { fontSize: SIZES.sm, color: COLORS.textHeading, fontWeight: '700' },
  row: { flexDirection: 'row', gap: SPACING.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  metricCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricLabel: { fontSize: SIZES.xs, color: COLORS.textSecondary, fontWeight: '600' },
  metricValue: { fontSize: SIZES.lg, color: COLORS.textHeading, marginTop: 4, fontWeight: '700' },
  primaryBtn: { marginTop: SPACING.xs, backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: SPACING.sm, alignItems: 'center' },
  primaryBtnText: { color: COLORS.white, fontSize: SIZES.sm, fontWeight: '700' },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, paddingVertical: SPACING.sm, alignItems: 'center' },
  secondaryBtnText: { color: COLORS.primary, fontSize: SIZES.xs, fontWeight: '700' },
  subtle: { fontSize: SIZES.xs, color: COLORS.textSecondary },
  itemRow: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.xs, marginTop: SPACING.xs },
  key: { fontSize: SIZES.xs, color: COLORS.textSecondary },
  value: { fontSize: SIZES.sm, color: COLORS.textHeading, marginTop: 2 },
});
