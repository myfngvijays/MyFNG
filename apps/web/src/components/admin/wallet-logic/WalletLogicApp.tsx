'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  Save,
  RefreshCw,
  Percent,
  Gift,
  Crown,
  Smartphone,
  Globe,
  Users,
  Shield,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Copy,
  Zap,
  IndianRupee,
  Clock,
  Plus,
  Trash2,
  Layers,
} from 'lucide-react';
import type { WalletCoreRules, WalletLogicFullSettings, WalletPlatformSettings, WalletRoadmapIdea, WalletUsageMode } from '@/lib/wallet-config';
import { computeUsageCapFromRules, createDefaultWalletLogicSettings, formatUsageLimitLabel, resolvePlatformCoreRules } from '@/lib/wallet-config';
import WalletLogicAdvancedSection from './WalletLogicAdvancedSection';

type PlatformTab = 'global' | 'android' | 'ios' | 'advanced';

const PLATFORM_TABS: Array<{ id: PlatformTab; label: string; icon: typeof Globe; hint: string }> = [
  { id: 'global', label: 'Default (Web)', icon: Globe, hint: 'Website checkout & app fallback' },
  { id: 'android', label: 'Android', icon: Smartphone, hint: 'Google Play app rules' },
  { id: 'ios', label: 'iOS', icon: Smartphone, hint: 'App Store app rules' },
];

const ROADMAP_STATUS: Record<WalletRoadmapIdea['status'], { label: string; className: string }> = {
  planned: { label: 'Planned', className: 'bg-violet-100 text-violet-700' },
  in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-700' },
  done: { label: 'Done', className: 'bg-emerald-100 text-emerald-700' },
};

function inr(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function cloneDefaults(): WalletLogicFullSettings {
  return createDefaultWalletLogicSettings();
}

function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
          {sub ? <p className="text-xs text-gray-500 mt-1">{sub}</p> : null}
        </div>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>{icon}</div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = React.useId();
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-semibold text-gray-900 cursor-pointer">
          {label}
        </label>
        {hint ? <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{hint}</p> : null}
      </div>
      <label htmlFor={id} className="relative inline-flex h-7 w-11 shrink-0 cursor-pointer items-center">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="absolute inset-0 rounded-full bg-gray-300 transition-colors peer-checked:bg-violet-600 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-300" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform peer-checked:translate-x-4" />
      </label>
    </div>
  );
}

