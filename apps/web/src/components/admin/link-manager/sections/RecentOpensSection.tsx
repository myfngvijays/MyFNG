'use client';

import { useCallback, useEffect, useState } from 'react';
import ReportDateRangeFilter, { type ReportDateRangeValue } from '@/components/admin/ReportDateRangeFilter';
import type { ReportDatePreset } from '@/lib/report-date-range';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import OpenEventsList from '../OpenEventsList';

export default function RecentOpensSection() {
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
  const [eventType, setEventType] = useState('all');
  const [platform, setPlatform] = useState('');
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
      if (eventType !== 'all') params.set('eventType', eventType);
      if (platform.trim()) params.set('platform', platform.trim());
      if (utmSource.trim()) params.set('utmSource', utmSource.trim());
      if (utmMedium.trim()) params.set('utmMedium', utmMedium.trim());
      if (utmCampaign.trim()) params.set('utmCampaign', utmCampaign.trim());
      if (q.trim()) params.set('q', q.trim());

      const res = await fetch(`/api/super_admin/link-manager/events?${params.toString()}`);
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
  }, [dateRange, page, pageSize, eventType, platform, utmSource, utmMedium, utmCampaign, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [dateRange.preset, dateRange.customStart, dateRange.customEnd, eventType, platform, utmSource, utmMedium, utmCampaign, q, pageSize]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4">
        <h2 className="text-xl font-black text-gray-900">Recent Opens</h2>
        <p className="mt-1 text-sm text-gray-600">
          Har row = ek baar kisi ne short link khola ya QR scan kiya. Campaign / From / How woh tags hain jo link
          banate time set kiye the.
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-600">What happened</span>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="all">Link opens + QR scans</option>
              <option value="click">Only link opens</option>
              <option value="qr_scan">Only QR scans</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-600">Device</span>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">All devices</option>
              <option value="android">Android phone</option>
              <option value="ios">iPhone / iPad</option>
              <option value="desktop">Computer</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-600">From (source)</span>
            <input
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
              placeholder="Search source…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-600">How (medium)</span>
            <input
              value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value)}
              placeholder="Search medium…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-600">Campaign</span>
            <input
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
              placeholder="Search campaign…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-600">Link name</span>
            <div className="flex gap-1">
              <input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setQ(qInput.trim());
                }}
                placeholder="Standee 3 / download-app"
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
            {total.toLocaleString('en-IN')} opens · showing {from}–{to}
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
        <OpenEventsList
          events={events}
          loading={loading}
          empty="Is filter / date range me koi open nahi mila."
        />
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
