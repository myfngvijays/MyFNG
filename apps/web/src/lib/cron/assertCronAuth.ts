import { NextRequest } from 'next/server';
import { getResolvedWhatsAppAgentsCredentials } from '@/lib/whatsappAgents/shared/envConfigStore';

function normalizeSecret(value: string): string {
  return String(value || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^["']|["']$/g, '');
}

function requestCronToken(req: NextRequest): string {
  const auth = normalizeSecret(req.headers.get('authorization') || '');
  const headerSecret = normalizeSecret(
    req.headers.get('x-cron-secret') || req.headers.get('cron-secret') || '',
  );
  const querySecret = normalizeSecret(req.nextUrl.searchParams.get('secret') || '');
  return auth || headerSecret || querySecret;
}

/** Vercel Cron identity — docs now send schedule + user-agent, not always x-vercel-cron: 1. */
export function isVercelCronRequest(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron') === '1') return true;
  if (req.headers.get('x-vercel-cron-schedule')) return true;
  return /vercel-cron/i.test(req.headers.get('user-agent') || '');
}

export function cronAuthDebug(req: NextRequest) {
  const ua = String(req.headers.get('user-agent') || '').slice(0, 80);
  return {
    ua,
    vercel: isVercelCronRequest(req),
    has_auth: Boolean(req.headers.get('authorization')),
    has_x_cron_secret: Boolean(req.headers.get('x-cron-secret') || req.headers.get('cron-secret')),
  };
}

export async function assertCronAuth(req: NextRequest): Promise<string | null> {
  if (isVercelCronRequest(req)) {
    return null;
  }

  const token = requestCronToken(req);
  const envSecrets = [
    process.env.CRON_SECRET,
    process.env.NOTIFICATION_CRON_SECRET,
    process.env.CRON_SECRET_TOKEN,
  ]
    .map((s) => normalizeSecret(String(s || '')))
    .filter(Boolean);

  if (token && envSecrets.includes(token)) {
    return null;
  }

  let dbSecret = '';
  try {
    const creds = await getResolvedWhatsAppAgentsCredentials();
    dbSecret = normalizeSecret(String(creds.cron_secret || ''));
  } catch {
    dbSecret = '';
  }

  const secrets = [...envSecrets, dbSecret].filter(Boolean);
  if (!secrets.length) return 'CRON secret is not configured on server';
  if (!token || !secrets.includes(token)) return 'Unauthorized';
  return null;
}
