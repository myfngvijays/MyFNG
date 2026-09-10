import { NextRequest, NextResponse } from 'next/server';
import { assertPushAdmin } from '@/lib/push/admin-auth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  applyKnownWebsiteTracking,
  loadProductAnalyticsConfig,
} from '@/lib/analytics/productAnalyticsConfig';
import {
  PUBLIC_TRACKING_PAGES,
  builtInSnippets,
  loadWebsiteTrackingScripts,
  saveBuiltInTrackingIds,
  saveWebsiteTrackingScripts,
} from '@/lib/analytics/websiteTrackingScripts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const analytics = applyKnownWebsiteTracking(
      await loadProductAnalyticsConfig(supabaseAdmin, { bypassCache: true }),
    );
    const scripts = await loadWebsiteTrackingScripts(supabaseAdmin);

    return NextResponse.json({
      analytics: {
        gtm_container_id: analytics.web_tracking.gtm_container_id,
        web_measurement_id: analytics.firebase.web_measurement_id,
        meta_pixel_id: analytics.web_tracking.meta_pixel_id,
        openai_ads_pixel_id: analytics.web_tracking.openai_ads_pixel_id,
        clarity_project_id: analytics.clarity.project_id,
        gtm_enabled: scripts.gtm_enabled,
        gtag_enabled: analytics.platforms.web.gtag_enabled,
        meta_pixel_enabled: analytics.platforms.web.meta_pixel_enabled,
        openai_ads_enabled: scripts.openai_ads_enabled,
        clarity_enabled: analytics.platforms.web.clarity_enabled,
      },
      snippets: builtInSnippets(analytics),
      custom: scripts.custom,
      pages: PUBLIC_TRACKING_PAGES,
      can_edit: auth.roleCode === 'SUPER_ADMIN',
      updated_at: scripts.updated_at || analytics.updated_at || null,
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
      return NextResponse.json({ error: 'Only Super Admin can edit tracking scripts' }, { status: 403 });
    }

    const body = await request.json();
    const analytics = body?.analytics || {};
    const ids = await saveBuiltInTrackingIds(
      {
        gtm_container_id: analytics.gtm_container_id,
        web_measurement_id: analytics.web_measurement_id,
        meta_pixel_id: analytics.meta_pixel_id,
        openai_ads_pixel_id: analytics.openai_ads_pixel_id,
        clarity_project_id: analytics.clarity_project_id,
        gtag_enabled: analytics.gtag_enabled,
        meta_pixel_enabled: analytics.meta_pixel_enabled,
        clarity_enabled: analytics.clarity_enabled,
      },
      auth.userId,
    );
    if (!ids.ok) {
      return NextResponse.json({ error: ids.error }, { status: 500 });
    }

    const scripts = await saveWebsiteTrackingScripts(
      {
        gtm_enabled: analytics.gtm_enabled !== false,
        openai_ads_enabled: analytics.openai_ads_enabled !== false,
        custom: body?.custom,
      },
      auth.userId,
    );
    if (!scripts.ok) {
      return NextResponse.json({ error: scripts.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Tracking scripts saved',
      custom: scripts.config.custom,
      gtm_enabled: scripts.config.gtm_enabled,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
