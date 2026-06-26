import ENV from '../config/environment';
import { getBookingDrafts, countDraftCartItems, type BookingDraft } from './bookingDraft';
import { getCustomerSessionToken } from './customerSession';
import { mobileCustomerHeaders } from './welcomeBonus';

export function countServerCartItems(items: unknown[]): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item: any) => sum + Math.max(1, Number(item?.quantity || 1)), 0);
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
