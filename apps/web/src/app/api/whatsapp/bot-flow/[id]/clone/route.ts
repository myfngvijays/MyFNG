import { NextRequest, NextResponse } from 'next/server';
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

    const latestVersion = await getLatestFlowVersion(auth.db, id);
    if (!latestVersion) return NextResponse.json({ error: 'Source flow version not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const requestedName = String(body?.name || '').trim();
    const cloneName = requestedName || `Copy of ${String(body?.source_name || 'Flow').trim() || 'Flow'}`;
    const now = new Date().toISOString();

    const { data: createdFlow, error: flowError } = await auth.db
      .from('bot_flows')
      .insert({
        name: cloneName,
        channel: 'WHATSAPP',
        status: 'DRAFT',
        created_by: auth.userProfile.id,
        updated_at: now,
      })
      .select('*')
      .single();

    if (flowError || !createdFlow) {
      return NextResponse.json({ error: flowError?.message || 'Failed to create cloned flow' }, { status: 500 });
    }

    const { data: createdVersion, error: versionError } = await auth.db
      .from('bot_flow_versions')
      .insert({
        bot_flow_id: createdFlow.id,
        version_no: 1,
        status: 'DRAFT',
        graph_json: latestVersion.graph_json,
        validation_summary: latestVersion.validation_summary || { errors: [], warnings: [] },
        created_by: auth.userProfile.id,
        updated_at: now,
      })
      .select('*')
      .single();

    if (versionError || !createdVersion) {
      return NextResponse.json({ error: versionError?.message || 'Failed to create cloned version' }, { status: 500 });
    }

    await auth.db.from('bot_flow_events').insert({
      bot_flow_id: createdFlow.id,
      version_id: createdVersion.id,
      action: 'CLONE_FLOW',
      actor_id: auth.userProfile.id,
      metadata: { source_flow_id: id, source_version_id: latestVersion.id },
    });

    return NextResponse.json({ success: true, flow: createdFlow, version: createdVersion });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
