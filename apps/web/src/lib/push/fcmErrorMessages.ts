import { MYFNG_FIREBASE_DEFAULTS } from '@/lib/push/firebaseProjectDefaults';

export function formatFcmAdminErrorMessage(errors: string[]): string {
  const joined = errors.filter(Boolean).join(' | ');
  const lower = joined.toLowerCase();

  if (lower.includes('third-party-auth-error') || lower.includes('missing required authentication credential')) {
    return [
      'iPhone push failed: Firebase cannot authenticate with Apple APNs (FCM → APNs).',
      'Android may still work — that is why "Both + All" can show 1 delivered while your iPhone gets nothing.',
      'Fix in Firebase Console → Project Settings → Cloud Messaging → Apple app (com.myfng.app): delete the APNs Auth Key, re-upload the .p8 file from Apple Developer.',
      `Use Key ID ${MYFNG_FIREBASE_DEFAULTS.apns_key_id} · Team ID ${MYFNG_FIREBASE_DEFAULTS.apns_team_id}. Wait 5 minutes, then retry iOS-only send.`,
    ].join(' ');
  }

  if (lower.includes('registration-token-not-registered') || lower.includes('invalid-registration-token')) {
    return `${joined}. Ask the user to open the app, log in, allow notifications, then try again.`;
  }

  if (joined) {
    return `FCM rejected push: ${joined}`;
  }

  return 'FCM rejected the push. Check Firebase Settings in admin panel and device token registration.';
}
