'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileDown, FileText, Loader2, Download, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';

type ManualInvoice = {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number | null;
  status: string | null;
  created_at?: string | null;
  payment_mode?: string | null;
  payment_reference?: string | null;
  customer_gstin?: string | null;
  car_number?: string | null;
  car_model?: string | null;
};

const PAGE_SIZE_OPTIONS = [25, 50, 100, 500];

export default function CreatedManualInvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<ManualInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [downloading, setDownloading] = useState(false);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const fetchInvoices = useCallback(async (pageNum = page, size = pageSize) => {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('pageSize', String(size));
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      const res = await fetch(`/api/admin/manual-invoices?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load invoices');
      setInvoices(json.invoices || []);
      setTotal(json.total ?? 0);
      setPage(json.page ?? 1);
      setPageSize(json.pageSize ?? 25);
      setTotalPages(json.totalPages ?? 1);
    } catch (e: any) {
      setMessage(e?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, fromDate, toDate]);

  useEffect(() => {
    fetchInvoices(page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, fromDate, toDate]);

  const filteredInvoices = invoices;

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  const allVisibleSelected = useMemo(() => {
    if (filteredInvoices.length === 0) return false;
    return filteredInvoices.every((inv) => selected[inv.id]);
  }, [filteredInvoices, selected]);

  const someVisibleSelected = useMemo(() => {
    if (filteredInvoices.length === 0) return false;
    const selectedCount = filteredInvoices.reduce((acc, inv) => acc + (selected[inv.id] ? 1 : 0), 0);
    return selectedCount > 0 && selectedCount < filteredInvoices.length;
  }, [filteredInvoices, selected]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  async function downloadSelectedZip() {
    const ids = selectedIds;
    if (ids.length === 0) return;

    setDownloading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/manual-invoices/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Failed to download ZIP');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'manual-invoices.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setMessage(e?.message || 'Failed to download ZIP');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-5 sm:py-6 md:py-8 space-y-4">
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/super_admin/manual-invoices"
              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-heading mt-2">Created Manual Invoices</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            All invoices created via CSV import or single-create.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadSelectedZip}
            className="btn btn-primary text-sm flex items-center gap-2"
            disabled={downloading || selectedIds.length === 0}
            title={selectedIds.length === 0 ? 'Select invoices to download' : 'Download selected invoices as ZIP'}
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download ({selectedIds.length})
          </button>
          <button onClick={fetchInvoices} className="btn btn-secondary text-sm" disabled={loading || downloading}>
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Refreshing...
              </span>
            ) : (
              'Refresh'
            )}
          </button>
        </div>
      </div>

      {message && <div className="text-sm text-gray-700">{message}</div>}

      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              From date
              <input
                className="border rounded-md px-2 py-2 text-sm"
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              To date
              <input
                className="border rounded-md px-2 py-2 text-sm"
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <div className="flex items-end">
              <button
                className="btn btn-secondary text-sm w-full"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  setPage(1);
                }}
                disabled={!fromDate && !toDate}
              >
                Clear filter
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs text-gray-600">
              Showing{' '}
              <span className="font-semibold text-gray-900">
                {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
              </span>{' '}
              of <span className="font-semibold text-gray-900">{total}</span>
            </div>
            <label className="text-xs text-gray-600 flex items-center gap-1">
              Per page
              <select
                className="border rounded-md px-2 py-1.5 text-sm"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-3">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSelected((prev) => {
                      const next = { ...prev };
                      for (const inv of filteredInvoices) {
                        next[inv.id] = checked;
                      }
                      return next;
                    });
                  }}
                />
              </th>
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">GSTIN</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && total === 0 && !fromDate && !toDate && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-gray-500">
                  No manual invoices yet.
                </td>
              </tr>
            )}
            {!loading && total === 0 && (fromDate || toDate) && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-gray-500">
                  No invoices match the selected date range.
                </td>
              </tr>
            )}
            {!loading && filteredInvoices.map((inv) => (
              <tr key={inv.id} className="border-t">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[inv.id])}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelected((prev) => ({ ...prev, [inv.id]: checked }));
                    }}
                  />
                </td>
                <td className="px-4 py-3">{inv.invoice_number}</td>
                <td className="px-4 py-3">{inv.customer_name || '—'}</td>
                <td className="px-4 py-3">{inv.customer_phone || '—'}</td>
                <td className="px-4 py-3">{inv.customer_gstin || '—'}</td>
                <td className="px-4 py-3">
                  {inv.car_number || '—'}
                  {inv.car_model ? ` / ${inv.car_model}` : ''}
                </td>
                <td className="px-4 py-3">
                  {inv.total_amount != null ? `₹${Number(inv.total_amount).toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3">
                  {inv.payment_mode || '—'}
                  {inv.payment_reference ? ` / ${inv.payment_reference}` : ''}
                </td>
                <td className="px-4 py-3">{inv.status || 'CREATED'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Link
                      href={`/dashboard/super_admin/manual-invoices/${inv.id}/edit`}
                      className="inline-flex items-center gap-1 text-brand-primary hover:underline"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </Link>
                    <a
                      className="inline-flex items-center gap-1 text-brand-primary hover:underline"
                      href={`/api/manual-invoices/${inv.id}/generate-pdf`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileText className="w-4 h-4" />
                      View
                    </a>
                    <a
                      className="inline-flex items-center gap-1 text-brand-primary hover:underline"
                      href={`/api/manual-invoices/${inv.id}/generate-pdf?print=1`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileDown className="w-4 h-4" />
                      PDF
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="bg-white rounded-lg border px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-gray-600">
            Page <span className="font-semibold text-gray-900">{page}</span> of{' '}
            <span className="font-semibold text-gray-900">{totalPages}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn btn-secondary text-sm px-2 py-1.5 disabled:opacity-50"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <button
                  key={p}
                  type="button"
                  className={`min-w-[2rem] px-2 py-1.5 text-sm rounded border ${
                    p === page
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setPage(p)}
                  disabled={loading}
                >
                  {p}
                </button>
              );
            })}
            <button
              type="button"
              className="btn btn-secondary text-sm px-2 py-1.5 disabled:opacity-50"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

