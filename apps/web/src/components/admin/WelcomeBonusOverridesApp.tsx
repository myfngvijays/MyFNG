'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Gift,
  RefreshCw,
  Search,
  Smartphone,
  Users,
  CheckCircle2,
  Clock3,
  UserX,
  AlertTriangle,
  ExternalLink,
  IndianRupee,
} from 'lucide-react';
import { appPlatformBadgeClass, appPlatformLabel } from '@/lib/app-platform';

type RowStatus = 'not_logged_in' | 'logged_in_pending' | 'credited_override' | 'credited_other';

type OverrideRow = {
  phone: string;
  override_amount: number;
  status: RowStatus;
  customer_id: string | null;
  full_name: string | null;
  app_platform: string | null;
  last_login_at: string | null;
  customer_created_at: string | null;
  welcome_credited: boolean;
  welcome_amount: number | null;
  welcome_credited_at: string | null;
  welcome_expires_at: string | null;
  coupon_assigned: boolean;
  coupon_pending: boolean;
  coupon_code: string | null;
};

type Summary = {
  listed: number;
  logged_in: number;
  credited_override: number;
  credited_other: number;
  pending: number;
  not_logged_in: number;
  coupon_assigned: number;
  coupon_pending: number;
};

type FilterId = 'all' | 'logged_in' | 'credited' | 'pending' | 'not_logged_in';

function inr(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `₹${Math.round(Number(value)).toLocaleString('en-IN')}`;
}

function fmtDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_META: Record<
  RowStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  credited_override: {
    label: 'Got special amount',
    className: 'bg-emerald-100 text-emerald-800',
    icon: CheckCircle2,
  },
  credited_other: {
    label: 'Got different amount',
    className: 'bg-amber-100 text-amber-800',
    icon: AlertTriangle,
  },
  logged_in_pending: {
    label: 'Logged in · pending credit',
    className: 'bg-blue-100 text-blue-800',
    icon: Clock3,
  },
  not_logged_in: {
    label: 'Not logged in yet',
    className: 'bg-gray-100 text-gray-700',
    icon: UserX,
  },
};

