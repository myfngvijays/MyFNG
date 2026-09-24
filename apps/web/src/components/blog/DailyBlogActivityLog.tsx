'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

function formatLogReason(reason?: string | null) {
  switch (String(reason || '')) {
    case 'waiting_for_next_slot':
      return 'Waiting for next IST slot';
    case 'already_posted_today':
      return 'All due slots already posted';
    case 'disabled':
      return 'Auto-post is paused';
    case 'no_overdue_slot':
      return 'No overdue slot';
    case 'already_running':
      return 'Previous run still in progress';
    case 'cron_auth_denied':
      return 'Cron request unauthorized (secret mismatch)';
    case 'stale_running_reset':
      return 'Stuck running status was reset';
    default:
      return reason || '—';
  }
}

type DayRow = {
  date: string;
  expected: number;
  posted: number;
  failed: number;
  missing: number;
  blogs: Array<{ id: string; title: string; slug: string; published_at: string | null }>;
  runs: Array<{ slot_index: number; status: string; topic?: string | null; error?: string | null }>;
};

type EventRow = {
  created_at?: string;
  source?: string;
  action?: string;
  status?: string;
  reason?: string | null;
  slot_index?: number | null;
  run_date?: string | null;
  topic?: string | null;
  blog_title?: string | null;
  error?: string | null;
  duration_ms?: number | null;
};

type LogsPayload = {
  table_missing?: boolean;
  enabled?: boolean;
  last_status?: string | null;
  last_error?: string | null;
  last_run_at?: string | null;
  last_success_at?: string | null;
  posts_per_day?: number;
  post_times?: string[];
  schedule_label?: string;
  today?: string;
  today_posted?: number;
  today_due?: number;
  days?: DayRow[];
  events?: EventRow[];
  diagnosis?: { level: 'ok' | 'warn' | 'error'; title: string; message: string };
};

function fmtWhen(iso?: string | null) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

function statusCls(status?: string) {
  if (status === 'success') return 'bg-emerald-50 text-emerald-800';
  if (status === 'failed') return 'bg-rose-50 text-rose-800';
  if (status === 'skipped') return 'bg-amber-50 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}

export default function DailyBlogActivityLog() {
  const [data, setData] = useState<LogsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed' | 'skipped' | 'info'>('all');

  async function load() {
    const res = await fetch('/api/blogs/daily-logs', { cache: 'no-store' });
    const json = (await res.json().catch(() => ({}))) as LogsPayload & { error?: string };
    if (!res.ok) {
      setError(json?.error || 'Could not load auto-post logs');
      return;
    }
    setError(null);
    setData(json);
  }

  useEffect(() => {
    void load();
  }, []);

  const events = useMemo(() => {
    const rows = data?.events || [];
    if (filter === 'all') return rows;
    return rows.filter((row) => String(row.status || '') === filter);
  }, [data?.events, filter]);

  const diagnosis = data?.diagnosis;
  const bannerCls =
    diagnosis?.level === 'error'
      ? 'border-rose-200 bg-rose-50'
      : diagnosis?.level === 'warn'
        ? 'border-amber-200 bg-amber-50'
        : 'border-emerald-200 bg-emerald-50';

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#023D95]">Auto-post logs</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Har cron hit, skip, fail, catch-up, aur admin Post now — last 7 days.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
        >
          Refresh
        </button>
      </div>

      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}

      {diagnosis ? (
        <div className={`rounded-lg border px-3 py-2 ${bannerCls}`}>
          <p className="text-sm font-bold text-slate-900">{diagnosis.title}</p>
          <p className="mt-0.5 text-xs text-slate-700">{diagnosis.message}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Schedule {data?.schedule_label || '—'} · last live post {fmtWhen(data?.last_success_at)} · last cron{' '}
            {fmtWhen(data?.last_run_at)}
          </p>
        </div>
      ) : null}

      {data?.table_missing ? (
        <p className="text-[11px] text-amber-800">
          Full tick log table missing — showing reconstructed history from published blogs + daily_blog_runs. Run
          database/378_daily_blog_cron_logs.sql for every cron skip/fail going forward.
        </p>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {(data?.days || []).map((day) => {
          const ok = day.posted >= day.expected && day.expected > 0;
          const empty = day.posted === 0 && day.expected > 0;
          return (
            <div
              key={day.date}
              className={`rounded-lg border px-2 py-1.5 ${
                empty ? 'border-rose-200 bg-rose-50' : ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
              }`}
            >
              <p className="text-[10px] font-bold text-slate-500">{day.date.slice(5)}</p>
              <p className="text-sm font-extrabold text-slate-900">
                {day.posted}/{day.expected}
              </p>
              <p className="text-[10px] text-slate-600">
                {empty ? 'none' : ok ? 'posted' : day.posted > 0 ? 'partial' : day.failed ? 'failed' : 'waiting'}
              </p>
            </div>
          );
        })}
      </div>

      {(data?.days || []).some((d) => d.blogs.length) ? (
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Published daily posts</p>
          {(data?.days || []).flatMap((day) =>
            day.blogs.map((blog) => (
              <div key={blog.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-slate-800">
                  {day.date} · {blog.title}
                </span>
                {blog.slug ? (
                  <Link href={`/blogs/${blog.slug}`} target="_blank" className="shrink-0 text-[#004AAD] hover:underline">
                    Open
                  </Link>
                ) : null}
              </div>
            )),
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {(['all', 'success', 'failed', 'skipped', 'info'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              filter === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {id}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-500">
              <th className="py-1.5 pr-3 font-bold">When (IST)</th>
              <th className="py-1.5 pr-3 font-bold">Source</th>
              <th className="py-1.5 pr-3 font-bold">Status</th>
              <th className="py-1.5 pr-3 font-bold">Slot</th>
              <th className="py-1.5 pr-3 font-bold">Detail</th>
            </tr>
          </thead>
          <tbody>
            {events.length ? (
              events.map((row, idx) => (
                <tr key={`${row.created_at}-${idx}`} className="border-t border-slate-100 align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap text-slate-600">{fmtWhen(row.created_at)}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap text-slate-700">{row.source || '—'}</td>
                  <td className="py-1.5 pr-3">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${statusCls(row.status)}`}>
                      {row.status || row.action || '—'}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-slate-600">{row.slot_index || '—'}</td>
                  <td className="py-1.5 pr-3 text-slate-700">
                    {row.blog_title || row.topic || formatLogReason(row.reason)}
                    {row.error ? <span className="block text-rose-700">{row.error}</span> : null}
                    {row.duration_ms != null ? (
                      <span className="block text-[10px] text-slate-400">{row.duration_ms} ms</span>
                    ) : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-4 text-center text-slate-500">
                  {data ? 'No log rows yet. Next cron tick will appear here.' : 'Loading logs…'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
