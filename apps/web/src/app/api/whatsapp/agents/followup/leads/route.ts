import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getDbWithAdmin } from '@/app/api/whatsapp/agents/utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ACTIVE,WAITING';
    const statuses = status.split(',').map((s) => s.trim().toUpperCase());

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? auth.db) as any;

    const { data, error } = await db
      .from('whatsapp_agent_instances')
      .select(`
        *,
        memory:whatsapp_agent_memory(buying_intent, sentiment, conversation_summary, crm_snapshot)
      `)
      .eq('agent_type', 'FOLLOWUP')
      .in('status', statuses)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, leads: data || [], total: data?.length || 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
