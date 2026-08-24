import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const body = await request.json();
    const { role_code, role_name, description, permissions } = body;

    if (!role_code || !role_name) {
      return NextResponse.json({ error: 'role_code and role_name are required' }, { status: 400 });
    }

    const code = String(role_code).trim().toUpperCase().replace(/\s+/g, '_');
    if (code === 'APP_OPERATIONS') {
      return NextResponse.json({ error: 'App Operations role is retired. Use Lead Manager.' }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('role_code', code)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: `Role code "${code}" already exists` }, { status: 409 });
    }

    const { data, error } = await supabaseAdmin
      .from('roles')
      .insert({
        role_code: code,
        role_name: String(role_name).trim(),
        description: description || null,
        permissions: permissions || {},
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ role: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const body = await request.json();
    const { role_id, permissions, description } = body;

    if (!role_id) return NextResponse.json({ error: 'role_id is required' }, { status: 400 });

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (permissions !== undefined) update.permissions = permissions;
    if (description !== undefined) update.description = description;

    const { data, error } = await supabaseAdmin
      .from('roles')
      .update(update)
      .eq('id', role_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ role: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const { data: roles, error } = await supabaseAdmin
      .from('roles')
      .select('id, role_code, role_name, description, permissions, is_active, created_at')
      .order('role_name');

    if (error) throw error;

    const { data: userCounts } = await supabaseAdmin
      .from('users_login')
      .select('role_id');

    const countByRoleId: Record<string, number> = {};
    for (const u of userCounts || []) {
      countByRoleId[u.role_id] = (countByRoleId[u.role_id] || 0) + 1;
    }

    const enriched = (roles || [])
      .filter((role: { role_code?: string }) => role.role_code !== 'APP_OPERATIONS')
      .map((role: any) => ({
        ...role,
        user_count: countByRoleId[role.id] || 0,
      }));

    return NextResponse.json({ roles: enriched });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
