'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Download, Loader2, Printer, Search } from 'lucide-react';
import {
  BREAKDOWN_API,
  META_DATE_PRESETS,
  campaignStatusBucket,
  downloadReportCsv,
  downloadReportExcel,
  filterReport,
  flattenReportSheets,
  mapBreakdownRows,
  money,
  num,
  pct,
  printReportHtml,
  totalsFromRows,
} from '@/lib/meta-ads/reportView';

type TabId = string;
type StatusFilter = 'active' | 'paused' | 'inactive' | 'all';
type SortDir = 'desc' | 'asc';
type ListMode = 'active' | 'inactive';

const TAB_ORDER = [
  'Summary',
  'Campaigns',
  'Ad sets',
  'Ads',
  'Placement',
  'Platform',
  'Age',
  'Gender',
  'Country',
  'Device',
  'Time of day',
  'Platform + device',
  'Billing',
];

const NESTED = new Set(Object.keys(BREAKDOWN_API));
const MONEY = new Set(['spend', 'cpr', 'cpl', 'cpc', 'cpm']);
const PCT = new Set(['ctr']);
const COUNT = new Set(['results', 'leads', 'messaging', 'clicks', 'impressions', 'reach']);
const NUMERIC = new Set([...MONEY, ...PCT, ...COUNT]);

function formatCell(key: string, value: unknown, currency: string) {
  if (value == null || value === '') return '—';
  if (MONEY.has(key)) return money(value, currency);
  if (PCT.has(key)) return pct(value);
  if (COUNT.has(key)) return num(value);
  return String(value);
}

function statusTone(value: unknown) {
  const bucket = campaignStatusBucket(value);
  if (bucket === 'active') return 'bg-emerald-50 text-emerald-700';
  if (bucket === 'paused') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

function statusLabelShort(value: unknown) {
  const bucket = campaignStatusBucket(value);
  if (bucket === 'active') return 'Active';
  if (bucket === 'paused') return 'Paused';
  return 'Inactive';
}

function dimLabel(tab: string, row: Record<string, unknown>) {
  if (tab === 'Placement') return [row.platform, row.position].filter(Boolean).join(' · ') || 'Placement';
  if (tab === 'Platform') return String(row.platform || 'Platform');
  if (tab === 'Age') return String(row.age || 'Age');
  if (tab === 'Gender') return String(row.gender || 'Gender');
  if (tab === 'Country') return String(row.country || 'Country');
  if (tab === 'Device') return String(row.device || 'Device');
  if (tab === 'Time of day') return String(row.hour || 'Hour');
  if (tab === 'Platform + device') return String(row.device_platform || 'Device');
  return String(row.campaign || row.name || '—');
}

function sortRows(list: Record<string, unknown>[], sortKey: string, sortDir: SortDir) {
  return [...list].sort((a, b) => {
    const cmp = NUMERIC.has(sortKey)
      ? Number(a[sortKey] || 0) - Number(b[sortKey] || 0)
      : String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''), 'en', { sensitivity: 'base' });
    return sortDir === 'desc' ? -cmp : cmp;
  });
}

