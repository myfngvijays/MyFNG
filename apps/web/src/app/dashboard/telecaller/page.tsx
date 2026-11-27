'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import DashboardLayout from '@/components/DashboardLayout';
import { WebPhoneCallLink } from '@/components/telecaller/PhoneDialHandoff';
import {
  CRM_DATE_PRESETS,
  resolveCrmDateRange,
  type CrmDatePreset,
} from '@/lib/telecaller/crmDateRange';
import {
  loadTelecallerCrmFilterPrefs,
  saveTelecallerCrmFilterPrefs,
} from '@/lib/telecaller/crmFilterPrefs';
import { crmDisplayLabelToFilterId, leadStatusKpiColors } from '@/lib/telecaller/leadDisplayStatus';
import type { TelecallerLeadOpsData } from '@/lib/telecaller/telecallerLeadOpsAggregate';
import TelecallerLeadOpsPanel from '@/components/telecaller/TelecallerLeadOpsPanel';
import {
  Phone,
  Calendar,
  ClipboardList,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  CalendarDays,
  MapPin,
  Tag,
  TrendingUp,
  Search,
  RefreshCw,
} from 'lucide-react';
import { shouldKeepPreviousDashboardKpis } from '@/lib/telecaller/crmDashboardGuard';
import {
  readCrmNewLeadPopupEnabled,
  readCrmNewLeadSoundEnabled,
  readCrmNewLeadSoundId,
} from '@/lib/telecaller/crmNewLeadPopupPref';
import { playCrmNewLeadWebSound } from '@/lib/telecaller/crmNewLeadWebSound';
import toast from 'react-hot-toast';
import { formatDurationShort } from '@/lib/telecaller/crmReportsRange';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import BookingConfirmedTodayCard from '@/components/crm/BookingConfirmedTodayCard';
import { crmFetch } from '@/lib/telecaller/crmFetch';
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
  total_leads?: number;
  ringing?: number;
  other?: number;
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
  avg_call_seconds?: number;
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
  vehicle_number?: string | null;
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

