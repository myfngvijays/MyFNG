import { NextRequest } from 'next/server';
import { getResolvedWhatsAppAgentsCredentials } from '@/lib/whatsappAgents/shared/envConfigStore';

export async function assertCronAuth(req: NextRequest): Promise<string | null> {
  // Vercel Cron sends this header automatically
  if (req.headers.get('x-vercel-cron') === '1') {
    return null;
  }

  const creds = await getResolvedWhatsAppAgentsCredentials();
  const secret = creds.cron_secret || process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET;
  if (!secret) return 'CRON secret is not configured on server';

  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token || token !== secret) return 'Unauthorized';
  return null;
}
