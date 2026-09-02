import { normalizePhone } from './coupon-rules';
import { enrichBookingLead, enrichLeadsServiceDisplay, getLeadVehicleLabel, getLeadPricingBreakdown, isIncomingSarvLeadSource, isWhatsAppEnquiryLead } from './booking-lead-utils';
import { getPostBookingMembershipConfig } from './post-booking-membership-config';
import { syncServiceLeadMembershipPricingForAdmin, resolveAdminBookingPayableAmount } from './post-booking-membership-offer';
import { computeWalletRewardTotals, filterVisibleWalletTransactions, getWalletSummary } from './wallet-service';
import { resolveAppPlatform, type AppPlatform } from './app-platform';
import { resolveCustomerAccountStatus } from './customer-account-admin';
import { loadCrmManualReferencesForCustomer } from './crm-manual-references';
import { parseReferredBy } from './telecaller/crmLeadReference';
import { isMembershipClaimLead, parseClaimsButtonOverride, usageCountsTowardBenefitQuota } from './membership-benefits-service';
import { MOBILE_PUSH_PLATFORM } from './push/constants';
import {
  applyReportDateRangeFilter,
  shouldApplyDateRangeFilter,
} from './report-date-range';

/** App Settings toggle + whether an active FCM device token exists. */
export type CustomerPushStatus = 'ON' | 'OFF' | 'NO_TOKEN';

export function resolveCustomerPushStatus(
  pushEnabled: boolean | null | undefined,
  hasActiveDevice: boolean,
): CustomerPushStatus {
  if (pushEnabled === false) return 'OFF';
  if (hasActiveDevice) return 'ON';
  return 'NO_TOKEN';
}

/** Dummy rows from Refer & Rise simulate-invite ("Test Friend" + synthetic 90… phones). */
export function isReferralTestDummyCustomer(customer: {
  full_name?: string | null;
  phone?: string | null;
  phone_verified?: boolean | null;
}): boolean {
  const name = String(customer.full_name || '').trim().toLowerCase();
  if (name !== 'test friend') return false;
  if (customer.phone_verified === true) return false;
  const digits = phoneDigits(customer.phone);
  return Boolean(digits && digits.startsWith('90') && digits.length === 10);
}

/** Exclude referral test dummies from App Customers list / overview / export. */
export function applyExcludeReferralTestDummies(query: any) {
  return query.not('full_name', 'ilike', 'Test Friend');
}

const IN_QUERY_CHUNK = 80;

function chunkIds(ids: string[], size = IN_QUERY_CHUNK): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}

async function selectByIdChunks(
  supabaseAdmin: any,
  table: string,
  select: string,
  ids: string[],
  idColumn = 'customer_id',
  apply?: (query: any) => any,
): Promise<any[]> {
  if (!ids.length) return [];
  const rows: any[] = [];
  for (const slice of chunkIds(ids)) {
    let query = supabaseAdmin.from(table).select(select).in(idColumn, slice);
    if (apply) query = apply(query);
    const { data, error } = await query;
    if (error) continue;
    rows.push(...(data || []));
  }
  return rows;
}

function uniqueIds(rows: Array<{ customer_id?: string | null } | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const id = String(row?.customer_id || '').trim();
    if (id) seen.add(id);
  }
  return [...seen];
}

/** Customer ids that match a list filter. `null` = scan all customers then JS-filter. */
export async function resolveListFilterCustomerIds(
  supabaseAdmin: any,
  filter: string,
): Promise<string[] | null> {
  const normalized = String(filter || 'ALL').trim().toUpperCase();
  if (normalized === 'ALL' || normalized === 'WITH_BOOKING' || normalized === 'PUSH_NO_TOKEN') {
    return null;
  }

  if (normalized === 'WITH_MEMBERSHIP') {
    const { data } = await supabaseAdmin
      .from('customer_memberships')
      .select('customer_id')
      .eq('status', 'ACTIVE')
      .gt('ends_at', new Date().toISOString())
      .limit(10000);
    return uniqueIds(data || []);
  }

  if (normalized === 'WITH_WALLET') {
    const { data } = await supabaseAdmin
      .from('wallet_accounts')
      .select('customer_id')
      .gt('current_balance', 0)
      .limit(10000);
    return uniqueIds(data || []);
  }

  if (normalized === 'WITH_COUPON') {
    const { data } = await supabaseAdmin
      .from('customer_coupon_assignments')
      .select('customer_id')
      .limit(10000);
    return uniqueIds(data || []);
  }

  if (normalized === 'PUSH_OFF') {
    const { data } = await supabaseAdmin
      .from('customer_notification_preferences')
      .select('customer_id')
      .eq('push_enabled', false)
      .limit(10000);
    return uniqueIds(data || []);
  }

  if (normalized === 'PUSH_ON') {
    const [{ data: devices }, { data: offPrefs }] = await Promise.all([
      supabaseAdmin
        .from('notification_devices')
        .select('customer_id')
        .eq('platform', MOBILE_PUSH_PLATFORM)
        .eq('is_active', true)
        .limit(20000),
      supabaseAdmin
        .from('customer_notification_preferences')
        .select('customer_id')
        .eq('push_enabled', false)
        .limit(10000),
    ]);
    const off = new Set(uniqueIds(offPrefs || []));
    return uniqueIds(devices || []).filter((id) => !off.has(id));
  }

  return null;
}

