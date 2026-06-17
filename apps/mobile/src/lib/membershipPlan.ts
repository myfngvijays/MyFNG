import { PRIME_MEMBERSHIP } from '../constants/publicAppData';

export type PrimeMembershipDisplay = typeof PRIME_MEMBERSHIP;

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export function mapDbPlanToPrimeDisplay(plan: any, benefits: any[] = []): PrimeMembershipDisplay {
  const priceNum = Number(plan?.price || 0);
  const originalPriceNum = plan?.original_price != null ? Number(plan.original_price) : 0;
  const addonPrice = Number(plan?.second_car_addon_price || 299);

  const mappedBenefits = (benefits || [])
    .filter((b) => b?.active !== false)
    .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0))
    .map((b) => ({
      icon: String(b.icon || 'star'),
      title: String(b.title || ''),
      description: String(b.description || ''),
      iconUrl: b.icon_url ? String(b.icon_url) : undefined,
    }));

  return {
    name: String(plan?.name || PRIME_MEMBERSHIP.name),
    badge: String(plan?.badge || 'MEMBERSHIP'),
    price: inr(priceNum),
    priceNum,
    originalPrice: originalPriceNum > 0 ? inr(originalPriceNum) : '',
    originalPriceNum,
    period: String(plan?.period_label || '/ Year'),
    tagline: String(plan?.tagline || ''),
    benefits: mappedBenefits.length > 0 ? mappedBenefits : PRIME_MEMBERSHIP.benefits,
    addOn: {
      icon: String(plan?.second_car_addon_icon || 'car-sport'),
      title: String(plan?.second_car_addon_title || '2nd Car Add-On'),
      description: String(plan?.second_car_addon_description || ''),
      price: `+${inr(addonPrice)}`,
      priceNum: addonPrice,
    },
    footerNote: String(plan?.footer_note || PRIME_MEMBERSHIP.footerNote),
    planId: plan?.id ? String(plan.id) : undefined,
    planCode: plan?.code ? String(plan.code) : undefined,
  } as PrimeMembershipDisplay & { planId?: string; planCode?: string; addOn: { priceNum: number } };
}

export async function fetchPrimeMembershipConfig(apiUrl: string): Promise<(PrimeMembershipDisplay & { planId?: string; planCode?: string }) | null> {
  try {
    const res = await fetch(`${apiUrl}/api/public/membership-plans`);
    if (!res.ok) return null;
    const json = await res.json();
    const plans: any[] = Array.isArray(json?.plans) ? json.plans : [];
    const prime =
      plans.find((p) => String(p?.code || '').toUpperCase() === 'PRIME') ||
      plans.find((p) => p?.active) ||
      plans[0];
    if (!prime) return null;
    return mapDbPlanToPrimeDisplay(prime, prime.benefits || []);
  } catch {
    return null;
  }
}
