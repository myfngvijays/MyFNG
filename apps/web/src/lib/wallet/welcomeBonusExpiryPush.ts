import 'server-only';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { dispatchPushToCustomer } from '@/lib/push/dispatchCustomerPush';
import { DEFAULT_WALLET_CONFIG } from '@/lib/wallet-config';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DEFAULT_LOOKAHEAD_DAYS = 15;

type AutomationRule = {
  id: string;
  template_id: string;
  schedule_mode: string;
  days_min: number;
  days_max: number;
  template?: { title?: string; body?: string; is_active?: boolean; name?: string } | null;
};

function istYmd(d: Date): string {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Whole calendar days until expiry date (IST). 0 = expires today. */
export function daysUntilExpiryIst(expiresAt: string | Date, now = new Date()): number {
  const exp = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  if (Number.isNaN(exp.getTime())) return -1;
  const today = istYmd(now);
  const expDay = istYmd(exp);
  const [ty, tm, td] = today.split('-').map(Number);
  const [ey, em, ed] = expDay.split('-').map(Number);
  const tUtc = Date.UTC(ty, tm - 1, td);
  const eUtc = Date.UTC(ey, em - 1, ed);
  return Math.round((eUtc - tUtc) / (24 * 60 * 60 * 1000));
}

function applyTemplatePlaceholders(
  text: string,
  vars: { amount: number; days_left: number },
): string {
  return String(text || '')
    .replace(/\{\{\s*amount\s*\}\}/gi, String(Math.round(vars.amount)))
    .replace(/\{\{\s*days_left\s*\}\}/gi, String(vars.days_left));
}

function buildCopyFallback(amount: number, daysLeft: number): { title: string; body: string } {
  const rupees = Math.round(amount);
  if (daysLeft === 15) {
    return {
      title: `₹${rupees} Welcome Bonus — 15 days left`,
      body: `Your MyFNG welcome bonus expires in 15 days. Book a service and use it before it expires.`,
    };
  }
  if (daysLeft === 0) {
    return {
      title: `Expires today! ₹${rupees} Welcome Bonus`,
      body: `Your welcome bonus expires today. Book now and use it before midnight.`,
    };
  }
  if (daysLeft === 1) {
    return {
      title: `Tomorrow! ₹${rupees} Welcome Bonus expires`,
      body: `Your welcome bonus expires tomorrow. Use it on your next booking today.`,
    };
  }
  return {
    title: `₹${rupees} Welcome Bonus — ${daysLeft} days left`,
    body: `Hurry! Your welcome bonus expires in ${daysLeft} days. Book now and save.`,
  };
}

/** Prefer exact once_at match over wider daily_range. */
function pickRuleForDaysLeft(rules: AutomationRule[], daysLeft: number): AutomationRule | null {
  const matches = rules.filter(
    (r) => daysLeft >= Number(r.days_min) && daysLeft <= Number(r.days_max),
  );
  if (!matches.length) return null;
  matches.sort((a, b) => {
    const spanA = Number(a.days_max) - Number(a.days_min);
    const spanB = Number(b.days_max) - Number(b.days_min);
    if (spanA !== spanB) return spanA - spanB;
    if (a.schedule_mode === 'once_at_days' && b.schedule_mode !== 'once_at_days') return -1;
    if (b.schedule_mode === 'once_at_days' && a.schedule_mode !== 'once_at_days') return 1;
    return 0;
  });
  return matches[0];
}

function copyFromRule(
  rule: AutomationRule | null,
  amount: number,
  daysLeft: number,
): { title: string; body: string } {
  const vars = { amount, days_left: daysLeft };
  const tpl = rule?.template;
  if (tpl && tpl.is_active !== false && tpl.title && tpl.body) {
    return {
      title: applyTemplatePlaceholders(String(tpl.title), vars),
      body: applyTemplatePlaceholders(String(tpl.body), vars),
    };
  }
  return buildCopyFallback(amount, daysLeft);
}

async function loadWelcomeExpiryRules(
  supabaseAdmin: NonNullable<ReturnType<typeof getSupabaseAdmin>['supabaseAdmin']>,
): Promise<{ rules: AutomationRule[]; missingTable: boolean }> {
  const { data, error } = await supabaseAdmin
    .from('push_automation_rules')
    .select(
      'id, template_id, schedule_mode, days_min, days_max, is_active, push_notification_templates(title, body, is_active, name)',
    )
    .eq('trigger_type', 'welcome_bonus_expiry')
    .eq('is_active', true);

  if (error) {
    if (String(error.message || '').includes('push_automation_rules')) {
      return { rules: [], missingTable: true };
    }
    console.warn('[welcome-expiry-push] rules load failed', error.message);
    return { rules: [], missingTable: false };
  }

  const rules: AutomationRule[] = (data || [])
    .filter((r: any) => r?.is_active !== false)
    .map((r: any) => ({
      id: String(r.id),
      template_id: String(r.template_id),
      schedule_mode: String(r.schedule_mode),
      days_min: Number(r.days_min),
      days_max: Number(r.days_max),
      template: Array.isArray(r.push_notification_templates)
        ? r.push_notification_templates[0]
        : r.push_notification_templates,
    }));

  return { rules, missingTable: false };
}

/** Legacy fallback when 293 not applied — same windows as before. */
function legacyReminderKey(daysLeft: number): string | null {
  if (daysLeft === 15) return 'd15';
  if (daysLeft >= 0 && daysLeft <= 7) return `d${daysLeft}`;
  return null;
}

export type WelcomeExpiryPushResult = {
  success: boolean;
  scanned: number;
  eligible: number;
  sent: number;
  skipped_already: number;
  skipped_no_balance: number;
  skipped_no_device: number;
  rules_loaded: number;
  using_legacy: boolean;
  errors: string[];
};

/**
 * Daily job driven by push_automation_rules (trigger = welcome_bonus_expiry).
 * Falls back to hardcoded 15d + daily 0–7d if rules table missing / empty.
 */
export async function runWelcomeBonusExpiryPush(opts?: {
  dryRun?: boolean;
  limit?: number;
}): Promise<WelcomeExpiryPushResult> {
  const dryRun = Boolean(opts?.dryRun);
  const limit = Math.min(Math.max(Number(opts?.limit) || 500, 1), 2000);
  const result: WelcomeExpiryPushResult = {
    success: true,
    scanned: 0,
    eligible: 0,
    sent: 0,
    skipped_already: 0,
    skipped_no_balance: 0,
    skipped_no_device: 0,
    rules_loaded: 0,
    using_legacy: false,
    errors: [],
  };

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { ...result, success: false, errors: ['Missing SUPABASE_SERVICE_ROLE_KEY'] };
  }

  const { rules, missingTable } = await loadWelcomeExpiryRules(supabaseAdmin);
  result.rules_loaded = rules.length;
  result.using_legacy = missingTable || rules.length === 0;

  const lookaheadDays = result.using_legacy
    ? DEFAULT_LOOKAHEAD_DAYS
    : Math.max(DEFAULT_LOOKAHEAD_DAYS, ...rules.map((r) => Number(r.days_max) || 0));

  const now = new Date();
  const nowIso = now.toISOString();
  const horizon = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);
  const source = DEFAULT_WALLET_CONFIG.WELCOME_SOURCE;

  const { data: credits, error } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, customer_id, amount, expires_at')
    .eq('transaction_type', 'CREDIT')
    .eq('source', source)
    .gt('amount', 0)
    .gt('expires_at', nowIso)
    .lte('expires_at', horizon.toISOString())
    .order('expires_at', { ascending: true })
    .limit(limit);

  if (error) {
    return { ...result, success: false, errors: [error.message] };
  }

  const rows = Array.isArray(credits) ? credits : [];
  result.scanned = rows.length;

  for (const credit of rows) {
    const customerId = String(credit.customer_id || '');
    const creditId = String(credit.id || '');
    const amount = Number(credit.amount || 0);
    const expiresAt = String(credit.expires_at || '');
    if (!customerId || !creditId || !expiresAt) continue;

    const daysLeft = daysUntilExpiryIst(expiresAt, now);
    if (daysLeft < 0) continue;

    let rule: AutomationRule | null = null;
    let reminderKey: string | null = null;

    if (!result.using_legacy) {
      rule = pickRuleForDaysLeft(rules, daysLeft);
      if (!rule) continue;
      reminderKey = `d${daysLeft}`;
    } else {
      reminderKey = legacyReminderKey(daysLeft);
      if (!reminderKey) continue;
    }

    result.eligible += 1;

    const { data: expiredRow } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id')
      .eq('customer_id', customerId)
      .eq('idempotency_key', `expire:welcome:${creditId}`)
      .maybeSingle();
    if (expiredRow) continue;

    const { data: wallet } = await supabaseAdmin
      .from('wallet_accounts')
      .select('current_balance')
      .eq('customer_id', customerId)
      .maybeSingle();
    if (!(Number(wallet?.current_balance || 0) > 0)) {
      result.skipped_no_balance += 1;
      continue;
    }

    const { data: already } = await supabaseAdmin
      .from('wallet_expiry_push_sent')
      .select('id')
      .eq('credit_txn_id', creditId)
      .eq('reminder_key', reminderKey)
      .maybeSingle();
    if (already) {
      result.skipped_already += 1;
      continue;
    }

    const copy = result.using_legacy
      ? buildCopyFallback(amount, daysLeft)
      : copyFromRule(rule, amount, daysLeft);

    if (dryRun) {
      result.sent += 1;
      continue;
    }

    try {
      const delivery = await dispatchPushToCustomer(
        customerId,
        {
          title: copy.title,
          body: copy.body,
          notificationType: 'WALLET_WELCOME_EXPIRY',
          data: {
            screen: 'wallet',
            days_left: String(daysLeft),
            credit_id: creditId,
            reminder_key: reminderKey,
            rule_id: rule?.id || '',
          },
        },
        'wallet_credits',
      );

      if (delivery.attempted === 0) {
        result.skipped_no_device += 1;
        continue;
      }

      const { error: logErr } = await supabaseAdmin.from('wallet_expiry_push_sent').insert({
        customer_id: customerId,
        credit_txn_id: creditId,
        reminder_key: reminderKey,
        amount,
        expires_at: expiresAt,
        delivered: delivery.delivered,
      });

      if (logErr) {
        if (String(logErr.code) === '23505') {
          result.skipped_already += 1;
          continue;
        }
        result.errors.push(`${customerId}: ${logErr.message}`);
        continue;
      }

      result.sent += 1;
    } catch (e: any) {
      result.errors.push(`${customerId}: ${e?.message || 'push failed'}`);
    }
  }

  if (result.errors.length > 20) result.errors = result.errors.slice(0, 20);
  return result;
}
