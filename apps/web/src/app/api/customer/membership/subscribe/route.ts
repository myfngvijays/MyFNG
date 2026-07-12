import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';
import { recordCouponRedemption } from '@/lib/coupon-validate';
import { applyBookingMembershipBundleToLead } from '@/lib/booking-post-membership';
import { debitWallet } from '@/lib/wallet-service';
import { notifyMembershipPaymentSuccessWhatsApp } from '@/lib/services/membershipPaymentWhatsApp';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || '';

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));
  const planId = String(body.plan_id || '');
  const postBookingBundle = Boolean(body.post_booking_bundle);
  const leadId = String(body.lead_id || '').trim();
  const serviceSubtotal = Number(body.service_subtotal || 0);
  const bookingBundleDiscount = Number(body.booking_bundle_discount || 0);
  if (!planId) return NextResponse.json({ error: 'plan_id is required' }, { status: 400 });
  if (postBookingBundle && !leadId) {
    return NextResponse.json({ error: 'lead_id is required for post-booking membership' }, { status: 400 });
  }

  const razorpayPaymentId = String(body.razorpay_payment_id || '');
  const razorpayOrderId = String(body.razorpay_order_id || '');
  const razorpaySignature = String(body.razorpay_signature || '');

  if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
    return NextResponse.json({ error: 'Payment verification details are required' }, { status: 400 });
  }

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
  }

  const { data: plan } = await supabaseAdmin.from('membership_plans').select('*').eq('id', planId).eq('active', true).maybeSingle();
  if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  const now = new Date();
  const endsAt = new Date(now.getTime() + Number(plan.duration_days || 365) * 24 * 60 * 60 * 1000);

  // Expire any previous active memberships for this customer
  await supabaseAdmin
    .from('customer_memberships')
    .update({ status: 'EXPIRED', updated_at: now.toISOString() })
    .eq('customer_id', customer.id)
    .eq('status', 'ACTIVE');

  const insertPayload = {
    customer_id: customer.id,
    plan_id: plan.id,
    status: 'ACTIVE',
    starts_at: now.toISOString(),
    ends_at: endsAt.toISOString(),
    auto_renew: Boolean(body.auto_renew),
    source: 'PURCHASE',
    has_second_car: Boolean(body.add_second_car),
    primary_vehicle_id: body.primary_vehicle_id || null,
    second_vehicle_id: body.second_vehicle_id || null,
    primary_vehicle_snapshot: body.primary_vehicle_snapshot || {},
    second_vehicle_snapshot: body.second_vehicle_snapshot || {},
  };

  let inserted: any = null;
  let insertError: any = null;
  ({ data: inserted, error: insertError } = await supabaseAdmin
    .from('customer_memberships')
    .insert(insertPayload)
    .select('*, plan:membership_plans(*)')
    .single());

  if (insertError && /does not exist|column/i.test(insertError.message || '')) {
    ({ data: inserted, error: insertError } = await supabaseAdmin
      .from('customer_memberships')
      .insert({
        customer_id: customer.id,
        plan_id: plan.id,
        status: 'ACTIVE',
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        auto_renew: Boolean(body.auto_renew),
        source: 'PURCHASE',
      })
      .select('*, plan:membership_plans(*)')
      .single());
  }

  if (insertError || !inserted) {
    console.error('[membership/subscribe] insert failed:', insertError);
    return NextResponse.json(
      { error: 'Membership activation failed', details: insertError?.message || 'Could not save membership' },
      { status: 500 },
    );
  }

  const walletDeduction = Number(body.wallet_deduction || 0);
  const vehicleNumber = String(
    body.primary_vehicle_snapshot?.vehicle_number || body.vehicle_number || '',
  ).trim();
  if (walletDeduction > 0) {
    try {
      await debitWallet(supabaseAdmin, customer.id, walletDeduction, {
        source: 'MEMBERSHIP_REDEEM',
        idempotencyKey: `membership:${razorpayOrderId}`,
        channel: 'MEMBERSHIP',
        vehicleNumber: vehicleNumber || null,
        metadata: {
          label: 'Used for Membership Purchase',
          plan_id: plan.id,
          plan_name: plan.name,
          payment_id: razorpayPaymentId,
          order_id: razorpayOrderId,
          usage_percent: 30,
          vehicle_number: vehicleNumber || null,
        },
      });
    } catch (walletErr: any) {
      console.error('[membership/subscribe] wallet debit failed:', walletErr);
    }
  }

  await logCustomerEvent(supabaseAdmin, customer.id, 'membership_subscribed', 'membership', {
    planId,
    paymentId: razorpayPaymentId,
    orderId: razorpayOrderId,
    leadId: leadId || null,
    postBookingBundle,
  });

  let appliedBundleDiscount = 0;
  let walletCredit = 0;
  if (postBookingBundle && leadId) {
    try {
      const applied = await applyBookingMembershipBundleToLead(supabaseAdmin, {
        customerId: customer.id,
        leadId,
        membershipId: String(inserted.id),
        serviceSubtotal,
        bundleDiscount: bookingBundleDiscount,
      });
      appliedBundleDiscount = applied.bundleDiscount;
      walletCredit = applied.walletCredit;
    } catch (bundleErr: any) {
      console.error('[membership/subscribe] post-booking bundle apply failed:', bundleErr?.message || bundleErr);
    }
  }

  const couponId = String(body.coupon_id || body.coupon_meta?.coupon_id || '');
  if (couponId) {
    try {
      await recordCouponRedemption(supabaseAdmin, {
        couponId,
        customerPhone: customer.phone || null,
        discountAmount: Number(body.coupon_meta?.discount_amount || body.discount_amount || 0),
        appliedByRole: 'CUSTOMER',
        idempotencyKey: `membership:${razorpayOrderId}:${couponId}`,
        meta: {
          type: 'membership',
          channel: 'MEMBERSHIP',
          customer_name: customer.full_name || null,
          plan_id: plan.id,
          payment_id: razorpayPaymentId,
          order_id: razorpayOrderId,
          coupon_code: body.coupon_code || body.coupon_meta?.code || null,
        },
      });
    } catch (redemptionErr) {
      console.error('[membership/subscribe] coupon redemption failed:', redemptionErr);
    }
  }

  const amountPaid =
    Number(body.amount_paid || body.amount || 0) > 0
      ? Number(body.amount_paid || body.amount)
      : Number(plan.price || 0);

  void notifyMembershipPaymentSuccessWhatsApp({
    customerId: customer.id,
    phone: String(customer.phone || '').trim(),
    customerName: customer.full_name,
    amount: amountPaid,
    planName: String(plan.name || 'MyFNG Prime'),
    transactionId: razorpayPaymentId,
  }).catch((error) => {
    console.warn('[membership/subscribe] WhatsApp notify failed:', error?.message || error);
  });

  return NextResponse.json({
    success: true,
    plan_id: plan.id,
    ends_at: endsAt.toISOString(),
    membership: inserted,
    booking_bundle_discount: appliedBundleDiscount,
    wallet_credit: walletCredit,
  });
}
