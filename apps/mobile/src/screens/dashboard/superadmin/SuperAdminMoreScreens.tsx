import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      {children}
    </SafeAreaView>
  );
}

function flattenRows(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  const keys = [
    'rows',
    'items',
    'data',
    'leads',
    'customers',
    'mechanics',
    'plans',
    'faqs',
    'templates',
    'campaigns',
    'history',
    'checks',
    'links',
    'popups',
    'services',
    'overrides',
    'headers',
    'setupSteps',
    'contentTemplates',
    'consentTemplates',
    'telemarketers',
    'logs',
  ];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  const firstArray = Object.values(payload).find((v) => Array.isArray(v));
  return Array.isArray(firstArray) ? firstArray : [];
}

function rowTitle(row: any, index: number): string {
  return String(
    row?.name ||
      row?.title ||
      row?.label ||
      row?.full_name ||
      row?.customer_name ||
      row?.lead_number ||
      row?.code ||
      row?.phone ||
      row?.category ||
      `Item ${index + 1}`,
  );
}

function rowMeta(row: any): string {
  return [
    row?.status,
    row?.message,
    row?.reason,
    row?.city,
    row?.phone,
    row?.email,
    row?.plan_name,
    row?.created_at,
  ]
    .filter(Boolean)
    .map((v) => String(v))
    .slice(0, 3)
    .join(' · ');
}

export function SuperAdminApiModuleScreen() {
  const route = useRoute<any>();
  const title = String(route.params?.title || 'Admin module');
  const path = String(route.params?.path || '');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!path) {
      setError('No API path configured');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await apiFetch<any>(path);
      setPayload(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
      setPayload(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [path]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const rows = useMemo(() => flattenRows(payload).slice(0, 80), [payload]);
  const summaryEntries = useMemo(() => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
    const source =
      payload.settings && typeof payload.settings === 'object' && !Array.isArray(payload.settings)
        ? payload.settings
        : payload;
    return Object.entries(source)
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
      .slice(0, 12);
  }, [payload]);

  return (
    <Shell title={title}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {summaryEntries.length > 0 ? (
            <View style={styles.summaryGrid}>
              {summaryEntries.map(([key, value]) => (
                <View key={key} style={styles.summaryCard}>
                  <Text style={styles.summaryLbl}>{key.replace(/_/g, ' ')}</Text>
                  <Text style={styles.summaryVal}>{String(value)}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {rows.length === 0 && !error ? (
            <Text style={styles.empty}>No records on this module yet.</Text>
          ) : (
            rows.map((row, index) => (
              <View key={String(row?.id || `${rowTitle(row, index)}-${index}`)} style={styles.card}>
                <Text style={styles.cardTitle}>{rowTitle(row, index)}</Text>
                {rowMeta(row) ? <Text style={styles.cardMeta}>{rowMeta(row)}</Text> : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </Shell>
  );
}

export function SuperAdminDltSmsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [peId, setPeId] = useState('');
  const [peName, setPeName] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch<any>('/api/super_admin/dlt-sms');
      setPayload(data);
      setPeId(String(data?.entity?.pe_id || ''));
      setPeName(String(data?.entity?.pe_name || ''));
    } catch (e: any) {
      setError(e?.message || 'Failed to load DLT SMS');
      setPayload(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveEntity = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/super_admin/dlt-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_entity',
          entity: { ...(payload?.entity || {}), pe_id: peId, pe_name: peName },
        }),
      });
      await load();
      Alert.alert('Saved', 'DLT entity updated');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not save entity');
    } finally {
      setSaving(false);
    }
  };

  const stats = payload?.stats || {};
  const steps: any[] = Array.isArray(payload?.setupSteps) ? payload.setupSteps : [];

  return (
    <Shell title="DLT SMS">
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.summaryGrid}>
            {[
              ['Entity', stats.entity],
              ['Headers', stats.headers],
              ['Consent', stats.consent],
              ['Content', stats.content],
            ].map(([label, counts]: any) => (
              <View key={String(label)} style={styles.summaryCard}>
                <Text style={styles.summaryLbl}>{label}</Text>
                <Text style={styles.summaryVal}>
                  {counts?.approved ?? 0} ok · {counts?.pending ?? 0} wait
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Principal Entity</Text>
            <Text style={styles.cardMeta}>
              {payload?.entity?.operator || 'JIO'} · {payload?.entity?.entity_status || '—'}
            </Text>
            <TextInput
              style={styles.input}
              value={peId}
              onChangeText={setPeId}
              placeholder="PE ID"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              value={peName}
              onChangeText={setPeName}
              placeholder="Registered name"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={() => void saveEntity()} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save entity'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Setup checklist</Text>
            {steps.map((step, i) => (
              <Text key={step.id || i} style={styles.cardMeta}>
                {step.done ? '✓' : `${i + 1}.`} {step.label}
              </Text>
            ))}
            <Text style={[styles.cardMeta, { marginTop: 8 }]}>
              Approve header & templates on Jio TrueConnect, then paste DLT IDs on web admin (full editor).
            </Text>
          </View>

          {(payload?.headers || []).slice(0, 8).map((row: any) => (
            <View key={row.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.cardTitle}>{row.header}</Text>
                <Text style={styles.badge}>{row.status}</Text>
              </View>
              <Text style={styles.cardMeta}>
                {row.header_type} · {row.dlt_header_id || 'no DLT id'}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </Shell>
  );
}

export function SuperAdminSystemMonitorScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch<any>('/api/super_admin/system-monitor');
      setPayload(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load monitor');
      setPayload(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const checks: any[] = Array.isArray(payload?.checks) ? payload.checks : [];

  return (
    <Shell title="System Monitor">
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLbl}>Health</Text>
              <Text style={styles.summaryVal}>{payload?.healthScore ?? '—'}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLbl}>Status</Text>
              <Text style={styles.summaryVal}>{payload?.overallStatus || '—'}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLbl}>Healthy</Text>
              <Text style={styles.summaryVal}>{payload?.summary?.healthy ?? 0}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLbl}>Down</Text>
              <Text style={styles.summaryVal}>{payload?.summary?.down ?? 0}</Text>
            </View>
          </View>
          {checks.map((check) => {
            const status = String(check.status || 'unknown');
            const tint =
              status === 'healthy' ? '#D1FAE5' : status === 'degraded' ? '#FEF3C7' : '#FEE2E2';
            const color =
              status === 'healthy' ? '#065F46' : status === 'degraded' ? '#92400E' : '#991B1B';
            return (
              <View key={check.name} style={[styles.card, { borderColor: tint }]}>
                <View style={styles.row}>
                  <Text style={styles.cardTitle}>{check.name}</Text>
                  <Text style={[styles.badge, { backgroundColor: tint, color }]}>{status}</Text>
                </View>
                <Text style={styles.cardMeta}>{check.category}</Text>
                {check.message ? <Text style={styles.cardMeta}>{check.message}</Text> : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </Shell>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
  },
  body: { padding: SPACING.md, paddingBottom: 40 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  summaryCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryLbl: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'capitalize' },
  summaryVal: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', flex: 1 },
  cardMeta: { fontSize: 12, color: '#64748B', marginTop: 4 },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  empty: { textAlign: 'center', color: '#64748B', marginTop: 24 },
  error: { color: '#B91C1C', marginBottom: 12, fontWeight: '700' },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  saveBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
