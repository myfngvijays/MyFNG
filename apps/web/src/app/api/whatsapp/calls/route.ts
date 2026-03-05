import { NextRequest, NextResponse } from 'next/server';
import {
  fetchCallPermissionState,
  fetchProviderCallLogs,
  initiateBusinessCall,
  requestCallCallback,
} from '@/lib/services/whatsappCallingService';
import {
  callErrorResponse,
  fetchCallContext,
  isInboundDirection,
  isSuperAdminRole,
  normalizePhone,
  requireOperationalUser,
} from '@/app/api/whatsapp/calls/_shared';

function getGuidelinePolicyState() {
  const enabled = String(process.env.WHATSAPP_CALLING_ENABLED || '').trim() === '1';
  const country = String(process.env.WHATSAPP_CALLING_BUSINESS_COUNTRY || 'IN')
    .trim()
    .toUpperCase();
  const supportedCountries = String(process.env.WHATSAPP_CALLING_SUPPORTED_COUNTRIES || 'IN')
    .split(',')
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
  const hours = String(process.env.WHATSAPP_CALLING_ALLOWED_HOURS || '').trim(); // e.g. 09:00-21:00
  return { enabled, country, supportedCountries, hours };
}

function isWithinAllowedHours(range: string): boolean {
  if (!range) return true;
  const parts = range.split('-').map((v) => v.trim());
  if (parts.length !== 2) return true;
  const [start, end] = parts;
  const startMin = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
  const endMin = Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5));
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) return true;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (startMin <= endMin) return nowMin >= startMin && nowMin <= endMin;
  return nowMin >= startMin || nowMin <= endMin;
}


function getProviderErrorMeta(raw: unknown): {
  code: number | null;
  details: string | null;
  traceId: string | null;
} {
  const obj = raw as any;
  const codeRaw = obj?.error?.code;
  const code = Number.isFinite(Number(codeRaw)) ? Number(codeRaw) : null;
  const details = String(obj?.error?.error_data?.details || '').trim();
  const traceId = String(
    obj?.error?.fbtrace_id ||
      obj?.request_id ||
      obj?.requestId ||
      obj?.meta?.request_id ||
      obj?.meta?.requestId ||
      ''
  ).trim();
  return { code, details: details || null, traceId: traceId || null };
}

