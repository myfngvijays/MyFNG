import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { fetchFullGbpLocation } from '@/lib/gbp/parseLocation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || '';
const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  '';

async function refreshAccessToken(admin: any): Promise<string> {
  const { data } = await admin
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [
      'google_business_access_token',
      'google_business_refresh_token',
      'google_business_token_expiry',
    ]);

  const map = new Map<string, string>();
  for (const row of data || []) map.set(row.setting_key, row.setting_value || '');

  const currentToken = map.get('google_business_access_token') || '';
  const refreshToken = map.get('google_business_refresh_token') || '';
  const expiry = map.get('google_business_token_expiry') || '';
  const expiryMs = expiry ? new Date(expiry).getTime() : 0;

  if (currentToken && (!expiryMs || Date.now() < expiryMs - 60_000)) return currentToken;
  if (!refreshToken) throw new Error('GBP not connected');

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) throw new Error('OAuth credentials missing');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString(),
    cache: 'no-store',
  });
  const tokenJson: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson?.access_token) throw new Error(tokenJson?.error_description || 'Token refresh failed');

  const nextToken = String(tokenJson.access_token);
  const nextExpiry = new Date(Date.now() + Number(tokenJson.expires_in || 3600) * 1000).toISOString();
  await admin.from('system_settings').upsert([
    { setting_key: 'google_business_access_token', setting_value: nextToken, setting_type: 'STRING', category: 'INTEGRATIONS', updated_at: new Date().toISOString() },
    { setting_key: 'google_business_token_expiry', setting_value: nextExpiry, setting_type: 'STRING', category: 'INTEGRATIONS', updated_at: new Date().toISOString() },
  ], { onConflict: 'setting_key' });

  return nextToken;
}

async function fetchAndStoreGmbForLocation(
  locationName: string,
  workshopPageId: string,
  accessToken: string,
  admin: any
): Promise<{ ok: boolean; error?: string }> {
  const gmbData = await fetchFullGbpLocation(locationName, accessToken, undefined, GOOGLE_API_KEY || undefined);

  const { error } = await admin
    .from('workshop_public_pages')
    .update({
      gmb_data: gmbData,
      gmb_place_id: gmbData.place_id || null,
      gmb_last_fetched_at: new Date().toISOString(),
    })
    .eq('id', workshopPageId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function runSync(request: NextRequest, isManual: boolean) {
  const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: adminErr || 'Admin client unavailable' }, { status: 500 });

  if (isManual) {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const profile = await resolveUserProfile(supabase as any, user as any);
    const role = String((profile?.roles as any)?.role_code || '');
    if (!new Set(['SUPER_ADMIN', 'SUB_ADMIN']).has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(supabaseAdmin);
  } catch (e: any) {
    return NextResponse.json({ error: 'GBP not connected or token refresh failed', details: e?.message }, { status: 500 });
  }

  const { data: pages, error: pagesErr } = await supabaseAdmin
    .from('workshop_public_pages')
    .select('id, workshop_id, gmb_location_name')
    .not('gmb_location_name', 'is', null)
    .neq('gmb_location_name', '');

  if (pagesErr) return NextResponse.json({ error: pagesErr.message }, { status: 500 });
  if (!pages || pages.length === 0) {
    return NextResponse.json({ success: true, synced: 0, message: 'No pages with GMB location linked.' });
  }

  const results: { workshop_page_id: string; ok: boolean; error?: string }[] = [];

  for (const page of pages) {
    try {
      const result = await fetchAndStoreGmbForLocation(
        page.gmb_location_name,
        page.id,
        accessToken,
        supabaseAdmin
      );
      results.push({ workshop_page_id: page.id, ...result });
    } catch (e: any) {
      results.push({ workshop_page_id: page.id, ok: false, error: e?.message || 'unknown' });
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`GMB sync complete: ${succeeded} succeeded, ${failed} failed`);
  return NextResponse.json({ success: true, synced: succeeded, failed, total: pages.length, results });
}

export async function POST(request: NextRequest) {
  try {
    return await runSync(request, true);
  } catch (e: any) {
    console.error('GMB sync error:', e);
    return NextResponse.json({ error: 'Sync failed', details: e?.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const cronHeader = request.headers.get('x-cron-secret') || '';
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && cronHeader !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return await runSync(request, false);
  } catch (e: any) {
    console.error('GMB cron sync error:', e);
    return NextResponse.json({ error: 'Sync failed', details: e?.message }, { status: 500 });
  }
}
