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
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

type Mode = 'SUPER_ADMIN' | 'WORKSHOP_ADMIN' | 'WORKSHOP_SUPERVISOR';
type Item = {
  id: string;
  workshop_id: string | null;
  name: string;
  category?: string | null;
  hsn_sac_code?: string | null;
  unit?: string | null;
  oem_price?: number | null;
  oes_price?: number | null;
  labour_price?: number | null;
  tax_rate?: number | null;
  is_active?: boolean | null;
  workshop?: { id: string; name?: string | null } | null;
};

type WorkshopOption = { id: string; name: string };

export default function AdditionalJobsMasterScreen({
  mode,
  navigation,
}: {
  mode: Mode;
  navigation: any;
}) {
  const { userProfile } = useAuth();
  const isSuperAdmin = mode === 'SUPER_ADMIN';
  const viewerWorkshopId = userProfile?.workshop?.id || null;

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeGlobal, setIncludeGlobal] = useState(true);
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({
    workshop_id: '' as string,
    name: '',
    category: '',
    hsn_sac_code: '',
    unit: 'job',
    oem_price: '',
    oes_price: '',
    labour_price: '',
    tax_rate: '18.00',
    is_active: true,
  });

  useEffect(() => {
    fetchItems();
  }, [includeInactive, includeGlobal, selectedWorkshopId]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchWorkshops();
    }
  }, [isSuperAdmin]);

  async function fetchWorkshops() {
    try {
      const { data, error } = await supabase
        .from('workshops')
        .select('id, name')
        .order('name', { ascending: true });
      if (error) throw error;
      setWorkshops(data || []);
    } catch (e) {
      console.error('Failed to load workshops', e);
    }
  }

  async function fetchItems() {
    try {
      setLoading(true);
      let query = supabase
        .from('additional_jobs_master')
        .select('*, workshop:workshops(id, name)')
        .order('created_at', { ascending: false });

      if (isSuperAdmin) {
        if (selectedWorkshopId === 'GLOBAL') {
          query = query.is('workshop_id', null);
        } else if (selectedWorkshopId) {
          query = query.eq('workshop_id', selectedWorkshopId);
        }
      } else if (viewerWorkshopId) {
        if (includeGlobal) {
          query = query.or(`workshop_id.eq.${viewerWorkshopId},workshop_id.is.null`);
        } else {
          query = query.eq('workshop_id', viewerWorkshopId);
        }
      }

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      console.error('Failed to load additional jobs', e);
    } finally {
      setLoading(false);
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      const c = (it.category || '').trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter((it) => {
      if (selectedCategory && (it.category || '').trim() !== selectedCategory) return false;
      if (!q) return true;
      return (
        (it.name || '').toLowerCase().includes(q) ||
        (it.category || '').toLowerCase().includes(q) ||
        (it.hsn_sac_code || '').toLowerCase().includes(q)
      );
    });
  }, [items, searchTerm, selectedCategory]);

  function openCreate() {
    setEditing(null);
    setForm({
      workshop_id: '',
      name: '',
      category: '',
      hsn_sac_code: '',
      unit: 'job',
      oem_price: '',
      oes_price: '',
      labour_price: '',
      tax_rate: '18.00',
      is_active: true,
    });
    setShowModal(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setForm({
      workshop_id: item.workshop_id || '',
      name: item.name || '',
      category: item.category || '',
      hsn_sac_code: item.hsn_sac_code || '',
      unit: item.unit || 'job',
      oem_price: item.oem_price != null ? String(item.oem_price) : '',
      oes_price: item.oes_price != null ? String(item.oes_price) : '',
      labour_price: item.labour_price != null ? String(item.labour_price) : '',
      tax_rate: item.tax_rate != null ? String(item.tax_rate) : '18.00',
      is_active: item.is_active !== false,
    });
    setShowModal(true);
  }

  async function saveItem() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        category: form.category.trim() || null,
        hsn_sac_code: form.hsn_sac_code.trim() || null,
        unit: form.unit.trim() || 'job',
        oem_price: form.oem_price ? Number(form.oem_price) : null,
        oes_price: form.oes_price ? Number(form.oes_price) : null,
        labour_price: form.labour_price ? Number(form.labour_price) : null,
        tax_rate: form.tax_rate ? Number(form.tax_rate) : null,
        is_active: form.is_active,
      };

      if (isSuperAdmin) {
        if (form.workshop_id === 'GLOBAL') {
          payload.workshop_id = null;
        } else {
          payload.workshop_id = form.workshop_id || null;
        }
      } else {
        payload.workshop_id = viewerWorkshopId;
      }

      if (editing) {
        const { error } = await supabase
          .from('additional_jobs_master')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('additional_jobs_master')
          .insert(payload);
        if (error) throw error;
      }

      setShowModal(false);
      await fetchItems();
    } catch (e) {
      console.error('Failed to save item', e);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: Item) {
    try {
      const { error } = await supabase
        .from('additional_jobs_master')
        .update({ is_active: !(item.is_active !== false) })
        .eq('id', item.id);
      if (error) throw error;
      await fetchItems();
    } catch (e) {
      console.error('Failed to update status', e);
    }
  }

  const renderItem = ({ item }: { item: Item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Switch value={item.is_active !== false} onValueChange={() => toggleActive(item)} />
      </View>
      <Text style={styles.cardMeta}>Category: {item.category || 'N/A'}</Text>
      <Text style={styles.cardMeta}>HSN/SAC: {item.hsn_sac_code || 'N/A'}</Text>
      <Text style={styles.cardMeta}>
        Price: OEM {item.oem_price ?? '-'} | OES {item.oes_price ?? '-'} | Labour {item.labour_price ?? '-'}
      </Text>
      <Text style={styles.cardMeta}>Tax: {item.tax_rate ?? '-'}%</Text>
      {isSuperAdmin && (
        <Text style={styles.cardMeta}>Workshop: {item.workshop?.name || 'Global'}</Text>
      )}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <DashboardHeader title="Additional Jobs Master" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, category, HSN/SAC"
            placeholderTextColor={COLORS.textSecondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={openCreate}>
            <Text style={styles.primaryText}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterBtn, selectedCategory === '' && styles.filterBtnActive]}
              onPress={() => setSelectedCategory('')}
            >
              <Text style={styles.filterText}>All</Text>
            </TouchableOpacity>
            {categories.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.filterBtn, selectedCategory === c && styles.filterBtnActive]}
                onPress={() => setSelectedCategory(c)}
              >
                <Text style={styles.filterText}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {isSuperAdmin ? (
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Workshop</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.filterBtn, selectedWorkshopId === '' && styles.filterBtnActive]}
                onPress={() => setSelectedWorkshopId('')}
              >
                <Text style={styles.filterText}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterBtn, selectedWorkshopId === 'GLOBAL' && styles.filterBtnActive]}
                onPress={() => setSelectedWorkshopId('GLOBAL')}
              >
                <Text style={styles.filterText}>Global</Text>
              </TouchableOpacity>
              {workshops.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.filterBtn, selectedWorkshopId === w.id && styles.filterBtnActive]}
                  onPress={() => setSelectedWorkshopId(w.id)}
                >
                  <Text style={styles.filterText}>{w.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Include Global</Text>
            <Switch value={includeGlobal} onValueChange={setIncludeGlobal} />
            <Text style={styles.toggleLabel}>Include Inactive</Text>
            <Switch value={includeInactive} onValueChange={setIncludeInactive} />
          </View>
        )}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
          />
        )}
      </View>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Item' : 'Add Item'}</Text>
            <ScrollView>
              {isSuperAdmin && (
                <>
                  <Text style={styles.label}>Workshop</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity
                      style={[styles.filterBtn, form.workshop_id === 'GLOBAL' && styles.filterBtnActive]}
                      onPress={() => setForm((p) => ({ ...p, workshop_id: 'GLOBAL' }))}
                    >
                      <Text style={styles.filterText}>Global</Text>
                    </TouchableOpacity>
                    {workshops.map((w) => (
                      <TouchableOpacity
                        key={w.id}
                        style={[styles.filterBtn, form.workshop_id === w.id && styles.filterBtnActive]}
                        onPress={() => setForm((p) => ({ ...p, workshop_id: w.id }))}
                      >
                        <Text style={styles.filterText}>{w.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={styles.label}>Name</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm((p) => ({ ...p, name: v }))} />
              <Text style={styles.label}>Category</Text>
              <TextInput style={styles.input} value={form.category} onChangeText={(v) => setForm((p) => ({ ...p, category: v }))} />
              <Text style={styles.label}>HSN/SAC</Text>
              <TextInput style={styles.input} value={form.hsn_sac_code} onChangeText={(v) => setForm((p) => ({ ...p, hsn_sac_code: v }))} />
              <Text style={styles.label}>Unit</Text>
              <TextInput style={styles.input} value={form.unit} onChangeText={(v) => setForm((p) => ({ ...p, unit: v }))} />
              <Text style={styles.label}>OEM Price</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={form.oem_price} onChangeText={(v) => setForm((p) => ({ ...p, oem_price: v }))} />
              <Text style={styles.label}>OES Price</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={form.oes_price} onChangeText={(v) => setForm((p) => ({ ...p, oes_price: v }))} />
              <Text style={styles.label}>Labour Price</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={form.labour_price} onChangeText={(v) => setForm((p) => ({ ...p, labour_price: v }))} />
              <Text style={styles.label}>Tax Rate</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={form.tax_rate} onChangeText={(v) => setForm((p) => ({ ...p, tax_rate: v }))} />
              <View style={styles.switchRow}>
                <Text style={styles.label}>Active</Text>
                <Switch value={form.is_active} onValueChange={(v) => setForm((p) => ({ ...p, is_active: v }))} />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={saveItem} disabled={saving}>
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
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  primaryText: { color: COLORS.white, fontWeight: '600' },
  filters: { marginTop: SPACING.sm },
  filterBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    marginRight: SPACING.xs,
    backgroundColor: COLORS.white,
  },
  filterBtnActive: { backgroundColor: COLORS.primary },
  filterText: { color: COLORS.text, fontSize: 12 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  toggleLabel: { color: COLORS.textSecondary, fontSize: 12 },
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
