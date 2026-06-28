'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  IndianRupee,
  Loader2,
  Upload,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  WALLET_BULK_MAX_ENTRIES,
  WALLET_CREDIT_PUSH_DEFAULT_MESSAGE,
  WALLET_CREDIT_PUSH_DEFAULT_TITLE,
  walletBulkLimitError,
} from '@/lib/wallet/walletBulkConstants';

type InputMode = 'single' | 'paste' | 'file' | 'google_sheet';
type AmountMode = 'uniform' | 'variable';

type PreviewRow = {
  phone: string;
  full_name: string | null;
  amount: number;
  current_balance: number;
  balance_after: number;
};

type OpResult = {
  credited_count: number;
  matched_count: number;
  total_credited: number;
  push_delivered?: number;
  not_found_phones: string[];
  batch_id: string;
  results: Array<{
    phone: string;
    full_name: string | null;
    amount: number;
    credited: number;
    balance_after: number;
    push_delivered?: number;
    error?: string;
  }>;
};

function parsePhonesText(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\n,;|\t]+/)
        .map((part) => part.replace(/\D/g, '').slice(-10))
        .filter((phone) => phone.length === 10),
    ),
  ];
}

function parseDualColumnEntries(phonesRaw: string, amountsRaw: string): Array<{ phone: string; amount: number }> {
  const phoneLines = phonesRaw.split(/\r?\n/);
  const amountLines = amountsRaw.split(/\r?\n/);
  const entries: Array<{ phone: string; amount: number }> = [];
  const rowCount = Math.max(phoneLines.length, amountLines.length);

  for (let i = 0; i < rowCount; i += 1) {
    const phone = phoneLines[i]?.replace(/\D/g, '').slice(-10);
    const amount = Number(String(amountLines[i] || '').replace(/[,₹\s]/g, ''));
    if (phone?.length === 10 && Number.isFinite(amount) && amount > 0) {
      entries.push({ phone, amount });
    }
  }

  const byPhone = new Map<string, { phone: string; amount: number }>();
  for (const entry of entries) byPhone.set(entry.phone, entry);
  return [...byPhone.values()];
}

