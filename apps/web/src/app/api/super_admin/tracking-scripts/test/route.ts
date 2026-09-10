import { NextRequest, NextResponse } from 'next/server';
import { assertPushAdmin } from '@/lib/push/admin-auth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  applyKnownWebsiteTracking,
  loadProductAnalyticsConfig,
} from '@/lib/analytics/productAnalyticsConfig';
import { loadWebsiteTrackingScripts } from '@/lib/analytics/websiteTrackingScripts';
import { runTrackingScriptTests } from '@/lib/analytics/trackingScriptTest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const analytics = body?.analytics || {};
    let custom = Array.isArray(body?.custom) ? body.custom : null;

    if (!analytics.gtm_container_id && custom == null) {
      const { supabaseAdmin } = getSupabaseAdmin();
      const saved = applyKnownWebsiteTracking(
        await loadProductAnalyticsConfig(supabaseAdmin, { bypassCache: true }),
      );
      const scripts = await loadWebsiteTrackingScripts(supabaseAdmin);
      const checks = await runTrackingScriptTests({
        gtm_container_id: saved.web_tracking.gtm_container_id,
        web_measurement_id: saved.firebase.web_measurement_id,
        meta_pixel_id: saved.web_tracking.meta_pixel_id,
        openai_ads_pixel_id: saved.web_tracking.openai_ads_pixel_id,
        gtm_enabled: scripts.gtm_enabled,
        gtag_enabled: saved.platforms.web.gtag_enabled,
        meta_pixel_enabled: saved.platforms.web.meta_pixel_enabled,
        openai_ads_enabled: scripts.openai_ads_enabled,
        custom: scripts.custom,
      });
      const failed = checks.filter((c) => !c.ok).length;
      return NextResponse.json({
        ok: failed === 0,
        failed,
        passed: checks.length - failed,
        checks,
        preview_path: '/tracking-test',
      });
    }

    const checks = await runTrackingScriptTests({
      gtm_container_id: analytics.gtm_container_id,
      web_measurement_id: analytics.web_measurement_id,
      meta_pixel_id: analytics.meta_pixel_id,
      openai_ads_pixel_id: analytics.openai_ads_pixel_id,
      gtm_enabled: analytics.gtm_enabled,
      gtag_enabled: analytics.gtag_enabled,
      meta_pixel_enabled: analytics.meta_pixel_enabled,
      openai_ads_enabled: analytics.openai_ads_enabled,
      custom: custom || [],
    });
    const failed = checks.filter((c) => !c.ok).length;
    return NextResponse.json({
      ok: failed === 0,
      failed,
      passed: checks.length - failed,
      checks,
      preview_path: '/tracking-test',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Test failed', details: msg }, { status: 500 });
  }
}
