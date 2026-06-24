import type { AppMembershipPlan } from './membershipPlan';
import {
  bookingMembershipExtraDiscountLabel,
  calculateBookingMembershipExtraDiscount,
} from './bookingMembershipDiscount';
import { membershipCartUnitPrice } from './membershipCart';

export type PostBookingMembershipQuote = {
  membershipPrice: number;
  bundleDiscount: number;
  payable: number;
  discountLabel: string;
};

export function quotePostBookingMembership(
  serviceSubtotal: number,
  plan: AppMembershipPlan | null,
): PostBookingMembershipQuote | null {
  if (!plan?.planId || serviceSubtotal <= 0) return null;
  const membershipPrice = membershipCartUnitPrice(plan);
  const bundleDiscount = calculateBookingMembershipExtraDiscount(serviceSubtotal, {
    includeMembership: true,
  });
  return {
    membershipPrice,
    bundleDiscount,
    payable: Math.max(0, membershipPrice - bundleDiscount),
    discountLabel: bookingMembershipExtraDiscountLabel(),
  };
}

function resolveOrderAmountRupee(orderRes: {
  amount?: number;
  amount_paise?: number;
  gross_amount?: number;
  booking_bundle_discount?: number;
  amount_before_wallet?: number;
}): number {
  const gross = Number(orderRes.gross_amount || 0);
  const bundleDiscount = Number(orderRes.booking_bundle_discount || 0);
  const beforeWallet = Number(orderRes.amount_before_wallet || 0);

  if (orderRes.amount != null && Number.isFinite(Number(orderRes.amount))) {
    const amount = Number(orderRes.amount);
    // Some server builds return list price in `amount` but include discount metadata separately.
    if (bundleDiscount > 0) {
      if (gross > 0 && Math.abs(amount - gross) < 1) {
        return Math.max(0, gross - bundleDiscount);
      }
      if (beforeWallet > 0 && Math.abs(amount - beforeWallet) < 1) {
        return Math.max(0, beforeWallet);
      }
    }
    return amount;
  }
  if (orderRes.amount_paise != null && Number.isFinite(Number(orderRes.amount_paise))) {
    return Number(orderRes.amount_paise) / 100;
  }
  if (gross > 0 && bundleDiscount > 0) {
    return Math.max(0, gross - bundleDiscount);
  }
  return 0;
}

async function createPostBookingMembershipOrder(
  apiFetch: <T = any>(path: string, init?: RequestInit) => Promise<T>,
  body: Record<string, unknown>,
  expectedPayable: number,
) {
  const endpoints = [
    '/api/public/membership/post-booking/create-order',
    '/api/customer/membership/create-order',
  ];

  let lastError = 'Could not create payment order. Please try again.';

  for (const path of endpoints) {
    try {
      const orderRes = await apiFetch<any>(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!orderRes?.order_id) {
        throw new Error(orderRes?.error || 'Could not create payment order.');
      }

      const chargedAmount = resolveOrderAmountRupee(orderRes);
      const serverBundleDiscount = Number(orderRes.booking_bundle_discount || 0);
      const grossAmount = Number(orderRes.gross_amount || 0);

      if (Math.abs(chargedAmount - expectedPayable) > 1) {
        if (grossAmount > 0 && serverBundleDiscount <= 0 && expectedPayable < grossAmount) {
          throw new Error(
            'Booking membership discount is not active on the server yet. Please ask support to deploy the latest MyFNG backend, then try again.',
          );
        }
        throw new Error(
          `Server charged ₹${Math.round(chargedAmount).toLocaleString('en-IN')} instead of ₹${Math.round(expectedPayable).toLocaleString('en-IN')}. Please update the MyFNG server and try again.`,
        );
      }

      if (serverBundleDiscount <= 0 && expectedPayable < Number(orderRes.gross_amount || 0)) {
        throw new Error(
          'Booking discount was not applied on the server. Please update the MyFNG server and try again.',
        );
      }

      return orderRes;
    } catch (err: any) {
      lastError = err?.message || lastError;
      const retryable =
        path === endpoints[0] &&
        (String(err?.message || '').toLowerCase().includes('not found') ||
          String(err?.message || '').includes('404') ||
          String(err?.message || '').includes('Service unavailable'));
      if (retryable) continue;
      throw err;
    }
  }

  throw new Error(lastError);
}

