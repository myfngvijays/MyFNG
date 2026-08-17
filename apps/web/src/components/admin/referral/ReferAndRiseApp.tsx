'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Gift,
  Save,
  RefreshCw,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  IndianRupee,
  Plus,
  Trash2,
  Trophy,
  Zap,
  Shield,
  Wallet,
  Diamond,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Pencil,
  Link2,
  Copy,
  ExternalLink,
  Smartphone,
} from 'lucide-react';
import {
  DEFAULT_REFER_AND_RISE_CONFIG,
  normalizeReferAndRiseConfig,
  type ReferAndRiseConfig,
} from '@/lib/refer-and-rise';
import { FAMILY_ORDER, type FamilyKey, type ReferPushNotificationTemplate, REFER_PUSH_TRIGGER_LABELS, previewReferPushBody } from '@/shared/constants/referAndRise';

type ReferralStats = {
  total_referrals: number;
  rewarded: number;
  pending: number;
  rejected: number;
  total_rewards_paid: number;
};

type ReferralEvent = {
  id: string;
  referral_code: string;
  status: string;
  created_at: string;
  referrer?: { full_name?: string; phone?: string };
  referee?: { full_name?: string; phone?: string };
};

type LeaderboardEntry = {
  customer_id: string;
  full_name: string;
  phone: string;
  total_referrals: number;
  rewarded: number;
  pending: number;
  total_earned: number;
  referral_code: string;
  referees: { event_id: string; full_name: string; phone: string; status: string; created_at: string }[];
};

type ContentConfig = ReferAndRiseConfig['content'];

type Milestone = ReferAndRiseConfig['milestones'][number];
type RewardCategory = ReferAndRiseConfig['categories'][FamilyKey];

const DEFAULT_CATEGORIES = DEFAULT_REFER_AND_RISE_CONFIG.categories;
const DEFAULT_MILESTONES = DEFAULT_REFER_AND_RISE_CONFIG.milestones;
const DEFAULT_CONTENT = DEFAULT_REFER_AND_RISE_CONFIG.content;

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  myfngSave: <Wallet className="h-4 w-4" />,
  myfngCare: <Shield className="h-4 w-4" />,
  myfngElite: <Diamond className="h-4 w-4" />,
  myfngExpress: <Zap className="h-4 w-4" />,
  saveMoney: <Wallet className="h-4 w-4" />,
  premiumExp: <Diamond className="h-4 w-4" />,
  qualityTrust: <Shield className="h-4 w-4" />,
  speedConvenience: <Zap className="h-4 w-4" />,
};

