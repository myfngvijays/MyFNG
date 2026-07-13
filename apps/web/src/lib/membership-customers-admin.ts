import { normalizeAppPlatform, resolveAppPlatform } from './app-platform';
import {
  buildCustomerLeadOrFilter,
  filterLeadsForCustomer,
  normalizeCustomerPhone,
} from './customer-service-leads';
import {
  getMembershipBenefitsStatusForMembership,
  type MembershipBenefitStatus,
  type MembershipClaimHistoryItem,
} from './membership-benefits-service';
import { resolveLeadAmountDisplay } from './post-booking-membership-offer';
import { getPostBookingMembershipConfig } from './post-booking-membership-config';
import { resolveReportDateRange, rowsToCsv, type ReportDatePreset } from './report-date-range';
import { getWalletSummary } from './wallet-service';

function resolveMaxUsage(benefit: any): number | null {
  if (benefit?.max_usage != null && Number.isFinite(Number(benefit.max_usage))) {
    return Number(benefit.max_usage);
  }
  const code = String(benefit?.benefit_code || '').toUpperCase();
  const defaults: Record<string, number | null> = {
    PERIODIC_10_OFF: null,
    FREE_INSPECTION: 2,
    FREE_SCAN: 2,
    DAMAGE_ASSESS: null,
  };
  return defaults[code] ?? null;
}

function vehicleLabel(snapshot: any): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const plate = snapshot.vehicle_number ? String(snapshot.vehicle_number) : '';
  const makeModel = [snapshot.make, snapshot.model].filter(Boolean).join(' ');
  return [makeModel, plate].filter(Boolean).join(' · ') || plate || null;
}

function snapshotPlate(snapshot: any): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const plate = String(snapshot.vehicle_number || '').trim().toUpperCase();
  return plate || null;
}

function isMembershipLive(row: { status?: string | null; ends_at?: string | null }) {
  const now = Date.now();
  return (
    String(row.status || '').toUpperCase() === 'ACTIVE' &&
    new Date(String(row.ends_at || 0)).getTime() > now
  );
}

export type MembershipCustomerOverview = {
  total_memberships: number;
  active_memberships: number;
  expired_memberships: number;
};

export type MembershipCustomerDashboard = {
  range_label: string;
  platform_filter: string;
  new_memberships: number;
  first_time_signups: number;
  renewals_in_period: number;
  active_now: number;
  expiring_soon: number;
  revenue_inr: number;
  total_wallet_balance: number;
  members_with_wallet: number;
  benefits_claimed: number;
  service_bookings: number;
  android_count: number;
  ios_count: number;
  unknown_platform_count: number;
  second_car_count: number;
  plan_breakdown: Array<{ plan_name: string; count: number; revenue_inr: number }>;
  benefit_breakdown: Array<{ benefit_code: string; title: string; count: number }>;
  source_breakdown: Array<{ source: string; count: number; revenue_inr: number }>;
  daily_signups: Array<{ date: string; count: number }>;
};

export type MembershipVehicleDetails = {
  make: string | null;
  model: string | null;
  vehicle_number: string | null;
  year: number | null;
  vin: string | null;
  odometer_km: number | null;
  insurance_expiry: string | null;
  fuel_type: string | null;
};

export type MembershipServiceBooking = {
  id: string;
  lead_number: string | null;
  service_type: string | null;
  service_display: string | null;
  status: string | null;
  payment_amount: number;
  vehicle_number: string | null;
  created_at: string;
};

const MEMBERSHIP_FETCH_CAP = 10000;
const OR_FILTER_BATCH = 40;

export type MembershipLastService = {
  label: string;
  amount: number;
  created_at: string;
};

export type MembershipCustomerListRow = {
  membership_id: string;
  customer_id: string;
  customer_name: string;
  email: string | null;
  phone: string;
  app_platform: string | null;
  plan_name: string;
  plan_code: string;
  membership_type: string;
  plan_price: number;
  status: string;
  is_live: boolean;
  starts_at: string;
  ends_at: string;
  source: string | null;
  wallet_balance: number;
  benefits_claimed: number;
  benefits_claimable: number;
  benefits_remaining: number | null;
  primary_vehicle: string | null;
  second_vehicle: string | null;
  vehicle: MembershipVehicleDetails;
  services_booked_count: number;
  last_service: MembershipLastService | null;
  has_second_car: boolean;
  created_at: string;
};

