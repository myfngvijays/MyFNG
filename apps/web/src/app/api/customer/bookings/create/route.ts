import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';
import { validateCouponForCheckout, redeemCouponAtomic } from '@/lib/coupon-service';
import {
  validateMembershipClaim,
  recordMembershipClaimUsage,
} from '@/lib/membership-benefits-service';
import {
  debitWallet,
  resolveWalletDeduction,
} from '@/lib/wallet-service';

export const dynamic = 'force-dynamic';

function generateLeadNumber() {
  return `L-${Date.now().toString().slice(-8)}`;
}

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const body = await request.json().catch(() => ({}));
  const lead = body?.lead || {};
  const useWallet = Boolean(body.use_wallet);
  const subtotal = Number(body.subtotal || lead.estimated_amount || 0);

  let couponDiscount = Number(body.discount_amount || lead.discount_amount || 0);
  let couponCode: string | null = lead.coupon_code || null;
  let couponMeta: Record<string, unknown> | null = lead.coupon_meta || null;

  if (body?.coupon?.code) {
    const channel = String(body?.coupon?.lead_context?.channel || 'MOBILE').toUpperCase();
    const couponResult = await validateCouponForCheckout(
      supabaseAdmin,
      String(body.coupon.code || ''),
      {
        ...(body.coupon.lead_context || {}),
        subtotal,
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

  const payableBeforeWallet = Math.max(0, subtotal - couponDiscount);
  const vehicleNumber = String(lead.vehicle_number || body.vehicle_number || '').trim();

  const resolved = await resolveWalletDeduction(
    supabaseAdmin,
    customer.id,
    payableBeforeWallet,
    'SERVICE',
    useWallet,
    vehicleNumber || null,
  );

  if (resolved.blocked && useWallet) {
    return NextResponse.json({ error: resolved.reason || 'Wallet cannot be used for this vehicle' }, { status: 400 });
  }

  const walletDeduction = resolved.deduction;
  const finalAmount = Math.max(0, payableBeforeWallet - walletDeduction);
  const leadNumber = String(lead.lead_number || generateLeadNumber());

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
    ...lead,
    lead_number: leadNumber,
    customer_name: lead.customer_name || customer.full_name || `Customer ${customer.phone}`,
    customer_phone: customer.phone,
    customer_email: customer.email || lead.customer_email || null,
    estimated_amount: finalAmount,
    actual_amount: finalAmount,
    coupon_code: couponCode,
    discount_amount: couponDiscount,
    coupon_meta: couponMeta,
    status: lead.status || 'NEW',
    lead_type: lead.lead_type || 'NORMAL',
    created_from: lead.created_from || 'MOBILE_APP',
    meta: membershipClaimMeta
      ? {
          ...(lead.meta && typeof lead.meta === 'object' ? lead.meta : {}),
          membership_claim: membershipClaimMeta,
        }
      : lead.meta || null,
    lead_priority: membershipClaimMeta ? 'HIGH' : (lead.lead_priority || 'NORMAL'),
    description: membershipClaimMeta
      ? `[Membership Claim] ${membershipClaimMeta.benefit_title}${membershipClaimMeta.vehicle_number ? ` · ${membershipClaimMeta.vehicle_number}` : ''}`
      : lead.description || null,
  };

  const { data: serviceLead, error: leadError } = await supabaseAdmin
    .from('service_leads')
    .insert(leadInsert)
    .select('id, lead_number')
    .single();

  if (leadError || !serviceLead) {
    return NextResponse.json({ error: leadError?.message || 'Booking failed' }, { status: 500 });
  }

  if (validatedMembershipClaim?.valid && membershipClaimMeta) {
    try {
      await recordMembershipClaimUsage(supabaseAdmin, {
        membership: validatedMembershipClaim.membership,
        customerId: customer.id,
        benefitCode: validatedMembershipClaim.benefitCode,
        referenceType: 'LEAD',
        referenceId: serviceLead.id,
        usedValue: 1,
      });
    } catch (claimErr: any) {
      console.error('[customer/bookings/create] membership claim usage failed:', claimErr?.message || claimErr);
    }
  }

  if (couponMeta?.coupon_id) {
    const redeemed = await redeemCouponAtomic(supabaseAdmin, {
      couponId: String(couponMeta.coupon_id),
      customerPhone: customer.phone,
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
      console.error('[customer/bookings/create] coupon redemption failed:', redeemed.error);
    }
  }

  if (walletDeduction > 0) {
    await debitWallet(supabaseAdmin, customer.id, walletDeduction, {
      source: 'ORDER_REDEEM',
      idempotencyKey: `booking:${serviceLead.id}`,
      channel: 'SERVICE',
      vehicleNumber: vehicleNumber || null,
      metadata: {
        label: 'Used for Service Booking',
        lead_id: serviceLead.id,
        lead_number: serviceLead.lead_number,
        subtotal,
        coupon_discount: couponDiscount,
        usage_percent: 10,
        vehicle_number: vehicleNumber || null,
      },
    });
  }

  await logCustomerEvent(supabaseAdmin, customer.id, 'service_booking_created', 'booking', {
    leadId: serviceLead.id,
    subtotal,
    walletDeduction,
    finalAmount,
  });

  return NextResponse.json({
    success: true,
    lead: serviceLead,
    wallet_deduction: walletDeduction,
    amount_payable: finalAmount,
  });
}
