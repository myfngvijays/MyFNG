import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RoleCode = 'WORKSHOP_ADMIN' | 'WORKSHOP_SUPERVISOR' | 'SUPER_ADMIN';

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
  return roleCode === 'WORKSHOP_ADMIN' || roleCode === 'WORKSHOP_SUPERVISOR' || roleCode === 'SUPER_ADMIN';
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { profile, roleCode, error } = await getAuthedProfile(supabase);
    if (error === 'Unauthorized') return NextResponse.json({ error }, { status: 401 });
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    if (!isRoleAllowed(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const leadId = params.id;
    const body = await request.json().catch(() => ({}));
    const enabled = Boolean(body?.enabled);

    const { data: lead, error: leadErr } = await supabase
      .from('service_leads')
      .select('id, workshop_id')
      .eq('id', leadId)
      .maybeSingle();
    if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    if (roleCode !== 'SUPER_ADMIN') {
      if (!profile.workshop_id) return NextResponse.json({ error: 'User has no workshop' }, { status: 400 });
      if (String(lead.workshop_id || '') !== String(profile.workshop_id || '')) {
        return NextResponse.json({ error: 'Lead not in your workshop' }, { status: 403 });
      }
    }

    const now = new Date().toISOString();
    const payload: any = enabled
      ? { customer_public_enabled: true, customer_public_enabled_at: now, customer_public_enabled_by: profile.id }
      : { customer_public_enabled: false, customer_public_enabled_at: null, customer_public_enabled_by: null };

    const { error: updErr } = await supabase.from('service_leads').update(payload).eq('id', leadId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ success: true, enabled }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message || String(e) }, { status: 500 });
  }
}


