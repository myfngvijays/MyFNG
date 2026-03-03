import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertInternalAsteriskAuth, signalingConfigState } from '@/app/api/internal/asterisk/_shared';

const SUPPORTED_ACTIONS = ['hangup', 'mute', 'unmute', 'hold', 'resume', 'transfer', 'dtmf'];

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
  const action = String(body?.action || '').trim().toLowerCase();
  if (!SUPPORTED_ACTIONS.includes(action)) {
    return NextResponse.json({ success: false, error: 'Unsupported control action' }, { status: 400 });
  }

  const supabase = await createClient();
  const db: any = supabase;
  const { data: callLog } = await db.from('whatsapp_call_logs').select('*').eq('id', callId).maybeSingle();
  if (!callLog) {
    return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const nextStatus = (() => {
    if (action === 'hangup') return 'ENDED';
    if (action === 'hold') return 'HOLD';
    if (action === 'resume') return 'ACCEPTED';
    return callLog.call_status || 'ACCEPTED';
  })();

  await db
    .from('whatsapp_call_logs')
    .update({
      call_status: nextStatus,
      ended_at: action === 'hangup' ? now : callLog.ended_at || null,
      updated_at: now,
    })
    .eq('id', callId);

  if (action === 'hangup') {
    await db
      .from('whatsapp_call_sessions')
      .update({
        session_state: 'ENDED',
        updated_at: now,
      })
      .eq('call_log_id', callId);
  }

  return NextResponse.json({
    success: true,
    status: action === 'hangup' ? 'ENDED' : 'DONE',
    bridge_call_id: callId,
    bridge_session_id: null,
    action,
    config_state: signalingConfigState(),
  });
}
