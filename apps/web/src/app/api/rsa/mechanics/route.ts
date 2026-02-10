import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

/** Normalize service_areas so it's always an array of objects (parse if string from DB) */
function normalizeServiceAreasForResponse(value: any): any[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * GET /api/rsa/mechanics
 * Search/list mechanics (RSA_MANAGER, SUPER_ADMIN, SUB_ADMIN). Uses table directly so it works even if RPC fails.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(supabase as any, user as any);
    const roleCode = String((userProfile?.roles as any)?.role_code || '');
    const allowed = new Set(['RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration: SUPABASE_SERVICE_ROLE_KEY required for mechanics list', details: adminError ?? '' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const pincodeParamRaw = searchParams.get('pincode')?.trim() || '';
    const qTrim = q.trim();
    const qIsPincode = /^\d{6}$/.test(qTrim);
    const pincodeRaw = pincodeParamRaw || (qIsPincode ? qTrim : '');
    const pincode = pincodeRaw ? normalizePincode6(pincodeRaw) : '';
    const serviceTag = searchParams.get('serviceTag')?.trim() || undefined;
    const searchTerm = (searchParams.get('searchTerm')?.trim() || '') || q;

    const db = supabaseAdmin as any;

    async function fetchActiveMechanicsPages(): Promise<any[]> {
      const pageSize = 1000;
      const out: any[] = [];
      for (let page = 0; page < 25; page++) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await db
          .from('company_mechanic_rsa')
          .select('id, code, mechanic_name, number, alternate_number1, alternate_number2, service_tag, service_tag2, service_tag3, timing, active, service_areas, is_available, rating, total_jobs_completed')
          .eq('active', true)
          .order('mechanic_name')
          .range(from, to);
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        out.push(...rows);
        if (rows.length < pageSize) break;
      }
      return out;
    }

    // If pincode filter is explicitly provided (or q is a 6-digit pincode) but invalid, return no results.
    if ((pincodeParamRaw || qIsPincode) && pincodeRaw && !pincode) {
      return NextResponse.json([], { status: 200 });
    }

    // Always page through rows to avoid PostgREST 1000-row cap and json/jsonb operator mismatches.
    let rows: any[] = [];
    try {
      rows = await fetchActiveMechanicsPages();
    } catch (e: any) {
      console.error('GET /api/rsa/mechanics query error:', e?.message || e);
      return NextResponse.json(
        { error: 'Failed to fetch mechanics', details: e?.message || 'Failed to fetch mechanics' },
        { status: 500 }
      );
    }

    let mechanics = (rows || []).map((m: any) => ({
      ...m,
      code: m.code ?? m.mechanic_code,
      service_areas: normalizeServiceAreasForResponse(m.service_areas),
    }));

    // Strict pincode match (after response normalization) to ensure we don't show mismatches.
    if (pincode) {
      mechanics = mechanics.filter((m: any) => {
        const areas = normalizeServiceAreasForResponse(m.service_areas);
        if (areas.length === 0) return false;
        return areas.some((a: any) => normalizePincode6(a?.pincode) === pincode);
      });
    }

    if (searchTerm) {
      const term = String(searchTerm).toLowerCase().trim();
      if (term) {
        mechanics = mechanics.filter((m: any) => {
          const areas = normalizeServiceAreasForResponse(m.service_areas);
          const areaText = areas
            .map((a: any) => {
              if (a == null) return '';
              if (typeof a === 'string' || typeof a === 'number') return String(a);
              return [a?.area, a?.pincode, a?.state].filter(Boolean).join(' ');
            })
            .join(' ')
            .toLowerCase();

          return (
            (m.mechanic_name && String(m.mechanic_name).toLowerCase().includes(term)) ||
            (m.code && String(m.code).toLowerCase().includes(term)) ||
            (m.number && String(m.number).includes(term)) ||
            (m.alternate_number1 && String(m.alternate_number1).includes(term)) ||
            (m.alternate_number2 && String(m.alternate_number2).includes(term)) ||
            (m.service_tag && String(m.service_tag).toLowerCase().includes(term)) ||
            (m.service_tag2 && String(m.service_tag2).toLowerCase().includes(term)) ||
            (m.service_tag3 && String(m.service_tag3).toLowerCase().includes(term)) ||
            (areaText && areaText.includes(term))
          );
        });
      }
    }

    if (serviceTag) {
      const tag = String(serviceTag).toLowerCase();
      mechanics = mechanics.filter(
        (m: any) =>
          (m.service_tag && String(m.service_tag).toLowerCase() === tag) ||
          (m.service_tag2 && String(m.service_tag2).toLowerCase() === tag) ||
          (m.service_tag3 && String(m.service_tag3).toLowerCase() === tag)
      );
    }

    // Attach completed RSA cases count per mechanic (based on rsa_leads)
    try {
      const ids = mechanics.map((m: any) => m?.id).filter(Boolean);
      if (ids.length > 0) {
        const { data: completed, error: completedErr } = await db
          .from('rsa_leads')
          .select('assigned_mechanic_id')
          .in('assigned_mechanic_id', ids)
          .eq('lead_status', 'completed');

        if (completedErr) {
          console.warn('Failed to compute completed cases:', completedErr.message);
        } else {
          const counts = new Map<string, number>();
          for (const row of completed || []) {
            const mid = String((row as any)?.assigned_mechanic_id || '');
            if (!mid) continue;
            counts.set(mid, (counts.get(mid) || 0) + 1);
          }
          mechanics = mechanics.map((m: any) => ({
            ...m,
            completed_cases: counts.get(String(m.id)) || 0,
          }));
        }
      }
    } catch (e: any) {
      console.warn('Completed cases aggregation error:', e?.message || e);
    }

    // Derive availability: Busy if any ongoing case exists, else Available
    try {
      const ids = mechanics.map((m: any) => m?.id).filter(Boolean);
      if (ids.length > 0) {
        const { data: ongoing, error: ongoingErr } = await db
          .from('rsa_leads')
          .select('assigned_mechanic_id, lead_status, mechanic_completed_datetime, mechanic_cancelled_datetime')
          .in('assigned_mechanic_id', ids)
          .is('mechanic_completed_datetime', null)
          .is('mechanic_cancelled_datetime', null)
          .not('lead_status', 'in', '(completed,cancelled)');

        if (ongoingErr) {
          console.warn('Failed to compute ongoing cases:', ongoingErr.message);
        } else {
          const ongoingCounts = new Map<string, number>();
          for (const row of ongoing || []) {
            const mid = String((row as any)?.assigned_mechanic_id || '');
            if (!mid) continue;
            ongoingCounts.set(mid, (ongoingCounts.get(mid) || 0) + 1);
          }
          mechanics = mechanics.map((m: any) => {
            const oc = ongoingCounts.get(String(m.id)) || 0;
            return {
              ...m,
              ongoing_cases: oc,
              // override UI availability to match ongoing cases
              is_available: oc === 0,
            };
          });
        }
      }
    } catch (e: any) {
      console.warn('Ongoing cases aggregation error:', e?.message || e);
    }

    return NextResponse.json(mechanics, { status: 200 });
  } catch (e: any) {
    console.error('GET /api/rsa/mechanics error:', e?.message ?? e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
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

