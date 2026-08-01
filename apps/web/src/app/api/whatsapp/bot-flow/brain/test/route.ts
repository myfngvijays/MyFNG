import { NextRequest, NextResponse } from 'next/server';
import { getDbWithAdmin } from '../../utils';
import { processWhatsAppBrainMessage } from '@/lib/whatsappBotFlow/brain';
import { fetchWhatsAppBrainConfig } from '@/lib/whatsappBotFlow/brainConfig';
import { processInboundWhatsAppMessage, summarizeInboundWhatsAppResult } from '@/lib/whatsappAgents/router';

export async function POST(request: NextRequest) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const message = String(body?.message || '').trim();
    const phone = String(body?.phone || '919999999999').trim();

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const live = Boolean(body?.live);
    const config = await fetchWhatsAppBrainConfig(true);
    const result = live
      ? await processInboundWhatsAppMessage({
          phone,
          message,
          profileName: body?.profile_name || 'Test User',
          dryRun: false,
        })
      : await processWhatsAppBrainMessage({
          phone,
          message,
          profileName: body?.profile_name || 'Test User',
          dryRun: true,
        });

    return NextResponse.json({
      success: true,
      live,
      config_enabled: config.enabled,
      summary: live ? summarizeInboundWhatsAppResult(result) : undefined,
      result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
