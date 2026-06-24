import {
  parsePostBookingMembershipOffer,
  resolvePostBookingBundleDiscount,
} from '@/lib/post-booking-membership-offer';
import { creditWallet } from '@/lib/wallet-service';
import { normalizeCustomerPhone } from '@/lib/customer-service-leads';

export type PostBookingLeadContext = {
  lead: Record<string, any>;
  serviceSubtotal: number;
  bundleDiscount: number;
};

export async function resolvePostBookingLeadContext(
  supabaseAdmin: any,
  customer: { id: string; phone?: string | null },
  leadId: string,
  serviceSubtotalInput?: number,
): Promise<{ ok: true; ctx: PostBookingLeadContext } | { ok: false; error: string; status: number }> {
  if (!leadId) return { ok: false, error: 'lead_id is required', status: 400 };

  const { data: lead, error } = await supabaseAdmin
    .from('service_leads')
    .select('id, lead_number, customer_phone, estimated_amount, actual_amount, discount_amount, meta')
    .eq('id', leadId)
    .maybeSingle();

  if (error) {
    console.error('[resolvePostBookingLeadContext] lead lookup failed:', error);
    return { ok: false, error: 'Could not load booking details', status: 500 };
  }
  if (!lead) return { ok: false, error: 'Booking not found', status: 404 };

  const meta =
    lead.meta && typeof lead.meta === 'object' ? (lead.meta as Record<string, unknown>) : {};
  const leadCustomerId = meta.customer_id ? String(meta.customer_id) : '';
  const leadPhone = normalizeCustomerPhone(String(lead.customer_phone || ''));
  const customerPhone = normalizeCustomerPhone(String(customer.phone || ''));

  if (leadCustomerId && leadCustomerId !== customer.id) {
    return { ok: false, error: 'This booking does not belong to your account', status: 403 };
  }
  if (!leadCustomerId && customerPhone && leadPhone && leadPhone !== customerPhone) {
    return { ok: false, error: 'This booking does not belong to your account', status: 403 };
  }

  const existingBundle = meta.booking_membership_bundle as Record<string, unknown> | undefined;
  if (existingBundle?.applied_at || existingBundle?.membership_id) {
    return { ok: false, error: 'Membership discount already applied to this booking', status: 400 };
  }

  const nowIso = new Date().toISOString();
  const { data: activeMembership } = await supabaseAdmin
    .from('customer_memberships')
    .select('id')
    .eq('customer_id', customer.id)
    .eq('status', 'ACTIVE')
    .gt('ends_at', nowIso)
    .limit(1)
    .maybeSingle();

  if (activeMembership) {
    return { ok: false, error: 'You already have an active membership', status: 400 };
  }

  let serviceSubtotal = Number(serviceSubtotalInput || 0);
  if (serviceSubtotal <= 0) {
    const estimated = Number(lead.estimated_amount || 0);
    const discount = Number(lead.discount_amount || 0);
    serviceSubtotal = Math.max(0, estimated + discount);
  }
  if (serviceSubtotal <= 0) {
    return { ok: false, error: 'Could not determine service amount for this booking', status: 400 };
  }

  const offer = parsePostBookingMembershipOffer(meta);
  const bundleDiscount = resolvePostBookingBundleDiscount(serviceSubtotal, offer);
  return {
    ok: true,
    ctx: {
      lead,
      serviceSubtotal,
      bundleDiscount,
    },
  };
}

export async function applyBookingMembershipBundleToLead(
  supabaseAdmin: any,
  opts: {
    customerId: string;
    leadId: string;
    membershipId: string;
    serviceSubtotal: number;
    bundleDiscount: number;
  },
) {
  const resolved = await resolvePostBookingLeadContext(
    supabaseAdmin,
    { id: opts.customerId },
    opts.leadId,
    opts.serviceSubtotal,
  );
  if (!resolved.ok) throw new Error(resolved.error);

  const { lead, bundleDiscount } = resolved.ctx;
  const discountToApply = opts.bundleDiscount > 0 ? opts.bundleDiscount : bundleDiscount;
  if (discountToApply <= 0) return { bundleDiscount: 0, walletCredit: 0 };

  const meta =
    lead.meta && typeof lead.meta === 'object'
      ? { ...(lead.meta as Record<string, unknown>) }
      : {};
  const previousAmount = Number(lead.estimated_amount || lead.actual_amount || 0);
  const previousDiscount = Number(lead.discount_amount || 0);
  const newDiscount = previousDiscount + discountToApply;
  const newAmount = Math.max(0, previousAmount - discountToApply);

  meta.booking_membership_bundle = {
    include_membership: true,
    discount_amount: discountToApply,
    post_booking: true,
    membership_id: opts.membershipId,
    applied_at: new Date().toISOString(),
    service_subtotal: opts.serviceSubtotal,
  };
  meta.customer_id = opts.customerId;

  const { error: updateError } = await supabaseAdmin
    .from('service_leads')
    .update({
      estimated_amount: newAmount,
      actual_amount: newAmount,
      discount_amount: newDiscount,
      meta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.leadId);

  if (updateError) throw new Error(updateError.message || 'Could not apply booking discount');

  let walletCredit = 0;
  const bundleMeta =
    meta.booking_membership_bundle && typeof meta.booking_membership_bundle === 'object'
      ? (meta.booking_membership_bundle as Record<string, unknown>)
      : {};
  const advancePaid = Number(
    bundleMeta.advance_paid || meta.advance_paid || meta.advance_payment || 0,
  );
  if (advancePaid > newAmount) {
    walletCredit = Math.max(0, Math.round((advancePaid - newAmount) * 100) / 100);
  }

  if (walletCredit > 0) {
    try {
      await creditWallet(supabaseAdmin, opts.customerId, walletCredit, {
        source: 'BOOKING_BUNDLE_ADJUSTMENT',
        idempotencyKey: `booking-bundle:${opts.leadId}`,
        sourceRefId: opts.leadId,
        metadata: {
          label: 'Membership booking discount adjustment',
          lead_id: opts.leadId,
          membership_id: opts.membershipId,
          bundle_discount: discountToApply,
        },
      });
    } catch (walletErr) {
      console.error('[booking-post-membership] wallet credit failed:', walletErr);
    }
  }

  return { bundleDiscount: discountToApply, walletCredit, newAmount };
}
