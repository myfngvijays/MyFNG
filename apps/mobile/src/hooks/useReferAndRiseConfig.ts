import { useEffect, useState } from 'react';
import { applyRemoteConfig, MILESTONES, FAMILIES, Milestone, FamilyKey, RewardFamily } from '../constants/referAndRise';
import { ENV } from '../config/environment';

type ContentConfig = {
  heroTitle: string;
  heroSubtitle: string;
  shareMessage: string;
  bannerTitle: string;
  bannerSubtitle: string;
  tnc: string[];
};

const DEFAULT_TNC: string[] = [
  'Each successful referral unlocks a milestone reward.',
  'You choose ONE reward from 4 categories at each milestone.',
  'Your referral reward unlocks when your friend books their first service.',
  'Your friend gets ₹1,500 wallet balance instantly on signup.',
  'Wallet balance expires in 90 days.',
  'Maximum wallet usage: 10% of service booking amount.',
  'Rewards cannot be converted to cash.',
  'Self-referral and fraudulent referrals will be rejected.',
];

type RemoteConfig = {
  milestones: Milestone[];
  families: Record<FamilyKey, RewardFamily>;
  content: ContentConfig;
  loaded: boolean;
};

export function useReferAndRiseConfig(): RemoteConfig {
  const [data, setData] = useState<RemoteConfig>({
    milestones: MILESTONES,
    families: FAMILIES,
    content: { heroTitle: 'Refer & Rise', heroSubtitle: '', shareMessage: '', bannerTitle: '', bannerSubtitle: '', tnc: DEFAULT_TNC },
    loaded: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${ENV.API_URL}/api/customer/referral/config`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success && json.config) {
          const merged = applyRemoteConfig(json.config);
          const content: ContentConfig = json.config.content || data.content;
          setData({ ...merged, content, loaded: true });
        } else {
          setData((prev) => ({ ...prev, loaded: true }));
        }
      } catch {
        if (!cancelled) setData((prev) => ({ ...prev, loaded: true }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return data;
}
