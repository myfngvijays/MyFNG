import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { PRIME_MEMBERSHIP } from '../constants/publicAppData';
import { ENV } from '../config/environment';
import { apiFetch } from '../lib/api';
import { fetchAppMembershipPlans, fetchPrimeMembershipConfig, type AppMembershipPlan } from '../lib/membershipPlan';
import { isMembershipActive } from '../lib/membershipTheme';
import { activatePostBookingMembership, quotePostBookingMembership } from '../lib/postBookingMembership';
import {
  findPendingMembershipOfferOrder,
  resolveMembershipListPrice,
  resolveOrderMembershipOffer,
  type MembershipOfferPayView,
} from '../lib/postBookingMembershipOffer';
import {
  DEFAULT_POST_BOOKING_MEMBERSHIP_APP_CONFIG,
  fetchPostBookingMembershipAppConfig,
  mergePostBookingMembershipAppConfig,
  type PostBookingMembershipAppConfig,
} from '../lib/postBookingMembershipAppConfig';
import { useMembershipOfferExpiryAlerts } from './useMembershipOfferExpiryAlerts';

type PendingOffer = {
  order: any;
  offerPayView: MembershipOfferPayView;
};

export function usePendingPostBookingMembershipOffer(enabled: boolean) {
  const [pending, setPending] = useState<PendingOffer | null>(null);
  const [paying, setPaying] = useState(false);
  const [tick, setTick] = useState(0);
  const [membershipPlan, setMembershipPlan] = useState<AppMembershipPlan | null>(null);
  const [appConfig, setAppConfig] = useState<PostBookingMembershipAppConfig>(
    DEFAULT_POST_BOOKING_MEMBERSHIP_APP_CONFIG,
  );

  const refresh = useCallback(async () => {
    if (!enabled) {
      setPending(null);
      return;
    }
    try {
      const [ordersRes, meRes, plans, publicConfig] = await Promise.all([
        apiFetch<any>('/api/customer/orders'),
        apiFetch<any>('/api/customer/auth/me').catch(() => null),
        fetchAppMembershipPlans(ENV.API_URL).catch(() => []),
        fetchPostBookingMembershipAppConfig().catch(() => DEFAULT_POST_BOOKING_MEMBERSHIP_APP_CONFIG),
      ]);
      const mergedConfig = mergePostBookingMembershipAppConfig(
        ordersRes?.post_booking_membership_settings || publicConfig,
      );
      setAppConfig(mergedConfig);

      if (!mergedConfig.enabled) {
        setPending(null);
        return;
      }

      const membership = meRes?.membership || meRes?.customer?.membership || null;
      const hasActiveMembership = isMembershipActive(membership);
      const plan =
        (Array.isArray(plans) && plans.length > 0 ? plans[0] : null) ||
        ((await fetchPrimeMembershipConfig(ENV.API_URL).catch(() => null)) as AppMembershipPlan | null);
      setMembershipPlan(plan);
      const orders = Array.isArray(ordersRes?.orders) ? ordersRes.orders : [];
      setPending(findPendingMembershipOfferOrder(orders, hasActiveMembership, plan || PRIME_MEMBERSHIP));
    } catch {
      setPending(null);
    }
  }, [enabled]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [pending?.order?.id]);

  const membershipListPrice = resolveMembershipListPrice(membershipPlan || PRIME_MEMBERSHIP);

  useMembershipOfferExpiryAlerts(pending ? [pending.order] : [], tick, {
    enabled: enabled && appConfig.enabled && appConfig.show_on_home,
    membershipListPrice,
    onExpired: refresh,
  });

  const pay = useCallback(async () => {
    const order = pending?.order;
    if (!order?.id) return;
    const offer = resolveOrderMembershipOffer(order);
    if (!offer?.active) {
      await refresh();
      return;
    }

    let plan = membershipPlan;
    if (!plan?.planId) {
      plan = (await fetchPrimeMembershipConfig(ENV.API_URL).catch(() => null)) as AppMembershipPlan | null;
    }
    if (!plan?.planId) {
      Alert.alert('Membership', 'Plan details not available. Please try again.');
      return;
    }

    const serviceSubtotal = Number(offer.service_subtotal || 0);
    const quote = quotePostBookingMembership(serviceSubtotal, plan);
    if (!quote) {
      Alert.alert('Membership', 'Could not calculate membership price.');
      return;
    }

    setPaying(true);
    try {
      await activatePostBookingMembership({
        apiFetch,
        plan,
        leadId: String(order.id),
        serviceSubtotal,
        expectedPayable: quote.payable,
        vehicle: {
          vehicle_number: String(order.vehicle_number || '').trim().toUpperCase(),
          make: String(order.vehicle_make || '').trim(),
          model: String(order.vehicle_model || '').trim(),
        },
      });
      Alert.alert('Success', 'Prime membership activated successfully.');
      await refresh();
    } catch (err: any) {
      Alert.alert('Payment failed', err?.message || 'Could not activate membership.');
    } finally {
      setPaying(false);
    }
  }, [membershipPlan, pending?.order, refresh]);

  return { pending, paying, tick, pay, refresh, appConfig };
}
