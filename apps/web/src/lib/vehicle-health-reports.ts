import { findCustomerByPhone, normalizeCustomerPhone } from '@/lib/customer-service-leads';
import { enrichListRowsWithCrossToolLinks } from '@/lib/smart-tools-customer-activity';
import { resolveReportDateRange, rowsToCsv } from '@/lib/report-date-range';

export type HealthReportPlatform = 'ANDROID' | 'IOS' | 'UNKNOWN';

export const HEALTH_REPORT_CSV_COLUMNS = [
  { key: 'created_at', label: 'Generated At' },
  { key: 'customer_name', label: 'Customer Name' },
  { key: 'customer_phone', label: 'Phone' },
  { key: 'platform', label: 'Platform' },
  { key: 'reg_number', label: 'Reg Number' },
  { key: 'make', label: 'Make' },
  { key: 'model', label: 'Model' },
  { key: 'fuel', label: 'Fuel' },
  { key: 'registration_year', label: 'Year' },
  { key: 'odometer', label: 'Odometer (km)' },
  { key: 'composite_score', label: 'Risk Score' },
  { key: 'band_label', label: 'Band' },
  { key: 'accuracy', label: 'Accuracy' },
] as const;

export function normalizeHealthPlatform(raw?: string | null): HealthReportPlatform {
  const v = String(raw || '').trim().toUpperCase();
  if (v === 'IOS' || v === 'IPHONE' || v === 'IPAD') return 'IOS';
  if (v === 'ANDROID') return 'ANDROID';
  return 'UNKNOWN';
}

function normalizeRegNumber(raw?: string | null): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '');
}

export async function findCustomerByRegNumber(db: any, regNumber?: string | null) {
  const reg = normalizeRegNumber(regNumber);
  if (!reg) return null;

  const tail = reg.length >= 4 ? reg.slice(-6) : reg;
  const { data: vehicles } = await db
    .from('customer_vehicles')
    .select('customer_id, vehicle_number')
    .ilike('vehicle_number', `%${tail}%`)
    .limit(50);

  const match = (vehicles || []).find(
    (v: any) => normalizeRegNumber(v.vehicle_number) === reg,
  );
  if (!match?.customer_id) return null;

  const { data: customer } = await db
    .from('customers')
    .select('id, phone, full_name, app_platform')
    .eq('id', match.customer_id)
    .maybeSingle();

  return customer || null;
}

async function persistHealthReportEnrichment(db: any, row: any, patch: Record<string, unknown>) {
  if (!row?.id || !Object.keys(patch).length) return;
  try {
    await db.from('vehicle_health_reports').update(patch).eq('id', row.id);
  } catch {
    /* non-blocking backfill */
  }
}

export async function enrichHealthReportRows(db: any, rows: any[], persist = true) {
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
          if (customer?.id) {
            const { data: extra } = await db
              .from('customers')
              .select('app_platform')
              .eq('id', customer.id)
              .maybeSingle();
            customer = { ...customer, app_platform: extra?.app_platform || null };
          }
          phoneCache.set(phone, customer);
        }
      }

      if (!customer) {
        const reg = normalizeRegNumber(next.reg_number);
        if (reg) {
          customer = regCache.get(reg);
          if (customer === undefined) {
            customer = await findCustomerByRegNumber(db, reg);
            regCache.set(reg, customer);
          }
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
          next.report_json?.client?.platform ||
          next.report_json?.client?.os ||
          next.report_json?.platform;
        if (jsonPlatform) {
          const platform = normalizeHealthPlatform(jsonPlatform);
          if (platform !== 'UNKNOWN') {
            next.platform = platform;
            patch.platform = platform;
          }
        }
      }

      if (!next.platform) next.platform = null;

      if (persist && Object.keys(patch).length) {
        await persistHealthReportEnrichment(db, row, patch);
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
    reg_number: row.reg_number || '',
    make: row.make || '',
    model: row.model || '',
    fuel: row.fuel || '',
    registration_year: row.registration_year ?? '',
    odometer: row.odometer ?? '',
    composite_score: row.composite_score ?? '',
    band_label: row.band_label || '',
    accuracy: row.accuracy || '',
  };
}

export async function fetchVehicleHealthReports(
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
    .from('vehicle_health_reports')
    .select(
      'id, reg_number, make, model, fuel, registration_year, odometer, composite_score, band_label, accuracy, customer_name, customer_phone, customer_id, platform, created_at',
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
      `reg_number.ilike.%${q}%,make.ilike.%${q}%,model.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`,
    );
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  const enriched = await enrichHealthReportRows(db, data || []);
  const items = await enrichListRowsWithCrossToolLinks(db, enriched, 'health');

  const { data: allInRange, error: statsError } = await db
    .from('vehicle_health_reports')
    .select('composite_score, band_label, platform')
    .gte('created_at', range.start)
    .lte('created_at', range.end);

  if (statsError) throw statsError;

  const statsRows = allInRange || [];
  const android = statsRows.filter((r: any) => String(r.platform || '').toUpperCase() === 'ANDROID').length;
  const ios = statsRows.filter((r: any) => String(r.platform || '').toUpperCase() === 'IOS').length;
  const unknown = statsRows.length - android - ios;
  const avgScore =
    statsRows.length > 0
      ? Math.round(statsRows.reduce((sum: number, r: any) => sum + Number(r.composite_score || 0), 0) / statsRows.length)
      : 0;
  const urgent = statsRows.filter((r: any) => {
    const label = String(r.band_label || '').toLowerCase();
    return label.includes('urgent') || Number(r.composite_score || 0) < 40;
  }).length;

  return {
    range,
    items,
    count: typeof count === 'number' ? count : items.length,
    limit,
    offset,
    summary: {
      total_reports: statsRows.length,
      android,
      ios,
      unknown_platform: unknown,
      avg_score: avgScore,
      urgent_attention: urgent,
    },
  };
}

export async function exportVehicleHealthReportsCsv(
  db: any,
  opts: {
    preset?: string;
    customStart?: string | null;
    customEnd?: string | null;
    q?: string;
    platform?: string;
  },
) {
  const report = await fetchVehicleHealthReports(db, { ...opts, limit: 5000, offset: 0 });
  const rows = report.items.map(mapRowForCsv);
  const csv = rowsToCsv(rows, [...HEALTH_REPORT_CSV_COLUMNS]);
  const summary = [
    'MyFNG Smart Health Check Reports Export',
    `Range: ${report.range.label}`,
    `From: ${report.range.start}`,
    `To: ${report.range.end}`,
    '',
    `Total Reports: ${report.summary.total_reports}`,
    `Android: ${report.summary.android}`,
    `iOS: ${report.summary.ios}`,
    `Unknown Platform: ${report.summary.unknown_platform}`,
    `Average Score: ${report.summary.avg_score}`,
    `Urgent Attention: ${report.summary.urgent_attention}`,
  ].join('\n');

  return {
    csv,
    summary,
    filename: `health-check-reports-${report.range.startYmd}-to-${report.range.endYmd}.csv`,
    range: report.range,
    summary_stats: report.summary,
  };
}
