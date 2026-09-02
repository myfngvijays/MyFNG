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
  Upload,
  FileSpreadsheet,
  Loader2,
  Layers,
  ArrowDown,
  Calculator,
  TrendingUp,
  Banknote,
  Car,
  BadgeCheck,
  Info,
  Link2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import type {
  WalletCoreRules,
  WalletLogicFullSettings,
  WalletPlatformSettings,
  WalletRoadmapIdea,
  WalletSourceCombinationRule,
  WalletSourceGroup,
  WalletSourceUsageLimits,
  WalletUsageMode,
  WelcomeBonusOverrideUsageRules,
  WelcomeBonusPhoneOverride,
  WelcomeOverrideServiceUsageRule,
} from '@/lib/wallet-config';
import {
  computeUsageCapFromRules,
  createDefaultWalletLogicSettings,
  DEFAULT_WELCOME_OVERRIDE_USAGE,
  formatUsageLimitLabel,
  parseWelcomeBonusOverrideUsage,
  parseWelcomeBonusPhoneOverrides,
  resolvePlatformCoreRules,
  WALLET_SOURCE_GROUPS,
  WALLET_SOURCE_LABELS,
} from '@/lib/wallet-config';
import WalletLogicAdvancedSection from './WalletLogicAdvancedSection';

