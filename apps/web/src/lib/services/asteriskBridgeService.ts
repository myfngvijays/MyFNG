type BridgeResult = {
  success: boolean;
  status?: string;
  bridgeCallId?: string;
  bridgeSessionId?: string;
  error?: string;
  raw?: unknown;
};

const ASTERISK_BRIDGE_INTERNAL_URL = process.env.ASTERISK_BRIDGE_INTERNAL_URL || '';
const ASTERISK_WEBHOOK_SECRET = process.env.ASTERISK_WEBHOOK_SECRET || '';
const ASTERISK_ARI_URL = process.env.ASTERISK_ARI_URL || '';
const ASTERISK_AMI_HOST = process.env.ASTERISK_AMI_HOST || '';

function isFullSignalingEnabled(): boolean {
  return String(process.env.WHATSAPP_CALLING_FULL_SIGNALING || '').trim() === '1';
}

function assertBridgeReady(): string | null {
  if (!isFullSignalingEnabled()) return 'WHATSAPP_CALLING_FULL_SIGNALING is disabled';
  if (!ASTERISK_BRIDGE_INTERNAL_URL) return 'ASTERISK_BRIDGE_INTERNAL_URL is not configured';
  if (!ASTERISK_WEBHOOK_SECRET) return 'ASTERISK_WEBHOOK_SECRET is not configured';
  return null;
}

async function bridgeRequest(path: string, body: Record<string, unknown>): Promise<BridgeResult> {
  const readyError = assertBridgeReady();
  if (readyError) return { success: false, error: readyError };
  try {
    const response = await fetch(`${ASTERISK_BRIDGE_INTERNAL_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-asterisk-webhook-secret': ASTERISK_WEBHOOK_SECRET,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) {
      return {
        success: false,
        error: data?.error || `Asterisk bridge request failed (${response.status})`,
        raw: data,
      };
    }
    return {
      success: true,
      status: data?.status || undefined,
      bridgeCallId: data?.bridge_call_id || undefined,
      bridgeSessionId: data?.bridge_session_id || undefined,
      raw: data,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Asterisk bridge request failed' };
  }
}

export async function submitAsteriskOffer(input: {
  callId: string;
  phone: string;
  sdp: string;
  sdpType: string;
}): Promise<BridgeResult> {
  return bridgeRequest(`/bridge/calls/${encodeURIComponent(input.callId)}/offer`, {
    phone: input.phone,
    sdp: input.sdp,
    sdp_type: input.sdpType,
  });
}

export async function submitAsteriskAnswer(input: {
  callId: string;
  providerSessionId?: string | null;
  sdp: string;
  sdpType: string;
}): Promise<BridgeResult> {
  return bridgeRequest(`/bridge/calls/${encodeURIComponent(input.callId)}/answer`, {
    provider_session_id: input.providerSessionId || null,
    sdp: input.sdp,
    sdp_type: input.sdpType,
  });
}

export async function submitAsteriskControl(input: {
  callId: string;
  action: 'hangup' | 'mute' | 'unmute' | 'hold' | 'resume' | 'transfer' | 'dtmf';
  payload?: Record<string, unknown>;
}): Promise<BridgeResult> {
  return bridgeRequest(`/bridge/calls/${encodeURIComponent(input.callId)}/control`, {
    action: input.action,
    payload: input.payload || {},
  });
}

export async function getAsteriskBridgeHealth(): Promise<BridgeResult> {
  const fullEnabled = isFullSignalingEnabled();
  return {
    success: true,
    status: fullEnabled ? 'READY_CHECK_REQUIRED' : 'DISABLED',
    raw: {
      full_signaling_enabled: fullEnabled,
      bridge_url_configured: Boolean(ASTERISK_BRIDGE_INTERNAL_URL),
      ari_url_configured: Boolean(ASTERISK_ARI_URL),
      ami_host_configured: Boolean(ASTERISK_AMI_HOST),
      webhook_secret_configured: Boolean(ASTERISK_WEBHOOK_SECRET),
    },
  };
}
