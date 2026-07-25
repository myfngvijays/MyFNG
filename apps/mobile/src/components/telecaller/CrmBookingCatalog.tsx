import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import CrmServicePlanPicker from './CrmServicePlanPicker';
import { RSA_SERVICES } from '../../constants/rsaServices';
import { POPULAR_PACKAGES } from '../../constants/publicAppData';
import { fetchAppMembershipPlans, type AppMembershipPlan } from '../../lib/membershipPlan';
import { ENV } from '../../config/environment';
import { COLORS, SHADOWS } from '../../constants/theme';

export type CrmCatalogSelection = {
  service_type_ids: string[];
  pickup_required?: boolean;
  membership_plan_id?: string;
  membership_plan_name?: string;
  membership_plan_price?: number;
  rsa_service?: string;
  problem_description?: string;
  package_label?: string;
};

type Props = {
  bookingType: string;
  selectedIds: string[];
  onChangeIds: (ids: string[]) => void;
  cityId?: string | null;
  vehicleClass?: string | null;
  modelId?: string | null;
  couponCode: string;
  onCouponChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  selectionMeta: CrmCatalogSelection;
  onMetaChange: (patch: Partial<CrmCatalogSelection>) => void;
};

function inr(n: number) {
  return `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
}

function isPackageLike(name: string) {
  const n = String(name || '').toLowerCase();
  return (
    n.includes('package') ||
    /\b(basic|general|premium|platinum)\s+service\b/.test(n) ||
    n.includes('tune up') ||
    n.includes('wheel care')
  );
}

function RsaIcon({ kind, name, color }: { kind: string; name: string; color: string }) {
  if (kind === 'mci') return <MaterialCommunityIcons name={name as any} size={22} color={color} />;
  if (kind === 'material') return <MaterialIcons name={name as any} size={22} color={color} />;
  return <Ionicons name={name as any} size={22} color={color} />;
}

export default function CrmBookingCatalog({
  bookingType,
  selectedIds,
  onChangeIds,
  cityId,
  vehicleClass,
  modelId,
  couponCode,
  onCouponChange,
  notes,
  onNotesChange,
  selectionMeta,
  onMetaChange,
}: Props) {
  const type = String(bookingType || 'CAR_SERVICE').toUpperCase();
  const [membershipPlans, setMembershipPlans] = useState<AppMembershipPlan[]>([]);
  const [memLoading, setMemLoading] = useState(false);

  useEffect(() => {
    if (type !== 'MEMBERSHIP') return;
    let cancelled = false;
    (async () => {
      setMemLoading(true);
      try {
        const plans = await fetchAppMembershipPlans(ENV.API_URL);
        if (!cancelled) setMembershipPlans(plans || []);
      } catch {
        if (!cancelled) setMembershipPlans([]);
      } finally {
        if (!cancelled) setMemLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type]);

  const packageFilter = useMemo(() => (s: { name: string }) => isPackageLike(s.name), []);

  const couponAndNotes = (
    <View style={styles.extra}>
      <Text style={styles.label}>Problem / Notes</Text>
      <TextInput
        style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
        value={notes}
        onChangeText={onNotesChange}
        multiline
        placeholder="Optional notes for workshop"
        placeholderTextColor={COLORS.textSecondary}
      />
    </View>
  );

  if (type === 'PERIODIC') {
    return (
      <View>
        <CrmServicePlanPicker
          selectedIds={selectedIds}
          onChange={(ids) => {
            onChangeIds(ids);
            onMetaChange({ service_type_ids: ids, pickup_required: true });
          }}
          cityId={cityId}
          vehicleClass={vehicleClass}
          modelId={modelId}
          categoryFilter={['PERIODIC']}
          title="Periodic Service plans"
          subtitle="Same app plans — oil type, points, view all checkpoints."
        />
        {couponAndNotes}
      </View>
    );
  }

  if (type === 'OTHER_SERVICES') {
    return (
      <View>
        <CrmServicePlanPicker
          selectedIds={selectedIds}
          onChange={(ids) => {
            onChangeIds(ids);
            onMetaChange({ service_type_ids: ids, pickup_required: true });
          }}
          cityId={cityId}
          vehicleClass={vehicleClass}
          modelId={modelId}
          filterFn={(s) => !String(s.category || '').toUpperCase().includes('PERIODIC')}
          title="Other Services"
          subtitle="AC, Battery, Brake, Detailing and more — same as the app."
        />
        {couponAndNotes}
      </View>
    );
  }

  if (type === 'HOME_CAR_SERVICE') {
    return (
      <View>
        <CrmServicePlanPicker
          selectedIds={selectedIds}
          onChange={(ids) => {
            onChangeIds(ids);
            onMetaChange({ service_type_ids: ids, pickup_required: true });
          }}
          cityId={cityId}
          vehicleClass={vehicleClass}
          title="Home Service — choose plans"
          subtitle="Same app plans. Doorstep pickup will be marked for this booking."
          banner={
            <View style={styles.homeBanner}>
              <Ionicons name="home-outline" size={18} color={COLORS.primary} />
              <Text style={styles.homeBannerText}>
                Home / doorstep service — pickup from customer address is enabled.
              </Text>
            </View>
          }
        />
        {couponAndNotes}
      </View>
    );
  }

  if (type === 'PACKAGE') {
    return (
      <View>
        <Text style={styles.sectionTitle}>Popular Packages</Text>
        <Text style={styles.sectionSub}>Tap a package, then refine with plan cards below (app-style).</Text>
        <View style={styles.pkgGrid}>
          {POPULAR_PACKAGES.map((pkg) => {
            const active = selectionMeta.package_label === pkg.name;
            return (
              <TouchableOpacity
                key={pkg.id}
                style={[styles.pkgCard, active && styles.pkgCardActive]}
                activeOpacity={0.9}
                onPress={() => onMetaChange({ package_label: pkg.name })}
              >
                <Image source={{ uri: pkg.image }} style={styles.pkgImage} />
                <Text style={styles.pkgName}>{pkg.name}</Text>
                <Text style={styles.pkgPrice}>{inr(pkg.price)}</Text>
                <Text style={styles.pkgDesc} numberOfLines={2}>{pkg.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <CrmServicePlanPicker
          selectedIds={selectedIds}
          onChange={(ids) => {
            onChangeIds(ids);
            onMetaChange({ service_type_ids: ids });
          }}
          cityId={cityId}
          vehicleClass={vehicleClass}
          categoryFilter={['PERIODIC']}
          filterFn={packageFilter}
          title="Package / Periodic plans"
          subtitle="Select the exact package plan with checkpoints — same as mobile app."
        />
        {couponAndNotes}
      </View>
    );
  }

  if (type === 'MEMBERSHIP') {
    return (
      <View>
        <Text style={styles.sectionTitle}>Membership plans</Text>
        <Text style={styles.sectionSub}>Same plans customers see in the app. Select one to book.</Text>
        {memLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
        ) : membershipPlans.length === 0 ? (
          <Text style={styles.sectionSub}>No membership plans available</Text>
        ) : (
          membershipPlans.map((plan) => {
            const selected = selectionMeta.membership_plan_id === (plan.planId || plan.planCode);
            const benefits = (plan.benefits || []).slice(0, 4) as Array<{
              title?: string;
              description?: string;
            }>;
            return (
              <TouchableOpacity
                key={plan.planId || plan.planCode || plan.name}
                style={[styles.memCard, selected && styles.memCardActive]}
                activeOpacity={0.9}
                onPress={() =>
                  onMetaChange({
                    membership_plan_id: String(plan.planId || plan.planCode || ''),
                    membership_plan_name: plan.name,
                    membership_plan_price: plan.priceNum,
                    service_type_ids: [],
                  })
                }
              >
                <View style={styles.memTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memName}>{plan.name}</Text>
                    {plan.tagline ? <Text style={styles.memTag}>{plan.tagline}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.memPrice}>{inr(plan.priceNum)}</Text>
                    <Text style={styles.memPeriod}>{plan.period || '/ year'}</Text>
                  </View>
                </View>
                {benefits.map((b, i) => (
                  <View key={`${plan.planId}-b-${i}`} style={styles.benefitRow}>
                    <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                    <Text style={styles.benefitText} numberOfLines={2}>
                      {b.title || b.description || ''}
                    </Text>
                  </View>
                ))}
                {selected ? (
                  <View style={styles.selectedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={styles.selectedBadgeText}>Selected</Text>
                  </View>
                ) : (
                  <View style={styles.selectBtn}>
                    <Text style={styles.selectBtnText}>Select plan</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
        {couponAndNotes}
      </View>
    );
  }

  if (type === 'RSA') {
    return (
      <View>
        <Text style={styles.sectionTitle}>RSA services</Text>
        <Text style={styles.sectionSub}>Pick the roadside issue — same options as the app RSA screen.</Text>
        <View style={styles.rsaGrid}>
          {RSA_SERVICES.map((svc) => {
            const selected = selectionMeta.rsa_service === svc.name;
            return (
              <TouchableOpacity
                key={svc.name}
                style={[styles.rsaCard, selected && styles.rsaCardActive]}
                activeOpacity={0.9}
                onPress={() => {
                  onMetaChange({
                    rsa_service: svc.name,
                    problem_description: notes?.trim() ? notes : svc.desc,
                    service_type_ids: [],
                  });
                  if (!notes?.trim()) onNotesChange(svc.desc);
                }}
              >
                <View style={[styles.rsaIcon, { backgroundColor: svc.bg + '22' }]}>
                  <RsaIcon kind={svc.iconKind} name={svc.iconName} color={svc.bg} />
                </View>
                <Text style={styles.rsaName}>{svc.name}</Text>
                <Text style={styles.rsaDesc} numberOfLines={2}>{svc.desc}</Text>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} style={{ marginTop: 6 }} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
        {couponAndNotes}
      </View>
    );
  }

  // Default: CAR_SERVICE
  return (
    <View>
      <CrmServicePlanPicker
        selectedIds={selectedIds}
        onChange={(ids) => {
          onChangeIds(ids);
          onMetaChange({ service_type_ids: ids, pickup_required: false });
        }}
        cityId={cityId}
        vehicleClass={vehicleClass}
        title="Choose services"
        subtitle="Same plan cards as the mobile app — categories, oil type, checkpoints."
      />
      {couponAndNotes}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textHeading },
  sectionSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: COLORS.textPrimary,
  },
  extra: { marginTop: 8, marginBottom: 8 },
  homeBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: COLORS.primary + '12',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  homeBannerText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.primary, lineHeight: 17 },
  pkgGrid: { gap: 10, marginBottom: 16 },
  pkgCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  pkgCardActive: { borderColor: COLORS.primary },
  pkgImage: { width: '100%', height: 110 },
  pkgName: { fontSize: 15, fontWeight: '800', color: COLORS.textHeading, paddingHorizontal: 12, paddingTop: 10 },
  pkgPrice: { fontSize: 14, fontWeight: '800', color: COLORS.primary, paddingHorizontal: 12, marginTop: 2 },
  pkgDesc: { fontSize: 12, color: COLORS.textSecondary, paddingHorizontal: 12, paddingBottom: 12, marginTop: 4 },
  memCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  memCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '06' },
  memTop: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  memName: { fontSize: 16, fontWeight: '800', color: COLORS.textHeading },
  memTag: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  memPrice: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  memPeriod: { fontSize: 11, color: COLORS.textSecondary },
  benefitRow: { flexDirection: 'row', gap: 8, marginBottom: 4, alignItems: 'flex-start' },
  benefitText: { flex: 1, fontSize: 12, color: COLORS.textSecondary },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  selectedBadgeText: { fontSize: 12, fontWeight: '700', color: '#059669' },
  selectBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  selectBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  rsaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  rsaCard: {
    width: '47%',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  rsaCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  rsaIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  rsaName: { fontSize: 13, fontWeight: '800', color: COLORS.textHeading },
  rsaDesc: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4, lineHeight: 15 },
});
