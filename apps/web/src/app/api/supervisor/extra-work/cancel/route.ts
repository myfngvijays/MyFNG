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
    const reason = String(body?.reason || '').trim();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const updater = supabaseAdmin ?? supabase;

    // Load request + lead ownership
    const { data: reqRow, error: reqErr } = await updater
      .from('lead_extra_charges')
      .select('id, lead_id, status, description')
      .eq('id', id)
      .maybeSingle();
    if (reqErr || !reqRow) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
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

    const now = new Date().toISOString();
    const rejection_reason = reason ? `Advisor: ${reason}` : 'Advisor: Cancelled';

    const { error: updErr } = await updater
      .from('lead_extra_charges')
      .update(
        {
          status: 'REJECTED',
          rejection_reason,
          customer_approved: false,
          customer_approved_at: null,
        } as any
      )
      .eq('id', id);

    if (updErr) return NextResponse.json({ error: (updErr as any)?.message || 'Failed to cancel' }, { status: 500 });

    // Best-effort event log
    try {
      await updater.from('lead_events').insert({
        lead_id: reqRow.lead_id,
        event_type: 'ADVISOR_EXTRA_WORK_CANCELLED',
        event_description: `Advisor cancelled additional work: ${String(reqRow.description || '').trim() || 'Item'}`,
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