function PercentField({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: number | string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const num = Number(value) || 0;
  return (
    <label className={`block ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-semibold text-gray-800">{label}</span>
        <span className="text-sm font-black text-violet-700 bg-violet-50 px-2 py-0.5 rounded-lg">{num}%</span>
      </div>
      {hint ? <span className="block text-xs text-gray-500 mb-2">{hint}</span> : null}
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={num}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full accent-violet-600"
      />
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"
      />
    </label>
  );
}

function MoneyField({
  label,
  hint,
  value,
  onChange,
  disabled,
  suffix = 'INR',
}: {
  label: string;
  hint?: string;
  value: number | string;
  onChange: (v: string) => void;
  disabled?: boolean;
  suffix?: string;
}) {
  return (
    <label className={`block ${disabled ? 'opacity-50' : ''}`}>
      <span className="text-sm font-semibold text-gray-800">{label}</span>
      {hint ? <span className="mt-1 block text-xs text-gray-500">{hint}</span> : null}
      <div className="mt-2 flex items-center gap-2">
        <div className="relative flex-1">
          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="number"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm font-semibold"
          />
        </div>
        <span className="text-xs font-bold text-gray-400 shrink-0">{suffix}</span>
      </div>
    </label>
  );
}

function DaysField({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: number | string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`block ${disabled ? 'opacity-50' : ''}`}>
      <span className="text-sm font-semibold text-gray-800">{label}</span>
      {hint ? <span className="mt-1 block text-xs text-gray-500">{hint}</span> : null}
      <div className="mt-2 flex items-center gap-2">
        <Clock className="h-4 w-4 text-gray-400 shrink-0" />
        <input
          type="number"
          min={1}
          max={3650}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold"
        />
        <span className="text-xs font-bold text-gray-400 shrink-0">days</span>
      </div>
    </label>
  );
}

function UsageLimitField({
  label,
  hint,
  mode,
  percent,
  amount,
  onModeChange,
  onPercentChange,
  onAmountChange,
  disabled,
}: {
  label: string;
  hint?: string;
  mode: WalletUsageMode;
  percent: number | string;
  amount: number | string;
  onModeChange: (mode: WalletUsageMode) => void;
  onPercentChange: (v: string) => void;
  onAmountChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-gray-800">{label}</span>
        <span className="text-sm font-black text-violet-700 bg-violet-50 px-2 py-0.5 rounded-lg">
          {mode === 'AMOUNT' ? `₹${Number(amount) || 0}` : `${Number(percent) || 0}%`}
        </span>
      </div>
      {hint ? <span className="block text-xs text-gray-500 mb-2">{hint}</span> : null}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onModeChange('PERCENT')}
          className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition ${
            mode === 'PERCENT'
              ? 'bg-violet-600 text-white border-violet-600'
              : 'bg-white text-gray-700 border-gray-200 hover:border-violet-200'
          }`}
        >
          Percentage
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onModeChange('AMOUNT')}
          className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition ${
            mode === 'AMOUNT'
              ? 'bg-violet-600 text-white border-violet-600'
              : 'bg-white text-gray-700 border-gray-200 hover:border-violet-200'
          }`}
        >
          Fixed ₹
        </button>
      </div>
      {mode === 'PERCENT' ? (
        <PercentField label="" value={percent} onChange={onPercentChange} disabled={disabled} />
      ) : (
        <MoneyField label="Max wallet (fixed INR)" value={amount} onChange={onAmountChange} disabled={disabled} />
      )}
    </div>
  );
}

function RulesForm({
  rules,
  onPatch,
  disabled,
}: {
  rules: WalletCoreRules;
  onPatch: (key: keyof WalletCoreRules, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <UsageLimitField
          label="Service booking — max wallet"
          hint="Kitna wallet service bill par use ho sakta hai"
          mode={rules.service_usage_mode}
          percent={rules.service_usage_percent}
          amount={rules.service_usage_amount}
          onModeChange={(m) => onPatch('service_usage_mode', m)}
          onPercentChange={(v) => onPatch('service_usage_percent', v)}
          onAmountChange={(v) => onPatch('service_usage_amount', v)}
          disabled={disabled}
        />
        <UsageLimitField
          label="Membership — max wallet"
          hint="Membership price par kitna wallet use ho sakta hai"
          mode={rules.membership_usage_mode}
          percent={rules.membership_usage_percent}
          amount={rules.membership_usage_amount}
          onModeChange={(m) => onPatch('membership_usage_mode', m)}
          onPercentChange={(v) => onPatch('membership_usage_percent', v)}
          onAmountChange={(v) => onPatch('membership_usage_amount', v)}
          disabled={disabled}
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <MoneyField
          label="Welcome bonus"
          value={rules.welcome_bonus_amount}
          onChange={(v) => onPatch('welcome_bonus_amount', v)}
          disabled={disabled}
        />
        <DaysField
          label="Welcome bonus expiry"
          hint="Unused bonus kitne din baad expire"
          value={rules.welcome_expiry_days}
          onChange={(v) => onPatch('welcome_expiry_days', v)}
          disabled={disabled}
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <PercentField
          label="Prime cashback rate"
          hint="Paid service bill par cashback %"
          value={rules.membership_cashback_rate_percent}
          onChange={(v) => onPatch('membership_cashback_rate_percent', v)}
          disabled={disabled}
        />
        <MoneyField
          label="Max cashback per bill"
          value={rules.membership_cashback_max}
          onChange={(v) => onPatch('membership_cashback_max', v)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export default function WalletLogicApp() {
  const [settings, setSettings] = useState<WalletLogicFullSettings>(cloneDefaults());
  const [tab, setTab] = useState<PlatformTab>('global');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [newIdeaTitle, setNewIdeaTitle] = useState('');
  const [newIdeaDesc, setNewIdeaDesc] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/wallet-logic');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load wallet logic');
      setSettings({ ...cloneDefaults(), ...(json.settings || {}), roadmap_ideas: json.settings?.roadmap_ideas || cloneDefaults().roadmap_ideas });
      setDirty(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to load wallet logic');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const effectiveRules = useMemo(() => {
    if (tab === 'advanced') return settings.global;
    const platform = tab === 'global' ? 'web' : tab;
    return resolvePlatformCoreRules(settings, platform);
  }, [settings, tab]);

  const preview = useMemo(() => {
    const serviceOrder = 5000;
    const membershipOrder = 699;
    const cashbackBill = 4000;
    const rules = effectiveRules;
    let serviceWallet = Math.round(computeUsageCapFromRules(serviceOrder, 'SERVICE', rules));
    let membershipWallet = Math.round(computeUsageCapFromRules(membershipOrder, 'MEMBERSHIP', rules));
    if (settings.max_absolute_deduction > 0) {
      serviceWallet = Math.min(serviceWallet, settings.max_absolute_deduction);
      membershipWallet = Math.min(membershipWallet, settings.max_absolute_deduction);
    }
    const cashback = Math.min(
      Math.round(cashbackBill * (rules.membership_cashback_rate_percent / 100)),
      rules.membership_cashback_max,
    );
    return { serviceOrder, membershipOrder, serviceWallet, membershipWallet, cashbackBill, cashback };
  }, [effectiveRules, settings.max_absolute_deduction]);

  const platformMeta = useMemo(() => {
    if (tab === 'global' || tab === 'advanced') return null;
    return settings[tab] as WalletPlatformSettings;
  }, [settings, tab]);

  const rulesDisabled = tab !== 'global' && Boolean(platformMeta?.use_global);
  const walletDisabledOnPlatform = tab !== 'global' && !platformMeta?.enabled;

  const patchGlobal = (key: keyof WalletCoreRules, value: string) => {
    setSettings((prev) => ({
      ...prev,
      global: {
        ...prev.global,
        [key]:
          key === 'service_usage_mode' || key === 'membership_usage_mode'
            ? (value as WalletUsageMode)
            : value === ''
              ? ''
              : Number(value),
      },
    }));
    setDirty(true);
  };

  const patchExtra = (key: keyof Pick<WalletLogicFullSettings, 'referral_first_reward' | 'referral_repeat_reward' | 'min_payable_for_wallet' | 'max_absolute_deduction'>, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value === '' ? '' : Number(value) }));
    setDirty(true);
  };

  const patchPlatform = (key: 'use_global' | 'enabled', value: boolean) => {
    if (tab === 'global') return;
    setSettings((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], [key]: value },
    }));
    setDirty(true);
  };

  const patchPlatformRules = (key: keyof WalletCoreRules, value: string) => {
    if (tab === 'global') return;
    setSettings((prev) => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        rules: {
          ...prev[tab].rules,
          [key]:
            key === 'service_usage_mode' || key === 'membership_usage_mode'
              ? (value as WalletUsageMode)
              : value === ''
                ? ''
                : Number(value),
        },
      },
    }));
    setDirty(true);
  };

  const copyFromDefault = () => {
    if (tab === 'global') return;
    setSettings((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], rules: { ...prev.global }, use_global: false },
    }));
    setDirty(true);
  };

  const addRoadmapIdea = () => {
    const title = newIdeaTitle.trim();
    if (!title) return;
    setSettings((prev) => ({
      ...prev,
      roadmap_ideas: [
        ...(prev.roadmap_ideas || []),
        {
          id: `idea-${Date.now()}`,
          title,
          desc: newIdeaDesc.trim(),
          status: 'planned',
        },
      ],
    }));
    setNewIdeaTitle('');
    setNewIdeaDesc('');
    setDirty(true);
  };

  const updateRoadmapIdea = (id: string, patch: Partial<WalletRoadmapIdea>) => {
    setSettings((prev) => ({
      ...prev,
      roadmap_ideas: (prev.roadmap_ideas || []).map((idea) => (idea.id === id ? { ...idea, ...patch } : idea)),
    }));
    setDirty(true);
  };

  const removeRoadmapIdea = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      roadmap_ideas: (prev.roadmap_ideas || []).filter((idea) => idea.id !== id),
    }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/super_admin/wallet-logic', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save wallet logic');
      setSettings({ ...cloneDefaults(), ...(json.settings || {}), roadmap_ideas: json.settings?.roadmap_ideas || cloneDefaults().roadmap_ideas });
      setMessage(json.message || 'Wallet logic saved');
      setDirty(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to save wallet logic');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#f4f6fb] [&_h1]:!text-white">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-700 via-indigo-700 to-blue-800 text-white">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_white_0,_transparent_45%)]" />
        <div className="relative px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                <Wallet className="h-3.5 w-3.5" />
                Wallet Engine
              </div>
              <h1 className="text-2xl sm:text-3xl font-black mt-3 text-white">Wallet Logic Control</h1>
              <p className="text-sm sm:text-base text-violet-100 mt-2 max-w-2xl">
                Web, Android aur iOS ke liye alag rules set karo. Percentages, welcome bonus, cashback aur referral — sab yahan se live update hoga.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 self-start rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur px-4 py-2.5 text-sm font-semibold text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {!loading ? (
            <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
              <StatCard
                label="Service cap"
                value={formatUsageLimitLabel(settings.global, 'SERVICE')}
                sub="Default / Web"
                accent="bg-blue-100 text-blue-700"
                icon={<Percent className="h-5 w-5" />}
              />
              <StatCard
                label="Membership cap"
                value={formatUsageLimitLabel(settings.global, 'MEMBERSHIP')}
                sub="Default / Web"
                accent="bg-violet-100 text-violet-700"
                icon={<Crown className="h-5 w-5" />}
              />
              <StatCard
                label="Welcome bonus"
                value={inr(settings.global.welcome_bonus_amount)}
                sub={`${settings.global.welcome_expiry_days} days validity`}
                accent="bg-emerald-100 text-emerald-700"
                icon={<Gift className="h-5 w-5" />}
              />
              <StatCard
                label="Referral rewards"
                value={`${inr(settings.referral_first_reward)} / ${inr(settings.referral_repeat_reward)}`}
                sub="First / Repeat"
                accent="bg-amber-100 text-amber-700"
                icon={<Users className="h-5 w-5" />}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            {message}
          </div>
        ) : null}

        {/* Platform tabs */}
        <div className="flex flex-wrap gap-2 mb-5">
          {PLATFORM_TABS.map(({ id, label, icon: Icon, hint }) => {
            const active = tab === id;
            const platformEnabled =
              id === 'global' ? true : settings[id].enabled;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? 'border-violet-600 bg-white shadow-md ring-2 ring-violet-100'
                    : 'border-gray-200 bg-white hover:border-violet-200'
                }`}
              >
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${active ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    {label}
                    {id !== 'global' && !platformEnabled ? (
                      <span className="text-[10px] font-bold uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Off</span>
                    ) : null}
                    {id !== 'global' && settings[id].use_global ? (
                      <span className="text-[10px] font-bold uppercase bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Default</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-500">{hint}</div>
                </div>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setTab('advanced')}
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-left transition ${
              tab === 'advanced'
                ? 'border-indigo-600 bg-white shadow-md ring-2 ring-indigo-100'
                : 'border-gray-200 bg-white hover:border-indigo-200'
            }`}
          >
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${tab === 'advanced' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                Advanced
                {settings.advanced_enabled ? (
                  <span className="text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                    {settings.service_overrides?.length || 0} rules
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-gray-500">Per-service wallet rules</div>
            </div>
          </button>
        </div>

        {loading ? (
          <div className="rounded-3xl border bg-white p-12 text-center text-gray-500">Loading wallet logic…</div>
        ) : tab === 'advanced' ? (
          <WalletLogicAdvancedSection
            settings={settings}
            globalRules={settings.global}
            onChange={(next) => {
              setSettings(next);
              setDirty(true);
            }}
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              {/* Platform controls */}
              {tab !== 'global' && platformMeta ? (
                <section className="rounded-3xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="font-bold !text-gray-900 flex items-center gap-2">
                        <Shield className="h-5 w-5 text-indigo-600" />
                        {tab === 'android' ? 'Android' : 'iOS'} Platform Controls
                      </h2>
                      <p className="text-xs text-gray-500 mt-1">App-specific overrides — aage chal kar alag campaigns bhi yahan se chala sakte ho</p>
                    </div>
                    <button
                      type="button"
                      onClick={copyFromDefault}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy from Default
                    </button>
                  </div>
                  <div className="space-y-3">
                    <Toggle
                      label="Use default (Web) rules"
                      hint="On = same as Default tab. Off = custom rules below apply."
                      checked={platformMeta.use_global}
                      onChange={(v) => patchPlatform('use_global', v)}
                    />
                    <Toggle
                      label={`Wallet enabled on ${tab === 'android' ? 'Android' : 'iOS'}`}
                      hint="Off karoge to is platform par wallet checkout band ho jayega"
                      checked={platformMeta.enabled}
                      onChange={(v) => patchPlatform('enabled', v)}
                    />
                  </div>
                  {walletDisabledOnPlatform ? (
                    <div className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-800">
                      Wallet is <strong>disabled</strong> on this platform. Customers won&apos;t see wallet option in app.
                    </div>
                  ) : null}
                  {rulesDisabled ? (
                    <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
                      Using <strong>Default (Web)</strong> rules. Turn off &quot;Use default rules&quot; to set custom {tab} values.
                    </div>
                  ) : null}
                </section>
              ) : null}

              {/* Core rules */}
              <section className="rounded-3xl border bg-white p-5 sm:p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                    <Percent className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-bold !text-gray-900">
                      {tab === 'global' ? 'Default Rules (Web + Fallback)' : `${tab === 'android' ? 'Android' : 'iOS'} Custom Rules`}
                    </h2>
                    <p className="text-xs text-gray-500">Checkout limits, welcome bonus & Prime cashback</p>
                  </div>
                </div>

                <RulesForm
                  rules={tab === 'global' ? settings.global : platformMeta!.rules}
                  onPatch={tab === 'global' ? patchGlobal : patchPlatformRules}
                  disabled={rulesDisabled || walletDisabledOnPlatform}
                />
              </section>

              {/* Global extras */}
              {tab === 'global' ? (
                <>
                  <section className="rounded-3xl border bg-white p-5 sm:p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-2">
                      <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-bold !text-gray-900">Referral Rewards</h2>
                        <p className="text-xs text-gray-500">App referral screen par ye amounts dikhengi</p>
                      </div>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <MoneyField
                        label="First successful referral"
                        value={settings.referral_first_reward}
                        onChange={(v) => patchExtra('referral_first_reward', v)}
                      />
                      <MoneyField
                        label="Every next referral"
                        value={settings.referral_repeat_reward}
                        onChange={(v) => patchExtra('referral_repeat_reward', v)}
                      />
                    </div>
                  </section>

                  <section className="rounded-3xl border bg-white p-5 sm:p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-2">
                      <div className="h-10 w-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                        <Shield className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-bold !text-gray-900">Safety Limits (All Platforms)</h2>
                        <p className="text-xs text-gray-500">Extra guardrails — 0 means no limit</p>
                      </div>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <MoneyField
                        label="Min payable to use wallet"
                        hint="Isse kam bill par wallet apply nahi hoga (0 = koi minimum nahi)"
                        value={settings.min_payable_for_wallet}
                        onChange={(v) => patchExtra('min_payable_for_wallet', v)}
                      />
                      <MoneyField
                        label="Max wallet per checkout (INR cap)"
                        hint="% ke alawa absolute max — e.g. ₹500 cap even if 10% zyada ho"
                        value={settings.max_absolute_deduction}
                        onChange={(v) => patchExtra('max_absolute_deduction', v)}
                      />
                    </div>
                  </section>

                  <section className="rounded-3xl border border-dashed border-violet-200 bg-violet-50/50 p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-violet-600" />
                        <div>
                          <h2 className="font-bold !text-violet-900">Aage add kar sakte ho (Roadmap)</h2>
                          <p className="text-xs text-violet-700 mt-0.5">Future wallet features — yahan add karo, Save par DB mein store hoga</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-violet-200 bg-white p-4 mb-4">
                      <p className="text-sm font-semibold text-gray-900 mb-3">Naya idea add karo</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          type="text"
                          value={newIdeaTitle}
                          onChange={(e) => setNewIdeaTitle(e.target.value)}
                          placeholder="Title — e.g. Diwali wallet bonus"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                        />
                        <input
                          type="text"
                          value={newIdeaDesc}
                          onChange={(e) => setNewIdeaDesc(e.target.value)}
                          placeholder="Short description (optional)"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm md:col-span-2"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addRoadmapIdea}
                        disabled={!newIdeaTitle.trim()}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                        Add Idea
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {(settings.roadmap_ideas || []).map((idea) => (
                        <div key={idea.id} className="rounded-2xl bg-white border border-violet-100 p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <input
                              type="text"
                              value={idea.title}
                              onChange={(e) => updateRoadmapIdea(idea.id, { title: e.target.value })}
                              className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-bold text-gray-900"
                            />
                            <button
                              type="button"
                              onClick={() => removeRoadmapIdea(idea.id)}
                              className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                              title="Remove idea"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <textarea
                            value={idea.desc}
                            onChange={(e) => updateRoadmapIdea(idea.id, { desc: e.target.value })}
                            rows={2}
                            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 resize-none"
                            placeholder="Description"
                          />
                          <select
                            value={idea.status}
                            onChange={(e) =>
                              updateRoadmapIdea(idea.id, { status: e.target.value as WalletRoadmapIdea['status'] })
                            }
                            className={`mt-2 rounded-lg border-0 px-2 py-1 text-[11px] font-bold ${ROADMAP_STATUS[idea.status].className}`}
                          >
                            <option value="planned">Planned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                        </div>
                      ))}
                    </div>

                    {(settings.roadmap_ideas || []).length === 0 ? (
                      <p className="text-sm text-violet-700 mt-3">Abhi koi idea nahi — upar se add karo.</p>
                    ) : null}
                  </section>
                </>
              ) : null}
            </div>

            {/* Preview sidebar */}
            <aside className="space-y-4 lg:sticky lg:top-4 h-fit">
              <div className="rounded-3xl border border-violet-200 bg-gradient-to-b from-violet-50 to-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-4 w-4 text-violet-700" />
                  <h3 className="font-bold !text-violet-900">Live Preview</h3>
                </div>
                <p className="text-xs text-violet-700 mb-4">
                  {tab === 'global' ? 'Web checkout' : tab === 'android' ? 'Android app' : 'iOS app'} — effective rules
                </p>
                <div className="space-y-3">
                  {[
                    {
                      label: 'Service ₹5,000',
                      value: inr(preview.serviceWallet),
                      sub: `max ${formatUsageLimitLabel(effectiveRules, 'SERVICE')} wallet`,
                    },
                    {
                      label: 'Membership ₹699',
                      value: inr(preview.membershipWallet),
                      sub: `max ${formatUsageLimitLabel(effectiveRules, 'MEMBERSHIP')} wallet`,
                    },
                    {
                      label: 'Cashback on ₹4,000 bill',
                      value: inr(preview.cashback),
                      sub: `${effectiveRules.membership_cashback_rate_percent}% · cap ${inr(effectiveRules.membership_cashback_max)}`,
                    },
                  ].map((row) => (
                    <div key={row.label} className="rounded-2xl bg-white border border-violet-100 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-gray-600">{row.label}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-violet-400" />
                      </div>
                      <p className="text-lg font-black text-gray-900 mt-1">{row.value}</p>
                      <p className="text-[11px] text-gray-500">{row.sub}</p>
                    </div>
                  ))}
                </div>
                {settings.min_payable_for_wallet > 0 || settings.max_absolute_deduction > 0 ? (
                  <div className="mt-4 rounded-xl bg-white/80 border border-violet-100 px-3 py-2 text-[11px] text-gray-600">
                    {settings.min_payable_for_wallet > 0 ? (
                      <p>Min bill for wallet: {inr(settings.min_payable_for_wallet)}</p>
                    ) : null}
                    {settings.max_absolute_deduction > 0 ? (
                      <p>Absolute cap: {inr(settings.max_absolute_deduction)} per checkout</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl border bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold !text-gray-900 mb-3">Platform status</h3>
                <div className="space-y-2 text-sm">
                  {(['android', 'ios'] as const).map((p) => {
                    const s = settings[p];
                    const rules = resolvePlatformCoreRules(settings, p);
                    return (
                      <div key={p} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                        <span className="font-semibold capitalize">{p}</span>
                        <span className={`text-xs font-bold ${s.enabled ? 'text-emerald-700' : 'text-red-600'}`}>
                          {s.enabled ? (s.use_global ? 'Default rules' : 'Custom') : 'Disabled'}
                          {!s.use_global && s.enabled
                            ? ` · ${formatUsageLimitLabel(rules, 'SERVICE')}/${formatUsageLimitLabel(rules, 'MEMBERSHIP')}`
                            : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* Sticky save bar */}
      {!loading ? (
        <div className="sticky bottom-0 z-10 border-t bg-white/95 backdrop-blur px-4 sm:px-6 py-3">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              {dirty ? (
                <span className="text-amber-700 font-semibold">Unsaved changes</span>
              ) : (
                <span className="text-emerald-700 font-semibold">All changes saved</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save Wallet Logic'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
