import React, { useEffect, useMemo, useState } from 'react';
import { ViewStyle } from 'react-native';
import PrimeMembershipValueCard from './PrimeMembershipValueCard';
import MembershipPlanCartCard from './MembershipPlanCartCard';
import { useAppMembershipPlans } from '../hooks/useAppMembershipPlans';
import type { MembershipType } from '../lib/membershipPlacements';
import { apiFetch } from '../lib/api';
import { getCustomerSessionToken } from '../lib/customerSession';
import { isMembershipActive } from '../lib/membershipTheme';

type Props = {
  screen: 'home' | 'rsa' | 'services';
  slot: string;
  navigation: any;
  style?: ViewStyle;
  membershipType?: MembershipType;
};

function getVehicleKey(vehicle: any, index = 0): string {
  const plate = String(vehicle?.vehicle_number || '').trim().toUpperCase();
  if (plate) return `plate:${plate}`;
  return `vehicle-${index}`;
}

function ActiveMembershipCard({
  plan,
  navigation,
  style,
}: {
  plan: ReturnType<ReturnType<typeof useAppMembershipPlans>['getPlansForSlot']>[number];
  navigation: any;
  style?: ViewStyle;
}) {
  const [currentMembership, setCurrentMembership] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getCustomerSessionToken().catch(() => null);
      if (!token || cancelled) return;
      const [memRes, vehiclesRes] = await Promise.all([
        apiFetch<any>('/api/customer/membership').catch(() => null),
        apiFetch<any>('/api/customer/vehicles').catch(() => null),
      ]);
      if (cancelled) return;
      setCurrentMembership(memRes?.membership || null);
      setVehicles(Array.isArray(vehiclesRes?.vehicles) ? vehiclesRes.vehicles : []);
    })();
    return () => { cancelled = true; };
  }, []);

  const isActive = Boolean(
    currentMembership?.plan_id &&
    String(currentMembership.plan_id) === String(plan.planId) &&
    isMembershipActive(currentMembership),
  );

  if (!isActive) return null;

  const primaryVehicle = vehicles[0];
  const linkedPrimaryVehicle = primaryVehicle
    ? {
        label: [primaryVehicle.make, primaryVehicle.model || primaryVehicle.model_name].filter(Boolean).join(' '),
        vehicle_number: primaryVehicle.vehicle_number,
        make: primaryVehicle.make,
        model: primaryVehicle.model || primaryVehicle.model_name,
      }
    : null;

  return (
    <PrimeMembershipValueCard
      embedded
      style={style}
      isLoggedIn
      isActive
      hasSecondCarAddon={Boolean(currentMembership?.has_second_car)}
      linkedPrimaryVehicle={linkedPrimaryVehicle}
      vehicles={[]}
      primaryVehicleKey={primaryVehicle ? getVehicleKey(primaryVehicle, 0) : null}
      onPrimaryVehicleKeyChange={() => {}}
      addSecondCar={false}
      onAddSecondCarChange={() => {}}
      secondVehicleKey={null}
      onSecondVehicleKeyChange={() => {}}
      showSecondVehicleForm={false}
      onShowSecondVehicleFormChange={() => {}}
      guestForm={{ name: '', phone: '', vehicleNumber: '', make: '', model: '' }}
      onGuestFormChange={() => {}}
      guestSecondForm={{ vehicleNumber: '', make: '', model: '' }}
      onGuestSecondFormChange={() => {}}
      onActivate={() => navigation.navigate('Settings', { subPage: 'Membership' })}
      planName={plan.name}
      planPrice={plan.priceNum}
      addonPrice={plan.addOn?.priceNum}
      tagline={plan.tagline}
      valueCard={plan.valueCard}
      addonIcon={plan.addOn?.icon}
      addonIconUrl={plan.addOn?.iconUrl}
      addonTitle={plan.addOn?.title}
      addonDescription={plan.addOn?.description}
      footerNote={plan.footerNote}
      membershipType={plan.membershipType}
      accentColor={plan.accentColor}
      accentTextColor={plan.accentTextColor}
      headerIcon={plan.headerIcon}
      headerIconUrl={plan.headerIconUrl}
      showSecondCarAddon={plan.showSecondCarAddonApp !== false}
    />
  );
}

export default function MembershipValueCardSlot({
  screen,
  slot,
  navigation,
  style,
  membershipType = 'SERVICE',
}: Props) {
  const { getPlansForSlot } = useAppMembershipPlans();
  const plans = getPlansForSlot(screen, slot).filter(
    (plan) => plan.membershipType === membershipType,
  );
  const [addingPlanId, setAddingPlanId] = useState<string | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getCustomerSessionToken().catch(() => null);
      if (!token || cancelled) return;
      const memRes = await apiFetch<any>('/api/customer/membership').catch(() => null);
      if (!cancelled) setMembershipStatus(memRes?.membership || null);
    })();
    return () => { cancelled = true; };
  }, []);

  const activePlanId = useMemo(() => {
    if (!membershipStatus || !isMembershipActive(membershipStatus)) return null;
    return String(membershipStatus.plan_id || '');
  }, [membershipStatus]);

  if (!plans.length) return null;

  return (
    <>
      {plans.map((plan) => {
        const planKey = plan.planId || plan.planCode || plan.name;
        const isThisPlanActive = activePlanId && String(plan.planId) === activePlanId;

        if (isThisPlanActive) {
          return (
            <ActiveMembershipCard
              key={planKey}
              plan={plan}
              navigation={navigation}
              style={style}
            />
          );
        }

        return (
          <MembershipPlanCartCard
            key={planKey}
            plan={plan}
            navigation={navigation}
            style={style}
            isAdding={addingPlanId === planKey}
            onAddingChange={(adding) => setAddingPlanId(adding ? planKey : null)}
          />
        );
      })}
    </>
  );
}
