'use client';

import { useCallback, useEffect, useState, Suspense, useRef, useMemo, type CSSProperties } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import MlScoreBadge from '@/components/telecaller/crm/MlScoreBadge';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import {
  resolveCrmDateRange,
  type CrmDatePreset,
} from '@/lib/telecaller/crmDateRange';
import {
  defaultTelecallerCrmFilterPrefs,
  loadTelecallerCrmFilterPrefs,
  saveTelecallerCrmFilterPrefs,
} from '@/lib/telecaller/crmFilterPrefs';
import {
  LEAD_STATUS_FILTERS,
  LOST_REASON_FILTERS,
  leadDisplayStatus,
  leadStatusCardColors,
  mergeCrmStatusFilters,
} from '@/lib/telecaller/leadDisplayStatus';
import { createClient } from '@/lib/supabase/client';
import {
  Phone,
  Search,
  Share2,
  Bell,
  Loader2,
  X,
  SlidersHorizontal,
  ChevronDown,
  List,
  LineChart,
  Columns3,
  CalendarDays,
  Download,
  Upload,
  UserPlus,
} from 'lucide-react';
import BookingsLeadsChartPanel from '@/components/admin/BookingsLeadsChartPanel';
import ManagerBulkActionsBar from '@/components/telecaller/crm/ManagerBulkActionsBar';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import CrmDatePickerModal from '@/components/telecaller/crm/CrmDatePickerModal';

const LEADS_COLUMNS_STORAGE_KEY = 'telecaller_crm_leads_columns_v5';

const BOOKING_SOURCE_OPTIONS = [
  { value: 'ALL', label: 'All Sources' },
  { value: 'APP', label: 'App Booking' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'MISA', label: 'MISA AI' },
  { value: 'SARV', label: 'Incoming Sarv Call' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'GOOGLE', label: 'Google Ads' },
  { value: 'META', label: 'Meta / Insta Ads' },
  { value: 'PARTNER', label: 'Partner' },
  { value: 'REFERENCE', label: 'Reference' },
  { value: 'BANNER', label: 'Banner / Offline' },
  { value: 'OTHER', label: 'Other' },
] as const;

const BOOKING_COUPON_OPTIONS = [
  { value: 'ALL', label: 'All discounts' },
  { value: 'YES', label: 'Any discount' },
  { value: 'PROMO', label: 'Promo coupon' },
  { value: 'REFERRAL', label: 'Refer & Rise' },
  { value: 'NO', label: 'No discount' },
] as const;

const LEADS_TABLE_COLUMNS = [
  { key: 'leadNumber', label: 'Lead #', onByDefault: false, locked: false },
  { key: 'status', label: 'Status', onByDefault: true, locked: false },
  { key: 'mlScore', label: 'ML', onByDefault: true, locked: false },
  { key: 'customer', label: 'Customer', onByDefault: true, locked: false },
  { key: 'phone', label: 'Phone', onByDefault: true, locked: false },
  { key: 'message', label: 'Message', onByDefault: true, locked: false },
  { key: 'regNo', label: 'Reg. No', onByDefault: true, locked: false },
  { key: 'makeModel', label: 'Make / Model', onByDefault: true, locked: false },
  { key: 'city', label: 'City', onByDefault: true, locked: false },
  { key: 'priority', label: 'Priority', onByDefault: false, locked: false },
  { key: 'source', label: 'Source', onByDefault: false, locked: false },
  { key: 'assignee', label: 'Assignee', onByDefault: true, locked: false },
  { key: 'date', label: 'Created on', onByDefault: true, locked: false },
  { key: 'modified', label: 'Modified', onByDefault: true, locked: false },
  { key: 'actions', label: 'Actions', onByDefault: true, locked: true },
] as const;

type LeadsColumnKey = (typeof LEADS_TABLE_COLUMNS)[number]['key'];
type LeadsColumnVisibility = Record<LeadsColumnKey, boolean>;

const DEFAULT_LEADS_COLUMNS: LeadsColumnVisibility = LEADS_TABLE_COLUMNS.reduce((acc, col) => {
  acc[col.key] = col.onByDefault;
  return acc;
}, {} as LeadsColumnVisibility);

