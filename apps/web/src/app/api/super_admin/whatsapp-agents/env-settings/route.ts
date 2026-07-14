import { getDbWithAdmin } from '@/app/api/whatsapp/agents/utils';
import { checkWhatsAppAgentsCredentials } from '@/lib/whatsappAgents/shared/agentsHealthCheck';
import {
  loadWhatsAppAgentsEnvConfigView,
  saveWhatsAppAgentsEnvConfig,
} from '@/lib/whatsappAgents/shared/envConfigStore';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const config = await loadWhatsAppAgentsEnvConfigView();
    const health = await checkWhatsAppAgentsCredentials();
    const roleCode = (auth.userProfile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '';

    return NextResponse.json({
      config,
      health,
      can_edit: roleCode === 'SUPER_ADMIN',
      version: '1.0',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const roleCode = (auth.userProfile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '';
    if (roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admin can edit agent credentials' }, { status: 403 });
    }

    const body = await request.json();
    const userId = (auth.userProfile as { id?: string } | null)?.id || '';
    const result = await saveWhatsAppAgentsEnvConfig(body, userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const health = await checkWhatsAppAgentsCredentials();
    return NextResponse.json({
      success: true,
      message: 'Agent credentials saved',
      health,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function POST() {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const health = await checkWhatsAppAgentsCredentials();
    return NextResponse.json({
      ok: health.ok,
      health,
      message: health.ok ? 'All agent credentials healthy' : 'Some credential checks failed',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