function isCallPermissionApprovalError(message?: string | null, raw?: unknown): boolean {
  const joined = `${String(message || '')} ${String((raw as any)?.error?.message || '')} ${String((raw as any)?.error?.error_data?.details || '')}`.toLowerCase();
  return joined.includes('no approved call permission');
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireOperationalUser();
    if (!gate.ok) return gate.response;
    const { db, roleCode } = gate;

    const phoneRaw = String(request.nextUrl.searchParams.get('phone') || '').trim();
    const normalizedPhone = normalizePhone(phoneRaw);
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 100);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 100;

    let query = db
      .from('whatsapp_call_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (normalizedPhone) query = query.eq('customer_phone', normalizedPhone);
    if (!isSuperAdminRole(roleCode)) query = query.neq('direction', 'INBOUND');

    const { data: logs, error } = await query;
    if (error) return callErrorResponse(error.message || 'Failed to fetch call logs', 500);

    const callIds = (logs || []).map((row: any) => row.id).filter(Boolean);
    let recordingsByCall: Record<string, any[]> = {};
    let sessionsByCall: Record<string, any[]> = {};
    if (callIds.length > 0) {
      const { data: recs } = await db
        .from('whatsapp_call_recordings')
        .select('*')
        .in('call_log_id', callIds)
        .order('created_at', { ascending: false });
      const { data: sessions } = await db
        .from('whatsapp_call_sessions')
        .select('id, call_log_id, provider_session_id, session_state, created_at, updated_at')
        .in('call_log_id', callIds)
        .order('created_at', { ascending: false });
      recordingsByCall = (recs || []).reduce((acc: Record<string, any[]>, rec: any) => {
        const key = String(rec.call_log_id || '');
        if (!key) return acc;
        if (!acc[key]) acc[key] = [];
        acc[key].push(rec);
        return acc;
      }, {});
      sessionsByCall = (sessions || []).reduce((acc: Record<string, any[]>, session: any) => {
        const key = String(session.call_log_id || '');
        if (!key) return acc;
        if (!acc[key]) acc[key] = [];
        acc[key].push(session);
        return acc;
      }, {});
    }

    return NextResponse.json({
      success: true,
      calls: (logs || [])
        .filter((row: any) => isSuperAdminRole(roleCode) || !isInboundDirection(row?.direction))
        .map((row: any) => ({
          ...row,
          recordings: recordingsByCall[String(row.id || '')] || [],
          sessions: sessionsByCall[String(row.id || '')] || [],
        })),
    });
  } catch (error: any) {
    return callErrorResponse(error?.message || 'Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireOperationalUser();
    if (!gate.ok) return gate.response;
    const { db, userProfile, roleCode } = gate;

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || 'initiate').trim().toLowerCase();
    const recipientPhone = normalizePhone(String(body?.recipient_phone || ''));
    const policy = getGuidelinePolicyState();

    if (!policy.enabled) {
      return callErrorResponse('Calling is disabled. Set WHATSAPP_CALLING_ENABLED=1', 400);
    }
    if (!policy.supportedCountries.includes(policy.country)) {
      return callErrorResponse(
        `Calling not allowed for configured business country (${policy.country})`,
        400
      );
    }
    if (!isWithinAllowedHours(policy.hours)) {
      return callErrorResponse(
        `Calling is outside allowed hours (${policy.hours}). Please request callback.`,
        400
      );
    }

    if (action === 'sync') {
      const providerLogs = await fetchProviderCallLogs({
        phoneNumber: recipientPhone || undefined,
        limit: 100,
      });
      if (!providerLogs.success) {
        return callErrorResponse(providerLogs.error || 'Failed to sync call logs', 502);
      }
      return NextResponse.json({ success: true, synced: true, provider: providerLogs.raw || null });
    }

    if (!recipientPhone) return callErrorResponse('recipient_phone is required', 400);

    if (action === 'initiate') {
      const optInConfirmed = Boolean(body?.customer_call_opt_in);
      if (!optInConfirmed) {
        return callErrorResponse(
          'Customer call opt-in is required before business-initiated calling',
          400
        );
      }
      const hasSessionPayload =
        typeof body?.session === 'object' &&
        typeof body?.session?.sdp === 'string' &&
        typeof body?.session?.sdp_type === 'string';
      if (!hasSessionPayload) {
        return callErrorResponse(
          'Missing session parameter. SDP offer is required for business-initiated calls.',
          400
        );
      }

      const permissionState = await fetchCallPermissionState(recipientPhone);
      if (
        permissionState.success &&
        String(permissionState.status || '').trim().toLowerCase() === 'no_permission'
      ) {
        const sendPermissionAction = Array.isArray(permissionState.actions)
          ? permissionState.actions.find(
              (item: any) => String(item?.action_name || '').trim() === 'send_call_permission_request'
            )
          : null;
        return NextResponse.json(
          {
            success: false,
            error: 'Provider has not approved call permission yet for this customer.',
            error_type: 'CALL_PERMISSION_NOT_APPROVED',
            permission_status: permissionState.status || null,
            permission_actions: permissionState.actions || [],
            can_send_permission_request:
              sendPermissionAction?.can_perform_action == null
                ? null
                : Boolean(sendPermissionAction.can_perform_action),
            next_steps: [
              'Customer must open the latest WhatsApp call-permission prompt and explicitly approve it.',
              'If sending permission request is blocked by quota, wait until limit resets then send again.',
              'After approval, wait 30-60 seconds and retry the call from UI.',
            ],
          },
          { status: 409 }
        );
      }

      const result = await initiateBusinessCall({
        phoneNumber: recipientPhone,
        optInToken: body?.opt_in_token ? String(body.opt_in_token) : null,
        consentGrantedAt: body?.consent_granted_at ? String(body.consent_granted_at) : null,
        reason: body?.reason ? String(body.reason) : null,
        sessionSdp: String(body.session.sdp),
        sessionSdpType: String(body.session.sdp_type).trim().toLowerCase() === 'answer'
          ? 'answer'
          : String(body.session.sdp_type).trim().toLowerCase() === 'pranswer'
            ? 'pranswer'
            : 'offer',
        providerSessionId: String(body?.session?.id || '') || null,
      });

      const now = new Date().toISOString();
      const { data: insertedCallLog } = await db
        .from('whatsapp_call_logs')
        .insert({
        provider_call_id: result.callId || null,
        direction: 'OUTBOUND',
        call_status: result.success ? String(result.status || 'INITIATED').toUpperCase() : 'FAILED',
        customer_phone: recipientPhone,
        started_at: result.success ? now : null,
        error_message: result.success ? null : result.error || 'Call initiation failed',
        payload: {
          request: {
            action,
            reason: body?.reason || null,
          },
          response: result.raw || null,
        },
        meta: {
          role_code: roleCode,
          actor_id: userProfile.id,
          actor_name: userProfile.full_name || null,
          policy: {
            country: policy.country,
            allowed_hours: policy.hours || null,
          },
        },
        created_by: userProfile.id,
        updated_at: now,
        })
        .select('id, provider_call_id')
        .maybeSingle();

      if (insertedCallLog?.id) {
        await db.from('whatsapp_call_sessions').insert({
          call_log_id: insertedCallLog.id,
          provider_call_id: insertedCallLog.provider_call_id || null,
          provider_session_id: result.sessionId || body?.session?.id || null,
          offer_sdp: String(body.session.sdp || ''),
          offer_sdp_type: String(body.session.sdp_type || '').trim().toLowerCase(),
          session_state: result.success ? 'NEGOTIATING' : 'FAILED',
          payload: body.session,
          meta: {
            source: 'initiate_payload',
            actor_id: userProfile.id,
            actor_name: userProfile.full_name || null,
          },
          updated_at: now,
        });
      }

      if (!result.success) {
        const providerStatus = Number(result.statusCode || 0);
        const providerMeta = getProviderErrorMeta(result.raw);
        const permissionPending = isCallPermissionApprovalError(result.error, result.raw);
        const responseStatus = permissionPending
          ? 409
          : Number.isFinite(providerStatus) && providerStatus >= 400 && providerStatus < 500
            ? providerStatus
            : 502;
        return NextResponse.json(
          {
            success: false,
            error: permissionPending
              ? 'Provider has not approved call permission yet for this customer.'
              : result.error || 'Call initiation failed',
            provider_status_code: result.statusCode || null,
            provider_error: result.raw || null,
            provider_error_code: providerMeta.code,
            provider_error_details: providerMeta.details,
            provider_trace_id: providerMeta.traceId,
            error_type: permissionPending ? 'CALL_PERMISSION_NOT_APPROVED' : 'CALL_INITIATION_FAILED',
            ...(permissionPending
              ? {
                  next_steps: [
                    'Customer must open the WhatsApp call permission prompt/template and explicitly approve it.',
                    'After approval, wait 30-60 seconds and retry the call from UI.',
                    'If still failing, send a fresh permission request and avoid repeated retries immediately.',
                  ],
                }
              : {}),
          },
          { status: responseStatus }
        );
      }
      const rawData = result.raw as any;
      console.log('[OutboundCall] Meta initiate response raw:', JSON.stringify(rawData));
      return NextResponse.json({
        success: true,
        action: 'initiate',
        call_id: result.callId || null,
        db_call_id: insertedCallLog?.id || null,
        session_id: result.sessionId || null,
        status: result.status || 'INITIATED',
        answer_sdp:
          rawData?.session?.sdp || rawData?.answer?.sdp || rawData?.sdp || null,
        answer_sdp_type:
          rawData?.session?.sdp_type || rawData?.answer?.sdp_type || rawData?.sdp_type || null,
      });
    }

    if (action === 'permission_status') {
      const statusResult = await fetchCallPermissionState(recipientPhone);
      if (!statusResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: statusResult.error || 'Failed to fetch permission state',
            provider_status_code: statusResult.statusCode || null,
            provider_error: statusResult.raw || null,
          },
          { status: 502 }
        );
      }
      return NextResponse.json({
        success: true,
        action: 'permission_status',
        permission_status: statusResult.status || null,
        actions: statusResult.actions || [],
        provider: statusResult.raw || null,
      });
    }

    if (action === 'callback_request') {
      const result = await requestCallCallback({
        phoneNumber: recipientPhone,
        reason: body?.reason ? String(body.reason) : null,
      });

      const now = new Date().toISOString();
      await db.from('whatsapp_call_logs').insert({
        provider_call_id: result.callId || null,
        direction: 'CALLBACK_REQUEST',
        call_status: result.success ? 'CALLBACK_REQUESTED' : 'FAILED',
        customer_phone: recipientPhone,
        callback_requested: true,
        error_message: result.success ? null : result.error || 'Callback request failed',
        payload: {
          request: {
            action,
            reason: body?.reason || null,
          },
          response: result.raw || null,
        },
        meta: {
          role_code: roleCode,
          actor_id: userProfile.id,
          actor_name: userProfile.full_name || null,
        },
        created_by: userProfile.id,
        updated_at: now,
      });

      if (!result.success) {
        const providerStatus = Number(result.statusCode || 0);
        const responseStatus =
          Number.isFinite(providerStatus) && providerStatus >= 400 && providerStatus < 500
            ? providerStatus
            : 502;
        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Callback request failed',
            provider_status_code: result.statusCode || null,
            provider_error: result.raw || null,
          },
          { status: responseStatus }
        );
      }
      return NextResponse.json({
        success: true,
        action: 'callback_request',
        call_id: result.callId || null,
        status: result.status || 'CALLBACK_REQUESTED',
      });
    }

    if (action === 'mark_session') {
      const callId = String(body?.call_id || '').trim();
      if (!callId) return callErrorResponse('call_id is required', 400);
      const { error: callContextError, callLog } = await fetchCallContext(db, callId);
      if (callContextError || !callLog) {
        return callErrorResponse(callContextError || 'Call not found', 404);
      }
      const sessionState = String(body?.session_state || 'NEGOTIATING').trim().toUpperCase();
      const now = new Date().toISOString();
      const { data: session, error: sessionError } = await db
        .from('whatsapp_call_sessions')
        .insert({
          call_log_id: callId,
          provider_call_id: callLog.provider_call_id || null,
          provider_session_id: body?.provider_session_id ? String(body.provider_session_id) : null,
          offer_sdp: body?.offer_sdp ? String(body.offer_sdp) : null,
          answer_sdp: body?.answer_sdp ? String(body.answer_sdp) : null,
          offer_sdp_type: body?.offer_sdp_type ? String(body.offer_sdp_type) : null,
          answer_sdp_type: body?.answer_sdp_type ? String(body.answer_sdp_type) : null,
          session_state: sessionState,
          payload: body?.payload && typeof body.payload === 'object' ? body.payload : {},
          meta: {
            source: 'manual_mark',
            actor_id: userProfile.id,
            actor_name: userProfile.full_name || null,
          },
          updated_at: now,
        })
        .select('*')
        .maybeSingle();
      if (sessionError) {
        return callErrorResponse(sessionError.message || 'Failed to mark session', 500);
      }
      return NextResponse.json({ success: true, session });
    }

    return callErrorResponse(
      'Unsupported action. Use initiate, callback_request, permission_status, sync, or mark_session',
      400
    );
  } catch (error: any) {
    return callErrorResponse(error?.message || 'Internal server error', 500);
  }
}
