'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Crown,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Gift,
  Car,
  CheckCircle2,
  Download,
  Loader2,
  LayoutDashboard,
  Users,
  IndianRupee,
  Calendar,
  Smartphone,
  Wrench,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { appPlatformBadgeClass, appPlatformLabel } from '@/lib/app-platform';
import { REPORT_DATE_PRESETS, type ReportDatePreset } from '@/lib/report-date-range';

type Overview = {
  total_memberships: number;
  active_memberships: number;
  expired_memberships: number;
};

type Dashboard = {
  range_label: string;
  platform_filter: string;
  new_memberships: number;
  first_time_signups: number;
  renewals_in_period: number;
  active_now: number;
  expiring_soon: number;
  revenue_inr: number;
  total_wallet_balance: number;
  members_with_wallet: number;
  benefits_claimed: number;
  service_bookings: number;
  android_count: number;
  ios_count: number;
  unknown_platform_count: number;
  second_car_count: number;
  plan_breakdown: Array<{ plan_name: string; count: number; revenue_inr: number }>;
  benefit_breakdown: Array<{ benefit_code: string; title: string; count: number }>;
  source_breakdown: Array<{ source: string; count: number; revenue_inr: number }>;
  daily_signups: Array<{ date: string; count: number }>;
};

type BenefitClaimRow = {
  id: string;
  benefit_code: string;
  benefit_title: string;
  customer_id: string;
  customer_name: string;
  phone: string;
  app_platform: string | null;
  plan_name: string | null;
  vehicle_number: string | null;
  vehicle_label: string | null;
  lead_number: string | null;
  lead_status: string | null;
  created_at: string;
};

type BenefitClaimsModal = {
  benefit_code: string;
  title: string;
  range_label: string;
  claims: BenefitClaimRow[];
};

type VehicleDetails = {
  make: string | null;
  model: string | null;
  vehicle_number: string | null;
  year: number | null;
  vin: string | null;
  odometer_km: number | null;
  insurance_expiry: string | null;
  fuel_type: string | null;
};

type MembershipRow = {
  membership_id: string;
  customer_id: string;
  customer_name: string;
  email: string | null;
  phone: string;
  app_platform: string | null;
  plan_name: string;
  plan_code: string;
  membership_type: string;
  plan_price: number;
  status: string;
  is_live: boolean;
  starts_at: string;
  ends_at: string;
  source: string | null;
  wallet_balance: number;
  benefits_claimed: number;
  benefits_claimable: number;
  benefits_remaining: number | null;
  primary_vehicle: string | null;
  second_vehicle: string | null;
  vehicle: VehicleDetails;
  services_booked_count: number;
  last_service: { label: string; amount: number; created_at: string } | null;
  has_second_car: boolean;
  created_at: string;
};

