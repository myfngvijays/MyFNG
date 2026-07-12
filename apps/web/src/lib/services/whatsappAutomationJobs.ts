import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { notifyBookingIncompleteWhatsApp } from '@/lib/services/bookingIncompleteWhatsApp';
import { sendAutomationWhatsApp } from '@/lib/services/whatsappAutomation';
import { getAutomationTemplateExamples } from '@/lib/services/whatsappAutomationMeta';
import { notifyMembershipPaymentFailedWhatsApp } from '@/lib/services/membershipPaymentWhatsApp';

const ADMIN_WHATSAPP_NUMBERS = (process.env.SYSTEM_ALERT_WHATSAPP_NUMBERS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getIstDayBounds(reference = new Date()) {
  const istNow = new Date(reference.getTime() + IST_OFFSET_MS);
  const istMidnight = new Date(
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate())
  );
  const startUtc = new Date(istMidnight.getTime() - IST_OFFSET_MS);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc, endUtc };
}

function formatIstDate(date = new Date()) {
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatIstDateFromIso(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return formatIstDate(date);
}

export async function runBookingIncompleteReminderJob() {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { processed: 0, sent: 0, error: 'Admin client unavailable' };

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('booking_drafts')
    .select(
      'id, customer_id, customer_phone, customer_name, car_label, service_label, draft_payload, last_activity_at'
    )
    .eq('status', 'ACTIVE')
    .lte('last_activity_at', cutoff)
    .not('customer_phone', 'is', null)
    .limit(100);

  if (error) return { processed: 0, sent: 0, error: error.message };

  let sent = 0;
  for (const row of data || []) {
    const result = await notifyBookingIncompleteWhatsApp(row);
    if (result.sent) {
      sent += 1;
      await supabaseAdmin
        .from('booking_drafts')
        .update({
          status: 'ABANDONED_NOTIFIED',
          reminder_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    }
  }

  return { processed: (data || []).length, sent };
}

export async function runAdminDailySummaryJob(force = false) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { sent: 0, error: 'Admin client unavailable' };
  if (ADMIN_WHATSAPP_NUMBERS.length === 0) {
    return { sent: 0, error: 'SYSTEM_ALERT_WHATSAPP_NUMBERS not configured' };
  }

  const now = new Date();
  const istHour = Number(
    now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false })
  );
  if (!force && istHour !== 9) {
    return { sent: 0, skipped: true, reason: 'outside_9am_ist_window' };
  }

  const { startUtc, endUtc } = getIstDayBounds(now);
  const startIso = startUtc.toISOString();
  const endIso = endUtc.toISOString();

  const [
    bookingsRes,
    membershipRes,
    invoicesRes,
    pendingPickupsRes,
    failedPaymentsRes,
  ] = await Promise.all([
    supabaseAdmin
      .from('service_leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabaseAdmin
      .from('customer_memberships')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .eq('source', 'PURCHASE'),
    supabaseAdmin
      .from('invoices')
      .select('paid_amount, final_amount')
      .eq('payment_status', 'PAID')
      .gte('paid_at', startIso)
      .lt('paid_at', endIso),
    supabaseAdmin
      .from('service_leads')
      .select('id', { count: 'exact', head: true })
      .in('status', ['ACCEPTED', 'TEAM_ASSIGNED', 'PICKUP_SCHEDULED', 'PICKUP_ASSIGNED', 'PICKUP_IN_PROGRESS'])
      .eq('pickup_required', true),
    supabaseAdmin
      .from('customer_analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_name', 'membership_payment_failed')
      .gte('created_at', startIso)
      .lt('created_at', endIso),
  ]);

  const revenue = (invoicesRes.data || []).reduce((sum, row) => {
    const paid = Number((row as { paid_amount?: number; final_amount?: number }).paid_amount ?? 0);
    const finalAmount = Number((row as { final_amount?: number }).final_amount ?? 0);
    return sum + (paid > 0 ? paid : finalAmount);
  }, 0);

  const examples = await getAutomationTemplateExamples('admin_daily_summary');
  const templateParams = [
    formatIstDate(now),
    String(bookingsRes.count ?? 0),
    String(membershipRes.count ?? 0),
    String(Math.round(revenue)),
    String(pendingPickupsRes.count ?? 0),
    String(failedPaymentsRes.count ?? 0),
  ].map((value, index) => value || examples[index] || '0');

  let sent = 0;
  for (const phone of ADMIN_WHATSAPP_NUMBERS) {
    const result = await sendAutomationWhatsApp({
      triggerKey: 'admin_daily_summary',
      phone,
      templateParams,
      payload: { templateParams, summary_date: templateParams[0] },
    });
    if (result.sent) sent += 1;
  }

  return {
    sent,
    recipients: ADMIN_WHATSAPP_NUMBERS.length,
    stats: {
      bookings: templateParams[1],
      memberships: templateParams[2],
      revenue: templateParams[3],
      pending_pickups: templateParams[4],
      failed_payments: templateParams[5],
    },
  };
}

export async function runServiceDueReminderJob() {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { processed: 0, sent: 0, error: 'Admin client unavailable' };

  const dueBefore = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('service_leads')
    .select(
      'id, customer_id, customer_phone, customer_name, vehicle_make, vehicle_model, vehicle_number, completed_at, service_type, status'
    )
    .in('status', ['COMPLETED', 'DELIVERED', 'DELIVERED_TO_CUSTOMER', 'CLOSED'])
    .not('customer_phone', 'is', null)
    .not('completed_at', 'is', null)
    .lte('completed_at', dueBefore)
    .order('completed_at', { ascending: false })
    .limit(500);

  if (error) return { processed: 0, sent: 0, error: error.message };

  const latestByKey = new Map<string, (typeof data)[number]>();
  for (const row of data || []) {
    const phone = String(row.customer_phone || '').trim();
    const reg = String(row.vehicle_number || 'NA').trim().toUpperCase();
    if (!phone) continue;
    const key = `${phone}:${reg}`;
    if (!latestByKey.has(key)) latestByKey.set(key, row);
  }

  let sent = 0;
  let processed = 0;
  for (const row of latestByKey.values()) {
    processed += 1;
    const phone = String(row.customer_phone || '').trim();
    const customerName = String(row.customer_name || 'Customer').trim() || 'Customer';
    const car = [row.vehicle_make, row.vehicle_model]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim() || 'Your vehicle';
    const reg = String(row.vehicle_number || 'NA').trim().toUpperCase();
    const lastServiceDate = formatIstDateFromIso(String(row.completed_at || ''));

    const result = await sendAutomationWhatsApp({
      triggerKey: 'service_due_reminder',
      phone,
      customerId: row.customer_id || null,
      templateParams: [customerName, car, reg, lastServiceDate],
      payload: {
        lead_id: row.id,
        last_service_at: row.completed_at,
      },
    });
    if (result.sent) sent += 1;
  }

  return { processed, sent };
}

export async function runMembershipExpiringReminderJob() {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { processed: 0, sent: 0, error: 'Admin client unavailable' };

  const nowIso = new Date().toISOString();
  const weekAheadIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('customer_memberships')
    .select('id, customer_id, ends_at, plan:membership_plans(name), customer:customers(full_name, phone)')
    .eq('status', 'ACTIVE')
    .gt('ends_at', nowIso)
    .lte('ends_at', weekAheadIso)
    .limit(200);

  if (error) return { processed: 0, sent: 0, error: error.message };

  let sent = 0;
  for (const row of data || []) {
    const customer = (row as { customer?: { full_name?: string; phone?: string } }).customer;
    const phone = String(customer?.phone || '').trim();
    if (!phone) continue;

    const customerName = String(customer?.full_name || 'Customer').trim() || 'Customer';
    const expiryDate = formatIstDateFromIso(String(row.ends_at || ''));

    const result = await sendAutomationWhatsApp({
      triggerKey: 'membership_expiring',
      phone,
      customerId: row.customer_id || null,
      templateParams: [customerName, expiryDate],
      payload: {
        membership_id: row.id,
        ends_at: row.ends_at,
      },
    });
    if (result.sent) sent += 1;
  }

  return { processed: (data || []).length, sent };
}

export async function notifyAppSessionIncompleteWhatsApp(input: {
  customerId: string;
  phone: string;
  customerName?: string | null;
  sessionDurationSec: number;
}) {
  const examples = await getAutomationTemplateExamples('app_session_incomplete');
  const customerName = String(input.customerName || examples[0] || 'Customer').trim() || 'Customer';

  return sendAutomationWhatsApp({
    triggerKey: 'app_session_incomplete',
    phone: input.phone,
    customerId: input.customerId,
    templateParams: [customerName],
    payload: {
      session_duration_sec: input.sessionDurationSec,
    },
  });
}

export { notifyMembershipPaymentFailedWhatsApp };
