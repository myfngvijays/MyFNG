import { NextResponse } from 'next/server';
import { pollAllFollowupTriggers, processDueFollowupWakeups } from '@/lib/whatsappAgents/followup/handler';
import { getDbWithAdmin } from '@/app/api/whatsapp/agents/utils';

export async function POST() {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const [wakeups, triggers] = await Promise.all([
      processDueFollowupWakeups(),
      pollAllFollowupTriggers(),
    ]);

    return NextResponse.json({
      success: true,
      followup_wakeups: wakeups,
      followup_triggers: triggers,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Run failed' }, { status: 500 });
  }
}
