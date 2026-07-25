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
      myfngSave: 'Car AC Performance Package',
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

export type ReferPushTrigger = 'milestone_unlocked';

export type ReferPushNotificationTemplate = {
  id: string;
  label: string;
  trigger: ReferPushTrigger;
  title: string;
  body: string;
  enabled: boolean;
};

export const DEFAULT_PUSH_NOTIFICATIONS: ReferPushNotificationTemplate[] = [
  {
    id: 'milestone_unlocked',
    label: 'Referral Milestone Unlocked',
    trigger: 'milestone_unlocked',
    title: 'MyFNG Referral Unlocked',
    body: '{{WALLET_PART}}Milestone #{{MILESTONE}} unlocked — claim your Refer & Rise reward now.',
    enabled: true,
  },
];

export const REFER_PUSH_TRIGGER_LABELS: Record<ReferPushTrigger, string> = {
  milestone_unlocked: 'Friend booking complete → milestone unlocks',
};

export function migratePushNotifications(content: unknown): ReferPushNotificationTemplate[] {
  const obj = content && typeof content === 'object' ? (content as Record<string, unknown>) : null;

  if (Array.isArray(obj?.pushNotifications) && obj.pushNotifications.length > 0) {
    return obj.pushNotifications.map((item: any, idx: number) => ({
      id: String(item?.id || `push_${idx + 1}`).trim() || `push_${idx + 1}`,
      label: String(item?.label || 'Push Notification').trim() || 'Push Notification',
      trigger: item?.trigger === 'milestone_unlocked' ? 'milestone_unlocked' : 'milestone_unlocked',
      title: String(item?.title || DEFAULT_PUSH_NOTIFICATIONS[0].title).trim() || DEFAULT_PUSH_NOTIFICATIONS[0].title,
      body: String(item?.body || DEFAULT_PUSH_NOTIFICATIONS[0].body).trim() || DEFAULT_PUSH_NOTIFICATIONS[0].body,
      enabled: item?.enabled !== false,
    }));
  }

  const legacyTitle = String((obj as any)?.pushMilestoneTitle || '').trim();
  const legacyBody = String((obj as any)?.pushMilestoneBody || '').trim();
  if (legacyTitle || legacyBody) {
    return [{
      ...DEFAULT_PUSH_NOTIFICATIONS[0],
      title: legacyTitle || DEFAULT_PUSH_NOTIFICATIONS[0].title,
      body: legacyBody || DEFAULT_PUSH_NOTIFICATIONS[0].body,
    }];
  }

  return DEFAULT_PUSH_NOTIFICATIONS.map((item) => ({ ...item }));
}

export function getReferPushTemplate(
  content: { pushNotifications?: ReferPushNotificationTemplate[] } | null | undefined,
  trigger: ReferPushTrigger,
): ReferPushNotificationTemplate {
  const list = migratePushNotifications(content);
  const match = list.find((item) => item.enabled && item.trigger === trigger);
  if (match) return match;
  const fallback = list.find((item) => item.id === 'milestone_unlocked') || DEFAULT_PUSH_NOTIFICATIONS[0];
  return fallback;
}

export function previewReferPushBody(body: string): string {
  return String(body || '')
    .replace(/\{\{WALLET_PART\}\}/g, '₹500 wallet bonus credited. ')
    .replace(/\{\{WALLET_AMOUNT\}\}/g, '₹500')
    .replace(/\{\{MILESTONE\}\}/g, '1');
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
    'When any referral reward voucher is applied on a booking, wallet balance cannot be used on that booking.',
    'MYFNG Care: General Service at 15 referrals and Premium Service at 20 referrals upgrade automatically if earlier Care rewards were not redeemed.',
    'Rewards cannot be converted to cash. Self-referral and fraudulent referrals will be rejected.',
  ],
  pushNotifications: DEFAULT_PUSH_NOTIFICATIONS,
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

/** Old admin/DB reward labels → current product names. */
export const REWARD_TEXT_RENAMES: Record<string, string> = {
  'Free Basic AC Service': 'Car AC Performance Package',
  'Car AC Performance Package (Free)': 'Car AC Performance Package',
};

export function applyRewardTextRenames(rewards: Record<FamilyKey, string>): Record<FamilyKey, string> {
  const out = { ...rewards };
  for (const key of FAMILY_ORDER) {
    const text = out[key];
    if (text && REWARD_TEXT_RENAMES[text]) {
      out[key] = REWARD_TEXT_RENAMES[text];
    }
  }
  return out;
}

export function configHasStaleRewardText(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const milestones = (raw as { milestones?: { rewards?: Record<string, string> }[] }).milestones;
  if (!Array.isArray(milestones)) return false;
  for (const m of milestones) {
    for (const text of Object.values(m.rewards || {})) {
      if (REWARD_TEXT_RENAMES[String(text)]) return true;
    }
  }
  return false;
}

