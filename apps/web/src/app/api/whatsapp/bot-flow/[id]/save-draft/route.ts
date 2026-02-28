import { NextRequest, NextResponse } from 'next/server';
import { normalizeBotFlowGraph, validateBotFlowGraph } from '@/lib/whatsappBotFlow/validation';
import { getDbWithAdmin, getLatestFlowVersion } from '../../utils';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid flow id' }, { status: 400 });

    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const graph = normalizeBotFlowGraph(body?.graph_json);
    const validation = validateBotFlowGraph(graph);
    const now = new Date().toISOString();

    const latestVersion = await getLatestFlowVersion(auth.db, id);
    if (!latestVersion) {
      return NextResponse.json({ error: 'Flow version not found for draft save' }, { status: 404 });
    }

    const nextVersionNo =
      latestVersion.status === 'DRAFT' ? latestVersion.version_no : Number(latestVersion.version_no || 0) + 1;

    if (latestVersion.status === 'DRAFT') {
      const { data: updated, error: updateError } = await auth.db
        .from('bot_flow_versions')
        .update({
          graph_json: graph,
          validation_summary: { errors: validation.errors, warnings: validation.warnings },
          updated_at: now,
        })
        .eq('id', latestVersion.id)
        .select('*')
        .single();

      if (updateError || !updated) {
        return NextResponse.json({ error: updateError?.message || 'Failed to save draft' }, { status: 500 });
      }

      await auth.db
        .from('bot_flows')
        .update({ status: 'DRAFT', updated_at: now })
        .eq('id', id);

      await auth.db.from('bot_flow_events').insert({
        bot_flow_id: id,
        version_id: updated.id,
        action: 'SAVE_DRAFT',
        actor_id: auth.userProfile.id,
        metadata: { version_no: updated.version_no, errors: validation.errors.length, warnings: validation.warnings.length },
      });

      return NextResponse.json({ success: true, version: updated, validation });
    }

    const { data: createdVersion, error: insertError } = await auth.db
      .from('bot_flow_versions')
      .insert({
        bot_flow_id: id,
        version_no: nextVersionNo,
        status: 'DRAFT',
        graph_json: graph,
        validation_summary: { errors: validation.errors, warnings: validation.warnings },
        created_by: auth.userProfile.id,
        updated_at: now,
      })
      .select('*')
      .single();

    if (insertError || !createdVersion) {
      return NextResponse.json({ error: insertError?.message || 'Failed to create draft version' }, { status: 500 });
    }

    await auth.db
      .from('bot_flows')
      .update({ status: 'DRAFT', updated_at: now })
      .eq('id', id);

    await auth.db.from('bot_flow_events').insert({
      bot_flow_id: id,
      version_id: createdVersion.id,
      action: 'CREATE_DRAFT_VERSION',
      actor_id: auth.userProfile.id,
      metadata: { version_no: createdVersion.version_no, errors: validation.errors.length, warnings: validation.warnings.length },
    });

    return NextResponse.json({ success: true, version: createdVersion, validation });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
