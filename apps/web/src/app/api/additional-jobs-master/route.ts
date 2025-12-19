import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RoleCode = 'SUPER_ADMIN' | 'WORKSHOP_ADMIN' | 'WORKSHOP_SUPERVISOR';

async function getAuthedProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { user: null, profile: null as any, roleCode: null as string | null, error: 'Unauthorized' as const };

  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();
  const selectProfile = 'id, email, phone, workshop_id, roles!inner(role_code)';

  const { data: byEmail } = email
    ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null };
  const { data: byPhone } = !byEmail && phone
    ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
    : { data: null };
  const { data: byId } = !byEmail && !byPhone
    ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
    : { data: null };

  const profile = byEmail || byPhone || byId;
  const roleCode = (profile?.roles as any)?.role_code || null;
  return { user, profile, roleCode, error: profile ? null : ('User profile not found' as const) };
}

function isRoleAllowed(roleCode: string | null): roleCode is RoleCode {
  return roleCode === 'SUPER_ADMIN' || roleCode === 'WORKSHOP_ADMIN' || roleCode === 'WORKSHOP_SUPERVISOR';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { profile, roleCode, error } = await getAuthedProfile(supabase);
    if (error === 'Unauthorized') return NextResponse.json({ error }, { status: 401 });
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    if (!isRoleAllowed(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const workshopIdParam = searchParams.get('workshop_id');
    const includeGlobal = searchParams.get('include_global') !== '0'; // default true
    const includeInactive = searchParams.get('include_inactive') === '1'; // default false
    const q = (searchParams.get('q') || '').trim();

    const isSuperAdmin = roleCode === 'SUPER_ADMIN';
    const workshopId =
      isSuperAdmin && workshopIdParam
        ? workshopIdParam
        : (profile.workshop_id as string | null);

    let query = supabase
      .from('additional_jobs_master')
      .select('*')
      .order('created_at', { ascending: false });

    if (!includeInactive) {
      query = query.eq('is_active', true).is('deleted_at', null);
    } else {
      query = query.is('deleted_at', null);
    }

    // Scope
    if (isSuperAdmin) {
      if (workshopId && includeGlobal) {
        query = query.or(`workshop_id.eq.${workshopId},workshop_id.is.null`);
      } else if (workshopId && !includeGlobal) {
        query = query.eq('workshop_id', workshopId);
      } else if (!workshopId && !includeGlobal) {
        query = query.is('workshop_id', null);
      } // else: all workshops + global
    } else {
      // workshop roles: always show own workshop + global (if includeGlobal)
      if (workshopId && includeGlobal) {
        query = query.or(`workshop_id.eq.${workshopId},workshop_id.is.null`);
      } else if (workshopId && !includeGlobal) {
        query = query.eq('workshop_id', workshopId);
      } else {
        query = query.is('workshop_id', null);
      }
    }

    if (q) {
      query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%,hsn_sac_code.ilike.%${q}%`);
    }

    const { data, error: fetchError } = await query;
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

    return NextResponse.json(
      {
        success: true,
        items: data || [],
        viewer: {
          roleCode,
          workshop_id: profile.workshop_id ?? null,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { profile, roleCode, error } = await getAuthedProfile(supabase);
    if (error === 'Unauthorized') return NextResponse.json({ error }, { status: 401 });
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    if (!isRoleAllowed(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const isSuperAdmin = roleCode === 'SUPER_ADMIN';
    const workshopId = isSuperAdmin ? (body?.workshop_id ?? null) : (profile.workshop_id ?? null);

    // Prevent duplicates (case-insensitive) within same scope (workshop/global)
    let existQuery = supabase
      .from('additional_jobs_master')
      .select('*')
      .is('deleted_at', null)
      .ilike('name', name);
    existQuery = workshopId ? existQuery.eq('workshop_id', workshopId) : existQuery.is('workshop_id', null);

    const { data: existing, error: existErr } = await existQuery.maybeSingle();
    if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 });
    if (existing) return NextResponse.json({ success: true, existed: true, item: existing }, { status: 200 });

    const payload: any = {
      workshop_id: workshopId,
      name,
      description: (body?.description ?? null) as string | null,
      category: (body?.category ?? null) as string | null,
      hsn_sac_code: (body?.hsn_sac_code ?? null) as string | null,
      unit: (body?.unit ?? 'job') as string,
      default_price: Number(body?.default_price ?? 0),
      tax_rate: Number(body?.tax_rate ?? 18),
      is_active: body?.is_active === false ? false : true,
      created_by: profile.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error: insErr } = await supabase
      .from('additional_jobs_master')
      .insert([payload])
      .select('*')
      .single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    return NextResponse.json({ success: true, item: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

