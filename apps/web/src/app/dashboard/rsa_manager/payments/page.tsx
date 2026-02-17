'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateTimeISTAssumeUTC } from '@/lib/utils';
import { AlertCircle, DollarSign, Search } from 'lucide-react';

export default function RSAManagerPaymentsPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundRow, setRefundRow] = useState<any | null>(null);
  const [refundMode, setRefundMode] = useState<'full' | 'partial'>('full');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNotes, setRefundNotes] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [refundSuccess, setRefundSuccess] = useState('');

  useEffect(() => {
    fetchRazorpayPayments();
  }, []);

  async function fetchRazorpayPayments() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rsa_manager/payments');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to fetch Razorpay payments');
      setPayments(Array.isArray(json?.payments) ? json.payments : []);
    } catch (e) {
      console.error('Failed to load Razorpay payments:', e);
      setError((e as any)?.message || 'Failed to load Razorpay payments');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }

  function openRefund(row: any) {
    setRefundRow(row);
    setRefundMode('full');
    setRefundAmount(row?.amount != null ? String(Number(row.amount).toFixed(2)) : '');
    setRefundNotes('');
    setRefundError('');
    setRefundSuccess('');
    setRefundOpen(true);
  }

  function closeRefund() {
    setRefundOpen(false);
    setRefundRow(null);
    setRefundMode('full');
    setRefundAmount('');
    setRefundNotes('');
    setRefundError('');
    setRefundSuccess('');
    setRefundLoading(false);
  }

  async function submitRefund() {
    if (!refundRow?.payment_id) return;
    setRefundLoading(true);
    setRefundError('');
    setRefundSuccess('');
    try {
      const payload: any = {
        payment_id: refundRow.payment_id,
        mode: refundMode,
        notes: refundNotes.trim() || null,
      };
      if (refundMode === 'partial') {
        const amount = Number(refundAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error('Enter a valid partial refund amount');
        }
        payload.amount = amount;
      }
      const res = await fetch('/api/rsa_manager/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Refund failed');
      setRefundSuccess(
        `Refund successful: ₹${Number(json?.refund?.amount || 0).toFixed(2)} (${String(json?.refund?.payment_status || json?.refund?.status || 'processed')})`
      );
      await fetchRazorpayPayments();
      window.setTimeout(() => {
        closeRefund();
      }, 1200);
    } catch (e: any) {
      setRefundError(e?.message || 'Refund failed');
    } finally {
      setRefundLoading(false);
    }
  }

  const filteredPayments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((row: any) => {
      return (
        String(row?.lead_customer_name || row?.customer_name || '').toLowerCase().includes(q) ||
        String(row?.lead_phone || row?.customer_phone || '').includes(query) ||
        String(row?.vehicle_number || '').toLowerCase().includes(q) ||
        String(row?.order_id || '').toLowerCase().includes(q) ||
        String(row?.payment_id || '').toLowerCase().includes(q)
      );
    });
  }, [payments, query]);

  const totals = useMemo(() => {
    let received = 0;
    for (const row of filteredPayments) {
      const amount = Number(row?.amount || 0);
      if (Number.isFinite(amount)) received += amount;
    }
    return {
      received,
      transactions: filteredPayments.length,
      customers: new Set(filteredPayments.map((row: any) => String(row?.lead_phone || row?.customer_phone || ''))).size,
    };
  }, [filteredPayments]);

  function refundBadge(refundStatus: string) {
    const s = String(refundStatus || '').toUpperCase();
    if (s === 'REFUNDED') {
      return <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">Refunded</span>;
    }
    if (s === 'PARTIALLY_REFUNDED') {
      return (
        <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
          Partially Refunded
        </span>
      );
    }
    return <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">Not Refunded</span>;
  }

  return (
    <DashboardLayout role="rsa_manager">
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-5 md:space-y-6">
        <div className="bg-gradient-to-r from-emerald-600 to-green-500 text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-lg">Payment</h1>
          <p className="text-white/90 font-medium text-xs sm:text-sm md:text-base mt-1">
            Only successful Razorpay payments from leads assigned to you.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card">
            <div className="text-xs text-gray-600">Razorpay Received</div>
            <div className="text-xl font-bold text-gray-900">₹{totals.received.toFixed(2)}</div>
          </div>
          <div className="card">
            <div className="text-xs text-gray-600">Transactions</div>
            <div className="text-xl font-bold text-gray-900">{totals.transactions}</div>
          </div>
          <div className="card">
            <div className="text-xs text-gray-600">Customers</div>
            <div className="text-xl font-bold text-gray-900">{totals.customers}</div>
          </div>
        </div>

        <div className="card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
              placeholder="Search by customer / phone / vehicle"
            />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">Razorpay Payments ({filteredPayments.length})</h2>
          </div>

          {error ? (
            <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          ) : null}

          {loading ? (
            <div className="text-sm text-gray-600 py-8 text-center">Loading Razorpay payments...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-10">
              <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No Razorpay payments found for your assigned leads.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3">Paid At</th>
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">Phone</th>
                    <th className="py-2 pr-3">Vehicle</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Refund</th>
                    <th className="py-2 pr-3">Method</th>
                    <th className="py-2 pr-3">Order ID</th>
                    <th className="py-2 pr-3">Payment ID</th>
                    <th className="py-2 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((row: any, idx: number) => (
                    <tr key={`${row.order_id || 'order'}-${row.payment_id || idx}`} className="border-b last:border-b-0">
                      <td className="py-2 pr-3">{formatDateTimeISTAssumeUTC(row.updated_at || row.created_at) || '—'}</td>
                      <td className="py-2 pr-3 font-semibold">{row.lead_customer_name || row.customer_name || '—'}</td>
                      <td className="py-2 pr-3">{row.lead_phone || row.customer_phone || '—'}</td>
                      <td className="py-2 pr-3">
                        {row.vehicle_number || '—'}
                        {row.vehicle_model ? ` (${row.vehicle_model})` : ''}
                      </td>
                      <td className="py-2 pr-3">{String(row.status || '').toUpperCase()}</td>
                      <td className="py-2 pr-3">₹{Number(row.amount || 0).toFixed(2)}</td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-col gap-1">
                          {refundBadge(row.refund_status)}
                          {Number(row.refunded_amount || 0) > 0 ? (
                            <span className="text-[11px] text-gray-500">₹{Number(row.refunded_amount).toFixed(2)} refunded</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-2 pr-3">{row.method ? String(row.method).toUpperCase() : '—'}</td>
                      <td className="py-2 pr-3 font-mono">{row.order_id || '—'}</td>
                      <td className="py-2 pr-3 font-mono">{row.payment_id || '—'}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-3">
                          {row.lead_id ? (
                            <Link
                              href={`/dashboard/rsa_manager/leads/${row.lead_id}`}
                              className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold"
                            >
                              <DollarSign className="w-4 h-4" />
                              View
                            </Link>
                          ) : (
                            <span>—</span>
                          )}
                          <button
                            type="button"
                            className="text-red-700 hover:text-red-800 font-semibold"
                            onClick={() => openRefund(row)}
                            disabled={String(row.refund_status || '').toUpperCase() === 'REFUNDED'}
                          >
                            {String(row.refund_status || '').toUpperCase() === 'REFUNDED' ? 'Refunded' : 'Refund'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {refundOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <div className="text-base font-bold text-gray-900">Instant Refund</div>
                <div className="text-xs text-gray-500">Payment ID: {refundRow?.payment_id || '—'}</div>
              </div>
              <button type="button" className="text-gray-500 hover:text-gray-700" onClick={closeRefund}>
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="text-sm text-gray-700">
                <span className="font-semibold">Paid Amount:</span> ₹{Number(refundRow?.amount || 0).toFixed(2)}
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-600">Refund Type</label>
                <div className="flex items-center gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="refund-mode"
                      checked={refundMode === 'full'}
                      onChange={() => setRefundMode('full')}
                      disabled={refundLoading}
                    />
                    Full Refund
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="refund-mode"
                      checked={refundMode === 'partial'}
                      onChange={() => setRefundMode('partial')}
                      disabled={refundLoading}
                    />
                    Partial Refund
                  </label>
                </div>
              </div>

              {refundMode === 'partial' ? (
                <div>
                  <label className="text-xs text-gray-600">Partial Amount (INR)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    disabled={refundLoading}
                    className="w-full border rounded-md px-3 py-2 text-sm mt-1"
                    placeholder="Enter amount to refund"
                  />
                </div>
              ) : null}

              <div>
                <label className="text-xs text-gray-600">Reason (optional)</label>
                <textarea
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  disabled={refundLoading}
                  className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] mt-1"
                  placeholder="Refund reason for audit trail"
                />
              </div>

              {refundError ? (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{refundError}</div>
              ) : null}
              {refundSuccess ? (
                <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{refundSuccess}</div>
              ) : null}
            </div>

            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn btn-outline text-sm px-4 py-2"
                onClick={closeRefund}
                disabled={refundLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary text-sm px-4 py-2"
                onClick={submitRefund}
                disabled={refundLoading}
              >
                {refundLoading ? 'Processing...' : 'Refund Now'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
