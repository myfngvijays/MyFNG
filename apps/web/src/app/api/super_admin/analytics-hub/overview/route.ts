import { assertPushAdmin } from '@/lib/push/admin-auth';
import {
  applyKnownWebsiteTracking,
  buildPlatformStatuses,
  loadProductAnalyticsConfig,
} from '@/lib/analytics/productAnalyticsConfig';
import { loadPushFirebaseConfigView } from '@/lib/push/firebaseConfigStore';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const [config, pushFirebase] = await Promise.all([
      loadProductAnalyticsConfig(supabaseAdmin).then(applyKnownWebsiteTracking),
      loadPushFirebaseConfigView().catch(() => null),
    ]);

    const platforms = buildPlatformStatuses(config);

    return NextResponse.json({
      config,
      platforms,
      push_firebase: pushFirebase
        ? {
            project_id: pushFirebase.project_id,
            measurement_id: pushFirebase.measurement_id,
            android_enabled: pushFirebase.android_enabled,
            ios_enabled: pushFirebase.ios_enabled,
            credentials_source: pushFirebase.credentials_source,
          }
        : null,
      summary: {
        android_active:
          config.platforms.android.firebase_analytics_enabled || config.platforms.android.clarity_enabled,
        ios_active: config.platforms.ios.firebase_analytics_enabled || config.platforms.ios.clarity_enabled,
        web_active:
          config.platforms.web.gtag_enabled ||
          config.platforms.web.meta_pixel_enabled ||
          config.platforms.web.clarity_enabled,
        last_updated: config.updated_at ?? null,
      },
      can_edit: auth.roleCode === 'SUPER_ADMIN',
      admin: {
        name: auth.userName,
        role: auth.roleCode,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
