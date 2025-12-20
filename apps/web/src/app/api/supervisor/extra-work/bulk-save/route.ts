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
    const lead_id = String(body?.lead_id || '').trim();
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!lead_id) return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
    if (!items.length) return NextResponse.json({ error: 'items is required' }, { status: 400 });

    const updates = items
      .map((it: any) => ({
        id: String(it?.id || '').trim(),
        oem_price: it?.oem_price === '' || it?.oem_price === null || it?.oem_price === undefined ? NaN : Number(it.oem_price),
        oes_price: it?.oes_price === '' || it?.oes_price === null || it?.oes_price === undefined ? NaN : Number(it.oes_price),
        labour_price: it?.labour_price === '' || it?.labour_price === null || it?.labour_price === undefined ? NaN : Number(it.labour_price),
        part_price_type: String(it?.part_price_type || 'OEM').toUpperCase(),
      }))
      .filter((it: any) => it.id);

    if (!updates.length) return NextResponse.json({ error: 'No valid items provided' }, { status: 400 });
    for (const u of updates) {
      if (!Number.isFinite(u.oem_price) || u.oem_price < 0) {
        return NextResponse.json({ error: `Invalid OEM price for item ${u.id}` }, { status: 400 });
      }
      if (!Number.isFinite(u.oes_price) || u.oes_price < 0) {
        return NextResponse.json({ error: `Invalid OES price for item ${u.id}` }, { status: 400 });
      }
      if (!Number.isFinite(u.labour_price) || u.labour_price < 0) {
        return NextResponse.json({ error: `Invalid labour price for item ${u.id}` }, { status: 400 });
      }
      if (u.part_price_type !== 'OEM' && u.part_price_type !== 'OES') {
        return NextResponse.json({ error: `Invalid part_price_type for item ${u.id}` }, { status: 400 });
      }
    }

    // Validate ownership: lead must be from this workshop
    const { data: lead, error: leadErr } = await (supabaseAdmin ?? supabase)
      .from('service_leads')
      .select('id, workshop_id')
      .eq('id', lead_id)
      .maybeSingle();

    if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (lead.workshop_id !== profile.workshop_id) {
      return NextResponse.json({ error: 'Forbidden (different workshop)' }, { status: 403 });
    }

    const updater = supabaseAdmin ?? supabase;

    // Update each pending request amount (no status change)
    const results = await Promise.all(
      updates.map(async (u: any) => {
        const { data: existing, error: exErr } = await updater
          .from('lead_extra_charges')
          .select('id, lead_id, status')
          .eq('id', u.id)
          .maybeSingle();
        if (exErr || !existing) return { id: u.id, ok: false, error: 'Request not found' };
        if (existing.lead_id !== lead_id) return { id: u.id, ok: false, error: 'Request does not belong to lead' };
        if (existing.status !== 'PENDING') return { id: u.id, ok: false, error: `Not pending (${existing.status})` };

        const total = (u.part_price_type === 'OES' ? u.oes_price : u.oem_price) + u.labour_price;

        const { error: updErr } = await updater
          .from('lead_extra_charges')
          .update(
            {
              oem_price: u.oem_price,
              oes_price: u.oes_price,
              labour_price: u.labour_price,
              part_price_type: u.part_price_type,
              // Keep legacy total in sync
              amount: total,
            } as any
          )
          .eq('id', u.id);

        return updErr ? { id: u.id, ok: false, error: (updErr as any)?.message || 'Update failed' } : { id: u.id, ok: true };
      })
    );

    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      return NextResponse.json(
        { error: 'Some items failed to save', failed, success_count: results.length - failed.length },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, updated_count: results.length }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message || String(e) }, { status: 500 });
  }
}


