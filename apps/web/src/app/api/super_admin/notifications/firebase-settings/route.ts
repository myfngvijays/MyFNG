import { assertPushAdmin } from '@/lib/push/admin-auth';
import { checkFcmCredentials } from '@/lib/push/fcmHealthCheck';
import {
  loadPushFirebaseConfigView,
  savePushFirebaseConfig,
} from '@/lib/push/firebaseConfigStore';
import { resetFirebaseAdminApp } from '@/lib/firebase/admin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const config = await loadPushFirebaseConfigView();
    const health = await checkFcmCredentials();

    return NextResponse.json({
      config,
      health: {
        ok: health.ok,
        message: health.message || health.error || null,
        credentials_source: health.credentialsSource,
      },
      can_edit: auth.roleCode === 'SUPER_ADMIN',
      protocol: 'FCM HTTP v1',
      version: '1.0',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    if (auth.roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only Super Admin can edit Firebase credentials' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const result = await savePushFirebaseConfig(body, auth.userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    resetFirebaseAdminApp();
    const health = await checkFcmCredentials();

    return NextResponse.json({
      success: true,
      message: 'Firebase settings saved',
      health,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function POST() {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    resetFirebaseAdminApp();
    const health = await checkFcmCredentials();
    return NextResponse.json({
      ok: health.ok,
      project_id: health.projectId,
      credentials_source: health.credentialsSource,
      message: health.ok
        ? health.message || 'FCM credentials valid'
        : health.error || 'FCM credential check failed',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
