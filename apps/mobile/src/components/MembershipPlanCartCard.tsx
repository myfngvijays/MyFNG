import React, { useState } from 'react';
import { Alert, StyleSheet, View, ViewStyle } from 'react-native';
import PrimeMembershipValueCard, { type GuestVehicleForm } from './PrimeMembershipValueCard';
import type { AppMembershipPlan } from '../lib/membershipPlan';
import { apiFetch } from '../lib/api';
import { getCustomerSessionToken } from '../lib/customerSession';
import { addMembershipPlanToCart } from '../lib/addMembershipPlanToCart';
import type { MembershipSecondVehicle } from '../lib/membershipCart';

const noop = () => {};

function planPeriodLabel(plan: AppMembershipPlan) {
  const raw = String(plan.period || '').trim();
  if (!raw) return '/ year';
  return raw.startsWith('/') ? raw : ` / ${raw}`;
}

function planToPreviewProps(plan: AppMembershipPlan) {
  return {
    planName: plan.name,
    planPrice: plan.priceNum,
    addonPrice: plan.addOn?.priceNum,
    tagline: plan.tagline,
    valueCard: plan.valueCard,
    addonIcon: plan.addOn?.icon,
    addonIconUrl: plan.addOn?.iconUrl,
    addonTitle: plan.addOn?.title,
    addonDescription: plan.addOn?.description,
    footerNote: plan.footerNote,
    membershipType: plan.membershipType,
    accentColor: plan.accentColor,
    accentTextColor: plan.accentTextColor,
    pricePeriodLabel: planPeriodLabel(plan),
  };
}

type Props = {
  plan: AppMembershipPlan;
  navigation: any;
  style?: ViewStyle;
  isAdding?: boolean;
  onAddingChange?: (adding: boolean) => void;
};

export default function MembershipPlanCartCard({
  plan,
  navigation,
  style,
  isAdding = false,
  onAddingChange,
}: Props) {
  const [addSecondCar, setAddSecondCar] = useState(false);
  const [showSecondVehicleForm, setShowSecondVehicleForm] = useState(false);
  const [guestSecondForm, setGuestSecondForm] = useState<
    Pick<GuestVehicleForm, 'vehicleNumber' | 'make' | 'model' | 'carSearchDisplay'>
  >({
    vehicleNumber: '',
    make: '',
    model: '',
  });

  const handleAdd = async () => {
    let secondVehicle: MembershipSecondVehicle | null = null;
    if (addSecondCar) {
      const vehicleNumber = guestSecondForm.vehicleNumber.trim().toUpperCase();
      const make = guestSecondForm.make.trim();
      const model = guestSecondForm.model.trim();
      if (!vehicleNumber || !make || !model) {
        Alert.alert('2nd Car Required', 'Please enter 2nd car number and search-select your car model.');
        return;
      }
      secondVehicle = { vehicle_number: vehicleNumber, make, model };
    }

    onAddingChange?.(true);
    try {
      const result = await addMembershipPlanToCart({
        navigation,
        plan,
        addSecondCar,
        secondVehicle,
        apiFetch,
        getToken: getCustomerSessionToken,
      });
      if (!result.ok) {
        Alert.alert('Cart', result.error || 'Could not add membership to cart.');
      }
    } catch (err: any) {
      Alert.alert('Cart', err?.message || 'Could not add membership to cart.');
    } finally {
      onAddingChange?.(false);
    }
  };

  return (
    <View style={[styles.wrap, style]}>
      <PrimeMembershipValueCard
        preview
        previewInteractiveAddon
        style={styles.card}
        isLoggedIn={false}
        isActive={false}
        vehicles={[]}
        primaryVehicleKey={null}
        onPrimaryVehicleKeyChange={noop}
        addSecondCar={addSecondCar}
        onAddSecondCarChange={setAddSecondCar}
        secondVehicleKey={null}
        onSecondVehicleKeyChange={noop}
        showSecondVehicleForm={showSecondVehicleForm}
        onShowSecondVehicleFormChange={setShowSecondVehicleForm}
        guestForm={{ name: '', phone: '', vehicleNumber: '', make: '', model: '' }}
        onGuestFormChange={noop}
        guestSecondForm={guestSecondForm}
        onGuestSecondFormChange={(patch) => setGuestSecondForm((prev) => ({ ...prev, ...patch }))}
        onActivate={noop}
        previewCtaLabel={isAdding ? 'Adding...' : 'Add to Cart'}
        onPreviewPress={() => {
          if (!isAdding) handleAdd();
        }}
        {...planToPreviewProps(plan)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 0 },
  card: { marginBottom: 0 },
});
