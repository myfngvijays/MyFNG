'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

type NewsItem = {
  id: string;
  title: string;
  slug: string;
  views: number;
  published_at: string | null;
  auto?: boolean;
};

type NewsPayload = {
  enabled?: boolean;
  pause_available?: boolean;
  posted_today?: number;
  quota?: number;
  schedule?: string;
  recent?: NewsItem[];
  error?: string;
  run?: { success?: boolean; skipped?: boolean; reason?: string; title?: string; error?: string };
};

export default function AutomobileNewsScheduleCard() {
  const [data, setData] = useState<NewsPayload | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch('/api/blogs/automobile-news', { cache: 'no-store' });
    const json = (await res.json().catch(() => ({}))) as NewsPayload;
    setData(json);
  }

  useEffect(() => {
    void load();
  }, []);

  async function runNow() {
    setBusy(true);
    try {
      const res = await fetch('/api/blogs/automobile-news', { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as NewsPayload;
      if (!res.ok) throw new Error(json?.run?.error || json?.error || 'Failed to publish');
      if (json?.run?.skipped) {
        toast.success(json.run.reason === 'quota_met' ? 'Today’s 10 news stories are already posted' : 'No fresh headline right now');
      } else {
        toast.success(json?.run?.title ? `Published: ${json.run.title}` : 'News story published');
      }
      setData(json);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to publish');
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled() {
    setBusy(true);
    try {
      const enabled = !(data?.enabled ?? true);
      const res = await fetch('/api/blogs/automobile-news', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to update');
      toast.success(enabled ? 'News auto-post is on' : 'News auto-post paused');
      setData(json);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setBusy(false);
    }
  }

  const posted = Number(data?.posted_today || 0);
  const quota = Number(data?.quota || 10);
  const enabled = data?.enabled !== false;

  return (
    <section className="rounded-xl border border-[#023D95]/20 bg-[#f4f8ff] px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#023D95]">Automobile news auto-post</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {posted}/{quota} posted today · {data?.schedule || '10:00–14:30 IST · every 30 min'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={runNow}
            disabled={busy}
            className="rounded-lg bg-[#023D95] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Posting…' : 'Post news'}
          </button>
          <button
            type="button"
            onClick={toggleEnabled}
            disabled={busy || data?.pause_available === false}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
          >
            {enabled ? 'Pause' : 'Enable'}
          </button>
          <Link href="/automobile-news" target="_blank" className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#023D95]">
            Live
          </Link>
        </div>
      </div>
      {data?.recent?.length ? (
        <ul className="mt-2 space-y-1">
          {data.recent.slice(0, 4).map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 text-[12px]">
              <Link href={`/dashboard/digital_marketing/blogs/${item.id}/edit`} className="min-w-0 truncate font-medium text-[#023D95] hover:underline">
                {item.title}
              </Link>
              <span className="shrink-0 text-[10px] text-slate-500">{item.views} views{item.auto ? ' · auto' : ''}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">No automobile news yet. Post news publishes the next story.</p>
      )}
    </section>
  );
}
