import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ coupons: [], error: adminError });

  const { data, error } = await supabaseAdmin
    .from('coupons')
    .select('id,code,coupon_kind,discount_mode,discount_value,min_order_value,description,start_at,end_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ coupons: [] });
  return NextResponse.json({ coupons: data || [] });
}
