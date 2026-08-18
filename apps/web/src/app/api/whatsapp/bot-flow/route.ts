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
        'id, name, channel, status, trigger_event, description, total_runs, success_runs, failed_runs, last_run_at, active_version_id, created_at, updated_at, bot_flow_versions!bot_flow_versions_bot_flow_id_fkey(id, version_no, status, created_at, published_at)'
      )
      .order('updated_at', { ascending: false });

    if (error) {
      // Older DBs without 315 columns — fall back.
      const retry = await auth.db
        .from('bot_flows')
        .select(
          'id, name, channel, status, active_version_id, created_at, updated_at, bot_flow_versions!bot_flow_versions_bot_flow_id_fkey(id, version_no, status, created_at, published_at)'
        )
        .order('updated_at', { ascending: false });
      if (retry.error) {
        return NextResponse.json({ error: retry.error.message || 'Failed to fetch bot flows' }, { status: 500 });
      }
      return NextResponse.json({ success: true, flows: retry.data || [] });
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
    const triggerEvent = String(body?.trigger_event || body?.triggerEvent || 'whatsapp_incoming').trim() || 'whatsapp_incoming';
    const description = String(body?.description || '').trim() || null;
    const graph = body?.graph_json || createDefaultBotFlowGraph();
    const validation = validateBotFlowGraph(graph);
    const now = new Date().toISOString();

    const insertPayload: Record<string, unknown> = {
      name,
      channel: 'WHATSAPP',
      status: 'DRAFT',
      created_by: auth.userProfile.id,
      updated_at: now,
      trigger_event: triggerEvent,
      description,
    };

    let createdFlow: any = null;
    let flowError: any = null;
    {
      const first = await auth.db
        .from('bot_flows')
        .insert(insertPayload)
        .select('id, name, channel, status, trigger_event, description, total_runs, success_runs, failed_runs, active_version_id, created_at, updated_at')
        .single();
      createdFlow = first.data;
      flowError = first.error;
      if (flowError && /trigger_event|description|total_runs/i.test(String(flowError.message || ''))) {
        const fallback = await auth.db
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
        createdFlow = fallback.data;
        flowError = fallback.error;
      }
    }

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
