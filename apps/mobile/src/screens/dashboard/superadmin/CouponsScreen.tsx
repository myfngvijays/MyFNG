import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

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

export default function CouponsScreen({ navigation }: any) {
  const [items, setItems] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => {
    fetchCoupons();
  }, []);

  async function fetchCoupons() {
    setLoading(true);
    try {
      const data = await apiFetch<{ coupons: Coupon[] }>('/api/admin/coupons');
      setItems(data.coupons || []);
    } catch (e) {
      console.error('Failed to load coupons', e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) =>
      [c.code, c.description, c.coupon_kind, c.discount_mode]
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

  const renderItem = ({ item }: { item: Coupon }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.code}</Text>
        <Switch value={!!item.is_active} onValueChange={() => toggleActive(item)} />
      </View>
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

  return (
    <View style={styles.container}>
      <DashboardHeader title="Coupons" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
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
      </View>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Coupon' : 'Add Coupon'}</Text>
            <ScrollView>
              <Text style={styles.label}>Code</Text>
              <TextInput style={styles.input} value={form.code} onChangeText={(v) => setForm((p) => ({ ...p, code: v }))} />
              <Text style={styles.label}>Type</Text>
              <TextInput style={styles.input} value={form.coupon_kind} onChangeText={(v) => setForm((p) => ({ ...p, coupon_kind: v }))} />
              <Text style={styles.label}>Discount Mode</Text>
              <TextInput style={styles.input} value={form.discount_mode} onChangeText={(v) => setForm((p) => ({ ...p, discount_mode: v }))} />
              <Text style={styles.label}>Discount Value</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={form.discount_value} onChangeText={(v) => setForm((p) => ({ ...p, discount_value: v }))} />
              <Text style={styles.label}>Min Order</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={form.min_order_value} onChangeText={(v) => setForm((p) => ({ ...p, min_order_value: v }))} />
              <Text style={styles.label}>Service Type Id</Text>
              <TextInput style={styles.input} value={form.target_service_type_id} onChangeText={(v) => setForm((p) => ({ ...p, target_service_type_id: v }))} />
              <Text style={styles.label}>Subservice Id</Text>
              <TextInput style={styles.input} value={form.target_subservice_id} onChangeText={(v) => setForm((p) => ({ ...p, target_subservice_id: v }))} />
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
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.sm },
  secondaryBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 8, backgroundColor: COLORS.border },
  secondaryText: { color: COLORS.text, fontWeight: '600' },
});
