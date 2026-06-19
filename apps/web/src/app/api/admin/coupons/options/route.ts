import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

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

    const [citiesRes, workshopsRes, servicesRes, batchesRes] = await Promise.all([
      supabaseAdmin.from('cities').select('id, name, state').eq('is_active', true).order('name').limit(200),
      supabaseAdmin.from('workshops').select('id, name, city').order('name').limit(300),
      supabaseAdmin.from('service_types').select('id, name, category').order('name').limit(200),
      supabaseAdmin.from('coupon_batches').select('id, campaign_name, code_prefix, code_count, created_at').order('created_at', { ascending: false }).limit(50),
    ]);

    return NextResponse.json({
      cities: citiesRes.data || [],
      workshops: workshopsRes.data || [],
      service_types: servicesRes.data || [],
      batches: batchesRes.data || [],
      channels: [
        { id: 'ALL', label: 'All Platforms' },
        { id: 'WEB', label: 'Website' },
        { id: 'MOBILE', label: 'Mobile App (Android + iOS)' },
        { id: 'MEMBERSHIP', label: 'Membership Checkout' },
        { id: 'TELECALLER', label: 'Telecaller Panel' },
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