export async function fetchCustomersByIds(
  supabaseAdmin: any,
  ids: string[],
  apply: (query: any) => any,
): Promise<any[]> {
  if (!ids.length) return [];
  const rows: any[] = [];
  for (const slice of chunkIds(ids)) {
    let query = supabaseAdmin
      .from('customers')
      .select(
        'id, phone, email, full_name, firebase_uid, phone_verified, last_login_at, created_at, is_active, app_platform, account_status, account_status_reason, account_status_changed_at',
      )
      .in('id', slice)
      .order('created_at', { ascending: false });
    query = apply(query);
    const { data, error } = await query;
    if (error) continue;
    rows.push(...(data || []));
  }
  rows.sort(
    (a, b) => new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime(),
  );
  return rows;
}

async function fetchCustomerSessions(
  supabaseAdmin: any,
  customerIds?: string[],
): Promise<Array<{ customer_id: string; user_agent?: string | null; app_platform?: string | null; created_at?: string }>> {
  const load = async (select: string) => {
    if (customerIds?.length) {
      const rows: any[] = [];
      for (const slice of chunkIds(customerIds)) {
        const { data, error } = await supabaseAdmin
          .from('customer_sessions')
          .select(select)
          .in('customer_id', slice)
          .order('created_at', { ascending: false });
        if (error) return { ok: false as const, data: [] };
        rows.push(...(data || []));
      }
      return { ok: true as const, data: rows };
    }
    const { data, error } = await supabaseAdmin
      .from('customer_sessions')
      .select(select)
      .order('created_at', { ascending: false });
    if (error) return { ok: false as const, data: [] };
    return { ok: true as const, data: data || [] };
  };

  const primary = await load('customer_id, app_platform, user_agent, created_at');
  if (primary.ok) return primary.data;

  const fallback = await load('customer_id, user_agent, created_at');
  return fallback.data;
}

function indexLatestSessions(
  sessions: Array<{ customer_id: string; user_agent?: string | null; app_platform?: string | null }>,
) {
  const latestSessionByCustomer = new Map<
    string,
    { user_agent?: string | null; app_platform?: string | null }
  >();
  for (const session of sessions) {
    const cid = String(session.customer_id);
    if (!latestSessionByCustomer.has(cid)) {
      latestSessionByCustomer.set(cid, session);
    }
  }
  return latestSessionByCustomer;
}

export function phoneDigits(phone: string | null | undefined) {
  return normalizePhone(phone);
}

export function phoneSearchFilter(phone: string | null | undefined) {
  const digits = phoneDigits(phone);
  if (!digits) return null;
  return `customer_phone.ilike.%${digits}`;
}

export function phoneChatbotFilter(phone: string | null | undefined) {
  const digits = phoneDigits(phone);
  if (!digits) return null;
  return `phone_number.ilike.%${digits}`;
}

const CUSTOMER_BOOKING_LEAD_FIELDS =
  'customer_phone, coupon_code, discount_amount, deleted_at, lead_source, created_from, service_type, is_incomplete, meta, coupon_meta';

function isEnquiryLeadNotBooking(lead: {
  lead_source?: string | null;
  created_from?: string | null;
  service_type?: string | null;
  is_incomplete?: boolean | null;
  meta?: unknown;
  coupon_meta?: unknown;
} | null | undefined): boolean {
  if (!lead) return false;
  if (isWhatsAppEnquiryLead(lead)) return true;
  if (isIncomingSarvLeadSource(String(lead.lead_source || ''))) return true;

  const source = String(lead.lead_source || '').trim();
  const createdFrom = String(lead.created_from || '').trim().toUpperCase();
  const serviceType = String(lead.service_type || '').trim();
  const meta = lead.meta && typeof lead.meta === 'object' ? (lead.meta as Record<string, unknown>) : {};
  const couponMeta =
    lead.coupon_meta && typeof lead.coupon_meta === 'object'
      ? (lead.coupon_meta as Record<string, unknown>)
      : {};

  if (meta.whatsapp_enquiry || couponMeta.whatsapp_enquiry || meta.telecrm_whatsapp || couponMeta.telecrm_whatsapp) {
    return true;
  }
  if (createdFrom === 'WHATSAPP' || createdFrom === 'WHATSAPP_META' || createdFrom === 'SARV_CALL') return true;
  if (/^whatsapp(\s*\(\d{10}\))?$/i.test(source)) return true;
  if (/whatsapp enquiry/i.test(serviceType) || /^incoming call$/i.test(serviceType)) return true;
  return false;
}

