import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(supabase as any, user as any);
    const roleCode = String((userProfile?.roles as any)?.role_code || '');
    if (!new Set(['SUPER_ADMIN', 'SUB_ADMIN']).has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['google_business_refresh_token', 'google_business_connected_at', 'google_business_token_expiry']);
    if (error) throw error;

    const map = new Map<string, string>();
    for (const row of data || []) map.set(String((row as any).setting_key), String((row as any).setting_value || ''));

    const refreshToken = map.get('google_business_refresh_token') || '';
    const connectedAt = map.get('google_business_connected_at') || '';
    const tokenExpiry = map.get('google_business_token_expiry') || '';
    return NextResponse.json({
      connected: Boolean(refreshToken),
      connected_at: connectedAt || null,
      token_expiry: tokenExpiry || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to read Google Business status', details: e?.message }, { status: 500 });
  }
}

