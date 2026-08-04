'use client';

import { useCallback, useEffect, useState } from 'react';
import ReportDateRangeFilter, { type ReportDateRangeValue } from '@/components/admin/ReportDateRangeFilter';
import type { ReportDatePreset } from '@/lib/report-date-range';

export default function AnalyticsSection() {
  const [events, setEvents] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [rangeLabel, setRangeLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<ReportDateRangeValue>({
    preset: 'today',
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
      if (res.ok) {
        setEvents(json.recent_clicks || []);
        setKpis(json.kpis || null);
        setRangeLabel(json.range?.label || '');
      }
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
        <ReportDateRangeFilter
          preset={dateRange.preset as ReportDatePreset}
          customStart={dateRange.customStart}
          customEnd={dateRange.customEnd}
          onChange={setDateRange}
        />
        {rangeLabel ? <p className="text-xs text-gray-500 mt-2">Period: {rangeLabel}</p> : null}
      </div>

      {loading ? (
        <div className="h-32 rounded-2xl bg-white border animate-pulse" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Clicks in period', value: kpis?.clicks_in_range || 0 },
            { label: 'QR scans in period', value: kpis?.qr_scans_in_range || 0 },
            { label: 'All-time clicks', value: kpis?.total_clicks || 0 },
            { label: 'Unique clicks', value: kpis?.unique_clicks || 0 },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Click events</h3>
          <p className="text-sm text-gray-500">Every redirect through /s/{'{code}'} is tracked here</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">Link</th>
                <th className="px-4 py-3 font-semibold">Referrer</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No click events in this period</td></tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {ev.created_at ? new Date(ev.created_at).toLocaleString('en-IN') : '-'}
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-800">
                      {String(ev.event_type || 'click').replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{(ev.link as any)?.title || (ev.link as any)?.short_code || '-'}</div>
                      <div className="text-xs text-gray-500">/s/{(ev.link as any)?.short_code}</div>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-gray-500">{ev.referrer || 'Direct'}</td>
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
