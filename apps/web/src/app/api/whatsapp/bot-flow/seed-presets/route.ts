import { NextResponse } from 'next/server';
import { getDbWithAdmin } from '../utils';
import { saveWhatsAppBrainConfig } from '@/lib/whatsappBotFlow/brainConfig';
import { PRESET_BOT_FLOWS, validatePresetGraph } from '@/lib/whatsappBotFlow/presetFlows';

export async function POST() {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const now = new Date().toISOString();
    const results: Array<{
      key: string;
      name: string;
      created: boolean;
      published: boolean;
      flow_id?: string;
      version_id?: string;
      validation?: { errors: string[]; warnings: string[]; isValid: boolean };
      error?: string;
    }> = [];

    let activeFlowId: string | null = null;
    let recommendedMode: 'HYBRID' | 'FLOW_FIRST' | 'AI_FIRST' | null = null;

    for (const preset of PRESET_BOT_FLOWS) {
      const validation = validatePresetGraph(preset.graph);
      if (!validation.isValid) {
        results.push({
          key: preset.key,
          name: preset.name,
          created: false,
          published: false,
          validation,
          error: validation.errors.join('; '),
        });
        continue;
      }

      const { data: existingRows } = await auth.db
        .from('bot_flows')
        .select('id, name, status, active_version_id, updated_at')
        .eq('name', preset.name)
        .order('updated_at', { ascending: false })
        .limit(1);

      const existing = Array.isArray(existingRows) ? existingRows[0] : null;

      if (existing?.id) {
        results.push({
          key: preset.key,
          name: preset.name,
          created: false,
          published: String(existing.status).toUpperCase() === 'PUBLISHED',
          flow_id: existing.id,
          version_id: existing.active_version_id || undefined,
          validation,
        });
        if (preset.setActiveOnSeed) activeFlowId = existing.id;
        if (preset.setActiveOnSeed) recommendedMode = preset.recommendedMode;
        continue;
      }

      const { data: createdFlow, error: flowError } = await auth.db
        .from('bot_flows')
        .insert({
          name: preset.name,
          channel: 'WHATSAPP',
          status: preset.publishOnSeed ? 'PUBLISHED' : 'DRAFT',
          created_by: auth.userProfile.id,
          updated_at: now,
        })
        .select('id, name, status')
        .single();

      if (flowError || !createdFlow) {
        results.push({
          key: preset.key,
          name: preset.name,
          created: false,
          published: false,
          error: flowError?.message || 'Failed to create flow',
          validation,
        });
        continue;
      }

      const { data: createdVersion, error: versionError } = await auth.db
        .from('bot_flow_versions')
        .insert({
          bot_flow_id: createdFlow.id,
          version_no: 1,
          status: preset.publishOnSeed ? 'PUBLISHED' : 'DRAFT',
          graph_json: preset.graph,
          validation_summary: { errors: validation.errors, warnings: validation.warnings },
          published_at: preset.publishOnSeed ? now : null,
          created_by: auth.userProfile.id,
          updated_at: now,
        })
        .select('id')
        .single();

      if (versionError || !createdVersion) {
        results.push({
          key: preset.key,
          name: preset.name,
          created: false,
          published: false,
          flow_id: createdFlow.id,
          error: versionError?.message || 'Failed to create flow version',
          validation,
        });
        continue;
      }

      if (preset.publishOnSeed) {
        await auth.db
          .from('bot_flows')
          .update({
            status: 'PUBLISHED',
            active_version_id: createdVersion.id,
            updated_at: now,
          })
          .eq('id', createdFlow.id);
      }

      await auth.db.from('bot_flow_events').insert({
        bot_flow_id: createdFlow.id,
        version_id: createdVersion.id,
        action: 'SEED_PRESET_FLOW',
        actor_id: auth.userProfile.id,
        metadata: { preset_key: preset.key, published: preset.publishOnSeed },
      });

      results.push({
        key: preset.key,
        name: preset.name,
        created: true,
        published: preset.publishOnSeed,
        flow_id: createdFlow.id,
        version_id: createdVersion.id,
        validation,
      });

      if (preset.setActiveOnSeed) {
        activeFlowId = createdFlow.id;
        recommendedMode = preset.recommendedMode;
      }
    }

    let config = null;
    if (activeFlowId) {
      config = await saveWhatsAppBrainConfig(
        {
          active_flow_id: activeFlowId,
          mode: recommendedMode || 'HYBRID',
        },
        auth.userProfile?.id || null,
      );
    }

    return NextResponse.json({
      success: true,
      results,
      active_flow_id: activeFlowId,
      config,
      note:
        'WhatsApp Router v1 is published and set active. Enable Brain + HYBRID mode on Bot Flow page if not already on.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
