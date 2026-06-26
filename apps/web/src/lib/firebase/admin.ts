/**
 * Firebase Admin SDK for server-side verification of Firebase ID tokens.
 * Used in /api/customer/auth/verify-otp to verify phone sign-in.
 */

import * as admin from 'firebase-admin';
import {
  loadPushFirebaseConfig,
  resolveActiveFirebaseCredentials,
} from '@/lib/push/firebaseConfigStore';

let firebaseAdminApp: admin.app.App | null = null;

function getServiceAccountCredentialsFromEnv(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} {
  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    const parsed = JSON.parse(jsonRaw) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (parsed.project_id && parsed.client_email && parsed.private_key) {
      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      };
    }
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';

  return { projectId, clientEmail, privateKey };
}

function getServiceAccountCredentialsSync(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} {
  return getServiceAccountCredentialsFromEnv();
}

export function resetFirebaseAdminApp() {
  if (firebaseAdminApp) {
    void firebaseAdminApp.delete().catch(() => undefined);
  }
  firebaseAdminApp = null;
}

function initFirebaseAdmin(credentials: {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}): admin.app.App {
  if (firebaseAdminApp) return firebaseAdminApp;

  const { projectId, clientEmail, privateKey } = credentials;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Configure in Push Notification Management → Firebase Settings or add FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY to server env.',
    );
  }

  firebaseAdminApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
  return firebaseAdminApp;
}

function getFirebaseAdmin(): admin.app.App {
  return initFirebaseAdmin(getServiceAccountCredentialsSync());
}

export function getFirebaseAdminApp(): admin.app.App {
  return getFirebaseAdmin();
}

export async function getFirebaseAdminAppAsync(): Promise<admin.app.App> {
  if (firebaseAdminApp) return firebaseAdminApp;
  const config = await loadPushFirebaseConfig();
  const active = resolveActiveFirebaseCredentials(config);
  if (active.source === 'none') {
    return getFirebaseAdmin();
  }
  return initFirebaseAdmin({
    projectId: active.projectId,
    clientEmail: active.clientEmail,
    privateKey: active.privateKey,
  });
}

export async function verifyFirebaseIdToken(idToken: string): Promise<{
  uid: string;
  phone_number?: string;
}> {
  const app = await getFirebaseAdminAppAsync();
  const decoded = await app.auth().verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    phone_number: decoded.phone_number,
  };
}
