'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Download, MessageSquare, RefreshCw } from 'lucide-react';
import {
  EXPORT_DATE_PRESETS,
  resolveReportDateRange,
  type ReportDatePreset,
} from '@/lib/report-date-range';

const WHATSAPP_DATE_PRESETS = EXPORT_DATE_PRESETS.map((option) => {
  if (option.value === 'all_time') return { ...option, label: 'Maximum' };
  if (option.value === 'custom') return { ...option, label: 'Custom range' };
  return option;
});

type MessageRow = {
  id: string;
  time: string;
  template_name: string | null;
  phone: string;
  recipient_phone: string | null;
  status: string;
  source: string;
  trigger_key: string | null;
  error_message: string | null;
  text_preview: string | null;
};

type MessagesResponse = {
  success: boolean;
  rows: MessageRow[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  range_label: string;
  error?: string;
};

function statusTone(status: string) {
  const value = status.toUpperCase();
  if (value === 'DELIVERED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (value === 'VIEWED') return 'bg-violet-50 text-violet-700 border-violet-200';
  if (value === 'FAILED') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

function buildQueryParams(input: {
  preset: ReportDatePreset;
  customStart: string;
  customEnd: string;
  page: number;
  limit: number;
  status: string;
  source: string;
  template: string;
  phone: string;
  exportCsv?: boolean;
}) {
  const params = new URLSearchParams({
    preset: input.preset,
    page: String(input.page),
    limit: String(input.limit),
    status: input.status,
    source: input.source,
  });
  if (input.preset === 'custom') {
    if (input.customStart) params.set('start', input.customStart);
    if (input.customEnd) params.set('end', input.customEnd);
  }
  if (input.template.trim()) params.set('template', input.template.trim());
  if (input.phone.trim()) params.set('phone', input.phone.trim());
  if (input.exportCsv) params.set('export', '1');
  return params;
}

export default function WhatsAppMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center text-sm text-gray-500">
          Loading WhatsApp messages…
        </div>
      }
    >
      <WhatsAppMessagesPageContent />
    </Suspense>
  );
}

function WhatsAppMessagesPageContent() {
  const searchParams = useSearchParams();
  const initialPreset = (searchParams.get('preset') || 'last_7_days') as ReportDatePreset;
  const initialStart = searchParams.get('start') || '';
  const initialEnd = searchParams.get('end') || '';

  const [preset, setPreset] = useState<ReportDatePreset>(initialPreset);
  const [customStart, setCustomStart] = useState(initialStart);
  const [customEnd, setCustomEnd] = useState(initialEnd);
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');
  const [template, setTemplate] = useState('');
  const [phone, setPhone] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<MessagesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rangeLabel = useMemo(
    () => resolveReportDateRange(preset, customStart, customEnd).label,
    [customEnd, customStart, preset]
  );

  const loadMessages = useCallback(async () => {
    if (preset === 'custom' && (!customStart || !customEnd)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = buildQueryParams({
        preset,
        customStart,
        customEnd,
        page,
        limit,
        status,
        source,
        template,
        phone,
      });
      const res = await fetch(`/api/whatsapp/dashboard/messages?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to load messages');
      }
      const json = (await res.json()) as MessagesResponse;
      setData(json);
    } catch (err: any) {
      setData(null);
      setError(err?.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [customEnd, customStart, limit, page, phone, preset, source, status, template]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleExport = async () => {
    if (preset === 'custom' && (!customStart || !customEnd)) return;
    setExporting(true);
    try {
      const params = buildQueryParams({
        preset,
        customStart,
        customEnd,
        page: 1,
        limit,
        status,
        source,
        template,
        phone,
        exportCsv: true,
      });
      const res = await fetch(`/api/whatsapp/dashboard/messages?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `whatsapp-outbound-messages-${preset}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const rows = data?.rows || [];
  const totalPages = data?.total_pages || 1;

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Outbound Message Logs</h1>
          <p className="mt-1 text-sm text-gray-600">
            All outbound WhatsApp template messages — delivered, read, pending & failed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/super_admin/whatsapp-dashboard"
            className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Back to Dashboard
          </Link>
          <button
            type="button"
            onClick={() => void loadMessages()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting || loading || (preset === 'custom' && (!customStart || !customEnd))}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-semibold text-gray-500">
            Date range
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value as ReportDatePreset);
                setPage(1);
              }}
            >
              {WHATSAPP_DATE_PRESETS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-gray-500">
            Status
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All statuses</option>
              <option value="SENT">Sent (pending)</option>
              <option value="DELIVERED">Delivered</option>
              <option value="VIEWED">Read / Viewed</option>
              <option value="FAILED">Failed</option>
            </select>
          </label>

          <label className="text-xs font-semibold text-gray-500">
            Source
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All sources</option>
              <option value="automation">Automation</option>
              <option value="manual">Manual / Other</option>
            </select>
          </label>

          <label className="text-xs font-semibold text-gray-500">
            Template name
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="booking_confirmed"
              value={template}
              onChange={(e) => {
                setTemplate(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {preset === 'custom' ? (
            <>
              <label className="text-xs font-semibold text-gray-500">
                From
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => {
                    setCustomStart(e.target.value);
                    setPage(1);
                  }}
                  className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-gray-500">
                To
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => {
                    setCustomEnd(e.target.value);
                    setPage(1);
                  }}
                  className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
            </>
          ) : null}

          <label className="text-xs font-semibold text-gray-500">
            Phone (last digits)
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="6023"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>

        <p className="text-xs text-gray-500">
          Showing: <span className="font-semibold text-gray-700">{rangeLabel}</span>
          {data ? (
            <>
              {' '}
              · {data.total} message{data.total === 1 ? '' : 's'}
            </>
          ) : null}
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">Outbound Messages</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Template</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">
                    {row.time ? new Date(row.time).toLocaleString('en-IN') : '—'}
                  </td>
                  <td className="py-2 pr-3">
                    <p className="font-medium text-gray-900">{row.template_name || '—'}</p>
                    {row.trigger_key ? <p className="text-xs text-gray-500">{row.trigger_key}</p> : null}
                  </td>
                  <td className="py-2 pr-3 text-gray-700">{row.phone}</td>
                  <td className="py-2 pr-3 capitalize text-gray-600">{row.source}</td>
                  <td className="py-2 pr-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-gray-600">
                    {row.status === 'FAILED' && row.error_message ? (
                      <span className="inline-flex items-start gap-1 text-red-700">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {row.error_message}
                      </span>
                    ) : row.text_preview ? (
                      <span className="text-gray-500">{row.text_preview}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No messages match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            Page {data?.page || page} of {totalPages}
            {data?.total != null ? ` · ${data.total} total` : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loading || page <= 1}
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={loading || page >= totalPages}
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
