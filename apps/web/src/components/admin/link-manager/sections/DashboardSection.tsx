'use client';

import { useCallback, useEffect, useState } from 'react';
import ReportDateRangeFilter, { type ReportDateRangeValue } from '@/components/admin/ReportDateRangeFilter';
import type { ReportDatePreset } from '@/lib/report-date-range';
import AdminGradientBanner, {
  AdminGradientBannerCopy,
  AdminGradientBannerTitle,
} from '@/components/admin/AdminGradientBanner';
import { ArrowRight, BarChart3, BookOpen, Link2, MousePointerClick, QrCode, Tags, Users } from 'lucide-react';
import { buildProductionShortUrl } from '@/lib/link-manager/utils';

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

type StatsPayload = {
  range?: { label: string };
  kpis?: {
    total_links: number;
    total_clicks: number;
    unique_clicks: number;
    qr_scans: number;
    clicks_in_range: number;
    qr_scans_in_range: number;
  };
  top_links?: Array<{
    id: string;
    short_code: string;
    title?: string;
    clicks: number;
    unique_clicks: number;
    qr_scans?: number;
  }>;
  recent_clicks?: any[];
  configured_links?: any[];
  utm_sources?: any[];
  utm_mediums?: any[];
  utm_campaigns?: any[];
};

export default function DashboardSection({
  onNavigate,
}: {
  onNavigate: (section: string) => void;
}) {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
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
      const res = await fetch(`/api/super_admin/link-manager/stats?${params.toString()}`);
      const json = await res.json();
      if (res.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void load();
  }, [load]);

  const k = data?.kpis;
  const events = (data?.recent_clicks || []).slice(0, 20);
  const configuredLinks = (data?.configured_links || []).slice(0, 10);
  const utmSources = data?.utm_sources || [];
  const utmMediums = data?.utm_mediums || [];
  const utmCampaigns = data?.utm_campaigns || [];

  return (
    <div className="space-y-6">
      <AdminGradientBanner className="bg-gradient-to-r from-blue-600 to-indigo-600">
        <AdminGradientBannerTitle>Overview — stats + analytics</AdminGradientBannerTitle>
        <AdminGradientBannerCopy className="max-w-2xl">
          KPIs, top links, UTM breakdown, and recent opens — ek jagah. How-to ke liye README tab dekho.
        </AdminGradientBannerCopy>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('create')}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-blue-700"
          >
            <Link2 className="h-4 w-4" />
            Create link
          </button>
          <button
            type="button"
            onClick={() => onNavigate('links')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-5 py-3 font-bold text-white"
          >
            My Links
          </button>
          <button
            type="button"
            onClick={() => onNavigate('readme')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-5 py-3 font-bold text-white"
          >
            <BookOpen className="h-4 w-4" />
            README
          </button>
        </div>
      </AdminGradientBanner>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <ReportDateRangeFilter
          preset={dateRange.preset as ReportDatePreset}
          customStart={dateRange.customStart}
          customEnd={dateRange.customEnd}
          onChange={setDateRange}
        />
        {data?.range?.label ? (
          <p className="mt-2 text-xs text-gray-500">Showing stats for: {data.range.label}</p>
        ) : null}
      </div>

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl border bg-white" />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {[
            { label: 'Total links', value: k?.total_links || 0, icon: Link2 },
            { label: 'Clicks (period)', value: k?.clicks_in_range || 0, icon: MousePointerClick },
            { label: 'QR scans (period)', value: k?.qr_scans_in_range || 0, icon: QrCode },
            { label: 'Unique (all-time)', value: k?.unique_clicks || 0, icon: Users },
            { label: 'Clicks (all-time)', value: k?.total_clicks || 0, icon: BarChart3 },
            { label: 'QR (all-time)', value: k?.qr_scans || 0, icon: QrCode },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500">{card.label}</p>
                  <Icon className="h-4 w-4 text-blue-600" />
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Top performing links</h3>
            <button
              type="button"
              onClick={() => onNavigate('links')}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              View all →
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (data?.top_links || []).length === 0 ? (
            <p className="text-sm text-gray-500">No links yet. Create your first short link.</p>
          ) : (
            <div className="divide-y">
              {(data?.top_links || []).map((link) => (
                <div key={link.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900">{link.title || link.short_code}</div>
                    <div className="truncate text-xs text-gray-500">
                      {buildProductionShortUrl(link.short_code)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-bold text-gray-900">
                      {link.clicks || 0} link · {link.qr_scans || 0} QR
                    </div>
                    <div className="text-gray-500">{link.unique_clicks || 0} unique</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          {[
            { title: 'Top UTM sources', rows: utmSources },
            { title: 'Top UTM mediums', rows: utmMediums },
            { title: 'Top UTM campaigns', rows: utmCampaigns },
          ].map((block) => (
            <div key={block.title} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">{block.title}</h3>
              {loading ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : block.rows.length === 0 ? (
                <p className="text-sm text-gray-500">No click UTM data in this period</p>
              ) : (
                <div className="space-y-1.5">
                  {block.rows.slice(0, 6).map((row: any) => (
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
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Links with UTM tags</h3>
            <p className="text-sm text-gray-500">Latest 10 · full list UTM Links tab me</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('utm-links')}
            className="inline-flex items-center gap-1.5 self-start rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white sm:self-auto"
          >
            <Tags className="h-3.5 w-3.5" />
            View more
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Link</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Medium</th>
                <th className="px-4 py-3 font-semibold">Campaign</th>
                <th className="px-4 py-3 font-semibold">Term</th>
                <th className="px-4 py-3 font-semibold">Content</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : configuredLinks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No UTM-tagged links yet
                  </td>
                </tr>
              ) : (
                configuredLinks.map((link) => (
                  <tr key={link.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{link.title || 'Untitled'}</div>
                      <div className="break-all text-xs text-blue-700">
                        {buildProductionShortUrl(link.short_code)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{link.utm_source || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{link.utm_medium || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{link.utm_campaign || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{link.utm_term || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{link.utm_content || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Recent opens</h3>
            <p className="text-sm text-gray-500">
              Latest 20 in selected period · filters / full history Recent Opens tab me
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
                <th className="px-4 py-3 font-semibold">Type</th>
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
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No events in this period
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id} className="border-t border-gray-100">
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          ev.event_type === 'qr_scan'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {ev.event_type === 'qr_scan' ? 'QR scan' : 'Link click'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {ev.created_at ? formatEventDate(ev.created_at) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {ev.created_at ? formatEventTime(ev.created_at) : '—'}
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-800">{ev.platform || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{ev.source || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{ev.utm_source || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{ev.utm_medium || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{ev.utm_campaign || '—'}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-gray-500">{ev.referrer || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
