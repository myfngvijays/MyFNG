import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['TELECALLER', 'LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);

async function gate(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const profile = await resolveUserProfile(supabase, user);
  const roleCode = String((profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '')
    .trim()
    .toUpperCase();
  if (!ALLOWED.has(roleCode)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  const profileId = String((profile as { id?: string } | null)?.id || '').trim();
  if (!profileId) return { error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) };
  return { profileId };
}

function parseStored(raw: unknown) {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    const json = JSON.parse(text) as { uri?: string; label?: string; auto_since?: number };
    const uri = String(json?.uri || '').trim();
    if (!uri) return null;
    return {
      uri,
      label: String(json?.label || '').trim() || 'Recording folder',
      auto_since: Number(json?.auto_since || 0) || 0,
    };
  } catch {
    return { uri: text, label: text, auto_since: 0 };
  }
}

export async function GET(request: NextRequest) {
  const auth = await gate(request);
  if ('error' in auth && auth.error) return auth.error;
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ path: null });
  const { data, error } = await (supabaseAdmin as any)
    .from('users_login')
    .select('call_recording_path')
    .eq('id', auth.profileId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ path: null, warning: error.message });
  }
  return NextResponse.json({ path: parseStored((data as { call_recording_path?: string } | null)?.call_recording_path) });
}

export async function PUT(request: NextRequest) {
  const auth = await gate(request);
  if ('error' in auth && auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const uri = String(body?.uri || '').trim();
  const label = String(body?.label || '').trim();
  const autoSince = Number(body?.auto_since || Date.now()) || Date.now();
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, error: 'Profile save is not configured' }, { status: 500 });
  }
  const stored = uri ? JSON.stringify({ uri, label: label || 'Recording folder', auto_since: autoSince }) : null;
  const { error } = await (supabaseAdmin as any)
    .from('users_login')
    .update({ call_recording_path: stored })
    .eq('id', auth.profileId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, path: stored ? parseStored(stored) : null });
}
