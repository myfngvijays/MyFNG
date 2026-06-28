'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, Loader2, MinusCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { WALLET_BULK_MAX_ENTRIES, walletBulkLimitError } from '@/lib/wallet/walletBulkConstants';

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const DEBIT_SAMPLE_ROWS = [
  { phone: '8652710389', amount: 200 },
  { phone: '9876543210', amount: 500 },
];

const DEBIT_VARIABLE_CSV = `Phone,Amount
8652710389,200
9876543210,500`;

const DEBIT_UNIFORM_PHONES_SAMPLE = `Phone
8652710389
9876543210`;

function inr(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function DebitCsvPreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-[11px]">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-3 py-2 text-left font-semibold border-r border-slate-200 w-1/2">Phone</th>
            <th className="px-3 py-2 text-left font-semibold w-1/2">Amount</th>
          </tr>
        </thead>
        <tbody>
          {DEBIT_SAMPLE_ROWS.map((row) => (
            <tr key={row.phone} className="border-t border-slate-100">
              <td className="px-3 py-1.5 font-mono border-r border-slate-100">{row.phone}</td>
              <td className="px-3 py-1.5">{inr(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function parseDualColumnEntries(phonesRaw: string, amountsRaw: string) {
  const phoneLines = phonesRaw.split(/\r?\n/);
  const amountLines = amountsRaw.split(/\r?\n/);
  const entries: Array<{ phone: string; amount: number }> = [];
  const rowCount = Math.max(phoneLines.length, amountLines.length);

  for (let i = 0; i < rowCount; i += 1) {
    const phone = phoneLines[i]?.replace(/\D/g, '').slice(-10);
    const amount = Number(String(amountLines[i] || '').replace(/[,₹\s]/g, ''));
    if (phone?.length === 10 && amount > 0) entries.push({ phone, amount });
  }

  return [...new Map(entries.map((e) => [e.phone, e])).values()];
}

export default function BulkDebitSection() {
  const [phonesColumnText, setPhonesColumnText] = useState('');
  const [amountsColumnText, setAmountsColumnText] = useState('');
  const [amount, setAmount] = useState('');
  const [uniformPhones, setUniformPhones] = useState('');
  const [mode, setMode] = useState<'uniform' | 'variable'>('uniform');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(null);

  const amountNum = Number(amount);
  const phones = useMemo(
    () => [...new Set(uniformPhones.split(/[\n,;]+/).map((p) => p.replace(/\D/g, '').slice(-10)).filter((p) => p.length === 10))],
    [uniformPhones],
  );
  const variableEntries = useMemo(
    () => parseDualColumnEntries(phonesColumnText, amountsColumnText),
    [phonesColumnText, amountsColumnText],
  );
  const entryCount = mode === 'uniform' ? phones.length : variableEntries.length;
  const overLimit = entryCount > WALLET_BULK_MAX_ENTRIES;
  const wasOverLimit = useRef(false);

  useEffect(() => {
    if (overLimit && !wasOverLimit.current) {
      toast.error(walletBulkLimitError(entryCount));
    }
    wasOverLimit.current = overLimit;
  }, [overLimit, entryCount]);

  const buildPayload = (dryRun: boolean) => {
    if (mode === 'uniform') {
      return {
        amount: amountNum,
        phones_text: uniformPhones.trim(),
        note: note.trim() || undefined,
        dry_run: dryRun,
      };
    }
    return {
      phones_column: phonesColumnText.trim(),
      amounts_column: amountsColumnText.trim(),
      note: note.trim() || undefined,
      dry_run: dryRun,
    };
  };

  const run = async (dryRun: boolean) => {
    if (mode === 'uniform' && (!amountNum || amountNum <= 0)) return toast.error('Enter valid amount');
    if (entryCount === 0) return toast.error('Add phone numbers');
    if (overLimit) return toast.error(walletBulkLimitError(entryCount));

    if (!dryRun && !confirm(`Debit wallets for ${entryCount} user(s)?`)) return;

    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/wallet/bulk-debit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(dryRun)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      if (dryRun) {
        setPreview(data.preview || []);
        toast.success(`${data.matched_count} matched`);
      } else {
        setPreview(null);
        toast.success(`Debited ${data.debited_count} wallet(s)`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5 space-y-4 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900 inline-flex items-center gap-2">
          <MinusCircle className="w-5 h-5 text-red-600" /> Bulk Wallet Debit
        </h2>
        <p className="text-sm text-gray-500 mt-1">Remove wallet balance from selected users.</p>
      </div>

      <div className="flex gap-2">
        {(['uniform', 'variable'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${mode === m ? 'bg-red-600 text-white border-red-600' : 'border-gray-200'}`}
          >
            {m === 'uniform' ? 'Same amount' : 'Per-user amount'}
          </button>
        ))}
      </div>

      {mode === 'uniform' ? (
        <>
          <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-600 space-y-2">
            <p className="text-amber-800 font-medium">
              Note: Ek batch mein maximum {WALLET_BULK_MAX_ENTRIES} numbers.
            </p>
            <button
              type="button"
              onClick={() => downloadTextFile('myfng-wallet-debit-phones-sample.csv', DEBIT_UNIFORM_PHONES_SAMPLE)}
              className="inline-flex items-center gap-1 text-red-700 font-semibold hover:underline"
            >
              <Download className="w-3 h-3" /> Download sample CSV (Phone column)
            </button>
          </div>
          <textarea
            className="w-full rounded-xl border px-4 py-3 text-sm min-h-[120px]"
            placeholder="Phone numbers — one per line"
            value={uniformPhones}
            onChange={(e) => setUniformPhones(e.target.value)}
          />
          <input
            type="number"
            className="w-full rounded-xl border px-4 py-3 text-sm"
            placeholder="Amount to deduct (₹)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </>
      ) : (
        <>
          <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-600 space-y-2">
            <p className="text-amber-800 font-medium">
              Note: Ek batch mein maximum {WALLET_BULK_MAX_ENTRIES} numbers.
            </p>
            <p>CSV: alag columns <strong>Phone</strong> + <strong>Amount</strong></p>
            <DebitCsvPreview />
            <button
              type="button"
              onClick={() => downloadTextFile('myfng-wallet-debit-sample.csv', DEBIT_VARIABLE_CSV)}
              className="inline-flex items-center gap-1 text-red-700 font-semibold hover:underline"
            >
              <Download className="w-3 h-3" /> Download sample CSV
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-semibold">Phone</span>
              <textarea
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm min-h-[140px] font-mono text-xs"
                placeholder={'8652710389\n9876543210'}
                value={phonesColumnText}
                onChange={(e) => setPhonesColumnText(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Amount (₹)</span>
              <textarea
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm min-h-[140px] font-mono text-xs"
                placeholder={'200\n500'}
                value={amountsColumnText}
                onChange={(e) => setAmountsColumnText(e.target.value)}
              />
            </label>
          </div>
        </>
      )}

      <input
        className="w-full rounded-xl border px-4 py-3 text-sm"
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <p className={`text-xs ${overLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
        {entryCount} entries · max {WALLET_BULK_MAX_ENTRIES} per batch
        {overLimit ? ' — limit exceeded' : ''}
      </p>

      {overLimit ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {walletBulkLimitError(entryCount)}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button type="button" disabled={loading || overLimit} onClick={() => void run(true)} className="px-4 py-2 rounded-xl border text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Preview
        </button>
        <button type="button" disabled={loading || overLimit} onClick={() => void run(false)} className="px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-50">
          Debit Wallets
        </button>
      </div>

      {preview?.length ? (
        <ul className="text-xs space-y-1 max-h-40 overflow-y-auto bg-red-50 rounded-xl p-3">
          {preview.map((row: any) => (
            <li key={row.phone} className={row.sufficient ? 'text-gray-800' : 'text-red-700'}>
              {row.full_name || row.phone} · {inr(row.amount)} · {inr(row.current_balance)} → {inr(row.balance_after)}
              {!row.sufficient ? ' (insufficient)' : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
