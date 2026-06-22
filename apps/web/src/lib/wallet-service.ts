export const WALLET_CONFIG = {
  WELCOME_BONUS_AMOUNT: 1000,
  WELCOME_EXPIRY_DAYS: 90,
  SERVICE_USAGE_PERCENT: 0.1,
  MEMBERSHIP_USAGE_PERCENT: 0.3,
  WELCOME_SOURCE: 'WELCOME_BONUS',
  MEMBERSHIP_CASHBACK_SOURCE: 'MEMBERSHIP_CASHBACK',
  MEMBERSHIP_CASHBACK_RATE: 0.05,
  MEMBERSHIP_CASHBACK_MAX: 500,
} as const;

export type WalletChannel = 'SERVICE' | 'MEMBERSHIP';

type WalletAccount = {
  id: string;
  current_balance?: number | string | null;
  lifetime_credited?: number | string | null;
  lifetime_debited?: number | string | null;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateMaxWalletUsage(
  payableAmount: number,
  spendableBalance: number,
  channel: WalletChannel,
): number {
  if (payableAmount <= 0 || spendableBalance <= 0) return 0;
  const percent =
    channel === 'MEMBERSHIP'
      ? WALLET_CONFIG.MEMBERSHIP_USAGE_PERCENT
      : WALLET_CONFIG.SERVICE_USAGE_PERCENT;
  const maxFromOrder = roundMoney(payableAmount * percent);
  return roundMoney(Math.min(spendableBalance, maxFromOrder));
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
): Promise<WalletAccount> {
  const nowIso = new Date().toISOString();
  const { data: expiredCredits } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, amount, expires_at')
    .eq('customer_id', customerId)
    .eq('transaction_type', 'CREDIT')
    .eq('source', WALLET_CONFIG.WELCOME_SOURCE)
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
      source: WALLET_CONFIG.WELCOME_SOURCE,
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

export async function getWalletSummary(supabaseAdmin: any, customerId: string) {
  let wallet = await ensureWalletAccountFull(supabaseAdmin, customerId);
  wallet = await processExpiredWelcomeCredits(supabaseAdmin, customerId, wallet);

  const { data: welcomeCredit } = await supabaseAdmin
    .from('wallet_transactions')
    .select('expires_at, created_at, amount')
    .eq('customer_id', customerId)
    .eq('transaction_type', 'CREDIT')
    .eq('source', WALLET_CONFIG.WELCOME_SOURCE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const spendableBalance = roundMoney(Number(wallet.current_balance || 0));
  return {
    wallet,
    spendable_balance: spendableBalance,
    welcome_bonus_expires_at: welcomeCredit?.expires_at || null,
    welcome_bonus_amount: Number(welcomeCredit?.amount || WALLET_CONFIG.WELCOME_BONUS_AMOUNT),
    rules: {
      service_usage_percent: WALLET_CONFIG.SERVICE_USAGE_PERCENT * 100,
      membership_usage_percent: WALLET_CONFIG.MEMBERSHIP_USAGE_PERCENT * 100,
      welcome_expiry_days: WALLET_CONFIG.WELCOME_EXPIRY_DAYS,
    },
  };
}

export async function creditWelcomeBonus(supabaseAdmin: any, customerId: string) {
  const idempotencyKey = `welcome:${customerId}`;
  const { data: existing } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id')
    .eq('customer_id', customerId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existing) return { credited: false, reason: 'already_credited' as const };

  const wallet = await ensureWalletAccountFull(supabaseAdmin, customerId);
  const amount = WALLET_CONFIG.WELCOME_BONUS_AMOUNT;
  const expiresAt = new Date(Date.now() + WALLET_CONFIG.WELCOME_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const nextBalance = roundMoney(Number(wallet.current_balance || 0) + amount);

  const { error } = await supabaseAdmin.from('wallet_transactions').insert({
    wallet_account_id: wallet.id,
    customer_id: customerId,
    transaction_type: 'CREDIT',
    amount,
    balance_after: nextBalance,
    source: WALLET_CONFIG.WELCOME_SOURCE,
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
) {
  if (!useWallet || payableAmount <= 0) {
    return { deduction: 0, blocked: false, spendable_balance: 0 };
  }

  const eligibility = await getWalletVehicleEligibility(supabaseAdmin, customerId, vehicleNumber);
  if (eligibility.blocked) {
    return { deduction: 0, blocked: true, reason: eligibility.reason, spendable_balance: 0 };
  }

  const summary = await getWalletSummary(supabaseAdmin, customerId);
  const deduction = calculateMaxWalletUsage(payableAmount, summary.spendable_balance, channel);
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
  },
) {
  const deduction = roundMoney(amount);
  if (deduction <= 0) return { debited: 0, balance_after: 0 };

  const eligibility = await getWalletVehicleEligibility(supabaseAdmin, customerId, opts.vehicleNumber);
  if (eligibility.blocked) {
    throw new Error(eligibility.reason || 'Wallet cannot be used for this vehicle');
  }

  const summary = await getWalletSummary(supabaseAdmin, customerId);
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

  const cashbackRaw = roundMoney(billAmount * WALLET_CONFIG.MEMBERSHIP_CASHBACK_RATE);
  const cashbackAmount = roundMoney(Math.min(cashbackRaw, WALLET_CONFIG.MEMBERSHIP_CASHBACK_MAX));
  if (cashbackAmount <= 0) return { credited: false, reason: 'zero_cashback' as const };

  const idempotencyKey = `membership-cashback:invoice:${opts.invoiceId}`;
  const result = await creditWallet(supabaseAdmin, opts.customerId, cashbackAmount, {
    source: WALLET_CONFIG.MEMBERSHIP_CASHBACK_SOURCE,
    idempotencyKey,
    sourceRefId: opts.invoiceId,
    metadata: {
      label: 'Membership Cashback',
      bill_amount: billAmount,
      cashback_rate: '5%',
      max_cap: WALLET_CONFIG.MEMBERSHIP_CASHBACK_MAX,
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