function isVisibleCustomerBooking(lead: {
  deleted_at?: string | null;
  lead_source?: string | null;
  created_from?: string | null;
  service_type?: string | null;
  is_incomplete?: boolean | null;
  meta?: unknown;
  coupon_meta?: unknown;
} | null | undefined): boolean {
  if (!lead || lead.deleted_at) return false;
  if (isMembershipClaimLead(lead)) return false;
  if (isEnquiryLeadNotBooking(lead)) return false;
  return true;
}

export async function fetchCustomerOverview(
  supabaseAdmin: any,
  options?: {
    preset?: string | null;
    start?: string | null;
    end?: string | null;
  },
) {
  const nowIso = new Date().toISOString();
  const preset = options?.preset || 'all_time';
  const dateFiltered = shouldApplyDateRangeFilter(preset);

  let customersQuery = supabaseAdmin.from('customers').select('id, phone, app_platform, full_name, phone_verified');
  customersQuery = applyExcludeReferralTestDummies(customersQuery);
  customersQuery = applyReportDateRangeFilter(
    customersQuery,
    'created_at',
    preset,
    options?.start,
    options?.end,
  );

  const { data: customersData } = await customersQuery;
  const customers = (customersData || []).filter(
    (c: any) => !isReferralTestDummyCustomer(c),
  );
  const customerIds = customers.map((c: any) => String(c.id));
  const digitsList = [
    ...new Set(customers.map((c: any) => phoneDigits(c.phone)).filter(Boolean)),
  ] as string[];

  // Empty date cohort → zeroed overview (avoid falling back to all-time totals).
  if (dateFiltered && customerIds.length === 0) {
    return {
      total_customers: 0,
      android_users: 0,
      ios_users: 0,
      unknown_platform_users: 0,
      customers_with_wallet_balance: 0,
      total_wallet_balance: 0,
      active_memberships: 0,
      total_service_bookings: 0,
      bookings_with_coupon: 0,
      coupon_redemptions: 0,
      open_coupon_assignments: 0,
      push_on: 0,
      push_off: 0,
      push_no_token: 0,
    };
  }

  const phoneOrFilter = digitsList.map((d) => `customer_phone.ilike.%${d}`).join(',');

  let membershipQuery = supabaseAdmin
    .from('customer_memberships')
    .select('customer_id', { count: 'exact', head: true })
    .eq('status', 'ACTIVE')
    .gt('ends_at', nowIso);
  if (dateFiltered) membershipQuery = membershipQuery.in('customer_id', customerIds);

  const [
    walletRes,
    membershipRes,
    leadsRes,
    redemptionRes,
    assignmentRes,
    sessions,
    pushPrefsRes,
    pushDevicesRes,
  ] = await Promise.all([
    dateFiltered
      ? supabaseAdmin
          .from('wallet_accounts')
          .select('current_balance')
          .in('customer_id', customerIds)
          .gt('current_balance', 0)
      : supabaseAdmin.from('wallet_accounts').select('current_balance').gt('current_balance', 0),
    membershipQuery,
    dateFiltered
      ? phoneOrFilter
        ? supabaseAdmin
            .from('service_leads')
            .select(CUSTOMER_BOOKING_LEAD_FIELDS)
            .or(phoneOrFilter)
            .limit(5000)
        : Promise.resolve({ data: [] })
      : Promise.all([
          supabaseAdmin.from('service_leads').select('id', { count: 'exact', head: true }),
          supabaseAdmin
            .from('service_leads')
            .select('id', { count: 'exact', head: true })
            .or('coupon_code.not.is.null,discount_amount.gt.0'),
        ]),
    dateFiltered
      ? Promise.resolve({ count: 0 })
      : supabaseAdmin.from('coupon_redemptions').select('id', { count: 'exact', head: true }),
    dateFiltered
      ? supabaseAdmin
          .from('customer_coupon_assignments')
          .select('id, redeemed_at')
          .in('customer_id', customerIds)
      : supabaseAdmin
          .from('customer_coupon_assignments')
          .select('id', { count: 'exact', head: true })
          .is('redeemed_at', null),
    fetchCustomerSessions(supabaseAdmin, dateFiltered ? customerIds : undefined),
    dateFiltered
      ? supabaseAdmin
          .from('customer_notification_preferences')
          .select('customer_id, push_enabled')
          .in('customer_id', customerIds)
      : supabaseAdmin.from('customer_notification_preferences').select('customer_id, push_enabled'),
    dateFiltered
      ? supabaseAdmin
          .from('notification_devices')
          .select('customer_id')
          .eq('platform', MOBILE_PUSH_PLATFORM)
          .eq('is_active', true)
          .in('customer_id', customerIds)
      : supabaseAdmin
          .from('notification_devices')
          .select('customer_id')
          .eq('platform', MOBILE_PUSH_PLATFORM)
          .eq('is_active', true)
          .not('customer_id', 'is', null),
  ]);

  const latestSessionByCustomer = indexLatestSessions(sessions);

  let androidUsers = 0;
  let iosUsers = 0;
  for (const customer of customers) {
    const session = latestSessionByCustomer.get(String(customer.id));
    const platform = resolveAppPlatform(
      customer.app_platform,
      session?.user_agent,
      session?.app_platform,
    );
    if (platform === 'ANDROID') androidUsers += 1;
    else if (platform === 'IOS') iosUsers += 1;
  }

  const wallets = walletRes.data || [];

  let totalServiceBookings = 0;
  let bookingsWithCoupon = 0;
  if (dateFiltered) {
    const leads = ((leadsRes as { data?: any[] }).data || []).filter(isVisibleCustomerBooking);
    totalServiceBookings = leads.length;
    bookingsWithCoupon = leads.filter(
      (lead: any) => String(lead.coupon_code || '').trim() || Number(lead.discount_amount || 0) > 0,
    ).length;
  } else {
    const [allLeads, couponLeads] = leadsRes as [{ count: number | null }, { count: number | null }];
    totalServiceBookings = allLeads.count || 0;
    bookingsWithCoupon = couponLeads.count || 0;
  }

  let couponRedemptions = redemptionRes.count || 0;
  let openCouponAssignments = 0;
  if (dateFiltered) {
    const assignments = assignmentRes.data || [];
    openCouponAssignments = assignments.filter((a: any) => !a.redeemed_at).length;
    couponRedemptions = assignments.filter((a: any) => a.redeemed_at).length;
  } else {
    openCouponAssignments = assignmentRes.count || 0;
  }

  const pushOffIds = new Set<string>();
  for (const p of pushPrefsRes.data || []) {
    if (p.push_enabled === false) pushOffIds.add(String(p.customer_id));
  }
  const pushDeviceIds = new Set<string>();
  for (const d of pushDevicesRes.data || []) {
    if (d.customer_id) pushDeviceIds.add(String(d.customer_id));
  }
  let pushOn = 0;
  let pushOff = 0;
  let pushNoToken = 0;
  for (const customer of customers) {
    const status = resolveCustomerPushStatus(
      pushOffIds.has(String(customer.id)) ? false : true,
      pushDeviceIds.has(String(customer.id)),
    );
    if (status === 'ON') pushOn += 1;
    else if (status === 'OFF') pushOff += 1;
    else pushNoToken += 1;
  }

  return {
    total_customers: customers.length,
    android_users: androidUsers,
    ios_users: iosUsers,
    unknown_platform_users: Math.max(0, customers.length - androidUsers - iosUsers),
    customers_with_wallet_balance: wallets.length,
    total_wallet_balance: wallets.reduce(
      (sum: number, w: any) => sum + Number(w.current_balance || 0),
      0,
    ),
    active_memberships: membershipRes.count || 0,
    total_service_bookings: totalServiceBookings,
    bookings_with_coupon: bookingsWithCoupon,
    coupon_redemptions: couponRedemptions,
    open_coupon_assignments: openCouponAssignments,
    push_on: pushOn,
    push_off: pushOff,
    push_no_token: pushNoToken,
  };
}

