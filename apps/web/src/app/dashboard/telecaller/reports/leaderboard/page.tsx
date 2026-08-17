'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Loader2, Search } from 'lucide-react';

type Member = {
  id: string;
  rank: number;
  full_name: string;
  role: string;
  calls: number;
  answered: number;
  duration_seconds: number;
  bookings: number;
  completed: number;
  first_call_at: string | null;
  last_call_at: string | null;
};

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

export default function CrmReportsLeaderboardPage() {
  const pathname = usePathname();
  const { layoutRole, isLeadManager } = getCrmDashboardBase(pathname);
  const { permissions } = useCrmPermissions();
  const fullName = useAuthStore((s) => s.userProfile?.full_name);
  const teamMode = Boolean(isLeadManager || permissions.reports_team_leaderboard);
  const boardTitle = teamMode ? 'Leaderboard' : personalLeaderboardLabel(fullName);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [date, setDate] = useState(istYmd());
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [totals, setTotals] = useState({
    calls: 0,
    duration_seconds: 0,
    bookings: 0,
    answered: 0,
  });
  const [teamSize, setTeamSize] = useState(0);
  const [selectedId, setSelectedId] = useState<string | 'total'>('total');
  const [label, setLabel] = useState('Today');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period, date });
      const res = await fetch(`/api/telecaller/crm/reports/leaderboard?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setMembers(Array.isArray(json.members) ? json.members : []);
      setTotals(json.totals || { calls: 0, duration_seconds: 0, bookings: 0, answered: 0 });
      setTeamSize(Number(json.team_size) || 0);
      setLabel(json.range?.label || period);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [period, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((m) => m.full_name.toLowerCase().includes(needle));
  }, [members, q]);

  const selected = selectedId === 'total' ? null : members.find((m) => m.id === selectedId) || null;

  const detailStats = selected
    ? [
        { label: 'Calls', value: String(selected.calls) },
        { label: 'Answered', value: String(selected.answered) },
        { label: 'Talk time', value: formatDurationShort(selected.duration_seconds) },
        { label: 'Bookings', value: String(selected.bookings) },
        { label: 'Completed', value: String(selected.completed) },
        { label: 'First call', value: fmtTime(selected.first_call_at) },
        { label: 'Last call', value: fmtTime(selected.last_call_at) },
      ]
    : [
        { label: 'Team size', value: String(teamSize) },
        { label: 'Calls', value: String(totals.calls) },
        { label: 'Answered', value: String(totals.answered) },
        { label: 'Talk time', value: formatDurationShort(totals.duration_seconds) },
        { label: 'Bookings', value: String(totals.bookings) },
      ];

  return (
    <DashboardLayout role={layoutRole}>
      <div className="mx-auto w-full max-w-7xl space-y-5 pb-10">
        <CrmReportsNav
          title={boardTitle}
          subtitle={
            teamMode
              ? `${label} · ranked by call volume`
              : `${label} · your calls & bookings only`
          }
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
          <div className="space-y-3 order-2 lg:order-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search teammate"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : (
              <>
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
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <MetricMini label="Calls" value={String(totals.calls)} />
                    <MetricMini label="Talk" value={formatDurationShort(totals.duration_seconds)} />
                    <MetricMini label="Bookings" value={String(totals.bookings)} />
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
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#023D95] text-sm font-bold text-white"
                        aria-hidden
                      >
                        {initialsFromName(m.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="truncate font-extrabold text-slate-900">{m.full_name}</p>
                            <p className="text-[11px] font-semibold text-slate-500">{m.role}</p>
                          </div>
                          <div className="text-right text-[10px] text-slate-500">
                            <p>First {fmtTime(m.first_call_at)}</p>
                            <p>Last {fmtTime(m.last_call_at)}</p>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                          <MetricMini label="Calls" value={String(m.calls)} />
                          <MetricMini label="Talk" value={formatDurationShort(m.duration_seconds)} />
                          <MetricMini label="Bookings" value={String(m.bookings)} />
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
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm order-1 lg:order-2 lg:sticky lg:top-4 lg:self-start">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Detail</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#023D95]">
              {selected ? selected.full_name : 'Team totals'}
            </h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {detailStats.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm text-slate-600">{row.label}</span>
                  <span className="text-sm font-bold text-slate-900">{row.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
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
