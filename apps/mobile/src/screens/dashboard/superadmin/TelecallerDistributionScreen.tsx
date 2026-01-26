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

export default function TelecallerDistributionScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);
  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<{ telecallers: Telecaller[]; allocations: AllocationRow[] }>(
        '/api/admin/telecaller-distribution'
      );
      const list = data.telecallers || [];
      const allocs = data.allocations || [];
      setTelecallers(list);
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
