export const PREMIUM_LUXURY_VEHICLE_CLASS = 'PREMIUM LUXURY';

export const PREMIUM_LUXURY_PRICING_MESSAGE =
  'Online pricing is not available for premium luxury vehicles. Our team will contact you with a custom quote.';

export function isPremiumLuxuryClass(vehicleClass: string | null | undefined): boolean {
  return String(vehicleClass || '')
    .trim()
    .toUpperCase() === PREMIUM_LUXURY_VEHICLE_CLASS;
}

export function premiumLuxuryPricingBlocked(vehicleClass: string | null | undefined): boolean {
  return isPremiumLuxuryClass(vehicleClass);
}
