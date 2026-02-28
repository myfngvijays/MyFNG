import { NextRequest, NextResponse } from 'next/server';
import { validateBotFlowGraph } from '@/lib/whatsappBotFlow/validation';
import { getDbWithAdmin, getLatestFlowVersion } from '../../utils';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid flow id' }, { status: 400 });

    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const latestVersion = await getLatestFlowVersion(auth.db, id);
    if (!latestVersion) return NextResponse.json({ error: 'No draft version available to publish' }, { status: 404 });

    const validation = validateBotFlowGraph(latestVersion.graph_json);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Publish blocked due to validation errors', validation },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: updatedVersion, error: updateError } = await auth.db
      .from('bot_flow_versions')
      .update({
        status: 'PUBLISHED',
        published_at: now,
        validation_summary: { errors: validation.errors, warnings: validation.warnings },
        updated_at: now,
      })
      .eq('id', latestVersion.id)
      .select('*')
      .single();

    if (updateError || !updatedVersion) {
      return NextResponse.json({ error: updateError?.message || 'Failed to publish flow version' }, { status: 500 });
    }

    await auth.db
      .from('bot_flows')
      .update({
        status: 'PUBLISHED',
        active_version_id: updatedVersion.id,
        updated_at: now,
      })
      .eq('id', id);

    await auth.db.from('bot_flow_events').insert({
      bot_flow_id: id,
      version_id: updatedVersion.id,
      action: 'PUBLISH_FLOW',
      actor_id: auth.userProfile.id,
      metadata: { version_no: updatedVersion.version_no, warnings: validation.warnings.length },
    });

    return NextResponse.json({ success: true, version: updatedVersion, validation });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
