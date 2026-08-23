'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CrmReportsNav, PeriodTabs } from '@/components/telecaller/crm/CrmReportsNav';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { formatDurationShort, istYmd } from '@/lib/telecaller/crmReportsRange';
import {
  ArrowDownRight,
  ArrowUpRight,
  Headphones,
  Loader2,
  Minus,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

type CallRow = {
  id: string;
  created_at: string;
  call_type: string;
  call_status: string;
  call_duration: number | null;
  phone_number?: string | null;
  notes?: string | null;
  has_recording?: boolean;
  telecaller_name?: string | null;
  lead: {
    id: string;
    lead_number: string;
    customer_name: string;
    customer_phone: string;
    status: string;
    is_incomplete?: boolean;
    telecaller_name?: string | null;
  } | null;
};

type HourRow = { hour: number; count: number; talk?: number; answered?: number };

function pct(n: number) {
  return `${Math.round((Number(n) || 0) * 100)}%`;
}

function DeltaChip({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (!value) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
        <Minus className="h-3 w-3" /> flat vs prev
      </span>
    );
  }
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
        up ? 'text-emerald-700' : 'text-rose-700'
      }`}
    >
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}
      {value}
      {suffix} vs prev
    </span>
  );
}

function statusTone(status: string) {
  const s = status.toUpperCase();
  if (s === 'ANSWERED' || s === 'COMPLETED' || s === 'CONNECTED') {
    return 'bg-emerald-100 text-emerald-900';
  }
  if (s === 'RINGING' || s === 'INITIATED') return 'bg-sky-100 text-sky-900';
  if (s === 'NO_ANSWER' || s === 'MISSED' || s === 'BUSY' || s === 'FAILED') {
    return 'bg-rose-100 text-rose-900';
  }
  return 'bg-slate-100 text-slate-700';
}

export default function CrmReportsCallsPage() {
  const pathname = usePathname();
  const { base, layoutRole, isLeadManager } = getCrmDashboardBase(pathname);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [date, setDate] = useState(istYmd());
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [durationFilter, setDurationFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [delta, setDelta] = useState({ calls: 0, connected: 0, duration_seconds: 0 });
  const [insights, setInsights] = useState<any>(null);
  const [hourly, setHourly] = useState<HourRow[]>([]);
  const [stages, setStages] = useState<Array<{ label: string; count: number }>>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [label, setLabel] = useState('Today');
  const [hourMode, setHourMode] = useState<'count' | 'talk'>('count');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period,
        date,
        status: statusFilter,
        type: typeFilter,
        duration: durationFilter,
      });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/telecaller/crm/reports/calls?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setSummary(json.summary || null);
      setDelta(json.delta || { calls: 0, connected: 0, duration_seconds: 0 });
      setInsights(json.insights || null);
      setHourly(Array.isArray(json.hourly) ? json.hourly : []);
      setStages(Array.isArray(json.stages) ? json.stages : []);
      setCalls(Array.isArray(json.calls) ? json.calls : []);
      setLabel(json.range?.label || period);
    } catch {
      setCalls([]);
      setHourly([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [period, date, q, statusFilter, typeFilter, durationFilter]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const maxHour = useMemo(() => {
    if (hourMode === 'talk') return Math.max(1, ...hourly.map((h) => h.talk || 0));
    return Math.max(1, ...hourly.map((h) => h.count || 0));
  }, [hourly, hourMode]);

  const statusEntries = Object.entries(
    (insights?.status_mix || {}) as Record<string, number>,
  ).sort((a, b) => b[1] - a[1]);

  const setQuickFilter = (kind: 'ALL' | 'CONNECTED' | 'MISSED' | 'OUTBOUND' | 'INBOUND') => {
    if (kind === 'ALL') {
      setStatusFilter('ALL');
      setTypeFilter('ALL');
      setDurationFilter('ALL');
      return;
    }
    if (kind === 'CONNECTED') {
      setStatusFilter('CONNECTED');
      setTypeFilter('ALL');
      return;
    }
    if (kind === 'MISSED') {
      setStatusFilter('MISSED');
      setTypeFilter('ALL');
      return;
    }
    if (kind === 'OUTBOUND') {
      setTypeFilter('OUTBOUND');
      setStatusFilter('ALL');
      return;
    }
    if (kind === 'INBOUND') {
      setTypeFilter('INBOUND');
      setStatusFilter('ALL');
    }
  };

  return (
    <DashboardLayout role={layoutRole}>
      <div className="mx-auto w-full max-w-7xl space-y-4 pb-10">
        <CrmReportsNav
          title="Call activity"
          subtitle={`${label} · advanced live call analytics`}
          onRefresh={load}
          refreshing={loading}
        />

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <PeriodTabs value={period} onChange={setPeriod} />
          {period === 'day' ? (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
            />
          ) : null}
        </div>

        {loading && !summary ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading call activity…
          </div>
        ) : (
          <>
            {/* Hero KPIs */}
            <div className="overflow-hidden rounded-2xl border border-[#004AAD]/20 bg-gradient-to-br from-[#023D95] via-[#004AAD] to-[#0369A1] p-4 text-white shadow-lg sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100/80">
                    Call intelligence
                  </p>
                  <p className="mt-1 text-sm text-blue-100/90">{label}</p>
                  {insights?.peak_hour_ist != null ? (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
                      <Sparkles className="h-3.5 w-3.5" />
                      Peak {insights.peak_hour_ist}:00 IST · {insights.peak_hour_calls} calls
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <DeltaChip value={delta.calls} suffix=" calls" />
                  <DeltaChip value={delta.connected} suffix=" connected" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Kpi
                  label="Calls"
                  value={String(summary?.total_calls ?? 0)}
                  onClick={() => setQuickFilter('ALL')}
                  active={statusFilter === 'ALL' && typeFilter === 'ALL'}
                />
                <Kpi
                  label="Connected"
                  value={String(summary?.connected ?? 0)}
                  onClick={() => setQuickFilter('CONNECTED')}
                  active={statusFilter === 'CONNECTED'}
                />
                <Kpi label="Connect %" value={pct(summary?.connect_rate || 0)} />
                <Kpi
                  label="Talk"
                  value={formatDurationShort(summary?.duration_seconds ?? 0)}
                />
                <Kpi
                  label="Avg talk"
                  value={formatDurationShort(summary?.avg_talk_seconds ?? 0)}
                />
                <Kpi label="Leads touched" value={String(summary?.unique_leads ?? 0)} />
              </div>
            </div>

            {/* Filter chips */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['ALL', 'All'],
                  ['CONNECTED', 'Connected'],
                  ['RINGING', 'Ringing'],
                  ['MISSED', 'Missed'],
                ] as const
              ).map(([id, lbl]) => (
                <Chip
                  key={id}
                  active={statusFilter === id}
                  onClick={() => setStatusFilter(id)}
                  label={lbl}
                />
              ))}
              <span className="mx-1 h-6 w-px bg-slate-200 self-center" />
              {(
                [
                  ['ALL', 'All types'],
                  ['OUTBOUND', 'Outbound'],
                  ['INBOUND', 'Inbound'],
                ] as const
              ).map(([id, lbl]) => (
                <Chip
                  key={`t-${id}`}
                  active={typeFilter === id}
                  onClick={() => setTypeFilter(id)}
                  label={lbl}
                />
              ))}
              <span className="mx-1 h-6 w-px bg-slate-200 self-center" />
              {(
                [
                  ['ALL', 'Any length'],
                  ['ZERO', '0s'],
                  ['SHORT', '<15s'],
                  ['CONNECTED', 'Talked'],
                ] as const
              ).map(([id, lbl]) => (
                <Chip
                  key={`d-${id}`}
                  active={durationFilter === id}
                  onClick={() => setDurationFilter(id)}
                  label={lbl}
                />
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-extrabold text-[#023D95]">Calls by hour (IST)</p>
                    <div className="flex gap-1">
                      <Chip
                        active={hourMode === 'count'}
                        onClick={() => setHourMode('count')}
                        label="Volume"
                      />
                      <Chip
                        active={hourMode === 'talk'}
                        onClick={() => setHourMode('talk')}
                        label="Talk"
                      />
                    </div>
                  </div>
                  <div className="mt-3 sm:mt-4 flex h-36 sm:h-44 items-end gap-0.5 sm:gap-1 overflow-x-auto">
                    {hourly.map((h) => {
                      const val = hourMode === 'talk' ? h.talk || 0 : h.count || 0;
                      const barMaxPx = 128;
                      const barH =
                        val > 0 ? Math.max(12, Math.round((val / maxHour) * barMaxPx)) : 3;
                      return (
                        <div
                          key={h.hour}
                          className="flex min-w-[6px] sm:min-w-0 flex-1 flex-col items-center justify-end gap-1 self-stretch"
                        >
                          <span className="h-3 text-[8px] sm:text-[9px] font-bold leading-none text-slate-600 tabular-nums">
                            {val > 0
                              ? hourMode === 'talk'
                                ? formatDurationShort(val)
                                : val
                              : ''}
                          </span>
                          <div
                            className={`w-full rounded-t-md ${
                              val > 0 ? 'bg-[#004AAD]' : 'bg-slate-100'
                            }`}
                            style={{ height: barH }}
                            title={`${h.hour}:00 — ${h.count} calls · ${formatDurationShort(h.talk || 0)} talk · ${h.answered || 0} ans`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-400">
                    <span>12a</span>
                    <span>6a</span>
                    <span>12p</span>
                    <span>6p</span>
                    <span>11p</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatChip
                    icon={<PhoneIncoming className="h-3.5 w-3.5" />}
                    label="In"
                    value={summary?.incoming ?? 0}
                    onClick={() => setQuickFilter('INBOUND')}
                    active={typeFilter === 'INBOUND'}
                  />
                  <StatChip
                    icon={<PhoneOutgoing className="h-3.5 w-3.5" />}
                    label="Out"
                    value={summary?.outgoing ?? 0}
                    onClick={() => setQuickFilter('OUTBOUND')}
                    active={typeFilter === 'OUTBOUND'}
                  />
                  <StatChip
                    icon={<PhoneMissed className="h-3.5 w-3.5" />}
                    label="Missed"
                    value={summary?.missed ?? 0}
                    onClick={() => setQuickFilter('MISSED')}
                    active={statusFilter === 'MISSED'}
                  />
                  <StatChip
                    icon={<Headphones className="h-3.5 w-3.5" />}
                    label="Recorded"
                    value={summary?.with_recording ?? 0}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-extrabold text-[#023D95]">Status mix</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {statusEntries.length ? (
                        statusEntries.map(([k, v]) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() =>
                              setStatusFilter(
                                k === 'ANSWERED' || k === 'COMPLETED' ? 'CONNECTED' : k,
                              )
                            }
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${statusTone(k)} ring-black/5`}
                          >
                            {k.replace(/_/g, ' ')} · {v}
                          </button>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400">No data</span>
                      )}
                    </div>
                    <ul className="mt-3 space-y-1 text-[11px] text-slate-500">
                      <li>Short connects (&lt;15s): {summary?.short_calls ?? 0}</li>
                      <li>Notes rate: {pct(summary?.notes_rate || 0)}</li>
                      <li>Recording rate: {pct(summary?.recording_rate || 0)}</li>
                    </ul>
                  </div>

                  {stages.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-sm font-extrabold text-[#023D95]">Lead stages</p>
                      <ul className="mt-3 space-y-2">
                        {stages.map((s) => (
                          <li key={s.label} className="flex items-center justify-between text-sm">
                            <span className="inline-flex items-center gap-2 text-slate-600">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              {s.label}
                            </span>
                            <span className="font-bold text-slate-900">{s.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      No lead stages in this filtered set
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Filter by name, phone, lead #"
                    className={`w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 text-sm ${
                      q ? 'pr-9' : 'pr-3'
                    }`}
                  />
                  {q ? (
                    <button
                      type="button"
                      onClick={() => setQ('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                      aria-label="Clear"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <p className="text-xs font-semibold text-slate-500">
                  {loading ? 'Loading…' : `${calls.length} matching calls`}
                </p>

                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : calls.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
                    No calls match these filters
                  </p>
                ) : (
                  <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                    {calls.map((c) => {
                      const phone =
                        c.lead?.customer_phone || c.phone_number || c.lead?.lead_number || '—';
                      const status = String(c.call_status || '—');
                      return (
                        <div
                          key={c.id}
                          className="rounded-2xl border border-slate-200 bg-white px-3 sm:px-4 py-3 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-bold text-slate-900">
                                {c.lead?.customer_name || phone || 'Unknown'}
                              </p>
                              <p className="text-xs text-slate-500">{phone}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[11px] font-semibold text-slate-500">
                                {new Date(c.created_at).toLocaleString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </p>
                              <p className="text-[11px] font-bold text-[#004AAD]">
                                {formatDurationShort(Number(c.call_duration) || 0)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(status)}`}
                            >
                              {status}
                            </span>
                            <Badge tone="soft">{c.call_type || 'OUT'}</Badge>
                            {c.has_recording ? <Badge>Recording</Badge> : null}
                            {c.lead?.is_incomplete ? <Badge tone="warn">Fresh</Badge> : null}
                            {(isLeadManager && (c.telecaller_name || c.lead?.telecaller_name)) ? (
                              <Badge tone="soft">
                                {c.telecaller_name || c.lead?.telecaller_name}
                              </Badge>
                            ) : null}
                          </div>
                          {c.notes ? (
                            <p className="mt-2 line-clamp-2 text-[11px] text-slate-500">{c.notes}</p>
                          ) : null}
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {c.lead?.id ? (
                              <Link
                                href={`${base}/leads/${c.lead.id}`}
                                className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] font-bold text-[#023D95] hover:bg-sky-100"
                              >
                                View lead
                              </Link>
                            ) : null}
                            <Link
                              href={`${base}/dialer`}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#023D95] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#004AAD]"
                            >
                              <Phone className="h-3 w-3" /> Dialer
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function Kpi({
  label,
  value,
  onClick,
  active,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-left ring-1 backdrop-blur-sm ${
        active
          ? 'bg-white text-[#023D95] ring-white'
          : 'bg-white/10 text-white ring-white/15 hover:bg-white/15'
      }`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-wide ${
          active ? 'text-[#004AAD]/70' : 'text-blue-100/80'
        }`}
      >
        {label}
      </p>
      <p className="mt-0.5 text-lg font-black tabular-nums">{value}</p>
    </Comp>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[11px] font-bold ring-1 ${
        active
          ? 'bg-[#023D95] text-white ring-[#023D95]'
          : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function StatChip({
  icon,
  label,
  value,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onClick?: () => void;
  active?: boolean;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left ${
        active
          ? 'border-[#004AAD] bg-[#EFF6FF]'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <span className="text-[#004AAD]">{icon}</span>
      <div>
        <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
        <p className="text-sm font-extrabold text-slate-900">{value}</p>
      </div>
    </Comp>
  );
}

function Badge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'soft' | 'warn';
}) {
  const cls =
    tone === 'warn'
      ? 'bg-amber-100 text-amber-900'
      : tone === 'soft'
        ? 'bg-slate-100 text-slate-700'
        : 'bg-sky-100 text-sky-900';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{children}</span>
  );
}
