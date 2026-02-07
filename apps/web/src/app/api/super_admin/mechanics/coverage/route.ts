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

function asServiceAreas(value: any): Array<{ pincode?: string | null; state?: string | null; area?: string | null }> {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (v == null) return null;
        if (typeof v === 'string' || typeof v === 'number') {
          return { pincode: normalizePincode6(v), state: null, area: null };
        }
        if (typeof v === 'object') {
          return {
            pincode: normalizePincode6((v as any).pincode),
            state: (v as any).state != null ? String((v as any).state).trim() : null,
            area: (v as any).area != null ? String((v as any).area).trim() : null,
          };
        }
        return null;
      })
      .filter(Boolean) as any[];
  }
  // fallback string: comma/newline list
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw
    .split(/[,\n]/g)
    .map((s) => normalizePincode6(s))
    .filter(Boolean)
    .map((pincode) => ({ pincode, state: null, area: null }));
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
    const includeInactive = searchParams.get('include_inactive') === '1';

    // Counts (master vs active) so UI matches KPI card.
    const [{ count: totalAll }, { count: totalActive }] = await Promise.all([
      db.from('company_mechanic_rsa').select('id', { count: 'exact', head: true }),
      db.from('company_mechanic_rsa').select('id', { count: 'exact', head: true }).eq('active', true),
    ]);

    const query = db.from('company_mechanic_rsa').select('id, active, service_areas');
    const res = includeInactive ? await query : await query.eq('active', true);
    if (res.error) return NextResponse.json({ error: 'Failed to load mechanics' }, { status: 500 });

    const payload = await buildCoverage(res.data || []);
    return NextResponse.json({
      ...payload,
      kpis: {
        ...payload.kpis,
        total_mechanics_all: typeof totalAll === 'number' ? totalAll : payload.kpis.total_mechanics,
        total_mechanics_active: typeof totalActive === 'number' ? totalActive : payload.kpis.total_mechanics,
        // Clarify what breakdown is based on
        breakdown_scope: includeInactive ? 'all' : 'active',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

async function buildCoverage(mechanics: any[]) {
  const rows = Array.isArray(mechanics) ? mechanics : [];
  const allPincodes = new Set<string>();

  const mechanicAreas = rows.map((m) => {
    const areas = asServiceAreas(m?.service_areas);
    const pincodes = Array.from(
      new Set(
        areas
          .map((a) => normalizePincode6(a?.pincode))
          .filter(Boolean)
      )
    );
    for (const p of pincodes) allPincodes.add(p);
    return { id: String(m?.id || ''), active: m?.active !== false, pincodes };
  });

  // Resolve pincode -> district/state
  const pincodeMap = new Map<string, { district: string; state: string }>();
  if (allPincodes.size) {
    // NOTE: pincode_city_state can be large; query only used pincodes.
    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin as any;
    const { data: pinRows } = await db
      .from('pincode_city_state')
      .select('pincode, district, state')
      .in('pincode', Array.from(allPincodes));
    for (const r of pinRows || []) {
      const p = normalizePincode6(r?.pincode);
      if (!p) continue;
      const district = normalizeKey(r?.district, 'Unknown');
      const state = normalizeKey(r?.state, 'Unknown');
      pincodeMap.set(p, { district, state });
    }
  }

  // Normalize names to avoid duplicates like "DELHI" vs "Delhi"
  const stateToMechanics = new Map<string, { name: string; set: Set<string> }>();
  const districtToMechanics = new Map<string, { district: string; state: string; set: Set<string> }>();

  const norm = (v: any) => String(v || '').trim().toLowerCase();

  for (const m of mechanicAreas) {
    if (!m.id) continue;
    const stateSet = new Set<string>();
    const districtSet = new Set<string>();

    for (const p of m.pincodes) {
      const loc = pincodeMap.get(p);
      if (loc?.state) stateSet.add(loc.state);
      if (loc?.district) districtSet.add(`${loc.district}||${loc.state || 'Unknown'}`);
    }

    for (const s of stateSet) {
      const key = norm(s) || 'unknown';
      const entry = stateToMechanics.get(key) || { name: s, set: new Set<string>() };
      entry.set.add(m.id);
      // Keep first "nice" casing as display
      stateToMechanics.set(key, entry);
    }
    for (const d of districtSet) {
      const [district, state] = String(d).split('||');
      const dKey = norm(district) || 'unknown';
      const sKey = norm(state) || 'unknown';
      const key = `${dKey}||${sKey}`;
      const entry = districtToMechanics.get(key) || { district, state: state || 'Unknown', set: new Set<string>() };
      entry.set.add(m.id);
      districtToMechanics.set(key, entry);
    }
  }

  const byState = Array.from(stateToMechanics.values())
    .map((e) => ({ state: e.name, mechanics: e.set.size }))
    .sort((a, b) => b.mechanics - a.mechanics);

  const byDistrict = Array.from(districtToMechanics.values())
    .map((e) => ({ district: e.district, state: e.state, mechanics: e.set.size }))
    .sort((a, b) => b.mechanics - a.mechanics);

  const totalMechanics = rows.length;
  const withCoverage = mechanicAreas.filter((m) => m.pincodes.length > 0).length;
  const uniqueServicePincodes = allPincodes.size;

  return {
    kpis: {
      total_mechanics: totalMechanics,
      mechanics_with_coverage: withCoverage,
      service_pincodes: uniqueServicePincodes,
    },
    breakdowns: {
      state: byState,
      district: byDistrict,
    },
  };
}

