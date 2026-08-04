'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  Smartphone,
  Apple,
  Monitor,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import AdminGradientBanner, {
  AdminGradientBannerCopy,
  AdminGradientBannerEyebrow,
  AdminGradientBannerTitle,
} from '@/components/admin/AdminGradientBanner';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';
import ReportDateRangeFilter, { type ReportDateRangeValue } from '@/components/admin/ReportDateRangeFilter';
import type { ReportDatePreset } from '@/lib/report-date-range';

type SectionId = 'overview' | 'analytics';

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
  { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
];

function sectionFromParam(value: string | null): SectionId {
  return value === 'analytics' ? 'analytics' : 'overview';
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
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [dateRange, setDateRange] = useState<ReportDateRangeValue>({
    preset: 'last_7_days',
    customStart: '',
    customEnd: '',
  });

  const setSection = useCallback(
    (next: SectionId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('section', next);
      router.push(`/dashboard/super_admin/universal-link?${params.toString()}`);
    },
    [router, searchParams],
  );

  const current = useMemo(() => NAV.find((n) => n.id === section) || NAV[0], [section]);

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
    load();
  }, [load, refreshKey]);

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
  const maxDaily = Math.max(...(data?.daily || []).map((d) => d.total), 1);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-blue-600" />
              Universal Link
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {current.label} — Smart app download link with iOS / Android tracking
            </p>
          </div>
          <AdminPageRefresh onClick={() => setRefreshKey((key) => key + 1)} />
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-2 overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="px-4 sm:px-6 lg:px-8 py-6 pb-10 space-y-6">
        <AdminGradientBanner className="bg-gradient-to-r from-indigo-600 to-blue-600">
          <AdminGradientBannerEyebrow>Universal link</AdminGradientBannerEyebrow>
          <AdminGradientBannerTitle>One link — auto routes to App Store or Play Store</AdminGradientBannerTitle>
          <AdminGradientBannerCopy className="max-w-3xl">
            Use this link in ads, WhatsApp, SMS, and campaigns. Mobile users are redirected to the correct store;
            desktop users see a fallback page. Play Store / App Store badges on the website stay on direct store URLs.
          </AdminGradientBannerCopy>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 rounded-xl bg-white/10 border border-white/20 px-4 py-3 font-mono text-sm break-all">
              {data?.universal_url || 'https://myfng.in/go/myfngapp'}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white text-blue-700 font-bold text-sm"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <a
                href={data?.universal_url || 'https://myfng.in/go/myfngapp'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-black/20 border border-white/20 font-bold text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Open
              </a>
            </div>
          </div>

          <p className="m-0 text-xs leading-5" style={{ color: '#bfdbfe' }}>
            Example with UTM:{' '}
            <span className="font-mono break-all">
              {(data?.universal_url || 'https://myfng.in/go/myfngapp')}?utm_source=google&utm_medium=cpc&utm_campaign=launch
            </span>
          </p>
        </AdminGradientBanner>

        <div className="rounded-2xl bg-white border border-gray-200 p-4">
          <ReportDateRangeFilter
            preset={dateRange.preset as ReportDatePreset}
            customStart={dateRange.customStart}
            customEnd={dateRange.customEnd}
            onChange={setDateRange}
          />
          {data?.range?.label ? (
            <p className="text-xs text-gray-500 mt-2">Showing data for: {data.range.label}</p>
          ) : null}
        </div>

        {loading ? (
          <div className="h-40 rounded-2xl bg-white border animate-pulse" />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                      <p className="text-xs font-medium text-gray-500 leading-4">{card.label}</p>
                      <Icon className="w-4 h-4 text-blue-600 shrink-0" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mt-3">{card.value}</p>
                    <p className="text-[11px] text-gray-500 mt-2 leading-4">{card.sub}</p>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-gray-500 leading-5">
              Total opens = iOS + Android + Desktop for the selected period. Desktop counts fallback page views;
              if someone clicks a store button on desktop, that is logged separately under iOS or Android.
            </p>

            {section === 'overview' ? (
              <>
                <div className="grid lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-4">Platform breakdown (selected period)</h3>
                    <div className="space-y-4">
                      {(data?.platform_breakdown || []).map((row) => {
                        const total = k?.clicks_in_range || 1;
                        const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
                        return (
                          <div key={row.platform}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm mb-1.5">
                              <span className="font-medium text-gray-800">{row.label}</span>
                              <span className="text-gray-600 tabular-nums">
                                {row.count} ({pct}%) · all-time {row.all_time}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-4">Store URLs (configured)</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">App Store (iOS)</p>
                        <a
                          href={data?.store_urls?.ios}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 break-all hover:underline"
                        >
                          {data?.store_urls?.ios}
                        </a>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">Play Store (Android)</p>
                        <a
                          href={data?.store_urls?.android}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 break-all hover:underline"
                        >
                          {data?.store_urls?.android}
                        </a>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-4 leading-5">
                      Footer badges and other Play/App Store buttons use these direct store links. Use the universal
                      link above only for campaign tracking.
                    </p>
                  </div>
                </div>

                {(data?.daily || []).length > 0 ? (
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-4">Daily trend</h3>
                    <div className="space-y-2">
                      {(data?.daily || []).map((day) => (
                        <div key={day.date} className="flex items-center gap-3 text-sm">
                          <span className="w-24 shrink-0 text-gray-600">{day.date}</span>
                          <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${Math.max(4, (day.total / maxDaily) * 100)}%` }}
                            />
                          </div>
                          <span className="w-28 shrink-0 text-right text-gray-700 tabular-nums text-xs sm:text-sm">
                            {day.total} · iOS {day.ios} · And {day.android} · Desk {day.desktop}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {section === 'analytics' ? (
              <>
                <div className="grid lg:grid-cols-3 gap-4">
                  {[
                    { title: 'Top UTM sources', rows: data?.utm_sources || [] },
                    { title: 'Top UTM mediums', rows: data?.utm_mediums || [] },
                    { title: 'Top UTM campaigns', rows: data?.utm_campaigns || [] },
                  ].map((block) => (
                    <div key={block.title} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                      <h3 className="font-semibold text-gray-900 mb-3">{block.title}</h3>
                      {block.rows.length === 0 ? (
                        <p className="text-sm text-gray-500">No UTM data in this period</p>
                      ) : (
                        <div className="space-y-2">
                          {block.rows.map((row) => (
                            <div key={row.label} className="flex items-center justify-between text-sm">
                              <span className="text-gray-800 truncate pr-2">{row.label}</span>
                              <span className="font-bold text-gray-900">{row.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Recent opens</h3>
                    <p className="text-sm text-gray-500">Every hit on /go/myfngapp is logged here</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-left text-gray-600">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Time</th>
                          <th className="px-4 py-3 font-semibold">Platform</th>
                          <th className="px-4 py-3 font-semibold">Source</th>
                          <th className="px-4 py-3 font-semibold">UTM</th>
                          <th className="px-4 py-3 font-semibold">Referrer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.recent_events || []).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                              No events in this period
                            </td>
                          </tr>
                        ) : (
                          (data?.recent_events || []).map((ev) => (
                            <tr key={ev.id} className="border-t border-gray-100">
                              <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                                {ev.created_at ? new Date(ev.created_at).toLocaleString('en-IN') : '-'}
                              </td>
                              <td className="px-4 py-3 capitalize">{ev.platform}</td>
                              <td className="px-4 py-3 text-gray-700">{ev.source.replace(/_/g, ' ')}</td>
                              <td className="px-4 py-3 text-gray-600">
                                {[ev.utm_source, ev.utm_medium, ev.utm_campaign].filter(Boolean).join(' / ') || '—'}
                              </td>
                              <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{ev.referer || '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
