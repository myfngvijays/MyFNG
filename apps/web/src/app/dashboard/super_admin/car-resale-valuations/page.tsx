'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Apple,
  Car,
  Download,
  IndianRupee,
  Loader2,
  RefreshCcw,
  Search,
  Smartphone,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { REPORT_DATE_PRESETS, type ReportDatePreset } from '@/lib/report-date-range';
import {
  ResaleValuationDetailView,
  buildPrintableValuationHtml,
  valuationDownloadBaseName,
  type ResaleValuationRecord,
} from '@/components/admin/ResaleValuationDetailView';
import SmartToolsCustomerActivityPanel from '@/components/admin/SmartToolsCustomerActivityPanel';
import SmartToolCrossLinkCell from '@/components/admin/SmartToolCrossLinkCell';

type ValuationRow = {
  id: string;
  make: string | null;
  model: string | null;
  vehicle_number: string | null;
  registration_year: number | null;
  fuel: string | null;
  transmission: string | null;
  odometer: number | null;
  owners: number | null;
  condition: string | null;
  had_accident: boolean | null;
  insurance_valid: boolean | null;
  service_records: string | null;
  city_name: string | null;
  city_tier: string | null;
  estimate_low: number;
  estimate_mid: number;
  estimate_high: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_id: string | null;
  platform: string | null;
  created_at: string;
  other_tool_checked?: boolean;
  other_tool_count?: number;
  other_tool_latest_id?: string | null;
  other_tool_admin_path?: string;
  other_tool_label?: string;
};

type ValuationDetail = ResaleValuationRecord;

type Summary = {
  total_valuations: number;
  android: number;
  ios: number;
  unknown_platform: number;
  avg_mid_estimate: number;
};

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dt;
  }
}

function fmtInr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function PlatformBadge({ platform }: { platform?: string | null }) {
  const p = String(platform || '').toUpperCase();
  if (p === 'IOS') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900 text-white">
        <Apple className="w-3 h-3" />
        iOS
      </span>
    );
  }
  if (p === 'ANDROID') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white">
        <Smartphone className="w-3 h-3" />
        Android
      </span>
    );
  }
  return <span className="text-[11px] font-semibold text-slate-400">Unknown</span>;
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${accent}`}>{icon}</div>
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

export default function CarResaleValuationsPage() {
  const searchParams = useSearchParams();
  const [preset, setPreset] = useState<ReportDatePreset>('last_30_days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ValuationRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rangeLabel, setRangeLabel] = useState('Last 30 days');
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<ValuationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ preset, platform: platformFilter });
    if (preset === 'custom') {
      if (customStart) params.set('start', customStart);
      if (customEnd) params.set('end', customEnd);
    }
    if (q.trim()) params.set('q', q.trim());
    return params.toString();
  }, [preset, customStart, customEnd, platformFilter, q]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/car-resale-valuations?${queryString}&limit=100`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load valuations');
      setItems(json.items || []);
      setSummary(json.summary || null);
      setTotalCount(json.count ?? json.items?.length ?? 0);
      setRangeLabel(json.range?.label || 'Selected range');
    } catch (e: any) {
      setError(e.message || 'Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/car-resale-valuations?${queryString}&export=1`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `car-resale-valuations-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setError('');
    setSelected(null);
    try {
      const res = await fetch(`/api/admin/car-resale-valuations/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load detail');
      setSelected(json.item);
    } catch (e: any) {
      setError(e.message || 'Failed to load detail');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && !detailLoading && !selected) {
      openDetail(openId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const downloadText = () => {
    if (!selected?.valuation_text) return;
    const blob = new Blob([selected.valuation_text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${valuationDownloadBaseName(selected)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    if (!selected) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(buildPrintableValuationHtml(selected));
    w.document.close();
    w.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-violet-600" />
            Car Resale Value
          </h1>
          <p className="text-sm text-slate-600 mt-1">Resale estimates generated from the mobile Smart Tools app.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadList}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-60"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total" value={summary?.total_valuations ?? 0} icon={<TrendingUp className="w-4 h-4 text-violet-700" />} accent="bg-violet-50" />
        <StatCard label="Android" value={summary?.android ?? 0} icon={<Smartphone className="w-4 h-4 text-emerald-700" />} accent="bg-emerald-50" />
        <StatCard label="iOS" value={summary?.ios ?? 0} icon={<Apple className="w-4 h-4 text-slate-700" />} accent="bg-slate-100" />
        <StatCard label="Avg Mid" value={fmtInr(summary?.avg_mid_estimate ?? 0)} icon={<IndianRupee className="w-4 h-4 text-amber-700" />} accent="bg-amber-50" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date range</label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as ReportDatePreset)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {REPORT_DATE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          {preset === 'custom' ? (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Start</label>
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">End</label>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
            </>
          ) : null}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Platform</label>
            <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="all">All</option>
              <option value="ANDROID">Android</option>
              <option value="IOS">iOS</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Make, model, phone, city..."
                className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Showing {items.length} of {totalCount} · {rangeLabel}
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading valuations...
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">No valuations in this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Estimate</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Generated</th>
                  <th className="px-4 py-3">Health Check</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{row.customer_name || 'Guest user'}</div>
                      <div className="text-slate-500 text-xs">{row.customer_phone || 'No phone'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{[row.make, row.model].filter(Boolean).join(' ') || '-'}</div>
                      <div className="text-slate-500 text-xs">
                        {[row.registration_year, row.odometer ? `${row.odometer.toLocaleString('en-IN')} km` : null].filter(Boolean).join(' · ') || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.city_name || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-emerald-700">{fmtInr(row.estimate_low)} - {fmtInr(row.estimate_high)}</div>
                      <div className="text-xs text-slate-500">Mid {fmtInr(row.estimate_mid)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <PlatformBadge platform={row.platform} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmt(row.created_at)}</td>
                    <td className="px-4 py-3">
                      <SmartToolCrossLinkCell
                        checked={Boolean(row.other_tool_checked)}
                        count={row.other_tool_count}
                        latestId={row.other_tool_latest_id}
                        adminPath={row.other_tool_admin_path || '/dashboard/super_admin/vehicle-health-reports'}
                        label={row.other_tool_label || 'Health Check'}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(row.id)}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(selected || detailLoading) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-100 w-full sm:max-w-2xl max-h-[94vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-start sm:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Car className="w-5 h-5 text-violet-600 shrink-0" />
                  <span className="truncate">
                    {selected ? [selected.make, selected.model].filter(Boolean).join(' ') : 'Valuation'}
                  </span>
                </h2>
                {selected ? (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-xs text-slate-500">
                      {fmtInr(selected.estimate_low)} - {fmtInr(selected.estimate_high)} · Mid {fmtInr(selected.estimate_mid)}
                    </p>
                    <PlatformBadge platform={selected.platform} />
                    {selected.customer_name ? (
                      <span className="text-xs text-slate-600">
                        {selected.customer_name}
                        {selected.customer_phone ? ` · ${selected.customer_phone}` : ''}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                {selected ? (
                  <>
                    <button
                      type="button"
                      onClick={downloadText}
                      disabled={!selected.valuation_text}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      TXT
                    </button>
                    <button
                      type="button"
                      onClick={printReport}
                      className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700"
                    >
                      Print / PDF
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 sm:p-5">
              {detailLoading ? (
                <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading full valuation...
                </div>
              ) : selected ? (
                <>
                  <SmartToolsCustomerActivityPanel
                    customerId={selected.customer_id}
                    customerPhone={selected.customer_phone}
                    excludeType="resale"
                    excludeId={selected.id}
                  />
                  <ResaleValuationDetailView item={selected} />
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
