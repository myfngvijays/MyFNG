'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Smartphone,
  Apple,
  Monitor,
  Copy,
  Check,
  ExternalLink,
  MousePointerClick,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
} from 'lucide-react';
import AdminGradientBanner, {
  AdminGradientBannerCopy,
  AdminGradientBannerEyebrow,
  AdminGradientBannerTitle,
} from '@/components/admin/AdminGradientBanner';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';
import ReportDateRangeFilter, { type ReportDateRangeValue } from '@/components/admin/ReportDateRangeFilter';
import type { ReportDatePreset } from '@/lib/report-date-range';

type SectionId = 'overview' | 'recent-opens';

type Stats = {
  range?: { label: string };
  universal_url?: string;
  store_urls?: { ios: string; android: string };
  kpis?: {
    clicks_in_range: number;
    ios_in_range: number;
    android_in_range: number;
    desktop_in_range: number;
    total_all_time: number;
    ios_all_time: number;
    android_all_time: number;
    desktop_all_time: number;
  };
  platform_breakdown?: Array<{
    platform: string;
    label: string;
    count: number;
    all_time: number;
  }>;
  daily?: Array<{ date: string; ios: number; android: number; desktop: number; total: number }>;
  utm_sources?: Array<{ label: string; count: number }>;
  utm_mediums?: Array<{ label: string; count: number }>;
  utm_campaigns?: Array<{ label: string; count: number }>;
  recent_events?: Array<{
    id: string;
    created_at: string;
    platform: string;
    source: string;
    referer: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
  }>;
};

const NAV = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
  { id: 'recent-opens' as const, label: 'Recent Opens', icon: MousePointerClick },
];

function sectionFromParam(value: string | null): SectionId {
  // Old Analytics tab → Overview (merged)
  if (value === 'analytics') return 'overview';
  return value === 'recent-opens' ? 'recent-opens' : 'overview';
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
}

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export default function UniversalLinkApp() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading Universal Link…</div>}>
      <UniversalLinkAppInner />
    </Suspense>
  );
}

function UniversalLinkAppInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = sectionFromParam(searchParams.get('section'));
  const [refreshKey, setRefreshKey] = useState(0);

  const setSection = useCallback(
    (next: SectionId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('section', next);
      router.push(`/dashboard/super_admin/universal-link?${params.toString()}`);
    },
    [router, searchParams],
  );

  const current = useMemo(() => NAV.find((n) => n.id === section) || NAV[0], [section]);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
              <Smartphone className="h-6 w-6 text-blue-600" />
              Universal Link
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {current.label} — Smart app download link with iOS / Android tracking
            </p>
          </div>
          <AdminPageRefresh onClick={() => setRefreshKey((key) => key + 1)} />
        </div>
      </div>

      <div className="overflow-x-auto border-b border-gray-200 bg-white px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex min-w-max gap-2 pb-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                  active
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="px-4 py-6 pb-10 sm:px-6 lg:px-8" key={refreshKey}>
        {section === 'overview' ? <OverviewSection onNavigate={setSection} /> : null}
        {section === 'recent-opens' ? <RecentOpensSection /> : null}
      </main>
    </div>
  );
}

