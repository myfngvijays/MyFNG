'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';
import { Loader2, MapPin, RefreshCw, Clock } from 'lucide-react';

type SummaryRow = {
  telecaller_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  last_login: string | null;
  logins_in_range: number;
  logins_today: number;
  logins_mobile: number;
  logins_web: number;
};

type EventRow = {
  id: string;
  telecaller_id: string;
  telecaller_name: string;
  logged_in_at: string;
  platform: string;
  device_label: string | null;
  ip_address: string | null;
  where: string;
};

function fmtWhen(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LeadManagerLoginActivityPage() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(14);
  const [filterId, setFilterId] = useState('');
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ days: String(days), limit: '250' });
      if (filterId) q.set('telecaller_id', filterId);
      const res = await fetch(`/api/lead-manager/telecaller-logins?${q}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load');
      setSummary(json.summary || []);
      setEvents(json.events || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [days, filterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalToday = useMemo(
    () => summary.reduce((n, s) => n + (s.logins_today || 0), 0),
    [summary],
  );

  return (
    <DashboardLayout role="LEAD_MANAGER">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-[#023D95]">
              <Clock className="h-6 w-6" /> Login activity
              <PageHelpIcon href="/dashboard/lead_manager/login-activity" label="Login activity" />
            </h1>
            <p className="text-sm text-slate-500">
              Kab, kahan, kitni baar telecallers login kiye — time, location / IP, device
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
            <select
              value={filterId}
              onChange={(e) => setFilterId(e.target.value)}
              className="max-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
            >
              <option value="">All telecallers</option>
              {summary.map((s) => (
                <option key={s.telecaller_id} value={s.telecaller_id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase text-slate-500">Logins today</p>
            <p className="text-2xl font-black text-[#023D95]">{totalToday}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase text-slate-500">Telecallers</p>
            <p className="text-2xl font-black text-slate-800">{summary.length}</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-1">
            <p className="text-xs font-bold uppercase text-slate-500">Events shown</p>
            <p className="text-2xl font-black text-slate-800">{events.length}</p>
          </div>
        </div>

        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

        {loading && !summary.length ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-black text-slate-800">Per telecaller · last {days} days</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Telecaller</th>
                      <th className="px-4 py-3">Today</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Mobile / Web</th>
                      <th className="px-4 py-3">Last login</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.map((s) => (
                      <tr
                        key={s.telecaller_id}
                        className="cursor-pointer hover:bg-slate-50/80"
                        onClick={() =>
                          setFilterId(filterId === s.telecaller_id ? '' : s.telecaller_id)
                        }
                      >
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.phone || s.email || '—'}</p>
                        </td>
                        <td className="px-4 py-3 font-black text-[#023D95]">{s.logins_today}</td>
                        <td className="px-4 py-3 font-semibold">{s.logins_in_range}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {s.logins_mobile} / {s.logins_web}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                          {fmtWhen(s.last_login)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-black text-slate-800">Login timeline</h2>
                <p className="text-xs text-slate-500">Newest first · tap a name above to filter</p>
              </div>
              <ul className="divide-y divide-slate-100">
                {events.map((ev) => (
                  <li key={ev.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">{ev.telecaller_name}</p>
                      <p className="text-xs font-semibold text-slate-500">{fmtWhen(ev.logged_in_at)}</p>
                      <p className="mt-1 flex items-start gap-1 text-xs text-slate-600">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span>{ev.where}</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-left text-xs text-slate-500 sm:text-right">
                      <p className="font-bold capitalize text-slate-700">
                        {ev.platform}
                        {ev.device_label ? ` · ${ev.device_label}` : ''}
                      </p>
                      {ev.ip_address ? <p className="font-mono">IP {ev.ip_address}</p> : null}
                    </div>
                  </li>
                ))}
                {!events.length ? (
                  <li className="px-4 py-10 text-center text-sm text-slate-500">
                    No login events in this range yet. After migration + next login, rows appear here.
                  </li>
                ) : null}
              </ul>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
