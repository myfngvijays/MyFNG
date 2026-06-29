import { assertPushAdmin } from '@/lib/push/admin-auth';
import {
  DEFAULT_META_PIXEL_ID,
  applyKnownWebsiteTracking,
  loadProductAnalyticsConfig,
  saveProductAnalyticsConfig,
} from '@/lib/analytics/productAnalyticsConfig';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const config = applyKnownWebsiteTracking(
      await loadProductAnalyticsConfig(supabaseAdmin, { bypassCache: true }),
    );

    return NextResponse.json({
      config,
      can_edit: auth.roleCode === 'SUPER_ADMIN',
      meta_pixel_id: DEFAULT_META_PIXEL_ID,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    if (auth.roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admin can edit analytics settings' }, { status: 403 });
    }

    const body = await request.json();
    const result = await saveProductAnalyticsConfig(body?.config ?? body, auth.userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Analytics settings saved',
      config: result.config,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
