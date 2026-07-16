import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING } from '../../constants/theme';
import type { MisaPricingPlan } from '../../lib/misa/misaPricing';
import {
  getOilTypeForPlan,
  groupPeriodicPlans,
  isPeriodicPricing,
} from '../../lib/misa/misaPricing';
import { ENV } from '../../config/environment';

type ChecklistItem = { name: string; category: string };
type ChecklistMeta = { points: number | null; itemCount: number; loading: boolean };

type Props = {
  plans: MisaPricingPlan[];
  title?: string;
  onSelect: (plan: MisaPricingPlan) => void;
};

function inr(value: number) {
  return `₹${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;
}

function checklistTierParam(plan: MisaPricingPlan): string {
  if (plan.isPeriodic) return plan.tier;
  return plan.name || plan.tier;
}

function checklistFetchUrl(plan: MisaPricingPlan): string {
  const oilParam = plan.oilType === 'unknown' ? 'semi' : plan.oilType;
  if (plan.serviceTypeId) {
    return `${ENV.API_URL}/api/chatbot/v2/service-checklist?service_type_id=${encodeURIComponent(plan.serviceTypeId)}&oil=${oilParam}`;
  }
  return `${ENV.API_URL}/api/chatbot/v2/service-checklist?tier=${encodeURIComponent(checklistTierParam(plan))}&oil=${oilParam}`;
}

async function fetchPlanChecklistMeta(plan: MisaPricingPlan): Promise<Omit<ChecklistMeta, 'loading'>> {
  try {
    const res = await fetch(checklistFetchUrl(plan));
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) return { points: null, itemCount: 0 };
    const items = Array.isArray(json.items) ? json.items : [];
    const points = typeof json.points === 'number' ? json.points : items.length > 0 ? items.length : null;
    return { points, itemCount: items.length };
  } catch {
    return { points: null, itemCount: 0 };
  }
}

function PointsModal({ plan, onClose }: { plan: MisaPricingPlan; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [modalTitle, setModalTitle] = useState(`${plan.tier} Service`);
  const [points, setPoints] = useState<number | null>(plan.points ? parseInt(plan.points, 10) : null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(checklistFetchUrl(plan));
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not load points');
        if (cancelled) return;
        setItems(Array.isArray(json.items) ? json.items : []);
        if (typeof json.points === 'number') setPoints(json.points);
        if (json.title) setModalTitle(String(json.title));
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load checklist');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plan]);

  const grouped = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    items.forEach((item) => {
      const key = item.category || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return map;
  }, [items]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <Text style={styles.modalSub}>
                {points ? `${points} Activity Points` : 'Service checklist'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={styles.metaLoading}>Loading checklist…</Text>
              </View>
            ) : error ? (
              <Text style={styles.modalError}>{error}</Text>
            ) : items.length === 0 ? (
              <Text style={styles.modalEmpty}>Detailed checklist will be shared by our team at booking.</Text>
            ) : (
              Array.from(grouped.entries()).map(([category, categoryItems]) => (
                <View key={category} style={styles.categoryBlock}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  {categoryItems.map((item, idx) => (
                    <View key={`${category}-${idx}`} style={styles.checkItem}>
                      <Ionicons name="checkmark-circle" size={14} color="#059669" />
                      <Text style={styles.checkText}>{item.name}</Text>
                    </View>
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function MisaPricingCards({ plans, title, onSelect }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checklistMeta, setChecklistMeta] = useState<Record<string, ChecklistMeta>>({});
  const [pointsPlan, setPointsPlan] = useState<MisaPricingPlan | null>(null);

  const grouped = useMemo(() => groupPeriodicPlans(plans), [plans]);
  const isPeriodic = useMemo(() => plans.some((p) => p.isPeriodic) || isPeriodicPricing(plans), [plans]);
  const hasSemi = grouped.semi.length > 0;
  const hasFull = grouped.full.length > 0;
  const showOilToggle = isPeriodic && hasSemi && hasFull;
  const [oilType, setOilType] = useState<'semi' | 'full'>(hasSemi ? 'semi' : 'full');

  const visiblePlans = useMemo(() => {
    if (!showOilToggle) return plans;
    return plans.filter((p) => {
      const oil = getOilTypeForPlan(p.name, p.description);
      return oil === oilType || oil === 'unknown';
    });
  }, [plans, oilType, showOilToggle]);

  useEffect(() => {
    let cancelled = false;
    const loadingMap: Record<string, ChecklistMeta> = {};
    visiblePlans.forEach((p) => {
      loadingMap[p.id] = { points: null, itemCount: 0, loading: true };
    });
    setChecklistMeta(loadingMap);
    void Promise.all(
      visiblePlans.map(async (plan) => {
        const m = await fetchPlanChecklistMeta(plan);
        return { id: plan.id, meta: { ...m, loading: false } };
      }),
    ).then((rows) => {
      if (cancelled) return;
      setChecklistMeta((prev) => {
        const next = { ...prev };
        rows.forEach(({ id, meta }) => {
          next[id] = meta;
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [visiblePlans]);

  useEffect(() => {
    setSelectedId(null);
  }, [oilType]);

  useEffect(() => {
    if (visiblePlans.length === 1) setSelectedId(visiblePlans[0].id);
  }, [visiblePlans]);

  const selected = visiblePlans.find((p) => p.id === selectedId) || null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>{isPeriodic ? 'PERIODIC PLANS' : 'SERVICE PLANS'}</Text>
      {title ? <Text style={styles.title}>{title}</Text> : null}

      {showOilToggle ? (
        <View style={styles.oilRow}>
          <Text style={styles.oilLabel}>Engine Oil:</Text>
          <TouchableOpacity
            style={[styles.oilBtn, oilType === 'semi' && styles.oilBtnSemiActive]}
            onPress={() => setOilType('semi')}
          >
            <Text style={[styles.oilBtnText, oilType === 'semi' && styles.oilBtnTextActive]}>Semi Synthetic</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.oilBtn, oilType === 'full' && styles.oilBtnFullActive]}
            onPress={() => setOilType('full')}
          >
            <Text style={[styles.oilBtnText, oilType === 'full' && styles.oilBtnTextActive]}>Fully Synthetic</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {visiblePlans.map((plan) => {
          const meta = checklistMeta[plan.id];
          const pointsNum =
            meta && !meta.loading && meta.points != null
              ? meta.points
              : plan.points
                ? parseInt(plan.points, 10)
                : null;
          const hasChecklist = (meta?.itemCount ?? plan.checklistCount ?? 0) > 0;
          const showPointsUi = hasChecklist || Boolean(pointsNum && pointsNum > 0);
          const isSelected = selectedId === plan.id;
          return (
            <TouchableOpacity
              key={plan.id}
              style={[styles.card, isSelected && styles.cardSelected]}
              activeOpacity={0.9}
              onPress={() => setSelectedId(plan.id)}
            >
              {plan.badge ? <Text style={styles.badge}>{plan.badge}</Text> : null}
              <Text style={styles.cardTitle} numberOfLines={3}>
                {plan.isPeriodic ? `${plan.tier} Service` : plan.tier}
              </Text>
              <Text style={styles.cardPrice}>{inr(plan.price)}</Text>
              {meta?.loading ? (
                <Text style={styles.metaLoading}>Loading points…</Text>
              ) : showPointsUi && pointsNum ? (
                <View style={styles.pointsRow}>
                  <Ionicons name="checkmark-circle" size={12} color={COLORS.primary} />
                  <Text style={styles.pointsText}>{pointsNum} Activity Points</Text>
                </View>
              ) : null}
              {!meta?.loading && showPointsUi ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setPointsPlan(plan);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.viewPoints}>View all points</Text>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selected ? (
        <Text style={styles.selectedLine}>
          Selected: {selected.tier} · {inr(selected.price)}
          {showOilToggle ? (oilType === 'semi' ? ' · Semi Synthetic' : ' · Fully Synthetic') : ''}
        </Text>
      ) : null}

      <TouchableOpacity
        style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
        disabled={!selected}
        onPress={() => selected && onSelect(selected)}
      >
        <Text style={styles.continueText}>
          {selected ? `Continue · ${inr(selected.price)}` : 'Select a plan to continue'}
        </Text>
      </TouchableOpacity>

      {pointsPlan ? <PointsModal plan={pointsPlan} onClose={() => setPointsPlan(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#F0F9FF',
    padding: SPACING.sm,
  },
  kicker: { fontSize: 10, fontWeight: '900', color: '#1D4ED8', letterSpacing: 0.6 },
  title: { marginTop: 4, fontSize: FONT_SIZES.sm, fontWeight: '800', color: COLORS.secondary },
  oilRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  oilLabel: { fontSize: 11, fontWeight: '800', color: '#4B5563' },
  oilBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#fff',
  },
  oilBtnSemiActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  oilBtnFullActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  oilBtnText: { fontSize: 11, fontWeight: '800', color: '#2563EB' },
  oilBtnTextActive: { color: '#fff' },
  row: { gap: 10, paddingVertical: 8 },
  card: {
    width: 168,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    padding: 12,
  },
  cardSelected: { borderColor: COLORS.primary, borderWidth: 2 },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 9,
    fontWeight: '900',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
    overflow: 'hidden',
  },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  cardPrice: { marginTop: 6, fontSize: 18, fontWeight: '900', color: '#1D4ED8' },
  metaLoading: { marginTop: 6, fontSize: 10, color: '#9CA3AF' },
  pointsRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  pointsText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  viewPoints: { marginTop: 6, fontSize: 11, fontWeight: '800', color: COLORS.primary, textDecorationLine: 'underline' },
  selectedLine: { marginTop: 4, fontSize: 11, fontWeight: '700', color: '#374151' },
  continueBtn: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  continueBtnDisabled: { opacity: 0.45 },
  continueText: { color: '#fff', fontWeight: '800', fontSize: FONT_SIZES.sm },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  modalSub: { marginTop: 2, fontSize: 13, fontWeight: '800', color: COLORS.primary },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { paddingHorizontal: 16, paddingVertical: 12 },
  modalLoading: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  modalError: { textAlign: 'center', color: '#DC2626', paddingVertical: 24, fontWeight: '700' },
  modalEmpty: { textAlign: 'center', color: '#6B7280', paddingVertical: 24, fontWeight: '600' },
  categoryBlock: { marginBottom: 16 },
  categoryTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  checkItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  checkText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#374151', lineHeight: 18 },
});
