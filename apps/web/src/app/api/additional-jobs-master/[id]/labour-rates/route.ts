import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RoleCode = 'SUPER_ADMIN' | 'WORKSHOP_ADMIN' | 'WORKSHOP_SUPERVISOR';

async function getAuthedProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, profile: null as any, roleCode: null as string | null, error: 'Unauthorized' as const };
  }

  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();
  const selectProfile = 'id, email, phone, workshop_id, roles!inner(role_code)';

  const { data: byEmail } = email
    ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null };
  const { data: byPhone } =
    !byEmail && phone ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle() : { data: null };
  const { data: byId } =
    !byEmail && !byPhone ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle() : { data: null };

  const profile = byEmail || byPhone || byId;
  const roleCode = (profile?.roles as any)?.role_code || null;

  return { user, profile, roleCode, error: profile ? null : ('User profile not found' as const) };
}

function isRoleAllowed(roleCode: string | null): roleCode is RoleCode {
  return roleCode === 'SUPER_ADMIN' || roleCode === 'WORKSHOP_ADMIN' || roleCode === 'WORKSHOP_SUPERVISOR';
}

function normalizeFuelType(v: any): 'PETROL' | 'DIESEL' | 'CNG' {
  const s = String(v || '').trim().toUpperCase();
  if (s === 'DIESEL') return 'DIESEL';
  if (s === 'CNG') return 'CNG';
  return 'PETROL';
}

export async function GET(
  _request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const params = await paramsPromise;
    const { profile, roleCode, error } = await getAuthedProfile(supabase);

    if (error === 'Unauthorized') return NextResponse.json({ error }, { status: 401 });
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    if (!isRoleAllowed(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const additionalJobId = String(params.id || '').trim();
    if (!additionalJobId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    // Ensure job exists + not deleted
    const { data: job, error: jobErr } = await supabase
      .from('additional_jobs_master')
      .select('id, workshop_id, deleted_at')
      .eq('id', additionalJobId)
      .maybeSingle();
    if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
    if (!job || (job as any).deleted_at) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data, error: fetchErr } = await supabase
      .from('additional_jobs_master_labour_rates')
      .select('id, additional_job_id, fuel_type, car_class, labour_price, created_at, updated_at')
      .eq('additional_job_id', additionalJobId)
      .order('car_class', { ascending: true })
      .order('fuel_type', { ascending: true });

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

    return NextResponse.json(
      {
        success: true,
        additional_job_id: additionalJobId,
        rates: (data || []).map((r: any) => ({
          id: r.id,
          additional_job_id: r.additional_job_id,
          fuel_type: String(r.fuel_type || '').toUpperCase(),
          car_class: r.car_class,
          labour_price: Number(r.labour_price ?? 0),
          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const params = await paramsPromise;
    const { profile, roleCode, error } = await getAuthedProfile(supabase);

    if (error === 'Unauthorized') return NextResponse.json({ error }, { status: 401 });
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    if (!isRoleAllowed(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const additionalJobId = String(params.id || '').trim();
    if (!additionalJobId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const rates = Array.isArray(body?.rates) ? body.rates : [];
    if (!rates.length) return NextResponse.json({ error: 'rates is required' }, { status: 400 });

    // Ensure job exists + enforce ownership rules for workshop roles
    const { data: job, error: jobErr } = await supabase
      .from('additional_jobs_master')
      .select('id, workshop_id, deleted_at')
      .eq('id', additionalJobId)
      .maybeSingle();
    if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
    if (!job || (job as any).deleted_at) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isSuperAdmin = roleCode === 'SUPER_ADMIN';
    const jobWorkshopId = (job as any).workshop_id as string | null;
    const viewerWorkshopId = (profile.workshop_id as string | null) ?? null;

    if (!isSuperAdmin) {
      if (!viewerWorkshopId) return NextResponse.json({ error: 'Workshop not set for user' }, { status: 400 });
      if (!jobWorkshopId) {
        return NextResponse.json(
          { error: 'Global items are read-only for workshop users. Create a workshop copy to edit rates.' },
          { status: 403 }
        );
      }
      if (jobWorkshopId !== viewerWorkshopId) return NextResponse.json({ error: 'Forbidden (different workshop)' }, { status: 403 });
    }

    const upserts = rates
      .map((r: any) => ({
        additional_job_id: additionalJobId,
        fuel_type: normalizeFuelType(r?.fuel_type),
        car_class: String(r?.car_class || '').trim(),
        labour_price: Number(r?.labour_price ?? 0),
        created_by: profile.id,
        updated_at: new Date().toISOString(),
      }))
      .filter((r: any) => r.car_class);

    if (!upserts.length) return NextResponse.json({ error: 'No valid rates provided' }, { status: 400 });
    for (const r of upserts) {
      if (!Number.isFinite(r.labour_price) || r.labour_price < 0) {
        return NextResponse.json({ error: `Invalid labour_price for ${r.fuel_type}/${r.car_class}` }, { status: 400 });
      }
    }

    const { data, error: upErr } = await supabase
      .from('additional_jobs_master_labour_rates')
      .upsert(upserts as any, { onConflict: 'additional_job_id,fuel_type,car_class' })
      .select('id, additional_job_id, fuel_type, car_class, labour_price, created_at, updated_at');

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({ success: true, rates: data || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


