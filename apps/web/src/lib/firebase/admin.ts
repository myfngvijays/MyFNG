/**
 * Firebase Admin SDK for server-side verification of Firebase ID tokens.
 * Used in /api/customer/auth/verify-otp to verify phone sign-in.
 */

import * as admin from 'firebase-admin';

let firebaseAdminApp: admin.app.App | null = null;

function getFirebaseAdmin(): admin.app.App {
  if (firebaseAdminApp) return firebaseAdminApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin env: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
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
