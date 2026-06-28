import { getFirebaseAdminAppAsync } from '@/lib/firebase/admin';
import {
  getEnvFirebaseDefaults,
  loadPushFirebaseConfig,
  resolveActiveFirebaseCredentials,
} from '@/lib/push/firebaseConfigStore';

export type FcmHealthResult = {
  ok: boolean;
  projectId: string;
  clientEmailMasked: string;
  messagingSenderId: string;
  credentialsConfigured: boolean;
  credentialsSource: 'database' | 'environment' | 'none';
  message?: string;
  error?: string;
};

function maskEmail(email: string): string {
  const trimmed = String(email || '').trim();
  if (!trimmed.includes('@')) return trimmed ? '••••••••' : '';
  const [local, domain] = trimmed.split('@');
  return `${local.slice(0, 3)}•••@${domain}`;
}

export function getFirebaseConfigSnapshot(): Omit<
  FcmHealthResult,
  'ok' | 'message' | 'error' | 'credentialsSource'
> {
  const env = getEnvFirebaseDefaults();
  return {
    projectId: env.project_id,
    clientEmailMasked: env.client_email_masked,
    messagingSenderId: env.messaging_sender_id,
    credentialsConfigured: env.credentials_configured,
  };
}

export async function checkFcmCredentials(): Promise<FcmHealthResult> {
  const config = await loadPushFirebaseConfig();
  const active = resolveActiveFirebaseCredentials(config);
  const env = getEnvFirebaseDefaults();

  const projectId = active.projectId || env.project_id;
  const clientEmailMasked = maskEmail(active.clientEmail || env.client_email);
  const messagingSenderId = config.messaging_sender_id || env.messaging_sender_id;
  const credentialsConfigured = active.source !== 'none';
  const credentialsSource = active.source;

  if (!credentialsConfigured) {
    return {
      ok: false,
      projectId,
      clientEmailMasked,
      messagingSenderId,
      credentialsConfigured: false,
      credentialsSource: 'none',
      error:
        'Firebase Admin credentials missing. Save service account email + private key in Firebase Settings.',
    };
  }

  try {
    const app = await getFirebaseAdminAppAsync();
    const messaging = app.messaging();
    const fakeToken = 'fake-fcm-token-for-credential-check';

    try {
      await messaging.send({
        token: fakeToken,
        notification: { title: 'Credential check', body: 'Test' },
      });
      return {
        ok: true,
        projectId: app.options.projectId || projectId,
        clientEmailMasked,
        messagingSenderId,
        credentialsConfigured: true,
        credentialsSource,
        message: 'FCM API reachable',
      };
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string; errorInfo?: { code?: string } };
      const code = e?.code || e?.errorInfo?.code || '';
      const msg = e?.message || String(err);

      if (
        code === 'messaging/invalid-argument' ||
        code === 'messaging/registration-token-not-registered' ||
        msg.toLowerCase().includes('registration token')
      ) {
        return {
          ok: true,
          projectId: app.options.projectId || projectId,
          clientEmailMasked,
          messagingSenderId,
          credentialsConfigured: true,
          credentialsSource,
          message: `FCM Admin credentials valid (${credentialsSource}). APNs delivery is tested only on real iOS sends.`,
        };
      }

      if (code === 'messaging/third-party-auth-error') {
        return {
          ok: false,
          projectId: app.options.projectId || projectId,
          clientEmailMasked,
          messagingSenderId,
          credentialsConfigured: true,
          credentialsSource,
          error:
            'APNs auth failed. If APNs key is already in Firebase Console, re-save the Firebase service account key in Admin → Firebase Settings and ensure project is myfng-d863c.',
        };
      }

      if (code === 'app/invalid-credential' || msg.toLowerCase().includes('credential')) {
        return {
          ok: false,
          projectId: app.options.projectId || projectId,
          clientEmailMasked,
          messagingSenderId,
          credentialsConfigured: true,
          credentialsSource,
          error: msg,
        };
      }

      return {
        ok: true,
        projectId: app.options.projectId || projectId,
        clientEmailMasked,
        messagingSenderId,
        credentialsConfigured: true,
        credentialsSource,
        message: `FCM responded: ${code || msg}`,
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      projectId,
      clientEmailMasked,
      messagingSenderId,
      credentialsConfigured,
      credentialsSource,
      error: msg,
    };
  }
}
