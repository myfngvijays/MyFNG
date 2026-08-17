'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CrmReportsNav, PeriodTabs } from '@/components/telecaller/crm/CrmReportsNav';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { formatDurationShort, istYmd } from '@/lib/telecaller/crmReportsRange';
import { Loader2, Search, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';

type CallRow = {
  id: string;
  created_at: string;
  call_type: string;
  call_status: string;
  call_duration: number | null;
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

export default function CrmReportsCallsPage() {
  const pathname = usePathname();
  const { base, layoutRole, isLeadManager } = getCrmDashboardBase(pathname);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [date, setDate] = useState(istYmd());
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [hourly, setHourly] = useState<Array<{ hour: number; count: number }>>([]);
  const [stages, setStages] = useState<Array<{ label: string; count: number }>>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [label, setLabel] = useState('Today');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period, date });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/telecaller/crm/reports/calls?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setSummary(json.summary || null);
      setHourly(Array.isArray(json.hourly) ? json.hourly : []);
      setStages(Array.isArray(json.stages) ? json.stages : []);
      setCalls(Array.isArray(json.calls) ? json.calls : []);
      setLabel(json.range?.label || period);
    } catch {
      setCalls([]);
      setHourly([]);
    } finally {
      setLoading(false);
    }
  }, [period, date, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const maxHour = useMemo(
    () => Math.max(1, ...hourly.map((h) => h.count)),
    [hourly],
  );

  return (
    <DashboardLayout role={layoutRole}>
      <div className="mx-auto w-full max-w-7xl space-y-5 pb-10">
        <CrmReportsNav
          title="Call activity"
          subtitle={`${label} · live from telecaller call logs`}
          onRefresh={load}
          refreshing={loading}
        />

        <div className="flex flex-wrap items-center gap-3">
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

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 order-1">
            <div className="grid grid-cols-3 gap-2">
              <SummaryTile
                tone="primary"
                label="Calls"
                value={String(summary?.total_calls ?? 0)}
              />
              <SummaryTile
                tone="muted"
                label="Talk time"
                value={formatDurationShort(summary?.duration_seconds ?? 0)}
              />
              <SummaryTile
                tone="muted"
                label="Leads touched"
                value={String(summary?.unique_leads ?? 0)}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
              <p className="text-sm font-extrabold text-[#023D95]">Calls by hour (IST)</p>
              <div className="mt-3 sm:mt-4 flex h-32 sm:h-40 items-end gap-0.5 sm:gap-1 overflow-x-auto">
                {hourly.map((h) => (
                  <div key={h.hour} className="flex min-w-[6px] sm:min-w-0 flex-1 flex-col items-center gap-1">
                    <span className="text-[8px] sm:text-[9px] font-bold text-slate-500">
                      {h.count > 0 ? h.count : ''}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-[#004AAD]/85"
                      style={{ height: `${Math.max(4, (h.count / maxHour) * 100)}%` }}
                      title={`${h.hour}:00 — ${h.count}`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-400">
                <span>12a</span>
                <span>6a</span>
                <span>12p</span>
                <span>6p</span>
                <span>11p</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <StatChip icon={<PhoneIncoming className="h-3.5 w-3.5" />} label="In" value={summary?.incoming ?? 0} />
              <StatChip icon={<PhoneOutgoing className="h-3.5 w-3.5" />} label="Out" value={summary?.outgoing ?? 0} />
              <StatChip icon={<PhoneMissed className="h-3.5 w-3.5" />} label="Missed" value={summary?.missed ?? 0} />
            </div>

            {stages.length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-extrabold text-[#023D95]">Lead stages in this set</p>
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
            ) : null}
          </div>

          <div className="space-y-3 order-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter by name, phone, lead #"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm"
              />
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
                No calls in this period
              </p>
            ) : (
              <div className="max-h-[55vh] sm:max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                {calls.map((c) => (
                  <Link
                    key={c.id}
                    href={c.lead?.id ? `${base}/leads/${c.lead.id}` : '#'}
                    className="block rounded-2xl border border-slate-200 bg-white px-3 sm:px-4 py-3 shadow-sm transition hover:border-[#004AAD]/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-900">
                          {c.lead?.customer_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {c.lead?.customer_phone || c.lead?.lead_number || '—'}
                        </p>
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
                      <Badge>{c.call_status || '—'}</Badge>
                      <Badge tone="soft">{c.call_type || 'OUT'}</Badge>
                      {c.lead?.is_incomplete ? <Badge tone="warn">Incomplete</Badge> : null}
                      {isLeadManager && c.lead?.telecaller_name ? (
                        <Badge tone="soft">{c.lead.telecaller_name}</Badge>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'primary' | 'muted';
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-4 text-center shadow-sm ${
        tone === 'primary'
          ? 'border-[#023D95] bg-[#023D95] text-white'
          : 'border-slate-200 bg-white text-slate-900'
      }`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-wide ${
          tone === 'primary' ? 'text-blue-100' : 'text-slate-400'
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <span className="text-[#004AAD]">{icon}</span>
      <div>
        <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
        <p className="text-sm font-extrabold text-slate-900">{value}</p>
      </div>
    </div>
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
