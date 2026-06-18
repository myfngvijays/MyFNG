import { PRIME_MEMBERSHIP } from '../constants/publicAppData';
import {
  PRIME_VALUE_BENEFITS,
  PRIME_VALUE_FOOTER,
  PRIME_VALUE_TOTAL,
} from '../constants/primeMembershipValueCard';

export type PrimeMembershipDisplay = typeof PRIME_MEMBERSHIP;

export type ValueCardBenefit = {
  icon: string;
  iconUrl?: string;
  iconClass?: string;
  title: string;
  description: string;
  valueLabel: string;
  valuePrefix?: string;
};

export type ValueCardConfig = {
  benefits: ValueCardBenefit[];
  totalBenefitsValue: number;
  saveAmount: number;
  valueColumnLabel: string;
  totalBenefitsLabel: string;
  saveLabel: string;
  priceHeroLabel: string;
  priceHeroSub: string;
  footerNote: string;
  tagline: string;
};

const LEGACY_MEMBERSHIP_CODES = new Set(['BRONZE', 'SILVER', 'GOLD']);

export function isAppMembershipPlan(code: unknown): boolean {
  return !LEGACY_MEMBERSHIP_CODES.has(String(code || '').toUpperCase());
}

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function sortPlans(plans: any[]) {
  return [...plans].sort((a, b) => {
    const orderDiff = (Number(a.display_order) || 0) - (Number(b.display_order) || 0);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });
}

export function mapDbPlanToPrimeDisplay(plan: any, benefits: any[] = []): PrimeMembershipDisplay {
  const priceNum = Number(plan?.price || 0);
  const originalPriceNum = plan?.original_price != null ? Number(plan.original_price) : 0;
  const addonPrice = Number(plan?.second_car_addon_price || 299);

  const mappedBenefits: ValueCardBenefit[] = (benefits || [])
    .filter((b) => b?.active !== false)
    .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0))
    .map((b) => ({
      icon: String(b.icon || 'star'),
      iconUrl: b.icon_url ? String(b.icon_url) : undefined,
      iconClass: b.icon_class ? String(b.icon_class) : undefined,
      title: String(b.title || ''),
      description: String(b.description || ''),
      valueLabel: String(b.value_label || ''),
      valuePrefix: b.value_prefix ? String(b.value_prefix) : undefined,
    }));

  const totalBenefitsValue = Number(plan?.total_benefits_value ?? PRIME_VALUE_TOTAL);
  const saveAmount = Math.max(0, totalBenefitsValue - priceNum);

  const valueCard: ValueCardConfig = {
    benefits: mappedBenefits.length > 0 ? mappedBenefits : PRIME_VALUE_BENEFITS.map((b) => ({
      icon: b.icon,
      title: b.title,
      description: b.description,
      valueLabel: b.valueLabel,
      valuePrefix: b.valuePrefix,
    })),
    totalBenefitsValue,
    saveAmount,
    valueColumnLabel: String(plan?.value_column_label || 'VALUE'),
    totalBenefitsLabel: String(plan?.total_benefits_label || 'Total Benefits Value'),
    saveLabel: String(plan?.save_label || 'You Save'),
    priceHeroLabel: String(plan?.price_hero_label || 'YOU PAY ONLY'),
    priceHeroSub: String(plan?.price_hero_sub || 'All benefits · One full year · One car'),
    footerNote: String(plan?.footer_note || PRIME_VALUE_FOOTER),
    tagline: String(plan?.tagline || PRIME_MEMBERSHIP.tagline),
  };

  const legacyMappedBenefits = valueCard.benefits.map((b) => ({
    icon: b.icon,
    title: b.title,
    description: b.description,
    iconUrl: b.iconUrl,
  }));

  return {
    name: String(plan?.name || PRIME_MEMBERSHIP.name),
    badge: String(plan?.badge || 'MEMBERSHIP'),
    price: inr(priceNum),
    priceNum,
    originalPrice: originalPriceNum > 0 ? inr(originalPriceNum) : '',
    originalPriceNum,
    period: String(plan?.period_label || '/ Year'),
    tagline: valueCard.tagline,
    benefits: legacyMappedBenefits.length > 0 ? legacyMappedBenefits : PRIME_MEMBERSHIP.benefits,
    valueCard,
    addOn: {
      icon: String(plan?.second_car_addon_icon || 'car-sport'),
      iconUrl: plan?.second_car_addon_icon_url ? String(plan.second_car_addon_icon_url) : undefined,
      iconClass: plan?.second_car_addon_icon_class ? String(plan.second_car_addon_icon_class) : undefined,
      title: String(plan?.second_car_addon_title || '2nd Car Add-On'),
      description: String(plan?.second_car_addon_description || PRIME_MEMBERSHIP.addOn.description),
      price: `+${inr(addonPrice)}`,
      priceNum: addonPrice,
    },
    footerNote: valueCard.footerNote,
    planId: plan?.id ? String(plan.id) : undefined,
    planCode: plan?.code ? String(plan.code) : undefined,
  } as PrimeMembershipDisplay & { planId?: string; planCode?: string; valueCard: ValueCardConfig; addOn: { priceNum: number; iconUrl?: string; iconClass?: string } };
}

export async function fetchAppMembershipPlans(
  apiUrl: string,
): Promise<(PrimeMembershipDisplay & { planId?: string; planCode?: string })[]> {
  try {
    const res = await fetch(`${apiUrl}/api/public/membership-plans`);
    if (!res.ok) return [];
    const json = await res.json();
    const plans: any[] = Array.isArray(json?.plans) ? json.plans : [];
    return sortPlans(plans.filter((p) => isAppMembershipPlan(p?.code))).map((plan) =>
      mapDbPlanToPrimeDisplay(plan, plan.benefits || []),
    );
  } catch {
    return [];
  }
}

export async function fetchPrimeMembershipConfig(
  apiUrl: string,
): Promise<(PrimeMembershipDisplay & { planId?: string; planCode?: string }) | null> {
  const plans = await fetchAppMembershipPlans(apiUrl);
  if (plans.length === 0) return null;
  return (
    plans.find((p) => String(p.planCode || '').toUpperCase() === 'PRIME') ||
    plans[0]
  );
}