/** Split date + time onto two lines (TeleCRM-style stack). */
function formatLeadDateParts(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return {
    date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
}

function formatLeadDateTime(iso: string | null | undefined) {
  const parts = formatLeadDateParts(iso);
  if (!parts) return '—';
  return `${parts.date}, ${parts.time}`;
}

/** Prefer 2 lines with full name (no ellipsis) — first word(s) then remainder. */
function splitCustomerNameLines(name: string): [string, string | null] {
  const full = String(name || '').trim() || 'Unknown';
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return [full, null];
  if (parts.length === 2) return [parts[0], parts[1]];
  // 3+ words: keep first on line 1, rest complete on line 2
  return [parts[0], parts.slice(1).join(' ')];
}

function StackedDateTime({ iso }: { iso: string | null | undefined }) {
  const parts = formatLeadDateParts(iso);
  if (!parts) return <span>—</span>;
  return (
    <span className="inline-flex flex-col leading-tight">
      <span>{parts.date}</span>
      <span className="text-slate-400">{parts.time}</span>
    </span>
  );
}

function loadLeadsColumnVisibility(): LeadsColumnVisibility {
  if (typeof window === 'undefined') return { ...DEFAULT_LEADS_COLUMNS };
  try {
    const raw = window.localStorage.getItem(LEADS_COLUMNS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LEADS_COLUMNS };
    const parsed = JSON.parse(raw) as Partial<LeadsColumnVisibility>;
    const next = { ...DEFAULT_LEADS_COLUMNS };
    for (const col of LEADS_TABLE_COLUMNS) {
      if (typeof parsed[col.key] === 'boolean') next[col.key] = parsed[col.key]!;
    }
    next.actions = true;
    return next;
  } catch {
    return { ...DEFAULT_LEADS_COLUMNS };
  }
}

function saveLeadsColumnVisibility(next: LeadsColumnVisibility) {
  try {
    window.localStorage.setItem(LEADS_COLUMNS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function openLeadWhatsApp(lead: { customer_phone?: string | null; message_preview?: string | null }) {
  const phone = String(lead?.customer_phone || '').replace(/\D/g, '');
  if (!phone) return;
  window.dispatchEvent(
    new CustomEvent('myfng:open-wa-chat', {
      detail: {
        phone,
        preview: lead?.message_preview || undefined,
      },
    }),
  );
}

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'NORMAL', label: 'NORMAL' },
  { value: 'HIGH', label: 'HIGH' },
  { value: 'URGENT', label: 'URGENT' },
];

function TelecallerCrmLeadsContent() {
  const pathname = usePathname();
  const { base, layoutRole, isLeadManager } = getCrmDashboardBase(pathname);
  const searchParams = useSearchParams();
  const router = useRouter();
  const filterParam = searchParams?.get('filter');
  const dateParam = searchParams?.get('date') as CrmDatePreset | null;
  const dateFieldParam = searchParams?.get('date_field');
  const cityParam = searchParams?.get('city');
  const priorityParam = searchParams?.get('priority');
  const qParam = searchParams?.get('q');
  const lostParam = searchParams?.get('lost_reason');
  const telecallerParam = searchParams?.get('telecaller_id');
  const unassignedParam = searchParams?.get('unassigned');
  const sourceParam = searchParams?.get('source');
  const couponParam = searchParams?.get('has_coupon');
  const triggerParam = searchParams?.get('trigger');

  // Defaults only — hydrate from localStorage after mount (SSR-safe)
  const defaults = defaultTelecallerCrmFilterPrefs();
  const [prefsReady, setPrefsReady] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const bootedRef = useRef(false);
  const [q, setQ] = useState(qParam || '');
  const [appliedQ, setAppliedQ] = useState(qParam || '');
  const [filter, setFilter] = useState(filterParam || 'all');
  const [statusFilters, setStatusFilters] = useState<Array<{ id: string; label: string }>>(
    () => LEAD_STATUS_FILTERS.map((f) => ({ id: f.id, label: f.label })),
  );
  const [lostReason, setLostReason] = useState(lostParam || '');
  const [city, setCity] = useState(cityParam || '');
  const [priority, setPriority] = useState(priorityParam || '');
  const [telecallerId, setTelecallerId] = useState(telecallerParam || '');
  const [unassignedOnly, setUnassignedOnly] = useState(unassignedParam === '1');
  const [sourceFilter, setSourceFilter] = useState(sourceParam || 'ALL');
  const [couponFilter, setCouponFilter] = useState(couponParam || 'ALL');
  const [triggerFilter, setTriggerFilter] = useState(triggerParam || '');
  const [messageTriggers, setMessageTriggers] = useState<Array<{ id: string; label: string }>>([]);
  const [overview, setOverview] = useState<{
    total: number;
    app: number;
    website: number;
    misa: number;
    googleAds: number;
    metaAds: number;
    withPromoCoupon: number;
    withReferralReward: number;
    newLeads: number;
  } | null>(null);
  const [telecallers, setTelecallers] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>(dateParam || defaults.datePreset);
  const [dateField, setDateField] = useState<'created' | 'modified'>(
    dateFieldParam === 'modified' || dateFieldParam === 'updated_at' ? 'modified' : defaults.dateField,
  );
  const [customStart, setCustomStart] = useState(defaults.customStart);
  const [customEnd, setCustomEnd] = useState(defaults.customEnd);
  const [cities, setCities] = useState<string[]>([]);
  const [shareLead, setShareLead] = useState<any>(null);
  const [peers, setPeers] = useState<any[]>([]);
  const [sharing, setSharing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advIncomplete, setAdvIncomplete] = useState(false);
  const [advFollowUp, setAdvFollowUp] = useState(false);
  const [advHasVehicle, setAdvHasVehicle] = useState(false);
  const [advHasCoupon, setAdvHasCoupon] = useState(false);
  const [advNoAssignee, setAdvNoAssignee] = useState(false);
  const [advHasPhone, setAdvHasPhone] = useState(false);
  const [advOverdueReminder, setAdvOverdueReminder] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState<25 | 50 | 75 | 100>(25);
  const [page, setPage] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState<LeadsColumnVisibility>(DEFAULT_LEADS_COLUMNS);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);
  const advancedMenuRef = useRef<HTMLDivElement>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    setVisibleColumns(loadLeadsColumnVisibility());
  }, []);

  useEffect(() => {
    if (!columnsMenuOpen && !showAdvanced) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (columnsMenuOpen && !columnsMenuRef.current?.contains(t)) setColumnsMenuOpen(false);
      if (showAdvanced && !advancedMenuRef.current?.contains(t)) setShowAdvanced(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [columnsMenuOpen, showAdvanced]);

  const showCol = (key: LeadsColumnKey) => {
    if (key === 'assignee' && !isLeadManager) return false;
    if (key === 'source' && !isLeadManager) return false;
    if (key === 'mlScore' && !isLeadManager) return false;
    return Boolean(visibleColumns[key]);
  };

  const visibleTableCols = useMemo(() => {
    return LEADS_TABLE_COLUMNS.filter((c) => showCol(c.key));
  }, [visibleColumns, isLeadManager]);

  const dataColWidthPct = useMemo(() => {
    const dataCount = visibleTableCols.filter((c) => c.key !== 'actions').length || 1;
    return `${(100 / dataCount).toFixed(3)}%`;
  }, [visibleTableCols]);

  /** Tight widths for Status / Customer / Phone so badge ↔ name gap isn't huge. */
  const colWidthStyle = (key: LeadsColumnKey): CSSProperties => {
    if (key === 'status') return { width: '5.25rem', minWidth: '5.25rem', maxWidth: '5.75rem' };
    if (key === 'mlScore') return { width: '3.5rem', minWidth: '3.25rem', maxWidth: '3.75rem' };
    if (key === 'phone') return { width: '6.75rem', minWidth: '6.5rem', maxWidth: '7.25rem' };
    if (key === 'customer') return { width: '8.25rem', minWidth: '7.5rem', maxWidth: '10rem' };
    return { width: dataColWidthPct };
  };

  const toggleColumn = (key: LeadsColumnKey) => {
    const meta = LEADS_TABLE_COLUMNS.find((c) => c.key === key);
    if (meta?.locked) return;
    setVisibleColumns((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!LEADS_TABLE_COLUMNS.some((c) => next[c.key] && c.key !== 'actions')) {
        next.customer = true;
      }
      saveLeadsColumnVisibility(next);
      return next;
    });
  };

  const dateRangeLabel = useMemo(
    () => resolveCrmDateRange(datePreset, customStart, customEnd).label,
    [datePreset, customStart, customEnd],
  );

  const advancedOnCount = [
    advIncomplete,
    advFollowUp,
    advHasVehicle,
    advHasCoupon,
    advNoAssignee,
    advHasPhone,
    advOverdueReminder,
    dateField === 'modified',
  ].filter(Boolean).length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/lead-manager/statuses');
        const json = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const rows = Array.isArray(json?.statuses) ? json.statuses : [];
        if (!rows.length) return;
        setStatusFilters(mergeCrmStatusFilters(rows, 'All'));
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore saved filters once on client (survives lead open → back)
  useEffect(() => {
    const saved = loadTelecallerCrmFilterPrefs();
    setFilter(filterParam || 'all');
    setDatePreset((dateParam && dateParam) || saved.datePreset);
    setDateField(
      dateFieldParam === 'modified' || dateFieldParam === 'updated_at'
        ? 'modified'
        : saved.dateField || 'created',
    );
    setCustomStart(saved.customStart);
    setCustomEnd(saved.customEnd);
    setLostReason(lostParam || saved.lostReason || '');
    setCity(cityParam || saved.city || '');
    setPriority(priorityParam || saved.priority || '');
    setQ(qParam || saved.q || '');
    setAppliedQ(qParam || saved.q || '');
    setTelecallerId(telecallerParam || saved.telecallerId || '');
    setUnassignedOnly(unassignedParam === '1' || saved.unassignedOnly);
    setSourceFilter(sourceParam || 'ALL');
    setCouponFilter(couponParam || 'ALL');
    setTriggerFilter(triggerParam || '');
    setAdvIncomplete(saved.advIncomplete);
    setAdvFollowUp(saved.advFollowUp);
    setAdvHasVehicle(saved.advHasVehicle);
    setAdvHasCoupon(saved.advHasCoupon);
    setAdvNoAssignee(saved.advNoAssignee);
    setPrefsReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount / URL entry
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    setFilter(filterParam || 'all');
  }, [filterParam, prefsReady]);

  const syncFiltersToUrl = useCallback(
    (next: {
      filter?: string;
      datePreset?: CrmDatePreset;
      dateField?: 'created' | 'modified';
      city?: string;
      priority?: string;
      q?: string;
      lostReason?: string;
      telecallerId?: string;
      unassignedOnly?: boolean;
      source?: string;
      hasCoupon?: string;
      trigger?: string;
    }) => {
      const params = new URLSearchParams(searchParams?.toString() || '');
      const f = next.filter ?? filter;
      const d = next.datePreset ?? datePreset;
      const df = next.dateField ?? dateField;
      const c = next.city ?? city;
      const p = next.priority ?? priority;
      const query = next.q ?? appliedQ;
      const lr = next.lostReason ?? lostReason;
      const tid = next.telecallerId ?? telecallerId;
      const una = next.unassignedOnly ?? unassignedOnly;
      const src = next.source ?? sourceFilter;
      const coupon = next.hasCoupon ?? couponFilter;
      const trig = next.trigger ?? triggerFilter;

      if (!f || f === 'all') params.delete('filter');
      else params.set('filter', f);
      if (!d || d === 'last_7_days') params.delete('date');
      else params.set('date', d);
      if (!df || df === 'created') params.delete('date_field');
      else params.set('date_field', df);
      if (!c) params.delete('city');
      else params.set('city', c);
      if (!p) params.delete('priority');
      else params.set('priority', p);
      if (!query) params.delete('q');
      else params.set('q', query);
      if (f === 'lost' && lr) params.set('lost_reason', lr);
      else params.delete('lost_reason');
      if (isLeadManager && tid) params.set('telecaller_id', tid);
      else params.delete('telecaller_id');
      if (isLeadManager && una) params.set('unassigned', '1');
      else params.delete('unassigned');
      if (isLeadManager && src && src !== 'ALL') params.set('source', src);
      else params.delete('source');
      if (isLeadManager && coupon && coupon !== 'ALL') params.set('has_coupon', coupon);
      else params.delete('has_coupon');
      if (isLeadManager && trig) params.set('trigger', trig);
      else params.delete('trigger');

      const qs = params.toString();
      router.replace(`${base}/leads${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [
      searchParams,
      filter,
      datePreset,
      dateField,
      city,
      priority,
      appliedQ,
      lostReason,
      telecallerId,
      unassignedOnly,
      sourceFilter,
      couponFilter,
      triggerFilter,
      isLeadManager,
      router,
      base,
    ],
  );

  const persistAll = useCallback(
    (partial: Parameters<typeof saveTelecallerCrmFilterPrefs>[0]) => {
      saveTelecallerCrmFilterPrefs(partial);
    },
    [],
  );

  const openLead = (leadId: string) => {
    router.push(`${base}/leads/${leadId}`);
  };

  const displayedLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (advIncomplete && !lead.is_incomplete) return false;
      if (advFollowUp && !lead.follow_up_required && !lead.next_follow_up_at && !lead.reminder?.at) {
        return false;
      }
      if (advHasVehicle) {
        const reg = String(lead.vehicle_number || '')
          .trim()
          .toUpperCase();
        if (!reg || reg === 'NA' || reg === '—') return false;
      }
      if (advHasCoupon) {
        const code = String(lead.coupon_code || lead.coupon_meta?.coupon_code || '').trim();
        if (!code) return false;
      }
      if (advNoAssignee && lead.assigned_telecaller_id) return false;
      if (advHasPhone && !String(lead.customer_phone || '').trim()) return false;
      if (advOverdueReminder) {
        const at = lead.reminder?.at || lead.next_follow_up_at;
        if (!at || new Date(at).getTime() >= Date.now()) return false;
      }
      return true;
    });
  }, [
    leads,
    advIncomplete,
    advFollowUp,
    advHasVehicle,
    advHasCoupon,
    advNoAssignee,
    advHasPhone,
    advOverdueReminder,
  ]);

  const persistDate = (next: {
    datePreset?: CrmDatePreset;
    customStart?: string;
    customEnd?: string;
  }) => {
    if (next.datePreset) setDatePreset(next.datePreset);
    if (typeof next.customStart === 'string') setCustomStart(next.customStart);
    if (typeof next.customEnd === 'string') setCustomEnd(next.customEnd);
    persistAll(next);
    if (next.datePreset) syncFiltersToUrl({ datePreset: next.datePreset });
  };

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('cities')
          .select('name')
          .eq('is_active', true)
          .order('name');
        setCities(
          Array.from(
            new Set((data || []).map((c: any) => String(c.name || '').trim()).filter(Boolean)),
          ),
        );
      } catch {
        setCities([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isLeadManager) return;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('users_login')
          .select('id, full_name, roles!role_id(role_code)')
          .eq('is_active', true)
          .order('full_name');
        setTelecallers(
          (data || [])
            .filter((t: any) => String(t?.roles?.role_code || '').toUpperCase() === 'TELECALLER')
            .map((t: any) => ({ id: String(t.id), full_name: t.full_name ? String(t.full_name) : null })),
        );
      } catch {
        setTelecallers([]);
      }
    })();
  }, [isLeadManager]);

  useEffect(() => {
    if (!isLeadManager) return;
    let cancelled = false;
    fetch('/api/lead-manager/message-triggers', { credentials: 'include', cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const rows = Array.isArray(json?.triggers) ? json.triggers : [];
        setMessageTriggers(
          rows
            .filter((t: any) => t?.id && t?.is_active !== false)
            .map((t: any) => ({
              id: String(t.id),
              label: String(t.label || t.phrase || t.id),
            })),
        );
      })
      .catch(() => {
        if (!cancelled) setMessageTriggers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isLeadManager]);

  useEffect(() => {
    if (!isLeadManager || !prefsReady) return;
    let cancelled = false;
    const range = resolveCrmDateRange(datePreset, customStart, customEnd);
    const params = new URLSearchParams({ overview: '1', limit: '4000' });
    if (!range.allTime) {
      params.set('from', range.start);
      params.set('to', range.end);
    }
    if (dateField === 'modified') params.set('date_field', 'updated_at');
    fetch(`/api/telecaller/crm/leads?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json?.overview) return;
        setOverview(json.overview);
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isLeadManager, prefsReady, datePreset, customStart, customEnd, dateField]);

  const exportLeadsCsv = () => {
    const range = resolveCrmDateRange(datePreset, customStart, customEnd);
    const params = new URLSearchParams({ export: '1' });
    const preset =
      datePreset === 'last_3_days' || datePreset === 'custom' ? 'custom' : datePreset;
    params.set('preset', preset === 'last_7_days' ? 'last_7_days' : String(preset));
    if (preset === 'custom' || datePreset === 'last_3_days') {
      params.set('start', range.start);
      params.set('end', range.end);
    }
    if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
    if (couponFilter !== 'ALL') params.set('has_coupon', couponFilter);
    if (appliedQ.trim()) params.set('search', appliedQ.trim());
    window.location.href = `/api/super_admin/leads?${params.toString()}`;
  };

  const toggleSelect = (id: string) => {
    if (!isLeadManager) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pageLeadIds = useMemo(
    () => displayedLeads.map((l) => String(l.id)).filter(Boolean),
    [displayedLeads],
  );

  const allPageSelected =
    isLeadManager && pageLeadIds.length > 0 && pageLeadIds.every((id) => selectedIds.has(id));

  const toggleSelectPage = () => {
    if (!isLeadManager) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageLeadIds.forEach((id) => next.delete(id));
      } else {
        pageLeadIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const load = useCallback(async () => {
    if (!prefsReady) return;
    if (bootedRef.current) setRefreshing(true);
    else setLoading(true);
    try {
      const range = resolveCrmDateRange(datePreset, customStart, customEnd);
      const baseParams = new URLSearchParams();
      if (filter && filter !== 'all') baseParams.set('filter', filter);
      if (filter === 'lost' && lostReason.trim()) baseParams.set('lost_reason', lostReason.trim());
      if (appliedQ.trim()) baseParams.set('q', appliedQ.trim());
      if (city.trim()) baseParams.set('city', city.trim());
      if (priority.trim()) baseParams.set('priority', priority.trim());
      if (dateField === 'modified') baseParams.set('date_field', 'updated_at');
      if (isLeadManager && telecallerId.trim()) baseParams.set('telecaller_id', telecallerId.trim());
      if (isLeadManager && unassignedOnly) baseParams.set('unassigned', '1');
      if (isLeadManager && sourceFilter && sourceFilter !== 'ALL') baseParams.set('source', sourceFilter);
      if (isLeadManager && couponFilter && couponFilter !== 'ALL') {
        baseParams.set('has_coupon', couponFilter);
      }
      if (isLeadManager && triggerFilter) baseParams.set('trigger', triggerFilter);
      // Name / phone / lead# search must not be limited by Last 7 Days — match across all time
      const searching = Boolean(appliedQ.trim());
      if (!searching && !range.allTime) {
        baseParams.set('from', range.start);
        baseParams.set('to', range.end);
      }

      if (viewMode === 'chart') {
        // Pull every matching lead (paged) so chart totals match filters, not a 100-row sample
        const pageLimit = 1000;
        let pageNum = 1;
        let all: any[] = [];
        let total = 0;
        for (;;) {
          const params = new URLSearchParams(baseParams);
          params.set('for_chart', '1');
          params.set('limit', String(pageLimit));
          params.set('page', String(pageNum));
          const res = await fetch(`/api/telecaller/crm/leads?${params.toString()}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || 'Failed');
          const batch = Array.isArray(data?.leads) ? data.leads : [];
          total = Number(data?.total || 0);
          all = all.concat(batch);
          if (batch.length < pageLimit || all.length >= total || pageNum >= 40) break;
          pageNum += 1;
        }
        setLeads(all);
        setTotalLeads(total || all.length);
      } else {
        const params = new URLSearchParams(baseParams);
        params.set('limit', String(pageSize));
        params.set('page', String(page));
        const res = await fetch(`/api/telecaller/crm/leads?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed');
        setLeads(Array.isArray(data?.leads) ? data.leads : []);
        setTotalLeads(Number(data?.total || 0));
      }
    } catch (e) {
      console.error(e);
      if (!bootedRef.current) {
        setLeads([]);
        setTotalLeads(0);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      bootedRef.current = true;
    }
  }, [
    prefsReady,
    viewMode,
    page,
    pageSize,
    filter,
    lostReason,
    appliedQ,
    city,
    priority,
    datePreset,
    dateField,
    customStart,
    customEnd,
    isLeadManager,
    telecallerId,
    unassignedOnly,
    sourceFilter,
    couponFilter,
    triggerFilter,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset to page 1 when filters change (not when page itself changes)
  useEffect(() => {
    setPage(1);
  }, [
    filter,
    lostReason,
    appliedQ,
    city,
    priority,
    datePreset,
    dateField,
    customStart,
    customEnd,
    telecallerId,
    unassignedOnly,
    sourceFilter,
    couponFilter,
    triggerFilter,
    pageSize,
    advIncomplete,
    advFollowUp,
    advHasVehicle,
    advHasCoupon,
    advNoAssignee,
  ]);

  const totalPages = Math.max(1, Math.ceil(totalLeads / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const pageStart = totalLeads === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, totalLeads);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const runSearch = () => {
    const nextQ = q.trim();
    setAppliedQ(nextQ);
    persistAll({ q: nextQ });
    syncFiltersToUrl({ q: nextQ });
  };

  // Search-as-you-type (debounce) — no need to press Search
  useEffect(() => {
    if (!prefsReady) return;
    const handle = window.setTimeout(() => {
      const nextQ = q.trim();
      setAppliedQ((prev) => {
        if (prev === nextQ) return prev;
        return nextQ;
      });
      persistAll({ q: nextQ });
      syncFiltersToUrl({ q: nextQ });
    }, 350);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on q only
  }, [q, prefsReady]);

  const openShare = async (lead: any) => {
    setShareLead(lead);
    try {
      const res = await fetch('/api/telecaller/crm/transfer?peers=1');
      const data = await res.json();
      setPeers(Array.isArray(data?.peers) ? data.peers : []);
    } catch {
      setPeers([]);
    }
  };

  const doTransfer = async (toId: string) => {
    if (!shareLead) return;
    setSharing(true);
    try {
      const res = await fetch('/api/telecaller/crm/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: shareLead.id,
          to_telecaller_id: toId,
          transfer_type: 'TRANSFER',
          reason: 'Transferred from MyFNG',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setShareLead(null);
      load();
    } catch (e: any) {
      alert(e?.message || 'Failed');
    } finally {
      setSharing(false);
    }
  };

  const setFilterAndUrl = (id: string) => {
    setFilter(id);
    if (id !== 'lost') setLostReason('');
    persistAll({ statusFilter: id, lostReason: id === 'lost' ? lostReason : '' });
    syncFiltersToUrl({ filter: id, lostReason: id === 'lost' ? lostReason : '' });
  };

  return (
    <DashboardLayout role={layoutRole}>
      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#023D95]">Leads</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isLeadManager
                ? 'Bookings + CRM leads ek jagah. Source / discount / trigger filter — click karke Service Lead Details.'
                : 'Sirf aapke assigned (ya aapke banaye) leads — WhatsApp · 6161 sticky pe niche.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex shrink-0 items-center rounded-full border-2 border-[#004AAD] bg-white p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('chart')}
                title="Chart view"
                aria-pressed={viewMode === 'chart'}
                style={
                  viewMode === 'chart'
                    ? { backgroundColor: '#004AAD', color: '#fff' }
                    : { color: '#334155' }
                }
                className={`inline-flex h-9 w-10 items-center justify-center rounded-full transition ${
                  viewMode === 'chart' ? 'shadow-sm' : 'hover:bg-slate-50'
                }`}
              >
                <LineChart className="h-4 w-4" stroke="currentColor" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="List view"
                aria-pressed={viewMode === 'list'}
                style={
                  viewMode === 'list'
                    ? { backgroundColor: '#004AAD', color: '#fff' }
                    : { color: '#334155' }
                }
                className={`inline-flex h-9 w-10 items-center justify-center rounded-full transition ${
                  viewMode === 'list' ? 'shadow-sm' : 'hover:bg-slate-50'
                }`}
              >
                <List className="h-4 w-4" stroke="currentColor" />
              </button>
            </div>
            {viewMode === 'list' ? (
              <div className="relative shrink-0" ref={columnsMenuRef}>
                <button
                  type="button"
                  onClick={() => setColumnsMenuOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700"
                  aria-expanded={columnsMenuOpen}
                >
                  <Columns3 className="h-4 w-4" />
                  Columns
                  <ChevronDown className={`h-4 w-4 transition ${columnsMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {columnsMenuOpen ? (
                  <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Show columns
                      </p>
                      <button
                        type="button"
                        className="text-[11px] font-bold text-[#004AAD]"
                        onClick={() => {
                          const next = { ...DEFAULT_LEADS_COLUMNS };
                          setVisibleColumns(next);
                          saveLeadsColumnVisibility(next);
                        }}
                      >
                        Reset
                      </button>
                    </div>
                    <div className="max-h-72 space-y-0.5 overflow-y-auto">
                      {LEADS_TABLE_COLUMNS.filter(
                        (c) =>
                          (c.key !== 'assignee' && c.key !== 'source' && c.key !== 'mlScore') ||
                          isLeadManager,
                      ).map((col) => (
                        <label
                          key={col.key}
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                            col.locked ? 'opacity-60' : 'hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="rounded border-slate-300"
                            checked={showCol(col.key)}
                            disabled={col.locked}
                            onChange={() => toggleColumn(col.key)}
                          />
                          <span className="font-semibold text-slate-700">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {isLeadManager ? (
              <>
                <button
                  type="button"
                  onClick={() => exportLeadsCsv()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
                <Link
                  href="/dashboard/lead_manager/bookings?upload=1"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700"
                >
                  <Upload className="h-4 w-4" />
                  Upload CRM
                </Link>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('myfng:open-wa-inbox'))}
              title="WhatsApp · 6161"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-sm"
            >
              <WhatsAppIcon className="h-5 w-5" />
            </button>
            <Link
              href={`${base}/book?mode=book`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              + New Booking
            </Link>
            <Link
              href={`${base}/book?mode=lead`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#023D95] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#012f73]"
            >
              <UserPlus className="h-4 w-4" />
              + Add Lead
            </Link>
          </div>
        </div>

        {isLeadManager && overview ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {(
              [
                { key: 'ALL', label: 'Total', value: overview.total },
                { key: 'APP', label: 'App', value: overview.app },
                { key: 'WEBSITE', label: 'Website', value: overview.website },
                { key: 'MISA', label: 'MISA AI', value: overview.misa },
                { key: 'GOOGLE', label: 'Google Ads', value: overview.googleAds },
                { key: 'META', label: 'Meta / Insta', value: overview.metaAds },
              ] as const
            ).map((card) => {
              const active = (card.key === 'ALL' && sourceFilter === 'ALL') || sourceFilter === card.key;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => {
                    const next = card.key === 'ALL' || sourceFilter === card.key ? 'ALL' : card.key;
                    setSourceFilter(next);
                    syncFiltersToUrl({ source: next });
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-left ${
                    active
                      ? 'border-[#004AAD] bg-[#004AAD] text-white'
                      : 'border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  <p className={`text-[10px] font-bold uppercase tracking-wide ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                    {card.label}
                  </p>
                  <p className="mt-0.5 text-xl font-extrabold tabular-nums">{card.value.toLocaleString('en-IN')}</p>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-3.5 shadow-sm space-y-3">
          {/* Search + clear in same bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className={`w-full rounded-xl border border-slate-200 py-2 pl-9 text-sm ${
                  q ? 'pr-9' : 'pr-3'
                }`}
                placeholder="Search name, phone, lead #"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => {
                    setQ('');
                    setAppliedQ('');
                    persistAll({ q: '' });
                    syncFiltersToUrl({ q: '' });
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setFilterAndUrl('all');
                  setCity('');
                  setPriority('');
                  setTelecallerId('');
                  setUnassignedOnly(false);
                  setSourceFilter('ALL');
                  setCouponFilter('ALL');
                  setTriggerFilter('');
                  setLostReason('');
                  setQ('');
                  setAppliedQ('');
                  setAdvIncomplete(false);
                  setAdvFollowUp(false);
                  setAdvHasVehicle(false);
                  setAdvHasCoupon(false);
                  setAdvNoAssignee(false);
                  setAdvHasPhone(false);
                  setAdvOverdueReminder(false);
                  setDateField('created');
                  persistAll({
                    statusFilter: 'all',
                    city: '',
                    priority: '',
                    telecallerId: '',
                    unassignedOnly: false,
                    lostReason: '',
                    q: '',
                    dateField: 'created',
                    advIncomplete: false,
                    advFollowUp: false,
                    advHasVehicle: false,
                    advHasCoupon: false,
                    advNoAssignee: false,
                  });
                  syncFiltersToUrl({
                    filter: 'all',
                    city: '',
                    priority: '',
                    telecallerId: '',
                    unassignedOnly: false,
                    lostReason: '',
                    q: '',
                    dateField: 'created',
                    source: 'ALL',
                    hasCoupon: 'ALL',
                    trigger: '',
                  });
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <X className="h-4 w-4" /> Clear
              </button>
            </div>
          </div>

          {/* Compact filter dropdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            <div className="relative min-w-0">
              <select
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-2.5 pr-9 text-sm font-semibold text-slate-800"
                value={filter}
                onChange={(e) => setFilterAndUrl(e.target.value)}
                aria-label="Lead Status"
              >
                {statusFilters.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.id === 'all' ? 'Lead Status' : f.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>

            <button
              type="button"
              onClick={() => setDatePickerOpen(true)}
              className="w-full inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left text-sm font-semibold text-slate-800 hover:border-blue-300"
              title="Select date"
            >
              <CalendarDays className="h-4 w-4 text-[#004AAD] shrink-0" />
              <span className="min-w-0 flex-1 truncate">{dateRangeLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
            </button>

            <div className="relative min-w-0">
              <select
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-2.5 pr-9 text-sm font-semibold text-slate-800"
                value={city}
                onChange={(e) => {
                  const v = e.target.value;
                  setCity(v);
                  persistAll({ city: v });
                  syncFiltersToUrl({ city: v });
                }}
                aria-label="City"
              >
                <option value="">All cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>

            <div className="relative min-w-0">
              <select
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-2.5 pr-9 text-sm font-semibold text-slate-800"
                value={priority}
                onChange={(e) => {
                  const v = e.target.value;
                  setPriority(v);
                  persistAll({ priority: v });
                  syncFiltersToUrl({ priority: v });
                }}
                aria-label="Priority"
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>

            {isLeadManager ? (
              <div className="relative min-w-0">
                <select
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-2.5 pr-9 text-sm font-semibold text-slate-800"
                  value={unassignedOnly ? '__unassigned__' : telecallerId}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__unassigned__') {
                      setUnassignedOnly(true);
                      setTelecallerId('');
                      persistAll({ unassignedOnly: true, telecallerId: '' });
                      syncFiltersToUrl({ unassignedOnly: true, telecallerId: '' });
                    } else {
                      setUnassignedOnly(false);
                      setTelecallerId(v);
                      persistAll({ unassignedOnly: false, telecallerId: v });
                      syncFiltersToUrl({ unassignedOnly: false, telecallerId: v });
                    }
                  }}
                  aria-label="Telecaller"
                >
                  <option value="">All telecallers</option>
                  <option value="__unassigned__">Unassigned only</option>
                  {telecallers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name || t.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            ) : null}

            {filter === 'lost' ? (
              <div className="relative min-w-0">
                <select
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-2.5 pr-9 text-sm font-semibold text-slate-800"
                  value={lostReason}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLostReason(v);
                    persistAll({ lostReason: v });
                    syncFiltersToUrl({ lostReason: v });
                  }}
                  aria-label="Lost reason"
                >
                  {LOST_REASON_FILTERS.map((f) => (
                    <option key={f.id || 'all-lost'} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            ) : null}

            {isLeadManager ? (
              <>
                <div className="relative min-w-0">
                  <select
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-2.5 pr-9 text-sm font-semibold text-slate-800"
                    value={sourceFilter}
                    onChange={(e) => {
                      const v = e.target.value || 'ALL';
                      setSourceFilter(v);
                      syncFiltersToUrl({ source: v });
                    }}
                    aria-label="Source"
                  >
                    {BOOKING_SOURCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
                <div className="relative min-w-0">
                  <select
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-2.5 pr-9 text-sm font-semibold text-slate-800"
                    value={couponFilter}
                    onChange={(e) => {
                      const v = e.target.value || 'ALL';
                      setCouponFilter(v);
                      syncFiltersToUrl({ hasCoupon: v });
                    }}
                    aria-label="Discount"
                  >
                    {BOOKING_COUPON_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
                <div className="relative min-w-0">
                  <select
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-2.5 pr-9 text-sm font-semibold text-slate-800"
                    value={triggerFilter}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTriggerFilter(v);
                      syncFiltersToUrl({ trigger: v });
                    }}
                    aria-label="Trigger"
                  >
                    <option value="">All triggers</option>
                    <option value="NONE">No trigger</option>
                    {messageTriggers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </>
            ) : null}

            <div className="relative" ref={advancedMenuRef}>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full inline-flex items-center justify-between gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-semibold text-slate-800"
                aria-expanded={showAdvanced}
              >
                <span className="inline-flex items-center gap-1.5 truncate">
                  <SlidersHorizontal className="h-4 w-4 text-[#023D95] shrink-0" />
                  More filters
                  {advancedOnCount > 0 ? (
                    <span className="rounded-full bg-[#023D95] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {advancedOnCount}
                    </span>
                  ) : null}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-500 transition ${showAdvanced ? 'rotate-180' : ''}`}
                />
              </button>
              {showAdvanced ? (
                <div className="absolute left-0 right-0 z-40 mt-1.5 min-w-[240px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg sm:right-auto sm:w-72">
                  <label className="block px-2 pt-1 pb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Date type
                  </label>
                  <select
                    className="mb-2 w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-2.5 pr-8 text-sm font-semibold text-slate-800"
                    value={dateField}
                    onChange={(e) => {
                      const v = e.target.value === 'modified' ? 'modified' : 'created';
                      setDateField(v);
                      persistAll({ dateField: v });
                      syncFiltersToUrl({ dateField: v });
                    }}
                    aria-label="Date type"
                  >
                    <option value="created">Created on</option>
                    <option value="modified">Modified</option>
                  </select>
                  {[
                    {
                      id: 'incomplete',
                      label: 'Fresh only',
                      checked: advIncomplete,
                      set: setAdvIncomplete,
                      key: 'advIncomplete' as const,
                    },
                    {
                      id: 'followup',
                      label: 'Follow-up / reminder',
                      checked: advFollowUp,
                      set: setAdvFollowUp,
                      key: 'advFollowUp' as const,
                    },
                    {
                      id: 'overdue',
                      label: 'Overdue reminder',
                      checked: advOverdueReminder,
                      set: setAdvOverdueReminder,
                      key: null,
                    },
                    {
                      id: 'phone',
                      label: 'Has phone',
                      checked: advHasPhone,
                      set: setAdvHasPhone,
                      key: null,
                    },
                    {
                      id: 'vehicle',
                      label: 'Has reg. number',
                      checked: advHasVehicle,
                      set: setAdvHasVehicle,
                      key: 'advHasVehicle' as const,
                    },
                    {
                      id: 'coupon',
                      label: 'Has coupon',
                      checked: advHasCoupon,
                      set: setAdvHasCoupon,
                      key: 'advHasCoupon' as const,
                    },
                    ...(isLeadManager
                      ? [
                          {
                            id: 'noassignee',
                            label: 'Unassigned only',
                            checked: advNoAssignee,
                            set: setAdvNoAssignee,
                            key: 'advNoAssignee' as const,
                          },
                        ]
                      : []),
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={opt.checked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          opt.set(checked);
                          if (opt.key) persistAll({ [opt.key]: checked });
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <CrmDatePickerModal
          open={datePickerOpen}
          onClose={() => setDatePickerOpen(false)}
          value={{ datePreset, customStart, customEnd }}
          onApply={(next) => {
            persistDate({
              datePreset: next.datePreset,
              customStart: next.customStart,
              customEnd: next.customEnd,
            });
          }}
        />

        {isLeadManager && selectedIds.size > 0 ? (
          <ManagerBulkActionsBar
            selectedIds={Array.from(selectedIds)}
            telecallers={telecallers}
            allowBulkWhatsApp
            onClear={() => setSelectedIds(new Set())}
            onDone={() => void load()}
          />
        ) : null}

        {refreshing ? (
          <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…
          </p>
        ) : null}

        {viewMode === 'chart' ? (
          loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading chart…
            </div>
          ) : (
            <BookingsLeadsChartPanel
              leads={displayedLeads}
              showManagerDimensions={isLeadManager}
              onViewLeads={() => setViewMode('list')}
              totalOverride={displayedLeads.length}
            />
          )
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading leads…
          </div>
        ) : displayedLeads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
            No leads in this filter / date range
          </div>
        ) : (
          <>
            {/* Desktop table — visible cols share width (no blank gaps when unchecked) */}
            <div className="hidden lg:block w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full table-fixed text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      {isLeadManager ? (
                        <th className="px-2 py-2 w-10">
                          <input
                            type="checkbox"
                            checked={allPageSelected}
                            onChange={toggleSelectPage}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Select all on page"
                          />
                        </th>
                      ) : null}
                      {showCol('leadNumber') ? (
                        <th className="px-2 py-2 truncate" style={colWidthStyle('leadNumber')}>
                          Lead #
                        </th>
                      ) : null}
                      {showCol('status') ? (
                        <th className="px-1.5 py-2 truncate" style={colWidthStyle('status')}>
                          Status
                        </th>
                      ) : null}
                      {showCol('mlScore') && isLeadManager ? (
                        <th className="px-1.5 py-2 truncate" style={colWidthStyle('mlScore')}>
                          ML
                        </th>
                      ) : null}
                      {showCol('customer') ? (
                        <th className="px-1.5 py-2 whitespace-normal" style={colWidthStyle('customer')}>
                          Customer
                        </th>
                      ) : null}
                      {showCol('phone') ? (
                        <th className="px-1.5 py-2 truncate" style={colWidthStyle('phone')}>
                          Phone
                        </th>
                      ) : null}
                      {showCol('message') ? (
                        <th className="px-2 py-2 truncate" style={colWidthStyle('message')}>
                          Message
                        </th>
                      ) : null}
                      {showCol('regNo') ? (
                        <th className="px-2 py-2 truncate" style={colWidthStyle('regNo')}>
                          Reg. No
                        </th>
                      ) : null}
                      {showCol('makeModel') ? (
                        <th className="px-2 py-2 truncate" style={colWidthStyle('makeModel')}>
                          Make / Model
                        </th>
                      ) : null}
                      {showCol('city') ? (
                        <th className="px-2 py-2 truncate" style={colWidthStyle('city')}>
                          City
                        </th>
                      ) : null}
                      {showCol('priority') ? (
                        <th className="px-2 py-2 truncate" style={colWidthStyle('priority')}>
                          Priority
                        </th>
                      ) : null}
                      {showCol('source') && isLeadManager ? (
                        <th className="px-2 py-2 truncate" style={colWidthStyle('source')}>
                          Source
                        </th>
                      ) : null}
                      {showCol('assignee') && isLeadManager ? (
                        <th className="px-2 py-2 truncate" style={colWidthStyle('assignee')}>
                          Assignee
                        </th>
                      ) : null}
                      {showCol('date') ? (
                        <th className="px-2 py-2 truncate" style={colWidthStyle('date')}>
                          Created on
                        </th>
                      ) : null}
                      {showCol('modified') ? (
                        <th className="px-2 py-2 truncate" style={colWidthStyle('modified')}>
                          Modified
                        </th>
                      ) : null}
                      {showCol('actions') ? (
                        <th className="sticky right-0 z-20 w-[112px] bg-slate-50 px-2 py-2 text-right shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.18)]">
                          Actions
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedLeads.map((lead) => {
                      const tint = leadStatusCardColors(lead);
                      const statusLabel = leadDisplayStatus(lead);
                      const msg =
                        lead.message_preview ||
                        lead.coupon_meta?.last_inbound_message ||
                        lead.problem_description ||
                        '—';
                      const regNo = String(lead.vehicle_number || '')
                        .trim()
                        .toUpperCase();
                      const regDisplay = regNo && regNo !== 'NA' ? regNo : '—';
                      const makeModel =
                        [lead.vehicle_make, lead.vehicle_model]
                          .map((v) => String(v || '').trim())
                          .filter((v) => v && v.toUpperCase() !== 'NA')
                          .join(' ') || '—';
                      return (
                        <tr
                          key={lead.id}
                          className={`group cursor-pointer transition ${
                            isLeadManager && selectedIds.has(String(lead.id))
                              ? 'ring-2 ring-inset ring-blue-400'
                              : ''
                          }`}
                          style={{
                            backgroundColor:
                              isLeadManager && selectedIds.has(String(lead.id))
                                ? '#DBEAFE'
                                : tint.cardBg,
                          }}
                          onClick={() => openLead(String(lead.id))}
                        >
                          {isLeadManager ? (
                            <td
                              className="px-2 py-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelect(String(lead.id));
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedIds.has(String(lead.id))}
                                onChange={() => toggleSelect(String(lead.id))}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Select ${lead.lead_number || lead.id}`}
                              />
                            </td>
                          ) : null}
                          {showCol('leadNumber') ? (
                            <td className="px-2 py-2 font-extrabold text-[#023D95] truncate text-[13px]">
                              {lead.lead_number || lead.id?.slice(0, 8)}
                            </td>
                          ) : null}
                          {showCol('status') ? (
                            <td className="px-1.5 py-2" style={colWidthStyle('status')}>
                              <span
                                className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold"
                                style={{ backgroundColor: tint.badgeBg, color: tint.badgeText }}
                              >
                                {statusLabel}
                              </span>
                            </td>
                          ) : null}
                          {showCol('mlScore') && isLeadManager ? (
                            <td className="px-1.5 py-2" style={colWidthStyle('mlScore')}>
                              <MlScoreBadge
                                compact
                                score={lead.ml_score?.conversion_score}
                                temperature={lead.ml_score?.temperature}
                              />
                            </td>
                          ) : null}
                          {showCol('customer') ? (
                            <td
                              className="px-1.5 py-2 font-semibold text-slate-900 text-[13px]"
                              style={colWidthStyle('customer')}
                              title={lead.customer_name || 'Unknown'}
                            >
                              {(() => {
                                const [line1, line2] = splitCustomerNameLines(
                                  lead.customer_name || 'Unknown',
                                );
                                return (
                                  <span className="inline-flex flex-col leading-snug">
                                    <span className="break-words">{line1}</span>
                                    {line2 ? (
                                      <span className="break-words">{line2}</span>
                                    ) : null}
                                  </span>
                                );
                              })()}
                            </td>
                          ) : null}
                          {showCol('phone') ? (
                            <td
                              className="px-1.5 py-2 text-slate-700 text-[13px] whitespace-nowrap"
                              style={colWidthStyle('phone')}
                            >
                              {lead.customer_phone || '—'}
                            </td>
                          ) : null}
                          {showCol('message') ? (
                            <td
                              className="px-2 py-2 text-slate-600 max-w-[180px] truncate text-[12px]"
                              title={String(msg)}
                            >
                              {String(msg)}
                            </td>
                          ) : null}
                          {showCol('regNo') ? (
                            <td
                              className="px-2 py-2 text-slate-800 font-semibold whitespace-nowrap uppercase text-[12px]"
                              title={regDisplay}
                            >
                              {regDisplay}
                            </td>
                          ) : null}
                          {showCol('makeModel') ? (
                            <td className="px-2 py-2 text-slate-700 text-[12px]" title={makeModel}>
                              {(() => {
                                const make = String(lead.vehicle_make || '')
                                  .trim()
                                  .toUpperCase();
                                const model = String(lead.vehicle_model || '')
                                  .trim()
                                  .toUpperCase();
                                const makeOk = make && make !== 'NA';
                                const modelOk = model && model !== 'NA';
                                if (!makeOk && !modelOk) return '—';
                                return (
                                  <span className="inline-flex flex-col leading-snug">
                                    {makeOk ? <span>{make}</span> : null}
                                    {modelOk ? <span className="text-slate-500">{model}</span> : null}
                                  </span>
                                );
                              })()}
                            </td>
                          ) : null}
                          {showCol('city') ? (
                            <td className="px-2 py-2 text-slate-700 truncate text-[12px]">
                              {lead.city || lead.workshop?.city || '—'}
                            </td>
                          ) : null}
                          {showCol('priority') ? (
                            <td className="px-2 py-2 text-slate-700 truncate text-[12px] font-semibold">
                              {lead.lead_priority || lead.priority || 'NORMAL'}
                            </td>
                          ) : null}
                          {showCol('source') && isLeadManager ? (
                            <td className="px-2 py-2 text-slate-600 truncate text-[12px]">
                              {lead.booking_source_label || lead.lead_source || '—'}
                            </td>
                          ) : null}
                          {showCol('assignee') && isLeadManager ? (
                            <td className="px-2 py-2 text-indigo-700 font-semibold text-xs whitespace-nowrap">
                              {lead.assigned_telecaller?.full_name || 'Unassigned'}
                            </td>
                          ) : null}
                          {showCol('date') ? (
                            <td
                              className="px-2 py-2 text-[11px] text-slate-600"
                              title={lead.created_at || undefined}
                            >
                              <StackedDateTime iso={lead.created_at} />
                            </td>
                          ) : null}
                          {showCol('modified') ? (
                            <td
                              className="px-2 py-2 text-[11px] text-slate-600"
                              title={lead.updated_at || undefined}
                            >
                              <StackedDateTime iso={lead.updated_at || lead.created_at} />
                            </td>
                          ) : null}
                          {showCol('actions') ? (
                            <td
                              className="sticky right-0 z-10 px-2 py-2 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]"
                              style={{
                                backgroundColor:
                                  isLeadManager && selectedIds.has(String(lead.id))
                                    ? '#DBEAFE'
                                    : tint.cardBg,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-end gap-1">
                                {lead.customer_phone ? (
                                  <a
                                    href={`tel:${lead.customer_phone}`}
                                    title="Call"
                                    aria-label="Call"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                                  >
                                    <Phone className="h-4 w-4 fill-current" strokeWidth={0} />
                                  </a>
                                ) : null}
                                {lead.customer_phone ? (
                                  <button
                                    type="button"
                                    onClick={() => openLeadWhatsApp(lead)}
                                    title="WhatsApp"
                                    aria-label="WhatsApp"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366] text-white shadow-sm hover:bg-[#1ebe5c]"
                                  >
                                    <WhatsAppIcon className="h-4 w-4" />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => openShare(lead)}
                                  title="Transfer"
                                  aria-label="Transfer"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-600 text-white shadow-sm hover:bg-slate-700"
                                >
                                  <Share2 className="h-3.5 w-3.5 fill-current" strokeWidth={2.5} />
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            </div>

            {/* Mobile / tablet cards */}
            <div className="grid grid-cols-1 gap-2 lg:hidden">
              {displayedLeads.map((lead) => {
                const tint = leadStatusCardColors(lead);
                const statusLabel = leadDisplayStatus(lead);
                return (
                  <div
                    key={lead.id}
                    className="rounded-2xl border p-3 shadow-sm"
                    style={{
                      backgroundColor: tint.cardBg,
                      borderColor: tint.border,
                    }}
                  >
                    {isLeadManager ? (
                      <div className="mb-2">
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(String(lead.id))}
                            onChange={() => toggleSelect(String(lead.id))}
                          />
                          Select
                        </label>
                      </div>
                    ) : null}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 leading-snug truncate">
                          {lead.customer_name || 'Unknown'}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {lead.customer_phone || '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isLeadManager ? (
                          <MlScoreBadge
                            compact
                            score={lead.ml_score?.conversion_score}
                            temperature={lead.ml_score?.temperature}
                          />
                        ) : null}
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                          style={{ backgroundColor: tint.badgeBg, color: tint.badgeText }}
                        >
                          {statusLabel}
                        </span>
                        {isLeadManager ? (
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-700 text-[10px] font-extrabold text-white"
                            title={
                              lead.assigned_telecaller?.full_name ||
                              lead.assigned_telecaller_name ||
                              'Unassigned'
                            }
                          >
                            {(() => {
                              const n = String(
                                lead.assigned_telecaller?.full_name ||
                                  lead.assigned_telecaller_name ||
                                  '',
                              ).trim();
                              if (!n) return '?';
                              const parts = n.split(/\s+/).filter(Boolean);
                              if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
                              return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
                            })()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      {lead.customer_phone ? (
                        <a
                          href={`tel:${lead.customer_phone}`}
                          title="Call"
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#004AAD] px-2 py-2 text-xs font-bold text-white"
                        >
                          <Phone className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
                          Call
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openLead(String(lead.id))}
                        className="inline-flex flex-1 items-center justify-center rounded-xl bg-blue-50 px-2 py-2 text-xs font-bold text-[#004AAD]"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => openShare(lead)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-blue-50 px-2 py-2 text-xs font-bold text-[#004AAD]"
                      >
                        <Share2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Transfer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {viewMode === 'list' ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200 bg-white px-3 py-3">
                <p className="text-xs font-semibold text-slate-500">
                  {totalLeads === 0
                    ? 'No leads'
                    : `Showing ${pageStart}–${pageEnd} of ${totalLeads.toLocaleString('en-IN')}`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
                    Per page
                    <select
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold"
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value) as 25 | 50 | 75 | 100)}
                    >
                      {[25, 50, 75, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={safePage <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="text-xs font-bold text-slate-600 tabular-nums">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {shareLead ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-[#023D95]">Transfer Lead</h3>
              <button type="button" onClick={() => setShareLead(null)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-600">
              {shareLead.customer_name} · {shareLead.lead_number}
            </p>
            {peers.length === 0 ? (
              <p className="text-sm text-slate-500">No peer telecallers found</p>
            ) : (
              <div className="space-y-2">
                {peers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 p-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-800">{p.name || p.email || 'Telecaller'}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={sharing}
                        onClick={() => doTransfer(p.id)}
                        className="rounded-lg bg-orange-50 px-2.5 py-1.5 text-[11px] font-bold text-orange-700"
                      >
                        Transfer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

export default function TelecallerCrmLeadsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout role="telecaller">
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        </DashboardLayout>
      }
    >
      <TelecallerCrmLeadsContent />
    </Suspense>
  );
}
