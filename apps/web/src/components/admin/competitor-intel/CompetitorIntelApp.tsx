'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Globe2,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Sparkles,
  Square,
} from 'lucide-react';

type TabId = 'overview' | 'pages' | 'keywords' | 'changes' | 'aio';

type CompetitorListItem = {
  id: string;
  name: string;
  domain: string;
  website_url: string;
  active: boolean;
  notes?: string | null;
  last_run?: {
    started_at: string;
    finished_at?: string | null;
    status: string;
    pages_scanned: number;
    new_pages: number;
    changed_pages: number;
    error?: string | null;
  } | null;
  changes_24h: number;
  open_aio_gaps: number;
};

type Detail = {
  competitor: CompetitorListItem & { slug?: string; seed_paths?: string[] };
  last_run?: CompetitorListItem['last_run'];
  runs?: any[];
  pages: any[];
  keywords: any[];
  changes: any[];
  aio_gaps: any[];
  stats: {
    pages: number;
    keywords: number;
    changes_7d: number;
    changes_today: number;
    open_aio_gaps: number;
    new_pages_7d: number;
  };
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'pages', label: 'Pages' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'changes', label: 'Daily changes' },
  { id: 'aio', label: 'AIO gaps' },
];

function fmtWhen(value?: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function statusTone(status?: string) {
  if (status === 'success' || status === 'healthy') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'failed' || status === 'down') return 'bg-red-50 text-red-700 ring-red-200';
  if (status === 'running' || status === 'cancelling') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status === 'cancelled') return 'bg-slate-100 text-slate-600 ring-slate-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function isActiveScan(status?: string | null) {
  return status === 'running' || status === 'cancelling';
}

