import { NextResponse } from 'next/server';
import { pollNewTelecrmLeadsForChase, processDueChaseWakeups } from '@/lib/whatsappAgents/chase/handler';
import { getDbWithAdmin } from '@/app/api/whatsapp/agents/utils';

export async function POST() {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const [wakeups, telecrm] = await Promise.all([
      processDueChaseWakeups(),
      pollNewTelecrmLeadsForChase(),
    ]);

    return NextResponse.json({
      success: true,
      chase_wakeups: wakeups,
      chase_telecrm_leads: telecrm,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Run failed' }, { status: 500 });
  }
}
