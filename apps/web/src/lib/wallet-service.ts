import {
  DEFAULT_WALLET_CONFIG,
  getWalletConfig,
  getWalletLogicSettings,
  parseWalletPlatform,
  resolveServiceWalletConfig,
  WALLET_SOURCE_GROUPS,
  type WalletLogicFullSettings,
  type WalletPlatform,
  type WalletRuntimeConfig,
  type WalletSourceGroup,
  type WalletSourceCombinationRule,
  type WalletSourceUsageLimits,
} from './wallet-config';

/** @deprecated Use getWalletConfig() — kept for backwards compatibility */
export const WALLET_CONFIG = DEFAULT_WALLET_CONFIG;

export type WalletChannel = 'SERVICE' | 'MEMBERSHIP';

export type WalletServiceLine = {
  service_type_id?: string | null;
  amount: number;
};

type WalletAccount = {
  id: string;
  current_balance?: number | string | null;
  lifetime_credited?: number | string | null;
  lifetime_debited?: number | string | null;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function isHiddenWalletTransaction(tx: { metadata?: unknown; amount?: unknown }): boolean {
  const meta =
    tx?.metadata && typeof tx.metadata === 'object' && !Array.isArray(tx.metadata)
      ? (tx.metadata as Record<string, unknown>)
      : null;
  return meta?.hidden_from_history === true || meta?.suppressed === true;
}

export function filterVisibleWalletTransactions<T extends { metadata?: unknown; amount?: unknown }>(
  rows: T[] | null | undefined,
): T[] {
  return (rows || []).filter((tx) => !isHiddenWalletTransaction(tx));
}

function welcomeBonusIdempotencyKey(customerId: string) {
  return `welcome:${customerId}`;
}

export async function hasWelcomeBonusMarker(supabaseAdmin: any, customerId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id')
    .eq('customer_id', customerId)
    .eq('idempotency_key', welcomeBonusIdempotencyKey(customerId))
    .maybeSingle();
  return Boolean(data?.id);
}

export async function isWelcomeBonusSuppressed(supabaseAdmin: any, customerId: string): Promise<boolean> {
  const { data: wallet } = await supabaseAdmin
    .from('wallet_accounts')
    .select('welcome_bonus_suppressed')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (wallet?.welcome_bonus_suppressed === true) return true;

  const { data: event } = await supabaseAdmin
    .from('customer_analytics_events')
    .select('id')
    .eq('customer_id', customerId)
    .eq('event_name', 'welcome_bonus_suppressed')
    .limit(1)
    .maybeSingle();
  return Boolean(event?.id);
}

/** Blocks future welcome bonus backfill without adding visible wallet history. */
export async function suppressWelcomeBonus(
  supabaseAdmin: any,
  customerId: string,
  opts?: { reason?: string; adminUserId?: string | null },
) {
  if (await isWelcomeBonusSuppressed(supabaseAdmin, customerId)) {
    return { suppressed: false, reason: 'already_marked' as const };
  }

  await ensureWalletAccountFull(supabaseAdmin, customerId);

  const { error: walletError } = await supabaseAdmin
    .from('wallet_accounts')
    .update({
      welcome_bonus_suppressed: true,
      updated_at: new Date().toISOString(),
    })
    .eq('customer_id', customerId);
  if (walletError && !String(walletError.message || '').includes('welcome_bonus_suppressed')) {
    throw walletError;
  }

  const { data: existingEvent } = await supabaseAdmin
    .from('customer_analytics_events')
    .select('id')
    .eq('customer_id', customerId)
    .eq('event_name', 'welcome_bonus_suppressed')
    .limit(1)
    .maybeSingle();

  if (!existingEvent?.id) {
    await supabaseAdmin.from('customer_analytics_events').insert({
      customer_id: customerId,
      event_name: 'welcome_bonus_suppressed',
      event_group: 'wallet',
      properties: {
        reason: opts?.reason || 'admin_wallet_history_clear',
        admin_user_id: opts?.adminUserId || null,
      },
    });
  }

  return { suppressed: true };
}

function computeCapFromConfig(payableAmount: number, channel: WalletChannel, config: WalletRuntimeConfig): number {
  const isMembership = channel === 'MEMBERSHIP';
  const mode = isMembership ? config.MEMBERSHIP_USAGE_MODE : config.SERVICE_USAGE_MODE;
  if (mode === 'AMOUNT') {
    const fixed = isMembership ? config.MEMBERSHIP_USAGE_AMOUNT : config.SERVICE_USAGE_AMOUNT;
    return roundMoney(Math.min(Math.max(0, fixed), payableAmount));
  }
  const percent = isMembership ? config.MEMBERSHIP_USAGE_PERCENT : config.SERVICE_USAGE_PERCENT;
  return roundMoney(Math.min(payableAmount, payableAmount * percent));
}

export function calculateMaxWalletUsageWithConfig(
  payableAmount: number,
  spendableBalance: number,
  channel: WalletChannel,
  config: WalletRuntimeConfig,
): number {
  if (!config.WALLET_ENABLED || payableAmount <= 0 || spendableBalance <= 0) return 0;
  if (config.MIN_PAYABLE_FOR_WALLET > 0 && payableAmount < config.MIN_PAYABLE_FOR_WALLET) return 0;

  const maxFromOrder = computeCapFromConfig(payableAmount, channel, config);
  let deduction = roundMoney(Math.min(spendableBalance, maxFromOrder));

  if (config.MAX_ABSOLUTE_DEDUCTION > 0) {
    deduction = roundMoney(Math.min(deduction, config.MAX_ABSOLUTE_DEDUCTION));
  }

  return deduction;
}

export function calculateWalletDeductionForServiceLines(
  serviceLines: WalletServiceLine[],
  spendableBalance: number,
  channel: WalletChannel,
  baseConfig: WalletRuntimeConfig,
  settings: WalletLogicFullSettings,
): number {
  if (!baseConfig.WALLET_ENABLED || spendableBalance <= 0 || channel !== 'SERVICE') return 0;
  if (!settings.advanced_enabled || !serviceLines.length) {
    const total = serviceLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    return calculateMaxWalletUsageWithConfig(total, spendableBalance, channel, baseConfig);
  }

  let remaining = spendableBalance;
  let totalDeduction = 0;

  for (const line of serviceLines) {
    const amount = roundMoney(Number(line.amount || 0));
    if (amount <= 0) continue;

    const lineConfig = resolveServiceWalletConfig(baseConfig, settings, line.service_type_id);
    if (!lineConfig.WALLET_ENABLED) continue;

    const lineDeduction = calculateMaxWalletUsageWithConfig(amount, remaining, channel, lineConfig);
    totalDeduction = roundMoney(totalDeduction + lineDeduction);
    remaining = roundMoney(remaining - lineDeduction);
    if (remaining <= 0) break;
  }

  if (baseConfig.MAX_ABSOLUTE_DEDUCTION > 0) {
    totalDeduction = roundMoney(Math.min(totalDeduction, baseConfig.MAX_ABSOLUTE_DEDUCTION));
  }

  return roundMoney(Math.min(totalDeduction, spendableBalance));
}

export function parseWalletServiceLines(body: any, payableAmount = 0): WalletServiceLine[] | undefined {
  const normalize = (rows: any[]): WalletServiceLine[] =>
    rows
      .map((row) => ({
        service_type_id: row?.service_type_id || row?.serviceTypeId || row?.id || null,
        amount: roundMoney(Number(row?.amount ?? row?.price ?? row?.payable ?? 0)),
      }))
      .filter((row) => row.amount > 0);

  if (Array.isArray(body?.service_lines) && body.service_lines.length) {
    return normalize(body.service_lines);
  }

  if (Array.isArray(body?.service_items) && body.service_items.length) {
    return normalize(body.service_items);
  }

  const couponItems = body?.coupon?.lead_context?.service_items;
  if (Array.isArray(couponItems) && couponItems.length) {
    return normalize(couponItems);
  }

  const ids: string[] = Array.isArray(body?.service_type_ids)
    ? body.service_type_ids
    : Array.isArray(body?.lead?.service_type_ids)
      ? body.lead.service_type_ids
      : [];

  if (ids.length && payableAmount > 0) {
    const each = roundMoney(payableAmount / ids.length);
    return ids.map((service_type_id) => ({ service_type_id, amount: each }));
  }

  return undefined;
}

export async function calculateMaxWalletUsage(
  payableAmount: number,
  spendableBalance: number,
  channel: WalletChannel,
  supabaseAdmin?: any,
  platform: WalletPlatform = 'web',
): Promise<number> {
  const config = await getWalletConfig(supabaseAdmin, platform);
  return calculateMaxWalletUsageWithConfig(payableAmount, spendableBalance, channel, config);
}

export type WalletBalanceBySource = {
  welcome_bonus: number;
  referral: number;
  membership_cashback: number;
  admin_credit: number;
  other: number;
  total: number;
};

function mapCreditSourceToGroup(source: string): WalletSourceGroup | 'other' {
  switch (source.toUpperCase()) {
    case 'WELCOME_BONUS': return 'welcome_bonus';
    case 'REFERRAL':
    case 'REFERRAL_BONUS': return 'referral';
    case 'MEMBERSHIP_CASHBACK': return 'membership_cashback';
    case 'ADMIN_CREDIT': return 'admin_credit';
    default: return 'other';
  }
}

export async function getWalletBalanceBySource(
  supabaseAdmin: any,
  customerId: string,
): Promise<WalletBalanceBySource> {
  const { data: txs } = await supabaseAdmin
    .from('wallet_transactions')
    .select('transaction_type, source, amount')
    .eq('customer_id', customerId);

  const sourceCredits: Record<string, number> = {
    welcome_bonus: 0, referral: 0, membership_cashback: 0, admin_credit: 0, other: 0,
  };
  let totalDebits = 0;

  for (const tx of txs || []) {
    const type = String(tx.transaction_type || '').toUpperCase();
    const source = String(tx.source || '');
    const amount = Number(tx.amount || 0);
    if (amount <= 0) continue;

    if (type === 'CREDIT') {
      sourceCredits[mapCreditSourceToGroup(source)] += amount;
    } else if (type === 'EXPIRE') {
      const group = mapCreditSourceToGroup(source);
      sourceCredits[group] = Math.max(0, sourceCredits[group] - amount);
    } else if (type === 'DEBIT') {
      totalDebits += amount;
    }
  }

  const totalNetCredits = Object.values(sourceCredits).reduce((s, v) => s + v, 0);

  const result: WalletBalanceBySource = {
    welcome_bonus: 0, referral: 0, membership_cashback: 0, admin_credit: 0, other: 0, total: 0,
  };

  if (totalNetCredits > 0 && totalNetCredits > totalDebits) {
    for (const group of [...WALLET_SOURCE_GROUPS, 'other' as const]) {
      const share = sourceCredits[group] / totalNetCredits;
      const allocatedDebit = totalDebits * share;
      result[group] = roundMoney(Math.max(0, sourceCredits[group] - allocatedDebit));
    }
  }

  result.total = roundMoney(
    result.welcome_bonus + result.referral + result.membership_cashback + result.admin_credit + result.other,
  );
  return result;
}

export function calculateMaxWalletUsagePerSource(
  payableAmount: number,
  balanceBySource: WalletBalanceBySource,
  channel: WalletChannel,
  sourceLimits: WalletSourceUsageLimits,
  config: WalletRuntimeConfig,
): number {
  if (!config.WALLET_ENABLED || payableAmount <= 0 || balanceBySource.total <= 0) return 0;
  if (config.MIN_PAYABLE_FOR_WALLET > 0 && payableAmount < config.MIN_PAYABLE_FOR_WALLET) return 0;

  const isMembership = channel === 'MEMBERSHIP';
  let totalDeduction = 0;

  for (const group of WALLET_SOURCE_GROUPS) {
    const sourceBalance = balanceBySource[group];
    if (sourceBalance <= 0) continue;
    const pct = isMembership ? sourceLimits[group].membership_percent : sourceLimits[group].service_percent;
    const cap = roundMoney(payableAmount * (pct / 100));
    totalDeduction += roundMoney(Math.min(sourceBalance, cap));
  }

  if (balanceBySource.other > 0) {
    const globalCap = computeCapFromConfig(payableAmount, channel, config);
    totalDeduction += roundMoney(Math.min(balanceBySource.other, globalCap));
  }

  totalDeduction = roundMoney(Math.min(totalDeduction, balanceBySource.total));

  if (config.MAX_ABSOLUTE_DEDUCTION > 0) {
    totalDeduction = roundMoney(Math.min(totalDeduction, config.MAX_ABSOLUTE_DEDUCTION));
  }

  return totalDeduction;
}

function getActiveCombinationRules(rules: WalletSourceCombinationRule[]): WalletSourceCombinationRule[] {
  return (rules || []).filter((rule) => rule.active && rule.sources.length >= 2);
}

function getSourcesClaimedByCombinations(rules: WalletSourceCombinationRule[]): Set<WalletSourceGroup> {
  const claimed = new Set<WalletSourceGroup>();
  for (const rule of getActiveCombinationRules(rules)) {
    for (const source of rule.sources) claimed.add(source);
  }
  return claimed;
}

export function calculateMaxWalletUsageWithCombinations(
  payableAmount: number,
  balanceBySource: WalletBalanceBySource,
  channel: WalletChannel,
  settings: WalletLogicFullSettings,
  config: WalletRuntimeConfig,
): number {
  if (!config.WALLET_ENABLED || payableAmount <= 0 || balanceBySource.total <= 0) return 0;
  if (config.MIN_PAYABLE_FOR_WALLET > 0 && payableAmount < config.MIN_PAYABLE_FOR_WALLET) return 0;

  const isMembership = channel === 'MEMBERSHIP';
  const activeRules = getActiveCombinationRules(settings.source_combination_rules || []);
  const claimedSources = getSourcesClaimedByCombinations(settings.source_combination_rules || []);
  let totalDeduction = 0;

  for (const rule of activeRules) {
    const groupBalance = roundMoney(rule.sources.reduce((sum, source) => sum + balanceBySource[source], 0));
    if (groupBalance <= 0) continue;
    const pct = isMembership ? rule.membership_percent : rule.service_percent;
    const cap = roundMoney(payableAmount * (pct / 100));
    totalDeduction += roundMoney(Math.min(groupBalance, cap));
  }

  if (settings.per_source_limits_enabled) {
    for (const group of WALLET_SOURCE_GROUPS) {
      if (claimedSources.has(group)) continue;
      const sourceBalance = balanceBySource[group];
      if (sourceBalance <= 0) continue;
      const pct = isMembership
        ? settings.source_limits[group].membership_percent
        : settings.source_limits[group].service_percent;
      const cap = roundMoney(payableAmount * (pct / 100));
      totalDeduction += roundMoney(Math.min(sourceBalance, cap));
    }
  } else {
    const ungroupedBalance = roundMoney(
      WALLET_SOURCE_GROUPS.filter((group) => !claimedSources.has(group)).reduce(
        (sum, group) => sum + balanceBySource[group],
        0,
      ),
    );
    if (ungroupedBalance > 0) {
      const globalCap = computeCapFromConfig(payableAmount, channel, config);
      totalDeduction += roundMoney(Math.min(ungroupedBalance, globalCap));
    }
  }

  if (balanceBySource.other > 0) {
    const globalCap = computeCapFromConfig(payableAmount, channel, config);
    totalDeduction += roundMoney(Math.min(balanceBySource.other, globalCap));
  }

  totalDeduction = roundMoney(Math.min(totalDeduction, balanceBySource.total));

  if (config.MAX_ABSOLUTE_DEDUCTION > 0) {
    totalDeduction = roundMoney(Math.min(totalDeduction, config.MAX_ABSOLUTE_DEDUCTION));
  }

  return totalDeduction;
}

export async function ensureWalletAccountFull(supabaseAdmin: any, customerId: string): Promise<WalletAccount> {
  const { data: existing } = await supabaseAdmin
    .from('wallet_accounts')
    .select('id, current_balance, lifetime_credited, lifetime_debited')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from('wallet_accounts')
    .insert({ customer_id: customerId, current_balance: 0 })
    .select('id, current_balance, lifetime_credited, lifetime_debited')
    .single();
  if (error || !data) throw new Error('Failed to create wallet account');
  return data;
}

export async function processExpiredWelcomeCredits(
  supabaseAdmin: any,
  customerId: string,
  wallet: WalletAccount,
  config?: WalletRuntimeConfig,
): Promise<WalletAccount> {
  const walletConfig = config || (await getWalletConfig(supabaseAdmin));
  const nowIso = new Date().toISOString();
  const { data: expiredCredits } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, amount, expires_at')
    .eq('customer_id', customerId)
    .eq('transaction_type', 'CREDIT')
    .eq('source', walletConfig.WELCOME_SOURCE)
    .lt('expires_at', nowIso);

  let balance = Number(wallet.current_balance || 0);
  for (const credit of expiredCredits || []) {
    const expireKey = `expire:welcome:${credit.id}`;
    const { data: existingExpire } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id')
      .eq('customer_id', customerId)
      .eq('idempotency_key', expireKey)
      .maybeSingle();
    if (existingExpire) continue;

    const amount = roundMoney(Number(credit.amount || 0));
    if (amount <= 0) continue;

    const deduct = roundMoney(Math.min(balance, amount));
    if (deduct <= 0) continue;

    const nextBalance = roundMoney(balance - deduct);
    await supabaseAdmin.from('wallet_transactions').insert({
      wallet_account_id: wallet.id,
      customer_id: customerId,
      transaction_type: 'EXPIRE',
      amount: deduct,
      balance_after: nextBalance,
      source: walletConfig.WELCOME_SOURCE,
      idempotency_key: expireKey,
      metadata: {
        label: 'Welcome Bonus Expired',
        expired_credit_id: credit.id,
      },
    });
    await supabaseAdmin
      .from('wallet_accounts')
      .update({
        current_balance: nextBalance,
        updated_at: nowIso,
      })
      .eq('id', wallet.id);
    balance = nextBalance;
  }

  if (balance !== Number(wallet.current_balance || 0)) {
    const { data: refreshed } = await supabaseAdmin
      .from('wallet_accounts')
      .select('id, current_balance, lifetime_credited, lifetime_debited')
      .eq('id', wallet.id)
      .single();
    return refreshed || { ...wallet, current_balance: balance };
  }
  return wallet;
}

export async function getWalletSummary(supabaseAdmin: any, customerId: string, platform: WalletPlatform = 'web') {
  const config = await getWalletConfig(supabaseAdmin, platform);
  let wallet = await ensureWalletAccountFull(supabaseAdmin, customerId);

  if (!(await isWelcomeBonusSuppressed(supabaseAdmin, customerId))) {
    const { data: existingWelcome } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id')
      .eq('customer_id', customerId)
      .eq('idempotency_key', welcomeBonusIdempotencyKey(customerId))
      .maybeSingle();

    if (!existingWelcome) {
      try {
        const backfill = await creditWelcomeBonus(supabaseAdmin, customerId, { platform });
        if (backfill.credited) {
          wallet = await ensureWalletAccountFull(supabaseAdmin, customerId);
        }
      } catch (err) {
        console.error('[getWalletSummary] welcome bonus backfill failed:', err);
      }
    }
  }

  wallet = await processExpiredWelcomeCredits(supabaseAdmin, customerId, wallet, config);

  const { data: welcomeCredit } = await supabaseAdmin
    .from('wallet_transactions')
    .select('expires_at, created_at, amount, metadata')
    .eq('customer_id', customerId)
    .eq('transaction_type', 'CREDIT')
    .eq('source', config.WELCOME_SOURCE)
    .gt('amount', 0)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const spendableBalance = roundMoney(Number(wallet.current_balance || 0));
  return {
    wallet,
    spendable_balance: spendableBalance,
    welcome_bonus_expires_at: welcomeCredit?.expires_at || null,
    welcome_bonus_amount: Number(welcomeCredit?.amount || config.WELCOME_BONUS_AMOUNT),
    rules: {
      wallet_enabled: config.WALLET_ENABLED,
      service_usage_mode: config.SERVICE_USAGE_MODE,
      service_usage_percent: config.SERVICE_USAGE_PERCENT * 100,
      service_usage_amount: config.SERVICE_USAGE_AMOUNT,
      membership_usage_mode: config.MEMBERSHIP_USAGE_MODE,
      membership_usage_percent: config.MEMBERSHIP_USAGE_PERCENT * 100,
      membership_usage_amount: config.MEMBERSHIP_USAGE_AMOUNT,
      welcome_expiry_days: config.WELCOME_EXPIRY_DAYS,
      welcome_bonus_enabled: config.WELCOME_BONUS_ENABLED !== false,
      welcome_bonus_amount: config.WELCOME_BONUS_AMOUNT,
      membership_cashback_rate_percent: config.MEMBERSHIP_CASHBACK_RATE * 100,
      membership_cashback_max: config.MEMBERSHIP_CASHBACK_MAX,
      referral_first_reward: config.REFERRAL_FIRST_REWARD,
      referral_repeat_reward: config.REFERRAL_REPEAT_REWARD,
      min_payable_for_wallet: config.MIN_PAYABLE_FOR_WALLET,
      max_absolute_deduction: config.MAX_ABSOLUTE_DEDUCTION,
    },
  };
}

const WELCOME_SIGNUP_GRACE_MS = 24 * 60 * 60 * 1000;

export type CreditWelcomeBonusOptions = {
  /** Admin/manual scripts only — skips fresh-signup eligibility check. */
  allowExistingCustomer?: boolean;
  /** Auth route sets this when the customer row was created in the current login flow. */
  isNewSignup?: boolean;
  platform?: WalletPlatform;
};

export async function isWelcomeBonusEligible(
  supabaseAdmin: any,
  customerId: string,
  options?: CreditWelcomeBonusOptions,
): Promise<boolean> {
  if (options?.allowExistingCustomer || options?.isNewSignup) return true;

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('created_at')
    .eq('id', customerId)
    .maybeSingle();
  if (!customer?.created_at) return false;

  const createdAtMs = Date.parse(String(customer.created_at));
  if (!Number.isFinite(createdAtMs)) return false;

  // Backfill only for accounts created recently (same-day signup missed credit).
  return createdAtMs >= Date.now() - WELCOME_SIGNUP_GRACE_MS;
}

export async function creditWelcomeBonus(
  supabaseAdmin: any,
  customerId: string,
  options?: CreditWelcomeBonusOptions,
) {
  const platform = options?.platform || 'web';
  const config = await getWalletConfig(supabaseAdmin, platform);
  const idempotencyKey = welcomeBonusIdempotencyKey(customerId);

  if (!config.WELCOME_BONUS_ENABLED) {
    return { credited: false, reason: 'disabled' as const };
  }

  if (await isWelcomeBonusSuppressed(supabaseAdmin, customerId)) {
    return { credited: false, reason: 'suppressed' as const };
  }

  const { data: existing } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id')
    .eq('customer_id', customerId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existing) return { credited: false, reason: 'already_credited' as const };

  const eligible = await isWelcomeBonusEligible(supabaseAdmin, customerId, options);
  if (!eligible) return { credited: false, reason: 'not_eligible' as const };

  const wallet = await ensureWalletAccountFull(supabaseAdmin, customerId);
  let amount = Number(config.WELCOME_BONUS_AMOUNT);
  if (!Number.isFinite(amount) || amount <= 0) {
    amount = DEFAULT_WALLET_CONFIG.WELCOME_BONUS_AMOUNT;
  }
  let expiryDays = Number(config.WELCOME_EXPIRY_DAYS);
  if (!Number.isFinite(expiryDays) || expiryDays <= 0) {
    expiryDays = DEFAULT_WALLET_CONFIG.WELCOME_EXPIRY_DAYS;
  }
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
  const nextBalance = roundMoney(Number(wallet.current_balance || 0) + amount);

  const { error } = await supabaseAdmin.from('wallet_transactions').insert({
    wallet_account_id: wallet.id,
    customer_id: customerId,
    transaction_type: 'CREDIT',
    amount,
    balance_after: nextBalance,
    source: config.WELCOME_SOURCE,
    idempotency_key: idempotencyKey,
    expires_at: expiresAt.toISOString(),
    metadata: {
      label: 'Welcome Bonus Credited',
      description: 'New app install welcome bonus',
    },
  });
  if (error) {
    if (String(error.message || '').includes('duplicate') || String(error.code || '') === '23505') {
      return { credited: false, reason: 'already_credited' as const };
    }
    throw error;
  }

  await supabaseAdmin
    .from('wallet_accounts')
    .update({
      current_balance: nextBalance,
      lifetime_credited: roundMoney(Number(wallet.lifetime_credited || 0) + amount),
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id);

  return { credited: true, amount, expires_at: expiresAt.toISOString() };
}

const INVALID_PLATES = new Set(['', 'NA', 'N/A', 'NONE', 'NULL', 'UNDEFINED', 'TBD']);

export function normalizeVehiclePlate(input?: string | null): string {
  const plate = String(input || '').trim().toUpperCase().replace(/\s+/g, '');
  return INVALID_PLATES.has(plate) ? '' : plate;
}

export async function getWalletVehicleEligibility(
  supabaseAdmin: any,
  customerId: string,
  vehicleNumber?: string | null,
): Promise<{ blocked: boolean; reason?: string }> {
  const plate = normalizeVehiclePlate(vehicleNumber);
  if (!plate) return { blocked: false };

  const { data: rows } = await supabaseAdmin
    .from('customer_vehicles')
    .select('customer_id, vehicle_number')
    .neq('customer_id', customerId);

  const taken = (rows || []).some(
    (row: { customer_id: string; vehicle_number?: string | null }) =>
      normalizeVehiclePlate(row.vehicle_number) === plate,
  );

  if (taken) {
    return {
      blocked: true,
      reason: 'This vehicle is registered with another MyFNG account. Wallet cannot be used.',
    };
  }
  return { blocked: false };
}

export async function resolveWalletDeduction(
  supabaseAdmin: any,
  customerId: string,
  payableAmount: number,
  channel: WalletChannel,
  useWallet: boolean,
  vehicleNumber?: string | null,
  platform: WalletPlatform = 'web',
  serviceLines?: WalletServiceLine[],
) {
  if (!useWallet || payableAmount <= 0) {
    return { deduction: 0, blocked: false, spendable_balance: 0 };
  }

  const eligibility = await getWalletVehicleEligibility(supabaseAdmin, customerId, vehicleNumber);
  if (eligibility.blocked) {
    return { deduction: 0, blocked: true, reason: eligibility.reason, spendable_balance: 0 };
  }

  const summary = await getWalletSummary(supabaseAdmin, customerId, platform);
  const config = await getWalletConfig(supabaseAdmin, platform);
  const settings = await getWalletLogicSettings(supabaseAdmin);

  if (!config.WALLET_ENABLED) {
    return { deduction: 0, blocked: false, spendable_balance: summary.spendable_balance, rules: summary.rules };
  }

  let deduction = 0;
  const balanceBySource = await getWalletBalanceBySource(supabaseAdmin, customerId);
  const hasActiveCombinationRules =
    settings.source_combination_enabled && getActiveCombinationRules(settings.source_combination_rules || []).length > 0;

  if (hasActiveCombinationRules) {
    deduction = calculateMaxWalletUsageWithCombinations(
      payableAmount,
      balanceBySource,
      channel,
      settings,
      config,
    );
    deduction = roundMoney(Math.min(deduction, summary.spendable_balance));
  } else if (settings.per_source_limits_enabled) {
    deduction = calculateMaxWalletUsagePerSource(
      payableAmount,
      balanceBySource,
      channel,
      settings.source_limits,
      config,
    );
    deduction = roundMoney(Math.min(deduction, summary.spendable_balance));
  } else if (channel === 'SERVICE' && serviceLines?.length) {
    deduction = calculateWalletDeductionForServiceLines(
      serviceLines,
      summary.spendable_balance,
      channel,
      config,
      settings,
    );
  } else {
    deduction = calculateMaxWalletUsageWithConfig(
      payableAmount,
      summary.spendable_balance,
      channel,
      config,
    );
  }

  return {
    deduction,
    blocked: false,
    spendable_balance: summary.spendable_balance,
    welcome_bonus_expires_at: summary.welcome_bonus_expires_at,
    rules: summary.rules,
  };
}

export async function debitWallet(
  supabaseAdmin: any,
  customerId: string,
  amount: number,
  opts: {
    source: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
    channel?: WalletChannel;
    vehicleNumber?: string | null;
    platform?: WalletPlatform;
  },
) {
  const deduction = roundMoney(amount);
  if (deduction <= 0) return { debited: 0, balance_after: 0 };

  const eligibility = await getWalletVehicleEligibility(supabaseAdmin, customerId, opts.vehicleNumber);
  if (eligibility.blocked) {
    throw new Error(eligibility.reason || 'Wallet cannot be used for this vehicle');
  }

  const summary = await getWalletSummary(supabaseAdmin, customerId, opts.platform || 'web');
  const wallet = summary.wallet;
  const spendable = summary.spendable_balance;
  if (deduction > spendable) {
    throw new Error('Insufficient wallet balance');
  }

  const { data: existing } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, amount, balance_after')
    .eq('customer_id', customerId)
    .eq('idempotency_key', opts.idempotencyKey)
    .maybeSingle();
  if (existing) {
    return {
      debited: roundMoney(Number(existing.amount || 0)),
      balance_after: roundMoney(Number(existing.balance_after || 0)),
      duplicate: true,
    };
  }

  const nextBalance = roundMoney(spendable - deduction);
  const { error } = await supabaseAdmin.from('wallet_transactions').insert({
    wallet_account_id: wallet.id,
    customer_id: customerId,
    transaction_type: 'DEBIT',
    amount: deduction,
    balance_after: nextBalance,
    source: opts.source,
    idempotency_key: opts.idempotencyKey,
    metadata: {
      ...(opts.metadata || {}),
      channel: opts.channel || null,
    },
  });
  if (error) throw error;

  await supabaseAdmin
    .from('wallet_accounts')
    .update({
      current_balance: nextBalance,
      lifetime_debited: roundMoney(Number(wallet.lifetime_debited || 0) + deduction),
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id);

  return { debited: deduction, balance_after: nextBalance, duplicate: false };
}

export async function creditWallet(
  supabaseAdmin: any,
  customerId: string,
  amount: number,
  opts: {
    source: string;
    idempotencyKey: string;
    sourceRefId?: string | null;
    metadata?: Record<string, unknown>;
    expiresAt?: string | null;
  },
) {
  const credit = roundMoney(amount);
  if (credit <= 0) return { credited: 0, balance_after: 0, duplicate: false };

  const summary = await getWalletSummary(supabaseAdmin, customerId);
  const wallet = summary.wallet;

  const { data: existing } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, amount, balance_after')
    .eq('customer_id', customerId)
    .eq('idempotency_key', opts.idempotencyKey)
    .maybeSingle();
  if (existing) {
    return {
      credited: roundMoney(Number(existing.amount || 0)),
      balance_after: roundMoney(Number(existing.balance_after || 0)),
      duplicate: true,
    };
  }

  const nextBalance = roundMoney(summary.spendable_balance + credit);
  const { error } = await supabaseAdmin.from('wallet_transactions').insert({
    wallet_account_id: wallet.id,
    customer_id: customerId,
    transaction_type: 'CREDIT',
    amount: credit,
    balance_after: nextBalance,
    source: opts.source,
    source_ref_id: opts.sourceRefId || null,
    idempotency_key: opts.idempotencyKey,
    expires_at: opts.expiresAt || null,
    metadata: opts.metadata || {},
  });
  if (error) throw error;

  await supabaseAdmin
    .from('wallet_accounts')
    .update({
      current_balance: nextBalance,
      lifetime_credited: roundMoney(Number(wallet.lifetime_credited || 0) + credit),
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id);

  return { credited: credit, balance_after: nextBalance, duplicate: false };
}

/** When Prime expires unpaid, update the original booking wallet debit to match full-service wallet rules. */
export async function reconcileBookingWalletOnMembershipExpiry(
  supabaseAdmin: any,
  opts: {
    customerId: string;
    leadId: string;
    targetDeduction: number;
    serviceSubtotal: number;
    serviceLabel?: string | null;
  },
): Promise<{ adjusted: boolean; previousAmount: number; newAmount: number }> {
  const target = roundMoney(opts.targetDeduction);
  const leadId = String(opts.leadId || '').trim();
  const customerId = String(opts.customerId || '').trim();
  if (!leadId || !customerId || target <= 0) {
    return { adjusted: false, previousAmount: 0, newAmount: target };
  }

  const idempotencyKey = `booking:${leadId}`;
  const { data: tx } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, amount, balance_after, metadata, wallet_account_id, created_at')
    .eq('customer_id', customerId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (!tx) {
    return { adjusted: false, previousAmount: 0, newAmount: target };
  }

  const currentAmount = roundMoney(Number(tx.amount || 0));
  if (Math.abs(currentAmount - target) < 0.01) {
    return { adjusted: false, previousAmount: currentAmount, newAmount: target };
  }

  const delta = roundMoney(target - currentAmount);
  const wallet = await ensureWalletAccountFull(supabaseAdmin, customerId);
  const walletBalance = roundMoney(Number(wallet.current_balance || 0));

  if (delta > 0 && delta > walletBalance + 0.01) {
    console.warn(
      '[reconcileBookingWalletOnMembershipExpiry] insufficient wallet balance for adjustment',
      { leadId, customerId, delta, walletBalance, target, currentAmount },
    );
    return { adjusted: false, previousAmount: currentAmount, newAmount: target };
  }

  const txBalanceAfter = roundMoney(Number(tx.balance_after || 0) - delta);
  const newWalletBalance = roundMoney(walletBalance - delta);
  const previousMetadata =
    tx.metadata && typeof tx.metadata === 'object' ? (tx.metadata as Record<string, unknown>) : {};

  const { error: txError } = await supabaseAdmin
    .from('wallet_transactions')
    .update({
      amount: target,
      balance_after: txBalanceAfter,
      metadata: {
        ...previousMetadata,
        subtotal: opts.serviceSubtotal,
        membership_bundle_discount: 0,
        membership_expiry_reconciled_at: new Date().toISOString(),
        previous_debit_amount: currentAmount,
        label: opts.serviceLabel || previousMetadata.label || 'Used for Service Booking',
      },
    })
    .eq('id', tx.id);

  if (txError) {
    console.error('[reconcileBookingWalletOnMembershipExpiry]', txError.message);
    return { adjusted: false, previousAmount: currentAmount, newAmount: target };
  }

  const { data: laterTxs } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, balance_after')
    .eq('customer_id', customerId)
    .gt('created_at', tx.created_at)
    .order('created_at', { ascending: true });

  for (const later of laterTxs || []) {
    await supabaseAdmin
      .from('wallet_transactions')
      .update({
        balance_after: roundMoney(Number(later.balance_after || 0) - delta),
      })
      .eq('id', later.id);
  }

  const lifetimeDebited = roundMoney(Number(wallet.lifetime_debited || 0) + delta);
  await supabaseAdmin
    .from('wallet_accounts')
    .update({
      current_balance: newWalletBalance,
      lifetime_debited: lifetimeDebited >= 0 ? lifetimeDebited : 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id);

  return { adjusted: true, previousAmount: currentAmount, newAmount: target };
}

function normalizePhoneDigits(input?: string | null): string {
  return String(input || '').replace(/\D/g, '');
}

export async function resolveCustomerIdFromLead(
  supabaseAdmin: any,
  lead?: { customer_id?: string | null; customer_phone?: string | null } | null,
): Promise<string | null> {
  if (lead?.customer_id) return String(lead.customer_id);

  const digits = normalizePhoneDigits(lead?.customer_phone);
  if (!digits) return null;

  const { data: exact } = await supabaseAdmin
    .from('customers')
    .select('id, phone')
    .eq('phone', lead?.customer_phone || digits)
    .maybeSingle();
  if (exact?.id) return exact.id;

  const last10 = digits.slice(-10);
  if (last10.length < 10) return null;

  const { data: rows } = await supabaseAdmin
    .from('customers')
    .select('id, phone')
    .or(`phone.ilike.%${last10},phone.eq.${last10},phone.eq.91${last10},phone.eq.+91${last10}`);
  const match = (rows || []).find((row: { id: string; phone?: string | null }) => {
    const rowDigits = normalizePhoneDigits(row.phone);
    return rowDigits.slice(-10) === last10;
  });
  return match?.id || null;
}

export async function computeWalletRewardTotals(supabaseAdmin: any, customerId: string) {
  const { data: credits } = await supabaseAdmin
    .from('wallet_transactions')
    .select('amount, source')
    .eq('customer_id', customerId)
    .eq('transaction_type', 'CREDIT');

  let earnedCashback = 0;
  let referralRewards = 0;
  let rewardPoints = 0;

  for (const tx of credits || []) {
    const src = String(tx.source || '').toUpperCase();
    const amt = Number(tx.amount || 0);
    if (src.includes('REFERRAL')) {
      referralRewards += amt;
      rewardPoints += 1;
    } else if (src.includes('CASHBACK')) {
      earnedCashback += amt;
      rewardPoints += 1;
    }
  }

  const { count: refCount } = await supabaseAdmin
    .from('referral_events')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_customer_id', customerId)
    .eq('status', 'REWARDED');

  rewardPoints = Math.max(rewardPoints, refCount || 0);

  return {
    earned_cashback: roundMoney(earnedCashback),
    referral_rewards: roundMoney(referralRewards),
    reward_points: rewardPoints,
  };
}

export async function maybeCreditMembershipBillCashback(
  supabaseAdmin: any,
  opts: {
    customerId: string;
    invoiceId: string;
    leadId?: string | null;
    billAmount: number;
    invoiceNumber?: string | null;
  },
) {
  const billAmount = roundMoney(opts.billAmount);
  if (billAmount <= 0) return { credited: false, reason: 'zero_bill' as const };

  const nowIso = new Date().toISOString();
  const { data: membership } = await supabaseAdmin
    .from('customer_memberships')
    .select('id, plan_id')
    .eq('customer_id', opts.customerId)
    .eq('status', 'ACTIVE')
    .gt('ends_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membership) return { credited: false, reason: 'no_active_membership' as const };

  const { data: benefit } = await supabaseAdmin
    .from('membership_benefits')
    .select('id')
    .eq('plan_id', membership.plan_id)
    .eq('benefit_code', 'CASHBACK_5')
    .eq('active', true)
    .maybeSingle();

  if (!benefit) return { credited: false, reason: 'no_cashback_benefit' as const };

  const config = await getWalletConfig(supabaseAdmin);
  const cashbackRaw = roundMoney(billAmount * config.MEMBERSHIP_CASHBACK_RATE);
  const cashbackAmount = roundMoney(Math.min(cashbackRaw, config.MEMBERSHIP_CASHBACK_MAX));
  if (cashbackAmount <= 0) return { credited: false, reason: 'zero_cashback' as const };

  const idempotencyKey = `membership-cashback:invoice:${opts.invoiceId}`;
  const result = await creditWallet(supabaseAdmin, opts.customerId, cashbackAmount, {
    source: config.MEMBERSHIP_CASHBACK_SOURCE,
    idempotencyKey,
    sourceRefId: opts.invoiceId,
    metadata: {
      label: 'Membership Cashback',
      bill_amount: billAmount,
      cashback_rate: `${config.MEMBERSHIP_CASHBACK_RATE * 100}%`,
      max_cap: config.MEMBERSHIP_CASHBACK_MAX,
      invoice_number: opts.invoiceNumber || null,
      lead_id: opts.leadId || null,
    },
  });

  if (!result.duplicate && result.credited > 0) {
    try {
      await supabaseAdmin.from('membership_usage').insert({
        customer_membership_id: membership.id,
        customer_id: opts.customerId,
        benefit_code: 'CASHBACK_5',
        used_value: result.credited,
        reference_type: 'INVOICE',
        reference_id: opts.invoiceId,
      });
    } catch {
      // best-effort usage log
    }
  }

  return {
    credited: result.credited > 0,
    amount: result.credited,
    duplicate: result.duplicate,
  };
}

export async function creditMembershipCashbackOnFullPayment(
  supabaseAdmin: any,
  invoice: {
    id: string;
    lead_id?: string | null;
    final_amount?: number | string | null;
    total_amount?: number | string | null;
    invoice_number?: string | null;
    lead?: { customer_id?: string | null; customer_phone?: string | null } | null;
  },
) {
  try {
    const billAmount = Number(invoice.final_amount || invoice.total_amount || 0);
    if (billAmount <= 0) return;

    let lead = invoice.lead || null;
    if (!lead && invoice.lead_id) {
      const { data } = await supabaseAdmin
        .from('service_leads')
        .select('customer_id, customer_phone')
        .eq('id', invoice.lead_id)
        .maybeSingle();
      lead = data || null;
    }

    const customerId = await resolveCustomerIdFromLead(supabaseAdmin, lead);
    if (!customerId) return;

    return await maybeCreditMembershipBillCashback(supabaseAdmin, {
      customerId,
      invoiceId: invoice.id,
      leadId: invoice.lead_id,
      billAmount,
      invoiceNumber: invoice.invoice_number,
    });
  } catch (e) {
    console.warn('Non-blocking: membership cashback credit failed:', e);
  }
}
