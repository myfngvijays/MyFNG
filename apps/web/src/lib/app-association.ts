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
 * Android App Links fingerprints (SHA-256 of signing cert, colon-separated hex).
 * Set ANDROID_APP_LINK_SHA256 (comma-separated) in env — Play App Signing + upload key.
 */
export function getAndroidAppLinkFingerprints(): string[] {
  const raw = String(process.env.ANDROID_APP_LINK_SHA256 || '').trim();
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
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
