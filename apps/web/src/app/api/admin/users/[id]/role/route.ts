import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { db: null as any, error: 'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL' };
  const db = createSupabaseAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { db, error: null };
}

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  if (profileError || !userProfile) return { ok: false as const, status: 403, error: 'Forbidden' };
  const roleCode = (userProfile.role as any)?.role_code;
  if (roleCode !== 'SUPER_ADMIN') return { ok: false as const, status: 403, error: 'Forbidden' };

  return { ok: true as const, userId: user.id };
}

// PATCH: change a user's role (+ optional related fields). SUPER_ADMIN only.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { db, error: adminErr } = getAdminDb();
    if (!db) return NextResponse.json({ error: adminErr }, { status: 500 });

    const targetUserId = String(params?.id || '').trim();
    if (!targetUserId) return NextResponse.json({ error: 'Missing user id' }, { status: 400 });

    const body = await request.json().catch(() => null) as any;
    const role_id = String(body?.role_id || '').trim();
    const workshop_id = body?.workshop_id ? String(body.workshop_id).trim() : null;
    const assigned_manager_id = body?.assigned_manager_id ? String(body.assigned_manager_id).trim() : null;
    const department = body?.department ? String(body.department).trim() : null;

    if (!role_id) return NextResponse.json({ error: 'Missing role_id' }, { status: 400 });

    const { data: role, error: roleErr } = await db
      .from('roles')
      .select('id, role_code, role_name')
      .eq('id', role_id)
      .single();
    if (roleErr || !role) return NextResponse.json({ error: 'Invalid role_id' }, { status: 400 });

    const newRoleCode = String((role as any).role_code || '').trim();
    if (!newRoleCode) return NextResponse.json({ error: 'Invalid role configuration' }, { status: 400 });

    const needsWorkshop = newRoleCode.startsWith('WORKSHOP_') || newRoleCode === 'PICKUP_BOY';
    const needsManager = newRoleCode === 'TELECALLER';
    const needsDepartment = newRoleCode === 'SUB_ADMIN';

    if (needsWorkshop && !workshop_id) {
      return NextResponse.json({ error: 'workshop_id is required for this role' }, { status: 400 });
    }
    if (needsManager && !assigned_manager_id) {
      return NextResponse.json({ error: 'assigned_manager_id is required for this role' }, { status: 400 });
    }
    if (needsDepartment && !department) {
      return NextResponse.json({ error: 'department is required for this role' }, { status: 400 });
    }

    const patch: any = {
      role_id,
      updated_at: new Date().toISOString(),
    };

    // Keep existing values unless role demands a specific field.
    if (needsWorkshop) patch.workshop_id = workshop_id;
    if (needsManager) patch.assigned_manager_id = assigned_manager_id;
    if (needsDepartment) patch.department = department;

    // Clear fields that should not persist across role changes.
    if (!needsWorkshop) patch.workshop_id = null;
    if (!needsManager) patch.assigned_manager_id = null;
    if (!needsDepartment) patch.department = null;

    const { data, error } = await db
      .from('users_login')
      .update(patch)
      .eq('id', targetUserId)
      .select('id, full_name, email, role_id, workshop_id, assigned_manager_id, department, is_active, updated_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, user: data });
  } catch (error: any) {
    console.error('[admin/users][role][PATCH]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

