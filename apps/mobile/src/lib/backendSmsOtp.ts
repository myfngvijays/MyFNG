import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { Platform } from 'react-native';
import { ENV } from '../config/environment';
import { sendFirebaseSmsOtp } from './firebasePhoneAuth';
import type { AuthVerifyResponse } from './welcomeBonus';

export type SmsOtpSendResult = {
  mode: 'firebase';
  confirmation: FirebaseAuthTypes.ConfirmationResult;
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

/** Firebase Phone Auth — same flow as the live Play Store / App Store builds. */
export async function sendSmsOtp(cleanPhone: string): Promise<SmsOtpSendResult> {
  const confirmation = await sendFirebaseSmsOtp(cleanPhone);
  return { mode: 'firebase', confirmation };
}

export async function verifySmsOtp(
  cleanPhone: string,
  otp: string,
  confirmation: FirebaseAuthTypes.ConfirmationResult | null,
): Promise<AuthVerifyResponse> {
  if (!confirmation) {
    throw new Error('Session expired. Please request OTP again.');
  }

  const userCredential = await confirmation.confirm(otp.trim());
  if (!userCredential?.user) throw new Error('OTP verification failed');
  const idToken = await userCredential.user.getIdToken();

  const res = await fetch(`${ENV.API_URL}/api/customer/auth/verify-otp`, {
    method: 'POST',
    headers: mobileHeaders,
    body: JSON.stringify({ idToken }),
  });
  const json = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(String(json?.error || `Verification failed (HTTP ${res.status})`));
  }

  return parseAuthVerifyResponse(json);
}
