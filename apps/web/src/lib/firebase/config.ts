/**
 * Firebase client config for browser (Phone OTP / Auth).
 * Used only on client for send OTP and verify OTP.
 */

import { getApps, initializeApp, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

function getFirebaseApp(): FirebaseApp {
  if (getApps().length === 0) {
    const config = getFirebaseConfig();
    if (!config.apiKey || !config.projectId) {
      throw new Error('Firebase client not configured: set NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_PROJECT_ID');
    }
    return initializeApp(config);
  }
  return getApp();
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export { getFirebaseApp };
