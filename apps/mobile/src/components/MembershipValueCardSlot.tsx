import React from 'react';
import { ViewStyle } from 'react-native';
import PrimeMembershipValueCard from './PrimeMembershipValueCard';
import { useAppMembershipPlans } from '../hooks/useAppMembershipPlans';
import type { AppMembershipPlan } from '../lib/membershipPlan';
import type { MembershipType } from '../lib/membershipPlacements';

type Props = {
  screen: 'home' | 'rsa' | 'services';
  slot: string;
  navigation: any;
  style?: ViewStyle;
  membershipType?: MembershipType;
};

const noop = () => {};

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
  };
}

export default function MembershipValueCardSlot({
  screen,
  slot,
  navigation,
  style,
  membershipType,
}: Props) {
  const { getPlansForSlot } = useAppMembershipPlans();
  const plans = getPlansForSlot(screen, slot).filter(
    (plan) => (membershipType ? plan.membershipType === membershipType : true),
  );

  if (!plans.length) return null;

  return (
    <>
      {plans.map((plan) => (
        <PrimeMembershipValueCard
          key={plan.planId || plan.planCode || plan.name}
          preview
          style={style}
          isLoggedIn={false}
          isActive={false}
          vehicles={[]}
          primaryVehicleKey={null}
          onPrimaryVehicleKeyChange={noop}
          addSecondCar={false}
          onAddSecondCarChange={noop}
          secondVehicleKey={null}
          onSecondVehicleKeyChange={noop}
          showSecondVehicleForm={false}
          onShowSecondVehicleFormChange={noop}
          guestForm={{ name: '', phone: '', vehicleNumber: '', make: '', model: '' }}
          onGuestFormChange={noop}
          guestSecondForm={{ vehicleNumber: '', make: '', model: '' }}
          onGuestSecondFormChange={noop}
          onActivate={noop}
          onPreviewPress={() =>
            navigation.navigate('Settings', {
              subPage: 'Membership',
              membershipType: plan.membershipType,
              planCode: plan.planCode,
            })
          }
          {...planToPreviewProps(plan)}
        />
      ))}
    </>
  );
}
