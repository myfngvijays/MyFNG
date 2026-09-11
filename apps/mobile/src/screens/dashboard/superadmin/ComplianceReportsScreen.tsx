import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../../lib/api';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

type TabId = 'rights' | 'reports';

export default function ComplianceReportsScreen() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<TabId>('rights');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [status, setStatus] = useState('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportType, setReportType] = useState('general');
  const [generating, setGenerating] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  const loadRights = useCallback(async () => {
    try {
      setError(null);
      const params = status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : '';
      const data = await apiFetch<any>(`/api/super_admin/data-rights${params}`);
      setRows(data?.requests || []);
      setCounts(data?.counts || {});
    } catch (e: any) {
      setError(e?.message || 'Failed to load data rights');
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => {
    if (tab === 'rights') void loadRights();
  }, [tab, loadRights]);

  const patch = async (id: string, next: string) => {
    setSavingId(id);
    try {
      await apiFetch('/api/super_admin/data-rights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: next }),
      });
      await loadRights();
    } catch (e: any) {
      setError(e?.message || 'Update failed');
    } finally {
      setSavingId(null);
    }
  };

  const generateReport = async () => {
    if (!startDate || !endDate) {
      setReportMsg('Select start and end dates');
      return;
    }
    setGenerating(true);
    setReportMsg(null);
    try {
      const params = new URLSearchParams({
        type: reportType,
        start_date: startDate,
        end_date: endDate,
        format: 'json',
      });
      const data = await apiFetch<any>(`/api/audit/compliance-report?${params.toString()}`);
      setReportMsg(data ? 'Report generated. Open web Compliance → Reports to download CSV/JSON.' : 'Empty report');
    } catch (e: any) {
      setReportMsg(e?.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Compliance</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabRow}>
        {([
          ['rights', 'Data Rights'],
          ['reports', 'Reports'],
        ] as const).map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[styles.tab, tab === id && styles.tabActive]}
            onPress={() => setTab(id)}
          >
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'reports' ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.sectionHint}>
            Same audit exports as web. Download file from the website Compliance page.
          </Text>
          {(['general', 'gdpr', 'soc2', 'iso27001'] as const).map((id) => (
            <TouchableOpacity
              key={id}
              style={[styles.chip, reportType === id && styles.chipActive]}
              onPress={() => setReportType(id)}
            >
              <Text style={[styles.chipText, reportType === id && styles.chipTextActive]}>
                {id === 'gdpr' ? 'DPDP / GDPR' : id.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
          <TextInput
            style={styles.input}
            placeholder="Start date YYYY-MM-DD"
            value={startDate}
            onChangeText={setStartDate}
          />
          <TextInput
            style={styles.input}
            placeholder="End date YYYY-MM-DD"
            value={endDate}
            onChangeText={setEndDate}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={() => void generateReport()} disabled={generating}>
            <Text style={styles.primaryBtnText}>{generating ? 'Generating…' : 'Generate report'}</Text>
          </TouchableOpacity>
          {reportMsg ? <Text style={styles.meta}>{reportMsg}</Text> : null}
        </ScrollView>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadRights();
              }}
            />
          }
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {[
              ['ALL', `All ${counts.all ?? 0}`],
              ['PENDING', `Pending ${counts.pending ?? 0}`],
              ['IN_PROGRESS', `Doing ${counts.in_progress ?? 0}`],
              ['DONE', `Done ${counts.done ?? 0}`],
            ].map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.chip, status === key && styles.chipActive]}
                onPress={() => setStatus(key)}
              >
                <Text style={[styles.chipText, status === key && styles.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {rows.length === 0 ? <Text style={styles.empty}>No requests</Text> : null}
          {rows.map((row) => {
            const open = openId === row.id;
            const st = String(row.status || 'PENDING').toUpperCase();
            return (
              <TouchableOpacity
                key={row.id}
                style={styles.card}
                onPress={() => setOpenId(open ? null : row.id)}
                activeOpacity={0.8}
              >
                <View style={styles.row}>
                  <Text style={styles.cardTitle}>{row.full_name}</Text>
                  <Text style={styles.badge}>{st.replace('_', ' ')}</Text>
                </View>
                <Text style={styles.meta}>
                  {row.request_type_label || row.request_type} · {row.email}
                </Text>
                {open ? (
                  <View style={[styles.row, { marginTop: 10, flexWrap: 'wrap' }]}>
                    {['PENDING', 'IN_PROGRESS', 'DONE', 'REJECTED'].map((next) => (
                      <TouchableOpacity
                        key={next}
                        style={[styles.chip, st === next && styles.chipActive]}
                        disabled={savingId === row.id}
                        onPress={() => void patch(row.id, next)}
                      >
                        <Text style={[styles.chipText, st === next && styles.chipTextActive]}>
                          {next.replace('_', ' ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: SIZES.lg, fontWeight: '700', color: '#0F172A' },
  tabRow: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff' },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  tabActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  tabTextActive: { color: '#fff' },
  body: { padding: SPACING.md, gap: 10 },
  sectionHint: { fontSize: 13, color: '#64748B', marginBottom: 6 },
  chipRow: { gap: 8, paddingBottom: 8 },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: '#0F172A' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  chipTextActive: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 14,
  },
  primaryBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  error: { color: '#B91C1C', fontSize: 13 },
  empty: { textAlign: 'center', color: '#64748B', marginTop: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', flex: 1 },
  badge: { fontSize: 11, fontWeight: '700', color: '#92400E', backgroundColor: '#FEF3C7', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  meta: { fontSize: 12, color: '#64748B', marginTop: 4 },
});
