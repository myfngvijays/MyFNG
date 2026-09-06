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

export type ResolvePostBookingLeadOptions = {
  /** After subscribe the new Prime row is already ACTIVE — skip that purchase-time guard. */
  skipActiveMembershipCheck?: boolean;
  ignoreMembershipId?: string | null;
};

function parseLeadMeta(lead: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return lead?.meta && typeof lead.meta === 'object' && !Array.isArray(lead.meta)
    ? { ...(lead.meta as Record<string, unknown>) }
    : {};
}

function stampPaidBookingMembershipBundle(
  meta: Record<string, unknown>,
  opts: {
    membershipId: string;
    customerId: string;
    appliedAt: string;
    discountAmount: number;
    serviceSubtotal: number;
    existingBundle?: Record<string, unknown>;
  },
) {
  const nextBundle = { ...(opts.existingBundle || {}) };
  delete nextBundle.expired_at;
  meta.booking_membership_bundle = {
    ...nextBundle,
    include_membership: true,
    discount_amount: opts.discountAmount,
    post_booking: true,
    membership_id: opts.membershipId,
    applied_at: opts.appliedAt,
    service_subtotal: opts.serviceSubtotal,
  };
  meta.customer_id = opts.customerId;
  const offer = meta.post_booking_membership_offer;
  if (offer && typeof offer === 'object' && !Array.isArray(offer)) {
    const nextOffer = { ...(offer as Record<string, unknown>) };
    delete nextOffer.expired_at;
    meta.post_booking_membership_offer = nextOffer;
  }
}

