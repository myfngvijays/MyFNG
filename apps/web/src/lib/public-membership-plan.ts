import { parseAppPlacements, normalizeMembershipType, type MembershipType } from '@/lib/membership-placements';
import { parseCardPlacements } from '@/lib/membership-card-placements';

export type PublicMembershipBenefit = {
  id?: string;
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

export type PublicMembershipPlan = {
  planId: string;
  planCode: string;
  name: string;
  tagline: string;
  price: number;
  originalPrice?: number;
  periodLabel: string;
  membershipType: MembershipType;
  accentColor?: string;
  accentTextColor?: string;
  headerIcon?: string;
  headerIconUrl?: string;
  headerIconClass?: string;
  footerNote?: string;
  totalBenefitsValue: number;
  valueColumnLabel: string;
  totalBenefitsLabel: string;
  saveLabel: string;
  priceHeroLabel: string;
  priceHeroSub: string;
  secondCarAddonPrice: number;
  secondCarAddonTitle: string;
  secondCarAddonDescription: string;
  secondCarAddonIcon?: string;
  secondCarAddonIconUrl?: string;
  secondCarAddonIconClass?: string;
  showSecondCarAddonWeb: boolean;
  showSecondCarAddonApp: boolean;
  webVisible: boolean;
  webCtaAction: 'whatsapp' | 'cart' | 'link';
  webCtaLabel: string;
  webCtaWhatsappPhone: string;
  webCtaWhatsappMessage: string;
  webCtaUrl?: string;
  benefits: PublicMembershipBenefit[];
  appPlacements: ReturnType<typeof parseAppPlacements>;
  displayOrder: number;
};

function inrNum(n: number) {
  return Number(n || 0);
}

function normalizeWebCtaAction(raw: unknown): 'whatsapp' | 'cart' | 'link' {
  const v = String(raw || 'whatsapp').toLowerCase();
  if (v === 'cart' || v === 'link') return v;
  return 'whatsapp';
}

export function mapPublicMembershipPlan(row: any): PublicMembershipPlan {
  const membershipType = normalizeMembershipType(row?.membership_type);
  const benefitsRaw = Array.isArray(row?.benefits) ? row.benefits : [];
  const benefits: PublicMembershipBenefit[] = benefitsRaw
    .filter((b: any) => b?.active !== false)
    .sort((a: any, b: any) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0))
    .map((b: any) => ({
      id: b.id ? String(b.id) : undefined,
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

  return {
    planId: String(row.id),
    planCode: String(row.code || ''),
    name: String(row.name || ''),
    tagline: String(row.tagline || ''),
    price: inrNum(row.price),
    originalPrice: row.original_price != null ? inrNum(row.original_price) : undefined,
    periodLabel: String(row.period_label || '/ year'),
    membershipType,
    accentColor: row.accent_color ? String(row.accent_color) : undefined,
    accentTextColor: row.accent_text_color ? String(row.accent_text_color) : undefined,
    headerIcon: row.header_icon ? String(row.header_icon) : undefined,
    headerIconUrl: row.header_icon_url ? String(row.header_icon_url) : undefined,
    headerIconClass: row.header_icon_class ? String(row.header_icon_class) : undefined,
    footerNote: row.footer_note ? String(row.footer_note) : undefined,
    totalBenefitsValue: inrNum(row.total_benefits_value),
    valueColumnLabel: String(row.value_column_label || 'VALUE'),
    totalBenefitsLabel: String(row.total_benefits_label || 'Total Benefits Value'),
    saveLabel: String(row.save_label || 'You Save'),
    priceHeroLabel: String(row.price_hero_label || 'YOU PAY ONLY'),
    priceHeroSub: String(row.price_hero_sub || ''),
    secondCarAddonPrice: inrNum(row.second_car_addon_price || 299),
    secondCarAddonTitle: String(row.second_car_addon_title || '2nd Car Add-On'),
    secondCarAddonDescription: String(row.second_car_addon_description || ''),
    secondCarAddonIcon: row.second_car_addon_icon ? String(row.second_car_addon_icon) : undefined,
    secondCarAddonIconUrl: row.second_car_addon_icon_url ? String(row.second_car_addon_icon_url) : undefined,
    secondCarAddonIconClass: row.second_car_addon_icon_class ? String(row.second_car_addon_icon_class) : undefined,
    showSecondCarAddonWeb: row.show_second_car_addon_web === true,
    showSecondCarAddonApp: row.show_second_car_addon_app !== false,
    webVisible: row.web_visible !== false,
    webCtaAction: normalizeWebCtaAction(row.web_cta_action),
    webCtaLabel: String(row.web_cta_label || 'Add to Cart — {price} →'),
    webCtaWhatsappPhone: String(row.web_cta_whatsapp_phone || '919167779696'),
    webCtaWhatsappMessage: String(
      row.web_cta_whatsapp_message || 'Hi I am interested in RSA Membership {plan_name} Plan',
    ),
    webCtaUrl: row.web_cta_url ? String(row.web_cta_url) : undefined,
    benefits,
    appPlacements: parseAppPlacements(row.app_placements, membershipType),
    displayOrder: Number(row.display_order) || 0,
  };
}

export async function fetchPublicMembershipPlans(): Promise<PublicMembershipPlan[]> {
  const res = await fetch('/api/public/membership-plans', { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return (json.plans || [])
    .map(mapPublicMembershipPlan)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}
