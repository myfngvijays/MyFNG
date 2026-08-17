import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  APPLE_APP_ID,
  APP_BUNDLE_ID,
  APP_LINK_PATHS,
  getAndroidAppLinkFingerprints,
} from '@/lib/app-association';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) return { ok: false as const, status: 403, error: 'Forbidden' };

  const roleCode = (userData as { roles?: { role_code?: string } }).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(String(roleCode || ''))) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const };
}

export async function GET() {
  try {
    const auth = await assertAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const origin = (process.env.NEXT_PUBLIC_SITE_URL || 'https://myfng.in').replace(/\/$/, '');
    const aasaUrl = `${origin}/.well-known/apple-app-site-association`;
    const assetlinksUrl = `${origin}/.well-known/assetlinks.json`;
    const inviteBaseUrl = `${origin}/refer`;
    const sampleCode = 'SAMPLECODE';
    const sampleInviteUrl = `${inviteBaseUrl}/${sampleCode}`;
    const fingerprints = getAndroidAppLinkFingerprints();

    let aasaOk = false;
    let aasaHasRefer = false;
    let aasaHasAppId = false;
    let aasaStatus: number | null = null;
    let assetlinksOk = false;
    let assetlinksFingerprintCount = 0;
    let assetlinksStatus: number | null = null;
    let fetchError: string | null = null;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const [aasaRes, assetsRes] = await Promise.all([
        fetch(aasaUrl, { signal: controller.signal, cache: 'no-store' }),
        fetch(assetlinksUrl, { signal: controller.signal, cache: 'no-store' }),
      ]);
      clearTimeout(timer);

      aasaStatus = aasaRes.status;
      aasaOk = aasaRes.ok;
      if (aasaRes.ok) {
        const aasaText = await aasaRes.text();
        aasaHasRefer = aasaText.includes('/refer/*') || aasaText.includes('"/refer');
        aasaHasAppId = aasaText.includes(APPLE_APP_ID);
      }

      assetlinksStatus = assetsRes.status;
      assetlinksOk = assetsRes.ok;
      if (assetsRes.ok) {
        const assetsJson = await assetsRes.json().catch(() => null);
        const fps = Array.isArray(assetsJson)
          ? (assetsJson[0]?.target?.sha256_cert_fingerprints as string[] | undefined) || []
          : [];
        assetlinksFingerprintCount = fps.length;
      }
    } catch (e: unknown) {
      fetchError = e instanceof Error ? e.message : 'Failed to fetch association files';
    }

    const iosReady = aasaOk && aasaHasRefer && aasaHasAppId;
    const androidReady = assetlinksOk && assetlinksFingerprintCount > 0;
    const overall: 'healthy' | 'degraded' | 'down' = !iosReady
      ? 'down'
      : !androidReady
        ? 'degraded'
        : 'healthy';

    return NextResponse.json({
      success: true,
      overall,
      origin,
      invite_base_url: inviteBaseUrl,
      invite_url_pattern: `${inviteBaseUrl}/{CODE}`,
      sample_invite_url: sampleInviteUrl,
      store_redirect_note:
        '/go/myfngapp is a store/app open link only — it does not carry a referral code. Use /refer/{CODE} for Refer & Rise invites.',
      apple_app_id: APPLE_APP_ID,
      android_package: APP_BUNDLE_ID,
      app_link_paths: [...APP_LINK_PATHS],
      aasa: {
        url: aasaUrl,
        ok: aasaOk,
        status: aasaStatus,
        has_refer_path: aasaHasRefer,
        has_app_id: aasaHasAppId,
        ready: iosReady,
      },
      assetlinks: {
        url: assetlinksUrl,
        ok: assetlinksOk,
        status: assetlinksStatus,
        fingerprint_count: assetlinksFingerprintCount,
        env_android_sha256_set: fingerprints.length > 0,
        ready: androidReady,
      },
      fetch_error: fetchError,
      admin_links: {
        universal_link: '/dashboard/super_admin/universal-link',
        system_monitor: '/dashboard/super_admin/system-monitor',
        sample_landing: `/refer/${sampleCode}`,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
