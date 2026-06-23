import { NextRequest } from 'next/server';
import { parseWalletPlatform } from '@/lib/wallet-config';
import { validateCouponForCheckout } from '@/lib/coupon-service';
import {
  getWalletVehicleEligibility,
  resolveWalletDeduction,
} from '@/lib/wallet-service';
import { calculateBookingMembershipBundleDiscount } from '@/lib/booking-membership-discount';
import { resolvePostBookingLeadContext } from '@/lib/booking-post-membership';

export type MembershipCreateOrderInput = {
  customer: { id: string; phone?: string | null };
  supabaseAdmin: any;
  body: Record<string, any>;
  request: NextRequest;
};

export async function createMembershipPaymentOrder(input: MembershipCreateOrderInput) {
  const { customer, supabaseAdmin, body, request } = input;

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || '';

  if (!razorpayKeyId || !razorpayKeySecret) {
    return {
      ok: false as const,
      status: 500,
      error: 'Payment gateway not configured',
      hint: 'Missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET',
    };
  }

  const planId = String(body.plan_id || '');
  const addSecondCar = Boolean(body.add_second_car);
  const postBookingBundle = Boolean(body.post_booking_bundle);
  const leadId = String(body.lead_id || '').trim();
  const serviceSubtotal = Number(body.service_subtotal || 0);
  const couponCode = String(body.coupon_code || '').trim().toUpperCase();
  const useWallet = body.use_wallet !== false;
  const vehicleNumber = body.vehicle_number ? String(body.vehicle_number) : null;
  const secondVehicleNumber = body.second_vehicle_number ? String(body.second_vehicle_number) : null;

  if (!planId) {
    return { ok: false as const, status: 400, error: 'plan_id is required' };
  }
  if (postBookingBundle && !leadId) {
    return { ok: false as const, status: 400, error: 'lead_id is required for post-booking membership' };
  }
  if (postBookingBundle && serviceSubtotal <= 0) {
    return { ok: false as const, status: 400, error: 'service_subtotal is required for post-booking membership' };
  }
  if (postBookingBundle && addSecondCar) {
    return { ok: false as const, status: 400, error: '2nd car add-on is not available in post-booking membership' };
  }

  const { data: plan } = await supabaseAdmin
    .from('membership_plans')
    .select('*')
    .eq('id', planId)
    .eq('active', true)
    .maybeSingle();

  if (!plan) {
    return { ok: false as const, status: 400, error: 'Invalid plan' };
  }

  const SECOND_CAR_ADDON_PRICE = Number(plan.second_car_addon_price) || 299;
  const baseAmount = Number(plan.price || 0);
  const grossAmount = baseAmount + (addSecondCar ? SECOND_CAR_ADDON_PRICE : 0);
  if (grossAmount <= 0) {
    return { ok: false as const, status: 400, error: 'Plan has no price' };
  }

  let bookingBundleDiscount = 0;
  if (postBookingBundle) {
    bookingBundleDiscount = calculateBookingMembershipBundleDiscount(serviceSubtotal);
    const leadCtx = await resolvePostBookingLeadContext(
      supabaseAdmin,
      customer,
      leadId,
      serviceSubtotal,
    );
    if (!leadCtx.ok) {
      return { ok: false as const, status: leadCtx.status, error: leadCtx.error };
    }
    bookingBundleDiscount = leadCtx.ctx.bundleDiscount;
  }

  let discountAmount = 0;
  let couponMeta: Record<string, unknown> | null = null;

  if (couponCode) {
    const couponResult = await validateCouponForCheckout(
      supabaseAdmin,
      couponCode,
      {
        subtotal: grossAmount,
        customer_phone: customer.phone || null,
        customer_id: customer.id,
        channel: 'MEMBERSHIP',
        service_items: [{ label: `${plan.name} Membership`, price: grossAmount }],
      },
      { membershipOnly: true },
    );
    if (!couponResult.valid) {
      return { ok: false as const, status: 400, error: couponResult.error };
    }
    discountAmount = couponResult.discountAmount;
    couponMeta = couponResult.couponMeta;
  }

  const amountBeforeWallet = Math.max(0, grossAmount - discountAmount - bookingBundleDiscount);
  if (amountBeforeWallet <= 0) {
    return { ok: false as const, status: 400, error: 'Invalid payable amount after discount' };
  }

  if (useWallet && vehicleNumber) {
    const primaryCheck = await getWalletVehicleEligibility(supabaseAdmin, customer.id, vehicleNumber);
    if (primaryCheck.blocked) {
      return { ok: false as const, status: 400, error: primaryCheck.reason || 'Wallet cannot be used for this vehicle' };
    }
  }
  if (useWallet && secondVehicleNumber) {
    const secondCheck = await getWalletVehicleEligibility(supabaseAdmin, customer.id, secondVehicleNumber);
    if (secondCheck.blocked) {
      return { ok: false as const, status: 400, error: secondCheck.reason || 'Wallet cannot be used for this vehicle' };
    }
  }

  const resolved = await resolveWalletDeduction(
    supabaseAdmin,
    customer.id,
    amountBeforeWallet,
    'MEMBERSHIP',
    useWallet,
    vehicleNumber,
    parseWalletPlatform(request.headers.get('x-app-platform')),
  );

  if (resolved.blocked && useWallet) {
    return { ok: false as const, status: 400, error: resolved.reason || 'Wallet cannot be used for this vehicle' };
  }

  const walletDeduction = resolved.deduction;
  const amount = Math.max(0, amountBeforeWallet - walletDeduction);
  if (amount <= 0 && walletDeduction <= 0) {
    return { ok: false as const, status: 400, error: 'Invalid payable amount' };
  }

  const amountInPaise = Math.round(amount * 100);
  const authHeader = 'Basic ' + Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');
  const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `MEM_${customer.id.substring(0, 8)}_${Date.now()}`,
      notes: {
        customer_id: customer.id,
        plan_id: plan.id,
        plan_name: plan.name,
        type: postBookingBundle ? 'post_booking_membership' : 'membership',
        add_second_car: addSecondCar ? 'yes' : 'no',
        coupon_code: couponCode || '',
        discount_amount: String(discountAmount),
        booking_bundle_discount: String(bookingBundleDiscount),
        lead_id: leadId || '',
        service_subtotal: String(serviceSubtotal || 0),
        wallet_deduction: String(walletDeduction),
        gross_amount: String(grossAmount),
        amount_before_wallet: String(amountBeforeWallet),
      },
    }),
  });

  if (!orderRes.ok) {
    const errBody = await orderRes.text().catch(() => '');
    return {
      ok: false as const,
      status: 500,
      error: 'Failed to create payment order',
      details: errBody,
    };
  }

  const order = await orderRes.json();

  return {
    ok: true as const,
    payload: {
      success: true,
      order_id: order.id,
      amount_paise: amountInPaise,
      amount,
      gross_amount: grossAmount,
      discount_amount: discountAmount,
      booking_bundle_discount: bookingBundleDiscount,
      lead_id: leadId || null,
      service_subtotal: serviceSubtotal || null,
      wallet_deduction: walletDeduction,
      amount_before_wallet: amountBeforeWallet,
      coupon_meta: couponMeta,
      currency: 'INR',
      razorpay_key: razorpayKeyId,
      plan_id: plan.id,
      plan_name: plan.name,
    },
  };
}
