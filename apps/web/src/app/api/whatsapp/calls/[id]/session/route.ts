import { NextRequest, NextResponse } from 'next/server';
import {
  callErrorResponse,
  fetchCallContext,
  isInboundDirection,
  isSuperAdminRole,
  normalizePhone,
  requireOperationalUser,
} from '@/app/api/whatsapp/calls/_shared';
import {
  acceptInboundCall,
  sendIceCandidate,
  sendSessionSignal,
} from '@/lib/services/whatsappCallingService';
import {
  submitAsteriskAnswer,
  submitAsteriskOffer,
} from '@/lib/services/asteriskBridgeService';

function normalizeSdpType(value: unknown): 'offer' | 'answer' | 'pranswer' | '' {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'offer' || normalized === 'answer' || normalized === 'pranswer') return normalized;
  return '';
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const gate = await requireOperationalUser();
    if (!gate.ok) return gate.response;
    const { db, roleCode } = gate;

    const params = await Promise.resolve(context.params as any);
    const callId = String(params?.id || '').trim();
    if (!callId) return callErrorResponse('id is required', 400);

    const { error: callContextError, callLog } = await fetchCallContext(db, callId);
    if (callContextError || !callLog) return callErrorResponse(callContextError || 'Call not found', 404);
    if (isInboundDirection(callLog.direction) && !isSuperAdminRole(roleCode)) {
      return callErrorResponse('Incoming calls are available only for Super Admin', 403);
    }

    const { data: sessions, error } = await db
      .from('whatsapp_call_sessions')
      .select('*')
      .eq('call_log_id', callId)
      .order('created_at', { ascending: false });
    if (error) return callErrorResponse(error.message || 'Failed to fetch sessions', 500);

    return NextResponse.json({ success: true, sessions: sessions || [] });
  } catch (error: any) {
    return callErrorResponse(error?.message || 'Internal server error', 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const gate = await requireOperationalUser();
    if (!gate.ok) return gate.response;
    const { db, userProfile, roleCode } = gate;

    const params = await Promise.resolve(context.params as any);
    const callId = String(params?.id || '').trim();
    if (!callId) return callErrorResponse('id is required', 400);

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || 'offer').trim().toLowerCase();

    const { error: callContextError, callLog } = await fetchCallContext(db, callId);
    if (callContextError || !callLog) return callErrorResponse(callContextError || 'Call not found', 404);
    if (isInboundDirection(callLog.direction) && !isSuperAdminRole(roleCode)) {
      return callErrorResponse('Incoming calls are available only for Super Admin', 403);
    }

    if (action === 'candidate') {
      const providerSessionId = String(body?.provider_session_id || '').trim();
      const candidate = String(body?.candidate || '').trim();
      if (!providerSessionId) return callErrorResponse('provider_session_id is required', 400);
      if (!candidate) return callErrorResponse('candidate is required', 400);

      const providerResult = await sendIceCandidate({
        callId: String(callLog.provider_call_id || callId),
        providerSessionId,
        candidate,
        sdpMid: body?.sdp_mid ? String(body.sdp_mid) : null,
        sdpMLineIndex:
          body?.sdp_mline_index != null && Number.isFinite(Number(body.sdp_mline_index))
            ? Number(body.sdp_mline_index)
            : null,
      });
      if (!providerResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: providerResult.error || 'Failed to submit ICE candidate',
            provider_status_code: providerResult.statusCode || null,
            provider_error: providerResult.raw || null,
          },
          { status: 502 }
        );
      }

      const sessionId = String(body?.session_id || '').trim();
      if (sessionId) {
        await db.from('whatsapp_call_ice_candidates').insert({
          session_id: sessionId,
          direction: 'OUTBOUND',
          candidate,
          sdp_mid: body?.sdp_mid ? String(body.sdp_mid) : null,
          sdp_mline_index:
            body?.sdp_mline_index != null && Number.isFinite(Number(body.sdp_mline_index))
              ? Math.floor(Number(body.sdp_mline_index))
              : null,
          payload: providerResult.raw || {},
        });
      }

      return NextResponse.json({ success: true, action: 'candidate', provider: providerResult.raw || null });
    }

    const sdp = String(body?.sdp || '').trim();
    const sdpType = normalizeSdpType(body?.sdp_type);
    if (!sdp) return callErrorResponse('sdp is required', 400);
    if (!sdpType) return callErrorResponse('sdp_type must be offer, answer, or pranswer', 400);

    const phone = normalizePhone(String(body?.phone || callLog?.customer_phone || ''));
    if (!phone) return callErrorResponse('phone is required', 400);

    let providerSessionId = String(body?.provider_session_id || '').trim();
    let providerRaw: unknown = null;
    let providerStatusCode: number | null = null;
    let bridgeResult: Awaited<ReturnType<typeof submitAsteriskOffer>> | undefined;

    if (sdpType === 'offer') {
      bridgeResult = await submitAsteriskOffer({ callId, phone, sdp, sdpType });
    } else {
      bridgeResult = await submitAsteriskAnswer({
        callId,
        providerSessionId: providerSessionId || null,
        sdp,
        sdpType,
      });
    }

    if (bridgeResult?.success && bridgeResult.bridgeSessionId) {
      providerSessionId = String(bridgeResult.bridgeSessionId);
    } else {
      const isInbound = isInboundDirection(callLog.direction);
      if (isInbound) {
        // Fetch Meta's SDP offer from DB (saved by webhook connect event)
        let metaOfferSdp: string | null = null;
        const { data: savedSessions } = await db
          .from('whatsapp_call_sessions')
          .select('offer_sdp')
          .eq('call_log_id', callId)
          .not('offer_sdp', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        metaOfferSdp = savedSessions?.offer_sdp
          ? String(savedSessions.offer_sdp).trim()
          : null;

        // Convert Meta's offer to an answer by changing setup directive
        let answerSdpToSend = sdp;
        if (metaOfferSdp) {
          answerSdpToSend = metaOfferSdp
            .replace(/a=setup:actpass/g, 'a=setup:active')
            .replace(/a=setup:passive/g, 'a=setup:active');
          console.log('[InboundCall] Using Meta offer converted to answer, length:', answerSdpToSend.length);
        } else {
          console.log('[InboundCall] No Meta offer found, using client SDP, length:', sdp.length);
        }

        const acceptResult = await acceptInboundCall({
          callId: String(callLog.provider_call_id || callId),
          to: phone,
          sdp: answerSdpToSend,
          sdpType: 'answer',
        });
        console.log('[InboundCall] acceptInboundCall result:', JSON.stringify({
          success: acceptResult.success,
          statusCode: acceptResult.statusCode,
          error: acceptResult.error,
          answerSdp: acceptResult.answerSdp ? 'present' : 'none',
          raw: acceptResult.raw,
        }));
        providerRaw = acceptResult.raw || null;
        providerStatusCode = acceptResult.statusCode || null;
        if (acceptResult.success) {
          if (acceptResult.sessionId) {
            providerSessionId = String(acceptResult.sessionId);
          }
          if (acceptResult.answerSdp) {
            (providerRaw as any) = {
              ...((providerRaw as any) || {}),
              answer_sdp: acceptResult.answerSdp,
              answer_sdp_type: acceptResult.answerSdpType || 'answer',
            };
          }
        } else {
          // Meta rejected the accept — return the error so the UI can show it
          return NextResponse.json(
            {
              success: false,
              error: acceptResult.error || 'Meta rejected call accept',
              provider_status_code: acceptResult.statusCode || null,
              provider_error: acceptResult.raw || null,
              bridge_error: bridgeResult?.error || null,
              accept_failed: true,
            },
            { status: 502 }
          );
        }
      } else {
        // Outbound call: send SDP offer/answer via standard session signal.
        const providerResult = await sendSessionSignal({
          callId: String(callLog.provider_call_id || callId),
          to: phone,
          sdp,
          sdpType,
          providerSessionId: providerSessionId || null,
        });
        if (!providerResult.success) {
          return NextResponse.json(
            {
              success: false,
              error: providerResult.error || 'Failed to submit session signal',
              provider_status_code: providerResult.statusCode || null,
              provider_error: providerResult.raw || null,
              bridge_error: bridgeResult?.error || null,
            },
            { status: 502 }
          );
        }
        providerSessionId = String(providerResult.sessionId || providerSessionId || '').trim();
        providerRaw = providerResult.raw || null;
        providerStatusCode = providerResult.statusCode || null;
      }
    }

    const now = new Date().toISOString();

    // For answer, update call status to ACCEPTED.
    if (sdpType === 'answer' || sdpType === 'pranswer') {
      await db
        .from('whatsapp_call_logs')
        .update({ call_status: 'ACCEPTED', started_at: now, updated_at: now })
        .eq('id', callId);
    }

    const upsertPayload: Record<string, unknown> = {
      call_log_id: callId,
      provider_call_id: callLog.provider_call_id || null,
      provider_session_id: providerSessionId || null,
      session_state: sdpType === 'offer' ? 'NEGOTIATING' : 'CONNECTED',
      payload: providerRaw || {},
      meta: {
        source: 'api_session_signal',
        actor_id: userProfile.id,
        actor_name: userProfile.full_name || null,
        bridge_status: bridgeResult?.status || null,
      },
      updated_at: now,
    };
    if (sdpType === 'offer') {
      upsertPayload.offer_sdp = sdp;
      upsertPayload.offer_sdp_type = sdpType;
    } else {
      upsertPayload.answer_sdp = sdp;
      upsertPayload.answer_sdp_type = sdpType;
    }

    // Upsert by provider_session_id if available, else insert.
    let session: any = null;
    let sessionError: any = null;
    if (providerSessionId) {
      const { data, error } = await db
        .from('whatsapp_call_sessions')
        .upsert(upsertPayload, { onConflict: 'provider_session_id' })
        .select('*')
        .maybeSingle();
      session = data;
      sessionError = error;
    } else {
      const { data: existing } = await db
        .from('whatsapp_call_sessions')
        .select('id')
        .eq('call_log_id', callId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        const { data, error } = await db
          .from('whatsapp_call_sessions')
          .update(upsertPayload)
          .eq('id', existing.id)
          .select('*')
          .maybeSingle();
        session = data;
        sessionError = error;
      } else {
        const { data, error } = await db
          .from('whatsapp_call_sessions')
          .insert(upsertPayload)
          .select('*')
          .maybeSingle();
        session = data;
        sessionError = error;
      }
    }
    if (sessionError) {
      return callErrorResponse(sessionError.message || 'Failed to store session', 500);
    }

    const rawObj = (providerRaw as any) || {};
    return NextResponse.json({
      success: true,
      action: sdpType,
      session,
      bridge: bridgeResult?.raw || null,
      provider_status_code: providerStatusCode,
      // SDP answer from Meta (for inbound call WebRTC completion)
      answer_sdp: rawObj?.answer_sdp || null,
      answer_sdp_type: rawObj?.answer_sdp_type || null,
    });
  } catch (error: any) {
    return callErrorResponse(error?.message || 'Internal server error', 500);
  }
}