export async function enrichCustomerListRows(supabaseAdmin: any, customers: any[]) {
  if (!customers.length) return [];

  const ids = customers.map((c) => String(c.id));
  const nowIso = new Date().toISOString();

  const [wallets, memberships, assignments, sessions, pushPrefs, pushDevices] = await Promise.all([
    selectByIdChunks(supabaseAdmin, 'wallet_accounts', 'customer_id, current_balance', ids),
    selectByIdChunks(
      supabaseAdmin,
      'customer_memberships',
      'customer_id, status, ends_at, created_at, plan:membership_plans(name, code, membership_type)',
      ids,
      'customer_id',
      (q) => q.order('created_at', { ascending: false }),
    ),
    selectByIdChunks(supabaseAdmin, 'customer_coupon_assignments', 'customer_id, redeemed_at', ids),
    fetchCustomerSessions(supabaseAdmin, ids),
    selectByIdChunks(
      supabaseAdmin,
      'customer_notification_preferences',
      'customer_id, push_enabled',
      ids,
    ),
    selectByIdChunks(
      supabaseAdmin,
      'notification_devices',
      'customer_id, last_seen_at, device_name',
      ids,
      'customer_id',
      (q) => q.eq('platform', MOBILE_PUSH_PLATFORM).eq('is_active', true),
    ),
  ]);

  const walletByCustomer = new Map<string, number>();
  for (const w of wallets || []) {
    walletByCustomer.set(String(w.customer_id), Number(w.current_balance || 0));
  }

  const activeMembershipByCustomer = new Map<string, any>();
  for (const m of memberships || []) {
    const cid = String(m.customer_id);
    if (activeMembershipByCustomer.has(cid)) continue;
    const active = m.status === 'ACTIVE' && String(m.ends_at || '') > nowIso;
    if (active) activeMembershipByCustomer.set(cid, m);
  }

  const couponStatsByCustomer = new Map<string, { assigned: number; redeemed: number }>();
  for (const a of assignments || []) {
    const cid = String(a.customer_id);
    const prev = couponStatsByCustomer.get(cid) || { assigned: 0, redeemed: 0 };
    prev.assigned += 1;
    if (a.redeemed_at) prev.redeemed += 1;
    couponStatsByCustomer.set(cid, prev);
  }

  const latestSessionByCustomer = indexLatestSessions(sessions);

  const pushEnabledByCustomer = new Map<string, boolean>();
  for (const p of pushPrefs || []) {
    pushEnabledByCustomer.set(String(p.customer_id), p.push_enabled !== false);
  }
  const pushDeviceByCustomer = new Map<
    string,
    { last_seen_at?: string | null; device_name?: string | null }
  >();
  for (const d of pushDevices || []) {
    const cid = String(d.customer_id);
    if (!pushDeviceByCustomer.has(cid)) {
      pushDeviceByCustomer.set(cid, {
        last_seen_at: d.last_seen_at,
        device_name: d.device_name,
      });
    }
  }

  const digitsList = [...new Set(customers.map((c) => phoneDigits(c.phone)).filter(Boolean))] as string[];
  const bookingsByDigits = new Map<string, number>();
  const couponBookingsByDigits = new Map<string, number>();

  if (digitsList.length) {
    const want = new Set(digitsList);
    let leads: any[] = [];
    if (digitsList.length > 40) {
      const { data } = await supabaseAdmin
        .from('service_leads')
        .select(CUSTOMER_BOOKING_LEAD_FIELDS)
        .limit(20000);
      leads = data || [];
    } else {
      for (const slice of chunkIds(digitsList, 20)) {
        const orFilter = slice.map((d) => `customer_phone.ilike.%${d}`).join(',');
        const { data } = await supabaseAdmin
          .from('service_leads')
          .select(CUSTOMER_BOOKING_LEAD_FIELDS)
          .or(orFilter)
          .limit(5000);
        leads.push(...(data || []));
      }
    }

    for (const lead of leads) {
      if (!isVisibleCustomerBooking(lead)) continue;
      const d = phoneDigits(lead.customer_phone);
      if (!d || !want.has(d)) continue;
      bookingsByDigits.set(d, (bookingsByDigits.get(d) || 0) + 1);
      const hasCoupon = String(lead.coupon_code || '').trim() || Number(lead.discount_amount || 0) > 0;
      if (hasCoupon) couponBookingsByDigits.set(d, (couponBookingsByDigits.get(d) || 0) + 1);
    }
  }

  return customers.map((c) => {
    const digits = phoneDigits(c.phone);
    const couponStats = couponStatsByCustomer.get(String(c.id)) || { assigned: 0, redeemed: 0 };
    const membership = activeMembershipByCustomer.get(String(c.id));
    const session = latestSessionByCustomer.get(String(c.id));
    const appPlatform = resolveAppPlatform(
      c.app_platform,
      session?.user_agent,
      session?.app_platform,
    );
    const cid = String(c.id);
    const device = pushDeviceByCustomer.get(cid);
    const pushEnabled = pushEnabledByCustomer.has(cid)
      ? pushEnabledByCustomer.get(cid)
      : true;
    const pushStatus = resolveCustomerPushStatus(pushEnabled, Boolean(device));

    return {
      ...c,
      app_platform: appPlatform,
      account_status: resolveCustomerAccountStatus(c.account_status, c.is_active),
      wallet_balance: walletByCustomer.get(cid) || 0,
      bookings_count: digits ? bookingsByDigits.get(digits) || 0 : 0,
      coupon_bookings_count: digits ? couponBookingsByDigits.get(digits) || 0 : 0,
      coupon_assigned_count: couponStats.assigned,
      coupon_redeemed_count: couponStats.redeemed,
      has_membership: Boolean(membership),
      membership_plan: membership?.plan?.name || null,
      membership_plan_code: membership?.plan?.code || null,
      membership_type: membership?.plan?.membership_type || null,
      is_app_user: Boolean(c.firebase_uid || c.phone_verified || c.last_login_at),
      push_enabled: pushEnabled !== false,
      push_has_device: Boolean(device),
      push_status: pushStatus,
      push_last_seen_at: device?.last_seen_at || null,
      push_device_name: device?.device_name || null,
    };
  });
}

