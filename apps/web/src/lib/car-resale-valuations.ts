import { findCustomerByPhone, normalizeCustomerPhone } from '@/lib/customer-service-leads';
import { enrichListRowsWithCrossToolLinks } from '@/lib/smart-tools-customer-activity';
import { findCustomerByRegNumber, normalizeHealthPlatform } from '@/lib/vehicle-health-reports';
import { resolveReportDateRange, rowsToCsv } from '@/lib/report-date-range';

export const RESALE_VALUATION_CSV_COLUMNS = [
  { key: 'created_at', label: 'Generated At' },
  { key: 'customer_name', label: 'Customer Name' },
  { key: 'customer_phone', label: 'Phone' },
  { key: 'platform', label: 'Platform' },
  { key: 'make', label: 'Make' },
  { key: 'model', label: 'Model' },
  { key: 'vehicle_number', label: 'Reg Number' },
  { key: 'registration_year', label: 'Year' },
  { key: 'fuel', label: 'Fuel' },
  { key: 'transmission', label: 'Transmission' },
  { key: 'odometer', label: 'Odometer (km)' },
  { key: 'owners', label: 'Owners' },
  { key: 'condition', label: 'Condition' },
  { key: 'had_accident', label: 'Major Accident' },
  { key: 'insurance_valid', label: 'Insurance Valid' },
  { key: 'service_records', label: 'Service Records' },
  { key: 'city_name', label: 'City' },
  { key: 'city_tier', label: 'City Tier' },
  { key: 'estimate_low', label: 'Estimate Low' },
  { key: 'estimate_mid', label: 'Estimate Mid' },
  { key: 'estimate_high', label: 'Estimate High' },
] as const;

export async function enrichResaleValuationRows(db: any, rows: any[], persist = true) {
  const phoneCache = new Map<string, any>();
  const regCache = new Map<string, any>();

  return Promise.all(
    rows.map(async (row) => {
      const next = { ...row };
      const patch: Record<string, unknown> = {};

      const hasPlatform = next.platform && String(next.platform).toUpperCase() !== 'UNKNOWN';
      if (next.customer_id && next.customer_name && next.customer_phone && hasPlatform) {
        return next;
      }

      let customer: any = null;

      const phone = normalizeCustomerPhone(next.customer_phone);
      if (phone) {
        customer = phoneCache.get(phone);
        if (customer === undefined) {
          customer = await findCustomerByPhone(db, phone);
          phoneCache.set(phone, customer);
        }
      }

      if (!customer && next.vehicle_number) {
        const reg = String(next.vehicle_number).trim().toUpperCase();
        customer = regCache.get(reg);
        if (customer === undefined) {
          customer = await findCustomerByRegNumber(db, reg);
          regCache.set(reg, customer);
        }
      }

      if (customer) {
        if (!next.customer_id && customer.id) {
          next.customer_id = customer.id;
          patch.customer_id = customer.id;
        }
        if (!next.customer_name && customer.full_name) {
          next.customer_name = customer.full_name;
          patch.customer_name = customer.full_name;
        }
        if (!next.customer_phone && customer.phone) {
          next.customer_phone = normalizeCustomerPhone(customer.phone) || customer.phone;
          patch.customer_phone = next.customer_phone;
        }
        if (!hasPlatform && customer.app_platform) {
          const platform = normalizeHealthPlatform(customer.app_platform);
          if (platform !== 'UNKNOWN') {
            next.platform = platform;
            patch.platform = platform;
          }
        }
      }

      if (!hasPlatform && !patch.platform) {
        const jsonPlatform =
          next.valuation_json?.client?.platform ||
          next.valuation_json?.client?.os;
        if (jsonPlatform) {
          const platform = normalizeHealthPlatform(jsonPlatform);
          if (platform !== 'UNKNOWN') {
            next.platform = platform;
            patch.platform = platform;
          }
        }
      }

      if (persist && row?.id && Object.keys(patch).length) {
        try {
          await db.from('car_resale_valuations').update(patch).eq('id', row.id);
        } catch {
          /* non-blocking backfill */
        }
      }

      return next;
    }),
  );
}

