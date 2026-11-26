'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ExternalLink, Minus, Plus, UserCheck } from 'lucide-react';
import type { TelecallerLeadOpsData } from '@/lib/telecaller/telecallerLeadOpsAggregate';

const CHART_COLORS = ['#004AAD', '#0066FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

function OpsSourceRow({
  name,
  count,
  pct,
  color,
  onClick,
}: {
  name: string;
  count: number;
  pct: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[0.5rem_minmax(0,1fr)_2.75rem_2.25rem] items-center gap-x-2 rounded-md py-1 px-1 text-left hover:bg-white/80"
      title={`${name} · ${count} · ${pct}%`}
    >
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="min-w-0 truncate text-[11px] font-medium text-gray-700 text-left">{name}</span>
      <span className="text-xs font-extrabold text-gray-900 tabular-nums text-right">{count}</span>
      <span className="text-[10px] font-bold text-violet-800 bg-violet-100 px-1 py-0.5 rounded tabular-nums text-center">
        {pct}%
      </span>
    </button>
  );
}

function OpsMetricChipGrid({
  rows,
  total,
  colorOffset = 0,
  onRowClick,
}: {
  rows: Array<{ name: string; count: number }>;
  total: number;
  colorOffset?: number;
  onRowClick: (name: string) => void;
}) {
  if (!rows.length) {
    return <p className="text-xs text-gray-500 py-2 text-center">No data</p>;
  }
  const denom = total || 1;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-0.5 max-h-[min(22rem,55vh)] overflow-y-auto pr-1">
      {rows.map((row, i) => {
        const pct = Math.round(((row.count || 0) / denom) * 100);
        const color = CHART_COLORS[(i + colorOffset) % CHART_COLORS.length];
        return (
          <OpsSourceRow
            key={`chip-${row.name}`}
            name={row.name}
            count={row.count}
            pct={pct}
            color={color}
            onClick={() => onRowClick(row.name)}
          />
        );
      })}
    </div>
  );
}