export async function openRazorpayMembershipOrder(
  orderRes: {
    razorpay_key?: string;
    amount_paise?: number;
    amount?: number;
    order_id?: string;
    plan_name?: string;
  },
  expectedPayable: number,
) {
  let RazorpayCheckout: any = null;
  try {
    RazorpayCheckout = require('react-native-razorpay')?.default;
  } catch {
    RazorpayCheckout = null;
  }
  if (!RazorpayCheckout) {
    throw new Error('Payment module is not available. Please update the app.');
  }
  if (!orderRes?.order_id || !orderRes?.razorpay_key) {
    throw new Error('Could not start payment. Please try again.');
  }

  const amountPaise =
    orderRes.amount_paise != null
      ? Math.round(Number(orderRes.amount_paise))
      : Math.round(Number(orderRes.amount || expectedPayable) * 100);

  if (Math.abs(amountPaise / 100 - expectedPayable) > 1) {
    throw new Error(
      `Payment amount mismatch (₹${Math.round(amountPaise / 100)} vs ₹${Math.round(expectedPayable)}). Please try again after app update.`,
    );
  }

  return RazorpayCheckout.open({
    key: orderRes.razorpay_key,
    amount: amountPaise,
    currency: 'INR',
    name: 'MyFNG',
    description: `${orderRes.plan_name || 'Prime'} Membership`,
    order_id: orderRes.order_id,
    theme: { color: '#004AAD' },
  });
}

export async function activatePostBookingMembership(opts: {
  apiFetch: <T = any>(path: string, init?: RequestInit) => Promise<T>;
  plan: AppMembershipPlan;
  leadId: string;
  serviceSubtotal: number;
  expectedPayable: number;
  vehicle: { vehicle_number: string; make: string; model: string };
}): Promise<{ membership?: any; bundleDiscount?: number; walletCredit?: number }> {
  const { apiFetch, plan, leadId, serviceSubtotal, expectedPayable, vehicle } = opts;
  const planId = String(plan.planId || '');
  if (!planId) throw new Error('Plan details not available. Please try again.');

  const quote = quotePostBookingMembership(serviceSubtotal, plan);
  const bookingBundleDiscount = quote?.bundleDiscount ?? Math.max(0, membershipCartUnitPrice(plan) - expectedPayable);

  let primaryVehicleId: string | null = null;
  try {
    const saved = await apiFetch<any>('/api/customer/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicle_number: vehicle.vehicle_number,
        make: vehicle.make,
        model: vehicle.model,
        is_default: false,
      }),
    });
    primaryVehicleId = saved?.vehicle?.id ? String(saved.vehicle.id) : null;
  } catch {
    primaryVehicleId = null;
  }

  const primarySnapshot = {
    vehicle_number: vehicle.vehicle_number,
    make: vehicle.make,
    model: vehicle.model,
    vehicle_id: primaryVehicleId,
  };

  const orderBody = {
    plan_id: planId,
    lead_id: leadId,
    post_booking_bundle: true,
    service_subtotal: serviceSubtotal,
    booking_bundle_discount: bookingBundleDiscount,
    use_wallet: false,
    vehicle_number: vehicle.vehicle_number,
  };

  const orderRes = await createPostBookingMembershipOrder(apiFetch, orderBody, expectedPayable);
  const paymentResult = await openRazorpayMembershipOrder(orderRes, expectedPayable);

  const subRes = await apiFetch<any>('/api/customer/membership/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan_id: planId,
      lead_id: leadId,
      service_subtotal: serviceSubtotal,
      post_booking_bundle: true,
      booking_bundle_discount: Number(orderRes?.booking_bundle_discount || bookingBundleDiscount),
      primary_vehicle_id: primaryVehicleId,
      primary_vehicle_snapshot: primarySnapshot,
      vehicle_number: vehicle.vehicle_number,
      razorpay_payment_id: paymentResult.razorpay_payment_id,
      razorpay_order_id: paymentResult.razorpay_order_id,
      razorpay_signature: paymentResult.razorpay_signature,
    }),
  });

  if (subRes?.error || !subRes?.success) {
    throw new Error(
      subRes?.error || subRes?.details || 'Membership activation failed after payment. Contact support with your payment ID.',
    );
  }

  return {
    membership: subRes.membership,
    bundleDiscount: Number(subRes?.booking_bundle_discount || orderRes?.booking_bundle_discount || 0),
    walletCredit: Number(subRes?.wallet_credit || 0),
  };
}
