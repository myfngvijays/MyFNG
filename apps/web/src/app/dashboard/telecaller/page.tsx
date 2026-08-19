'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import DashboardLayout from '@/components/DashboardLayout';
import TelecallerAanshBar from '@/components/telecaller/TelecallerAanshBar';
import {
  CRM_DATE_PRESETS,
  resolveCrmDateRange,
  type CrmDatePreset,
} from '@/lib/telecaller/crmDateRange';
import {
  loadTelecallerCrmFilterPrefs,
  saveTelecallerCrmFilterPrefs,
} from '@/lib/telecaller/crmFilterPrefs';
import { leadStatusCardColors } from '@/lib/telecaller/leadDisplayStatus';
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
  Clock,
  MapPin,
  Truck,
  TrendingUp,
  LogIn,
  LogOut,
} from 'lucide-react';
import { formatDurationShort } from '@/lib/telecaller/crmReportsRange';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';

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
    lead_number?: string;
    customer_name?: string;
    customer_phone?: string;
  } | null;
};

function SimpleBarChart({
  title,
  data,
  color,
  emptyHint,
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
  color: string;
  emptyHint: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="rounded-2xl bg-white p-3.5 sm:p-4 shadow-sm border border-slate-100 min-h-[200px] flex flex-col">
      <h2 className="mb-2 text-[14px] font-bold text-[#023D95]">{title}</h2>
      {data.length === 0 || total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl bg-slate-50/80 border border-dashed border-slate-200 px-4 py-8 text-center">
          <BarChart3 className="h-7 w-7 text-slate-300 mb-2" />
          <p className="text-xs font-semibold text-slate-500">{emptyHint}</p>
        </div>
      ) : (
        <div className="flex h-36 items-end gap-2 flex-1">
          {data.map((t, i) => {
            const h = Math.max(6, (t.value / max) * 100);
            return (
              <div key={`${t.label}-${i}`} className="flex flex-1 flex-col items-center gap-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-600 tabular-nums">{t.value}</span>
                <div
                  className="w-full max-w-[28px] rounded-t-lg transition-all"
                  style={{ height: `${h}%`, backgroundColor: color, minHeight: 6 }}
                  title={`${t.value}`}
                />
                <span className="text-[10px] font-semibold text-slate-500 truncate w-full text-center">
                  {t.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TelecallerCrmHomePage() {
  const pathname = usePathname();
  const { base, layoutRole, isLeadManager } = getCrmDashboardBase(pathname);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpis, setKpis] = useState<Kpis>({});
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [upcomingReminders, setUpcomingReminders] = useState<UpcomingReminder[]>([]);
  const [profileName, setProfileName] = useState('Telecaller');
  const [punchedIn, setPunchedIn] = useState(false);
  const [punching, setPunching] = useState(false);
  const [waUnread, setWaUnread] = useState(0);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>(
    () => loadTelecallerCrmFilterPrefs().datePreset,
  );
  const [customStart, setCustomStart] = useState(
    () => loadTelecallerCrmFilterPrefs().customStart,
  );
  const [customEnd, setCustomEnd] = useState(() => loadTelecallerCrmFilterPrefs().customEnd);
  const [dateOpen, setDateOpen] = useState(false);

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

  const load = useCallback(async () => {
    try {
      const range = resolveCrmDateRange(datePreset, customStart, customEnd);
      const params = new URLSearchParams();
      if (range.allTime) {
        params.set('all', '1');
      } else {
        params.set('from', range.start);
        params.set('to', range.end);
      }
      const res = await fetch(`/api/telecaller/crm/dashboard?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setKpis(json.kpis || {});
      setTrend(Array.isArray(json.trend) ? json.trend : []);
      setUpcomingReminders(Array.isArray(json.upcoming_reminders) ? json.upcoming_reminders : []);
      setProfileName(json?.profile?.name || 'Telecaller');
      setPunchedIn(Boolean(json?.attendance?.is_punched_in));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [datePreset, customStart, customEnd]);

  useEffect(() => {
    setLoading(true);
    void load();
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

  const punch = async () => {
    setPunching(true);
    try {
      const res = await fetch('/api/telecaller/crm/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: punchedIn ? 'punch_out' : 'punch_in' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Punch failed');
      setPunchedIn(!punchedIn);
      setRefreshing(true);
      void load();
    } catch (e: any) {
      alert(e?.message || 'Punch failed');
    } finally {
      setPunching(false);
    }
  };

  // Same labels / filters as Leads — colors from leadStatusCardColors palette
  const kpiCards = [
    { label: 'New', value: kpis.new_leads, statusKey: 'New', filter: 'new', href: `${base}/leads?filter=new` },
    {
      label: 'Incomplete',
      value: kpis.incomplete,
      statusKey: 'Incomplete',
      filter: 'incomplete',
      href: `${base}/leads?filter=incomplete`,
    },
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

  const callTrend = trend.map((t) => ({
    label: t.label || String(t.date || '').slice(5) || '',
    value: Number(t.calls || 0),
  }));
  const bookingTrend = trend.map((t) => ({
    label: t.label || String(t.date || '').slice(5) || '',
    value: Number(t.leads_created || 0),
  }));

  return (
    <DashboardLayout role={layoutRole}>
      <div className="mx-auto w-full max-w-6xl space-y-3 pb-8">
        {/* Compact hero strip: title + punch + date/Aansh */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-3.5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold text-[#023D95] leading-tight truncate">
                {isLeadManager ? 'Lead Manager' : profileName}
              </h1>
            </div>
            {isLeadManager ? (
              <Link
                href={`${base}/floor`}
                className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-800 ring-1 ring-violet-200 hover:bg-violet-100"
              >
                Floor status
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => void punch()}
                disabled={punching}
                title={punchedIn ? 'Punch out' : 'Punch in'}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold disabled:opacity-60 ${
                  punchedIn
                    ? 'bg-emerald-500/10 text-emerald-800 ring-1 ring-emerald-200'
                    : 'bg-orange-500/10 text-orange-800 ring-1 ring-orange-200'
                }`}
              >
                {punching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : punchedIn ? (
                  <LogOut className="h-3.5 w-3.5" />
                ) : (
                  <LogIn className="h-3.5 w-3.5" />
                )}
                {punchedIn ? 'On Floor · Out' : 'Off Duty · In'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,240px)_1fr] gap-2 items-start">
            <div className="relative z-20">
              <button
                type="button"
                onClick={() => setDateOpen((v) => !v)}
                className="w-full flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <CalendarDays className="w-4 h-4 text-[#004AAD] shrink-0" />
                <span className="flex-1 text-left text-[12px] font-bold text-slate-800 truncate">
                  {datePreset === 'custom' ? dateRange.label : dateLabel}
                </span>
                {dateOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
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
                          void load();
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

            <TelecallerAanshBar
              onClaimed={() => {
                setRefreshing(true);
                void load();
              }}
            />
          </div>
        </div>

        {loading && !refreshing ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-[#004AAD]" />
            <span className="text-sm">Loading MyFNG CRM...</span>
          </div>
        ) : (
          <>
            {/* KPI grid — 5×2 with Today due filling last cell */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-2.5">
              {kpiCards.map((k) => {
                const tint = leadStatusCardColors(
                  k.label === 'Incomplete' ? { is_incomplete: true } : k.statusKey,
                );
                return (
                  <Link
                    key={k.label}
                    href={k.href}
                    onClick={() => {
                      if (k.filter) saveTelecallerCrmFilterPrefs({ statusFilter: k.filter });
                    }}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white p-3.5 sm:p-4 shadow-sm border border-slate-100">
                <h2 className="text-[14px] font-bold text-[#023D95] mb-2.5">Calls in range</h2>
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

              <SimpleBarChart
                title="7-Day Call Trend"
                data={callTrend}
                color="#004AAD"
                emptyHint="No calls this week"
              />
              <SimpleBarChart
                title="7-Day Bookings Created"
                data={bookingTrend}
                color="#10B981"
                emptyHint="No bookings this week"
              />
            </div>

            {/* Upcoming reminders */}
            <div className="rounded-2xl bg-white p-3.5 sm:p-4 shadow-sm border border-slate-100">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-bold text-[#023D95] inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  Upcoming reminders
                  {Number(kpis.overdue_callbacks || 0) > 0 ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      {kpis.overdue_callbacks} overdue
                    </span>
                  ) : null}
                </h2>
                <Link href={`${base}/followups`} className="text-xs font-bold text-[#004AAD]">
                  View all →
                </Link>
              </div>
              {upcomingReminders.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No pending reminders</p>
              ) : (
                <ul className="space-y-2">
                  {upcomingReminders.map((r) => {
                    const overdue = r.scheduled_time
                      ? new Date(r.scheduled_time).getTime() < Date.now()
                      : false;
                    const phone = String(r.lead?.customer_phone || '').trim();
                    const leadHref = `${base}/leads/${r.lead_id || r.lead?.id || ''}`;
                    return (
                      <li
                        key={r.id}
                        className={`rounded-xl border px-3 py-2.5 ${
                          overdue
                            ? 'border-red-200 bg-red-50/70'
                            : 'border-slate-100 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link href={leadHref} className="min-w-0 flex-1 hover:opacity-90">
                            <p className="text-sm font-bold text-slate-900 truncate">
                              {r.lead?.customer_name || 'Customer'}
                              {r.lead?.lead_number ? (
                                <span className="ml-1.5 text-[10px] font-mono text-slate-500">
                                  {r.lead.lead_number}
                                </span>
                              ) : null}
                            </p>
                            <p className="text-xs text-slate-600 truncate mt-0.5">
                              {r.reason || 'Follow-up'}
                            </p>
                            <p
                              className={`text-[11px] font-bold mt-1 ${
                                overdue ? 'text-red-600' : 'text-slate-500'
                              }`}
                            >
                              {overdue ? 'Overdue · ' : ''}
                              {r.scheduled_time
                                ? new Date(r.scheduled_time).toLocaleString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </p>
                          </Link>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {phone ? (
                              <a
                                href={`tel:${phone}`}
                                title="Call"
                                aria-label="Call"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                            {phone ? (
                              <button
                                type="button"
                                title="WhatsApp"
                                aria-label="WhatsApp"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366]/15 text-[#25D366] ring-1 ring-[#25D366]/40"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  window.dispatchEvent(
                                    new CustomEvent('myfng:open-wa-chat', {
                                      detail: {
                                        phone: phone.replace(/\D/g, ''),
                                        preview: r.reason || undefined,
                                      },
                                    }),
                                  );
                                }}
                              >
                                <WhatsAppIcon className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div>
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
                          href: `${base}/rsa`,
                          label: 'RSA',
                          icon: Truck,
                          color: '#EA580C',
                        },
                      ]
                    : [
                        {
                          href: `${base}/floor`,
                          label: 'Floor',
                          icon: TrendingUp,
                          color: '#7C3AED',
                        },
                      ]),
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
                      className="relative rounded-xl bg-white py-3 px-2 shadow-sm border border-slate-100 flex flex-col items-center gap-1.5 hover:border-emerald-200 transition"
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
                      className="rounded-xl bg-white py-3 px-2 shadow-sm border border-slate-100 flex flex-col items-center gap-1.5 hover:border-blue-200 transition"
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