type WelcomeOverrideInputMode = 'paste' | 'csv' | 'sheet';

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
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = React.useId();
  return (
    <div className={`grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 ${disabled ? 'opacity-50' : ''}`}>
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
          disabled={disabled}
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
  onPatch: (key: keyof WalletCoreRules, value: string | boolean) => void;
  disabled?: boolean;
}) {
  const welcomeEnabled = rules.welcome_bonus_enabled !== false;

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
      <Toggle
        label="Welcome bonus"
        hint="Naye users ko login par welcome wallet milta hai. Festival/society coupon usi bucket mein add hota hai, isliye 1000+500=1500 par yahi wallet rules lagenge."
        checked={welcomeEnabled}
        onChange={(v) => onPatch('welcome_bonus_enabled', v)}
        disabled={disabled}
      />
      <div className={`grid gap-5 md:grid-cols-2 ${!welcomeEnabled ? 'opacity-50' : ''}`}>
        <MoneyField
          label="Welcome bonus amount (default)"
          value={rules.welcome_bonus_amount}
          onChange={(v) => onPatch('welcome_bonus_amount', v)}
          disabled={disabled || !welcomeEnabled}
        />
        <DaysField
          label="Welcome bonus expiry"
          hint="Unused bonus kitne din baad expire"
          value={rules.welcome_expiry_days}
          onChange={(v) => onPatch('welcome_expiry_days', v)}
          disabled={disabled || !welcomeEnabled}
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

function WelcomeBonusPhoneOverridesSection({
  overrides,
  defaultAmount,
  disabled,
  onChange,
}: {
  overrides: WelcomeBonusPhoneOverride[];
  defaultAmount: number;
  disabled?: boolean;
  onChange: (next: WelcomeBonusPhoneOverride[]) => void;
}) {
  const [inputMode, setInputMode] = useState<WelcomeOverrideInputMode>('paste');
  const [bulkPhones, setBulkPhones] = useState('');
  const [bulkAmount, setBulkAmount] = useState('1500');
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetLoading, setSheetLoading] = useState(false);

  const rows = overrides || [];

  const mergePhones = (phones: string[], amount: number) => {
    if (!phones.length || !Number.isFinite(amount) || amount <= 0) return 0;
    const before = new Set(rows.map((r) => r.phone));
    const merged = parseWelcomeBonusPhoneOverrides([
      ...rows,
      ...phones.map((phone) => ({ phone, amount })),
    ]);
    onChange(merged);
    return phones.filter((p) => !before.has(p)).length || phones.length;
  };

  const updateRow = (index: number, patch: Partial<WelcomeBonusPhoneOverride>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(parseWelcomeBonusPhoneOverrides(next));
  };

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const addBulk = () => {
    const amount = Number(bulkAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid override amount');
      return;
    }
    const phones = bulkPhones
      .split(/[\n,;]+/)
      .map((p) => p.replace(/\D/g, '').slice(-10))
      .filter((p) => p.length === 10);
    if (!phones.length) {
      toast.error('No valid 10-digit phones found');
      return;
    }
    const added = mergePhones(phones, amount);
    setBulkPhones('');
    toast.success(`${added} phone${added === 1 ? '' : 's'} added at ₹${amount}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const amount = Number(bulkAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Set override amount first');
      e.target.value = '';
      return;
    }
    const name = file.name.toLowerCase();

    if (name.endsWith('.csv') || name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = String(ev.target?.result || '');
        const phones = text
          .split(/[\n\r,;|\t]+/)
          .map((p) => p.replace(/\D/g, '').slice(-10))
          .filter((p) => p.length === 10);
        const unique = [...new Set(phones)];
        if (!unique.length) {
          toast.error('No phone numbers found in file');
          return;
        }
        mergePhones(unique, amount);
        toast.success(`${unique.length} phone${unique.length === 1 ? '' : 's'} loaded from ${file.name}`);
      };
      reader.readAsText(file);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const XLSX = await import('xlsx');
          const wb = XLSX.read(ev.target?.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const sheetRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
          const phones: string[] = [];
          for (const row of sheetRows) {
            for (const cell of row || []) {
              const val = String(cell || '').replace(/\D/g, '').slice(-10);
              if (val.length === 10) phones.push(val);
            }
          }
          const unique = [...new Set(phones)];
          if (!unique.length) {
            toast.error('No phone numbers found in file');
            return;
          }
          mergePhones(unique, amount);
          toast.success(`${unique.length} phone${unique.length === 1 ? '' : 's'} loaded from ${file.name}`);
        } catch {
          toast.error('Could not read Excel file. Try CSV instead.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error('Unsupported file type. Use .csv, .xlsx, .xls or .txt');
    }
    e.target.value = '';
  };

  const handleSheetFetch = async () => {
    const url = sheetUrl.trim();
    if (!url) return;
    const amount = Number(bulkAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Set override amount first');
      return;
    }
    setSheetLoading(true);
    try {
      const res = await fetch('/api/super_admin/notifications/import-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Failed to fetch sheet');
        return;
      }
      const phones: string[] = Array.isArray(data.phones) ? data.phones : [];
      const unique = [
        ...new Set(phones.map((p) => String(p).replace(/\D/g, '').slice(-10)).filter((p) => p.length === 10)),
      ];
      if (!unique.length) {
        toast.error('No phone numbers found in sheet');
        return;
      }
      mergePhones(unique, amount);
      toast.success(`${unique.length} phone${unique.length === 1 ? '' : 's'} imported from Google Sheet`);
      setSheetUrl('');
    } catch {
      toast.error('Failed to fetch Google Sheet');
    } finally {
      setSheetLoading(false);
    }
  };

  const modes: Array<{ id: WelcomeOverrideInputMode; label: string }> = [
    { id: 'paste', label: 'Paste numbers' },
    { id: 'csv', label: 'Upload CSV' },
    { id: 'sheet', label: 'Google Sheet' },
  ];

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div>
        <p className="text-sm text-gray-600">
          Default welcome bonus <strong>₹{Math.round(defaultAmount).toLocaleString('en-IN')}</strong> rehta hai.
          Neeche listed phones ko alag amount milega (jaise ₹1500) — baaki sabko default.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block text-xs font-semibold text-gray-600 sm:w-40">
          Override amount (₹)
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal"
            value={bulkAmount}
            onChange={(e) => setBulkAmount(e.target.value)}
            disabled={disabled}
          />
        </label>
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
          {modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setInputMode(mode.id)}
              disabled={disabled}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                inputMode === mode.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {inputMode === 'paste' ? (
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <textarea
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono"
            rows={3}
            placeholder={'9876543210\n9123456789'}
            value={bulkPhones}
            onChange={(e) => setBulkPhones(e.target.value)}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={addBulk}
            disabled={disabled}
            className="inline-flex h-fit items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add phones
          </button>
        </div>
      ) : null}

      {inputMode === 'csv' ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-5">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-blue-400 hover:text-blue-700">
            <Upload className="h-4 w-4" />
            Choose CSV / Excel
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={handleFileUpload}
              disabled={disabled}
            />
          </label>
          <p className="mt-2 text-xs text-gray-500">
            File se phones nikal kar upar wale amount (₹{bulkAmount || '…'}) pe merge honge.
          </p>
        </div>
      ) : null}

      {inputMode === 'sheet' ? (
        <div className="space-y-2">
          <div className="relative">
            <input
              type="url"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/... (public sheet URL)"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 pr-24 text-sm"
              disabled={disabled}
            />
            <button
              type="button"
              disabled={disabled || !sheetUrl.trim() || sheetLoading}
              onClick={() => void handleSheetFetch()}
              className="absolute right-1.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              {sheetLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5" />
              )}
              Fetch
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Sheet Anyone with the link → Viewer hona chahiye. Phones amount ₹{bulkAmount || '…'} pe add honge.
          </p>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <div className="grid grid-cols-[1fr_120px_40px] gap-2 bg-gray-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">
            <span>Phone</span>
            <span>Amount</span>
            <span />
          </div>
          <div className="divide-y">
            {rows.map((row, index) => (
              <div key={`${row.phone}-${index}`} className="grid grid-cols-[1fr_120px_40px] items-center gap-2 px-3 py-2">
                <input
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-mono"
                  value={row.phone}
                  onChange={(e) =>
                    updateRow(index, { phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
                  }
                  disabled={disabled}
                />
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  value={row.amount}
                  onChange={(e) => updateRow(index, { amount: Number(e.target.value) })}
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50"
                  title="Remove"
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500">No phone overrides yet — sabko default welcome amount milega.</p>
      )}

      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold text-emerald-700">
            {rows.length} phone{rows.length === 1 ? '' : 's'} with custom welcome amount
          </p>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={disabled}
            className="text-xs font-semibold text-rose-600 hover:underline"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}

type CouponOption = {
  id: string;
  code: string;
  title?: string | null;
  description?: string | null;
  discount_type?: string | null;
  discount_value?: number | null;
  is_active?: boolean;
};

function WelcomeOverrideUsageSection({
  usage,
  disabled,
  onChange,
}: {
  usage: WelcomeBonusOverrideUsageRules;
  disabled?: boolean;
  onChange: (next: WelcomeBonusOverrideUsageRules) => void;
}) {
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);
  const [pickId, setPickId] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/super_admin/wallet-logic/service-types', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const list = (json.services || []).map((s: any) => ({
          id: String(s.id),
          name: String(s.name || 'Service'),
        }));
        setServices(list);
      } catch {
        if (!cancelled) setServices([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rules = usage.service_type_rules || [];
  const used = new Set(rules.map((r) => r.service_type_id));
  const available = services.filter((s) => !used.has(s.id));

  const patch = (partial: Partial<WelcomeBonusOverrideUsageRules>) => {
    onChange(parseWelcomeBonusOverrideUsage({ ...usage, ...partial }));
  };

  const addServiceRule = () => {
    const svc = available.find((s) => s.id === pickId) || available[0];
    if (!svc) {
      toast.error('Pehle service select karo');
      return;
    }
    const next: WelcomeOverrideServiceUsageRule = {
      id: svc.id,
      service_type_id: svc.id,
      service_name: svc.name,
      active: true,
      usage_mode: usage.service_usage_mode || 'AMOUNT',
      usage_percent: usage.service_usage_percent || 10,
      usage_amount: usage.service_usage_amount || 500,
    };
    patch({ service_type_rules: [...rules, next] });
    setPickId('');
  };

  const updateRule = (index: number, partial: Partial<WelcomeOverrideServiceUsageRule>) => {
    const next = rules.map((row, i) => (i === index ? { ...row, ...partial } : row));
    patch({ service_type_rules: next });
  };

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
        <input
          type="checkbox"
          checked={Boolean(usage.enabled)}
          onChange={(e) => patch({ enabled: e.target.checked })}
          disabled={disabled}
        />
        Special welcome users ke liye alag wallet usage rules ON
      </label>
      <p className="text-sm text-gray-600">
        Phone override list wale users (jaise ₹1500) booking pe kitna wallet use kar sakte hain —{' '}
        <strong>%</strong> ya <strong>fixed ₹</strong> (jaise ₹500). Neeche specific services
        (Periodic / Basic / General) ke alag limits bhi set kar sakte ho.
      </p>

      {usage.enabled ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <UsageLimitField
              label="Default service booking"
              mode={usage.service_usage_mode}
              percent={usage.service_usage_percent}
              amount={usage.service_usage_amount}
              onModeChange={(m) => patch({ service_usage_mode: m })}
              onPercentChange={(v) => patch({ service_usage_percent: Number(v) || 0 })}
              onAmountChange={(v) => patch({ service_usage_amount: Number(v) || 0 })}
              disabled={disabled}
            />
            <UsageLimitField
              label="Membership purchase"
              mode={usage.membership_usage_mode}
              percent={usage.membership_usage_percent}
              amount={usage.membership_usage_amount}
              onModeChange={(m) => patch({ membership_usage_mode: m })}
              onPercentChange={(v) => patch({ membership_usage_percent: Number(v) || 0 })}
              onAmountChange={(v) => patch({ membership_usage_amount: Number(v) || 0 })}
              disabled={disabled}
            />
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <label className="block min-w-[220px] flex-1 text-xs font-semibold text-gray-600">
                Per-service rule (Periodic / Basic / General…)
                <select
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={pickId}
                  onChange={(e) => setPickId(e.target.value)}
                  disabled={disabled || !available.length}
                >
                  <option value="">Select service…</option>
                  {available.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={addServiceRule}
                disabled={disabled || !available.length}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Add service rule
              </button>
            </div>

            {rules.length === 0 ? (
              <p className="text-xs text-gray-500">
                Abhi koi per-service rule nahi — default upar wala sab services pe lagega.
              </p>
            ) : (
              <div className="space-y-3">
                {rules.map((row, index) => (
                  <div
                    key={row.id || row.service_type_id}
                    className="rounded-xl border border-gray-200 bg-white p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-gray-900">{row.service_name}</p>
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-600 hover:underline"
                        onClick={() =>
                          patch({ service_type_rules: rules.filter((_, i) => i !== index) })
                        }
                      >
                        Remove
                      </button>
                    </div>
                    <UsageLimitField
                      label="Wallet use on this service"
                      mode={row.usage_mode}
                      percent={row.usage_percent}
                      amount={row.usage_amount}
                      onModeChange={(m) => updateRule(index, { usage_mode: m })}
                      onPercentChange={(v) => updateRule(index, { usage_percent: Number(v) || 0 })}
                      onAmountChange={(v) => updateRule(index, { usage_amount: Number(v) || 0 })}
                      disabled={disabled}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-500">
          OFF hone pe normal Wallet Logic rules lagenge (sab users jaisi).
        </p>
      )}
    </div>
  );
}

function WelcomeBonusAutoCouponSection({
  couponId,
  disabled,
  onChange,
}: {
  couponId: string | null;
  disabled?: boolean;
  onChange: (next: string | null) => void;
}) {
  const [coupons, setCoupons] = useState<CouponOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/coupons', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Failed to load coupons');
        const list = (Array.isArray(json.coupons) ? json.coupons : Array.isArray(json) ? json : []) as CouponOption[];
        if (!cancelled) {
          setCoupons(
            list
              .filter((c) => c?.id && c.is_active !== false)
              .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''))),
          );
        }
      } catch {
        if (!cancelled) setCoupons([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = coupons.find((c) => c.id === couponId) || null;

  return (
    <div className={`space-y-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <p className="text-sm text-gray-600">
        Override list wale phones ko login / welcome pe ye coupon <strong>auto</strong> My Coupons me mil jayega.
        Default: <strong>WELCOME_CI1000</strong> (Car Inspection ₹1000, private — sab users ko list me nahi dikhega).
      </p>
      <label className="block text-xs font-semibold text-gray-600">
        Auto coupon for override phones
        <select
          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-900"
          value={couponId || ''}
          disabled={disabled || loading}
          onChange={(e) => onChange(e.target.value.trim() || null)}
        >
          <option value="">{loading ? 'Loading coupons…' : '— None (amount override only) —'}</option>
          {coupons.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
              {c.title ? ` · ${c.title}` : ''}
              {c.discount_value != null
                ? ` · ${c.discount_type === 'PERCENT' ? `${c.discount_value}%` : `₹${c.discount_value}`}`
                : ''}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <p className="text-xs text-emerald-700">
          Selected: <span className="font-semibold">{selected.code}</span>
          {selected.title ? ` — ${selected.title}` : ''}. Save ke baad listed phones ko assign / pending ho jayega.
        </p>
      ) : (
        <p className="text-xs text-gray-500">Coupon select nahi hai — sirf special wallet amount chalega.</p>
      )}
    </div>
  );
}

