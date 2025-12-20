import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type RoleCode = 'WORKSHOP_SUPERVISOR';

async function getAuthedProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { profile: null as any, roleCode: null as string | null, error: 'Unauthorized' as const };

  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();
  const selectProfile = 'id, email, phone, workshop_id, role_id, roles!inner(role_code)';

  const { data: userProfileByEmail } = email
    ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null };
  const { data: userProfileByPhone } = !userProfileByEmail && phone
    ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
    : { data: null };
  const { data: userProfileById } = !userProfileByEmail && !userProfileByPhone
    ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
    : { data: null };

  const profile = userProfileByEmail || userProfileByPhone || userProfileById;
  const roleCode = (profile?.roles as any)?.role_code || null;
  return { profile, roleCode, error: profile ? null : ('User profile not found' as const) };
}

function isRoleAllowed(roleCode: string | null): roleCode is RoleCode {
  return roleCode === 'WORKSHOP_SUPERVISOR';
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ADMIN_KEY;
    const supabaseAdmin =
      supabaseUrl && serviceRoleKey
        ? createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;

    const { profile, roleCode, error } = await getAuthedProfile(supabase);
    if (error === 'Unauthorized') return NextResponse.json({ error }, { status: 401 });
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    if (!isRoleAllowed(roleCode)) return NextResponse.json({ error: 'Forbidden: Supervisor only' }, { status: 403 });
    if (!profile.workshop_id) return NextResponse.json({ error: 'Workshop not set for user' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    const partTypeRaw = String(body?.part_price_type || 'OEM').toUpperCase().trim();
    const part_price_type = partTypeRaw === 'OES' ? 'OES' : 'OEM';
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const updater = supabaseAdmin ?? supabase;

    // Load request + lead ownership; schema tolerant (oem/oes/labour may not exist)
    let reqRow: any = null;
    try {
      const { data, error: reqErr } = await updater
        .from('lead_extra_charges')
        .select('id, lead_id, status, description, amount, oem_price, oes_price, labour_price')
        .eq('id', id)
        .maybeSingle();
      if (reqErr) throw reqErr;
      reqRow = data;
    } catch (e: any) {
      if (e?.code === '42703' || /does not exist/i.test(String(e?.message || ''))) {
        const { data } = await updater
          .from('lead_extra_charges')
          .select('id, lead_id, status, description, amount')
          .eq('id', id)
          .maybeSingle();
        reqRow = data;
      } else {
        throw e;
      }
    }

    if (!reqRow) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (String(reqRow.status || '').toUpperCase() !== 'PENDING') {
      return NextResponse.json({ error: `Not pending (${reqRow.status})` }, { status: 400 });
    }

    const { data: lead, error: leadErr } = await updater
      .from('service_leads')
      .select('id, workshop_id')
      .eq('id', reqRow.lead_id)
      .maybeSingle();
    if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (lead.workshop_id !== profile.workshop_id) {
      return NextResponse.json({ error: 'Forbidden (different workshop)' }, { status: 403 });
    }

    const oem = Number(reqRow?.oem_price ?? 0);
    const oes = Number(reqRow?.oes_price ?? 0);
    const labour = Number(reqRow?.labour_price ?? 0);
    const legacyAmount = Number(reqRow?.amount ?? 0);
    const computedTotal =
      Number.isFinite(oem) || Number.isFinite(oes) || Number.isFinite(labour)
        ? (part_price_type === 'OES' ? (Number.isFinite(oes) ? oes : 0) : (Number.isFinite(oem) ? oem : 0)) +
          (Number.isFinite(labour) ? labour : 0)
        : (Number.isFinite(legacyAmount) ? legacyAmount : 0);

    const now = new Date().toISOString();

    // Update request as approved by advisor (customer_approved_at stays NULL)
    const payload: any = {
      status: 'APPROVED',
      part_price_type,
      amount: computedTotal,
      customer_approved: false,
      customer_approved_at: null,
      rejection_reason: null,
    };

    let updErr: any = null;
    const upd1 = await updater.from('lead_extra_charges').update(payload).eq('id', id);
    updErr = upd1.error;

    if (updErr && (updErr as any)?.code === '42703') {
      // Legacy fallback: update only core fields
      const upd2 = await updater.from('lead_extra_charges').update({ status: 'APPROVED', amount: computedTotal } as any).eq('id', id);
      if (upd2.error) return NextResponse.json({ error: (upd2.error as any)?.message || 'Failed to approve' }, { status: 500 });
    } else if (updErr) {
      return NextResponse.json({ error: (updErr as any)?.message || 'Failed to approve' }, { status: 500 });
    }

    // Best-effort event log
    try {
      await updater.from('lead_events').insert({
        lead_id: reqRow.lead_id,
        event_type: 'ADVISOR_EXTRA_WORK_APPROVED',
        event_description: `Advisor approved additional work (${part_price_type}): ${String(reqRow.description || '').trim() || 'Item'}`,
        created_at: now,
      } as any);
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message || String(e) }, { status: 500 });
  }
}

