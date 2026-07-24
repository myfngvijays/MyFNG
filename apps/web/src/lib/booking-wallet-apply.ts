import type { NextRequest } from 'next/server';
import { parseWalletPlatform } from '@/lib/wallet-config';
import {
  debitWallet,
  parseWalletServiceLines,
  resolveWalletDeduction,
} from '@/lib/wallet-service';

export type ServiceBookingWalletResult = {
  walletDeduction: number;
  payableBeforeWallet: number;
  finalAmount: number;
  spendableBalance: number;
  blocked: boolean;
  reason?: string;
};

export async function resolveServiceBookingWallet(
  supabaseAdmin: any,
  customerId: string,
  request: NextRequest,
  body: Record<string, any>,
  opts: {
    subtotal: number;
    couponDiscount?: number;
    membershipBundleDiscount?: number;
    vehicleNumber?: string | null;
    useWallet: boolean;
  },
): Promise<ServiceBookingWalletResult> {
  const couponDiscount = Number(opts.couponDiscount || 0);
  const membershipBundleDiscount = Number(opts.membershipBundleDiscount || 0);
  const referralVoucherDiscount = Number(body?.referral_voucher_discount || 0);
  const payableBeforeWallet = Math.max(
    0,
    opts.subtotal - couponDiscount - membershipBundleDiscount - referralVoucherDiscount,
  );
  const vehicleNumber = String(opts.vehicleNumber || body?.lead?.vehicle_number || '').trim() || null;

  const referralRewardClaimId = String(body?.referral_reward_claim_id || '').trim();
  const referralVoucherApplied = Boolean(body?.referral_voucher_applied || referralRewardClaimId);

  if (referralVoucherApplied && opts.useWallet) {
    return {
      walletDeduction: 0,
      payableBeforeWallet,
      finalAmount: payableBeforeWallet,
      spendableBalance: 0,
      blocked: true,
      reason:
        'Wallet balance cannot be used when a referral service voucher is applied. Remove the voucher or turn off wallet usage.',
    };
  }

  if (!opts.useWallet || payableBeforeWallet <= 0) {
    return {
      walletDeduction: 0,
      payableBeforeWallet,
      finalAmount: payableBeforeWallet,
      spendableBalance: 0,
      blocked: false,
    };
  }

  const walletPlatform = parseWalletPlatform(request.headers.get('x-app-platform'));
  const serviceLines = parseWalletServiceLines(body, payableBeforeWallet);
  const resolved = await resolveWalletDeduction(
    supabaseAdmin,
    customerId,
    payableBeforeWallet,
    'SERVICE',
    true,
    vehicleNumber,
    walletPlatform,
    serviceLines,
  );

  if (resolved.blocked) {
    return {
      walletDeduction: 0,
      payableBeforeWallet,
      finalAmount: payableBeforeWallet,
      spendableBalance: 0,
      blocked: true,
      reason: resolved.reason,
    };
  }

  const walletDeduction = resolved.deduction;
  return {
    walletDeduction,
    payableBeforeWallet,
    finalAmount: Math.max(0, payableBeforeWallet - walletDeduction),
    spendableBalance: resolved.spendable_balance,
    blocked: false,
  };
}

export async function debitServiceBookingWallet(
  supabaseAdmin: any,
  customerId: string,
  request: NextRequest,
  opts: {
    leadId: string;
    leadNumber: string;
    subtotal: number;
    couponDiscount?: number;
    membershipBundleDiscount?: number;
    walletDeduction: number;
    vehicleNumber?: string | null;
    serviceLabel?: string | null;
  },
) {
  if (opts.walletDeduction <= 0) return { debited: 0 };

  const walletPlatform = parseWalletPlatform(request.headers.get('x-app-platform'));
  const vehicleNumber = String(opts.vehicleNumber || '').trim() || null;
  const serviceLabel = String(opts.serviceLabel || '').trim() || null;
  const walletLabel = serviceLabel ? `Used for ${serviceLabel}` : 'Used for Service Booking';

  return debitWallet(supabaseAdmin, customerId, opts.walletDeduction, {
    source: 'ORDER_REDEEM',
    idempotencyKey: `booking:${opts.leadId}`,
    channel: 'SERVICE',
    vehicleNumber,
    platform: walletPlatform,
    metadata: {
      label: walletLabel,
      service_name: serviceLabel,
      lead_id: opts.leadId,
      lead_number: opts.leadNumber,
      subtotal: opts.subtotal,
      coupon_discount: opts.couponDiscount || 0,
      membership_bundle_discount: opts.membershipBundleDiscount || 0,
      usage_percent: 10,
      vehicle_number: vehicleNumber,
    },
  });
}

export function resolveBookingServiceLabel(body: Record<string, any>): string | null {
  const items = Array.isArray(body?.service_items)
    ? body.service_items
    : Array.isArray(body?.coupon?.lead_context?.service_items)
      ? body.coupon.lead_context.service_items
      : [];
  const labels = items
    .map((item: any) => String(item?.label || '').trim())
    .filter(Boolean);
  if (labels.length > 0) return labels.join(', ');
  return null;
}
