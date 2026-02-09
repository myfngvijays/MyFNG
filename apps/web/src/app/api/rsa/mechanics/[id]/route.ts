import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
  if (Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number')) {
    const out = (value as any[])
      .map((v) => normalizePincode6(v))
      .filter(Boolean)
      .map((pincode) => ({ area: null, state: null, pincode }));
    return out.length ? out : null;
  }
  if (Array.isArray(value) && value.every((v) => v && typeof v === 'object')) {
    const out = (value as any[])
      .map((v) => {
        const pincode = normalizePincode6(v?.pincode);
        if (!pincode) return null;
        return {
          area: v?.area != null ? String(v.area).trim() : null,
          state: v?.state != null ? String(v.state).trim() : null,
          pincode,
        };
      })
      .filter(Boolean);
    return out.length ? out : null;
  }
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parts = raw.split(/[,\n]/g).map((s) => s.trim()).filter(Boolean);
  const unique = Array.from(new Set(parts.map((p) => normalizePincode6(p)).filter(Boolean)));
  return unique.length ? unique.map((pincode) => ({ area: null, state: null, pincode })) : null;
}

/**
 * PATCH /api/rsa/mechanics/[id]
 * Update mechanic (RSA_MANAGER, SUPER_ADMIN, SUB_ADMIN only). Code is not changed.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(supabase as any, user as any);
    const roleCode = String((userProfile?.roles as any)?.role_code || '');
    const allowed = new Set(['RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const mechanicId = String(id || '').trim();
    if (!mechanicId) return NextResponse.json({ error: 'Missing mechanic id' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const mechanic_name = body?.mechanic_name != null ? String(body.mechanic_name).trim() : undefined;
    const number = body?.number != null ? normalizePhone10(String(body.number)) : undefined;
    const alternate_number1 = body?.alternate_number1 != null ? normalizePhone10(String(body.alternate_number1)) || null : undefined;
    const alternate_number2 = body?.alternate_number2 != null ? normalizePhone10(String(body.alternate_number2)) || null : undefined;
    const service_tag = body?.service_tag !== undefined ? String(body.service_tag).trim() || null : undefined;
    const service_tag2 = body?.service_tag2 !== undefined ? String(body.service_tag2).trim() || null : undefined;
    const service_tag3 = body?.service_tag3 !== undefined ? String(body.service_tag3).trim() || null : undefined;
    const timing = body?.timing !== undefined ? String(body.timing).trim() || null : undefined;
    const active = body?.active !== undefined ? (body.active === false ? false : true) : undefined;
    const service_areas = body?.service_areas !== undefined ? normalizeServiceAreasJson(body.service_areas) : undefined;

    if (mechanic_name !== undefined && !mechanic_name) return NextResponse.json({ error: 'mechanic_name cannot be empty' }, { status: 400 });
    if (number !== undefined && (!number || number.length !== 10)) return NextResponse.json({ error: 'Valid 10-digit number is required' }, { status: 400 });

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });

    const db = supabaseAdmin as any;
    const { data: existing, error: fetchErr } = await db
      .from('company_mechanic_rsa')
      .select('id')
      .eq('id', mechanicId)
      .maybeSingle();

    if (fetchErr || !existing?.id) return NextResponse.json({ error: 'Mechanic not found' }, { status: 404 });

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (mechanic_name !== undefined) payload.mechanic_name = mechanic_name;
    if (number !== undefined) payload.number = number;
    if (alternate_number1 !== undefined) payload.alternate_number1 = alternate_number1;
    if (alternate_number2 !== undefined) payload.alternate_number2 = alternate_number2;
    if (service_tag !== undefined) payload.service_tag = service_tag;
    if (service_tag2 !== undefined) payload.service_tag2 = service_tag2;
    if (service_tag3 !== undefined) payload.service_tag3 = service_tag3;
    if (timing !== undefined) payload.timing = timing;
    if (active !== undefined) payload.active = active;
    if (service_areas !== undefined) payload.service_areas = service_areas.slice(0, 20);

    const { data: updated, error: updateErr } = await db
      .from('company_mechanic_rsa')
      .update(payload)
      .eq('id', mechanicId)
      .select()
      .single();

    if (updateErr) return NextResponse.json({ error: 'Failed to update mechanic', details: updateErr.message }, { status: 500 });

    return NextResponse.json({ success: true, mechanic: updated }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
