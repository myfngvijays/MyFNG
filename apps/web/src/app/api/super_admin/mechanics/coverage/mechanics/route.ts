import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertSuperAdmin(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized', user: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed', user };
  }
  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin', user };
  }
  return { ok: true, status: 200, error: null, user };
}

function normalizePincode6(value: any) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 6);
  return digits.length === 6 ? digits : '';
}

function normalizeKey(value: any, fallback: string) {
  const raw = String(value || '').trim();
  return raw ? raw : fallback;
}

function asServiceAreas(value: any): Array<{ pincode?: string | null }> {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (v == null) return null;
        if (typeof v === 'string' || typeof v === 'number') return { pincode: normalizePincode6(v) };
        if (typeof v === 'object') return { pincode: normalizePincode6((v as any).pincode) };
        return null;
      })
      .filter(Boolean) as any[];
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw
    .split(/[,\n]/g)
    .map((s) => normalizePincode6(s))
    .filter(Boolean)
    .map((pincode) => ({ pincode }));
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const { searchParams } = new URL(request.url);
    const state = normalizeKey(searchParams.get('state'), '');
    const district = normalizeKey(searchParams.get('district'), '');
    const includeInactive = searchParams.get('include_inactive') === '1';

    if (!state) return NextResponse.json({ error: 'state is required' }, { status: 400 });

    const mechQuery = db
      .from('company_mechanic_rsa')
      .select('id, code, mechanic_name, number, active, service_areas');
    const mechRes = includeInactive ? await mechQuery : await mechQuery.eq('active', true);
    if (mechRes.error) return NextResponse.json({ error: 'Failed to load mechanics' }, { status: 500 });

    const mechanics = Array.isArray(mechRes.data) ? mechRes.data : [];
    const allPincodes = new Set<string>();
    const mechPins = mechanics.map((m: any) => {
      const pins = Array.from(
        new Set(asServiceAreas(m?.service_areas).map((a) => normalizePincode6(a?.pincode)).filter(Boolean))
      );
      for (const p of pins) allPincodes.add(p);
      return { ...m, pins };
    });

    const pincodeMap = new Map<string, { district: string; state: string }>();
    if (allPincodes.size) {
      const { data: pinRows } = await db
        .from('pincode_city_state')
        .select('pincode, district, state')
        .in('pincode', Array.from(allPincodes));
      for (const r of pinRows || []) {
        const p = normalizePincode6(r?.pincode);
        if (!p) continue;
        pincodeMap.set(p, {
          district: normalizeKey(r?.district, 'Unknown'),
          state: normalizeKey(r?.state, 'Unknown'),
        });
      }
    }

    const norm = (v: any) => String(v || '').trim().toLowerCase();
    const targetState = norm(state);
    const targetDistrict = district ? norm(district) : '';

    const filtered = mechPins
      .map((m: any) => {
        const hitPins: string[] = [];
        for (const p of m.pins || []) {
          const loc = pincodeMap.get(p);
          if (!loc) continue;
          if (norm(loc.state) !== targetState) continue;
          if (targetDistrict && norm(loc.district) !== targetDistrict) continue;
          hitPins.push(p);
        }
        if (hitPins.length === 0) return null;
        return {
          id: String(m.id),
          code: m.code || null,
          mechanic_name: m.mechanic_name || null,
          number: m.number || null,
          active: m.active !== false,
          matched_pincodes: hitPins.slice(0, 12),
          matched_pincode_count: hitPins.length,
        };
      })
      .filter(Boolean) as any[];

    filtered.sort((a: any, b: any) => (b.matched_pincode_count || 0) - (a.matched_pincode_count || 0));

    return NextResponse.json({
      filter: { state, district: district || null },
      total: filtered.length,
      mechanics: filtered,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

