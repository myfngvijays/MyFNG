'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CrmReportsNav, PeriodTabs } from '@/components/telecaller/crm/CrmReportsNav';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { personalLeaderboardLabel } from '@/lib/telecaller/crmPermissions';
import { useCrmPermissions } from '@/lib/telecaller/useCrmPermissions';
import {
  formatDurationShort,
  initialsFromName,
  istYmd,
} from '@/lib/telecaller/crmReportsRange';
import { useAuthStore } from '@/store/authStore';
import {
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Minus,
  Phone,
  Search,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';

type Member = {
  id: string;
  rank: number;
  full_name: string;
  role: string;
  score: number;
  calls: number;
  answered: number;
  missed: number;
  short_calls: number;
  connect_rate: number;
  duration_seconds: number;
  avg_talk_seconds: number;
  bookings: number;
  completed: number;
  book_rate: number;
  with_recording: number;
  recording_rate: number;
  with_notes: number;
  notes_rate: number;
  inbound: number;
  outbound: number;
  first_call_at: string | null;
  last_call_at: string | null;
  status_mix?: Record<string, number>;
  hourly?: number[];
};

type Totals = {
  calls: number;
  answered: number;
  missed: number;
  short_calls: number;
  duration_seconds: number;
  bookings: number;
  completed: number;
  with_recording: number;
  with_notes: number;
  inbound: number;
  outbound: number;
  connect_rate: number;
  avg_talk_seconds: number;
  book_rate: number;
  recording_rate: number;
  notes_rate: number;
  score: number;
};

function pct(n: number) {
  return `${Math.round((Number(n) || 0) * 100)}%`;
}

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function DeltaChip({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (!value) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-100/70">
        <Minus className="h-3 w-3" />0{suffix} vs prev
      </span>
    );
  }
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
        up ? 'text-emerald-300' : 'text-rose-300'
      }`}
    >
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}
      {value}
      {suffix} vs prev
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, Math.round(score || 0)));
  const tone =
    s >= 75 ? 'bg-emerald-600' : s >= 55 ? 'bg-violet-700' : s >= 35 ? 'bg-amber-500' : 'bg-slate-400';
  return (
    <div
      className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full text-white shadow ${tone}`}
      title="Performance score"
    >
      <span className="text-lg font-black leading-none">{s}</span>
      <span className="text-[8px] font-bold uppercase opacity-90">score</span>
    </div>
  );
}

