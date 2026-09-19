'use client';

import { resolveAdsColumns, type AdsColumn } from '@/lib/google-ads/columns';

type Row = Record<string, any>;

function money(n: number | null | undefined, currency = 'INR') {
  if (n == null || Number.isNaN(Number(n))) return '—';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
}

function num(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(n);
}

function statusClass(status?: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'ENABLED') return 'bg-emerald-50 text-emerald-800';
  if (s === 'PAUSED') return 'bg-amber-50 text-amber-800';
  if (s === 'REMOVED') return 'bg-slate-100 text-slate-500';
  return 'bg-slate-100 text-slate-600';
}

function rowValue(row: Row, key: string) {
  if (key === 'name') return row.name || row.text || '—';
  if (key === 'channel') return [row.channel, row.match, row.type].filter(Boolean).join(' · ') || '—';
  return row[key];
}

function formatCell(col: AdsColumn, value: any, currency: string, row?: Row) {
  if (col.key === 'budget' && row) {
    const amount = Number(row.budget || 0);
    if (!amount) return '—';
    const period = String(row.budget_period || 'DAILY');
    return `${money(amount, currency)}${period === 'DAILY' ? '/day' : ''}`;
  }
  if (col.fmt === 'status') {
    if (!value) return '—';
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass(String(value))}`}>
        {String(value)}
      </span>
    );
  }
  if (col.fmt === 'money') return money(value, currency);
  if (col.fmt === 'pct') return value != null && !Number.isNaN(Number(value)) ? `${Number(value).toFixed(2)}%` : '—';
  if (col.fmt === 'score') return value != null && !Number.isNaN(Number(value)) ? `${Number(value).toFixed(1)}%` : '—';
  if (col.fmt === 'num') return num(value, Number(value) % 1 ? 2 : 0);
  return value != null && String(value).trim() ? String(value) : '—';
}

function derivedTotals(rows: Row[]): Row {
  const spend = rows.reduce((s, r) => s + Number(r.spend || 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks || 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions || 0), 0);
  const conversions = rows.reduce((s, r) => s + Number(r.conversions || 0), 0);
  const conversionValue = rows.reduce((s, r) => s + Number(r.conversion_value || 0), 0);
  const scores = rows.map((r) => Number(r.opt_score)).filter((n) => !Number.isNaN(n) && n > 0);
  return {
    name: `Total · ${rows.length}`,
    spend,
    clicks,
    impressions,
    conversions,
    conversion_value: conversionValue,
    all_conversions: rows.reduce((s, r) => s + Number(r.all_conversions || 0), 0),
    view_through: rows.reduce((s, r) => s + Number(r.view_through || 0), 0),
    interactions: rows.reduce((s, r) => s + Number(r.interactions || 0), 0),
    video_views: rows.reduce((s, r) => s + Number(r.video_views || 0), 0),
    budget: rows.reduce((s, r) => s + Number(r.budget || 0), 0),
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
    cpl: conversions > 0 ? spend / conversions : null,
    cpi: conversions > 0 ? spend / conversions : null,
    cpia: conversions > 0 ? spend / conversions : null,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
    roas: spend > 0 && conversionValue > 0 ? conversionValue / spend : null,
    opt_score: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
  };
}

const FALLBACK_KEYS = ['name', 'status', 'spend', 'clicks', 'conversions'];

export default function GoogleAdsTable({
  rows,
  currency = 'INR',
  sort,
  onSort,
  columnKeys,
  onRowClick,
  selectedId,
}: {
  rows: Row[];
  currency?: string;
  sort?: string;
  onSort?: (key: string) => void;
  columnKeys?: string[];
  onRowClick?: (row: Row) => void;
  selectedId?: string | null;
}) {
  const cols = resolveAdsColumns(columnKeys?.length ? columnKeys : FALLBACK_KEYS);
  const totals = derivedTotals(rows);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {cols.map((col) => {
              const align = col.fmt === 'text' || col.fmt === 'status' ? 'left' : 'right';
              const sortKey = col.sort || (col.fmt !== 'text' && col.fmt !== 'status' ? col.key : undefined);
              return (
                <th
                  key={col.key}
                  className={`sticky top-0 px-3 py-2.5 ${align === 'right' ? 'text-right' : 'text-left'} ${
                    col.sticky ? 'sticky left-0 z-10 min-w-[220px] bg-slate-50' : 'whitespace-nowrap'
                  }`}
                >
                  {sortKey && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(sortKey)}
                      className={`inline-flex items-center gap-1 ${sort === sortKey ? 'text-[#004AAD]' : ''}`}
                    >
                      {col.label}
                      {sort === sortKey ? ' ↓' : ''}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={[row.id, row.text, row.match, row.campaign, index].filter(Boolean).join('::')}
              className={`border-b border-slate-100 hover:bg-slate-50/80 ${onRowClick && row.id ? 'cursor-pointer' : ''} ${
                selectedId && row.id === selectedId ? 'bg-blue-50/80' : ''
              }`}
              onClick={() => {
                if (onRowClick && row.id) onRowClick(row);
              }}
            >
              {cols.map((col) => {
                const align = col.fmt === 'text' || col.fmt === 'status' ? 'left' : 'right';
                if (col.key === 'name') {
                  return (
                    <td key={col.key} className={`sticky left-0 z-10 px-3 py-3 align-top ${selectedId && row.id === selectedId ? 'bg-blue-50' : 'bg-white'}`}>
                      <p className={`font-semibold ${onRowClick && row.id ? 'text-[#004AAD]' : 'text-slate-900'}`}>
                        {row.name || row.text || '—'}
                      </p>
                      {row.headlines?.length ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{row.headlines.join(' · ')}</p>
                      ) : null}
                      {row.campaign || row.ad_group ? (
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {[row.campaign, row.ad_group].filter(Boolean).join(' / ')}
                        </p>
                      ) : null}
                    </td>
                  );
                }
                return (
                  <td
                    key={col.key}
                    className={`px-3 py-3 align-top ${align === 'right' ? 'text-right tabular-nums' : ''} ${
                      col.key === 'spend' ? 'font-semibold text-slate-900' : 'text-slate-700'
                    }`}
                  >
                    {formatCell(col, rowValue(row, col.key), currency, row)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 text-sm font-bold text-slate-800">
            {cols.map((col) => {
              const align = col.fmt === 'text' || col.fmt === 'status' ? 'left' : 'right';
              const skip = col.fmt === 'status' || (col.fmt === 'text' && col.key !== 'name');
              return (
                <td
                  key={col.key}
                  className={`px-3 py-2.5 ${align === 'right' ? 'text-right tabular-nums' : ''} ${
                    col.sticky ? 'sticky left-0 bg-slate-50' : ''
                  }`}
                >
                  {skip ? '' : formatCell(col, rowValue(totals, col.key), currency)}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
