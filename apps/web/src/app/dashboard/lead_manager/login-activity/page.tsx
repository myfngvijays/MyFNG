'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';
import { Clock, Globe, Loader2, MapPin, RefreshCw, Search, Smartphone } from 'lucide-react';

type Platform = 'mobile' | 'web' | 'unknown';

type SummaryRow = {
  telecaller_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  last_login: string | null;
  logins_in_range: number;
  logins_today: number;
  logins_mobile: number;
  logins_web: number;
  logins_unknown: number;
  today_mobile: number;
  today_web: number;
  last_mobile_login: string | null;
  last_web_login: string | null;
  app_last_seen: string | null;
  app_device: string | null;
  devices: number;
  ips: number;
};

type EventRow = {
  id: string;
  telecaller_id: string;
  telecaller_name: string;
  logged_in_at: string;
  platform: Platform;
  device_label: string | null;
  ip_address: string | null;
  where: string;
};

type Totals = {
  today: number;
  today_mobile: number;
  today_web: number;
  range_mobile: number;
  range_web: number;
  telecallers: number;
  logged_in_today: number;
  app_open_today: number;
};

const RANGE_OPTIONS = [
  { value: 1, label: 'Today' },
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

function istYmd(d: Date) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Today → "Today, 01:00 pm"; older → "21 Nov, 11:18 am". */
function fmtWhen(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
  });
  if (istYmd(d) === istYmd(new Date())) return `Today, ${time}`;
  return `${d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' })}, ${time}`;
}

const TIMELINE_PAGE = 40;