function CampaignPicker({
  campaigns,
  value,
  onChange,
}: {
  campaigns: any[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ListMode>('active');
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = campaigns.find((c) => String(c.id) === value);
  const activeCount = campaigns.filter((c) => campaignStatusBucket(c.effective_status || c.status) === 'active').length;
  const inactiveCount = campaigns.length - activeCount;
  const filtered = campaigns.filter((c) => {
    const bucket = campaignStatusBucket(c.effective_status || c.status);
    const ok = mode === 'active' ? bucket === 'active' : bucket !== 'active';
    if (!ok) return false;
    const hay = `${c.name} ${c.id}`.toLowerCase();
    return !q.trim() || hay.includes(q.trim().toLowerCase());
  });

  useEffect(() => {
    if (!open || value === 'all') return;
    const campaign = campaigns.find((c) => String(c.id) === value);
    if (!campaign) return;
    const bucket = campaignStatusBucket(campaign.effective_status || campaign.status);
    setMode(bucket === 'active' ? 'active' : 'inactive');
  }, [open, value, campaigns]);

  return (
    <div ref={box} className="relative ml-auto w-full max-w-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left text-xs text-slate-700"
      >
        <span className="truncate">
          {value === 'all' ? 'All campaigns' : selected?.name || 'Campaign'}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-1 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex gap-2 border-b border-slate-100 p-2">
            <button
              type="button"
              onClick={() => setMode('active')}
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${mode === 'active' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Active {activeCount}
            </button>
            <button
              type="button"
              onClick={() => setMode('inactive')}
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${mode === 'inactive' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Inactive {inactiveCount}
            </button>
          </div>
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search campaign…"
              className="w-full text-xs outline-none"
            />
          </div>
          <div className="max-h-[min(16rem,50vh)] overflow-y-auto overscroll-contain">
            <button
              type="button"
              onClick={() => {
                onChange('all');
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50"
            >
              All campaigns
            </button>
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(String(c.id));
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-xs hover:bg-blue-50 ${value === String(c.id) ? 'bg-blue-50 font-semibold' : ''}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate">{c.name}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusTone(c.effective_status || c.status)}`}>
                    {statusLabelShort(c.effective_status || c.status)}
                  </span>
                </span>
              </button>
            ))}
            {!filtered.length ? <p className="px-3 py-4 text-xs text-slate-400">No campaigns.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Cell({
  col,
  row,
  i,
  currency,
  indent = 0,
}: {
  col: { key: string };
  row: Record<string, unknown>;
  i: number;
  currency: string;
  indent?: number;
}) {
  return (
    <td
      className={`whitespace-nowrap border-b border-slate-100 px-3 py-2 text-slate-800 ${
        i === 0 ? 'sticky left-0 z-[1] font-semibold bg-inherit' : ''
      } ${NUMERIC.has(col.key) ? 'text-right tabular-nums' : ''}`}
      style={i === 0 && indent ? { paddingLeft: 12 + indent * 16 } : undefined}
    >
      {col.key === 'status' ? (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(row[col.key])}`}>
          {formatCell(col.key, row[col.key], currency)}
        </span>
      ) : (
        formatCell(col.key, row[col.key], currency)
      )}
    </td>
  );
}

export default function MetaAdsReportPanel({
  report,
  copied,
  onCopy,
  onGenerate,
  busy,
}: {
  report: any;
  copied?: string;
  onCopy: (text: string) => void;
  onGenerate?: (query: { date_preset?: string; since?: string; until?: string; period?: string }) => void;
  busy?: boolean;
}) {
  const currency = report?.account?.currency || 'INR';
  const [tab, setTab] = useState<TabId>('Campaigns');
  const [campaignId, setCampaignId] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [sortKey, setSortKey] = useState('spend');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [printHint, setPrintHint] = useState('');
  const [datesOpen, setDatesOpen] = useState(false);
  const [since, setSince] = useState(String(report?.since || ''));
  const [until, setUntil] = useState(String(report?.until || ''));
  const [openCampaigns, setOpenCampaigns] = useState<Record<string, boolean>>({});
  const [openAdsets, setOpenAdsets] = useState<Record<string, boolean>>({});
  const [childCache, setChildCache] = useState<Record<string, { adsets: any[]; ads: any[]; loading?: boolean; error?: string }>>({});

  const scoped = useMemo(() => filterReport(report, { campaignId, status }), [report, campaignId, status]);
  const sheets = useMemo(() => flattenReportSheets(scoped).filter((s) => s.name !== '_meta'), [scoped]);
  const available = TAB_ORDER.filter((id) => sheets.some((s) => s.name === id));
  const sheet = sheets.find((s) => s.name === tab) || sheets.find((s) => s.name === 'Campaigns') || sheets[0];
  const allCampaigns: any[] = Array.isArray(report?.campaigns) ? report.campaigns : [];
  const visibleCampaigns = scoped.campaigns || [];

  const rows = useMemo(() => sortRows(sheet?.rows || [], sortKey, sortDir), [sheet, sortKey, sortDir]);
  const totals = useMemo(() => totalsFromRows(rows), [rows]);
  const grouped = useMemo(() => {
    if (!NESTED.has(tab)) return [];
    const map = new Map<string, { id: string; name: string; rows: Record<string, unknown>[] }>();
    for (const row of rows) {
      const id = String(row.campaign_id || 'unknown');
      const name = String(row.campaign || visibleCampaigns.find((c: any) => String(c.id) === id)?.name || id);
      if (!map.has(id)) map.set(id, { id, name, rows: [] });
      map.get(id)!.rows.push(row);
    }
    return [...map.values()].sort((a, b) => Number(totalsFromRows(b.rows).spend) - Number(totalsFromRows(a.rows).spend));
  }, [rows, tab, visibleCampaigns]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir(NUMERIC.has(key) ? 'desc' : 'asc');
    }
  };

  const loadChildren = async (id: string) => {
    const key = `${tab}:${id}`;
    const existing = childCache[key];
    if (existing?.loading || (existing && !existing.error)) return;
    setChildCache((prev) => ({ ...prev, [key]: { adsets: [], ads: [], loading: true } }));
    try {
      const res = await fetch('/api/super_admin/meta-ads-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'insights_breakdown',
          object_id: id,
          breakdowns: BREAKDOWN_API[tab],
          date_preset: report.date_preset,
          since: report.since,
          until: report.until,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Breakdown failed');
      setChildCache((prev) => ({
        ...prev,
        [key]: {
          adsets: mapBreakdownRows(tab, json.adsets || []),
          ads: mapBreakdownRows(tab, json.ads || []),
          loading: false,
          error: json.error || '',
        },
      }));
    } catch (e: any) {
      setChildCache((prev) => ({
        ...prev,
        [key]: { adsets: [], ads: [], loading: false, error: e?.message || 'Failed' },
      }));
    }
  };

  const toggleCampaign = (id: string) => {
    const next = !openCampaigns[id];
    setOpenCampaigns((prev) => ({ ...prev, [id]: next }));
    if (next && NESTED.has(tab)) void loadChildren(id);
  };

  const exportReport = (kind: 'xlsx' | 'csv' | 'print') => {
    if (kind === 'xlsx') {
      void downloadReportExcel(scoped).catch((e) => setPrintHint(e?.message || 'Excel fail'));
      return;
    }
    if (kind === 'csv') {
      downloadReportCsv(scoped);
      return;
    }
    const ok = printReportHtml(scoped);
    setPrintHint(ok ? 'Print dialog open — Save as PDF choose karo.' : 'Print block ho gaya.');
  };

  if (!sheet) {
    return <p className="px-4 py-8 text-center text-sm text-slate-500">Report empty hai.</p>;
  }

  const renderMetricCells = (row: Record<string, unknown>, indent = 0, extraFirst?: ReactNode) =>
    sheet.columns.map((col, i) =>
      i === 0 && extraFirst ? (
        <td
          key={col.key}
          className="sticky left-0 z-[1] whitespace-nowrap border-b border-slate-100 bg-inherit px-3 py-2 font-semibold"
          style={{ paddingLeft: 12 + indent * 16 }}
        >
          {extraFirst}
        </td>
      ) : (
        <Cell key={col.key} col={col} row={row} i={i} currency={currency} indent={indent} />
      ),
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{scoped.title}</p>
          <p className="text-[11px] text-slate-500">
            {report.account?.name} · {report.range_label || report.date_preset || report.period} · {visibleCampaigns.length} campaigns
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onGenerate ? (
            <div className="relative">
              <button type="button" onClick={() => setDatesOpen((v) => !v)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {report.range_label || 'Date'} ▾
              </button>
              {datesOpen ? (
                <div className="absolute right-0 z-30 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                  <div className="grid grid-cols-2 gap-1">
                    {META_DATE_PRESETS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setDatesOpen(false);
                          onGenerate({ date_preset: item.id, period: item.id });
                        }}
                        className="rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-2">
                    <div className="flex gap-2">
                      <input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="w-full rounded border px-2 py-1 text-xs" />
                      <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="w-full rounded border px-2 py-1 text-xs" />
                    </div>
                    <button
                      type="button"
                      disabled={busy || !since || !until}
                      onClick={() => {
                        setDatesOpen(false);
                        onGenerate({ since, until, period: 'custom' });
                      }}
                      className="mt-2 w-full rounded-lg bg-[#004AAD] px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Apply dates
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <button type="button" onClick={() => exportReport('xlsx')} className="inline-flex items-center gap-1.5 rounded-lg bg-[#004AAD] px-3 py-1.5 text-xs font-semibold text-white">
            <Download className="h-3.5 w-3.5" /> Excel
          </button>
          <button type="button" onClick={() => exportReport('csv')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
            CSV
          </button>
          <button type="button" onClick={() => exportReport('print')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
            <Printer className="h-3.5 w-3.5" /> PDF
          </button>
          <button type="button" onClick={() => onCopy(scoped.markdown || report.markdown || '')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
            <Copy className="h-3.5 w-3.5" />
            {copied === 'report' ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {printHint ? <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">{printHint}</p> : null}

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        {(['active', 'paused', 'inactive', 'all'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setStatus(id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${status === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            {id}
          </button>
        ))}
        <CampaignPicker campaigns={allCampaigns} value={campaignId} onChange={setCampaignId} />
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-3 py-2">
        {available.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setSortKey(id === 'Summary' ? 'period' : 'spend');
              setSortDir('desc');
              setOpenCampaigns({});
              setOpenAdsets({});
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === id ? 'bg-[#004AAD] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {id}
            <span className="ml-1 opacity-70">{sheets.find((s) => s.name === id)?.rows.length || 0}</span>
          </button>
        ))}
      </div>

      <div className="max-h-[34rem] overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              {sheet.columns.map((col, i) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={`cursor-pointer select-none whitespace-nowrap border-b border-slate-200 bg-slate-800 px-3 py-2 font-semibold text-white ${i === 0 ? 'sticky left-0 z-20' : ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key ? sortDir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" /> : <span className="text-[10px] opacity-50">↕</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tab === 'Campaigns' ? (
              rows.length ? (
                rows.map((row, idx) => {
                  const id = String(row.campaign_id || row.id || '');
                  const open = Boolean(openCampaigns[id]);
                  const adsets = (sheets.find((s) => s.name === 'Ad sets')?.rows || []).filter(
                    (item) => String(item.campaign_id || '') === id,
                  );
                  return (
                    <Fragment key={id || idx}>
                      <tr
                        className={`cursor-pointer ${idx % 2 ? 'bg-slate-50' : 'bg-white'} hover:bg-blue-50`}
                        onClick={() => setOpenCampaigns((prev) => ({ ...prev, [id]: !open }))}
                      >
                        {renderMetricCells(
                          row,
                          0,
                          <span className="inline-flex items-center gap-1">
                            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            {String(row.name || 'Campaign')}
                          </span>,
                        )}
                      </tr>
                      {open
                        ? adsets.map((adset) => {
                            const aKey = `${id}:${adset.id}`;
                            const aOpen = Boolean(openAdsets[aKey]);
                            const ads = (sheets.find((s) => s.name === 'Ads')?.rows || []).filter((item) => {
                              const sameCampaign = String(item.campaign_id || '') === id;
                              if (item.adset_id && adset.id) return sameCampaign && String(item.adset_id) === String(adset.id);
                              return sameCampaign && String(item.adset || '') === String(adset.name || '');
                            });
                            return (
                              <Fragment key={aKey}>
                                <tr
                                  className="cursor-pointer bg-indigo-50/70 hover:bg-indigo-50"
                                  onClick={() => setOpenAdsets((prev) => ({ ...prev, [aKey]: !aOpen }))}
                                >
                                  {renderMetricCells(
                                    { ...adset, name: adset.name },
                                    1,
                                    <span className="inline-flex items-center gap-1">
                                      {aOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                      Ad set · {String(adset.name || '')}
                                    </span>,
                                  )}
                                </tr>
                                {aOpen
                                  ? ads.map((ad, adIdx) => (
                                      <tr key={`${aKey}-${ad.id || adIdx}`} className="bg-sky-50/50">
                                        {renderMetricCells(
                                          ad,
                                          2,
                                          <span className="pl-1">Ad · {String(ad.name || '')}</span>,
                                        )}
                                      </tr>
                                    ))
                                  : null}
                                {aOpen && !ads.length ? (
                                  <tr>
                                    <td colSpan={sheet.columns.length} className="px-10 py-2 text-[11px] text-slate-400">
                                      Is ad set pe ads nahi mile.
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
                            );
                          })
                        : null}
                      {open && !adsets.length ? (
                        <tr>
                          <td colSpan={sheet.columns.length} className="px-8 py-2 text-[11px] text-slate-400">
                            Is campaign pe ad sets nahi mile.
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={sheet.columns.length} className="px-4 py-8 text-center text-slate-500">
                    Is filter pe rows nahi hain.
                  </td>
                </tr>
              )
            ) : NESTED.has(tab) ? (
              grouped.length ? (
                grouped.map((group) => {
                  const open = Boolean(openCampaigns[group.id]);
                  const agg = { campaign: group.name, campaign_id: group.id, ...totalsFromRows(group.rows) };
                  const child = childCache[`${tab}:${group.id}`];
                  const adsetGroups = new Map<string, { id: string; name: string; rows: any[] }>();
                  for (const row of child?.adsets || []) {
                    const id = String(row.adset_id || row.adset || 'adset');
                    if (!adsetGroups.has(id)) adsetGroups.set(id, { id, name: String(row.adset || id), rows: [] });
                    adsetGroups.get(id)!.rows.push(row);
                  }
                  return (
                    <Fragment key={group.id}>
                      <tr className="cursor-pointer bg-slate-100 hover:bg-blue-50" onClick={() => toggleCampaign(group.id)}>
                        {renderMetricCells(
                          agg,
                          0,
                          <span className="inline-flex items-center gap-1">
                            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            {group.name}
                          </span>,
                        )}
                      </tr>
                      {open
                        ? sortRows(group.rows, sortKey, sortDir).map((row, idx) => (
                            <tr key={`${group.id}-p-${idx}`} className={idx % 2 ? 'bg-white' : 'bg-slate-50'}>
                              {renderMetricCells(row, 1, <span>{dimLabel(tab, row)}</span>)}
                            </tr>
                          ))
                        : null}
                      {open && child?.loading ? (
                        <tr>
                          <td colSpan={sheet.columns.length} className="px-8 py-2 text-[11px] text-slate-500">
                            Ad sets / ads load ho rahe hain…
                          </td>
                        </tr>
                      ) : null}
                      {open && child?.error ? (
                        <tr>
                          <td colSpan={sheet.columns.length} className="px-8 py-2 text-[11px] text-amber-700">
                            {child.error}
                          </td>
                        </tr>
                      ) : null}
                      {open
                        ? [...adsetGroups.values()].map((adset) => {
                            const aOpen = Boolean(openAdsets[`${group.id}:${adset.id}`]);
                            const ads = (child?.ads || []).filter((row) => String(row.adset_id || '') === adset.id);
                            return (
                              <Fragment key={`${group.id}-${adset.id}`}>
                                <tr
                                  className="cursor-pointer bg-indigo-50/70 hover:bg-indigo-50"
                                  onClick={() => setOpenAdsets((prev) => ({ ...prev, [`${group.id}:${adset.id}`]: !aOpen }))}
                                >
                                  {renderMetricCells(
                                    { ...totalsFromRows(adset.rows), campaign: adset.name },
                                    1,
                                    <span className="inline-flex items-center gap-1">
                                      {aOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                      Ad set · {adset.name}
                                    </span>,
                                  )}
                                </tr>
                                {aOpen
                                  ? sortRows(adset.rows, sortKey, sortDir).map((row, idx) => (
                                      <tr key={`${adset.id}-r-${idx}`} className="bg-white">
                                        {renderMetricCells(row, 2, <span>{dimLabel(tab, row)}</span>)}
                                      </tr>
                                    ))
                                  : null}
                                {aOpen
                                  ? ads.map((row, idx) => (
                                      <tr key={`${adset.id}-ad-${idx}`} className="bg-sky-50/50">
                                        {renderMetricCells(
                                          row,
                                          3,
                                          <span>Ad · {String(row.ad || '')} · {dimLabel(tab, row)}</span>,
                                        )}
                                      </tr>
                                    ))
                                  : null}
                              </Fragment>
                            );
                          })
                        : null}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={sheet.columns.length} className="px-4 py-8 text-center text-slate-500">
                    Is filter pe rows nahi hain.
                  </td>
                </tr>
              )
            ) : rows.length ? (
              rows.map((row, idx) => (
                <tr key={`${tab}-${idx}`} className={`${idx % 2 ? 'bg-slate-50' : 'bg-white'} hover:bg-blue-50`}>
                  {sheet.columns.map((col, i) => (
                    <Cell key={col.key} col={col} row={row} i={i} currency={currency} />
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={sheet.columns.length} className="px-4 py-8 text-center text-slate-500">
                  Is filter pe rows nahi hain.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="bg-[#0f172a] text-white">
              {sheet.columns.map((col, i) => (
                <td
                  key={col.key}
                  className={`whitespace-nowrap px-3 py-2 text-xs font-bold ${i === 0 ? 'sticky left-0 bg-[#0f172a]' : ''} ${NUMERIC.has(col.key) ? 'text-right tabular-nums' : ''}`}
                >
                  {i === 0
                    ? `Total · ${NESTED.has(tab) ? grouped.length : rows.length}`
                    : NUMERIC.has(col.key)
                      ? formatCell(col.key, (totals as any)[col.key], currency)
                      : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
        Campaign click = ad sets / ads · Dropdown mein Active / Inactive + search · Total last row
      </p>
    </div>
  );
}

export function ReportBusyNote() {
  return (
    <p className="flex items-center gap-2 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      Campaigns, ad sets, ads aur Meta breakdowns nikal raha hoon — 20–40 sec lag sakte hain.
    </p>
  );
}
