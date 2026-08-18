import { NextRequest, NextResponse } from 'next/server';
import { getDbWithAdmin } from '../utils';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid flow id' }, { status: 400 });

    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data: flow, error: flowError } = await auth.db
      .from('bot_flows')
      .select('id, name, channel, status, active_version_id, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (flowError) return NextResponse.json({ error: flowError.message || 'Failed to fetch flow' }, { status: 500 });
    if (!flow) return NextResponse.json({ error: 'Flow not found' }, { status: 404 });

    const { data: versions, error: versionsError } = await auth.db
      .from('bot_flow_versions')
      .select('id, bot_flow_id, version_no, status, graph_json, validation_summary, published_at, created_at, updated_at')
      .eq('bot_flow_id', id)
      .order('version_no', { ascending: false });

    if (versionsError) {
      return NextResponse.json({ error: versionsError.message || 'Failed to fetch flow versions' }, { status: 500 });
    }

    const { data: events, error: eventsError } = await auth.db
      .from('bot_flow_events')
      .select('id, action, metadata, created_at, version_id')
      .eq('bot_flow_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message || 'Failed to fetch flow events' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      flow,
      versions: versions || [],
      events: events || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid flow id' }, { status: 400 });

    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data: existing, error: lookupError } = await auth.db
      .from('bot_flows')
      .select('id, name')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message || 'Failed to lookup flow' }, { status: 500 });
    }
    if (!existing) return NextResponse.json({ error: 'Flow not found' }, { status: 404 });

    // Break active_version FK before cascade delete of versions
    const { error: clearError } = await auth.db
      .from('bot_flows')
      .update({ active_version_id: null, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (clearError) {
      return NextResponse.json({ error: clearError.message || 'Failed to clear active version' }, { status: 500 });
    }

    const { error: deleteError } = await auth.db.from('bot_flows').delete().eq('id', id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message || 'Failed to delete flow' }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted_id: id, name: existing.name });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