function timeIst(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dayLabel(ymd: string) {
  const today = istYmd(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (ymd === today) return 'Today';
  if (ymd === istYmd(y)) return 'Yesterday';
  const [yy, mm, dd] = ymd.split('-').map(Number);
  return new Date(Date.UTC(yy, mm - 1, dd, 12)).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function PlatformBadge({ platform }: { platform: Platform }) {
  if (platform === 'mobile') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-800">
        <Smartphone className="h-3 w-3" /> Mobile app
      </span>
    );
  }
  if (platform === 'web') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">
        <Globe className="h-3 w-3" /> Web
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
      Unknown
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-[11px] font-bold uppercase opacity-80">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}

export default function LeadManagerLoginActivityPage() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(14);
  const [platform, setPlatform] = useState<'all' | 'mobile' | 'web'>('all');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [filterId, setFilterId] = useState('');
  const [search, setSearch] = useState('');
  const [hideNoLogin, setHideNoLogin] = useState(false);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        days: String(days),
        limit: '300',
        platform,
        status,
      });
      if (filterId) q.set('telecaller_id', filterId);
      const res = await fetch(`/api/lead-manager/telecaller-logins?${q}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Telecaller left the chosen status list: drop that filter and reload.
        if (res.status === 404 && filterId) {
          setFilterId('');
          return;
        }
        throw new Error(json?.error || 'Failed to load');
      }
      setSummary(json.summary || []);
      setEvents(json.events || []);
      setEventsTotal(Number(json.events_total || 0));
      setTotals(json.totals || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [days, platform, status, filterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === days)?.label || `Last ${days} days`;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summary.filter((s) => {
      if (hideNoLogin && s.logins_in_range === 0) return false;
      if (filterId && s.telecaller_id !== filterId) return false;
      if (!q) return true;
      return [s.name, s.phone, s.email].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [summary, search, hideNoLogin, filterId]);

  const visibleEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || filterId) return events;
    return events.filter((e) => e.telecaller_name.toLowerCase().includes(q));
  }, [events, search, filterId]);

  // Same person + platform + device within the same minute → one line "×N".
  const grouped = useMemo(() => {
    const out: (EventRow & { repeat: number })[] = [];
    for (const ev of visibleEvents) {
      const prev = out[out.length - 1];
      if (
        prev &&
        prev.telecaller_id === ev.telecaller_id &&
        prev.platform === ev.platform &&
        (prev.device_label || '') === (ev.device_label || '') &&
        timeIst(prev.logged_in_at) === timeIst(ev.logged_in_at) &&
        istYmd(new Date(prev.logged_in_at)) === istYmd(new Date(ev.logged_in_at))
      ) {
        prev.repeat += 1;
        continue;
      }
      out.push({ ...ev, repeat: 1 });
    }
    return out;
  }, [visibleEvents]);

  const [shownCount, setShownCount] = useState(TIMELINE_PAGE);
  useEffect(() => setShownCount(TIMELINE_PAGE), [days, platform, status, filterId, search]);

  const timelineDays = useMemo(() => {
    const days: { key: string; label: string; count: number; rows: typeof grouped }[] = [];
    for (const ev of grouped.slice(0, shownCount)) {
      const key = istYmd(new Date(ev.logged_in_at));
      let day = days[days.length - 1];
      if (!day || day.key !== key) {
        day = { key, label: dayLabel(key), count: 0, rows: [] };
        days.push(day);
      }
      day.rows.push(ev);
      day.count += ev.repeat;
    }
    return days;
  }, [grouped, shownCount]);

  const showMobile = platform !== 'web';
  const showWeb = platform !== 'mobile';

  return (
    <DashboardLayout role="LEAD_MANAGER">
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-[#023D95]">
              <Clock className="h-6 w-6" /> Login activity
              <PageHelpIcon href="/dashboard/lead_manager/login-activity" label="Login activity" />
            </h1>
            <p className="text-sm text-slate-500">
              Kab, kahan, kitni baar telecallers login kiye — mobile app aur web alag-alag
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'mobile', label: 'Mobile app' },
                { id: 'web', label: 'Web' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPlatform(opt.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  platform === opt.id ? 'bg-[#023D95] text-white' : 'text-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
          >
            {RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
          >
            <option value="active">Active telecallers</option>
            <option value="inactive">Inactive telecallers</option>
            <option value="all">All telecallers</option>
          </select>
          <select
            value={filterId}
            onChange={(e) => setFilterId(e.target.value)}
            className="max-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
          >
            <option value="">Every telecaller</option>
            {summary.map((s) => (
              <option key={s.telecaller_id} value={s.telecaller_id}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name / phone"
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={hideNoLogin}
              onChange={(e) => setHideNoLogin(e.target.checked)}
            />
            Hide no-login
          </label>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Logins today" value={totals?.today ?? 0} tone="border-slate-200 bg-white text-[#023D95]" />
          <Stat label="Mobile today" value={totals?.today_mobile ?? 0} tone="border-violet-200 bg-violet-50 text-violet-900" />
          <Stat label="Web today" value={totals?.today_web ?? 0} tone="border-sky-200 bg-sky-50 text-sky-900" />
          <Stat
            label="Logged in today"
            value={`${totals?.logged_in_today ?? 0} / ${totals?.telecallers ?? 0}`}
            tone="border-emerald-200 bg-emerald-50 text-emerald-900"
          />
          <Stat label="App opened today" value={totals?.app_open_today ?? 0} tone="border-amber-200 bg-amber-50 text-amber-900" />
          <Stat
            label={`Mobile / Web · ${rangeLabel}`}
            value={`${totals?.range_mobile ?? 0} / ${totals?.range_web ?? 0}`}
            tone="border-slate-200 bg-slate-50 text-slate-800"
          />
        </div>

        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

        {loading && !summary.length ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-black text-slate-800">Per telecaller · {rangeLabel}</h2>
                <p className="text-xs text-slate-500">
                  {rows.length} shown · row pe click karke us telecaller ki timeline dekho
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Telecaller</th>
                      <th className="px-4 py-3">Today</th>
                      {showMobile ? <th className="px-4 py-3 text-violet-700">Mobile</th> : null}
                      {showWeb ? <th className="px-4 py-3 text-sky-700">Web</th> : null}
                      <th className="px-4 py-3">Total</th>
                      {showMobile ? <th className="px-4 py-3">Last mobile login</th> : null}
                      {showWeb ? <th className="px-4 py-3">Last web login</th> : null}
                      <th className="px-4 py-3">App last opened</th>
                      <th className="px-4 py-3">Devices / IPs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((s) => {
                      const todayCount =
                        platform === 'mobile' ? s.today_mobile : platform === 'web' ? s.today_web : s.logins_today;
                      const totalCount =
                        platform === 'mobile' ? s.logins_mobile : platform === 'web' ? s.logins_web : s.logins_in_range;
                      return (
                        <tr
                          key={s.telecaller_id}
                          className={`cursor-pointer hover:bg-slate-50/80 ${
                            filterId === s.telecaller_id ? 'bg-blue-50/60' : ''
                          }`}
                          onClick={() => setFilterId(filterId === s.telecaller_id ? '' : s.telecaller_id)}
                        >
                          <td className="px-4 py-3">
                            <p className="flex items-center gap-1.5 font-bold text-slate-900">
                              {s.name}
                              {!s.is_active ? (
                                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                                  Inactive
                                </span>
                              ) : null}
                            </p>
                            <p className="text-xs text-slate-500">{s.phone || s.email || '—'}</p>
                          </td>
                          <td className="px-4 py-3 font-black text-[#023D95]">{todayCount}</td>
                          {showMobile ? (
                            <td className="px-4 py-3 text-xs text-violet-800">
                              <span className="font-bold">{s.logins_mobile}</span>
                              <span className="text-slate-400"> · {s.today_mobile} today</span>
                            </td>
                          ) : null}
                          {showWeb ? (
                            <td className="px-4 py-3 text-xs text-sky-800">
                              <span className="font-bold">{s.logins_web}</span>
                              <span className="text-slate-400"> · {s.today_web} today</span>
                            </td>
                          ) : null}
                          <td className="px-4 py-3 font-semibold">{totalCount}</td>
                          {showMobile ? (
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                              {fmtWhen(s.last_mobile_login)}
                            </td>
                          ) : null}
                          {showWeb ? (
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                              {fmtWhen(s.last_web_login)}
                            </td>
                          ) : null}
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                            {fmtWhen(s.app_last_seen)}
                            {s.app_device ? <p className="text-[10px] text-slate-400">{s.app_device}</p> : null}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {s.devices} / {s.ips}
                          </td>
                        </tr>
                      );
                    })}
                    {!rows.length ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                          Is filter mein koi telecaller nahi.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div>
                  <h2 className="text-sm font-black text-slate-800">Login timeline</h2>
                  <p className="text-xs text-slate-500">
                    Newest first · same minute ke logins ek line mein
                    {filterId ? ` · ${summary.find((s) => s.telecaller_id === filterId)?.name || ''}` : ''}
                    {platform !== 'all' ? ` · ${platform === 'mobile' ? 'Mobile app' : 'Web'} only` : ''}
                  </p>
                </div>
                <p className="text-xs text-slate-500">{eventsTotal} logins</p>
              </div>
              {timelineDays.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="w-24 px-4 py-2">Time</th>
                        <th className="px-4 py-2">Telecaller</th>
                        <th className="px-4 py-2">Platform</th>
                        <th className="px-4 py-2">Device</th>
                        <th className="px-4 py-2">Location / IP</th>
                      </tr>
                    </thead>
                    {timelineDays.map((day) => (
                      <tbody key={day.key} className="divide-y divide-slate-100">
                        <tr className="bg-slate-50/70">
                          <td colSpan={5} className="px-4 py-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500">
                            {day.label}
                            <span className="ml-2 font-semibold normal-case text-slate-400">
                              {day.count} login{day.count === 1 ? '' : 's'}
                            </span>
                          </td>
                        </tr>
                        {day.rows.map((ev) => (
                          <tr key={ev.id} className="hover:bg-slate-50/60">
                            <td className="whitespace-nowrap px-4 py-2 text-xs font-semibold text-slate-700">
                              {timeIst(ev.logged_in_at)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2">
                              <button
                                type="button"
                                onClick={() => setFilterId(filterId === ev.telecaller_id ? '' : ev.telecaller_id)}
                                className="font-bold text-slate-900 hover:text-[#023D95] hover:underline"
                              >
                                {ev.telecaller_name}
                              </button>
                              {ev.repeat > 1 ? (
                                <span
                                  className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"
                                  title="Same minute mein itni baar login hua"
                                >
                                  ×{ev.repeat}
                                </span>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2">
                              <PlatformBadge platform={ev.platform} />
                            </td>
                            <td className="max-w-[220px] truncate px-4 py-2 text-xs text-slate-600" title={ev.device_label || ''}>
                              {ev.device_label || <span className="text-slate-300">—</span>}
                            </td>
                            <td className="max-w-[260px] truncate px-4 py-2 text-xs text-slate-600" title={ev.where}>
                              {ev.where && ev.where !== '—' ? (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3 w-3 shrink-0 text-slate-400" /> {ev.where}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    ))}
                  </table>
                </div>
              ) : (
                <p className="px-4 py-10 text-center text-sm text-slate-500">Is range / filter mein koi login nahi.</p>
              )}
              {grouped.length > shownCount ? (
                <div className="border-t border-slate-100 px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => setShownCount((n) => n + TIMELINE_PAGE)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Show more ({grouped.length - shownCount} left)
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
