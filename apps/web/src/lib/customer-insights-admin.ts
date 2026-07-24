import { normalizePhone } from './coupon-rules';
import { enrichBookingLead, enrichLeadsServiceDisplay, getLeadVehicleLabel, getLeadPricingBreakdown } from './booking-lead-utils';
import { getPostBookingMembershipConfig } from './post-booking-membership-config';
import { syncServiceLeadMembershipPricingForAdmin, resolveAdminBookingPayableAmount } from './post-booking-membership-offer';
import { computeWalletRewardTotals, filterVisibleWalletTransactions, getWalletSummary } from './wallet-service';
import { resolveAppPlatform, type AppPlatform } from './app-platform';
import { resolveCustomerAccountStatus } from './customer-account-admin';
import {
  applyReportDateRangeFilter,
  shouldApplyDateRangeFilter,
} from './report-date-range';

async function fetchCustomerSessions(
  supabaseAdmin: any,
  customerIds?: string[],
): Promise<Array<{ customer_id: string; user_agent?: string | null; app_platform?: string | null; created_at?: string }>> {
  let query = supabaseAdmin
    .from('customer_sessions')
    .select('customer_id, app_platform, user_agent, created_at')
    .order('created_at', { ascending: false });

  if (customerIds?.length) {
    query = query.in('customer_id', customerIds);
  }

  const { data, error } = await query;
  if (!error) return data || [];

  let fallbackQuery = supabaseAdmin
    .from('customer_sessions')
    .select('customer_id, user_agent, created_at')
    .order('created_at', { ascending: false });
  if (customerIds?.length) {
    fallbackQuery = fallbackQuery.in('customer_id', customerIds);
  }
  const { data: fallbackData } = await fallbackQuery;
  return fallbackData || [];
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

  let customersQuery = supabaseAdmin.from('customers').select('id, phone, app_platform');
  customersQuery = applyReportDateRangeFilter(
    customersQuery,
    'created_at',
    preset,
    options?.start,
    options?.end,
  );

  const { data: customersData } = await customersQuery;
  const customers = customersData || [];
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
            .select('id, coupon_code, discount_amount')
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
    const leads = (leadsRes as { data?: any[] }).data || [];
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
  };
}

export async function enrichCustomerListRows(supabaseAdmin: any, customers: any[]) {
  if (!customers.length) return [];

  const ids = customers.map((c) => c.id);
  const nowIso = new Date().toISOString();

  const [{ data: wallets }, { data: memberships }, { data: assignments }, sessions] =
    await Promise.all([
    supabaseAdmin.from('wallet_accounts').select('customer_id, current_balance').in('customer_id', ids),
    supabaseAdmin
      .from('customer_memberships')
      .select('customer_id, status, ends_at, plan:membership_plans(name, code, membership_type)')
      .in('customer_id', ids)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('customer_coupon_assignments')
      .select('customer_id, redeemed_at')
      .in('customer_id', ids),
    fetchCustomerSessions(supabaseAdmin, ids),
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

  const digitsList = [...new Set(customers.map((c) => phoneDigits(c.phone)).filter(Boolean))] as string[];
  const bookingsByDigits = new Map<string, number>();
  const couponBookingsByDigits = new Map<string, number>();

  if (digitsList.length) {
    const orFilter = digitsList.map((d) => `customer_phone.ilike.%${d}`).join(',');
    const { data: leads } = await supabaseAdmin
      .from('service_leads')
      .select('customer_phone, coupon_code, discount_amount')
      .or(orFilter)
      .limit(5000);

    for (const lead of leads || []) {
      const d = phoneDigits(lead.customer_phone);
      if (!d) continue;
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

    return {
      ...c,
      app_platform: appPlatform,
      account_status: resolveCustomerAccountStatus(c.account_status, c.is_active),
      wallet_balance: walletByCustomer.get(String(c.id)) || 0,
      bookings_count: digits ? bookingsByDigits.get(digits) || 0 : 0,
      coupon_bookings_count: digits ? couponBookingsByDigits.get(digits) || 0 : 0,
      coupon_assigned_count: couponStats.assigned,
      coupon_redeemed_count: couponStats.redeemed,
      has_membership: Boolean(membership),
      membership_plan: membership?.plan?.name || null,
      membership_plan_code: membership?.plan?.code || null,
      membership_type: membership?.plan?.membership_type || null,
      is_app_user: Boolean(c.firebase_uid || c.phone_verified || c.last_login_at),
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

  const [
    vehiclesRes,
    addressesRes,
    membershipsRes,
    usageRes,
    assignmentsRes,
    eventsRes,
    leadsRes,
    chatbotRes,
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
  ]);

  const leads = (leadsRes.data || []).map((l: any) => enrichBookingLead(l));

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

  const benefitCodes = [...new Set((usageRes.data || []).map((u: any) => u.benefit_code).filter(Boolean))];
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

  const usage = (usageRes.data || []).map((u: any) => ({
    ...u,
    benefit_title: benefitTitleByCode.get(String(u.benefit_code)) || u.benefit_code,
  }));

  return {
    customer: {
      ...customer,
      app_platform: resolveAppPlatform(customer.app_platform, latestSession?.user_agent, latestSession?.app_platform),
      account_status: resolveCustomerAccountStatus(customer.account_status, customer.is_active),
    },
    vehicles: vehiclesRes.data || [],
    addresses: addressesRes.data || [],
    wallet: walletSummary
      ? {
          ...walletSummary.wallet,
          spendable_balance: walletSummary.spendable_balance,
          welcome_bonus_expires_at: walletSummary.welcome_bonus_expires_at,
          totals: walletTotals,
        }
      : null,
    wallet_transactions: filterVisibleWalletTransactions(walletTransactions || []),
    memberships: membershipsRes.data || [],
    membership_usage: usage,
    coupon_assignments: assignmentsRes.data || [],
    coupon_redemptions: redemptions,
    service_bookings: serviceBookings,
    chatbot_bookings: chatbotRes.data || [],
    analytics_events: eventsRes.data || [],
  };
}
