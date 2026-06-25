/**
 * Firebase Admin SDK for server-side verification of Firebase ID tokens.
 * Used in /api/customer/auth/verify-otp to verify phone sign-in.
 */

import * as admin from 'firebase-admin';

let firebaseAdminApp: admin.app.App | null = null;

function getServiceAccountCredentials(): {
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

function getFirebaseAdmin(): admin.app.App {
  if (firebaseAdminApp) return firebaseAdminApp;

  const { projectId, clientEmail, privateKey } = getServiceAccountCredentials();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials for server OTP verify. Add FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY to apps/web/.env.local (Firebase Console → Service accounts → Generate new private key). Live myfng.in already has these on VPS.'
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

export async function verifyFirebaseIdToken(idToken: string): Promise<{
  uid: string;
  phone_number?: string;
}> {
  const app = getFirebaseAdmin();
  const decoded = await app.auth().verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    phone_number: decoded.phone_number,
  };
}
