import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { boundRecordingUrlForCallId, fetchRecordingAudio } from '@/lib/telecaller/smartfloCdr';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/telecaller/calls/recording/[id]
 * Streams Smartflo recording audio for a telecaller_call_logs row.
 * Auth: session cookie, Bearer, or ?access_token= (for <audio> / mobile open).
 */
async function resolveUser(request: NextRequest) {
  const url = new URL(request.url);
  const qToken = String(url.searchParams.get('access_token') || '').trim();

  if (qToken && qToken.split('.').length >= 3) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const client = createSupabaseClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${qToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
    } = await client.auth.getUser(qToken);
    if (user) return { user, supabase: client };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { user, supabase };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await resolveUser(request);
    if (!auth?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const logId = String(id || '').trim();
    if (!logId) {
      return NextResponse.json({ error: 'Missing recording id' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin ?? auth.supabase;

    const { data: log } = await db
      .from('telecaller_call_logs')
      .select('id, lead_id, call_recording_url, smartflo_call_id')
      .eq('id', logId)
      .maybeSingle();

    const { data: cdrByRow } = await db
      .from('smartflo_call_recordings')
      .select('id, recording_url, smartflo_call_id, call_log_id')
      .eq('id', logId)
      .maybeSingle();

    const cdrByCallId =
      !cdrByRow && log?.smartflo_call_id
        ? await db
            .from('smartflo_call_recordings')
            .select('id, recording_url, smartflo_call_id, call_log_id')
            .eq('smartflo_call_id', log.smartflo_call_id)
            .maybeSingle()
        : { data: null as any };

    const cdr = cdrByRow || cdrByCallId.data;
    const callId = String(cdr?.smartflo_call_id || log?.smartflo_call_id || '').trim();
    const recordingUrl = boundRecordingUrlForCallId(
      callId,
      String(cdr?.recording_url || log?.call_recording_url || '').trim() || null,
    );
    const playRefId = String(cdr?.id || log?.id || logId);

    if (!log && !cdr) {
      return NextResponse.json({ error: 'Call log not found' }, { status: 404 });
    }

    if (!recordingUrl) {
      return NextResponse.json({ error: 'No recording for this call yet' }, { status: 404 });
    }

    // JSON mode — return URL for clients that open externally (managers/admins only)
    const accept = request.headers.get('accept') || '';
    if (accept.includes('application/json') && !accept.includes('audio')) {
      const selectProfile = 'id, roles!inner(role_code)';
      const email = String(auth.user.email || '').trim();
      const phone = String((auth.user as any)?.phone || '').trim();
      const byEmail = email
        ? await auth.supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
        : { data: null as any };
      const byPhone = !byEmail.data && phone
        ? await auth.supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
        : { data: null as any };
      const byId = !byEmail.data && !byPhone.data
        ? await auth.supabase.from('users_login').select(selectProfile).eq('id', auth.user.id).maybeSingle()
        : { data: null as any };
      const profile = byEmail.data || byPhone.data || byId.data;
      const roleCode = String((profile as any)?.roles?.role_code || '').toUpperCase();
      const canExposeDirectUrl =
        roleCode === 'LEAD_MANAGER' ||
        roleCode === 'SUPER_ADMIN' ||
        roleCode === 'SUB_ADMIN';

      return NextResponse.json({
        success: true,
        call_log_id: playRefId,
        recording_url: canExposeDirectUrl ? recordingUrl : null,
        proxy: `/api/telecaller/calls/recording/${playRefId}`,
        download_allowed: canExposeDirectUrl,
      });
    }

    const audio = await fetchRecordingAudio(recordingUrl);
    if (!audio.ok) {
      return NextResponse.json(
        { error: audio.error || 'Failed to fetch recording from Smartflo' },
        { status: audio.status || 502 },
      );
    }

    return new NextResponse(audio.body, {
      status: 200,
      headers: {
        'Content-Type': audio.contentType || 'audio/mpeg',
        'Content-Length': String(audio.body.byteLength),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': `inline; filename="call-${logId}.mp3"`,
      },
    });
  } catch (e: any) {
    console.error('[calls/recording]', e);
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
