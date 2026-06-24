import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';
import { creditWelcomeBonus } from '@/lib/wallet-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/customer/wallet/claim-welcome
 * Idempotent welcome bonus credit for logged-in customer (mobile backfill).
 */
export async function POST() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  try {
    const result = await creditWelcomeBonus(supabaseAdmin, customer.id);
    if (result.credited) {
      return NextResponse.json({
        success: true,
        welcome_bonus: {
          credited: true,
          amount: Number(result.amount || 0),
          expires_at: result.expires_at || null,
        },
      });
    }
    if (result.reason === 'already_credited') {
      return NextResponse.json({
        success: true,
        welcome_bonus: {
          credited: false,
          already_credited: true,
          amount: 0,
        },
      });
    }
    return NextResponse.json({
      success: false,
      welcome_bonus: { credited: false, amount: 0 },
      reason: result.reason || 'not_credited',
    });
  } catch (err: any) {
    console.error('[claim-welcome] failed:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to claim welcome bonus' },
      { status: 500 },
    );
  }
}
