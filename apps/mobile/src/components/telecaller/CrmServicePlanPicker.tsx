import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { getOilTypeForPlan } from '../../lib/misa/misaPricing';
import { getServiceIconUrl } from '../../lib/serviceIcons';
import { fetchServicePricingMap, resolveCityZoneId, resolveVehicleClass } from '../../lib/servicePricing';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';

export type CrmServiceItem = {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  points?: number;
};

type ChecklistItem = { name: string; category?: string };

type Props = {
  /** Preloaded services; if empty, component loads all active service_types */
  services?: CrmServiceItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  cityId?: string | null;
  vehicleClass?: string | null;
  modelId?: string | null;
  /** Restrict to these category names (uppercase), e.g. ['PERIODIC'] for packages */
  categoryFilter?: string[] | null;
  /** Only keep services matching this predicate */
  filterFn?: ((s: CrmServiceItem) => boolean) | null;
  title?: string;
  subtitle?: string;
  banner?: React.ReactNode;
};

function inr(n: number) {
  return `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
}

function titleCaseCat(c: string) {
  return String(c || '')
    .split(' ')
    .map((w) => (w ? w.charAt(0) + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

export default function CrmServicePlanPicker({
  services: servicesProp,
  selectedIds,
  onChange,
  cityId,
  vehicleClass,
  modelId,
  categoryFilter,
  filterFn,
  title = 'Choose services',
  subtitle,
  banner,
}: Props) {
  const [loading, setLoading] = useState(!servicesProp?.length);
  const [allServices, setAllServices] = useState<CrmServiceItem[]>(servicesProp || []);
  const [checklists, setChecklists] = useState<Record<string, ChecklistItem[]>>({});
  const [pointsMap, setPointsMap] = useState<Record<string, number>>({});
  const [pricing, setPricing] = useState<Record<string, number>>({});
  const [pricingLoading, setPricingLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [oilType, setOilType] = useState<'semi' | 'full'>('semi');
  const [search, setSearch] = useState('');
  const [details, setDetails] = useState<CrmServiceItem | null>(null);

  useEffect(() => {
    if (servicesProp?.length) {
      setAllServices(servicesProp);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: cats } = await supabase.from('categories').select('uuid, category').order('category');
        const categoryMap: Record<string, string> = {};
        (cats || []).forEach((c: any) => {
          if (c.uuid && c.category) categoryMap[c.uuid] = String(c.category).toUpperCase();
        });
        const { data: rows } = await supabase
          .from('service_types')
          .select('id, name, description, is_active, category_uuid')
          .eq('is_active', true)
          .order('name');
        const mapped: CrmServiceItem[] = (rows || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          category: s.category_uuid ? categoryMap[s.category_uuid] || 'OTHER SERVICES' : 'OTHER SERVICES',
        }));
        if (!cancelled) setAllServices(mapped);

        const ids = mapped.map((s) => s.id);
        if (ids.length) {
          const { data: templates } = await supabase
            .from('service_type_checklist_templates')
            .select('service_type_id, points, checklist_items')
            .in('service_type_id', ids);
          const lists: Record<string, ChecklistItem[]> = {};
          const pts: Record<string, number> = {};
          (templates || []).forEach((r: any) => {
            const sid = String(r.service_type_id);
            const items = Array.isArray(r.checklist_items)
              ? r.checklist_items
                  .map((it: any) => {
                    if (typeof it === 'string') return { name: it.trim(), category: 'General' };
                    const name = String(it?.name || it?.title || '').trim();
                    if (!name) return null;
                    return { name, category: String(it?.category || 'General') };
                  })
                  .filter(Boolean)
              : [];
            lists[sid] = items as ChecklistItem[];
            const p = Number(r.points || items.length || 0);
            if (p > 0) pts[sid] = p;
          });
          if (!cancelled) {
            setChecklists(lists);
            setPointsMap(pts);
          }
        }
      } catch (e) {
        console.error('CrmServicePlanPicker load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [servicesProp]);

  const filteredBase = useMemo(() => {
    let list = allServices;
    if (categoryFilter?.length) {
      const set = new Set(categoryFilter.map((c) => c.toUpperCase()));
      list = list.filter((s) => set.has(String(s.category || '').toUpperCase()) ||
        [...set].some((c) => String(s.category || '').toUpperCase().includes(c)));
    }
    if (filterFn) list = list.filter(filterFn);
    return list;
  }, [allServices, categoryFilter, filterFn]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    filteredBase.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    const order = [
      'PERIODIC', 'ENGINE', 'AC', 'BATTERY', 'BRAKE', 'CLUTCH', 'TYRE', 'WHEEL',
      'DETAILING', 'DENTING', 'PAINTING', 'ELECTRICAL', 'SUSPENSION', 'STEERING',
    ];
    const arr = Array.from(set);
    arr.sort((a, b) => {
      const ia = order.findIndex((o) => a.includes(o));
      const ib = order.findIndex((o) => b.includes(o));
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });
    return arr;
  }, [filteredBase]);

  useEffect(() => {
    if (!selectedCategory && categories.length) setSelectedCategory(categories[0]);
    else if (selectedCategory && categories.length && !categories.includes(selectedCategory)) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  const isPeriodicCategory = String(selectedCategory || '').toUpperCase().includes('PERIODIC');

  const servicesInCategory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return filteredBase
      .filter((s) => !selectedCategory || s.category === selectedCategory)
      .filter((s) => {
        if (!isPeriodicCategory) return true;
        const oil = getOilTypeForPlan(s.name, s.description || '');
        if (oil === 'unknown') return true;
        return oil === oilType;
      })
      .filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [filteredBase, selectedCategory, isPeriodicCategory, oilType, search]);

  useEffect(() => {
    const ids = filteredBase.map((s) => s.id);
    if (!ids.length) {
      setPricing({});
      return;
    }
    let cancelled = false;
    (async () => {
      setPricingLoading(true);
      try {
        const zoneId = cityId ? await resolveCityZoneId(cityId) : null;
        let cls = String(vehicleClass || '').trim() || null;
        if (!cls && modelId) {
          cls = await resolveVehicleClass(modelId);
        }
        const map = await fetchServicePricingMap(ids, cityId || null, zoneId, cls);
        if (!cancelled) setPricing(map);
      } catch {
        if (!cancelled) setPricing({});
      } finally {
        if (!cancelled) setPricingLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filteredBase, cityId, vehicleClass, modelId]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };

  const selectedTotal = selectedIds.reduce((sum, id) => sum + (pricing[id] || 0), 0);

  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {banner}

      {categories.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {categories.map((c) => {
            const active = c === selectedCategory;
            const iconUrl = getServiceIconUrl(c);
            return (
              <TouchableOpacity
                key={c}
                style={[styles.catItem, active && styles.catItemActive]}
                onPress={() => setSelectedCategory(c)}
                activeOpacity={0.85}
              >
                <View style={[styles.catIcon, active && styles.catIconActive]}>
                  {iconUrl ? (
                    <Image source={{ uri: iconUrl }} style={{ width: 22, height: 22 }} resizeMode="contain" />
                  ) : (
                    <Ionicons name="construct-outline" size={18} color={active ? COLORS.primary : COLORS.textSecondary} />
                  )}
                </View>
                <Text style={[styles.catText, active && styles.catTextActive]} numberOfLines={2}>
                  {titleCaseCat(c)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={COLORS.textSecondary} />
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search services"
          placeholderTextColor={COLORS.textSecondary}
        />
        {pricingLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
      </View>

      {isPeriodicCategory ? (
        <View style={styles.oilRow}>
          <Text style={styles.oilLabel}>Engine Oil:</Text>
          <View style={styles.oilToggle}>
            <TouchableOpacity
              style={[styles.oilTab, oilType === 'semi' && styles.oilTabActive]}
              onPress={() => setOilType('semi')}
            >
              <Text style={[styles.oilTabText, oilType === 'semi' && styles.oilTabTextActive]}>Semi Synthetic</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.oilTab, oilType === 'full' && styles.oilTabFull]}
              onPress={() => setOilType('full')}
            >
              <Text style={[styles.oilTabText, oilType === 'full' && styles.oilTabTextActive]}>Fully Synthetic</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {selectedIds.length > 0 ? (
        <View style={styles.cart}>
          <View style={styles.cartTop}>
            <Text style={styles.cartTitle}>
              {selectedIds.length} selected
            </Text>
            <Text style={styles.cartTotal}>{selectedTotal > 0 ? inr(selectedTotal) : '—'}</Text>
          </View>
          <View style={styles.chipWrap}>
            {selectedIds.map((id) => {
              const s = allServices.find((x) => x.id === id);
              return (
                <View key={id} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>{s?.name || id}</Text>
                  <TouchableOpacity onPress={() => toggle(id)}>
                    <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.muted}>Loading plans…</Text>
        </View>
      ) : servicesInCategory.length === 0 ? (
        <Text style={styles.muted}>No plans in this category</Text>
      ) : (
        servicesInCategory.map((s) => {
          const selected = selectedIds.includes(s.id);
          const price = pricing[s.id] || 0;
          const items = checklists[s.id] || [];
          const pts = pointsMap[s.id] || s.points || items.length || 0;
          const preview = items.slice(0, 5);
          return (
            <View key={s.id} style={[styles.planCard, selected && styles.planCardActive]}>
              <TouchableOpacity style={styles.planHeader} onPress={() => toggle(s.id)} activeOpacity={0.85}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{s.name}</Text>
                  {pts > 0 ? <Text style={styles.planPoints}>{pts} Points</Text> : null}
                </View>
                <View style={styles.planRight}>
                  <Text style={styles.planPrice}>{price ? inr(price) : '—'}</Text>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={selected ? COLORS.green : COLORS.gray[400]}
                  />
                </View>
              </TouchableOpacity>

              {preview.length > 0 ? (
                <View style={styles.planItems}>
                  {preview.map((it, idx) => (
                    <View key={`${s.id}-${idx}`} style={styles.planItemRow}>
                      <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                      <Text style={styles.planItemText} numberOfLines={2}>{it.name}</Text>
                    </View>
                  ))}
                  {items.length > 5 ? (
                    <TouchableOpacity style={styles.viewAll} onPress={() => setDetails(s)}>
                      <Text style={styles.viewAllText}>View all points ({items.length})</Text>
                      <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : s.description ? (
                <Text style={styles.desc} numberOfLines={2}>{s.description}</Text>
              ) : null}

              {selected ? (
                <View style={styles.added}>
                  <Ionicons name="checkmark-circle" size={14} color="#059669" />
                  <Text style={styles.addedText}>Added</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.addBtn} onPress={() => toggle(s.id)}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}

      <Modal visible={!!details} transparent animationType="slide" onRequestClose={() => setDetails(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{details?.name}</Text>
                <Text style={styles.muted}>
                  {(pointsMap[details?.id || ''] || checklists[details?.id || '']?.length || 0)} Points
                  {pricing[details?.id || ''] ? ` · ${inr(pricing[details?.id || ''])}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDetails(null)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {(checklists[details?.id || ''] || []).map((it, idx) => (
                <View key={`d-${idx}`} style={styles.planItemRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                  <Text style={styles.planItemText}>{it.name}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCta}
              onPress={() => {
                if (details && !selectedIds.includes(details.id)) toggle(details.id);
                setDetails(null);
              }}
            >
              <Text style={styles.modalCtaText}>
                {details && selectedIds.includes(details.id) ? 'Already added' : 'Add this plan'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '800', color: COLORS.textHeading, marginBottom: 4 },
  subtitle: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 10 },
  muted: { fontSize: 12, color: COLORS.textSecondary },
  catRow: { gap: 8, paddingVertical: 8 },
  catItem: {
    width: 78,
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catItemActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  catIconActive: { backgroundColor: COLORS.primary + '18' },
  catText: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  catTextActive: { color: COLORS.primary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  search: { flex: 1, paddingVertical: 10, color: COLORS.textPrimary },
  oilRow: { marginBottom: 10 },
  oilLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6 },
  oilToggle: { flexDirection: 'row', gap: 8 },
  oilTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  oilTabActive: { backgroundColor: COLORS.primary },
  oilTabFull: { backgroundColor: '#EA580C', borderColor: '#EA580C' },
  oilTabText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  oilTabTextActive: { color: '#fff' },
  cart: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    ...SHADOWS.small,
  },
  cartTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cartTitle: { fontWeight: '700', color: COLORS.textPrimary },
  cartTotal: { fontWeight: '800', color: COLORS.primary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary + '12',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    maxWidth: '100%',
  },
  chipText: { fontSize: 11, fontWeight: '600', color: COLORS.primary, maxWidth: 160 },
  loading: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  planCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  planCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '06' },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  planName: { fontSize: 15, fontWeight: '800', color: COLORS.textHeading },
  planPoints: { fontSize: 12, color: COLORS.primary, fontWeight: '700', marginTop: 2 },
  planRight: { alignItems: 'flex-end', gap: 4 },
  planPrice: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  planItems: { marginTop: 10, gap: 6 },
  planItemRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 4 },
  planItemText: { flex: 1, fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  viewAllText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  desc: { marginTop: 8, fontSize: 12, color: COLORS.textSecondary },
  added: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  addedText: { fontSize: 12, fontWeight: '700', color: '#059669' },
  addBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: 28,
  },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textHeading },
  modalCta: {
    marginTop: 14,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCtaText: { color: '#fff', fontWeight: '800' },
});
