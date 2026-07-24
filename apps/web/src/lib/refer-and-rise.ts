export {
  type FamilyKey,
  type RewardType,
  type RewardFamily,
  type Milestone,
  LEGACY_FAMILY_MAP,
  normalizeFamilyKey,
  FAMILIES,
  FAMILY_ORDER,
  MILESTONES,
  MILESTONE_COUNTS,
  MAX_REFERRALS,
  DEFAULT_RISE_CONTENT,
  getMilestoneRewardText,
  inferRewardType,
  rewardBlocksWallet,
  parseVoucherAmount,
  migrateMilestoneRewards,
  migrateRemoteMilestones,
  migrateRemoteCategories,
  isLegacyReferAndRiseConfig,
  getCurrentMilestoneIndex,
  getNextMilestone,
  getMilestoneByCount,
  type ReferPushNotificationTemplate,
  type ReferPushTrigger,
  DEFAULT_PUSH_NOTIFICATIONS,
  REFER_PUSH_TRIGGER_LABELS,
  migratePushNotifications,
  getReferPushTemplate,
  previewReferPushBody,
} from '@/shared/constants/referAndRise';

import {
  DEFAULT_RISE_CONTENT,
  FAMILIES,
  MILESTONES,
  migrateRemoteCategories,
  migrateRemoteMilestones,
  isLegacyReferAndRiseConfig,
  migratePushNotifications,
  normalizeFamilyKey,
  inferRewardType,
  rewardBlocksWallet,
  parseVoucherAmount,
  type FamilyKey,
  type Milestone,
  type RewardFamily,
} from '@/shared/constants/referAndRise';

export type ReferAndRiseConfig = {
  milestones: Milestone[];
  categories: Record<FamilyKey, RewardFamily>;
  friendBonus?: number;
  expiryDays?: number;
  rewardExpiryDays?: number;
  content: typeof DEFAULT_RISE_CONTENT;
};

export const DEFAULT_REFER_AND_RISE_CONFIG: ReferAndRiseConfig = {
  milestones: MILESTONES,
  categories: FAMILIES,
  content: DEFAULT_RISE_CONTENT,
  rewardExpiryDays: 365,
};

export function normalizeReferAndRiseConfig(raw: unknown): ReferAndRiseConfig {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;

  if (!obj || isLegacyReferAndRiseConfig(obj)) {
    return {
      ...DEFAULT_REFER_AND_RISE_CONFIG,
      friendBonus: Number(obj?.friendBonus) || undefined,
      expiryDays: Number(obj?.expiryDays) || undefined,
    };
  }

  return {
    milestones: migrateRemoteMilestones(obj.milestones as any),
    categories: migrateRemoteCategories(obj.categories as any),
    friendBonus: Number(obj.friendBonus) || undefined,
    expiryDays: Number(obj.expiryDays) || undefined,
    rewardExpiryDays: Number(obj.rewardExpiryDays) || 365,
    content: {
      ...DEFAULT_RISE_CONTENT,
      ...(obj.content as typeof DEFAULT_RISE_CONTENT),
      tnc: Array.isArray((obj.content as any)?.tnc) ? (obj.content as any).tnc : DEFAULT_RISE_CONTENT.tnc,
      pushNotifications: migratePushNotifications(obj.content),
    },
  };
}

export function resolveCareRewardText(
  referralCount: number,
  baseText: string,
  priorCareClaims: number[],
): string {
  if (referralCount === 15 && !priorCareClaims.includes(10)) {
    return 'Free General Service (upgraded — Basic at 10 referrals was not redeemed)';
  }
  if (referralCount === 20 && !priorCareClaims.includes(15)) {
    return 'Free Premium Service (upgraded — General at 15 referrals was not redeemed)';
  }
  return baseText;
}

export function buildRewardMeta(familyRaw: string, rewardText: string) {
  const family = normalizeFamilyKey(familyRaw);
  const reward_type = family ? inferRewardType(family, rewardText) : 'service';
  const blocks_wallet = family ? rewardBlocksWallet(family, rewardText) : false;
  const voucher_amount = reward_type === 'voucher' ? parseVoucherAmount(rewardText) : null;
  return { family, reward_type, blocks_wallet, voucher_amount };
}