export default function WelcomeBonusOverridesApp() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<OverrideRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    listed: 0,
    logged_in: 0,
    credited_override: 0,
    credited_other: 0,
    pending: 0,
    not_logged_in: 0,
    coupon_assigned: 0,
    coupon_pending: 0,
  });
  const [defaultAmount, setDefaultAmount] = useState(1000);
  const [expiryDays, setExpiryDays] = useState(90);
  const [autoCouponCode, setAutoCouponCode] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/welcome-bonus-overrides', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setRows(Array.isArray(json.rows) ? json.rows : []);
      setSummary(json.summary || {
        listed: 0,
        logged_in: 0,
        credited_override: 0,
        credited_other: 0,
        pending: 0,
        not_logged_in: 0,
        coupon_assigned: 0,
        coupon_pending: 0,
      });
      setDefaultAmount(Number(json.default_amount) || 1000);
      setExpiryDays(Number(json.expiry_days) || 90);
      setAutoCouponCode(json.auto_coupon_code ? String(json.auto_coupon_code) : null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'logged_in' && row.status === 'not_logged_in') return false;
      if (filter === 'credited' && row.status !== 'credited_override' && row.status !== 'credited_other') {
        return false;
      }
      if (filter === 'pending' && row.status !== 'logged_in_pending') return false;
      if (filter === 'not_logged_in' && row.status !== 'not_logged_in') return false;
      if (!q) return true;
      return (
        row.phone.includes(q) ||
        String(row.full_name || '')
          .toLowerCase()
          .includes(q) ||
        String(row.override_amount).includes(q)
      );
    });
  }, [rows, search, filter]);

  const filters: Array<{ id: FilterId; label: string; count: number }> = [
    { id: 'all', label: 'All listed', count: summary.listed },
    { id: 'logged_in', label: 'Logged in', count: summary.logged_in },
    { id: 'credited', label: 'Credited', count: summary.credited_override + summary.credited_other },
    { id: 'pending', label: 'Pending credit', count: summary.pending },
    { id: 'not_logged_in', label: 'Not logged in', count: summary.not_logged_in },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Smartphone className="h-4 w-4" />
              App Customers
            </div>
            <h1 className="mt-1 text-2xl font-black text-gray-900">Special Welcome Bonus</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              Phone override list se kitne users login hue, special amount (jaise ₹1500) mila ya nahi —
              default {inr(defaultAmount)} · expiry {expiryDays} days
              {autoCouponCode ? (
                <>
                  {' '}
                  · auto coupon <span className="font-semibold text-violet-700">{autoCouponCode}</span>
                </>
              ) : (
                ' · auto coupon not set'
              )}
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/super_admin/wallet-logic"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Edit phone list
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Listed phones"
            value={summary.listed}
            hint="Wallet Logic override list"
            icon={<Gift className="h-5 w-5" />}
            tone="emerald"
          />
          <StatCard
            label="Logged in"
            value={summary.logged_in}
            hint="App customer account mila"
            icon={<Users className="h-5 w-5" />}
            tone="blue"
          />
          <StatCard
            label="Got special amount"
            value={summary.credited_override}
            hint="Welcome credit = override ₹"
            icon={<IndianRupee className="h-5 w-5" />}
            tone="violet"
          />
          <StatCard
            label="Coupon in My Coupons"
            value={summary.coupon_assigned}
            hint={
              autoCouponCode
                ? `${autoCouponCode} assigned`
                : 'Set auto coupon in Wallet Logic'
            }
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="violet"
          />
          <StatCard
            label="Not logged in yet"
            value={summary.not_logged_in}
            hint={
              summary.coupon_pending > 0
                ? `${summary.coupon_pending} pending coupon on login`
                : 'List pe hain, app login nahi'
            }
            icon={<UserX className="h-5 w-5" />}
            tone="gray"
          />
        </div>

        {summary.credited_other > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {summary.credited_other} user(s) already got a different welcome amount (often default{' '}
            {inr(defaultAmount)} before override was added). Special amount dubara nahi milta.
          </div>
        ) : null}

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    filter === item.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {item.label} ({item.count})
                </button>
              ))}
            </div>
            <label className="relative block w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm"
                placeholder="Search phone / name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>

          {error ? (
            <div className="px-4 py-8 text-center text-sm text-rose-600">{error}</div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-gray-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500">
              {rows.length === 0 ? (
                <>
                  Abhi koi phone override nahi hai.{' '}
                  <Link href="/dashboard/super_admin/wallet-logic" className="font-semibold text-blue-700 hover:underline">
                    Wallet Logic
                  </Link>{' '}
                  se phones add karo.
                </>
              ) : (
                'Is filter pe koi row nahi.'
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Special ₹</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Credited</th>
                    <th className="px-4 py-3">Coupon</th>
                    <th className="px-4 py-3">Last login</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((row) => {
                    const meta = STATUS_META[row.status];
                    const Icon = meta.icon;
                    return (
                      <tr key={row.phone} className="hover:bg-gray-50/80">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900">{row.phone}</td>
                        <td className="px-4 py-3">
                          {row.customer_id ? (
                            <div>
                              <div className="font-semibold text-gray-900">
                                {row.full_name || 'App customer'}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                {row.app_platform ? (
                                  <span
                                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${appPlatformBadgeClass(row.app_platform)}`}
                                  >
                                    {appPlatformLabel(row.app_platform)}
                                  </span>
                                ) : null}
                                <Link
                                  href={`/dashboard/super_admin/customer-insights?search=${encodeURIComponent(row.phone)}`}
                                  className="text-[11px] font-semibold text-blue-700 hover:underline"
                                >
                                  Open in Customers
                                </Link>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">No app account yet</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-700">
                          {inr(row.override_amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${meta.className}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {row.welcome_credited ? (
                            <div>
                              <div className="font-semibold text-gray-900">{inr(row.welcome_amount)}</div>
                              <div className="text-[11px] text-gray-500">
                                {fmtDate(row.welcome_credited_at)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.coupon_assigned ? (
                            <span className="inline-flex rounded-full bg-violet-100 px-2 py-1 text-[11px] font-bold text-violet-800">
                              {row.coupon_code || 'Assigned'}
                            </span>
                          ) : row.coupon_pending ? (
                            <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800">
                              Pending login
                            </span>
                          ) : autoCouponCode ? (
                            <span className="text-gray-400">Not yet</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {fmtDate(row.last_login_at || row.customer_created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
  tone: 'emerald' | 'blue' | 'violet' | 'gray';
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm`}>
      <div className={`mb-3 inline-flex rounded-xl border p-2 ${tones[tone]}`}>{icon}</div>
      <div className="text-2xl font-black text-gray-900">{value}</div>
      <div className="text-sm font-semibold text-gray-800">{label}</div>
      <div className="mt-0.5 text-[11px] text-gray-500">{hint}</div>
    </div>
  );
}
