const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';

const WHATSAPP_CALLING_API_URL =
  process.env.WHATSAPP_CALLING_API_URL || `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}`;
const WHATSAPP_CALLING_ACCESS_TOKEN =
  process.env.WHATSAPP_CALLING_ACCESS_TOKEN || WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_CALLING_START_PATH = process.env.WHATSAPP_CALLING_START_PATH || '/calls';
const WHATSAPP_CALLING_CALLBACK_PATH =
  process.env.WHATSAPP_CALLING_CALLBACK_PATH || '';
const WHATSAPP_CALLING_LOGS_PATH = process.env.WHATSAPP_CALLING_LOGS_PATH || '/calls/logs';
const WHATSAPP_CALLING_SESSION_PATH_TEMPLATE =
  process.env.WHATSAPP_CALLING_SESSION_PATH_TEMPLATE || '/calls/{call_id}/session';
const WHATSAPP_CALLING_CONTROL_PATH_TEMPLATE =
  process.env.WHATSAPP_CALLING_CONTROL_PATH_TEMPLATE || '';
const WHATSAPP_CALLING_CONTROL_FALLBACK_PATH =
  process.env.WHATSAPP_CALLING_CONTROL_FALLBACK_PATH || '/calls';

export type WhatsAppCallingResult = {
  success: boolean;
  callId?: string;
  sessionId?: string;
  status?: string;
  error?: string;
  statusCode?: number;
  raw?: unknown;
};

export type CallPermissionStateResult = {
  success: boolean;
  status?: 'temporary' | 'no_permission' | string;
  actions?: Array<{
    action_name?: string;
    can_perform_action?: boolean;
    limits?: Array<{
      time_period?: string;
      max_allowed?: number;
      current_usage?: number;
    }>;
  }>;
  error?: string;
  statusCode?: number;
  raw?: unknown;
};

export type SessionSignalPayload = {
  callId: string;
  to: string;
  sdp: string;
  sdpType: 'offer' | 'answer' | 'pranswer';
  providerSessionId?: string | null;
};

export type IceCandidatePayload = {
  callId: string;
  providerSessionId: string;
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
};

export type CallControlPayload = {
  callId: string;
  action: 'hangup' | 'mute' | 'unmute' | 'hold' | 'resume' | 'transfer' | 'dtmf';
  payload?: Record<string, unknown>;
};

