import { findCustomerByPhone, normalizeCustomerPhone } from '@/lib/customer-service-leads';

export type SmartToolActivityItem = {
  type: 'health' | 'resale';
  id: string;
  title: string;
  subtitle: string;
  created_at: string;
  adminPath: string;
};

export type SmartToolCustomerActivity = {
  customer_id: string | null;
  customer_phone: string | null;
  health_count: number;
  resale_count: number;
  items: SmartToolActivityItem[];
};

function fmtInr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export type SmartToolCrossLink = {
  other_tool_checked: boolean;
  other_tool_count: number;
  other_tool_latest_id: string | null;
  other_tool_admin_path: string;
  other_tool_label: string;
};

function customerKeys(row: { customer_id?: string | null; customer_phone?: string | null }) {
  const keys = new Set<string>();
  if (row.customer_id) keys.add(`id:${row.customer_id}`);
  const phone = normalizeCustomerPhone(row.customer_phone);
  if (phone) keys.add(`phone:${phone}`);
  return keys;
}

function rowMatchesKeys(other: { customer_id?: string | null; customer_phone?: string | null }, keys: Set<string>) {
  if (other.customer_id && keys.has(`id:${other.customer_id}`)) return true;
  const phone = normalizeCustomerPhone(other.customer_phone);
  return phone ? keys.has(`phone:${phone}`) : false;
}

async function fetchOtherToolRows(
  db: any,
  table: 'vehicle_health_reports' | 'car_resale_valuations',
  customerIds: string[],
  phones: string[],
) {
  const byId = new Map<string, any>();

  if (customerIds.length) {
    const { data, error } = await db
      .from(table)
      .select('id, customer_id, customer_phone, created_at')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    for (const row of data || []) byId.set(row.id, row);
  }

  if (phones.length) {
    const { data, error } = await db
      .from(table)
      .select('id, customer_id, customer_phone, created_at')
      .in('customer_phone', phones)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    for (const row of data || []) byId.set(row.id, row);
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/** Attach cross-tool link fields for admin list tables. */
export async function enrichListRowsWithCrossToolLinks(
  db: any,
  rows: any[],
  currentTool: 'health' | 'resale',
): Promise<any[]> {
  if (!rows.length) return rows;

  const customerIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))] as string[];
  const phones = [
    ...new Set(
      rows
        .map((r) => normalizeCustomerPhone(r.customer_phone))
        .filter(Boolean),
    ),
  ] as string[];

  if (!customerIds.length && !phones.length) {
    return rows.map((row) => ({
      ...row,
      other_tool_checked: false,
      other_tool_count: 0,
      other_tool_latest_id: null,
      other_tool_admin_path:
        currentTool === 'health'
          ? '/dashboard/super_admin/car-resale-valuations'
          : '/dashboard/super_admin/vehicle-health-reports',
      other_tool_label: currentTool === 'health' ? 'Resale Value' : 'Health Check',
    }));
  }

  const otherTable = currentTool === 'health' ? 'car_resale_valuations' : 'vehicle_health_reports';
  const otherPath =
    currentTool === 'health'
      ? '/dashboard/super_admin/car-resale-valuations'
      : '/dashboard/super_admin/vehicle-health-reports';
  const otherLabel = currentTool === 'health' ? 'Resale Value' : 'Health Check';

  const otherRows = await fetchOtherToolRows(db, otherTable, customerIds, phones);

  return rows.map((row) => {
    const keys = customerKeys(row);
    const matches = otherRows.filter((other) => rowMatchesKeys(other, keys));
    return {
      ...row,
      other_tool_checked: matches.length > 0,
      other_tool_count: matches.length,
      other_tool_latest_id: matches[0]?.id || null,
      other_tool_admin_path: otherPath,
      other_tool_label: otherLabel,
    };
  });
}

export async function fetchSmartToolCustomerActivity(
  db: any,
  opts: {
    customerId?: string | null;
    customerPhone?: string | null;
    excludeType?: 'health' | 'resale';
    excludeId?: string;
    limit?: number;
  },
): Promise<SmartToolCustomerActivity> {
  let customerId = opts.customerId ? String(opts.customerId).trim() : null;
  let phone = normalizeCustomerPhone(opts.customerPhone);

  if (!customerId && phone) {
    const found = await findCustomerByPhone(db, phone);
    if (found?.id) customerId = found.id;
    if (found?.phone) phone = normalizeCustomerPhone(found.phone) || phone;
  }

  if (!customerId && !phone) {
    return {
      customer_id: null,
      customer_phone: null,
      health_count: 0,
      resale_count: 0,
      items: [],
    };
  }

  let healthQuery = db
    .from('vehicle_health_reports')
    .select('id, reg_number, make, model, composite_score, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  let resaleQuery = db
    .from('car_resale_valuations')
    .select('id, make, model, vehicle_number, estimate_low, estimate_high, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (customerId && phone) {
    healthQuery = healthQuery.or(`customer_id.eq.${customerId},customer_phone.eq.${phone}`);
    resaleQuery = resaleQuery.or(`customer_id.eq.${customerId},customer_phone.eq.${phone}`);
  } else if (customerId) {
    healthQuery = healthQuery.eq('customer_id', customerId);
    resaleQuery = resaleQuery.eq('customer_id', customerId);
  } else if (phone) {
    healthQuery = healthQuery.eq('customer_phone', phone);
    resaleQuery = resaleQuery.eq('customer_phone', phone);
  }

  const [{ data: healthRows, error: healthErr }, { data: resaleRows, error: resaleErr }] = await Promise.all([
    healthQuery,
    resaleQuery,
  ]);

  if (healthErr) throw healthErr;
  if (resaleErr) throw resaleErr;

  const allHealth = healthRows || [];
  const allResale = resaleRows || [];

  const healthItems: SmartToolActivityItem[] = allHealth
    .filter((r: any) => !(opts.excludeType === 'health' && r.id === opts.excludeId))
    .map((r: any) => ({
      type: 'health' as const,
      id: r.id,
      title: 'Smart Health Check',
      subtitle: `${r.reg_number || '-'} · ${[r.make, r.model].filter(Boolean).join(' ') || 'Vehicle'} · Score ${r.composite_score ?? '-'}`,
      created_at: r.created_at,
      adminPath: '/dashboard/super_admin/vehicle-health-reports',
    }));

  const resaleItems: SmartToolActivityItem[] = allResale
    .filter((r: any) => !(opts.excludeType === 'resale' && r.id === opts.excludeId))
    .map((r: any) => ({
      type: 'resale' as const,
      id: r.id,
      title: 'Car Resale Value',
      subtitle: `${[r.make, r.model].filter(Boolean).join(' ') || 'Vehicle'} · ${fmtInr(r.estimate_low)} - ${fmtInr(r.estimate_high)}`,
      created_at: r.created_at,
      adminPath: '/dashboard/super_admin/car-resale-valuations',
    }));

  const items = [...healthItems, ...resaleItems]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, opts.limit ?? 8);

  return {
    customer_id: customerId,
    customer_phone: phone,
    health_count: allHealth.length,
    resale_count: allResale.length,
    items,
  };
}
