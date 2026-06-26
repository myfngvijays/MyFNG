import { Platform } from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { isAndroidEmulator, isDevSimulator, isIosSimulator } from '../config/environment';

export { isIosSimulator, isAndroidEmulator, isDevSimulator };

export const FIREBASE_TEST_PHONE_NUMBERS = ['7007543565'];
export const FIREBASE_TEST_OTP = '454545';

export function isFirebaseTestPhone(cleanPhone?: string): boolean {
  const phone = String(cleanPhone || '').replace(/\D/g, '').slice(-10);
  return FIREBASE_TEST_PHONE_NUMBERS.includes(phone);
}

/** Simulators cannot receive real SMS — use Firebase test numbers on a real device for other numbers. */
export function shouldSkipFirebaseSmsOnSimulator(_cleanPhone?: string): boolean {
  return false;
}

export function prepareFirebasePhoneAuth(cleanPhone?: string) {
  if (__DEV__ || isDevSimulator() || isFirebaseTestPhone(cleanPhone)) {
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

export function isFirebaseSmsClientError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code || '');
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    code === 'auth/missing-client-identifier' ||
    code === 'auth/app-not-authorized' ||
    code === 'auth/invalid-app-credential' ||
    code === 'auth/captcha-check-failed' ||
    code === 'auth/missing-android-pkg-name' ||
    code === 'auth/operation-not-allowed' ||
    code === 'auth/invalid-phone-number' ||
    (code === 'auth/unknown' &&
      (message.includes('client identifier') ||
        message.includes('app identifier') ||
        message.includes('app verification')))
  );
}

/** @deprecated Use isFirebaseSmsClientError */
export const isFirebaseIosClientError = isFirebaseSmsClientError;

export function firebaseSmsUnavailableMessage(error: unknown): string {
  if (isDevSimulator()) {
    return 'Simulator par real number par SMS nahi aata. Real phone par try karein, ya test number 7007543565 / OTP 454545 use karein.';
  }
  if (isFirebaseSmsClientError(error)) {
    if (Platform.OS === 'android' && !__DEV__) {
      return 'Release APK keystore Firebase par register nahi hai. Play Store wala app chalega; sideload APK ke liye release SHA add karein. Tab tak WhatsApp OTP use karein.';
    }
    return 'SMS OTP is temporarily unavailable. Please try WhatsApp OTP or retry in a moment.';
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
