import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

type CatalogItem = { key: string; name: string };
type Incident = { id: string; title: string; state: string; impact: string; updates: Array<{ id: string; body: string; state: string }> };
type Maintenance = { id: string; title: string; state: string; body: string; startsAt: string; endsAt: string };

export default function SuperAdminStatusScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headline, setHeadline] = useState('');
  const [tablesReady, setTablesReady] = useState(true);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [impact, setImpact] = useState('degraded');
  const [keys, setKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch<any>('/api/super_admin/status-page');
      setHeadline(String(data?.headline || ''));
      setTablesReady(data?.tablesReady !== false);
      setCatalog(Array.isArray(data?.catalog) ? data.catalog : []);
      setIncidents(Array.isArray(data?.incidents) ? data.incidents.filter((item: Incident) => item.state !== 'resolved') : []);
      setMaintenances(Array.isArray(data?.maintenances) ? data.maintenances.filter((item: Maintenance) => item.state !== 'completed') : []);
    } catch (err: any) {
      setError(err?.message || 'Could not load status page');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/super_admin/status-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'incident',
          title,
          impact,
          componentKeys: keys,
          body,
          state: 'investigating',
        }),
      });
      setTitle('');
      setBody('');
      setKeys([]);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not publish');
    } finally {
      setSaving(false);
    }
  }

  async function resolve(id: string) {
    setSaving(true);
    try {
      await apiFetch('/api/super_admin/status-page', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'incident', id, state: 'resolved', body: 'This incident has been resolved.' }),
      });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not resolve');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Public status</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        >
          <Text style={styles.headline}>{headline || 'Status'}</Text>
          <Text style={styles.hint}>Customers see this on the website /status page. Live checks stay automatic.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!tablesReady ? <Text style={styles.warn}>Run database/385_public_status_page.sql before posting incidents.</Text> : null}

          <Text style={styles.section}>Post an incident</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Short title" style={styles.input} />
          <View style={styles.chips}>
            {['degraded', 'partial_outage', 'major_outage', 'maintenance'].map((item) => (
              <TouchableOpacity key={item} style={[styles.chip, impact === item && styles.chipOn]} onPress={() => setImpact(item)}>
                <Text style={[styles.chipText, impact === item && styles.chipTextOn]}>{item.replace('_', ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.chips}>
            {catalog.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.chip, keys.includes(item.key) && styles.chipOn]}
                onPress={() => setKeys((prev) => prev.includes(item.key) ? prev.filter((key) => key !== item.key) : [...prev, item.key])}
              >
                <Text style={[styles.chipText, keys.includes(item.key) && styles.chipTextOn]}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput value={body} onChangeText={setBody} placeholder="What customers should know" multiline style={[styles.input, styles.area]} />
          <TouchableOpacity style={styles.primary} disabled={saving} onPress={() => void publish()}>
            <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Publish incident'}</Text>
          </TouchableOpacity>

          <Text style={styles.section}>Open incidents</Text>
          {incidents.length === 0 ? <Text style={styles.hint}>No open incidents.</Text> : null}
          {incidents.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.hint}>{item.state} · {item.impact}</Text>
              <Text style={styles.cardBody}>{item.updates?.[0]?.body || ''}</Text>
              <TouchableOpacity style={styles.secondary} disabled={saving} onPress={() => void resolve(item.id)}>
                <Text style={styles.secondaryText}>Mark resolved</Text>
              </TouchableOpacity>
            </View>
          ))}

          <Text style={styles.section}>Scheduled maintenance</Text>
          {maintenances.length === 0 ? <Text style={styles.hint}>No upcoming maintenance. Schedule it from the website admin page.</Text> : null}
          {maintenances.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.hint}>{item.state}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
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
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: COLORS.primary },
  body: { padding: SPACING.md, paddingBottom: 40 },
  headline: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  hint: { fontSize: 12, color: '#64748B', marginTop: 4, marginBottom: 8 },
  error: { color: '#B91C1C', fontSize: 13, marginBottom: 8 },
  warn: { color: '#92400E', backgroundColor: '#FEF3C7', padding: 8, borderRadius: 8, fontSize: 12, marginBottom: 8 },
  section: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, fontSize: 14 },
  area: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  chipTextOn: { color: '#1D4ED8' },
  primary: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  cardBody: { fontSize: 13, color: '#334155', marginTop: 4 },
  secondary: { marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  secondaryText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
});
