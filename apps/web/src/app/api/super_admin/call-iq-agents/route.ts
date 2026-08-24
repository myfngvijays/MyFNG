import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import {
  CALL_IQ_PROVIDER,
  defaultCallIqAgents,
  displayCallIqProvider,
  slugifyAgentName,
  type CallIqAgent,
  type CallIqAgentField,
  type CallIqAgentVersion,
} from '@/lib/telecaller/callIqAgents';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertEditor(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized', db: null as any, userId: null as string | null };
  }
  const profile = await resolveUserProfile(supabase, user);
  const roleCode = String((profile?.roles as any)?.role_code || '')
    .trim()
    .toUpperCase();
  if (!['SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER', 'APP_OPERATIONS'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden', db: null as any, userId: null };
  }
  const { supabaseAdmin } = getSupabaseAdmin();
  return {
    ok: true as const,
    status: 200,
    error: null,
    db: supabaseAdmin ?? supabase,
    userId: String((profile as any)?.id || user.id),
  };
}

function tableMissing(message?: string) {
  return /does not exist|schema cache|PGRST205|42P01/i.test(message || '');
}

function mapAgent(
  row: {
    id: string;
    slug: string;
    name: string;
    provider: string;
    agent_type: string;
    current_version: number;
    is_active?: boolean;
    updated_at?: string;
  },
  versions: CallIqAgentVersion[],
): CallIqAgent {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    provider: displayCallIqProvider(row.provider),
    agent_type: row.agent_type || 'Call-IQ',
    current_version: row.current_version || 1,
    is_active: row.is_active === true,
    versions: versions.sort((a, b) => a.version - b.version),
    updated_at: row.updated_at || null,
  };
}

function normalizeFields(raw: unknown): CallIqAgentField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any, idx: number) => {
      const type = String(item?.response_type || 'text').toLowerCase();
      const response_type = type === 'number' || type === 'dropdown' ? type : 'text';
      const options = Array.isArray(item?.options)
        ? item.options.map((x: unknown) => String(x).trim()).filter(Boolean)
        : undefined;
      return {
        id: String(item?.id || item?.key || `f_${idx}`),
        key: String(item?.key || item?.name || `field_${idx}`)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '') || `field_${idx}`,
        name: String(item?.name || 'Field').trim() || 'Field',
        response_type: response_type as CallIqAgentField['response_type'],
        options: response_type === 'dropdown' ? options || [] : undefined,
      };
    })
    .filter((f) => f.name);
}

async function loadAgents(db: any): Promise<{ agents: CallIqAgent[]; persisted: boolean; warning?: string }> {
  const { data: rows, error } = await db
    .from('call_iq_agents')
    .select('id, slug, name, provider, agent_type, current_version, is_active, updated_at')
    .order('name');
  if (error) {
    if (tableMissing(error.message)) {
      return { agents: defaultCallIqAgents(), persisted: false, warning: 'Run database/351_call_iq_agents.sql' };
    }
    throw error;
  }
  if (!rows?.length) {
    const seeded = await seedDefaults(db);
    return { agents: seeded, persisted: true };
  }
  const ids = rows.map((r: { id: string }) => r.id);
  const { data: vers, error: vErr } = await db
    .from('call_iq_agent_versions')
    .select('agent_id, version, instruction, fields, created_at')
    .in('agent_id', ids)
    .order('version');
  if (vErr) throw vErr;
  const byAgent = new Map<string, CallIqAgentVersion[]>();
  for (const v of vers || []) {
    const list = byAgent.get(v.agent_id) || [];
    list.push({
      version: v.version,
      instruction: String(v.instruction || ''),
      fields: normalizeFields(v.fields),
      created_at: v.created_at,
    });
    byAgent.set(v.agent_id, list);
  }
  const mapped = rows.map((r: any) => mapAgent(r, byAgent.get(r.id) || []));
  const actives = mapped.filter((a) => a.is_active);
  const keepId =
    actives.length <= 1
      ? actives[0]?.id
      : mapped.find((a) => a.slug === 'call-audit-sop-new' && a.is_active)?.id || actives[0]?.id;
  return {
    agents: mapped.map((a) => ({ ...a, is_active: keepId ? a.id === keepId : a.slug === 'call-audit-sop-new' })),
    persisted: true,
  };
}

