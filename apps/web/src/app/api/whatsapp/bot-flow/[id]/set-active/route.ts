import { NextRequest, NextResponse } from 'next/server';
import { getDbWithAdmin } from '../../utils';
import { saveWhatsAppBrainConfig } from '@/lib/whatsappBotFlow/brainConfig';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const flowId = String(id || '').trim();
    if (!flowId) return NextResponse.json({ error: 'Flow id is required' }, { status: 400 });

    const { data: flow, error } = await auth.db
      .from('bot_flows')
      .select('id, name, status')
      .eq('id', flowId)
      .maybeSingle();

    if (error || !flow) {
      return NextResponse.json({ error: error?.message || 'Flow not found' }, { status: 404 });
    }

    const saved = await saveWhatsAppBrainConfig({ active_flow_id: flowId }, auth.userProfile?.id || null);

    return NextResponse.json({
      success: true,
      active_flow: flow,
      config: saved,
      note:
        flow.status !== 'PUBLISHED'
          ? 'Flow set as active brain target. Publish it before relying on flow-first routing in Phase 2.'
          : 'Flow set as active brain target.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
