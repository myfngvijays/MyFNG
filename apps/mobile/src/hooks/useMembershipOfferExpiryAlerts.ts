import { useEffect, useRef } from 'react';
import {
  buildMembershipOfferExpiredView,
  buildMembershipOfferPayView,
} from '../lib/postBookingMembershipOffer';
import { notifyMembershipOfferExpiredOnce } from '../lib/membershipOfferExpiryNotice';

type Options = {
  enabled?: boolean;
  membershipListPrice?: number;
  onExpired?: () => void | Promise<void>;
};

export function useMembershipOfferExpiryAlerts(
  orders: any[],
  tick: number,
  options: Options = {},
) {
  const { enabled = true, membershipListPrice = 699, onExpired } = options;
  const scheduledRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const activeOfferRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !Array.isArray(orders) || orders.length === 0) return;

    void (async () => {
      for (const order of orders) {
        if (buildMembershipOfferPayView(order, membershipListPrice)) continue;
        const expiredView = buildMembershipOfferExpiredView(order);
        if (!expiredView) continue;
        const expiredMs = expiredView.expiredAt ? new Date(expiredView.expiredAt).getTime() : 0;
        if (expiredMs > 0 && Date.now() - expiredMs > 7 * 24 * 60 * 60 * 1000) continue;
        await notifyMembershipOfferExpiredOnce(order, () => onExpired?.());
      }
    })();
  }, [enabled, membershipListPrice, onExpired, orders]);

  useEffect(() => {
    if (!enabled || !Array.isArray(orders)) return;

    const nextActive = new Set<string>();

    for (const order of orders) {
      const orderId = String(order?.id || '').trim();
      if (!orderId) continue;

      const offerPayView = buildMembershipOfferPayView(order, membershipListPrice);
      if (offerPayView?.offer.active) {
        nextActive.add(orderId);
        if (scheduledRef.current.has(orderId)) continue;

        const ms = new Date(offerPayView.offer.expires_at).getTime() - Date.now();
        if (ms <= 0) {
          void notifyMembershipOfferExpiredOnce(order, () => onExpired?.());
          continue;
        }

        const timeout = setTimeout(() => {
          scheduledRef.current.delete(orderId);
          void notifyMembershipOfferExpiredOnce(order, () => onExpired?.());
        }, ms + 400);
        scheduledRef.current.set(orderId, timeout);
      }
    }

    for (const orderId of activeOfferRef.current) {
      if (nextActive.has(orderId)) continue;
      const timeout = scheduledRef.current.get(orderId);
      if (timeout) {
        clearTimeout(timeout);
        scheduledRef.current.delete(orderId);
      }
    }

    activeOfferRef.current = nextActive;
  }, [enabled, membershipListPrice, onExpired, orders, tick]);

  useEffect(
    () => () => {
      scheduledRef.current.forEach(clearTimeout);
      scheduledRef.current.clear();
    },
    [],
  );
}