function fmtSourceLabel(source: string) {
  const value = String(source || '').trim().toUpperCase();
  if (value === 'PURCHASE') return 'App purchase';
  if (value === 'ADMIN' || value === 'ADMIN_ACTIVATE') return 'Admin activated';
  if (value === 'RENEWAL') return 'Renewal';
  return value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function platformFilterLabel(filter: PlatformFilter) {
  if (filter === 'ANDROID') return 'Android';
  if (filter === 'IOS') return 'iOS';
  if (filter === 'UNKNOWN') return 'Unknown platform';
  return 'All platforms';
}

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDateShort(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function VehicleProfileCell({ vehicle }: { vehicle: VehicleDetails }) {
  return (
    <div className="text-[11px] leading-relaxed text-gray-600 space-y-0.5 min-w-[150px]">
      <div className="font-bold text-gray-900">{vehicle.vehicle_number || '—'}</div>
      <div>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'}</div>
      <div>Reg: {vehicle.year ?? '—'} · {vehicle.fuel_type || '—'}</div>
      <div>Chassis: {vehicle.vin || '—'}</div>
      <div>Odo: {vehicle.odometer_km != null ? `${vehicle.odometer_km.toLocaleString('en-IN')} km` : '—'}</div>
      <div>Ins: {vehicle.insurance_expiry ? fmtDateShort(vehicle.insurance_expiry) : '—'}</div>
    </div>
  );
}

function VehicleDetailBlock({ title, vehicle }: { title: string; vehicle: VehicleDetails }) {
  return (
    <div className="rounded-xl border p-3 text-sm space-y-1.5">
      <div className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</div>
      <div className="flex justify-between gap-2">
        <span className="text-gray-500">Car number</span>
        <span className="font-bold">{vehicle.vehicle_number || '—'}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-gray-500">Make / Model</span>
        <span className="font-semibold text-right">
          {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'}
        </span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-gray-500">Registration year</span>
        <span className="font-semibold">{vehicle.year ?? '—'}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-gray-500">Fuel type</span>
        <span className="font-semibold">{vehicle.fuel_type || '—'}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-gray-500">Chassis / VIN</span>
        <span className="font-semibold">{vehicle.vin || '—'}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-gray-500">Odometer</span>
        <span className="font-semibold">
          {vehicle.odometer_km != null ? `${vehicle.odometer_km.toLocaleString('en-IN')} km` : '—'}
        </span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-gray-500">Insurance expiry</span>
        <span className="font-semibold">
          {vehicle.insurance_expiry ? fmtDateShort(vehicle.insurance_expiry) : '—'}
        </span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent = 'bg-white',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className={`rounded-2xl border border-gray-200 p-4 shadow-sm ${accent}`}>
      {icon ? <div className="mb-2">{icon}</div> : null}
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-gray-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : null}
    </div>
  );
}

function MiniBarChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (!data.length) {
    return <p className="text-sm text-gray-400 py-6 text-center">No signups in this period</p>;
  }
  return (
    <div className="flex items-end gap-1.5 h-32 pt-2">
      {data.map((d) => (
        <div key={d.date} className="flex-1 min-w-0 flex flex-col items-center gap-1">
          <span className="text-[10px] font-bold text-violet-700">{d.count || ''}</span>
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-violet-600 to-violet-400 min-h-[4px]"
            style={{ height: `${Math.max(8, (d.count / max) * 100)}%` }}
            title={`${d.date}: ${d.count}`}
          />
          <span className="text-[9px] text-gray-400 truncate w-full text-center">
            {d.date.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

type PlatformFilter = 'ALL' | 'ANDROID' | 'IOS' | 'UNKNOWN';

function PlatformTabButton({
  active,
  label,
  onClick,
  className,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold border ${
        active ? className : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}

export default function MembershipCustomersApp() {
  const pathname = usePathname();
  const dashboardBase = pathname?.startsWith('/dashboard/app_operations')
    ? '/dashboard/app_operations'
    : '/dashboard/super_admin';
  const [tab, setTab] = useState<'dashboard' | 'customers'>('dashboard');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ACTIVE');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rangeLabel, setRangeLabel] = useState('Last 30 days');
  const [preset, setPreset] = useState<ReportDatePreset>('last_30_days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [benefitModal, setBenefitModal] = useState<BenefitClaimsModal | null>(null);
  const [benefitModalLoading, setBenefitModalLoading] = useState(false);

  const queryBase = useMemo(() => {
    const params = new URLSearchParams({ preset });
    if (preset === 'custom') {
      if (customStart) params.set('start', customStart);
      if (customEnd) params.set('end', customEnd);
    }
    return params;
  }, [preset, customStart, customEnd]);

  const applyPlatformFilter = (next: PlatformFilter) => {
    setPlatformFilter(next);
    setPage(1);
  };

  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(queryBase);
      params.set('view', 'dashboard');
      params.set('platform', platformFilter);
      const res = await fetch(`/api/super_admin/membership-customers?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load dashboard');
      setDashboard(json.dashboard || null);
      setOverview(json.overview || null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setDashboardLoading(false);
    }
  }, [platformFilter, queryBase]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(queryBase);
      params.set('page', String(page));
      params.set('limit', '40');
      params.set('filter', filter);
      params.set('platform', platformFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/super_admin/membership-customers?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load membership customers');

      setOverview(json.overview || null);
      setRows(json.memberships || []);
      setTotal(json.pagination?.total || 0);
      setRangeLabel(json.range_label || 'Last 30 days');
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter, page, platformFilter, search, queryBase]);

  const openBenefitClaims = async (benefit: { benefit_code: string; title: string }) => {
    setBenefitModalLoading(true);
    setBenefitModal({
      benefit_code: benefit.benefit_code,
      title: benefit.title,
      range_label: dashboard?.range_label || rangeLabel,
      claims: [],
    });
    setError(null);
    try {
      const params = new URLSearchParams(queryBase);
      params.set('view', 'benefit_claims');
      params.set('benefit_code', benefit.benefit_code);
      params.set('platform', platformFilter);
      const res = await fetch(`/api/super_admin/membership-customers?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load benefit claims');
      setBenefitModal({
        benefit_code: json.benefit_code,
        title: json.title,
        range_label: json.range_label,
        claims: json.claims || [],
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load benefit claims');
      setBenefitModal(null);
    } finally {
      setBenefitModalLoading(false);
    }
  };

  const closeBenefitModal = () => setBenefitModal(null);

  useEffect(() => {
    if (tab === 'dashboard') void fetchDashboard();
    else void fetchList();
  }, [tab, fetchDashboard, fetchList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    (async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/super_admin/membership-customers/${selectedId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load detail');
        if (active) setDetail(json);
      } catch (e: any) {
        if (active) setError(e?.message || 'Failed to load detail');
      } finally {
        if (active) setDetailLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedId]);

  const handleExport = async (scope: 'period' | 'all_active' = 'period') => {
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams(queryBase);
      params.set('export', '1');
      params.set('filter', scope === 'all_active' ? 'ACTIVE' : filter);
      params.set('platform', platformFilter);
      if (scope === 'all_active') params.set('export_scope', 'all_active');
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/super_admin/membership-customers?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `membership-customers-${scope === 'all_active' ? 'all-active' : 'period'}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteMembership = async () => {
    if (!selectedId || !selectedRow) return;
    const ok = window.confirm(
      `Remove membership for ${selectedRow.customer_name} (${selectedRow.phone})?\n\nThis deletes the membership record and its benefit usage history. This cannot be undone.`,
    );
    if (!ok) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/super_admin/membership-customers/${selectedId}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to remove membership');
      setSelectedId(null);
      setDetail(null);
      await fetchList();
    } catch (e: any) {
      setError(e?.message || 'Failed to remove membership');
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 40));
  const selectedRow = useMemo(
    () => rows.find((r) => r.membership_id === selectedId) || null,
    [rows, selectedId],
  );

  const refresh = () => {
    if (tab === 'dashboard') void fetchDashboard();
    else void fetchList();
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1680px] mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Crown className="h-6 w-6 text-violet-600" />
            Membership Customers
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Prime members — plan, vehicle profile, wallet, benefits &amp; service bookings.
            Dashboard &amp; period export use report period on the right. Customers list shows all active members.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleExport('period')}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export (period)
          </button>
          <button
            type="button"
            onClick={() => void handleExport('all_active')}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-50"
          >
            Export all active
          </button>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs + platform filters + report period */}
      <div className="mb-4 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('dashboard')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${
              tab === 'dashboard' ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-700'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setTab('customers')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${
              tab === 'customers' ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-700'
            }`}
          >
            <Users className="h-4 w-4" />
            Customers
          </button>

          <span className="hidden sm:inline text-gray-300">|</span>

          <PlatformTabButton
            active={platformFilter === 'ANDROID'}
            label="Android"
            onClick={() => applyPlatformFilter('ANDROID')}
            className="bg-emerald-600 text-white border-emerald-600"
          />
          <PlatformTabButton
            active={platformFilter === 'IOS'}
            label="iOS"
            onClick={() => applyPlatformFilter('IOS')}
            className="bg-slate-900 text-white border-slate-900"
          />
          <PlatformTabButton
            active={platformFilter === 'UNKNOWN'}
            label="Unknown"
            onClick={() => applyPlatformFilter('UNKNOWN')}
            className="bg-gray-500 text-white border-gray-500"
          />
          {platformFilter !== 'ALL' ? (
            <button
              type="button"
              onClick={() => applyPlatformFilter('ALL')}
              className="rounded-xl px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100"
            >
              Clear platform
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {preset === 'custom' ? (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                aria-label="From date"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                aria-label="To date"
              />
            </>
          ) : null}
          <select
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value as ReportDatePreset);
              setPage(1);
            }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold min-w-[150px]"
            aria-label="Report period"
          >
            {REPORT_DATE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {tab === 'dashboard' ? (
        <div className="space-y-4">
          {dashboardLoading || !dashboard ? (
            <div className="py-16 text-center text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading dashboard...
            </div>
          ) : (
            <>
              {platformFilter !== 'ALL' ? (
                <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 flex flex-wrap items-center gap-2">
                  <Smartphone className="h-4 w-4 shrink-0" />
                  <span>
                    Showing <strong>{platformFilterLabel(platformFilter)}</strong> only · {dashboard.range_label}
                  </span>
                </div>
              ) : null}

              <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                <StatCard
                  label="Purchases in period"
                  value={dashboard.new_memberships}
                  sub={`${dashboard.first_time_signups} new · ${dashboard.renewals_in_period} renewals`}
                  accent="bg-violet-50"
                  icon={<Calendar className="h-5 w-5 text-violet-600" />}
                />
                <StatCard
                  label="Active now"
                  value={dashboard.active_now}
                  sub={`${dashboard.expiring_soon} expiring in 30 days`}
                  accent="bg-emerald-50"
                  icon={<Crown className="h-5 w-5 text-emerald-600" />}
                />
                <StatCard
                  label="Revenue"
                  value={inr(dashboard.revenue_inr)}
                  sub="Plan purchases in period"
                  accent="bg-blue-50"
                  icon={<IndianRupee className="h-5 w-5 text-blue-600" />}
                />
                <StatCard
                  label="Wallet balance"
                  value={inr(dashboard.total_wallet_balance)}
                  sub={`${dashboard.members_with_wallet} members with balance`}
                  accent="bg-sky-50"
                  icon={<Wallet className="h-5 w-5 text-sky-600" />}
                />
                <StatCard
                  label="Benefits claimed"
                  value={dashboard.benefits_claimed}
                  sub="Selected period"
                  accent="bg-amber-50"
                  icon={<Gift className="h-5 w-5 text-amber-600" />}
                />
                <StatCard
                  label="Service bookings"
                  value={dashboard.service_bookings}
                  sub="Membership customers · period"
                  accent="bg-orange-50"
                  icon={<Wrench className="h-5 w-5 text-orange-600" />}
                />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  label="Platform split"
                  value={`${dashboard.android_count} / ${dashboard.ios_count} / ${dashboard.unknown_platform_count}`}
                  sub="Android / iOS / Unknown"
                  accent="bg-slate-50"
                  icon={<Smartphone className="h-5 w-5 text-slate-600" />}
                />
                <StatCard
                  label="Second car add-ons"
                  value={dashboard.second_car_count}
                  sub="Purchases with 2nd vehicle"
                  accent="bg-rose-50"
                  icon={<Car className="h-5 w-5 text-rose-600" />}
                />
                <StatCard
                  label="Renewals"
                  value={dashboard.renewals_in_period}
                  sub="Repeat purchases in period"
                  accent="bg-indigo-50"
                  icon={<RotateCcw className="h-5 w-5 text-indigo-600" />}
                />
                <StatCard
                  label="Expiring soon"
                  value={dashboard.expiring_soon}
                  sub="Active · ends within 30 days"
                  accent="bg-yellow-50"
                  icon={<AlertTriangle className="h-5 w-5 text-yellow-600" />}
                />
              </div>

              {overview ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <StatCard label="Total purchases (all time)" value={overview.total_memberships} />
                  <StatCard label="Active (all time)" value={overview.active_memberships} />
                  <StatCard label="Expired / inactive" value={overview.expired_memberships} />
                </div>
              ) : null}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-3">Daily signups</h3>
                  <MiniBarChart data={dashboard.daily_signups} />
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-3">Plan breakdown</h3>
                  {dashboard.plan_breakdown.length === 0 ? (
                    <p className="text-sm text-gray-400 py-6 text-center">No purchases in period</p>
                  ) : (
                    <div className="space-y-2">
                      {dashboard.plan_breakdown.map((p) => (
                        <div
                          key={p.plan_name}
                          className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2"
                        >
                          <div>
                            <div className="font-bold text-violet-900">{p.plan_name}</div>
                            <div className="text-xs text-gray-500">{p.count} purchase{p.count === 1 ? '' : 's'}</div>
                          </div>
                          <div className="font-extrabold text-gray-900">{inr(p.revenue_inr)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-3">Benefits claimed</h3>
                  {dashboard.benefit_breakdown.length === 0 ? (
                    <p className="text-sm text-gray-400 py-6 text-center">No benefits claimed in period</p>
                  ) : (
                    <div className="space-y-2">
                      {dashboard.benefit_breakdown.map((b) => (
                        <button
                          key={b.benefit_code}
                          type="button"
                          onClick={() => void openBenefitClaims(b)}
                          className="w-full flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-left hover:bg-amber-50 hover:border-amber-200 transition-colors cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-amber-900">{b.title}</div>
                            <div className="text-xs text-gray-500">{b.benefit_code} · Tap to view claims</div>
                          </div>
                          <div className="font-extrabold text-gray-900">{b.count}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-3">Purchase source</h3>
                  {dashboard.source_breakdown.length === 0 ? (
                    <p className="text-sm text-gray-400 py-6 text-center">No purchases in period</p>
                  ) : (
                    <div className="space-y-2">
                      {dashboard.source_breakdown.map((s) => (
                        <div
                          key={s.source}
                          className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2"
                        >
                          <div>
                            <div className="font-bold text-gray-900">{fmtSourceLabel(s.source)}</div>
                            <div className="text-xs text-gray-500">{s.count} purchase{s.count === 1 ? '' : 's'}</div>
                          </div>
                          <div className="font-extrabold text-gray-900">{inr(s.revenue_inr)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-4">
          <div className={`flex-1 min-w-0 ${selectedId ? 'xl:max-w-[62%]' : ''}`}>
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Name, phone, plan, car number..."
                    className="w-full rounded-xl border border-gray-200 pl-10 pr-3 py-2 text-sm"
                  />
                </div>
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
                >
                  <option value="ACTIVE">Active only</option>
                  <option value="ALL">All memberships</option>
                  <option value="EXPIRED">Expired / inactive</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3">Plan / Amount</th>
                      <th className="px-3 py-3">Purchased</th>
                      <th className="px-3 py-3">Start</th>
                      <th className="px-3 py-3">End</th>
                      <th className="px-3 py-3">Vehicle profile</th>
                      <th className="px-3 py-3">Wallet</th>
                      <th className="px-3 py-3">Benefits</th>
                      <th className="px-3 py-3">Services</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                          Loading...
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                          No membership customers found
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const active = selectedId === row.membership_id;
                        return (
                          <tr
                            key={row.membership_id}
                            onClick={() => setSelectedId(row.membership_id)}
                            className={`border-t border-gray-100 cursor-pointer hover:bg-violet-50/50 ${active ? 'bg-violet-50' : ''}`}
                          >
                            <td className="px-3 py-3">
                              <div className="font-bold text-gray-900">{row.customer_name}</div>
                              <div className="text-xs text-gray-500">{row.phone}</div>
                              {row.email ? <div className="text-[11px] text-gray-400 truncate max-w-[140px]">{row.email}</div> : null}
                              {row.app_platform ? (
                                <span
                                  className={`inline-block mt-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${appPlatformBadgeClass(row.app_platform as any)}`}
                                >
                                  {appPlatformLabel(row.app_platform as any)}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-semibold text-violet-800">{row.plan_name}</div>
                              <div className="text-xs font-bold text-gray-800">{inr(row.plan_price)}</div>
                              <span
                                className={`inline-block mt-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                  row.is_live ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {row.is_live ? 'Active' : row.status}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                              {fmtDateShort(row.created_at)}
                            </td>
                            <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                              {fmtDateShort(row.starts_at)}
                            </td>
                            <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                              {fmtDateShort(row.ends_at)}
                            </td>
                            <td className="px-3 py-3">
                              <VehicleProfileCell vehicle={row.vehicle} />
                              {row.second_vehicle ? (
                                <div className="mt-1 text-[10px] font-semibold text-amber-700">2nd: {row.second_vehicle}</div>
                              ) : null}
                            </td>
                            <td className="px-3 py-3 font-semibold text-blue-700">{inr(row.wallet_balance)}</td>
                            <td className="px-3 py-3 text-xs">
                              <div className="font-semibold text-gray-800">{row.benefits_claimed} claimed</div>
                              <div className="text-gray-500">
                                {row.benefits_claimable} claimable
                                {row.benefits_remaining != null ? ` · ${row.benefits_remaining} left` : ''}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-xs">
                              <div className="font-semibold text-orange-700">{row.services_booked_count} booked</div>
                              {row.last_service ? (
                                <div className="text-gray-600 mt-1">
                                  <div className="truncate max-w-[130px]" title={row.last_service.label}>
                                    {row.last_service.label}
                                  </div>
                                  <div className="font-bold text-emerald-700">{inr(row.last_service.amount)}</div>
                                </div>
                              ) : (
                                <div className="text-gray-400 mt-1">—</div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-3">
                <span className="text-xs text-gray-500">
                  Page {page} of {totalPages} · {total} total · {rangeLabel}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border px-2 py-1 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border px-2 py-1 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {selectedId ? (
            <div className="xl:w-[38%] rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 bg-violet-50">
                <div>
                  <h2 className="font-bold text-gray-900">{selectedRow?.customer_name || 'Member'}</h2>
                  <p className="text-xs text-gray-500">{selectedRow?.phone}</p>
                  {detail?.customer?.email ? (
                    <p className="text-xs text-gray-500">{detail.customer.email}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void handleDeleteMembership()}
                    disabled={deleting}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    title="Remove membership record"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-2 hover:bg-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {detailLoading || !detail ? (
                <div className="p-8 text-center text-gray-400">Loading details...</div>
              ) : (
                <div className="p-4 space-y-5 max-h-[78vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-violet-50 p-3">
                      <div className="text-xs text-violet-700">Plan</div>
                      <div className="font-extrabold text-violet-900">{detail.membership?.plan?.name}</div>
                      <div className="text-xs text-violet-700 mt-1">
                        {detail.membership?.plan?.membership_type} · {inr(Number(detail.membership?.plan?.price || 0))}
                      </div>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-3">
                      <div className="text-xs text-blue-700">Wallet balance</div>
                      <div className="font-extrabold text-blue-900">{inr(detail.wallet?.current_balance || 0)}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border p-3 text-sm space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">Status</span>
                      <span className={`font-bold ${detail.membership?.is_live ? 'text-emerald-700' : 'text-gray-600'}`}>
                        {detail.membership?.is_live ? 'Active' : detail.membership?.status}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">Purchased</span>
                      <span className="font-semibold">{fmtDateShort(detail.membership?.created_at)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">Start date</span>
                      <span className="font-semibold">{fmtDateShort(detail.membership?.starts_at)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">End date</span>
                      <span className="font-semibold">{fmtDateShort(detail.membership?.ends_at)}</span>
                    </div>
                    {detail.membership?.source ? (
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-500">Source</span>
                        <span className="font-semibold">{detail.membership.source}</span>
                      </div>
                    ) : null}
                  </div>

                  {detail.membership?.vehicle ? (
                    <div>
                      <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        Covered vehicles
                      </h3>
                      <div className="space-y-2">
                        <VehicleDetailBlock title="Primary vehicle" vehicle={detail.membership.vehicle} />
                        {detail.membership?.second_vehicle_details?.vehicle_number ||
                        detail.membership?.has_second_car ? (
                          <VehicleDetailBlock
                            title="Second vehicle"
                            vehicle={
                              detail.membership.second_vehicle_details?.vehicle_number
                                ? detail.membership.second_vehicle_details
                                : {
                                    make: null,
                                    model: null,
                                    vehicle_number: detail.membership.second_vehicle,
                                    year: null,
                                    vin: null,
                                    odometer_km: null,
                                    insurance_expiry: null,
                                    fuel_type: null,
                                  }
                            }
                          />
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {(detail.vehicles || []).length > 0 ? (
                    <div>
                      <h3 className="font-bold text-gray-800 mb-2">All saved vehicles</h3>
                      <div className="space-y-2">
                        {detail.vehicles.map((v: any) => (
                          <div key={v.id} className="rounded-xl border p-3 text-xs text-gray-600">
                            <div className="font-bold text-gray-900">
                              {v.vehicle_number || 'No plate'}
                              {v.is_default ? ' · Default' : ''}
                            </div>
                            <div>{[v.make, v.model || v.model_name].filter(Boolean).join(' ')}</div>
                            <div>
                              {v.year ? `Year ${v.year}` : ''}
                              {v.fuel_type ? ` · ${v.fuel_type}` : ''}
                              {v.odometer_km != null ? ` · ${v.odometer_km} km` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Service bookings ({detail.service_bookings?.length || 0})
                    </h3>
                    {(detail.service_bookings || []).length === 0 ? (
                      <p className="text-sm text-gray-400">No service bookings yet</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.service_bookings.map((s: any) => (
                          <div key={s.id} className="rounded-xl border p-3 text-sm">
                            <div className="flex justify-between gap-2">
                              <div className="font-bold">{s.service_display || s.service_type || 'Service'}</div>
                              <div className="font-extrabold text-emerald-700">{inr(s.payment_amount)}</div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{fmtDate(s.created_at)}</div>
                            {s.lead_number ? (
                              <div className="text-xs font-semibold text-violet-700 mt-1">
                                #{s.lead_number}
                                {s.status ? ` · ${s.status}` : ''}
                              </div>
                            ) : null}
                            {s.vehicle_number ? (
                              <div className="text-xs text-gray-600 mt-0.5">{s.vehicle_number}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                      <Gift className="h-4 w-4" />
                      Benefits — claimed &amp; remaining
                    </h3>
                    <div className="space-y-2">
                      {(detail.benefits || []).map((b: any) => (
                        <div key={b.benefit_code} className="rounded-xl border p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold">{b.title}</div>
                              <div className="text-xs text-gray-500">{b.benefit_code}</div>
                            </div>
                            <span
                              className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                b.claimable
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : b.show_claim_button
                                    ? 'bg-gray-100 text-gray-600'
                                    : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {b.status_label}
                            </span>
                          </div>
                          {b.show_claim_button ? (
                            <div className="mt-2 text-xs text-gray-600 flex flex-wrap gap-3">
                              <span>
                                Used: <strong>{b.used_count}</strong>
                                {b.max_usage != null ? ` / ${b.max_usage}` : ''}
                              </span>
                              {b.remaining != null ? (
                                <span>
                                  Remaining: <strong>{b.remaining}</strong>
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Claim history
                    </h3>
                    {(detail.claim_history || []).length === 0 ? (
                      <p className="text-sm text-gray-400">No benefits claimed yet</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.claim_history.map((h: any) => (
                          <div key={h.id} className="rounded-xl border p-3 text-sm">
                            <div className="font-bold">{h.benefit_title || h.benefit_code}</div>
                            <div className="text-xs text-gray-500 mt-1">{fmtDate(h.created_at)}</div>
                            {h.vehicle_label || h.vehicle_number ? (
                              <div className="text-xs text-gray-600 mt-1">
                                {h.vehicle_label || h.vehicle_number}
                              </div>
                            ) : null}
                            {h.lead_number ? (
                              <div className="text-xs font-semibold text-violet-700 mt-1">
                                Booking #{h.lead_number}
                                {h.lead_status ? ` · ${h.lead_status}` : ''}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Link
                    href={`${dashboardBase}/customer-insights`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:underline"
                  >
                    Open App Customers (search {selectedRow?.phone || 'phone'}) →
                  </Link>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {benefitModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeBenefitModal}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 bg-amber-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Gift className="h-5 w-5 text-amber-600" />
                  {benefitModal.title}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {benefitModal.benefit_code} · {benefitModal.range_label}
                  {platformFilter !== 'ALL' ? ` · ${platformFilterLabel(platformFilter)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={closeBenefitModal}
                className="rounded-lg p-2 hover:bg-white text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-5">
              {benefitModalLoading ? (
                <div className="py-12 text-center text-gray-400 flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading claims...
                </div>
              ) : benefitModal.claims.length === 0 ? (
                <p className="py-12 text-center text-gray-400">No claims found in this period</p>
              ) : (
                <div className="space-y-3">
                  {benefitModal.claims.map((claim) => (
                    <div key={claim.id} className="rounded-xl border border-gray-100 p-4 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-gray-900">{claim.customer_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{claim.phone}</div>
                          {claim.plan_name ? (
                            <div className="text-xs text-violet-700 font-semibold mt-1">{claim.plan_name}</div>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">{fmtDate(claim.created_at)}</div>
                          {claim.app_platform ? (
                            <span
                              className={`inline-block mt-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${appPlatformBadgeClass(claim.app_platform as any)}`}
                            >
                              {appPlatformLabel(claim.app_platform as any)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {claim.vehicle_number || claim.vehicle_label ? (
                        <div className="mt-2 text-xs text-gray-600 flex items-center gap-1.5">
                          <Car className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {[claim.vehicle_label, claim.vehicle_number].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                      ) : null}
                      {claim.lead_number ? (
                        <div className="mt-2 text-xs font-semibold text-violet-700">
                          Booking #{claim.lead_number}
                          {claim.lead_status ? ` · ${claim.lead_status}` : ''}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