async function seedDefaults(db: any): Promise<CallIqAgent[]> {
  const seeded: CallIqAgent[] = [];
  for (const agent of defaultCallIqAgents()) {
    const { data: row, error } = await db
      .from('call_iq_agents')
      .upsert(
        {
          slug: agent.slug,
          name: agent.name,
          provider: agent.provider,
          agent_type: agent.agent_type,
          current_version: agent.current_version,
          is_active: agent.is_active === true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'slug' },
      )
      .select('id, slug, name, provider, agent_type, current_version, is_active, updated_at')
      .single();
    if (error || !row) continue;
    const versions: CallIqAgentVersion[] = [];
    for (const v of agent.versions) {
      const { error: vErr } = await db.from('call_iq_agent_versions').upsert(
        {
          agent_id: row.id,
          version: v.version,
          instruction: v.instruction,
          fields: v.fields,
        },
        { onConflict: 'agent_id,version' },
      );
      if (!vErr) versions.push(v);
    }
    seeded.push(mapAgent(row, versions.length ? versions : agent.versions));
  }
  return seeded.length ? seeded : defaultCallIqAgents();
}

export async function GET(request: NextRequest) {
  const auth = await assertEditor(request);
  if (!auth.ok) {
    return NextResponse.json({
      success: true,
      agents: defaultCallIqAgents(),
      persisted: false,
      warning: 'Default Call-IQ agents. Session/database check failed — run 351_call_iq_agents.sql to save edits.',
    });
  }
  try {
    const loaded = await loadAgents(auth.db);
    return NextResponse.json({ success: true, ...loaded });
  } catch (e: any) {
    return NextResponse.json({
      success: true,
      agents: defaultCallIqAgents(),
      persisted: false,
      warning: e?.message || 'Using default agents',
    });
  }
}

