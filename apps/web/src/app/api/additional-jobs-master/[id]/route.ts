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

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { profile, roleCode, error } = await getAuthedProfile(supabase);
    if (error === 'Unauthorized') return NextResponse.json({ error }, { status: 401 });
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    if (!isRoleAllowed(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = params.id;
    const body = await request.json().catch(() => ({}));

    // Pre-check: enforce workshop-wise ownership rules with clear errors
    const { data: existing, error: getErr } = await supabase
      .from('additional_jobs_master')
      .select('id, workshop_id')
      .eq('id', id)
      .maybeSingle();
    if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isSuperAdmin = roleCode === 'SUPER_ADMIN';
    const viewerWorkshopId = (profile.workshop_id as string | null) ?? null;

    if (!isSuperAdmin) {
      if (!viewerWorkshopId) return NextResponse.json({ error: 'Workshop not set for user' }, { status: 400 });
      if (!existing.workshop_id) {
        return NextResponse.json(
          { error: 'Global items are read-only for workshop users. Create a workshop copy to edit.' },
          { status: 403 }
        );
      }
      if (existing.workshop_id !== viewerWorkshopId) {
        return NextResponse.json({ error: 'Forbidden (different workshop)' }, { status: 403 });
      }
    }

    const update: any = {
      updated_at: new Date().toISOString(),
    };

    const fields = [
      'name',
      'description',
      'category',
      'hsn_sac_code',
      'unit',
      'oem_price',
      'oes_price',
      'labour_price',
      // legacy
      'default_price',
      'tax_rate',
      'is_active',
    ];
    for (const f of fields) {
      if (Object.prototype.hasOwnProperty.call(body, f)) update[f] = body[f];
    }
    if (typeof update.name === 'string') update.name = update.name.trim();
    // Legacy: if default_price is provided, map it to oem_price
    if (Object.prototype.hasOwnProperty.call(update, 'default_price')) {
      update.oem_price = Number(update.default_price ?? 0);
      delete update.default_price;
    }
    if (Object.prototype.hasOwnProperty.call(update, 'oem_price')) update.oem_price = Number(update.oem_price ?? 0);
    if (Object.prototype.hasOwnProperty.call(update, 'oes_price')) update.oes_price = Number(update.oes_price ?? 0);
    if (Object.prototype.hasOwnProperty.call(update, 'labour_price')) update.labour_price = Number(update.labour_price ?? 0);
    if (Object.prototype.hasOwnProperty.call(update, 'tax_rate')) update.tax_rate = Number(update.tax_rate ?? 18);

    // Only super admin can change workshop_id (and only if explicitly provided)
    if (roleCode === 'SUPER_ADMIN' && Object.prototype.hasOwnProperty.call(body, 'workshop_id')) {
      update.workshop_id = body.workshop_id ?? null;
    }

    const { data, error: updErr } = await supabase
      .from('additional_jobs_master')
      .update(update)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, item: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { profile, roleCode, error } = await getAuthedProfile(supabase);
    if (error === 'Unauthorized') return NextResponse.json({ error }, { status: 401 });
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    if (!isRoleAllowed(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = params.id;
    const now = new Date().toISOString();

    // Pre-check: enforce workshop-wise ownership rules with clear errors
    const { data: existing, error: getErr } = await supabase
      .from('additional_jobs_master')
      .select('id, workshop_id')
      .eq('id', id)
      .maybeSingle();
    if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isSuperAdmin = roleCode === 'SUPER_ADMIN';
    const viewerWorkshopId = (profile.workshop_id as string | null) ?? null;

    if (!isSuperAdmin) {
      if (!viewerWorkshopId) return NextResponse.json({ error: 'Workshop not set for user' }, { status: 400 });
      if (!existing.workshop_id) {
        return NextResponse.json(
          { error: 'Global items are read-only for workshop users. Create a workshop copy to delete.' },
          { status: 403 }
        );
      }
      if (existing.workshop_id !== viewerWorkshopId) {
        return NextResponse.json({ error: 'Forbidden (different workshop)' }, { status: 403 });
      }
    }

    // Soft-delete: mark inactive + deleted_at
    const { data, error: delErr } = await supabase
      .from('additional_jobs_master')
      .update({ is_active: false, deleted_at: now, updated_at: now })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, item: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

