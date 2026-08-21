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
const MAX_BARS = 24;

function prettify(value: string) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseWords(value: string) {
  return prettify(value)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getCouponMeta(lead: Lead) {
  const meta = lead?.coupon_meta;
  return meta && typeof meta === 'object' ? (meta as Record<string, any>) : {};
}

function getProfileHistory(lead: Lead): any[] {
  const meta = getCouponMeta(lead);
  return Array.isArray(meta.profile_history) ? meta.profile_history : [];
}

/** Live CRM disposition — ignore merge/pipeline status on history rows (e.g. VALIDATED). */
function getTcUpdate(lead: Lead): string {
  const meta = getCouponMeta(lead);
  const raw =
    String(meta.last_call_label || '').trim() ||
    String(meta.last_call_result || '').trim() ||
    '';
  if (!raw) return 'No update';
  const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');
  // TC Update chart: one Lost bucket — reasons live under "Lost reasons" tab
  if (upper === 'LOST' || upper.startsWith('LOST_') || /^lost\b/i.test(raw)) return 'Lost';
  if (/will\s*visit/i.test(raw) || upper === 'WILL_VISIT' || upper === 'HE_WILL_VISIT') {
    return 'He will visit';
  }
  const known: Record<string, string> = {
    FRESH: 'Fresh',
    NEW: 'Fresh',
    INTERESTED: 'Interested',
    CALLBACK: 'Follow-up',
    BOOKING_CONFIRMED: 'Booking confirmed',
    OTP_VERIFIED: 'OTP Verified',
    RINGING: 'Ringing',
    IN_SERVICE: 'In Service',
    SERVICE_DONE: 'Service Done',
  };
  if (known[upper]) return known[upper];
  if (/otp verified/i.test(raw)) return prettify(raw);
  if (/^validated$/i.test(raw)) return 'Booking confirmed';
  return titleCaseWords(raw);
}

function getLostReason(lead: Lead): string | null {
  const meta = getCouponMeta(lead);
  const result = String(meta.last_call_result || '').toUpperCase();
  const label = String(meta.last_call_label || '').trim();
  const isLost =
    getTcUpdate(lead) === 'Lost' ||
    result.includes('LOST') ||
    /^lost\b/i.test(label);
  if (!isLost) return null;

  const history = getProfileHistory(lead);
  for (const row of history) {
    const reason = String(row?.lost_reason || '').trim();
    if (reason) return prettify(reason);
    const status = String(row?.status || '').toUpperCase();
    if (status.includes('LOST')) {
      const remark = String(row?.remark || '').trim();
      if (remark && !/^lost\b/i.test(remark)) return prettify(remark);
    }
  }
  const direct = String(
    meta.last_lost_reason || meta.lost_reason || lead?.lost_reason || '',
  ).trim();
  if (direct) return prettify(direct);
  // Strip "Lost - " prefix from label if present for reason tab
  const fromLabel = label.replace(/^lost\s*[-–—:]?\s*/i, '').trim();
  if (fromLabel && !/^lost$/i.test(fromLabel)) return prettify(fromLabel);
  return 'Lost (no reason)';
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
  const raw = String(lead?.status || 'UNKNOWN').trim().toUpperCase();
  if (raw === 'VALIDATED') return 'Booking confirmed';
  if (raw === 'ASSIGNED_TO_WORKSHOP') return 'Assigned to workshop';
  if (raw === 'READY_FOR_DELIVERY') return 'Ready for delivery';
  if (raw === 'READY_FOR_BILLING') return 'Ready for billing';
  if (raw === 'VEHICLE_DROPPED') return 'Vehicle dropped';
  if (raw === 'REWORK_REQUIRED') return 'Rework required';
  if (raw === 'ON_THE_WAY') return 'On the way';
  if (raw === 'QC_APPROVED') return 'QC approved';
  if (raw === 'IN_PROGRESS') return 'In progress';
  return titleCaseWords(raw) || 'Unknown';
}

function getCity(lead: Lead): string {
  return String(lead?.city || '').trim() || 'Unknown';
}

function parseLeadDate(lead: Lead): Date | null {
  const raw = String(lead?.created_at || '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDay(d: Date) {
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

function formatMonth(d: Date) {
  return d.toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

function formatWeek(d: Date) {
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  return `W/o ${formatDay(monday)}`;
}

type CreatedGrain = 'day' | 'week' | 'month';

function resolveCreatedGrain(leads: Lead[]): CreatedGrain {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let dated = 0;
  for (const lead of leads) {
    const d = parseLeadDate(lead);
    if (!d) continue;
    dated += 1;
    const t = d.getTime();
    if (t < min) min = t;
    if (t > max) max = t;
  }
  if (dated <= 1 || !Number.isFinite(min) || !Number.isFinite(max)) return 'day';
  const spanDays = Math.max(1, Math.round((max - min) / 86_400_000));
  if (spanDays > 120 || dated > 45) return 'month';
  if (spanDays > 45 || dated > 28) return 'week';
  return 'day';
}

function getCreatedBucket(lead: Lead, grain: CreatedGrain): string {
  const d = parseLeadDate(lead);
  if (!d) return 'Unknown';
  if (grain === 'month') return formatMonth(d);
  if (grain === 'week') return formatWeek(d);
  return formatDay(d);
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

function bucketKey(lead: Lead, dimension: ChartDimension, createdGrain: CreatedGrain): string | null {
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
      return getCreatedBucket(lead, createdGrain);
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

/** Match a lead to a chart bar key (same bucketing as the chart). */
export function leadMatchesChartBucket(
  lead: Lead,
  dimension: ChartDimension,
  bucketKeyValue: string,
  allLeadsForGrain?: Lead[],
): boolean {
  if (!bucketKeyValue || bucketKeyValue.startsWith('Other (')) return false;
  const grain =
    dimension === 'created_on'
      ? resolveCreatedGrain(allLeadsForGrain || [lead])
      : 'day';
  return bucketKey(lead, dimension, grain) === bucketKeyValue;
}

export function chartDimensionLabel(dimension: ChartDimension): string {
  return ALL_DIMENSIONS.find((d) => d.id === dimension)?.label || dimension;
}

type ChartRow = {
  key: string;
  label: string;
  count: number;
  pct: number;
  color: string;
};

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

function aggregateLeads(
  leads: Lead[],
  dimension: ChartDimension,
  createdGrain: CreatedGrain,
): ChartRow[] {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const key = bucketKey(lead, dimension, createdGrain);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
  let entries = Array.from(counts.entries()).map(([key, count]) => ({
    key,
    label: key,
    count,
    pct: Math.round((count / total) * 10000) / 100,
    color: '#64748B',
  }));

  if (dimension === 'calls_placed') {
    entries = entries.sort(
      (a, b) => CALLS_ORDER.indexOf(a.key) - CALLS_ORDER.indexOf(b.key),
    );
  } else if (dimension === 'created_on') {
    // Keep chronological for time series when month/week/day labels sort poorly —
    // fall back to count order for Unknown.
    entries = entries.sort((a, b) => {
      if (a.key === 'Unknown') return 1;
      if (b.key === 'Unknown') return -1;
      return b.count - a.count;
    });
  } else {
    entries = entries.sort((a, b) => b.count - a.count);
  }

  // Cap crowded charts: keep top N, roll rest into Other
  if (dimension !== 'calls_placed' && entries.length > MAX_BARS) {
    const head = entries.slice(0, MAX_BARS - 1);
    const tail = entries.slice(MAX_BARS - 1);
    const otherCount = tail.reduce((s, r) => s + r.count, 0);
    entries = [
      ...head,
      {
        key: `Other (${tail.length} groups)`,
        label: `Other (${tail.length})`,
        count: otherCount,
        pct: Math.round((otherCount / total) * 10000) / 100,
        color: '#64748B',
      },
    ];
  }

  return entries.map((row, idx) => ({
    ...row,
    color: BAR_COLORS[idx % BAR_COLORS.length],
  }));
}

function wrapLabelLines(text: string, maxChars = 12): string[] {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function AxisTick(props: any) {
  const { x, y, payload } = props;
  const lines = wrapLabelLines(String(payload?.value || ''), 11);
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text
          key={`${line}-${i}`}
          x={0}
          y={14 + i * 13}
          textAnchor="middle"
          fill="#334155"
          fontSize={11}
        >
          {line}
        </text>
      ))}
    </g>
  );
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
  onBarClick,
  showManagerDimensions = true,
  totalOverride,
}: {
  leads: Lead[];
  /** Click "View N leads" → leave chart and show list */
  onViewLeads?: () => void;
  /** Click a bar / breakdown row → open matching leads in list */
  onBarClick?: (payload: { dimension: ChartDimension; key: string; count: number }) => void;
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

  const createdGrain = useMemo(
    () => (activeDimension === 'created_on' ? resolveCreatedGrain(leads) : 'day'),
    [leads, activeDimension],
  );

  const rows = useMemo(() => {
    // Full labels on axis — no ellipsis; width/scroll keeps them readable
    return aggregateLeads(leads, activeDimension, createdGrain).map((row) => ({
      ...row,
      label: row.key,
    }));
  }, [leads, activeDimension, createdGrain]);

  const total =
    typeof totalOverride === 'number' && totalOverride > 0
      ? totalOverride
      : leads.length;

  const chartHeight = 440;
  const chartMinWidth = useMemo(() => {
    if (!rows.length) return 560;
    // Straight labels: give each category enough width; wrap long names
    const slots = rows.reduce((sum, r) => sum + Math.max(96, Math.min(130, r.label.length * 6)), 0);
    return Math.max(720, slots + 80);
  }, [rows]);

  const handleBucketOpen = (key: string, count: number) => {
    if (!onBarClick || !key || key.startsWith('Other (')) return;
    onBarClick({ dimension: activeDimension, key, count });
  };

  const grainHint =
    activeDimension === 'created_on'
      ? createdGrain === 'month'
        ? 'Grouped by month'
        : createdGrain === 'week'
          ? 'Grouped by week'
          : 'By day'
      : null;

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
              Total {total.toLocaleString('en-IN')}
              {grainHint ? ` · ${grainHint}` : ''} · Vertical bar chart
              {onBarClick ? ' · click a bar to open leads' : ''}
              {rows.length > 8 ? ' · scroll → for all labels' : ''}
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
          <div className="w-full overflow-x-auto pb-1">
            <div style={{ width: '100%', minWidth: chartMinWidth, height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rows}
                  margin={{
                    top: 32,
                    right: 20,
                    left: 8,
                    bottom: 72,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    type="category"
                    dataKey="label"
                    interval={0}
                    angle={0}
                    textAnchor="middle"
                    height={72}
                    tick={<AxisTick />}
                    tickMargin={4}
                  />
                  <YAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    width={48}
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
                  <Bar
                    dataKey="count"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                    cursor={onBarClick ? 'pointer' : undefined}
                    onClick={(data: any) => {
                      const key = String(data?.key || data?.payload?.key || '');
                      const count = Number(data?.count ?? data?.payload?.count ?? 0) || 0;
                      handleBucketOpen(key, count);
                    }}
                  >
                    {rows.map((row) => (
                      <Cell key={row.key} fill={row.color} cursor={onBarClick ? 'pointer' : undefined} />
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
              <button
                key={row.key}
                type="button"
                disabled={!onBarClick || row.key.startsWith('Other (')}
                onClick={() => handleBucketOpen(row.key, row.count)}
                className={`min-w-0 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50 ${
                  onBarClick && !row.key.startsWith('Other (') ? 'cursor-pointer' : ''
                }`}
              >
                <div className="mb-1.5 flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                    aria-hidden
                  />
                  <span
                    className="text-[12px] font-medium leading-tight text-slate-500 break-words"
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
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
