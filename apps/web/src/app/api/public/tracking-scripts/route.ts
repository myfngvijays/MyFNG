import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  applyKnownWebsiteTracking,
  loadProductAnalyticsConfig,
} from '@/lib/analytics/productAnalyticsConfig';
import { loadWebsiteTrackingScripts } from '@/lib/analytics/websiteTrackingScripts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    const analytics = applyKnownWebsiteTracking(await loadProductAnalyticsConfig(supabaseAdmin));
    const scripts = await loadWebsiteTrackingScripts(supabaseAdmin);

    return NextResponse.json({
      builtIn: {
        gtm_container_id: analytics.web_tracking.gtm_container_id,
        web_measurement_id: analytics.firebase.web_measurement_id,
        meta_pixel_id: analytics.web_tracking.meta_pixel_id,
        openai_ads_pixel_id: analytics.web_tracking.openai_ads_pixel_id,
        gtm_enabled: scripts.gtm_enabled,
        gtag_enabled: analytics.platforms.web.gtag_enabled,
        meta_pixel_enabled: analytics.platforms.web.meta_pixel_enabled,
        openai_ads_enabled: scripts.openai_ads_enabled,
      },
      custom: scripts.custom.filter((row) => row.enabled && String(row.html || '').trim()),
    });
  } catch {
    return NextResponse.json({
      builtIn: {
        gtm_container_id: '',
        web_measurement_id: '',
        meta_pixel_id: '',
        openai_ads_pixel_id: '',
        gtm_enabled: true,
        gtag_enabled: true,
        meta_pixel_enabled: true,
        openai_ads_enabled: true,
      },
      custom: [],
    });
  }
}
