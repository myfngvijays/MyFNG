import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { COUPON_PLATFORM_CHANNELS, DEFAULT_COUPON_TYPES } from '@/lib/coupon-types';
import { buildBookableServices } from '@/lib/coupon-service-options';

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

async function fetchServiceTypes(supabaseAdmin: any) {
  const attempts = [
    () => supabaseAdmin.from('service_types').select('id, name, category_uuid, is_active').eq('is_active', true).order('name').limit(500),
    () => supabaseAdmin.from('service_types').select('id, name, category_uuid').order('name').limit(500),
    () => supabaseAdmin.from('service_types').select('id, name').order('name').limit(500),
  ];

  for (const run of attempts) {
    const { data, error } = await run();
    if (!error && data?.length) return data;
  }
  return [];
}

async function fetchCategories(supabaseAdmin: any) {
  const attempts = [
    () => supabaseAdmin.from('categories').select('uuid, category, status, sequence').eq('status', true).order('sequence').order('category'),
    () => supabaseAdmin.from('categories').select('uuid, category').order('category'),
  ];

  for (const run of attempts) {
    const { data, error } = await run();
    if (!error && data?.length) return data;
  }
  return [];
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const [citiesRes, workshopsRes, categories, serviceTypes, batchesRes, typesRes] = await Promise.all([
      supabaseAdmin.from('cities').select('id, name, state').eq('is_active', true).order('name').limit(200),
      supabaseAdmin.from('workshops').select('id, name, city').order('name').limit(300),
      fetchCategories(supabaseAdmin),
      fetchServiceTypes(supabaseAdmin),
      supabaseAdmin.from('coupon_batches').select('id, campaign_name, code_prefix, code_count, created_at').order('created_at', { ascending: false }).limit(50),
      supabaseAdmin.from('coupon_types').select('slug, label, is_system, display_order').order('display_order').order('label'),
    ]);

    const bookable_services = buildBookableServices(
      (categories || []).map((c: any) => ({ uuid: c.uuid, category: c.category })),
    );

    return NextResponse.json({
      cities: citiesRes.data || [],
      workshops: workshopsRes.data || [],
      service_types: serviceTypes || [],
      categories: categories || [],
      bookable_services,
      batches: batchesRes.data || [],
      coupon_types: typesRes.error ? DEFAULT_COUPON_TYPES : (typesRes.data?.length ? typesRes.data : DEFAULT_COUPON_TYPES),
      channels: COUPON_PLATFORM_CHANNELS,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
