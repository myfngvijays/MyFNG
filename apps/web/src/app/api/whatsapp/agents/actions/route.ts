import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getDbWithAdmin } from '@/app/api/whatsapp/agents/utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instance_id');
    const agentType = searchParams.get('agent_type');
    const status = searchParams.get('execution_status');
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 30)));
    const offset = (page - 1) * limit;

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? auth.db) as any;

    let query = db
      .from('whatsapp_agent_actions')
      .select(
        'id, instance_id, event_type, validated_action, execution_status, block_reason, message_sent, wait_until, confidence, reason, latency_ms, created_at, instance:whatsapp_agent_instances(agent_type, phone, status)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (instanceId) query = query.eq('instance_id', instanceId);
    if (status) query = query.eq('execution_status', status.toUpperCase());

    const { data, error, count } = await query;

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, actions: [], total: 0, page });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let actions = data || [];
    if (agentType) {
      const wanted = agentType.toUpperCase();
      actions = actions.filter(
        (row: any) => String(row.instance?.agent_type || '').toUpperCase() === wanted,
      );
    }

    return NextResponse.json({
      success: true,
      actions,
      total: count ?? actions.length,
      page,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
