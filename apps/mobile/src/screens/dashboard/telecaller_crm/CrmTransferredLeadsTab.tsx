import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDateTime } from '@/lib/dateFormat';
import { titleCasePersonName } from '@/lib/personName';
import { apiFetch } from '../../../lib/api';
import CarLoading from '../../../components/CarLoading';
import { COLORS, SPACING } from '../../../constants/theme';
import {
  CRM_DATE_PRESETS,
  type CrmDatePreset,
  resolveCrmDateRange,
} from '../../../lib/crmDateRange';

export type TransferredLeadRow = {
  id: string;
  transferred_at: string;
  customer_name: string;
  transferred_to: string;
  status_at_transfer: string;
  status_now: string;
};

export default function CrmTransferredLeadsTab({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<TransferredLeadRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>('all_time');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showDateSheet, setShowDateSheet] = useState(false);

  const range = useMemo(
    () => resolveCrmDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd],
  );

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const params = new URLSearchParams({ outgoing: '1' });
      if (range.allTime) {
        params.set('all_time', '1');
      } else {
        params.set('from', range.startYmd);
        params.set('to', range.endYmd);
      }
      const data = await apiFetch<{ items?: TransferredLeadRow[]; error?: string }>(
        `/api/telecaller/crm/transfer?${params.toString()}`,
      );
      if (data && typeof data === 'object' && 'error' in data && data.error && !data.items) {
        throw new Error(String(data.error));
      }
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: unknown) {
      setItems([]);
      const msg = e instanceof Error ? e.message : 'Load failed';
      setLoadError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range.allTime, range.endYmd, range.startYmd]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Transferred Leads</Text>
        <Text style={styles.heroSub}>
          Jo leads aapne transfer ki — sirf list, detail open nahi hoti
        </Text>
        <View style={styles.heroRow}>
          <TouchableOpacity style={styles.dateChip} onPress={() => setShowDateSheet(true)} activeOpacity={0.85}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
            <Text style={styles.dateChipText}>{range.label}</Text>
            <Ionicons name="chevron-down" size={14} color="#64748B" />
          </TouchableOpacity>
          <Text style={styles.countText}>{items.length.toLocaleString('en-IN')} transfers</Text>
        </View>
      </View>

      {loading ? (
        <CarLoading label="Loading transfers…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(row) => row.id}
          style={styles.listCard}
          contentContainerStyle={[
            styles.listCardInner,
            items.length === 0 && styles.listCardInnerEmpty,
            { paddingBottom: 24 + insets.bottom },
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#047857" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="swap-horizontal-outline" size={40} color="#6EE7B7" />
              <Text style={styles.emptyTitle}>
                {loadError ? 'Transfers load nahi ho paaye' : 'No transferred leads'}
              </Text>
              <Text style={styles.emptySub}>
                {loadError
                  ? loadError
                  : 'Is date range mein koi transfer nahi mila — nayi transfer ke baad yahan dikhegi.'}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <View
              style={[styles.card, index === items.length - 1 ? styles.cardLast : styles.cardDivider]}
              accessibilityRole="text"
            >
              <View style={styles.cardTop}>
                <Text style={styles.name} numberOfLines={1}>
                  {titleCasePersonName(item.customer_name) || 'Unknown'}
                </Text>
                <Text style={styles.date}>{formatDateTime(item.transferred_at)}</Text>
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                To: {item.transferred_to || '—'}
              </Text>
              <View style={styles.statusRow}>
                <View style={styles.statusCol}>
                  <Text style={styles.statusLbl}>At transfer</Text>
                  <Text style={styles.statusVal}>{item.status_at_transfer || '—'}</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color="#94A3B8" style={{ marginTop: 14 }} />
                <View style={styles.statusCol}>
                  <Text style={styles.statusLbl}>Now</Text>
                  <Text style={[styles.statusVal, { color: '#047857' }]}>{item.status_now || '—'}</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={showDateSheet} transparent animationType="slide" onRequestClose={() => setShowDateSheet(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowDateSheet(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <Text style={styles.sheetTitle}>Transfer date</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {CRM_DATE_PRESETS.map((p) => {
                const active = datePreset === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.presetRow, active && styles.presetRowOn]}
                    onPress={() => {
                      setDatePreset(p.value);
                      if (p.value !== 'custom') setShowDateSheet(false);
                    }}
                  >
                    <Text style={[styles.presetText, active && styles.presetTextOn]}>{p.label}</Text>
                    {active ? <Ionicons name="checkmark" size={18} color={COLORS.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {datePreset === 'custom' ? (
              <View style={{ marginTop: 10, gap: 8 }}>
                <Text style={styles.customHint}>Custom range (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="From"
                  value={customStart}
                  onChangeText={setCustomStart}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.dateInput}
                  placeholder="To"
                  value={customEnd}
                  onChangeText={setCustomEnd}
                  autoCapitalize="none"
                />
              </View>
            ) : null}
            <TouchableOpacity style={styles.sheetDone} onPress={() => setShowDateSheet(false)}>
              <Text style={styles.sheetDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#F1F5F9' },
  hero: {
    backgroundColor: '#fff',
    paddingHorizontal: SPACING.md,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  heroSub: { fontSize: 12, color: '#64748B', marginTop: 4, marginBottom: 10 },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  dateChipText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  countText: { fontSize: 12, fontWeight: '700', color: '#047857' },
  listCard: {
    flex: 1,
    marginHorizontal: SPACING.md,
    marginTop: 10,
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    overflow: 'hidden',
  },
  listCardInner: { paddingHorizontal: 12, paddingTop: 8 },
  listCardInnerEmpty: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#065F46' },
  emptySub: { fontSize: 13, color: '#047857', textAlign: 'center', paddingHorizontal: 24 },
  card: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  cardDivider: {},
  cardLast: { marginBottom: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: '800', color: '#0F172A' },
  date: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  meta: { fontSize: 12, color: '#475569', marginTop: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  statusCol: { flex: 1 },
  statusLbl: { fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase' },
  statusVal: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 2 },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  presetRowOn: { backgroundColor: '#F8FAFC' },
  presetText: { fontSize: 15, fontWeight: '600', color: '#334155' },
  presetTextOn: { color: COLORS.primary, fontWeight: '800' },
  customHint: { fontSize: 12, color: '#64748B' },
  dateInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#fff',
  },
  sheetDone: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetDoneText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});