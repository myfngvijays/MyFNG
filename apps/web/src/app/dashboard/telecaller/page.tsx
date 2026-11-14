'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import DashboardLayout from '@/components/DashboardLayout';
import {
  CRM_DATE_PRESETS,
  resolveCrmDateRange,
  type CrmDatePreset,
} from '@/lib/telecaller/crmDateRange';
import {
  loadTelecallerCrmFilterPrefs,
  saveTelecallerCrmFilterPrefs,
} from '@/lib/telecaller/crmFilterPrefs';
import { leadStatusKpiColors } from '@/lib/telecaller/leadDisplayStatus';
import {
  Phone,
  Calendar,
  ClipboardList,
  MessageCircle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  CalendarDays,
  MapPin,
  Tag,
  TrendingUp,
} from 'lucide-react';
import { shouldKeepPreviousDashboardKpis } from '@/lib/telecaller/crmDashboardGuard';
import { formatDurationShort } from '@/lib/telecaller/crmReportsRange';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Kpis = {
  new_leads?: number;
  incomplete?: number;
  interested?: number;
  will_visit?: number;
  booking_confirmed?: number;
  in_service?: number;
  service_done?: number;
  lost?: number;
  callbacks?: number;
  followups_today?: number;
  reminders_pending?: number;
  overdue_callbacks?: number;
  booked?: number;
  rejected?: number;
  today_calls?: number;
  answered_calls?: number;
  answer_rate?: number;
  talk_duration_seconds?: number;
  my_rank?: number | null;
  leaderboard_size?: number;
};

type TrendRow = {
  date?: string;
  label?: string;
  calls?: number;
  leads_created?: number;
};

type UpcomingReminder = {
  id: string;
  scheduled_time?: string;
  reason?: string | null;
  priority?: string | null;
  lead_id?: string;
  lead?: {
    id?: string;
    lead_number?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
  } | null;
};

type FreshLead = {
  id: string;
  lead_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  city?: string | null;
  created_at?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
};

function formatDashName(name?: string | null): string {
  const full = String(name || '').trim();
  if (!full) return 'Customer';
  return full
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      /^\d+$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(' ');
}

