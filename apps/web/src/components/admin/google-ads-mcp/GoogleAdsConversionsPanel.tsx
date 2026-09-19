'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

function pretty(value?: string) {
  return String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${currency} ${Math.round(n || 0)}`;
  }
}

function num(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);
}

type ConvRow = {
  id?: string;
  name?: string;
  category?: string;
  type?: string;
  counting?: string;
  status?: string;
  in_results?: boolean;
  conversions?: number;
  all_conversions?: number;
  conversion_value?: number;
};

export default function GoogleAdsConversionsPanel({
  report,
  loading,
  currency = 'INR',
  rangeLabel,
}: {
  report: any;
  loading?: boolean;
  currency?: string;
  rangeLabel: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const actions: ConvRow[] = report?.actions || [];
  const fired: ConvRow[] = report?.fired || actions.filter((r) => Number(r.conversions || 0) + Number(r.all_conversions || 0) > 0);
  const rows = showAll ? actions : fired;
  const totals = report?.totals || {
    conversions: fired.reduce((s, r) => s + Number(r.conversions || 0), 0),
    all_conversions: fired.reduce((s, r) => s + Number(r.all_conversions || 0), 0),
    conversion_value: fired.reduce((s, r) => s + Number(r.conversion_value || 0), 0),
  };
  const hidden = Math.max(0, actions.length - fired.length);
  const kpis = useMemo(
    () => [
      ['Results', num(totals.conversions || 0), 'Include in Conversions'],
      ['All conv.', num(totals.all_conversions || 0), 'Primary + secondary'],
      ['Value', money(totals.conversion_value || 0, currency), 'Conversion value'],
    ],
    [totals, currency],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {kpis.map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Conversion actions</h2>
            <p className="mt-1 text-xs text-slate-500">
              {rangeLabel}. Results unhi actions ka count hai jinke liye “Include in Conversions” on hai.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
          >
            {showAll ? 'Only with conversions' : `Show all configured${hidden ? ` (${hidden} zeros)` : ''}`}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center px-5 py-8 text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading conversions…
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            {showAll ? 'Koi conversion action configured nahi hai.' : 'Is date range me koi conversion event nahi aaya.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Conversion action</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3 text-right">Results</th>
                  <th className="px-3 py-3 text-right">All conv.</th>
                  <th className="px-3 py-3 text-right">Value</th>
                  <th className="px-5 py-3">In Results?</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id || row.name} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-3 align-top">
                      <p className="font-semibold text-slate-900">{row.name || '—'}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {[pretty(row.type), pretty(row.counting), pretty(row.status)].filter(Boolean).join(' · ')}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top text-slate-600">{pretty(row.category) || '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-900">{num(row.conversions || 0)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">{num(row.all_conversions || 0)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">{money(row.conversion_value || 0, currency)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          row.in_results ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {row.in_results ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
