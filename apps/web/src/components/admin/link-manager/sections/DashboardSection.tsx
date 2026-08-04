'use client';

import { useCallback, useEffect, useState } from 'react';
import ReportDateRangeFilter, { type ReportDateRangeValue } from '@/components/admin/ReportDateRangeFilter';
import type { ReportDatePreset } from '@/lib/report-date-range';
import AdminGradientBanner, {
  AdminGradientBannerCopy,
  AdminGradientBannerTitle,
} from '@/components/admin/AdminGradientBanner';
import { BarChart3, Link2, MousePointerClick, QrCode } from 'lucide-react';

type Stats = {
  range?: { label: string };
  kpis: {
    total_links: number;
    total_clicks: number;
    unique_clicks: number;
    qr_scans: number;
    clicks_in_range: number;
  };
  top_links: Array<{ id: string; short_code: string; title?: string; clicks: number; unique_clicks: number }>;
};

export default function DashboardSection({ onNavigate }: { onNavigate: (section: any) => void }) {
  const [data, setData] = useState<Stats | null>(null);
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
    load();
  }, [load]);

  const k = data?.kpis;

  return (
    <div className="space-y-6">
      <AdminGradientBanner className="bg-gradient-to-r from-blue-600 to-indigo-600">
        <AdminGradientBannerTitle>Create, share, and track short links</AdminGradientBannerTitle>
        <AdminGradientBannerCopy className="max-w-2xl">
          Bitly-style link shortening with QR codes, UTM tags, and click analytics.
        </AdminGradientBannerCopy>
        <button
          type="button"
          onClick={() => onNavigate('create')}
          className="self-start inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-blue-700 font-bold"
        >
          <Link2 className="w-4 h-4" />
          Shorten a link
        </button>
      </AdminGradientBanner>

      <div className="rounded-2xl bg-white border border-gray-200 p-4">
        <ReportDateRangeFilter
          preset={dateRange.preset as ReportDatePreset}
          customStart={dateRange.customStart}
          customEnd={dateRange.customEnd}
          onChange={setDateRange}
        />
        {data?.range?.label ? (
          <p className="text-xs text-gray-500 mt-2">Showing clicks for: {data.range.label}</p>
        ) : null}
      </div>

      {loading ? (
        <div className="h-32 rounded-2xl bg-white border animate-pulse" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total links', value: k?.total_links || 0, icon: Link2 },
            { label: 'Clicks in range', value: k?.clicks_in_range || 0, icon: MousePointerClick },
            { label: 'All-time clicks', value: k?.total_clicks || 0, icon: BarChart3 },
            { label: 'QR scans', value: k?.qr_scans || 0, icon: QrCode },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500">{card.label}</p>
                  <Icon className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-2">{card.value}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-3">Top performing links</h3>
        {(data?.top_links || []).length === 0 ? (
          <p className="text-sm text-gray-500">No links yet. Create your first short link.</p>
        ) : (
          <div className="divide-y">
            {(data?.top_links || []).map((link) => (
              <div key={link.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-semibold text-gray-900">{link.title || link.short_code}</div>
                  <div className="text-gray-500">/s/{link.short_code}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{link.clicks} clicks</div>
                  <div className="text-gray-500">{link.unique_clicks} unique</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
