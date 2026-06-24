'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  combineOfferWindowMinutes,
  formatOfferWindowLabel,
  splitOfferWindowMinutes,
} from '@/lib/post-booking-membership-config';
import Link from 'next/link';
import { Clock3, Crown, Download, RefreshCw, Save, Search, Timer, Ban } from 'lucide-react';
import { toast } from 'react-hot-toast';

type Config = {
  enabled: boolean;
  offer_window_minutes: number;
  bundle_discount_percent: number;
  bundle_discount_max_inr: number;
  card_title: string;
  fomo_message: string;
  show_on_home: boolean;
  show_on_account: boolean;
  show_on_order_history: boolean;
  show_on_booking_success: boolean;
};

type AdminRow = {
  lead_id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  vehicle_number: string;
  created_at: string;
  lead_status: string;
  offer_status: 'active' | 'expired' | 'paid' | 'revoked';
  expires_at: string | null;
  bundle_discount: number;
  service_subtotal: number;
  membership_payable: number | null;
  booking_amount: number;
};

type Stats = {
  active: number;
  expired: number;
  paid: number;
  revoked: number;
  total: number;
  conversion_rate: number;
};

const DEFAULT_CONFIG: Config = {
  enabled: true,
  offer_window_minutes: 180,
  bundle_discount_percent: 5,
  bundle_discount_max_inr: 250,
  card_title: 'Keep your booking discount',
  fomo_message:
    'Activate Prime before the timer ends - or your special booking price will be removed.',
  show_on_home: true,
  show_on_account: true,
  show_on_order_history: true,
  show_on_booking_success: true,
};

const STATUS_STYLES: Record<AdminRow['offer_status'], string> = {
  active: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-700',
  paid: 'bg-green-100 text-green-700',
  revoked: 'bg-amber-100 text-amber-800',
};

