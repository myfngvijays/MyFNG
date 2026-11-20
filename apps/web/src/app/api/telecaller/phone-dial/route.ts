import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WINDOW_MS = 45_000;

async function staffProfile(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const profile = await resolveUserProfile(supabase, user);
  const roleCode = String((profile?.roles as { role_code?: string } | undefined)?.role_code || '')
    .trim()
    .toUpperCase();
  const allowed = new Set(['TELECALLER', 'LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
  if (!allowed.has(roleCode)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  const profileId = String((profile as { id?: string } | null)?.id || user.id || '').trim();
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin || !profileId) {
    return { error: NextResponse.json({ error: 'Call service is not configured' }, { status: 500 }) };
  }
  return { profileId, supabaseAdmin };
}

/** Latest web call still waiting for the open phone app. */
export async function GET(request: NextRequest) {
  const ctx = await staffProfile(request);
  if ('error' in ctx && ctx.error) return ctx.error;
  const { profileId, supabaseAdmin } = ctx as Exclude<typeof ctx, { error: NextResponse }>;
  const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();

  await supabaseAdmin
    .from('telecaller_call_logs')
    .update({
      call_status: 'CANCELLED',
      notes: '[Phone dial] Timed out before the phone app opened',
    })
    .eq('telecaller_id', profileId)
    .eq('call_status', 'DEVICE_PENDING')
    .lt('created_at', cutoff);

  const id = String(new URL(request.url).searchParams.get('id') || '').trim();
  let query = supabaseAdmin
    .from('telecaller_call_logs')
    .select('id, lead_id, phone_number, call_status, created_at')
    .eq('telecaller_id', profileId);
  query = id
    ? query.eq('id', id)
    : query.eq('call_status', 'DEVICE_PENDING').gte('created_at', cutoff);
  const { data } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (!data?.id) return NextResponse.json({ pending: null });
  return NextResponse.json({
    pending: {
      id: data.id,
      lead_id: data.lead_id,
      phone: data.phone_number,
      status: data.call_status,
      created_at: data.created_at,
    },
  });
}

/** Phone opened the dialer, or the website cancelled the wait. */
export async function POST(request: NextRequest) {
  const ctx = await staffProfile(request);
  if ('error' in ctx && ctx.error) return ctx.error;
  const { profileId, supabaseAdmin } = ctx as Exclude<typeof ctx, { error: NextResponse }>;
  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || '').trim();
  const action = String(body?.action || '').toLowerCase();
  if (!id || (action !== 'ack' && action !== 'cancel')) {
    return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
  }

  const nextStatus = action === 'ack' ? 'RINGING' : 'CANCELLED';
  const notes =
    action === 'ack'
      ? '[Phone dial] Phone app opened the lead and the call sheet'
      : '[Phone dial] Cancelled from the website';

  const { data } = await supabaseAdmin
    .from('telecaller_call_logs')
    .update({ call_status: nextStatus, notes })
    .eq('id', id)
    .eq('telecaller_id', profileId)
    .eq('call_status', 'DEVICE_PENDING')
    .select('id, call_status')
    .maybeSingle();

  return NextResponse.json({ success: true, updated: Boolean(data?.id), status: data?.call_status || nextStatus });
}
