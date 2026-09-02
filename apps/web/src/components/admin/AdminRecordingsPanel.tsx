'use client';

/** Recordings list: Deep AI expands under Play. Customer opens Bookings, not lead-history. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Brain,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  Square,
  X,
} from 'lucide-react';
import PageHelpIcon from '@/components/PageHelpIcon';
import ReportDateRangeFilter from '@/components/admin/ReportDateRangeFilter';
import CallRecordingPlayer, {
  formatCallLogDuration,
} from '@/components/telecaller/CallRecordingPlayer';
import DeepAiCallResult from '@/components/admin/DeepAiCallResult';
import type { CallIqSopAudit } from '@/lib/telecaller/callIqSop';
import {
  istYmd,
  type ReportDatePreset,
} from '@/lib/report-date-range';
import { leadDisplayStatus, leadStatusCardColors } from '@/lib/telecaller/leadDisplayStatus';
import { usePathname } from 'next/navigation';

type RecordingRow = {
  id: string;
  call_log_id?: string | null;
  lead_id: string | null;
  lead_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  lead_status: string | null;
  city: string | null;
  phone_number: string | null;
  telecaller_id: string | null;
  telecaller_name: string | null;
  call_type: string | null;
  call_status: string | null;
  outcome: string | null;
  call_duration: number | null;
  notes: string | null;
  created_at: string;
  has_recording: boolean;
};

type AnalysisHit = {
  quality_score: number;
  quality_grade: string;
  sentiment: string;
  summary: string;
  conversation_tags: string[];
  customer_problem?: string | null;
  agent_solution?: string | null;
  solution_adequacy?: string;
  coaching_tips?: string[];
  query_resolutions?: Array<{
    id: string;
    query: string;
    agent_answer: string | null;
    resolution: string;
    gap: string | null;
  }>;
  overall_resolution?: string | null;
  queries_resolved?: number;
  queries_total?: number;
  engine?: string;
  sop_audit?: CallIqSopAudit | null;
};

type TelecallerOpt = { id: string; full_name: string };

type Stats = {
  total: number;
  answered: number | null;
  no_answer: number | null;
  with_lead: number | null;
  short: number | null;
};

type SyncMeta = {
  enabled?: boolean;
  last_run_at?: string | null;
  last_run_ok?: boolean | null;
  last_run_summary?: string | null;
  last_skip_reason?: string | null;
  overdue?: boolean;
  can_sync?: boolean;
};

const CALL_STATUS_OPTIONS = [
  'ALL',
  'ANSWERED',
  'NO_ANSWER',
  'BUSY',
  'FAILED',
  'MISSED',
  'CANCELLED',
  'RINGING',
] as const;

const DURATION_OPTIONS = [
  { value: 'ALL', label: 'All durations' },
  { value: 'CONNECTED', label: 'Connected (>0s)' },
  { value: 'SHORT', label: 'Short (1–30s)' },
  { value: 'MEDIUM', label: 'Medium (31–120s)' },
  { value: 'LONG', label: 'Long (>2m)' },
  { value: 'ZERO', label: '0s / unknown' },
] as const;

const GROUP_OPTIONS = [
  { value: 'date', label: 'Group by date' },
  { value: 'telecaller', label: 'Group by telecaller' },
  { value: 'none', label: 'No grouping' },
] as const;

function FilterSelect({
  label,
  value,
  onChange,
  children,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 min-w-[140px] ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {children}
      </select>
    </label>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatWhenCompact(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  const time = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const date = d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
  return `${time} · ${date}`;
}

function callStatusTone(status?: string | null) {
  const s = String(status || '').toUpperCase();
  if (s === 'ANSWERED' || s === 'COMPLETED' || s === 'CONNECTED') {
    return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  }
  if (s === 'NO_ANSWER' || s === 'MISSED' || s === 'BUSY' || s === 'FAILED' || s === 'CANCELLED') {
    return 'bg-red-50 text-red-800 ring-red-200';
  }
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

function sectionLabelForDate(iso: string): string {
  const ymd = (() => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    } catch {
      return String(iso).slice(0, 10);
    }
  })();
  const today = istYmd();
  const yesterday = (() => {
    const [y, m, d] = today.split('-').map(Number);
    const utc = Date.UTC(y, m - 1, d) - 86400000;
    const shifted = new Date(utc - 5.5 * 60 * 60 * 1000);
    return istYmd(shifted);
  })();
  if (ymd === today) return 'Today';
  if (ymd === yesterday) return 'Yesterday';
  try {
    const d = new Date(`${ymd}T12:00:00+05:30`);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return ymd;
  }
}

function groupRows(rows: RecordingRow[], groupBy: string) {
  if (groupBy === 'none') {
    return [{ key: 'all', label: null as string | null, rows }];
  }
  const map = new Map<string, { label: string; rows: RecordingRow[] }>();
  for (const row of rows) {
    let key: string;
    let label: string;
    if (groupBy === 'telecaller') {
      key = row.telecaller_id || row.telecaller_name || 'unknown';
      label = row.telecaller_name || 'Unknown telecaller';
    } else {
      key = sectionLabelForDate(row.created_at);
      label = key;
    }
    const bucket = map.get(key) || { label, rows: [] };
    bucket.rows.push(row);
    map.set(key, bucket);
  }
  return Array.from(map.entries()).map(([key, v]) => ({
    key,
    label: v.label,
    rows: v.rows,
  }));
}

export default function AdminRecordingsPanel({
  helpHref,
  bookingsHref,
}: {
  helpHref: string;
  bookingsHref: string;
}) {
  const [q, setQ] = useState('');
  const [qApplied, setQApplied] = useState('');
  const [preset, setPreset] = useState<ReportDatePreset>('last_30_days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [callStatus, setCallStatus] = useState<string>('ALL');
  const [duration, setDuration] = useState<string>('ALL');
  const [leadLink, setLeadLink] = useState<string>('WITH_LEAD');
  const [telecallerId, setTelecallerId] = useState<string>('ALL');
  const [groupBy, setGroupBy] = useState<'date' | 'telecaller' | 'none'>('date');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RecordingRow[]>([]);
  const [telecallers, setTelecallers] = useState<TelecallerOpt[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    answered: null,
    no_answer: null,
    with_lead: null,
    short: null,
  });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rangeLabel, setRangeLabel] = useState('Last 30 days');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingKey, setAnalyzingKey] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [analysisById, setAnalysisById] = useState<Record<string, AnalysisHit>>({});
  const pathname = usePathname() || '';
  const intelligenceHref = pathname.includes('/lead_manager')
    ? '/dashboard/lead_manager/call-intelligence'
    : '/dashboard/super_admin/call-intelligence';

  const hasActiveFilters =
    callStatus !== 'ALL' ||
    duration !== 'ALL' ||
    leadLink !== 'WITH_LEAD' ||
    telecallerId !== 'ALL' ||
    qApplied.trim() ||
    preset !== 'last_30_days';

  const buildFilterParams = useCallback(
    (opts?: { exportCsv?: boolean; ids?: string[] }) => {
      const params = new URLSearchParams({
        preset,
        call_status: callStatus,
        duration,
        lead_link: leadLink,
        group_by: groupBy,
      });
      if (!opts?.exportCsv) {
        params.set('page', String(page));
        params.set('limit', '40');
      } else {
        params.set('export', '1');
        params.set('limit', '5000');
      }
      if (preset === 'custom') {
        if (customStart) params.set('start', customStart);
        if (customEnd) params.set('end', customEnd);
      }
      if (telecallerId !== 'ALL') params.set('telecaller_id', telecallerId);
      if (qApplied.trim()) params.set('q', qApplied.trim());
      if (opts?.ids && opts.ids.length > 0) {
        params.set('ids', opts.ids.join(','));
      }
      return params;
    },
    [
      page,
      preset,
      customStart,
      customEnd,
      callStatus,
      duration,
      leadLink,
      telecallerId,
      qApplied,
      groupBy,
    ],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const ac = new AbortController();
    const kill = window.setTimeout(() => ac.abort(), 20_000);
    try {
      const params = buildFilterParams();
      const res = await fetch(`/api/super_admin/recordings?${params}`, {
        credentials: 'include',
        cache: 'no-store',
        signal: ac.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to load recordings');
      }
      setRows(Array.isArray(json.rows) ? json.rows : []);
      setTotal(Number(json.total) || 0);
      setTotalPages(Number(json.total_pages) || 1);
      setRangeLabel(String(json.range_label || ''));
      setStats({
        total: Number(json.stats?.total) || Number(json.total) || 0,
        answered: json.stats?.answered ?? null,
        no_answer: json.stats?.no_answer ?? null,
        with_lead: json.stats?.with_lead ?? null,
        short: json.stats?.short ?? null,
      });
      if (Array.isArray(json.telecallers)) {
        setTelecallers(json.telecallers);
      }
      if (json.sync && typeof json.sync === 'object') {
        setSyncMeta(json.sync);
      }
    } catch (e: any) {
      const aborted = e?.name === 'AbortError' || /aborted/i.test(String(e?.message || ''));
      setError(
        aborted
          ? 'Recordings took too long to load. Click Refresh, or Sync now.'
          : e?.message || 'Failed to load',
      );
      setRows([]);
    } finally {
      window.clearTimeout(kill);
      setLoading(false);
    }
  }, [buildFilterParams]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live search: debounce typing → apply filter
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = q.trim();
      setQApplied((prev) => {
        if (prev === next) return prev;
        setPage(1);
        return next;
      });
    }, 350);
    return () => window.clearTimeout(t);
  }, [q]);

  async function handleSyncNow() {
    if (!syncMeta?.can_sync || syncing) return;
    setSyncing(true);
    setError(null);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/super_admin/recordings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || json?.message || 'Recording sync failed');
      }
      setSyncMessage(
        json.message ||
          `Synced ${json.with_recording ?? 0} recording(s) from ${json.fetched ?? 0} CDR row(s)`,
      );
      await load();
    } catch (e: any) {
      setError(e?.message || 'Recording sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function handleExport(mode: 'filtered' | 'selected') {
    if (preset === 'custom' && (!customStart || !customEnd)) {
      setError('Please select both start and end dates for custom range');
      return;
    }
    if (mode === 'selected' && selectedIds.size === 0) return;
    setExporting(true);
    setError(null);
    try {
      const params = buildFilterParams({
        exportCsv: true,
        ids: mode === 'selected' ? Array.from(selectedIds) : undefined,
      });
      const res = await fetch(`/api/super_admin/recordings?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        mode === 'selected'
          ? `recordings-selected-${selectedIds.size}.csv`
          : `recordings-${preset}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handleAnalyze(ids: string[], deep = false, recordingIds: string[] = []) {
    if (!ids.length) return;
    setAnalyzing(true);
    setAnalyzingKey(recordingIds[0] || ids[0] || null);
    setError(null);
    if (deep) setSyncMessage(null);
    try {
      const res = await fetch('/api/super_admin/call-intelligence', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          deep,
          recording_ids: recordingIds.filter(Boolean),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Analyze failed');
      }
      const usedAi = Number(json.used_openai || 0) > 0;
      const warn = Array.isArray(json.warnings) && json.warnings[0] ? String(json.warnings[0]) : '';
      if (deep) {
        if (usedAi) {
          setSyncMessage(
            json.engine === 'openai_deep_v1'
              ? 'Deep AI done — recording transcript + SOP saved. Open the row for details.'
              : 'Deep AI finished.',
          );
        } else {
          setError(warn || 'Deep AI could not run on this call (no transcript/notes). Free score shown.');
        }
      } else if (warn && !/database\/|\.sql/i.test(warn)) {
        setSyncMessage(warn);
      }
      const list = Array.isArray(json.analyses) ? json.analyses : [];
      if (!list.length) {
        throw new Error('Analyze returned no result for this call.');
      }
      const next: Record<string, AnalysisHit> = { ...analysisById };
      for (const a of list) {
        const payload: AnalysisHit = {
          quality_score: a.quality_score,
          quality_grade: a.quality_grade,
          sentiment: a.sentiment,
          summary: a.summary,
          conversation_tags: a.conversation_tags || [],
          customer_problem: a.customer_problem || null,
          agent_solution: a.agent_solution || null,
          solution_adequacy: a.solution_adequacy || 'UNKNOWN',
          coaching_tips: a.coaching_tips || [],
          query_resolutions: a.query_resolutions || [],
          overall_resolution: a.overall_resolution || null,
          queries_resolved: a.queries_resolved,
          queries_total: a.queries_total,
          engine: a.engine || json.engine || null,
          sop_audit: a.sop_audit || null,
        };
        const logId = String(a.call_log_id || '').trim();
        if (logId) next[logId] = payload;
        for (const requested of ids) next[requested] = payload;
        for (const recId of recordingIds) next[recId] = payload;
      }
      setAnalysisById(next);
      const expandId = recordingIds[0] || rows.find((r) => ids.includes(String(r.call_log_id || r.id)))?.id;
      if (deep && expandId) setExpandedId(expandId);
    } catch (e: any) {
      setError(e?.message || 'Analyze failed');
    } finally {
      setAnalyzing(false);
      setAnalyzingKey(null);
    }
  }

  function clearFilters() {
    setQ('');
    setQApplied('');
    setPreset('last_30_days');
    setCustomStart('');
    setCustomEnd('');
    setCallStatus('ALL');
    setDuration('ALL');
    setLeadLink('WITH_LEAD');
    setTelecallerId('ALL');
    setGroupBy('date');
    setPage(1);
    setSelectedIds(new Set());
  }

  const pageIds = useMemo(() => rows.map((r) => r.id).filter(Boolean), [rows]);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  }

  const sections = useMemo(() => groupRows(rows, groupBy), [rows, groupBy]);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1400px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recordings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Only Mahendra / Ajit click-to-call on the 5 MyFNG DIDs — not other Tata numbers.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <PageHelpIcon href={helpHref} label="Recordings" />
          <Link
            href={intelligenceHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100"
          >
            <Brain className="h-4 w-4" />
            Call Intelligence
          </Link>
          <button
            type="button"
            onClick={() => void handleExport('filtered')}
            disabled={exporting || loading || (preset === 'custom' && (!customStart || !customEnd))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          {syncMeta?.can_sync !== false ? (
            <button
              type="button"
              onClick={() => void handleSyncNow()}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          ) : null}
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

      {syncMeta?.last_run_at ? (
        <p className="text-xs text-slate-500">
          Last sync:{' '}
          {formatDateTime(syncMeta.last_run_at)}
          {syncMeta.last_run_ok === false ? ' · failed' : ''}
          {syncMeta.last_run_summary ? ` · ${syncMeta.last_run_summary}` : ''}
        </p>
      ) : null}
      {syncMessage ? (
        <p className="text-xs font-medium text-emerald-700">{syncMessage}</p>
      ) : null}

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setCallStatus('ALL');
            setDuration('ALL');
            setLeadLink('WITH_LEAD');
            setPage(1);
          }}
          className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
            callStatus === 'ALL' && duration === 'ALL' && leadLink === 'WITH_LEAD'
              ? 'bg-blue-600 text-white ring-blue-600'
              : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          All {stats.total.toLocaleString('en-IN')}
        </button>
        {stats.answered != null ? (
          <button
            type="button"
            onClick={() => {
              setCallStatus('ANSWERED');
              setPage(1);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
              callStatus === 'ANSWERED'
                ? 'bg-emerald-600 text-white ring-emerald-600'
                : 'bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Answered {stats.answered.toLocaleString('en-IN')}
          </button>
        ) : null}
        {stats.no_answer != null ? (
          <button
            type="button"
            onClick={() => {
              setCallStatus('NO_ANSWER');
              setPage(1);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
              callStatus === 'NO_ANSWER'
                ? 'bg-red-600 text-white ring-red-600'
                : 'bg-red-50 text-red-800 ring-red-200 hover:bg-red-100'
            }`}
          >
            No answer {stats.no_answer.toLocaleString('en-IN')}
          </button>
        ) : null}
        {stats.short != null ? (
          <button
            type="button"
            onClick={() => {
              setDuration('SHORT');
              setPage(1);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
              duration === 'SHORT'
                ? 'bg-amber-600 text-white ring-amber-600'
                : 'bg-amber-50 text-amber-900 ring-amber-200 hover:bg-amber-100'
            }`}
          >
            Short ≤30s {stats.short.toLocaleString('en-IN')}
          </button>
        ) : null}
        {stats.with_lead != null ? (
          <button
            type="button"
            onClick={() => {
              setLeadLink('WITH_LEAD');
              setPage(1);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
              leadLink === 'WITH_LEAD'
                ? 'bg-violet-700 text-white ring-violet-700'
                : 'bg-violet-50 text-violet-800 ring-violet-200 hover:bg-violet-100'
            }`}
          >
            With lead {stats.with_lead.toLocaleString('en-IN')}
          </button>
        ) : null}
      </div>

      {/* Filters — same pattern as Bookings & Leads */}
      <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-sm space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 min-w-[160px]">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Date</span>
            <ReportDateRangeFilter
              variant="compact"
              preset={preset}
              customStart={customStart}
              customEnd={customEnd}
              onChange={({ preset: p, customStart: s, customEnd: e }) => {
                setPage(1);
                setPreset(p);
                setCustomStart(s);
                setCustomEnd(e);
              }}
            />
          </div>

          <FilterSelect
            label="Call status"
            value={callStatus}
            onChange={(v) => {
              setPage(1);
              setCallStatus(v);
            }}
            className="min-w-[160px]"
          >
            {CALL_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All statuses' : s.replace(/_/g, ' ')}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Duration"
            value={duration}
            onChange={(v) => {
              setPage(1);
              setDuration(v);
            }}
            className="min-w-[170px]"
          >
            {DURATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Telecaller"
            value={telecallerId}
            onChange={(v) => {
              setPage(1);
              setTelecallerId(v);
            }}
            className="min-w-[180px]"
          >
            <option value="ALL">All telecallers</option>
            {telecallers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Segregate"
            value={groupBy}
            onChange={(v) => setGroupBy(v as 'date' | 'telecaller' | 'none')}
            className="min-w-[170px]"
          >
            {GROUP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>

          <div className="flex flex-col gap-1 min-w-[220px] flex-1 max-w-md">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Type phone, name, lead #…"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="off"
              />
              {q ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                  onClick={() => {
                    setQ('');
                    setQApplied('');
                    setPage(1);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <span className="text-[10px] text-gray-400">Searches as you type</span>
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mb-0.5 inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          ) : null}

          {!loading ? (
            <p className="text-[11px] text-gray-500 ml-auto shrink-0 pb-2 text-right">
              <span className="font-bold text-gray-800">{total.toLocaleString('en-IN')}</span>
              {' recordings'}
              {rangeLabel ? <span className="text-gray-400"> · {rangeLabel}</span> : null}
            </p>
          ) : null}
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 shadow-sm">
          <span className="text-sm font-bold text-blue-900">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={() => void handleExport('selected')}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export selected
          </button>
          <button
            type="button"
            onClick={() => {
              const recIds = Array.from(selectedIds);
              const logIds = recIds.map((id) => {
                const row = rows.find((r) => r.id === id);
                return String(row?.call_log_id || id);
              });
              void handleAnalyze(logIds, false, recIds);
            }}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
            Analyze queries
          </button>
          <button
            type="button"
            onClick={() => {
              const recIds = Array.from(selectedIds);
              const logIds = recIds.map((id) => {
                const row = rows.find((r) => r.id === id);
                return String(row?.call_log_id || id);
              });
              void handleAnalyze(logIds, true, recIds);
            }}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-900 disabled:opacity-50"
            title="Transcribes this recording, then runs OpenAI SOP (10–30s)."
          >
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Deep AI
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs font-semibold text-blue-800 hover:underline"
          >
            Clear selection
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          Loading recordings…
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
          No recordings match these filters. Try clearing filters or widening the date range.
        </div>
      ) : null}

      {/* CRM-style table */}
      {!loading && rows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-2 w-10">
                    <button
                      type="button"
                      onClick={toggleSelectPage}
                      className="p-1 rounded hover:bg-gray-200"
                      title={allPageSelected ? 'Deselect page' : 'Select page'}
                      aria-label={allPageSelected ? 'Deselect page' : 'Select page'}
                    >
                      {allPageSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : somePageSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-2 py-2 whitespace-nowrap">Lead status</th>
                  <th className="px-2 py-2 whitespace-nowrap">Call</th>
                  <th className="px-2 py-2 whitespace-nowrap">Customer</th>
                  <th className="px-2 py-2 whitespace-nowrap">Phone</th>
                  <th className="px-2 py-2 whitespace-nowrap">Telecaller</th>
                  <th className="px-2 py-2 whitespace-nowrap">Duration</th>
                  <th className="px-2 py-2 whitespace-nowrap">When</th>
                  <th className="px-2 py-2 whitespace-nowrap">AI</th>
                  <th className="px-2 py-2 text-right whitespace-nowrap">Play</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => (
                  <SectionRows
                    key={section.key}
                    label={section.label}
                    rows={section.rows}
                    colSpan={10}
                    expandedId={expandedId}
                    setExpandedId={setExpandedId}
                    bookingsHref={bookingsHref}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    analysisById={analysisById}
                    analyzing={analyzing}
                    analyzingKey={analyzingKey}
                    onAnalyze={(row) =>
                      void handleAnalyze([String(row.call_log_id || row.id)], false, [row.id])
                    }
                    onDeepAnalyze={(row) =>
                      void handleAnalyze([String(row.call_log_id || row.id)], true, [row.id])
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-3 py-2.5 bg-slate-50/80">
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SectionRows({
  label,
  rows,
  colSpan,
  expandedId,
  setExpandedId,
  bookingsHref,
  selectedIds,
  onToggleSelect,
  analysisById,
  analyzing,
  analyzingKey,
  onAnalyze,
  onDeepAnalyze,
}: {
  label: string | null;
  rows: RecordingRow[];
  colSpan: number;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  bookingsHref: string;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  analysisById: Record<string, AnalysisHit>;
  analyzing: boolean;
  analyzingKey: string | null;
  onAnalyze: (row: RecordingRow) => void;
  onDeepAnalyze: (row: RecordingRow) => void;
}) {
  return (
    <>
      {label ? (
        <tr className="bg-slate-100/90">
          <td
            colSpan={colSpan}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            {label}
            <span className="ml-2 font-semibold normal-case text-slate-400">
              ({rows.length})
            </span>
          </td>
        </tr>
      ) : null}
      {rows.map((row, idx) => {
        const phone = row.customer_phone || row.phone_number || '—';
        const open = expandedId === row.id;
        const isSelected = selectedIds.has(row.id);
        const zebra = isSelected
          ? 'bg-blue-50'
          : idx % 2 === 0
            ? 'bg-white'
            : 'bg-slate-50';
        const disp = row.lead_id
          ? leadDisplayStatus({ status: row.lead_status } as any) || row.lead_status
          : null;
        const statusColors = leadStatusCardColors(String(disp || ''));
        const customer = (
          <span className="truncate">
            {row.customer_name || '—'}
            {row.city ? <span className="text-gray-400 font-normal"> · {row.city}</span> : null}
          </span>
        );
        return (
          <FragmentRow key={row.id}>
            <tr className={`border-b border-gray-100 h-10 ${zebra} hover:bg-sky-50/70`}>
              <td
                className="px-2 py-1 align-middle w-10"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => onToggleSelect(row.id)}
                  className="p-0.5 rounded hover:bg-gray-200"
                  aria-label={isSelected ? 'Deselect' : 'Select'}
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </td>
              <td className="px-2 py-1 align-middle whitespace-nowrap">
                {disp ? (
                  <span
                    className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: statusColors.badgeBg,
                      color: statusColors.badgeText,
                    }}
                  >
                    {String(disp).replace(/_/g, ' ')}
                  </span>
                ) : (
                  <span className="text-gray-300 text-sm">—</span>
                )}
              </td>
              <td className="px-2 py-1 align-middle whitespace-nowrap">
                <span
                  className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${callStatusTone(row.call_status)}`}
                >
                  <Phone className="h-3 w-3" />
                  {String(row.call_status || 'CALL').replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-2 py-1 align-middle text-[13px] text-gray-800 max-w-[180px]">
                {row.lead_id ? (
                  <Link
                    href={`${bookingsHref}?search=${encodeURIComponent(
                      String(row.lead_number || row.customer_phone || row.phone_number || '').trim(),
                    )}`}
                    className="text-teal-700 hover:underline font-medium"
                  >
                    {customer}
                  </Link>
                ) : (
                  customer
                )}
              </td>
              <td className="px-2 py-1 align-middle text-[13px] tabular-nums text-gray-700 whitespace-nowrap">
                {phone}
              </td>
              <td className="px-2 py-1 align-middle text-[13px] font-medium text-teal-800 whitespace-nowrap">
                {row.telecaller_name || '—'}
              </td>
              <td className="px-2 py-1 align-middle text-[13px] font-semibold text-slate-700 whitespace-nowrap">
                {formatCallLogDuration(row.call_duration)}
              </td>
              <td className="px-2 py-1 align-middle text-[10px] text-gray-600 whitespace-nowrap">
                {formatWhenCompact(row.created_at)}
              </td>
              <td className="px-2 py-1 align-middle" onClick={(e) => e.stopPropagation()}>
                {(() => {
                  const key = String(row.call_log_id || row.id);
                  const hit = analysisById[key] || analysisById[row.id];
                  const busy = analyzing && (analyzingKey === row.id || analyzingKey === key);
                  const isDeep =
                    String(hit?.engine || '').includes('openai') ||
                    String(hit?.sop_audit?.engine || '').includes('openai');
                  if (hit) {
                    return (
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${
                            isDeep ? 'bg-indigo-700' : 'bg-violet-700'
                          }`}
                          title={hit.summary || ''}
                        >
                          {isDeep ? 'Deep ' : ''}
                          {hit.quality_grade} {hit.quality_score}
                        </span>
                        <button
                          type="button"
                          disabled={analyzing}
                          onClick={() => onDeepAnalyze(row)}
                          className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800 disabled:opacity-50"
                          title="Transcribe recording and run Deep AI SOP"
                        >
                          {busy ? '…' : 'Deep AI'}
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={analyzing}
                        onClick={() => onAnalyze(row)}
                        className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-50"
                      >
                        <Brain className="h-3 w-3" />
                        {busy ? '…' : 'Analyze'}
                      </button>
                      <button
                        type="button"
                        disabled={analyzing}
                        onClick={() => onDeepAnalyze(row)}
                        className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        {busy ? '…' : 'Deep AI'}
                      </button>
                    </div>
                  );
                })()}
              </td>
              <td className="px-2 py-1 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                {row.has_recording && !open ? (
                  <CallRecordingPlayer
                    callLogId={row.id}
                    hasRecording
                    showChipDuration={false}
                    durationSeconds={
                      row.call_duration != null ? Number(row.call_duration) : null
                    }
                    open={false}
                    onOpenChange={(next) => setExpandedId(next ? row.id : null)}
                  />
                ) : row.has_recording && open ? (
                  <span className="text-[11px] font-semibold text-violet-700">Playing…</span>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </td>
            </tr>
            {open ? (
              <tr className="border-b border-violet-100 bg-slate-50/80">
                <td colSpan={colSpan} className="px-3 py-3">
                  <CallRecordingPlayer
                    callLogId={row.id}
                    hasRecording
                    durationSeconds={
                      row.call_duration != null ? Number(row.call_duration) : null
                    }
                    open
                    onOpenChange={(next) => setExpandedId(next ? row.id : null)}
                  />
                  {(() => {
                    const hit = analysisById[String(row.call_log_id || row.id)] || analysisById[row.id];
                    return hit ? <DeepAiCallResult hit={hit} /> : null;
                  })()}
                </td>
              </tr>
            ) : null}
          </FragmentRow>
        );
      })}
    </>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
