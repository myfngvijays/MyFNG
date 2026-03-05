import { NextRequest, NextResponse } from 'next/server';
import {
  callErrorResponse,
  fetchCallContext,
  isInboundDirection,
  isSuperAdminRole,
  requireOperationalUser,
} from '@/app/api/whatsapp/calls/_shared';
import { sendCallControl } from '@/lib/services/whatsappCallingService';
import { submitAsteriskControl } from '@/lib/services/asteriskBridgeService';

const CONTROL_ACTIONS = ['hangup', 'mute', 'unmute', 'hold', 'resume', 'transfer', 'dtmf'] as const;
type ControlAction = (typeof CONTROL_ACTIONS)[number];

function asControlAction(value: unknown): ControlAction | '' {
  const normalized = String(value || '').trim().toLowerCase();
  return CONTROL_ACTIONS.includes(normalized as ControlAction) ? (normalized as ControlAction) : '';
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
    const action = asControlAction(body?.action);
    if (!action) {
      return callErrorResponse('Unsupported action. Use hangup, mute, unmute, hold, resume, transfer, dtmf', 400);
    }

    const { error: callContextError, callLog } = await fetchCallContext(db, callId);
    if (callContextError || !callLog) return callErrorResponse(callContextError || 'Call not found', 404);
    if (isInboundDirection(callLog.direction) && !isSuperAdminRole(roleCode)) {
      return callErrorResponse('Incoming calls are available only for Super Admin', 403);
    }

    const now = new Date().toISOString();
    const controlPayload =
      body?.payload && typeof body.payload === 'object'
        ? (body.payload as Record<string, unknown>)
        : {};

    const { data: auditRow } = await db
      .from('whatsapp_call_control_audit')
      .insert({
        call_log_id: callId,
        action,
        action_status: 'REQUESTED',
        requested_by: userProfile.id,
        request_payload: controlPayload,
        updated_at: now,
      })
      .select('*')
      .maybeSingle();

    const bridgeResult = await submitAsteriskControl({
      callId,
      action,
      payload: controlPayload,
    });

    if (!bridgeResult.success) {
      const providerResult = await sendCallControl({
        callId: String(callLog.provider_call_id || callId),
        action,
        payload: controlPayload,
      });

      if (!providerResult.success) {
        if (auditRow?.id) {
          await db
            .from('whatsapp_call_control_audit')
            .update({
              action_status: 'FAILED',
              error_message: providerResult.error || 'Control action failed',
              response_payload: providerResult.raw || {},
              updated_at: new Date().toISOString(),
            })
            .eq('id', auditRow.id);
        }

        if (action === 'hangup') {
          const endedNow = new Date().toISOString();
          await db
            .from('whatsapp_call_logs')
            .update({ call_status: 'ENDED', ended_at: endedNow, updated_at: endedNow })
            .eq('id', callId);
          await db
            .from('whatsapp_call_sessions')
            .update({ session_state: 'ENDED', updated_at: endedNow })
            .eq('call_log_id', callId);
          return NextResponse.json({
            success: true,
            action,
            via: 'local_override',
            audit_id: auditRow?.id || null,
          });
        }

        return NextResponse.json(
          {
            success: false,
            error: providerResult.error || 'Control action failed',
            provider_status_code: providerResult.statusCode || null,
            provider_error: providerResult.raw || null,
            bridge_error: bridgeResult.error || null,
          },
          { status: 502 }
        );
      }

      if (action === 'hangup') {
        const endedNow = new Date().toISOString();
        await db
          .from('whatsapp_call_logs')
          .update({ call_status: 'ENDED', ended_at: endedNow, updated_at: endedNow })
          .eq('id', callId);
        await db
          .from('whatsapp_call_sessions')
          .update({ session_state: 'ENDED', updated_at: endedNow })
          .eq('call_log_id', callId);
      }

      if (auditRow?.id) {
        await db
          .from('whatsapp_call_control_audit')
          .update({
            action_status: 'DONE',
            response_payload: providerResult.raw || {},
            updated_at: new Date().toISOString(),
          })
          .eq('id', auditRow.id);
      }

      return NextResponse.json({
        success: true,
        action,
        via: 'provider',
        audit_id: auditRow?.id || null,
      });
    }

    if (auditRow?.id) {
      await db
        .from('whatsapp_call_control_audit')
        .update({
          action_status: 'DONE',
          response_payload: bridgeResult.raw || {},
          updated_at: new Date().toISOString(),
        })
        .eq('id', auditRow.id);
    }

    if (action === 'hangup') {
      await db
        .from('whatsapp_call_logs')
        .update({
          call_status: 'ENDED',
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', callId);
      await db
        .from('whatsapp_call_sessions')
        .update({
          session_state: 'ENDED',
          updated_at: new Date().toISOString(),
        })
        .eq('call_log_id', callId);
    }

    return NextResponse.json({
      success: true,
      action,
      via: 'asterisk_bridge',
      audit_id: auditRow?.id || null,
      status: bridgeResult.status || 'DONE',
    });
  } catch (error: any) {
    return callErrorResponse(error?.message || 'Internal server error', 500);
  }
}
