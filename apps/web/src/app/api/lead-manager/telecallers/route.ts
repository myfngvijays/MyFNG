import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireManager(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { supabaseAdmin } = getSupabaseAdmin();
  const profile = await resolveUserProfile(supabase, user, supabaseAdmin);
  const roleCode = String(
    (profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '',
  )
    .trim()
    .toUpperCase();

  if (!profile?.id || !['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return {
    ok: true as const,
    userId: String(profile.id),
    authUserId: user.id,
    roleCode,
    managerName: String((profile as any)?.full_name || '').trim(),
    supabaseAdmin,
  };
}

/**
 * GET /api/lead-manager/telecallers
 * List telecaller IDs under this manager (or all for super/sub admin).
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireManager(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const supabaseAdmin = gate.supabaseAdmin || getSupabaseAdmin().supabaseAdmin;
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 });
    }

    const { data: roleRow } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('role_code', 'TELECALLER')
      .maybeSingle();

    const telecallerRoleId = roleRow?.id ? String(roleRow.id) : null;
    if (!telecallerRoleId) {
      return NextResponse.json({ error: 'TELECALLER role not found' }, { status: 500 });
    }

    let query = supabaseAdmin
      .from('users_login')
      .select('id, full_name, email, phone, is_active, assigned_manager_id, created_at')
      .eq('role_id', telecallerRoleId)
      .order('full_name', { ascending: true });

    if (gate.roleCode === 'LEAD_MANAGER') {
      if (gate.authUserId && gate.authUserId !== gate.userId) {
        query = query.or(
          `assigned_manager_id.eq.${gate.userId},assigned_manager_id.eq.${gate.authUserId}`,
        );
      } else {
        query = query.eq('assigned_manager_id', gate.userId);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      telecallers: data || [],
      manager_id: gate.userId,
    });
  } catch (e: any) {
    console.error('lead-manager telecallers GET', e);
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}

/**
 * POST /api/lead-manager/telecallers
 * Create a telecaller login ID assigned to the current lead manager.
 * Body: { full_name, email, phone?, password }
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await requireManager(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await request.json().catch(() => ({}));
    const first_name = String(body.first_name || '').trim();
    const last_name = String(body.last_name || '').trim();
    const full_name =
      String(body.full_name || '').trim() ||
      [first_name, last_name].filter(Boolean).join(' ').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').replace(/\D/g, '').slice(-10);
    const password = String(body.password || '');

    if (!first_name && !full_name) {
      return NextResponse.json(
        { error: 'first_name (or full_name) is required' },
        { status: 400 },
      );
    }
    if (!email || !password) {
      return NextResponse.json(
        { error: 'email and password are required' },
        { status: 400 },
      );
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: adminErr || 'Admin client unavailable' },
        { status: 500 },
      );
    }

    const { data: roleRow } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('role_code', 'TELECALLER')
      .maybeSingle();

    const telecallerRoleId = roleRow?.id ? String(roleRow.id) : null;
    if (!telecallerRoleId) {
      return NextResponse.json({ error: 'TELECALLER role not found' }, { status: 500 });
    }

    // Lead manager always owns the ID; super/sub can optionally pass assigned_manager_id
    let assignedManagerId = gate.userId;
    if (gate.roleCode !== 'LEAD_MANAGER' && body.assigned_manager_id) {
      assignedManagerId = String(body.assigned_manager_id).trim() || gate.userId;
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone: phone || null },
    });

    if (authError || !authUser?.user?.id) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create auth user' },
        { status: 400 },
      );
    }

    const { data: userData, error: insertError } = await supabaseAdmin
      .from('users_login')
      .insert([
        {
          id: authUser.user.id,
          full_name,
          email,
          phone: phone || null,
          role_id: telecallerRoleId,
          assigned_manager_id: assignedManagerId,
          is_active: true,
        },
      ])
      .select('id, full_name, email, phone, is_active, assigned_manager_id, created_at')
      .single();

    if (insertError) {
      console.error('telecaller users_login insert', insertError);
      try {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      } catch {
        /* ignore cleanup */
      }
      return NextResponse.json(
        { error: `Database error: ${insertError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Telecaller ID created',
      telecaller: userData,
      assigned_to: gate.managerName || assignedManagerId,
    });
  } catch (e: any) {
    console.error('lead-manager telecallers POST', e);
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
