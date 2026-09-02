'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Brain,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Megaphone,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  X,
  BookOpen,
} from 'lucide-react';
import PageHelpIcon from '@/components/PageHelpIcon';
import ReportDateRangeFilter from '@/components/admin/ReportDateRangeFilter';
import { type ReportDatePreset } from '@/lib/report-date-range';
import SopAuditCard from '@/components/admin/SopAuditCard';
import type { CallIqSopAudit } from '@/lib/telecaller/callIqSop';
import { toCrmSuggestedStatus } from '@/lib/telecaller/callIqSop';

type AgentRow = {
  telecaller_id: string;
  telecaller_name: string;
  total_calls: number;
  answered: number;
  connect_rate: number;
  talk_seconds: number;
  avg_duration: number;
  with_recording: number;
  recording_rate: number;
  with_notes: number;
  notes_rate: number;
  short_calls: number;
  quality_avg: number;
  sentiment_positive: number;
  sentiment_negative: number;
  high_intent: number;
  performance_score: number;
};

type AnalysisRow = {
  call_log_id: string;
  telecaller_id?: string | null;
  sentiment: string;
  quality_score: number;
  quality_grade: string;
  quality_flags: string[];
  speech_insights: string[];
  conversation_tags: string[];
  summary: string;
  buying_intent: string;
  customer_problem?: string | null;
  customer_problem_categories?: string[];
  agent_solution?: string | null;
  solution_adequacy?: string;
  solution_score?: number;
  coaching_tips?: string[];
  query_resolutions?: Array<{
    id: string;
    query: string;
    agent_answer: string | null;
    resolution: string;
    evidence: string | null;
    gap: string | null;
  }>;
  overall_resolution?: string;
  queries_resolved?: number;
  queries_total?: number;
  unresolved_gaps?: string[];
  customer_name?: string | null;
  telecaller_name?: string | null;
  lead_number?: string | null;
  phone_number?: string | null;
  created_at?: string | null;
  call_duration?: number | null;
  call_status?: string | null;
  has_recording?: boolean;
  sop_audit?: CallIqSopAudit | null;
};

const PAGE_SIZE = 10;

