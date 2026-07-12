'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Smartphone,
  Search,
  Wallet,
  Crown,
  Ticket,
  ClipboardList,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  User,
  Car,
  ShieldBan,
  ShieldOff,
  ShieldCheck,
  Plus,
  Minus,
} from 'lucide-react';
import { appPlatformBadgeClass, appPlatformLabel } from '@/lib/app-platform';
import {
  customerAccountStatusBadgeClass,
  customerAccountStatusLabel,
  type CustomerAccountStatus,
} from '@/lib/customer-account-admin';
import ExportDateRangeMenu from '@/components/admin/ExportDateRangeMenu';
import { getLeadServiceLabel, getLeadVehicleLabel, getLeadPricingBreakdown } from '@/lib/booking-lead-utils';
import { resolveReportDateRange, type ReportDatePreset } from '@/lib/report-date-range';

type Overview = {
  total_customers: number;
  android_users: number;
  ios_users: number;
  unknown_platform_users: number;
  customers_with_wallet_balance: number;
  total_wallet_balance: number;
  active_memberships: number;
  total_service_bookings: number;
  bookings_with_coupon: number;
  coupon_redemptions: number;
  open_coupon_assignments: number;
};

type AppPlatform = 'ANDROID' | 'IOS' | null;

type CustomerRow = {
  id: string;
  phone: string;
  email?: string | null;
  full_name?: string | null;
  last_login_at?: string | null;
  created_at: string;
  wallet_balance: number;
  bookings_count: number;
  coupon_bookings_count: number;
  coupon_assigned_count: number;
  coupon_redeemed_count: number;
  has_membership: boolean;
  membership_plan?: string | null;
  membership_plan_code?: string | null;
  membership_type?: string | null;
  is_app_user: boolean;
  app_platform?: AppPlatform;
  account_status?: CustomerAccountStatus;
};

type DetailTab = 'profile' | 'bookings' | 'wallet' | 'membership' | 'coupons';

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

function toDateTimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isPrimeMembership(customer?: {
  membership_type?: string | null;
  membership_plan?: string | null;
  membership_plan_code?: string | null;
} | null) {
  if (!customer) return false;
  const parts = [
    customer.membership_type,
    customer.membership_plan,
    customer.membership_plan_code,
  ]
    .map((v) => String(v || '').trim().toUpperCase())
    .filter(Boolean);
  return parts.some((v) => v.includes('PRIME'));
}

function membershipCrownClass(customer?: {
  membership_type?: string | null;
  membership_plan?: string | null;
  membership_plan_code?: string | null;
} | null) {
  return isPrimeMembership(customer) ? 'text-violet-600' : 'text-amber-500';
}

function buildDefaultActivateDates(plan?: { duration_days?: number | null }) {
  const start = new Date();
  const durationDays = Number(plan?.duration_days || 365);
  const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
  return {
    start: toDateTimeLocalValue(start),
    end: toDateTimeLocalValue(end),
  };
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-gray-900">{value}</p>
          {sub ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : null}
        </div>
        <div className="rounded-xl bg-blue-50 p-2 text-blue-600">{icon}</div>
      </div>
    </div>
  );
}

