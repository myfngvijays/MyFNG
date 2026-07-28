import {
  evaluateForceUpdate,
  getMobileAppVersionConfig,
  type MobilePlatform,
} from '@/lib/mobile-app-version-config';
import {
  getStoreLatestVersion,
  isStoreUpdateAvailable,
} from '@/lib/mobile-app-store-latest';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SOFT_UPDATE_MESSAGE =
  'A new version of MyFNG is available on the store. Update now for the latest features and fixes.';

function resolvePlatform(raw: string | null): MobilePlatform | null {
  const normalized = String(raw || '')
    .trim()
    .toLowerCase();
  if (normalized === 'android' || normalized === 'ios') return normalized;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams;
    const platform =
      resolvePlatform(search.get('platform')) ||
      resolvePlatform(request.headers.get('x-app-platform'));

    if (!platform) {
      return NextResponse.json({ error: 'platform is required (android or ios)' }, { status: 400 });
    }

    const currentVersion =
      search.get('version')?.trim() ||
      request.headers.get('x-app-version')?.trim() ||
      '0.0.0';
    const currentBuild = Number(
      search.get('build') || request.headers.get('x-app-build') || '0',
    );

    const { supabaseAdmin } = getSupabaseAdmin();
    const config = await getMobileAppVersionConfig(supabaseAdmin);
    const force = evaluateForceUpdate(config, platform, currentVersion, currentBuild);
    const store = await getStoreLatestVersion(platform);
    const storeUpdateAvailable = isStoreUpdateAvailable(force.current_version, store.version);

    return NextResponse.json({
      success: true,
      force_update: force.required,
      update_available: storeUpdateAvailable || force.required,
      soft_update: storeUpdateAvailable && !force.required,
      platform: force.platform,
      store_url: store.storeUrl || force.store_url,
      message: force.required ? force.message : SOFT_UPDATE_MESSAGE,
      min_version: force.min_version,
      min_build: force.min_build,
      latest_version: store.version || force.min_version || null,
      current_version: force.current_version,
      current_build: force.current_build,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
