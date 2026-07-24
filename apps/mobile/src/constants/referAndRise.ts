import { Ionicons } from '@expo/vector-icons';
import {
  type FamilyKey,
  type Milestone,
  type RewardFamily,
  FAMILIES as BASE_FAMILIES,
  FAMILY_ORDER,
  MILESTONES,
  MILESTONE_COUNTS,
  MAX_REFERRALS,
  DEFAULT_RISE_CONTENT,
  migrateRemoteMilestones,
  migrateRemoteCategories,
  getCurrentMilestoneIndex,
  getNextMilestone,
  getMilestoneByCount,
  normalizeFamilyKey,
} from '../../../../shared/constants/referAndRise';

export type { FamilyKey, Milestone, RewardFamily };
export {
  FAMILY_ORDER,
  MILESTONES,
  MILESTONE_COUNTS,
  MAX_REFERRALS,
  DEFAULT_RISE_CONTENT,
  getCurrentMilestoneIndex,
  getNextMilestone,
  getMilestoneByCount,
  normalizeFamilyKey,
};

const ICON_MAP: Record<FamilyKey, keyof typeof Ionicons.glyphMap> = {
  myfngSave: 'wallet-outline',
  myfngCare: 'shield-checkmark-outline',
  myfngElite: 'diamond-outline',
  myfngExpress: 'flash-outline',
};

export type RewardFamilyWithIcon = RewardFamily & { icon: keyof typeof Ionicons.glyphMap };

export const FAMILIES: Record<FamilyKey, RewardFamilyWithIcon> = {
  myfngSave: { ...BASE_FAMILIES.myfngSave, icon: ICON_MAP.myfngSave },
  myfngCare: { ...BASE_FAMILIES.myfngCare, icon: ICON_MAP.myfngCare },
  myfngElite: { ...BASE_FAMILIES.myfngElite, icon: ICON_MAP.myfngElite },
  myfngExpress: { ...BASE_FAMILIES.myfngExpress, icon: ICON_MAP.myfngExpress },
};

export function getUnlockedMilestone(referrals: number, milestones: Milestone[] = MILESTONES): Milestone | null {
  const ms = milestones.find((m) => m.referralCount === referrals);
  return ms || null;
}

export function applyRemoteConfig(remote: {
  milestones?: { referralCount: number; rewards: Record<string, string> }[];
  categories?: Record<string, { key: string; name: string; tag: string; color: string }>;
}): { milestones: Milestone[]; families: Record<FamilyKey, RewardFamilyWithIcon> } {
  const milestones = remote.milestones?.length
    ? migrateRemoteMilestones(remote.milestones)
    : MILESTONES;

  const migrated = migrateRemoteCategories(remote.categories);
  const families = {} as Record<FamilyKey, RewardFamilyWithIcon>;
  for (const key of FAMILY_ORDER) {
    families[key] = { ...migrated[key], icon: ICON_MAP[key] };
  }

  return { milestones, families };
}
