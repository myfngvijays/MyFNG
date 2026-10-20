import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  addIncidentUpdate,
  buildPublicStatus,
  createIncident,
  createMaintenance,
  setMaintenanceState,
} from '@/lib/status/publicStatus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  if (roleError || !userData) return { ok: false as const, status: 403, error: 'Forbidden' };

  const roleCode = (userData as { roles?: { role_code?: string } }).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(String(roleCode || ''))) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return { ok: true as const };
}

export async function GET() {
  const auth = await assertSuperAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const full = await buildPublicStatus();
  return NextResponse.json({
    tablesReady: full.tablesReady,
    catalog: full.catalog,
    overall: full.overall,
    headline: full.headline,
    updatedAt: full.updatedAt,
    components: full.components,
    incidents: full.allIncidents,
    maintenances: full.allMaintenances,
  });
}

export async function POST(request: Request) {
  const auth = await assertSuperAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  try {
    if (body.kind === 'incident') {
      const id = await createIncident(body);
      return NextResponse.json({ ok: true, id });
    }
    if (body.kind === 'maintenance') {
      await createMaintenance(body);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save';
    const status = /385_public_status_page/.test(message) ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  const auth = await assertSuperAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  try {
    if (body.kind === 'incident') {
      await addIncidentUpdate(body);
      return NextResponse.json({ ok: true });
    }
    if (body.kind === 'maintenance') {
      await setMaintenanceState(body);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save';
    const status = /385_public_status_page/.test(message) ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