export async function resolvePostBookingLeadContext(
  supabaseAdmin: any,
  customer: { id: string; phone?: string | null },
  leadId: string,
  serviceSubtotalInput?: number,
  options?: ResolvePostBookingLeadOptions,
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

  if (!options?.skipActiveMembershipCheck) {
    const nowIso = new Date().toISOString();
    let activeQuery = supabaseAdmin
      .from('customer_memberships')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('status', 'ACTIVE')
      .gt('ends_at', nowIso);
    if (options?.ignoreMembershipId) {
      activeQuery = activeQuery.neq('id', options.ignoreMembershipId);
    }
    const { data: activeMembership } = await activeQuery.limit(1).maybeSingle();

    if (activeMembership) {
      return { ok: false, error: 'You already have an active membership', status: 400 };
    }
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
    {
      skipActiveMembershipCheck: true,
      ignoreMembershipId: opts.membershipId,
    },
  );
  if (!resolved.ok) throw new Error(resolved.error);

  const { lead, bundleDiscount } = resolved.ctx;
  const discountToApply = opts.bundleDiscount > 0 ? opts.bundleDiscount : bundleDiscount;
  if (discountToApply <= 0) return { bundleDiscount: 0, walletCredit: 0 };

  const meta = parseLeadMeta(lead);
  const previousAmount = Number(lead.estimated_amount || lead.actual_amount || 0);
  const previousDiscount = Number(lead.discount_amount || 0);
  const existingBundle = meta.booking_membership_bundle as Record<string, unknown> | undefined;
  const alreadyDiscountedAtBooking =
    Boolean(existingBundle?.include_membership) &&
    Number(existingBundle?.discount_amount || 0) > 0 &&
    !existingBundle?.applied_at &&
    !existingBundle?.membership_id;
  const appliedAt = new Date().toISOString();

  if (alreadyDiscountedAtBooking) {
    stampPaidBookingMembershipBundle(meta, {
      membershipId: opts.membershipId,
      customerId: opts.customerId,
      appliedAt,
      discountAmount: Number(existingBundle?.discount_amount || discountToApply),
      serviceSubtotal: opts.serviceSubtotal,
      existingBundle,
    });

    const { error: updateError } = await supabaseAdmin
      .from('service_leads')
      .update({
        meta,
        updated_at: appliedAt,
      })
      .eq('id', opts.leadId);

    if (updateError) throw new Error(updateError.message || 'Could not apply booking discount');

    return {
      bundleDiscount: Number(existingBundle?.discount_amount || discountToApply),
      walletCredit: 0,
      newAmount: previousAmount,
    };
  }

  const newDiscount = previousDiscount + discountToApply;
  const newAmount = Math.max(0, previousAmount - discountToApply);

  stampPaidBookingMembershipBundle(meta, {
    membershipId: opts.membershipId,
    customerId: opts.customerId,
    appliedAt,
    discountAmount: discountToApply,
    serviceSubtotal: opts.serviceSubtotal || Number(existingBundle?.service_subtotal || 0),
    existingBundle,
  });

  const { error: updateError } = await supabaseAdmin
    .from('service_leads')
    .update({
      estimated_amount: newAmount,
      actual_amount: newAmount,
      discount_amount: newDiscount,
      meta,
      updated_at: appliedAt,
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

export async function loadPaidMembershipIdsBySourceLead(
  supabaseAdmin: any,
  leadIds: string[],
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(leadIds.map((id) => String(id || '').trim()).filter(Boolean)));
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('customer_memberships')
    .select('id, source_lead_id')
    .in('source_lead_id', ids)
    .eq('status', 'ACTIVE')
    .gt('ends_at', nowIso);
  if (error) return map;
  for (const row of data || []) {
    const leadId = String((row as { source_lead_id?: string }).source_lead_id || '').trim();
    const membershipId = String((row as { id?: string }).id || '').trim();
    if (leadId && membershipId) map.set(leadId, membershipId);
  }
  return map;
}

/**
 * If the customer already paid Prime for this booking (source_lead_id) but the
 * bundle was never locked (subscribe applied after insert), attach the discount
 * instead of treating the offer as unpaid.
 */
export async function relinkPaidPostBookingMembershipIfNeeded(
  supabaseAdmin: any,
  lead: Record<string, unknown>,
  options?: { knownMembershipId?: string | null; skipLookup?: boolean },
): Promise<boolean> {
  const leadId = String(lead.id || '').trim();
  const meta = parseLeadMeta(lead);
  const bundle = meta.booking_membership_bundle as Record<string, unknown> | undefined;
  if (!leadId) return false;
  if (bundle?.applied_at || bundle?.membership_id) return false;

  const customerId = String(meta.customer_id || '').trim();
  if (!customerId) return false;

  let membershipId = String(options?.knownMembershipId || '').trim();
  if (!membershipId) {
    if (options?.skipLookup) return false;
    const nowIso = new Date().toISOString();
    const { data: membership, error } = await supabaseAdmin
      .from('customer_memberships')
      .select('id')
      .eq('customer_id', customerId)
      .eq('source_lead_id', leadId)
      .eq('status', 'ACTIVE')
      .gt('ends_at', nowIso)
      .maybeSingle();
    if (error || !membership?.id) return false;
    membershipId = String(membership.id);
  }

  const offer =
    meta.post_booking_membership_offer && typeof meta.post_booking_membership_offer === 'object'
      ? (meta.post_booking_membership_offer as Record<string, unknown>)
      : {};
  const bundleDiscount = Number(offer.bundle_discount || bundle?.discount_amount || 0);
  const serviceSubtotal = Number(
    meta.service_subtotal || offer.service_subtotal || bundle?.service_subtotal || 0,
  );
  if (bundleDiscount <= 0) return false;

  try {
    const applied = await applyBookingMembershipBundleToLead(supabaseAdmin, {
      customerId,
      leadId,
      membershipId,
      serviceSubtotal,
      bundleDiscount,
    });
    const { data: refreshed } = await supabaseAdmin
      .from('service_leads')
      .select('estimated_amount, actual_amount, discount_amount, meta')
      .eq('id', leadId)
      .maybeSingle();
    if (refreshed) {
      lead.estimated_amount = refreshed.estimated_amount;
      lead.actual_amount = refreshed.actual_amount;
      lead.discount_amount = refreshed.discount_amount;
      lead.meta = refreshed.meta;
    } else if (applied.newAmount != null) {
      lead.estimated_amount = applied.newAmount;
      lead.actual_amount = applied.newAmount;
    }
    return true;
  } catch (err: any) {
    if (/already applied/i.test(String(err?.message || ''))) return true;
    console.error('[relinkPaidPostBookingMembershipIfNeeded]', err?.message || err);
    // Paid Prime exists for this booking — never strip the offer as unpaid.
    return true;
  }
}