export default function CustomerInsightsApp() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [platform, setPlatform] = useState('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('profile');
  const [error, setError] = useState<string | null>(null);
  const [membershipPlans, setMembershipPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [activatePlanId, setActivatePlanId] = useState('');
  const [activateSecondCar, setActivateSecondCar] = useState(false);
  const [activateNotes, setActivateNotes] = useState('');
  const [activateStartDate, setActivateStartDate] = useState('');
  const [activateEndDate, setActivateEndDate] = useState('');
  const [activateLoading, setActivateLoading] = useState(false);
  const [activateMessage, setActivateMessage] = useState<string | null>(null);
  const [accountReason, setAccountReason] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [walletCreditAmount, setWalletCreditAmount] = useState('');
  const [walletCreditNote, setWalletCreditNote] = useState('');
  const [walletCreditLoading, setWalletCreditLoading] = useState(false);
  const [walletCreditMessage, setWalletCreditMessage] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<ReportDatePreset>('all_time');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const reloadDetail = useCallback(async (customerId: string) => {
    const res = await fetch(`/api/super_admin/customers/${customerId}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to load customer');
    setDetail(json);
    return json;
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '40',
        filter,
        platform,
        preset: datePreset,
      });
      if (datePreset === 'custom') {
        if (customStart) params.set('start', customStart);
        if (customEnd) params.set('end', customEnd);
      }
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/super_admin/customers?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load customers');

      setOverview(json.overview || null);
      setCustomers(json.customers || []);
      setTotal(json.pagination?.total || 0);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [customEnd, customStart, datePreset, filter, page, platform, search]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    (async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/super_admin/customers/${selectedId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load customer');
        if (active) setDetail(json);
      } catch (e: any) {
        if (active) setError(e?.message || 'Failed to load customer detail');
      } finally {
        if (active) setDetailLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    if (detailTab !== 'membership') return;
    let active = true;
    (async () => {
      setPlansLoading(true);
      try {
        const res = await fetch('/api/super_admin/membership-plans');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load plans');
        const plans = (json.data || []).filter((p: any) => p.active !== false);
        if (active) {
          setMembershipPlans(plans);
          setActivatePlanId((prev) => prev || (plans[0]?.id ? String(plans[0].id) : ''));
        }
      } catch {
        if (active) setMembershipPlans([]);
      } finally {
        if (active) setPlansLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [detailTab]);

  useEffect(() => {
    setActivateMessage(null);
    setAccountMessage(null);
    setWalletCreditMessage(null);
    setAccountReason('');
    setWalletCreditAmount('');
    setWalletCreditNote('');
  }, [selectedId, detailTab]);

  useEffect(() => {
    if (detailTab !== 'membership' || membershipPlans.length === 0) return;
    const plan = membershipPlans[0];
    if (!plan?.id) return;
    const defaults = buildDefaultActivateDates(plan);
    setActivatePlanId(String(plan.id));
    setActivateStartDate(defaults.start);
    setActivateEndDate(defaults.end);
    setActivateSecondCar(false);
    setActivateNotes('');
  }, [detailTab, selectedId, membershipPlans]);

  const handleActivatePlanChange = (planId: string) => {
    setActivatePlanId(planId);
    const plan = membershipPlans.find((p) => String(p.id) === planId);
    const start = activateStartDate ? new Date(activateStartDate) : new Date();
    const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const end = new Date(safeStart.getTime() + Number(plan?.duration_days || 365) * 24 * 60 * 60 * 1000);
    setActivateStartDate(toDateTimeLocalValue(safeStart));
    setActivateEndDate(toDateTimeLocalValue(end));
  };

  const activeMembership = useMemo(() => {
    const now = Date.now();
    return (detail?.memberships || []).find(
      (m: any) =>
        m.status === 'ACTIVE' && new Date(String(m.ends_at || 0)).getTime() > now,
    );
  }, [detail?.memberships]);

  const handleManualActivate = async () => {
    if (!selectedId || !activatePlanId) return;

    const startsAt = new Date(activateStartDate);
    const endsAt = new Date(activateEndDate);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setError('Please enter valid start and end dates');
      return;
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      setError('End date must be after start date');
      return;
    }

    setActivateLoading(true);
    setActivateMessage(null);
    setError(null);
    try {
      const primaryVehicle = detail?.vehicles?.[0];
      const res = await fetch(`/api/super_admin/customers/${selectedId}/membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: activatePlanId,
          add_second_car: activateSecondCar,
          notes: activateNotes.trim() || null,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          primary_vehicle_id: primaryVehicle?.id || null,
          primary_vehicle_snapshot: primaryVehicle
            ? {
                vehicle_number: primaryVehicle.vehicle_number,
                make: primaryVehicle.make,
                model: primaryVehicle.model,
                vehicle_id: primaryVehicle.id,
              }
            : {},
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.details || 'Activation failed');

      await reloadDetail(selectedId);
      await fetchList();
      setActivateNotes('');
      setActivateMessage(
        `Membership activated: ${json.membership?.plan?.name || 'Plan'} · ${fmtDate(json.starts_at)} → ${fmtDate(json.ends_at)}`,
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to activate membership');
    } finally {
      setActivateLoading(false);
    }
  };

  const handleAccountAction = async (action: 'deactivate' | 'ban' | 'reactivate') => {
    if (!selectedId) return;

    if (action === 'ban' && !accountReason.trim()) {
      setError('Ban reason required');
      return;
    }

    const confirmText =
      action === 'ban'
        ? 'Ban this customer? They will be logged out and cannot login again.'
        : action === 'deactivate'
          ? 'Deactivate this account? They will be logged out immediately.'
          : 'Reactivate this customer account?';

    if (!window.confirm(confirmText)) return;

    setAccountLoading(true);
    setAccountMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/super_admin/customers/${selectedId}/account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: accountReason.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Account update failed');

      await reloadDetail(selectedId);
      await fetchList();
      setAccountReason('');
      setAccountMessage(
        action === 'reactivate'
          ? 'Account reactivated successfully.'
          : action === 'ban'
            ? 'Account banned and all sessions revoked.'
            : 'Account deactivated and all sessions revoked.',
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to update account');
    } finally {
      setAccountLoading(false);
    }
  };

  const customerAccountStatus = useMemo(
    () => detail?.customer?.account_status || 'ACTIVE',
    [detail?.customer?.account_status],
  );

  const handleManualExpire = async () => {
    if (!selectedId) return;
    if (!window.confirm('Expire this customer\'s active membership now?')) return;
    setActivateLoading(true);
    setActivateMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/super_admin/customers/${selectedId}/membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'expire',
          notes: activateNotes.trim() || 'Expired from App Customers admin',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to expire membership');

      await reloadDetail(selectedId);
      await fetchList();
      setActivateMessage('Active membership expired.');
    } catch (e: any) {
      setError(e?.message || 'Failed to expire membership');
    } finally {
      setActivateLoading(false);
    }
  };

  const handleWalletAdjust = async (action: 'credit' | 'debit') => {
    if (!selectedId) return;

    const amount = Number(walletCreditAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid wallet amount');
      return;
    }

    const currentBalance = Number(
      detail?.wallet?.spendable_balance ?? detail?.wallet?.current_balance ?? 0,
    );
    if (action === 'debit' && amount > currentBalance) {
      setError(`Insufficient balance. Available: ${inr(currentBalance)}`);
      return;
    }

    const confirmText =
      action === 'credit'
        ? `Add ${inr(amount)} to this customer's wallet?`
        : `Remove ${inr(amount)} from this customer's wallet?`;

    if (!window.confirm(confirmText)) return;

    setWalletCreditLoading(true);
    setWalletCreditMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/super_admin/customers/${selectedId}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          amount,
          note: walletCreditNote.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Wallet update failed');

      await reloadDetail(selectedId);
      await fetchList();
      setWalletCreditAmount('');
      setWalletCreditNote('');

      if (json.duplicate) {
        setWalletCreditMessage('This adjustment was already applied.');
      } else if (action === 'credit') {
        setWalletCreditMessage(
          `Added ${inr(json.credited)} · New balance ${inr(json.balance_after)}`,
        );
      } else {
        setWalletCreditMessage(
          `Removed ${inr(json.debited)} · New balance ${inr(json.balance_after)}`,
        );
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to update wallet balance');
    } finally {
      setWalletCreditLoading(false);
    }
  };

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedId) || detail?.customer || null,
    [customers, selectedId, detail],
  );

  const totalPages = Math.max(1, Math.ceil(total / 40));

  const rangeLabel = useMemo(
    () => resolveReportDateRange(datePreset, customStart, customEnd).label,
    [customEnd, customStart, datePreset],
  );

  const handleExport = async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ export: '1', preset: datePreset, filter, platform });
      if (datePreset === 'custom') {
        if (customStart) params.set('start', customStart);
        if (customEnd) params.set('end', customEnd);
      }
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/super_admin/customers?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `app-customers-${datePreset}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || 'Export failed');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-blue-600" />
            App Customers
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            App install users — service bookings, coupons, wallet, membership &amp; benefit usage
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportDateRangeMenu
            preset={datePreset}
            customStart={customStart}
            customEnd={customEnd}
            onRangeChange={({ preset, customStart: start, customEnd: end }) => {
              setDatePreset(preset);
              setCustomStart(start);
              setCustomEnd(end);
              setPage(1);
            }}
            onExport={handleExport}
            disabled={loading}
          />
          <button
            type="button"
            onClick={fetchList}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {overview ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
          <StatCard label="All App Users" value={overview.total_customers} icon={<Smartphone className="h-5 w-5" />} />
          <StatCard label="Android" value={overview.android_users} icon={<Smartphone className="h-5 w-5" />} />
          <StatCard label="iOS" value={overview.ios_users} icon={<Smartphone className="h-5 w-5" />} />
          <StatCard label="Unknown Platform" value={overview.unknown_platform_users} icon={<Smartphone className="h-5 w-5" />} />
          <StatCard label="Service Bookings" value={overview.total_service_bookings} icon={<ClipboardList className="h-5 w-5" />} />
          <StatCard
            label="Coupon Bookings"
            value={overview.bookings_with_coupon}
            sub={`${overview.coupon_redemptions} redeemed · ${overview.open_coupon_assignments} open`}
            icon={<Ticket className="h-5 w-5" />}
          />
          <StatCard label="Active Memberships" value={overview.active_memberships} icon={<Crown className="h-5 w-5" />} />
          <StatCard
            label="Wallet Users"
            value={overview.customers_with_wallet_balance}
            sub={`Total ${inr(overview.total_wallet_balance)}`}
            icon={<Wallet className="h-5 w-5" />}
          />
        </div>
      ) : null}

      {datePreset !== 'all_time' ? (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
          Showing customers who joined in <strong>{rangeLabel}</strong>
          {total > 0 ? (
            <>
              {' '}
              · <strong>{total}</strong> matched
            </>
          ) : null}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['ALL', 'All Platforms'],
            ['ANDROID', 'Android'],
            ['IOS', 'iOS'],
            ['UNKNOWN', 'Unknown'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setPlatform(value);
              setPage(1);
            }}
            className={`rounded-full px-4 py-2 text-xs font-bold border ${
              platform === value
                ? value === 'ANDROID'
                  ? 'bg-green-600 text-white border-green-600'
                  : value === 'IOS'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className={`${selectedId ? 'xl:col-span-2' : 'xl:col-span-5'} space-y-4`}>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  className="w-full rounded-xl border border-gray-200 pl-10 pr-3 py-2.5 text-sm"
                  placeholder="Search name, phone, email..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <select
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All customers</option>
                <option value="WITH_BOOKING">With service booking</option>
                <option value="WITH_MEMBERSHIP">With membership</option>
                <option value="WITH_WALLET">With wallet balance</option>
                <option value="WITH_COUPON">With coupons</option>
              </select>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-gray-600">Customer</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-600">Platform</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-600">Joined</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-600">Last Login</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-600">Bookings</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-600">Wallet</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-600">Membership</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-600">Coupons</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                        Loading customers...
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                        No customers found
                      </td>
                    </tr>
                  ) : (
                    customers.map((c) => (
                      <tr
                        key={c.id}
                        className={`border-t border-gray-100 cursor-pointer hover:bg-blue-50/40 ${
                          selectedId === c.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => {
                          setSelectedId(c.id);
                          setDetailTab('profile');
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-900 flex items-center gap-1.5">
                            <span>{c.full_name || 'Unnamed'}</span>
                            {c.has_membership ? (
                              <Crown
                                className={`h-3.5 w-3.5 shrink-0 ${membershipCrownClass(c)}`}
                                title={c.membership_plan || 'Member'}
                              />
                            ) : null}
                          </div>
                          <div className="text-xs text-gray-500">{c.phone}</div>
                          {c.email ? <div className="text-[11px] text-gray-400 truncate max-w-[180px]">{c.email}</div> : null}
                          {c.account_status && c.account_status !== 'ACTIVE' ? (
                            <span
                              className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${customerAccountStatusBadgeClass(c.account_status)}`}
                            >
                              {customerAccountStatusLabel(c.account_status)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${appPlatformBadgeClass(c.app_platform || null)}`}
                          >
                            {appPlatformLabel(c.app_platform || null)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{fmtDate(c.created_at)}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{fmtDate(c.last_login_at)}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold">{c.bookings_count}</span>
                          {c.coupon_bookings_count > 0 ? (
                            <span className="ml-1 text-xs text-emerald-600">({c.coupon_bookings_count} coupon)</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-semibold text-blue-700">{inr(c.wallet_balance)}</td>
                        <td className="px-4 py-3">
                          {c.has_membership ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                                isPrimeMembership(c)
                                  ? 'bg-violet-100 text-violet-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              <Crown className={`h-3 w-3 ${membershipCrownClass(c)}`} />
                              {c.membership_plan || 'Active'}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {c.coupon_assigned_count} assigned
                          {c.coupon_redeemed_count > 0 ? ` · ${c.coupon_redeemed_count} used` : ''}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
              <span className="text-xs text-gray-500">
                Page {page} of {totalPages} · {total} total
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
          <div className="xl:col-span-3">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm sticky top-4 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span>{selectedCustomer?.full_name || detail?.customer?.full_name || 'Customer'}</span>
                    {(selectedCustomer?.has_membership || detail?.memberships?.some((m: any) => m.status === 'ACTIVE')) ? (
                      <Crown
                        className={`h-4 w-4 shrink-0 ${membershipCrownClass({
                          membership_type:
                            selectedCustomer?.membership_type ||
                            detail?.memberships?.[0]?.plan?.membership_type,
                          membership_plan:
                            selectedCustomer?.membership_plan || detail?.memberships?.[0]?.plan?.name,
                          membership_plan_code:
                            selectedCustomer?.membership_plan_code || detail?.memberships?.[0]?.plan?.code,
                        })}`}
                        title={
                          selectedCustomer?.membership_plan ||
                          detail?.memberships?.[0]?.plan?.name ||
                          'Member'
                        }
                      />
                    ) : null}
                  </h2>
                  <p className="text-sm text-gray-500">{selectedCustomer?.phone || detail?.customer?.phone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-lg p-2 hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1 border-b border-gray-100 px-3 py-2">
                {(
                  [
                    ['profile', 'Profile', User],
                    ['bookings', 'Bookings', ClipboardList],
                    ['wallet', 'Wallet', Wallet],
                    ['membership', 'Membership', Crown],
                    ['coupons', 'Coupons', Ticket],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDetailTab(id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                      detailTab === id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="overflow-y-auto p-4 flex-1">
                {detailLoading ? (
                  <div className="py-16 text-center text-gray-400">Loading details...</div>
                ) : !detail ? (
                  <div className="py-16 text-center text-gray-400">Select a customer</div>
                ) : detailTab === 'profile' ? (
                  <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">App platform</div>
                        <div className="font-semibold">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${appPlatformBadgeClass(detail.customer.app_platform || null)}`}
                          >
                            {appPlatformLabel(detail.customer.app_platform || null)}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">Email</div>
                        <div className="font-semibold">{detail.customer.email || '—'}</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">Last login</div>
                        <div className="font-semibold">{fmtDate(detail.customer.last_login_at)}</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">App installed / joined</div>
                        <div className="font-semibold">{fmtDate(detail.customer.created_at)}</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">Account status</div>
                        <div className="font-semibold">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${customerAccountStatusBadgeClass(customerAccountStatus)}`}
                          >
                            {customerAccountStatusLabel(customerAccountStatus)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/80 p-4 space-y-3">
                      <div>
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                          <ShieldBan className="h-4 w-4 text-red-600" />
                          Account Access
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Deactivate temporarily or ban permanently. User turant logout ho jayega.
                        </p>
                      </div>

                      {accountMessage ? (
                        <div className="rounded-xl bg-emerald-100 border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800">
                          {accountMessage}
                        </div>
                      ) : null}

                      {detail.customer.account_status_reason ? (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                          <span className="font-bold">Reason: </span>
                          {detail.customer.account_status_reason}
                          {detail.customer.account_status_changed_at ? (
                            <span className="block text-amber-700 mt-1">
                              Updated {fmtDate(detail.customer.account_status_changed_at)}
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      <label className="block text-xs font-semibold text-gray-700">
                        Reason {customerAccountStatus === 'ACTIVE' ? '(required for ban)' : '(optional)'}
                        <input
                          type="text"
                          value={accountReason}
                          onChange={(e) => setAccountReason(e.target.value)}
                          disabled={accountLoading}
                          placeholder="e.g. Fraud, abuse, duplicate account..."
                          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                        />
                      </label>

                      <div className="flex flex-wrap gap-2">
                        {customerAccountStatus === 'ACTIVE' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAccountAction('deactivate')}
                              disabled={accountLoading}
                              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                            >
                              <ShieldOff className="h-4 w-4" />
                              {accountLoading ? 'Working...' : 'Deactivate'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAccountAction('ban')}
                              disabled={accountLoading}
                              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              <ShieldBan className="h-4 w-4" />
                              {accountLoading ? 'Working...' : 'Ban Account'}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAccountAction('reactivate')}
                            disabled={accountLoading}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <ShieldCheck className="h-4 w-4" />
                            {accountLoading ? 'Working...' : 'Reactivate Account'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <Car className="h-4 w-4" /> Vehicles
                      </h3>
                      {detail.vehicles?.length ? (
                        <div className="space-y-2">
                          {detail.vehicles.map((v: any) => (
                            <div key={v.id} className="rounded-xl border p-3">
                              <div className="font-bold">{v.vehicle_number}</div>
                              <div className="text-xs text-gray-500">
                                {[v.make, v.model, v.year].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-xs">No vehicles saved</p>
                      )}
                    </div>

                    {detail.analytics_events?.length ? (
                      <div>
                        <h3 className="font-bold text-gray-800 mb-2">Recent App Events</h3>
                        <div className="space-y-1">
                          {detail.analytics_events.slice(0, 8).map((ev: any) => (
                            <div key={ev.id} className="flex justify-between text-xs border-b border-gray-100 py-1.5">
                              <span className="font-medium">{ev.event_name}</span>
                              <span className="text-gray-400">{fmtDate(ev.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : detailTab === 'bookings' ? (
                  <div className="space-y-3">
                    <h3 className="font-bold text-gray-800">Service Bookings ({detail.service_bookings?.length || 0})</h3>
                    {(detail.service_bookings || []).length === 0 ? (
                      <p className="text-sm text-gray-400">No service bookings</p>
                    ) : (
                      detail.service_bookings.map((b: any) => {
                        const serviceLabel = getLeadServiceLabel(b);
                        const vehicleLabel = b.vehicle_display || getLeadVehicleLabel(b);
                        const pricing = getLeadPricingBreakdown(b, {
                          walletTxAmount: b.wallet_used,
                          walletTxPercent: b.wallet_usage_percent,
                          payableOverride: b.payment_amount,
                        });
                        const reg =
                          b.vehicle_number && String(b.vehicle_number).trim().toUpperCase() !== 'NA'
                            ? String(b.vehicle_number).trim()
                            : null;
                        return (
                        <div key={b.id} className="rounded-xl border p-3 text-sm">
                          <div className="flex justify-between gap-2">
                            <span className="font-bold">{b.lead_number || 'Lead'}</span>
                            <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5">{b.status}</span>
                          </div>
                          <div className="font-semibold text-gray-900 mt-1">{serviceLabel}</div>
                          {vehicleLabel || reg ? (
                            <div className="mt-2 flex items-start gap-2 text-xs text-gray-700">
                              <Car className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                              <div>
                                {vehicleLabel ? <div className="font-semibold">{vehicleLabel}</div> : null}
                                {reg ? <div className="text-gray-500">{reg}</div> : null}
                              </div>
                            </div>
                          ) : null}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 mt-2">
                            {b.city ? <div><span className="text-gray-400">City:</span> {b.city}</div> : null}
                            {b.booking_source_label ? <div><span className="text-gray-400">Source:</span> {b.booking_source_label}</div> : null}
                          </div>
                          {pricing.original > 0 || pricing.payable > 0 ? (
                            <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 p-2.5 space-y-1 text-xs">
                              {pricing.original > 0 ? (
                                <div className="flex justify-between gap-3">
                                  <span className="text-gray-500">Original amount</span>
                                  <span className="font-semibold text-gray-800">{inr(pricing.original)}</span>
                                </div>
                              ) : null}
                              {pricing.walletUsed > 0 ? (
                                <div className="flex justify-between gap-3 text-blue-700">
                                  <span>
                                    Wallet used
                                    {b.wallet_usage_percent
                                      ? ` (${b.wallet_usage_percent}%)`
                                      : pricing.walletUsagePercent
                                        ? ` (${pricing.walletUsagePercent}%)`
                                        : ''}
                                  </span>
                                  <span className="font-semibold">−{inr(pricing.walletUsed)}</span>
                                </div>
                              ) : null}
                              {pricing.couponDiscount > 0 ? (
                                <div className="flex justify-between gap-3 text-emerald-700">
                                  <span>Coupon discount</span>
                                  <span className="font-semibold">−{inr(pricing.couponDiscount)}</span>
                                </div>
                              ) : null}
                              <div className="flex justify-between gap-3 border-t border-gray-200 pt-1.5 mt-1">
                                <span className="font-bold text-gray-700">Payable</span>
                                <span className="font-extrabold text-emerald-700">{inr(pricing.payable)}</span>
                              </div>
                            </div>
                          ) : null}
                          <div className="text-xs text-gray-500 mt-2">{fmtDate(b.created_at)}</div>
                          {b.coupon_display_code ? (
                            <div className="mt-2 text-xs font-bold text-emerald-700">
                              Coupon: {b.coupon_display_code}
                              {b.coupon_display_discount ? ` · −${inr(b.coupon_display_discount)}` : ''}
                            </div>
                          ) : null}
                        </div>
                      );})
                    )}

                    {(detail.chatbot_bookings || []).length > 0 ? (
                      <>
                        <h3 className="font-bold text-gray-800 pt-2">AI Chatbot Bookings</h3>
                        {detail.chatbot_bookings.map((b: any) => (
                          <div key={b.id} className="rounded-xl border border-dashed p-3 text-sm">
                            <div className="font-bold">{b.service_name || 'Chatbot booking'}</div>
                            <div className="text-xs text-gray-600 mt-1">{b.car_model || '—'} · {b.city || '—'}</div>
                            {b.quoted_price ? (
                              <div className="text-xs font-bold text-emerald-700 mt-1">{inr(Number(b.quoted_price))}</div>
                            ) : null}
                            <div className="text-xs text-gray-400 mt-1">{fmtDate(b.created_at)} · {b.status || '—'}</div>
                          </div>
                        ))}
                      </>
                    ) : null}
                  </div>
                ) : detailTab === 'wallet' ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-blue-50 p-3">
                        <div className="text-xs text-blue-700">Available balance</div>
                        <div className="text-xl font-extrabold text-blue-800">
                          {inr(detail.wallet?.spendable_balance ?? detail.wallet?.current_balance ?? 0)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-3">
                        <div className="text-xs text-emerald-700">Cashback earned</div>
                        <div className="text-xl font-extrabold text-emerald-800">
                          {inr(detail.wallet?.totals?.earned_cashback ?? 0)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 p-4 space-y-3">
                      <div>
                        <h3 className="font-bold text-blue-900 flex items-center gap-2">
                          <Wallet className="h-4 w-4" />
                          Adjust Wallet Balance
                        </h3>
                        <p className="text-xs text-blue-700 mt-1">
                          Customer ke wallet mein amount add ya remove karo — app mein turant update hoga.
                        </p>
                      </div>

                      {walletCreditMessage ? (
                        <div className="rounded-xl bg-emerald-100 border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800">
                          {walletCreditMessage}
                        </div>
                      ) : null}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-semibold text-gray-700">
                          Amount (₹)
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={walletCreditAmount}
                            onChange={(e) => setWalletCreditAmount(e.target.value)}
                            disabled={walletCreditLoading}
                            placeholder="e.g. 500"
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                          />
                        </label>

                        <label className="block text-xs font-semibold text-gray-700">
                          Note (optional)
                          <input
                            type="text"
                            value={walletCreditNote}
                            onChange={(e) => setWalletCreditNote(e.target.value)}
                            disabled={walletCreditLoading}
                            placeholder="Reason — refund, correction, etc."
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                          />
                        </label>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleWalletAdjust('credit')}
                          disabled={walletCreditLoading || !walletCreditAmount}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                          {walletCreditLoading ? 'Saving…' : 'Add to Wallet'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleWalletAdjust('debit')}
                          disabled={walletCreditLoading || !walletCreditAmount}
                          className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          <Minus className="h-4 w-4" />
                          {walletCreditLoading ? 'Saving…' : 'Remove from Wallet'}
                        </button>
                      </div>
                    </div>

                    <h3 className="font-bold text-gray-800">Wallet History</h3>
                    {(detail.wallet_transactions || []).length === 0 ? (
                      <p className="text-sm text-gray-400">No transactions</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.wallet_transactions.map((tx: any) => (
                          <div key={tx.id} className="rounded-xl border p-3 text-sm flex justify-between gap-3">
                            <div>
                              <div className="font-bold">
                                {tx.transaction_type} · {tx.source}
                              </div>
                              <div className="text-xs text-gray-500">{fmtDate(tx.created_at)}</div>
                              {tx.metadata?.label ? (
                                <div className="text-xs text-gray-600 mt-1">{String(tx.metadata.label)}</div>
                              ) : null}
                            </div>
                            <div className="text-right">
                              <div
                                className={`font-extrabold ${
                                  tx.transaction_type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'
                                }`}
                              >
                                {tx.transaction_type === 'CREDIT' ? '+' : '−'}
                                {inr(tx.amount)}
                              </div>
                              <div className="text-xs text-gray-400">Bal {inr(tx.balance_after)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : detailTab === 'membership' ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/60 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-violet-900 flex items-center gap-2">
                            <Crown className="h-4 w-4" />
                            Manual Activate
                          </h3>
                          <p className="text-xs text-violet-700 mt-1">
                            Payment ho gaya par app se activate nahi hua? Yahan se turant activate karo.
                          </p>
                        </div>
                        {activeMembership ? (
                          <span className="text-[11px] font-bold rounded-full bg-amber-100 text-amber-800 px-2 py-1 shrink-0">
                            Active plan replace hogi
                          </span>
                        ) : null}
                      </div>

                      {activateMessage ? (
                        <div className="rounded-xl bg-emerald-100 border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800">
                          {activateMessage}
                        </div>
                      ) : null}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-semibold text-gray-700">
                          Membership plan
                          <select
                            value={activatePlanId}
                            onChange={(e) => handleActivatePlanChange(e.target.value)}
                            disabled={plansLoading || activateLoading}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                          >
                            {plansLoading ? <option>Loading plans...</option> : null}
                            {!plansLoading && membershipPlans.length === 0 ? (
                              <option value="">No active plans</option>
                            ) : null}
                            {membershipPlans.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} · {p.membership_type || 'SERVICE'} · ₹{Number(p.price || 0).toLocaleString('en-IN')}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block text-xs font-semibold text-gray-700">
                          Admin note (optional)
                          <input
                            type="text"
                            value={activateNotes}
                            onChange={(e) => setActivateNotes(e.target.value)}
                            disabled={activateLoading}
                            placeholder="e.g. Razorpay pay_xxx, UPI ref..."
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                          />
                        </label>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-semibold text-gray-700">
                          Start date
                          <input
                            type="datetime-local"
                            value={activateStartDate}
                            onChange={(e) => setActivateStartDate(e.target.value)}
                            disabled={activateLoading}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                          />
                        </label>

                        <label className="block text-xs font-semibold text-gray-700">
                          End date
                          <input
                            type="datetime-local"
                            value={activateEndDate}
                            onChange={(e) => setActivateEndDate(e.target.value)}
                            disabled={activateLoading}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                          />
                        </label>
                      </div>
                      <p className="text-[11px] text-violet-700">
                        End date plan duration se auto-fill hoti hai; zarurat ho to manually change kar sakte ho.
                      </p>

                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={activateSecondCar}
                          onChange={(e) => setActivateSecondCar(e.target.checked)}
                          disabled={activateLoading}
                          className="rounded border-gray-300"
                        />
                        Include 2nd car add-on
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleManualActivate}
                          disabled={activateLoading || !activatePlanId || plansLoading || !activateStartDate || !activateEndDate}
                          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                          {activateLoading ? 'Working...' : 'Activate Now'}
                        </button>
                        {activeMembership ? (
                          <button
                            type="button"
                            onClick={handleManualExpire}
                            disabled={activateLoading}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Expire Active
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <h3 className="font-bold text-gray-800">Memberships</h3>
                    {(detail.memberships || []).length === 0 ? (
                      <p className="text-sm text-gray-400">No membership purchased</p>
                    ) : (
                      detail.memberships.map((m: any) => (
                        <div key={m.id} className="rounded-xl border p-3 text-sm">
                          <div className="flex justify-between gap-2">
                            <span className="font-bold">{m.plan?.name || 'Plan'}</span>
                            <span className="text-xs rounded-full bg-violet-100 px-2 py-0.5 font-bold text-violet-700">
                              {m.status}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {m.plan?.membership_type || 'SERVICE'} · {inr(Number(m.plan?.price || 0))}
                          </div>
                          <div className="text-xs text-gray-500">
                            {fmtDate(m.starts_at)} → {fmtDate(m.ends_at)}
                          </div>
                          {m.has_second_car ? (
                            <div className="mt-1 text-xs font-semibold text-blue-700">Includes 2nd car add-on</div>
                          ) : null}
                        </div>
                      ))
                    )}

                    <h3 className="font-bold text-gray-800 pt-2">Benefits Used</h3>
                    {(detail.membership_usage || []).length === 0 ? (
                      <p className="text-sm text-gray-400">No membership benefits used yet</p>
                    ) : (
                      detail.membership_usage.map((u: any) => (
                        <div key={u.id} className="rounded-xl border p-3 text-sm flex justify-between gap-3">
                          <div>
                            <div className="font-bold">{u.benefit_title || u.benefit_code}</div>
                            <div className="text-xs text-gray-500">
                              {u.reference_type || 'USAGE'} · {fmtDate(u.created_at)}
                            </div>
                          </div>
                          {u.used_value != null ? (
                            <div className="font-extrabold text-violet-700">{inr(Number(u.used_value))}</div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-800">Assigned Coupons</h3>
                    {(detail.coupon_assignments || []).length === 0 ? (
                      <p className="text-sm text-gray-400">No personal coupons assigned</p>
                    ) : (
                      detail.coupon_assignments.map((a: any) => (
                        <div key={a.id} className="rounded-xl border p-3 text-sm">
                          <div className="font-bold">{a.coupon?.code || 'Coupon'}</div>
                          <div className="text-xs text-gray-500">{a.coupon?.description || '—'}</div>
                          <div className="text-xs mt-1">
                            Assigned {fmtDate(a.created_at)} ·{' '}
                            <span className={a.redeemed_at ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                              {a.redeemed_at ? `Redeemed ${fmtDate(a.redeemed_at)}` : 'Not used yet'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}

                    <h3 className="font-bold text-gray-800 pt-2">Checkout Redemptions</h3>
                    {(detail.coupon_redemptions || []).length === 0 ? (
                      <p className="text-sm text-gray-400">No checkout redemptions linked to this phone</p>
                    ) : (
                      detail.coupon_redemptions.map((r: any) => (
                        <div key={r.id} className="rounded-xl border p-3 text-sm flex justify-between gap-3">
                          <div>
                            <div className="font-bold">{r.coupon?.code || 'Coupon'}</div>
                            <div className="text-xs text-gray-500">{fmtDate(r.created_at)}</div>
                          </div>
                          <div className="font-extrabold text-emerald-700">
                            −{inr(Number(r.discount_amount_applied || 0))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
