import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  deriveCartLabelsFromItems,
  notifyCartAbandonedWhatsApp,
  type CartAbandonmentTarget,
} from '@/lib/services/cartAbandonedWhatsApp';
import {
  isWhatsAppAutomationCronMasterEnabled,
  getAutomationSetting,
} from '@/lib/services/whatsappAutomation';

const MS_5M = 5 * 60 * 1000;
const MS_3H = 3 * 60 * 60 * 1000;
const MS_12H = 12 * 60 * 60 * 1000;

const TERMINAL_LEAD_STATUSES = new Set([
  'COMPLETED',
  'DELIVERED',
  'CLOSED',
  'CANCELLED',
  'REJECTED',
  'LOST',
  'DUPLICATE',
]);

async function hasBookedSince(
  supabaseAdmin: any,
  customerId: string,
  phone: string,
  sinceIso: string,
): Promise<boolean> {
  const phone10 = String(phone || '').replace(/\D/g, '').slice(-10);

  const [{ data: cart }, { data: draft }, { data: leads }] = await Promise.all([
    supabaseAdmin
      .from('carts')
      .select('status, updated_at')
      .eq('customer_id', customerId)
      .maybeSingle(),
    supabaseAdmin
      .from('booking_drafts')
      .select('status, completed_at')
      .eq('customer_id', customerId)
      .eq('status', 'COMPLETED')
      .gte('completed_at', sinceIso)
      .limit(1),
    phone10
      ? supabaseAdmin
          .from('service_leads')
          .select('id, status, created_at')
          .eq('customer_phone', phone10)
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  if (cart?.status === 'CHECKED_OUT' && String(cart.updated_at || '') >= sinceIso) {
    return true;
  }
  if (Array.isArray(draft) && draft.length > 0) return true;

  return (leads || []).some((lead: any) => {
    const status = String(lead.status || '').toUpperCase();
    return status && !TERMINAL_LEAD_STATUSES.has(status);
  });
}

type ReminderStage = '5m' | '3h' | '12h';

function stageDue(anchorMs: number, stage: ReminderStage, nowMs: number): boolean {
  const delays = { '5m': MS_5M, '3h': MS_3H, '12h': MS_12H };
  return nowMs >= anchorMs + delays[stage];
}

async function processTarget(
  supabaseAdmin: any,
  target: CartAbandonmentTarget,
  anchorIso: string,
  sent: { r1?: string | null; r2?: string | null; r3?: string | null },
  table: 'carts' | 'booking_drafts',
  nowMs: number,
) {
  const stats = { attempted: 0, sent: 0 };
  const anchorMs = new Date(anchorIso).getTime();
  if (!Number.isFinite(anchorMs)) return stats;

  if (await hasBookedSince(supabaseAdmin, target.customerId, target.phone, anchorIso)) {
    return stats;
  }

  const stages: Array<{ stage: ReminderStage; sentAt: string | null | undefined; col: string }> = [
    { stage: '5m', sentAt: sent.r1, col: table === 'carts' ? 'wa_cart_reminder_1_sent_at' : 'wa_reminder_1_sent_at' },
    { stage: '3h', sentAt: sent.r2, col: table === 'carts' ? 'wa_cart_reminder_2_sent_at' : 'wa_reminder_2_sent_at' },
    { stage: '12h', sentAt: sent.r3, col: table === 'carts' ? 'wa_cart_reminder_3_sent_at' : 'wa_reminder_3_sent_at' },
  ];

  for (const item of stages) {
    if (item.sentAt) continue;
    if (!stageDue(anchorMs, item.stage, nowMs)) continue;

    const setting = await getAutomationSetting(
      item.stage === '5m'
        ? 'cart_abandoned_5m'
        : item.stage === '3h'
          ? 'cart_abandoned_3h'
          : 'cart_abandoned_12h',
    );
    if (!setting?.is_enabled) continue;

    stats.attempted += 1;
    const result = await notifyCartAbandonedWhatsApp(supabaseAdmin, target, item.stage);
    if (result.sent) {
      stats.sent += 1;
      await supabaseAdmin
        .from(table)
        .update({ [item.col]: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', target.sourceId);
    }
    break;
  }

  return stats;
}

export async function runCartAbandonedReminderJob() {
  const master = await isWhatsAppAutomationCronMasterEnabled();
  if (!master) {
    return { processed: 0, sent: 0, skipped: true, reason: 'cron_master_disabled' };
  }

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { processed: 0, sent: 0, error: 'Admin client unavailable' };

  const nowMs = Date.now();
  const cutoff12h = new Date(nowMs - MS_12H - MS_5M).toISOString();

  let processed = 0;
  let sent = 0;
  let attempted = 0;

  type PendingJob = {
    target: CartAbandonmentTarget;
    anchorIso: string;
    sent: { r1?: string | null; r2?: string | null; r3?: string | null };
    table: 'carts' | 'booking_drafts';
    anchorMs: number;
  };

  const pendingByCustomer = new Map<string, PendingJob>();

  function consider(customerId: string, job: PendingJob) {
    const existing = pendingByCustomer.get(customerId);
    if (!existing || job.anchorMs > existing.anchorMs) {
      pendingByCustomer.set(customerId, job);
    }
  }

  const { data: carts } = await supabaseAdmin
    .from('carts')
    .select(
      'id, customer_id, abandonment_anchor_at, wa_cart_reminder_1_sent_at, wa_cart_reminder_2_sent_at, wa_cart_reminder_3_sent_at, customer:customer_id(id, full_name, phone)',
    )
    .eq('status', 'ACTIVE')
    .not('abandonment_anchor_at', 'is', null)
    .gte('abandonment_anchor_at', cutoff12h)
    .limit(100);

  for (const cart of carts || []) {
    const customer = (cart as any).customer;
    const phone = String(customer?.phone || '').trim();
    if (!phone) continue;

    const { data: items } = await supabaseAdmin
      .from('cart_items')
      .select('service_type, metadata')
      .eq('cart_id', cart.id)
      .limit(5);
    if (!items?.length) continue;

    const { carLabel, serviceLabel } = deriveCartLabelsFromItems(items);
    const anchorMs = new Date(cart.abandonment_anchor_at).getTime();
    if (!Number.isFinite(anchorMs)) continue;

    consider(cart.customer_id, {
      target: {
        source: 'cart',
        sourceId: cart.id,
        customerId: cart.customer_id,
        phone,
        customerName: customer?.full_name,
        carLabel,
        serviceLabel,
      },
      anchorIso: cart.abandonment_anchor_at,
      sent: {
        r1: cart.wa_cart_reminder_1_sent_at,
        r2: cart.wa_cart_reminder_2_sent_at,
        r3: cart.wa_cart_reminder_3_sent_at,
      },
      table: 'carts',
      anchorMs,
    });
  }

  const { data: drafts } = await supabaseAdmin
    .from('booking_drafts')
    .select(
      'id, customer_id, customer_phone, customer_name, car_label, service_label, last_activity_at, wa_reminder_1_sent_at, wa_reminder_2_sent_at, wa_reminder_3_sent_at',
    )
    .eq('status', 'ACTIVE')
    .not('customer_phone', 'is', null)
    .gte('last_activity_at', cutoff12h)
    .limit(100);

  for (const draft of drafts || []) {
    const phone = String(draft.customer_phone || '').trim();
    if (!phone) continue;
    const anchorMs = new Date(draft.last_activity_at).getTime();
    if (!Number.isFinite(anchorMs)) continue;

    consider(draft.customer_id, {
      target: {
        source: 'booking_draft',
        sourceId: draft.id,
        customerId: draft.customer_id,
        phone,
        customerName: draft.customer_name,
        carLabel: String(draft.car_label || 'Your vehicle'),
        serviceLabel: String(draft.service_label || 'Car Service'),
      },
      anchorIso: draft.last_activity_at,
      sent: {
        r1: draft.wa_reminder_1_sent_at,
        r2: draft.wa_reminder_2_sent_at,
        r3: draft.wa_reminder_3_sent_at,
      },
      table: 'booking_drafts',
      anchorMs,
    });
  }

  for (const job of pendingByCustomer.values()) {
    processed += 1;
    const result = await processTarget(
      supabaseAdmin,
      job.target,
      job.anchorIso,
      job.sent,
      job.table,
      nowMs,
    );
    attempted += result.attempted;
    sent += result.sent;
  }

  return { processed, attempted, sent };
}
