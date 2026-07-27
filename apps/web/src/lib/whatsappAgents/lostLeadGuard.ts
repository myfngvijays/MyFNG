import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { normalizeCustomerPhone } from '@/lib/customer-service-leads';
import { clearFlowSession, upsertFlowSession } from '@/lib/whatsappBotFlow/sessionStore';

/**
 * True when the canonical CRM lead for this phone is Lost (REJECTED / last_call LOST).
 * Used to stop WhatsApp bot booking after telecaller marks Lost.
 */
export async function isPhoneLeadLost(phone: string | null | undefined): Promise<boolean> {
  const phone10 = normalizeCustomerPhone(phone);
  if (!phone10) return false;

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return false;

  try {
    let query = supabaseAdmin
      .from('service_leads')
      .select('id, status, coupon_meta')
      .or(
        `customer_phone.eq.${phone10},customer_phone.eq.91${phone10},customer_phone.ilike.%${phone10}`,
      )
      .order('created_at', { ascending: true })
      .limit(1);

    query = query.is('deleted_at', null);
    let { data, error } = await query.maybeSingle();
    if (error && /deleted_at/i.test(String(error.message || ''))) {
      ({ data, error } = await supabaseAdmin
        .from('service_leads')
        .select('id, status, coupon_meta')
        .or(
          `customer_phone.eq.${phone10},customer_phone.eq.91${phone10},customer_phone.ilike.%${phone10}`,
        )
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle());
    }
    if (error || !data) return false;

    const status = String(data.status || '').toUpperCase();
    if (status === 'REJECTED') return true;
    const result = String(
      (data.coupon_meta as any)?.last_call_result || '',
    ).toUpperCase();
    return result === 'LOST';
  } catch {
    return false;
  }
}

/** Stop mid-flow WhatsApp bot after telecaller marks Lost. */
export async function stopWhatsAppBotForLostLead(phone: string | null | undefined): Promise<void> {
  const phone10 = normalizeCustomerPhone(phone);
  if (!phone10) return;
  try {
    // Drop active flow steps (location / fuel / service collection)
    await clearFlowSession(phone10);
    // Mark handoff so executor won't restart a flow (sessionStore normalizes to 91…)
    await upsertFlowSession({
      phone: phone10,
      status: 'HANDOFF',
      variables: { lost_stop: true, stopped_at: new Date().toISOString() },
    });
  } catch (err) {
    console.warn('[lost-lead-guard] stop bot failed:', err);
  }
}
