import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function normalizePhone10(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length <= 10 ? digits : digits.slice(-10);
}

function normalizePincode6(value: any) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 6);
  return digits.length === 6 ? digits : '';
}

function normalizeServiceAreasJson(value: any): any[] | null {
  if (!value) return null;

  // Array of strings => treat as pincodes
  if (Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number')) {
    const out = (value as any[])
      .map((v) => normalizePincode6(v))
      .filter(Boolean)
      .map((pincode) => ({ area: null, state: null, pincode }));
    return out.length ? out : null;
  }

  // Array of objects (from UI/import) => keep area/state + normalize pincode
  if (Array.isArray(value) && value.every((v) => v && typeof v === 'object')) {
    const out = (value as any[])
      .map((v) => {
        const pincode = normalizePincode6(v?.pincode);
        if (!pincode) return null;
        return {
          area: v?.area != null ? String(v.area).trim() : null,
          state: v?.state != null ? String(v.state).trim() : null,
          pincode,
          // keep any extra fields if present
          ...(v?.region != null ? { region: v.region } : {}),
          ...(v?.is_primary != null ? { is_primary: v.is_primary } : {}),
          ...(v?.service_radius_km != null ? { service_radius_km: v.service_radius_km } : {}),
        };
      })
      .filter(Boolean);
    return out.length ? out : null;
  }

  // String input (comma/newline) => treat as pincodes list
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parts = raw
    .split(/[,\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(parts.map((p) => normalizePincode6(p)).filter(Boolean)));
  return unique.length ? unique.map((pincode) => ({ area: null, state: null, pincode })) : null;
}

async function generateMechanicCode(supabaseAdmin: any) {
  const { count } = await supabaseAdmin
    .from('company_mechanic_rsa')
    .select('id', { count: 'exact', head: true });
  const n = (typeof count === 'number' && isFinite(count) ? count : 0) + 1;
  return `RS_MECH_${String(n).padStart(3, '0')}`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(supabase as any, user as any);
    const roleCode = String((userProfile?.roles as any)?.role_code || '');
    const allowed = new Set(['RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    // Back-compat: accept mechanic_code OR code
    let code = String(body?.code || body?.mechanic_code || '').trim();
    const mechanic_name = String(body?.mechanic_name || '').trim();
    const number = normalizePhone10(String(body?.number || '').trim());

    if (!mechanic_name) return NextResponse.json({ error: 'mechanic_name is required' }, { status: 400 });
    if (!number || number.length !== 10) return NextResponse.json({ error: 'Valid 10-digit number is required' }, { status: 400 });

    const alternate_number1 = normalizePhone10(String(body?.alternate_number1 || '').trim()) || null;
    const alternate_number2 = normalizePhone10(String(body?.alternate_number2 || '').trim()) || null;

    const service_tag = String(body?.service_tag || '').trim() || null;
    const service_tag2 = String(body?.service_tag2 || '').trim() || null;
    const service_tag3 = String(body?.service_tag3 || '').trim() || null;
    const timing = String(body?.timing || '').trim() || null;
    const active = body?.active === false ? false : true;
    const service_areas = normalizeServiceAreasJson(body?.service_areas);

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });

    if (!code) {
      code = await generateMechanicCode(supabaseAdmin as any);
    }

    const now = new Date().toISOString();
    const payload: any = {
      code,
      mechanic_name,
      number,
      alternate_number1,
      alternate_number2,
      service_tag,
      service_tag2,
      service_tag3,
      timing,
      active,
      // JSONB array of objects (2nd-account compatible)
      ...(service_areas ? { service_areas: service_areas.slice(0, 20) } : {}),
      is_available: true,
      updated_at: now,
    };

    const insertOnce = async (candidateCode: string) => {
      const { data: created, error } = await (supabaseAdmin as any)
        .from('company_mechanic_rsa')
        .insert({ ...payload, code: candidateCode })
        .select('*')
        .single();
      return { created, error };
    };

    // Best-effort uniqueness if auto-generated code collides.
    let lastError: any = null;
    const attempts = code && String(body?.code || body?.mechanic_code || '').trim() ? 1 : 3;
    let created: any = null;
    for (let i = 0; i < attempts; i++) {
      const candidate =
        i === 0
          ? code
          : `RS_MECH_${Date.now().toString().slice(-6)}_${Math.floor(Math.random() * 1000)
              .toString()
              .padStart(3, '0')}`;
      const res = await insertOnce(candidate);
      if (!res.error) {
        created = res.created;
        code = candidate;
        lastError = null;
        break;
      }
      lastError = res.error;
      const msg = String(res.error?.message || '').toLowerCase();
      const isDup =
        msg.includes('duplicate') ||
        msg.includes('unique constraint') ||
        msg.includes('already exists');
      if (!isDup) break;
    }

    if (lastError) {
      return NextResponse.json({ error: 'Failed to create mechanic', details: lastError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, mechanic: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

