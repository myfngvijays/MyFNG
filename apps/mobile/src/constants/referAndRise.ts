import { Ionicons } from '@expo/vector-icons';

export type FamilyKey = 'saveMoney' | 'premiumExp' | 'qualityTrust' | 'speedConvenience';

export type RewardFamily = {
  key: FamilyKey;
  name: string;
  tag: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

export type Milestone = {
  referralCount: number;
  rewards: Record<FamilyKey, string>;
};

export const FAMILIES: Record<FamilyKey, RewardFamily> = {
  saveMoney: { key: 'saveMoney', name: 'Save Money', tag: 'SAVE MONEY', icon: 'wallet-outline', color: '#F5B942' },
  premiumExp: { key: 'premiumExp', name: 'Premium Exp.', tag: 'PREMIUM EXPERIENCE', icon: 'diamond-outline', color: '#F97316' },
  qualityTrust: { key: 'qualityTrust', name: 'Quality & Trust', tag: 'QUALITY & TRUST', icon: 'shield-checkmark-outline', color: '#EF4444' },
  speedConvenience: { key: 'speedConvenience', name: 'Speed & Conv.', tag: 'SPEED & CONVENIENCE', icon: 'flash-outline', color: '#22D3EE' },
};

export const FAMILY_ORDER: FamilyKey[] = ['saveMoney', 'premiumExp', 'qualityTrust', 'speedConvenience'];

export const MILESTONES: Milestone[] = [
  {
    referralCount: 1,
    rewards: {
      saveMoney: '₹200 Wallet Credit',
      premiumExp: 'Priority Booking (30 Days)',
      qualityTrust: 'Car Health Scan',
      speedConvenience: 'Express Pickup Slot',
    },
  },
  {
    referralCount: 2,
    rewards: {
      saveMoney: 'Free Interior Cleaning',
      premiumExp: 'Dedicated Service Advisor (1 Booking)',
      qualityTrust: 'General Check-up',
      speedConvenience: 'Priority Queue Access',
    },
  },
  {
    referralCount: 3,
    rewards: {
      saveMoney: 'Wheel Alignment',
      premiumExp: 'MYFNG Priority Support',
      qualityTrust: 'Fluid Top-up Package',
      speedConvenience: 'Express Pickup & Delivery',
    },
  },
  {
    referralCount: 5,
    rewards: {
      saveMoney: '₹500 Wallet Credit',
      premiumExp: 'MYFNG Prime (1 Month)',
      qualityTrust: 'AC Inspection',
      speedConvenience: 'Same-Day Service Priority',
    },
  },
  {
    referralCount: 7,
    rewards: {
      saveMoney: 'Free Car Wash + Vacuum',
      premiumExp: 'Premium Booking Window',
      qualityTrust: 'Brake & Battery Health Check',
      speedConvenience: 'Emergency Pickup (1 Use)',
    },
  },
  {
    referralCount: 10,
    rewards: {
      saveMoney: '₹1,000 Wallet Credit',
      premiumExp: 'MYFNG Prime (3 Months)',
      qualityTrust: 'Basic Service',
      speedConvenience: 'Free Roadside Assistance (3 Months)',
    },
  },
  {
    referralCount: 15,
    rewards: {
      saveMoney: 'Service Upgrade Voucher',
      premiumExp: 'VIP Concierge Support',
      qualityTrust: 'General Service',
      speedConvenience: 'Guaranteed Express Service',
    },
  },
  {
    referralCount: 20,
    rewards: {
      saveMoney: '₹2,000 Wallet Credit',
      premiumExp: 'MYFNG Prime (12 Months)',
      qualityTrust: 'Premium Service Upgrade',
      speedConvenience: 'Free Roadside Assistance (12 Months)',
    },
  },
];

export const MILESTONE_COUNTS = MILESTONES.map((m) => m.referralCount);
export const TOTAL_MILESTONES = MILESTONES.length;
export const MAX_REFERRALS = MILESTONES[MILESTONES.length - 1].referralCount;

export function getCurrentMilestoneIndex(referrals: number): number {
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    if (referrals >= MILESTONES[i].referralCount) return i;
  }
  return -1;
}

export function getNextMilestone(referrals: number): Milestone | null {
  const next = MILESTONES.find((m) => m.referralCount > referrals);
  return next || null;
}

export function getUnlockedMilestone(referrals: number): Milestone | null {
  const ms = MILESTONES.find((m) => m.referralCount === referrals);
  return ms || null;
}

export function getMilestoneByCount(count: number): Milestone | undefined {
  return MILESTONES.find((m) => m.referralCount === count);
}

/**
 * Apply remote config over local defaults. Returns merged milestones and families.
 */
export function applyRemoteConfig(remote: {
  milestones?: { referralCount: number; rewards: Record<string, string> }[];
  categories?: Record<string, { key: string; name: string; tag: string; color: string }>;
}): { milestones: Milestone[]; families: Record<FamilyKey, RewardFamily> } {
  let milestones = MILESTONES;
  let families = { ...FAMILIES };

  if (remote.milestones && remote.milestones.length > 0) {
    milestones = remote.milestones.map((m) => ({
      referralCount: m.referralCount,
      rewards: m.rewards as Record<FamilyKey, string>,
    }));
  }

  if (remote.categories) {
    const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
      saveMoney: 'wallet-outline',
      premiumExp: 'diamond-outline',
      qualityTrust: 'shield-checkmark-outline',
      speedConvenience: 'flash-outline',
    };
    for (const [key, cat] of Object.entries(remote.categories)) {
      if (families[key as FamilyKey]) {
        families[key as FamilyKey] = {
          ...families[key as FamilyKey],
          name: cat.name || families[key as FamilyKey].name,
          tag: cat.tag || families[key as FamilyKey].tag,
          color: cat.color || families[key as FamilyKey].color,
        };
      }
    }
  }

  return { milestones, families };
}

