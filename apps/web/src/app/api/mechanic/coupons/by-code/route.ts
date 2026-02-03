import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type RoleCode = 'WORKSHOP_ADMIN' | 'WORKSHOP_SUPERVISOR' | 'WORKSHOP_MECHANIC' | 'SUPER_ADMIN';

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
  return (
    roleCode === 'WORKSHOP_ADMIN' ||
    roleCode === 'WORKSHOP_SUPERVISOR' ||
    roleCode === 'WORKSHOP_MECHANIC' ||
    roleCode === 'SUPER_ADMIN'
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { profile, roleCode, error } = await getAuthedProfile(supabase);
    if (error === 'Unauthorized') return NextResponse.json({ error }, { status: 401 });
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    if (!isRoleAllowed(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = new URL(request.url);
    const code = (url.searchParams.get('code') || '').trim().toUpperCase();
    if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 });

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

    const reader = supabaseAdmin ?? supabase;
    const { data, error: qErr } = await reader
      .from('coupons')
      .select('code, coupon_kind, target_custom_label, description')
      .eq('code', code)
      .maybeSingle();

    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });

    return NextResponse.json(
      {
        coupon: {
          code: (data as any).code,
          coupon_kind: (data as any).coupon_kind,
          target_custom_label: (data as any).target_custom_label ?? null,
          description: (data as any).description ?? null,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message || String(e) }, { status: 500 });
  }
}

