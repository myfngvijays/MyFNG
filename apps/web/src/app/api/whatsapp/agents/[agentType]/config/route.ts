import { NextRequest, NextResponse } from 'next/server';
import {
  ensureAgentConfigsSeeded,
  fetchAgentConfig,
  fetchAgentRuntime,
  saveAgentConfig,
} from '@/lib/whatsappAgents/shared/configStore';
import type { AgentType } from '@/lib/whatsappAgents/shared/types';
import { getDbWithAdmin } from '@/app/api/whatsapp/agents/utils';

type RouteContext = { params: Promise<{ agentType: string }> };

const TYPE_MAP: Record<string, AgentType> = {
  booking: 'BOOKING',
  followup: 'FOLLOWUP',
  chase: 'CHASE',
};

function resolveType(raw: string): AgentType | null {
  return TYPE_MAP[raw.toLowerCase()] || null;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { agentType: raw } = await context.params;
    const agentType = resolveType(raw);
    if (!agentType) return NextResponse.json({ error: 'Invalid agent type' }, { status: 400 });

    await ensureAgentConfigsSeeded().catch(() => null);
    const [config, runtime] = await Promise.all([
      fetchAgentConfig(agentType, true),
      fetchAgentRuntime(agentType),
    ]);

    return NextResponse.json({ success: true, config, runtime });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { agentType: raw } = await context.params;
    const agentType = resolveType(raw);
    if (!agentType) return NextResponse.json({ error: 'Invalid agent type' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const saved = await saveAgentConfig(
      agentType,
      body?.config || body,
      auth.userProfile?.id || null,
    );

    return NextResponse.json({ success: true, config: saved });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
