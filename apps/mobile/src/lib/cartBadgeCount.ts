import ENV from '../config/environment';
import { getBookingDrafts, type BookingDraft } from './bookingDraft';
import { getCustomerSessionToken } from './customerSession';
import { mobileCustomerHeaders } from './welcomeBonus';

type CartCountListener = (count: number) => void;
const cartCountListeners = new Set<CartCountListener>();

export function subscribeCartBadgeCount(listener: CartCountListener): () => void {
  cartCountListeners.add(listener);
  return () => {
    cartCountListeners.delete(listener);
  };
}

export function notifyCartBadgeCountChanged(count?: number): void {
  if (typeof count === 'number') {
    const safe = Math.max(0, count);
    cartCountListeners.forEach((listener) => listener(safe));
    return;
  }
  void refreshCartBadgeCount();
}

export async function refreshCartBadgeCount(): Promise<number> {
  const count = await getCartBadgeCount();
  notifyCartBadgeCountChanged(count);
  return count;
}

export function countServerCartItems(items: unknown[]): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item: any) => sum + Math.max(1, Number(item?.quantity || 1)), 0);
}

/** Count selected services across all saved booking drafts. */
export function countDraftCartItems(drafts: BookingDraft[]): number {
  return drafts.reduce((sum, draft) => sum + (draft.selectedServices?.length || 0), 0);
}

/** Total badge count: booking draft services + logged-in server cart items. */
export async function getCartBadgeCount(): Promise<number> {
  const drafts = await getBookingDrafts();
  const draftCount = countDraftCartItems(drafts);

  try {
    const token = await getCustomerSessionToken();
    if (!token) return draftCount;

    const res = await fetch(`${ENV.API_URL}/api/customer/cart`, {
      headers: mobileCustomerHeaders(token),
      cache: 'no-store',
    });
    if (!res.ok) return draftCount;

    const json = await res.json().catch(() => ({}));
    const serverCount = countServerCartItems(json?.items || []);
    return draftCount + serverCount;
  } catch {
    return draftCount;
  }
}

export function countBookingServices(services: string[] | undefined): number {
  return services?.length || 0;
}

export function countLiveBookingCart(
  selectedServices: string[],
  includeMembership: boolean,
  hasMembershipPlan: boolean,
): number {
  let count = selectedServices.length;
  if (includeMembership && hasMembershipPlan) count += 1;
  return count;
}
