import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  ScrollView,
  Switch,
  StyleSheet,
  Alert,
} from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

type TabId = 'coupons' | 'assign' | 'audit';

type Coupon = {
  id: string;
  code: string;
  coupon_kind: string;
  discount_mode: string | null;
  discount_value: number | null;
  min_order_value: number | null;
  target_service_type_id: string | null;
  target_subservice_id: string | null;
  target_custom_label: string | null;
  start_at: string | null;
  end_at: string | null;
  usage_limit_total: number | null;
  usage_limit_per_customer: number | null;
  is_active: boolean;
  description: string | null;
  campaign_name?: string | null;
  is_public?: boolean | null;
};

const emptyForm = {
  code: '',
  coupon_kind: 'TOTAL_DISCOUNT',
  discount_mode: 'AMOUNT',
  discount_value: '',
  min_order_value: '',
  target_service_type_id: '',
  target_subservice_id: '',
  target_custom_label: '',
  start_at: '',
  end_at: '',
  usage_limit_total: '',
  usage_limit_per_customer: '',
  is_active: true,
  description: '',
};

const TABS: { id: TabId; label: string }[] = [
  { id: 'coupons', label: 'Coupons' },
  { id: 'assign', label: 'Assign' },
  { id: 'audit', label: 'Audit' },
];

