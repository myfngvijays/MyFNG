import { PRIME_MEMBERSHIP } from '../constants/publicAppData';
import {
  normalizeMembershipType,
  parseAppPlacements,
  type AppPlacements,
  type MembershipType,
} from './membershipPlacements';
import {
  parseCardPlacements,
  type CardPlacements,
} from './membershipCardPlacements';
import { supabase } from './supabase';
import {
  PRIME_VALUE_BENEFITS,
  PRIME_VALUE_FOOTER,
  PRIME_VALUE_TOTAL,
} from '../constants/primeMembershipValueCard';

export type PrimeMembershipDisplay = typeof PRIME_MEMBERSHIP;

export type AppMembershipPlan = ReturnType<typeof mapDbPlanToPrimeDisplay> & {
  planId?: string;
  planCode?: string;
  membershipType: MembershipType;
  appPlacements: AppPlacements;
  cardPlacements: CardPlacements;
  cardBenefitLine1: string;
  cardBenefitLine2: string;
  cardAnimated: boolean;
  accentColor?: string;
  accentTextColor?: string;
  headerIcon?: string;
  headerIconUrl?: string;
  headerIconClass?: string;
  showSecondCarAddonApp?: boolean;
};

export type ValueCardBenefit = {
  benefitCode?: string;
  showClaimButton?: boolean;
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
      benefitCode: b.benefit_code ? String(b.benefit_code) : undefined,
      showClaimButton: b.show_claim_button === true,
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
      benefitCode: b.benefitCode,
      showClaimButton: Boolean(b.showClaimButton),
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
    membershipType: normalizeMembershipType(plan?.membership_type),
    appPlacements: parseAppPlacements(plan?.app_placements, normalizeMembershipType(plan?.membership_type)),
    cardPlacements: parseCardPlacements(plan?.card_placements, normalizeMembershipType(plan?.membership_type)),
    cardBenefitLine1: String(plan?.card_benefit_line_1 || '10% off on all services'),
    cardBenefitLine2: String(plan?.card_benefit_line_2 || '5% cashback to wallet'),
    cardAnimated: plan?.card_animated !== false,
    accentColor: plan?.accent_color ? String(plan.accent_color) : undefined,
    accentTextColor: plan?.accent_text_color ? String(plan.accent_text_color) : undefined,
    headerIcon: plan?.header_icon ? String(plan.header_icon) : undefined,
    headerIconUrl: plan?.header_icon_url ? String(plan.header_icon_url) : undefined,
    headerIconClass: plan?.header_icon_class ? String(plan.header_icon_class) : undefined,
    showSecondCarAddonApp: plan?.show_second_car_addon_app !== false,
  } as AppMembershipPlan;
}

function mapPublicPlansPayload(plans: any[]): AppMembershipPlan[] {
  return sortPlans(plans.filter((p) => isAppMembershipPlan(p?.code) && p?.app_visible !== false)).map((plan) =>
    mapDbPlanToPrimeDisplay(plan, plan.benefits || []),
  ) as AppMembershipPlan[];
}

async function fetchMembershipPlansFromSupabase(): Promise<AppMembershipPlan[]> {
  const loadBenefits = async (planIds: string[]) => {
    if (!planIds.length) return {} as Record<string, any[]>;
    const { data: benefits } = await supabase
      .from('membership_benefits')
      .select('*')
      .in('plan_id', planIds)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    const benefitsByPlan: Record<string, any[]> = {};
    for (const benefit of benefits || []) {
      if (benefit?.active === false) continue;
      benefitsByPlan[benefit.plan_id] = benefitsByPlan[benefit.plan_id] || [];
      benefitsByPlan[benefit.plan_id].push(benefit);
    }
    return benefitsByPlan;
  };

  const mapRows = (rows: any[]) => {
    const visiblePlans = rows.filter((p) => isAppMembershipPlan(p.code) && p.app_visible !== false);
    return visiblePlans;
  };

  // Preferred: SECURITY DEFINER RPC (works even if table RLS was misconfigured).
  try {
    const { data: rpcPlans, error: rpcError } = await supabase.rpc('get_public_membership_plans');
    if (!rpcError && Array.isArray(rpcPlans) && rpcPlans.length) {
      const visiblePlans = mapRows(rpcPlans);
      const benefitsByPlan = await loadBenefits(visiblePlans.map((p) => p.id));
      return mapPublicPlansPayload(
        visiblePlans.map((plan) => ({
          ...plan,
          benefits: benefitsByPlan[plan.id] || [],
        })),
      );
    }
  } catch {
    // fall through
  }

  const { data: plans, error } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error || !plans?.length) return [];

  const visiblePlans = mapRows(plans);
  const benefitsByPlan = await loadBenefits(visiblePlans.map((p) => p.id));

  return mapPublicPlansPayload(
    visiblePlans.map((plan) => ({
      ...plan,
      benefits: benefitsByPlan[plan.id] || [],
    })),
  );
}

async function fetchMembershipPlansFromApi(apiUrl: string): Promise<AppMembershipPlan[]> {
  const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/public/membership-plans`, {
    headers: { Accept: 'application/json' },
    redirect: 'follow',
  });
  if (!res.ok) return [];
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return [];
  const json = await res.json().catch(() => null);
  if (!json || typeof json !== 'object') return [];
  const plans: any[] = Array.isArray(json?.plans) ? json.plans : [];
  if (!plans.length) return [];
  return mapPublicPlansPayload(plans);
}

export async function fetchAppMembershipPlans(
  apiUrl: string,
): Promise<AppMembershipPlan[]> {
  try {
    const fromSupabase = await fetchMembershipPlansFromSupabase();
    if (fromSupabase.length) return fromSupabase;
  } catch {
    // try API next
  }

  try {
    const fromApi = await fetchMembershipPlansFromApi(apiUrl);
    if (fromApi.length) return fromApi;
  } catch {
    // no plans
  }

  return [];
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
