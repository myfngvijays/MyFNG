import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RoleCode = 'SUPER_ADMIN';
type ApplyMode = 'OVERWRITE' | 'FILL_MISSING';
type FuelType = 'PETROL' | 'DIESEL' | 'CNG';

async function getAuthedProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { profile: null as any, roleCode: null as string | null, error: 'Unauthorized' as const };

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
  return { profile, roleCode, error: profile ? null : ('User profile not found' as const) };
}

function isRoleAllowed(roleCode: string | null): roleCode is RoleCode {
  return roleCode === 'SUPER_ADMIN';
}

function normalizeFuelType(v: any): FuelType {
  const s = String(v || '').trim().toUpperCase();
  if (s === 'DIESEL') return 'DIESEL';
  if (s === 'CNG') return 'CNG';
  return 'PETROL';
}

function normalizeName(s: any) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { profile, roleCode, error } = await getAuthedProfile(supabase);
    if (error === 'Unauthorized') return NextResponse.json({ error }, { status: 401 });
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    if (!isRoleAllowed(roleCode)) return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const zoneId = String(body?.zone_id || '').trim();
    const carClass = String(body?.car_class || '').trim();
    const modeRaw = String(body?.mode || 'OVERWRITE').trim().toUpperCase();
    const mode: ApplyMode = modeRaw === 'FILL_MISSING' ? 'FILL_MISSING' : 'OVERWRITE';
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!zoneId) return NextResponse.json({ error: 'zone_id is required' }, { status: 400 });
    if (!carClass) return NextResponse.json({ error: 'car_class is required' }, { status: 400 });
    if (!items.length) return NextResponse.json({ error: 'items is required' }, { status: 400 });

    // Fast path: use DB-side RPC (set-based apply)
    const { data, error: rpcErr } = await supabase.rpc('apply_ajm_labour_zone_bulk', {
      p_zone_id: zoneId,
      p_car_class: carClass,
      p_mode: mode,
      p_items: items,
    } as any);

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, result: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message || String(e) }, { status: 500 });
  }
}


