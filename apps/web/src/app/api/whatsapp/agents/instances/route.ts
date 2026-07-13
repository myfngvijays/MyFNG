import { NextRequest, NextResponse } from 'next/server';
import { getDbWithAdmin } from '@/app/api/whatsapp/agents/utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const agentType = searchParams.get('agent_type');
    const status = searchParams.get('status');
    const phone = searchParams.get('phone');
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));
    const offset = (page - 1) * limit;

    let query = auth.db
      .from('whatsapp_agent_instances')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (agentType) query = query.eq('agent_type', agentType.toUpperCase());
    if (status) query = query.eq('status', status.toUpperCase());
    if (phone) query = query.ilike('phone', `%${phone.replace(/\D/g, '').slice(-10)}%`);

    const { data, error, count } = await query;

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          instances: [],
          total: 0,
          page,
          note: 'Run migration database/260_whatsapp_agents.sql to enable instances',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      instances: data || [],
      total: count ?? 0,
      page,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
