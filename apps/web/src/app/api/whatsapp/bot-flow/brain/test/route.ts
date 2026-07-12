import { NextRequest, NextResponse } from 'next/server';
import { getDbWithAdmin } from '../../utils';
import { processWhatsAppBrainMessage } from '@/lib/whatsappBotFlow/brain';
import { fetchWhatsAppBrainConfig } from '@/lib/whatsappBotFlow/brainConfig';

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

    const config = await fetchWhatsAppBrainConfig(true);
    const result = await processWhatsAppBrainMessage({
      phone,
      message,
      profileName: body?.profile_name || 'Test User',
      dryRun: true,
    });

    return NextResponse.json({
      success: true,
      config_enabled: config.enabled,
      result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
