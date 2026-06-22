import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { DEFAULT_COUPON_TYPES, slugifyCouponType } from '@/lib/coupon-types';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const { data, error } = await supabaseAdmin
      .from('coupon_types')
      .select('slug, label, is_system, display_order')
      .order('display_order', { ascending: true })
      .order('label', { ascending: true });

    if (error) {
      return NextResponse.json({ types: DEFAULT_COUPON_TYPES });
    }

    return NextResponse.json({ types: data?.length ? data : DEFAULT_COUPON_TYPES });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const label = String(body?.label || '').trim();
    if (!label) {
      return NextResponse.json({ error: 'Type label is required' }, { status: 400 });
    }

    let slug = slugifyCouponType(body?.slug || label);
    const { data: existing } = await supabaseAdmin.from('coupon_types').select('slug').eq('slug', slug).maybeSingle();
    if (existing) slug = `${slug}_${Date.now().toString(36)}`;

    const { data: maxOrderRow } = await supabaseAdmin
      .from('coupon_types')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabaseAdmin
      .from('coupon_types')
      .insert({
        slug,
        label,
        is_system: false,
        display_order: Number(maxOrderRow?.display_order || 0) + 1,
      })
      .select('slug, label, is_system, display_order')
      .single();

    if (error) throw error;
    return NextResponse.json({ type: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