function CrmStatusRow({
  name,
  count,
  pct,
  color,
  onClick,
}: {
  name: string;
  count: number;
  pct: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[0.5rem_1fr_auto] grid-rows-[auto_auto] gap-x-2 gap-y-1 rounded-lg py-1.5 px-1 text-left hover:bg-white/80"
      title="Open leads with this CRM status"
    >
      <span
        className="row-span-2 self-center h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="min-w-0 truncate text-sm font-medium text-gray-800">{name}</span>
      <span className="text-xs text-gray-600 tabular-nums text-right shrink-0 whitespace-nowrap">
        {count} · {pct}%
      </span>
      <div className="col-span-2 col-start-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full max-w-full"
          style={{
            width: `${Math.max(pct, 2)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </button>
  );
}

export type TelecallerLeadOpsPanelProps = {
  ops: TelecallerLeadOpsData;
  periodLabel: string;
  /** Super Admin team view with assignee bars; self = single telecaller CRM home. */
  variant: 'admin' | 'self';
  title?: string;
  subtitle?: string;
  distributionHref?: string;
  footerHint?: string;
  selfLabel?: string;
  onLeadsReceivedClick?: () => void;
  onUnassignedClick?: () => void;
  onCrmStatusClick: (crmLabel: string, ctx: { assigneeName?: string }) => void;
  onSourceClick: (sourceLabel: string, ctx: { assigneeName?: string }) => void;
};

export default function TelecallerLeadOpsPanel({
  ops,
  periodLabel,
  variant,
  title,
  subtitle,
  distributionHref,
  footerHint,
  selfLabel = 'You',
  onLeadsReceivedClick,
  onUnassignedClick,
  onCrmStatusClick,
  onSourceClick,
}: TelecallerLeadOpsPanelProps) {
  const showAssigneeChart = variant === 'admin' && ops.byAssignee.length > 0;
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const view = useMemo(() => {
    if (variant === 'self' || !selectedAssignee) {
      const label = variant === 'self' ? selfLabel : 'All assignees';
      return {
        label,
        total: ops.totalCreated,
        byCrmStatus: ops.byCrmStatus,
        byLeadSource: ops.byLeadSource,
      };
    }
    const unKey = ops.unassignedKey || '__unassigned__';
    const slice = ops.assigneeSlices[selectedAssignee];
    const label =
      selectedAssignee === unKey
        ? 'Unassigned'
        : ops.byAssignee.find((a) => a.telecaller_id === selectedAssignee)?.name || 'Assignee';
    return {
      label,
      total: slice?.count || 0,
      byCrmStatus: slice?.byCrmStatus || [],
      byLeadSource: slice?.byLeadSource || [],
    };
  }, [variant, selectedAssignee, ops, selfLabel]);

  const drillCtx = useMemo((): { assigneeName?: string } => {
    if (variant !== 'admin' || !selectedAssignee) return {};
    const unKey = ops.unassignedKey || '__unassigned__';
    if (selectedAssignee === unKey) return { assigneeName: 'UNASSIGNED' };
    const row = ops.byAssignee.find((a) => a.telecaller_id === selectedAssignee);
    return row?.name ? { assigneeName: row.name } : {};
  }, [variant, selectedAssignee, ops.byAssignee, ops.unassignedKey]);

  const heading =
    title || (variant === 'self' ? 'My leads — status & source' : 'Telecaller — leads & assignment');
  const helpText =
    subtitle ||
    (variant === 'self'
      ? 'Date filter ke hisaab se tumhare assigned leads · CRM / source par click → list'
      : 'Assignee bar par click karo — CRM status (right) aur lead source (neeche full width) dono filter honge.');

  return (
    <div className={`rounded-xl shadow-sm border border-slate-300 bg-slate-100 p-4 ${expanded ? 'space-y-3' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900 flex flex-wrap items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600 shrink-0" />
            {heading}
            <span className="text-sm font-semibold text-blue-600">({periodLabel})</span>
          </h2>
          {expanded ? (
            <>
              <p className="text-xs text-gray-500 mt-1">{helpText}</p>
              {ops.sampleTruncated ? (
                <p className="text-xs text-amber-600 mt-1">
                  Large range — counts capped at sample limit; use shorter period for exact totals.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {distributionHref && expanded ? (
            <Link
              href={distributionHref}
              className="text-xs font-semibold text-blue-600 inline-flex items-center gap-1"
            >
              Distribution <ExternalLink className="w-3 h-3" />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse leads breakdown' : 'Expand leads breakdown'}
          >
            {expanded ? <Minus className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {expanded ? (() => {
        const summaryMetrics = (
          <div
            className="grid grid-cols-3 gap-2 min-w-0"
          >
            <button
              type="button"
              onClick={() => {
                if (variant === 'admin') setSelectedAssignee(null);
                onLeadsReceivedClick?.();
              }}
              className={`rounded-lg border border-blue-100 bg-blue-50/80 px-2 py-2 text-left hover:bg-blue-50 sm:px-3 ${
                variant === 'admin' && !selectedAssignee ? 'ring-2 ring-blue-400' : ''
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">
                {variant === 'self' ? 'Leads in period' : 'Leads received'}
              </p>
              <p className="text-2xl font-extrabold text-[#023D95] leading-tight">{ops.totalCreated}</p>
            </button>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/80 px-2 py-2 sm:px-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Assigned</p>
              <p className="text-2xl font-extrabold text-emerald-800 leading-tight">{ops.assignedCount}</p>
            </div>
            {variant === 'admin' ? (
              <button
                type="button"
                onClick={() => {
                  if (ops.unassignedCount > 0) setSelectedAssignee(ops.unassignedKey);
                  onUnassignedClick?.();
                }}
                className={`rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-left hover:bg-amber-50/90 ${
                  selectedAssignee === ops.unassignedKey ? 'ring-2 ring-amber-500' : ''
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Unassigned</p>
                <p className="text-2xl font-extrabold text-amber-900 leading-tight">{ops.unassignedCount}</p>
              </button>
            ) : (
              <div className="rounded-lg border border-violet-100 bg-violet-50/80 px-2 py-2 sm:px-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-violet-800">CRM buckets</p>
                <p className="text-2xl font-extrabold text-violet-900 leading-tight">{ops.byCrmStatus.length}</p>
              </div>
            )}
          </div>
        );

        const crmStatusBlock = (
          <div className="min-w-0 flex flex-col h-full">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span className="text-sm font-bold text-gray-900">
                CRM status — <span className="text-blue-600">{view.label}</span>
                <span className="text-gray-500 font-semibold"> ({view.total} leads)</span>
              </span>
              {variant === 'admin' && selectedAssignee ? (
                <button
                  type="button"
                  onClick={() => setSelectedAssignee(null)}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  Show all
                </button>
              ) : null}
            </div>

            {view.byCrmStatus.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No leads</p>
            ) : (
              <div className="space-y-1 flex-1 min-h-0 max-h-[min(26rem,60vh)] overflow-y-auto pr-1">
                {view.byCrmStatus.map((row, i) => {
                  const total = view.total || 1;
                  const pct = Math.round(((row.count || 0) / total) * 100);
                  return (
                    <CrmStatusRow
                      key={`st-${row.name}`}
                      name={row.name}
                      count={row.count}
                      pct={pct}
                      color={CHART_COLORS[i % CHART_COLORS.length]}
                      onClick={() => onCrmStatusClick(row.name, drillCtx)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );

        if (variant === 'self') {
          return (
            <div className="space-y-3">
              {summaryMetrics}
              <div className="border-t border-slate-300/80 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    CRM status —{' '}
                    <span className="text-blue-600 normal-case">{view.label}</span>
                    <span className="text-gray-500 font-semibold normal-case"> ({view.total} leads)</span>
                  </h3>
                  <span className="text-[10px] text-gray-500">{periodLabel}</span>
                </div>
                <OpsMetricChipGrid
                  rows={view.byCrmStatus}
                  total={view.total}
                  colorOffset={0}
                  onRowClick={(name) => onCrmStatusClick(name, drillCtx)}
                />
              </div>
            </div>
          );
        }

        return (
          <>
            {summaryMetrics}
            <div
              className={`grid gap-4 items-start ${
                showAssigneeChart ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
              }`}
            >
              {showAssigneeChart ? (
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 mb-1">Assigned to (count)</h3>
                  <p className="text-xs text-gray-500 mb-2">Bar click → filter CRM status on the right</p>
                  <ResponsiveContainer width="100%" height={Math.max(180, ops.byAssignee.length * 32)}>
                    <BarChart layout="vertical" data={ops.byAssignee} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                      <XAxis type="number" fontSize={11} tick={{ fill: '#6B7280' }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={108} fontSize={10} tick={{ fill: '#374151' }} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Bar
                        dataKey="count"
                        name="Leads"
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                        onClick={(entry: { payload?: { telecaller_id?: string } }) => {
                          const id = String(entry?.payload?.telecaller_id || '').trim();
                          if (id) setSelectedAssignee(id);
                        }}
                      >
                        {ops.byAssignee.map((row) => (
                          <Cell
                            key={row.telecaller_id}
                            fill={selectedAssignee === row.telecaller_id ? '#0066FF' : '#004AAD'}
                            fillOpacity={
                              selectedAssignee && selectedAssignee !== row.telecaller_id ? 0.35 : 1
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null}

              <div className={`min-w-0 ${showAssigneeChart ? 'lg:border-l lg:border-slate-300/80 lg:pl-4' : ''}`}>
                {crmStatusBlock}
              </div>
            </div>
          </>
        );
      })() : null}

      {expanded ? (
        <div className="border-t border-slate-300/80 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Lead source —{' '}
              <span className="text-blue-600 normal-case">{view.label}</span>
              <span className="text-gray-500 font-semibold normal-case"> ({view.total} leads)</span>
            </h3>
            <span className="text-[10px] text-gray-500">
              {periodLabel}
              {footerHint ? ` · ${footerHint}` : ''}
            </span>
          </div>
          <OpsMetricChipGrid
            rows={view.byLeadSource}
            total={view.total}
            colorOffset={3}
            onRowClick={(name) => onSourceClick(name, drillCtx)}
          />
        </div>
      ) : null}
    </div>
  );
}