function StatCard({ label, value, icon, accent }: { label: string; value: string | number; icon: React.ReactNode; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>{icon}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: 'bg-amber-100', text: 'text-amber-700' },
    REWARDED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    REJECTED: { bg: 'bg-red-100', text: 'text-red-700' },
  };
  const s = map[status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${s.bg} ${s.text}`}>{status}</span>;
}

export default function ReferAndRiseApp({ mode = 'full' }: { mode?: 'full' | 'analytics-only' }) {
  const analyticsOnly = mode === 'analytics-only';
  const [config, setConfig] = useState<ReferAndRiseConfig | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [events, setEvents] = useState<ReferralEvent[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [expandedMilestone, setExpandedMilestone] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'milestones' | 'content' | 'users' | 'activity' | 'deeplinks'>(
    analyticsOnly ? 'users' : 'milestones',
  );
  const [backfilling, setBackfilling] = useState(false);
  const [rewardingId, setRewardingId] = useState<string | null>(null);
  const [deepLinks, setDeepLinks] = useState<{
    overall?: string;
    invite_url_pattern?: string;
    sample_invite_url?: string;
    store_redirect_note?: string;
    apple_app_id?: string;
    android_package?: string;
    aasa?: { url?: string; ready?: boolean; has_refer_path?: boolean; has_app_id?: boolean; status?: number | null };
    assetlinks?: {
      url?: string;
      ready?: boolean;
      fingerprint_count?: number;
      env_android_sha256_set?: boolean;
      status?: number | null;
    };
    admin_links?: { universal_link?: string; system_monitor?: string; sample_landing?: string };
    fetch_error?: string | null;
  } | null>(null);
  const [deepLinksLoading, setDeepLinksLoading] = useState(false);
  const [copiedDeepLink, setCopiedDeepLink] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const editable = !analyticsOnly && canEdit;

  const runBackfill = async () => {
    setBackfilling(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/referral/backfill', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setMessage(`Backfill done: ${json.processed} rewarded, ${json.still_pending} still pending`);
        void fetchData();
      } else {
        setError(json.error || 'Backfill failed');
      }
    } catch {
      setError('Backfill network error');
    } finally {
      setBackfilling(false);
    }
  };

  const handleManualReward = async (eventId: string) => {
    if (!window.confirm('Mark this referral as completed and credit wallet to referrer?')) return;
    setRewardingId(eventId);
    try {
      const res = await fetch('/api/super_admin/referral/manual-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setMessage(`Rewarded! ₹${json.amount} credited to referrer's wallet.`);
        void fetchData();
      } else {
        setError(json.error || 'Failed to reward');
      }
    } catch {
      setError('Network error');
    } finally {
      setRewardingId(null);
    }
  };

  const fetchDeepLinks = useCallback(async () => {
    setDeepLinksLoading(true);
    try {
      const res = await fetch('/api/super_admin/referral/deep-links');
      const json = await res.json();
      if (res.ok && json.success) {
        setDeepLinks(json);
      } else {
        setError(json.error || 'Failed to load deep link status');
      }
    } catch {
      setError('Deep links network error');
    } finally {
      setDeepLinksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'deeplinks' && !analyticsOnly) {
      void fetchDeepLinks();
    }
  }, [activeTab, analyticsOnly, fetchDeepLinks]);

  const copyDeepLinkText = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedDeepLink(key);
      setTimeout(() => setCopiedDeepLink(null), 1500);
    } catch {
      setError('Copy failed');
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/referral');
      const json = await res.json();
      if (json.success) {
        const riseConfig: ReferAndRiseConfig = json.refer_and_rise_config
          ? normalizeReferAndRiseConfig(json.refer_and_rise_config)
          : {
              ...DEFAULT_REFER_AND_RISE_CONFIG,
              friendBonus: json.config?.referral_friend_bonus || 500,
              expiryDays: json.config?.referral_expiry_days || 90,
            };
        riseConfig.friendBonus = json.config?.referral_friend_bonus ?? riseConfig.friendBonus ?? 500;
        riseConfig.expiryDays = json.config?.referral_expiry_days ?? riseConfig.expiryDays ?? 90;
        if (!riseConfig.content) riseConfig.content = DEFAULT_CONTENT;
        setConfig(riseConfig);
        setCanEdit(json.can_edit === true);
        setStats(json.stats);
        setEvents(json.recent_events || []);
        setLeaderboard(json.leaderboard || []);
      } else {
        setError(json.error || 'Failed to load');
      }
    } catch {
      setError('Failed to load referral data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => { setMessage(null); setError(null); }, 4000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  const handleSave = async () => {
    if (!config || !editable) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/super_admin/referral', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refer_and_rise_config: config,
          referral_friend_bonus: config.friendBonus,
          referral_expiry_days: config.expiryDays,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage('Refer & Rise config saved!');
        setDirty(false);
        if (json.refer_and_rise_config) {
          setConfig(normalizeReferAndRiseConfig(json.refer_and_rise_config));
        }
      } else {
        setError(json.error || 'Save failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const updateMilestoneReward = (milestoneIdx: number, catKey: string, value: string) => {
    if (!config) return;
    const updated = { ...config };
    updated.milestones = [...updated.milestones];
    updated.milestones[milestoneIdx] = {
      ...updated.milestones[milestoneIdx],
      rewards: { ...updated.milestones[milestoneIdx].rewards, [catKey]: value },
    };
    setConfig(updated);
    setDirty(true);
  };

  const updateMilestoneCount = (milestoneIdx: number, count: number) => {
    if (!config) return;
    const updated = { ...config };
    updated.milestones = [...updated.milestones];
    updated.milestones[milestoneIdx] = { ...updated.milestones[milestoneIdx], referralCount: count };
    setConfig(updated);
    setDirty(true);
  };

  const addMilestone = () => {
    if (!config) return;
    const lastCount = config.milestones.length > 0 ? config.milestones[config.milestones.length - 1].referralCount : 0;
    const newMilestone: Milestone = {
      referralCount: lastCount + 5,
      rewards: Object.fromEntries(FAMILY_ORDER.map((k) => [k, ''])) as Milestone['rewards'],
    };
    setConfig({ ...config, milestones: [...config.milestones, newMilestone] });
    setExpandedMilestone(config.milestones.length);
    setDirty(true);
  };

  const removeMilestone = (idx: number) => {
    if (!config) return;
    const updated = config.milestones.filter((_, i) => i !== idx);
    setConfig({ ...config, milestones: updated });
    setExpandedMilestone(null);
    setDirty(true);
  };

  const updateCategory = (catKey: string, field: keyof RewardCategory, value: string) => {
    if (!config) return;
    const updated = { ...config };
    updated.categories = { ...updated.categories };
    updated.categories[catKey] = { ...updated.categories[catKey], [field]: value };
    setConfig(updated);
    setDirty(true);
  };

  const updateGlobalSetting = (key: 'friendBonus' | 'expiryDays' | 'rewardExpiryDays', value: number) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
    setDirty(true);
  };

  const updateContent = (key: keyof ContentConfig, value: string | string[]) => {
    if (!config) return;
    setConfig({ ...config, content: { ...config.content, [key]: value } });
    setDirty(true);
  };

  const addTncItem = () => {
    if (!config) return;
    updateContent('tnc', [...config.content.tnc, '']);
  };

  const updateTncItem = (idx: number, value: string) => {
    if (!config) return;
    const updated = [...config.content.tnc];
    updated[idx] = value;
    updateContent('tnc', updated);
  };

  const removeTncItem = (idx: number) => {
    if (!config) return;
    updateContent('tnc', config.content.tnc.filter((_, i) => i !== idx));
  };

  const pushNotifications = config?.content.pushNotifications || DEFAULT_CONTENT.pushNotifications;

  const updatePushNotifications = (next: ReferPushNotificationTemplate[]) => {
    if (!config) return;
    setConfig({ ...config, content: { ...config.content, pushNotifications: next } });
    setDirty(true);
  };

  const addPushNotification = () => {
    updatePushNotifications([
      ...pushNotifications,
      {
        id: `push_${Date.now()}`,
        label: 'New Push Notification',
        trigger: 'milestone_unlocked',
        title: 'MyFNG Referral Unlocked',
        body: '{{WALLET_PART}}Milestone #{{MILESTONE}} unlocked — claim your Refer & Rise reward now.',
        enabled: true,
      },
    ]);
  };

  const updatePushNotification = (
    idx: number,
    field: keyof ReferPushNotificationTemplate,
    value: string | boolean,
  ) => {
    const next = pushNotifications.map((item, i) => (i === idx ? { ...item, [field]: value } : item));
    updatePushNotifications(next);
  };

  const removePushNotification = (idx: number) => {
    if (pushNotifications.length <= 1) return;
    updatePushNotifications(pushNotifications.filter((_, i) => i !== idx));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center">
        <div className="animate-pulse text-lg text-gray-400">Loading Refer & Rise...</div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f4f6fb]">
      {/* Toast */}
      {(message || error) && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg ${message ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {message || error}
        </div>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_white_0,_transparent_45%)]" />
        <div className="relative px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                <Trophy className="h-3.5 w-3.5" />
                Refer & Rise Engine
              </div>
              <h1 className="text-2xl sm:text-3xl font-black mt-3 text-white">Refer &amp; Rise Management</h1>
              <p className="text-sm sm:text-base text-blue-100 mt-2 max-w-2xl">
                {analyticsOnly
                  ? 'View referral performance, leaderboard, and user analytics.'
                  : editable
                    ? 'Manage milestones, rewards categories, and track referral activity. Changes reflect instantly in the app.'
                    : 'View referral configuration and analytics. Only Super Admin can edit settings.'}
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              {editable && (
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm('Reset to MYFNG Save / Care / Elite / Express defaults?')) return;
                    setConfig({
                      ...DEFAULT_REFER_AND_RISE_CONFIG,
                      friendBonus: config?.friendBonus ?? 500,
                      expiryDays: config?.expiryDays ?? 90,
                    });
                    setDirty(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur px-4 py-2.5 text-sm font-bold transition"
                >
                  Reset Defaults
                </button>
              )}
              {!analyticsOnly && (
                <button onClick={runBackfill} disabled={backfilling} className="inline-flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur px-4 py-2.5 text-sm font-bold transition disabled:opacity-50">
                  <CheckCircle2 className="h-4 w-4" /> {backfilling ? 'Processing...' : 'Sync Rewards'}
                </button>
              )}
              <button onClick={fetchData} className="inline-flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur px-4 py-2.5 text-sm font-bold transition">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
              {editable && dirty && (
                <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-white text-blue-700 px-5 py-2.5 text-sm font-black shadow-lg hover:shadow-xl transition disabled:opacity-50">
                  <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Total Referrals" value={stats.total_referrals} icon={<Users className="h-5 w-5 text-blue-600" />} accent="bg-blue-100" />
            <StatCard label="Rewarded" value={stats.rewarded} icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} accent="bg-emerald-100" />
            <StatCard label="Pending" value={stats.pending} icon={<Clock className="h-5 w-5 text-amber-600" />} accent="bg-amber-100" />
            <StatCard label="Rejected" value={stats.rejected} icon={<XCircle className="h-5 w-5 text-red-600" />} accent="bg-red-100" />
            <StatCard label="Total Paid" value={`₹${stats.total_rewards_paid.toLocaleString('en-IN')}`} icon={<IndianRupee className="h-5 w-5 text-violet-600" />} accent="bg-violet-100" />
          </div>
        )}

        {/* Tabs */}
        {!analyticsOnly && (
        <div className="flex gap-1 bg-white/70 backdrop-blur rounded-xl p-1 border border-gray-200/50 w-fit">
          {[
            { key: 'milestones' as const, label: 'Milestones & Rewards', icon: <Trophy className="h-3.5 w-3.5" /> },
            { key: 'content' as const, label: 'Content & T&C', icon: <Pencil className="h-3.5 w-3.5" /> },
            { key: 'deeplinks' as const, label: 'Deep Links', icon: <Link2 className="h-3.5 w-3.5" /> },
            { key: 'users' as const, label: 'Users & Analytics', icon: <Users className="h-3.5 w-3.5" /> },
            { key: 'activity' as const, label: 'Recent Activity', icon: <Clock className="h-3.5 w-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === tab.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        )}

        {!analyticsOnly && !canEdit && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 font-semibold">
            View-only mode — configuration changes require Super Admin access.
          </div>
        )}

        {!analyticsOnly && activeTab === 'milestones' && config && (
          <div className={editable ? undefined : 'pointer-events-none opacity-80'}>
          <>
            {/* Global Settings */}
            <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-sm">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2 mb-4">
                <Gift className="h-5 w-5 text-blue-600" />
                Global Settings
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <label className="block">
                  <span className="text-sm font-semibold text-gray-800">Friend Bonus (on signup)</span>
                  <span className="mt-1 block text-xs text-gray-500">New user gets this instantly when they use a referral code</span>
                  <div className="mt-2 flex items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      value={config.friendBonus}
                      onChange={(e) => updateGlobalSetting('friendBonus', Number(e.target.value) || 0)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-gray-800">Wallet Credit Expiry</span>
                  <span className="mt-1 block text-xs text-gray-500">Referral wallet credits expire after this many days</span>
                  <div className="mt-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      min={1}
                      value={config.expiryDays}
                      onChange={(e) => updateGlobalSetting('expiryDays', Number(e.target.value) || 90)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold"
                    />
                    <span className="text-xs font-bold text-gray-400">days</span>
                  </div>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-gray-800">Claimed Reward Voucher Expiry</span>
                  <span className="mt-1 block text-xs text-gray-500">Refer &amp; Rise claimed rewards become booking coupons for this long</span>
                  <div className="mt-2 flex items-center gap-2">
                    <Gift className="h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      min={1}
                      value={config.rewardExpiryDays ?? 365}
                      onChange={(e) => updateGlobalSetting('rewardExpiryDays', Number(e.target.value) || 365)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold"
                    />
                    <span className="text-xs font-bold text-gray-400">days</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Reward Categories */}
            <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-sm">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2 mb-4">
                <Gift className="h-5 w-5 text-blue-600" />
                Reward Categories
              </h2>
              <p className="text-xs text-gray-500 mb-4">These are the 4 reward families users can choose from at each milestone.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {FAMILY_ORDER.map((key) => {
                  const cat = config.categories[key];
                  if (!cat) return null;
                  return (
                  <div key={key} className="rounded-xl border border-gray-200 p-4 space-y-3" style={{ borderTopColor: cat.color, borderTopWidth: 3 }}>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                        {CATEGORY_ICONS[key] || <Gift className="h-4 w-4" style={{ color: cat.color }} />}
                      </div>
                      <input
                        value={cat.name}
                        onChange={(e) => updateCategory(key, 'name', e.target.value)}
                        className="flex-1 text-sm font-bold text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none transition px-1"
                      />
                    </div>
                    <input
                      value={cat.tag}
                      onChange={(e) => updateCategory(key, 'tag', e.target.value)}
                      className="w-full text-[10px] font-bold uppercase tracking-wider border rounded-lg px-2 py-1 text-gray-600 border-gray-200"
                      placeholder="TAG NAME"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Color:</span>
                      <input
                        type="color"
                        value={cat.color}
                        onChange={(e) => updateCategory(key, 'color', e.target.value)}
                        className="h-6 w-6 rounded border border-gray-200 cursor-pointer"
                      />
                      <span className="text-xs font-mono text-gray-400">{cat.color}</span>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Milestones */}
            <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-blue-600" />
                  Milestones ({config.milestones.length})
                </h2>
                <button onClick={addMilestone} disabled={!editable} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition disabled:opacity-40">
                  <Plus className="h-3.5 w-3.5" /> Add Milestone
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-4">Each milestone unlocks when user reaches the required referral count. User picks ONE reward from any category.</p>

              <div className="space-y-3">
                {config.milestones.map((milestone, idx) => {
                  const isExpanded = expandedMilestone === idx;
                  return (
                    <div key={idx} className="rounded-xl border border-gray-200 overflow-hidden">
                      {/* Header */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
                        onClick={() => setExpandedMilestone(isExpanded ? null : idx)}
                      >
                        <GripVertical className="h-4 w-4 text-gray-300" />
                        <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">
                          {milestone.referralCount}
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-bold text-gray-900">Milestone #{idx + 1}</span>
                          <span className="text-xs text-gray-500 ml-2">— {milestone.referralCount} referrals</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {FAMILY_ORDER.map((key) => {
                            const cat = config.categories[key];
                            if (!cat) return null;
                            return (
                            <div key={key} className="h-5 w-5 rounded flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                            </div>
                            );
                          })}
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="px-4 py-4 border-t border-gray-100 space-y-4">
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-600">Referral Count:</span>
                              <input
                                type="number"
                                min={1}
                                value={milestone.referralCount}
                                onChange={(e) => updateMilestoneCount(idx, Number(e.target.value) || 1)}
                                className="w-20 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-bold text-center"
                              />
                            </label>
                            <button onClick={() => removeMilestone(idx)} className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition">
                              <Trash2 className="h-3.5 w-3.5" /> Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {FAMILY_ORDER.map((key) => {
                              const cat = config.categories[key];
                              if (!cat) return null;
                              return (
                              <div key={key} className="rounded-lg border border-gray-100 p-3" style={{ borderLeftColor: cat.color, borderLeftWidth: 3 }}>
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="h-5 w-5 rounded flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                                    {CATEGORY_ICONS[key]}
                                  </div>
                                  <span className="text-xs font-bold text-gray-700">{cat.name}</span>
                                </div>
                                <input
                                  type="text"
                                  value={milestone.rewards[key as FamilyKey] || ''}
                                  onChange={(e) => updateMilestoneReward(idx, key, e.target.value)}
                                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400"
                                  placeholder={`Reward for ${cat.name}...`}
                                />
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
          </div>
        )}

        {/* Content Tab */}
        {!analyticsOnly && activeTab === 'content' && config && (
          <div className={editable ? undefined : 'pointer-events-none opacity-80'}>
          <>
            {/* UI Text */}
            <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-sm space-y-5">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Pencil className="h-5 w-5 text-blue-600" />
                App Content
              </h2>
              <p className="text-xs text-gray-500">These strings appear in the mobile app. Changes reflect immediately after save.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <label className="block">
                  <span className="text-sm font-semibold text-gray-800">Hero Title</span>
                  <input
                    type="text"
                    value={config.content.heroTitle}
                    onChange={(e) => updateContent('heroTitle', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-gray-800">Hero Subtitle</span>
                  <input
                    type="text"
                    value={config.content.heroSubtitle}
                    onChange={(e) => updateContent('heroSubtitle', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-gray-800">Banner Title</span>
                  <span className="block text-xs text-gray-500 mt-0.5">Shown in the footer referral banner</span>
                  <input
                    type="text"
                    value={config.content.bannerTitle}
                    onChange={(e) => updateContent('bannerTitle', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-gray-800">Banner Subtitle</span>
                  <input
                    type="text"
                    value={config.content.bannerSubtitle}
                    onChange={(e) => updateContent('bannerSubtitle', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-gray-800">Share Message Template</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  Use <code className="bg-gray-100 px-1 rounded">{'{{CODE}}'}</code> for referral code and <code className="bg-gray-100 px-1 rounded">{'{{LINK}}'}</code> for download link
                </span>
                <textarea
                  value={config.content.shareMessage}
                  onChange={(e) => updateContent('shareMessage', e.target.value)}
                  rows={5}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-mono resize-y"
                />
              </label>
            </div>

            {/* Push Notifications */}
            <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-violet-600" />
                    Push Notifications
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Edit anytime — saved to Refer &amp; Rise config. Tap on notification opens Refer &amp; Rise in app.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addPushNotification}
                  className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:text-violet-800 transition shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Notification
                </button>
              </div>

              <p className="text-xs text-gray-500">
                Placeholders:{' '}
                <code className="bg-gray-100 px-1 rounded">{'{{WALLET_PART}}'}</code>,{' '}
                <code className="bg-gray-100 px-1 rounded">{'{{WALLET_AMOUNT}}'}</code>,{' '}
                <code className="bg-gray-100 px-1 rounded">{'{{MILESTONE}}'}</code>
              </p>

              <div className="space-y-4">
                {pushNotifications.map((item, idx) => (
                  <div key={item.id || idx} className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Label (admin only)</span>
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => updatePushNotification(idx, 'label', e.target.value)}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-bold uppercase tracking-wide text-gray-500">When to send</span>
                          <select
                            value={item.trigger}
                            onChange={(e) => updatePushNotification(idx, 'trigger', e.target.value)}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                          >
                            {Object.entries(REFER_PUSH_TRIGGER_LABELS).map(([key, label]) => (
                              <option key={key} value={key}>{label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 pt-6">
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={(e) => updatePushNotification(idx, 'enabled', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          Enabled
                        </label>
                        <button
                          type="button"
                          onClick={() => removePushNotification(idx)}
                          disabled={pushNotifications.length <= 1}
                          className="text-gray-400 hover:text-red-500 transition disabled:opacity-30"
                          title={pushNotifications.length <= 1 ? 'At least one notification required' : 'Remove'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-sm font-semibold text-gray-800">Title</span>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updatePushNotification(idx, 'title', e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-gray-800">Body</span>
                      <textarea
                        value={item.body}
                        onChange={(e) => updatePushNotification(idx, 'body', e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm resize-y"
                      />
                    </label>

                    <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 text-xs text-violet-900">
                      <p className="font-bold mb-1">Preview (1st referral, ₹500 wallet credit)</p>
                      <p className="font-semibold">{item.title || '—'}</p>
                      <p className="mt-1 text-violet-800">{previewReferPushBody(item.body)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* T&C Editor */}
            <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-gray-900">Terms &amp; Conditions</h2>
                <button onClick={addTncItem} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition">
                  <Plus className="h-3.5 w-3.5" /> Add Item
                </button>
              </div>
              <p className="text-xs text-gray-500">Shown in the app&apos;s Refer &amp; Rise section.</p>
              <div className="space-y-2">
                {config.content.tnc.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 font-bold mt-2.5 w-5 shrink-0">{idx + 1}.</span>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateTncItem(idx, e.target.value)}
                      className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                      placeholder="Enter T&C point..."
                    />
                    <button onClick={() => removeTncItem(idx)} className="mt-1.5 text-gray-400 hover:text-red-500 transition">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
          </div>
        )}

        {/* Users & Analytics Tab */}
        {(analyticsOnly || activeTab === 'users') && (
          <div className="space-y-6">
            {/* Analytics Summary */}
            {stats && (
              <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-sm">
                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2 mb-4">
                  <Trophy className="h-5 w-5 text-blue-600" />
                  Analytics Overview
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                    <p className="text-xs font-bold text-blue-600 uppercase">Conversion Rate</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">
                      {stats.total_referrals > 0 ? ((stats.rewarded / stats.total_referrals) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Rewarded / Total</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                    <p className="text-xs font-bold text-emerald-600 uppercase">Avg Reward</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">
                      ₹{stats.rewarded > 0 ? Math.round(stats.total_rewards_paid / stats.rewarded).toLocaleString('en-IN') : 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Per referral</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                    <p className="text-xs font-bold text-amber-600 uppercase">Pending</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{stats.pending}</p>
                    <p className="text-xs text-gray-500 mt-1">Awaiting first booking</p>
                  </div>
                  <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
                    <p className="text-xs font-bold text-violet-600 uppercase">Total Distributed</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">₹{stats.total_rewards_paid.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-gray-500 mt-1">Wallet credits given</p>
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard */}
            <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-sm">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-blue-600" />
                Referral Leaderboard
              </h2>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-gray-400">No referral data yet. Leaderboard will populate as users refer friends.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                        <th className="pb-3 pr-4">#</th>
                        <th className="pb-3 pr-4">User</th>
                        <th className="pb-3 pr-4">Code</th>
                        <th className="pb-3 pr-4 text-center">Total</th>
                        <th className="pb-3 pr-4 text-center">Rewarded</th>
                        <th className="pb-3 pr-4 text-center">Pending</th>
                        <th className="pb-3 text-right">Earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((entry, idx) => (
                        <React.Fragment key={entry.customer_id}>
                          <tr
                            className="border-b border-gray-50 hover:bg-gray-50/50 transition cursor-pointer"
                            onClick={() => setExpandedUser(expandedUser === entry.customer_id ? null : entry.customer_id)}
                          >
                            <td className="py-3 pr-4">
                              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${idx < 3 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="font-semibold text-gray-800">{entry.full_name || 'Unknown'}</span>
                              <span className="text-gray-400 text-xs ml-1">{entry.phone}</span>
                            </td>
                            <td className="py-3 pr-4 font-mono text-xs font-bold text-blue-600">{entry.referral_code}</td>
                            <td className="py-3 pr-4 text-center font-bold text-gray-900">{entry.total_referrals}</td>
                            <td className="py-3 pr-4 text-center">
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                <CheckCircle2 className="h-3 w-3" /> {entry.rewarded}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-center">
                              <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                                <Clock className="h-3 w-3" /> {entry.pending}
                              </span>
                            </td>
                            <td className="py-3 text-right font-bold text-gray-900">₹{entry.total_earned.toLocaleString('en-IN')}</td>
                          </tr>
                          {expandedUser === entry.customer_id && entry.referees && entry.referees.length > 0 && (
                            <tr>
                              <td colSpan={7} className="px-4 py-3 bg-blue-50/50 border-b border-gray-100">
                                <p className="text-xs font-bold text-gray-600 mb-2">Referred Friends:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {entry.referees.map((ref, ri) => (
                                    <div key={ri} className="flex items-center gap-2 rounded-lg bg-white border border-gray-100 px-3 py-2">
                                      <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                                        {(ref.full_name || 'U')[0].toUpperCase()}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-gray-800 truncate">{ref.full_name || 'Unknown'}</p>
                                        <p className="text-[10px] text-gray-400">{ref.phone}</p>
                                      </div>
                                      <StatusBadge status={ref.status} />
                                      {!analyticsOnly && ref.status === 'PENDING' && ref.event_id && (
                                        <button
                                          onClick={() => handleManualReward(ref.event_id)}
                                          disabled={rewardingId === ref.event_id}
                                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition shrink-0"
                                        >
                                          {rewardingId === ref.event_id ? '…' : 'Reward'}
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Deep Links Tab */}
        {!analyticsOnly && activeTab === 'deeplinks' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-blue-600" />
                    Refer &amp; Rise invite deep links
                  </h2>
                  <p className="text-sm text-gray-600 mt-1 max-w-2xl">
                    Share <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">/refer/&#123;CODE&#125;</code> so iOS
                    Universal Links and Android App Links open the app with the referral code applied.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchDeepLinks()}
                  disabled={deepLinksLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${deepLinksLoading ? 'animate-spin' : ''}`} />
                  Refresh status
                </button>
              </div>

              {deepLinksLoading && !deepLinks ? (
                <p className="text-sm text-gray-400">Checking association files…</p>
              ) : deepLinks ? (
                <div className="space-y-4">
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                      deepLinks.overall === 'healthy'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : deepLinks.overall === 'degraded'
                          ? 'border-amber-200 bg-amber-50 text-amber-900'
                          : 'border-red-200 bg-red-50 text-red-800'
                    }`}
                  >
                    Status:{' '}
                    {deepLinks.overall === 'healthy'
                      ? 'iOS + Android ready'
                      : deepLinks.overall === 'degraded'
                        ? 'iOS OK · Android needs fingerprints / assetlinks'
                        : 'Deep links not ready — AASA/assetlinks missing on live site'}
                    {deepLinks.fetch_error ? ` (${deepLinks.fetch_error})` : ''}
                  </div>

                  {(deepLinks.aasa?.status === 404 || deepLinks.assetlinks?.status === 404) && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 space-y-1">
                      <p className="font-bold">HTTP 404 on myfng.in = routes not live yet</p>
                      <p className="text-xs leading-relaxed">
                        Code already has{' '}
                        <code className="bg-white/70 px-1 rounded">/.well-known/apple-app-site-association</code> and{' '}
                        <code className="bg-white/70 px-1 rounded">/.well-known/assetlinks.json</code>. Deploy the web
                        app, then refresh this tab. After deploy: set Vercel env{' '}
                        <code className="bg-white/70 px-1 rounded">ANDROID_APP_LINK_SHA256</code> (Play App Signing
                        SHA-256) for Android &quot;Ready&quot;.
                      </p>
                    </div>
                  )}

                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Invite URL pattern</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-sm font-mono text-gray-900 break-all">
                        {deepLinks.invite_url_pattern || 'https://myfng.in/refer/{CODE}'}
                      </code>
                      {deepLinks.invite_url_pattern ? (
                        <button
                          type="button"
                          onClick={() =>
                            void copyDeepLinkText(deepLinks.invite_url_pattern!, 'pattern')
                          }
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copiedDeepLink === 'pattern' ? 'Copied' : 'Copy'}
                        </button>
                      ) : null}
                    </div>
                    {deepLinks.sample_invite_url ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs text-gray-500">Sample:</span>
                        <code className="text-xs font-mono text-gray-700 break-all">
                          {deepLinks.sample_invite_url}
                        </code>
                        <button
                          type="button"
                          onClick={() => void copyDeepLinkText(deepLinks.sample_invite_url!, 'sample')}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copiedDeepLink === 'sample' ? 'Copied' : 'Copy'}
                        </button>
                        {deepLinks.admin_links?.sample_landing ? (
                          <a
                            href={deepLinks.admin_links.sample_landing}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Open landing
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
                      {deepLinks.store_redirect_note ||
                        '/go/myfngapp does not carry a referral code — use /refer/{CODE} for invites.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="text-sm font-black text-gray-900">iOS AASA</h3>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            deepLinks.aasa?.ready
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {deepLinks.aasa?.ready ? 'Ready' : 'Not ready'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 break-all mb-2">{deepLinks.aasa?.url}</p>
                      <ul className="text-xs text-gray-700 space-y-1">
                        <li>/refer path: {deepLinks.aasa?.has_refer_path ? 'yes' : 'no'}</li>
                        <li>App ID: {deepLinks.aasa?.has_app_id ? deepLinks.apple_app_id : 'missing'}</li>
                        <li>HTTP: {deepLinks.aasa?.status ?? '—'}</li>
                      </ul>
                    </div>
                    <div className="rounded-xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="text-sm font-black text-gray-900">Android assetlinks</h3>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            deepLinks.assetlinks?.ready
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {deepLinks.assetlinks?.ready ? 'Ready' : 'Needs setup'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 break-all mb-2">{deepLinks.assetlinks?.url}</p>
                      <ul className="text-xs text-gray-700 space-y-1">
                        <li>Package: {deepLinks.android_package || 'com.myfng.app'}</li>
                        <li>
                          Fingerprints on file: {deepLinks.assetlinks?.fingerprint_count ?? 0}
                        </li>
                        <li>
                          Env ANDROID_APP_LINK_SHA256:{' '}
                          {deepLinks.assetlinks?.env_android_sha256_set ? 'set' : 'not set'}
                        </li>
                        <li>HTTP: {deepLinks.assetlinks?.status ?? '—'}</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {deepLinks.admin_links?.universal_link ? (
                      <a
                        href={deepLinks.admin_links.universal_link}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                      >
                        <Link2 className="h-3.5 w-3.5" /> Store Universal Link (/go)
                      </a>
                    ) : null}
                    {deepLinks.admin_links?.system_monitor ? (
                      <a
                        href={deepLinks.admin_links.system_monitor}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> System Monitor
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No status loaded yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {!analyticsOnly && activeTab === 'activity' && (
          <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 mb-4">Recent Referral Activity</h2>
            {events.length === 0 ? (
              <p className="text-sm text-gray-400">No referral events yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Referrer</th>
                      <th className="pb-3 pr-4">Friend</th>
                      <th className="pb-3 pr-4">Code</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev) => (
                      <tr key={ev.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                        <td className="py-3 pr-4 text-gray-600">
                          {new Date(ev.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="font-semibold text-gray-800">{ev.referrer?.full_name || 'Unknown'}</span>
                          {ev.referrer?.phone && <span className="text-gray-400 text-xs ml-1">{ev.referrer.phone}</span>}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="font-semibold text-gray-800">{ev.referee?.full_name || 'Unknown'}</span>
                          {ev.referee?.phone && <span className="text-gray-400 text-xs ml-1">{ev.referee.phone}</span>}
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs font-bold text-gray-600">{ev.referral_code}</td>
                        <td className="py-3 pr-4"><StatusBadge status={ev.status} /></td>
                        <td className="py-3">
                          {ev.status === 'PENDING' && (
                            <button
                              onClick={() => handleManualReward(ev.id)}
                              disabled={rewardingId === ev.id}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                            >
                              {rewardingId === ev.id ? 'Rewarding…' : 'Mark Rewarded'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
