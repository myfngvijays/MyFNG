import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getPostBookingMembershipConfig,
  toPostBookingMembershipAppConfig,
} from '@/lib/post-booking-membership-config';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    const config = await getPostBookingMembershipConfig(supabaseAdmin);
    return NextResponse.json({
      success: true,
      config: toPostBookingMembershipAppConfig(config),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
