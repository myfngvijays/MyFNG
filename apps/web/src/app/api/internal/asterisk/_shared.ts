import { NextRequest } from 'next/server';

export type InternalAuthResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

const ASTERISK_WEBHOOK_SECRET = process.env.ASTERISK_WEBHOOK_SECRET || '';

export function assertInternalAsteriskAuth(request: NextRequest): InternalAuthResult {
  if (!ASTERISK_WEBHOOK_SECRET) {
    return { ok: false, error: 'ASTERISK_WEBHOOK_SECRET is not configured', status: 500 };
  }
  const token = String(request.headers.get('x-asterisk-webhook-secret') || '').trim();
  if (!token || token !== ASTERISK_WEBHOOK_SECRET) {
    return { ok: false, error: 'Unauthorized internal asterisk request', status: 401 };
  }
  return { ok: true };
}

export function pseudoId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

export function signalingConfigState() {
  return {
    ari_url: Boolean(process.env.ASTERISK_ARI_URL),
    ari_username: Boolean(process.env.ASTERISK_ARI_USERNAME),
    ari_password: Boolean(process.env.ASTERISK_ARI_PASSWORD),
    ami_host: Boolean(process.env.ASTERISK_AMI_HOST),
    ami_username: Boolean(process.env.ASTERISK_AMI_USERNAME),
    ami_secret: Boolean(process.env.ASTERISK_AMI_SECRET),
  };
}
