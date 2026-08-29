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
  const BAR_TRACK_PX = 128;
  return (
    <div className="rounded-2xl bg-white p-3.5 sm:p-4 shadow-sm border border-slate-100 min-h-[200px] flex flex-col">
      <h2 className="mb-2 text-[14px] font-bold text-[#023D95]">{title}</h2>
      {data.length === 0 || total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl bg-slate-50/80 border border-dashed border-slate-200 px-4 py-8 text-center">
          <BarChart3 className="h-7 w-7 text-slate-300 mb-2" />
          <p className="text-xs font-semibold text-slate-500">{emptyHint}</p>
        </div>
      ) : (
        <div className="flex items-end gap-2 flex-1 pt-1" style={{ minHeight: BAR_TRACK_PX + 40 }}>
          {data.map((t, i) => {
            const hPx = Math.max(t.value > 0 ? 10 : 2, Math.round((t.value / max) * BAR_TRACK_PX));
            return (
              <div key={`${t.label}-${i}`} className="flex flex-1 flex-col items-center gap-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-700 tabular-nums leading-none">
                  {t.value}
                </span>
                <div
                  className="w-full flex items-end justify-center"
                  style={{ height: BAR_TRACK_PX }}
                >
                  <div
                    className="w-full max-w-[32px] rounded-t-md transition-all"
                    style={{ height: hPx, backgroundColor: color }}
                    title={`${t.label}: ${t.value}`}
                  />
                </div>
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
  const [freshLeads, setFreshLeads] = useState<FreshLead[]>([]);
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
      setFreshLeads(Array.isArray(json.fresh_leads) ? json.fresh_leads : []);
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
    const id = window.setInterval(() => {
      void load();
    }, 20000);
    return () => window.clearInterval(id);
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

            <div className="rounded-2xl bg-[#004AAD] p-3.5 sm:p-4 shadow-sm">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-bold text-white">Fresh leads</h2>
                <Link href={`${base}/leads?filter=new`} className="text-xs font-bold text-white/85">
                  View all →
                </Link>
              </div>
              {freshLeads.length === 0 ? (
                <p className="py-4 text-center text-sm text-white/75">No fresh leads right now</p>
              ) : (
                <ul className="divide-y divide-white/15">
                  {freshLeads.map((lead) => {
                    const phone = String(lead.customer_phone || '').trim();
                    const vehicle = [lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ');
                    const meta = [lead.city, vehicle].filter(Boolean).join(' · ');
                    return (
                      <li key={lead.id} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
                        <Link href={`${base}/leads/${lead.id}`} className="min-w-0 flex-1 hover:opacity-90">
                          <p className="truncate text-sm font-bold text-white">
                            {String(lead.customer_name || 'Customer').trim()}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-white/75">
                            {phone || '—'}
                            {meta ? ` · ${meta}` : ''}
                          </p>
                          <p className="mt-0.5 text-[11px] font-bold text-blue-100">
                            {formatLeadAgo(lead.created_at)}
                          </p>
                        </Link>
                        {phone ? (
                          <a
                            href={`tel:${phone}`}
                            title="Call"
                            aria-label="Call"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#004AAD]"
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

            <div className="rounded-2xl bg-[#004AAD] p-3.5 sm:p-4 shadow-sm">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-bold text-white">Upcoming reminders</h2>
                <Link href={`${base}/followups`} className="text-xs font-bold text-white/85">
                  View all →
                </Link>
              </div>
              {upcomingReminders.length === 0 ? (
                <p className="py-4 text-center text-sm text-white/75">No reminders today</p>
              ) : (
                <ul className="divide-y divide-white/15">
                  {upcomingReminders.slice(0, 3).map((r) => {
                    const overdue = r.scheduled_time
                      ? new Date(r.scheduled_time).getTime() < Date.now()
                      : false;
                    const phone = String(r.lead?.customer_phone || '').trim();
                    const leadHref = `${base}/leads/${r.lead_id || r.lead?.id || ''}`;
                    return (
                      <li key={r.id} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
                        <Link href={leadHref} className="min-w-0 flex-1 hover:opacity-90">
                          <p className="truncate text-sm font-bold text-white">
                            {r.lead?.customer_name || 'Customer'}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-white/75">
                            {r.reason || 'Follow-up'}
                            {phone ? ` · ${phone}` : ''}
                          </p>
                          <p className={`mt-0.5 text-[11px] font-bold ${overdue ? 'text-red-200' : 'text-blue-100'}`}>
                            {overdue ? 'Overdue · ' : ''}
                            {formatReminderClock(r.scheduled_time)}
                          </p>
                        </Link>
                        {phone ? (
                          <a
                            href={`tel:${phone}`}
                            title="Call"
                            aria-label="Call"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#004AAD]"
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

            {/* Quick Actions — web only, above analytics (phone order unchanged) */}
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
