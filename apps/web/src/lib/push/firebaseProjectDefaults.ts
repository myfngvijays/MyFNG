/** Known MyFNG Firebase / FCM identifiers (mobile app configs). */
export const MYFNG_FIREBASE_DEFAULTS = {
  project_name: 'MyFNG',
  project_id: 'myfng-d863c',
  auth_domain: 'myfng-d863c.firebaseapp.com',
  storage_bucket: 'myfng-d863c.firebasestorage.app',
  messaging_sender_id: '455279370834',
  android_package: 'com.myfng.app',
  ios_bundle_id: 'com.myfng.app',
  android_app_id: '1:455279370834:android:ae9e7dcf4df27191e7b58b',
  ios_app_id: '1:455279370834:ios:38d95771254f40a5e7b58b',
  android_default_channel: 'default',
  apns_environment: 'production',
  apns_key_id: 'W9XQWZPN59',
  apns_team_id: 'JUN6TX4JD3',
} as const;

export function buildFirebaseBootstrapPayload(env: NodeJS.ProcessEnv = process.env) {
  const projectId = env.FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || MYFNG_FIREBASE_DEFAULTS.project_id;

  return {
    project_name: MYFNG_FIREBASE_DEFAULTS.project_name,
    project_id: projectId,
    api_key: env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    auth_domain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || MYFNG_FIREBASE_DEFAULTS.auth_domain,
    storage_bucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || MYFNG_FIREBASE_DEFAULTS.storage_bucket,
    messaging_sender_id:
      env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || MYFNG_FIREBASE_DEFAULTS.messaging_sender_id,
    app_id: MYFNG_FIREBASE_DEFAULTS.android_app_id,
    measurement_id: env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
    client_email: env.FIREBASE_CLIENT_EMAIL || '',
    private_key: String(env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    android_package: MYFNG_FIREBASE_DEFAULTS.android_package,
    ios_bundle_id: MYFNG_FIREBASE_DEFAULTS.ios_bundle_id,
    android_default_channel: MYFNG_FIREBASE_DEFAULTS.android_default_channel,
    apns_environment: MYFNG_FIREBASE_DEFAULTS.apns_environment,
    default_icon_url: '',
    push_enabled: true,
    android_enabled: true,
    ios_enabled: true,
    use_db_credentials: true,
    admin_notes: [
      'Auto-configured from server environment + MyFNG mobile app IDs.',
      `Android app: ${MYFNG_FIREBASE_DEFAULTS.android_app_id}`,
      `iOS app: ${MYFNG_FIREBASE_DEFAULTS.ios_app_id}`,
      `APNs Auth Key ID (upload .p8 in Firebase Console): ${MYFNG_FIREBASE_DEFAULTS.apns_key_id}`,
    ].join('\n'),
  };
}