function PerSourceLimitsSection({
  settings,
  onToggle,
  onPatchSourceLimit,
}: {
  settings: WalletLogicFullSettings;
  onToggle: (enabled: boolean) => void;
  onPatchSourceLimit: (group: WalletSourceGroup, field: 'service_percent' | 'membership_percent', value: string) => void;
}) {
  const SOURCE_ICONS: Record<WalletSourceGroup, { accent: string; icon: React.ReactNode }> = {
    welcome_bonus: { accent: 'bg-emerald-100 text-emerald-700', icon: <Gift className="h-4 w-4" /> },
    referral: { accent: 'bg-blue-100 text-blue-700', icon: <Users className="h-4 w-4" /> },
    membership_cashback: { accent: 'bg-violet-100 text-violet-700', icon: <Crown className="h-4 w-4" /> },
    admin_credit: { accent: 'bg-sky-100 text-sky-700', icon: <BadgeCheck className="h-4 w-4" /> },
  };

  return (
    <div className="space-y-4">
      <Toggle
        label="Enable per-source wallet limits"
        hint="On = har source ka alag usage % hoga. Off = global % poore balance pe lagta hai (current behavior)"
        checked={settings.per_source_limits_enabled}
        onChange={onToggle}
      />

      {settings.per_source_limits_enabled ? (
        <>
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800">Per-source limits additive hain</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Har source independently apna cap lagata hai. Agar welcome 10% aur referral 20% hai, toh ₹5,000 booking pe welcome se max ₹500 + referral se max ₹1,000 = total ₹1,500 kat sakta hai (agar balance ho).
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left font-bold text-gray-700">Source</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-700">Service Booking %</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-700">Membership %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {WALLET_SOURCE_GROUPS.map((group) => {
                  const meta = SOURCE_ICONS[group];
                  const limits = settings.source_limits[group];
                  return (
                    <tr key={group} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${meta.accent}`}>
                            {meta.icon}
                          </div>
                          <span className="font-semibold text-gray-900">{WALLET_SOURCE_LABELS[group]}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={limits.service_percent}
                            onChange={(e) => onPatchSourceLimit(group, 'service_percent', e.target.value)}
                            className="w-20 rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm font-bold"
                          />
                          <span className="text-xs font-bold text-gray-400">%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={limits.membership_percent}
                            onChange={(e) => onPatchSourceLimit(group, 'membership_percent', e.target.value)}
                            className="w-20 rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm font-bold"
                          />
                          <span className="text-xs font-bold text-gray-400">%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Live example */}
          <div className="rounded-2xl bg-gradient-to-b from-violet-50 to-white border border-violet-200 p-4">
            <p className="text-xs font-bold text-violet-800 mb-3">Example: ₹1,000 Welcome + ₹500 Referral = ₹1,500 balance → ₹5,000 service booking</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(() => {
                const exampleBooking = 5000;
                const welcomeBal = 1000;
                const referralBal = 500;
                const wCap = Math.round(exampleBooking * (settings.source_limits.welcome_bonus.service_percent / 100));
                const rCap = Math.round(exampleBooking * (settings.source_limits.referral.service_percent / 100));
                const wDed = Math.min(welcomeBal, wCap);
                const rDed = Math.min(referralBal, rCap);
                const total = wDed + rDed;
                return [
                  { label: 'Welcome', bal: welcomeBal, pct: settings.source_limits.welcome_bonus.service_percent, cap: wCap, ded: wDed, accent: 'text-emerald-700' },
                  { label: 'Referral', bal: referralBal, pct: settings.source_limits.referral.service_percent, cap: rCap, ded: rDed, accent: 'text-blue-700' },
                ].map((row) => (
                  <div key={row.label} className="rounded-xl bg-white border border-violet-100 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${row.accent}`}>{row.label} (₹{row.bal.toLocaleString('en-IN')})</span>
                      <span className="text-xs text-gray-400">{row.pct}% = cap {inr(row.cap)}</span>
                    </div>
                    <p className="text-lg font-black text-gray-900 mt-1">
                      {inr(row.ded)}
                      {row.ded === row.bal ? <span className="text-[10px] text-gray-400 ml-1">(balance limit)</span> : null}
                      {row.ded === row.cap && row.ded < row.bal ? <span className="text-[10px] text-gray-400 ml-1">(cap limit)</span> : null}
                    </p>
                  </div>
                )).concat(
                  <div key="total" className="sm:col-span-2 rounded-xl bg-violet-100 border border-violet-200 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-violet-800">Total Wallet Deduction</span>
                      <span className="text-xs text-violet-600">Customer pays {inr(exampleBooking - total)}</span>
                    </div>
                    <p className="text-xl font-black text-violet-900 mt-1">{inr(total)}</p>
                  </div>,
                );
              })()}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
          Currently using global cap: <strong>{formatUsageLimitLabel(settings.global, 'SERVICE')}</strong> for service,{' '}
          <strong>{formatUsageLimitLabel(settings.global, 'MEMBERSHIP')}</strong> for membership — applied to <em>total</em> balance regardless of source.
        </div>
      )}
    </div>
  );
}

