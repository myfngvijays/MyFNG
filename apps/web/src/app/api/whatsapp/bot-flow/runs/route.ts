import { NextRequest, NextResponse } from 'next/server';
import { getDbWithAdmin } from '../utils';
import { WORKFLOW_TRIGGER_EVENTS } from '@/lib/whatsappBotFlow/workflowEvents';

export async function GET(request: NextRequest) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const flowId = String(request.nextUrl.searchParams.get('flow_id') || '').trim();
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 50);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 50;

    let query = auth.db
      .from('bot_flow_runs')
      .select(
        'id, bot_flow_id, version_id, trigger_event, phone, status, input_payload, trace, error_message, started_at, finished_at, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (flowId) query = query.eq('bot_flow_id', flowId);

    const { data, error } = await query;
    if (error) {
      if (/bot_flow_runs|does not exist|relation/i.test(String(error.message || ''))) {
        return NextResponse.json({
          success: true,
          runs: [],
          events: WORKFLOW_TRIGGER_EVENTS,
          migration_required: true,
        });
      }
      return NextResponse.json({ error: error.message || 'Failed to load runs' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      runs: data || [],
      events: WORKFLOW_TRIGGER_EVENTS,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
