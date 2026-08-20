'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';

type Lead = Record<string, any>;

export type ChartDimension =
  | 'status'
  | 'tc_update'
  | 'source'
  | 'assignee'
  | 'created_on'
  | 'lost_reason'
  | 'city'
  | 'calls_placed';

type DimensionDef = { id: ChartDimension; label: string; managerOnly?: boolean };

const ALL_DIMENSIONS: DimensionDef[] = [
  { id: 'created_on', label: 'Created on' },
  { id: 'status', label: 'Status' },
  { id: 'tc_update', label: 'TC Update' },
  { id: 'lost_reason', label: 'Lost reasons' },
  { id: 'assignee', label: 'Assignee', managerOnly: true },
  { id: 'calls_placed', label: 'Number of calls placed' },
  { id: 'source', label: 'Source', managerOnly: true },
  { id: 'city', label: 'City' },
];

const BAR_COLORS = [
  '#059669',
  '#004AAD',
  '#8B5CF6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#06B6D4',
  '#EC4899',
  '#6366F1',
  '#84CC16',
  '#F97316',
  '#64748B',
];

const ACTIVE_TAB = '#004AAD';

function prettify(value: string) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCouponMeta(lead: Lead) {
  const meta = lead?.coupon_meta;
  return meta && typeof meta === 'object' ? (meta as Record<string, any>) : {};
}

function getProfileHistory(lead: Lead): any[] {
  const meta = getCouponMeta(lead);
  return Array.isArray(meta.profile_history) ? meta.profile_history : [];
}

function getTcUpdate(lead: Lead): string {
  const meta = getCouponMeta(lead);
  const history = getProfileHistory(lead);
  const latest = history[0];
  const raw =
    (latest?.status as string) ||
    (meta.last_call_label as string) ||
    (meta.last_call_result as string) ||
    '';
  return prettify(raw) || 'No update';
}

function getLostReason(lead: Lead): string | null {
  const history = getProfileHistory(lead);
  for (const row of history) {
    const reason = String(row?.lost_reason || '').trim();
    if (reason) return prettify(reason);
    const status = String(row?.status || '').toUpperCase();
    if (status.includes('LOST')) {
      const remark = String(row?.remark || '').trim();
      if (remark) return prettify(remark);
    }
  }
  const meta = getCouponMeta(lead);
  const direct = String(meta.lost_reason || lead?.lost_reason || '').trim();
  return direct ? prettify(direct) : null;
}

function getSource(lead: Lead): string {
  return (
    String(
      lead?.source_badge_label ||
        lead?.booking_source_label ||
        lead?.lead_source ||
        lead?.created_from ||
        'Other',
    ).trim() || 'Other'
  );
}

function getAssignee(lead: Lead): string {
  const nested = lead?.assigned_telecaller;
  const nestedName =
    nested && typeof nested === 'object'
      ? String((nested as any).full_name || '').trim()
      : '';
  return (
    String(lead?.assigned_telecaller_name || '').trim() ||
    nestedName ||
    'Unassigned'
  );
}

function getStatus(lead: Lead): string {
  return prettify(String(lead?.status || 'UNKNOWN')) || 'Unknown';
}

function getCity(lead: Lead): string {
  return String(lead?.city || '').trim() || 'Unknown';
}

function getCreatedDay(lead: Lead): string {
  const raw = String(lead?.created_at || '').trim();
  if (!raw) return 'Unknown';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10) || 'Unknown';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

function getCallsPlacedBucket(lead: Lead): string {
  const n = Math.max(0, Number(lead?.total_calls ?? lead?.call_count ?? 0) || 0);
  if (n <= 0) return '0';
  if (n === 1) return '1';
  if (n === 2) return '2';
  if (n === 3) return '3';
  if (n === 4) return '4';
  if (n <= 10) return '5 - 10';
  return '10+';
}

function bucketKey(lead: Lead, dimension: ChartDimension): string | null {
  switch (dimension) {
    case 'status':
      return getStatus(lead);
    case 'tc_update':
      return getTcUpdate(lead);
    case 'source':
      return getSource(lead);
    case 'assignee':
      return getAssignee(lead);
    case 'created_on':
      return getCreatedDay(lead);
    case 'city':
      return getCity(lead);
    case 'lost_reason':
      return getLostReason(lead);
    case 'calls_placed':
      return getCallsPlacedBucket(lead);
    default:
      return null;
  }
}

type ChartRow = {
  key: string;
  label: string;
  count: number;
  pct: number;
  color: string;
};

function truncateLabel(key: string, max = 16) {
  if (key.length <= max) return key;
  return `${key.slice(0, max - 1)}…`;
}

function formatCount(n: number) {
  if (n < 1000) return String(n);
  const k = n / 1000;
  const text = k >= 10 ? k.toFixed(1) : k.toFixed(2);
  return `${text.replace(/\.?0+$/, '')}K`;
}

function formatPct(pct: number) {
  if (pct === 0) return '0%';
  return `${pct}%`;
}

const CALLS_ORDER = ['0', '1', '2', '3', '4', '5 - 10', '10+'];

