import { Linking, Platform } from 'react-native';

/**
 * Open the phone dialer for the given E.164 (or any tel-friendly) number.
 *
 * iOS:     uses `telprompt:` so the system shows a confirm dialog before
 *          actually dialing — recommended UX per Apple HIG and required
 *          for App Store reviewers who flag silent auto-dial buttons.
 * Android: uses `tel:` (standard tel URI) which opens the dialer pre-filled.
 *
 * Falls back gracefully if `telprompt:` cannot be opened (e.g. iPad without
 * cellular) by retrying with `tel:`.
 */
export async function openPhoneCall(phone: string): Promise<void> {
  if (!phone) return;
  const cleaned = String(phone).trim();
  if (!cleaned) return;

  const primary = Platform.select({
    ios: `telprompt:${cleaned}`,
    android: `tel:${cleaned}`,
    default: `tel:${cleaned}`,
  }) as string;

  try {
    const supported = await Linking.canOpenURL(primary);
    if (supported) {
      await Linking.openURL(primary);
      return;
    }
  } catch {
    // ignore and try fallback
  }

  try {
    await Linking.openURL(`tel:${cleaned}`);
  } catch {
    // device cannot dial (e.g. wifi-only iPad) — silently no-op
  }
}

/**
 * Open WhatsApp chat with the given phone (digits only, country code prefix).
 * Works on both Android (intent) and iOS (URL scheme — `whatsapp` must be
 * declared in Info.plist `LSApplicationQueriesSchemes`).
 */
export async function openWhatsApp(phone: string, message?: string): Promise<boolean> {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return false;
  const text = message ? `&text=${encodeURIComponent(message)}` : '';
  const url = `whatsapp://send?phone=${digits}${text}`;
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) return false;
    await Linking.openURL(url);
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
