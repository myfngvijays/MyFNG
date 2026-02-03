'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileDown, FileText, Loader2, Download } from 'lucide-react';

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

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export default function CreatedManualInvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<ManualInvoice[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [downloading, setDownloading] = useState(false);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchInvoices() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/manual-invoices');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load invoices');
      setInvoices(json.invoices || []);
    } catch (e: any) {
      setMessage(e?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }

  const filteredInvoices = useMemo(() => {
    const hasFrom = Boolean(fromDate);
    const hasTo = Boolean(toDate);
    if (!hasFrom && !hasTo) return invoices;

    const from = hasFrom ? startOfDay(new Date(fromDate)) : null;
    const to = hasTo ? endOfDay(new Date(toDate)) : null;

    return invoices.filter((inv) => {
      if (!inv.created_at) return false;
      const d = new Date(inv.created_at);
      if (Number.isNaN(d.getTime())) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [fromDate, invoices, toDate]);

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
                onChange={(e) => setFromDate(e.target.value)}
              />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              To date
              <input
                className="border rounded-md px-2 py-2 text-sm"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </label>
            <div className="flex items-end">
              <button
                className="btn btn-secondary text-sm w-full"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                }}
                disabled={!fromDate && !toDate}
              >
                Clear filter
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredInvoices.length}</span> of{' '}
            <span className="font-semibold text-gray-900">{invoices.length}</span>
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
            {!loading && invoices.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-gray-500">
                  No manual invoices yet.
                </td>
              </tr>
            )}
            {!loading && invoices.length > 0 && filteredInvoices.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-gray-500">
                  No invoices match the selected date range.
                </td>
              </tr>
            )}
            {filteredInvoices.map((inv) => (
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
                  <div className="flex items-center gap-3">
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
    </div>
  );
}