function aggregateLeads(leads: Lead[], dimension: ChartDimension): ChartRow[] {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const key = bucketKey(lead, dimension);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
  let entries = Array.from(counts.entries()).map(([key, count]) => ({
    key,
    label: truncateLabel(key),
    count,
    pct: Math.round((count / total) * 10000) / 100,
    color: '#64748B',
  }));

  if (dimension === 'calls_placed') {
    entries = entries.sort(
      (a, b) => CALLS_ORDER.indexOf(a.key) - CALLS_ORDER.indexOf(b.key),
    );
  } else {
    entries = entries.sort((a, b) => b.count - a.count);
  }

  return entries.map((row, idx) => ({
    ...row,
    color: BAR_COLORS[idx % BAR_COLORS.length],
  }));
}

function exportChartCsv(rows: ChartRow[], dimension: ChartDimension) {
  const header = 'Category,Count,Percentage\n';
  const body = rows
    .map((r) => `"${String(r.key).replace(/"/g, '""')}",${r.count},${r.pct}%`)
    .join('\n');
  const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads_chart_${dimension}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BookingsLeadsChartPanel({
  leads,
  onViewLeads,
  showManagerDimensions = true,
  totalOverride,
}: {
  leads: Lead[];
  /** Click "View N leads" → leave chart and show list */
  onViewLeads?: () => void;
  /** Assignee / Source tabs (managers & admin) */
  showManagerDimensions?: boolean;
  /** Prefer API total when chart rows are a subset */
  totalOverride?: number;
}) {
  const dimensions = useMemo(
    () =>
      ALL_DIMENSIONS.filter((d) => showManagerDimensions || !d.managerOnly),
    [showManagerDimensions],
  );
  const [dimension, setDimension] = useState<ChartDimension>('status');
  const activeDimension = dimensions.some((d) => d.id === dimension)
    ? dimension
    : dimensions[0]?.id || 'status';

  const rows = useMemo(
    () => aggregateLeads(leads, activeDimension),
    [leads, activeDimension],
  );
  const total =
    typeof totalOverride === 'number' && totalOverride > 0
      ? totalOverride
      : leads.length;
  const chartHeight = 360;
  const needAngle = rows.length > 6;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
          {dimensions.map((d) => {
            const active = activeDimension === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDimension(d.id)}
                style={active ? { backgroundColor: ACTIVE_TAB, color: '#fff' } : undefined}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs sm:text-sm font-bold transition ${
                  active
                    ? 'border-transparent shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportChartCsv(rows, activeDimension)}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5 text-slate-700" />
            Export chart CSV
          </button>
          {onViewLeads ? (
            <button
              type="button"
              onClick={onViewLeads}
              className="rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:brightness-110"
              style={{ backgroundColor: ACTIVE_TAB }}
              title="Back to leads list"
            >
              View {total.toLocaleString('en-IN')} lead{total === 1 ? '' : 's'}
            </button>
          ) : (
            <span
              className="rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-sm"
              style={{ backgroundColor: ACTIVE_TAB }}
            >
              View {total.toLocaleString('en-IN')} lead{total === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-extrabold text-slate-800">
              Leads by{' '}
              {dimensions.find((d) => d.id === activeDimension)?.label || activeDimension}
            </p>
            <p className="text-xs font-medium text-slate-500">
              Total {total.toLocaleString('en-IN')} · Vertical bar chart
            </p>
          </div>
          <p className="text-lg font-black tabular-nums text-[#023D95]">
            {total.toLocaleString('en-IN')}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No data for this dimension with current filters.
          </div>
        ) : (
          <div style={{ width: '100%', height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                margin={{
                  top: 28,
                  right: 12,
                  left: 8,
                  bottom: needAngle ? 72 : 28,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  type="category"
                  dataKey="label"
                  interval={0}
                  angle={needAngle ? -35 : 0}
                  textAnchor={needAngle ? 'end' : 'middle'}
                  height={needAngle ? 70 : 36}
                  tick={{ fontSize: 11, fill: '#475569' }}
                />
                <YAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  label={{
                    value: 'Leads count',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 11, fill: '#94A3B8' },
                  }}
                />
                <Tooltip
                  formatter={(value: any, _name: any, item: any) => [
                    `${value} (${item?.payload?.pct ?? 0}%)`,
                    'Leads',
                  ]}
                  labelFormatter={(_label, payload) =>
                    String(payload?.[0]?.payload?.key || _label || '')
                  }
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: '#E2E8F0',
                    fontSize: 12,
                    color: '#0f172a',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {rows.map((row) => (
                    <Cell key={row.key} fill={row.color} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="top"
                    formatter={(v: any) => formatCount(Number(v) || 0)}
                    style={{ fontSize: 11, fontWeight: 700, fill: '#334155' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {rows.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
            Breakdown
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {rows.map((row) => (
              <div
                key={row.key}
                className="min-w-0 rounded-xl px-2 py-2 transition hover:bg-slate-50"
              >
                <div className="mb-1.5 flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                    aria-hidden
                  />
                  <span
                    className="truncate text-[12px] font-medium leading-tight text-slate-500"
                    title={row.key}
                  >
                    {row.key}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-[18px]">
                  <span className="text-lg font-bold tabular-nums leading-none text-slate-900">
                    {formatCount(row.count)}
                  </span>
                  <span className="inline-flex w-fit shrink-0 items-center rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-violet-800">
                    {formatPct(row.pct)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
