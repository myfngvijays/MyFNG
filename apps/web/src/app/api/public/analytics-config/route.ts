import {
  applyKnownWebsiteTracking,
  loadProductAnalyticsConfig,
  productAnalyticsToPublicPayload,
} from '@/lib/analytics/productAnalyticsConfig';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Public read-only analytics flags + IDs for mobile app runtime (no secrets). */
export async function GET() {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    const config = applyKnownWebsiteTracking(await loadProductAnalyticsConfig(supabaseAdmin));
    return NextResponse.json(productAnalyticsToPublicPayload(config));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