function PaginationBar({
  page,
  totalPages,
  total,
  onPage,
  label,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
  label?: string;
}) {
  if (totalPages <= 1) {
    return total > 0 ? (
      <p className="px-3 py-2 text-[11px] text-slate-500 border-t border-slate-100">
        {total} {label || 'items'}
      </p>
    ) : null;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-2.5">
      <span className="text-xs text-slate-500">
        {total} {label || 'items'} · Page {page} / {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function usePaged<T>(items: T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [items]);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = useMemo(() => {
    const from = (safePage - 1) * pageSize;
    return items.slice(from, from + pageSize);
  }, [items, safePage, pageSize]);
  return { page: safePage, setPage, totalPages, slice, total: items.length };
}

function resolutionTone(s?: string) {
  const u = String(s || '').toUpperCase();
  if (u === 'RESOLVED' || u === 'FULLY_RESOLVED' || u === 'PROPER') {
    return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  }
  if (u === 'PARTIAL' || u === 'PARTIALLY_RESOLVED') {
    return 'bg-amber-50 text-amber-900 ring-amber-200';
  }
  if (u === 'UNRESOLVED' || u === 'NOT_RESOLVED' || u === 'MISSING') {
    return 'bg-red-50 text-red-800 ring-red-200';
  }
  if (u === 'NOT_NEEDED' || u === 'NOT_APPLICABLE') {
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  return 'bg-slate-50 text-slate-500 ring-slate-200';
}

const solutionTone = resolutionTone;

function QueryResolutionBoard({
  queries,
}: {
  queries?: AnalysisRow['query_resolutions'];
}) {
  if (!queries?.length) return null;
  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        Query → answer check
      </p>
      {queries.map((q) => (
        <div
          key={q.id}
          className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-xs"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-semibold text-slate-900">
              <span className="text-orange-700">Q:</span> {q.query}
            </p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${resolutionTone(q.resolution)}`}
            >
              {q.resolution}
            </span>
          </div>
          <p className="mt-1 text-slate-700">
            <span className="font-semibold text-emerald-700">A:</span>{' '}
            {q.agent_answer || '— no clear answer in notes —'}
          </p>
          {q.gap ? (
            <p className="mt-0.5 text-[11px] text-red-700">Gap: {q.gap}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function pct(n: number) {
  return `${Math.round((n || 0) * 100)}%`;
}

function fmtDur(sec: number) {
  const s = Math.round(sec || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function sentimentTone(s: string) {
  const u = s.toUpperCase();
  if (u === 'POSITIVE') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  if (u === 'ANGRY') return 'bg-red-100 text-red-900 ring-red-300';
  if (u === 'NEGATIVE') return 'bg-orange-50 text-orange-800 ring-orange-200';
  if (u === 'UNKNOWN') return 'bg-slate-50 text-slate-500 ring-slate-200';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

function gradeTone(g: string) {
  if (g === 'A') return 'bg-emerald-600 text-white';
  if (g === 'B') return 'bg-teal-600 text-white';
  if (g === 'C') return 'bg-amber-500 text-white';
  if (g === 'D') return 'bg-orange-600 text-white';
  return 'bg-red-600 text-white';
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-lg font-bold text-slate-900 tabular-nums leading-tight">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

export default function CallIntelligencePanel({
  helpHref,
  recordingsHref,
  suiteHref,
  playbookHref,
  workflowHref,
  embedded = false,
}: {
  helpHref: string;
  recordingsHref: string;
  suiteHref?: string;
  playbookHref?: string;
  workflowHref?: string;
  embedded?: boolean;
}) {
  const [preset, setPreset] = useState<ReportDatePreset>('last_7_days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<
    'overview' | 'agents' | 'sentiment' | 'quality' | 'recent' | 'sop'
  >('sop');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentDetail, setAgentDetail] = useState<any>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [openSopId, setOpenSopId] = useState<string | null>(null);
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ preset, limit: '1500' });
      if (preset === 'custom') {
        if (customStart) params.set('start', customStart);
        if (customEnd) params.set('end', customEnd);
      }
      const res = await fetch(`/api/super_admin/call-intelligence?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to load intelligence');
      }
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [preset, customStart, customEnd]);

  const loadAgentDetail = useCallback(
    async (telecallerId: string) => {
      setSelectedAgentId(telecallerId);
      setAgentLoading(true);
      setAgentError(null);
      try {
        const params = new URLSearchParams({
          preset,
          limit: '1500',
          telecaller_id: telecallerId,
        });
        if (preset === 'custom') {
          if (customStart) params.set('start', customStart);
          if (customEnd) params.set('end', customEnd);
        }
        const res = await fetch(`/api/super_admin/call-intelligence?${params}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to load agent report');
        }
        setAgentDetail(json.agent_detail || null);
        if (!json.agent_detail) {
          setAgentError('Agent report not available for this range');
        }
      } catch (e: any) {
        setAgentError(e?.message || 'Failed to load agent');
        setAgentDetail(null);
      } finally {
        setAgentLoading(false);
      }
    },
    [preset, customStart, customEnd],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedAgentId) return;
    void loadAgentDetail(selectedAgentId);
  }, [selectedAgentId, loadAgentDetail]);

  const a = data?.analytics;
  const agents: AgentRow[] = Array.isArray(data?.agents) ? data.agents : [];
  const recent: AnalysisRow[] = Array.isArray(data?.recent) ? data.recent : [];
  const issues: AnalysisRow[] = Array.isArray(data?.top_issues) ? data.top_issues : [];

  const agentsPage = usePaged(agents);
  const issuesPage = usePaged(issues);
  const recentPage = usePaged(recent);
  const agentCalls: AnalysisRow[] = Array.isArray(agentDetail?.calls) ? agentDetail.calls : [];
  const agentCallsPage = usePaged(agentCalls);

  const maxHour = Math.max(1, ...(a?.hourly || []).map((h: any) => h.count || 0));

  const closeAgent = () => {
    setSelectedAgentId(null);
    setAgentDetail(null);
    setAgentError(null);
  };

  return (
    <div className={embedded ? 'px-4 sm:px-6 space-y-4 max-w-[1400px]' : 'p-4 sm:p-6 space-y-4 max-w-[1400px]'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {embedded ? (
          <p className="text-sm text-slate-500">SOP scans, quality, sentiment, and telecaller scores.</p>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Brain className="h-7 w-7 text-violet-700" />
              Call IQ
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              MY FNG Sales SOP audit · qualification · USPs · objections · closing · intent · score /100.
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {embedded ? null : <PageHelpIcon href={helpHref} label="Call IQ" />}
          {suiteHref ? (
            <Link
              href={suiteHref}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              AI Suite
            </Link>
          ) : null}
          {workflowHref ? (
            <Link
              href={workflowHref}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Workflow
            </Link>
          ) : null}
          {playbookHref ? (
            <Link
              href={playbookHref}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <BookOpen className="h-4 w-4" />
              Playbook
            </Link>
          ) : null}
          <Link
            href={recordingsHref}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Recordings
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        <strong>Deep AI</strong> recording sunta hai (transcript) phir SOP. <strong>Free</strong> sirf
        notes + lead fields — bina sunne.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-sm flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 min-w-[160px]">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Date</span>
          <ReportDateRangeFilter
            variant="compact"
            preset={preset}
            customStart={customStart}
            customEnd={customEnd}
            onChange={({ preset: p, customStart: s, customEnd: e }) => {
              setPreset(p);
              setCustomStart(s);
              setCustomEnd(e);
            }}
          />
        </div>
        {!loading && data ? (
          <p className="text-[11px] text-gray-500 pb-2 ml-auto">
            Scanned <span className="font-bold text-gray-800">{data.scanned}</span> calls
            {data.range_label ? ` · ${data.range_label}` : ''}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['sop', 'SOP Audit', BookOpen],
            ['agents', 'Agents', Users],
            ['quality', 'Queries', Sparkles],
            ['overview', 'Analytics', Activity],
            ['sentiment', 'Sentiment', Megaphone],
            ['recent', 'Recordings', Brain],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              if (id !== 'agents') closeAgent();
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
              tab === id
                ? 'bg-violet-700 text-white ring-violet-700'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
          Analyzing calls…
        </div>
      ) : null}

      {!loading && a ? (
        <>
          {tab === 'overview' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Kpi label="Total calls" value={String(a.total_calls)} />
              <Kpi label="Connect rate" value={pct(a.connect_rate)} sub={`${a.answered} answered`} />
              <Kpi label="Avg talk" value={fmtDur(a.avg_talk)} sub={`Total ${fmtDur(a.talk_seconds)}`} />
              <Kpi label="Proper solution" value={String(a.solution_proper ?? 0)} sub="Problem + clear offer" />
              <Kpi
                label="Queries resolved"
                value={pct(a.query_resolve_rate || 0)}
                sub={`${a.queries_resolved_sum || 0}/${a.queries_total_sum || 0} asks`}
              />
              <Kpi
                label="Fully resolved calls"
                value={String(a.fully_resolved_calls ?? 0)}
                sub={`Quality avg ${a.quality_avg}`}
              />
              <Kpi label="Not resolved" value={String(a.not_resolved_calls ?? 0)} sub="Needs coaching" />
              <Kpi label="SOP avg" value={String(a.sop_avg ?? '—')} sub={`${a.sop_high_intent ?? 0} high intent`} />
            </div>
          )}

          {tab === 'overview' ? (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-violet-600" />
                  Speech analytics (timing)
                </h2>
                <p className="text-[11px] text-slate-500 mt-1 mb-3">
                  Hourly call volume & talk time from metadata (free).
                </p>
                <div className="flex items-end gap-1 h-28">
                  {(a.hourly || []).map((h: any) => (
                    <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <div
                        className="w-full rounded-t bg-violet-500/80"
                        style={{ height: `${Math.max(4, (h.count / maxHour) * 100)}%` }}
                        title={`${h.hour}:00 — ${h.count} calls, ${fmtDur(h.talk)} talk`}
                      />
                      <span className="text-[9px] text-slate-400 tabular-nums">
                        {h.hour % 3 === 0 ? h.hour : ''}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-900 ring-1 ring-amber-200">
                    Short connects (&lt;15s): {a.short_calls}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900">Call status</h2>
                <ul className="mt-2 space-y-1 text-[13px]">
                  {Object.entries(a.status_mix || {})
                    .sort((x, y) => Number(y[1]) - Number(x[1]))
                    .slice(0, 6)
                    .map(([k, v]) => (
                      <li key={k} className="flex justify-between">
                        <span className="text-slate-600">{String(k).replace(/_/g, ' ')}</span>
                        <span className="font-bold tabular-nums">{String(v)}</span>
                      </li>
                    ))}
                </ul>
                <h3 className="mt-3 text-[10px] font-bold uppercase text-slate-400">SOP suggested (CRM)</h3>
                <ul className="mt-1 space-y-1 text-[13px]">
                  {Object.entries(a.sop_status_mix || {})
                    .sort((x, y) => Number(y[1]) - Number(x[1]))
                    .slice(0, 6)
                    .map(([k, v]) => (
                      <li key={k} className="flex justify-between">
                        <span className="text-slate-600">{k}</span>
                        <span className="font-bold tabular-nums">{String(v)}</span>
                      </li>
                    ))}
                  {!Object.keys(a.sop_status_mix || {}).length ? (
                    <li className="text-slate-400">No SOP statuses yet</li>
                  ) : null}
                </ul>
              </div>
            </div>
          ) : null}

          {tab === 'agents' && !selectedAgentId ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-100 text-[11px] text-slate-500">
                Agent name pe click → full detailed report
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Agent</th>
                      <th className="px-3 py-2">Score</th>
                      <th className="px-3 py-2">Calls</th>
                      <th className="px-3 py-2">Connect</th>
                      <th className="px-3 py-2">Avg talk</th>
                      <th className="px-3 py-2">Recording</th>
                      <th className="px-3 py-2">Notes</th>
                      <th className="px-3 py-2">Quality</th>
                      <th className="px-3 py-2">+ / − mood</th>
                      <th className="px-3 py-2">High intent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentsPage.slice.map((ag, i) => (
                      <tr
                        key={ag.telecaller_id}
                        className={`border-b border-gray-100 ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}
                      >
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              setTab('agents');
                              setSelectedAgentId(ag.telecaller_id);
                            }}
                            className="font-semibold text-violet-700 hover:text-violet-900 hover:underline text-left"
                          >
                            {ag.telecaller_name}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex rounded-full bg-violet-700 px-2 py-0.5 text-xs font-bold text-white">
                            {ag.performance_score}
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums">{ag.total_calls}</td>
                        <td className="px-3 py-2 tabular-nums">{pct(ag.connect_rate)}</td>
                        <td className="px-3 py-2 tabular-nums">{fmtDur(ag.avg_duration)}</td>
                        <td className="px-3 py-2 tabular-nums">{pct(ag.recording_rate)}</td>
                        <td className="px-3 py-2 tabular-nums">{pct(ag.notes_rate)}</td>
                        <td className="px-3 py-2 tabular-nums">{ag.quality_avg}</td>
                        <td className="px-3 py-2 tabular-nums text-xs">
                          <span className="text-emerald-700 font-semibold">{ag.sentiment_positive}</span>
                          {' / '}
                          <span className="text-red-700 font-semibold">{ag.sentiment_negative}</span>
                        </td>
                        <td className="px-3 py-2 tabular-nums">{ag.high_intent}</td>
                      </tr>
                    ))}
                    {agents.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
                          No agents in range
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <PaginationBar
                page={agentsPage.page}
                totalPages={agentsPage.totalPages}
                total={agentsPage.total}
                onPage={agentsPage.setPage}
                label="agents"
              />
            </div>
          ) : null}

          {tab === 'agents' && selectedAgentId ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={closeAgent}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ChevronLeft className="h-4 w-4" /> All agents
                </button>
                <button
                  type="button"
                  onClick={closeAgent}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {agentLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                  Loading agent report…
                </div>
              ) : null}

              {agentError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {agentError}
                </div>
              ) : null}

              {!agentLoading && agentDetail?.agent ? (
                <>
                  <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600">
                          Agent report
                        </p>
                        <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                          {agentDetail.agent.telecaller_name}
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                          {data?.range_label || 'Selected range'} · {agentDetail.total_calls || 0}{' '}
                          analyzed calls
                        </p>
                      </div>
                      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-violet-700 text-lg font-bold text-white shadow">
                        {agentDetail.agent.performance_score}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                      <Kpi label="Calls" value={String(agentDetail.agent.total_calls)} />
                      <Kpi label="Connect" value={pct(agentDetail.agent.connect_rate)} />
                      <Kpi label="Avg talk" value={fmtDur(agentDetail.agent.avg_duration)} />
                      <Kpi label="Recording" value={pct(agentDetail.agent.recording_rate)} />
                      <Kpi label="Notes" value={pct(agentDetail.agent.notes_rate)} />
                      <Kpi label="Quality avg" value={String(agentDetail.agent.quality_avg)} />
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <h3 className="text-sm font-bold text-slate-900">Resolution mix</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(agentDetail.resolution_mix || {}).map(([k, v]) => (
                          <span
                            key={k}
                            className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${resolutionTone(k)}`}
                          >
                            {k.replace(/_/g, ' ')} · {String(v)}
                          </span>
                        ))}
                        {!Object.keys(agentDetail.resolution_mix || {}).length ? (
                          <span className="text-sm text-slate-400">No resolution data</span>
                        ) : null}
                      </div>
                      <div className="mt-4 flex gap-4 text-sm">
                        <span>
                          <span className="text-emerald-700 font-bold">
                            {agentDetail.agent.sentiment_positive}
                          </span>{' '}
                          <span className="text-slate-500">positive</span>
                        </span>
                        <span>
                          <span className="text-red-700 font-bold">
                            {agentDetail.agent.sentiment_negative}
                          </span>{' '}
                          <span className="text-slate-500">negative</span>
                        </span>
                        <span>
                          <span className="font-bold text-slate-900">
                            {agentDetail.agent.high_intent}
                          </span>{' '}
                          <span className="text-slate-500">high intent</span>
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <h3 className="text-sm font-bold text-slate-900">Problem categories</h3>
                      <ul className="mt-3 space-y-1.5 max-h-40 overflow-y-auto">
                        {Object.entries(agentDetail.problem_category_mix || {})
                          .sort((x, y) => Number(y[1]) - Number(x[1]))
                          .map(([k, v]) => (
                            <li key={k} className="flex justify-between text-sm">
                              <span className="text-slate-600">{k}</span>
                              <span className="font-bold">{String(v)}</span>
                            </li>
                          ))}
                        {!Object.keys(agentDetail.problem_category_mix || {}).length ? (
                          <li className="text-sm text-slate-400">None detected</li>
                        ) : null}
                      </ul>
                    </div>
                  </div>

                  {(agentDetail.top_coaching_tips || []).length ? (
                    <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                      <h3 className="text-sm font-bold text-violet-900">Top coaching tips</h3>
                      <ul className="mt-2 space-y-1 text-sm text-violet-900">
                        {(agentDetail.top_coaching_tips || []).map((t: { tip: string; count: number }) => (
                          <li key={t.tip}>
                            → {t.tip}
                            {t.count > 1 ? (
                              <span className="ml-1 text-[10px] text-violet-600">×{t.count}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-900">Call-by-call detail</h3>
                      <p className="text-[11px] text-slate-500">
                        Queries, resolution & quality for this agent
                      </p>
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {agentCallsPage.slice.map((row) => (
                        <li key={row.call_log_id} className="px-4 py-3 space-y-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {row.customer_name || row.phone_number || 'Call'}
                                {row.lead_number ? (
                                  <span className="ml-2 text-xs font-medium text-teal-700">
                                    #{row.lead_number}
                                  </span>
                                ) : null}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {row.created_at
                                  ? new Date(row.created_at).toLocaleString('en-IN')
                                  : ''}
                                {row.call_duration != null
                                  ? ` · ${fmtDur(row.call_duration)}`
                                  : ''}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-bold ${gradeTone(row.quality_grade)}`}
                              >
                                {row.quality_grade} · {row.quality_score}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${resolutionTone(row.overall_resolution || row.solution_adequacy)}`}
                              >
                                {String(
                                  row.overall_resolution || row.solution_adequacy || 'UNKNOWN',
                                ).replace(/_/g, ' ')}
                                {row.queries_total
                                  ? ` · ${row.queries_resolved || 0}/${row.queries_total}`
                                  : ''}
                              </span>
                            </div>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-orange-50/80 border border-orange-100 px-2.5 py-2">
                              <p className="font-bold uppercase tracking-wide text-[10px] text-orange-700">
                                Customer problem
                              </p>
                              <p className="mt-0.5 text-slate-800">
                                {row.customer_problem || '—'}
                              </p>
                            </div>
                            <div className="rounded-lg bg-emerald-50/80 border border-emerald-100 px-2.5 py-2">
                              <p className="font-bold uppercase tracking-wide text-[10px] text-emerald-700">
                                Telecaller solution
                              </p>
                              <p className="mt-0.5 text-slate-800">
                                {row.agent_solution || '—'}
                              </p>
                            </div>
                          </div>
                          <QueryResolutionBoard queries={row.query_resolutions} />
                          <SopAuditCard sop={row.sop_audit} compact />
                          {(row.coaching_tips || []).length ? (
                            <ul className="text-[11px] text-violet-800 space-y-0.5">
                              {(row.coaching_tips || []).map((t) => (
                                <li key={t}>→ {t}</li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                      {agentCalls.length === 0 ? (
                        <li className="px-4 py-8 text-center text-sm text-slate-400">
                          No analyzed calls for this agent in range
                        </li>
                      ) : null}
                    </ul>
                    <PaginationBar
                      page={agentCallsPage.page}
                      totalPages={agentCallsPage.totalPages}
                      total={agentCallsPage.total}
                      onPage={agentCallsPage.setPage}
                      label="calls"
                    />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {tab === 'sentiment' ? (
            <div className="grid lg:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-2">
                <h2 className="text-sm font-bold text-slate-900">Sentiment mix</h2>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(a.sentiment_mix || {}).map(([k, v]) => (
                    <span
                      key={k}
                      className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${sentimentTone(k)}`}
                    >
                      {k} · {String(v)}
                    </span>
                  ))}
                </div>
                <h3 className="text-xs font-bold uppercase text-slate-400 pt-2">Buying intent</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(a.intent_mix || {}).map(([k, v]) => (
                    <span
                      key={k}
                      className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 ring-1 ring-blue-200"
                    >
                      {k} · {String(v)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900">Conversation tags</h2>
                <ul className="mt-2 space-y-1">
                  {Object.entries(a.tag_mix || {})
                    .sort((x, y) => Number(y[1]) - Number(x[1]))
                    .map(([k, v]) => (
                      <li key={k} className="flex justify-between text-sm">
                        <span className="text-slate-600">{k.replace(/_/g, ' ')}</span>
                        <span className="font-bold">{String(v)}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          ) : null}

          {tab === 'quality' ? (
            <div className="space-y-3">
              <div className="grid lg:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <h2 className="text-sm font-bold text-slate-900">Solution</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(a.solution_mix || {}).map(([k, v]) => (
                      <span
                        key={k}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${solutionTone(k)}`}
                      >
                        {k.replace(/_/g, ' ')} · {String(v)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <h2 className="text-sm font-bold text-slate-900">Problems</h2>
                  <ul className="mt-2 space-y-1 text-[13px]">
                    {Object.entries(a.problem_category_mix || {})
                      .sort((x, y) => Number(y[1]) - Number(x[1]))
                      .slice(0, 6)
                      .map(([k, v]) => (
                        <li key={k} className="flex justify-between">
                          <span className="text-slate-600 truncate pr-2">{k}</span>
                          <span className="font-bold">{String(v)}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-1.5">Lead</th>
                        <th className="px-3 py-1.5">Agent</th>
                        <th className="px-3 py-1.5">Problem</th>
                        <th className="px-3 py-1.5">Solution</th>
                        <th className="px-3 py-1.5">Grade</th>
                        <th className="px-3 py-1.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {issuesPage.slice.map((row, i) => {
                        const open = openIssueId === String(row.call_log_id);
                        return (
                          <Fragment key={row.call_log_id}>
                            <tr className={i % 2 ? 'bg-slate-50/70' : 'bg-white'}>
                              <td className="px-3 py-1.5">
                                <p className="font-semibold text-[13px] leading-tight">
                                  {row.customer_name || row.phone_number || 'Call'}
                                </p>
                                <p className="text-[10px] text-teal-700">{row.lead_number || ''}</p>
                              </td>
                              <td className="px-3 py-1.5 text-xs text-slate-600">
                                {row.telecaller_name || '—'}
                              </td>
                              <td className="px-3 py-1.5 text-[11px] text-slate-700 max-w-[220px]">
                                <span className="line-clamp-1">{row.customer_problem || '—'}</span>
                              </td>
                              <td className="px-3 py-1.5">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ${solutionTone(row.solution_adequacy)}`}
                                >
                                  {(row.solution_adequacy || '—').replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="px-3 py-1.5">
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${gradeTone(row.quality_grade)}`}>
                                  {row.quality_grade} · {row.quality_score}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenIssueId(open ? null : String(row.call_log_id))
                                  }
                                  className="text-[11px] font-semibold text-violet-700"
                                >
                                  {open ? 'Hide' : 'Details'}
                                </button>
                              </td>
                            </tr>
                            {open ? (
                              <tr className="bg-slate-50">
                                <td colSpan={6} className="px-3 py-2 text-[12px]">
                                  <p className="text-orange-800">
                                    <strong>P:</strong> {row.customer_problem || '—'}
                                  </p>
                                  <p className="text-emerald-800 mt-0.5">
                                    <strong>S:</strong> {row.agent_solution || '—'}
                                  </p>
                                  {row.sop_audit ? (
                                    <div className="mt-2">
                                      <SopAuditCard sop={row.sop_audit} hideHeader />
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                      {!issues.length ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                            No coaching gaps in this range
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <PaginationBar
                  page={issuesPage.page}
                  totalPages={issuesPage.totalPages}
                  total={issuesPage.total}
                  onPage={issuesPage.setPage}
                  label="reviews"
                />
              </div>
            </div>
          ) : null}

          {tab === 'sop' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Status</p>
                  <p className="mt-1 text-[11px] text-slate-700 leading-relaxed">
                    {Object.entries(a?.sop_status_mix || {})
                      .sort((x, y) => Number(y[1]) - Number(x[1]))
                      .slice(0, 4)
                      .map(([k, v]) => `${k} ${v}`)
                      .join(' · ') || '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Stage</p>
                  <p className="mt-1 text-[11px] text-slate-700 leading-relaxed">
                    {Object.entries(a?.sop_stage_mix || {})
                      .map(([k, v]) => `${k} ${v}`)
                      .join(' · ') || '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Close</p>
                  <p className="mt-1 text-[11px] text-slate-700 leading-relaxed">
                    {Object.entries(a?.sop_close_mix || {})
                      .map(([k, v]) => `${k} ${v}`)
                      .join(' · ') || '—'}
                  </p>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-1.5">Lead</th>
                        <th className="px-3 py-1.5">Agent</th>
                        <th className="px-3 py-1.5">SOP</th>
                        <th className="px-3 py-1.5">Status</th>
                        <th className="px-3 py-1.5">Intent</th>
                        <th className="px-3 py-1.5">Stage</th>
                        <th className="px-3 py-1.5">Heard</th>
                        <th className="px-3 py-1.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {recentPage.slice.map((row, i) => {
                        const open = openSopId === String(row.call_log_id);
                        return (
                          <Fragment key={row.call_log_id}>
                            <tr
                              className={`border-b border-slate-100 ${i % 2 ? 'bg-slate-50/70' : 'bg-white'}`}
                            >
                              <td className="px-3 py-1.5">
                                <p className="font-semibold text-slate-900 text-[13px] leading-tight">
                                  {row.customer_name || row.phone_number || 'Call'}
                                </p>
                                <p className="text-[10px] text-teal-700 leading-tight">
                                  {row.lead_number || ''}
                                </p>
                              </td>
                              <td className="px-3 py-1.5 text-xs text-slate-600 whitespace-nowrap">
                                {row.telecaller_name || '—'}
                              </td>
                              <td className="px-3 py-1.5">
                                <span className="rounded-full bg-violet-700 px-2 py-0.5 text-[10px] font-bold text-white">
                                  {row.sop_audit?.overall_score ?? row.quality_score}/100
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                                {row.sop_audit
                                  ? toCrmSuggestedStatus(row.sop_audit.suggested_lead_status)
                                  : '—'}
                              </td>
                              <td className="px-3 py-1.5 text-[11px]">
                                {row.sop_audit?.customer_intent_level || '—'}
                              </td>
                              <td className="px-3 py-1.5 text-[11px] text-slate-600">
                                {row.sop_audit?.decision_stage || '—'}
                              </td>
                              <td className="px-3 py-1.5 text-[10px] font-semibold">
                                {row.sop_audit?.audit_source === 'transcript' ? (
                                  <span className="text-emerald-700">Transcript</span>
                                ) : (
                                  <span className="text-slate-400">Notes</span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenSopId(open ? null : String(row.call_log_id))
                                  }
                                  className="text-[11px] font-semibold text-violet-700 hover:underline"
                                >
                                  {open ? 'Hide' : 'Details'}
                                </button>
                              </td>
                            </tr>
                            {open && row.sop_audit ? (
                              <tr className="bg-slate-50">
                                <td colSpan={8} className="px-2 py-2">
                                  <SopAuditCard sop={row.sop_audit} hideHeader />
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                      {!recent.length ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                            No SOP audits in this range
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <PaginationBar
                  page={recentPage.page}
                  totalPages={recentPage.totalPages}
                  total={recentPage.total}
                  onPage={recentPage.setPage}
                  label="audits"
                />
              </div>
            </div>
          ) : null}

          {tab === 'recent' ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Agent</th>
                      <th className="px-3 py-2">Queries (Q→A)</th>
                      <th className="px-3 py-2">Handling</th>
                      <th className="px-3 py-2">Resolution</th>
                      <th className="px-3 py-2">Quality</th>
                      <th className="px-3 py-2">Sentiment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPage.slice.map((row, i) => (
                      <tr
                        key={row.call_log_id}
                        className={`border-b border-gray-100 align-top ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}
                      >
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-900">
                            {row.customer_name || row.phone_number || '—'}
                          </div>
                          <div className="text-[11px] text-slate-400">{row.lead_number || ''}</div>
                        </td>
                        <td className="px-3 py-2">
                          {row.telecaller_id ? (
                            <button
                              type="button"
                              onClick={() => {
                                setTab('agents');
                                setSelectedAgentId(String(row.telecaller_id));
                              }}
                              className="font-medium text-violet-700 hover:underline"
                            >
                              {row.telecaller_name || '—'}
                            </button>
                          ) : (
                            <span className="text-teal-800">{row.telecaller_name || '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700 max-w-[280px]">
                          <QueryResolutionBoard queries={row.query_resolutions} />
                          {!row.query_resolutions?.length ? (
                            <>
                              <div className="text-orange-800">
                                <strong>P:</strong> {row.customer_problem || '—'}
                              </div>
                              <div className="text-emerald-800 mt-0.5">
                                <strong>S:</strong> {row.agent_solution || '—'}
                              </div>
                            </>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700 max-w-[160px]">
                          {row.agent_solution || '—'}
                          {(row.coaching_tips || [])[0] ? (
                            <span className="mt-1 block text-[10px] text-violet-700">
                              Tip: {(row.coaching_tips || [])[0]}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${resolutionTone(row.overall_resolution || row.solution_adequacy)}`}
                          >
                            {String(row.overall_resolution || row.solution_adequacy || 'UNKNOWN').replace(
                              /_/g,
                              ' ',
                            )}
                          </span>
                          {row.queries_total ? (
                            <span className="mt-1 block text-[10px] text-slate-500">
                              {row.queries_resolved || 0}/{row.queries_total} resolved
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${gradeTone(row.quality_grade)}`}
                          >
                            {row.quality_grade} {row.quality_score}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${sentimentTone(row.sentiment)}`}
                          >
                            {row.sentiment}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {recent.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                          No recordings analyzed in this range
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <PaginationBar
                page={recentPage.page}
                totalPages={recentPage.totalPages}
                total={recentPage.total}
                onPage={recentPage.setPage}
                label="calls"
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
