import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logCustomerEvent } from '@/lib/customer-api';
import type { CustomerRow } from '@/lib/customer-session';
import { validateCouponForCheckout, redeemCouponAtomic } from '@/lib/coupon-service';
import {
  validateMembershipClaim,
  recordMembershipClaimUsage,
} from '@/lib/membership-benefits-service';
import { calculateBookingMembershipBundleDiscount } from '@/lib/booking-membership-discount';
import {
  buildPostBookingMembershipOffer,
} from '@/lib/post-booking-membership-offer';
import {
  calculateBundleDiscountWithConfig,
  getPostBookingMembershipConfig,
} from '@/lib/post-booking-membership-config';
import { normalizeCustomerPhone, toServiceLeadType, findCustomerByPhone } from '@/lib/customer-service-leads';
import { pushServiceLeadToTeleCRM, saveBookedVehicleToProfile } from '@/lib/booking-telecrm-sync';
import {
  debitServiceBookingWallet,
  resolveBookingServiceLabel,
  resolveServiceBookingWallet,
} from '@/lib/booking-wallet-apply';
import {
  redeemReferralVoucherClaim,
  resolveReferralVoucherForBooking,
} from '@/lib/referral-voucher-apply';
import { notifyBookingConfirmedWhatsApp } from '@/lib/services/bookingConfirmedWhatsApp';
import { extractUtmFromUnknown, mergeUtmParams, parseUtmFromRequest } from '@/lib/utm';
import { mergeLeadMetaWithUtm } from '@/lib/telecrm/utmFields';
import { upsertBookingServiceLead } from '@/lib/service-lead-reopen';

function generateLeadNumber() {
  return `L-${Date.now().toString().slice(-8)}`;
}

function pickLeadFields(lead: Record<string, unknown>) {
  return {
    city: lead.city ?? null,
    city_id: lead.city_id ?? null,
    model_id: lead.model_id ?? null,
    vehicle_make: lead.vehicle_make ?? null,
    vehicle_model: lead.vehicle_model ?? null,
    vehicle_variant: lead.vehicle_variant ?? null,
    service_type_ids: lead.service_type_ids ?? null,
    subservice_ids: lead.subservice_ids ?? null,
    pickup_required: lead.pickup_required ?? null,
    workshop_id: lead.workshop_id ?? null,
    address: lead.address ?? null,
    customer_address: lead.customer_address ?? null,
    pickup_address: lead.pickup_address ?? null,
    preferred_slot_start: lead.preferred_slot_start ?? null,
    preferred_date: lead.preferred_date ?? null,
    preferred_time_slot: lead.preferred_time_slot ?? null,
    lead_source: lead.lead_source ?? null,
    payment_mode: lead.payment_mode ?? null,
    payment_status: lead.payment_status ?? null,
  };
}

