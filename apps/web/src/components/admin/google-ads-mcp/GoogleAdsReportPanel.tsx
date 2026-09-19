'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, FileText, Loader2, Printer, RefreshCw } from 'lucide-react';

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
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
}

function downloadText(report: any) {
  const blob = new Blob([report?.markdown || ''], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `myfng-google-ads-${report?.campaign_id || report?.period || 'report'}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function printPdf(report: any, currency: string) {
  const m = report?.metrics || {};
  const table = (title: string, headers: string[], rows: string[][]) =>
    `<h2>${esc(title)}</h2><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
      rows.length
        ? rows.map((r, i) => `<tr class="${i % 2 ? 'alt' : ''}">${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${headers.length}">No rows</td></tr>`
    }</tbody></table>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(report?.title)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; color: #0f172a; padding: 12px 16px; }
    h1 { color: #004AAD; font-size: 20px; margin: 0 0 4px; }
    .sub { color: #64748b; font-size: 12px; margin: 0 0 16px; }
    .kpis { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; min-width: 120px; }
    .kpi b { display: block; font-size: 16px; }
    .kpi span { font-size: 10px; color: #64748b; text-transform: uppercase; }
    h2 { font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: #334155; margin: 18px 0 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #004AAD; color: #fff; text-align: left; padding: 6px 7px; }
    td { padding: 5px 7px; border-bottom: 1px solid #e2e8f0; }
    tr.alt td { background: #f8fafc; }
    ul { margin: 0; padding-left: 18px; font-size: 12px; }
    .foot { margin-top: 20px; font-size: 10px; color: #94a3b8; }
  </style></head><body>
  <h1>MyFNG · Google Ads</h1>
  <p class="sub">${esc(report?.title)} · ${esc(report?.account?.name)} · ${esc(report?.account?.id)} · ${esc(
    new Date(report?.generated_at || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
  )} IST</p>
  <div class="kpis">
    ${[
      ['Spend', money(m.spend, currency)],
      ['Clicks', num(m.clicks)],
      ['Results', num(m.conversions)],
      ['CTR', m.ctr != null ? `${m.ctr}%` : '—'],
      ['CPL', money(m.cpl, currency)],
    ]
      .map(([l, v]) => `<div class="kpi"><span>${esc(l)}</span><b>${esc(v)}</b></div>`)
      .join('')}
  </div>
  <h2>Insights</h2>
  <ul>${(report?.insights?.lines || []).map((line: string) => `<li>${esc(line)}</li>`).join('')}</ul>
  ${
    report?.campaign
      ? table(
          'Campaign',
          ['Campaign', 'Status', 'Spend', 'Clicks', 'Results', 'CPL'],
          [[report.campaign.name, report.campaign.status, money(report.campaign.spend, currency), num(report.campaign.clicks), num(report.campaign.conversions), money(report.campaign.cpl, currency)]],
        )
      : table(
          'Live campaigns',
          ['Campaign', 'Status', 'Spend', 'Clicks', 'Results', 'CPL'],
          (report?.campaigns || []).map((c: any) => [c.name, c.status, money(c.spend, currency), num(c.clicks), num(c.conversions), money(c.cpl, currency)]),
        )
  }
  ${table(
    'Ad groups',
    ['Ad group', 'Campaign', 'Spend', 'Results'],
    (report?.ad_groups || []).map((g: any) => [g.name, g.campaign || '', money(g.spend, currency), num(g.conversions)]),
  )}
  ${table(
    'Ads',
    ['Ad', 'Spend', 'Clicks', 'Results'],
    (report?.ads || []).map((a: any) => [a.name, money(a.spend, currency), num(a.clicks), num(a.conversions)]),
  )}
  ${table(
    'Conversions fired',
    ['Action', 'Results', 'All conv.', 'In Results'],
    (report?.conversions || []).map((c: any) => [c.name, num(c.conversions), num(c.all_conversions), c.in_results ? 'Yes' : 'No']),
  )}
  ${table(
    'Keywords',
    ['Keyword', 'Match', 'Spend', 'Clicks'],
    (report?.keywords || []).map((k: any) => [k.text, k.match, money(k.spend, currency), num(k.clicks)]),
  )}
  ${table(
    'Search terms',
    ['Term', 'Clicks', 'Spend', 'Results'],
    (report?.search_terms || []).map((t: any) => [t.text, num(t.clicks), money(t.spend, currency), num(t.conversions)]),
  )}
  <p class="foot">Read-only Google Ads API · Print dialog se Save as PDF choose karo. Paused campaigns excluded.</p>
  </body></html>`;
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 2000);
  }, 400);
}

function MiniTable({
  title,
  rows,
  columns,
  onRowClick,
}: {
  title: string;
  rows: any[];
  columns: { key: string; label: string; render?: (row: any) => ReactNode }[];
  onRowClick?: (row: any) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-extrabold text-slate-900">
          {title} <span className="font-semibold text-slate-400">· {rows.length}</span>
        </h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">No live rows in this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-2.5">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.id || row.text || row.name || i}
                  className={`border-t border-slate-100 ${onRowClick ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-2.5 text-slate-700">
                      {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function GoogleAdsReportPanel({
  report,
  busy,
  ready,
  onGenerate,
}: {
  report: any;
  busy?: boolean;
  ready?: boolean;
  onGenerate: (period: string, campaignId?: string) => void;
}) {
  const currency = report?.currency || 'INR';
  const m = report?.metrics || {};
  const daily: any[] = report?.daily || [];
  const maxSpend = Math.max(1, ...daily.map((d) => Number(d.spend || 0)));
  const selectedId = String(report?.campaign_id || '');
  const campaigns: any[] = report?.campaigns || [];
  const period = report?.period || 'last_7d';

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { id: 'today', label: 'Today', hint: 'Aaj ka snapshot' },
          { id: 'last_7d', label: 'Last 7 days', hint: 'Week vs week' },
          { id: 'last_30d', label: 'Last 30 days', hint: 'Month view' },
          { id: 'briefing', label: 'Full briefing', hint: 'Deep + insights' },
          { id: 'custom', label: 'Selected dates', hint: 'Header date picker' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={busy || !ready}
            onClick={() => onGenerate(item.id, selectedId || undefined)}
            className={`rounded-2xl border bg-white p-4 text-left shadow-sm hover:border-blue-200 disabled:opacity-50 ${
              report?.period === item.id ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <p className="font-extrabold text-slate-900">{item.label}</p>
            <p className="mt-1 text-xs text-slate-500">{item.hint}</p>
          </button>
        ))}
      </div>

      {campaigns.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-extrabold text-slate-900">Campaign report</p>
              <p className="text-xs text-slate-500">Ek campaign kholo — paused / band campaigns hide hain.</p>
            </div>
            {selectedId ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onGenerate(period, '')}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#004AAD]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> All enabled
              </button>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => onGenerate(period, '')}
              className={`rounded-xl border p-3 text-left ${
                !selectedId ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-200'
              }`}
            >
              <p className="text-sm font-extrabold text-slate-900">All enabled</p>
              <p className="mt-1 text-xs text-slate-500">
                {campaigns.length} live · {money(
                  campaigns.reduce((sum, c) => sum + Number(c.spend || 0), 0),
                  currency,
                )}
              </p>
            </button>
            {campaigns.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busy}
                onClick={() => onGenerate(period, c.id)}
                className={`rounded-xl border p-3 text-left ${
                  selectedId === String(c.id) ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-200'
                }`}
              >
                <p className="truncate text-sm font-extrabold text-slate-900">{c.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {money(c.spend, currency)} · {num(c.conversions)} results
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {busy && (
        <div className="flex items-center text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {selectedId ? 'Campaign report bana raha hoon…' : 'Deep report bana raha hoon…'}
        </div>
      )}

      {report && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">{report.label || report.title}</h2>
              <p className="text-xs text-slate-500">
                {report.account?.name} · {report.account?.id} · Enabled only
                {report.generated_at
                  ? ` · ${new Date(report.generated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadText(report)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
              >
                <FileText className="h-3.5 w-3.5" /> Export text
              </button>
              <button
                type="button"
                onClick={() => printPdf(report, currency)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#004AAD] px-3 py-2 text-xs font-bold text-white"
              >
                <Printer className="h-3.5 w-3.5" /> Export PDF
              </button>
              <button
                type="button"
                onClick={() => onGenerate(period, selectedId || undefined)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Spend', money(m.spend, currency)],
              ['Clicks', num(m.clicks)],
              ['Results', num(m.conversions)],
              ['CTR', m.ctr != null ? `${m.ctr}%` : '—'],
              ['CPL', money(m.cpl, currency)],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[11px] font-bold uppercase text-slate-400">{label}</p>
                <p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          {daily.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-800">Daily spend</p>
              <div className="mt-3 flex h-28 items-end gap-1">
                {daily.map((day) => (
                  <div key={day.date} className="relative h-full min-w-0 flex-1" title={`${day.date}: ${money(day.spend, currency)}`}>
                    <div
                      className="absolute bottom-0 inset-x-0.5 rounded-t bg-[#004AAD]"
                      style={{ height: `${Math.max(6, (Number(day.spend || 0) / maxSpend) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.insights?.lines?.length ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
              <p className="text-sm font-extrabold text-[#004AAD]">Insights</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
                {report.insights.lines.map((line: string) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {!selectedId && (
            <MiniTable
              title="Live campaigns — click to open"
              rows={campaigns}
              onRowClick={(row) => onGenerate(period, row.id)}
              columns={[
                { key: 'name', label: 'Campaign', render: (r) => <span className="font-semibold text-[#004AAD]">{r.name}</span> },
                { key: 'status', label: 'Status' },
                { key: 'spend', label: 'Spend', render: (r) => money(r.spend, currency) },
                { key: 'clicks', label: 'Clicks', render: (r) => num(r.clicks) },
                { key: 'conversions', label: 'Results', render: (r) => num(r.conversions) },
                { key: 'cpl', label: 'CPL', render: (r) => money(r.cpl, currency) },
              ]}
            />
          )}
          <MiniTable
            title={selectedId ? 'Ad groups in this campaign' : 'Ad groups (live spend)'}
            rows={report.ad_groups || []}
            columns={[
              { key: 'name', label: 'Ad group', render: (r) => <span className="font-semibold">{r.name}</span> },
              { key: 'campaign', label: 'Campaign' },
              { key: 'spend', label: 'Spend', render: (r) => money(r.spend, currency) },
              { key: 'conversions', label: 'Results', render: (r) => num(r.conversions) },
            ]}
          />
          <MiniTable
            title={selectedId ? 'Ads in this campaign' : 'Ads (live spend)'}
            rows={report.ads || []}
            columns={[
              { key: 'name', label: 'Ad', render: (r) => <span className="font-semibold">{r.name}</span> },
              { key: 'spend', label: 'Spend', render: (r) => money(r.spend, currency) },
              { key: 'clicks', label: 'Clicks', render: (r) => num(r.clicks) },
              { key: 'conversions', label: 'Results', render: (r) => num(r.conversions) },
            ]}
          />
          <MiniTable
            title="Conversions fired"
            rows={report.conversions || []}
            columns={[
              { key: 'name', label: 'Action' },
              { key: 'conversions', label: 'Results', render: (r) => num(r.conversions) },
              { key: 'all_conversions', label: 'All conv.', render: (r) => num(r.all_conversions) },
              { key: 'in_results', label: 'In Results', render: (r) => (r.in_results ? 'Yes' : 'No') },
            ]}
          />
          <MiniTable
            title="Keywords"
            rows={report.keywords || []}
            columns={[
              { key: 'text', label: 'Keyword' },
              { key: 'match', label: 'Match' },
              { key: 'spend', label: 'Spend', render: (r) => money(r.spend, currency) },
              { key: 'clicks', label: 'Clicks', render: (r) => num(r.clicks) },
            ]}
          />
          <MiniTable
            title="Search terms"
            rows={report.search_terms || []}
            columns={[
              { key: 'text', label: 'Term' },
              { key: 'clicks', label: 'Clicks', render: (r) => num(r.clicks) },
              { key: 'spend', label: 'Spend', render: (r) => money(r.spend, currency) },
              { key: 'conversions', label: 'Results', render: (r) => num(r.conversions) },
            ]}
          />
        </>
      )}
    </div>
  );
}
