import { resolveBookingSource } from '@/lib/booking-lead-utils';
import { leadDisplayStatus } from '@/lib/telecaller/leadDisplayStatus';

export type TelecallerLeadOpsRow = { name: string; count: number };
export type TelecallerLeadOpsAssignee = { telecaller_id: string; name: string; count: number };

export type TelecallerLeadOpsSlice = {
  count: number;
  byCrmStatus: TelecallerLeadOpsRow[];
  byLeadSource: TelecallerLeadOpsRow[];
};

export type TelecallerLeadOpsData = {
  totalCreated: number;
  assignedCount: number;
  unassignedCount: number;
  byAssignee: TelecallerLeadOpsAssignee[];
  byCrmStatus: TelecallerLeadOpsRow[];
  byLeadSource: TelecallerLeadOpsRow[];
  assigneeSlices: Record<string, TelecallerLeadOpsSlice>;
  unassignedKey: string;
  sampleTruncated: boolean;
};

const UNASSIGNED_KEY = '__unassigned__';

const EMPTY_OPS: TelecallerLeadOpsData = {
  totalCreated: 0,
  assignedCount: 0,
  unassignedCount: 0,
  byAssignee: [],
  byCrmStatus: [],
  byLeadSource: [],
  assigneeSlices: {},
  unassignedKey: UNASSIGNED_KEY,
  sampleTruncated: false,
};

/**
 * Leads created in the selected period — assignee + CRM status + lead source (Super Admin + telecaller CRM home).
 */
export async function aggregateTelecallerLeadOps(
  db: any,
  options: {
    /** Mutate base query with period bounds (e.g. gte/lte on created_at). */
    applyPeriod?: (query: any) => any;
    /** When set, only leads assigned to this telecaller user id. */
    assigneeId?: string | null;
  } = {},
): Promise<TelecallerLeadOpsData> {
  const pageSize = 1000;
  const maxPages = 30;
  const rows: any[] = [];
  const assigneeId = String(options.assigneeId || '').trim();

  for (let page = 0; page < maxPages; page++) {
    let q = db
      .from('service_leads')
      .select(
        'id, assigned_telecaller_id, status, is_incomplete, coupon_meta, deleted_at, lead_source, created_from, lead_type',
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    if (assigneeId) q = q.eq('assigned_telecaller_id', assigneeId);
    if (options.applyPeriod) q = options.applyPeriod(q);

    const { data, error } = await q;
    if (error) break;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  if (!rows.length) return { ...EMPTY_OPS };

  type Slice = { status: Map<string, number>; source: Map<string, number>; count: number };
  const sliceFor = (map: Map<string, Slice>, key: string): Slice => {
    let s = map.get(key);
    if (!s) {
      s = { status: new Map(), source: new Map(), count: 0 };
      map.set(key, s);
    }
    return s;
  };

  const assigneeMap = new Map<string, number>();
  let unassigned = 0;
  const statusMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  const slices = new Map<string, Slice>();

  for (const row of rows) {
    const rowAssigneeId = row?.assigned_telecaller_id ? String(row.assigned_telecaller_id) : '';
    const sliceKey = rowAssigneeId || UNASSIGNED_KEY;
    if (!rowAssigneeId) unassigned += 1;
    else assigneeMap.set(rowAssigneeId, (assigneeMap.get(rowAssigneeId) || 0) + 1);

    const crmLabel = leadDisplayStatus(row) || 'Unknown';
    statusMap.set(crmLabel, (statusMap.get(crmLabel) || 0) + 1);

    const sourceLabel =
      resolveBookingSource(row as Record<string, any>).booking_source_label || 'Other';
    sourceMap.set(sourceLabel, (sourceMap.get(sourceLabel) || 0) + 1);

    const slice = sliceFor(slices, sliceKey);
    slice.count += 1;
    slice.status.set(crmLabel, (slice.status.get(crmLabel) || 0) + 1);
    slice.source.set(sourceLabel, (slice.source.get(sourceLabel) || 0) + 1);
  }

  const mapToRows = (m: Map<string, number>): TelecallerLeadOpsRow[] =>
    [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

  const assigneeSlices: Record<string, TelecallerLeadOpsSlice> = {};
  for (const [key, slice] of slices.entries()) {
    assigneeSlices[key] = {
      count: slice.count,
      byCrmStatus: mapToRows(slice.status),
      byLeadSource: mapToRows(slice.source),
    };
  }

  const assigneeIds = [...assigneeMap.keys()];
  const nameById = new Map<string, string>();
  if (assigneeIds.length) {
    const { data: users } = await db
      .from('users_login')
      .select('id, full_name, email')
      .in('id', assigneeIds.slice(0, 200));
    for (const u of users || []) {
      const id = String(u?.id || '');
      const name = String(u?.full_name || u?.email || 'Telecaller').trim();
      if (id) nameById.set(id, name);
    }
  }

  const byAssignee = [...assigneeMap.entries()]
    .map(([telecaller_id, count]) => ({
      telecaller_id,
      name: nameById.get(telecaller_id) || 'Telecaller',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const totalCreated = rows.length;
  const assignedCount = assigneeId ? totalCreated : totalCreated - unassigned;

  return {
    totalCreated,
    assignedCount,
    unassignedCount: assigneeId ? 0 : unassigned,
    byAssignee,
    byCrmStatus: mapToRows(statusMap),
    byLeadSource: mapToRows(sourceMap),
    assigneeSlices,
    unassignedKey: UNASSIGNED_KEY,
    sampleTruncated: rows.length >= pageSize * maxPages,
  };
}