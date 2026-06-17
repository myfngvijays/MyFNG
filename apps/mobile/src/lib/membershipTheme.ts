export type MembershipTierCode =
  | 'PRIME'
  | 'PRIME_PLUS'
  | 'PRIME_ELITE'
  | 'GOLD'
  | 'SILVER'
  | 'BRONZE';

export type MembershipDisplay = {
  code: MembershipTierCode | 'NONE';
  label: string;
  headerBg: string;
  headerAccent: string;
  topBar: string;
  stripBg: string;
  stripText: string;
  stripMuted: string;
  crownColor: string;
  showCrown: boolean;
  cta?: string;
};

export const NON_MEMBER_PROFILE: MembershipDisplay = {
  code: 'NONE',
  label: 'MyFNG Member',
  headerBg: '#0046AD',
  headerAccent: '#0084FF',
  topBar: '#F97316',
  stripBg: '#003580',
  stripText: '#FFFFFF',
  stripMuted: 'rgba(255,255,255,0.78)',
  crownColor: '#FCD34D',
  showCrown: false,
  cta: 'Get Prime →',
};

const TIER_THEMES: Record<MembershipTierCode, MembershipDisplay> = {
  PRIME: {
    code: 'PRIME',
    label: 'MyFNG Prime Member',
    headerBg: '#0F2B5B',
    headerAccent: '#FFD166',
    topBar: '#FFD166',
    stripBg: '#FFD166',
    stripText: '#0F2B5B',
    stripMuted: '#374151',
    crownColor: '#0F2B5B',
    showCrown: true,
  },
  PRIME_PLUS: {
    code: 'PRIME_PLUS',
    label: 'MyFNG Prime Plus Member',
    headerBg: '#78350F',
    headerAccent: '#FBBF24',
    topBar: '#FDE68A',
    stripBg: '#FBBF24',
    stripText: '#451A03',
    stripMuted: '#57534E',
    crownColor: '#451A03',
    showCrown: true,
  },
  PRIME_ELITE: {
    code: 'PRIME_ELITE',
    label: 'MyFNG Elite Member',
    headerBg: '#4C1D95',
    headerAccent: '#C4B5FD',
    topBar: '#DDD6FE',
    stripBg: '#A855F7',
    stripText: '#FFFFFF',
    stripMuted: 'rgba(255,255,255,0.82)',
    crownColor: '#FFFFFF',
    showCrown: true,
  },
  GOLD: {
    code: 'GOLD',
    label: 'MyFNG Max Member',
    headerBg: '#9A3412',
    headerAccent: '#FDBA74',
    topBar: '#FDBA74',
    stripBg: '#F97316',
    stripText: '#FFFFFF',
    stripMuted: 'rgba(255,255,255,0.85)',
    crownColor: '#FFFFFF',
    showCrown: true,
  },
  SILVER: {
    code: 'SILVER',
    label: 'MyFNG Pro Member',
    headerBg: '#5B21B6',
    headerAccent: '#C4B5FD',
    topBar: '#DDD6FE',
    stripBg: '#8B5CF6',
    stripText: '#FFFFFF',
    stripMuted: 'rgba(255,255,255,0.85)',
    crownColor: '#FFFFFF',
    showCrown: false,
  },
  BRONZE: {
    code: 'BRONZE',
    label: 'MyFNG Go Member',
    headerBg: '#1D4ED8',
    headerAccent: '#93C5FD',
    topBar: '#93C5FD',
    stripBg: '#2563EB',
    stripText: '#FFFFFF',
    stripMuted: 'rgba(255,255,255,0.85)',
    crownColor: '#FFFFFF',
    showCrown: false,
  },
};

export function isMembershipActive(membership: any | null | undefined): boolean {
  if (!membership) return false;
  if (String(membership.status || '').toUpperCase() !== 'ACTIVE') return false;
  const endsAt = membership.ends_at ? new Date(membership.ends_at).getTime() : 0;
  return !endsAt || endsAt > Date.now();
}

export function getMembershipTierCode(membership: any | null | undefined): MembershipTierCode | null {
  if (!isMembershipActive(membership)) return null;
  const code = String(membership?.plan?.code || '').toUpperCase();
  if (code in TIER_THEMES) return code as MembershipTierCode;
  return null;
}

export function getMembershipDisplay(membership: any | null | undefined): MembershipDisplay | null {
  const code = getMembershipTierCode(membership);
  if (!code) return null;
  return TIER_THEMES[code];
}

export function getProfileCardTheme(membership: any | null | undefined): MembershipDisplay {
  return getMembershipDisplay(membership) || NON_MEMBER_PROFILE;
}

export function formatMembershipExpiry(membership: any | null | undefined): string {
  if (!membership?.ends_at) return '';
  const d = new Date(membership.ends_at);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