function inr(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '-';
  return `₹${Math.round(Number(value)).toLocaleString('en-IN')}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function exportOffersToCsv(rows: AdminRow[], filterLabel: string) {
  if (rows.length === 0) {
    toast.error('No offers to export');
    return;
  }

  const header = [
    'Booking ID',
    'Booked At',
    'Customer Name',
    'Phone',
    'Vehicle',
    'Status',
    'Bundle Discount',
    'Expires At',
    'Prime Pay',
    'Booking Amount',
    'Lead Status',
  ];

  const lines = rows.map((row) =>
    [
      row.lead_number,
      formatDate(row.created_at),
      row.customer_name,
      row.customer_phone,
      row.vehicle_number,
      row.offer_status,
      row.bundle_discount,
      formatDate(row.expires_at),
      row.membership_payable ?? '',
      row.booking_amount,
      row.lead_status,
    ]
      .map(csvEscape)
      .join(','),
  );

  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `post-booking-prime-offers-${filterLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${rows.length} offer${rows.length === 1 ? '' : 's'}`);
}

export default function PostBookingMembershipAdminApp() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    active: 0,
    expired: 0,
    paid: 0,
    revoked: 0,
    total: 0,
    conversion_rate: 0,
  });
  const [membershipListPrice, setMembershipListPrice] = useState(699);
  const [filter, setFilter] = useState<'all' | AdminRow['offer_status']>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async (query = searchQuery) => {
    setLoading(true);
    try {
      const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
      const res = await fetch(`/api/super_admin/post-booking-membership${params}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load settings');
      setConfig({ ...DEFAULT_CONFIG, ...(json.config || {}) });
      setRows(Array.isArray(json.rows) ? json.rows : []);
      setStats({
        active: Number(json.stats?.active || 0),
        expired: Number(json.stats?.expired || 0),
        paid: Number(json.stats?.paid || 0),
        revoked: Number(json.stats?.revoked || 0),
        total: Number(json.stats?.total || 0),
        conversion_rate: Number(json.stats?.conversion_rate || 0),
      });
      setMembershipListPrice(Number(json.membership_list_price || 699));
    } catch (err: any) {
      toast.error(err?.message || 'Could not load post-booking membership panel');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((row) => row.offer_status === filter);
  }, [filter, rows]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/super_admin/post-booking-membership', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      setConfig({ ...DEFAULT_CONFIG, ...(json.config || {}) });
      toast.success('Post-booking Prime offer settings saved');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const revokeOffer = async (row: AdminRow) => {
    if (row.offer_status !== 'active') return;
    const ok = window.confirm(
      `Revoke Prime offer for #${row.lead_number}? Booking discount will be removed and pay card will hide in the app.`,
    );
    if (!ok) return;

    setRevokingId(row.lead_id);
    try {
      const res = await fetch('/api/super_admin/post-booking-membership/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: row.lead_id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Revoke failed');
      toast.success('Offer revoked successfully');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Could not revoke offer');
    } finally {
      setRevokingId(null);
    }
  };

  const exampleDiscount = Math.min(
    Math.round(3750 * (config.bundle_discount_percent / 100)),
    config.bundle_discount_max_inr,
  );
  const windowParts = splitOfferWindowMinutes(config.offer_window_minutes);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Crown className="h-4 w-4" />
              Membership
            </div>
            <h1 className="mt-1 text-2xl font-black text-gray-900">Post-Booking Prime Offer</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Timer upsell after booking. Prime list price{' '}
              <Link href="/dashboard/super_admin/membership-plans" className="font-semibold text-blue-600 hover:underline">
                {inr(membershipListPrice)}
              </Link>{' '}
              from Membership Plans.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[380px_1fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wide text-gray-500">Offer Settings</h2>

            <label className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div>
                <div className="text-sm font-bold text-gray-900">Enable offer</div>
                <div className="text-xs text-gray-500">Master switch for post-booking Prime upsell</div>
              </div>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
            </label>

            <div className="mt-4 space-y-4">
              <div>
                <span className="text-sm font-bold text-gray-900">Timer window</span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  How long customer can pay & keep booking discount
                </span>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">Hours</span>
                    <input
                      type="number"
                      min={0}
                      max={72}
                      value={windowParts.hours}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          offer_window_minutes: combineOfferWindowMinutes(
                            Number(e.target.value) || 0,
                            splitOfferWindowMinutes(prev.offer_window_minutes).minutes,
                          ),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">Minutes</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={windowParts.minutes}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          offer_window_minutes: combineOfferWindowMinutes(
                            splitOfferWindowMinutes(prev.offer_window_minutes).hours,
                            Number(e.target.value) || 0,
                          ),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                </div>
                <span className="mt-2 block text-xs font-semibold text-red-700">
                  Total: {formatOfferWindowLabel(config.offer_window_minutes)}
                </span>
              </div>
              <Field
                label="Bundle discount %"
                value={config.bundle_discount_percent}
                onChange={(value) =>
                  setConfig((prev) => ({ ...prev, bundle_discount_percent: Number(value) || 1 }))
                }
                min={1}
                max={50}
              />
              <Field
                label="Max bundle discount (₹)"
                value={config.bundle_discount_max_inr}
                onChange={(value) =>
                  setConfig((prev) => ({ ...prev, bundle_discount_max_inr: Number(value) || 1 }))
                }
                min={1}
                max={5000}
              />
            </div>

            <div className="mt-5 rounded-xl bg-red-50 p-4 text-xs leading-5 text-red-900">
              Example on ₹3,750 booking: bundle off {inr(exampleDiscount)} · Prime pay{' '}
              {inr(Math.max(0, membershipListPrice - exampleDiscount))} within{' '}
              {formatOfferWindowLabel(config.offer_window_minutes)}.
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wide text-gray-500">App Copy</h2>
            <div className="mt-4 space-y-4">
              <TextField
                label="Card heading"
                value={config.card_title}
                onChange={(value) => setConfig((prev) => ({ ...prev, card_title: value }))}
                maxLength={120}
              />
              <TextAreaField
                label="FOMO message"
                value={config.fomo_message}
                onChange={(value) => setConfig((prev) => ({ ...prev, fomo_message: value }))}
                maxLength={280}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wide text-gray-500">Show On</h2>
            <div className="mt-4 space-y-3">
              <ToggleRow
                label="Booking success screen"
                checked={config.show_on_booking_success}
                onChange={(checked) => setConfig((prev) => ({ ...prev, show_on_booking_success: checked }))}
              />
              <ToggleRow
                label="Home page"
                checked={config.show_on_home}
                onChange={(checked) => setConfig((prev) => ({ ...prev, show_on_home: checked }))}
              />
              <ToggleRow
                label="Account page"
                checked={config.show_on_account}
                onChange={(checked) => setConfig((prev) => ({ ...prev, show_on_account: checked }))}
              />
              <ToggleRow
                label="Order History & details"
                checked={config.show_on_order_history}
                onChange={(checked) => setConfig((prev) => ({ ...prev, show_on_order_history: checked }))}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Active now" value={stats.active} tone="red" />
            <StatCard label="Paid" value={stats.paid} tone="green" />
            <StatCard label="Expired" value={stats.expired} tone="gray" />
            <StatCard label="Revoked" value={stats.revoked} tone="amber" />
            <StatCard label="Conversion" value={`${stats.conversion_rate}%`} tone="blue" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gray-50/60 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h2 className="text-base font-black text-gray-900">Recent offers (last 30 days)</h2>
                  <p className="mt-0.5 text-xs text-gray-500">{stats.total} total tracked offers</p>
                </div>

                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:max-w-xl">
                  <form
                    className="flex min-w-0 flex-1 items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setSearchQuery(searchInput.trim());
                      load(searchInput.trim());
                    }}
                  >
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search booking, phone, vehicle…"
                        className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                      />
                    </div>
                    <button
                      type="submit"
                      className="shrink-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50"
                    >
                      Search
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => exportOffersToCsv(filteredRows, filter)}
                    disabled={loading || filteredRows.length === 0}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(['all', 'active', 'paid', 'expired', 'revoked'] as const).map((key) => {
                  const count =
                    key === 'all'
                      ? rows.length
                      : rows.filter((row) => row.offer_status === key).length;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                        filter === key
                          ? 'bg-gray-900 text-white shadow-sm'
                          : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {key}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                          filter === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-sm">
                <thead className="border-b border-gray-200 bg-white text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="whitespace-nowrap px-5 py-3.5">Booking</th>
                    <th className="whitespace-nowrap px-5 py-3.5">Customer</th>
                    <th className="whitespace-nowrap px-5 py-3.5">Status</th>
                    <th className="whitespace-nowrap px-5 py-3.5">Expires</th>
                    <th className="whitespace-nowrap px-5 py-3.5 text-right">Prime pay</th>
                    <th className="whitespace-nowrap px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center text-sm text-gray-500">
                        Loading…
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center">
                        <div className="mx-auto max-w-xs text-sm text-gray-500">No offers found.</div>
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.lead_id} className="transition-colors hover:bg-gray-50/70">
                        <td className="whitespace-nowrap px-5 py-4 align-top">
                          <div className="font-bold text-gray-900">#{row.lead_number}</div>
                          <div className="mt-1 text-xs leading-5 text-gray-500">{formatDate(row.created_at)}</div>
                          <div className="text-xs leading-5 text-gray-500">Booking {inr(row.booking_amount)}</div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="max-w-[180px] truncate font-semibold text-gray-900">
                            {row.customer_name || '-'}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-gray-500">{row.customer_phone || '-'}</div>
                          <div className="max-w-[180px] truncate text-xs leading-5 text-gray-500">
                            {row.vehicle_number || '-'}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 align-top">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${STATUS_STYLES[row.offer_status]}`}
                          >
                            {row.offer_status}
                          </span>
                          <div className="mt-2 text-xs text-gray-500">Bundle off {inr(row.bundle_discount)}</div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 align-top">
                          {row.offer_status === 'active' ? (
                            <span className="inline-flex max-w-[190px] items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold leading-5 text-red-700 ring-1 ring-red-100">
                              <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{formatDate(row.expires_at)}</span>
                            </span>
                          ) : (
                            <span className="text-xs leading-5 text-gray-600">{formatDate(row.expires_at)}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right align-top">
                          <span className="text-base font-bold tabular-nums text-gray-900">
                            {inr(row.membership_payable)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right align-top">
                          <div className="inline-flex flex-col items-end gap-2">
                            <Link
                              href={`/dashboard/super_admin/bookings?lead=${encodeURIComponent(row.lead_number)}`}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                            >
                              Open booking
                            </Link>
                            {row.offer_status === 'active' ? (
                              <button
                                type="button"
                                onClick={() => revokeOffer(row)}
                                disabled={revokingId === row.lead_id}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-60"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                {revokingId === row.lead_id ? 'Revoking…' : 'Revoke offer'}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: string) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-gray-900">{label}</span>
      {hint ? <span className="mt-0.5 block text-xs text-gray-500">{hint}</span> : null}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-gray-900">{label}</span>
      <input
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-gray-900">{label}</span>
      <textarea
        value={value}
        maxLength={maxLength}
        rows={4}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm leading-5 text-gray-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
      />
      <span className="mt-1 block text-[11px] text-gray-400">{value.length}/{maxLength}</span>
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
      <span className="text-sm font-semibold text-gray-800">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
      />
    </label>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: 'red' | 'green' | 'gray' | 'amber' | 'blue';
}) {
  const toneClass =
    tone === 'red'
      ? 'border-red-100 bg-red-50 text-red-700'
      : tone === 'green'
        ? 'border-green-100 bg-green-50 text-green-700'
        : tone === 'amber'
          ? 'border-amber-100 bg-amber-50 text-amber-800'
          : tone === 'blue'
            ? 'border-blue-100 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-white text-gray-700';

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClass}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-80">
        <Clock3 className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}
