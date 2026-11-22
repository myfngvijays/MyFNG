import { Linking, NativeModules, PermissionsAndroid, Platform } from 'react-native';

function dialableNumber(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15 && !digits.startsWith('0')) return `+${digits}`;
  return digits;
}

type DirectCallNative = {
  call: (n: string) => Promise<boolean>;
  watchCallEnd: () => void;
  canReturnAfterCall: () => Promise<boolean>;
  openReturnAfterCallSettings: () => void;
};

function directCallNative(): DirectCallNative | null {
  if (Platform.OS !== 'android') return null;
  const native = NativeModules.MyFNGDirectCall as DirectCallNative | undefined;
  return native?.call ? native : null;
}

/** Android: "Make and manage phone calls" (auto call + see when the call hangs up). */
export async function ensureCallPermissions(): Promise<boolean> {
  if (!directCallNative()) return false;
  const { CALL_PHONE, READ_PHONE_STATE } = PermissionsAndroid.PERMISSIONS;
  try {
    const [call, state] = await Promise.all([
      PermissionsAndroid.check(CALL_PHONE),
      PermissionsAndroid.check(READ_PHONE_STATE),
    ]);
    if (call && state) return true;
    const res = await PermissionsAndroid.requestMultiple([CALL_PHONE, READ_PHONE_STATE]);
    return res[CALL_PHONE] === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/** Android needs "Display over other apps" to bring MyFNG back after a call. */
export async function canReturnAfterCall(): Promise<boolean> {
  const native = directCallNative();
  if (!native) return true;
  try {
    return await native.canReturnAfterCall();
  } catch {
    return true;
  }
}

export function openReturnAfterCallSettings(): void {
  directCallNative()?.openReturnAfterCallSettings();
}

/**
 * Telecaller call. Android: rings straight away (no green button) and MyFNG
 * comes back to the lead when the call is cut. Falls back to the normal dialer
 * if the permission is denied, and on iOS (Apple never allows auto call).
 */
export async function placePhoneCall(phone: string): Promise<void> {
  const dialable = dialableNumber(phone);
  if (!dialable) return;
  const native = directCallNative();
  if (native) {
    try {
      if ((await ensureCallPermissions()) && (await native.call(dialable))) return;
      native.watchCallEnd();
    } catch {
      // fall back to the dialer below
    }
  }
  await openPhoneCall(phone);
}

/**
 * Open the phone dialer for the given E.164 (or any tel-friendly) number.
 *
 * Both platforms use `tel:`. On a dual-SIM iPhone this is the system sheet
 * "Call +91… from" with each line (Personal / business) and Cancel.
 * A 10-digit Indian number is sent as +91 so that sheet shows the country code.
 */
export async function openPhoneCall(phone: string): Promise<void> {
  if (!phone) return;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return;
  const dialable =
    digits.length === 10
      ? `+91${digits}`
      : digits.length === 12 && digits.startsWith('91')
        ? `+${digits}`
        : digits.length >= 11 && digits.length <= 15 && !digits.startsWith('0')
          ? `+${digits}` // foreign number with its own country code (e.g. +966)
          : digits;

  try {
    await Linking.openURL(`tel:${dialable}`);
  } catch {
    // device cannot dial (e.g. wifi-only iPad) — silently no-op
  }
}

/** Normalize to WhatsApp-friendly digits (India 10-digit → 91…). */
export function normalizeWhatsAppPhone(phone: string): string {
  let digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.startsWith('0') && digits.length === 11) digits = `91${digits.slice(1)}`;
  return digits;
}

/**
 * Open WhatsApp chat with the given phone (digits only, country code prefix).
 * Works on both Android (intent) and iOS (URL scheme — `whatsapp` must be
 * declared in Info.plist `LSApplicationQueriesSchemes`).
 * Falls back to https://wa.me/ when the app scheme is unavailable.
 */
export async function openWhatsApp(phone: string, message?: string): Promise<boolean> {
  const digits = normalizeWhatsAppPhone(phone);
  if (!digits) return false;
  const textParam = message ? `?text=${encodeURIComponent(message)}` : '';
  const appText = message ? `&text=${encodeURIComponent(message)}` : '';
  const appUrl = `whatsapp://send?phone=${digits}${appText}`;
  const webUrl = `https://wa.me/${digits}${textParam}`;
  try {
    const supported = await Linking.canOpenURL(appUrl);
    if (supported) {
      await Linking.openURL(appUrl);
      return true;
    }
  } catch {
    // fall through to web
  }
  try {
    await Linking.openURL(webUrl);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open the default mail composer with optional subject/body.
 */
export async function openEmail(email: string, subject?: string, body?: string): Promise<void> {
  if (!email) return;
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  try {
    await Linking.openURL(`mailto:${email}${qs}`);
  } catch {
    // no mail client configured
  }
}
