/**
 * Refer & Rise — shared reward matrix (MYFNG Save / Care / Elite / Express).
 * Used by mobile app, web admin, and customer APIs.
 */

export type FamilyKey = 'myfngSave' | 'myfngCare' | 'myfngElite' | 'myfngExpress';

export type RewardType = 'voucher' | 'discount' | 'service' | 'membership' | 'benefit';

export type RewardFamily = {
  key: FamilyKey;
  name: string;
  tag: string;
  color: string;
};

export type Milestone = {
  referralCount: number;
  rewards: Record<FamilyKey, string>;
};

/** Legacy keys from older app versions — map to new track names. */
export const LEGACY_FAMILY_MAP: Record<string, FamilyKey> = {
  saveMoney: 'myfngSave',
  premiumExp: 'myfngElite',
  qualityTrust: 'myfngCare',
  speedConvenience: 'myfngExpress',
  myfngSave: 'myfngSave',
  myfngCare: 'myfngCare',
  myfngElite: 'myfngElite',
  myfngExpress: 'myfngExpress',
};

export function normalizeFamilyKey(raw: string | null | undefined): FamilyKey | null {
  if (!raw) return null;
  return LEGACY_FAMILY_MAP[raw] || null;
}

export const FAMILIES: Record<FamilyKey, RewardFamily> = {
  myfngSave: { key: 'myfngSave', name: 'MYFNG Save', tag: 'SAVE', color: '#F5B942' },
  myfngCare: { key: 'myfngCare', name: 'MYFNG Care', tag: 'CARE', color: '#EF4444' },
  myfngElite: { key: 'myfngElite', name: 'MYFNG Elite', tag: 'ELITE', color: '#F97316' },
  myfngExpress: { key: 'myfngExpress', name: 'MYFNG Express', tag: 'EXPRESS', color: '#22D3EE' },
};

export const FAMILY_ORDER: FamilyKey[] = ['myfngSave', 'myfngCare', 'myfngElite', 'myfngExpress'];

export const MILESTONES: Milestone[] = [
  {
    referralCount: 1,
    rewards: {
      myfngSave: '₹500 Service Voucher',
      myfngCare: 'Free Car Scanning',
      myfngElite: 'MYFNG Prime Membership (12 Months)',
      myfngExpress: 'Priority Booking Slot + Instant Pickup Voucher',
    },
  },
  {
    referralCount: 2,
    rewards: {
      myfngSave: '10% Labour Discount',
      myfngCare: 'Free Top-up of Consumables',
      myfngElite: 'Complimentary Doorstep Inspection',
      myfngExpress: 'Same-Day Service Guaranteed',
    },
  },
  {
    referralCount: 3,
    rewards: {
      myfngSave: '1 Panel FREE Voucher on 2-Panel Painting',
      myfngCare: 'Free Wheel Alignment & Balancing',
      myfngElite: 'AC Gas Top-up',
      myfngExpress: 'Express Claim Process',
    },
  },
  {
    referralCount: 5,
    rewards: {
      myfngSave: '₹1,500 Service Voucher',
      myfngCare: 'Free 50-Point Car Health Scan',
      myfngElite: 'Free Wax Polish',
      myfngExpress: 'Free Pickup & Drop (3) + Free Brake Service',
    },
  },
  {
    referralCount: 7,
    rewards: {
      myfngSave: 'Free AC Disinfection',
      myfngCare: 'Monsoon / Summer / Long Trip Preventive Check',
      myfngElite: 'Dedicated Sr. Service Advisor + Priority Booking Slot',
      myfngExpress: 'Weekend Priority Slot',
    },
  },
  {
    referralCount: 10,
    rewards: {
      myfngSave: '₹2,000 Service Voucher',
      myfngCare: 'Free Basic Service',
      myfngElite: 'Free Interior Cleaning',
      myfngExpress: 'Free RSA (Roadside Assistance) — 12 Months',
    },
  },
  {
    referralCount: 12,
    rewards: {
      myfngSave: 'Free Basic AC Service',
      myfngCare: 'Headlight Restoration + Free Battery Health Test',
      myfngElite: 'Warranty Extension + VIP Customer Helpline',
      myfngExpress: '3 Express Bookings',
    },
  },
  {
    referralCount: 15,
    rewards: {
      myfngSave: '₹3,000 Service Voucher',
      myfngCare: 'Free General Service (upgrades from Basic if not redeemed)',
      myfngElite: 'Interior + Exterior Cleaning',
      myfngExpress: 'Free Any 1 Panel Painting + 48hr Guaranteed Delivery',
    },
  },
  {
    referralCount: 20,
    rewards: {
      myfngSave: '₹5,000 Service Voucher',
      myfngCare: 'Free Premium Service (upgrades from General if not redeemed)',
      myfngElite: 'MYFNG Elite Black Membership — Lifetime Prime, VIP Helpline, Premium Workshop Access',
      myfngExpress: 'MYFNG Express Black Membership — Unlimited Pickup & Drop, Lifetime Priority Booking, RSA 12 Months',
    },
  },
];

export const MILESTONE_COUNTS = MILESTONES.map((m) => m.referralCount);
export const MAX_REFERRALS = MILESTONES[MILESTONES.length - 1].referralCount;

export const EXPECTED_MILESTONE_COUNTS = [1, 2, 3, 5, 7, 10, 12, 15, 20];

const LEGACY_CATEGORY_KEYS = new Set(['saveMoney', 'premiumExp', 'qualityTrust', 'speedConvenience']);