function HourBars({ hourly }: { hourly: Array<{ hour: number; count: number }> | number[] }) {
  const rows = Array.isArray(hourly)
    ? hourly.map((h, i) =>
        typeof h === 'number' ? { hour: i, count: h } : { hour: h.hour, count: h.count },
      )
    : [];
  const max = Math.max(1, ...rows.map((r) => r.count || 0));
  const barMaxPx = 64;
  return (
    <div className="flex h-24 items-end gap-0.5">
      {rows.map((r) => {
        const count = r.count || 0;
        const barH = count > 0 ? Math.max(8, Math.round((count / max) * barMaxPx)) : 2;
        return (
          <div key={r.hour} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5 self-stretch">
            <div
              className={`w-full rounded-t ${count > 0 ? 'bg-[#004AAD]' : 'bg-slate-100'}`}
              style={{ height: barH }}
              title={`${r.hour}:00 — ${count} calls`}
            />
            <span className="text-[8px] tabular-nums text-slate-400">
              {r.hour % 3 === 0 ? r.hour : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function CrmReportsLeaderboardPage() {
  const pathname = usePathname();
  const { layoutRole, isLeadManager, base } = getCrmDashboardBase(pathname);
  const { permissions } = useCrmPermissions();
  const fullName = useAuthStore((s) => s.userProfile?.full_name);
  const teamMode = Boolean(isLeadManager || permissions.reports_team_leaderboard);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [date, setDate] = useState(istYmd());
  const [sort, setSort] = useState<'score' | 'calls' | 'talk' | 'bookings'>('score');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [delta, setDelta] = useState({
    calls: 0,
    answered: 0,
    duration_seconds: 0,
    bookings: 0,
  });
  const [insights, setInsights] = useState<any>(null);
  const [teamSize, setTeamSize] = useState(0);
  const [selectedId, setSelectedId] = useState<string | 'total'>('total');
  const [label, setLabel] = useState('Today');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period, date, sort });
      const res = await fetch(`/api/telecaller/crm/reports/leaderboard?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setMembers(Array.isArray(json.members) ? json.members : []);
      setTotals(json.totals || null);
      setDelta(json.delta || { calls: 0, answered: 0, duration_seconds: 0, bookings: 0 });
      setInsights(json.insights || null);
      setTeamSize(Number(json.team_size) || 0);
      setLabel(json.range?.label || period);
    } catch {
      setMembers([]);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  }, [period, date, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((m) => m.full_name.toLowerCase().includes(needle));
  }, [members, q]);

  const selected =
    selectedId === 'total' ? null : members.find((m) => m.id === selectedId) || null;
  const focus = selected || null;
  const t = totals;

  const kpiGrid = focus
    ? [
        { label: 'Score', value: String(focus.score) },
        { label: 'Calls', value: String(focus.calls) },
        { label: 'Connect', value: pct(focus.connect_rate) },
        { label: 'Avg talk', value: formatDurationShort(focus.avg_talk_seconds) },
        { label: 'Bookings', value: String(focus.bookings) },
        { label: 'Book rate', value: pct(focus.book_rate) },
      ]
    : t
      ? [
          { label: 'Score', value: String(t.score) },
          { label: 'Calls', value: String(t.calls) },
          { label: 'Connect', value: pct(t.connect_rate) },
          { label: 'Avg talk', value: formatDurationShort(t.avg_talk_seconds) },
          { label: 'Bookings', value: String(t.bookings) },
          { label: 'Book rate', value: pct(t.book_rate) },
        ]
      : [];

  const detailRows = focus
    ? [
        { label: 'Answered', value: String(focus.answered) },
        { label: 'Missed / no answer', value: String(focus.missed) },
        { label: 'Short connects (<15s)', value: String(focus.short_calls) },
        { label: 'Talk time', value: formatDurationShort(focus.duration_seconds) },
        { label: 'Inbound / Outbound', value: `${focus.inbound} / ${focus.outbound}` },
        { label: 'With recording', value: `${focus.with_recording} (${pct(focus.recording_rate)})` },
        { label: 'With notes', value: `${focus.with_notes} (${pct(focus.notes_rate)})` },
        { label: 'Completed leads', value: String(focus.completed) },
        { label: 'First call', value: fmtTime(focus.first_call_at) },
        { label: 'Last call', value: fmtTime(focus.last_call_at) },
      ]
    : t
      ? [
          { label: teamMode ? 'Team size' : 'You', value: teamMode ? String(teamSize) : '1' },
          { label: 'Answered', value: String(t.answered) },
          { label: 'Missed / no answer', value: String(t.missed) },
          { label: 'Short connects (<15s)', value: String(t.short_calls) },
          { label: 'Talk time', value: formatDurationShort(t.duration_seconds) },
          { label: 'Inbound / Outbound', value: `${t.inbound} / ${t.outbound}` },
          { label: 'With recording', value: `${t.with_recording} (${pct(t.recording_rate)})` },
          { label: 'With notes', value: `${t.with_notes} (${pct(t.notes_rate)})` },
          { label: 'Completed leads', value: String(t.completed) },
        ]
      : [];

  const hourlySrc = focus?.hourly?.length
    ? focus.hourly
    : insights?.hourly || [];

  const statusEntries = Object.entries(
    (focus?.status_mix || insights?.status_mix || {}) as Record<string, number>,
  ).sort((a, b) => b[1] - a[1]);

  return (
    <DashboardLayout role={layoutRole}>
      <div className="mx-auto w-full max-w-7xl space-y-4 pb-10">
        <CrmReportsNav
          title={teamMode ? 'Leaderboard' : 'My performance'}
          subtitle={
            teamMode
              ? `${label} · ranked by ${sort} · live call logs`
              : `${label} · ${fullName ? `${String(fullName).split(/\s+/)[0]} · ` : ''}advanced stats from live calls`
          }
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
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['score', 'Score'],
                ['calls', 'Calls'],
                ['talk', 'Talk'],
                ['bookings', 'Bookings'],
              ] as const
            ).map(([id, lbl]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSort(id)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold ring-1 ${
                  sort === id
                    ? 'bg-[#023D95] text-white ring-[#023D95]'
                    : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                Sort: {lbl}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading advanced report…
          </div>
        ) : (
          <>
            {/* Hero KPIs + deltas */}
            <div className="overflow-hidden rounded-2xl border border-[#004AAD]/20 bg-gradient-to-br from-[#023D95] via-[#004AAD] to-[#0369A1] p-4 text-white shadow-lg sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100/80">
                    {teamMode && !focus
                      ? 'Team performance'
                      : focus
                        ? focus.full_name
                        : personalLeaderboardLabel(fullName)}
                  </p>
                  <p className="mt-1 text-sm text-blue-100/90">{label}</p>
                  {insights?.peak_hour_ist != null ? (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
                      <Sparkles className="h-3.5 w-3.5" />
                      Peak hour {insights.peak_hour_ist}:00 IST · {insights.peak_hour_calls} calls
                    </p>
                  ) : null}
                </div>
                <ScoreRing score={focus?.score ?? t?.score ?? 0} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {kpiGrid.map((k) => (
                  <div
                    key={k.label}
                    className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide text-blue-100/80">
                      {k.label}
                    </p>
                    <p className="mt-0.5 text-lg font-black tabular-nums">{k.value}</p>
                  </div>
                ))}
              </div>
              {!focus ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  <DeltaChip value={delta.calls} suffix=" calls" />
                  <DeltaChip value={delta.answered} suffix=" answered" />
                  <DeltaChip value={delta.bookings} suffix=" bookings" />
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <TrendingUp className="h-4 w-4 text-[#004AAD]" />
                  Call volume by hour (IST)
                </h3>
                <p className="mt-1 text-[11px] text-slate-500">When dials happened in this range</p>
                <div className="mt-3">
                  <HourBars hourly={hourlySrc} />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900">Status mix</h3>
                <p className="mt-1 text-[11px] text-slate-500">From live call logs</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {statusEntries.length ? (
                    statusEntries.slice(0, 10).map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200"
                      >
                        {k.replace(/_/g, ' ')} · {v}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">No status data</span>
                  )}
                </div>
                {teamMode && insights?.top_performer ? (
                  <p className="mt-4 text-xs text-slate-600">
                    Top:{' '}
                    <button
                      type="button"
                      className="font-bold text-[#023D95] hover:underline"
                      onClick={() => setSelectedId(insights.top_performer.id)}
                    >
                      {insights.top_performer.full_name}
                    </button>{' '}
                    (score {insights.top_performer.score})
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
              <div className="space-y-3">
                {teamMode ? (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search teammate"
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

                    <button
                      type="button"
                      onClick={() => setSelectedId('total')}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selectedId === 'total'
                          ? 'border-[#004AAD] bg-[#EFF6FF] shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-extrabold text-[#023D95]">Team totals</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                          {teamSize} people
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                        <MetricMini label="Score" value={String(t?.score ?? 0)} />
                        <MetricMini label="Calls" value={String(t?.calls ?? 0)} />
                        <MetricMini label="Connect" value={pct(t?.connect_rate || 0)} />
                        <MetricMini label="Books" value={String(t?.bookings ?? 0)} />
                      </div>
                    </button>

                    {filtered.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedId(m.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          selectedId === m.id
                            ? 'border-[#004AAD] bg-[#EFF6FF] shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                              m.rank === 1
                                ? 'bg-amber-400 text-amber-950'
                                : m.rank === 2
                                  ? 'bg-slate-300 text-slate-800'
                                  : m.rank === 3
                                    ? 'bg-orange-300 text-orange-950'
                                    : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            #{m.rank}
                          </span>
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#023D95] text-sm font-bold text-white">
                            {initialsFromName(m.full_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="truncate font-extrabold text-slate-900">
                                  {m.full_name}
                                </p>
                                <p className="text-[11px] font-semibold text-violet-700">
                                  Score {m.score} · {pct(m.connect_rate)} connect
                                </p>
                              </div>
                              <div className="text-right text-[10px] text-slate-500">
                                <p>First {fmtTime(m.first_call_at)}</p>
                                <p>Last {fmtTime(m.last_call_at)}</p>
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                              <MetricMini label="Calls" value={String(m.calls)} />
                              <MetricMini
                                label="Talk"
                                value={formatDurationShort(m.duration_seconds)}
                              />
                              <MetricMini label="Avg" value={formatDurationShort(m.avg_talk_seconds)} />
                              <MetricMini label="Books" value={String(m.bookings)} />
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                    {filtered.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
                        No teammates match this search / period
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Deep dive
                    </p>
                    <ul className="mt-3 divide-y divide-slate-100">
                      {detailRows.map((row) => (
                        <li
                          key={row.label}
                          className="flex items-center justify-between gap-3 py-2.5"
                        >
                          <span className="text-sm text-slate-600">{row.label}</span>
                          <span className="text-sm font-bold text-slate-900">{row.value}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`${base}/reports/calls`}
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#023D95] hover:underline"
                    >
                      <Phone className="h-4 w-4" /> Open call activity →
                    </Link>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm lg:sticky lg:top-4 lg:self-start">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Detail</p>
                <h2 className="mt-1 text-xl font-extrabold text-[#023D95]">
                  {focus ? focus.full_name : teamMode ? 'Team totals' : 'Your stats'}
                </h2>
                {focus ? (
                  <button
                    type="button"
                    onClick={() => setSelectedId('total')}
                    className="mt-1 text-[11px] font-semibold text-slate-500 hover:text-[#023D95]"
                  >
                    ← Back to team
                  </button>
                ) : null}
                <ul className="mt-4 divide-y divide-slate-100">
                  {detailRows.map((row) => (
                    <li key={row.label} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="text-sm text-slate-600">{row.label}</span>
                      <span className="text-sm font-bold text-slate-900">{row.value}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`${base}/reports/calls`}
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#023D95] py-2.5 text-sm font-bold text-white hover:bg-[#004AAD]"
                >
                  <Phone className="h-4 w-4" /> Call activity
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold text-slate-900">{value}</p>
    </div>
  );
}
