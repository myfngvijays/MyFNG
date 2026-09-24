'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { defaultTimesForCount, MAX_DAILY_BLOGS } from '@/lib/blog/dailyBlogSlots';

type DailyPayload = {
  missing?: boolean;
  error?: string;
  settings?: { enabled?: boolean; posts_per_day?: number; post_times?: string[] } | null;
  schedule?: {
    enabled?: boolean;
    schedule?: string;
    next_run_at?: string;
    posts_per_day?: number;
    post_times?: string[];
    last_status?: string | null;
    last_error?: string | null;
    city_rotation?: string;
    usp_rotation?: string;
  };
  last_blog?: { title?: string } | null;
  today_slots?: Array<{ index: number; time: string; status: string; topic?: string | null }>;
  today_posted_count?: number;
};

export default function DailyBlogScheduleCard({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<DailyPayload | null>(null);
  const [count, setCount] = useState(1);
  const [times, setTimes] = useState<string[]>(['10:00']);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch('/api/blogs/daily-settings', { cache: 'no-store' });
    const json = (await res.json().catch(() => ({}))) as DailyPayload;
    setData(json);
    const nextCount = Number(json.schedule?.posts_per_day || json.settings?.posts_per_day || 1);
    const nextTimes = json.schedule?.post_times || json.settings?.post_times || defaultTimesForCount(nextCount);
    setCount(nextCount);
    setTimes(nextTimes.slice(0, nextCount));
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSchedule() {
    setBusy(true);
    try {
      const res = await fetch('/api/blogs/daily-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts_per_day: count, post_times: times }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to save schedule');
      toast.success(`Daily schedule saved: ${count} blog${count > 1 ? 's' : ''}`);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save schedule');
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled() {
    setBusy(true);
    try {
      const enabled = !(data?.settings?.enabled ?? data?.schedule?.enabled);
      const res = await fetch('/api/blogs/daily-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to update');
      toast.success(enabled ? 'Daily auto-post is on' : 'Daily auto-post paused');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    setBusy(true);
    try {
      const res = await fetch('/api/blogs/daily-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_now' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.run?.error || json?.error || 'Failed to publish');
      if (json?.run?.skipped) {
        toast.success(
          json.run.reason === 'already_running'
            ? 'A post is already running. Wait a minute, then try again.'
            : json.run.reason === 'already_posted_today'
              ? 'Today’s slots are already posted'
              : 'Nothing to post right now',
        );
      } else {
        toast.success(json?.run?.title ? `Published: ${json.run.title}` : 'Daily blog published');
      }
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to publish');
    } finally {
      setBusy(false);
    }
  }

  const enabled = data?.settings?.enabled ?? data?.schedule?.enabled;
  const posted = Number(data?.today_posted_count || 0);

  return (
    <section className={`rounded-xl border ${compact ? 'px-3 py-2.5' : 'p-4 sm:p-5'} border-blue-100 bg-blue-50/70`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#023D95]">Daily auto-post schedule</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {data?.missing
              ? data.error || 'Run database/369_daily_blog_slots.sql'
              : `${posted}/${count} posted today · ${data?.schedule?.schedule || '10:00 IST'}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={runNow}
            disabled={busy || Boolean(data?.missing)}
            className="rounded-lg bg-[#023D95] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            {busy ? '…' : 'Post now'}
          </button>
          <button
            type="button"
            onClick={toggleEnabled}
            disabled={busy || Boolean(data?.missing)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
          >
            {enabled ? 'Pause' : 'Enable'}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-slate-700">
          Blogs per day
          <select
            value={count}
            disabled={busy || Boolean(data?.missing)}
            onChange={(e) => {
              const next = Number(e.target.value);
              setCount(next);
              setTimes((prev) => {
                const defaults = defaultTimesForCount(next);
                return Array.from({ length: next }, (_, i) => prev[i] || defaults[i]);
              });
            }}
            className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
          >
            {Array.from({ length: MAX_DAILY_BLOGS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {times.map((time, idx) => (
          <label key={`slot-${idx}`} className="text-xs font-semibold text-slate-700">
            Slot {idx + 1}
            <input
              type="time"
              value={time}
              disabled={busy || Boolean(data?.missing)}
              onChange={(e) => {
                const next = [...times];
                next[idx] = e.target.value;
                setTimes(next);
              }}
              className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            />
          </label>
        ))}
        <button
          type="button"
          onClick={saveSchedule}
          disabled={busy || Boolean(data?.missing)}
          className="rounded-lg border border-[#023D95] bg-white px-3 py-1.5 text-xs font-semibold text-[#023D95] disabled:opacity-60"
        >
          Save schedule
        </button>
      </div>

      {data?.today_slots?.length ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
          {data.today_slots.map((slot) => (
            <span key={slot.index}>
              {slot.time} IST · {slot.status === 'success' ? 'posted' : slot.status === 'failed' ? 'failed' : 'waiting'}
              {slot.topic ? ` · ${slot.topic}` : ''}
            </span>
          ))}
        </div>
      ) : null}
      {data?.schedule?.last_error ? (
        <p className="mt-2 text-[11px] font-semibold text-rose-700">Last error: {data.schedule.last_error}</p>
      ) : null}

      {!compact && data?.schedule?.usp_rotation ? (
        <p className="mt-2 text-[11px] text-slate-500">{data.schedule.usp_rotation}</p>
      ) : null}
    </section>
  );
}
