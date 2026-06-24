'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  Apple,
  Car,
  Download,
  Loader2,
  RefreshCcw,
  Search,
  Smartphone,
  TrendingUp,
  Users,
} from 'lucide-react';
import { REPORT_DATE_PRESETS, type ReportDatePreset } from '@/lib/report-date-range';
import { buildPrintableReportHtml, HealthReportDetailView } from '@/components/admin/HealthReportDetailView';
import SmartToolsCustomerActivityPanel from '@/components/admin/SmartToolsCustomerActivityPanel';
import SmartToolCrossLinkCell from '@/components/admin/SmartToolCrossLinkCell';

type ReportRow = {
  id: string;
  reg_number: string;
  make: string | null;
  model: string | null;
  fuel: string | null;
  registration_year: number | null;
  odometer: number | null;
  composite_score: number;
  band_label: string | null;
  accuracy: string | null;
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

type ReportDetail = ReportRow & {
  report_json: any;
  report_text: string;
};

type Summary = {
  total_reports: number;
  android: number;
  ios: number;
  unknown_platform: number;
  avg_score: number;
  urgent_attention: number;
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

function scoreTone(score: number) {
  if (score >= 80) return 'text-emerald-700 bg-emerald-50 ring-emerald-200';
  if (score >= 60) return 'text-amber-700 bg-amber-50 ring-amber-200';
  if (score >= 40) return 'text-orange-700 bg-orange-50 ring-orange-200';
  return 'text-red-700 bg-red-50 ring-red-200';
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

export default function VehicleHealthReportsPage() {
  const searchParams = useSearchParams();
  const [preset, setPreset] = useState<ReportDatePreset>('last_30_days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rangeLabel, setRangeLabel] = useState('Last 30 days');
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<ReportDetail | null>(null);
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
      const res = await fetch(`/api/admin/vehicle-health-reports?${queryString}&limit=100`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load reports');
      setItems(json.items || []);
      setSummary(json.summary || null);
      setTotalCount(json.count ?? json.items?.length ?? 0);
      setRangeLabel(json.range?.label || 'Selected range');
    } catch (e: any) {
      setError(e.message || 'Failed to load');
      setItems([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setError('');
    setSelected(null);
    try {
      const res = await fetch(`/api/admin/vehicle-health-reports/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load report');
      setSelected(json.item);
    } catch (e: any) {
      setError(e.message || 'Failed to load report');
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

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/vehicle-health-reports?${queryString}&export=1`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `health-check-reports-${preset}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const downloadText = () => {
    if (!selected?.report_text) return;
    const blob = new Blob([selected.report_text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health-report-${selected.reg_number}-${selected.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    if (!selected?.report_json) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(buildPrintableReportHtml(selected.report_json, selected));
    w.document.close();
    w.print();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-blue-600" />
            Smart Health Check Reports
          </h1>
          <p className="text-sm text-slate-600 mt-1">Customer details, platform split, filters & export</p>
        </div>
        <button
          type="button"
          onClick={loadList}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold hover:bg-slate-50"
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <label className="text-xs font-semibold text-slate-500">
            Date range
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900"
              value={preset}
              onChange={(e) => setPreset(e.target.value as ReportDatePreset)}
            >
              {REPORT_DATE_PRESETS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-slate-500">
            Platform
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
            >
              <option value="all">All platforms</option>
              <option value="ANDROID">Android only</option>
              <option value="IOS">iOS only</option>
            </select>
          </label>

          {preset === 'custom' ? (
            <>
              <label className="text-xs font-semibold text-slate-500">
                From
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                To
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
            </>
          ) : (
            <label className="text-xs font-semibold text-slate-500 md:col-span-2">
              Search
              <div className="relative mt-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadList()}
                  placeholder="Reg, name, phone, make, model"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm"
                />
              </div>
            </label>
          )}
        </div>

        {preset === 'custom' ? (
          <label className="block text-xs font-semibold text-slate-500">
            Search
            <div className="relative mt-1 max-w-xl">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadList()}
                placeholder="Reg, name, phone, make, model"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm"
              />
            </div>
          </label>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500">
            Showing <span className="font-bold text-slate-800">{rangeLabel}</span>
            {totalCount ? ` · ${totalCount} report${totalCount === 1 ? '' : 's'}` : ''}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadList}
              disabled={loading}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Apply'}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || loading || !items.length}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div> : null}

      {/* Stats */}
      {!loading && summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard label="Total Reports" value={summary.total_reports} icon={<Users className="w-4 h-4 text-blue-600" />} accent="bg-blue-50" />
          <StatCard label="Android" value={summary.android} icon={<Smartphone className="w-4 h-4 text-emerald-600" />} accent="bg-emerald-50" />
          <StatCard label="iOS" value={summary.ios} icon={<Apple className="w-4 h-4 text-slate-700" />} accent="bg-slate-100" />
          <StatCard label="Avg Score" value={summary.avg_score} icon={<TrendingUp className="w-4 h-4 text-violet-600" />} accent="bg-violet-50" />
          <StatCard label="Urgent" value={summary.urgent_attention} icon={<AlertTriangle className="w-4 h-4 text-red-600" />} accent="bg-red-50" />
          <StatCard label="Unknown OS" value={summary.unknown_platform} icon={<Activity className="w-4 h-4 text-slate-500" />} accent="bg-slate-50" />
        </div>
      ) : null}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading reports...
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">No reports in this period. Adjust filters or wait for app users to generate reports.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Band</th>
                  <th className="px-4 py-3">Accuracy</th>
                  <th className="px-4 py-3">Generated</th>
                  <th className="px-4 py-3">Resale Value</th>
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
                      <div className="font-semibold text-slate-900">{row.reg_number}</div>
                      <div className="text-slate-500 text-xs">{[row.make, row.model].filter(Boolean).join(' ') || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <PlatformBadge platform={row.platform} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex min-w-[2.5rem] justify-center px-2 py-1 rounded-lg text-sm font-black ring-1 ${scoreTone(row.composite_score)}`}>
                        {row.composite_score}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[140px]">{row.band_label || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                        {row.accuracy || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmt(row.created_at)}</td>
                    <td className="px-4 py-3">
                      <SmartToolCrossLinkCell
                        checked={Boolean(row.other_tool_checked)}
                        count={row.other_tool_count}
                        latestId={row.other_tool_latest_id}
                        adminPath={row.other_tool_admin_path || '/dashboard/super_admin/car-resale-valuations'}
                        label={row.other_tool_label || 'Resale Value'}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(row.id)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                      >
                        View report
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
                  <Car className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="truncate">{selected?.reg_number || 'Report'}</span>
                </h2>
                {selected ? (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-xs text-slate-500 truncate">
                      {[selected.make, selected.model].filter(Boolean).join(' ')} · Score {selected.composite_score}
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
                    <button type="button" onClick={downloadText} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold hover:bg-slate-50">
                      <Download className="w-3.5 h-3.5" />
                      TXT
                    </button>
                    <button type="button" onClick={printReport} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700">
                      Print / PDF
                    </button>
                  </>
                ) : null}
                <button type="button" onClick={() => setSelected(null)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold hover:bg-slate-50">
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 sm:p-5">
              {detailLoading ? (
                <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading full report...
                </div>
              ) : selected?.report_json ? (
                <>
                  <SmartToolsCustomerActivityPanel
                    customerId={selected.customer_id}
                    customerPhone={selected.customer_phone}
                    excludeType="health"
                    excludeId={selected.id}
                  />
                  <HealthReportDetailView report={selected.report_json} vehicle={selected} />
                </>
              ) : selected?.report_text ? (
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 bg-white border border-slate-200 rounded-xl p-4">
                  {selected.report_text}
                </pre>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