function normalizePhoneNumber(phoneNumber: string): string {
  const digits = String(phoneNumber || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('91') ? digits : `91${digits}`;
}

function assertCallingConfig(): string | null {
  if (!WHATSAPP_PHONE_NUMBER_ID) return 'WHATSAPP_PHONE_NUMBER_ID is not configured';
  if (!WHATSAPP_CALLING_ACCESS_TOKEN) return 'WHATSAPP_CALLING_ACCESS_TOKEN is not configured';
  if (!WHATSAPP_CALLING_API_URL) return 'WHATSAPP_CALLING_API_URL is not configured';
  return null;
}

async function parseProviderError(response: Response): Promise<{ message: string; raw?: unknown }> {
  try {
    const payload = await response.json();
    const baseMessage =
      payload?.error?.error_user_msg ||
      payload?.error?.message ||
      payload?.message ||
      `WhatsApp Calling API request failed (${response.status})`;
    const details = payload?.error?.error_data?.details;
    const message =
      typeof details === 'string' && details.trim().length > 0
        ? `${baseMessage} (${details.trim()})`
        : baseMessage;
    return { message, raw: payload };
  } catch {
    return { message: `WhatsApp Calling API request failed (${response.status})` };
  }
}

async function providerRequest(path: string, init: RequestInit): Promise<WhatsAppCallingResult> {
  const configError = assertCallingConfig();
  if (configError) return { success: false, error: configError };

  try {
    const response = await fetch(`${WHATSAPP_CALLING_API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WHATSAPP_CALLING_ACCESS_TOKEN}`,
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      const parsed = await parseProviderError(response);
      return {
        success: false,
        error: parsed.message,
        statusCode: response.status,
        raw: parsed.raw,
      };
    }

    const data = await response.json().catch(() => ({}));
    return {
      success: true,
      callId:
        data?.call_id ||
        data?.id ||
        data?.data?.call_id ||
        data?.call?.id ||
        undefined,
      sessionId:
        data?.session_id ||
        data?.session?.id ||
        data?.data?.session_id ||
        data?.call?.session_id ||
        undefined,
      status: data?.status || data?.call_status || undefined,
      statusCode: response.status,
      raw: data,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Calling provider request failed' };
  }
}

export async function initiateBusinessCall(input: {
  phoneNumber: string;
  optInToken?: string | null;
  consentGrantedAt?: string | null;
  reason?: string | null;
  sessionSdp?: string | null;
  sessionSdpType?: 'offer' | 'answer' | 'pranswer' | null;
  providerSessionId?: string | null;
}): Promise<WhatsAppCallingResult> {
  const to = normalizePhoneNumber(input.phoneNumber);
  if (!to) return { success: false, error: 'Invalid recipient phone number' };

  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to,
    type: 'voice',
  };
  if (input.reason) payload.reason = input.reason;
  if (input.optInToken || input.consentGrantedAt) {
    payload.consent = {
      ...(input.optInToken ? { opt_in_token: input.optInToken } : {}),
      ...(input.consentGrantedAt ? { granted_at: input.consentGrantedAt } : {}),
    };
  }
  if (input.sessionSdp && input.sessionSdpType) {
    payload.session = {
      sdp: String(input.sessionSdp),
      sdp_type: String(input.sessionSdpType),
      ...(input.providerSessionId ? { id: String(input.providerSessionId) } : {}),
    };
  }

  return providerRequest(WHATSAPP_CALLING_START_PATH, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function requestCallCallback(input: {
  phoneNumber: string;
  reason?: string | null;
}): Promise<WhatsAppCallingResult> {
  if (!String(WHATSAPP_CALLING_CALLBACK_PATH || '').trim()) {
    return {
      success: false,
      error:
        'Callback endpoint is not configured. Set WHATSAPP_CALLING_CALLBACK_PATH if your provider supports callback requests.',
    };
  }
  const to = normalizePhoneNumber(input.phoneNumber);
  if (!to) return { success: false, error: 'Invalid recipient phone number' };

  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to,
  };
  if (input.reason) payload.reason = input.reason;

  return providerRequest(WHATSAPP_CALLING_CALLBACK_PATH, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function resolveTemplatePath(template: string, callId: string): string {
  return template.replace('{call_id}', encodeURIComponent(callId));
}

export async function sendSessionSignal(input: SessionSignalPayload): Promise<WhatsAppCallingResult> {
  const callId = String(input.callId || '').trim();
  const to = normalizePhoneNumber(input.to);
  const sdp = String(input.sdp || '').trim();
  const sdpType = String(input.sdpType || '').trim().toLowerCase();
  if (!callId) return { success: false, error: 'callId is required' };
  if (!to) return { success: false, error: 'Invalid recipient phone number' };
  if (!sdp) return { success: false, error: 'session.sdp is required' };
  if (!['offer', 'answer', 'pranswer'].includes(sdpType)) {
    return { success: false, error: 'session.sdp_type must be offer, answer, or pranswer' };
  }

  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to,
    session: {
      sdp,
      sdp_type: sdpType,
      ...(input.providerSessionId ? { id: String(input.providerSessionId) } : {}),
    },
  };

  return providerRequest(resolveTemplatePath(WHATSAPP_CALLING_SESSION_PATH_TEMPLATE, callId), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function sendIceCandidate(input: IceCandidatePayload): Promise<WhatsAppCallingResult> {
  const callId = String(input.callId || '').trim();
  const providerSessionId = String(input.providerSessionId || '').trim();
  const candidate = String(input.candidate || '').trim();
  if (!callId) return { success: false, error: 'callId is required' };
  if (!providerSessionId) return { success: false, error: 'providerSessionId is required' };
  if (!candidate) return { success: false, error: 'candidate is required' };

  return providerRequest(resolveTemplatePath(WHATSAPP_CALLING_SESSION_PATH_TEMPLATE, callId), {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      session: {
        id: providerSessionId,
        candidate,
        ...(input.sdpMid ? { sdp_mid: input.sdpMid } : {}),
        ...(input.sdpMLineIndex != null ? { sdp_mline_index: input.sdpMLineIndex } : {}),
      },
    }),
  });
}

/**
 * Accept an inbound WhatsApp call. Sends our SDP offer so Meta can establish
 * the WebRTC media path and respond with its SDP answer.
 */
export async function acceptInboundCall(input: {
  callId: string;
  to: string;
  sdp?: string | null;
  sdpType?: 'offer' | 'answer' | 'pranswer' | null;
}): Promise<WhatsAppCallingResult & { answerSdp?: string; answerSdpType?: string }> {
  const callId = String(input.callId || '').trim();
  const to = normalizePhoneNumber(input.to);
  if (!callId) return { success: false, error: 'callId is required' };
  if (!to) return { success: false, error: 'Invalid recipient phone number' };

  // Meta requires: action='accept', session.sdp_type='answer'
  const actionVariants: Array<Record<string, unknown>> = input.sdp
    ? [
        {
          messaging_product: 'whatsapp',
          call_id: callId,
          action: 'accept',
          session: { sdp: input.sdp, sdp_type: 'answer' },
        },
      ]
    : [
        { messaging_product: 'whatsapp', call_id: callId, action: 'accept' },
      ];

  const attempts: Array<{ path: string; payload: Record<string, unknown>; result: WhatsAppCallingResult }> = [];
  for (const payload of actionVariants) {
    const result = await providerRequest(WHATSAPP_CALLING_CONTROL_FALLBACK_PATH, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    attempts.push({ path: WHATSAPP_CALLING_CONTROL_FALLBACK_PATH, payload, result });
    console.log(`[acceptInboundCall] ${WHATSAPP_CALLING_CONTROL_FALLBACK_PATH}`, {
      payloadKeys: Object.keys(payload),
      success: result.success,
      statusCode: result.statusCode,
      error: result.error,
    });
    if (result.success) {
      const raw = result.raw as any;
      const answerSdp: string | undefined =
        raw?.session?.sdp || raw?.answer?.sdp || raw?.sdp || undefined;
      const answerSdpType: string | undefined =
        raw?.session?.sdp_type || raw?.answer?.sdp_type || raw?.sdp_type || undefined;
      return { ...result, answerSdp, answerSdpType };
    }
  }

  // Try the session endpoint as last resort
  const sessionPath = resolveTemplatePath(WHATSAPP_CALLING_SESSION_PATH_TEMPLATE, callId);
  const sessionPayload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to,
    ...(input.sdp && input.sdpType
      ? { session: { sdp: input.sdp, sdp_type: input.sdpType } }
      : {}),
  };
  const sessionResult = await providerRequest(sessionPath, {
    method: 'POST',
    body: JSON.stringify(sessionPayload),
  });
  console.log(`[acceptInboundCall] session endpoint ${sessionPath}`, {
    success: sessionResult.success,
    statusCode: sessionResult.statusCode,
    error: sessionResult.error,
    raw: sessionResult.raw,
  });
  if (sessionResult.success) {
    const raw = sessionResult.raw as any;
    return {
      ...sessionResult,
      answerSdp: raw?.session?.sdp || raw?.sdp || undefined,
      answerSdpType: raw?.session?.sdp_type || raw?.sdp_type || undefined,
    };
  }

  return {
    success: false,
    error: 'acceptInboundCall: all attempts failed',
    raw: { attempts: attempts.map((a) => ({ path: a.path, success: a.result.success, statusCode: a.result.statusCode, error: a.result.error, raw: a.result.raw })) },
  };
}

export async function sendCallControl(input: CallControlPayload): Promise<WhatsAppCallingResult> {
  const callId = String(input.callId || '').trim();
  if (!callId) return { success: false, error: 'callId is required' };
  const requested = String(input.action || '').trim().toLowerCase();
  const actionCandidates =
    requested === 'resume'
      ? ['accept', 'answer', 'resume']
      : requested === 'hangup'
      ? ['terminate', 'hangup', 'end']
      : [requested];

  const endpointCandidates = [WHATSAPP_CALLING_CONTROL_FALLBACK_PATH];
  const attempts: Array<{
    endpoint: string;
    payload: Record<string, unknown>;
    result: WhatsAppCallingResult;
  }> = [];

  for (const endpoint of endpointCandidates) {
    for (const action of actionCandidates) {
      const payloadVariants: Record<string, unknown>[] = [
        {
          messaging_product: 'whatsapp',
          call_id: callId,
          action,
          ...(input.payload ? { payload: input.payload } : {}),
        },
        {
          messaging_product: 'whatsapp',
          call_id: callId,
          event: action,
          ...(input.payload ? { payload: input.payload } : {}),
        },
      ];

      for (const payload of payloadVariants) {
        const result = await providerRequest(endpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        attempts.push({ endpoint, payload, result });
        if (result.success) return result;
      }
    }
  }

  // Optional legacy path, only when explicitly configured in env.
  if (WHATSAPP_CALLING_CONTROL_PATH_TEMPLATE) {
    for (const action of actionCandidates) {
      const legacyPayload: Record<string, unknown> = {
        messaging_product: 'whatsapp',
        action,
        ...(input.payload ? { payload: input.payload } : {}),
      };
      const result = await providerRequest(resolveTemplatePath(WHATSAPP_CALLING_CONTROL_PATH_TEMPLATE, callId), {
        method: 'POST',
        body: JSON.stringify(legacyPayload),
      });
      attempts.push({
        endpoint: resolveTemplatePath(WHATSAPP_CALLING_CONTROL_PATH_TEMPLATE, callId),
        payload: legacyPayload,
        result,
      });
      if (result.success) return result;
    }
  }

  const last = attempts[attempts.length - 1];
  return {
    success: false,
    error: last?.result?.error || 'Call control failed after trying all supported payload formats',
    statusCode: last?.result?.statusCode || undefined,
    raw: {
      attempts: attempts.map((item) => ({
        endpoint: item.endpoint,
        payload: item.payload,
        success: item.result.success,
        statusCode: item.result.statusCode || null,
        error: item.result.error || null,
        raw: item.result.raw || null,
      })),
    },
  };
}

export async function fetchProviderCallLogs(params?: {
  phoneNumber?: string;
  limit?: number;
  cursor?: string | null;
}): Promise<WhatsAppCallingResult> {
  const query = new URLSearchParams();
  if (params?.phoneNumber) query.set('phone', normalizePhoneNumber(params.phoneNumber));
  if (params?.limit != null) query.set('limit', String(params.limit));
  if (params?.cursor) query.set('cursor', String(params.cursor));
  const suffix = query.toString() ? `?${query.toString()}` : '';

  return providerRequest(`${WHATSAPP_CALLING_LOGS_PATH}${suffix}`, {
    method: 'GET',
  });
}

export async function fetchCallPermissionState(phoneNumber: string): Promise<CallPermissionStateResult> {
  const configError = assertCallingConfig();
  if (configError) return { success: false, error: configError };
  const userWaId = normalizePhoneNumber(phoneNumber);
  if (!userWaId) return { success: false, error: 'Invalid recipient phone number' };

  try {
    const query = new URLSearchParams({ user_wa_id: userWaId }).toString();
    const response = await fetch(`${WHATSAPP_CALLING_API_URL}/call_permissions?${query}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${WHATSAPP_CALLING_ACCESS_TOKEN}`,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const baseMessage =
        data?.error?.error_user_msg ||
        data?.error?.message ||
        data?.message ||
        `WhatsApp Calling API request failed (${response.status})`;
      const details = data?.error?.error_data?.details;
      const message =
        typeof details === 'string' && details.trim().length > 0
          ? `${baseMessage} (${details.trim()})`
          : baseMessage;
      return {
        success: false,
        error: message,
        statusCode: response.status,
        raw: data,
      };
    }
    const permissionStatus = String(data?.permission?.status || '').trim();
    const actions = Array.isArray(data?.actions) ? data.actions : [];
    return {
      success: true,
      status: permissionStatus || undefined,
      actions,
      statusCode: response.status,
      raw: data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Failed to fetch call permission state',
    };
  }
}
