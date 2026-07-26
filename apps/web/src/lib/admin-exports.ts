import { enrichBookingLead, filterBookingLeads, enrichLeadsServiceDisplay, getLeadServiceLabel, getLeadDisplayAmount } from './booking-lead-utils';
import { enrichCustomerListRows, matchesPlatformFilter } from './customer-insights-admin';
import { resolveReportDateRange, rowsToCsv } from './report-date-range';

const SERVICE_LEADS_CSV_COLUMNS = [
  { key: 'lead_number', label: 'Lead #' },
  { key: 'source', label: 'Source' },
  { key: 'customer_name', label: 'Customer' },
  { key: 'customer_phone', label: 'Phone' },
  { key: 'vehicle_number', label: 'Vehicle' },
  { key: 'city', label: 'City' },
  { key: 'service', label: 'Service' },
  { key: 'coupon_code', label: 'Coupon' },
  { key: 'discount_amount', label: 'Discount' },
  { key: 'status', label: 'Status' },
  { key: 'amount', label: 'Amount' },
  { key: 'created_at', label: 'Date' },
] as const;

const CHATBOT_BOOKINGS_CSV_COLUMNS = [
  { key: 'customer_name', label: 'Customer' },
  { key: 'phone_number', label: 'Phone' },
  { key: 'car_model', label: 'Car Model' },
  { key: 'city', label: 'City' },
  { key: 'service_name', label: 'Service' },
  { key: 'service_category', label: 'Category' },
  { key: 'quoted_price', label: 'Price' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Date' },
] as const;

const CUSTOMERS_CSV_COLUMNS = [
  { key: 'full_name', label: 'Customer' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'app_platform', label: 'Platform' },
  { key: 'created_at', label: 'Joined' },
  { key: 'bookings_count', label: 'Bookings' },
  { key: 'wallet_balance', label: 'Wallet' },
  { key: 'membership_plan', label: 'Membership' },
  { key: 'coupon_assigned_count', label: 'Coupons Assigned' },
  { key: 'coupon_bookings_count', label: 'Coupon Bookings' },
  { key: 'account_status', label: 'Account Status' },
] as const;

function formatCsvDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type DateRangeOpts = {
  preset?: string;
  start?: string | null;
  end?: string | null;
};

export async function exportServiceLeadsCsv(
  supabaseAdmin: any,
  opts: DateRangeOpts & {
    search?: string;
    status?: string;
    source?: string;
    hasCoupon?: string;
  },
) {
  const range = resolveReportDateRange(opts.preset || 'last_30_days', opts.start, opts.end);

  let query = supabaseAdmin
    .from('service_leads')
    .select('*')
    .is('deleted_at', null)
    .gte('created_at', range.start)
    .lte('created_at', range.end)
    .order('created_at', { ascending: false })
    .limit(10000);

  const status = String(opts.status || 'ALL').trim().toUpperCase();
  if (status && status !== 'ALL') {
    query = query.eq('status', status);
  }

  const search = String(opts.search || '').trim();
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
      ].join(','),
    );
  }

  const { data, error } = await query;
  if (error) throw new Error('Failed to export service leads');

  let leads = (data || []).map((lead: Record<string, unknown>) => enrichBookingLead(lead));
  leads = filterBookingLeads(leads, {
    source: String(opts.source || 'ALL').trim().toUpperCase(),
    hasCoupon: String(opts.hasCoupon || 'ALL').trim().toUpperCase(),
    search: '',
  });

  await enrichLeadsServiceDisplay(supabaseAdmin, leads);

  const csvRows = leads.map((lead) => ({
    lead_number: lead.lead_number || '',
    source: lead.booking_source_label || lead.lead_source || '',
    customer_name: lead.customer_name || '',
    customer_phone: lead.customer_phone || '',
    vehicle_number: lead.vehicle_number || '',
    city: lead.city || '',
    service: getLeadServiceLabel(lead),
    coupon_code: lead.coupon_display_code || lead.coupon_code || '',
    discount_amount: lead.coupon_display_discount ?? lead.discount_amount ?? '',
    status: lead.status || '',
    amount: getLeadDisplayAmount(lead),
    created_at: formatCsvDate(lead.created_at),
  }));

  return {
    csv: rowsToCsv(csvRows, [...SERVICE_LEADS_CSV_COLUMNS]),
    filename: `service-leads-${range.startYmd}-to-${range.endYmd}.csv`,
    range,
    count: csvRows.length,
  };
}