export function migrateRemoteMilestones(
  raw: { referralCount: number; rewards: Record<string, string> }[] | undefined,
): Milestone[] {
  if (!raw?.length) return MILESTONES;
  return raw.map((m) => ({
    referralCount: m.referralCount,
    rewards: applyRewardTextRenames({
      ...MILESTONES.find((x) => x.referralCount === m.referralCount)?.rewards,
      ...migrateMilestoneRewards(m.rewards),
    }),
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

/** Phones allowed to simulate referral invites instantly (QA / demo). */
export const REFERRAL_TEST_REFERRER_PHONES = ['8652710389'];

export function normalizePhoneLast10(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

export function isReferralTestReferrerPhone(phone: string): boolean {
  const last10 = normalizePhoneLast10(phone);
  return REFERRAL_TEST_REFERRER_PHONES.includes(last10);
}

export function isLabourPercentReferralReward(rewardText?: string | null): boolean {
  return /10%.*labour/i.test(String(rewardText || ''));
}

export type RewardComponent = {
  key: string;
  label: string;
  uses_total: number;
  uses_remaining: number;
};

function slugifyRewardKey(label: string, index: number): string {
  const slug = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return slug ? `${slug}_${index}` : `benefit_${index}`;
}

/** Parse composite / multi-use rewards, e.g. "Free Pickup & Drop (3) + Free Brake Service". */
export function parseRewardComponents(rewardText: string): RewardComponent[] {
  const text = String(rewardText || '').trim();
  if (!text) return [];

  if (/membership/i.test(text)) return [];

  const parts = text.split(/\s+\+\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) parts.push(text);

  return parts.map((part, index) => {
    let label = part;
    let uses = 1;

    const parenMatch = part.match(/\((\d+)\)\s*$/);
    if (parenMatch?.[1]) {
      uses = Math.max(1, Number(parenMatch[1]));
      label = part.replace(/\s*\(\d+\)\s*$/, '').trim();
    } else {
      const leadingCount = part.match(/^(\d+)\s+(.+)$/i);
      if (leadingCount?.[1] && leadingCount[2]) {
        uses = Math.max(1, Number(leadingCount[1]));
        label = leadingCount[2].trim();
      }
    }

    return {
      key: slugifyRewardKey(label, index),
      label: label || part,
      uses_total: uses,
      uses_remaining: uses,
    };
  });
}

export function parseStoredRewardComponents(raw: unknown): RewardComponent[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      return parseStoredRewardComponents(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      const label = String(item?.label || '').trim();
      if (!label) return null;
      const usesTotal = Math.max(1, Number(item?.uses_total ?? item?.usesTotal ?? 1));
      const usesRemaining = Math.max(0, Number(item?.uses_remaining ?? item?.usesRemaining ?? usesTotal));
      return {
        key: String(item?.key || slugifyRewardKey(label, index)),
        label,
        uses_total: usesTotal,
        uses_remaining: Math.min(usesRemaining, usesTotal),
      };
    })
    .filter(Boolean) as RewardComponent[];
}

export function rewardHasRemainingUses(
  components: RewardComponent[],
  usesRemaining: number | null | undefined,
  redeemedAt?: string | null,
  status?: string | null,
): boolean {
  if (components.length > 0) {
    return components.some((c) => c.uses_remaining > 0);
  }
  if (usesRemaining != null) return usesRemaining > 0;
  if (redeemedAt || status === 'DELIVERED') return false;
  return true;
}

export function totalRewardUses(components: RewardComponent[]): number {
  if (components.length === 0) return 1;
  return components.reduce((sum, c) => sum + Math.max(1, c.uses_total), 0);
}

export function remainingRewardUses(components: RewardComponent[], fallback?: number | null): number {
  if (components.length > 0) {
    return components.reduce((sum, c) => sum + Math.max(0, c.uses_remaining), 0);
  }
  return fallback != null ? Math.max(0, fallback) : 1;
}

export function formatRewardUsesLabel(components: RewardComponent[], fallbackRemaining?: number | null): string | null {
  if (components.length > 1) {
    return components
      .filter((c) => c.uses_remaining > 0)
      .map((c) => `${c.label} (${c.uses_remaining}/${c.uses_total})`)
      .join(' · ');
  }
  if (components.length === 1 && components[0].uses_total > 1) {
    const c = components[0];
    return `${c.uses_remaining} of ${c.uses_total} uses left`;
  }
  if (fallbackRemaining != null && fallbackRemaining > 1) {
    return `${fallbackRemaining} uses left`;
  }
  return null;
}

export function parseMembershipMonthsFromReward(rewardText: string): number | null {
  const match = String(rewardText || '').match(/(\d+)\s*Months?/i);
  if (match?.[1]) return Math.max(1, Number(match[1]));
  if (/lifetime|black membership/i.test(String(rewardText || ''))) return null;
  return null;
}

export function isReferralMembershipReward(rewardText: string): boolean {
  return /membership/i.test(String(rewardText || ''));
}