function OverviewSection({ onNavigate }: { onNavigate: (s: SectionId) => void }) {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [dateRange, setDateRange] = useState<ReportDateRangeValue>({
    preset: 'last_7_days',
    customStart: '',
    customEnd: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ preset: dateRange.preset });
      if (dateRange.preset === 'custom') {
        if (dateRange.customStart) params.set('from', dateRange.customStart);
        if (dateRange.customEnd) params.set('to', dateRange.customEnd);
      }
      const res = await fetch(`/api/super_admin/universal-link/stats?${params.toString()}`);
      const json = await res.json();
      if (res.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyLink = async () => {
    const url = data?.universal_url || 'https://myfng.in/go/myfngapp';
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const k = data?.kpis;
  const recentEvents = (data?.recent_events || []).slice(0, 20);
  const daily = (data?.daily || []).slice(-20);
  const maxDaily = Math.max(...daily.map((d) => d.total), 1);

  return (
    <div className="space-y-6">
      <AdminGradientBanner className="bg-gradient-to-r from-indigo-600 to-blue-600">
        <AdminGradientBannerEyebrow>Universal link</AdminGradientBannerEyebrow>
        <AdminGradientBannerTitle>One link — auto routes to App Store or Play Store</AdminGradientBannerTitle>
        <AdminGradientBannerCopy className="max-w-3xl">
          Use this link in ads, WhatsApp, SMS, and campaigns. Mobile users are redirected to the correct store;
          desktop users see a fallback page. Stats + UTM analytics yahi Overview me hain.
        </AdminGradientBannerCopy>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 break-all rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-mono text-sm">
            {data?.universal_url || 'https://myfng.in/go/myfngapp'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-700"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <a
              href={data?.universal_url || 'https://myfng.in/go/myfngapp'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm font-bold"
            >
              <ExternalLink className="h-4 w-4" />
              Open
            </a>
          </div>
        </div>

        <p className="m-0 text-xs leading-5" style={{ color: '#bfdbfe' }}>
          Example with UTM:{' '}
          <span className="break-all font-mono">
            {(data?.universal_url || 'https://myfng.in/go/myfngapp')}?utm_source=google&utm_medium=cpc&utm_campaign=launch
          </span>
        </p>
      </AdminGradientBanner>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <ReportDateRangeFilter
          preset={dateRange.preset as ReportDatePreset}
          customStart={dateRange.customStart}
          customEnd={dateRange.customEnd}
          onChange={setDateRange}
        />
        {data?.range?.label ? (
          <p className="mt-2 text-xs text-gray-500">Showing data for: {data.range.label}</p>
        ) : null}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl border bg-white" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Total opens', value: k?.clicks_in_range || 0, sub: 'In selected period', icon: Smartphone },
              { label: 'iOS / App Store', value: k?.ios_in_range || 0, sub: `All-time ${k?.ios_all_time || 0}`, icon: Apple },
              { label: 'Android / Play Store', value: k?.android_in_range || 0, sub: `All-time ${k?.android_all_time || 0}`, icon: Smartphone },
              { label: 'Desktop fallback', value: k?.desktop_in_range || 0, sub: `All-time ${k?.desktop_all_time || 0}`, icon: Monitor },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium leading-4 text-gray-500">{card.label}</p>
                    <Icon className="h-4 w-4 shrink-0 text-blue-600" />
                  </div>
                  <p className="mt-3 text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="mt-2 text-[11px] leading-4 text-gray-500">{card.sub}</p>
                </div>
              );
            })}
          </div>

          <p className="text-xs leading-5 text-gray-500">
            Total opens = iOS + Android + Desktop for the selected period. Desktop counts fallback page views;
            if someone clicks a store button on desktop, that is logged separately under iOS or Android.
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 font-semibold text-gray-900">Platform breakdown (selected period)</h3>
              <div className="space-y-4">
                {(data?.platform_breakdown || []).map((row) => {
                  const total = k?.clicks_in_range || 1;
                  const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
                  return (
                    <div key={row.platform}>
                      <div className="mb-1.5 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-medium text-gray-800">{row.label}</span>
                        <span className="tabular-nums text-gray-600">
                          {row.count} ({pct}%) · all-time {row.all_time}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 font-semibold text-gray-900">Store URLs (configured)</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="mb-1 text-xs font-semibold text-gray-500">App Store (iOS)</p>
                  <a
                    href={data?.store_urls?.ios}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-blue-700 hover:underline"
                  >
                    {data?.store_urls?.ios}
                  </a>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-gray-500">Play Store (Android)</p>
                  <a
                    href={data?.store_urls?.android}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-blue-700 hover:underline"
                  >
                    {data?.store_urls?.android}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {daily.length > 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-1 font-semibold text-gray-900">Daily trend</h3>
              <p className="mb-4 text-sm text-gray-500">Last {daily.length} days in selected period (max 20)</p>
              <div className="space-y-2">
                {daily.map((day) => (
                  <div key={day.date} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 text-gray-600">{day.date}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${Math.max(4, (day.total / maxDaily) * 100)}%` }}
                      />
                    </div>
                    <span className="w-28 shrink-0 text-right text-xs tabular-nums text-gray-700 sm:text-sm">
                      {day.total} · iOS {day.ios} · And {day.android} · Desk {day.desktop}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            {[
              { title: 'Top UTM sources', rows: data?.utm_sources || [] },
              { title: 'Top UTM mediums', rows: data?.utm_mediums || [] },
              { title: 'Top UTM campaigns', rows: data?.utm_campaigns || [] },
            ].map((block) => (
              <div key={block.title} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 font-semibold text-gray-900">{block.title}</h3>
                {block.rows.length === 0 ? (
                  <p className="text-sm text-gray-500">No UTM data in this period</p>
                ) : (
                  <div className="space-y-2">
                    {block.rows.slice(0, 10).map((row) => (
                      <div key={row.label} className="flex items-center justify-between text-sm">
                        <span className="truncate pr-2 text-gray-800">{row.label}</span>
                        <span className="font-bold text-gray-900">{row.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Recent opens</h3>
                <p className="text-sm text-gray-500">
                  Latest 20 hits on /go/myfngapp · full list + filters Recent Opens tab me
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('recent-opens')}
                className="inline-flex items-center gap-1.5 self-start rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white sm:self-auto"
              >
                <MousePointerClick className="h-3.5 w-3.5" />
                View more
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Time</th>
                    <th className="px-4 py-3 font-semibold">Platform</th>
                    <th className="px-4 py-3 font-semibold">Source</th>
                    <th className="px-4 py-3 font-semibold">UTM Source</th>
                    <th className="px-4 py-3 font-semibold">UTM Medium</th>
                    <th className="px-4 py-3 font-semibold">UTM Campaign</th>
                    <th className="px-4 py-3 font-semibold">Referrer</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        No events in this period
                      </td>
                    </tr>
                  ) : (
                    recentEvents.map((ev) => (
                      <tr key={ev.id} className="border-t border-gray-100">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          {ev.created_at ? formatEventDate(ev.created_at) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          {ev.created_at ? formatEventTime(ev.created_at) : '—'}
                        </td>
                        <td className="px-4 py-3 capitalize">{ev.platform}</td>
                        <td className="px-4 py-3 text-gray-700">{ev.source.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-gray-700">{ev.utm_source || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{ev.utm_medium || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{ev.utm_campaign || '—'}</td>
                        <td className="max-w-xs truncate px-4 py-3 text-gray-500">{ev.referer || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RecentOpensSection() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [rangeLabel, setRangeLabel] = useState('');
  const [dateRange, setDateRange] = useState<ReportDateRangeValue>({
    preset: 'last_7_days',
    customStart: '',
    customEnd: '',
  });
  const [platform, setPlatform] = useState('all');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        preset: dateRange.preset,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (dateRange.preset === 'custom') {
        if (dateRange.customStart) params.set('from', dateRange.customStart);
        if (dateRange.customEnd) params.set('to', dateRange.customEnd);
      }
      if (platform !== 'all') params.set('platform', platform);
      if (utmSource.trim()) params.set('utmSource', utmSource.trim());
      if (utmMedium.trim()) params.set('utmMedium', utmMedium.trim());
      if (utmCampaign.trim()) params.set('utmCampaign', utmCampaign.trim());
      if (q.trim()) params.set('q', q.trim());

      const res = await fetch(`/api/super_admin/universal-link/events?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Load failed');
      setEvents(json.events || []);
      setTotal(Number(json.total) || 0);
      setTotalPages(Math.max(1, Number(json.totalPages) || 1));
      setRangeLabel(json.range?.label || '');
    } catch {
      setEvents([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [dateRange, page, pageSize, platform, utmSource, utmMedium, utmCampaign, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [dateRange.preset, dateRange.customStart, dateRange.customEnd, platform, utmSource, utmMedium, utmCampaign, q, pageSize]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4">
        <h2 className="text-xl font-black text-gray-900">Recent Opens</h2>
        <p className="mt-1 text-sm text-gray-600">
          /go/myfngapp ke saare opens — date, platform, UTM filters ke saath. Overview pe max 20 dikhte hain.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <ReportDateRangeFilter
          preset={dateRange.preset as ReportDatePreset}
          customStart={dateRange.customStart}
          customEnd={dateRange.customEnd}
          onChange={setDateRange}
        />
        {rangeLabel ? <p className="text-xs text-gray-500">Period: {rangeLabel}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-600">Platform</span>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="ios">iOS</option>
              <option value="android">Android</option>
              <option value="desktop">Desktop</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-600">UTM source</span>
            <input
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
              placeholder="google"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-600">UTM medium</span>
            <input
              value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value)}
              placeholder="cpc"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-600">UTM campaign</span>
            <input
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
              placeholder="launch"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-600">Search</span>
            <div className="flex gap-1">
              <input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setQ(qInput.trim());
                }}
                placeholder="source / referrer"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setQ(qInput.trim())}
                className="rounded-xl bg-blue-600 px-3 text-white"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <p className="text-sm font-semibold text-gray-700">
            {total.toLocaleString('en-IN')} events · showing {from}–{to}
          </p>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) || 25)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Platform</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">UTM Source</th>
                <th className="px-4 py-3 font-semibold">UTM Medium</th>
                <th className="px-4 py-3 font-semibold">UTM Campaign</th>
                <th className="px-4 py-3 font-semibold">Referrer</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                    No events match these filters
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id} className="border-t border-gray-100">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {ev.created_at ? formatEventDate(ev.created_at) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {ev.created_at ? formatEventTime(ev.created_at) : '—'}
                    </td>
                    <td className="px-4 py-3 capitalize">{ev.platform}</td>
                    <td className="px-4 py-3 text-gray-700">{String(ev.source || '').replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-gray-700">{ev.utm_source || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{ev.utm_medium || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{ev.utm_campaign || '—'}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-gray-500">{ev.referer || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-gray-700">
            Page <span className="text-blue-700">{page}</span> of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
