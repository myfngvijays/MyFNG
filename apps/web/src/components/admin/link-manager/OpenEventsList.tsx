'use client';

import { Loader2, Monitor, QrCode, Smartphone } from 'lucide-react';
import { buildProductionShortUrl } from '@/lib/link-manager/utils';

export type OpenEvent = {
  id: string;
  created_at?: string;
  event_type?: string;
  platform?: string | null;
  source?: string | null;
  short_code?: string | null;
  link_title?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  referrer?: string | null;
};

function formatWhen(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function platformLabel(platform?: string | null) {
  const k = String(platform || '').toLowerCase();
  if (k === 'ios') return 'iPhone / iPad';
  if (k === 'android') return 'Android phone';
  if (k === 'desktop') return 'Computer';
  return platform ? String(platform) : 'Unknown device';
}

function prettyTag(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  return raw.replace(/[_-]+/g, ' ');
}

export default function OpenEventsList({
  events,
  loading,
  empty,
}: {
  events: OpenEvent[];
  loading?: boolean;
  empty?: string;
}) {
  if (loading) {
    return (
      <div className="flex justify-center px-4 py-12">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!events.length) {
    return <p className="px-4 py-12 text-center text-sm text-gray-500">{empty || 'No opens in this period.'}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">What</th>
            <th className="px-4 py-3">Link</th>
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">Device</th>
            <th className="px-4 py-3">Campaign</th>
            <th className="px-4 py-3">From</th>
            <th className="px-4 py-3">How</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => {
            const isQr = ev.event_type === 'qr_scan';
            const title = ev.link_title || ev.short_code || 'Untitled link';
            const href = ev.short_code ? buildProductionShortUrl(ev.short_code) : '';
            const DeviceIcon = ev.platform === 'desktop' ? Monitor : Smartphone;
            return (
              <tr key={ev.id} className="border-t border-gray-100 align-top">
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      isQr ? 'bg-violet-100 text-violet-800' : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {isQr ? <QrCode className="h-3 w-3" /> : null}
                    {isQr ? 'QR scanned' : 'Link opened'}
                  </span>
                </td>
                <td className="min-w-[12rem] px-4 py-3">
                  <p className="font-bold text-gray-900">{title}</p>
                  {href ? (
                    <p className="mt-0.5 font-mono text-xs text-blue-700">{href.replace(/^https:\/\//, '')}</p>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">{formatWhen(ev.created_at)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    <DeviceIcon className="h-3.5 w-3.5 shrink-0" />
                    {platformLabel(ev.platform)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-800">{prettyTag(ev.utm_campaign)}</td>
                <td className="px-4 py-3 text-gray-800">{prettyTag(ev.utm_source)}</td>
                <td className="px-4 py-3 text-gray-800">{prettyTag(ev.utm_medium)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
