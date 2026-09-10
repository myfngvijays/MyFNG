import Script from 'next/script';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  DEFAULT_OPENAI_ADS_PIXEL_ID,
  loadProductAnalyticsConfig,
} from '@/lib/analytics/productAnalyticsConfig';
import { loadWebsiteTrackingScripts, openaiAdsInitJs } from '@/lib/analytics/websiteTrackingScripts';

/** Official OpenAI Ads pixel — one setup in HTML head, near the top. */
export default async function OpenAiAdsHeadScript() {
  let pixelId = DEFAULT_OPENAI_ADS_PIXEL_ID;
  let enabled = true;
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    const [analytics, scripts] = await Promise.all([
      loadProductAnalyticsConfig(supabaseAdmin),
      loadWebsiteTrackingScripts(supabaseAdmin),
    ]);
    pixelId = analytics.web_tracking.openai_ads_pixel_id || DEFAULT_OPENAI_ADS_PIXEL_ID;
    enabled = scripts.openai_ads_enabled !== false;
  } catch {
    // Keep official default pixel if settings are unavailable.
  }

  if (!enabled) return null;

  return (
    <Script id="openai-ads-pixel" strategy="beforeInteractive">
      {openaiAdsInitJs(pixelId, process.env.NODE_ENV !== 'production')}
    </Script>
  );
}
