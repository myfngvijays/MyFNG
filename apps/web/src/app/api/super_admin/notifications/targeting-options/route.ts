import { NextResponse } from 'next/server';
import { assertPushAdmin } from '@/lib/push/admin-auth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await assertPushAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ cities: [] });

  const [{ data: cities }, { data: plans }, { data: workshops }, { data: brands }, { data: coupons }] = await Promise.all([
    supabaseAdmin.from('cities').select('id, name').eq('is_active', true).order('name'),
    supabaseAdmin.from('membership_plans').select('code, name').eq('active', true).order('name'),
    supabaseAdmin.from('workshops').select('name').order('name'),
    supabaseAdmin.from('service_leads').select('vehicle_make').not('vehicle_make', 'is', null).not('vehicle_make', 'eq', ''),
    supabaseAdmin.from('coupons').select('id, code').order('code'),
  ]);

  const uniqueBrands = [...new Set((brands || []).map((b: any) => String(b.vehicle_make).trim()).filter(Boolean))].sort();

  return NextResponse.json({
    cities: (cities || []).map((c: any) => c.name),
    plans: (plans || []).map((p: any) => ({ code: p.code, name: p.name })),
    service_centers: (workshops || []).map((w: any) => w.name),
    car_brands: uniqueBrands,
    coupons: (coupons || []).map((c: any) => ({ id: c.id, code: c.code })),
  });
}
