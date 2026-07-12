import { NextRequest, NextResponse } from 'next/server';
import { getDbWithAdmin } from '../utils';
import {
  clearWhatsAppBrainConfigCache,
  fetchWhatsAppBrainConfig,
  saveWhatsAppBrainConfig,
} from '@/lib/whatsappBotFlow/brainConfig';
import { loadActivePublishedFlow } from '@/lib/whatsappBotFlow/executor';

export async function GET() {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const config = await fetchWhatsAppBrainConfig(true);

    let activeFlow: any = null;
    if (config.active_flow_id) {
      const { data } = await auth.db
        .from('bot_flows')
        .select('id, name, status, active_version_id, updated_at')
        .eq('id', config.active_flow_id)
        .maybeSingle();
      activeFlow = data || null;
    }

    const publishedFlow = await loadActivePublishedFlow(config).catch(() => null);
    const runtimeConnected = Boolean(
      config.enabled &&
        (config.mode === 'FLOW_FIRST'
          ? Boolean(publishedFlow)
          : config.mode === 'HYBRID'
            ? Boolean(process.env.OPENAI_API_KEY || publishedFlow)
            : process.env.OPENAI_API_KEY),
    );

    return NextResponse.json({
      success: true,
      config,
      active_flow: activeFlow,
      runtime: {
        connected: runtimeConnected,
        openai_configured: Boolean(process.env.OPENAI_API_KEY),
        whatsapp_configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
        phase: 'PHASE_2',
        mode: config.mode,
        flow_executor_ready: Boolean(publishedFlow),
        active_flow_published: Boolean(publishedFlow),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const saved = await saveWhatsAppBrainConfig(body?.config || body, auth.userProfile?.id || null);
    clearWhatsAppBrainConfigCache();

    return NextResponse.json({ success: true, config: saved });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
