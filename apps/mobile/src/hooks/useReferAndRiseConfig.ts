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
        const res = await fetch(`${ENV.API_URL}/api/public/referral-config`);
        const json = await res.json();
        if (cancelled) return;
        const riseConfig = json.refer_and_rise_config;
        if (riseConfig) {
          const merged = applyRemoteConfig(riseConfig);
          const remoteContent = riseConfig.content;
          const content: ContentConfig = {
            heroTitle: remoteContent?.heroTitle || data.content.heroTitle,
            heroSubtitle: remoteContent?.heroSubtitle || data.content.heroSubtitle,
            shareMessage: remoteContent?.shareMessage || data.content.shareMessage,
            bannerTitle: remoteContent?.bannerTitle || data.content.bannerTitle,
            bannerSubtitle: remoteContent?.bannerSubtitle || data.content.bannerSubtitle,
            tnc: remoteContent?.tnc || json.tnc || data.content.tnc,
          };
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
