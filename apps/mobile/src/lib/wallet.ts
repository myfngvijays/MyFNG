import { ENV } from '../config/environment';
import { Platform } from 'react-native';

export type WalletUsageMode = 'PERCENT' | 'AMOUNT';

export type WalletServiceOverride = {
  service_type_id: string;
  active: boolean;
  use_global: boolean;
  wallet_allowed: boolean;
  service_usage_mode: WalletUsageMode;
  service_usage_percent: number;
  service_usage_amount: number;
  membership_cashback_rate_percent: number;
  membership_cashback_max: number;
};

export type WalletSourceUsageLimits = {
  welcome_bonus: { service_percent: number; membership_percent: number };
  referral: { service_percent: number; membership_percent: number };
  membership_cashback: { service_percent: number; membership_percent: number };
  admin_credit: { service_percent: number; membership_percent: number };
};

export type WalletRules = {
  wallet_enabled: boolean;
  service_usage_mode: WalletUsageMode;
  service_usage_percent: number;
  service_usage_amount: number;
  membership_usage_mode: WalletUsageMode;
  membership_usage_percent: number;
  membership_usage_amount: number;
  welcome_bonus_amount: number;
  welcome_expiry_days: number;
  membership_cashback_rate_percent: number;
  membership_cashback_max: number;
  referral_first_reward: number;
  referral_repeat_reward: number;
  min_payable_for_wallet: number;
  max_absolute_deduction: number;
  advanced_enabled: boolean;
  service_overrides: WalletServiceOverride[];
  per_source_limits_enabled: boolean;
  source_limits: WalletSourceUsageLimits | null;
};

export type WalletServiceLine = {
  service_type_id: string;
  amount: number;
};

const DEFAULT_WALLET_RULES: WalletRules = {
  wallet_enabled: true,
  service_usage_mode: 'PERCENT',
  service_usage_percent: 10,
  service_usage_amount: 500,
  membership_usage_mode: 'PERCENT',
  membership_usage_percent: 30,
  membership_usage_amount: 210,
  welcome_bonus_amount: 1000,
  welcome_expiry_days: 90,
  membership_cashback_rate_percent: 5,
  membership_cashback_max: 500,
  referral_first_reward: 500,
  referral_repeat_reward: 250,
  min_payable_for_wallet: 0,
  max_absolute_deduction: 0,
  advanced_enabled: false,
  service_overrides: [],
  per_source_limits_enabled: false,
  source_limits: null,
};

let rulesCache: WalletRules = { ...DEFAULT_WALLET_RULES };
let loadPromise: Promise<WalletRules> | null = null;

