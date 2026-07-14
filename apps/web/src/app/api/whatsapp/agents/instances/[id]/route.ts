import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getDbWithAdmin } from '@/app/api/whatsapp/agents/utils';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid instance id' }, { status: 400 });

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? auth.db) as any;

    const { data: instance, error: instError } = await db
      .from('whatsapp_agent_instances')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (instError) return NextResponse.json({ error: instError.message }, { status: 500 });
    if (!instance) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });

    const [{ data: memory }, { data: actions }, { data: wakeup }] = await Promise.all([
      db.from('whatsapp_agent_memory').select('*').eq('instance_id', id).maybeSingle(),
      db
        .from('whatsapp_agent_actions')
        .select(
          'id, event_type, validated_action, execution_status, block_reason, message_sent, wait_until, confidence, reason, latency_ms, created_at',
        )
        .eq('instance_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
      db
        .from('whatsapp_agent_scheduled_wakeups')
        .select('id, wake_at, event_type, status, created_at')
        .eq('instance_id', id)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      success: true,
      instance,
      memory: memory || null,
      actions: actions || [],
      wakeup: wakeup || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
