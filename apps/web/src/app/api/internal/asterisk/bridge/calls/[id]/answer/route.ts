import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertInternalAsteriskAuth, signalingConfigState } from '@/app/api/internal/asterisk/_shared';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = assertInternalAsteriskAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const params = await Promise.resolve(context.params as any);
  const callId = String(params?.id || '').trim();
  if (!callId) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const providerSessionId = String(body?.provider_session_id || '').trim();
  const sdp = String(body?.sdp || '').trim();
  const sdpType = String(body?.sdp_type || '').trim().toLowerCase();
  if (!sdp) return NextResponse.json({ success: false, error: 'sdp is required' }, { status: 400 });
  if (sdpType !== 'answer' && sdpType !== 'pranswer') {
    return NextResponse.json({ success: false, error: 'sdp_type must be answer or pranswer' }, { status: 400 });
  }

  const supabase = await createClient();
  const db: any = supabase;
  const now = new Date().toISOString();

  // Try matching by provider_session_id first, fall back to latest session for this call.
  let session: { id: string } | null = null;
  if (providerSessionId) {
    const { data } = await db
      .from('whatsapp_call_sessions')
      .select('id')
      .eq('call_log_id', callId)
      .eq('provider_session_id', providerSessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    session = data;
  }
  if (!session?.id) {
    const { data } = await db
      .from('whatsapp_call_sessions')
      .select('id')
      .eq('call_log_id', callId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    session = data;
  }
  // If still no session, create a minimal one so the answer can be persisted.
  if (!session?.id) {
    const { data: inserted } = await db
      .from('whatsapp_call_sessions')
      .insert({
        call_log_id: callId,
        provider_session_id: providerSessionId || null,
        session_state: 'NEGOTIATING',
        payload: {},
        meta: { source: 'auto_created_for_answer' },
        updated_at: now,
      })
      .select('id')
      .maybeSingle();
    session = inserted;
  }
  if (!session?.id) {
    return NextResponse.json({ success: false, error: 'Session not found and could not be created' }, { status: 404 });
  }

  await db
    .from('whatsapp_call_sessions')
    .update({
      answer_sdp: sdp,
      answer_sdp_type: sdpType,
      session_state: sdpType === 'answer' ? 'CONNECTED' : 'NEGOTIATING',
      meta: {
        source: 'internal_asterisk_answer',
        config_state: signalingConfigState(),
      },
      updated_at: now,
    })
    .eq('id', session.id);

  await db
    .from('whatsapp_call_logs')
    .update({
      call_status: sdpType === 'answer' ? 'ACCEPTED' : 'RINGING',
      started_at: sdpType === 'answer' ? now : undefined,
      updated_at: now,
    })
    .eq('id', callId);

  return NextResponse.json({
    success: true,
    status: sdpType === 'answer' ? 'CONNECTED' : 'NEGOTIATING',
    bridge_call_id: callId,
    bridge_session_id: providerSessionId,
    config_state: signalingConfigState(),
  });
}
