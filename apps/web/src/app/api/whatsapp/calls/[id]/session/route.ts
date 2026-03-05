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
  preAcceptInboundCall,
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

    let allSessions: any[] = sessions || [];

    const providerCallId = String(callLog.provider_call_id || '').trim();
    if (providerCallId) {
      const { data: relatedLogs } = await db
        .from('whatsapp_call_logs')
        .select('id')
        .eq('provider_call_id', providerCallId)
        .neq('id', callId);
      const relatedIds = (relatedLogs || []).map((r: any) => r.id).filter(Boolean);
      if (relatedIds.length > 0) {
        const { data: relatedSessions } = await db
          .from('whatsapp_call_sessions')
          .select('*')
          .in('call_log_id', relatedIds);
        if (relatedSessions?.length) {
          allSessions = [...allSessions, ...relatedSessions];
        }
      }

      const { data: providerSessions } = await db
        .from('whatsapp_call_sessions')
        .select('*')
        .eq('provider_call_id', providerCallId);
      if (providerSessions?.length) {
        allSessions = [...allSessions, ...providerSessions];
      }
    }

    const uniqueSessions = Array.from(
      new Map(allSessions.map((s: any) => [s.id, s])).values()
    );

    let iceCandidates: any[] = [];
    const sessionIds = uniqueSessions.map((s: any) => s.id).filter(Boolean);
    if (sessionIds.length > 0) {
      const { data: candidateData } = await db
        .from('whatsapp_call_ice_candidates')
        .select('*')
        .in('session_id', sessionIds)
        .eq('direction', 'INBOUND')
        .order('created_at', { ascending: true });
      iceCandidates = candidateData || [];
    }

    const hasAnswerInSessions = uniqueSessions.some(
      (s: any) => String(s.answer_sdp || '').trim().length > 0
    );

    let webhookAnswerSdp: string | null = null;
    let webhookAnswerSdpType: string | null = null;
    let webhookCallStatus: string | null = null;

    const currentCallStatus = String(callLog.call_status || '').trim().toUpperCase();
    const isCallTerminated = ['ENDED', 'FAILED', 'MISSED', 'REJECTED'].includes(currentCallStatus);

    if (providerCallId && (!hasAnswerInSessions || !isCallTerminated)) {
      const { data: webhookRows } = await db
        .from('whatsapp_webhook_events')
        .select('id, payload, received_at, process_status')
        .order('received_at', { ascending: false })
        .limit(10);
      const matchingRows = (webhookRows || []).filter((row: any) => {
        const raw = JSON.stringify(row?.payload || {});
        return raw.includes(providerCallId);
      });

      for (const row of matchingRows) {
        const entries = Array.isArray(row.payload?.entry) ? row.payload.entry : [];
        for (const entry of entries) {
          const changes = Array.isArray(entry?.changes) ? entry.changes : [];
          for (const change of changes) {
            const calls = Array.isArray(change?.value?.calls) ? change.value.calls : [];
            for (const callItem of calls) {
              const itemId = String(callItem?.call_id || callItem?.id || '').trim();
              if (itemId !== providerCallId) continue;
              const sdp = String(callItem?.session?.sdp || '').trim();
              const sdpType = String(callItem?.session?.sdp_type || '').trim().toLowerCase();
              if (sdp && !webhookAnswerSdp) {
                webhookAnswerSdp = sdp;
                webhookAnswerSdpType = sdpType || 'answer';
              }
            }

            const statuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : [];
            const statusPriority: Record<string, number> = {
              INITIATED: 0,
              RINGING: 1,
              ACCEPTED: 2,
              CONNECTED: 3,
              MISSED: 4,
              REJECTED: 4,
              ENDED: 4,
              FAILED: 4,
            };
            for (const statusItem of statuses) {
              const itemId = String(statusItem?.id || '').trim();
              if (itemId !== providerCallId) continue;
              const status = String(statusItem?.status || '').trim().toUpperCase();
              if (
                status &&
                ((statusPriority[status] ?? -1) >= (statusPriority[String(webhookCallStatus || '').toUpperCase()] ?? -1))
              ) {
                webhookCallStatus = status;
              }
            }

            for (const callItem of calls) {
              const itemId = String(callItem?.call_id || callItem?.id || '').trim();
              if (itemId !== providerCallId) continue;
              const event = String(callItem?.event || '').trim().toLowerCase();
              const callStatus = String(callItem?.status || '').trim().toUpperCase();
              const isTerminalEvent = ['terminate', 'terminated', 'hangup', 'end', 'ended', 'cancel', 'cancelled', 'canceled', 'reject', 'rejected', 'declined', 'busy', 'no_answer', 'not_answered', 'timeout'].includes(event);
              const normalizedTerminalStatus = ['FAILED', 'ENDED', 'MISSED', 'REJECTED'].includes(callStatus) ? callStatus : '';
              if (isTerminalEvent || normalizedTerminalStatus) {
                webhookCallStatus = normalizedTerminalStatus || 'ENDED';
              }
            }
          }
        }
      }

      if (!hasAnswerInSessions && webhookAnswerSdp) {
        const existingSessionId = uniqueSessions[0]?.id;
        if (existingSessionId) {
          await db
            .from('whatsapp_call_sessions')
            .update({
              answer_sdp: webhookAnswerSdp,
              answer_sdp_type: webhookAnswerSdpType || 'answer',
              session_state: 'CONNECTED',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingSessionId);
          uniqueSessions[0].answer_sdp = webhookAnswerSdp;
          uniqueSessions[0].answer_sdp_type = webhookAnswerSdpType || 'answer';
          uniqueSessions[0].session_state = 'CONNECTED';
        } else {
          await db.from('whatsapp_call_sessions').insert({
            call_log_id: callId,
            provider_call_id: providerCallId,
            answer_sdp: webhookAnswerSdp,
            answer_sdp_type: webhookAnswerSdpType || 'answer',
            session_state: 'CONNECTED',
            meta: { source: 'webhook_extraction' },
          });
          uniqueSessions.push({
            answer_sdp: webhookAnswerSdp,
            answer_sdp_type: webhookAnswerSdpType || 'answer',
            session_state: 'CONNECTED',
            meta: { source: 'webhook_extraction' },
          });
        }
      }

      if (webhookCallStatus) {
        const statusMap: Record<string, string> = {
          RINGING: 'RINGING',
          ACCEPTED: 'ACCEPTED',
          CONNECTED: 'CONNECTED',
          MISSED: 'MISSED',
          REJECTED: 'REJECTED',
          ENDED: 'ENDED',
          FAILED: 'FAILED',
        };
        const mappedStatus = statusMap[webhookCallStatus];
        if (mappedStatus) {
          const statusPriority: Record<string, number> = { INITIATED: 0, RINGING: 1, ACCEPTED: 2, CONNECTED: 3, MISSED: 4, REJECTED: 4, ENDED: 4, FAILED: 4 };
          if ((statusPriority[mappedStatus] ?? -1) > (statusPriority[currentCallStatus] ?? -1)) {
            const updatePayload: Record<string, unknown> = { call_status: mappedStatus, updated_at: new Date().toISOString() };
            if (mappedStatus === 'ENDED' || mappedStatus === 'FAILED' || mappedStatus === 'MISSED' || mappedStatus === 'REJECTED') {
              updatePayload.ended_at = new Date().toISOString();
            }
            await db
              .from('whatsapp_call_logs')
              .update(updatePayload)
              .eq('id', callId);
          }
        }
      }
    }

    const latestCallStatus = webhookCallStatus || currentCallStatus || null;
    return NextResponse.json({ success: true, sessions: uniqueSessions, ice_candidates: iceCandidates, call_status: latestCallStatus });
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
        const metaAction = String(body?.meta_action || 'accept').trim().toLowerCase();

        if (metaAction === 'pre_accept') {
          const preResult = await preAcceptInboundCall({
            callId: String(callLog.provider_call_id || callId),
            sdp,
          });
          providerRaw = preResult.raw || null;
          providerStatusCode = preResult.statusCode || null;
          if (!preResult.success) {
            return NextResponse.json(
              {
                success: false,
                error: preResult.error || 'Meta rejected pre_accept',
                provider_status_code: preResult.statusCode || null,
                provider_error: preResult.raw || null,
                bridge_error: bridgeResult?.error || null,
                accept_failed: true,
              },
              { status: 502 }
            );
          }
        } else {
          const acceptResult = await acceptInboundCall({
            callId: String(callLog.provider_call_id || callId),
            sdp,
          });
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
        }
      } else {
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