export async function POST(request: NextRequest) {
  const auth = await assertEditor(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || 'create');

  try {
    if (action === 'duplicate') {
      const loaded = await loadAgents(auth.db);
      const source = loaded.agents.find((a) => a.id === body.agent_id || a.slug === body.slug);
      if (!source) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      if (!loaded.persisted) {
        return NextResponse.json({ error: 'Run database/351_call_iq_agents.sql' }, { status: 409 });
      }
      const name = `${source.name} copy`;
      const slug = `${slugifyAgentName(name)}-${Date.now().toString(36)}`;
      const ver = source.versions.find((v) => v.version === source.current_version) || source.versions[0];
      const { data: row, error } = await auth.db
        .from('call_iq_agents')
        .insert({
          slug,
          name,
          provider: displayCallIqProvider(source.provider),
          agent_type: source.agent_type,
          current_version: 1,
          is_active: false,
        })
        .select('id, slug, name, provider, agent_type, current_version, is_active, updated_at')
        .single();
      if (error) throw error;
      await auth.db.from('call_iq_agent_versions').insert({
        agent_id: row.id,
        version: 1,
        instruction: ver?.instruction || '',
        fields: ver?.fields || [],
        created_by: auth.userId,
      });
      const again = await loadAgents(auth.db);
      return NextResponse.json({ success: true, ...again, created_id: row.id });
    }

    const name = String(body.name || '').trim() || 'New Call-IQ agent';
    const slug = `${slugifyAgentName(name)}-${Date.now().toString(36)}`;
    const fields = normalizeFields(body.fields?.length ? body.fields : defaultCallIqAgents()[0].versions[0].fields);
    const instruction = String(body.instruction || DEFAULT_FALLBACK_INSTRUCTION);
    const { data: row, error } = await auth.db
      .from('call_iq_agents')
      .insert({
        slug,
        name,
        provider: CALL_IQ_PROVIDER,
        agent_type: 'Call-IQ',
        current_version: 1,
        is_active: false,
      })
      .select('id, slug, name, provider, agent_type, current_version, is_active, updated_at')
      .single();
    if (error) {
      if (tableMissing(error.message)) {
        return NextResponse.json({ error: 'Run database/351_call_iq_agents.sql' }, { status: 409 });
      }
      throw error;
    }
    await auth.db.from('call_iq_agent_versions').insert({
      agent_id: row.id,
      version: 1,
      instruction,
      fields,
      created_by: auth.userId,
    });
    const again = await loadAgents(auth.db);
    return NextResponse.json({ success: true, ...again, created_id: row.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Save failed' }, { status: 500 });
  }
}

const DEFAULT_FALLBACK_INSTRUCTION = `- Overall score out of 100
Return results strictly in structured fields.`;

export async function PUT(request: NextRequest) {
  const auth = await assertEditor(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));
  const agentId = String(body.agent_id || '').trim();
  if (!agentId) return NextResponse.json({ error: 'agent_id required' }, { status: 400 });

  try {
    const loaded = await loadAgents(auth.db);
    if (!loaded.persisted) {
      return NextResponse.json({ error: 'Run database/351_call_iq_agents.sql' }, { status: 409 });
    }
    const agent = loaded.agents.find((a) => a.id === agentId);
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

    const nextVersion = Math.max(0, ...agent.versions.map((v) => v.version)) + 1;
    const fields = normalizeFields(body.fields);
    const instruction = String(body.instruction ?? '');
    const name = String(body.name || agent.name).trim() || agent.name;

    const { error: vErr } = await auth.db.from('call_iq_agent_versions').insert({
      agent_id: agentId,
      version: nextVersion,
      instruction,
      fields,
      created_by: auth.userId,
    });
    if (vErr) throw vErr;

    const { error: uErr } = await auth.db
      .from('call_iq_agents')
      .update({
        name,
        current_version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agentId);
    if (uErr) throw uErr;

    const again = await loadAgents(auth.db);
    return NextResponse.json({ success: true, ...again, saved_version: nextVersion });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Save failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await assertEditor(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));
  const agentId = String(body.agent_id || '').trim();
  const action = String(body.action || '').trim();
  if (!agentId) return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
  try {
    if (action === 'set_active' || action === 'set_inactive') {
      const makeActive = action === 'set_active';
      if (makeActive) {
        await auth.db.from('call_iq_agents').update({ is_active: false, updated_at: new Date().toISOString() }).neq('id', agentId);
      }
      const { error } = await auth.db
        .from('call_iq_agents')
        .update({ is_active: makeActive, updated_at: new Date().toISOString() })
        .eq('id', agentId);
      if (error) {
        if (tableMissing(error.message)) {
          return NextResponse.json({ error: 'Run database/351_call_iq_agents.sql' }, { status: 409 });
        }
        throw error;
      }
      const again = await loadAgents(auth.db);
      return NextResponse.json({ success: true, ...again });
    }

    const version = Number(body.version);
    if (!version) return NextResponse.json({ error: 'version or action required' }, { status: 400 });
    const { error } = await auth.db
      .from('call_iq_agents')
      .update({ current_version: version, updated_at: new Date().toISOString() })
      .eq('id', agentId);
    if (error) {
      if (tableMissing(error.message)) {
        return NextResponse.json({ error: 'Run database/351_call_iq_agents.sql' }, { status: 409 });
      }
      throw error;
    }
    const again = await loadAgents(auth.db);
    return NextResponse.json({ success: true, ...again });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await assertEditor(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const agentId = String(new URL(request.url).searchParams.get('id') || '').trim();
  if (!agentId) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    const loaded = await loadAgents(auth.db);
    if (!loaded.persisted) {
      return NextResponse.json({ error: 'Run database/351_call_iq_agents.sql' }, { status: 409 });
    }
    const agent = loaded.agents.find((a) => a.id === agentId);
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    if (loaded.agents.length <= 1) {
      return NextResponse.json({ error: 'At least one agent is required' }, { status: 400 });
    }
    const { error } = await auth.db.from('call_iq_agents').delete().eq('id', agentId);
    if (error) throw error;
    if (agent.is_active) {
      const fallback = loaded.agents.find((a) => a.id !== agentId);
      if (fallback) {
        await auth.db.from('call_iq_agents').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', fallback.id);
      }
    }
    const again = await loadAgents(auth.db);
    return NextResponse.json({ success: true, ...again });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 });
  }
}
