import { NextRequest } from 'next/server';
import { getResolvedWhatsAppAgentsCredentials } from '@/lib/whatsappAgents/shared/envConfigStore';

function bearerToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
}

/** Vercel Cron identity — docs now send schedule + user-agent, not always x-vercel-cron: 1. */
export function isVercelCronRequest(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron') === '1') return true;
  if (req.headers.get('x-vercel-cron-schedule')) return true;
  return /vercel-cron/i.test(req.headers.get('user-agent') || '');
}

export async function assertCronAuth(req: NextRequest): Promise<string | null> {
  if (isVercelCronRequest(req)) {
    return null;
  }

  const token = bearerToken(req);
  const envSecrets = [process.env.CRON_SECRET, process.env.NOTIFICATION_CRON_SECRET]
    .map((s) => String(s || '').trim())
    .filter(Boolean);

  if (token && envSecrets.includes(token)) {
    return null;
  }

  let dbSecret = '';
  try {
    const creds = await getResolvedWhatsAppAgentsCredentials();
    dbSecret = String(creds.cron_secret || '').trim();
  } catch {
    dbSecret = '';
  }

  const secrets = [...envSecrets, dbSecret].filter(Boolean);
  if (!secrets.length) return 'CRON secret is not configured on server';
  if (!token || !secrets.includes(token)) return 'Unauthorized';
  return null;
}
