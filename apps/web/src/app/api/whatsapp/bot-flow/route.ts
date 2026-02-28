import { NextRequest, NextResponse } from 'next/server';
import { createDefaultBotFlowGraph, validateBotFlowGraph } from '@/lib/whatsappBotFlow/validation';
import { getDbWithAdmin } from './utils';

export async function GET() {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data: flows, error } = await auth.db
      .from('bot_flows')
      .select(
        'id, name, channel, status, active_version_id, created_at, updated_at, bot_flow_versions!bot_flow_versions_bot_flow_id_fkey(id, version_no, status, created_at, published_at)'
      )
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to fetch bot flows' }, { status: 500 });
    }

    return NextResponse.json({ success: true, flows: flows || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || '').trim() || 'Untitled Flow';
    const graph = body?.graph_json || createDefaultBotFlowGraph();
    const validation = validateBotFlowGraph(graph);
    const now = new Date().toISOString();

    const { data: createdFlow, error: flowError } = await auth.db
      .from('bot_flows')
      .insert({
        name,
        channel: 'WHATSAPP',
        status: 'DRAFT',
        created_by: auth.userProfile.id,
        updated_at: now,
      })
      .select('id, name, channel, status, active_version_id, created_at, updated_at')
      .single();

    if (flowError || !createdFlow) {
      return NextResponse.json({ error: flowError?.message || 'Failed to create flow' }, { status: 500 });
    }

    const { data: createdVersion, error: versionError } = await auth.db
      .from('bot_flow_versions')
      .insert({
        bot_flow_id: createdFlow.id,
        version_no: 1,
        status: 'DRAFT',
        graph_json: graph,
        validation_summary: { errors: validation.errors, warnings: validation.warnings },
        created_by: auth.userProfile.id,
        updated_at: now,
      })
      .select('*')
      .single();

    if (versionError || !createdVersion) {
      return NextResponse.json({ error: versionError?.message || 'Failed to create flow version' }, { status: 500 });
    }

    await auth.db
      .from('bot_flow_events')
      .insert({
        bot_flow_id: createdFlow.id,
        version_id: createdVersion.id,
        action: 'CREATE_FLOW',
        actor_id: auth.userProfile.id,
        metadata: { name },
      });

    return NextResponse.json({
      success: true,
      flow: createdFlow,
      version: createdVersion,
      validation,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
