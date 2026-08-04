'use client';

import { useCallback, useEffect, useState } from 'react';
import ReportDateRangeFilter, { type ReportDateRangeValue } from '@/components/admin/ReportDateRangeFilter';
import type { ReportDatePreset } from '@/lib/report-date-range';

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

export default function AnalyticsSection() {
  const [events, setEvents] = useState<any[]>([]);
  const [configuredLinks, setConfiguredLinks] = useState<any[]>([]);
  const [utmSources, setUtmSources] = useState<any[]>([]);
  const [utmMediums, setUtmMediums] = useState<any[]>([]);
  const [utmCampaigns, setUtmCampaigns] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [rangeLabel, setRangeLabel] = useState('');
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
      if (res.ok) {
        setEvents(json.recent_clicks || []);
        setConfiguredLinks(json.configured_links || []);
        setUtmSources(json.utm_sources || []);
        setUtmMediums(json.utm_mediums || []);
        setUtmCampaigns(json.utm_campaigns || []);
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

      {!loading ? (
        <div className="grid lg:grid-cols-3 gap-4">
          {[
            { title: 'Top UTM sources', rows: utmSources },
            { title: 'Top UTM mediums', rows: utmMediums },
            { title: 'Top UTM campaigns', rows: utmCampaigns },
          ].map((block) => (
            <div key={block.title} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">{block.title}</h3>
              {block.rows.length === 0 ? (
                <p className="text-sm text-gray-500">No click UTM data in this period</p>
              ) : (
                <div className="space-y-2">
                  {block.rows.map((row: any) => (
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
      ) : null}

      {!loading && configuredLinks.length > 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Links with UTM tags</h3>
            <p className="text-sm text-gray-500">UTM configured on each short link — shown on click events below</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Link</th>
                  <th className="px-4 py-3 font-semibold">UTM Source</th>
                  <th className="px-4 py-3 font-semibold">UTM Medium</th>
                  <th className="px-4 py-3 font-semibold">UTM Campaign</th>
                  <th className="px-4 py-3 font-semibold">Term</th>
                  <th className="px-4 py-3 font-semibold">Content</th>
                </tr>
              </thead>
              <tbody>
                {configuredLinks.map((link) => (
                  <tr key={link.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{link.title || 'Untitled'}</div>
                      <div className="text-xs text-blue-700">/s/{link.short_code}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{link.utm_source || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{link.utm_medium || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{link.utm_campaign || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{link.utm_term || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{link.utm_content || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Click events</h3>
          <p className="text-sm text-gray-500">Every redirect through /s/{'{code}'} is tracked here with UTM</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">Link</th>
                <th className="px-4 py-3 font-semibold">UTM Source</th>
                <th className="px-4 py-3 font-semibold">UTM Medium</th>
                <th className="px-4 py-3 font-semibold">UTM Campaign</th>
                <th className="px-4 py-3 font-semibold">Referrer</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No click events in this period</td></tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {ev.created_at ? formatEventDate(ev.created_at) : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {ev.created_at ? formatEventTime(ev.created_at) : '—'}
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-800">
                      {String(ev.event_type || 'click').replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{ev.link_title || ev.short_code || '—'}</div>
                      {ev.short_code ? <div className="text-xs text-gray-500">/s/{ev.short_code}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{ev.utm_source || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{ev.utm_medium || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{ev.utm_campaign || '—'}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-gray-500">{ev.referrer || '—'}</td>
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
