export const BOOKING_MEMBERSHIP_BUNDLE_DISCOUNT_PERCENT = 5;
export const BOOKING_MEMBERSHIP_BUNDLE_DISCOUNT_MAX_INR = 250;

export function calculateBookingMembershipBundleDiscount(serviceSubtotal: number): number {
  if (serviceSubtotal <= 0) return 0;
  const raw = serviceSubtotal * (BOOKING_MEMBERSHIP_BUNDLE_DISCOUNT_PERCENT / 100);
  return Math.min(Math.round(raw), BOOKING_MEMBERSHIP_BUNDLE_DISCOUNT_MAX_INR);
}
