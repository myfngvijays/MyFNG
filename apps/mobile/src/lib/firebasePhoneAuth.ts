import { Platform } from 'react-native';
import Constants from 'expo-constants';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

export const FIREBASE_TEST_PHONE_NUMBERS = ['7007543565'];
export const FIREBASE_TEST_OTP = '454545';

export function isIosSimulator(): boolean {
  if (Platform.OS !== 'ios') return false;
  return Boolean((Constants.platform as { ios?: { simulator?: boolean } })?.ios?.simulator);
}

export function isFirebaseTestPhone(cleanPhone?: string): boolean {
  const phone = String(cleanPhone || '').replace(/\D/g, '').slice(-10);
  return FIREBASE_TEST_PHONE_NUMBERS.includes(phone);
}

/** Real SMS never appears on iOS Simulator — use WhatsApp or Firebase test numbers. */
export function shouldSkipFirebaseSmsOnSimulator(cleanPhone?: string): boolean {
  if (!__DEV__ || !isIosSimulator()) return false;
  return !isFirebaseTestPhone(cleanPhone);
}

export function prepareFirebasePhoneAuth(cleanPhone?: string) {
  if (__DEV__ || isFirebaseTestPhone(cleanPhone) || isIosSimulator()) {
    try {
      auth().settings.appVerificationDisabledForTesting = true;
    } catch {
      // ignore
    }
  }
}

export async function sendFirebaseSmsOtp(cleanPhone: string): Promise<FirebaseAuthTypes.ConfirmationResult> {
  prepareFirebasePhoneAuth(cleanPhone);
  return auth().signInWithPhoneNumber(`+91${cleanPhone}`);
}

export function isFirebaseIosClientError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code || '');
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    code === 'auth/missing-client-identifier' ||
    code === 'auth/app-not-authorized' ||
    (code === 'auth/unknown' && message.includes('client identifier'))
  );
}

export function firebaseSmsUnavailableMessage(error: unknown): string {
  if (isIosSimulator()) {
    return 'iOS Simulator par real SMS nahi aata. WhatsApp OTP use karein, ya test number 7007543565 / OTP 454545.';
  }
  if (isFirebaseIosClientError(error)) {
    return 'Phone verification is unavailable on this device. Please try WhatsApp OTP or use a real iPhone.';
  }
  const code = String((error as { code?: string })?.code || '');
  if (code === 'auth/network-request-failed') {
    return 'Network issue. Please check internet and retry.';
  }
  return String((error as { message?: string })?.message || 'Unable to send OTP. Please try again.');
}

export function firebaseTestOtpHint(cleanPhone?: string): string | null {
  if (!isFirebaseTestPhone(cleanPhone)) return null;
  return `Test number: OTP ${FIREBASE_TEST_OTP} enter karein (SMS nahi aayega).`;
}
