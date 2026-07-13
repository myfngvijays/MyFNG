import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron/assertCronAuth';
import { pollNewTelecrmLeadsForChase, processDueChaseWakeups } from '@/lib/whatsappAgents/chase/handler';
import {
  pollAllFollowupTriggers,
  processDueFollowupWakeups,
} from '@/lib/whatsappAgents/followup/handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authError = assertCronAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const job = String(request.nextUrl.searchParams.get('job') || 'all').trim().toLowerCase();
  const results: Record<string, unknown> = {};

  try {
    if (job === 'all' || job === 'chase-wakeups') {
      results.chaseWakeups = await processDueChaseWakeups();
    }
    if (job === 'all' || job === 'chase-telecrm') {
      results.chaseTelecrmLeads = await pollNewTelecrmLeadsForChase();
    }
    if (job === 'all' || job === 'followup-wakeups') {
      results.followupWakeups = await processDueFollowupWakeups();
    }
    if (job === 'all' || job === 'followup-triggers') {
      results.followupTriggers = await pollAllFollowupTriggers();
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Cron failed' }, { status: 500 });
  }
}
