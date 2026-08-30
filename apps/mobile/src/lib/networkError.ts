import { Platform } from 'react-native';
import { isAndroidEmulator } from '../config/environment';

export function isLikelyNetworkError(err: unknown): boolean {
  const raw = String((err as { message?: string })?.message || err || '');
  return /network request failed|failed to fetch|networkerror|could not reach|timed?\s*out/i.test(
    raw,
  );
}

/** Staff login hits Supabase on the public internet — not local Metro / Next.js. */
export function staffLoginNetworkMessage(): string {
  if (Platform.OS === 'android' && isAndroidEmulator()) {
    return [
      'Could not reach the login server (not a wrong password).',
      '',
      'Android emulator often has no internet/DNS even when the app loads from Metro.',
      '',
      '1. Open Chrome inside the emulator → google.com',
      '2. If that fails: Device Manager → Cold Boot Now',
      '3. Extended Controls (⋯) → Settings → Proxy → No proxy',
    ].join('\n');
  }
  if (Platform.OS === 'android') {
    return 'Could not reach the login server. Turn on Wi‑Fi or mobile data on the phone and try again.';
  }
  return 'Could not reach the login server. Check your internet connection and try again.';
}
