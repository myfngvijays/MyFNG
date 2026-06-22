export type CouponTypeRecord = {
  slug: string;
  label: string;
  is_system?: boolean;
  display_order?: number;
};

export type CouponPlatformChannel = 'WEB' | 'ANDROID' | 'IOS' | 'MEMBERSHIP' | 'TELECALLER' | 'MOBILE' | 'ALL';

export const DEFAULT_COUPON_TYPES: CouponTypeRecord[] = [
  { slug: 'welcome', label: 'Welcome Coupon', is_system: true, display_order: 1 },
  { slug: 'flat', label: 'Flat Discount', is_system: true, display_order: 2 },
  { slug: 'percent', label: 'Percentage Discount', is_system: true, display_order: 3 },
  { slug: 'free_service', label: 'Free Service', is_system: true, display_order: 4 },
  { slug: 'bundle', label: 'Bundle Offer', is_system: true, display_order: 5 },
  { slug: 'free_checkup', label: 'Free Checkup', is_system: true, display_order: 6 },
  { slug: 'referral', label: 'Referral Coupon', is_system: true, display_order: 7 },
  { slug: 'society', label: 'Society Coupon', is_system: true, display_order: 8 },
  { slug: 'festival', label: 'Festival Coupon', is_system: true, display_order: 9 },
  { slug: 'corporate', label: 'Corporate Coupon', is_system: true, display_order: 10 },
  { slug: 'loyalty', label: 'Loyalty Coupon', is_system: true, display_order: 11 },
  { slug: 'cashback', label: 'Cashback Coupon', is_system: true, display_order: 12 },
  { slug: 'scratch', label: 'Scratch Card', is_system: true, display_order: 13 },
];

export const COUPON_PLATFORM_CHANNELS: Array<{ id: Exclude<CouponPlatformChannel, 'MOBILE' | 'ALL'>; label: string }> = [
  { id: 'WEB', label: 'Website' },
  { id: 'ANDROID', label: 'Android App' },
  { id: 'IOS', label: 'iOS App' },
  { id: 'MEMBERSHIP', label: 'Membership Checkout' },
  { id: 'TELECALLER', label: 'Telecaller Panel' },
];

export function slugifyCouponType(label: string) {
  const base = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || `type_${Date.now()}`;
}

export function couponTypeFilterOptions(types: CouponTypeRecord[]) {
  return [
    { value: 'all', label: 'All Types' },
    ...types.map((t) => ({ value: t.slug, label: t.label })),
  ];
}

export function applyCouponTypeDefaults(typeSlug: string): {
  coupon_kind: 'TOTAL_DISCOUNT' | 'FREE_SERVICE';
  discount_mode: 'AMOUNT' | 'PERCENT' | '';
} {
  if (typeSlug === 'free_service' || typeSlug === 'free_checkup') {
    return { coupon_kind: 'FREE_SERVICE', discount_mode: '' };
  }
  if (typeSlug === 'percent') {
    return { coupon_kind: 'TOTAL_DISCOUNT', discount_mode: 'PERCENT' };
  }
  return { coupon_kind: 'TOTAL_DISCOUNT', discount_mode: 'AMOUNT' };
}

export function inferCouponTypeSlug(coupon: any): string {
  if (coupon?.coupon_type_slug) return String(coupon.coupon_type_slug);
  const kind = String(coupon?.coupon_kind || '').toUpperCase();
  if (kind === 'FREE_SERVICE') {
    const hay = [coupon?.description, coupon?.campaign_name, coupon?.code].filter(Boolean).join(' ').toLowerCase();
    return hay.includes('checkup') ? 'free_checkup' : 'free_service';
  }
  if (coupon?.discount_mode === 'PERCENT') return 'percent';
  const hay = [coupon?.description, coupon?.campaign_name, coupon?.code].filter(Boolean).join(' ').toLowerCase();
  if (hay.includes('scratch')) return 'scratch';
  if (hay.includes('cashback')) return 'cashback';
  if (hay.includes('welcome')) return 'welcome';
  if (hay.includes('referral')) return 'referral';
  if (hay.includes('society')) return 'society';
  if (hay.includes('festival')) return 'festival';
  if (hay.includes('corporate')) return 'corporate';
  if (hay.includes('loyalty')) return 'loyalty';
  if (hay.includes('bundle')) return 'bundle';
  return 'flat';
}

export function couponTypeLabel(types: CouponTypeRecord[], slug: string | null | undefined) {
  const found = types.find((t) => t.slug === slug);
  return found?.label || slug || '—';
}

export function channelsForForm(value: unknown): Array<Exclude<CouponPlatformChannel, 'MOBILE' | 'ALL'>> {
  const raw = Array.isArray(value) ? value.map(String) : [];
  const upper = raw.map((v) => v.toUpperCase());
  if (upper.includes('ALL')) return [];
  const out = new Set<Exclude<CouponPlatformChannel, 'MOBILE' | 'ALL'>>();
  for (const ch of upper) {
    if (ch === 'MOBILE') {
      out.add('ANDROID');
      out.add('IOS');
    } else if (['WEB', 'ANDROID', 'IOS', 'MEMBERSHIP', 'TELECALLER'].includes(ch)) {
      out.add(ch as Exclude<CouponPlatformChannel, 'MOBILE' | 'ALL'>);
    }
  }
  return Array.from(out);
}
