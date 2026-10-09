import { Platform } from 'react-native';
import { ENV } from '../config/environment';
import type { AuthVerifyResponse } from './welcomeBonus';

export { checkSmsOtpAllowed } from './mobileAuthConfig';

export type SmsOtpSendResult = {
  mode: 'whysms';
  confirmation: null;
};

const mobileHeaders = {
  'Content-Type': 'application/json',
  'x-mobile-client': 'true',
  'X-App-Platform': Platform.OS,
};

function parseAuthVerifyResponse(json: any): AuthVerifyResponse {
  if (!json?.session_token) {
    throw new Error('Session token not received');
  }
  return {
    session_token: String(json.session_token),
    welcome_bonus: json?.welcome_bonus,
    is_new_customer: Boolean(json?.is_new_customer),
    customer: json?.customer?.id
      ? {
          id: String(json.customer.id),
          phone: json.customer.phone ? String(json.customer.phone) : undefined,
          full_name: json.customer.full_name ?? null,
        }
      : undefined,
  };
}

async function parseJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return {};
  }
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

/** Server SMS OTP via WhySMS. Login no longer uses Firebase phone auth. */
export async function sendSmsOtp(cleanPhone: string): Promise<SmsOtpSendResult> {
  const res = await fetch(`${ENV.API_URL}/api/customer/auth/send-otp`, {
    method: 'POST',
    headers: mobileHeaders,
    body: JSON.stringify({ phone: cleanPhone, metadata: { source: 'app_login' } }),
  });
  const json = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(String(json?.error || `Unable to send SMS OTP (HTTP ${res.status})`));
  }
  return { mode: 'whysms', confirmation: null };
}

export async function verifySmsOtp(
  cleanPhone: string,
  otp: string,
  _confirmation?: unknown,
): Promise<AuthVerifyResponse> {
  const res = await fetch(`${ENV.API_URL}/api/customer/auth/whatsapp-verify`, {
    method: 'POST',
    headers: mobileHeaders,
    body: JSON.stringify({
      phone: cleanPhone,
      otp,
      channel: 'SMS',
      platform: Platform.OS,
    }),
  });
  const json = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(String(json?.error || `Verification failed (HTTP ${res.status})`));
  }
  return parseAuthVerifyResponse(json);
}
