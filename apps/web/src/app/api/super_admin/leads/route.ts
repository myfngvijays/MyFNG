import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { enrichBookingLead, filterBookingLeads } from '@/lib/booking-lead-utils';
import { getPostBookingMembershipConfig } from '@/lib/post-booking-membership-config';
import { syncServiceLeadMembershipPricingForAdmin } from '@/lib/post-booking-membership-offer';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed' };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN', 'APP_OPERATIONS'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin' };
  }

  return { ok: true, status: 200, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const search = String(searchParams.get('search') || '').trim();
    const status = String(searchParams.get('status') || 'ALL').trim().toUpperCase();
    const source = String(searchParams.get('source') || 'ALL').trim().toUpperCase();
    const hasCoupon = String(searchParams.get('has_coupon') || 'ALL').trim().toUpperCase();
    const limit = Math.min(Number(searchParams.get('limit') || 500), 1000);

    let query = supabaseAdmin
      .from('service_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Number.isFinite(limit) && limit > 0 ? limit : 200);

    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(
        [
          `lead_number.ilike.%${search}%`,
          `customer_name.ilike.%${search}%`,
          `customer_phone.ilike.%${search}%`,
          `vehicle_number.ilike.%${search}%`,
          `city.ilike.%${search}%`,
          `service_type.ilike.%${search}%`,
          `coupon_code.ilike.%${search}%`,
          `lead_source.ilike.%${search}%`,
          `created_from.ilike.%${search}%`,
        ].join(',')
      );
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch service leads' }, { status: 500 });
    }

    let leads = (data || []).map((lead) => enrichBookingLead(lead as Record<string, any>));

    leads = filterBookingLeads(leads, { source, hasCoupon, search: '' });

    const pbConfig = await getPostBookingMembershipConfig(supabaseAdmin);
    leads = await Promise.all(
      leads.map((lead) => syncServiceLeadMembershipPricingForAdmin(supabaseAdmin, lead, pbConfig)),
    );

    const allServiceTypeIds = new Set<string>();
    for (const lead of leads) {
      if (Array.isArray(lead.service_type_ids)) {
        lead.service_type_ids.forEach((id: string) => allServiceTypeIds.add(id));
      }
    }

    const serviceNameMap: Record<string, string> = {};
    if (allServiceTypeIds.size > 0) {
      const { data: stRows } = await supabaseAdmin
        .from('service_types')
        .select('id, name')
        .in('id', Array.from(allServiceTypeIds));
      if (stRows) {
        for (const row of stRows as any[]) {
          serviceNameMap[row.id] = row.name;
        }
      }
    }

    for (const lead of leads) {
      if ((!lead.service_type || lead.service_type === 'CAR_SERVICE') && Array.isArray(lead.service_type_ids) && lead.service_type_ids.length > 0) {
        const names = lead.service_type_ids.map((id: string) => serviceNameMap[id]).filter(Boolean);
        if (names.length > 0) {
          lead.service_display = names.join(', ');
        }
      }
    }

    return NextResponse.json({
      leads,
      summary: {
        total_fetched: (data || []).length,
        total_filtered: leads.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}