export default function CompetitorIntelApp() {
  const [list, setList] = useState<CompetitorListItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tab, setTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [checkUrl, setCheckUrl] = useState('');
  const [missing, setMissing] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    const res = await fetch('/api/super_admin/competitors', { cache: 'no-store' });
    const data = await res.json();
    if (data?.missing) {
      setMissing(data.error || 'Run database/371_competitor_intel.sql');
      setList([]);
      return [];
    }
    if (!res.ok) throw new Error(data?.error || 'Could not load competitors');
    setMissing('');
    const rows = Array.isArray(data.competitors) ? data.competitors : [];
    setList(rows);
    return rows as CompetitorListItem[];
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) {
      setDetail(null);
      return;
    }
    const res = await fetch(`/api/super_admin/competitors/${id}`, { cache: 'no-store' });
    const data = await res.json();
    if (data?.missing) {
      setMissing(data.error || 'Run database/371_competitor_intel.sql');
      return;
    }
    if (!res.ok) throw new Error(data?.error || 'Could not load competitor');
    setDetail(data);
  }, []);

  const refresh = useCallback(async (id?: string) => {
    setError('');
    setLoading(true);
    try {
      const rows = await loadList();
      const nextId = id || selectedId || rows[0]?.id || '';
      setSelectedId(nextId);
      if (nextId) await loadDetail(nextId);
    } catch (err: any) {
      setError(err?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [loadDetail, loadList, selectedId]);

  useEffect(() => {
    void refresh();
    // first load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scanNow = async (url?: string) => {
    if (!selectedId) return;
    setScanning(true);
    setError('');
    try {
      const res = await fetch(`/api/super_admin/competitors/${selectedId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(url ? { url } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Scan failed');
      if (data?.stopped) setError('');
      await refresh(selectedId);
    } catch (err: any) {
      setError(err?.message || 'Scan failed');
    } finally {
      setScanning(false);
      setStopping(false);
    }
  };

  const stopScan = async () => {
    if (!selectedId) return;
    setStopping(true);
    setError('');
    try {
      const res = await fetch(`/api/super_admin/competitors/${selectedId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not stop scan');
      await loadDetail(selectedId);
    } catch (err: any) {
      setError(err?.message || 'Could not stop scan');
      setStopping(false);
    }
  };

  useEffect(() => {
    if (!selectedId) return;
    const busy = scanning || isActiveScan(detail?.last_run?.status);
    if (!busy) return;
    const timer = window.setInterval(() => {
      void loadDetail(selectedId);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [selectedId, scanning, detail?.last_run?.status, loadDetail]);


  const updateGap = async (gapId: string, status: string) => {
    if (!selectedId) return;
    await fetch(`/api/super_admin/competitors/${selectedId}/aio-gaps`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: gapId, status }),
    });
    await loadDetail(selectedId);
    await loadList();
  };

  const addCompetitor = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/super_admin/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addName, website_url: addUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not add competitor');
      setShowAdd(false);
      setAddName('');
      setAddUrl('');
      await refresh(data.competitor?.id);
    } catch (err: any) {
      setError(err?.message || 'Could not add competitor');
    } finally {
      setSaving(false);
    }
  };

  const q = query.trim().toLowerCase();
  const pages = useMemo(
    () => (detail?.pages || []).filter((row) => !q || `${row.path} ${row.title} ${row.h1}`.toLowerCase().includes(q)),
    [detail?.pages, q],
  );
  const keywords = useMemo(
    () => (detail?.keywords || []).filter((row) => !q || String(row.keyword || '').toLowerCase().includes(q)),
    [detail?.keywords, q],
  );
  const changes = useMemo(
    () => (detail?.changes || []).filter((row) => !q || `${row.change_type} ${row.url} ${row.after_value}`.toLowerCase().includes(q)),
    [detail?.changes, q],
  );

  return (
    <div className="min-h-full w-full bg-gradient-to-br from-slate-50 via-orange-50/40 to-amber-50/30 text-slate-800">
      <header className="border-b border-orange-100/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Advanced SEO</p>
              <h1 className="mt-1 text-2xl font-black text-slate-900">Competitors</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Public pages, daily keyword shifts, and AI Overview claim gaps. Lives under Advanced SEO. Public MyFNG content never names the brand.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowAdd((v) => !v)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                <Plus className="h-4 w-4" /> Add
              </button>
              <button type="button" onClick={() => void refresh(selectedId)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
              {scanning || isActiveScan(detail?.last_run?.status) ? (
                <button
                  type="button"
                  disabled={stopping || !selectedId}
                  onClick={() => void stopScan()}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <Square className="h-3.5 w-3.5 fill-current" /> {stopping || detail?.last_run?.status === 'cancelling' ? 'Stopping…' : 'Stop'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!selectedId}
                  onClick={() => void scanNow()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#023D95] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <Radar className="h-4 w-4" /> Scan all
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto]">
            <input
              value={checkUrl}
              onChange={(e) => setCheckUrl(e.target.value)}
              placeholder={detail?.competitor?.domain ? `https://${detail.competitor.domain}/services` : 'https://caryaar.com/services'}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              disabled={!selectedId || scanning || isActiveScan(detail?.last_run?.status)}
            />
            <button
              type="button"
              disabled={!selectedId || !checkUrl.trim() || scanning || isActiveScan(detail?.last_run?.status)}
              onClick={() => void scanNow(checkUrl.trim())}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
            >
              <Search className="h-4 w-4" /> Check this URL
            </button>
          </div>

          {showAdd && (
            <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_1fr_auto]">
              <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Name" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={addUrl} onChange={(e) => setAddUrl(e.target.value)} placeholder="https://competitor.com" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <button type="button" disabled={saving} onClick={() => void addCompetitor()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                {saving ? '…' : 'Save'}
              </button>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1">
            {list.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedId(item.id);
                  void loadDetail(item.id);
                }}
                className={`min-w-[180px] rounded-2xl border px-4 py-3 text-left ${
                  selectedId === item.id ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white'
                }`}
              >
                <p className="font-bold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">{item.domain}</p>
                <p className="mt-1 text-[11px] text-slate-400">{item.changes_24h} changes · {item.open_aio_gaps} AIO gaps</p>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 md:px-6">
        {missing && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {missing}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading competitor intel…</div>
        ) : !detail ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            No competitor yet. Add a public website to start monitoring.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={tab === item.id
                    ? 'rounded-full bg-[#023D95] px-4 py-2 text-sm font-semibold text-white'
                    : 'rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200'}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: 'Pages tracked', value: detail.stats.pages },
                    { label: 'Keywords', value: detail.stats.keywords },
                    { label: 'Changes today', value: detail.stats.changes_today },
                    { label: 'Open AIO gaps', value: detail.stats.open_aio_gaps },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{stat.label}</p>
                      <p className="mt-1 text-3xl font-black text-slate-900">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">Last crawl</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${statusTone(detail.last_run?.status)}`}>
                        {detail.last_run?.status || 'idle'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {fmtWhen(detail.last_run?.finished_at || detail.last_run?.started_at)} IST
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {detail.last_run
                        ? `${detail.last_run.pages_scanned} pages · ${detail.last_run.new_pages} new · ${detail.last_run.changed_pages} changed`
                        : 'No crawl yet. Scan all public pages, or paste one URL above.'}
                    </p>
                    {detail.last_run?.error && <p className="mt-2 text-xs text-red-600">{detail.last_run.error}</p>}
                    <a href={detail.competitor.website_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#023D95]">
                      Open site <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-bold text-slate-900">How AIO is tackled</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-600">
                      <li>We store their quotable claims (no app, prices, cities, hours).</li>
                      <li>MyFNG counter facts stay brand-safe — competitor name never goes on public pages.</li>
                      <li>Open gaps in the AIO tab = pages / FAQs Digital Marketing should refresh.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {tab !== 'overview' && tab !== 'aio' && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter this tab"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm"
                />
              </div>
            )}

            {tab === 'pages' && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {pages.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">No pages yet. Run Scan now.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {pages.map((row) => (
                      <a key={row.id} href={row.url} target="_blank" rel="noreferrer" className="block px-4 py-3 hover:bg-slate-50">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-slate-900">{row.title || row.path}</p>
                          <span className="text-[11px] text-slate-400">{row.path}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{row.h1 || row.meta_description || '—'}</p>
                        <p className="mt-1 text-[11px] text-slate-400">Seen {fmtWhen(row.last_seen_at)} · {row.word_count} words</p>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'keywords' && (
              <div className="flex flex-wrap gap-2">
                {keywords.length === 0 ? (
                  <p className="text-sm text-slate-500">No keywords yet. Scan the site first.</p>
                ) : keywords.map((row) => (
                  <div key={row.id} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm">
                    <span className="font-semibold text-slate-800">{row.keyword}</span>
                    <span className="ml-2 text-[11px] text-slate-400">{row.hit_count}×</span>
                  </div>
                ))}
              </div>
            )}

            {tab === 'changes' && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {changes.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">No changes in the last 7 days. First scan creates the baseline.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {changes.map((row) => (
                      <div key={row.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-700">{row.change_type}</span>
                          <span className="text-[11px] text-slate-400">{fmtWhen(row.detected_at)}</span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-800">{row.url}</p>
                        {row.after_value && <p className="mt-1 text-sm text-slate-600">{row.after_value}</p>}
                        {row.before_value && row.change_type !== 'new_page' && (
                          <p className="mt-0.5 text-xs text-slate-400">Was: {row.before_value}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'aio' && (
              <div className="grid gap-3">
                {(detail.aio_gaps || []).length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                    No AIO claims extracted yet. Scan the site first.
                  </p>
                ) : detail.aio_gaps.map((gap) => (
                  <div key={gap.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black uppercase tracking-wide text-orange-600">{gap.dimension}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${
                        gap.status === 'open' ? 'bg-amber-50 text-amber-700 ring-amber-200' : gap.status === 'covered' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
                      }`}>
                        {gap.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">They say:</span> {gap.competitor_claim}</p>
                    <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">MyFNG fact:</span> {gap.myfng_counter}</p>
                    {gap.suggested_action && <p className="mt-2 text-xs text-slate-500">{gap.suggested_action}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['open', 'covered', 'ignored'].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => void updateGap(gap.id, status)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700"
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center gap-3 pb-8 text-xs text-slate-400">
          <Globe2 className="h-3.5 w-3.5" />
          Public pages only. Cron every 6 hours after `372_competitor_intel_pg_cron.sql`.
          <Sparkles className="h-3.5 w-3.5" />
          AIO = Google AI Overview dimensions, not a Google scrape.
          <Clock3 className="h-3.5 w-3.5" />
          Times in IST.
          <CheckCircle2 className="h-3.5 w-3.5" />
          Under Advanced SEO, next to On-page SEO.
          <AlertTriangle className="h-3.5 w-3.5" />
          Do not crawl /ops or login URLs.
        </div>
      </div>
    </div>
  );
}
