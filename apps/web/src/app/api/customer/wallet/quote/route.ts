import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';
import { parseWalletPlatform } from '@/lib/wallet-config';
import {
  getWalletVehicleEligibility,
  parseWalletServiceLines,
  resolveWalletDeduction,
  type WalletChannel,
} from '@/lib/wallet-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));

  const payableAmount = Number(body.payable_amount || 0);
  const channel = String(body.channel || 'SERVICE').toUpperCase() as WalletChannel;
  const useWallet = body.use_wallet !== false;
  const vehicleNumber = body.vehicle_number ? String(body.vehicle_number) : null;

  if (!['SERVICE', 'MEMBERSHIP'].includes(channel)) {
    return NextResponse.json({ error: 'channel must be SERVICE or MEMBERSHIP' }, { status: 400 });
  }

  const resolved = await resolveWalletDeduction(
    supabaseAdmin,
    customer.id,
    payableAmount,
    channel,
    useWallet,
    vehicleNumber,
    parseWalletPlatform(request.headers.get('x-app-platform')),
    parseWalletServiceLines(body, payableAmount),
  );

  return NextResponse.json({
    spendable_balance: resolved.spendable_balance,
    max_usable: resolved.deduction,
    wallet_deduction: resolved.deduction,
    payable_after_wallet: Math.max(0, payableAmount - resolved.deduction),
    can_use_wallet: !resolved.blocked,
    wallet_blocked: resolved.blocked,
    block_reason: resolved.reason || null,
    welcome_bonus_expires_at: resolved.welcome_bonus_expires_at || null,
    rules: resolved.rules || null,
  });
}

export async function GET(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const vehicleNumber = request.nextUrl.searchParams.get('vehicle_number');

  const eligibility = await getWalletVehicleEligibility(
    supabaseAdmin,
    customer.id,
    vehicleNumber,
  );

  return NextResponse.json({
    can_use_wallet: !eligibility.blocked,
    wallet_blocked: eligibility.blocked,
    block_reason: eligibility.reason || null,
  });
}
