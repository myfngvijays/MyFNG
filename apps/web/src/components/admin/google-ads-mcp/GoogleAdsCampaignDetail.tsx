'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';

function money(n: number | null | undefined, currency = 'INR') {
  if (n == null || Number.isNaN(Number(n))) return '—';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
}

function num(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: Number(n) % 1 ? 2 : 0 }).format(n);
}

function statusClass(status?: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'ENABLED') return 'bg-emerald-50 text-emerald-800';
  if (s === 'PAUSED') return 'bg-amber-50 text-amber-800';
  return 'bg-slate-100 text-slate-600';
}

function budgetLabel(campaign: any, currency: string) {
  const amount = Number(campaign?.budget || 0);
  if (!amount) return '—';
  return `${money(amount, currency)}${String(campaign?.budget_period || 'DAILY') === 'DAILY' ? '/day' : ''}`;
}

function prettyDate(value?: string) {
  const raw = String(value || '').slice(0, 10);
  if (!raw || raw.startsWith('2037') || raw === '1970-01-01') return '';
  const [y, m, d] = raw.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!y || !m || !d) return raw;
  return `${months[Number(m) - 1]} ${Number(d)}, ${y}`;
}

function rowTitle(row: any) {
  if (row?.name) return row.name;
  if (row?.text) return row.text;
  if (row?.headlines?.length) return row.headlines[0];
  return '—';
}

function CompactRows({
  title,
  rows,
  currency,
}: {
  title: string;
  rows: any[];
  currency: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-extrabold text-slate-900">
          {title} <span className="font-semibold text-slate-400">· {rows.length}</span>
        </h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">Is range me kuch nahi mila.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <div key={[row.id, row.text, i].filter(Boolean).join('::')} className="grid gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] sm:items-center">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{rowTitle(row)}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-400">
                  {[row.status, row.match, row.type, row.ad_group].filter(Boolean).join(' · ')}
                </p>
              </div>
              <p className="text-sm tabular-nums text-slate-700">
                <span className="mr-1 text-[10px] font-bold uppercase text-slate-400 sm:hidden">Cost</span>
                {money(row.spend, currency)}
              </p>
              <p className="text-sm tabular-nums text-slate-700">
                <span className="mr-1 text-[10px] font-bold uppercase text-slate-400 sm:hidden">Clicks</span>
                {num(row.clicks)}
              </p>
              <p className="text-sm tabular-nums text-slate-700">
                <span className="mr-1 text-[10px] font-bold uppercase text-slate-400 sm:hidden">CTR</span>
                {row.ctr != null ? `${Number(row.ctr).toFixed(2)}%` : '—'}
              </p>
              <p className="text-sm tabular-nums text-slate-700">
                <span className="mr-1 text-[10px] font-bold uppercase text-slate-400 sm:hidden">Results</span>
                {num(row.conversions)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function GoogleAdsCampaignDetail({
  detail,
  loading,
  error,
  currency = 'INR',
  onClose,
}: {
  detail: any;
  loading?: boolean;
  error?: string | null;
  currency?: string;
  onClose: () => void;
}) {
  const campaign = detail?.campaign || {};
  const daily: any[] = Array.isArray(detail?.daily) ? detail.daily : [];
  const maxSpend = Math.max(1, ...daily.map((d) => Number(d.spend || 0)));
  const isApp = /MULTI_CHANNEL|APP/i.test(String(campaign.channel || ''));
  const dateLabel = [prettyDate(campaign.start_date), prettyDate(campaign.end_date)].filter(Boolean).join(' → ') || '—';

  const kpis: [string, string | number][] = [
    ['Budget', budgetLabel(campaign, currency)],
    ['Cost', money(campaign.spend, currency)],
    ['Clicks', num(campaign.clicks)],
    ['Impr.', num(campaign.impressions)],
    ['Results', num(campaign.conversions)],
    ['CTR', campaign.ctr != null ? `${Number(campaign.ctr).toFixed(2)}%` : '—'],
    ['Avg. CPC', campaign.cpc != null ? money(campaign.cpc, currency) : '—'],
    isApp
      ? ['Cost / install', campaign.cpi != null ? money(campaign.cpi, currency) : '—']
      : ['Cost / conv.', campaign.cpl != null ? money(campaign.cpl, currency) : '—'],
  ];

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#004AAD]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to campaigns
      </button>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">{campaign.name || (loading ? 'Loading…' : 'Campaign')}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[campaign.status, campaign.channel, campaign.bidding, campaign.serving].filter(Boolean).map((tag) => (
                <span
                  key={String(tag)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    tag === campaign.status ? statusClass(campaign.status) : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {String(tag).replace(/_/g, ' ')}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Dates · {dateLabel}</p>
          </div>
        </div>

        {loading && (
          <div className="mt-4 flex items-center text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading campaign…
          </div>
        )}
        {error ? <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p> : null}

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-1 text-lg font-extrabold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-bold text-slate-800">Daily spend</p>
          {daily.length ? (
            <>
              <div className="flex h-36 items-end gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                {daily.map((day: any) => (
                  <div key={day.date} className="relative h-full min-w-0 flex-1">
                    <div
                      className="absolute bottom-0 inset-x-0.5 rounded-t bg-[#004AAD]"
                      style={{ height: `${Math.max(8, (Number(day.spend || 0) / maxSpend) * 100)}%` }}
                      title={`${day.date}: ${money(day.spend, currency)}`}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {daily[0]?.date} → {daily[daily.length - 1]?.date}
              </p>
            </>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
              Is date range me daily series nahi mili.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-extrabold text-slate-900">
            Conversions in this range <span className="font-semibold text-slate-400">· {(detail?.conversions || []).length}</span>
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Results column unhi actions ko count karti hai jo Google Ads me “Include in Conversions” pe hain.
          </p>
        </div>
        {(detail?.conversions || []).length ? (
          <div className="divide-y divide-slate-100">
            {detail.conversions.map((row: any, i: number) => (
              <div key={row.name || i} className="grid gap-2 px-5 py-3 sm:grid-cols-4 sm:items-center">
                <div className="sm:col-span-2">
                  <p className="font-semibold text-slate-900">{row.name || '—'}</p>
                  <p className="text-[11px] text-slate-400">{String(row.category || '').replace(/_/g, ' ') || '—'}</p>
                </div>
                <p className="text-sm text-slate-700">Results {row.conversions || 0}</p>
                <p className="text-sm text-slate-700">All {row.all_conversions || 0}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-slate-500">Is campaign / date range me koi conversion event nahi aaya.</p>
        )}
      </section>

      <CompactRows title="Ad groups" rows={detail?.ad_groups || []} currency={currency} />
      <CompactRows title="Ads" rows={detail?.ads || []} currency={currency} />
      <CompactRows title="Keywords" rows={detail?.keywords || []} currency={currency} />
      <CompactRows title="Search terms" rows={detail?.search_terms || []} currency={currency} />
    </div>
  );
}
