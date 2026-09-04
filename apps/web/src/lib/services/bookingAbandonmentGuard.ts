/**
 * Shared guards for cart/booking-draft WhatsApp reminders.
 * Full service bookings must suppress incomplete/abandoned reminders.
 */

const NON_BOOKING_LEAD_STATUSES = new Set([
  'CANCELLED',
  'REJECTED',
  'LOST',
  'DUPLICATE',
]);

function phone10(raw: string | null | undefined): string {
  return String(raw || '').replace(/\D/g, '').slice(-10);
}

/** True if this lead is a real booking (not an incomplete WhatsApp enquiry stub). */
export function isRealServiceBookingLead(lead: {
  status?: string | null;
  is_incomplete?: boolean | null;
  lead_source?: string | null;
  service_type?: string | null;
  coupon_meta?: Record<string, unknown> | null;
}): boolean {
  const status = String(lead?.status || '').toUpperCase();
  if (!status || NON_BOOKING_LEAD_STATUSES.has(status)) return false;
  if (lead?.is_incomplete === true) return false;

  const meta =
    lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
  // WhatsApp chat / TeleCRM enquiry stubs are not full app/website bookings.
  if (meta.whatsapp_enquiry || meta.telecrm_whatsapp) return false;

  const service = String(lead?.service_type || '').toLowerCase();
  if (service.includes('whatsapp enquiry')) return false;

  return true;
}

/**
 * Did this customer complete (or start) a real booking after `sinceIso`?
 * Used to skip cart-abandoned / booking-incomplete WhatsApp reminders.
 */
export async function customerHasFullBookingSince(
  supabaseAdmin: any,
  opts: { customerId: string; phone?: string | null; sinceIso: string },
): Promise<boolean> {
  const customerId = String(opts.customerId || '').trim();
  const sinceIso = String(opts.sinceIso || '').trim();
  if (!customerId || !sinceIso) return false;

  const phone = phone10(opts.phone);

  const [{ data: cart }, { data: completedDrafts }, byCustomer, byPhone] = await Promise.all([
    supabaseAdmin
      .from('carts')
      .select('status, updated_at')
      .eq('customer_id', customerId)
      .maybeSingle(),
    supabaseAdmin
      .from('booking_drafts')
      .select('id')
      .eq('customer_id', customerId)
      .eq('status', 'COMPLETED')
      .gte('completed_at', sinceIso)
      .limit(1),
    supabaseAdmin
      .from('service_leads')
      .select('id, status, is_incomplete, coupon_meta, lead_source, service_type, created_at')
      .eq('customer_id', customerId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(20),
    phone
      ? supabaseAdmin
          .from('service_leads')
          .select('id, status, is_incomplete, coupon_meta, lead_source, service_type, created_at, customer_phone')
          .or(
            [
              `customer_phone.eq.${phone}`,
              `customer_phone.eq.91${phone}`,
              `customer_phone.eq.+91${phone}`,
              `customer_phone.ilike.%${phone}`,
            ].join(','),
          )
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  if (cart?.status === 'CHECKED_OUT' && String(cart.updated_at || '') >= sinceIso) {
    return true;
  }
  if (Array.isArray(completedDrafts) && completedDrafts.length > 0) return true;

  const leads = [...(byCustomer.data || []), ...(byPhone.data || [])];
  const seen = new Set<string>();
  for (const lead of leads) {
    const id = String(lead?.id || '');
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    if (isRealServiceBookingLead(lead)) return true;
  }

  return false;
}

/** Mark active booking drafts (+ optional cart) completed after a successful booking. */
export async function markCustomerBookingAbandonedCleared(
  supabaseAdmin: any,
  opts: { customerId?: string | null; phone?: string | null },
): Promise<void> {
  const now = new Date().toISOString();
  const customerId = String(opts.customerId || '').trim();
  const phone = phone10(opts.phone);

  try {
    if (customerId) {
      await supabaseAdmin
        .from('booking_drafts')
        .update({
          status: 'COMPLETED',
          completed_at: now,
          updated_at: now,
        })
        .eq('customer_id', customerId)
        .eq('status', 'ACTIVE');

      await supabaseAdmin
        .from('carts')
        .update({
          status: 'CHECKED_OUT',
          updated_at: now,
        })
        .eq('customer_id', customerId)
        .eq('status', 'ACTIVE');
    } else if (phone) {
      await supabaseAdmin
        .from('booking_drafts')
        .update({
          status: 'COMPLETED',
          completed_at: now,
          updated_at: now,
        })
        .or(
          [
            `customer_phone.eq.${phone}`,
            `customer_phone.eq.91${phone}`,
            `customer_phone.eq.+91${phone}`,
            `customer_phone.ilike.%${phone}`,
          ].join(','),
        )
        .eq('status', 'ACTIVE');
    }
  } catch (err) {
    console.warn('[bookingAbandonmentGuard] clear drafts failed:', (err as Error)?.message || err);
  }
}
