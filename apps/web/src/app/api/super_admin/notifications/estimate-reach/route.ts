import { NextRequest, NextResponse } from 'next/server';
import { assertPushAdmin } from '@/lib/push/admin-auth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { MOBILE_PUSH_PLATFORM } from '@/lib/push/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await assertPushAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ count: 0 });

  const citiesParam = req.nextUrl.searchParams.get('cities') || '';
  const cities = citiesParam.split(',').map((c) => c.trim()).filter(Boolean);
  const membership = req.nextUrl.searchParams.get('membership') || '';

  let customerIds: Set<string> | null = null;

  if (cities.length > 0) {
    const { data: cityRows } = await supabaseAdmin
      .from('cities')
      .select('id')
      .in('name', cities);

    const cityIds = (cityRows || []).map((c: any) => c.id);
    if (cityIds.length > 0) {
      const { data: leads } = await supabaseAdmin
        .from('service_leads')
        .select('customer_phone')
        .in('city_id', cityIds)
        .not('customer_phone', 'is', null);

      const phones = [...new Set((leads || []).map((l: any) => String(l.customer_phone).replace(/\D/g, '').slice(-10)).filter((p: string) => p.length === 10))];

      if (phones.length > 0) {
        const { data: customers } = await supabaseAdmin
          .from('customers')
          .select('id, phone');

        const matchedIds = (customers || [])
          .filter((c: any) => phones.includes(String(c.phone).replace(/\D/g, '').slice(-10)))
          .map((c: any) => c.id);
        customerIds = new Set(matchedIds);
      } else {
        customerIds = new Set();
      }
    } else {
      customerIds = new Set();
    }
  }

  const plansParam = req.nextUrl.searchParams.get('plans') || '';
  const planCodes = plansParam.split(',').map((p) => p.trim()).filter(Boolean);

  if (membership === 'members' || membership === 'non_members') {
    let membershipQuery = supabaseAdmin.from('customer_memberships').select('customer_id, plan_id').eq('status', 'ACTIVE');

    if (membership === 'members' && planCodes.length > 0) {
      const { data: planRows } = await supabaseAdmin.from('membership_plans').select('id').in('code', planCodes);
      const planIds = (planRows || []).map((p: any) => p.id);
      if (planIds.length > 0) {
        membershipQuery = membershipQuery.in('plan_id', planIds);
      }
    }

    const { data: memberships } = await membershipQuery;

    const memberCustomerIds = new Set((memberships || []).map((m: any) => m.customer_id));

    if (membership === 'members') {
      if (customerIds !== null) {
        customerIds = new Set([...customerIds].filter((id) => memberCustomerIds.has(id)));
      } else {
        customerIds = memberCustomerIds;
      }
    } else {
      if (customerIds !== null) {
        customerIds = new Set([...customerIds].filter((id) => !memberCustomerIds.has(id)));
      } else {
        const { data: allCustomers } = await supabaseAdmin
          .from('customers')
          .select('id');
        customerIds = new Set(
          (allCustomers || []).map((c: any) => c.id).filter((id: string) => !memberCustomerIds.has(id))
        );
      }
    }
  }

  if (customerIds !== null) {
    if (customerIds.size === 0) return NextResponse.json({ count: 0 });

    const ids = [...customerIds];
    const { count } = await supabaseAdmin
      .from('notification_devices')
      .select('id', { count: 'exact', head: true })
      .eq('platform', MOBILE_PUSH_PLATFORM)
      .eq('is_active', true)
      .in('customer_id', ids);

    return NextResponse.json({ count: count || 0 });
  }

  const { count } = await supabaseAdmin
    .from('notification_devices')
    .select('id', { count: 'exact', head: true })
    .eq('platform', MOBILE_PUSH_PLATFORM)
    .eq('is_active', true);

  return NextResponse.json({ count: count || 0 });
}
