'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateTimeISTAssumeUTC } from '@/lib/utils';
import { AlertCircle, Copy, DollarSign, ExternalLink, Search } from 'lucide-react';

type GeneratedPaymentLink = {
  ref: string;
  link: string;
  amount: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  status: string;
  order_id: string | null;
  payment_id: string | null;
  created_at: string;
  updated_at: string | null;
};

type DirectPayStatusRow = {
  link_ref: string;
  order_id: string | null;
  payment_id: string | null;
  status: string | null;
  updated_at: string | null;
};

function statusLabel(value: string) {
  return String(value || '')
    .replace(/[_\-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function paymentStatusBadgeClass(value: string) {
  const s = String(value || '').trim().toUpperCase();
  if (s === 'SUCCESS' || s === 'PAID') return 'bg-green-100 text-green-700 border-green-200';
  if (s === 'CREATED') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (s === 'FAILED') return 'bg-red-100 text-red-700 border-red-200';
  if (s === 'CANCELLED' || s === 'CANCELED') return 'bg-red-100 text-red-700 border-red-200';
  if (s === 'LINK_GENERATED') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function paymentStatusLabel(value: string) {
  const s = String(value || '').trim().toUpperCase();
  if (s === 'LINK_GENERATED') return 'Link Generated';
  if (s === 'CREATED') return 'Pending Payment';
  if (s === 'SUCCESS') return 'Paid';
  if (s === 'FAILED') return 'Failed';
  if (s === 'CANCELLED' || s === 'CANCELED') return 'Cancelled';
  return statusLabel(value || 'Unknown');
}

function createPaymentLinkRef() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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
  const [collectForm, setCollectForm] = useState({
    amount: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
  });
  const [collectError, setCollectError] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copySuccess, setCopySuccess] = useState('');
  const [collectRefreshLoading, setCollectRefreshLoading] = useState(false);
  const [collectRefreshError, setCollectRefreshError] = useState('');
  const [generatedPayments, setGeneratedPayments] = useState<GeneratedPaymentLink[]>([]);
  const [cancelLinkLoadingRef, setCancelLinkLoadingRef] = useState('');

  useEffect(() => {
    fetchRazorpayPayments();
    fetchGeneratedPaymentLinks();
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

  async function fetchGeneratedPaymentLinks() {
    setCollectRefreshLoading(true);
    setCollectRefreshError('');
    try {
      const res = await fetch('/api/telecaller/direct-pay-links?limit=200');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load payment links');
      const rows = Array.isArray(json?.rows) ? json.rows : [];
      setGeneratedPayments(
        rows.map((row: any) => ({
          ref: String(row?.ref || ''),
          link: String(row?.link || ''),
          amount: Number(row?.amount || 0),
          customer_name: String(row?.customer_name || ''),
          customer_phone: String(row?.customer_phone || ''),
          customer_email: String(row?.customer_email || ''),
          status: String(row?.status || 'LINK_GENERATED'),
          order_id: row?.order_id ? String(row.order_id) : null,
          payment_id: row?.payment_id ? String(row.payment_id) : null,
          created_at: String(row?.created_at || new Date().toISOString()),
          updated_at: row?.updated_at ? String(row.updated_at) : null,
        }))
      );
    } catch (e: any) {
      setCollectRefreshError(e?.message || 'Failed to load payment links');
    } finally {
      setCollectRefreshLoading(false);
    }
  }

  async function generatePaymentLink() {
    setCollectError('');
    setCopySuccess('');
    const amount = Number(collectForm.amount);
    const customerName = collectForm.customer_name.trim();
    const customerPhone = collectForm.customer_phone.trim();
    const customerEmail = collectForm.customer_email.trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      setCollectError('Please enter a valid amount.');
      setGeneratedLink('');
      return;
    }
    if (!customerName) {
      setCollectError('Please enter customer name.');
      setGeneratedLink('');
      return;
    }
    if (!customerPhone) {
      setCollectError('Please enter customer phone.');
      setGeneratedLink('');
      return;
    }

    const params = new URLSearchParams();
    params.set('amount', String(amount));
    params.set('name', customerName);
    params.set('phone', customerPhone);
    const linkRef = createPaymentLinkRef();
    params.set('ref', linkRef);
    if (customerEmail) {
      params.set('email', customerEmail);
    }

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const link = `${baseUrl}/pay-now?${params.toString()}`;
    try {
      const res = await fetch('/api/telecaller/direct-pay-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: linkRef,
          link,
          amount,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to save payment link');

      const row = json?.row || null;
      if (row) {
        setGeneratedPayments((prev) => {
          const next = prev.filter((item) => item.ref !== String(row.ref || ''));
          next.unshift({
            ref: String(row.ref || ''),
            link: String(row.link || link),
            amount: Number(row.amount || amount),
            customer_name: String(row.customer_name || customerName),
            customer_phone: String(row.customer_phone || customerPhone),
            customer_email: String(row.customer_email || customerEmail),
            status: String(row.status || 'LINK_GENERATED'),
            order_id: row.order_id ? String(row.order_id) : null,
            payment_id: row.payment_id ? String(row.payment_id) : null,
            created_at: String(row.created_at || new Date().toISOString()),
            updated_at: row.updated_at ? String(row.updated_at) : null,
          });
          return next;
        });
      } else {
        fetchGeneratedPaymentLinks();
      }
      setGeneratedLink(link);
      setCopySuccess('Payment link generated.');
    } catch (e: any) {
      setCollectError(e?.message || 'Failed to save payment link');
      setGeneratedLink('');
    }
  }

  async function copyPaymentLink(linkValue?: string) {
    const toCopy = linkValue || generatedLink;
    if (!toCopy) return;
    setCopySuccess('');
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopySuccess('Payment link copied.');
    } catch {
      setCollectError('Unable to copy link. Please copy manually.');
    }
  }

  function canCancelLink(statusValue: string) {
    const status = String(statusValue || '').trim().toUpperCase();
    return status === 'LINK_GENERATED' || status === 'CREATED' || status === 'FAILED';
  }

  function isComplaintCompleted(statusValue: unknown) {
    const status = String(statusValue || '').trim().toLowerCase();
    return status === 'completed' || status === 'closed' || status === 'resolved';
  }

  async function cancelGeneratedPaymentLink(ref: string) {
    if (!ref) return;
    const ok = window.confirm('Customer ne mana kiya hai? Is payment link ko cancel karna hai?');
    if (!ok) return;

    setCollectError('');
    setCopySuccess('');
    setCollectRefreshError('');
    setCancelLinkLoadingRef(ref);
    try {
      const res = await fetch('/api/telecaller/direct-pay-links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to cancel payment link');
      setGeneratedPayments((prev) =>
        prev.map((item) =>
          item.ref === ref
            ? {
                ...item,
                status: 'CANCELLED',
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );
      setCopySuccess('Payment link cancelled.');
    } catch (e: any) {
      setCollectRefreshError(e?.message || 'Failed to cancel payment link');
    } finally {
      setCancelLinkLoadingRef('');
    }
  }

  async function refreshGeneratedPaymentStatuses() {
    const refs = Array.from(new Set(generatedPayments.map((row) => row.ref).filter(Boolean)));
    if (refs.length === 0) return;

    setCollectRefreshLoading(true);
    setCollectRefreshError('');
    try {
      const res = await fetch('/api/telecaller/direct-pay-links/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refs }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to refresh payment status');
      const rows: DirectPayStatusRow[] = Array.isArray(json?.rows) ? json.rows : [];
      const byRef = new Map<string, DirectPayStatusRow>();
      for (const row of rows) {
        const ref = String(row?.link_ref || '').trim();
        if (ref) byRef.set(ref, row);
      }

      setGeneratedPayments((prev) =>
        prev.map((item) => {
          const matched = byRef.get(item.ref);
          if (!matched) return item;
          return {
            ...item,
            status: String(matched.status || item.status),
            order_id: matched.order_id || item.order_id,
            payment_id: matched.payment_id || item.payment_id,
            updated_at: matched.updated_at || item.updated_at,
          };
        })
      );
    } catch (e: any) {
      setCollectRefreshError(e?.message || 'Failed to refresh payment status');
    } finally {
      setCollectRefreshLoading(false);
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

  const generatedPaymentRefsKey = useMemo(
    () => generatedPayments.map((row) => row.ref).join('|'),
    [generatedPayments]
  );

  useEffect(() => {
    if (!generatedPaymentRefsKey) return;
    refreshGeneratedPaymentStatuses();
    const timer = window.setInterval(() => {
      refreshGeneratedPaymentStatuses();
    }, 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedPaymentRefsKey]);

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

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-base font-bold text-text-heading">Collect Payment</h2>
          </div>
          <p className="text-xs text-gray-600 mb-4">
            Payment link generate karke customer ko bhej sakte ho. Amount, name aur phone link me prefilled rehte hain.
          </p>

          {collectError ? (
            <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm mb-3">
              {collectError}
            </div>
          ) : null}
          {copySuccess ? (
            <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg text-sm mb-3">
              {copySuccess}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Amount (INR)</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                type="number"
                min="1"
                placeholder="Enter amount"
                value={collectForm.amount}
                onChange={(e) => setCollectForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Customer Name</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                type="text"
                placeholder="Customer full name"
                value={collectForm.customer_name}
                onChange={(e) => setCollectForm((f) => ({ ...f, customer_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Customer Phone</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                type="tel"
                placeholder="9876543210"
                value={collectForm.customer_phone}
                onChange={(e) => setCollectForm((f) => ({ ...f, customer_phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Customer Email (optional)</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                type="email"
                placeholder="you@example.com"
                value={collectForm.customer_email}
                onChange={(e) => setCollectForm((f) => ({ ...f, customer_email: e.target.value }))}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary text-xs px-4 py-2" onClick={generatePaymentLink}>
              Generate Link
            </button>
            {generatedLink ? (
              <>
                <button
                  type="button"
                  className="btn btn-outline text-xs px-4 py-2 flex items-center gap-1"
                  onClick={() => copyPaymentLink()}
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
                <a
                  href={generatedLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline text-xs px-4 py-2 inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Link
                </a>
              </>
            ) : null}
          </div>

          {generatedLink ? (
            <div className="mt-4">
              <label className="text-xs text-gray-600">Generated Payment Link</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-xs mt-1 bg-gray-50"
                rows={3}
                value={generatedLink}
                readOnly
              />
            </div>
          ) : null}
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-text-heading">Generated Payment Links</h3>
              <div className="text-xs text-gray-500">
                {generatedPayments.length} links {collectRefreshLoading ? '(refreshing...)' : ''}
              </div>
            </div>
            {generatedPayments.length > 0 ? (
              <button
                type="button"
                className="btn btn-outline text-xs px-3 py-1.5"
                onClick={fetchGeneratedPaymentLinks}
                disabled={collectRefreshLoading}
              >
                Refresh
              </button>
            ) : null}
          </div>

          {collectRefreshError ? (
            <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm mb-3">
              {collectRefreshError}
            </div>
          ) : null}

          {generatedPayments.length === 0 ? (
            <div className="text-sm text-gray-600 py-3">No payment links generated yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">Phone</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Updated</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedPayments.map((row) => (
                    <tr key={row.ref} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 font-semibold">{row.customer_name || '—'}</td>
                      <td className="py-2 pr-3">{row.customer_phone || '—'}</td>
                      <td className="py-2 pr-3">₹{row.amount}</td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-1 rounded-full border ${paymentStatusBadgeClass(row.status)}`}>
                          {paymentStatusLabel(row.status)}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{formatDateTimeISTAssumeUTC(row.updated_at || row.created_at)}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-700 font-semibold"
                            onClick={() => copyPaymentLink(row.link)}
                          >
                            Copy
                          </button>
                          <a
                            href={row.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 font-semibold"
                          >
                            Open
                          </a>
                          {canCancelLink(row.status) ? (
                            <button
                              type="button"
                              className="text-red-600 hover:text-red-700 font-semibold disabled:opacity-60"
                              onClick={() => cancelGeneratedPaymentLink(row.ref)}
                              disabled={cancelLinkLoadingRef === row.ref}
                            >
                              {cancelLinkLoadingRef === row.ref ? 'Cancelling...' : 'Cancel'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                          {isComplaintCompleted(row.lead_status) ? null : (
                            <button
                              type="button"
                              className="text-red-700 hover:text-red-800 font-semibold"
                              onClick={() => openRefund(row)}
                              disabled={String(row.refund_status || '').toUpperCase() === 'REFUNDED'}
                            >
                              {String(row.refund_status || '').toUpperCase() === 'REFUNDED' ? 'Refunded' : 'Refund'}
                            </button>
                          )}
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