function leadInitials(name?: string | null): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0];
  if (/^\d/.test(first)) return first.slice(0, 2);
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return `${first[0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const EMPTY_TELECALLER_LEAD_OPS: TelecallerLeadOpsData = {
  totalCreated: 0,
  assignedCount: 0,
  unassignedCount: 0,
  byAssignee: [],
  byCrmStatus: [],
  byLeadSource: [],
  assigneeSlices: {},
  unassignedKey: '__unassigned__',
  sampleTruncated: false,
};

function crmLeadsFilterFromLabel(label: string): string | null {
  const id = crmDisplayLabelToFilterId(label);
  if (!id) return null;
  const map: Record<string, string> = {
    FRESH: 'new',
    RINGING: 'ringing',
    INTERESTED: 'interested',
    WILL_VISIT: 'will_visit',
    CALLBACK: 'callback',
    BOOKING_CONFIRMED: 'booking_confirmed',
    IN_SERVICE: 'in_service',
    SERVICE_DONE: 'service_done',
    LOST: 'lost',
    OTHER: 'other',
  };
  return map[id] || id.toLowerCase();
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
  const time = d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const day = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
  const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
  return day === today ? time : `${day} ${time}`;
}

export default function TelecallerCrmHomePage() {
  const pathname = usePathname();
  const router = useRouter();
  const { base, layoutRole, isLeadManager } = getCrmDashboardBase(pathname);
  const [leadQ, setLeadQ] = useState('');
  const [leadHits, setLeadHits] = useState<
    Array<{ id: string; lead_number?: string | null; customer_name?: string | null; customer_phone?: string | null; vehicle_number?: string | null; vehicle_model?: string | null }>
  >([]);
  const [leadHitsTotal, setLeadHitsTotal] = useState(0);
  const [leadHitsLoading, setLeadHitsLoading] = useState(false);
  const [leadHitsOpen, setLeadHitsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpis, setKpis] = useState<Kpis>({});
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [upcomingReminders, setUpcomingReminders] = useState<UpcomingReminder[]>([]);
  const [freshLeads, setFreshLeads] = useState<FreshLead[]>([]);
  const [nextCall, setNextCall] = useState<UpcomingReminder | null>(null);
  const [followupsDue, setFollowupsDue] = useState<UpcomingReminder[]>([]);
  const [inServiceLeads, setInServiceLeads] = useState<FreshLead[]>([]);
  const [recentCalls, setRecentCalls] = useState<Array<{ id: string; call_status?: string | null; call_duration?: number | null; created_at?: string | null; phone_number?: string | null; lead_id?: string | null; lead?: { id?: string; customer_name?: string | null; customer_phone?: string | null } | null }>>([]);
  const [leaderboard, setLeaderboard] = useState<Array<{ rank: number; name?: string; total_calls?: number; is_me?: boolean }>>([]);
  const [profileName, setProfileName] = useState('Telecaller');
  const [waUnread, setWaUnread] = useState(0);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>('all_time');
  const [customStart, setCustomStart] = useState(
    () => loadTelecallerCrmFilterPrefs().customStart,
  );
  const [customEnd, setCustomEnd] = useState(() => loadTelecallerCrmFilterPrefs().customEnd);
  const [dateOpen, setDateOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [telecallerLeadOps, setTelecallerLeadOps] = useState<TelecallerLeadOpsData>(EMPTY_TELECALLER_LEAD_OPS);
  const [leadOpsVariant, setLeadOpsVariant] = useState<'admin' | 'self'>('self');
  const [ready, setReady] = useState(false);
  const inFlight = useRef(false);
  const kpisRef = useRef<Kpis>({});
  const seenFreshLeadIdsRef = useRef<Set<string> | null>(null);
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

  // Live lead search: results show under the box while typing (no need to press Search).
  useEffect(() => {
    const q = leadQ.trim();
    if (q.length < 2) {
      setLeadHits([]);
      setLeadHitsTotal(0);
      setLeadHitsLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLeadHitsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await crmFetch(`/api/telecaller/crm/leads?q=${encodeURIComponent(q)}&limit=8`, {
          signal: ctrl.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (ctrl.signal.aborted) return;
        setLeadHits(Array.isArray(json?.leads) ? json.leads : []);
        setLeadHitsTotal(Number(json?.total || 0));
      } catch {
        if (!ctrl.signal.aborted) setLeadHits([]);
      } finally {
        if (!ctrl.signal.aborted) setLeadHitsLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [leadQ]);

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
        const res = await crmFetch(`/api/telecaller/crm/dashboard?${params.toString()}`, {
          signal: controller.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Failed');
        const nextKpis = json.kpis || {};
        const nextFresh = Array.isArray(json.fresh_leads) ? json.fresh_leads : [];
        const freshIds = nextFresh
          .map((row: { id?: string }) => String(row.id || ''))
          .filter(Boolean);
        if (seenFreshLeadIdsRef.current === null) {
          seenFreshLeadIdsRef.current = new Set(freshIds);
        } else if (readCrmNewLeadPopupEnabled()) {
          const seen = seenFreshLeadIdsRef.current;
          for (const lead of nextFresh) {
            const id = String((lead as { id?: string }).id || '').trim();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            const name = formatDashName((lead as { customer_name?: string | null }).customer_name);
            if (readCrmNewLeadSoundEnabled()) {
              playCrmNewLeadWebSound(readCrmNewLeadSoundId());
            }
            toast(
              (t) => (
                <button
                  type="button"
                  onClick={() => toast.dismiss(t.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left shadow-lg"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-extrabold text-emerald-800">
                    +
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold uppercase tracking-wide text-emerald-700">
                      New lead
                    </span>
                    <span className="block truncate text-sm font-extrabold text-slate-900">{name}</span>
                  </span>
                </button>
              ),
              { duration: 2600 },
            );
          }
        }
        if (
          force ||
          !shouldKeepPreviousDashboardKpis(kpisRef.current, nextKpis, nextFresh.length)
        ) {
          setKpis(nextKpis);
          setTrend(Array.isArray(json.trend) ? json.trend : []);
          setUpcomingReminders(Array.isArray(json.upcoming_reminders) ? json.upcoming_reminders : []);
          setFreshLeads(nextFresh);
          setNextCall(json.next_call || null);
          setFollowupsDue(Array.isArray(json.followups_due) ? json.followups_due : []);
          setInServiceLeads(Array.isArray(json.in_service_leads) ? json.in_service_leads : []);
          setRecentCalls(Array.isArray(json.recent_calls) ? json.recent_calls : []);
          setLeaderboard(Array.isArray(json.leaderboard) ? json.leaderboard : []);
        }
        setProfileName(json?.profile?.name || 'Telecaller');
        setTelecallerLeadOps(json?.telecaller_lead_ops || EMPTY_TELECALLER_LEAD_OPS);
        setLeadOpsVariant(json?.telecaller_lead_ops_variant === 'admin' ? 'admin' : 'self');
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
    { label: 'All', value: kpis.total_leads || 0, statusKey: 'All', filter: null as string | null, href: `${base}/leads?filter=all` },
    { label: 'Ringing', value: kpis.ringing || 0, statusKey: 'Ringing', filter: 'ringing', href: `${base}/leads?filter=ringing` },
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
      label: 'Other',
      value: kpis.other || 0,
      statusKey: 'Other',
      filter: 'other',
      href: `${base}/leads?filter=other`,
    },
    {
      label: 'Today due',
      value: kpis.followups_today,
      statusKey: 'Follow-up',
      filter: null as string | null,
      href: `${base}/followups`,
    },
  ];

  const openOpsLeads = useCallback(
    (opts: { filter?: string | null; source?: string; q?: string }) => {
      const params = new URLSearchParams();
      if (opts.filter) params.set('filter', opts.filter);
      if (opts.source) params.set('source', opts.source);
      if (opts.q) params.set('q', opts.q);
      const qs = params.toString();
      router.push(qs ? `${base}/leads?${qs}` : `${base}/leads`);
    },
    [router, base],
  );

  const activityBars = trend.map((t) => ({
    label: t.label || String(t.date || '').slice(5) || '',
    calls: Number(t.calls || 0),
    bookings: Number(t.leads_created || 0),
  }));
  const statusPie = kpiCards
    .filter((k) => k.filter && k.label !== 'All')
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

            <form
              className="flex min-w-0 w-full flex-1 items-center gap-2 lg:max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                const q = leadQ.trim();
                if (!q) return;
                router.push(`${base}/leads?q=${encodeURIComponent(q)}`);
              }}
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#004AAD]" />
                <input
                  value={leadQ}
                  onChange={(e) => {
                    setLeadQ(e.target.value);
                    setLeadHitsOpen(true);
                  }}
                  onFocus={() => setLeadHitsOpen(true)}
                  onBlur={() => setTimeout(() => setLeadHitsOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setLeadHitsOpen(false);
                  }}
                  placeholder="Search lead by name, phone, vehicle"
                  className="w-full rounded-xl border border-white bg-white py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                {leadHitsOpen && leadQ.trim().length >= 2 ? (
                  <div className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                    {leadHitsLoading && leadHits.length === 0 ? (
                      <p className="px-3 py-2.5 text-xs font-semibold text-slate-400">Searching…</p>
                    ) : leadHits.length === 0 ? (
                      <p className="px-3 py-2.5 text-xs font-semibold text-slate-400">No leads found</p>
                    ) : (
                      <>
                        {leadHits.map((hit) => (
                          <Link
                            key={hit.id}
                            href={`${base}/leads?q=${encodeURIComponent(leadQ.trim())}&lead=${encodeURIComponent(hit.id)}`}
                            onMouseDown={(e) => e.preventDefault()}
                            className="block px-3 py-2 hover:bg-slate-50"
                          >
                            <p className="truncate text-sm font-bold text-slate-900">
                              {hit.customer_name || 'Unnamed lead'}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {[hit.customer_phone, hit.lead_number, hit.vehicle_number, hit.vehicle_model]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </Link>
                        ))}
                        {leadHitsTotal > leadHits.length ? (
                          <Link
                            href={`${base}/leads?q=${encodeURIComponent(leadQ.trim())}`}
                            onMouseDown={(e) => e.preventDefault()}
                            className="block border-t border-slate-100 px-3 py-2 text-xs font-bold text-[#004AAD] hover:bg-slate-50"
                          >
                            See all {leadHitsTotal} results
                          </Link>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
              <button
                type="submit"
                className="inline-flex h-10 shrink-0 items-center rounded-xl bg-white px-3 text-xs font-bold text-[#023D95]"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => {
                  setRefreshing(true);
                  void load(true);
                }}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#023D95]"
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </form>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`${base}/book?mode=book`}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/40 bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/20"
              >
                <Calendar className="h-4 w-4" />
                Book
              </Link>
              <Link
                href={`${base}/book?mode=lead`}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-[#023D95]"
              >
                <Phone className="h-4 w-4" />
                Add Lead
              </Link>
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
            {nextCall ? (
              <div className="rounded-2xl bg-[#0F2744] p-4 text-white shadow-sm">
                <div className="text-[11px] font-extrabold tracking-wide text-blue-200">NEXT CALL</div>
                <div className="mt-1 text-lg font-extrabold">{formatDashName(nextCall.lead?.customer_name)}</div>
                <div className="text-sm text-slate-300">{nextCall.reason || nextCall.lead?.customer_phone || 'Follow-up'}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextCall.lead?.customer_phone ? (
                    <WebPhoneCallLink phone={String(nextCall.lead.customer_phone)} leadId={String(nextCall.lead_id || nextCall.lead?.id || '')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white">Call now</WebPhoneCallLink>
                  ) : null}
                  <Link href={`${base}/leads/${nextCall.lead_id || nextCall.lead?.id || ''}`} className="rounded-lg border border-white/20 px-3 py-2 text-xs font-bold text-slate-100">Open lead</Link>
                </div>
              </div>
            ) : null}

            <TelecallerLeadOpsPanel
              ops={telecallerLeadOps}
              periodLabel={datePreset === 'custom' ? dateRange.label : dateLabel}
              variant={leadOpsVariant}
              title={
                leadOpsVariant === 'admin'
                  ? isLeadManager
                    ? 'Team — leads & assignment'
                    : 'Telecaller — leads & assignment'
                  : undefined
              }
              selfLabel={formatDashName(profileName)}
              footerHint="click chip → leads"
              onLeadsReceivedClick={() => openOpsLeads({})}
              onCrmStatusClick={(crmLabel, ctx) => {
                const filter = crmLeadsFilterFromLabel(crmLabel);
                if (leadOpsVariant === 'admin' && ctx.assigneeName) {
                  const params = new URLSearchParams();
                  if (filter) params.set('filter', filter);
                  params.set('q', ctx.assigneeName === 'UNASSIGNED' ? '' : ctx.assigneeName);
                  if (ctx.assigneeName === 'UNASSIGNED') params.set('unassigned', '1');
                  router.push(`${base}/leads?${params.toString()}`);
                  return;
                }
                openOpsLeads({ filter, q: filter ? undefined : crmLabel });
              }}
              onSourceClick={(source, ctx) => {
                const params = new URLSearchParams();
                params.set('source', source);
                if (leadOpsVariant === 'admin' && ctx.assigneeName && ctx.assigneeName !== 'UNASSIGNED') {
                  params.set('q', ctx.assigneeName);
                }
                if (ctx.assigneeName === 'UNASSIGNED') params.set('unassigned', '1');
                router.push(`${base}/leads?${params.toString()}`);
              }}
            />

            {/* KPI grid — 6 and 6 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
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

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <div className="rounded-2xl border border-[#C7D7F5] border-l-4 border-l-[#004AAD] bg-[#F3F7FF] p-3.5 shadow-sm sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-bold text-[#023D95]">Fresh leads</h2>
                <Link href={`${base}/leads?filter=new`} className="rounded-full bg-[#E4EDFF] px-2 py-0.5 text-[11px] font-semibold text-[#004AAD]">
                  View all
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
                    const name = formatDashName(lead.customer_name);
                    return (
                      <li key={lead.id} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
                        <Link href={`${base}/leads/${lead.id}`} className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-90">
                          <span className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#DCE8FF] text-[11px] font-extrabold text-[#004AAD]">
                            {leadInitials(name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-semibold text-slate-900">{name}</span>
                            <span className="block truncate text-[10px] text-slate-500">
                              {phone || '—'}
                              {meta ? ` · ${meta}` : ''}
                            </span>
                          </span>
                        </Link>
                        <span className="w-16 shrink-0 text-right text-[11px] font-semibold text-[#004AAD]">
                          {formatLeadAgo(lead.created_at)}
                        </span>
                        {phone ? (
                          <WebPhoneCallLink
                            phone={phone}
                            leadId={String(lead.id)}
                            title="Call"
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DCE8FF] text-[#004AAD]"
                          >
                            <Phone className="h-3 w-3" />
                          </WebPhoneCallLink>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-[#F3D5B5] border-l-4 border-l-[#EA580C] bg-[#FFF7ED] p-3.5 shadow-sm sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-bold text-[#9A3412]">Reminders</h2>
                <Link href={`${base}/followups`} className="rounded-full bg-[#FFEDD5] px-2 py-0.5 text-[11px] font-semibold text-[#C2410C]">
                  View all
                </Link>
              </div>
              {upcomingReminders.length + followupsDue.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">No reminders</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {[...followupsDue, ...upcomingReminders]
                    .filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i)
                    .sort((a, b) => {
                      const now = Date.now();
                      return (
                        Math.abs(new Date(a.scheduled_time || 0).getTime() - now) -
                        Math.abs(new Date(b.scheduled_time || 0).getTime() - now)
                      );
                    })
                    .slice(0, 5)
                    .map((r) => {
                    const overdue = r.scheduled_time
                      ? new Date(r.scheduled_time).getTime() < Date.now()
                      : false;
                    const phone = String(r.lead?.customer_phone || '').trim();
                    const leadHref = `${base}/leads/${r.lead_id || r.lead?.id || ''}`;
                    const name = formatDashName(r.lead?.customer_name);
                    return (
                      <li key={r.id} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
                        <Link href={leadHref} className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-90">
                          <span className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#FFEDD5] text-[11px] font-extrabold text-[#C2410C]">
                            {leadInitials(name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-semibold text-slate-900">{name}</span>
                            <span className="block truncate text-[10px] text-slate-500">
                              {r.reason || 'Follow-up'}
                              {phone ? ` · ${phone}` : ''}
                            </span>
                          </span>
                        </Link>
                        <span className={`w-24 shrink-0 text-right text-[11px] font-semibold ${overdue ? 'text-red-600' : 'text-emerald-600'}`}>
                          {formatReminderClock(r.scheduled_time)}
                        </span>
                        {phone ? (
                          <WebPhoneCallLink
                            phone={phone}
                            leadId={String(r.lead_id || r.lead?.id || '')}
                            title="Call"
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFEDD5] text-[#C2410C]"
                          >
                            <Phone className="h-3 w-3" />
                          </WebPhoneCallLink>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            </div>

            {/* Lead manager: whole team. Telecaller: the API returns only their own leads. */}
            <BookingConfirmedTodayCard
              viewAllHref={`${base}/booking-confirmed`}
              leadHref={(row) => `${base}/leads?lead=${encodeURIComponent(row.id)}`}
            />

            {/* Quick Actions — web only, above analytics (phone order unchanged) */}
            <div className="rounded-2xl border border-[#C7D7F5] bg-[#F4F8FF] p-3.5 sm:p-4">
              <h2 className="text-[14px] font-bold text-[#023D95] mb-2">Quick Actions</h2>
              <div
                className={`grid grid-cols-3 gap-2 ${isLeadManager ? 'lg:grid-cols-7' : 'lg:grid-cols-6'}`}
              >
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
                    label: 'Leads',
                    icon: ClipboardList,
                    color: '#F59E0B',
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
                    href: '#whatsapp',
                    label: 'WhatsApp',
                    icon: MessageCircle,
                    color: '#25D366',
                    action: 'open-wa-inbox' as const,
                  },
                  ...(isLeadManager
                    ? [
                        {
                          href: `${base}/assignment`,
                          label: 'Assignment',
                          icon: MessageCircle,
                          color: '#7C3AED',
                        },
                      ]
                    : []),
                ].map((a) =>
                  a.action === 'open-wa-inbox' ? (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => {
                        setWaUnread(0);
                        window.dispatchEvent(new CustomEvent('myfng:open-wa-inbox'));
                      }}
                      className="relative flex w-full flex-row items-center justify-start gap-1.5 rounded-xl border border-[#E6EDF5] bg-white px-2 py-2.5 text-left shadow-sm transition hover:brightness-[0.98]"
                    >
                      <span
                        className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${a.color}18` }}
                      >
                        <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                      </span>
                      <span className="min-w-0 text-left text-[11px] font-bold leading-tight text-[#0F2744]">
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
                      className="flex w-full flex-row items-center justify-start gap-1.5 rounded-xl border border-[#E6EDF5] bg-white px-2 py-2.5 text-left shadow-sm transition hover:brightness-[0.98]"
                    >
                      <span
                        className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${a.color}18` }}
                      >
                        <a.icon className="w-4 h-4" style={{ color: a.color }} />
                      </span>
                      <span className="min-w-0 text-left text-[11px] font-bold leading-tight text-[#0F2744]">
                        {a.label}
                      </span>
                    </Link>
                  ),
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-3.5 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-[14px] font-bold text-[#1E3A8A]">Cars in service</h2>
                  <Link
                    href={`${base}/leads?filter=in_service`}
                    className="rounded-full border border-[#93C5FD] bg-[#DBEAFE] px-2 py-0.5 text-[11px] font-semibold text-[#1E40AF]"
                  >
                    View all
                  </Link>
                </div>
                {inServiceLeads.length === 0 ? <p className="text-sm text-slate-500">No cars in service</p> : (
                  <ul className="divide-y divide-[#BFDBFE]/60">
                    {inServiceLeads.map((lead) => {
                      const name = formatDashName(lead.customer_name);
                      const line = [lead.vehicle_number, lead.vehicle_make, lead.vehicle_model, lead.city]
                        .filter(Boolean)
                        .join(' · ') || 'In service';
                      return (
                        <li key={lead.id} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
                          <Link href={`${base}/leads/${lead.id}`} className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-90">
                            <span className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-[11px] font-extrabold text-[#1D4ED8]">
                              {leadInitials(name)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12px] font-semibold text-slate-900">{name}</span>
                              <span className="block truncate text-[10px] text-slate-600">{line}</span>
                            </span>
                          </Link>
                          <span className="shrink-0 rounded-full border border-[#93C5FD] bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-bold text-[#1E40AF]">
                            In service
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <h2 className="mb-2 text-[14px] font-bold text-[#023D95]">Recent calls</h2>
                {recentCalls.length === 0 ? <p className="text-sm text-slate-500">No calls yet</p> : (
                  <ul className="divide-y divide-slate-100">
                    {recentCalls.map((call) => (
                      <li key={call.id} className="py-1.5">
                        <Link href={`${base}/leads/${call.lead?.id || call.lead_id || ''}`} className="block truncate text-[12px] font-semibold text-slate-900">{formatDashName(call.lead?.customer_name || call.phone_number)}</Link>
                        <span className="block truncate text-[10px] text-slate-500">{call.call_status || 'Call'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {isLeadManager ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <h2 className="mb-2 text-[14px] font-bold text-[#023D95]">Team today</h2>
                {leaderboard.length === 0 ? <p className="text-sm text-slate-500">No calls logged today</p> : (
                  <ul className="divide-y divide-slate-100">
                    {leaderboard.map((row) => (
                      <li key={row.rank} className="flex items-center justify-between py-1.5 text-[13px]">
                        <span className={row.is_me ? 'font-extrabold text-[#004AAD]' : 'font-semibold text-slate-900'}>{row.rank}. {row.is_me ? 'You' : row.name}</span>
                        <span className="text-[11px] font-bold text-slate-500">{row.total_calls || 0} calls</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              ) : null}
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

            <div className="rounded-2xl border border-[#E6EDF5] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="text-lg font-extrabold" style={{ color: '#0F2744' }}>
                  {datePreset === 'today' ? "Today's performance" : 'Performance'}
                </h2>
                <span className="text-xs font-semibold text-slate-500">{dateLabel}</span>
              </div>
              {(() => {
                const calls = Number(kpis.today_calls || 0);
                const connected = Number(kpis.answered_calls || 0);
                const bookings = Number(kpis.booking_confirmed ?? kpis.booked ?? 0);
                const talkSeconds = Number(kpis.talk_duration_seconds || 0);
                const connectRatio = calls > 0 ? connected / calls : 0;
                const talkRatio = Math.min(1, talkSeconds / (3 * 3600));
                const bookRatio = calls > 0 ? Math.min(1, bookings / calls) : bookings > 0 ? 1 : 0;
                const avg = Math.max(0, Math.floor(Number(kpis.avg_call_seconds || 0)));
                const avgLabel = `${Math.floor(avg / 60)}:${String(avg % 60).padStart(2, '0')}`;
                const bars = [
                  { label: 'Connected', value: `${connected} / ${calls}`, ratio: connectRatio, color: '#15803D' },
                  { label: 'Talk time', value: formatDurationShort(talkSeconds), ratio: talkRatio, color: '#1D4ED8' },
                  { label: 'Bookings', value: String(bookings), ratio: bookRatio, color: '#7C3AED' },
                ];
                const stats = [
                  { value: `${kpis.answer_rate ?? 0}%`, label: 'Answer rate', color: '#15803D' },
                  { value: avgLabel, label: 'Avg call', color: '#0F2744' },
                  { value: String(kpis.new_leads ?? 0), label: 'New leads', color: '#1D4ED8' },
                  { value: String(kpis.overdue_callbacks ?? 0), label: 'Overdue', color: '#DC2626' },
                ];
                return (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="relative h-[104px] w-[104px] shrink-0">
                        <div
                          className="h-full w-full rounded-full"
                          style={{ background: `conic-gradient(#1D4ED8 ${Math.round(connectRatio * 100)}%, #E7EEF8 0)` }}
                        />
                        <div className="absolute inset-[11px] flex flex-col items-center justify-center rounded-full bg-white">
                          <div className="text-[26px] font-extrabold leading-none text-[#0F2744]">{calls}</div>
                          <div className="mt-1 text-[11px] font-semibold text-slate-500">calls</div>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 space-y-2.5">
                        {bars.map((bar) => (
                          <div key={bar.label}>
                            <div className="flex items-center justify-between gap-2 text-[13px]">
                              <span className="font-bold text-slate-700">{bar.label}</span>
                              <span className="font-extrabold text-[#0F2744]">{bar.value}</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EEF2F7]">
                              <div className="h-full rounded-full" style={{ width: `${Math.round(bar.ratio * 100)}%`, backgroundColor: bar.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {stats.map((stat) => (
                        <div key={stat.label} className="rounded-xl bg-[#F4F7FB] px-1 py-2.5 text-center">
                          <div className="text-lg font-extrabold" style={{ color: stat.color }}>{stat.value}</div>
                          <div className="mt-0.5 text-[11px] font-semibold leading-tight text-slate-500">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
