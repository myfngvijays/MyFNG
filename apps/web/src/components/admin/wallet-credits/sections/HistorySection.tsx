'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, History, IndianRupee, Loader2, Search } from 'lucide-react';

type TxRow = {
  id: string;
  customer_name: string | null;
  phone: string | null;
  amount: number;
  balance_after: number;
  source: string;
  label: string;
  campaign_label: string | null;
  bulk_batch_id: string | null;
  created_at: string;
};

function inr(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function formatPhone(phone: string | null) {
  if (!phone) return '—';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export default function HistorySection() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [bulkBatches, setBulkBatches] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const load = async (q = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '150' });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/super_admin/wallet/credits/history?${params}`);
      const data = await res.json();
      if (res.ok) {
        setTransactions(data.transactions || []);
        setBulkBatches(data.bulk_batches || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((row) =>
      [row.customer_name, row.phone, row.label, row.campaign_label, row.bulk_batch_id, row.source]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [transactions, search]);

  const exportCsv = () => {
    const header = ['Date', 'Customer', 'Phone', 'Type', 'Amount', 'Balance After', 'Label', 'Campaign', 'Batch ID'];
    const lines = filtered.map((row) =>
      [
        new Date(row.created_at).toISOString(),
        row.customer_name || '',
        formatPhone(row.phone),
        row.source,
        row.amount,
        row.balance_after,
        row.label,
        row.campaign_label || '',
        row.bulk_batch_id || '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet-admin-credits-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2.5 text-sm"
            placeholder="Search phone, name, campaign, batch…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load(search)}
          />
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {bulkBatches.length > 0 ? (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="px-5 py-3 border-b font-bold">Bulk Batches</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Campaign</th>
                <th className="px-4 py-2 text-left">Users</th>
                <th className="px-4 py-2 text-left">Total</th>
              </tr>
            </thead>
            <tbody>
              {bulkBatches.map((b) => (
                <tr key={b.batch_id} className="border-t">
                  <td className="px-4 py-2">{new Date(b.created_at).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2">{b.campaign_label || 'Bulk'}</td>
                  <td className="px-4 py-2">{b.user_count}</td>
                  <td className="px-4 py-2 font-semibold text-emerald-700">{inr(b.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-5 py-3 border-b font-bold inline-flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-600" /> Admin Credits & Debits ({filtered.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Phone</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Amount</th>
                <th className="px-4 py-2 text-left">Balance</th>
                <th className="px-4 py-2 text-left">Label</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(row.created_at).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2">{row.customer_name || '—'}</td>
                  <td className="px-4 py-2">{formatPhone(row.phone)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${row.source === 'ADMIN_DEBIT' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}
                    >
                      {row.source === 'ADMIN_DEBIT' ? 'Debit' : 'Credit'}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-semibold">{inr(row.amount)}</td>
                  <td className="px-4 py-2">{inr(row.balance_after)}</td>
                  <td className="px-4 py-2 text-gray-600">{row.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
