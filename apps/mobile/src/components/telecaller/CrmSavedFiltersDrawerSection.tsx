import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, DeviceEventEmitter } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../lib/api';
import { COLORS } from '../../constants/theme';

const CHANGED = 'myfng:crm-views-changed';

type SavedRow = { id: string; name: string; filters: Record<string, unknown>; owner_id?: string };

export default function CrmSavedFiltersDrawerSection({
  collapsed,
  onApply,
}: {
  collapsed: boolean;
  onApply: (filters: Record<string, unknown>, name: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [views, setViews] = useState<SavedRow[]>([]);
  const [me, setMe] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ views?: unknown[]; me?: string }>('/api/lead-manager/saved-views');
      const rows = (Array.isArray(data?.views) ? data.views : [])
        .filter((row: any) => row?.filters?.kind === 'crm_leads')
        .map((row: any) => ({
          id: String(row.id),
          name: String(row.name || 'View'),
          filters: row.filters || {},
          owner_id: String(row.owner_id || ''),
        }));
      setViews(rows);
      setMe(String(data?.me || ''));
    } catch {
      setViews([]);
    }
  }, []);

  useEffect(() => {
    void load();
    const sub = DeviceEventEmitter.addListener(CHANGED, () => void load());
    return () => sub.remove();
  }, [load]);

  const remove = (id: string, name: string) => {
    Alert.alert('Remove filter view?', `"${name}" hata dena hai?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/lead-manager/saved-views?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
            setViews((prev) => prev.filter((row) => row.id !== id));
            DeviceEventEmitter.emit(CHANGED);
          } catch (e: unknown) {
            Alert.alert('Failed', e instanceof Error ? e.message : 'Could not remove view');
          }
        },
      },
    ]);
  };

  if (collapsed) {
    return (
      <TouchableOpacity style={styles.rowCollapsed} onPress={() => setOpen((v) => !v)} accessibilityLabel="Saved filters">
        <Ionicons name="filter-outline" size={22} color="#fff" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.head} onPress={() => setOpen((v) => !v)} activeOpacity={0.85}>
        <Ionicons name="filter-outline" size={20} color="#fff" />
        <Text style={styles.headText}>Filters</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="rgba(255,255,255,0.8)" />
      </TouchableOpacity>
      {open ? (
        <View style={styles.list}>
          {views.length === 0 ? (
            <Text style={styles.hint}>Advanced Filters se view save karo</Text>
          ) : (
            views.map((row) => (
              <View key={row.id} style={styles.itemRow}>
                <TouchableOpacity style={styles.itemPress} onPress={() => onApply(row.filters, row.name)}>
                  <Text style={styles.itemText} numberOfLines={1}>
                    {row.name}
                  </Text>
                </TouchableOpacity>
                {row.owner_id === me || !row.owner_id ? (
                  <TouchableOpacity onPress={() => remove(row.id, row.name)} hitSlop={8} accessibilityLabel="Remove">
                    <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.75)" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

export function emitCrmViewsChanged() {
  DeviceEventEmitter.emit(CHANGED);
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 8 },
  rowCollapsed: { paddingVertical: 10, alignItems: 'center' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  headText: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 15 },
  list: { marginLeft: 12, marginRight: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.2)' },
  hint: { color: 'rgba(255,255,255,0.55)', fontSize: 12, paddingHorizontal: 16, paddingBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 12 },
  itemPress: { flex: 1, minWidth: 0 },
  itemText: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '600' },
});