import { assertPushAdmin } from '@/lib/push/admin-auth';
import { checkFcmCredentials } from '@/lib/push/fcmHealthCheck';
import { buildFirebaseBootstrapPayload } from '@/lib/push/firebaseProjectDefaults';
import { savePushFirebaseConfig } from '@/lib/push/firebaseConfigStore';
import { resetFirebaseAdminApp } from '@/lib/firebase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/super_admin/notifications/firebase-settings/bootstrap
 * One-click setup: fill push_firebase_config from server env + known MyFNG app IDs.
 */
export async function POST() {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    if (auth.roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admin can bootstrap Firebase settings' }, { status: 403 });
    }

    const payload = buildFirebaseBootstrapPayload();
    if (!payload.client_email.trim() || !payload.private_key.trim()) {
      return NextResponse.json(
        {
          error:
            'Server env missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY. Add them to .env.local (local) or VPS env (production), then retry.',
        },
        { status: 400 },
      );
    }

    const result = await savePushFirebaseConfig(payload, auth.userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    await resetFirebaseAdminApp();
    const health = await checkFcmCredentials();

    return NextResponse.json({
      success: true,
      message: health.ok
        ? 'Firebase settings configured. Test Connection should show Connected.'
        : 'Settings saved, but FCM health check failed — see health message.',
      health: {
        ok: health.ok,
        message: health.message || health.error || null,
        credentials_source: health.credentialsSource,
      },
      configured: {
        project_id: payload.project_id,
        client_email: payload.client_email,
        messaging_sender_id: payload.messaging_sender_id,
        android_package: payload.android_package,
        ios_bundle_id: payload.ios_bundle_id,
        apns_environment: payload.apns_environment,
        use_db_credentials: true,
        push_enabled: true,
      },
      manual_steps: [
        'Upload APNs Auth Key (.p8) in Firebase Console → Cloud Messaging (Key ID W9XQWZPN59, Production).',
        'Open MyFNG app on phone → OTP login → Allow notifications.',
        'Admin → Send Notification → Advanced → enter test phone → Send.',
      ],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