function mapRowForCsv(row: any) {
  return {
    created_at: row.created_at ? new Date(row.created_at).toLocaleString('en-IN') : '',
    customer_name: row.customer_name || '',
    customer_phone: row.customer_phone || '',
    platform: row.platform || '',
    make: row.make || '',
    model: row.model || '',
    vehicle_number: row.vehicle_number || '',
    registration_year: row.registration_year ?? '',
    fuel: row.fuel || '',
    transmission: row.transmission || '',
    odometer: row.odometer ?? '',
    owners: row.owners ?? '',
    condition: row.condition || '',
    had_accident: row.had_accident ? 'Yes' : 'No',
    insurance_valid: row.insurance_valid == null ? '' : row.insurance_valid ? 'Yes' : 'No',
    service_records: row.service_records || '',
    city_name: row.city_name || '',
    city_tier: row.city_tier || '',
    estimate_low: row.estimate_low ?? '',
    estimate_mid: row.estimate_mid ?? '',
    estimate_high: row.estimate_high ?? '',
  };
}

export async function fetchCarResaleValuations(
  db: any,
  opts: {
    preset?: string;
    customStart?: string | null;
    customEnd?: string | null;
    q?: string;
    platform?: string;
    limit?: number;
    offset?: number;
  },
) {
  const range = resolveReportDateRange(opts.preset, opts.customStart, opts.customEnd);
  const q = String(opts.q || '').trim();
  const platform = String(opts.platform || 'all').trim().toUpperCase();
  const limit = Math.min(Math.max(Number(opts.limit || 50), 1), 5000);
  const offset = Math.max(Number(opts.offset || 0), 0);

  let query = db
    .from('car_resale_valuations')
    .select(
      'id, make, model, vehicle_number, registration_year, fuel, transmission, odometer, owners, condition, had_accident, insurance_valid, service_records, city_name, city_tier, estimate_low, estimate_mid, estimate_high, customer_name, customer_phone, customer_id, platform, created_at',
      { count: 'exact' },
    )
    .gte('created_at', range.start)
    .lte('created_at', range.end)
    .order('created_at', { ascending: false });

  if (platform && platform !== 'ALL') {
    query = query.eq('platform', platform === 'IOS' ? 'IOS' : platform === 'ANDROID' ? 'ANDROID' : platform);
  }

  if (q) {
    query = query.or(
      `make.ilike.%${q}%,model.ilike.%${q}%,vehicle_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,city_name.ilike.%${q}%`,
    );
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  const enriched = await enrichResaleValuationRows(db, data || []);
  let items: any[];
  try {
    items = await enrichListRowsWithCrossToolLinks(db, enriched, 'resale');
  } catch {
    items = enriched;
  }

  const { data: allInRange, error: statsError } = await db
    .from('car_resale_valuations')
    .select('estimate_mid, platform')
    .gte('created_at', range.start)
    .lte('created_at', range.end);

  if (statsError) throw statsError;

  const statsRows = allInRange || [];
  const android = statsRows.filter((r: any) => String(r.platform || '').toUpperCase() === 'ANDROID').length;
  const ios = statsRows.filter((r: any) => String(r.platform || '').toUpperCase() === 'IOS').length;
  const unknown = statsRows.length - android - ios;
  const avgMid =
    statsRows.length > 0
      ? Math.round(statsRows.reduce((sum: number, r: any) => sum + Number(r.estimate_mid || 0), 0) / statsRows.length)
      : 0;

  return {
    range: { ...range, label: range.label },
    items,
    count: count ?? items.length,
    limit,
    offset,
    summary: {
      total_valuations: statsRows.length,
      android,
      ios,
      unknown_platform: unknown,
      avg_mid_estimate: avgMid,
    },
  };
}

export async function exportCarResaleValuationsCsv(
  db: any,
  opts: {
    preset?: string;
    customStart?: string | null;
    customEnd?: string | null;
    q?: string;
    platform?: string;
  },
) {
  const report = await fetchCarResaleValuations(db, { ...opts, limit: 5000, offset: 0 });
  const rows = report.items.map(mapRowForCsv);
  const csv = rowsToCsv(rows, RESALE_VALUATION_CSV_COLUMNS as any);
  const summary = [
    'MyFNG Car Resale Value Export',
    `Range: ${report.range.label}`,
    `Total valuations: ${report.summary.total_valuations}`,
    `Android: ${report.summary.android} | iOS: ${report.summary.ios} | Unknown: ${report.summary.unknown_platform}`,
    `Average mid estimate: ₹${report.summary.avg_mid_estimate.toLocaleString('en-IN')}`,
  ].join('\n');

  const stamp = new Date().toISOString().slice(0, 10);
  return {
    csv,
    summary,
    filename: `car-resale-valuations-${stamp}.csv`,
  };
}

export { normalizeHealthPlatform };