/** True when DB still has pre–MYFNG Save/Care/Elite/Express config. */
export function isLegacyReferAndRiseConfig(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return true;
  const obj = raw as Record<string, unknown>;
  const categories = obj.categories as Record<string, unknown> | undefined;
  const milestones = obj.milestones as { referralCount: number; rewards?: Record<string, string> }[] | undefined;

  if (categories) {
    for (const key of Object.keys(categories)) {
      if (LEGACY_CATEGORY_KEYS.has(key)) return true;
    }
    const names = Object.values(categories).map((c) => String((c as { name?: string })?.name || ''));
    if (names.length > 0 && !names.some((n) => n.includes('MYFNG'))) return true;
  }

  const counts = (milestones || []).map((m) => m.referralCount).sort((a, b) => a - b);
  if (counts.join(',') !== EXPECTED_MILESTONE_COUNTS.join(',')) return true;

  const first = (milestones || []).find((m) => m.referralCount === 1);
  const saveReward =
    first?.rewards?.myfngSave ||
    first?.rewards?.saveMoney ||
    '';
  if (/₹200 Wallet Credit|Wallet Credit/i.test(String(saveReward))) return true;

  return false;
}

export const DEFAULT_RISE_CONTENT = {
  heroTitle: 'Refer & Rise',
  heroSubtitle: 'Invite friends, unlock milestones, and choose your rewards',
  shareMessage:
    '🚗 Great cars deserve great care!\n\nJoin MyFNG and keep your car performing at its best.\n\nUse my referral code *{{CODE}}* to get wallet bonus on signup.\n\n👉 {{LINK}}',
  bannerTitle: 'Refer & Rise',
  bannerSubtitle: 'Invite friends & earn rewards',
  tnc: [
    'Each successful referral unlocks a milestone reward.',
    'You choose ONE reward from 4 tracks (MYFNG Save, Care, Elite, Express) at each milestone.',
    'Your referral reward unlocks when your friend completes their first paid service.',
    'MYFNG Save service vouchers cannot be combined with wallet balance on the same booking.',
    'If you use wallet balance on a booking, referral service vouchers cannot be applied on that booking.',
    'MYFNG Care: General Service at 15 referrals and Premium Service at 20 referrals upgrade automatically if earlier Care rewards were not redeemed.',
    'Rewards cannot be converted to cash. Self-referral and fraudulent referrals will be rejected.',
  ],
};

export function getMilestoneRewardText(milestone: Milestone, family: FamilyKey): string {
  return milestone.rewards[family] || '';
}

export function inferRewardType(family: FamilyKey, rewardText: string): RewardType {
  const text = String(rewardText || '');
  if (family === 'myfngSave') {
    if (/voucher/i.test(text)) return 'voucher';
    if (/discount/i.test(text)) return 'discount';
  }
  if (/membership/i.test(text)) return 'membership';
  if (/wallet\s*credit/i.test(text)) return 'voucher';
  return 'service';
}

/** Service vouchers / discounts from MYFNG Save block wallet on same booking. */
export function rewardBlocksWallet(family: FamilyKey, rewardText: string): boolean {
  if (family !== 'myfngSave') return false;
  const type = inferRewardType(family, rewardText);
  return type === 'voucher' || type === 'discount';
}

export function parseVoucherAmount(rewardText: string): number | null {
  const match = String(rewardText || '').match(/₹([\d,]+)/);
  if (!match) return null;
  return Number(match[1].replace(/,/g, ''));
}

export function migrateMilestoneRewards(rewards: Record<string, string>): Record<FamilyKey, string> {
  const out = {} as Record<FamilyKey, string>;
  for (const [key, text] of Object.entries(rewards || {})) {
    const normalized = normalizeFamilyKey(key);
    if (normalized && text) out[normalized] = text;
  }
  return out;
}

export function migrateRemoteMilestones(
  raw: { referralCount: number; rewards: Record<string, string> }[] | undefined,
): Milestone[] {
  if (!raw?.length) return MILESTONES;
  return raw.map((m) => ({
    referralCount: m.referralCount,
    rewards: { ...MILESTONES.find((x) => x.referralCount === m.referralCount)?.rewards, ...migrateMilestoneRewards(m.rewards) },
  }));
}

export function migrateRemoteCategories(
  raw: Record<string, { key: string; name: string; tag: string; color: string }> | undefined,
): Record<FamilyKey, RewardFamily> {
  const base = { ...FAMILIES };
  if (!raw) return base;
  for (const [key, cat] of Object.entries(raw)) {
    const normalized = normalizeFamilyKey(key) || normalizeFamilyKey(cat.key);
    if (normalized && cat) {
      base[normalized] = {
        ...base[normalized],
        name: cat.name || base[normalized].name,
        tag: cat.tag || base[normalized].tag,
        color: cat.color || base[normalized].color,
      };
    }
  }
  return base;
}

export function getCurrentMilestoneIndex(referrals: number, milestones: Milestone[] = MILESTONES): number {
  for (let i = milestones.length - 1; i >= 0; i--) {
    if (referrals >= milestones[i].referralCount) return i;
  }
  return -1;
}

export function getNextMilestone(referrals: number, milestones: Milestone[] = MILESTONES): Milestone | null {
  return milestones.find((m) => m.referralCount > referrals) || null;
}

export function getMilestoneByCount(count: number, milestones: Milestone[] = MILESTONES): Milestone | undefined {
  return milestones.find((m) => m.referralCount === count);
}
