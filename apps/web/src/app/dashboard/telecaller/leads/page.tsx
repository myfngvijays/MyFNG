'use client';

import { useCallback, useEffect, useState, Suspense, useRef, useMemo, useLayoutEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
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
  ADMIN_CRM_STATUS_OPTIONS,
  leadDisplayStatus,
  leadStatusCardColors,
  mergeAdminStatusChoices,
  mergeCrmStatusFilters,
  resolveAdminCrmStatusId,
} from '@/lib/telecaller/leadDisplayStatus';
import { crmLeadClosedForFollowUp } from '@/lib/telecaller/crmFollowUpClose';
import { leadMatchesCrmQueueFilter } from '@/lib/telecaller/crmLeadFilters';
import { createClient } from '@/lib/supabase/client';
import {
  Phone,
  Search,
  ArrowRightLeft,
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
  RefreshCw,
  Crown,
} from 'lucide-react';
import BookingsLeadsChartPanel from '@/components/admin/BookingsLeadsChartPanel';
import ManagerBulkActionsBar from '@/components/telecaller/crm/ManagerBulkActionsBar';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import CrmDatePickerModal from '@/components/telecaller/crm/CrmDatePickerModal';
import LeadsSavedViews, { type CrmLeadsViewSnapshot } from '@/components/telecaller/crm/LeadsSavedViews';
import { LeadDetailContent } from './[id]/page';

/** Compact filters — same size on 14", 15.6", and wide monitors. Two-up only on phones. */
const FILTER_FIELD = 'relative shrink-0 w-auto min-w-[6.5rem]';

function FilterSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const place = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, 190);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, Math.min(320, openUp ? spaceAbove : spaceBelow));
    const top = openUp ? Math.max(8, r.top - 6 - maxHeight) : r.bottom + 6;
    setBox({ top, left, width, maxHeight });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = options.find((option) => option.value === value);

  return (
    <div className={FILTER_FIELD}>
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
        className="inline-flex h-8 w-max min-w-[6.5rem] max-w-[12rem] items-center justify-between gap-1 rounded-lg border border-slate-200 bg-white px-2 text-left text-xs font-semibold text-slate-800"
      >
        <span className="truncate">{current?.label || 'Select'}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && box
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[80] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              style={{ top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}
            >
              {options.map((option) => (
                <button
                  key={option.value || 'empty'}
                  type="button"
                  className={`block w-full truncate px-3 py-1.5 text-left text-xs font-semibold hover:bg-slate-50 ${
                    option.value === value ? 'bg-[#E7F0FF] text-[#023D95]' : 'text-slate-800'
                  }`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

const LEADS_COLUMNS_STORAGE_KEY = 'telecaller_crm_leads_columns_v6';

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
  { key: 'mlScore', label: 'ML', onByDefault: false, locked: false },
  { key: 'customer', label: 'Customer', onByDefault: true, locked: false },
  { key: 'phone', label: 'Phone', onByDefault: true, locked: false },
  { key: 'message', label: 'Message', onByDefault: false, locked: false },
  { key: 'regNo', label: 'Reg. No', onByDefault: false, locked: false },
  { key: 'makeModel', label: 'Make / Model', onByDefault: false, locked: false },
  { key: 'city', label: 'City', onByDefault: false, locked: false },
  { key: 'priority', label: 'Priority', onByDefault: false, locked: false },
  { key: 'source', label: 'Source', onByDefault: false, locked: false },
  { key: 'assignee', label: 'Assignee', onByDefault: true, locked: false },
  { key: 'date', label: 'Created on', onByDefault: true, locked: false },
  { key: 'serviceDoneDate', label: 'Service done date', onByDefault: false, locked: false },
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

function leadServiceDoneDate(lead: any): string {
  const coupon = lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
  const meta = lead?.meta && typeof lead.meta === 'object' ? lead.meta : {};
  const imported = meta.import_fields && typeof meta.import_fields === 'object' ? meta.import_fields : {};
  const raw = String(
    coupon.service_done_at || meta.service_date || imported['Service Date'] || imported['Service Done Date'] || '',
  ).trim();
  if (!raw) return '';
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return raw;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatLeadDateTime(iso: string | null | undefined) {
  const parts = formatLeadDateParts(iso);
  if (!parts) return '—';
  return `${parts.date}, ${parts.time}`;
}

/** One line, each word capitalised (not ALL CAPS, not all lowercase). */
function formatLeadName(name: string | null | undefined): string {
  const full = String(name || '').trim();
  if (!full) return 'Unknown';
  return full
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/^\d+$/.test(word)) return word;
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function formatRelativeLeadTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return '—';
  const diff = Date.now() - ms;
  const min = Math.max(0, Math.round(diff / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function formatHoverLeadTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' });
  return `${time} ${day}`;
}

function StackedDateTime({ iso }: { iso: string | null | undefined }) {
  const label = formatRelativeLeadTime(iso);
  const hover = formatHoverLeadTime(iso);
  const [tip, setTip] = useState<{ x: number; y: number; below: boolean } | null>(null);
  if (!hover) return <span>—</span>;
  return (
    <span
      className="inline-flex cursor-default"
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const half = 120;
        const x = Math.min(window.innerWidth - half, Math.max(half, rect.left + rect.width / 2));
        setTip({
          x,
          y: rect.top < 56 ? rect.bottom + 6 : rect.top - 6,
          below: rect.top < 56,
        });
      }}
      onMouseLeave={() => setTip(null)}
    >
      <span>{label}</span>
      {tip
        ? createPortal(
            <span
              className="pointer-events-none fixed z-[80] whitespace-nowrap rounded-md bg-violet-100 px-2 py-1 text-[11px] font-medium text-violet-900 shadow"
              style={{
                left: tip.x,
                top: tip.y,
                transform: tip.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
              }}
            >
              {hover}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

function MembershipCrown() {
  return (
    <Crown
      className="h-3.5 w-3.5 shrink-0 text-purple-600"
      aria-label="Membership customer"
    />
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
  const loadGen = useRef(0);
  const [q, setQ] = useState(qParam || '');
  const [appliedQ, setAppliedQ] = useState(qParam || '');
  const [filter, setFilter] = useState(filterParam || 'all');
  const [crmStatusChoices, setCrmStatusChoices] = useState(
    ADMIN_CRM_STATUS_OPTIONS.map((opt) => ({ id: opt.id, label: opt.label })),
  );
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [statusFilters, setStatusFilters] = useState<Array<{ id: string; label: string }>>(
    () => LEAD_STATUS_FILTERS.map((f) => ({ id: f.id, label: f.label })),
  );
  const [lostReason, setLostReason] = useState(lostParam || '');
  const otherParam = searchParams?.get('other_reason');
  const [otherReason, setOtherReason] = useState(otherParam || '');
  const [otherReasonOptions, setOtherReasonOptions] = useState<string[]>([]);
  const [lostReasonChoices, setLostReasonChoices] = useState<string[]>(
    LOST_REASON_FILTERS.map((item) => item.id).filter(Boolean),
  );
  const [reasonMenu, setReasonMenu] = useState<{
    lead: any;
    top: number;
    left: number;
    maxHeight: number;
  } | null>(null);
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
  const [datePreset, setDatePreset] = useState<CrmDatePreset>(dateParam || 'all_time');
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
  const [, setScopeTotal] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState<LeadsColumnVisibility>(DEFAULT_LEADS_COLUMNS);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [columnsQuery, setColumnsQuery] = useState('');
  const columnsMenuRef = useRef<HTMLDivElement>(null);
  const columnsBtnRef = useRef<HTMLButtonElement>(null);
  const leadsTableRef = useRef<HTMLDivElement>(null);
  const [lockedWidths, setLockedWidths] = useState<Partial<Record<'check' | LeadsColumnKey, number>> | null>(null);
  const [columnsMenuBox, setColumnsMenuBox] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [columnsPortalReady, setColumnsPortalReady] = useState(false);
  const advancedMenuRef = useRef<HTMLDivElement>(null);
  const advancedPanelRef = useRef<HTMLDivElement>(null);
  const dateBtnRef = useRef<HTMLButtonElement>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [advancedBox, setAdvancedBox] = useState<{ top: number; left: number } | null>(null);
  const [selectedOnly, setSelectedOnly] = useState(false);

  useEffect(() => {
    setVisibleColumns(loadLeadsColumnVisibility());
  }, []);

  useEffect(() => {
    if (!columnsMenuOpen && !showAdvanced) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      const menu = document.getElementById('leads-columns-menu');
      if (columnsMenuOpen && !columnsMenuRef.current?.contains(t) && !menu?.contains(t)) {
        setColumnsMenuOpen(false);
      }
      if (
        showAdvanced &&
        !advancedMenuRef.current?.contains(t) &&
        !advancedPanelRef.current?.contains(t)
      ) {
        setShowAdvanced(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [columnsMenuOpen, showAdvanced]);

  useLayoutEffect(() => {
    if (!showAdvanced) return;
    const place = () => {
      const el = advancedMenuRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = 288;
      const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
      setAdvancedBox({ top: r.bottom + 6, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [showAdvanced]);

  useEffect(() => {
    setColumnsPortalReady(true);
  }, []);

  useEffect(() => {
    if (!columnsMenuOpen) setColumnsQuery('');
  }, [columnsMenuOpen]);

  const showCol = (key: LeadsColumnKey) => {
    if (key === 'source' && !isLeadManager) return false;
    if (key === 'mlScore' && !isLeadManager) return false;
    return Boolean(visibleColumns[key]);
  };

  const visibleTableCols = useMemo(() => {
    return LEADS_TABLE_COLUMNS.filter((c) => showCol(c.key));
  }, [visibleColumns, isLeadManager]);

  const COL_MIN_PX: Record<LeadsColumnKey, number> = {
    leadNumber: 124,
    status: 152,
    mlScore: 68,
    customer: 176,
    phone: 124,
    message: 240,
    regNo: 118,
    makeModel: 136,
    city: 108,
    priority: 92,
    source: 116,
    assignee: 128,
    date: 112,
    serviceDoneDate: 132,
    modified: 112,
    actions: 268,
  };

  const EXTRA_COL_KEYS: LeadsColumnKey[] = [
    'leadNumber',
    'mlScore',
    'message',
    'regNo',
    'makeModel',
    'city',
    'priority',
    'source',
    'serviceDoneDate',
  ];
  const hasExtraCols = EXTRA_COL_KEYS.some((key) => showCol(key));
  const BASE_COL_KEYS: LeadsColumnKey[] = ['status', 'customer', 'phone', 'assignee', 'date', 'modified'];

  useEffect(() => {
    if (hasExtraCols) return;
    const root = leadsTableRef.current;
    if (!root) return;
    const measure = () => {
      const next: Partial<Record<'check' | LeadsColumnKey, number>> = {};
      root.querySelectorAll<HTMLElement>('thead th[data-col]').forEach((cell) => {
        const key = cell.dataset.col as 'check' | LeadsColumnKey;
        const w = Math.round(cell.getBoundingClientRect().width);
        if (w > 24) next[key] = w;
      });
      if (next.customer && next.actions) {
        setLockedWidths((prev) => {
          if (
            prev &&
            prev.check === next.check &&
            prev.status === next.status &&
            prev.customer === next.customer &&
            prev.phone === next.phone &&
            prev.assignee === next.assignee &&
            prev.date === next.date &&
            prev.modified === next.modified &&
            prev.actions === next.actions
          ) {
            return prev;
          }
          return next;
        });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [hasExtraCols, visibleColumns, loading]);

  const baseLock = lockedWidths;
  const pxFor = (key: 'check' | LeadsColumnKey) => {
    if (key !== 'check' && EXTRA_COL_KEYS.includes(key)) return COL_MIN_PX[key];
    if (key === 'check') return baseLock?.check ?? 40;
    if (key === 'actions') return baseLock?.actions ?? 268;
    return baseLock?.[key] ?? COL_MIN_PX[key];
  };
  const tableWidthPx =
    pxFor('check') +
    BASE_COL_KEYS.reduce((sum, key) => (showCol(key) ? sum + pxFor(key) : sum), 0) +
    EXTRA_COL_KEYS.reduce((sum, key) => (showCol(key) ? sum + pxFor(key) : sum), 0) +
    (showCol('actions') ? pxFor('actions') : 0);

  const colWidthStyle = (key: LeadsColumnKey): CSSProperties => {
    if (hasExtraCols) {
      const px = pxFor(key);
      return { width: px, minWidth: px, maxWidth: px };
    }
    const weight: Record<LeadsColumnKey, number> = {
      leadNumber: 1.15,
      status: 1.45,
      mlScore: 0.7,
      customer: 2.05,
      phone: 1.3,
      message: 2.1,
      regNo: 1.2,
      makeModel: 1.45,
      city: 1.1,
      priority: 0.95,
      source: 1.1,
      assignee: 1.4,
      date: 1.15,
      serviceDoneDate: 1.2,
      modified: 1.15,
      actions: 1.05,
    };
    const total =
      visibleTableCols.reduce((sum, col) => (col.key === 'actions' ? sum : sum + weight[col.key]), 0) || 1;
    const pct = (weight[key] / total) * 94;
    if (key === 'actions') return { width: 268, minWidth: 268, maxWidth: 268 };
    return { width: `${pct.toFixed(2)}%` };
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
        setCrmStatusChoices(mergeAdminStatusChoices(rows));
        const currentFilter = String(filterParam || '');
        if (/^[0-9a-f]{8}-/i.test(currentFilter)) {
          const match = rows.find((row: { id?: string; code?: string }) => String(row.id || '') === currentFilter);
          const code = String(match?.code || '').trim().toLowerCase();
          if (code) setFilter(code);
        }
        const reasons = (Array.isArray(json?.other_reasons) ? json.other_reasons : [])
          .map((row: { name?: string } | string) => String(typeof row === 'string' ? row : row?.name || '').trim())
          .filter(Boolean);
        setOtherReasonOptions(reasons);
        const lostNames = (Array.isArray(json?.lost_reasons) ? json.lost_reasons : [])
          .map((row: { name?: string } | string) => String(typeof row === 'string' ? row : row?.name || '').trim())
          .filter(Boolean);
        if (lostNames.length) setLostReasonChoices(lostNames);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!reasonMenu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setReasonMenu(null);
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-lost-reason-menu]')) return;
      setReasonMenu(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [reasonMenu]);

  const openLostReasonMenu = (lead: any, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    const width = 260;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, Math.min(280, openUp ? spaceAbove : spaceBelow));
    const top = openUp ? Math.max(8, rect.top - 6 - maxHeight) : rect.bottom + 6;
    setReasonMenu({ lead, top, left, maxHeight });
  };

  const changeLeadStatus = async (
    lead: any,
    statusId: string,
    anchor?: HTMLElement,
    chosenReason?: string,
  ) => {
    const current = resolveAdminCrmStatusId(lead);
    if (current === statusId && statusId !== 'LOST' && statusId !== 'OTHER') return;
    let lostReason: string | null = null;
    if (statusId === 'LOST' && chosenReason === undefined) {
      if (anchor) openLostReasonMenu(lead, anchor);
      return;
    }
    if (statusId === 'LOST') {
      const reason = String(chosenReason || '').trim();
      if (!reason) return;
      lostReason = reason;
    }
    if (statusId === 'OTHER') {
      const reason = window.prompt('Other item (optional). Leave blank to mark Other only.', '');
      if (reason === null) return;
      lostReason = reason.trim() || null;
    }
    const choice = crmStatusChoices.find((opt) => opt.id === statusId);
    const label =
      statusId === 'LOST' && lostReason
        ? `Lost · ${lostReason}`
        : statusId === 'OTHER' && lostReason
          ? `Other · ${lostReason}`
          : choice?.label || statusId;
    setStatusSavingId(String(lead.id));
    try {
      const res = await fetch(`/api/telecaller/leads/${lead.id}/heal-disposition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          force: true,
          last_call_result: statusId,
          last_call_label: label,
          last_lost_reason: lostReason,
          last_call_status: statusId === 'RINGING' ? 'NO_ANSWER' : 'ANSWERED',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Status update failed');
      const nextLead = {
        ...lead,
        ...(json.lead && typeof json.lead === 'object' ? json.lead : {}),
        coupon_meta: {
          ...(lead.coupon_meta || {}),
          last_call_result: statusId,
          last_call_label: label,
          last_lost_reason: lostReason,
        },
      };
      setLeads((prev) => {
        if (!leadMatchesCrmQueueFilter(nextLead, filter)) {
          return prev.filter((row) => String(row.id) !== String(lead.id));
        }
        return prev.map((row) => (String(row.id) === String(lead.id) ? { ...row, ...nextLead } : row));
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setStatusSavingId(null);
    }
  };

  // Restore saved filters once on client (survives lead open → back)
  useEffect(() => {
    const saved = loadTelecallerCrmFilterPrefs();
    setFilter(filterParam || 'all');
    setDatePreset(dateParam || 'all_time');
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
    const next = filterParam || 'all';
    if (/^[0-9a-f]{8}-/i.test(next)) return;
    setFilter(next);
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
      otherReason?: string;
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
      if (!d || d === 'all_time') params.delete('date');
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
      const or = next.otherReason ?? otherReason;
      if (f === 'other' && or) params.set('other_reason', or);
      else params.delete('other_reason');
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
      otherReason,
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

  const openLeadId = searchParams?.get('lead') || '';

  const openLead = (leadId: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('lead', leadId);
    const qs = params.toString();
    router.replace(`${base}/leads${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const closeLead = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.delete('lead');
    const qs = params.toString();
    router.replace(`${base}/leads${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [searchParams, router, base]);

  useEffect(() => {
    if (!openLeadId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLead();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [openLeadId, closeLead]);

  const displayedLeads = useMemo(() => {
    const base = leads.filter((lead) => {
      if (advIncomplete && !lead.is_incomplete) return false;
      if (advFollowUp) {
        if (crmLeadClosedForFollowUp(lead)) return false;
        if (!lead.follow_up_required && !lead.next_follow_up_at && !lead.reminder?.at) {
          return false;
        }
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
      return leadMatchesCrmQueueFilter(lead, filter);
    });
    if (!selectedOnly || selectedIds.size === 0) return base;
    return base.filter((lead) => selectedIds.has(String(lead.id)));
  }, [
    leads,
    advIncomplete,
    advFollowUp,
    advHasVehicle,
    advHasCoupon,
    advNoAssignee,
    advHasPhone,
    advOverdueReminder,
    selectedOnly,
    selectedIds,
    filter,
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
    if (!isLeadManager || !prefsReady || loading) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
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
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isLeadManager, prefsReady, loading, datePreset, customStart, customEnd, dateField]);

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
    pageLeadIds.length > 0 && pageLeadIds.every((id) => selectedIds.has(id));

  const toggleSelectPage = () => {
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

  const switchView = (next: 'list' | 'chart') => {
    if (next === viewMode) return;
    loadGen.current += 1;
    setViewMode(next);
    if (next === 'list') {
      setLeads([]);
      setLoading(true);
    }
  };

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!prefsReady) return;
    const gen = ++loadGen.current;
    const silent = Boolean(opts?.silent);
    if (!silent) {
      if (bootedRef.current) setRefreshing(true);
      else setLoading(true);
    }
    try {
      const range = resolveCrmDateRange(datePreset, customStart, customEnd);
      const baseParams = new URLSearchParams();
      if (appliedQ.trim()) baseParams.set('q', appliedQ.trim());
      if (filter && filter !== 'all') baseParams.set('filter', filter);
      if (filter === 'lost' && lostReason.trim()) baseParams.set('lost_reason', lostReason.trim());
      if (filter === 'other' && otherReason.trim()) baseParams.set('other_reason', otherReason.trim());
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
      if (!range.allTime) {
        baseParams.set('from', range.start);
        baseParams.set('to', range.end);
      }

      if (viewMode === 'chart') {
        // Pull every matching lead (paged) so chart totals match filters, not a 100-row sample
        const pageLimit = 1000;
        let pageNum = 1;
        let all: any[] = [];
        let total = 0;
        let scope = 0;
        for (;;) {
          if (loadGen.current !== gen) return;
          const params = new URLSearchParams(baseParams);
          params.set('for_chart', '1');
          params.set('limit', String(pageLimit));
          params.set('page', String(pageNum));
          const res = await fetch(`/api/telecaller/crm/leads?${params.toString()}`);
          const data = await res.json();
          if (loadGen.current !== gen) return;
          if (!res.ok) throw new Error(data?.error || 'Failed');
          const batch = Array.isArray(data?.leads) ? data.leads : [];
          total = Number(data?.total || 0);
          scope = Number(data?.scope_total || 0);
          all = all.concat(batch);
          if (batch.length === 0 || pageNum * pageLimit >= total || pageNum >= 80) break;
          pageNum += 1;
        }
        if (loadGen.current !== gen) return;
        setLeads(all);
        setTotalLeads(total || all.length);
        setScopeTotal(scope || total || all.length);
      } else {
        const params = new URLSearchParams(baseParams);
        params.set('limit', String(pageSize));
        params.set('page', String(page));
        const res = await fetch(`/api/telecaller/crm/leads?${params.toString()}`);
        const data = await res.json();
        if (loadGen.current !== gen) return;
        if (!res.ok) throw new Error(data?.error || 'Failed');
        setLeads(Array.isArray(data?.leads) ? data.leads : []);
        setTotalLeads(Number(data?.total || 0));
        setScopeTotal(Number(data?.scope_total || data?.total || 0));
      }
    } catch (e) {
      console.error(e);
      if (!bootedRef.current) {
        setLeads([]);
        setTotalLeads(0);
        setScopeTotal(0);
      }
    } finally {
      if (loadGen.current === gen) {
        if (!silent) {
          setLoading(false);
          setRefreshing(false);
        }
        bootedRef.current = true;
      }
    }
  }, [
    prefsReady,
    viewMode,
    page,
    pageSize,
    filter,
    lostReason,
    otherReason,
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

  useEffect(() => {
    if (viewMode === 'chart') return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void load({ silent: true });
    }, 15000);
    return () => window.clearInterval(id);
  }, [load, viewMode]);

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
  const leadsPager = (
    <div data-leads-pager className="relative z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200 bg-white px-3 py-3">
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
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openLeadWas = useRef('');
  useEffect(() => {
    if (openLeadWas.current && !openLeadId) void load();
    openLeadWas.current = openLeadId;
  }, [openLeadId, load]);

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
    if (id !== 'other') setOtherReason('');
    persistAll({ statusFilter: id, lostReason: id === 'lost' ? lostReason : '' });
    syncFiltersToUrl({
      filter: id,
      lostReason: id === 'lost' ? lostReason : '',
      otherReason: id === 'other' ? otherReason : '',
    });
  };

  const viewSnapshot: CrmLeadsViewSnapshot = {
    kind: 'crm_leads',
    v: 1,
    filter,
    lostReason,
    city,
    priority,
    q: appliedQ,
    datePreset,
    dateField,
    customStart,
    customEnd,
    telecallerId,
    unassignedOnly,
    source: sourceFilter,
    coupon: couponFilter,
    trigger: triggerFilter,
    advIncomplete,
    advFollowUp,
    advHasVehicle,
    advHasCoupon,
    advNoAssignee,
    advHasPhone,
    advOverdueReminder,
  };

  const applySavedView = (next: CrmLeadsViewSnapshot) => {
    const status = next.filter || 'all';
    const lost = status === 'lost' ? next.lostReason || '' : '';
    const preset = (next.datePreset || 'all_time') as CrmDatePreset;
    const field = next.dateField === 'modified' ? 'modified' : 'created';
    setFilter(status);
    setLostReason(lost);
    setCity(next.city || '');
    setPriority(next.priority || '');
    setQ(next.q || '');
    setAppliedQ(next.q || '');
    setDatePreset(preset);
    setDateField(field);
    setCustomStart(next.customStart || '');
    setCustomEnd(next.customEnd || '');
    setTelecallerId(next.telecallerId || '');
    setUnassignedOnly(Boolean(next.unassignedOnly));
    setSourceFilter(next.source || 'ALL');
    setCouponFilter(next.coupon || 'ALL');
    setTriggerFilter(next.trigger || '');
    setAdvIncomplete(Boolean(next.advIncomplete));
    setAdvFollowUp(Boolean(next.advFollowUp));
    setAdvHasVehicle(Boolean(next.advHasVehicle));
    setAdvHasCoupon(Boolean(next.advHasCoupon));
    setAdvNoAssignee(Boolean(next.advNoAssignee));
    setAdvHasPhone(Boolean(next.advHasPhone));
    setAdvOverdueReminder(Boolean(next.advOverdueReminder));
    persistAll({
      statusFilter: status,
      lostReason: lost,
      city: next.city || '',
      priority: next.priority || '',
      q: next.q || '',
      datePreset: preset,
      dateField: field,
      customStart: next.customStart || '',
      customEnd: next.customEnd || '',
      telecallerId: next.telecallerId || '',
      unassignedOnly: Boolean(next.unassignedOnly),
      advIncomplete: Boolean(next.advIncomplete),
      advFollowUp: Boolean(next.advFollowUp),
      advHasVehicle: Boolean(next.advHasVehicle),
      advHasCoupon: Boolean(next.advHasCoupon),
      advNoAssignee: Boolean(next.advNoAssignee),
    });
    syncFiltersToUrl({
      filter: status,
      lostReason: lost,
      city: next.city || '',
      priority: next.priority || '',
      q: next.q || '',
      datePreset: preset,
      dateField: field,
      telecallerId: next.telecallerId || '',
      unassignedOnly: Boolean(next.unassignedOnly),
      source: next.source || 'ALL',
      hasCoupon: next.coupon || 'ALL',
      trigger: next.trigger || '',
    });
  };

  const applyViewRef = useRef(applySavedView);
  applyViewRef.current = applySavedView;
  const appliedViewRef = useRef('');
  useEffect(() => {
    const viewParam = searchParams?.get('view') || '';
    if (!prefsReady || !viewParam || appliedViewRef.current === viewParam) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/lead-manager/saved-views', { credentials: 'include' });
        const json = await res.json().catch(() => ({}));
        const row = (Array.isArray(json?.views) ? json.views : []).find(
          (item: any) => String(item?.id) === viewParam && item?.filters?.kind === 'crm_leads',
        );
        if (!row || cancelled) return;
        appliedViewRef.current = viewParam;
        applyViewRef.current(row.filters);
      } catch {
        /* sidebar click retries on next navigation */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefsReady, searchParams]);

  return (
    <DashboardLayout role={layoutRole}>
      <div className="mx-auto w-full min-w-0 max-w-none space-y-3 pb-24 sm:space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="shrink-0 text-2xl font-extrabold text-[#023D95] md:text-3xl">Leads</h1>
          <div className="flex w-full min-w-0 items-center gap-2 sm:max-w-[36rem] sm:flex-1">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white" />
              <input
                className="w-full rounded-xl border border-[#023D95] bg-[#023D95] py-2.5 pl-9 pr-3 text-sm font-semibold text-white placeholder:text-white/80 focus:outline-none focus:ring-2 focus:ring-white/40"
                placeholder="Search name, phone, lead #, vehicle"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setQ('');
                setAppliedQ('');
                persistAll({ q: '' });
                syncFiltersToUrl({ q: '' });
              }}
              className="inline-flex h-10 shrink-0 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#023D95] hover:bg-slate-50"
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="ml-auto shrink-0">
            <LeadsSavedViews snapshot={viewSnapshot} onApply={applySavedView} />
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

        <div>
          <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
            <FilterSelect
              ariaLabel="Lead Status"
              value={filter}
              onChange={setFilterAndUrl}
              options={statusFilters.map((f) => ({
                value: f.id,
                label: f.id === 'all' ? 'Lead Status' : f.label,
              }))}
            />

            <button
              ref={dateBtnRef}
              type="button"
              onClick={() => {
                setShowAdvanced(false);
                setDatePickerOpen((v) => !v);
              }}
              className={`${FILTER_FIELD} inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-left text-xs font-semibold text-slate-800 hover:border-blue-300`}
              title="Select date"
            >
              <CalendarDays className="h-4 w-4 text-[#004AAD] shrink-0" />
              <span className="min-w-0 flex-1 truncate">{dateRangeLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
            </button>

            <FilterSelect
              ariaLabel="City"
              value={city}
              onChange={(v) => {
                setCity(v);
                persistAll({ city: v });
                syncFiltersToUrl({ city: v });
              }}
              options={[{ value: '', label: 'All cities' }, ...cities.map((c) => ({ value: c, label: c }))]}
            />

            <FilterSelect
              ariaLabel="Priority"
              value={priority}
              onChange={(v) => {
                setPriority(v);
                persistAll({ priority: v });
                syncFiltersToUrl({ priority: v });
              }}
              options={PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />

            {filter === 'lost' ? (
              <FilterSelect
                ariaLabel="Lost reason"
                value={lostReason}
                onChange={(v) => {
                  setLostReason(v);
                  persistAll({ lostReason: v });
                  syncFiltersToUrl({ lostReason: v });
                }}
                options={LOST_REASON_FILTERS.map((f) => ({ value: f.id, label: f.label }))}
              />
            ) : null}

            {filter === 'other' ? (
              <FilterSelect
                ariaLabel="Other reason"
                value={otherReason}
                onChange={(v) => {
                  setOtherReason(v);
                  syncFiltersToUrl({ otherReason: v });
                }}
                options={[
                  { value: '', label: 'All other reasons' },
                  ...otherReasonOptions.map((name) => ({ value: name, label: name })),
                ]}
              />
            ) : null}

            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => setSelectedOnly((v) => !v)}
              className={`${FILTER_FIELD} inline-flex h-8 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                selectedOnly && selectedIds.size > 0
                  ? 'border-[#004AAD] bg-[#004AAD] text-white'
                  : 'border-[#004AAD]/30 bg-[#E7F0FF] text-[#023D95]'
              }`}
              title="Select leads in the list, then filter to only those"
            >
              Selected{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
            </button>

            <div className={FILTER_FIELD} ref={advancedMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setDatePickerOpen(false);
                  setShowAdvanced((v) => !v);
                }}
                className="inline-flex h-8 w-full items-center justify-between gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800"
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
              {showAdvanced && advancedBox
                ? createPortal(
                <div
                  ref={advancedPanelRef}
                  className="fixed z-[80] max-h-[70vh] w-72 max-w-[80vw] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
                  style={{ top: advancedBox.top, left: advancedBox.left }}
                >
                  {isLeadManager ? (
                    <div className="mb-2 space-y-2 border-b border-slate-100 pb-2">
                      <label className="block px-2 pt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Team
                      </label>
                      <select
                        className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-2.5 pr-8 text-sm font-semibold text-slate-800"
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
                      <select
                        className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-2.5 pr-8 text-sm font-semibold text-slate-800"
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
                      <select
                        className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-2.5 pr-8 text-sm font-semibold text-slate-800"
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
                      <select
                        className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-2.5 pr-8 text-sm font-semibold text-slate-800"
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
                    </div>
                  ) : null}
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
                </div>,
                document.body,
              )
                : null}
            </div>

            <div className="contents">
              {isLeadManager ? (
                <>
                  <button
                    type="button"
                    onClick={() => exportLeadsCsv()}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                  <Link
                    href="/dashboard/lead_manager/bookings?upload=1"
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700"
                  >
                    <Upload className="h-4 w-4" />
                    Upload
                  </Link>
                </>
              ) : null}
              <Link
                href={`${base}/book?mode=book`}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                + New Booking
              </Link>
              <Link
                href={`${base}/book?mode=lead`}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[#023D95] px-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#012f73]"
              >
                <UserPlus className="h-4 w-4" />
                + Add Lead
              </Link>
              <div className="inline-flex shrink-0 items-center rounded-full border-2 border-[#004AAD] bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => switchView('chart')}
                  title="Chart view"
                  aria-pressed={viewMode === 'chart'}
                  style={
                    viewMode === 'chart'
                      ? { backgroundColor: '#004AAD', color: '#fff' }
                      : { color: '#334155' }
                  }
                  className={`inline-flex h-7 w-8 items-center justify-center rounded-full transition ${
                  viewMode === 'chart' ? 'shadow-sm' : 'hover:bg-slate-50'
                }`}
                >
                  <LineChart className="h-4 w-4" stroke="currentColor" />
                </button>
                <button
                  type="button"
                  onClick={() => switchView('list')}
                  title="List view"
                  aria-pressed={viewMode === 'list'}
                  style={
                    viewMode === 'list'
                      ? { backgroundColor: '#004AAD', color: '#fff' }
                      : { color: '#334155' }
                  }
                  className={`inline-flex h-7 w-8 items-center justify-center rounded-full transition ${
                  viewMode === 'list' ? 'shadow-sm' : 'hover:bg-slate-50'
                }`}
                >
                  <List className="h-4 w-4" stroke="currentColor" />
                </button>
              </div>
              {viewMode === 'list' ? (
                <div className="relative shrink-0" ref={columnsMenuRef}>
                  <button
                    ref={columnsBtnRef}
                    type="button"
                    onClick={() => {
                      const rect = columnsBtnRef.current?.getBoundingClientRect();
                      if (rect) {
                        const width = 288;
                        const margin = 12;
                        const viewH = window.visualViewport?.height || window.innerHeight;
                        const top = rect.bottom + 8;
                        const maxHeight = Math.max(320, Math.min(520, viewH - top - 16));
                        let left = rect.right - width;
                        if (left < margin) left = margin;
                        if (left + width > window.innerWidth - margin) {
                          left = Math.max(margin, window.innerWidth - margin - width);
                        }
                        setColumnsMenuBox({ top, left, maxHeight });
                      }
                      setColumnsMenuOpen((o) => !o);
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700"
                    aria-expanded={columnsMenuOpen}
                  >
                    <Columns3 className="h-4 w-4" />
                    Columns
                    <ChevronDown className={`h-4 w-4 transition ${columnsMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {columnsMenuOpen && columnsMenuBox && columnsPortalReady
                    ? createPortal(
                    <div
                      id="leads-columns-menu"
                      className="fixed z-[200] flex w-72 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
                      style={{ top: columnsMenuBox.top, left: columnsMenuBox.left, maxHeight: columnsMenuBox.maxHeight }}
                    >
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
                      <label className="relative mb-2 block">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                          type="search"
                          value={columnsQuery}
                          onChange={(e) => setColumnsQuery(e.target.value)}
                          placeholder="Search columns…"
                          className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004AAD]/30"
                          autoComplete="off"
                          autoFocus
                        />
                      </label>
                      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
                        {LEADS_TABLE_COLUMNS.filter(
                          (c) =>
                            (c.key !== 'source' && c.key !== 'mlScore') || isLeadManager,
                        )
                          .filter((c) => {
                            const query = columnsQuery.trim().toLowerCase();
                            if (!query) return true;
                            return c.label.toLowerCase().includes(query) || c.key.toLowerCase().includes(query);
                          })
                          .map((col) => (
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
                    </div>,
                    document.body,
                  )
                    : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <CrmDatePickerModal
          open={datePickerOpen}
          anchorRef={dateBtnRef}
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
            {leadsPager}
            {/* One table, TeleCRM style: extra columns append after Modified and the row slides */}
            <div ref={leadsTableRef} className="leads-hscroll hidden w-full min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white xl:block">
              <table
                className="w-full table-fixed border-separate border-spacing-0 text-left text-sm [&_td]:overflow-hidden [&_th]:overflow-hidden"
                style={hasExtraCols ? { width: tableWidthPx, minWidth: tableWidthPx, maxWidth: tableWidthPx } : { width: '100%' }}
              >
                {hasExtraCols ? (
                  <colgroup>
                    <col style={{ width: pxFor('check') }} />
                    {showCol('status') ? <col style={{ width: pxFor('status') }} /> : null}
                    {showCol('customer') ? <col style={{ width: pxFor('customer') }} /> : null}
                    {showCol('phone') ? <col style={{ width: pxFor('phone') }} /> : null}
                    {showCol('assignee') ? <col style={{ width: pxFor('assignee') }} /> : null}
                    {showCol('date') ? <col style={{ width: pxFor('date') }} /> : null}
                    {showCol('modified') ? <col style={{ width: pxFor('modified') }} /> : null}
                    {showCol('leadNumber') ? <col style={{ width: pxFor('leadNumber') }} /> : null}
                    {showCol('mlScore') && isLeadManager ? <col style={{ width: pxFor('mlScore') }} /> : null}
                    {showCol('message') ? <col style={{ width: pxFor('message') }} /> : null}
                    {showCol('regNo') ? <col style={{ width: pxFor('regNo') }} /> : null}
                    {showCol('makeModel') ? <col style={{ width: pxFor('makeModel') }} /> : null}
                    {showCol('city') ? <col style={{ width: pxFor('city') }} /> : null}
                    {showCol('priority') ? <col style={{ width: pxFor('priority') }} /> : null}
                    {showCol('source') && isLeadManager ? <col style={{ width: pxFor('source') }} /> : null}
                    {showCol('serviceDoneDate') ? <col style={{ width: pxFor('serviceDoneDate') }} /> : null}
                    {showCol('actions') ? <col style={{ width: pxFor('actions') }} /> : null}
                  </colgroup>
                ) : null}
                <thead className="bg-[#004AAD] text-[11px] font-bold uppercase tracking-wide text-white">
                  <tr>
                    <th data-col="check" className="w-10 bg-[#004AAD] px-2 py-2" style={hasExtraCols ? { width: pxFor('check'), minWidth: pxFor('check'), maxWidth: pxFor('check') } : undefined}>
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectPage}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Select all on page"
                      />
                    </th>
                    {showCol('status') ? (
                      <th data-col="status" className="truncate bg-[#004AAD] px-1.5 py-2" style={colWidthStyle('status')}>Status</th>
                    ) : null}
                    {showCol('customer') ? (
                      <th data-col="customer" className="whitespace-nowrap bg-[#004AAD] px-1.5 py-2" style={colWidthStyle('customer')}>Customer</th>
                    ) : null}
                    {showCol('phone') ? (
                      <th data-col="phone" className="truncate bg-[#004AAD] px-1.5 py-2" style={colWidthStyle('phone')}>Phone</th>
                    ) : null}
                    {showCol('assignee') ? (
                      <th data-col="assignee" className="whitespace-nowrap bg-[#004AAD] px-1.5 py-2" style={colWidthStyle('assignee')}>Assignee</th>
                    ) : null}
                    {showCol('date') ? (
                      <th data-col="date" className="whitespace-nowrap bg-[#004AAD] px-1.5 py-2" style={colWidthStyle('date')}>Created on</th>
                    ) : null}
                    {showCol('modified') ? (
                      <th data-col="modified" className="whitespace-nowrap bg-[#004AAD] px-1.5 py-2" style={colWidthStyle('modified')}>Modified</th>
                    ) : null}
                    {showCol('leadNumber') ? (
                      <th className="truncate bg-[#004AAD] px-2 py-2" style={colWidthStyle('leadNumber')}>Lead #</th>
                    ) : null}
                    {showCol('mlScore') && isLeadManager ? (
                      <th className="truncate bg-[#004AAD] px-1.5 py-2" style={colWidthStyle('mlScore')}>ML</th>
                    ) : null}
                    {showCol('message') ? (
                      <th className="truncate bg-[#004AAD] px-2 py-2" style={colWidthStyle('message')}>Message</th>
                    ) : null}
                    {showCol('regNo') ? (
                      <th className="truncate bg-[#004AAD] px-2 py-2" style={colWidthStyle('regNo')}>Reg. No</th>
                    ) : null}
                    {showCol('makeModel') ? (
                      <th className="truncate bg-[#004AAD] px-2 py-2" style={colWidthStyle('makeModel')}>Make / Model</th>
                    ) : null}
                    {showCol('city') ? (
                      <th className="truncate bg-[#004AAD] px-2 py-2" style={colWidthStyle('city')}>City</th>
                    ) : null}
                    {showCol('priority') ? (
                      <th className="truncate bg-[#004AAD] px-2 py-2" style={colWidthStyle('priority')}>Priority</th>
                    ) : null}
                    {showCol('source') && isLeadManager ? (
                      <th className="truncate bg-[#004AAD] px-2 py-2" style={colWidthStyle('source')}>Source</th>
                    ) : null}
                    {showCol('serviceDoneDate') ? (
                      <th className="whitespace-nowrap bg-[#004AAD] px-1.5 py-2" style={colWidthStyle('serviceDoneDate')}>Service done date</th>
                    ) : null}
                    {showCol('actions') ? (
                      <th
                        className="bg-[#004AAD] px-2 py-2 text-right"
                        data-col="actions"
                        style={hasExtraCols ? { width: pxFor('actions'), minWidth: pxFor('actions'), maxWidth: pxFor('actions') } : { width: 268, minWidth: 268, maxWidth: 268 }}
                      >
                        Actions
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {displayedLeads.map((lead) => {
                    const tint = leadStatusCardColors(lead);
                    const rowBg = selectedIds.has(String(lead.id)) ? '#DBEAFE' : tint.cardBg;
                    const msg =
                      lead.message_preview ||
                      lead.coupon_meta?.last_inbound_message ||
                      lead.problem_description ||
                      '—';
                    const regNo = String(lead.vehicle_number || '').trim().toUpperCase();
                    const regDisplay = regNo && regNo !== 'NA' ? regNo : '—';
                    const makeModel =
                      [lead.vehicle_make, lead.vehicle_model]
                        .map((v) => String(v || '').trim())
                        .filter((v) => v && v.toUpperCase() !== 'NA')
                        .join(' ') || '—';
                    return (
                      <tr
                        key={lead.id}
                        className={`cursor-pointer border-b border-slate-100 ${
                          openLeadId === String(lead.id)
                            ? 'ring-2 ring-inset ring-[#004AAD]'
                            : selectedIds.has(String(lead.id))
                              ? 'ring-2 ring-inset ring-blue-400'
                              : ''
                        }`}
                        style={{ backgroundColor: rowBg }}
                        onClick={() => openLead(String(lead.id))}
                      >
                        <td className="border-b border-slate-100 px-2 py-2 align-middle" style={{ backgroundColor: rowBg }} onClick={(e) => { e.stopPropagation(); toggleSelect(String(lead.id)); }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(String(lead.id))}
                            onChange={() => toggleSelect(String(lead.id))}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${lead.lead_number || lead.id}`}
                          />
                        </td>
                        {showCol('status') ? (
                          <td className="border-b border-slate-100 px-1.5 py-2 align-middle" style={{ ...colWidthStyle('status'), backgroundColor: rowBg }} onClick={(e) => e.stopPropagation()}>
                            <select
                              aria-label="Change lead status"
                              value={resolveAdminCrmStatusId(lead)}
                              disabled={statusSavingId === String(lead.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                void changeLeadStatus(lead, e.target.value, e.currentTarget);
                              }}
                              className="max-w-[148px] cursor-pointer rounded-full border-0 py-0.5 pl-2 pr-6 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                              style={{ backgroundColor: tint.badgeBg, color: tint.badgeText, WebkitTextFillColor: tint.badgeText }}
                            >
                              {crmStatusChoices.map((opt) => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                              ))}
                            </select>
                          </td>
                        ) : null}
                        {showCol('customer') ? (
                          <td className="border-b border-slate-100 px-1.5 py-2 align-middle text-[13px] font-semibold text-slate-900" style={{ ...colWidthStyle('customer'), backgroundColor: rowBg }} title={formatLeadName(lead.customer_name)}>
                            <span className="flex min-w-0 items-center gap-1.5">
                              {lead.has_membership ? <MembershipCrown /> : null}
                              <span className="truncate whitespace-nowrap">{formatLeadName(lead.customer_name)}</span>
                              {lead.repeat_customer ? (
                                <span title={lead.repeat_remark || 'Repeat Customer'} className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">Repeat</span>
                              ) : null}
                            </span>
                            {lead.repeat_customer && lead.repeat_remark ? (
                              <span className="mt-0.5 block truncate text-[10px] font-medium text-amber-800" title={lead.repeat_remark}>{lead.repeat_remark}</span>
                            ) : null}
                          </td>
                        ) : null}
                        {showCol('phone') ? (
                          <td className="whitespace-nowrap border-b border-slate-100 px-1.5 py-2 align-middle text-[13px] text-slate-700" style={{ ...colWidthStyle('phone'), backgroundColor: rowBg }}>{lead.customer_phone || '—'}</td>
                        ) : null}
                        {showCol('assignee') ? (
                          <td className="truncate whitespace-nowrap border-b border-slate-100 px-1.5 py-2 align-middle text-xs font-semibold text-indigo-700" style={{ ...colWidthStyle('assignee'), backgroundColor: rowBg }} title={formatLeadName(lead.assigned_telecaller?.full_name || 'Unassigned')}>
                            {formatLeadName(lead.assigned_telecaller?.full_name || 'Unassigned')}
                          </td>
                        ) : null}
                        {showCol('date') ? (
                          <td className="whitespace-nowrap border-b border-slate-100 px-1.5 py-2 align-middle text-[11px] text-slate-600" style={{ ...colWidthStyle('date'), backgroundColor: rowBg }}>
                            <StackedDateTime iso={lead.created_at} />
                          </td>
                        ) : null}
                        {showCol('modified') ? (
                          <td className="whitespace-nowrap border-b border-slate-100 px-1.5 py-2 align-middle text-[11px] text-slate-600" style={{ ...colWidthStyle('modified'), backgroundColor: rowBg }}>
                            <StackedDateTime iso={lead.updated_at || lead.created_at} />
                          </td>
                        ) : null}
                        {showCol('leadNumber') ? (
                          <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 align-middle text-[13px] font-extrabold text-[#023D95]" style={{ ...colWidthStyle('leadNumber'), backgroundColor: rowBg }}>{lead.lead_number || lead.id?.slice(0, 8)}</td>
                        ) : null}
                        {showCol('mlScore') && isLeadManager ? (
                          <td className="border-b border-slate-100 px-1.5 py-2 align-middle" style={{ ...colWidthStyle('mlScore'), backgroundColor: rowBg }}>
                            <MlScoreBadge compact score={lead.ml_score?.conversion_score} temperature={lead.ml_score?.temperature} />
                          </td>
                        ) : null}
                        {showCol('message') ? (
                          <td className="overflow-hidden border-b border-slate-100 px-2 py-2 align-middle text-[11px] text-slate-600" style={{ ...colWidthStyle('message'), backgroundColor: rowBg }}>
                            <span className="line-clamp-2 break-words leading-snug">{String(msg)}</span>
                          </td>
                        ) : null}
                        {showCol('regNo') ? (
                          <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 align-middle text-[12px] font-semibold uppercase text-slate-800" style={{ ...colWidthStyle('regNo'), backgroundColor: rowBg }} title={regDisplay}>{regDisplay}</td>
                        ) : null}
                        {showCol('makeModel') ? (
                          <td className="border-b border-slate-100 px-2 py-2 align-middle text-[12px] text-slate-700" style={{ ...colWidthStyle('makeModel'), backgroundColor: rowBg }} title={makeModel}>
                            {(() => {
                              const make = String(lead.vehicle_make || '').trim().toUpperCase();
                              const model = String(lead.vehicle_model || '').trim().toUpperCase();
                              const makeOk = make && make !== 'NA';
                              const modelOk = model && model !== 'NA';
                              if (!makeOk && !modelOk) return '—';
                              return (
                                <span className="inline-flex max-w-full flex-col leading-snug">
                                  {makeOk ? <span className="truncate">{make}</span> : null}
                                  {modelOk ? <span className="truncate text-slate-500">{model}</span> : null}
                                </span>
                              );
                            })()}
                          </td>
                        ) : null}
                        {showCol('city') ? (
                          <td className="truncate border-b border-slate-100 px-2 py-2 align-middle text-[12px] text-slate-700" style={{ ...colWidthStyle('city'), backgroundColor: rowBg }}>{lead.city || lead.workshop?.city || '—'}</td>
                        ) : null}
                        {showCol('priority') ? (
                          <td className="truncate border-b border-slate-100 px-2 py-2 align-middle text-[12px] font-semibold text-slate-700" style={{ ...colWidthStyle('priority'), backgroundColor: rowBg }}>{lead.lead_priority || lead.priority || 'NORMAL'}</td>
                        ) : null}
                        {showCol('source') && isLeadManager ? (
                          <td className="truncate border-b border-slate-100 px-2 py-2 align-middle text-[12px] text-slate-600" style={{ ...colWidthStyle('source'), backgroundColor: rowBg }}>{lead.booking_source_label || lead.lead_source || '—'}</td>
                        ) : null}
                        {showCol('serviceDoneDate') ? (
                          <td className="whitespace-nowrap border-b border-slate-100 px-1.5 py-2 align-middle text-[11px] text-slate-700" style={{ ...colWidthStyle('serviceDoneDate'), backgroundColor: rowBg }}>{leadServiceDoneDate(lead) || '—'}</td>
                        ) : null}
                        {showCol('actions') ? (
                          <td
                            className="border-b border-slate-100 px-2 py-2 align-middle"
                            style={{ width: 268, backgroundColor: rowBg }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-nowrap items-center justify-end gap-2">
                              {lead.customer_phone ? (
                                <a href={`tel:${lead.customer_phone}`} title="Call" aria-label="Call" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700">
                                  <Phone className="h-5 w-5 shrink-0 fill-current" strokeWidth={0} />
                                </a>
                              ) : null}
                              {lead.customer_phone ? (
                                <button type="button" onClick={() => openLeadWhatsApp(lead)} title="WhatsApp" aria-label="WhatsApp" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-sm hover:bg-[#1ebe5c]">
                                  <WhatsAppIcon className="h-5 w-5 shrink-0" />
                                </button>
                              ) : null}
                              <button type="button" onClick={() => openShare(lead)} title="Transfer to another telecaller" aria-label="Transfer to another telecaller" className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#004AAD] px-3 text-xs font-bold text-white shadow-sm hover:bg-[#023D95]">
                                <ArrowRightLeft className="h-4 w-4 shrink-0" />
                                Transfer
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:hidden">
              {displayedLeads.map((lead) => {
                const tint = leadStatusCardColors(lead);
                const statusLabel = leadDisplayStatus(lead);
                return (
                  <div
                    key={lead.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openLead(String(lead.id))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openLead(String(lead.id));
                      }
                    }}
                    className={`rounded-2xl border p-3 shadow-sm ${
                      openLeadId === String(lead.id) ? 'ring-2 ring-[#004AAD]' : ''
                    }`}
                    style={{
                      backgroundColor: tint.cardBg,
                      borderColor: tint.border,
                    }}
                  >
                    <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(String(lead.id))}
                          onChange={() => toggleSelect(String(lead.id))}
                        />
                        Select
                      </label>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 font-bold text-slate-900 leading-snug truncate">
                          {lead.has_membership ? <MembershipCrown /> : null}
                          <span className="truncate">{formatLeadName(lead.customer_name)}</span>
                        </p>
                        {lead.repeat_customer ? (
                          <p className="mt-1 text-[11px] font-semibold text-amber-800" title={lead.repeat_remark || ''}>
                            Repeat Customer{lead.repeat_remark ? ` · ${lead.repeat_remark}` : ''}
                          </p>
                        ) : null}
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
                        <select
                          aria-label="Change lead status"
                          value={resolveAdminCrmStatusId(lead)}
                          disabled={statusSavingId === String(lead.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            void changeLeadStatus(lead, e.target.value, e.currentTarget);
                          }}
                          className="max-w-[132px] cursor-pointer rounded-full border-0 py-0.5 pl-2 pr-5 text-[11px] font-bold focus:outline-none disabled:opacity-60"
                          style={{ backgroundColor: tint.badgeBg, color: tint.badgeText, WebkitTextFillColor: tint.badgeText }}
                        >
                          {crmStatusChoices.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
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
                    <div className="mt-2.5 flex gap-2" onClick={(e) => e.stopPropagation()}>
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
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        Transfer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {leadsPager}
          </>
        )}
      </div>

      {shareLead ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-[#023D95]">Transfer to telecaller</h3>
              <button type="button" onClick={() => setShareLead(null)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-600">
              {formatLeadName(shareLead.customer_name)} · {shareLead.lead_number}. Choose who should get this lead.
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
                      <p className="text-sm font-bold text-slate-800">
                        {String(p.full_name || p.name || '').trim() || 'Telecaller'}
                      </p>
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

      {reasonMenu
        ? createPortal(
            <div
              data-lost-reason-menu
              className="fixed z-[90] w-[260px] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              style={{ top: reasonMenu.top, left: reasonMenu.left, maxHeight: reasonMenu.maxHeight }}
            >
              <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Lost reason</p>
              {lostReasonChoices.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="block w-full truncate px-3 py-1.5 text-left text-xs font-semibold text-slate-800 hover:bg-[#E7F0FF] hover:text-[#023D95]"
                  onClick={() => {
                    const lead = reasonMenu.lead;
                    setReasonMenu(null);
                    void changeLeadStatus(lead, 'LOST', undefined, name);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}

      {openLeadId ? (
        <div className="fixed inset-0 z-[80] flex justify-end">
          <button
            type="button"
            aria-label="Close lead"
            className="absolute inset-0 bg-slate-900/40"
            onClick={closeLead}
          />
          <div className="telecaller-lead-drawer relative flex h-full w-full min-w-0 flex-col bg-[#f4f7fb] shadow-2xl min-[1100px]:w-[calc(100vw-7rem)] min-[1536px]:w-[min(1360px,calc(100vw-9rem))]">
            {pageLeadIds.length > 0 ? (
              <div className="flex shrink-0 items-center justify-end gap-2 border-b border-slate-200 bg-white px-3 py-2">
                <button
                  type="button"
                  disabled={pageLeadIds.indexOf(openLeadId) <= 0}
                  onClick={() => {
                    const i = pageLeadIds.indexOf(openLeadId);
                    if (i > 0) openLead(pageLeadIds[i - 1]);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-xs font-bold text-slate-500">
                  {Math.max(1, pageLeadIds.indexOf(openLeadId) + 1)} of {pageLeadIds.length}
                </span>
                <button
                  type="button"
                  disabled={pageLeadIds.indexOf(openLeadId) < 0 || pageLeadIds.indexOf(openLeadId) >= pageLeadIds.length - 1}
                  onClick={() => {
                    const i = pageLeadIds.indexOf(openLeadId);
                    if (i >= 0 && i < pageLeadIds.length - 1) openLead(pageLeadIds[i + 1]);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <LeadDetailContent
                panelLeadId={openLeadId}
                onPanelClose={closeLead}
                listSeed={displayedLeads.find((row) => String(row.id) === openLeadId) || null}
              />
            </div>
            <div id="lead-drawer-actions" className="hidden" />
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