function SourceCombinationRulesSection({
  settings,
  onToggle,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
}: {
  settings: WalletLogicFullSettings;
  onToggle: (enabled: boolean) => void;
  onAddRule: () => void;
  onUpdateRule: (id: string, patch: Partial<WalletSourceCombinationRule>) => void;
  onRemoveRule: (id: string) => void;
}) {
  const rules = settings.source_combination_rules || [];

  const toggleSourceInRule = (ruleId: string, source: WalletSourceGroup) => {
    const rule = rules.find((row) => row.id === ruleId);
    if (!rule) return;
    const has = rule.sources.includes(source);
    const nextSources = has
      ? rule.sources.filter((s) => s !== source)
      : [...rule.sources, source];
    onUpdateRule(ruleId, { sources: nextSources });
  };

  return (
    <div className="space-y-4">
      <Toggle
        label="Enable combined source groups"
        hint="On = selected sources share ek hi usage cap (e.g. Welcome + Referral @ 15%). Off = per-source ya global rules apply honge"
        checked={settings.source_combination_enabled}
        onChange={onToggle}
      />

      {settings.source_combination_enabled ? (
        <>
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-indigo-800">Combined cap = order amount × group %</p>
                <p className="text-[11px] text-indigo-700 mt-0.5">
                  Example: ₹1,000 welcome + ₹500 referral, group cap 15% → ₹10,000 booking pe max ₹1,500; ₹5,000 pe max ₹750.
                  Group balance se zyada nahi kat sakta.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-[200px] space-y-2">
                    <input
                      type="text"
                      value={rule.label}
                      onChange={(e) => onUpdateRule(rule.id, { label: e.target.value })}
                      placeholder="Group name (e.g. Welcome + Referral)"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold"
                    />
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={rule.active}
                        onChange={(e) => onUpdateRule(rule.id, { active: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      Active
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveRule(rule.id)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>

                <div className="mb-3">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Sources in this group</p>
                  <div className="flex flex-wrap gap-2">
                    {WALLET_SOURCE_GROUPS.map((source) => {
                      const selected = rule.sources.includes(source);
                      return (
                        <button
                          key={source}
                          type="button"
                          onClick={() => toggleSourceInRule(rule.id, source)}
                          className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${
                            selected
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-200'
                          }`}
                        >
                          {WALLET_SOURCE_LABELS[source]}
                        </button>
                      );
                    })}
                  </div>
                  {rule.sources.length < 2 ? (
                    <p className="text-[11px] text-amber-600 mt-2">Pick at least 2 sources</p>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Service booking %</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={rule.service_percent}
                        onChange={(e) =>
                          onUpdateRule(rule.id, {
                            service_percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          })
                        }
                        className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-center text-sm font-bold"
                      />
                      <span className="text-xs font-bold text-gray-400">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Membership %</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={rule.membership_percent}
                        onChange={(e) =>
                          onUpdateRule(rule.id, {
                            membership_percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          })
                        }
                        className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-center text-sm font-bold"
                      />
                      <span className="text-xs font-bold text-gray-400">%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onAddRule}
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50"
          >
            <Plus className="h-4 w-4" />
            Add combination group
          </button>

          {(() => {
            const exampleRule = rules.find((row) => row.active && row.sources.includes('welcome_bonus') && row.sources.includes('referral'))
              || rules.find((row) => row.active)
              || rules[0];
            if (!exampleRule || exampleRule.sources.length < 2) return null;
            const exampleBooking = 10000;
            const welcomeBal = 1000;
            const referralBal = 500;
            const groupBal = exampleRule.sources.reduce((sum, source) => {
              if (source === 'welcome_bonus') return sum + welcomeBal;
              if (source === 'referral') return sum + referralBal;
              return sum + 500;
            }, 0);
            const cap = Math.round(exampleBooking * (exampleRule.service_percent / 100));
            const ded = Math.min(groupBal, cap);
            return (
              <div className="rounded-2xl bg-gradient-to-b from-indigo-50 to-white border border-indigo-200 p-4">
                <p className="text-xs font-bold text-indigo-800 mb-2">
                  Example: {exampleRule.label} — balance ₹{groupBal.toLocaleString('en-IN')} → ₹{exampleBooking.toLocaleString('en-IN')} booking
                </p>
                <p className="text-lg font-black text-indigo-900">
                  Max wallet: {inr(ded)}
                  <span className="text-xs font-normal text-indigo-600 ml-2">
                    ({exampleRule.service_percent}% = {inr(cap)} cap{ded < groupBal ? ', cap applies' : ', balance applies'})
                  </span>
                </p>
              </div>
            );
          })()}
        </>
      ) : (
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
          Combined groups off. Use per-source limits (additive) ya global cap on total balance.
        </div>
      )}
    </div>
  );
}

function WalletUsageSimulator({
  settings,
  effectiveRules,
}: {
  settings: WalletLogicFullSettings;
  effectiveRules: WalletCoreRules;
}) {
  const [simBalance, setSimBalance] = useState(1500);
  const [simBooking, setSimBooking] = useState(5000);
  const [simCoupon, setSimCoupon] = useState(0);
  const [simChannel, setSimChannel] = useState<'SERVICE' | 'MEMBERSHIP'>('SERVICE');
  const [simWelcome, setSimWelcome] = useState(1000);
  const [simReferral, setSimReferral] = useState(500);
  const [simCashback, setSimCashback] = useState(0);
  const [simAdmin, setSimAdmin] = useState(0);

  const perSourceTotal = simWelcome + simReferral + simCashback + simAdmin;
  const effectiveBalance = settings.per_source_limits_enabled ? perSourceTotal : simBalance;

  const result = useMemo(() => {
    const payableBeforeWallet = Math.max(0, simBooking - simCoupon);
    const bal = settings.per_source_limits_enabled ? perSourceTotal : simBalance;

    if (settings.per_source_limits_enabled) {
      const isMembership = simChannel === 'MEMBERSHIP';
      const sources = [
        { group: 'welcome_bonus' as const, balance: simWelcome },
        { group: 'referral' as const, balance: simReferral },
        { group: 'membership_cashback' as const, balance: simCashback },
        { group: 'admin_credit' as const, balance: simAdmin },
      ];
      let totalDeduction = 0;
      const breakdown: Array<{ group: string; balance: number; pct: number; cap: number; deduction: number }> = [];

      for (const { group, balance } of sources) {
        if (balance <= 0) continue;
        const pct = isMembership ? settings.source_limits[group].membership_percent : settings.source_limits[group].service_percent;
        const cap = Math.round(payableBeforeWallet * (pct / 100));
        const ded = Math.round(Math.min(balance, cap));
        totalDeduction += ded;
        breakdown.push({ group, balance, pct, cap, deduction: ded });
      }

      if (settings.min_payable_for_wallet > 0 && payableBeforeWallet < settings.min_payable_for_wallet) {
        totalDeduction = 0;
      }
      if (settings.max_absolute_deduction > 0) {
        totalDeduction = Math.min(totalDeduction, settings.max_absolute_deduction);
      }
      totalDeduction = Math.min(totalDeduction, bal);
      const finalAmount = Math.max(0, payableBeforeWallet - totalDeduction);

      return {
        payableBeforeWallet, maxFromOrder: 0, deduction: totalDeduction, finalAmount,
        capLabel: 'per-source', limitingFactor: '', breakdown,
      };
    }

    const maxFromOrder = Math.round(computeUsageCapFromRules(payableBeforeWallet, simChannel, effectiveRules));
    let deduction = Math.min(bal, maxFromOrder);
    if (settings.min_payable_for_wallet > 0 && payableBeforeWallet < settings.min_payable_for_wallet) {
      deduction = 0;
    }
    if (settings.max_absolute_deduction > 0) {
      deduction = Math.min(deduction, settings.max_absolute_deduction);
    }
    deduction = Math.round(deduction);
    const finalAmount = Math.max(0, payableBeforeWallet - deduction);
    const capPercent = simChannel === 'SERVICE' ? effectiveRules.service_usage_percent : effectiveRules.membership_usage_percent;
    const capMode = simChannel === 'SERVICE' ? effectiveRules.service_usage_mode : effectiveRules.membership_usage_mode;
    const capLabel = capMode === 'AMOUNT'
      ? `₹${(simChannel === 'SERVICE' ? effectiveRules.service_usage_amount : effectiveRules.membership_usage_amount).toLocaleString('en-IN')}`
      : `${capPercent}%`;
    const limitingFactor =
      deduction === 0 && payableBeforeWallet > 0 && bal > 0
        ? settings.min_payable_for_wallet > 0 && payableBeforeWallet < settings.min_payable_for_wallet
          ? 'Min payable not met'
          : 'No wallet available'
        : deduction === bal
          ? 'Limited by wallet balance'
          : settings.max_absolute_deduction > 0 && deduction === settings.max_absolute_deduction
            ? 'Limited by absolute cap'
            : deduction === maxFromOrder
              ? `Limited by ${capLabel} cap`
              : '';
    return { payableBeforeWallet, maxFromOrder, deduction, finalAmount, capLabel, limitingFactor, breakdown: [] as Array<{ group: string; balance: number; pct: number; cap: number; deduction: number }> };
  }, [simBalance, simBooking, simCoupon, simChannel, settings, effectiveRules, perSourceTotal, simWelcome, simReferral, simCashback, simAdmin]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {settings.per_source_limits_enabled ? (
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-800 mb-2">Balance by Source (total: {inr(perSourceTotal)})</label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {([
                { label: 'Welcome', value: simWelcome, set: setSimWelcome, accent: 'border-emerald-200 bg-emerald-50/50' },
                { label: 'Referral', value: simReferral, set: setSimReferral, accent: 'border-blue-200 bg-blue-50/50' },
                { label: 'Cashback', value: simCashback, set: setSimCashback, accent: 'border-violet-200 bg-violet-50/50' },
                { label: 'Admin', value: simAdmin, set: setSimAdmin, accent: 'border-sky-200 bg-sky-50/50' },
              ] as const).map((src) => (
                <div key={src.label} className={`rounded-xl border p-2.5 ${src.accent}`}>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1">{src.label}</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      type="number"
                      value={src.value}
                      onChange={(e) => src.set(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded-lg border border-gray-200 bg-white pl-7 pr-2 py-1.5 text-sm font-semibold"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Wallet Balance</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="number"
                value={simBalance}
                onChange={(e) => setSimBalance(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm font-semibold"
              />
            </div>
            <div className="flex gap-1.5 mt-2">
              {[500, 1000, 1500, 2000, 5000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSimBalance(v)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${simBalance === v ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  ₹{v.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">Booking Amount</label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="number"
              value={simBooking}
              onChange={(e) => setSimBooking(Math.max(0, Number(e.target.value) || 0))}
              className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm font-semibold"
            />
          </div>
          <div className="flex gap-1.5 mt-2">
            {[2000, 5000, 10000, 15000, 20000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSimBooking(v)}
                className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${simBooking === v ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                ₹{v.toLocaleString('en-IN')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">Coupon Discount</label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="number"
              value={simCoupon}
              onChange={(e) => setSimCoupon(Math.max(0, Number(e.target.value) || 0))}
              className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm font-semibold"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">Checkout Type</label>
          <div className="flex gap-2">
            {([['SERVICE', 'Service Booking'], ['MEMBERSHIP', 'Membership']] as const).map(([ch, label]) => (
              <button
                key={ch}
                type="button"
                onClick={() => setSimChannel(ch)}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                  simChannel === ch
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-violet-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Flow visualization */}
      <div className="rounded-2xl bg-gradient-to-b from-gray-50 to-white border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <ArrowDown className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-bold text-gray-900">Deduction Flow</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-white border border-gray-100 px-4 py-2.5">
            <span className="text-sm text-gray-600">Booking Subtotal</span>
            <span className="text-sm font-black text-gray-900">{inr(simBooking)}</span>
          </div>
          {simCoupon > 0 ? (
            <div className="flex items-center justify-between rounded-xl bg-orange-50 border border-orange-100 px-4 py-2.5">
              <span className="text-sm text-orange-700">− Coupon Discount</span>
              <span className="text-sm font-black text-orange-700">−{inr(simCoupon)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-100 px-4 py-2.5">
            <span className="text-sm text-blue-700">= Payable Before Wallet</span>
            <span className="text-sm font-black text-blue-900">{inr(result.payableBeforeWallet)}</span>
          </div>
          {result.breakdown.length > 0 ? (
            <div className="space-y-1.5 rounded-xl bg-violet-50 border border-violet-200 px-4 py-2.5">
              <span className="text-sm text-violet-700 font-semibold">− Wallet Deduction (per-source)</span>
              {result.breakdown.map((b) => (
                <div key={b.group} className="flex items-center justify-between text-xs rounded-lg bg-white/70 px-3 py-1.5">
                  <span className="text-gray-600 capitalize">{b.group.replace(/_/g, ' ')} ({inr(b.balance)}) @ {b.pct}%</span>
                  <span className="font-bold text-violet-700">−{inr(b.deduction)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1 border-t border-violet-200">
                <span className="text-sm text-violet-700">Total wallet</span>
                <span className="text-sm font-black text-violet-800">−{inr(result.deduction)}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl bg-violet-50 border border-violet-200 px-4 py-2.5">
              <div>
                <span className="text-sm text-violet-700">− Wallet Deduction</span>
                <span className="text-[11px] text-violet-500 ml-2">
                  (max {result.capLabel} of {inr(result.payableBeforeWallet)} = {inr(result.maxFromOrder)})
                </span>
              </div>
              <span className="text-sm font-black text-violet-800">−{inr(result.deduction)}</span>
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
            <span className="text-sm font-bold text-emerald-800">= Customer Pays</span>
            <span className="text-lg font-black text-emerald-900">{inr(result.finalAmount)}</span>
          </div>
        </div>
        {result.limitingFactor ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
            <Info className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span className="text-xs font-semibold text-amber-700">{result.limitingFactor}</span>
          </div>
        ) : null}
      </div>

      {/* Quick scenario table */}
      <div>
        <p className="text-sm font-bold text-gray-900 mb-3">
          Quick Scenarios — {settings.per_source_limits_enabled ? `${inr(perSourceTotal)} total (per-source)` : `₹${simBalance.toLocaleString('en-IN')} balance`}, {simChannel === 'SERVICE' ? 'Service' : 'Membership'}
        </p>
        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2.5 font-bold text-gray-700">Booking ₹</th>
                <th className="px-4 py-2.5 font-bold text-gray-700">Max Wallet</th>
                <th className="px-4 py-2.5 font-bold text-gray-700">Deducted</th>
                <th className="px-4 py-2.5 font-bold text-gray-700">Pays</th>
                <th className="px-4 py-2.5 font-bold text-gray-700">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000].map((amt) => {
                let ded = 0;
                let cap = 0;
                const bal = settings.per_source_limits_enabled ? perSourceTotal : simBalance;

                if (settings.per_source_limits_enabled) {
                  const isMem = simChannel === 'MEMBERSHIP';
                  const srcBalances = [
                    { group: 'welcome_bonus' as const, balance: simWelcome },
                    { group: 'referral' as const, balance: simReferral },
                    { group: 'membership_cashback' as const, balance: simCashback },
                    { group: 'admin_credit' as const, balance: simAdmin },
                  ];
                  for (const { group, balance } of srcBalances) {
                    if (balance <= 0) continue;
                    const pct = isMem ? settings.source_limits[group].membership_percent : settings.source_limits[group].service_percent;
                    const srcCap = Math.round(amt * (pct / 100));
                    cap += srcCap;
                    ded += Math.min(balance, srcCap);
                  }
                } else {
                  cap = Math.round(computeUsageCapFromRules(amt, simChannel, effectiveRules));
                  ded = Math.min(bal, cap);
                }

                if (settings.max_absolute_deduction > 0) {
                  cap = Math.min(cap, settings.max_absolute_deduction);
                  ded = Math.min(ded, settings.max_absolute_deduction);
                }
                if (settings.min_payable_for_wallet > 0 && amt < settings.min_payable_for_wallet) ded = 0;
                ded = Math.round(ded);
                cap = Math.round(cap);

                const reason =
                  ded === 0 ? '—'
                    : ded === bal ? 'Balance limit'
                    : settings.max_absolute_deduction > 0 && ded === settings.max_absolute_deduction ? 'Abs. cap'
                    : 'Cap limit';
                return (
                  <tr key={amt} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2 font-semibold text-gray-900">{inr(amt)}</td>
                    <td className="px-4 py-2 text-violet-700 font-semibold">{inr(cap)}</td>
                    <td className="px-4 py-2 font-black text-violet-800">{inr(ded)}</td>
                    <td className="px-4 py-2 font-bold text-emerald-700">{inr(amt - ded)}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function WalletFundingSources({ settings }: { settings: WalletLogicFullSettings }) {
  const welcomeEnabled = settings.global.welcome_bonus_enabled !== false;

  const sources = [
    {
      icon: <Gift className="h-5 w-5" />,
      accent: 'bg-emerald-100 text-emerald-700',
      title: 'Welcome Bonus',
      who: 'Naye user ko signup pe',
      amount: welcomeEnabled ? inr(settings.global.welcome_bonus_amount) : 'Off',
      expiry: welcomeEnabled ? `${settings.global.welcome_expiry_days} din` : '—',
      autoExpire: true,
      active: welcomeEnabled,
    },
    {
      icon: <Users className="h-5 w-5" />,
      accent: 'bg-blue-100 text-blue-700',
      title: 'Referral Friend Bonus',
      who: 'Friend ko jab referral code apply kare',
      amount: inr(settings.referral_friend_bonus),
      expiry: `${settings.referral_expiry_days} din`,
      autoExpire: false,
      active: true,
    },
    {
      icon: <TrendingUp className="h-5 w-5" />,
      accent: 'bg-amber-100 text-amber-700',
      title: 'Referral Reward (1st)',
      who: 'Referrer ko pehli referral pe',
      amount: inr(settings.referral_first_reward),
      expiry: `${settings.referral_expiry_days} din`,
      autoExpire: false,
      active: true,
    },
    {
      icon: <TrendingUp className="h-5 w-5" />,
      accent: 'bg-orange-100 text-orange-700',
      title: 'Referral Reward (Repeat)',
      who: 'Referrer ko har agle referral pe',
      amount: inr(settings.referral_repeat_reward),
      expiry: `${settings.referral_expiry_days} din`,
      autoExpire: false,
      active: true,
    },
    {
      icon: <Crown className="h-5 w-5" />,
      accent: 'bg-violet-100 text-violet-700',
      title: 'Membership Cashback',
      who: 'Prime members ko bill pay hone pe',
      amount: `${settings.global.membership_cashback_rate_percent}% (max ${inr(settings.global.membership_cashback_max)})`,
      expiry: 'No expiry',
      autoExpire: false,
      active: true,
    },
    {
      icon: <BadgeCheck className="h-5 w-5" />,
      accent: 'bg-sky-100 text-sky-700',
      title: 'Admin Credit',
      who: 'Admin manually ya bulk credit',
      amount: 'Custom',
      expiry: 'Optional',
      autoExpire: false,
      active: true,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sources.map((src) => (
        <div
          key={src.title}
          className={`rounded-2xl border bg-white p-4 shadow-sm transition ${!src.active ? 'opacity-50' : ''}`}
        >
          <div className="flex items-start gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${src.accent}`}>
              {src.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">{src.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{src.who}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-lg font-black text-gray-900">{src.amount}</p>
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {src.expiry}
                {src.autoExpire ? <span className="text-emerald-600 font-semibold ml-1">• Auto-expire</span> : null}
              </p>
            </div>
            {!src.active ? (
              <span className="text-[10px] font-bold uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Disabled</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function WalletUsageRulesOverview({ settings, effectiveRules }: { settings: WalletLogicFullSettings; effectiveRules: WalletCoreRules }) {
  const serviceLabel = formatUsageLimitLabel(effectiveRules, 'SERVICE');
  const membershipLabel = formatUsageLimitLabel(effectiveRules, 'MEMBERSHIP');

  const rules = [
    {
      icon: <Car className="h-4 w-4" />,
      label: 'Service Booking',
      cap: serviceLabel,
      mode: effectiveRules.service_usage_mode,
      example: `₹5,000 bill → max ${inr(Math.round(computeUsageCapFromRules(5000, 'SERVICE', effectiveRules)))} wallet`,
    },
    {
      icon: <Crown className="h-4 w-4" />,
      label: 'Membership Purchase',
      cap: membershipLabel,
      mode: effectiveRules.membership_usage_mode,
      example: `₹699 plan → max ${inr(Math.round(computeUsageCapFromRules(699, 'MEMBERSHIP', effectiveRules)))} wallet`,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {rules.map((r) => (
          <div key={r.label} className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">{r.icon}</div>
              <div>
                <p className="text-sm font-bold text-gray-900">{r.label}</p>
                <p className="text-[11px] text-gray-500">Mode: {r.mode}</p>
              </div>
            </div>
            <p className="text-2xl font-black text-violet-800">{r.cap}</p>
            <p className="text-xs text-gray-500 mt-1">{r.example}</p>
          </div>
        ))}
      </div>
      {settings.min_payable_for_wallet > 0 || settings.max_absolute_deduction > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {settings.min_payable_for_wallet > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-bold text-amber-800">Min Payable Required</p>
              <p className="text-sm font-black text-amber-900 mt-1">{inr(settings.min_payable_for_wallet)}</p>
              <p className="text-[11px] text-amber-600">Isse kam bill pe wallet nahi lagega</p>
            </div>
          ) : null}
          {settings.max_absolute_deduction > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-xs font-bold text-red-800">Absolute Cap per Checkout</p>
              <p className="text-sm font-black text-red-900 mt-1">{inr(settings.max_absolute_deduction)}</p>
              <p className="text-[11px] text-red-600">% ke baad bhi ye max limit lagegi</p>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
        <p className="text-xs font-bold text-gray-700 mb-2">Discount Order (sabse pehle se last tak)</p>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {[
            { label: 'Subtotal', color: 'bg-gray-200 text-gray-800' },
            { label: '→', color: '' },
            { label: '− Coupon', color: 'bg-orange-100 text-orange-700' },
            { label: '→', color: '' },
            { label: '− Membership Bundle', color: 'bg-blue-100 text-blue-700' },
            { label: '→', color: '' },
            { label: '− Wallet', color: 'bg-violet-100 text-violet-700' },
            { label: '=', color: '' },
            { label: 'Final Amount', color: 'bg-emerald-100 text-emerald-800' },
          ].map((step, i) =>
            step.color ? (
              <span key={i} className={`rounded-lg px-2 py-1 ${step.color}`}>{step.label}</span>
            ) : (
              <span key={i} className="text-gray-400">{step.label}</span>
            ),
          )}
        </div>
        <p className="text-[11px] text-gray-500 mt-2">Wallet sabse last mein lagta hai — coupon aur membership discount ke baad jo amount bachta hai uspe wallet % lagta hai</p>
      </div>
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
        <div className="flex items-start gap-2">
          <Car className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-sky-800">Vehicle Blocking Rule</p>
            <p className="text-[11px] text-sky-700 mt-0.5">
              Agar vehicle number kisi doosre customer ke account pe registered hai, toh wallet use nahi hoga — ye server enforce karta hai
            </p>
          </div>
        </div>
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

  const patchGlobal = (key: keyof WalletCoreRules, value: string | boolean) => {
    setSettings((prev) => ({
      ...prev,
      global: {
        ...prev.global,
        [key]:
          key === 'welcome_bonus_enabled'
            ? Boolean(value)
            : key === 'service_usage_mode' || key === 'membership_usage_mode'
              ? (value as WalletUsageMode)
              : value === ''
                ? ''
                : Number(value),
      },
    }));
    setDirty(true);
  };

  const patchExtra = (key: keyof Pick<WalletLogicFullSettings, 'referral_first_reward' | 'referral_repeat_reward' | 'referral_friend_bonus' | 'referral_expiry_days' | 'min_payable_for_wallet' | 'max_absolute_deduction'>, value: string) => {
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

  const patchPlatformRules = (key: keyof WalletCoreRules, value: string | boolean) => {
    if (tab === 'global') return;
    setSettings((prev) => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        rules: {
          ...prev[tab].rules,
          [key]:
            key === 'welcome_bonus_enabled'
              ? Boolean(value)
              : key === 'service_usage_mode' || key === 'membership_usage_mode'
                ? (value as WalletUsageMode)
                : value === ''
                  ? ''
                  : Number(value),
        },
      },
    }));
    setDirty(true);
  };

  const togglePerSourceLimits = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, per_source_limits_enabled: enabled }));
    setDirty(true);
  };

  const patchSourceLimit = (group: WalletSourceGroup, field: 'service_percent' | 'membership_percent', value: string) => {
    setSettings((prev) => ({
      ...prev,
      source_limits: {
        ...prev.source_limits,
        [group]: {
          ...prev.source_limits[group],
          [field]: value === '' ? '' : Math.max(0, Math.min(100, Number(value) || 0)),
        },
      },
    }));
    setDirty(true);
  };

  const toggleSourceCombination = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, source_combination_enabled: enabled }));
    setDirty(true);
  };

  const updateCombinationRule = (id: string, patch: Partial<WalletSourceCombinationRule>) => {
    setSettings((prev) => ({
      ...prev,
      source_combination_rules: (prev.source_combination_rules || []).map((rule) =>
        rule.id === id ? { ...rule, ...patch } : rule,
      ),
    }));
    setDirty(true);
  };

  const addCombinationRule = () => {
    setSettings((prev) => ({
      ...prev,
      source_combination_rules: [
        ...(prev.source_combination_rules || []),
        {
          id: `combo-${Date.now()}`,
          label: 'New combination',
          sources: ['welcome_bonus', 'membership_cashback'],
          service_percent: 15,
          membership_percent: 30,
          active: true,
        },
      ],
    }));
    setDirty(true);
  };

  const removeCombinationRule = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      source_combination_rules: (prev.source_combination_rules || []).filter((rule) => rule.id !== id),
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
                value={
                  settings.global.welcome_bonus_enabled !== false
                    ? inr(settings.global.welcome_bonus_amount)
                    : 'Off'
                }
                sub={
                  settings.global.welcome_bonus_enabled !== false
                    ? `${settings.global.welcome_expiry_days} days validity`
                    : 'Welcome bonus disabled'
                }
                accent={
                  settings.global.welcome_bonus_enabled !== false
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-600'
                }
                icon={<Gift className="h-5 w-5" />}
              />
              <StatCard
                label="Referral rewards"
                value={`${inr(settings.referral_friend_bonus)} / ${inr(settings.referral_first_reward)} / ${inr(settings.referral_repeat_reward)}`}
                sub="Friend / 1st Referrer / Repeat"
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
                      <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Gift className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-bold !text-gray-900">Welcome bonus — phone overrides</h2>
                        <p className="text-xs text-gray-500">
                          Selected numbers get a custom amount; everyone else gets the default
                        </p>
                      </div>
                    </div>
                    <WelcomeBonusPhoneOverridesSection
                      overrides={settings.welcome_bonus_phone_overrides || []}
                      defaultAmount={settings.global.welcome_bonus_amount}
                      disabled={settings.global.welcome_bonus_enabled === false}
                      onChange={(next) => {
                        setSettings((prev) => ({ ...prev, welcome_bonus_phone_overrides: next }));
                        setDirty(true);
                      }}
                    />
                    <div className="mt-6 border-t border-gray-100 pt-5">
                      <div className="mb-3 flex items-center gap-2">
                        <BadgeCheck className="h-4 w-4 text-violet-600" />
                        <h3 className="text-sm font-bold text-gray-900">Auto coupon (My Coupons)</h3>
                      </div>
                      <WelcomeBonusAutoCouponSection
                        couponId={settings.welcome_bonus_auto_coupon_id}
                        disabled={settings.global.welcome_bonus_enabled === false}
                        onChange={(next) => {
                          setSettings((prev) => ({ ...prev, welcome_bonus_auto_coupon_id: next }));
                          setDirty(true);
                        }}
                      />
                    </div>
                    <div className="mt-6 border-t border-gray-100 pt-5">
                      <div className="mb-3 flex items-center gap-2">
                        <Percent className="h-4 w-4 text-emerald-600" />
                        <h3 className="text-sm font-bold text-gray-900">
                          Special welcome — wallet usage (₹ / %)
                        </h3>
                      </div>
                      <WelcomeOverrideUsageSection
                        usage={
                          settings.welcome_bonus_override_usage || {
                            ...DEFAULT_WELCOME_OVERRIDE_USAGE,
                            service_type_rules: [],
                          }
                        }
                        disabled={settings.global.welcome_bonus_enabled === false}
                        onChange={(next) => {
                          setSettings((prev) => ({ ...prev, welcome_bonus_override_usage: next }));
                          setDirty(true);
                        }}
                      />
                    </div>
                  </section>

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
                        label="Friend bonus (referee gets)"
                        hint="Jab koi referral code apply kare toh friend ko instant milega"
                        value={settings.referral_friend_bonus}
                        onChange={(v) => patchExtra('referral_friend_bonus', v)}
                      />
                      <MoneyField
                        label="First successful referral (referrer gets)"
                        hint="Referrer ko pehli successful referral par"
                        value={settings.referral_first_reward}
                        onChange={(v) => patchExtra('referral_first_reward', v)}
                      />
                      <MoneyField
                        label="Repeat referral reward (referrer gets)"
                        hint="Har agle successful referral par referrer ko"
                        value={settings.referral_repeat_reward}
                        onChange={(v) => patchExtra('referral_repeat_reward', v)}
                      />
                      <DaysField
                        label="Referral credit expiry"
                        hint="Referral credits kitne din baad expire honge"
                        value={settings.referral_expiry_days}
                        onChange={(v) => patchExtra('referral_expiry_days', v)}
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

                  {/* Per-Source Wallet Limits */}
                  <section className="rounded-3xl border border-teal-200 bg-gradient-to-b from-teal-50/30 to-white p-5 sm:p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-2">
                      <div className="h-10 w-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                        <Layers className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-bold !text-gray-900">Per-Source Wallet Limits</h2>
                        <p className="text-xs text-gray-500">Har source (welcome, referral, cashback, admin) ke liye alag usage % set karo</p>
                      </div>
                    </div>
                    <PerSourceLimitsSection
                      settings={settings}
                      onToggle={togglePerSourceLimits}
                      onPatchSourceLimit={patchSourceLimit}
                    />
                  </section>

                  {/* Combined Source Groups */}
                  <section className="rounded-3xl border border-indigo-200 bg-gradient-to-b from-indigo-50/30 to-white p-5 sm:p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-2">
                      <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                        <Link2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-bold !text-gray-900">Combined Source Groups</h2>
                        <p className="text-xs text-gray-500">Multiple sources ko ek shared cap do — e.g. Welcome + Referral @ 15% of order</p>
                      </div>
                    </div>
                    <SourceCombinationRulesSection
                      settings={settings}
                      onToggle={toggleSourceCombination}
                      onAddRule={addCombinationRule}
                      onUpdateRule={updateCombinationRule}
                      onRemoveRule={removeCombinationRule}
                    />
                  </section>

                  {/* Wallet Logic Explained */}
                  <section className="rounded-3xl border border-indigo-200 bg-gradient-to-b from-indigo-50/50 to-white p-5 sm:p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-2">
                      <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                        <Banknote className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-bold !text-gray-900">Wallet Funding Sources</h2>
                        <p className="text-xs text-gray-500">Wallet mein paisa kahan se aata hai — saare 6 sources</p>
                      </div>
                    </div>
                    <WalletFundingSources settings={settings} />
                  </section>

                  <section className="rounded-3xl border border-violet-200 bg-gradient-to-b from-violet-50/30 to-white p-5 sm:p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-2">
                      <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                        <Percent className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-bold !text-gray-900">Wallet Usage Rules</h2>
                        <p className="text-xs text-gray-500">Wallet balance kaise aur kitna use hota hai checkout pe</p>
                      </div>
                    </div>
                    <WalletUsageRulesOverview settings={settings} effectiveRules={effectiveRules} />
                  </section>

                  <section className="rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50/30 to-white p-5 sm:p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-2">
                      <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Calculator className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-bold !text-gray-900">Wallet Usage Simulator</h2>
                        <p className="text-xs text-gray-500">Balance aur booking amount daal ke dekho — kitna wallet lagega</p>
                      </div>
                    </div>
                    <WalletUsageSimulator settings={settings} effectiveRules={effectiveRules} />
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
