'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Calendar, Loader2, RefreshCw, SwapHorizontal } from 'lucide-react';
import { CRM_DATE_PRESETS, resolveCrmDateRange, type CrmDatePreset } from '@/lib/telecaller/crmDateRange';

type Row = {
  id: string;
  transferred_at: string;
  customer_name: string;
  transferred_to: string;
  status_at_transfer: string;
  status_now: string;
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** View-only list of leads the telecaller transferred away (no detail drill-down). */
export default function TransferredLeadsPanel() {
  const [datePreset, setDatePreset] = useState<CrmDatePreset>('all_time');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Row[]>([]);

  const range = useMemo(
    () => resolveCrmDateRange(datePreset, customStart, customEnd),
    [customEnd, customStart, datePreset],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ outgoing: '1' });
      if (range.allTime) params.set('all_time', '1');
      else {
        params.set('from', range.startYmd);
        params.set('to', range.endYmd);
      }
      const res = await fetch(`/api/telecaller/crm/transfer?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [range.allTime, range.endYmd, range.startYmd]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Transferred Leads</h1>
            <p className="mt-1 text-sm text-slate-500">
              Leads you transferred — summary only (name &amp; status). Detail does not open from here.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Date</span>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as CrmDatePreset)}
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-sm font-semibold text-slate-800"
              >
                {CRM_DATE_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </label>
          {datePreset === 'custom' ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">From</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">To</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                />
              </label>
            </>
          ) : null}
          <p className="text-sm font-bold text-slate-500">{items.length} transfers · {range.label}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 py-16 text-center">
          <SwapHorizontal className="mx-auto mb-2 h-9 w-9 text-emerald-300" />
          <p className="font-bold text-emerald-900">No transferred leads in this range</p>
        </div>
      ) : (
        <ul className="divide-y divide-emerald-100 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 shadow-sm">
          {items.map((row) => (
            <li key={row.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base font-extrabold text-slate-900">{row.customer_name}</p>
                <time className="text-xs font-semibold text-slate-500">{fmtDateTime(row.transferred_at)}</time>
              </div>
              <p className="mt-1 text-sm text-slate-600">To: {row.transferred_to}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">At transfer</p>
                  <p className="font-bold text-slate-700">{row.status_at_transfer}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300" />
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Now</p>
                  <p className="font-bold text-emerald-700">{row.status_now}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}