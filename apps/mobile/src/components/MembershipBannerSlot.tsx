import React from 'react';
import { ViewStyle } from 'react-native';
import PrimeBanner, { type PrimeBannerPlan } from './PrimeBanner';
import { useAppMembershipPlans } from '../hooks/useAppMembershipPlans';
import type { MembershipType } from '../lib/membershipPlacements';

type Props = {
  screen: 'home' | 'rsa' | 'services';
  slot: string;
  navigation: any;
  style?: ViewStyle;
  membershipType?: MembershipType;
};

export default function MembershipBannerSlot({
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
      {plans.map((plan) => {
        const bannerPlan: PrimeBannerPlan = {
          name: plan.name,
          badge: plan.badge,
          price: plan.price,
          originalPrice: plan.originalPrice,
          period: plan.period?.replace('/', '').trim() || 'year',
          benefitLine1: plan.benefits?.[0]?.title || (plan.membershipType === 'RSA' ? 'Priority RSA dispatch' : '10% off on all services'),
          benefitLine2: plan.benefits?.[1]?.title || (plan.membershipType === 'RSA' ? 'Discounted towing rates' : '5% cashback to wallet'),
          membershipType: plan.membershipType,
        };
        return (
          <PrimeBanner
            key={plan.planId || plan.planCode || plan.name}
            plan={bannerPlan}
            animated
            style={style}
            onPress={() =>
              navigation.navigate('Settings', {
                subPage: 'Membership',
                membershipType: plan.membershipType,
                planCode: plan.planCode,
              })
            }
          />
        );
      })}
    </>
  );
}
