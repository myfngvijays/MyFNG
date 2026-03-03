import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertInternalAsteriskAuth, pseudoId, signalingConfigState } from '@/app/api/internal/asterisk/_shared';

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
  const sdp = String(body?.sdp || '').trim();
  const sdpType = String(body?.sdp_type || '').trim().toLowerCase();
  if (!sdp) return NextResponse.json({ success: false, error: 'sdp is required' }, { status: 400 });
  if (sdpType !== 'offer') {
    return NextResponse.json({ success: false, error: 'sdp_type must be offer' }, { status: 400 });
  }

  const supabase = await createClient();
  const db: any = supabase;
  const { data: callLog } = await db.from('whatsapp_call_logs').select('*').eq('id', callId).maybeSingle();
  if (!callLog) {
    return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 });
  }

  const bridgeSessionId = pseudoId('bridge_session');
  const now = new Date().toISOString();
  await db
    .from('whatsapp_call_sessions')
    .insert({
      call_log_id: callId,
      provider_call_id: callLog.provider_call_id || null,
      provider_session_id: bridgeSessionId,
      offer_sdp: sdp,
      offer_sdp_type: 'offer',
      session_state: 'NEGOTIATING',
      asterisk_channel_id: pseudoId('ari_channel'),
      asterisk_bridge_id: pseudoId('ari_bridge'),
      payload: body?.payload && typeof body.payload === 'object' ? body.payload : {},
      meta: {
        source: 'internal_asterisk_offer',
        config_state: signalingConfigState(),
      },
      updated_at: now,
    })
    .select('id')
    .maybeSingle();

  await db
    .from('whatsapp_call_logs')
    .update({
      call_status: 'RINGING',
      updated_at: now,
    })
    .eq('id', callId);

  return NextResponse.json({
    success: true,
    status: 'NEGOTIATING',
    bridge_call_id: callId,
    bridge_session_id: bridgeSessionId,
    config_state: signalingConfigState(),
  });
}