export default function CouponsScreen({ navigation }: any) {
  const [tab, setTab] = useState<TabId>('coupons');
  const [items, setItems] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [assignForm, setAssignForm] = useState({ phone: '', phones_text: '', coupon_id: '', notes: '', google_sheet_url: '' });
  const [assignMode, setAssignMode] = useState<'single' | 'multiple' | 'google_sheet'>('single');
  const [assignResult, setAssignResult] = useState<{ assigned_count: number; not_found_phones: string[] } | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ coupons: Coupon[] }>('/api/admin/coupons');
      setItems(data.coupons || []);
    } catch (e) {
      console.error('Failed to load coupons', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const data = await apiFetch<{ logs: any[] }>('/api/admin/coupons/audit-log?limit=100');
      setAuditLogs(data.logs || []);
    } catch (e) {
      console.error('Failed to load audit logs', e);
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  useEffect(() => {
    if (tab === 'audit') fetchAuditLogs();
  }, [tab, fetchAuditLogs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) =>
      [c.code, c.description, c.coupon_kind, c.discount_mode, c.campaign_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [items, search]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  }

  function openEdit(item: Coupon) {
    setEditing(item);
    setForm({
      code: item.code || '',
      coupon_kind: item.coupon_kind || 'TOTAL_DISCOUNT',
      discount_mode: item.discount_mode || '',
      discount_value: item.discount_value != null ? String(item.discount_value) : '',
      min_order_value: item.min_order_value != null ? String(item.min_order_value) : '',
      target_service_type_id: item.target_service_type_id || '',
      target_subservice_id: item.target_subservice_id || '',
      target_custom_label: item.target_custom_label || '',
      start_at: item.start_at ? String(item.start_at).slice(0, 16) : '',
      end_at: item.end_at ? String(item.end_at).slice(0, 16) : '',
      usage_limit_total: item.usage_limit_total != null ? String(item.usage_limit_total) : '',
      usage_limit_per_customer: item.usage_limit_per_customer != null ? String(item.usage_limit_per_customer) : '',
      is_active: Boolean(item.is_active),
      description: item.description || '',
    });
    setShowModal(true);
  }

  async function saveCoupon() {
    setSaving(true);
    try {
      const payload: any = {
        code: form.code.trim(),
        coupon_kind: form.coupon_kind,
        discount_mode: form.discount_mode || null,
        discount_value: form.discount_value ? Number(form.discount_value) : null,
        min_order_value: form.min_order_value ? Number(form.min_order_value) : null,
        target_service_type_id: form.target_service_type_id || null,
        target_subservice_id: form.target_subservice_id || null,
        target_custom_label: form.target_custom_label || null,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
        usage_limit_total: form.usage_limit_total ? Number(form.usage_limit_total) : null,
        usage_limit_per_customer: form.usage_limit_per_customer ? Number(form.usage_limit_per_customer) : null,
        is_active: form.is_active,
        description: form.description || null,
      };
      if (!payload.code) return;

      if (editing) {
        await apiFetch(`/api/admin/coupons/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/admin/coupons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setShowModal(false);
      setEditing(null);
      setForm({ ...emptyForm });
      await fetchCoupons();
    } catch (e) {
      console.error('Failed to save coupon', e);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: Coupon) {
    try {
      await apiFetch(`/api/admin/coupons/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !item.is_active }),
      });
      await fetchCoupons();
    } catch (e) {
      console.error('Failed to update coupon', e);
    }
  }

  const parsedBulkPhones = useMemo(() => {
    const raw = assignForm.phones_text.trim();
    if (!raw) return [];
    return [...new Set(
      raw
        .split(/[\n,;|\t]+/)
        .map((part) => part.replace(/\D/g, '').slice(-10))
        .filter((phone) => phone.length === 10),
    )];
  }, [assignForm.phones_text]);

  async function handleFetchGoogleSheet() {
    const url = assignForm.google_sheet_url.trim();
    if (!url) {
      Alert.alert('Missing URL', 'Paste a Google Sheet link first.');
      return;
    }
    setImportLoading(true);
    try {
      const res = await apiFetch<{ phones_text?: string }>('/api/admin/coupons/assign/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ google_sheet_url: url }),
      });
      setAssignForm((p) => ({ ...p, phones_text: String(res?.phones_text || '') }));
    } catch (e: any) {
      Alert.alert('Fetch failed', e?.message || 'Could not fetch Google Sheet.');
    } finally {
      setImportLoading(false);
    }
  }

  async function handleAssign() {
    const phone = assignForm.phone.replace(/\D/g, '').slice(-10);
    const bulkPhones = parsedBulkPhones;
    if (assignMode === 'single' && phone.length !== 10) {
      Alert.alert('Invalid phone', 'Enter a valid 10-digit mobile number.');
      return;
    }
    if (assignMode === 'multiple' && bulkPhones.length === 0) {
      Alert.alert('No numbers', 'Enter at least one valid 10-digit mobile number.');
      return;
    }
    if (assignMode === 'google_sheet' && bulkPhones.length === 0 && !assignForm.google_sheet_url.trim()) {
      Alert.alert('Google Sheet', 'Paste sheet URL and fetch numbers, or assign directly from URL.');
      return;
    }
    if (!assignForm.coupon_id) {
      Alert.alert('Select coupon', 'Choose a coupon to assign.');
      return;
    }
    setAssigning(true);
    setAssignResult(null);
    try {
      let payload: Record<string, unknown> = {
        coupon_id: assignForm.coupon_id,
        notes: assignForm.notes || null,
      };
      if (assignMode === 'single') {
        payload = { ...payload, phone };
      } else if (assignMode === 'google_sheet') {
        payload = bulkPhones.length > 0
          ? { ...payload, phones_text: assignForm.phones_text.trim() }
          : { ...payload, google_sheet_url: assignForm.google_sheet_url.trim() };
      } else {
        payload = { ...payload, phones_text: assignForm.phones_text.trim() };
      }

      const res = await apiFetch<{ assigned_count: number; not_found_phones?: string[] }>('/api/admin/coupons/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setAssignResult({
        assigned_count: Number(res?.assigned_count || 0),
        not_found_phones: Array.isArray(res?.not_found_phones) ? res.not_found_phones : [],
      });
      if (assignMode === 'single') {
        setAssignForm((p) => ({ ...p, phone: '' }));
      } else if (assignMode === 'google_sheet') {
        setAssignForm((p) => ({ ...p, phones_text: '', google_sheet_url: '' }));
      } else {
        setAssignForm((p) => ({ ...p, phones_text: '' }));
      }
      if (tab === 'audit') fetchAuditLogs();
    } catch (e: any) {
      Alert.alert('Assign failed', e?.message || 'Could not assign coupon.');
    } finally {
      setAssigning(false);
    }
  }

  const renderItem = ({ item }: { item: Coupon }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.code}</Text>
        <Switch value={!!item.is_active} onValueChange={() => toggleActive(item)} />
      </View>
      {item.campaign_name ? <Text style={styles.cardMeta}>Campaign: {item.campaign_name}</Text> : null}
      <Text style={styles.cardMeta}>{item.coupon_kind} • {item.discount_mode || '-'}</Text>
      <Text style={styles.cardMeta}>Discount: {item.discount_value ?? '-'} | Min: {item.min_order_value ?? '-'}</Text>
      {item.description ? <Text style={styles.cardMeta}>{item.description}</Text> : null}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCouponsTab = () => (
    <>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search coupons"
          placeholderTextColor={COLORS.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={openCreate}>
          <Text style={styles.primaryText}>Add</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hintText}>For bulk generate, redemptions & export use the web admin panel.</Text>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </>
  );

  const renderAssignTab = () => (
    <ScrollView contentContainerStyle={styles.assignWrap}>
      <Text style={styles.sectionTitle}>Assign Personal Coupon</Text>
      <Text style={styles.hintText}>
        Assign to one customer or many at once. Appears in their app under My Coupons.
      </Text>

      <View style={styles.modeRow}>
        {(['single', 'multiple', 'google_sheet'] as const).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.modeBtn, assignMode === mode ? styles.modeBtnActive : null]}
            onPress={() => {
              setAssignMode(mode);
              setAssignResult(null);
            }}
          >
            <Text style={[styles.modeBtnText, assignMode === mode ? styles.modeBtnTextActive : null]}>
              {mode === 'single' ? 'Single' : mode === 'multiple' ? 'Paste' : 'G-Sheet'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {assignMode === 'single' ? (
        <>
          <Text style={styles.label}>Customer Mobile</Text>
          <TextInput
            style={styles.input}
            keyboardType="phone-pad"
            placeholder="10-digit mobile"
            placeholderTextColor={COLORS.textSecondary}
            value={assignForm.phone}
            onChangeText={(v) => setAssignForm((p) => ({ ...p, phone: v.replace(/\D/g, '').slice(0, 10) }))}
          />
        </>
      ) : assignMode === 'multiple' ? (
        <>
          <Text style={styles.label}>Mobile Numbers</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            placeholder={'One per line or comma-separated\n9876543210\n9123456789'}
            placeholderTextColor={COLORS.textSecondary}
            value={assignForm.phones_text}
            onChangeText={(v) => setAssignForm((p) => ({ ...p, phones_text: v }))}
          />
          <Text style={styles.hintText}>
            {parsedBulkPhones.length} valid number{parsedBulkPhones.length === 1 ? '' : 's'} detected
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.label}>Google Sheet URL</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            placeholderTextColor={COLORS.textSecondary}
            value={assignForm.google_sheet_url}
            onChangeText={(v) => setAssignForm((p) => ({ ...p, google_sheet_url: v }))}
          />
          <TouchableOpacity
            style={[styles.secondaryBtn, { marginTop: 8, alignSelf: 'flex-start' }]}
            onPress={handleFetchGoogleSheet}
            disabled={importLoading}
          >
            <Text style={styles.secondaryText}>{importLoading ? 'Fetching...' : 'Fetch Numbers'}</Text>
          </TouchableOpacity>
          <Text style={styles.hintText}>Sheet must be shared as Anyone with link → Viewer</Text>
          {parsedBulkPhones.length > 0 ? (
            <Text style={styles.hintText}>{parsedBulkPhones.length} numbers loaded from sheet</Text>
          ) : null}
        </>
      )}

      <Text style={styles.label}>Coupon</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {items.filter((c) => c.is_active).map((c) => {
          const selected = assignForm.coupon_id === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, selected ? styles.chipActive : null]}
              onPress={() => setAssignForm((p) => ({ ...p, coupon_id: c.id }))}
            >
              <Text style={[styles.chipText, selected ? styles.chipTextActive : null]}>{c.code}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Reason / campaign note"
        placeholderTextColor={COLORS.textSecondary}
        value={assignForm.notes}
        onChangeText={(v) => setAssignForm((p) => ({ ...p, notes: v }))}
      />
      <TouchableOpacity style={[styles.primaryBtn, styles.assignBtn]} onPress={handleAssign} disabled={assigning || importLoading}>
        <Text style={styles.primaryText}>
          {assigning
            ? 'Assigning...'
            : assignMode === 'single'
              ? 'Assign Coupon'
              : assignMode === 'google_sheet' && parsedBulkPhones.length === 0
                ? 'Assign from Sheet URL'
                : `Assign to ${parsedBulkPhones.length || 0} Customers`}
        </Text>
      </TouchableOpacity>

      {assignResult ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>Assigned to {assignResult.assigned_count} customer(s).</Text>
          {assignResult.not_found_phones.length > 0 ? (
            <Text style={styles.resultWarn}>
              Not found: {assignResult.not_found_phones.join(', ')}
            </Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );

  const renderAuditTab = () => (
    <>
      <TouchableOpacity style={styles.refreshBtn} onPress={fetchAuditLogs}>
        <Text style={styles.actionText}>Refresh</Text>
      </TouchableOpacity>
      {auditLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={auditLogs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No audit entries yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.auditCard}>
              <Text style={styles.auditAction}>{String(item.action || 'ACTION')}</Text>
              <Text style={styles.cardMeta}>{new Date(item.created_at).toLocaleString()}</Text>
              {item.details ? (
                <Text style={styles.auditDetails}>{JSON.stringify(item.details)}</Text>
              ) : null}
            </View>
          )}
        />
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <DashboardHeader title="Coupon Management" onBack={() => navigation.goBack()} />
      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabBtn, tab === t.id ? styles.tabBtnActive : null]}
            onPress={() => setTab(t.id)}
          >
            <Text style={[styles.tabText, tab === t.id ? styles.tabTextActive : null]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.body}>
        {tab === 'coupons' ? renderCouponsTab() : null}
        {tab === 'assign' ? renderAssignTab() : null}
        {tab === 'audit' ? renderAuditTab() : null}
      </View>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Coupon' : 'Add Coupon'}</Text>
            <ScrollView>
              <Text style={styles.label}>Code</Text>
              <TextInput style={styles.input} value={form.code} onChangeText={(v) => setForm((p) => ({ ...p, code: v.toUpperCase() }))} />
              <Text style={styles.label}>Type</Text>
              <TextInput style={styles.input} value={form.coupon_kind} onChangeText={(v) => setForm((p) => ({ ...p, coupon_kind: v }))} />
              <Text style={styles.label}>Discount Mode</Text>
              <TextInput style={styles.input} value={form.discount_mode} onChangeText={(v) => setForm((p) => ({ ...p, discount_mode: v }))} />
              <Text style={styles.label}>Discount Value</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={form.discount_value} onChangeText={(v) => setForm((p) => ({ ...p, discount_value: v }))} />
              <Text style={styles.label}>Min Order</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={form.min_order_value} onChangeText={(v) => setForm((p) => ({ ...p, min_order_value: v }))} />
              <Text style={styles.label}>Custom Label</Text>
              <TextInput style={styles.input} value={form.target_custom_label} onChangeText={(v) => setForm((p) => ({ ...p, target_custom_label: v }))} />
              <Text style={styles.label}>Start At (YYYY-MM-DDTHH:mm)</Text>
              <TextInput style={styles.input} value={form.start_at} onChangeText={(v) => setForm((p) => ({ ...p, start_at: v }))} />
              <Text style={styles.label}>End At (YYYY-MM-DDTHH:mm)</Text>
              <TextInput style={styles.input} value={form.end_at} onChangeText={(v) => setForm((p) => ({ ...p, end_at: v }))} />
              <Text style={styles.label}>Usage Limit Total</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={form.usage_limit_total} onChangeText={(v) => setForm((p) => ({ ...p, usage_limit_total: v }))} />
              <Text style={styles.label}>Usage Limit Per Customer</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={form.usage_limit_per_customer} onChangeText={(v) => setForm((p) => ({ ...p, usage_limit_per_customer: v }))} />
              <Text style={styles.label}>Description</Text>
              <TextInput style={styles.input} value={form.description} onChangeText={(v) => setForm((p) => ({ ...p, description: v }))} />
              <View style={styles.switchRow}>
                <Text style={styles.label}>Active</Text>
                <Switch value={form.is_active} onValueChange={(v) => setForm((p) => ({ ...p, is_active: v }))} />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={saveCoupon} disabled={saving}>
                <Text style={styles.primaryText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, padding: SPACING.md },
  tabRow: { flexDirection: 'row', paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: SPACING.xs },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontWeight: '600', color: COLORS.textSecondary, fontSize: 13 },
  tabTextActive: { color: COLORS.white },
  searchRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  hintText: { fontSize: 11, color: COLORS.textSecondary, marginTop: 8, marginBottom: 4 },
  primaryBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 8 },
  primaryText: { color: COLORS.white, fontWeight: '600' },
  list: { paddingVertical: SPACING.sm },
  card: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading },
  cardMeta: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
  cardActions: { flexDirection: 'row', marginTop: SPACING.sm },
  actionBtn: { paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: 6, backgroundColor: COLORS.gray[100] },
  actionText: { color: COLORS.primary, fontWeight: '600', fontSize: 12 },
  loading: { alignItems: 'center', marginTop: SPACING.lg },
  loadingText: { marginTop: SPACING.sm, color: COLORS.textSecondary },
  assignWrap: { paddingBottom: SPACING.xl },
  sectionTitle: { fontSize: SIZES.lg, fontWeight: '700', color: COLORS.textHeading },
  assignBtn: { marginTop: SPACING.md, alignSelf: 'flex-start' },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm, marginBottom: SPACING.sm },
  modeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  modeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeBtnText: { fontWeight: '600', color: COLORS.textSecondary, fontSize: 13 },
  modeBtnTextActive: { color: COLORS.white },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  resultBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  resultTitle: { fontWeight: '700', color: '#065F46' },
  resultWarn: { marginTop: 4, fontSize: 12, color: '#92400E' },
  chipRow: { marginTop: 6, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#DBEAFE', borderColor: '#2563EB' },
  chipText: { fontWeight: '600', color: COLORS.textSecondary, fontSize: 12 },
  chipTextActive: { color: '#1D4ED8' },
  refreshBtn: { alignSelf: 'flex-end', marginBottom: SPACING.sm },
  auditCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  auditAction: { fontWeight: '700', color: COLORS.textHeading },
  auditDetails: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.lg },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: SPACING.md },
  modalContent: { backgroundColor: COLORS.white, borderRadius: 12, padding: SPACING.md, maxHeight: '90%' },
  modalTitle: { fontSize: SIZES.lg, fontWeight: '700', marginBottom: SPACING.sm, color: COLORS.textHeading },
  label: { marginTop: SPACING.sm, color: COLORS.textSecondary, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    marginTop: 4,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.sm },
  secondaryBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 8, backgroundColor: COLORS.border },
  secondaryText: { color: COLORS.text, fontWeight: '600' },
});