function inr(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function numOrDefault(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function parseUsageMode(value: unknown, fallback: WalletUsageMode = 'PERCENT'): WalletUsageMode {
  return String(value || '').toUpperCase() === 'AMOUNT' ? 'AMOUNT' : fallback;
}

export function getWalletRules(): WalletRules {
  return rulesCache;
}

export function formatWalletUsageLimit(
  channel: 'SERVICE' | 'MEMBERSHIP',
  rules: WalletRules = rulesCache,
): string {
  const isMembership = channel === 'MEMBERSHIP';
  const mode = isMembership ? rules.membership_usage_mode : rules.service_usage_mode;
  if (mode === 'AMOUNT') {
    const amt = isMembership ? rules.membership_usage_amount : rules.service_usage_amount;
    return inr(amt);
  }
  const pct = isMembership ? rules.membership_usage_percent : rules.service_usage_percent;
  return `${pct}%`;
}

export function computeWalletUsageCap(
  payableAmount: number,
  channel: 'SERVICE' | 'MEMBERSHIP',
  rules: Pick<
    WalletRules,
    | 'service_usage_mode'
    | 'service_usage_percent'
    | 'service_usage_amount'
    | 'membership_usage_mode'
    | 'membership_usage_percent'
    | 'membership_usage_amount'
  >,
): number {
  if (payableAmount <= 0) return 0;
  const isMembership = channel === 'MEMBERSHIP';
  const mode = isMembership ? rules.membership_usage_mode : rules.service_usage_mode;
  if (mode === 'AMOUNT') {
    const fixed = isMembership ? rules.membership_usage_amount : rules.service_usage_amount;
    return Math.min(Math.max(0, fixed), payableAmount);
  }
  const pct = isMembership ? rules.membership_usage_percent : rules.service_usage_percent;
  return Math.min(payableAmount, payableAmount * (pct / 100));
}

export function getWalletServicePercent() {
  if (rulesCache.service_usage_mode === 'AMOUNT') return 0;
  return rulesCache.service_usage_percent / 100;
}

export function getWalletMembershipPercent() {
  if (rulesCache.membership_usage_mode === 'AMOUNT') return 0;
  return rulesCache.membership_usage_percent / 100;
}

/** @deprecated Use getWalletServicePercent() — kept for older imports */
export const WALLET_SERVICE_PERCENT = 0.1;
/** @deprecated Use getWalletMembershipPercent() — kept for older imports */
export const WALLET_MEMBERSHIP_PERCENT = 0.3;

export function buildWalletTerms(rules: WalletRules = rulesCache): string[] {
  return [
    `${inr(rules.welcome_bonus_amount)} Welcome Bonus on first app login.`,
    `Valid for ${rules.welcome_expiry_days} days - unused welcome bonus expires automatically.`,
    `Prime members: ${rules.membership_cashback_rate_percent}% cashback on paid service bills (up to ${inr(rules.membership_cashback_max)} per bill), credited to Available Balance.`,
    'Referral rewards are credited to Available Balance when your friend completes their first order.',
    `Services: use up to ${formatWalletUsageLimit('SERVICE', rules)} from wallet at checkout.`,
    `Membership: use up to ${formatWalletUsageLimit('MEMBERSHIP', rules)} from wallet at checkout.`,
    'All credits (welcome bonus, cashback, referral) add to Available Balance and show in Recent Activity.',
    'Wallet balance cannot be withdrawn as cash or transferred to bank.',
    'Applied at checkout - final amount shown before you pay.',
    'MyFNG may update wallet terms with in-app notice.',
  ];
}

export const WALLET_TERMS = buildWalletTerms();

export async function loadWalletRules(apiUrl: string = ENV.API_URL): Promise<WalletRules> {
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/public/wallet-rules`, {
      headers: {
        Accept: 'application/json',
        'X-App-Platform': Platform.OS,
      },
    });
    if (!res.ok) return rulesCache;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return rulesCache;
    const json = await res.json();
    if (!json?.success) return rulesCache;

    rulesCache = {
      wallet_enabled: json.wallet_enabled !== false,
      service_usage_mode: parseUsageMode(json.service_usage_mode),
      service_usage_percent: numOrDefault(json.service_usage_percent, DEFAULT_WALLET_RULES.service_usage_percent),
      service_usage_amount: numOrDefault(json.service_usage_amount, DEFAULT_WALLET_RULES.service_usage_amount),
      membership_usage_mode: parseUsageMode(json.membership_usage_mode),
      membership_usage_percent: numOrDefault(json.membership_usage_percent, DEFAULT_WALLET_RULES.membership_usage_percent),
      membership_usage_amount: numOrDefault(json.membership_usage_amount, DEFAULT_WALLET_RULES.membership_usage_amount),
      welcome_bonus_amount: numOrDefault(json.welcome_bonus_amount, DEFAULT_WALLET_RULES.welcome_bonus_amount),
      welcome_expiry_days: numOrDefault(json.welcome_expiry_days, DEFAULT_WALLET_RULES.welcome_expiry_days),
      membership_cashback_rate_percent: numOrDefault(json.membership_cashback_rate_percent, DEFAULT_WALLET_RULES.membership_cashback_rate_percent),
      membership_cashback_max: numOrDefault(json.membership_cashback_max, DEFAULT_WALLET_RULES.membership_cashback_max),
      referral_first_reward: numOrDefault(json.referral_first_reward, DEFAULT_WALLET_RULES.referral_first_reward),
      referral_repeat_reward: numOrDefault(json.referral_repeat_reward, DEFAULT_WALLET_RULES.referral_repeat_reward),
      min_payable_for_wallet: numOrDefault(json.min_payable_for_wallet, DEFAULT_WALLET_RULES.min_payable_for_wallet),
      max_absolute_deduction: numOrDefault(json.max_absolute_deduction, DEFAULT_WALLET_RULES.max_absolute_deduction),
      per_source_limits_enabled: Boolean(json.per_source_limits_enabled),
      source_limits: json.source_limits && typeof json.source_limits === 'object' ? json.source_limits : null,
      advanced_enabled: Boolean(json.advanced_enabled),
      service_overrides: Array.isArray(json.service_overrides)
        ? json.service_overrides.map((row: any) => ({
            service_type_id: String(row.service_type_id || ''),
            active: row.active !== false,
            use_global: row.use_global !== false,
            wallet_allowed: row.wallet_allowed !== false,
            service_usage_mode: parseUsageMode(row.service_usage_mode),
            service_usage_percent: numOrDefault(row.service_usage_percent, DEFAULT_WALLET_RULES.service_usage_percent),
            service_usage_amount: numOrDefault(row.service_usage_amount, DEFAULT_WALLET_RULES.service_usage_amount),
            membership_cashback_rate_percent: numOrDefault(row.membership_cashback_rate_percent, DEFAULT_WALLET_RULES.membership_cashback_rate_percent),
            membership_cashback_max: numOrDefault(row.membership_cashback_max, DEFAULT_WALLET_RULES.membership_cashback_max),
          }))
        : [],
    };
    return rulesCache;
  } catch {
    return rulesCache;
  }
}

export function preloadWalletRules(apiUrl: string = ENV.API_URL): Promise<WalletRules> {
  if (!loadPromise) {
    loadPromise = loadWalletRules(apiUrl);
  }
  return loadPromise;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateWalletUsage(
  payableAmount: number,
  walletBalance: number,
  channel: 'SERVICE' | 'MEMBERSHIP',
  vehicleBlocked = false,
  rules: WalletRules = rulesCache,
): number {
  if (!rules.wallet_enabled || vehicleBlocked || payableAmount <= 0 || walletBalance <= 0) return 0;
  if (rules.min_payable_for_wallet > 0 && payableAmount < rules.min_payable_for_wallet) return 0;

  const maxFromOrder = roundMoney(computeWalletUsageCap(payableAmount, channel, rules));
  let deduction = roundMoney(Math.min(walletBalance, maxFromOrder));

  if (rules.max_absolute_deduction > 0) {
    deduction = roundMoney(Math.min(deduction, rules.max_absolute_deduction));
  }

  return deduction;
}

type ServiceUsageRule = Pick<
  WalletRules,
  'service_usage_mode' | 'service_usage_percent' | 'service_usage_amount'
>;

function resolveServiceUsageRule(rules: WalletRules, serviceTypeId?: string | null): ServiceUsageRule {
  if (!rules.advanced_enabled || !serviceTypeId) {
    return {
      service_usage_mode: rules.service_usage_mode,
      service_usage_percent: rules.service_usage_percent,
      service_usage_amount: rules.service_usage_amount,
    };
  }
  const override = (rules.service_overrides || []).find(
    (row) => row.active && row.service_type_id === serviceTypeId,
  );
  if (!override || !override.wallet_allowed) {
    return {
      service_usage_mode: 'PERCENT',
      service_usage_percent: 0,
      service_usage_amount: 0,
    };
  }
  if (override.use_global) {
    return {
      service_usage_mode: rules.service_usage_mode,
      service_usage_percent: rules.service_usage_percent,
      service_usage_amount: rules.service_usage_amount,
    };
  }
  return {
    service_usage_mode: override.service_usage_mode,
    service_usage_percent: override.service_usage_percent,
    service_usage_amount: override.service_usage_amount,
  };
}

export function calculateWalletUsageForServiceLines(
  serviceLines: WalletServiceLine[],
  walletBalance: number,
  vehicleBlocked = false,
  rules: WalletRules = rulesCache,
): number {
  if (!rules.wallet_enabled || vehicleBlocked || walletBalance <= 0 || !serviceLines.length) return 0;

  const totalPayable = serviceLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  if (totalPayable <= 0) return 0;
  if (rules.min_payable_for_wallet > 0 && totalPayable < rules.min_payable_for_wallet) return 0;

  if (!rules.advanced_enabled) {
    return calculateWalletUsage(totalPayable, walletBalance, 'SERVICE', false, rules);
  }

  let remaining = walletBalance;
  let totalDeduction = 0;

  for (const line of serviceLines) {
    const amount = roundMoney(Number(line.amount || 0));
    if (amount <= 0) continue;
    const usageRule = resolveServiceUsageRule(rules, line.service_type_id);
    const lineCap = roundMoney(
      computeWalletUsageCap(amount, 'SERVICE', {
        ...usageRule,
        membership_usage_mode: 'PERCENT',
        membership_usage_percent: 0,
        membership_usage_amount: 0,
      }),
    );
    if (lineCap <= 0) continue;
    const lineDeduction = roundMoney(Math.min(remaining, lineCap));
    totalDeduction = roundMoney(totalDeduction + lineDeduction);
    remaining = roundMoney(remaining - lineDeduction);
    if (remaining <= 0) break;
  }

  if (rules.max_absolute_deduction > 0) {
    totalDeduction = roundMoney(Math.min(totalDeduction, rules.max_absolute_deduction));
  }

  return roundMoney(Math.min(totalDeduction, walletBalance));
}

export function getEffectiveServiceWalletLimit(
  serviceTypeId?: string | null,
  rules: WalletRules = rulesCache,
): string {
  const usageRule = resolveServiceUsageRule(rules, serviceTypeId);
  if (usageRule.service_usage_mode === 'AMOUNT') {
    return inr(usageRule.service_usage_amount);
  }
  return `${usageRule.service_usage_percent}%`;
}

/** @deprecated Use getEffectiveServiceWalletLimit() */
export function getEffectiveServiceWalletPercent(serviceTypeId?: string | null, rules: WalletRules = rulesCache) {
  const usageRule = resolveServiceUsageRule(rules, serviceTypeId);
  if (usageRule.service_usage_mode === 'AMOUNT') return 0;
  return usageRule.service_usage_percent;
}

export async function fetchWalletVehicleBlocked(
  apiFetchFn: (path: string) => Promise<any>,
  vehicleNumber?: string | null,
): Promise<{ blocked: boolean; reason?: string | null }> {
  const plate = String(vehicleNumber || '').trim();
  if (!plate) return { blocked: false, reason: null };
  try {
    const data = await apiFetchFn(
      `/api/customer/wallet/quote?vehicle_number=${encodeURIComponent(plate)}`,
    );
    return { blocked: Boolean(data?.wallet_blocked), reason: data?.block_reason || null };
  } catch {
    return { blocked: false, reason: null };
  }
}
