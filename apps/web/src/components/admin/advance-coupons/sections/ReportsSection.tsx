'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Crown,
  Download,
  IndianRupee,
  Loader2,
  Smartphone,
  Ticket,
} from 'lucide-react';
import { PcmPageHeader, PcmStatCard } from '../shared';
import { REPORT_DATE_PRESETS, type ReportDatePreset } from '@/lib/report-date-range';

type ReportTab = 'coupons' | 'devices' | 'memberships';

function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN');
}

export default function PcmReportsSection() {
  const [preset, setPreset] = useState<ReportDatePreset>('last_30_days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [activeTab, setActiveTab] = useState<ReportTab>('coupons');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ preset });
    if (preset === 'custom') {
      if (customStart) params.set('start', customStart);
      if (customEnd) params.set('end', customEnd);
    }
    return params.toString();
  }, [preset, customStart, customEnd]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/coupons/pcms-reports?${queryString}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load report');
      setReport(json);
    } catch (e: any) {
      setError(e?.message || 'Failed to load report');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/coupons/pcms-reports?${queryString}&export=1`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `pcm-report-${report?.range?.startYmd || 'export'}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const summary = report?.summary;
  const rangeLabel = report?.range?.label || 'Last 30 days';

  return (
    <div>
      <PcmPageHeader
        title="Reports & Analytics"
        description="Coupons, app devices & memberships — filter by date and export"
      />

      <div className="pcm-card rounded-xl border p-4 mb-5 space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-end gap-3">
          <label className="flex-1 text-xs font-semibold text-[#72665e]">
            Date range
            <select
              className="mt-1 w-full rounded-lg border border-[#e6e0da] bg-white px-3 py-2.5 text-sm font-semibold text-[#15110d]"
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

          {preset === 'custom' ? (
            <>
              <label className="text-xs font-semibold text-[#72665e]">
                From
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-[#e6e0da] bg-white px-3 py-2.5 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-[#72665e]">
                To
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-[#e6e0da] bg-white px-3 py-2.5 text-sm"
                />
              </label>
            </>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadReport}
              disabled={loading}
              className="rounded-lg border border-[#e6e0da] bg-white px-4 py-2.5 text-sm font-bold text-[#15110d] hover:bg-[#faf7f2] disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Apply'}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || loading || !report}
              className="inline-flex items-center gap-2 rounded-lg bg-[#e54800] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#c93d00] disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export Report
            </button>
          </div>
        </div>
        <p className="text-xs text-[#72665e]">
          Showing data for <span className="font-bold text-[#15110d]">{rangeLabel}</span>
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="h-40 pcm-card rounded-xl border animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 mb-5">
            <PcmStatCard label="Redemptions" value={summary?.total_redemptions || 0} icon={<Ticket className="w-5 h-5" />} accent="primary" />
            <PcmStatCard label="Discount Given" value={`₹${Number(summary?.total_discount || 0).toLocaleString('en-IN')}`} icon={<IndianRupee className="w-5 h-5" />} accent="emerald" />
            <PcmStatCard label="New App Users" value={summary?.new_app_customers || 0} icon={<Smartphone className="w-5 h-5" />} accent="violet" />
            <PcmStatCard label="Android" value={summary?.android_installs || 0} icon={<Smartphone className="w-5 h-5" />} accent="emerald" />
            <PcmStatCard label="iOS" value={summary?.ios_installs || 0} icon={<Smartphone className="w-5 h-5" />} accent="primary" />
            <PcmStatCard label="New Memberships" value={summary?.new_memberships || 0} icon={<Crown className="w-5 h-5" />} accent="amber" />
            <PcmStatCard label="Active Coupons" value={summary?.active_coupons || 0} icon={<BarChart3 className="w-5 h-5" />} accent="violet" />
            <PcmStatCard label="Active Memberships" value={summary?.active_memberships_in_period || 0} icon={<Crown className="w-5 h-5" />} accent="primary" />
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {(
              [
                ['coupons', 'Coupon Redemptions', Ticket],
                ['devices', 'App Devices / Installs', Smartphone],
                ['memberships', 'Memberships', Crown],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold border ${
                  activeTab === id
                    ? 'bg-[#e54800] text-white border-[#e54800]'
                    : 'bg-white text-[#72665e] border-[#e6e0da] hover:bg-[#faf7f2]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'coupons' ? (
            <ReportTable
              title="Coupon Redemption Log"
              empty="No coupon redemptions in this period."
              columns={[
                'Date',
                'Code',
                'Customer',
                'Phone',
                'Service Booked',
                'Car',
                'City',
                'Lead #',
                'Channel',
                'Status',
                'Role',
                'Discount',
              ]}
              rows={(report?.redemptions || []).map((row: any) => {
                const customer = row.customer_display || {};
                const booking = row.booking_display || {};
                return [
                  fmtDate(row.created_at),
                  row.coupon?.code || '—',
                  customer.name || '—',
                  customer.phone || '—',
                  booking.service || '—',
                  booking.vehicle || booking.vehicle_number || '—',
                  booking.city || '—',
                  customer.lead_number || '—',
                  customer.channel || '—',
                  booking.lead_status || '—',
                  row.applied_by_role || '—',
                  `₹${Number(row.discount_amount_applied || 0).toLocaleString('en-IN')}`,
                ];
              })}
            />
          ) : null}

          {activeTab === 'devices' ? (
            <ReportTable
              title="App Devices & New Installs"
              empty="No new app customers in this period."
              columns={['Joined', 'Name', 'Phone', 'Email', 'Platform', 'Account', 'Last Login']}
              rows={(report?.devices || []).map((row: any) => [
                fmtDate(row.created_at),
                row.full_name || '—',
                row.phone || '—',
                row.email || '—',
                row.platform || 'Unknown',
                row.account_status || 'ACTIVE',
                fmtDate(row.last_login_at),
              ])}
            />
          ) : null}

          {activeTab === 'memberships' ? (
            <ReportTable
              title="Membership Purchases & Activations"
              empty="No memberships in this period."
              columns={['Date', 'Customer', 'Phone', 'Plan', 'Type', 'Status', 'Source', 'Price', 'Valid Until', '2nd Car']}
              rows={(report?.memberships || []).map((row: any) => [
                fmtDate(row.created_at),
                row.customer_name || '—',
                row.customer_phone || '—',
                row.plan_name || '—',
                row.membership_type || '—',
                row.status || '—',
                row.source || '—',
                `₹${Number(row.plan_price || 0).toLocaleString('en-IN')}`,
                fmtDate(row.ends_at),
                row.has_second_car ? 'Yes' : 'No',
              ])}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function ReportTable({
  title,
  empty,
  columns,
  rows,
}: {
  title: string;
  empty: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <div className="pcm-card rounded-xl border overflow-hidden">
      <div className="p-4 border-b border-[#e6e0da] font-bold">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-[#f7f3ec]">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-4 py-3 text-left whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-[#72665e]">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={idx} className="border-t border-[#e6e0da]">
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-4 py-3 whitespace-nowrap">
                      {cellIdx === 1 ? <span className="font-semibold">{cell}</span> : cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
