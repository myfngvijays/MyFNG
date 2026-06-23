import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { ENV } from '../config/environment';
import { isFirebaseTestPhone, sendFirebaseSmsOtp } from './firebasePhoneAuth';
import type { AuthVerifyResponse } from './welcomeBonus';

export type SmsOtpSendResult =
  | { mode: 'firebase'; confirmation: FirebaseAuthTypes.ConfirmationResult }
  | { mode: 'backend' };

const mobileHeaders = {
  'Content-Type': 'application/json',
  'x-mobile-client': 'true',
};

function parseAuthVerifyResponse(json: any): AuthVerifyResponse {
  if (!json?.session_token) {
    throw new Error('Session token not received');
  }
  return {
    session_token: String(json.session_token),
    welcome_bonus: json?.welcome_bonus,
    is_new_customer: Boolean(json?.is_new_customer),
  };
}

export async function sendSmsOtp(cleanPhone: string): Promise<SmsOtpSendResult> {
  if (isFirebaseTestPhone(cleanPhone)) {
    const confirmation = await sendFirebaseSmsOtp(cleanPhone);
    return { mode: 'firebase', confirmation };
  }

  const res = await fetch(`${ENV.API_URL}/api/customer/auth/sms-otp`, {
    method: 'POST',
    headers: mobileHeaders,
    body: JSON.stringify({ phone: cleanPhone }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Unable to send SMS OTP (HTTP ${res.status})`);
  }
  return { mode: 'backend' };
}

export async function verifySmsOtp(
  cleanPhone: string,
  otp: string,
  confirmation: FirebaseAuthTypes.ConfirmationResult | null
): Promise<AuthVerifyResponse> {
  if (confirmation) {
    const userCredential = await confirmation.confirm(otp.trim());
    if (!userCredential?.user) throw new Error('OTP verification failed');
    const idToken = await userCredential.user.getIdToken();

    const res = await fetch(`${ENV.API_URL}/api/customer/auth/verify-otp`, {
      method: 'POST',
      headers: mobileHeaders,
      body: JSON.stringify({ idToken }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `Verification failed (HTTP ${res.status})`);
    }
    return parseAuthVerifyResponse(json);
  }

  const res = await fetch(`${ENV.API_URL}/api/customer/auth/sms-verify`, {
    method: 'POST',
    headers: mobileHeaders,
    body: JSON.stringify({ phone: cleanPhone, otp: otp.trim() }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Verification failed (HTTP ${res.status})`);
  }
  return parseAuthVerifyResponse(json);
}
