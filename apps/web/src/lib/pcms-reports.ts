import { appPlatformLabel, resolveAppPlatform } from './app-platform';
import { resolveCustomerAccountStatus } from './customer-account-admin';
import { enrichCouponRedemptions } from './coupon-redemption-enrich';
import { resolveReportDateRange } from './report-date-range';

async function fetchLatestSessionPlatforms(supabaseAdmin: any, customerIds: string[]) {
  if (!customerIds.length) return new Map<string, { user_agent?: string | null; app_platform?: string | null }>();

  let query = supabaseAdmin
    .from('customer_sessions')
    .select('customer_id, app_platform, user_agent, created_at')
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) {
    const { data: fallback } = await supabaseAdmin
      .from('customer_sessions')
      .select('customer_id, user_agent, created_at')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false });
    const map = new Map<string, { user_agent?: string | null; app_platform?: string | null }>();
    for (const row of fallback || []) {
      const cid = String(row.customer_id);
      if (!map.has(cid)) map.set(cid, row);
    }
    return map;
  }

  const map = new Map<string, { user_agent?: string | null; app_platform?: string | null }>();
  for (const row of data || []) {
    const cid = String(row.customer_id);
    if (!map.has(cid)) map.set(cid, row);
  }
  return map;
}

export async function fetchPcmsReports(
  supabaseAdmin: any,
  options: {
    preset: string;
    customStart?: string | null;
    customEnd?: string | null;
    limit?: number;
  },
) {
  const range = resolveReportDateRange(options.preset, options.customStart, options.customEnd);
  const limit = Math.min(Number(options.limit || 500), 2000);

  const [
    redemptionsRes,
    customersRes,
    membershipsRes,
    dashboardRes,
  ] = await Promise.all([
    supabaseAdmin
      .from('coupon_redemptions')
      .select(
        'id, coupon_id, service_lead_id, applied_by_role, discount_amount_applied, meta, created_at, coupon:coupons(code)',
      )
      .gte('created_at', range.start)
      .lte('created_at', range.end)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from('customers')
      .select(
        'id, phone, email, full_name, firebase_uid, phone_verified, created_at, last_login_at, app_platform, account_status, is_active',
      )
      .gte('created_at', range.start)
      .lte('created_at', range.end)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from('customer_memberships')
      .select(
        'id, customer_id, plan_id, status, starts_at, ends_at, source, has_second_car, created_at, customer:customers(full_name, phone), plan:membership_plans(name, code, membership_type, price)',
      )
      .gte('created_at', range.start)
      .lte('created_at', range.end)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabaseAdmin.from('coupons').select('id, is_active, valid_until'),
  ]);

  let redemptions = redemptionsRes.data || [];
  if (redemptionsRes.error) {
    const { data } = await supabaseAdmin
      .from('coupon_redemptions')
      .select('id, coupon_id, service_lead_id, applied_by_role, discount_amount_applied, meta, created_at')
      .gte('created_at', range.start)
      .lte('created_at', range.end)
      .order('created_at', { ascending: false })
      .limit(limit);
    redemptions = data || [];
  }

  const enrichedRedemptions = await enrichCouponRedemptions(supabaseAdmin, redemptions);

  const customers = customersRes.data || [];
  const sessionMap = await fetchLatestSessionPlatforms(
    supabaseAdmin,
    customers.map((c: any) => String(c.id)),
  );

  const devices = customers.map((c: any) => {
    const session = sessionMap.get(String(c.id));
    const platform = resolveAppPlatform(c.app_platform, session?.user_agent, session?.app_platform);
    return {
      id: c.id,
      created_at: c.created_at,
      full_name: c.full_name,
      phone: c.phone,
      email: c.email,
      platform: appPlatformLabel(platform),
      account_status: resolveCustomerAccountStatus(c.account_status, c.is_active),
      last_login_at: c.last_login_at,
      is_app_user: Boolean(c.firebase_uid || c.phone_verified),
    };
  });

  const memberships = (membershipsRes.data || []).map((m: any) => ({
    id: m.id,
    created_at: m.created_at,
    starts_at: m.starts_at,
    ends_at: m.ends_at,
    status: m.status,
    source: m.source || 'PURCHASE',
    has_second_car: Boolean(m.has_second_car),
    customer_name: m.customer?.full_name || null,
    customer_phone: m.customer?.phone || null,
    plan_name: m.plan?.name || null,
    plan_code: m.plan?.code || null,
    membership_type: m.plan?.membership_type || null,
    plan_price: Number(m.plan?.price || 0),
  }));

  const platformCounts = devices.reduce(
    (acc, row) => {
      const key = String(row.platform || 'Unknown');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const totalDiscount = enrichedRedemptions.reduce(
    (sum: number, row: any) => sum + Number(row.discount_amount_applied || 0),
    0,
  );

  const allCoupons = dashboardRes.data || [];
  const activeCoupons = allCoupons.filter((c: any) => c.is_active).length;

  return {
    range,
    summary: {
      total_redemptions: enrichedRedemptions.length,
      total_discount: totalDiscount,
      active_coupons: activeCoupons,
      new_app_customers: devices.length,
      android_installs: platformCounts.Android || 0,
      ios_installs: platformCounts.iOS || 0,
      unknown_platform_installs: platformCounts.Unknown || 0,
      new_memberships: memberships.length,
      active_memberships_in_period: memberships.filter((m: any) => m.status === 'ACTIVE').length,
    },
    redemptions: enrichedRedemptions,
    devices,
    memberships,
  };
}

export const PCM_REPORT_CSV_COLUMNS = {
  redemptions: [
    { key: 'created_at', label: 'Date' },
    { key: 'code', label: 'Coupon Code' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'phone', label: 'Phone' },
    { key: 'service', label: 'Service Booked' },
    { key: 'vehicle', label: 'Car' },
    { key: 'city', label: 'City' },
    { key: 'lead_number', label: 'Lead #' },
    { key: 'channel', label: 'Channel' },
    { key: 'lead_status', label: 'Lead Status' },
    { key: 'applied_by_role', label: 'Role' },
    { key: 'discount_amount_applied', label: 'Discount' },
  ],
  devices: [
    { key: 'created_at', label: 'Joined At' },
    { key: 'full_name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'platform', label: 'Platform' },
    { key: 'account_status', label: 'Account Status' },
    { key: 'last_login_at', label: 'Last Login' },
  ],
  memberships: [
    { key: 'created_at', label: 'Purchased At' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'customer_phone', label: 'Phone' },
    { key: 'plan_name', label: 'Plan' },
    { key: 'membership_type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'source', label: 'Source' },
    { key: 'plan_price', label: 'Price' },
    { key: 'starts_at', label: 'Starts' },
    { key: 'ends_at', label: 'Ends' },
    { key: 'has_second_car', label: '2nd Car' },
  ],
};

export function mapRedemptionsForCsv(rows: any[]) {
  return rows.map((row) => {
    const customer = row.customer_display || {};
    const booking = row.booking_display || {};
    return {
      created_at: row.created_at,
      code: row.coupon?.code || '',
      customer_name: customer.name || '',
      phone: customer.phone || '',
      service: booking.service || '',
      vehicle: booking.vehicle || booking.vehicle_number || '',
      city: booking.city || '',
      lead_number: customer.lead_number || '',
      channel: customer.channel || '',
      lead_status: booking.lead_status || '',
      applied_by_role: row.applied_by_role || '',
      discount_amount_applied: Number(row.discount_amount_applied || 0),
    };
  });
}
