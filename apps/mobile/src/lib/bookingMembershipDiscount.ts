export const BOOKING_MEMBERSHIP_EXTRA_DISCOUNT_PERCENT = 5;
export const BOOKING_MEMBERSHIP_EXTRA_DISCOUNT_MAX_INR = 250;

export function calculateBookingMembershipExtraDiscount(
  serviceSubtotal: number,
  opts?: { includeMembership?: boolean; hasActiveMembership?: boolean },
): number {
  if (!opts?.includeMembership || opts?.hasActiveMembership || serviceSubtotal <= 0) return 0;
  const raw = serviceSubtotal * (BOOKING_MEMBERSHIP_EXTRA_DISCOUNT_PERCENT / 100);
  return Math.min(Math.round(raw), BOOKING_MEMBERSHIP_EXTRA_DISCOUNT_MAX_INR);
}

export function bookingMembershipExtraDiscountLabel(): string {
  return `Extra ${BOOKING_MEMBERSHIP_EXTRA_DISCOUNT_PERCENT}% off (up to ₹${BOOKING_MEMBERSHIP_EXTRA_DISCOUNT_MAX_INR.toLocaleString('en-IN')})`;
}