function inr(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const UNIFORM_PHONE_CSV_SAMPLE = `Phone
8652710389
9876543210
9123456789`;

const VARIABLE_AMOUNT_CSV_SAMPLE = `Phone,Amount
8652710389,500
9876543210,1000
9123456789,250`;

const SAMPLE_PHONE_ROWS = ['8652710389', '9876543210', '9123456789'];
const SAMPLE_WALLET_ROWS = [
  { phone: '8652710389', amount: 500 },
  { phone: '9876543210', amount: 1000 },
  { phone: '9123456789', amount: 250 },
];

function CsvFormatPreview({ variant }: { variant: 'phone-only' | 'phone-amount' }) {
  if (variant === 'phone-only') {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-[11px]">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Phone</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_PHONE_ROWS.map((row) => (
              <tr key={row} className="border-t border-slate-100">
                <td className="px-3 py-1.5 font-mono text-slate-800">{row}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-[11px]">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-slate-700 border-r border-slate-200 w-1/2">
              Phone
            </th>
            <th className="px-3 py-2 text-left font-semibold text-slate-700 w-1/2">Amount</th>
          </tr>
        </thead>
        <tbody>
          {SAMPLE_WALLET_ROWS.map((row) => (
            <tr key={row.phone} className="border-t border-slate-100">
              <td className="px-3 py-1.5 font-mono text-slate-800 border-r border-slate-100">{row.phone}</td>
              <td className="px-3 py-1.5 text-slate-800">{inr(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function downloadUniformPhoneTemplate() {
  downloadTextFile('myfng-wallet-phones-sample.csv', UNIFORM_PHONE_CSV_SAMPLE);
}

function downloadVariableAmountTemplate() {
  downloadTextFile('myfng-wallet-credit-sample.csv', VARIABLE_AMOUNT_CSV_SAMPLE);
}

export default function BulkCreditSection() {
  const [amountMode, setAmountMode] = useState<AmountMode>('uniform');
  const [inputMode, setInputMode] = useState<InputMode>('paste');
  const [phone, setPhone] = useState('');
  const [phonesText, setPhonesText] = useState('');
  const [phonesColumnText, setPhonesColumnText] = useState('');
  const [amountsColumnText, setAmountsColumnText] = useState('');
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [amount, setAmount] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [campaignLabel, setCampaignLabel] = useState('');
  const [note, setNote] = useState('');
  const [sendPush, setSendPush] = useState(true);
  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{
    total: number;
    notFound: string[];
    matchedCount: number;
  } | null>(null);
  const [result, setResult] = useState<OpResult | null>(null);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= 100000;

  const uniformPhones = useMemo(() => {
    if (inputMode === 'single') {
      const p = phone.replace(/\D/g, '').slice(-10);
      return p.length === 10 ? [p] : [];
    }
    return parsePhonesText(phonesText);
  }, [inputMode, phone, phonesText]);

  const variableEntries = useMemo(
    () => parseDualColumnEntries(phonesColumnText, amountsColumnText),
    [phonesColumnText, amountsColumnText],
  );

  const entryCount = amountMode === 'uniform' ? uniformPhones.length : variableEntries.length;
  const totalAmount = useMemo(() => {
    if (amountMode === 'uniform') {
      return amountValid ? amountNum * uniformPhones.length : 0;
    }
    return variableEntries.reduce((sum, e) => sum + e.amount, 0);
  }, [amountMode, amountValid, amountNum, uniformPhones.length, variableEntries]);

  const overLimit = entryCount > WALLET_BULK_MAX_ENTRIES;
  const wasOverLimit = useRef(false);

  useEffect(() => {
    if (overLimit && !wasOverLimit.current) {
      toast.error(walletBulkLimitError(entryCount));
    }
    wasOverLimit.current = overLimit;
  }, [overLimit, entryCount]);

  const buildPayload = (dryRun: boolean): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      note: note.trim() || undefined,
      campaign_label: campaignLabel.trim() || undefined,
      dry_run: dryRun,
      send_push: sendPush,
      push_title: sendPush && pushTitle.trim() ? pushTitle.trim() : undefined,
      push_message: sendPush && pushMessage.trim() ? pushMessage.trim() : undefined,
      expires_in_days: expiresInDays.trim() ? Number(expiresInDays) : undefined,
    };

    if (amountMode === 'uniform') {
      payload.amount = amountNum;
      if (inputMode === 'single') payload.phone = phone.replace(/\D/g, '').slice(-10);
      else if (inputMode === 'google_sheet') payload.google_sheet_url = googleSheetUrl.trim();
      else payload.phones_text = phonesText.trim();
    } else {
      if (inputMode === 'google_sheet') payload.google_sheet_url = googleSheetUrl.trim();
      else {
        payload.phones_column = phonesColumnText.trim();
        payload.amounts_column = amountsColumnText.trim();
      }
    }

    return payload;
  };

  const validate = (): string | null => {
    if (amountMode === 'uniform' && !amountValid) return 'Enter a valid amount (₹1 – ₹1,00,000)';
    if (entryCount === 0) return 'Add at least one valid entry';
    if (overLimit) return walletBulkLimitError(entryCount);
    if (inputMode === 'google_sheet' && !googleSheetUrl.trim()) return 'Paste Google Sheet URL';
    return null;
  };

  const handlePreview = async () => {
    const err = validate();
    if (err) return toast.error(err);

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/super_admin/wallet/bulk-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(true)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview failed');

      setPreview(data.preview || []);
      setPreviewMeta({
        total: Number(data.total_credit || 0),
        notFound: data.not_found_phones || [],
        matchedCount: Number(data.matched_count || 0),
      });
      toast.success(`${data.matched_count} customer(s) matched · ${inr(data.total_credit)} total`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Preview failed');
      setPreview(null);
      setPreviewMeta(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCredit = async () => {
    const err = validate();
    if (err) return toast.error(err);

    const matched = previewMeta?.matchedCount ?? entryCount;
    const total = previewMeta?.total ?? totalAmount;
    if (
      !confirm(
        `Credit wallets for ${matched} matched user(s)?\n\nTotal: ${inr(total)}${sendPush ? '\n\nPush notification will be sent.' : ''}`,
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/wallet/bulk-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(false)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk credit failed');

      setResult(data as OpResult);
      setPreview(null);
      setPreviewMeta(null);

      if (Number(data.credited_count) > 0) {
        toast.success(
          `Credited ${data.credited_count} wallet(s) — ${inr(data.total_credited)}${data.push_delivered ? ` · ${data.push_delivered} push sent` : ''}`,
        );
      } else {
        toast.error('No wallets were credited');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Bulk credit failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, withAmounts: boolean) => {
    if (withAmounts) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/super_admin/wallet/import-entries', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Import failed');
      const entries = (json.entries || []) as Array<{ phone: string; amount: number }>;
      if (entries.length > WALLET_BULK_MAX_ENTRIES) {
        throw new Error(walletBulkLimitError(entries.length));
      }
      setPhonesColumnText(entries.map((e) => e.phone).join('\n'));
      setAmountsColumnText(entries.map((e) => e.amount).join('\n'));
      setAmountMode('variable');
      setInputMode('paste');
      toast.success(`${json.count} rows imported — Phone & Amount columns filled`);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/admin/coupons/assign/import', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Import failed');
      const phonesText = String(json?.phones_text || '');
      const count = Number(json.count) || parsePhonesText(phonesText).length;
      if (count > WALLET_BULK_MAX_ENTRIES) {
        throw new Error(walletBulkLimitError(count));
      }
      setPhonesText(phonesText);
      setInputMode('paste');
      toast.success(`${json.count} numbers imported`);
    } catch (err: unknown) {
      if (err instanceof Error && err.message !== 'Import failed') {
        toast.error(err.message);
        return;
      }
      const text = await file.text();
      const phones = parsePhonesText(text);
      if (phones.length > WALLET_BULK_MAX_ENTRIES) {
        toast.error(walletBulkLimitError(phones.length));
        return;
      }
      setPhonesText(text);
      setInputMode('paste');
      toast.success('File loaded');
    }
  };

  const fetchGoogleSheet = async () => {
    if (!googleSheetUrl.trim()) return toast.error('Paste Google Sheet URL first');
    setLoading(true);
    try {
      const endpoint =
        amountMode === 'variable'
          ? '/api/super_admin/wallet/import-entries'
          : '/api/admin/coupons/assign/import';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ google_sheet_url: googleSheetUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Fetch failed');
      const count = Number(json.count) || 0;
      if (count > WALLET_BULK_MAX_ENTRIES) {
        throw new Error(walletBulkLimitError(count));
      }
      if (amountMode === 'variable') {
        const entries = (json.entries || []) as Array<{ phone: string; amount: number }>;
        setPhonesColumnText(entries.map((e) => e.phone).join('\n'));
        setAmountsColumnText(entries.map((e) => e.amount).join('\n'));
        setInputMode('paste');
      } else {
        setPhonesText(String(json.phones_text || ''));
        setInputMode('paste');
      }
      toast.success(`${json.count} rows fetched from Google Sheet`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Google Sheet fetch failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Bulk Wallet Credit</h2>
          <p className="text-sm text-gray-500 mt-1">
            Same amount ya alag-alag amount — selected users ke wallet mein balance add hoga.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'uniform' as const, label: 'Same amount for all' },
              { id: 'variable' as const, label: 'Different amount per user' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setAmountMode(m.id);
                setPreview(null);
                setResult(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                amountMode === m.id
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'single' as const, label: 'Single', hide: amountMode === 'variable' },
              { id: 'paste' as const, label: 'Paste' },
              { id: 'file' as const, label: 'Upload File' },
              { id: 'google_sheet' as const, label: 'Google Sheet' },
            ] as const
          )
            .filter((m) => !m.hide)
            .map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setInputMode(m.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                  inputMode === m.id
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {m.label}
              </button>
            ))}
        </div>

        {inputMode === 'single' && amountMode === 'uniform' ? (
          <input
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            placeholder="Customer mobile (10 digits)"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
          />
        ) : null}

        {inputMode === 'paste' && amountMode === 'uniform' ? (
          <textarea
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm min-h-[140px]"
            placeholder={`8652710389\n9876543210,9123456789\n\n(Max ${WALLET_BULK_MAX_ENTRIES} numbers per batch)`}
            value={phonesText}
            onChange={(e) => {
              setPhonesText(e.target.value);
              setPreview(null);
            }}
          />
        ) : null}

        {inputMode === 'paste' && amountMode === 'variable' ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Har row match honi chahiye — line 1 phone = line 1 amount, line 2 phone = line 2 amount…
              <span className="block mt-1 text-amber-800 font-medium">
                Note: Maximum {WALLET_BULK_MAX_ENTRIES} numbers per batch.
              </span>
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-semibold text-gray-800">Phone</span>
                <textarea
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm min-h-[160px] font-mono text-xs"
                  placeholder={'8652710389\n9876543210\n9123456789'}
                  value={phonesColumnText}
                  onChange={(e) => {
                    setPhonesColumnText(e.target.value);
                    setPreview(null);
                  }}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-gray-800">Amount (₹)</span>
                <textarea
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm min-h-[160px] font-mono text-xs"
                  placeholder={'500\n1000\n250'}
                  value={amountsColumnText}
                  onChange={(e) => {
                    setAmountsColumnText(e.target.value);
                    setPreview(null);
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-gray-500">{variableEntries.length} matched row(s)</p>
          </div>
        ) : null}

        {inputMode === 'file' ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-2">
              <p className="font-semibold text-slate-800">CSV format</p>
              <p className="text-amber-800 font-medium">
                Note: Ek batch mein maximum {WALLET_BULK_MAX_ENTRIES} numbers upload kar sakte ho.
              </p>
              {amountMode === 'uniform' ? (
                <>
                  <p>Ek column: <strong>Phone</strong></p>
                  <CsvFormatPreview variant="phone-only" />
                  <p>Same amount field mein daalo — sab imported numbers ko wahi milega.</p>
                  <button
                    type="button"
                    onClick={downloadUniformPhoneTemplate}
                    className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download sample CSV (phones only)
                  </button>
                </>
              ) : (
                <>
                  <p>
                    Do alag columns — <strong>Phone</strong> | <strong>Amount</strong>
                  </p>
                  <CsvFormatPreview variant="phone-amount" />
                  <button
                    type="button"
                    onClick={downloadVariableAmountTemplate}
                    className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download sample CSV (Phone + Amount columns)
                  </button>
                </>
              )}
            </div>
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-8 cursor-pointer hover:border-emerald-300">
              <Upload className="w-8 h-8 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">
                {amountMode === 'variable' ? 'Upload CSV with phone + amount columns' : 'Upload phone list CSV'}
              </span>
              <input
                type="file"
                accept=".csv,.txt,.xls,.xlsx"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file, amountMode === 'variable').catch((err) => toast.error(String(err.message || err)));
                }}
              />
            </label>
          </div>
        ) : null}

        {inputMode === 'google_sheet' ? (
          <div className="space-y-2">
            <input
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              placeholder="Google Sheet URL (shared as Viewer)"
              value={googleSheetUrl}
              onChange={(e) => setGoogleSheetUrl(e.target.value)}
            />
            <button
              type="button"
              disabled={loading || !googleSheetUrl.trim()}
              onClick={() => void fetchGoogleSheet()}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold disabled:opacity-50"
            >
              Fetch from Google Sheet
            </button>
            {amountMode === 'uniform' ? (
              <p className="text-xs text-gray-500">Sheet with phone column + uniform amount field below.</p>
            ) : (
              <p className="text-xs text-gray-500">Sheet needs phone + amount columns.</p>
            )}
          </div>
        ) : null}

        {overLimit ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {walletBulkLimitError(entryCount)}
          </p>
        ) : null}

        <p className={`text-xs ${overLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
          {entryCount} entr{entryCount === 1 ? 'y' : 'ies'} · max {WALLET_BULK_MAX_ENTRIES} per batch
          {overLimit ? ' — limit exceeded' : ''}
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {amountMode === 'uniform' ? (
            <label className="block">
              <span className="text-sm font-semibold text-gray-800">Amount per user (₹) *</span>
              <input
                type="number"
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                placeholder="500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          ) : (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm">
              <p className="font-semibold text-emerald-900">Variable amounts</p>
              <p className="text-emerald-800 mt-1">Total: {inr(totalAmount)}</p>
            </div>
          )}
          <label className="block">
            <span className="text-sm font-semibold text-gray-800">Campaign label</span>
            <input
              className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              placeholder="Diwali Bonus 2026"
              value={campaignLabel}
              onChange={(e) => setCampaignLabel(e.target.value)}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-gray-800 inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Expires in (days)
          </span>
          <input
            type="number"
            min={0}
            max={365}
            className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            placeholder="Leave empty = no expiry"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
          />
        </label>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={sendPush} onChange={(e) => setSendPush(e.target.checked)} />
            <span className="text-sm font-semibold text-gray-800 inline-flex items-center gap-1">
              <Bell className="w-3.5 h-3.5" /> Send push notification
            </span>
          </label>

          {sendPush ? (
            <div className="space-y-3 border-t border-gray-200 pt-3">
              <label className="block">
                <span className="text-sm font-semibold text-gray-800">Notification title</span>
                <input
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm"
                  placeholder={WALLET_CREDIT_PUSH_DEFAULT_TITLE}
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-gray-800">Notification message</span>
                <textarea
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm min-h-[80px]"
                  placeholder={WALLET_CREDIT_PUSH_DEFAULT_MESSAGE}
                  value={pushMessage}
                  onChange={(e) => setPushMessage(e.target.value)}
                />
              </label>
              <p className="text-xs text-gray-500">
                Placeholders:{' '}
                <code className="rounded bg-white px-1">{'{amount}'}</code>,{' '}
                <code className="rounded bg-white px-1">{'{balance}'}</code>,{' '}
                <code className="rounded bg-white px-1">{'{name}'}</code> — har user ke liye auto fill hoga.
                Khali chhodo to default message use hoga.
              </p>
            </div>
          ) : null}
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-gray-800">Note (wallet history)</span>
          <input
            className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading || overLimit}
            onClick={() => void handlePreview()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            Preview matched
          </button>
          <button
            type="button"
            disabled={loading || overLimit}
            onClick={() => void handleCredit()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <IndianRupee className="w-4 h-4" />}
            Credit Wallets
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <SummaryCard entryCount={entryCount} totalAmount={totalAmount} overLimit={overLimit} />
        {preview && preview.length > 0 ? <PreviewCard preview={preview} notFound={previewMeta?.notFound || []} /> : null}
        {result ? <ResultCard result={result} /> : null}
      </div>
    </div>
  );
}

function SummaryCard({
  entryCount,
  totalAmount,
  overLimit,
}: {
  entryCount: number;
  totalAmount: number;
  overLimit: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Summary</p>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Entries</span>
          <span className={`font-bold ${overLimit ? 'text-red-600' : 'text-gray-900'}`}>{entryCount}</span>
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-2">
          <span className="font-semibold text-gray-700">Total credit</span>
          <span className="font-black text-emerald-700 text-lg">{totalAmount > 0 ? inr(totalAmount) : '—'}</span>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ preview, notFound }: { preview: PreviewRow[]; notFound: string[] }) {
  return (
    <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4 space-y-3">
      <p className="text-sm font-bold text-emerald-900 inline-flex items-center gap-2">
        <Users className="w-4 h-4" /> Preview — {preview.length} matched
      </p>
      <ul className="max-h-56 overflow-y-auto space-y-1.5 text-xs">
        {preview.map((row) => (
          <li key={row.phone} className="flex justify-between gap-2 bg-white/80 rounded-lg px-3 py-2">
            <span>
              {row.full_name || 'Customer'} · {row.phone} · {inr(row.amount)}
            </span>
            <span className="font-semibold text-emerald-800">
              {inr(row.current_balance)} → {inr(row.balance_after)}
            </span>
          </li>
        ))}
      </ul>
      {notFound.length ? <p className="text-xs text-amber-800">Not found: {notFound.join(', ')}</p> : null}
    </div>
  );
}

function ResultCard({ result }: { result: OpResult }) {
  return (
    <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4 space-y-3">
      <p className="text-sm font-bold text-blue-900 inline-flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" />
        Credited {result.credited_count}/{result.matched_count}
      </p>
      <p className="text-xs text-blue-800">
        {inr(result.total_credited)} added
        {result.push_delivered ? ` · ${result.push_delivered} push delivered` : ''}
      </p>
      <ul className="max-h-48 overflow-y-auto space-y-1 text-xs">
        {result.results.map((row) => (
          <li
            key={row.phone}
            className={`rounded-lg px-3 py-2 ${row.error ? 'bg-red-50 text-red-800' : 'bg-white/80 text-gray-800'}`}
          >
            {row.full_name || row.phone} · {inr(row.amount)}
            {row.error ? ` — ${row.error}` : ` → ${inr(row.balance_after)}`}
          </li>
        ))}
      </ul>
      {result.not_found_phones?.length ? (
        <p className="text-xs text-amber-800">Not found: {result.not_found_phones.join(', ')}</p>
      ) : null}
    </div>
  );
}
