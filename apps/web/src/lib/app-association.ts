/** Apple Team ID from Xcode signing (JUN6TX4JD3). */
export const APPLE_TEAM_ID = 'JUN6TX4JD3';
export const APP_BUNDLE_ID = 'com.myfng.app';
export const APPLE_APP_ID = `${APPLE_TEAM_ID}.${APP_BUNDLE_ID}`;

/** Paths that should open the native app via Universal / App Links. */
export const APP_LINK_PATHS = [
  '/refer/*',
  '/customer/*',
  '/booking/*',
  '/track/*',
  '/invoice/*',
  '/order/*',
  '/go/*',
] as const;

export function buildAppleAppSiteAssociation() {
  return {
    applinks: {
      apps: [],
      details: [
        {
          appID: APPLE_APP_ID,
          paths: [...APP_LINK_PATHS],
        },
        {
          appIDs: [APPLE_APP_ID],
          components: APP_LINK_PATHS.map((path) => ({
            '/': path,
            comment: `MyFNG deep link ${path}`,
          })),
        },
      ],
    },
    webcredentials: {
      apps: [APPLE_APP_ID],
    },
  };
}

/**
 * Play App Signing SHA-256 (Play Console → Protected with Play →
 * Play Store protection → Manage Play app signing → App signing key).
 * This is a public certificate fingerprint, not a secret.
 */
export const PLAY_APP_SIGNING_SHA256 =
  '1E:D5:18:AA:81:DA:52:B1:05:06:79:28:91:82:29:AA:1B:DC:AA:38:DD:5D:9F:04:13:93:4A:5F:9A:C4:60:68';

/**
 * Android App Links fingerprints (SHA-256 of signing cert, colon-separated hex).
 * Always includes Play App Signing. Extra keys via ANDROID_APP_LINK_SHA256 (upload/debug).
 */
export function getAndroidAppLinkFingerprints(): string[] {
  // Bracket access so Next.js does not inline this at `next build`.
  const raw = String(process.env['ANDROID_APP_LINK_SHA256'] || '').trim();
  const fromEnv = raw
    ? raw
        .split(/[,;\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    : [];
  return [...new Set([PLAY_APP_SIGNING_SHA256, ...fromEnv])];
}

export function buildAndroidAssetLinks() {
  const fingerprints = getAndroidAppLinkFingerprints();
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: APP_BUNDLE_ID,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