export async function createAuthenticatedServiceBooking(
  request: NextRequest,
  ctx: { customer: CustomerRow; supabaseAdmin: any },
  body: Record<string, any>,
) {
  const { customer, supabaseAdmin } = ctx;
  const lead = body?.lead || {};
  const requestUtm = parseUtmFromRequest(request);
  const leadUtm = extractUtmFromUnknown(lead);
  const bodyUtm = extractUtmFromUnknown(body);
  const resolvedUtm = mergeUtmParams(requestUtm, leadUtm, bodyUtm);
  const useWallet = Boolean(body.use_wallet);
  const subtotal = Number(body.subtotal || lead.estimated_amount || 0);
  const pbConfig = await getPostBookingMembershipConfig(supabaseAdmin);

  let couponDiscount = Number(body.discount_amount || lead.discount_amount || 0);
  let couponCode: string | null = lead.coupon_code || null;
  let couponMeta: Record<string, unknown> | null = lead.coupon_meta || null;
  let membershipBundleDiscount = 0;
  let referralClaimId = String(body.referral_reward_claim_id || '').trim();

  if (body?.coupon?.code) {
    const channel = String(body?.coupon?.lead_context?.channel || 'MOBILE').toUpperCase();
    const rawCityId = body?.coupon?.lead_context?.city_id;
    const cityId =
      rawCityId && typeof rawCityId === 'object' && 'id' in (rawCityId as object)
        ? String((rawCityId as { id?: string }).id || '')
        : rawCityId
          ? String(rawCityId)
          : null;
    const couponResult = await validateCouponForCheckout(
      supabaseAdmin,
      String(body.coupon.code || ''),
      {
        ...(body.coupon.lead_context || {}),
        subtotal,
        city_id: cityId,
        customer_id: customer.id,
        customer_phone: body?.coupon?.lead_context?.customer_phone || customer.phone,
        channel,
      },
      { serviceBooking: true },
    );

    if (!couponResult.valid) {
      return NextResponse.json({ error: couponResult.error }, { status: 400 });
    }

    couponCode = String(couponResult.coupon.code || '');
    couponDiscount = couponResult.discountAmount;
    couponMeta = couponResult.couponMeta;
  }

  if (!referralClaimId && couponMeta?.referral_claim_id) {
    referralClaimId = String(couponMeta.referral_claim_id).trim();
  }

  const includeBookingMembership = Boolean(body.include_booking_membership);
  if (includeBookingMembership && subtotal > 0) {
    const nowIso = new Date().toISOString();
    const { data: activeMembership } = await supabaseAdmin
      .from('customer_memberships')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('status', 'ACTIVE')
      .gt('ends_at', nowIso)
      .limit(1)
      .maybeSingle();

    if (!activeMembership) {
      membershipBundleDiscount = calculateBundleDiscountWithConfig(subtotal, pbConfig);
    }
  }

  const nowIso = new Date().toISOString();
  const { data: activeMembershipForOffer } = await supabaseAdmin
    .from('customer_memberships')
    .select('id')
    .eq('customer_id', customer.id)
    .eq('status', 'ACTIVE')
    .gt('ends_at', nowIso)
    .limit(1)
    .maybeSingle();
  const postBookingMembershipOffer =
    pbConfig.enabled && !activeMembershipForOffer && subtotal > 0
      ? buildPostBookingMembershipOffer(subtotal, pbConfig)
      : null;

  const totalDiscountBeforeReferral = couponDiscount + membershipBundleDiscount;
  const payableBeforeReferral = Math.max(0, subtotal - totalDiscountBeforeReferral);

  let referralVoucherDiscount = 0;
  let referralClaimMeta: Record<string, unknown> | null = null;

  if (referralClaimId) {
    const voucherResult = await resolveReferralVoucherForBooking(
      supabaseAdmin,
      customer.id,
      referralClaimId,
      payableBeforeReferral,
    );
    if (voucherResult.error) {
      return NextResponse.json({ error: voucherResult.error }, { status: 400 });
    }
    referralVoucherDiscount = couponMeta?.referral_reward ? 0 : voucherResult.discount;
    referralClaimMeta = voucherResult.claim;
    if (referralClaimId && useWallet) {
      return NextResponse.json(
        {
          error:
            'Wallet balance cannot be used when a referral reward voucher is applied. Turn off wallet or remove the voucher.',
        },
        { status: 400 },
      );
    }
  }

  const totalDiscount = totalDiscountBeforeReferral + referralVoucherDiscount;
  const payableBeforeWallet = Math.max(0, subtotal - totalDiscount);
  const vehicleNumber = String(lead.vehicle_number || body.vehicle_number || '').trim();

  const walletResult = await resolveServiceBookingWallet(supabaseAdmin, customer.id, request, {
    ...body,
    referral_voucher_discount: referralVoucherDiscount,
  }, {
    subtotal,
    couponDiscount,
    membershipBundleDiscount,
    vehicleNumber,
    useWallet,
  });

  if (walletResult.blocked && useWallet) {
    return NextResponse.json({ error: walletResult.reason || 'Wallet cannot be used for this vehicle' }, { status: 400 });
  }

  const walletDeduction = walletResult.walletDeduction;
  const finalAmount = walletResult.finalAmount;
  const leadNumber = String(lead.lead_number || generateLeadNumber());
  const normalizedPhone = normalizeCustomerPhone(customer.phone);
  if (!normalizedPhone) {
    return NextResponse.json({ error: 'Invalid customer phone' }, { status: 400 });
  }

  if (walletDeduction > 0 && walletDeduction > walletResult.spendableBalance) {
    return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
  }

  let membershipClaimMeta: Record<string, unknown> | null = null;
  let validatedMembershipClaim: Awaited<ReturnType<typeof validateMembershipClaim>> | null = null;

  if (body?.membership_claim?.benefit_code) {
    validatedMembershipClaim = await validateMembershipClaim(
      supabaseAdmin,
      customer.id,
      String(body.membership_claim.benefit_code),
      body.membership_claim.vehicle_number || vehicleNumber || null,
    );
    if (!validatedMembershipClaim.valid) {
      return NextResponse.json({ error: validatedMembershipClaim.error }, { status: 400 });
    }
    membershipClaimMeta = {
      benefit_code: validatedMembershipClaim.benefitCode,
      benefit_title: validatedMembershipClaim.benefitTitle,
      vehicle_number: body.membership_claim.vehicle_number || vehicleNumber || null,
      vehicle_label: body.membership_claim.vehicle_label || null,
    };
  }

  const leadInsert = {
    ...pickLeadFields(lead as Record<string, unknown>),
    lead_number: leadNumber,
    lead_type: toServiceLeadType(String(lead.lead_type || 'NORMAL')),
    service_type:
      String(
        lead.service_type ||
          (Array.isArray(lead.service_type_ids) && lead.service_type_ids.length > 0 ? 'CAR_SERVICE' : '') ||
          'CAR_SERVICE',
      )
        .trim()
        .slice(0, 100) || 'CAR_SERVICE',
    customer_name: lead.customer_name || customer.full_name || `Customer ${normalizedPhone}`,
    customer_phone: normalizedPhone,
    customer_email: customer.email || lead.customer_email || null,
    vehicle_number: vehicleNumber || String(lead.vehicle_number || '').trim().toUpperCase() || 'NA',
    estimated_amount: finalAmount,
    actual_amount: finalAmount,
    coupon_code: couponCode,
    discount_amount: totalDiscount,
    coupon_meta: couponMeta,
    status: lead.status || 'NEW',
    created_from: lead.created_from || 'MOBILE_APP',
    meta: (() => {
      const nextMeta = mergeLeadMetaWithUtm(lead.meta, resolvedUtm, requestUtm, leadUtm, bodyUtm);
      nextMeta.customer_id = customer.id;
      nextMeta.service_subtotal = subtotal;
      if (includeBookingMembership) {
        nextMeta.unpaid_membership_line_price = Number(body.membership_line_price || 0) || null;
      }
      if (membershipClaimMeta) nextMeta.membership_claim = membershipClaimMeta;
      if (membershipBundleDiscount > 0) {
        nextMeta.booking_membership_bundle = {
          include_membership: includeBookingMembership,
          discount_amount: membershipBundleDiscount,
          coupon_discount: couponDiscount,
          service_subtotal: subtotal,
        };
      }
      if (walletDeduction > 0) {
        nextMeta.wallet_deduction = walletDeduction;
        nextMeta.wallet_applied = true;
      }
      if (referralClaimMeta && referralClaimId) {
        nextMeta.referral_reward = {
          claim_id: referralClaimId,
          reward_text: referralClaimMeta.reward_text || null,
          discount_amount: referralVoucherDiscount,
          chosen_family: referralClaimMeta.chosen_family || null,
        };
      }
      if (postBookingMembershipOffer) {
        nextMeta.post_booking_membership_offer = postBookingMembershipOffer;
      }
      return nextMeta;
    })(),
    lead_priority: membershipClaimMeta ? 'HIGH' : (lead.lead_priority || 'NORMAL'),
    description: membershipClaimMeta
      ? `[Membership Claim] ${membershipClaimMeta.benefit_title}${membershipClaimMeta.vehicle_number ? ` · ${membershipClaimMeta.vehicle_number}` : ''}`
      : lead.description || null,
  };

  let serviceLead: { id: string; lead_number: string };
  try {
    const serviceLabel = resolveBookingServiceLabel(body);
    const upserted = await upsertBookingServiceLead(supabaseAdmin, {
      phone: normalizedPhone,
      leadPayload: leadInsert,
      bookingSummary: [
        serviceLabel,
        leadInsert.vehicle_number && String(leadInsert.vehicle_number).toUpperCase() !== 'NA'
          ? String(leadInsert.vehicle_number)
          : null,
        finalAmount ? `₹${Math.round(Number(finalAmount))}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    });
    serviceLead = upserted.lead;
    if (!upserted.created) {
      console.info(
        '[service-booking-create] reopened lead',
        serviceLead.lead_number,
        'was',
        upserted.previousStatus,
        upserted.previousLabel,
      );
    }
  } catch (leadErr: any) {
    return NextResponse.json({ error: leadErr?.message || 'Booking failed' }, { status: 500 });
  }

  if (referralClaimId && referralClaimMeta) {
    try {
      const pickupRequired = Boolean(
        lead.pickup_required ?? body?.lead?.pickup_required ?? body?.pickup_required,
      );
      await redeemReferralVoucherClaim(supabaseAdmin, referralClaimId, serviceLead.id, {
        pickupRequired,
      });
    } catch (redeemErr) {
      console.error('[service-booking-create] referral voucher redeem failed:', redeemErr);
    }
  }

  if (validatedMembershipClaim?.valid && membershipClaimMeta) {
    const usageResult = await recordMembershipClaimUsage(supabaseAdmin, {
      membership: validatedMembershipClaim.membership,
      customerId: customer.id,
      benefitCode: validatedMembershipClaim.benefitCode,
      referenceType: 'LEAD',
      referenceId: String(serviceLead.id),
      usedValue: 1,
    });
    if (!usageResult.ok) {
      console.error('[service-booking-create] membership claim usage failed:', usageResult.error);
    }
  }

  if (couponMeta?.coupon_id) {
    const redeemed = await redeemCouponAtomic(supabaseAdmin, {
      couponId: String(couponMeta.coupon_id),
      customerPhone: normalizedPhone,
      discountAmount: couponDiscount,
      appliedByRole: 'CUSTOMER',
      serviceLeadId: serviceLead?.id || null,
      idempotencyKey: serviceLead?.id ? `lead:${serviceLead.id}` : null,
      meta: {
        lead_source: lead.lead_source || 'App Booking',
        channel: body?.coupon?.lead_context?.channel || 'MOBILE',
        customer_name: lead.customer_name || customer.full_name || null,
        lead_number: leadNumber,
      },
    });
    if (!redeemed.success) {
      console.error('[service-booking-create] coupon redemption failed:', redeemed.error);
    }
  }

  if (walletDeduction > 0) {
    const serviceLabel = resolveBookingServiceLabel(body);
    try {
      await debitServiceBookingWallet(supabaseAdmin, customer.id, request, {
        leadId: serviceLead.id,
        leadNumber: serviceLead.lead_number,
        subtotal,
        couponDiscount,
        membershipBundleDiscount,
        walletDeduction,
        vehicleNumber: vehicleNumber || null,
        serviceLabel,
      });
    } catch (walletErr: any) {
      await supabaseAdmin.from('service_leads').delete().eq('id', serviceLead.id);
      return NextResponse.json(
        { error: walletErr?.message || 'Wallet deduction failed' },
        { status: 400 },
      );
    }
  }

  try {
    await logCustomerEvent(supabaseAdmin, customer.id, 'service_booking_created', 'booking', {
      leadId: serviceLead.id,
      subtotal,
      walletDeduction,
      finalAmount,
    });
  } catch (eventErr: any) {
    console.error('[service-booking-create] analytics event failed:', eventErr?.message || eventErr);
  }

  try {
    const { notifyReferrerOnRefereeBooking } = await import('@/lib/referral-push-notify');
    await notifyReferrerOnRefereeBooking(supabaseAdmin, customer.id, serviceLead.id);
  } catch (referralPushErr) {
    console.warn('[service-booking-create] referral booked push failed:', referralPushErr);
  }

  await saveBookedVehicleToProfile(supabaseAdmin, leadInsert, normalizedPhone);

  const telecrmLead = {
    ...leadInsert,
    ...serviceLead,
    meta: mergeLeadMetaWithUtm(leadInsert.meta, resolvedUtm),
    ...resolvedUtm,
  };

  // WhatsApp first — never block confirmation on TeleCRM latency/timeouts.
  try {
    const whatsappResult = await notifyBookingConfirmedWhatsApp({
      lead: {
        id: serviceLead.id,
        lead_number: serviceLead.lead_number,
        customer_name: leadInsert.customer_name,
        customer_phone: normalizedPhone,
        vehicle_number: leadInsert.vehicle_number,
        vehicle_make: leadInsert.vehicle_make,
        vehicle_model: leadInsert.vehicle_model,
        vehicle_variant: leadInsert.vehicle_variant,
        service_type: leadInsert.service_type,
        preferred_slot_start: leadInsert.preferred_slot_start,
        preferred_date: leadInsert.preferred_date,
        preferred_time_slot: leadInsert.preferred_time_slot,
        pickup_required: leadInsert.pickup_required,
        pickup_address: leadInsert.pickup_address,
        customer_address: leadInsert.customer_address,
        city: leadInsert.city,
        pincode: leadInsert.pincode,
        workshop_name: leadInsert.workshop_name,
        estimated_amount: leadInsert.estimated_amount ?? finalAmount,
        flat_number: leadInsert.flat_number,
        landmark: leadInsert.landmark,
      },
      customerId: customer.id,
      body,
      amount: finalAmount,
    });
    if (whatsappResult.skipped || !whatsappResult.sent) {
      console.log('[service-booking-create] booking confirmed WhatsApp skipped:', whatsappResult.skipReason || whatsappResult.error);
    }
  } catch (whatsappErr: any) {
    console.error('[service-booking-create] booking confirmed WhatsApp failed:', whatsappErr?.message || whatsappErr);
  }

  try {
    await pushServiceLeadToTeleCRM(telecrmLead, supabaseAdmin, {
      leadTag: 'APP',
      leadSource: String(lead.lead_source || 'App Booking'),
      createdFrom: String(leadInsert.created_from || 'MOBILE_APP'),
    });
  } catch (syncErr: any) {
    console.error('[service-booking-create] TeleCRM sync failed:', syncErr?.message || syncErr);
    try {
      await supabaseAdmin.from('telecrm_api').insert({
        name: leadInsert.customer_name || null,
        mobile: normalizedPhone,
        city: leadInsert.city || null,
        service_type: leadInsert.service_type || null,
        vehicle_number: leadInsert.vehicle_number || null,
        vehicle_model: leadInsert.vehicle_make ? `${leadInsert.vehicle_make} ${leadInsert.vehicle_model || ''}`.trim() : null,
        customer_quoted_amount: finalAmount || null,
        disposition: 'App Booking',
        disposition_note: `Lead ${serviceLead.lead_number} - TeleCRM direct push failed, queued for cron retry`,
      });
    } catch (fallbackErr: any) {
      console.error('[service-booking-create] TeleCRM fallback insert failed:', fallbackErr?.message || fallbackErr);
    }
  }

  return NextResponse.json({
    success: true,
    lead_id: serviceLead.id,
    lead: serviceLead,
    wallet_deduction: walletDeduction,
    membership_bundle_discount: membershipBundleDiscount,
    amount_payable: finalAmount,
  });
}
