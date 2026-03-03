import { NextResponse } from 'next/server';
import { requireOperationalUser } from '@/app/api/whatsapp/calls/_shared';
import { getAsteriskBridgeHealth } from '@/lib/services/asteriskBridgeService';

export async function GET() {
  try {
    const gate = await requireOperationalUser();
    if (!gate.ok) return gate.response;

    const callingEnabled = String(process.env.WHATSAPP_CALLING_ENABLED || '').trim() === '1';
    const fullSignalingEnabled = String(process.env.WHATSAPP_CALLING_FULL_SIGNALING || '').trim() === '1';
    const bridgeHealth = await getAsteriskBridgeHealth();

    return NextResponse.json({
      success: true,
      calling_enabled: callingEnabled,
      full_signaling_enabled: fullSignalingEnabled,
      env_checks: {
        whatsapp_api_url: Boolean(process.env.WHATSAPP_API_URL),
        whatsapp_phone_number_id: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
        whatsapp_access_token: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
        asterisk_bridge_internal_url: Boolean(process.env.ASTERISK_BRIDGE_INTERNAL_URL),
        asterisk_webhook_secret: Boolean(process.env.ASTERISK_WEBHOOK_SECRET),
      },
      bridge: bridgeHealth.raw || {},
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Health check failed' },
      { status: 500 }
    );
  }
}
