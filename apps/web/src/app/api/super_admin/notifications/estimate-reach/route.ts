import { NextRequest, NextResponse } from 'next/server';
import { assertPushAdmin } from '@/lib/push/admin-auth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { MOBILE_PUSH_PLATFORM } from '@/lib/push/constants';
import {
  hasAdvancedTargeting,
  resolveTargetCustomerIds,
  type CustomerTargetFilters,
} from '@/lib/push/customerTargeting';

export const dynamic = 'force-dynamic';

function splitCsv(value: string | null): string[] {
  return String(value || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  const auth = await assertPushAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ count: 0 });

  const sp = req.nextUrl.searchParams;
  const filters: CustomerTargetFilters = {
    targetCities: splitCsv(sp.get('cities')),
    targetMembership: sp.get('membership') || '',
    targetMembershipPlans: splitCsv(sp.get('plans')),
    targetServiceCenters: splitCsv(sp.get('service_centers')),
    targetCarBrands: splitCsv(sp.get('car_brands')),
    targetCustomerType: sp.get('customer_type') || '',
    targetCouponUsers: sp.get('coupon_users') || '',
    targetCouponCodes: splitCsv(sp.get('coupon_codes')),
    targetWallet: sp.get('wallet') || '',
    targetBooking: sp.get('booking') || '',
    targetPhoneList: splitCsv(sp.get('phones')),
  };

  if (!hasAdvancedTargeting(filters)) {
    const { count } = await supabaseAdmin
      .from('notification_devices')
      .select('id', { count: 'exact', head: true })
      .eq('platform', MOBILE_PUSH_PLATFORM)
      .eq('is_active', true)
      .not('customer_id', 'is', null);
    return NextResponse.json({ count: count || 0 });
  }

  const customerIds = await resolveTargetCustomerIds(supabaseAdmin, filters);
  if (!customerIds || customerIds.size === 0) {
    return NextResponse.json({ count: 0 });
  }

  const ids = [...customerIds];
  let total = 0;
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { count } = await supabaseAdmin
      .from('notification_devices')
      .select('id', { count: 'exact', head: true })
      .eq('platform', MOBILE_PUSH_PLATFORM)
      .eq('is_active', true)
      .in('customer_id', chunk);
    total += count || 0;
  }

  return NextResponse.json({ count: total, customers: ids.length });
}
