import {
  evaluateForceUpdate,
  getMobileAppVersionConfig,
  type MobilePlatform,
} from '@/lib/mobile-app-version-config';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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
    const result = evaluateForceUpdate(config, platform, currentVersion, currentBuild);

    return NextResponse.json({
      success: true,
      force_update: result.required,
      platform: result.platform,
      store_url: result.store_url,
      message: result.message,
      min_version: result.min_version,
      min_build: result.min_build,
      current_version: result.current_version,
      current_build: result.current_build,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