export function matchesPlatformFilter(platform: AppPlatform | null, filter: string) {
  const normalized = String(filter || 'ALL').trim().toUpperCase();
  if (normalized === 'ALL') return true;
  if (normalized === 'ANDROID') return platform === 'ANDROID';
  if (normalized === 'IOS') return platform === 'IOS';
  if (normalized === 'UNKNOWN') return !platform;
  return true;
}

export async function fetchCustomerDetail(supabaseAdmin: any, customerId: string) {
  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .maybeSingle();

  if (error || !customer) return null;

  const { data: latestSession } = await supabaseAdmin
    .from('customer_sessions')
    .select('user_agent, app_platform')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const phoneFilter = phoneSearchFilter(customer.phone);
  const chatFilter = phoneChatbotFilter(customer.phone);
  const digits = phoneDigits(customer.phone);

  const whatsappFilter = digits
    ? `recipient_phone.ilike.%${digits}%,sender_phone.ilike.%${digits}%`
    : null;
  const rsaFilter = digits ? `contact_number.ilike.%${digits}%` : null;

  const [
    vehiclesRes,
    addressesRes,
    membershipsRes,
    usageRes,
    assignmentsRes,
    eventsRes,
    leadsRes,
    chatbotRes,
    pushPrefsRes,
    pushDevicesRes,
    profileRes,
    referralRes,
    referralEventsRes,
    cartRes,
    whatsappRes,
    rsaRes,
  ] = await Promise.all([
    supabaseAdmin
      .from('customer_vehicles')
      .select('*')
      .eq('customer_id', customerId)
      .order('updated_at', { ascending: false }),
    supabaseAdmin
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', customerId)
      .order('updated_at', { ascending: false }),
    supabaseAdmin
      .from('customer_memberships')
      .select('*, plan:membership_plans(id, code, name, membership_type, price)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('membership_usage')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('customer_coupon_assignments')
      .select(`
        id, notes, expires_at, redeemed_at, created_at,
        coupon:coupons(id, code, description, discount_value, discount_mode, coupon_kind)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('customer_analytics_events')
      .select('id, event_name, event_group, properties, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(50),
    phoneFilter
      ? supabaseAdmin
          .from('service_leads')
          .select('*')
          .or(phoneFilter)
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    chatFilter
      ? supabaseAdmin
          .from('chatbot_bookings')
          .select('*')
          .or(chatFilter)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    supabaseAdmin
      .from('customer_notification_preferences')
      .select('push_enabled')
      .eq('customer_id', customerId)
      .maybeSingle(),
    supabaseAdmin
      .from('notification_devices')
      .select('id, device_name, last_seen_at, is_active')
      .eq('customer_id', customerId)
      .eq('platform', MOBILE_PUSH_PLATFORM)
      .eq('is_active', true)
      .order('last_seen_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('customer_profiles')
      .select('gender, dob, alt_phone, loyalty_tier, preferences')
      .eq('customer_id', customerId)
      .maybeSingle(),
    supabaseAdmin
      .from('referral_codes')
      .select('code, active, usage_count, created_at')
      .eq('customer_id', customerId)
      .maybeSingle(),
    supabaseAdmin
      .from('referral_events')
      .select('id, referrer_customer_id, referee_customer_id, referral_code, status, created_at')
      .or(`referrer_customer_id.eq.${customerId},referee_customer_id.eq.${customerId}`)
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin.from('carts').select('*').eq('customer_id', customerId).maybeSingle(),
    whatsappFilter
      ? supabaseAdmin
          .from('whatsapp_messages')
          .select(
            'id, direction, sender_phone, recipient_phone, message_type, template_name, status, text_body, created_at, lead_id',
          )
          .or(whatsappFilter)
          .order('created_at', { ascending: false })
          .limit(25)
      : Promise.resolve({ data: [] }),
    rsaFilter
      ? supabaseAdmin
          .from('rsa_leads')
          .select(
            'id, customer_name, contact_number, lead_status, complaint_status, vehicle_number, vehicle_model, service_type, address, pincode, lead_registered_at',
          )
          .or(rsaFilter)
          .order('lead_registered_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  let cartItems: any[] = [];
  const cartRow = cartRes?.error ? null : cartRes?.data || null;
  if (cartRow?.id) {
    const { data: itemRows } = await supabaseAdmin
      .from('cart_items')
      .select('id, cart_id, item_type, service_type, quantity, unit_price, total_price, metadata, created_at')
      .eq('cart_id', cartRow.id)
      .order('created_at', { ascending: false });
    cartItems = itemRows || [];
  }

  const leads = (leadsRes.data || []).filter(isVisibleCustomerBooking).map((l: any) => enrichBookingLead(l));

  const pbConfig = await getPostBookingMembershipConfig(supabaseAdmin);
  const syncedLeads = await Promise.all(
    leads.map((lead: Record<string, unknown>) =>
      syncServiceLeadMembershipPricingForAdmin(supabaseAdmin, lead, pbConfig),
    ),
  );

  await enrichLeadsServiceDisplay(supabaseAdmin, syncedLeads);

  const leadIds = syncedLeads.map((lead) => String(lead.id || '')).filter(Boolean);
  const walletDebitByLeadId = new Map<string, { amount: number; percent?: number }>();

  if (leadIds.length) {
    const { data: bookingWalletTx } = await supabaseAdmin
      .from('wallet_transactions')
      .select('amount, idempotency_key, metadata, source')
      .eq('customer_id', customerId)
      .eq('transaction_type', 'DEBIT');

    for (const tx of bookingWalletTx || []) {
      const txMeta =
        tx.metadata && typeof tx.metadata === 'object'
          ? (tx.metadata as Record<string, unknown>)
          : {};
      const leadId =
        String(txMeta.lead_id || '').trim() ||
        String(tx.idempotency_key || '')
          .replace(/^booking:/, '')
          .trim();
      if (!leadId || !leadIds.includes(leadId)) continue;
      const amt = Math.abs(Number(tx.amount || 0));
      if (amt <= 0) continue;
      walletDebitByLeadId.set(leadId, {
        amount: amt,
        percent: Number(txMeta.usage_percent || 0) || undefined,
      });
    }
  }

  const serviceBookings = syncedLeads.map((lead: Record<string, unknown>) => {
    const leadId = String(lead.id || '');
    const walletTx = walletDebitByLeadId.get(leadId);
    const payable = resolveAdminBookingPayableAmount(lead, pbConfig);
    const pricing = getLeadPricingBreakdown(lead, {
      walletTxAmount: walletTx?.amount,
      walletTxPercent: walletTx?.percent,
      payableOverride: payable,
    });

    return {
      ...lead,
      payment_amount: pricing.payable,
      vehicle_display: getLeadVehicleLabel(lead),
      original_amount: pricing.original,
      wallet_used: pricing.walletUsed,
      wallet_usage_percent: pricing.walletUsagePercent,
      coupon_discount_amount: pricing.couponDiscount,
      referred_by: parseReferredBy(lead.coupon_meta),
    };
  });

  const manualRefs = await loadCrmManualReferencesForCustomer(supabaseAdmin, {
    leads: syncedLeads,
    phone: customer.phone,
    customerId,
  });
  const telecallerNameById = new Map(manualRefs.telecallers.map((t) => [t.id, t.name]));
  const serviceBookingsWithTele = serviceBookings.map((lead: Record<string, unknown>) => {
    const assigned = String(lead.assigned_telecaller_id || '').trim();
    const createdBy = String(lead.created_by_id || '').trim();
    return {
      ...lead,
      assigned_telecaller_name:
        (assigned && telecallerNameById.get(assigned)) ||
        (createdBy && telecallerNameById.get(createdBy)) ||
        null,
    };
  });
  const walletSummary = await getWalletSummary(supabaseAdmin, customerId).catch(() => null);
  const walletTotals = await computeWalletRewardTotals(supabaseAdmin, customerId).catch(() => ({
    earned_cashback: 0,
    referral_rewards: 0,
    reward_points: 0,
  }));
  const { data: walletTransactions } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, transaction_type, amount, source, created_at, balance_after, metadata, expires_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(200);

  let redemptions: any[] = [];
  if (digits) {
    const { data: redemptionRows } = await supabaseAdmin
      .from('coupon_redemptions')
      .select(`
        id, coupon_id, service_lead_id, discount_amount_applied, meta, created_at,
        coupon:coupons(code, description)
      `)
      .order('created_at', { ascending: false })
      .limit(300);

    redemptions = (redemptionRows || []).filter((row: any) => {
      const metaPhone = phoneDigits(row.meta?.customer_phone);
      return metaPhone === digits;
    });
  }

  const leadByIdForUsage: Record<string, { deleted_at?: unknown; status?: unknown }> = {};
  for (const lead of leadsRes.data || []) {
    leadByIdForUsage[String(lead.id)] = lead;
  }

  const benefitCodes = [
    ...new Set(
      (usageRes.data || [])
        .filter((u: any) => usageCountsTowardBenefitQuota(u, leadByIdForUsage))
        .map((u: any) => u.benefit_code)
        .filter(Boolean),
    ),
  ];
  const benefitTitleByCode = new Map<string, string>();
  if (benefitCodes.length) {
    const { data: benefitRows } = await supabaseAdmin
      .from('membership_benefits')
      .select('benefit_code, title')
      .in('benefit_code', benefitCodes);
    for (const b of benefitRows || []) {
      benefitTitleByCode.set(String(b.benefit_code), String(b.title || b.benefit_code));
    }
  }

  const usage = (usageRes.data || [])
    .filter((u: any) => usageCountsTowardBenefitQuota(u, leadByIdForUsage))
    .map((u: any) => ({
      ...u,
      benefit_title: benefitTitleByCode.get(String(u.benefit_code)) || u.benefit_code,
    }));

  const pushEnabled = pushPrefsRes.data?.push_enabled !== false;
  const pushDevices = pushDevicesRes.data || [];
  const pushHasDevice = pushDevices.length > 0;
  const pushStatus = resolveCustomerPushStatus(pushEnabled, pushHasDevice);

  return {
    customer: {
      ...customer,
      app_platform: resolveAppPlatform(customer.app_platform, latestSession?.user_agent, latestSession?.app_platform),
      account_status: resolveCustomerAccountStatus(customer.account_status, customer.is_active),
      push_enabled: pushEnabled,
      push_has_device: pushHasDevice,
      push_status: pushStatus,
      push_last_seen_at: pushDevices[0]?.last_seen_at || null,
      push_device_name: pushDevices[0]?.device_name || null,
    },
    vehicles: vehiclesRes.data || [],
    addresses: addressesRes.data || [],
    profile: profileRes?.error ? null : profileRes?.data || null,
    referral: referralRes?.error ? null : referralRes?.data || null,
    referral_events: referralEventsRes?.error ? [] : referralEventsRes?.data || [],
    manual_referral: {
      referred_by: manualRefs.referred_by,
      telecallers: manualRefs.telecallers,
      references_given: manualRefs.references_given,
    },
    cart: cartRow
      ? {
          ...cartRow,
          items: cartItems,
        }
      : null,
    whatsapp_messages: whatsappRes?.error ? [] : whatsappRes?.data || [],
    rsa_leads: rsaRes?.error ? [] : rsaRes?.data || [],
    wallet: walletSummary
      ? {
          ...walletSummary.wallet,
          spendable_balance: walletSummary.spendable_balance,
          welcome_bonus_expires_at: walletSummary.welcome_bonus_expires_at,
          totals: walletTotals,
        }
      : null,
    wallet_transactions: filterVisibleWalletTransactions(walletTransactions || []),
    memberships: (membershipsRes.data || []).map((m: any) => {
      const fromMembership = parseClaimsButtonOverride(m.claims_button_override);
      const fromPrefs = parseClaimsButtonOverride(
        profileRes?.data?.preferences && typeof profileRes.data.preferences === 'object'
          ? (profileRes.data.preferences as Record<string, unknown>).membership_claims_button
          : 'AUTO',
      );
      return {
        ...m,
        claims_button_override: fromMembership !== 'AUTO' ? fromMembership : fromPrefs,
      };
    }),
    membership_usage: usage,
    coupon_assignments: assignmentsRes.data || [],
    coupon_redemptions: redemptions,
    service_bookings: serviceBookingsWithTele,
    chatbot_bookings: chatbotRes.data || [],
    analytics_events: eventsRes.data || [],
    push_devices: pushDevices,
  };
}