export const MEMBERSHIP_CUSTOMERS_CSV_COLUMNS = [
  { key: 'customer_name', label: 'Customer Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'app_platform', label: 'Platform' },
  { key: 'plan_name', label: 'Plan' },
  { key: 'plan_price', label: 'Amount (INR)' },
  { key: 'starts_at', label: 'Start Date' },
  { key: 'ends_at', label: 'End Date' },
  { key: 'status', label: 'Status' },
  { key: 'vehicle_make', label: 'Car Make' },
  { key: 'vehicle_model', label: 'Car Model' },
  { key: 'vehicle_number', label: 'Car Number' },
  { key: 'vehicle_year', label: 'Registration Year' },
  { key: 'vehicle_vin', label: 'Chassis / VIN' },
  { key: 'vehicle_odometer_km', label: 'Odometer (km)' },
  { key: 'vehicle_insurance_expiry', label: 'Insurance Expiry' },
  { key: 'wallet_balance', label: 'Wallet Balance' },
  { key: 'benefits_claimed', label: 'Benefits Claimed' },
  { key: 'benefits_claimable', label: 'Benefits Claimable' },
  { key: 'benefits_remaining', label: 'Benefits Remaining' },
  { key: 'services_booked_count', label: 'Services Booked' },
  { key: 'services_summary', label: 'Service History Summary' },
  { key: 'created_at', label: 'Purchased At' },
] as const;

function resolveDateParams(preset?: string | null, start?: string | null, end?: string | null) {
  return resolveReportDateRange(preset || 'last_30_days', start, end);
}

function isAllTimePreset(preset?: string | null) {
  return String(preset || '').trim().toLowerCase() === 'all_time';
}

function matchesPlatformFilter(appPlatform: string | null | undefined, platformFilter?: string | null) {
  const pf = String(platformFilter || 'ALL').trim().toUpperCase();
  if (!pf || pf === 'ALL') return true;
  const resolved = normalizeAppPlatform(appPlatform);
  if (pf === 'UNKNOWN') return !resolved;
  return resolved === pf;
}

async function fetchAllMembershipRawRows(
  supabaseAdmin: any,
  applyQuery: (query: any) => any,
): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (all.length < MEMBERSHIP_FETCH_CAP) {
    let query = supabaseAdmin
      .from('customer_memberships')
      .select(
        `
        id, customer_id, plan_id, status, starts_at, ends_at, source, created_at,
        has_second_car, primary_vehicle_snapshot, second_vehicle_snapshot,
        customer:customers(id, phone, full_name, email, app_platform),
        plan:membership_plans(id, name, code, membership_type, price)
      `,
      )
      .order('created_at', { ascending: false });

    query = applyQuery(query);
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message || 'Failed to fetch memberships');
    if (!data?.length) break;

    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

async function fetchAllMembershipCustomerIds(supabaseAdmin: any): Promise<string[]> {
  const ids = new Set<string>();
  let offset = 0;
  const pageSize = 1000;

  while (ids.size < MEMBERSHIP_FETCH_CAP) {
    const { data, error } = await supabaseAdmin
      .from('customer_memberships')
      .select('customer_id')
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message || 'Failed to fetch membership customers');
    if (!data?.length) break;
    for (const row of data) {
      if (row.customer_id) ids.add(String(row.customer_id));
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return [...ids];
}

async function fetchMembershipCustomerPlatformMap(
  supabaseAdmin: any,
  customerIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (!customerIds.length) return map;

  for (let i = 0; i < customerIds.length; i += OR_FILTER_BATCH) {
    const batch = customerIds.slice(i, i + OR_FILTER_BATCH);
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('id, app_platform')
      .in('id', batch);
    if (error) throw new Error(error.message || 'Failed to fetch customer platforms');
    for (const row of data || []) {
      map.set(String(row.id), row.app_platform ? String(row.app_platform) : null);
    }
  }

  return map;
}

async function fetchBenefitTitleMap(supabaseAdmin: any): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin
    .from('membership_benefits')
    .select('benefit_code, title')
    .eq('active', true);

  const map = new Map<string, string>();
  for (const row of data || []) {
    const code = String(row.benefit_code || '').toUpperCase();
    if (!map.has(code)) map.set(code, String(row.title || code));
  }
  return map;
}

async function countRenewalsInPeriod(
  supabaseAdmin: any,
  rows: Array<{ customer_id: string; created_at: string }>,
): Promise<number> {
  const customerIds = [...new Set(rows.map((r) => String(r.customer_id)).filter(Boolean))];
  if (!customerIds.length) return 0;

  const earliestByCustomer = new Map<string, string>();
  for (const row of rows) {
    const cid = String(row.customer_id);
    const createdAt = String(row.created_at || '');
    const existing = earliestByCustomer.get(cid);
    if (!existing || createdAt < existing) earliestByCustomer.set(cid, createdAt);
  }

  const priorCountByCustomer = new Map<string, number>();
  for (let i = 0; i < customerIds.length; i += OR_FILTER_BATCH) {
    const batch = customerIds.slice(i, i + OR_FILTER_BATCH);
    const { data, error } = await supabaseAdmin
      .from('customer_memberships')
      .select('customer_id, created_at')
      .in('customer_id', batch);
    if (error) throw new Error(error.message || 'Failed to fetch prior memberships');

    for (const row of data || []) {
      const cid = String(row.customer_id);
      const createdAt = String(row.created_at || '');
      const periodStart = earliestByCustomer.get(cid);
      if (periodStart && createdAt < periodStart) {
        priorCountByCustomer.set(cid, (priorCountByCustomer.get(cid) || 0) + 1);
      }
    }
  }

  let renewals = 0;
  for (const row of rows) {
    const cid = String(row.customer_id);
    if ((priorCountByCustomer.get(cid) || 0) > 0) renewals += 1;
  }
  return renewals;
}

async function countServiceBookingsForMemberCustomers(
  supabaseAdmin: any,
  range: { start: string; end: string },
  customerIds?: string[],
): Promise<number> {
  const ids = customerIds?.length ? customerIds : await fetchAllMembershipCustomerIds(supabaseAdmin);
  if (!ids.length) return 0;

  let total = 0;
  for (let i = 0; i < ids.length; i += OR_FILTER_BATCH) {
    const batch = ids.slice(i, i + OR_FILTER_BATCH);
    const { count, error } = await supabaseAdmin
      .from('service_leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', range.start)
      .lte('created_at', range.end)
      .or(batch.map((id) => `meta->>customer_id.eq.${id}`).join(','));
    if (error) throw new Error(error.message || 'Failed to count service bookings');
    total += Number(count || 0);
  }
  return total;
}

async function fetchVehiclesForCustomers(
  supabaseAdmin: any,
  customerIds: string[],
): Promise<Map<string, any[]>> {
  const map = new Map<string, any[]>();
  if (!customerIds.length) return map;

  const { data } = await supabaseAdmin
    .from('customer_vehicles')
    .select(
      'id, customer_id, vehicle_number, make, model, model_name, year, vin, odometer_km, insurance_expiry, fuel_type, is_default',
    )
    .in('customer_id', customerIds)
    .order('is_default', { ascending: false });

  for (const v of data || []) {
    const cid = String(v.customer_id);
    if (!map.has(cid)) map.set(cid, []);
    map.get(cid)!.push(v);
  }
  return map;
}

function resolveVehicleDetails(
  snapshot: any,
  vehicles: any[] | undefined,
): MembershipVehicleDetails {
  const plate = snapshotPlate(snapshot);
  let match = (vehicles || []).find(
    (v) => plate && String(v.vehicle_number || '').trim().toUpperCase() === plate,
  );
  if (!match) match = (vehicles || []).find((v) => v.is_default) || (vehicles || [])[0];

  const snapMake = snapshot?.make ? String(snapshot.make) : null;
  const snapModel = snapshot?.model ? String(snapshot.model) : null;

  return {
    make: match?.make ? String(match.make) : snapMake,
    model: match?.model || match?.model_name ? String(match.model || match.model_name) : snapModel,
    vehicle_number: plate || (match?.vehicle_number ? String(match.vehicle_number) : null),
    year: match?.year != null ? Number(match.year) : snapshot?.year != null ? Number(snapshot.year) : null,
    vin: match?.vin ? String(match.vin) : null,
    odometer_km: match?.odometer_km != null ? Number(match.odometer_km) : null,
    insurance_expiry: match?.insurance_expiry ? String(match.insurance_expiry) : null,
    fuel_type: match?.fuel_type ? String(match.fuel_type) : null,
  };
}

async function fetchServiceBookingsForCustomers(
  supabaseAdmin: any,
  rows: Array<{ customer_id: string; phone: string }>,
): Promise<Map<string, MembershipServiceBooking[]>> {
  const map = new Map<string, MembershipServiceBooking[]>();
  if (!rows.length) return map;

  const pbConfig = await getPostBookingMembershipConfig(supabaseAdmin);
  const unique = new Map<string, { id: string; phone: string }>();
  for (const r of rows) {
    const phone = normalizeCustomerPhone(r.phone) || r.phone;
    unique.set(r.customer_id, { id: r.customer_id, phone });
  }

  await Promise.all(
    [...unique.values()].map(async (customer) => {
      const { data } = await supabaseAdmin
        .from('service_leads')
        .select(
          'id, lead_number, status, service_type, description, estimated_amount, actual_amount, invoice_amount, vehicle_number, created_at, meta, customer_phone',
        )
        .or(buildCustomerLeadOrFilter({ id: customer.id, phone: customer.phone }))
        .order('created_at', { ascending: false })
        .limit(50);

      const filtered = filterLeadsForCustomer(data, { id: customer.id, phone: customer.phone });
      const bookings: MembershipServiceBooking[] = filtered.map((lead: any) => {
        const serviceDisplay =
          String(lead.description || '').trim() ||
          String(lead.service_type || '').replace(/_/g, ' ');
        return {
          id: String(lead.id),
          lead_number: lead.lead_number ? String(lead.lead_number) : null,
          service_type: lead.service_type ? String(lead.service_type) : null,
          service_display: serviceDisplay || null,
          status: lead.status ? String(lead.status) : null,
          payment_amount: resolveLeadAmountDisplay(lead, pbConfig),
          vehicle_number: lead.vehicle_number ? String(lead.vehicle_number) : null,
          created_at: String(lead.created_at || ''),
        };
      });
      map.set(customer.id, bookings);
    }),
  );

  return map;
}

export async function fetchMembershipCustomersOverview(
  supabaseAdmin: any,
): Promise<MembershipCustomerOverview> {
  const nowIso = new Date().toISOString();
  const { count: total } = await supabaseAdmin
    .from('customer_memberships')
    .select('id', { count: 'exact', head: true });

  const { count: active } = await supabaseAdmin
    .from('customer_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'ACTIVE')
    .gt('ends_at', nowIso);

  const totalCount = Number(total || 0);
  const activeCount = Number(active || 0);

  return {
    total_memberships: totalCount,
    active_memberships: activeCount,
    expired_memberships: Math.max(0, totalCount - activeCount),
  };
}

async function fetchMembershipCustomerIdsByPlatform(
  supabaseAdmin: any,
  platformFilter: string,
): Promise<string[] | undefined> {
  if (platformFilter === 'ALL') return undefined;

  const rows = await fetchAllMembershipRawRows(supabaseAdmin, (query) => query);
  const ids = new Set<string>();
  for (const row of rows) {
    if (
      matchesPlatformFilter(row.customer?.app_platform ? String(row.customer.app_platform) : null, platformFilter)
    ) {
      ids.add(String(row.customer_id));
    }
  }
  return [...ids];
}

export async function fetchMembershipCustomersDashboard(
  supabaseAdmin: any,
  opts: { preset?: string; start?: string | null; end?: string | null; platform?: string },
): Promise<MembershipCustomerDashboard> {
  const range = resolveDateParams(opts.preset, opts.start, opts.end);
  const allTime = isAllTimePreset(opts.preset);
  const nowIso = new Date().toISOString();
  const platformFilter = String(opts.platform || 'ALL').trim().toUpperCase();
  const expiringSoonIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  let periodQuery = supabaseAdmin.from('customer_memberships').select(
    `
      id, customer_id, created_at, status, ends_at, source, has_second_car,
      customer:customers(app_platform),
      plan:membership_plans(name, price)
    `,
  );
  if (!allTime) {
    periodQuery = periodQuery.gte('created_at', range.start).lte('created_at', range.end);
  }
  const { data: periodRows, error: periodError } = await periodQuery;
  if (periodError) throw new Error(periodError.message || 'Failed to fetch period memberships');

  let rows = periodRows || [];
  if (platformFilter !== 'ALL') {
    rows = rows.filter((row: any) =>
      matchesPlatformFilter(row.customer?.app_platform ? String(row.customer.app_platform) : null, platformFilter),
    );
  }

  const newMemberships = rows.length;
  const revenue = rows.reduce((sum: number, r: any) => sum + Number(r.plan?.price || 0), 0);
  const renewalsInPeriod = await countRenewalsInPeriod(
    supabaseAdmin,
    rows.map((r: any) => ({ customer_id: String(r.customer_id), created_at: String(r.created_at || '') })),
  );
  const firstTimeSignups = Math.max(0, newMemberships - renewalsInPeriod);
  const secondCarCount = rows.filter((r: any) => Boolean(r.has_second_car)).length;

  let android = 0;
  let ios = 0;
  let unknownPlatform = 0;
  const planMap = new Map<string, { plan_name: string; count: number; revenue_inr: number }>();
  const sourceMap = new Map<string, { source: string; count: number; revenue_inr: number }>();
  const dailyMap = new Map<string, number>();

  for (const r of rows) {
    const platform = normalizeAppPlatform(r.customer?.app_platform);
    if (platform === 'ANDROID') android += 1;
    else if (platform === 'IOS') ios += 1;
    else unknownPlatform += 1;

    const planName = String(r.plan?.name || 'Unknown');
    const price = Number(r.plan?.price || 0);
    if (!planMap.has(planName)) planMap.set(planName, { plan_name: planName, count: 0, revenue_inr: 0 });
    const planEntry = planMap.get(planName)!;
    planEntry.count += 1;
    planEntry.revenue_inr += price;

    const source = String(r.source || 'PURCHASE').trim().toUpperCase() || 'PURCHASE';
    if (!sourceMap.has(source)) sourceMap.set(source, { source, count: 0, revenue_inr: 0 });
    const sourceEntry = sourceMap.get(source)!;
    sourceEntry.count += 1;
    sourceEntry.revenue_inr += price;

    const day = String(r.created_at || '').slice(0, 10);
    if (day) dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
  }

  const activeRows = await fetchAllMembershipRawRows(supabaseAdmin, (query) =>
    query.eq('status', 'ACTIVE').gt('ends_at', nowIso),
  );
  const activeDeduped = dedupeActivePerCustomer(activeRows);
  const activeFiltered =
    platformFilter === 'ALL'
      ? activeDeduped
      : activeDeduped.filter((row: any) =>
          matchesPlatformFilter(row.customer?.app_platform ? String(row.customer.app_platform) : null, platformFilter),
        );

  const expiringSoon = activeFiltered.filter((row: any) => {
    const endsAt = new Date(String(row.ends_at || 0)).getTime();
    return endsAt > Date.now() && endsAt <= new Date(expiringSoonIso).getTime();
  }).length;

  const scopedCustomerIds = [...new Set(activeFiltered.map((row: any) => String(row.customer_id)).filter(Boolean))];
  let totalWalletBalance = 0;
  let membersWithWallet = 0;
  if (scopedCustomerIds.length) {
    const { data: wallets, error: walletError } = await supabaseAdmin
      .from('wallet_accounts')
      .select('customer_id, current_balance')
      .in('customer_id', scopedCustomerIds);
    if (walletError) throw new Error(walletError.message || 'Failed to fetch wallet balances');
    for (const wallet of wallets || []) {
      const balance = Number(wallet.current_balance || 0);
      if (balance > 0) membersWithWallet += 1;
      totalWalletBalance += balance;
    }
  }

  let usageQuery = supabaseAdmin.from('membership_usage').select('id, customer_id, benefit_code');
  if (!allTime) {
    usageQuery = usageQuery.gte('created_at', range.start).lte('created_at', range.end);
  }
  const { data: usageRows, error: usageError } = await usageQuery;
  if (usageError) throw new Error(usageError.message || 'Failed to fetch benefit usage');

  let filteredUsage = usageRows || [];
  if (platformFilter !== 'ALL') {
    const usageCustomerIds = [...new Set(filteredUsage.map((row: any) => String(row.customer_id)).filter(Boolean))];
    const platformMap = await fetchMembershipCustomerPlatformMap(supabaseAdmin, usageCustomerIds);
    filteredUsage = filteredUsage.filter((row: any) =>
      matchesPlatformFilter(platformMap.get(String(row.customer_id)), platformFilter),
    );
  }

  const benefitTitleMap = await fetchBenefitTitleMap(supabaseAdmin);
  const benefitCountMap = new Map<string, number>();
  for (const usage of filteredUsage) {
    const code = String(usage.benefit_code || '').toUpperCase() || 'UNKNOWN';
    benefitCountMap.set(code, (benefitCountMap.get(code) || 0) + 1);
  }
  const benefit_breakdown = [...benefitCountMap.entries()]
    .map(([benefit_code, count]) => ({
      benefit_code,
      title: benefitTitleMap.get(benefit_code) || benefit_code,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const membershipCustomerIds = await fetchMembershipCustomerIdsByPlatform(supabaseAdmin, platformFilter);

  const serviceBookings = allTime
    ? await countServiceBookingsForMemberCustomers(
        supabaseAdmin,
        {
          start: '1970-01-01T00:00:00.000+05:30',
          end: range.end,
        },
        membershipCustomerIds,
      )
    : await countServiceBookingsForMemberCustomers(supabaseAdmin, range, membershipCustomerIds);

  const daily_signups = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return {
    range_label: range.label,
    platform_filter: platformFilter,
    new_memberships: newMemberships,
    first_time_signups: firstTimeSignups,
    renewals_in_period: renewalsInPeriod,
    active_now: activeFiltered.length,
    expiring_soon: expiringSoon,
    revenue_inr: Math.round(revenue),
    total_wallet_balance: Math.round(totalWalletBalance),
    members_with_wallet: membersWithWallet,
    benefits_claimed: filteredUsage.length,
    service_bookings: serviceBookings,
    android_count: android,
    ios_count: ios,
    unknown_platform_count: unknownPlatform,
    second_car_count: secondCarCount,
    plan_breakdown: [...planMap.values()].sort((a, b) => b.count - a.count),
    benefit_breakdown,
    source_breakdown: [...sourceMap.values()].sort((a, b) => b.count - a.count),
    daily_signups,
  };
}

export type MembershipBenefitClaimRow = {
  id: string;
  benefit_code: string;
  benefit_title: string;
  customer_id: string;
  customer_name: string;
  phone: string;
  app_platform: string | null;
  plan_name: string | null;
  vehicle_number: string | null;
  vehicle_label: string | null;
  lead_number: string | null;
  lead_status: string | null;
  created_at: string;
};

export async function fetchMembershipBenefitClaims(
  supabaseAdmin: any,
  opts: {
    benefit_code: string;
    preset?: string;
    start?: string | null;
    end?: string | null;
    platform?: string;
  },
): Promise<{
  benefit_code: string;
  title: string;
  range_label: string;
  platform_filter: string;
  claims: MembershipBenefitClaimRow[];
}> {
  const benefitCode = String(opts.benefit_code || '').trim().toUpperCase();
  if (!benefitCode) throw new Error('benefit_code is required');

  const range = resolveDateParams(opts.preset, opts.start, opts.end);
  const allTime = isAllTimePreset(opts.preset);
  const platformFilter = String(opts.platform || 'ALL').trim().toUpperCase();
  const benefitTitleMap = await fetchBenefitTitleMap(supabaseAdmin);
  const title = benefitTitleMap.get(benefitCode) || benefitCode;

  let usageQuery = supabaseAdmin
    .from('membership_usage')
    .select(
      `
      id, benefit_code, customer_id, customer_membership_id, reference_type, reference_id, created_at,
      customer:customers(id, phone, full_name, app_platform)
    `,
    )
    .eq('benefit_code', benefitCode)
    .order('created_at', { ascending: false })
    .limit(500);

  if (!allTime) {
    usageQuery = usageQuery.gte('created_at', range.start).lte('created_at', range.end);
  }

  const { data: usageRows, error } = await usageQuery;
  if (error) throw new Error(error.message || 'Failed to fetch benefit claims');

  let rows = usageRows || [];
  if (platformFilter !== 'ALL') {
    rows = rows.filter((row: any) =>
      matchesPlatformFilter(row.customer?.app_platform ? String(row.customer.app_platform) : null, platformFilter),
    );
  }

  const membershipIds = [
    ...new Set(rows.map((row: any) => String(row.customer_membership_id)).filter(Boolean)),
  ];
  const membershipById = new Map<string, any>();
  for (let i = 0; i < membershipIds.length; i += OR_FILTER_BATCH) {
    const batch = membershipIds.slice(i, i + OR_FILTER_BATCH);
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('customer_memberships')
      .select('id, primary_vehicle_snapshot, plan:membership_plans(name)')
      .in('id', batch);
    if (membershipError) throw new Error(membershipError.message || 'Failed to fetch memberships');
    for (const membership of memberships || []) {
      membershipById.set(String(membership.id), membership);
    }
  }

  const leadIds = [
    ...new Set(
      rows
        .filter((row: any) => String(row.reference_type || '').toUpperCase() === 'LEAD' && row.reference_id)
        .map((row: any) => String(row.reference_id)),
    ),
  ];

  const leadById = new Map<string, any>();
  for (let i = 0; i < leadIds.length; i += OR_FILTER_BATCH) {
    const batch = leadIds.slice(i, i + OR_FILTER_BATCH);
    const { data: leads, error: leadError } = await supabaseAdmin
      .from('service_leads')
      .select('id, lead_number, status, vehicle_number, vehicle_make, vehicle_model, meta')
      .in('id', batch);
    if (leadError) throw new Error(leadError.message || 'Failed to fetch linked bookings');
    for (const lead of leads || []) {
      leadById.set(String(lead.id), lead);
    }
  }

  const claims: MembershipBenefitClaimRow[] = rows.map((row: any) => {
    const lead = row.reference_id ? leadById.get(String(row.reference_id)) : null;
    const claimMeta = (lead?.meta as any)?.membership_claim || {};
    const membership = membershipById.get(String(row.customer_membership_id));
    const snapshot = membership?.primary_vehicle_snapshot;
    const snapshotPlate = snapshot?.vehicle_number ? String(snapshot.vehicle_number) : null;
    const snapshotLabel = [snapshot?.make, snapshot?.model].filter(Boolean).join(' ') || null;

    return {
      id: String(row.id),
      benefit_code: benefitCode,
      benefit_title: String(claimMeta.benefit_title || title),
      customer_id: String(row.customer_id),
      customer_name: String(
        row.customer?.full_name || `User ${String(row.customer?.phone || '').slice(-4)}`,
      ),
      phone: String(row.customer?.phone || ''),
      app_platform: row.customer?.app_platform ? String(row.customer.app_platform) : null,
      plan_name: membership?.plan?.name ? String(membership.plan.name) : null,
      vehicle_number: claimMeta.vehicle_number || lead?.vehicle_number || snapshotPlate,
      vehicle_label:
        claimMeta.vehicle_label ||
        [lead?.vehicle_make, lead?.vehicle_model].filter(Boolean).join(' ') ||
        snapshotLabel,
      lead_number: lead?.lead_number ? String(lead.lead_number) : null,
      lead_status: lead?.status ? String(lead.status) : null,
      created_at: String(row.created_at || ''),
    };
  });

  return {
    benefit_code: benefitCode,
    title,
    range_label: allTime ? 'All time' : range.label,
    platform_filter: platformFilter,
    claims,
  };
}

async function summarizeBenefitsForMemberships(
  supabaseAdmin: any,
  rows: any[],
): Promise<
  Map<
    string,
    { benefits_claimed: number; benefits_claimable: number; benefits_remaining: number | null }
  >
> {
  const result = new Map<
    string,
    { benefits_claimed: number; benefits_claimable: number; benefits_remaining: number | null }
  >();
  if (!rows.length) return result;

  const membershipIds = rows.map((r) => String(r.id));
  const planIds = [...new Set(rows.map((r) => String(r.plan_id)).filter(Boolean))];

  const [{ data: planBenefits }, { data: usageRows }] = await Promise.all([
    supabaseAdmin
      .from('membership_benefits')
      .select('plan_id, benefit_code, max_usage, show_claim_button, active')
      .in('plan_id', planIds)
      .eq('active', true),
    supabaseAdmin
      .from('membership_usage')
      .select('customer_membership_id, benefit_code')
      .in('customer_membership_id', membershipIds),
  ]);

  const benefitsByPlan = new Map<string, any[]>();
  for (const b of planBenefits || []) {
    const pid = String(b.plan_id);
    if (!benefitsByPlan.has(pid)) benefitsByPlan.set(pid, []);
    benefitsByPlan.get(pid)!.push(b);
  }

  const usageByMembership = new Map<string, Record<string, number>>();
  for (const u of usageRows || []) {
    const mid = String(u.customer_membership_id);
    const code = String(u.benefit_code || '').toUpperCase();
    if (!usageByMembership.has(mid)) usageByMembership.set(mid, {});
    const map = usageByMembership.get(mid)!;
    map[code] = (map[code] || 0) + 1;
  }

  for (const row of rows) {
    const mid = String(row.id);
    const claimable = (benefitsByPlan.get(String(row.plan_id)) || []).filter(
      (b) => b.show_claim_button === true,
    );
    const usageByCode = usageByMembership.get(mid) || {};

    let benefits_claimed = 0;
    let benefits_remaining = 0;
    let hasLimited = false;

    for (const b of claimable) {
      const code = String(b.benefit_code || '').toUpperCase();
      const used = usageByCode[code] || 0;
      benefits_claimed += used;
      const maxUsage = resolveMaxUsage(b);
      if (maxUsage == null) continue;
      hasLimited = true;
      benefits_remaining += Math.max(0, maxUsage - used);
    }

    result.set(mid, {
      benefits_claimed,
      benefits_claimable: claimable.length,
      benefits_remaining: hasLimited ? benefits_remaining : null,
    });
  }

  return result;
}

function dedupeActivePerCustomer(rows: any[]): any[] {
  const byCustomer = new Map<string, any>();
  for (const row of rows) {
    const cid = String(row.customer_id);
    const existing = byCustomer.get(cid);
    if (!existing) {
      byCustomer.set(cid, row);
      continue;
    }
    const existingLive = isMembershipLive(existing);
    const rowLive = isMembershipLive(row);
    if (rowLive && !existingLive) {
      byCustomer.set(cid, row);
      continue;
    }
    if (rowLive === existingLive) {
      const existingEnd = new Date(String(existing.ends_at || 0)).getTime();
      const rowEnd = new Date(String(row.ends_at || 0)).getTime();
      if (rowEnd > existingEnd) byCustomer.set(cid, row);
    }
  }
  return [...byCustomer.values()].sort(
    (a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime(),
  );
}

function mapListRow(
  row: any,
  walletByCustomer: Map<string, number>,
  benefitSummary: Map<string, { benefits_claimed: number; benefits_claimable: number; benefits_remaining: number | null }>,
  vehiclesByCustomer: Map<string, any[]>,
  servicesByCustomer: Map<string, MembershipServiceBooking[]>,
): MembershipCustomerListRow {
  const summary = benefitSummary.get(String(row.id)) || {
    benefits_claimed: 0,
    benefits_claimable: 0,
    benefits_remaining: null,
  };
  const customerId = String(row.customer_id);
  const vehicle = resolveVehicleDetails(row.primary_vehicle_snapshot, vehiclesByCustomer.get(customerId));
  const services = servicesByCustomer.get(customerId) || [];
  const latest = services[0];

  return {
    membership_id: String(row.id),
    customer_id: customerId,
    customer_name: String(row.customer?.full_name || `User ${String(row.customer?.phone || '').slice(-4)}`),
    email: row.customer?.email ? String(row.customer.email) : null,
    phone: String(row.customer?.phone || ''),
    app_platform: row.customer?.app_platform ? String(row.customer.app_platform) : null,
    plan_name: String(row.plan?.name || 'Plan'),
    plan_code: String(row.plan?.code || ''),
    membership_type: String(row.plan?.membership_type || 'SERVICE'),
    plan_price: Number(row.plan?.price || 0),
    status: String(row.status || ''),
    is_live: isMembershipLive(row),
    starts_at: String(row.starts_at || ''),
    ends_at: String(row.ends_at || ''),
    source: row.source ? String(row.source) : null,
    wallet_balance: walletByCustomer.get(customerId) || 0,
    benefits_claimed: summary.benefits_claimed,
    benefits_claimable: summary.benefits_claimable,
    benefits_remaining: summary.benefits_remaining,
    primary_vehicle: vehicleLabel(row.primary_vehicle_snapshot),
    second_vehicle: vehicleLabel(row.second_vehicle_snapshot),
    vehicle,
    services_booked_count: services.length,
    last_service: latest
      ? {
          label: latest.service_display || latest.service_type || 'Service',
          amount: latest.payment_amount,
          created_at: latest.created_at,
        }
      : null,
    has_second_car: Boolean(row.has_second_car),
    created_at: String(row.created_at || ''),
  };
}

export async function fetchMembershipCustomersList(
  supabaseAdmin: any,
  opts: {
    search?: string;
    filter?: string;
    page?: number;
    limit?: number;
    preset?: string;
    start?: string | null;
    end?: string | null;
    dateField?: 'created_at' | 'starts_at';
    forceDateFilter?: boolean;
    exportAllActive?: boolean;
    platform?: string;
  },
): Promise<{ rows: MembershipCustomerListRow[]; total: number; range_label: string }> {
  const search = String(opts.search || '').trim();
  const filter = String(opts.filter || 'ACTIVE').trim().toUpperCase();
  const platform = String(opts.platform || 'ALL').trim().toUpperCase();
  const page = Math.max(1, Number(opts.page || 1));
  const limit = Math.min(Math.max(Number(opts.limit || 40), 1), 100);
  const dateField = opts.dateField === 'starts_at' ? 'starts_at' : 'created_at';
  const range = resolveDateParams(opts.preset, opts.start, opts.end);
  const allTime = isAllTimePreset(opts.preset);
  const nowIso = new Date().toISOString();
  const applyDateFilter =
    !allTime && (Boolean(opts.forceDateFilter) || (filter !== 'ACTIVE' && !opts.exportAllActive));

  const rows = await fetchAllMembershipRawRows(supabaseAdmin, (query) => {
    let q = query;
    if (applyDateFilter) {
      q = q.gte(dateField, range.start).lte(dateField, range.end);
    }
    if (filter === 'ACTIVE') {
      q = q.eq('status', 'ACTIVE').gt('ends_at', nowIso);
    } else if (filter === 'EXPIRED') {
      q = q.or(`status.neq.ACTIVE,ends_at.lte.${nowIso}`);
    }
    return q;
  });

  let filtered = rows;

  if (filter === 'ACTIVE') {
    filtered = dedupeActivePerCustomer(filtered);
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((row: any) => {
      const name = String(row.customer?.full_name || '').toLowerCase();
      const phone = String(row.customer?.phone || '').toLowerCase();
      const email = String(row.customer?.email || '').toLowerCase();
      const plan = String(row.plan?.name || '').toLowerCase();
      const plate = snapshotPlate(row.primary_vehicle_snapshot)?.toLowerCase() || '';
      return name.includes(q) || phone.includes(q) || email.includes(q) || plan.includes(q) || plate.includes(q);
    });
  }

  if (platform !== 'ALL') {
    filtered = filtered.filter((row: any) =>
      matchesPlatformFilter(row.customer?.app_platform ? String(row.customer.app_platform) : null, platform),
    );
  }

  const total = filtered.length;
  const pagedRows = filtered.slice((page - 1) * limit, page * limit);

  const customerIds = [...new Set(pagedRows.map((r: any) => String(r.customer_id)).filter(Boolean))];
  const [{ data: wallets }, vehiclesByCustomer, servicesByCustomer] = await Promise.all([
    customerIds.length
      ? supabaseAdmin
          .from('wallet_accounts')
          .select('customer_id, current_balance')
          .in('customer_id', customerIds)
      : Promise.resolve({ data: [] }),
    fetchVehiclesForCustomers(supabaseAdmin, customerIds),
    fetchServiceBookingsForCustomers(
      supabaseAdmin,
      pagedRows.map((r: any) => ({
        customer_id: String(r.customer_id),
        phone: String(r.customer?.phone || ''),
      })),
    ),
  ]);

  const walletByCustomer = new Map<string, number>();
  for (const w of wallets || []) {
    walletByCustomer.set(String(w.customer_id), Number(w.current_balance || 0));
  }

  const benefitSummary = await summarizeBenefitsForMemberships(supabaseAdmin, pagedRows);

  const mapped = pagedRows.map((row: any) =>
    mapListRow(row, walletByCustomer, benefitSummary, vehiclesByCustomer, servicesByCustomer),
  );

  return {
    rows: mapped,
    total,
    range_label: opts.exportAllActive
      ? 'All active members'
      : allTime
        ? 'All time'
        : applyDateFilter
          ? range.label
          : 'All active members',
  };
}

export async function deleteMembershipCustomer(supabaseAdmin: any, membershipId: string) {
  const { data: existing, error: findError } = await supabaseAdmin
    .from('customer_memberships')
    .select('id, customer_id, status')
    .eq('id', membershipId)
    .maybeSingle();
  if (findError) throw new Error(findError.message || 'Failed to find membership');
  if (!existing?.id) return null;

  const { error } = await supabaseAdmin.from('customer_memberships').delete().eq('id', membershipId);
  if (error) throw new Error(error.message || 'Failed to delete membership');

  return {
    id: String(existing.id),
    customer_id: String(existing.customer_id),
    status: String(existing.status || ''),
  };
}

export async function exportMembershipCustomersCsv(
  supabaseAdmin: any,
  opts: {
    search?: string;
    filter?: string;
    preset?: string;
    start?: string | null;
    end?: string | null;
    exportAllActive?: boolean;
    platform?: string;
  },
): Promise<string> {
  const { rows } = await fetchMembershipCustomersList(supabaseAdmin, {
    ...opts,
    page: 1,
    limit: MEMBERSHIP_FETCH_CAP,
    forceDateFilter: !opts.exportAllActive,
    exportAllActive: Boolean(opts.exportAllActive),
    filter: opts.exportAllActive ? 'ACTIVE' : opts.filter || 'ACTIVE',
  });

  const servicesByCustomer = await fetchServiceBookingsForCustomers(
    supabaseAdmin,
    rows.map((r) => ({ customer_id: r.customer_id, phone: r.phone })),
  );

  const csvRows = rows.map((row) => {
    const services = servicesByCustomer.get(row.customer_id) || [];
    const servicesSummary = services
      .slice(0, 10)
      .map((s) => {
        const label = s.service_display || s.service_type || 'Service';
        return `${label} - ₹${s.payment_amount}`;
      })
      .join('; ');

    return {
      customer_name: row.customer_name,
      email: row.email || '',
      phone: row.phone,
      app_platform: row.app_platform || '',
      plan_name: row.plan_name,
      plan_price: row.plan_price,
      starts_at: row.starts_at?.slice(0, 10) || '',
      ends_at: row.ends_at?.slice(0, 10) || '',
      status: row.is_live ? 'ACTIVE' : row.status,
      vehicle_make: row.vehicle.make || '',
      vehicle_model: row.vehicle.model || '',
      vehicle_number: row.vehicle.vehicle_number || '',
      vehicle_year: row.vehicle.year ?? '',
      vehicle_vin: row.vehicle.vin || '',
      vehicle_odometer_km: row.vehicle.odometer_km ?? '',
      vehicle_insurance_expiry: row.vehicle.insurance_expiry?.slice(0, 10) || '',
      wallet_balance: row.wallet_balance,
      benefits_claimed: row.benefits_claimed,
      benefits_claimable: row.benefits_claimable,
      benefits_remaining: row.benefits_remaining ?? '',
      services_booked_count: services.length,
      services_summary: servicesSummary,
      created_at: row.created_at,
    };
  });

  return rowsToCsv(csvRows, [...MEMBERSHIP_CUSTOMERS_CSV_COLUMNS]);
}

export async function fetchMembershipCustomerDetail(supabaseAdmin: any, membershipId: string) {
  const { data: membership, error } = await supabaseAdmin
    .from('customer_memberships')
    .select(
      `
      *,
      customer:customers(id, phone, full_name, email, app_platform, last_login_at, created_at),
      plan:membership_plans(id, name, code, membership_type, price, duration_days)
    `,
    )
    .eq('id', membershipId)
    .maybeSingle();

  if (error || !membership) return null;

  const customerId = String(membership.customer_id);
  const phone = String(membership.customer?.phone || '');

  const [{ benefits, history }, walletSummary, vehiclesRes, servicesByCustomer] = await Promise.all([
    getMembershipBenefitsStatusForMembership(supabaseAdmin, {
      id: String(membership.id),
      customer_id: customerId,
      plan_id: String(membership.plan_id),
      starts_at: membership.starts_at,
      created_at: membership.created_at,
      source_lead_id: membership.source_lead_id,
    }, phone),
    getWalletSummary(supabaseAdmin, customerId).catch(() => null),
    supabaseAdmin
      .from('customer_vehicles')
      .select(
        'id, vehicle_number, make, model, model_name, year, vin, odometer_km, insurance_expiry, fuel_type, variant, is_default',
      )
      .eq('customer_id', customerId)
      .order('is_default', { ascending: false }),
    fetchServiceBookingsForCustomers(supabaseAdmin, [{ customer_id: customerId, phone }]),
  ]);

  const allPlanBenefitsRes = await supabaseAdmin
    .from('membership_benefits')
    .select('benefit_code, title, max_usage, display_order, active, show_claim_button')
    .eq('plan_id', membership.plan_id)
    .eq('active', true)
    .order('display_order', { ascending: true });

  const claimableByCode = new Map(
    (benefits || []).map((b: MembershipBenefitStatus) => [b.benefit_code, b]),
  );

  const all_benefits = (allPlanBenefitsRes.data || []).map((b: any) => {
    const code = String(b.benefit_code || '').toUpperCase();
    const status = claimableByCode.get(code);
    return {
      benefit_code: code,
      title: String(b.title || code),
      show_claim_button: b.show_claim_button === true,
      max_usage: status?.max_usage ?? resolveMaxUsage(b),
      used_count: status?.used_count ?? 0,
      remaining: status?.remaining ?? null,
      claimable: status?.claimable ?? false,
      status_label: !b.show_claim_button
        ? 'Info only'
        : status?.claimable
          ? status.remaining == null
            ? 'Available'
            : `${status.remaining} left`
          : 'Fully used',
    };
  });

  const primaryVehicle = resolveVehicleDetails(
    membership.primary_vehicle_snapshot,
    vehiclesRes.data || [],
  );
  const secondVehicle = resolveVehicleDetails(
    membership.second_vehicle_snapshot,
    vehiclesRes.data || [],
  );

  return {
    membership: {
      id: String(membership.id),
      status: String(membership.status || ''),
      is_live: isMembershipLive(membership),
      starts_at: String(membership.starts_at || ''),
      ends_at: String(membership.ends_at || ''),
      source: membership.source ? String(membership.source) : null,
      has_second_car: Boolean(membership.has_second_car),
      primary_vehicle: vehicleLabel(membership.primary_vehicle_snapshot),
      second_vehicle: vehicleLabel(membership.second_vehicle_snapshot),
      vehicle: primaryVehicle,
      second_vehicle_details: secondVehicle,
      created_at: String(membership.created_at || ''),
      plan: membership.plan,
    },
    customer: {
      ...membership.customer,
      app_platform: resolveAppPlatform(
        membership.customer?.app_platform,
        null,
        membership.customer?.app_platform,
      ),
    },
    wallet: walletSummary
      ? {
          current_balance: walletSummary.spendable_balance,
          welcome_bonus_expires_at: walletSummary.welcome_bonus_expires_at,
        }
      : { current_balance: 0, welcome_bonus_expires_at: null },
    vehicles: vehiclesRes.data || [],
    service_bookings: servicesByCustomer.get(customerId) || [],
    benefits: all_benefits,
    claim_history: history as MembershipClaimHistoryItem[],
    claimable_benefits: benefits,
  };
}

export type { ReportDatePreset };
