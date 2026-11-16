import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

type Telecaller = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
};

type AllocationRow = {
  telecaller_id: string;
  allocation_percent: number;
  allocation_status: 'ACTIVE' | 'INACTIVE';
  daily_limit: number | null;
};

type SourceAssignee = { telecaller_id: string; percent: number };
type SourceRoute = { source: string; assignees: SourceAssignee[] };

const SOURCE_OPTIONS = [
  { id: 'WEBSITE', label: 'Website' },
  { id: 'APP', label: 'App' },
  { id: 'WHATSAPP', label: 'WhatsApp' },
  { id: 'META', label: 'Meta / Insta Ads' },
  { id: 'MISA', label: 'MISA AI' },
  { id: 'SARV', label: 'Incoming Sarv' },
  { id: 'GOOGLE', label: 'Google Ads' },
  { id: 'PARTNER', label: 'Partner' },
  { id: 'REFERENCE', label: 'Reference' },
  { id: 'BANNER', label: 'Banner / Offline' },
  { id: 'OTHER', label: 'Other' },
];

export default function TelecallerDistributionScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);
  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [routes, setRoutes] = useState<SourceRoute[]>([]);
  const [mode, setMode] = useState<'allocation' | 'sources'>('sources');
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<{
        telecallers: Telecaller[];
        allocations: AllocationRow[];
        source_routes?: SourceRoute[];
      }>('/api/admin/telecaller-distribution');
      const list = data.telecallers || [];
      const allocs = data.allocations || [];
      setTelecallers(list);
      setRoutes(Array.isArray(data.source_routes) ? data.source_routes : []);
      setRows(
        allocs.length > 0
          ? allocs
          : list.map((t) => ({
              telecaller_id: t.id,
              allocation_percent: 0,
              allocation_status: 'INACTIVE',
              daily_limit: null,
            }))
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  const activeTotal = useMemo(() => {
    return rows
      .filter((r) => r.allocation_status === 'ACTIVE')
      .reduce((sum, r) => sum + Number(r.allocation_percent || 0), 0);
  }, [rows]);

  function updateRow(index: number, patch: Partial<AllocationRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function peopleFor(source: string) {
    return routes.find((row) => row.source === source)?.assignees || [];
  }

  function setPeople(source: string, assignees: SourceAssignee[]) {
    setRoutes((prev) => {
      const next = prev.filter((row) => row.source !== source);
      if (assignees.length) next.push({ source, assignees });
      return next;
    });
  }

  async function handleSaveSources() {
    setSaving(true);
    setError(null);
    try {
      const payload = routes
        .map((row) => {
          const assignees = row.assignees.filter((person) => person.telecaller_id);
          if (assignees.length === 1) assignees[0] = { ...assignees[0], percent: 100 };
          return { source: row.source, assignees };
        })
        .filter((row) => row.assignees.length > 0);
      const bad = payload.find((row) => {
        const total = row.assignees.reduce((sum, person) => sum + Number(person.percent || 0), 0);
        return row.assignees.length > 1 && total !== 100;
      });
      if (bad) {
        const name = SOURCE_OPTIONS.find((item) => item.id === bad.source)?.label || bad.source;
        const total = bad.assignees.reduce((sum, person) => sum + Number(person.percent || 0), 0);
        throw new Error(`${name}: ${total}% hai, 100 hona chahiye`);
      }
      await apiFetch('/api/admin/telecaller-distribution', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_routes: payload }),
      });
      await fetchData();
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/admin/telecaller-distribution', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations: rows }),
      });
      await fetchData();
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleBackfill() {
    setBackfilling(true);
    setError(null);
    try {
      await apiFetch('/api/admin/telecaller-distribution/backfill', { method: 'POST' });
    } catch (e: any) {
      setError(e?.message || 'Backfill failed');
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Telecaller Distribution" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <ScrollView>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'sources' && styles.modeBtnOn]}
                onPress={() => setMode('sources')}
              >
                <Text style={[styles.modeText, mode === 'sources' && styles.modeTextOn]}>Source Assign</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'allocation' && styles.modeBtnOn]}
                onPress={() => setMode('allocation')}
              >
                <Text style={[styles.modeText, mode === 'allocation' && styles.modeTextOn]}>% Allocation</Text>
              </TouchableOpacity>
            </View>
            {mode === 'sources' ? (
              <View>
                <Text style={styles.meta}>
                  Ek source pe ek telecaller, ya do log percentage ke saath. Khali source purani allocation use karti hai.
                </Text>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <TouchableOpacity onPress={() => setShowInactive((value) => !value)}>
                  <Text style={styles.linkText}>{showInactive ? 'Hide inactive' : 'Show inactive'}</Text>
                </TouchableOpacity>
                {SOURCE_OPTIONS.map((source) => {
                  const assignees = peopleFor(source.id);
                  const total = assignees.reduce((sum, person) => sum + Number(person.percent || 0), 0);
                  const choices = telecallers.filter(
                    (person) => person.is_active || showInactive || assignees.some((row) => row.telecaller_id === person.id),
                  );
                  return (
                    <View key={source.id} style={styles.card}>
                      <Text style={styles.cardTitle}>{source.label}</Text>
                      {assignees.length === 0 ? (
                        <Text style={styles.cardMeta}>Not set</Text>
                      ) : (
                        assignees.map((person, index) => {
                          const current = telecallers.find((item) => item.id === person.telecaller_id);
                          return (
                            <View key={`${source.id}-${index}`} style={styles.personBlock}>
                              {choices.map((item) => {
                                const on = item.id === person.telecaller_id;
                                return (
                                  <TouchableOpacity
                                    key={item.id}
                                    style={[styles.chip, on && styles.chipOn]}
                                    onPress={() => {
                                      const next = assignees.map((row, i) =>
                                        i === index ? { ...row, telecaller_id: item.id } : row,
                                      );
                                      setPeople(source.id, next);
                                    }}
                                  >
                                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                                      {item.full_name || 'Telecaller'}
                                      {item.is_active ? '' : ' (inactive)'}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                              {assignees.length > 1 ? (
                                <View style={styles.row}>
                                  <Text style={styles.label}>Percent</Text>
                                  <TextInput
                                    style={styles.input}
                                    keyboardType="numeric"
                                    value={String(person.percent ?? 0)}
                                    onChangeText={(value) => {
                                      const next = assignees.map((row, i) =>
                                        i === index ? { ...row, percent: Number(value || 0) } : row,
                                      );
                                      setPeople(source.id, next);
                                    }}
                                  />
                                </View>
                              ) : (
                                <Text style={styles.cardMeta}>{current?.full_name || 'Telecaller'} · 100%</Text>
                              )}
                              <TouchableOpacity
                                onPress={() => {
                                  const next = assignees.filter((_, i) => i !== index);
                                  if (next.length === 1) next[0] = { ...next[0], percent: 100 };
                                  setPeople(source.id, next);
                                }}
                              >
                                <Text style={styles.linkText}>Remove</Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })
                      )}
                      {assignees.length > 1 ? (
                        <Text style={styles.cardMeta}>Total {total}% (100 chahiye)</Text>
                      ) : null}
                      <TouchableOpacity
                        onPress={() => {
                          const used = new Set(assignees.map((row) => row.telecaller_id));
                          const nextPerson = telecallers.find((person) => person.is_active && !used.has(person.id));
                          if (!nextPerson) return;
                          const next = [...assignees, { telecaller_id: nextPerson.id, percent: 0 }];
                          const share = Math.floor(100 / next.length);
                          const extra = 100 - share * next.length;
                          setPeople(
                            source.id,
                            next.map((person, index) => ({ ...person, percent: share + (index < extra ? 1 : 0) })),
                          );
                        }}
                      >
                        <Text style={styles.linkText}>Add person</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
                <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveSources} disabled={saving}>
                  <Text style={styles.primaryText}>{saving ? 'Saving...' : 'Save source assign'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
            <View>
            <Text style={styles.meta}>Active Total: {activeTotal}% (must be 100)</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {rows.map((row, idx) => {
              const tc = telecallers.find((t) => t.id === row.telecaller_id);
              return (
                <View key={`${row.telecaller_id}-${idx}`} style={styles.card}>
                  <Text style={styles.cardTitle}>{tc?.full_name || 'Telecaller'}</Text>
                  <Text style={styles.cardMeta}>{tc?.email || tc?.phone || ''}</Text>
                  <View style={styles.row}>
                    <Text style={styles.label}>Percent</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={String(row.allocation_percent ?? 0)}
                      onChangeText={(v) => updateRow(idx, { allocation_percent: Number(v || 0) })}
                    />
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Daily Limit</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={row.daily_limit == null ? '' : String(row.daily_limit)}
                      onChangeText={(v) =>
                        updateRow(idx, { daily_limit: v === '' ? null : Number(v) })
                      }
                    />
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Status</Text>
                    <TouchableOpacity
                      style={[
                        styles.statusBtn,
                        row.allocation_status === 'ACTIVE' && styles.statusActive,
                      ]}
                      onPress={() =>
                        updateRow(idx, {
                          allocation_status: row.allocation_status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                        })
                      }
                    >
                      <Text style={styles.statusText}>{row.allocation_status}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} disabled={saving}>
              <Text style={styles.primaryText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleBackfill} disabled={backfilling}>
              <Text style={styles.secondaryText}>{backfilling ? 'Backfilling...' : 'Backfill Unassigned'}</Text>
            </TouchableOpacity>
            </View>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, padding: SPACING.md },
  loading: { alignItems: 'center', marginTop: SPACING.lg },
  loadingText: { marginTop: SPACING.sm, color: COLORS.textSecondary },
  meta: { color: COLORS.textSecondary, marginBottom: SPACING.sm },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.sm },
  modeBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 8, backgroundColor: COLORS.white },
  modeBtnOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeText: { textAlign: 'center', color: COLORS.text, fontWeight: '600' },
  modeTextOn: { color: COLORS.white },
  linkText: { color: COLORS.primary, fontWeight: '700', marginTop: 6 },
  personBlock: { marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  chip: { alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.text, fontSize: 12 },
  chipTextOn: { color: COLORS.white },
  errorText: { color: COLORS.danger, marginBottom: SPACING.sm },
  card: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: 8, marginBottom: SPACING.sm },
  cardTitle: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading },
  cardMeta: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  label: { color: COLORS.textSecondary, fontSize: 12 },
  input: { minWidth: 80, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 6, textAlign: 'center', backgroundColor: COLORS.white },
  statusBtn: { paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: 6, backgroundColor: COLORS.border },
  statusActive: { backgroundColor: COLORS.primary },
  statusText: { color: COLORS.white, fontWeight: '600' },
  primaryBtn: { backgroundColor: COLORS.primary, padding: SPACING.sm, borderRadius: 8, marginTop: SPACING.sm },
  primaryText: { color: COLORS.white, textAlign: 'center', fontWeight: '600' },
  secondaryBtn: { backgroundColor: COLORS.border, padding: SPACING.sm, borderRadius: 8, marginTop: SPACING.sm },
  secondaryText: { color: COLORS.text, textAlign: 'center', fontWeight: '600' },
});