function formatLeadAgo(iso?: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatReminderClock(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function TelecallerCrmHomePage() {
  const pathname = usePathname();
  const { base, layoutRole, isLeadManager } = getCrmDashboardBase(pathname);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpis, setKpis] = useState<Kpis>({});
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [upcomingReminders, setUpcomingReminders] = useState<UpcomingReminder[]>([]);
  const [freshLeads, setFreshLeads] = useState<FreshLead[]>([]);
  const [profileName, setProfileName] = useState('Telecaller');
  const [waUnread, setWaUnread] = useState(0);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>('all_time');
  const [customStart, setCustomStart] = useState(
    () => loadTelecallerCrmFilterPrefs().customStart,
  );
  const [customEnd, setCustomEnd] = useState(() => loadTelecallerCrmFilterPrefs().customEnd);
  const [dateOpen, setDateOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const inFlight = useRef(false);
  const kpisRef = useRef<Kpis>({});
  kpisRef.current = kpis;

  const persistDate = (next: {
    datePreset?: CrmDatePreset;
    customStart?: string;
    customEnd?: string;
  }) => {
    if (next.datePreset) setDatePreset(next.datePreset);
    if (next.customStart) setCustomStart(next.customStart);
    if (next.customEnd) setCustomEnd(next.customEnd);
    saveTelecallerCrmFilterPrefs(next);
  };

  const dateRange = useMemo(
    () => resolveCrmDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd],
  );
  const dateLabel =
    CRM_DATE_PRESETS.find((p) => p.value === datePreset)?.label || dateRange.label;

  const load = useCallback(async (force = false) => {
    if (inFlight.current && !force) return;
    inFlight.current = true;
    try {
      const range = resolveCrmDateRange(datePreset, customStart, customEnd);
      const params = new URLSearchParams();
      if (range.allTime) {
        params.set('all', '1');
      } else {
        params.set('from', range.start);
        params.set('to', range.end);
      }
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 45000);
      try {
        const res = await fetch(`/api/telecaller/crm/dashboard?${params.toString()}`, {
          signal: controller.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Failed');
        const nextKpis = json.kpis || {};
        const nextFresh = Array.isArray(json.fresh_leads) ? json.fresh_leads : [];
        if (
          force ||
          !shouldKeepPreviousDashboardKpis(kpisRef.current, nextKpis, nextFresh.length)
        ) {
          setKpis(nextKpis);
          setTrend(Array.isArray(json.trend) ? json.trend : []);
          setUpcomingReminders(Array.isArray(json.upcoming_reminders) ? json.upcoming_reminders : []);
          setFreshLeads(nextFresh);
        }
        setProfileName(json?.profile?.name || 'Telecaller');
        setLoadError(null);
        setReady(true);
      } finally {
        window.clearTimeout(timer);
      }
    } catch (e: any) {
      const aborted = e?.name === 'AbortError';
      setLoadError(
        aborted || /unauthorized/i.test(String(e?.message || ''))
          ? 'Could not reach the server. Check your connection and try again.'
          : e?.message || 'Could not load CRM',
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [datePreset, customStart, customEnd]);

  useEffect(() => {
    setLoading(true);
    void load(true);
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void load(false);
    }, 40000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void load(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  useEffect(() => {
    const onBump = () => setWaUnread((n) => n + 1);
    const onClear = () => setWaUnread(0);
    window.addEventListener('myfng:wa-unread-bump', onBump);
    window.addEventListener('myfng:open-wa-inbox', onClear);
    return () => {
      window.removeEventListener('myfng:wa-unread-bump', onBump);
      window.removeEventListener('myfng:open-wa-inbox', onClear);
    };
  }, []);

  // Same labels / filters as Leads — colors from leadStatusCardColors palette
  const kpiCards = [
    { label: 'Fresh', value: kpis.new_leads || 0, statusKey: 'Fresh', filter: 'new', href: `${base}/leads?filter=new` },
    {
      label: 'Interested',
      value: kpis.interested,
      statusKey: 'Interested',
      filter: 'interested',
      href: `${base}/leads?filter=interested`,
    },
    {
      label: 'He will visit',
      value: kpis.will_visit,
      statusKey: 'He will visit',
      filter: 'will_visit',
      href: `${base}/leads?filter=will_visit`,
    },
    {
      label: 'Follow-up',
      value: kpis.callbacks,
      statusKey: 'Follow-up',
      filter: 'callback',
      href: `${base}/leads?filter=callback`,
    },
    {
      label: 'Booking confirmed',
      value: kpis.booking_confirmed ?? kpis.booked,
      statusKey: 'Booking confirmed',
      filter: 'booking_confirmed',
      href: `${base}/leads?filter=booking_confirmed`,
    },
    {
      label: 'In Service',
      value: kpis.in_service,
      statusKey: 'In Service',
      filter: 'in_service',
      href: `${base}/leads?filter=in_service`,
    },
    {
      label: 'Service Done',
      value: kpis.service_done,
      statusKey: 'Service Done',
      filter: 'service_done',
      href: `${base}/leads?filter=service_done`,
    },
    {
      label: 'Lost',
      value: kpis.lost ?? kpis.rejected,
      statusKey: 'Lost',
      filter: 'lost',
      href: `${base}/leads?filter=lost`,
    },
    {
      label: 'Today due',
      value: kpis.followups_today,
      statusKey: 'Follow-up',
      filter: null as string | null,
      href: `${base}/followups`,
    },
  ];

  const activityBars = trend.map((t) => ({
    label: t.label || String(t.date || '').slice(5) || '',
    calls: Number(t.calls || 0),
    bookings: Number(t.leads_created || 0),
  }));
  const statusPie = kpiCards
    .filter((k) => k.filter)
    .map((k) => {
      const tint = leadStatusKpiColors(k.statusKey);
      const fill = tint.badgeText === '#FFFFFF' ? tint.badgeBg : tint.badgeText;
      return { name: k.label, value: Number(k.value || 0), fill };
    })
    .filter((d) => d.value > 0);

  return (
    <DashboardLayout role={layoutRole}>
      <div className="w-full max-w-none space-y-4 pb-8">
        <div className="rounded-2xl bg-[#004AAD] px-4 py-3.5 text-white shadow-md sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
              <div className="min-w-0 shrink-0">
                <h1 className="truncate text-xl font-extrabold leading-tight text-white sm:text-2xl">
                  {isLeadManager ? 'Lead Manager' : formatDashName(profileName)}
                </h1>
                <p className="text-xs font-semibold text-blue-100">
                  {isLeadManager ? 'All team leads' : 'Your floor'}
                </p>
              </div>
              {isLeadManager ? (
                <Link
                  href={`${base}/floor`}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-[#5B21B6]"
                >
                  Floor status
                </Link>
              ) : null}
            </div>

            <div className="relative z-20 w-full sm:ml-auto sm:w-44 sm:shrink-0">
              <button
                type="button"
                onClick={() => setDateOpen((v) => !v)}
                className="flex w-full items-center gap-2 rounded-xl border border-white bg-white px-3 py-2.5"
              >
                <CalendarDays className="h-4 w-4 shrink-0 text-[#004AAD]" />
                <span className="flex-1 truncate text-left text-[12px] font-bold text-[#023D95]">
                  {datePreset === 'custom' ? dateRange.label : dateLabel}
                </span>
                {dateOpen ? (
                  <ChevronUp className="h-4 w-4 text-[#004AAD]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[#004AAD]" />
                )}
              </button>
              {dateOpen ? (
                <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-30">
                  {CRM_DATE_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => {
                        persistDate({ datePreset: p.value });
                        if (p.value !== 'custom') setDateOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-[13px] font-semibold border-b border-slate-100 last:border-0 ${
                        datePreset === p.value ? 'bg-blue-50 text-[#004AAD]' : 'text-slate-800'
                      }`}
                    >
                      {p.label}
                      {datePreset === p.value ? <Check className="w-4 h-4" /> : null}
                    </button>
                  ))}
                  {datePreset === 'custom' ? (
                    <div className="flex items-center gap-2 p-2.5 bg-slate-50">
                      <input
                        type="date"
                        className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        value={customStart}
                        onChange={(e) =>
                          persistDate({ customStart: e.target.value, datePreset: 'custom' })
                        }
                      />
                      <span className="text-xs text-slate-400">→</span>
                      <input
                        type="date"
                        className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        value={customEnd}
                        onChange={(e) =>
                          persistDate({ customEnd: e.target.value, datePreset: 'custom' })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => {
                          persistDate({ datePreset: 'custom', customStart, customEnd });
                          setDateOpen(false);
                          setRefreshing(true);
                          void load(true);
                        }}
                        className="rounded-lg bg-[#004AAD] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Apply
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {loading && !refreshing ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-[#004AAD]" />
            <span className="text-sm">Loading MyFNG CRM...</span>
          </div>
        ) : loadError && !ready ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center px-4">
            <p className="text-sm font-semibold text-slate-600">{loadError}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void load(true);
              }}
              className="text-sm font-bold text-[#004AAD]"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* KPI grid — 5×2 with Today due filling last cell */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-2.5">
              {kpiCards.map((k) => {
                const tint = leadStatusKpiColors(k.statusKey);
                return (
                  <Link
                    key={k.label}
                    href={k.href}
                    className="rounded-xl py-2.5 sm:py-3 text-center shadow-sm border transition hover:brightness-[0.98] hover:shadow"
                    style={{
                      backgroundColor: tint.cardBg,
                      borderColor: tint.border,
                    }}
                  >
                    <div
                      className="text-lg sm:text-xl font-extrabold tabular-nums"
                      style={{ color: tint.badgeText === '#FFFFFF' ? tint.badgeBg : tint.badgeText }}
                    >
                      {k.value ?? 0}
                    </div>
                    <div
                      className="mt-1 max-w-[95%] truncate px-1 text-[10px] sm:text-[11px] font-bold leading-tight"
                      style={{
                        color: tint.badgeText === '#FFFFFF' ? tint.badgeBg : tint.badgeText,
                      }}
                    >
                      {k.label}
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
              <div className="rounded-2xl border border-[#C7D7F5] bg-[#EEF4FF] p-3.5 shadow-sm sm:p-4 xl:col-span-2">
                <h2 className="mb-2 text-[14px] font-bold text-[#023D95]">Lead mix</h2>
                {statusPie.length === 0 ? (
                  <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
                    No leads in this range
                  </div>
                ) : (
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusPie}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={58}
                          outerRadius={88}
                          paddingAngle={2}
                        >
                          {statusPie.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-3.5 shadow-sm sm:p-4 xl:col-span-3">
                <h2 className="mb-2 text-[14px] font-bold text-[#023D95]">Calls and bookings</h2>
                {activityBars.length === 0 ? (
                  <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
                    No activity this week
                  </div>
                ) : (
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activityBars} barGap={4}>
                        <CartesianGrid stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="calls" name="Calls" fill="#004AAD" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="bookings" name="Bookings" fill="#10B981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <div className="rounded-2xl border border-[#C7D7F5] border-l-4 border-l-[#004AAD] bg-[#F3F7FF] p-3.5 shadow-sm sm:p-4">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-bold text-[#023D95]">Fresh leads</h2>
                <Link href={`${base}/leads?filter=new`} className="text-xs font-bold text-[#004AAD]">
                  View all →
                </Link>
              </div>
              {freshLeads.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">No fresh leads right now</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {freshLeads.map((lead) => {
                    const phone = String(lead.customer_phone || '').trim();
                    const vehicle = [lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ');
                    const meta = [lead.city, vehicle].filter(Boolean).join(' · ');
                    return (
                      <li key={lead.id} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
                        <Link href={`${base}/leads/${lead.id}`} className="min-w-0 flex-1 hover:opacity-90">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {formatDashName(lead.customer_name)}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {phone || '—'}
                            {meta ? ` · ${meta}` : ''}
                          </p>
                          <p className="mt-0.5 text-[11px] font-bold text-[#004AAD]">
                            {formatLeadAgo(lead.created_at)}
                          </p>
                        </Link>
                        {phone ? (
                          <a
                            href={`tel:${phone}`}
                            title="Call"
                            aria-label="Call"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DCE8FF] text-[#004AAD]"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-[#F3D5B5] border-l-4 border-l-[#EA580C] bg-[#FFF7ED] p-3.5 shadow-sm sm:p-4">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-bold text-[#9A3412]">Upcoming reminders</h2>
                <Link href={`${base}/followups`} className="text-xs font-bold text-[#C2410C]">
                  View all →
                </Link>
              </div>
              {upcomingReminders.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">No reminders today</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcomingReminders.slice(0, 3).map((r) => {
                    const overdue = r.scheduled_time
                      ? new Date(r.scheduled_time).getTime() < Date.now()
                      : false;
                    const phone = String(r.lead?.customer_phone || '').trim();
                    const leadHref = `${base}/leads/${r.lead_id || r.lead?.id || ''}`;
                    return (
                      <li key={r.id} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
                        <Link href={leadHref} className="min-w-0 flex-1 hover:opacity-90">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {formatDashName(r.lead?.customer_name)}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {r.reason || 'Follow-up'}
                            {phone ? ` · ${phone}` : ''}
                          </p>
                          <p className={`mt-0.5 text-[11px] font-bold ${overdue ? 'text-red-600' : 'text-[#C2410C]'}`}>
                            {overdue ? 'Overdue · ' : ''}
                            {formatReminderClock(r.scheduled_time)}
                          </p>
                        </Link>
                        {phone ? (
                          <a
                            href={`tel:${phone}`}
                            title="Call"
                            aria-label="Call"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFEDD5] text-[#C2410C]"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            </div>

            {/* Quick Actions — web only, above analytics (phone order unchanged) */}
            <div className="rounded-2xl border border-[#C7D7F5] bg-[#F4F8FF] p-3.5 sm:p-4">
              <h2 className="text-[14px] font-bold text-[#023D95] mb-2">Quick Actions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5">
                {[
                  {
                    href: `${base}/book?mode=book`,
                    label: 'Booking',
                    icon: Calendar,
                    color: '#10B981',
                  },
                  {
                    href: `${base}/book?mode=lead`,
                    label: 'Add Lead',
                    icon: Phone,
                    color: '#004AAD',
                  },
                  {
                    href: `${base}/leads`,
                    label: 'Open Leads',
                    icon: ClipboardList,
                    color: '#F59E0B',
                  },
                  {
                    href: '#whatsapp',
                    label: 'WhatsApp',
                    icon: MessageCircle,
                    color: '#25D366',
                    action: 'open-wa-inbox' as const,
                  },
                  {
                    href: `${base}/workshops`,
                    label: 'Workshops',
                    icon: MapPin,
                    color: '#0EA5E9',
                  },
                  ...(!isLeadManager
                    ? [
                        {
                          href: `${base}/zone-prices`,
                          label: 'Zone Prices',
                          icon: Tag,
                          color: '#2563EB',
                        },
                      ]
                    : []),
                  ...(isLeadManager
                    ? [
                        {
                          href: `${base}/floor`,
                          label: 'Floor',
                          icon: TrendingUp,
                          color: '#7C3AED',
                        },
                      ]
                    : []),
                  {
                    href: isLeadManager ? `${base}/assignment` : `${base}/reports`,
                    label: isLeadManager ? 'Assignment' : 'Reports',
                    icon: isLeadManager ? MessageCircle : BarChart3,
                    color: isLeadManager ? '#7C3AED' : '#023D95',
                  },
                ].map((a) =>
                  a.action === 'open-wa-inbox' ? (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => {
                        setWaUnread(0);
                        window.dispatchEvent(new CustomEvent('myfng:open-wa-inbox'));
                      }}
                      className="relative flex flex-col items-center gap-1.5 rounded-xl border border-[#86EFAC] bg-[#ECFDF5] px-2 py-3 shadow-sm transition hover:brightness-[0.98]"
                    >
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${a.color}18` }}
                      >
                        <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
                      </span>
                      <span className="text-[12px] font-bold text-slate-800 text-center leading-tight">
                        {a.label}
                      </span>
                      {waUnread > 0 ? (
                        <span className="absolute top-1.5 right-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {waUnread > 9 ? '9+' : waUnread}
                        </span>
                      ) : null}
                    </button>
                  ) : (
                    <Link
                      key={a.href + a.label}
                      href={a.href}
                      className="flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 shadow-sm transition hover:brightness-[0.98]"
                      style={{ backgroundColor: `${a.color}18`, borderColor: `${a.color}55` }}
                    >
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${a.color}18` }}
                      >
                        <a.icon className="w-5 h-5" style={{ color: a.color }} />
                      </span>
                      <span className="text-[12px] font-bold text-slate-800 text-center leading-tight">
                        {a.label}
                      </span>
                    </Link>
                  ),
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-2xl border border-[#C7D7F5] bg-[#F3F7FF] p-3.5 shadow-sm sm:p-4">
                <h2 className="mb-2.5 text-[14px] font-bold text-[#023D95]">Calls in range</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="text-center">
                    <div className="text-lg sm:text-xl font-extrabold text-[#004AAD] tabular-nums">
                      {kpis.today_calls ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg sm:text-xl font-extrabold text-[#004AAD] tabular-nums">
                      {kpis.answered_calls ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Answered</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg sm:text-xl font-extrabold text-emerald-600 tabular-nums">
                      {kpis.answer_rate ?? 0}%
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Answer Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg sm:text-xl font-extrabold text-slate-800 tabular-nums">
                      {formatDurationShort(Number(kpis.talk_duration_seconds || 0))}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Talk time</div>
                  </div>
                </div>
                {kpis.my_rank != null ? (
                  <Link
                    href={`${base}/reports/leaderboard`}
                    className="mt-3 flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Today rank #{kpis.my_rank}
                      {kpis.leaderboard_size ? ` / ${kpis.leaderboard_size}` : ''}
                    </span>
                    <span className="text-indigo-500">→</span>
                  </Link>
                ) : (
                  <Link
                    href={`${base}/reports/leaderboard`}
                    className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Your leaderboard
                    </span>
                    <span>→</span>
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