export async function exportChatbotBookingsCsv(
  supabaseAdmin: any,
  opts: DateRangeOpts & {
    search?: string;
    status?: string;
  },
) {
  const range = resolveReportDateRange(opts.preset || 'last_30_days', opts.start, opts.end);

  let query = supabaseAdmin
    .from('chatbot_bookings')
    .select('*')
    .gte('created_at', range.start)
    .lte('created_at', range.end)
    .order('created_at', { ascending: false })
    .limit(10000);

  const status = String(opts.status || 'ALL').trim().toLowerCase();
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const search = String(opts.search || '').trim();
  if (search) {
    query = query.or(
      [
        `customer_name.ilike.%${search}%`,
        `phone_number.ilike.%${search}%`,
        `car_model.ilike.%${search}%`,
        `city.ilike.%${search}%`,
        `service_name.ilike.%${search}%`,
        `service_category.ilike.%${search}%`,
      ].join(','),
    );
  }

  const { data, error } = await query;
  if (error) throw new Error('Failed to export AI bookings');

  const csvRows = (data || []).map((booking: Record<string, unknown>) => ({
    customer_name: booking.customer_name || '',
    phone_number: booking.phone_number || '',
    car_model: booking.car_model || '',
    city: booking.city || '',
    service_name: booking.service_name || '',
    service_category: booking.service_category || '',
    quoted_price: booking.quoted_price ?? '',
    status: booking.status || '',
    created_at: formatCsvDate(String(booking.created_at || '')),
  }));

  return {
    csv: rowsToCsv(csvRows, [...CHATBOT_BOOKINGS_CSV_COLUMNS]),
    filename: `ai-bookings-${range.startYmd}-to-${range.endYmd}.csv`,
    range,
    count: csvRows.length,
  };
}

export async function exportCustomersCsv(
  supabaseAdmin: any,
  opts: DateRangeOpts & {
    search?: string;
    filter?: string;
    platform?: string;
  },
) {
  const range = resolveReportDateRange(opts.preset || 'last_30_days', opts.start, opts.end);
  const filter = String(opts.filter || 'ALL').trim().toUpperCase();
  const platform = String(opts.platform || 'ALL').trim().toUpperCase();
  const search = String(opts.search || '').trim();

  let query = supabaseAdmin
    .from('customers')
    .select(
      'id, phone, email, full_name, firebase_uid, phone_verified, last_login_at, created_at, is_active, app_platform, account_status, account_status_reason, account_status_changed_at',
    )
    .gte('created_at', range.start)
    .lte('created_at', range.end)
    .order('created_at', { ascending: false })
    .limit(10000);

  if (search) {
    query = query.or(
      [`full_name.ilike.%${search}%`, `phone.ilike.%${search}%`, `email.ilike.%${search}%`].join(','),
    );
  }

  const { data, error } = await query;
  if (error) throw new Error('Failed to export customers');

  let customers = await enrichCustomerListRows(supabaseAdmin, data || []);

  if (filter === 'WITH_BOOKING') {
    customers = customers.filter((c) => c.bookings_count > 0);
  } else if (filter === 'WITH_MEMBERSHIP') {
    customers = customers.filter((c) => c.has_membership);
  } else if (filter === 'WITH_WALLET') {
    customers = customers.filter((c) => Number(c.wallet_balance || 0) > 0);
  } else if (filter === 'WITH_COUPON') {
    customers = customers.filter(
      (c) => c.coupon_assigned_count > 0 || c.coupon_bookings_count > 0 || c.coupon_redeemed_count > 0,
    );
  }

  if (platform !== 'ALL') {
    customers = customers.filter((c) => matchesPlatformFilter(c.app_platform, platform));
  }

  const csvRows = customers.map((c) => ({
    full_name: c.full_name || 'Unnamed',
    phone: c.phone || '',
    email: c.email || '',
    app_platform: c.app_platform || '',
    created_at: formatCsvDate(c.created_at),
    bookings_count: c.bookings_count ?? 0,
    wallet_balance: c.wallet_balance ?? 0,
    membership_plan: c.has_membership ? c.membership_plan || c.membership_type || 'Yes' : '',
    coupon_assigned_count: c.coupon_assigned_count ?? 0,
    coupon_bookings_count: c.coupon_bookings_count ?? 0,
    account_status: c.account_status || 'ACTIVE',
  }));

  return {
    csv: rowsToCsv(csvRows, [...CUSTOMERS_CSV_COLUMNS]),
    filename: `app-customers-${range.startYmd}-to-${range.endYmd}.csv`,
    range,
    count: csvRows.length,
  };
}
