'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import GoogleEmbedMap from '@/components/maps/GoogleEmbedMap';
import GoogleStateHeatmapMap, { type GoogleStateHeatmapPoint } from '@/components/maps/GoogleStateHeatmapMap';
import StateHeatmapLeafletVanillaMap, { type StateHeatmapPoint as LeafletStatePoint } from '@/components/maps/StateHeatmapLeafletVanillaMap';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Telecaller = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type MappingRow = {
  id: string;
  aansh_id: number;
  telecaller_id: string | null;
  assignee_role?: string | null;
  assignee_id?: string | null;
  assignee_name?: string | null;
  assignee_email?: string | null;
  assignee_phone?: string | null;
  effective_from: string;
  effective_to: string | null;
  day_of_week?: number[] | null;
  time_from?: string | null;
  time_to?: string | null;
};

type SarvCallRow = {
  id: string;
  callid: string;
  cnumber: string | null;
  callstatus: number | null;
  ctype: string | null;
  ivrstime: string | null;
  ivretime: string | null;
  ivrduration: number | null;
  talkduration: number | null;
  agentoncallduration: number | null;
  custanswerstime: string | null;
  custansweretime: string | null;
  custanswerduration: number | null;
  recording_url: string | null;
  transcription: string | null;
  summary: string | null;
  disposition: string | null;
  disposition_category: string | null;
  disposition_note: string | null;
  disposition_updated_at: string | null;
  sarv_created_at: string | null;
  created_at: string;
  assigned_user_id: string | null;
  assigned_role: string | null;
  city?: string | null;
  assignee_name?: string | null;
  assignee_email?: string | null;
  assignee_phone?: string | null;
};

type SarvCallAudit = {
  id: string;
  sarv_call_id: string;
  audit_status: string | null;
  audit_score: number | null;
  feedback: string | null;
  audited_by_id: string | null;
  audited_at: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type OverviewBreakdownRow = {
  key: string;
  name: string;
  total: number;
  resolved: number;
  rate: number;
  revenue: number;
  mechanic_payment: number;
  company_profit: number;
};

type OverviewLeadRow = {
  id: string;
  customer_name: string | null;
  contact_number: string | null;
  vehicle_number: string | null;
  service_type: string | null;
  service_tag: string | null;
  lead_status: string | null;
  complaint_status: string | null;
  lead_registered_at: string | null;
  address: string | null;
  pincode: string | null;
  registered_by_name?: string | null;
  assigned_manager_name?: string | null;
  customer_quoted_amount?: number | null;
  advance_payment?: string | null;
  payment_to_mechanic?: number | null;
  payment_received?: number | null;
};

type OverviewSelection = {
  type: 'all' | 'district' | 'state' | 'employee' | 'department' | 'mechanic';
  value: string;
  label: string;
};

type OverviewData = {
  status_options?: string[];
  kpis: {
    total_requests: number;
    resolved: number;
    pending: number;
    avg_resolution_hours: number | null;
    total_quoted: number;
    total_mechanics?: number;
    advance_amount?: number;
    payment_received: number;
    payment_to_mechanic: number;
    company_profit: number;
    total_link_generated_count?: number;
    total_link_generated_amount?: number;
    total_captured_payment_count?: number;
    total_captured_payment_amount?: number;
    total_refund_count?: number;
    total_refund_amount?: number;
  };
  payment_rows?: Array<{
    order_id: string | null;
    payment_id: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    employee_name: string | null;
    employee_role: string | null;
    status: string | null;
    amount: number;
    captured_amount: number;
    refunded_amount: number;
    created_at: string | null;
  }>;
  breakdowns: {
    department: OverviewBreakdownRow[];
    district: OverviewBreakdownRow[];
    state: OverviewBreakdownRow[];
    employee: OverviewBreakdownRow[];
    mechanic?: OverviewBreakdownRow[];
  };
};

type PaymentMetricKey = 'links' | 'captured' | 'refund';

function formatStatusLabel(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return 'Unknown';
  return raw
    .replace(/[_\-]+/g, ' ')
    .split(/\s+/)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function normalizeAmountInput(value: any) {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[^\d.]/g, '');
  return cleaned;
}

function toNullableNumberFromInput(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : NaN;
}

type OverviewTrendPoint = {
  date: string; // YYYY-MM-DD (UTC)
  total_requests: number;
  resolved: number;
  total_quoted: number;
  mechanic_payment: number;
  advance_amount: number;
  company_profit: number;
};

type TrendMetric = 'total_requests' | 'resolved' | 'company_profit' | 'total_quoted';

type TabKey = 'mapping' | 'report' | 'overview' | 'catalog' | 'sessions';

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return String(value).replace('T', ' ').slice(0, 19);
}

function formatDays(days?: number[] | null) {
  if (!Array.isArray(days) || days.length === 0) return '—';
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => labels[d] ?? String(d))
    .join(', ');
}

function formatTimeRange(from?: string | null, to?: string | null) {
  if (!from && !to) return '—';
  const fmt = (value?: string | null) => {
    if (!value) return '—';
    const raw = String(value).slice(0, 5);
    const [h, m] = raw.split(':').map((n) => Number(n));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return raw;
    const hour12 = ((h + 11) % 12) + 1;
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  return `${fmt(from)} - ${fmt(to)}`;
}

function formatDuration(seconds?: number | null) {
  if (!Number.isFinite(seconds as number)) return '—';
  const total = Math.max(0, Number(seconds));
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function extractCallRatingFromSummary(summary?: string | null) {
  const text = String(summary || '').trim();
  if (!text) return null;
  const m =
    text.match(/Call Rating\s*\(1-5\)\s*[:\-–]?\s*([1-5])/i) ||
    text.match(/\bRating\b\s*[:\-–]?\s*([1-5])/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 5 ? n : null;
}

function parseSummarySections(summary?: string | null) {
  const text = String(summary || '').trim();
  const out = {
    customerIssue: '',
    resolution: '',
    sentiment: '',
    actionItems: '',
    other: '',
  };
  if (!text) return out;
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  let current: keyof typeof out = 'other';
  for (const line of lines) {
    const clean = line.replace(/^\s*[-•]\s*/, '').replace(/\*\*+/g, '').trim();
    const match = clean.match(/^(Customer Issue|Resolution|Sentiment|Action Items)\s*[:\-–]?\s*(.*)$/i);
    if (match) {
      const label = match[1].toLowerCase();
      if (label.includes('customer issue')) current = 'customerIssue';
      else if (label.includes('resolution')) current = 'resolution';
      else if (label.includes('sentiment')) current = 'sentiment';
      else if (label.includes('action items')) current = 'actionItems';
      const rest = match[2]?.trim();
      if (rest) out[current] = out[current] ? `${out[current]} ${rest}` : rest;
      continue;
    }
    out[current] = out[current] ? `${out[current]} ${clean}` : clean;
  }
  return out;
}

function deriveCallRating(summary?: string | null) {
  // Prefer explicit rating (new format)
  const explicit = extractCallRatingFromSummary(summary);
  if (explicit != null) return explicit;

  // Backward-compat: infer rating from sentiment (old 4-line summary)
  const sections = parseSummarySections(summary);
  const s = String(sections.sentiment || '').trim();
  if (!s) return null;
  if (/negative|नकारात्मक/i.test(s)) return 2;
  if (/neutral|तटस्थ/i.test(s)) return 3;
  if (/positive|सकारात्मक/i.test(s)) return 4;
  return null;
}

function groupCallsByCustomer(calls: SarvCallRow[]) {
  const map = new Map<string, SarvCallRow[]>();
  for (const call of calls) {
    const key = call.cnumber || 'Unknown';
    const list = map.get(key) || [];
    list.push(call);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([customer, list]) => {
    const sorted = [...list].sort((a, b) => {
      const at = new Date(a.custanswerstime || a.sarv_created_at || a.created_at).getTime();
      const bt = new Date(b.custanswerstime || b.sarv_created_at || b.created_at).getTime();
      return bt - at;
    });
    return { customer, calls: sorted };
  }).sort((a, b) => {
    const at = new Date(a.calls[0].custanswerstime || a.calls[0].sarv_created_at || a.calls[0].created_at).getTime();
    const bt = new Date(b.calls[0].custanswerstime || b.calls[0].sarv_created_at || b.calls[0].created_at).getTime();
    return bt - at;
  });
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

const IST_OFFSET_MS = 330 * 60 * 1000;

function todayISTYMD() {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function addDaysYMD(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toISTBoundaryISO(value: string, which: 'start' | 'end') {
  // value supports YYYY-MM-DD or YYYY-MM-DDTHH:mm (interpreted as IST).
  const raw = String(value || '').trim();
  if (!raw) return null;
  const [datePart, timePart = ''] = raw.split('T');
  const [y, m, d] = datePart.split('-').map((n) => Number(n));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  let hh = which === 'start' ? 0 : 23;
  let mm = which === 'start' ? 0 : 59;
  if (timePart) {
    const [hStr, minStr] = timePart.split(':');
    const h = Number(hStr);
    const mins = Number(minStr);
    if (Number.isFinite(h) && Number.isFinite(mins)) {
      hh = Math.min(23, Math.max(0, h));
      mm = Math.min(59, Math.max(0, mins));
    }
  }
  const baseUtc =
    which === 'start'
      ? Date.UTC(y, m - 1, d, hh, mm, 0, 0)
      : Date.UTC(y, m - 1, d, hh, mm, 59, 999);
  // Convert IST -> UTC by subtracting offset.
  return new Date(baseUtc - IST_OFFSET_MS).toISOString();
}

function formatYMD(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  if (raw.includes('T')) return raw.replace('T', ' ').slice(0, 16);
  return raw.slice(0, 10);
}

function normalizeStateLabel(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

const INDIA_CENTER = { lat: 22.9734, lng: 78.6569 };

// Centroids used to place state-level markers. (No lead-level lat/lng available in RSA overview data.)
const STATE_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  andhrapradesh: { lat: 15.9129, lng: 79.74 },
  arunachalpradesh: { lat: 28.218, lng: 94.7278 },
  assam: { lat: 26.2006, lng: 92.9376 },
  bihar: { lat: 25.0961, lng: 85.3131 },
  chhattisgarh: { lat: 21.2787, lng: 81.8661 },
  goa: { lat: 15.2993, lng: 74.124 },
  gujarat: { lat: 22.2587, lng: 71.1924 },
  haryana: { lat: 29.0588, lng: 76.0856 },
  himachalpradesh: { lat: 31.1048, lng: 77.1734 },
  jammuandkashmir: { lat: 33.7782, lng: 76.5762 },
  jharkhand: { lat: 23.6102, lng: 85.2799 },
  karnataka: { lat: 15.3173, lng: 75.7139 },
  kerala: { lat: 10.8505, lng: 76.2711 },
  madhyapradesh: { lat: 22.9734, lng: 78.6569 },
  maharashtra: { lat: 19.7515, lng: 75.7139 },
  manipur: { lat: 24.6637, lng: 93.9063 },
  meghalaya: { lat: 25.467, lng: 91.3662 },
  mizoram: { lat: 23.1645, lng: 92.9376 },
  nagaland: { lat: 26.1584, lng: 94.5624 },
  odisha: { lat: 20.9517, lng: 85.0985 },
  punjab: { lat: 31.1471, lng: 75.3412 },
  rajasthan: { lat: 27.0238, lng: 74.2179 },
  sikkim: { lat: 27.533, lng: 88.5122 },
  tamilnadu: { lat: 11.1271, lng: 78.6569 },
  telangana: { lat: 18.1124, lng: 79.0193 },
  tripura: { lat: 23.9408, lng: 91.9882 },
  uttarpradesh: { lat: 26.8467, lng: 80.9462 },
  uttarakhand: { lat: 30.0668, lng: 79.0193 },
  westbengal: { lat: 22.9868, lng: 87.855 },

  // UTs (common ones)
  delhi: { lat: 28.7041, lng: 77.1025 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  puducherry: { lat: 11.9416, lng: 79.8083 },
  andamannicobar: { lat: 11.7401, lng: 92.6586 },
  ladakh: { lat: 34.1526, lng: 77.577 },
};

function getStateCentroid(name?: string | null) {
  const key = normalizeStateLabel(name);
  if (key === 'unknown') return INDIA_CENTER;
  return STATE_CENTROIDS[key] || null;
}

function formatCurrency(value?: number | null) {
  if (!Number.isFinite(value as number)) return '₹0';
  return `₹${Math.round(Number(value)).toLocaleString('en-IN')}`;
}

function formatRate(value?: number | null) {
  if (!Number.isFinite(value as number)) return '—';
  return `${Number(value).toFixed(0)}%`;
}

function formatHours(value?: number | null) {
  if (!Number.isFinite(value as number)) return '—';
  const hours = Number(value);
  return `${hours.toFixed(1)}h`;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export default function SuperAdminRSASettingsPage() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(false);
  const [mappingError, setMappingError] = useState('');
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportCalls, setReportCalls] = useState<SarvCallRow[]>([]);
  const [reportOverviewAll, setReportOverviewAll] = useState<{
    totalCalls: number;
    totalCustomers: number;
    dispositions: Array<{ name: string; total: number }>;
    cities: Array<{ name: string; total: number }>;
  } | null>(null);
  const [reportDrilldownOpen, setReportDrilldownOpen] = useState(false);
  const [reportDrilldownLoading, setReportDrilldownLoading] = useState(false);
  const [reportDrilldownError, setReportDrilldownError] = useState('');
  const [reportDrilldownTitle, setReportDrilldownTitle] = useState('');
  const [reportDrilldownRows, setReportDrilldownRows] = useState<SarvCallRow[]>([]);
  const [reportPage, setReportPage] = useState(1);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportJumpPage, setReportJumpPage] = useState('1');
  const [reportAssignees, setReportAssignees] = useState<Telecaller[]>([]);
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState('');
  const [trendPoints, setTrendPoints] = useState<OverviewTrendPoint[]>([]);
  const [trendGranularity, setTrendGranularity] = useState<'day' | 'hour'>('day');
  const [activeStateId, setActiveStateId] = useState<string>('');
  const [mechCoverageOpen, setMechCoverageOpen] = useState(false);
  const [mechCoverageLoading, setMechCoverageLoading] = useState(false);
  const [mechCoverageError, setMechCoverageError] = useState('');
  const [mechCoverageTab, setMechCoverageTab] = useState<'state' | 'district'>('state');
  const [mechCoverageFilterState, setMechCoverageFilterState] = useState<string>('');
  const [mechListOpen, setMechListOpen] = useState(false);
  const [mechListLoading, setMechListLoading] = useState(false);
  const [mechListError, setMechListError] = useState('');
  const [mechListTitle, setMechListTitle] = useState('');
  const [mechList, setMechList] = useState<
    { id: string; code: string | null; mechanic_name: string | null; number: string | null; matched_pincode_count: number; matched_pincodes: string[] }[]
  >([]);
  const [mechCoverage, setMechCoverage] = useState<{
    kpis: {
      total_mechanics: number;
      mechanics_with_coverage: number;
      service_pincodes: number;
      total_mechanics_all?: number;
      total_mechanics_active?: number;
      breakdown_scope?: 'all' | 'active';
    };
    breakdowns: {
      state: { state: string; mechanics: number }[];
      district: { district: string; state: string; mechanics: number }[];
    };
  } | null>(null);
  const [employeeReportLoading, setEmployeeReportLoading] = useState(false);
  const [employeeReportError, setEmployeeReportError] = useState('');
  const [employeeReportRows, setEmployeeReportRows] = useState<
    {
      user_id: string;
      name: string;
      role: string;
      registered_complaints: number;
      completed_complaints: number;
      registered_resolved_complaints: number;
      total_quoted: number;
      registered_advance_amount: number;
      registered_profit: number;
      self_completed_mechanic_payment: number;
      self_completed_profit: number;
      completed_only_mechanic_payment: number;
      completed_only_profit: number;
      total_answer_calls: number;
      avg_call_rating: number | null;
      avg_audit_rating: number | null;
    }[]
  >([]);
  const [overviewSelection, setOverviewSelection] = useState<OverviewSelection | null>(null);
  const [overviewLeads, setOverviewLeads] = useState<OverviewLeadRow[]>([]);
  const [overviewLeadsLoading, setOverviewLeadsLoading] = useState(false);
  const [overviewLeadsError, setOverviewLeadsError] = useState('');
  const [overviewFinanceDrafts, setOverviewFinanceDrafts] = useState<
    Record<
      string,
      {
        customer_quoted_amount: string;
        advance_payment: string;
        payment_to_mechanic: string;
        saving?: boolean;
        error?: string;
      }
    >
  >({});
  const [overviewStatusOptions, setOverviewStatusOptions] = useState<string[]>([]);
  const [overviewExportLoading, setOverviewExportLoading] = useState(false);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState('');
  const [activePaymentMetric, setActivePaymentMetric] = useState<PaymentMetricKey | null>(null);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [paymentRoleFilter, setPaymentRoleFilter] = useState('');
  const [paymentEmployeeFilter, setPaymentEmployeeFilter] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [districtOpen, setDistrictOpen] = useState(false);
  const [mechanicOpen, setMechanicOpen] = useState(false);
  const [showProfit, setShowProfit] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryCall, setSummaryCall] = useState<SarvCallRow | null>(null);
  const [transcriptionView, setTranscriptionView] = useState<'raw' | 'split'>('raw');
  const [swapSpeakers, setSwapSpeakers] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState('');

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditCall, setAuditCall] = useState<SarvCallRow | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSaving, setAuditSaving] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditForm, setAuditForm] = useState(() => ({
    audit_status: '',
    audit_score: '',
    feedback: '',
  }));
  const [auditByCallId, setAuditByCallId] = useState<Record<string, SarvCallAudit | null>>({});
  const [form, setForm] = useState({
    id: '',
    aansh_id: '',
    assignee_role: 'TELECALLER',
    assignee_id: '',
    effective_from: '1970-01-01T00:00',
    effective_to: '',
    day_of_week: [] as number[],
    time_from: '',
    time_to: '',
  });
  const [overviewFilters, setOverviewFilters] = useState(() => {
    const today = todayISTYMD();
    const from = addDaysYMD(today, -7);
    return {
      from: `${from}T00:00`,
      to: `${today}T23:59`,
      status: '',
    };
  });
  const [reportFilters, setReportFilters] = useState(() => {
    const today = todayISTYMD();
    const from = addDaysYMD(today, -7);
    return {
      from,
      to: today,
      assignee_role: '',
      assignee_id: '',
      has_recording: false,
      q: '',
      limit: 50,
    };
  });

  const [reportRatingFilter, setReportRatingFilter] = useState<string>('');

  const [catalogItems, setCatalogItems] = useState<{ id: string; aansh_id: number; system_name?: string | null; is_active: boolean; created_at?: string }[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [catalogNewId, setCatalogNewId] = useState('');
  const [catalogNewName, setCatalogNewName] = useState('');
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [sessionsList, setSessionsList] = useState<{ id: string; aansh_id: number; user_id: string; assignee_role: string; expires_at: string; user_name?: string; user_email?: string }[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionRemovingId, setSessionRemovingId] = useState<string>('');

  const filteredReportCalls = useMemo(() => {
    const list = Array.isArray(reportCalls) ? reportCalls : [];
    const f = String(reportRatingFilter || '').trim();
    if (!f) return list;
    if (f === 'unrated') {
      return list.filter((c: any) => deriveCallRating(c?.summary) == null);
    }
    const n = Number(f);
    if (!Number.isFinite(n) || n < 1 || n > 5) return list;
    return list.filter((c: any) => deriveCallRating(c?.summary) === n);
  }, [reportCalls, reportRatingFilter]);

  const groupedReportCalls = useMemo(() => groupCallsByCustomer(filteredReportCalls), [filteredReportCalls]);
  const reportOverview = useMemo(() => {
    const calls = Array.isArray(filteredReportCalls) ? filteredReportCalls : [];
    const dispositionCounts = new Map<string, number>();
    const cityCounts = new Map<string, number>();
    const customers = new Set<string>();

    const addCount = (map: Map<string, number>, key: string) => {
      map.set(key, (map.get(key) || 0) + 1);
    };

    const getCityLabel = (row: any) => {
      const candidates = [
        row?.city,
        row?.customer_city,
        row?.lead_city,
        row?.location_city,
        row?.district,
        row?.circle,
        row?.state,
      ];
      const hit = candidates
        .map((v) => String(v || '').trim())
        .find((v) => v.length > 0);
      return hit || 'Unknown';
    };

    for (const row of calls as any[]) {
      const customer = String(row?.cnumber || '').trim();
      if (customer) customers.add(customer);

      const disposition = String(row?.disposition || row?.disposition_category || '').trim() || 'Unspecified';
      addCount(dispositionCounts, disposition);
      addCount(cityCounts, getCityLabel(row));
    }

    const sortRows = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total);

    return {
      totalCalls: calls.length,
      totalCustomers: customers.size,
      dispositions: sortRows(dispositionCounts),
      cities: sortRows(cityCounts),
    };
  }, [filteredReportCalls]);
  const activeReportOverview = reportRatingFilter ? reportOverview : reportOverviewAll || reportOverview;

  const telecallerOptions = useMemo(() => telecallers, [telecallers]);

  const resetForm = () => {
    setForm({
      id: '',
      aansh_id: '',
      assignee_role: 'TELECALLER',
      assignee_id: '',
      effective_from: '1970-01-01T00:00',
      effective_to: '',
      day_of_week: [],
      time_from: '',
      time_to: '',
    });
  };

  const loadMappings = async () => {
    setLoading(true);
    setMappingError('');
    try {
      const mapRes = await fetch('/api/super_admin/sarv-aansh-mappings');
      const mapJson = await mapRes.json().catch(() => ({}));
      if (!mapRes.ok) throw new Error(mapJson?.error || 'Failed to load mappings');
      setMappings(Array.isArray(mapJson?.mappings) ? mapJson.mappings : []);
    } catch (e: any) {
      setMappingError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadCatalog = async () => {
    setCatalogLoading(true);
    setCatalogError('');
    try {
      const res = await fetch('/api/super_admin/sarv-aansh-catalog');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load catalog');
      setCatalogItems(Array.isArray(json?.catalog) ? json.catalog : []);
    } catch (e: any) {
      setCatalogError(e?.message || 'Failed to load catalog');
      setCatalogItems([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/super_admin/sarv-aansh-sessions');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load sessions');
      setSessionsList(Array.isArray(json?.sessions) ? json.sessions : []);
    } catch {
      setSessionsList([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  const removeSession = async (sessionId: string) => {
    if (!sessionId) return;
    if (!confirm('Is session ko manually release karna hai?')) return;
    setSessionRemovingId(sessionId);
    try {
      const res = await fetch('/api/super_admin/sarv-aansh-sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to remove session');
      await loadSessions();
    } catch (e: any) {
      alert(e?.message || 'Failed to remove session');
    } finally {
      setSessionRemovingId('');
    }
  };

  const loadAssignees = async (role: string) => {
    try {
      const res = await fetch(`/api/super_admin/telecallers?role=${role}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load users');
      setTelecallers(Array.isArray(json?.telecallers) ? json.telecallers : []);
    } catch (e: any) {
      setMappingError(e?.message || 'Failed to load users');
      setTelecallers([]);
    }
  };

  const loadReportAssignees = async (role: string) => {
    try {
      const res = await fetch(`/api/super_admin/telecallers?role=${role}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load users');
      setReportAssignees(Array.isArray(json?.telecallers) ? json.telecallers : []);
    } catch (e: any) {
      setReportError(e?.message || 'Failed to load users');
      setReportAssignees([]);
    }
  };

  const loadReport = async () => {
    setReportLoading(true);
    setReportError('');
    try {
      const params = new URLSearchParams();
      if (reportFilters.from) {
        params.set('from', new Date(`${reportFilters.from}T00:00:00`).toISOString());
      }
      if (reportFilters.to) {
        params.set('to', new Date(`${reportFilters.to}T23:59:59`).toISOString());
      }
      if (reportFilters.assignee_role) {
        params.set('assignee_role', reportFilters.assignee_role);
      }
      if (reportFilters.assignee_id) {
        params.set('assignee_id', reportFilters.assignee_id);
      }
      if (reportFilters.has_recording) {
        params.set('has_recording', 'true');
      }
      if (reportFilters.q.trim()) {
        params.set('q', reportFilters.q.trim());
      }
      params.set('include_overview', 'true');
      params.set('limit', String(reportFilters.limit));
      params.set('page', String(reportPage));

      const res = await fetch(`/api/super_admin/sarv-calls?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load calls');
      setReportCalls(Array.isArray(json?.calls) ? json.calls : []);
      setReportTotal(Number(json?.pagination?.total || 0));
      setReportOverviewAll(
        json?.overview
          ? {
              totalCalls: Number(json.overview.totalCalls || 0),
              totalCustomers: Number(json.overview.totalCustomers || 0),
              dispositions: Array.isArray(json.overview.dispositions) ? json.overview.dispositions : [],
              cities: Array.isArray(json.overview.cities) ? json.overview.cities : [],
            }
          : null
      );
      if (json?.audits && typeof json.audits === 'object') {
        setAuditByCallId((prev) => ({ ...prev, ...(json.audits as Record<string, SarvCallAudit | null>) }));
      }
    } catch (e: any) {
      setReportError(e?.message || 'Failed to load calls');
      setReportCalls([]);
      setReportTotal(0);
      setReportOverviewAll(null);
    } finally {
      setReportLoading(false);
    }
  };

  const openReportDrilldown = async (type: 'disposition' | 'city', value: string) => {
    setReportDrilldownOpen(true);
    setReportDrilldownLoading(true);
    setReportDrilldownError('');
    setReportDrilldownRows([]);
    setReportDrilldownTitle(`${type === 'disposition' ? 'Disposition' : 'City'}: ${value}`);
    try {
      const params = new URLSearchParams();
      if (reportFilters.from) {
        params.set('from', new Date(`${reportFilters.from}T00:00:00`).toISOString());
      }
      if (reportFilters.to) {
        params.set('to', new Date(`${reportFilters.to}T23:59:59`).toISOString());
      }
      if (reportFilters.assignee_role) {
        params.set('assignee_role', reportFilters.assignee_role);
      }
      if (reportFilters.assignee_id) {
        params.set('assignee_id', reportFilters.assignee_id);
      }
      if (reportFilters.has_recording) {
        params.set('has_recording', 'true');
      }
      if (reportFilters.q.trim()) {
        params.set('q', reportFilters.q.trim());
      }
      params.set('all_rows', 'true');
      params.set(type, value);

      const res = await fetch(`/api/super_admin/sarv-calls?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load calls');
      let rows = Array.isArray(json?.calls) ? (json.calls as SarvCallRow[]) : [];
      const f = String(reportRatingFilter || '').trim();
      if (f) {
        if (f === 'unrated') {
          rows = rows.filter((c: any) => deriveCallRating(c?.summary) == null);
        } else {
          const n = Number(f);
          if (Number.isFinite(n) && n >= 1 && n <= 5) {
            rows = rows.filter((c: any) => deriveCallRating(c?.summary) === n);
          }
        }
      }
      setReportDrilldownRows(rows);
    } catch (e: any) {
      setReportDrilldownError(e?.message || 'Failed to load calls');
      setReportDrilldownRows([]);
    } finally {
      setReportDrilldownLoading(false);
    }
  };

  const closeReportDrilldown = () => {
    setReportDrilldownOpen(false);
    setReportDrilldownLoading(false);
    setReportDrilldownError('');
    setReportDrilldownTitle('');
    setReportDrilldownRows([]);
  };

  const openSummary = (call: SarvCallRow) => {
    setSummaryCall(call);
    setSummaryOpen(true);
    setRegenLoading(false);
    setRegenError('');
    setTranscriptionView('raw');
    setSwapSpeakers(false);
  };

  const closeSummary = () => {
    setSummaryOpen(false);
    setSummaryCall(null);
    setRegenLoading(false);
    setRegenError('');
    setTranscriptionView('raw');
    setSwapSpeakers(false);
  };

  const openAudit = async (call: SarvCallRow) => {
    setAuditCall(call);
    setAuditOpen(true);
    setAuditError('');

    const cached = call?.id ? auditByCallId[call.id] : null;
    setAuditForm({
      audit_status: String(cached?.audit_status || '').trim(),
      audit_score: cached?.audit_score != null ? String(cached.audit_score) : '',
      feedback: String(cached?.feedback || '').trim(),
    });

    if (!call?.id) return;
    const hasCached = Object.prototype.hasOwnProperty.call(auditByCallId, call.id);
    if (hasCached) return;

    setAuditLoading(true);
    try {
      const res = await fetch(`/api/super_admin/sarv-calls/${encodeURIComponent(String(call.id))}/audit`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load audit');
      const audit = (json?.audit || null) as SarvCallAudit | null;
      setAuditByCallId((prev) => ({ ...prev, [call.id]: audit }));
      setAuditForm({
        audit_status: String(audit?.audit_status || '').trim(),
        audit_score: audit?.audit_score != null ? String(audit.audit_score) : '',
        feedback: String(audit?.feedback || '').trim(),
      });
    } catch (e: any) {
      setAuditError(e?.message || 'Failed to load audit');
    } finally {
      setAuditLoading(false);
    }
  };

  const closeAudit = () => {
    setAuditOpen(false);
    setAuditCall(null);
    setAuditLoading(false);
    setAuditSaving(false);
    setAuditError('');
  };

  const saveAudit = async () => {
    if (!auditCall?.id) return;
    setAuditSaving(true);
    setAuditError('');
    try {
      const payload = {
        audit_status: auditForm.audit_status,
        audit_score: auditForm.audit_score || null,
        feedback: auditForm.feedback,
      };
      const res = await fetch(`/api/super_admin/sarv-calls/${encodeURIComponent(String(auditCall.id))}/audit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to save audit');
      const audit = (json?.audit || null) as SarvCallAudit | null;
      setAuditByCallId((prev) => ({ ...prev, [auditCall.id]: audit }));
      closeAudit();
    } catch (e: any) {
      setAuditError(e?.message || 'Failed to save audit');
    } finally {
      setAuditSaving(false);
    }
  };

  const regenerateSummary = async () => {
    if (!summaryCall?.id) return;
    setRegenLoading(true);
    setRegenError('');
    try {
      const res = await fetch(`/api/sarv-calls/${encodeURIComponent(String(summaryCall.id))}/regenerate-ai`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.details || 'Failed to regenerate');

      const nextSummary = json?.summary != null ? String(json.summary) : null;
      const nextTranscription = json?.transcription != null ? String(json.transcription) : null;

      setSummaryCall((prev) =>
        prev
          ? {
              ...prev,
              summary: nextSummary,
              transcription: nextTranscription,
            }
          : prev
      );

      // Keep list in sync if the modal was opened from report list.
      setReportCalls((prev) =>
        Array.isArray(prev)
          ? prev.map((c: any) =>
              c?.id === summaryCall.id
                ? { ...c, summary: nextSummary, transcription: nextTranscription }
                : c
            )
          : prev
      );
    } catch (e: any) {
      setRegenError(e?.message || 'Failed to regenerate');
    } finally {
      setRegenLoading(false);
    }
  };

  const loadOverview = async () => {
    setOverviewLoading(true);
    setOverviewError('');
    try {
      const params = new URLSearchParams();
      if (overviewFilters.from) {
        const iso = toISTBoundaryISO(overviewFilters.from, 'start');
        if (iso) params.set('from', iso);
      }
      if (overviewFilters.to) {
        const iso = toISTBoundaryISO(overviewFilters.to, 'end');
        if (iso) params.set('to', iso);
      }
      if (overviewFilters.status) {
        params.set('status', overviewFilters.status);
      }
      const res = await fetch(`/api/super_admin/rsa-overview?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load overview');
      setOverviewData(json || null);
      setOverviewStatusOptions(Array.isArray(json?.status_options) ? json.status_options : []);
    } catch (e: any) {
      setOverviewError(e?.message || 'Failed to load overview');
      setOverviewData(null);
      setOverviewStatusOptions([]);
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadOverviewTrends = async () => {
    setTrendLoading(true);
    setTrendError('');
    try {
      const params = new URLSearchParams();
      if (overviewFilters.from) {
        const iso = toISTBoundaryISO(overviewFilters.from, 'start');
        if (iso) params.set('from', iso);
      }
      if (overviewFilters.to) {
        const iso = toISTBoundaryISO(overviewFilters.to, 'end');
        if (iso) params.set('to', iso);
      }
      if (overviewFilters.status) {
        params.set('status', overviewFilters.status);
      }
      const res = await fetch(`/api/super_admin/rsa-overview/trends?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load trends');
      setTrendGranularity(json?.granularity === 'hour' ? 'hour' : 'day');
      setTrendPoints(Array.isArray(json?.points) ? json.points : []);
    } catch (e: any) {
      setTrendError(e?.message || 'Failed to load trends');
      setTrendPoints([]);
    } finally {
      setTrendLoading(false);
    }
  };

  const loadEmployeeReport = async () => {
    setEmployeeReportLoading(true);
    setEmployeeReportError('');
    try {
      const params = new URLSearchParams();
      if (overviewFilters.from) {
        const iso = toISTBoundaryISO(overviewFilters.from, 'start');
        if (iso) params.set('from', iso);
      }
      if (overviewFilters.to) {
        const iso = toISTBoundaryISO(overviewFilters.to, 'end');
        if (iso) params.set('to', iso);
      }
      if (overviewFilters.status) {
        params.set('status', overviewFilters.status);
      }
      const res = await fetch(`/api/super_admin/rsa-overview/employee-report?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load employee report');
      setEmployeeReportRows(Array.isArray(json?.rows) ? json.rows : []);
    } catch (e: any) {
      setEmployeeReportError(e?.message || 'Failed to load employee report');
      setEmployeeReportRows([]);
    } finally {
      setEmployeeReportLoading(false);
    }
  };

  const loadOverviewLeads = async (selection: OverviewSelection) => {
    setOverviewSelection(selection);
    setOverviewLeadsLoading(true);
    setOverviewLeadsError('');
    try {
      const params = new URLSearchParams();
      if (overviewFilters.from) {
        const iso = toISTBoundaryISO(overviewFilters.from, 'start');
        if (iso) params.set('from', iso);
      }
      if (overviewFilters.to) {
        const iso = toISTBoundaryISO(overviewFilters.to, 'end');
        if (iso) params.set('to', iso);
      }
      if (overviewFilters.status) {
        params.set('status', overviewFilters.status);
      }
      params.set('type', selection.type);
      params.set('value', selection.value);
      const res = await fetch(`/api/super_admin/rsa-overview/leads?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load customers');
      setOverviewLeads(Array.isArray(json?.leads) ? json.leads : []);
    } catch (e: any) {
      setOverviewLeadsError(e?.message || 'Failed to load customers');
      setOverviewLeads([]);
    } finally {
      setOverviewLeadsLoading(false);
    }
  };

  const setOverviewFinanceField = (
    leadId: string,
    field: 'customer_quoted_amount' | 'advance_payment' | 'payment_to_mechanic',
    value: string
  ) => {
    setOverviewFinanceDrafts((prev) => ({
      ...prev,
      [leadId]: {
        customer_quoted_amount: prev[leadId]?.customer_quoted_amount ?? '',
        advance_payment: prev[leadId]?.advance_payment ?? '',
        payment_to_mechanic: prev[leadId]?.payment_to_mechanic ?? '',
        saving: prev[leadId]?.saving ?? false,
        error: '',
        [field]: value,
      },
    }));
  };

  const saveOverviewLeadFinance = async (leadId: string) => {
    const draft = overviewFinanceDrafts[leadId];
    if (!draft) return;

    const quoted = toNullableNumberFromInput(draft.customer_quoted_amount);
    const mechanic = toNullableNumberFromInput(draft.payment_to_mechanic);
    const advanceRaw = String(draft.advance_payment || '').trim();
    const advance = advanceRaw ? advanceRaw : null;

    if (Number.isNaN(quoted) || Number.isNaN(mechanic)) {
      setOverviewFinanceDrafts((prev) => ({
        ...prev,
        [leadId]: {
          ...prev[leadId],
          saving: false,
          error: 'Quoted/Mechanic amount invalid.',
        },
      }));
      return;
    }

    setOverviewFinanceDrafts((prev) => ({
      ...prev,
      [leadId]: { ...prev[leadId], saving: true, error: '' },
    }));

    try {
      const res = await fetch(`/api/super_admin/rsa-overview/leads/${encodeURIComponent(leadId)}/finance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_quoted_amount: quoted,
          advance_payment: advance,
          payment_to_mechanic: mechanic,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to update finance values');

      const updated = (json?.lead || {}) as Partial<OverviewLeadRow>;
      setOverviewLeads((prev) =>
        Array.isArray(prev)
          ? prev.map((lead) =>
              lead.id === leadId
                ? {
                    ...lead,
                    customer_quoted_amount: (updated as any).customer_quoted_amount ?? null,
                    advance_payment: (updated as any).advance_payment ?? null,
                    payment_to_mechanic: (updated as any).payment_to_mechanic ?? null,
                  }
                : lead
            )
          : prev
      );

      setOverviewFinanceDrafts((prev) => ({
        ...prev,
        [leadId]: {
          customer_quoted_amount: normalizeAmountInput((updated as any).customer_quoted_amount),
          advance_payment: normalizeAmountInput((updated as any).advance_payment),
          payment_to_mechanic: normalizeAmountInput((updated as any).payment_to_mechanic),
          saving: false,
          error: '',
        },
      }));
    } catch (e: any) {
      setOverviewFinanceDrafts((prev) => ({
        ...prev,
        [leadId]: {
          ...prev[leadId],
          saving: false,
          error: e?.message || 'Failed to save',
        },
      }));
    }
  };

  const exportOverviewCSV = async () => {
    setOverviewExportLoading(true);
    setOverviewError('');
    try {
      const params = new URLSearchParams();
      if (overviewFilters.from) {
        const iso = toISTBoundaryISO(overviewFilters.from, 'start');
        if (iso) params.set('from', iso);
      }
      if (overviewFilters.to) {
        const iso = toISTBoundaryISO(overviewFilters.to, 'end');
        if (iso) params.set('to', iso);
      }
      if (overviewFilters.status) {
        params.set('status', overviewFilters.status);
      }

      const res = await fetch(`/api/super_admin/rsa-overview/export?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Failed to export CSV');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rsa-overview-customers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setOverviewError(e?.message || 'Failed to export CSV');
    } finally {
      setOverviewExportLoading(false);
    }
  };

  const reconcileStalePayments = async () => {
    setReconcileLoading(true);
    setReconcileMessage('');
    setOverviewError('');
    try {
      const res = await fetch('/api/super_admin/rsa-overview/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30, limit: 1000 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to reconcile stale payments');
      setReconcileMessage(
        `Reconcile done. Scanned: ${json?.scanned ?? 0}, Updated: ${json?.updated ?? 0}, No capture: ${json?.no_capture ?? 0}, Failed: ${json?.failed ?? 0}`
      );
      await loadOverview();
    } catch (e: any) {
      setOverviewError(e?.message || 'Failed to reconcile stale payments');
    } finally {
      setReconcileLoading(false);
    }
  };

  const openMechanicCoverage = async () => {
    setMechCoverageOpen(true);
    setMechCoverageTab('state');
    setMechCoverageFilterState('');
    setMechCoverageLoading(true);
    setMechCoverageError('');
    try {
      const res = await fetch('/api/super_admin/mechanics/coverage');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load mechanic coverage');
      setMechCoverage(json || null);
    } catch (e: any) {
      setMechCoverageError(e?.message || 'Failed to load mechanic coverage');
      setMechCoverage(null);
    } finally {
      setMechCoverageLoading(false);
    }
  };

  const openMechanicsList = async (params: { state: string; district?: string }) => {
    setMechListOpen(true);
    setMechListLoading(true);
    setMechListError('');
    setMechList([]);
    const title = params.district ? `${params.district}, ${params.state}` : params.state;
    setMechListTitle(title);
    try {
      const qs = new URLSearchParams();
      qs.set('state', params.state);
      if (params.district) qs.set('district', params.district);
      const res = await fetch(`/api/super_admin/mechanics/coverage/mechanics?${qs.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load mechanics');
      setMechList(Array.isArray(json?.mechanics) ? json.mechanics : []);
    } catch (e: any) {
      setMechListError(e?.message || 'Failed to load mechanics');
      setMechList([]);
    } finally {
      setMechListLoading(false);
    }
  };

  useEffect(() => {
    loadMappings();
    loadAssignees(form.assignee_role);
  }, []);

  useEffect(() => {
    if (tab !== 'report') return;
    if (reportFilters.assignee_role) {
      loadReportAssignees(reportFilters.assignee_role);
    } else {
      setReportAssignees([]);
    }
    loadReport();
  }, [tab, reportFilters, reportPage]);

  useEffect(() => {
    setReportJumpPage(String(reportPage));
  }, [reportPage]);

  useEffect(() => {
    if (tab === 'catalog') loadCatalog();
  }, [tab]);

  useEffect(() => {
    if (tab === 'sessions') loadSessions();
  }, [tab]);

  useEffect(() => {
    if (tab !== 'overview') return;
    setOverviewSelection(null);
    setOverviewLeads([]);
    loadOverview();
    loadOverviewTrends();
    loadEmployeeReport();
  }, [tab, overviewFilters]);

  useEffect(() => {
    const next: Record<
      string,
      {
        customer_quoted_amount: string;
        advance_payment: string;
        payment_to_mechanic: string;
        saving?: boolean;
        error?: string;
      }
    > = {};
    for (const lead of overviewLeads) {
      next[lead.id] = {
        customer_quoted_amount: normalizeAmountInput((lead as any).customer_quoted_amount),
        advance_payment: normalizeAmountInput((lead as any).advance_payment),
        payment_to_mechanic: normalizeAmountInput((lead as any).payment_to_mechanic),
        saving: false,
        error: '',
      };
    }
    setOverviewFinanceDrafts(next);
  }, [overviewLeads]);

  const stateRows = useMemo(() => overviewData?.breakdowns.state || [], [overviewData]);
  const reportTotalPages = Math.max(
    1,
    Math.ceil(reportTotal / Math.max(1, Number(reportFilters.limit) || 1))
  );
  const canGoNextReportPage = !reportLoading && reportPage < reportTotalPages;
  const canGoPrevReportPage = !reportLoading && reportPage > 1;

  const jumpToReportPage = () => {
    const requested = Number(reportJumpPage);
    if (!Number.isFinite(requested)) return;
    const nextPage = Math.min(reportTotalPages, Math.max(1, Math.trunc(requested)));
    setReportPage(nextPage);
  };

  const activeStateRow = useMemo(() => {
    if (!activeStateId || activeStateId === '__ALL__') return null;
    return stateRows.find((r) => r.key === activeStateId) || null;
  }, [stateRows, activeStateId]);

  const activeStateCenter = useMemo(() => {
    const row = activeStateRow;
    if (!row) return INDIA_CENTER;
    const centroid = getStateCentroid(row?.name);
    return centroid || INDIA_CENTER;
  }, [activeStateRow]);

  const googleMapsKey =
    (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();

  const allStatePoints = useMemo(() => {
    const pts: GoogleStateHeatmapPoint[] = [];
    for (const row of stateRows) {
      const centroid = getStateCentroid(row?.name);
      if (!centroid) continue;
      pts.push({
        id: row.key,
        name: row.name,
        lat: centroid.lat,
        lng: centroid.lng,
        total: row.total,
        resolved: row.resolved,
        company_profit: row.company_profit,
      });
    }
    return pts;
  }, [stateRows]);

  const allStateLeafletPoints = useMemo(() => {
    const pts: LeafletStatePoint[] = [];
    for (const row of stateRows) {
      const centroid = getStateCentroid(row?.name);
      if (!centroid) continue;
      pts.push({
        id: row.key,
        name: row.name,
        lat: centroid.lat,
        lng: centroid.lng,
        total: row.total,
        resolved: row.resolved,
        company_profit: row.company_profit,
      });
    }
    return pts;
  }, [stateRows]);

  useEffect(() => {
    if (tab !== 'overview') return;
    if (stateRows.length === 0) {
      if (activeStateId) setActiveStateId('');
      return;
    }
    if (!activeStateId) {
      setActiveStateId('__ALL__');
      return;
    }
    const stillExists = activeStateId && stateRows.some((m) => m.key === activeStateId);
    if (stillExists) return;
    setActiveStateId('__ALL__');
  }, [tab, stateRows, activeStateId]);

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setMappingError('');
    const payload = {
      aansh_id: Number(form.aansh_id),
      assignee_role: form.assignee_role,
      assignee_id: form.assignee_id,
      effective_from: form.effective_from
        ? new Date(form.effective_from).toISOString()
        : new Date('1970-01-01T00:00:00Z').toISOString(),
      effective_to: form.effective_to ? new Date(form.effective_to).toISOString() : null,
      day_of_week: form.day_of_week,
      time_from: form.time_from || null,
      time_to: form.time_to || null,
    };

    try {
      const res = await fetch(
        form.id ? `/api/super_admin/sarv-aansh-mappings/${form.id}` : '/api/super_admin/sarv-aansh-mappings',
        {
          method: form.id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      resetForm();
      loadMappings();
    } catch (e: any) {
      setMappingError(e?.message || 'Save failed');
    }
  };

  const editRow = (row: MappingRow) => {
    const assigneeRole = row.assignee_role || (row.telecaller_id ? 'TELECALLER' : 'RSA_MANAGER');
    setForm({
      id: row.id,
      aansh_id: String(row.aansh_id),
      assignee_role: assigneeRole,
      assignee_id: row.assignee_id || row.telecaller_id || '',
      effective_from: row.effective_from ? String(row.effective_from).slice(0, 16) : '',
      effective_to: row.effective_to ? String(row.effective_to).slice(0, 16) : '',
      day_of_week: Array.isArray(row.day_of_week) ? row.day_of_week : [],
      time_from: row.time_from ? String(row.time_from).slice(0, 5) : '',
      time_to: row.time_to ? String(row.time_to).slice(0, 5) : '',
    });
    loadAssignees(assigneeRole);
  };

  const deleteRow = async (row: MappingRow) => {
    if (!confirm('Delete this mapping?')) return;
    setMappingError('');
    try {
      const res = await fetch(`/api/super_admin/sarv-aansh-mappings/${row.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Delete failed');
      loadMappings();
    } catch (e: any) {
      setMappingError(e?.message || 'Delete failed');
    }
  };

  const runBackfill = async () => {
    if (!confirm('Run backfill for unmapped SARV calls?')) return;
    setBackfillLoading(true);
    setMappingError('');
    try {
      const res = await fetch('/api/super_admin/sarv-aansh-mappings/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 500 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Backfill failed');
      await loadMappings();
    } catch (e: any) {
      setMappingError(e?.message || 'Backfill failed');
    } finally {
      setBackfillLoading(false);
    }
  };

  const paymentMetricRows = useMemo(() => {
    const rows = Array.isArray(overviewData?.payment_rows) ? overviewData.payment_rows : [];
    if (!activePaymentMetric) return [];
    if (activePaymentMetric === 'links') return rows;
    if (activePaymentMetric === 'captured') return rows.filter((r) => Number(r.captured_amount || 0) > 0);
    return rows.filter((r) => Number(r.refunded_amount || 0) > 0);
  }, [overviewData, activePaymentMetric]);

  useEffect(() => {
    setPaymentStatusFilter('');
    setPaymentRoleFilter('');
    setPaymentEmployeeFilter('');
    setPaymentSearch('');
  }, [activePaymentMetric]);

  const paymentStatusOptions = useMemo(() => {
    return Array.from(new Set(paymentMetricRows.map((r) => String(r.status || '').trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [paymentMetricRows]);

  const paymentRoleOptions = useMemo(() => {
    return Array.from(new Set(paymentMetricRows.map((r) => String(r.employee_role || '').trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [paymentMetricRows]);

  const paymentEmployeeOptions = useMemo(() => {
    return Array.from(new Set(paymentMetricRows.map((r) => String(r.employee_name || '').trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [paymentMetricRows]);

  const filteredPaymentMetricRows = useMemo(() => {
    const q = paymentSearch.trim().toLowerCase();
    return paymentMetricRows.filter((row) => {
      const statusOk = !paymentStatusFilter || String(row.status || '').trim() === paymentStatusFilter;
      const roleOk = !paymentRoleFilter || String(row.employee_role || '').trim() === paymentRoleFilter;
      const employeeOk = !paymentEmployeeFilter || String(row.employee_name || '').trim() === paymentEmployeeFilter;
      const text = [
        row.order_id,
        row.payment_id,
        row.customer_name,
        row.customer_phone,
        row.employee_name,
        row.employee_role,
      ]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
      const searchOk = !q || text.includes(q);
      return statusOk && roleOk && employeeOk && searchOk;
    });
  }, [paymentMetricRows, paymentStatusFilter, paymentRoleFilter, paymentEmployeeFilter, paymentSearch]);

  const paymentMetricTitle =
    activePaymentMetric === 'links'
      ? 'Total Link Generate'
      : activePaymentMetric === 'captured'
        ? 'Total Capture Payment'
        : activePaymentMetric === 'refund'
          ? 'Total Refund'
          : '';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">RSA</h1>
        <p className="text-sm text-gray-600 mt-1">Manage SARV telecaller mapping for RSA calls.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={tab === 'overview' ? 'btn btn-primary text-sm' : 'btn btn-outline text-sm'}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={tab === 'report' ? 'btn btn-primary text-sm' : 'btn btn-outline text-sm'}
          onClick={() => setTab('report')}
        >
          Call Report
        </button>
        <button
          type="button"
          className={tab === 'mapping' ? 'btn btn-primary text-sm' : 'btn btn-outline text-sm'}
          onClick={() => setTab('mapping')}
        >
          Manage Mapping
        </button>
        <button
          type="button"
          className={tab === 'catalog' ? 'btn btn-primary text-sm' : 'btn btn-outline text-sm'}
          onClick={() => setTab('catalog')}
        >
          Aansh Catalog
        </button>
        <button
          type="button"
          className={tab === 'sessions' ? 'btn btn-primary text-sm' : 'btn btn-outline text-sm'}
          onClick={() => setTab('sessions')}
        >
          Active Sessions
        </button>
      </div>

      {tab === 'mapping' ? (
        <div className="space-y-6">
          {mappingError ? <div className="text-sm text-red-600">{mappingError}</div> : null}

          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Manage Mapping</h2>
            <form onSubmit={submitForm} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">Aansh ID</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  type="number"
                  value={form.aansh_id}
                  onChange={(e) => setForm((f) => ({ ...f, aansh_id: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Role</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.assignee_role}
                  onChange={(e) => {
                    const role = e.target.value;
                    setForm((f) => ({ ...f, assignee_role: role, assignee_id: '' }));
                    loadAssignees(role);
                  }}
                  required
                >
                  <option value="TELECALLER">Telecaller</option>
                  <option value="RSA_MANAGER">RSA Manager</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Assignee</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.assignee_id}
                  onChange={(e) => setForm((f) => ({ ...f, assignee_id: e.target.value }))}
                  required
                >
                  <option value="">Select user</option>
                  {telecallerOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name || t.email || t.phone || t.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Days of Week (optional)</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1 text-sm">
                  {[
                    { id: 0, label: 'Sun' },
                    { id: 1, label: 'Mon' },
                    { id: 2, label: 'Tue' },
                    { id: 3, label: 'Wed' },
                    { id: 4, label: 'Thu' },
                    { id: 5, label: 'Fri' },
                    { id: 6, label: 'Sat' },
                  ].map((d) => (
                    <label key={d.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.day_of_week.includes(d.id)}
                        onChange={(e) => {
                          setForm((f) => {
                            const next = new Set(f.day_of_week);
                            if (e.target.checked) next.add(d.id);
                            else next.delete(d.id);
                            return { ...f, day_of_week: Array.from(next).sort() };
                          });
                        }}
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600">Time From (optional)</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  type="time"
                  value={form.time_from}
                  onChange={(e) => setForm((f) => ({ ...f, time_from: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Time To (optional)</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  type="time"
                  value={form.time_to}
                  onChange={(e) => setForm((f) => ({ ...f, time_to: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <button type="submit" className="btn btn-primary text-sm px-4 py-2">
                  {form.id ? 'Update Mapping' : 'Add Mapping'}
                </button>
                {form.id ? (
                  <button
                    type="button"
                    className="btn btn-outline text-sm px-4 py-2"
                    onClick={resetForm}
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Mappings</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="btn btn-outline text-xs px-3 py-1.5"
                  onClick={runBackfill}
                  disabled={backfillLoading}
                >
                  {backfillLoading ? 'Running Backfill...' : 'Run Backfill'}
                </button>
                <div className="text-xs text-gray-500">{loading ? 'Loading...' : `${mappings.length} rows`}</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3">Aansh ID</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Assignee</th>
                    <th className="py-2 pr-3">Days</th>
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.length === 0 ? (
                    <tr>
                      <td className="py-3 text-gray-500" colSpan={6}>
                        No mappings found.
                      </td>
                    </tr>
                  ) : (
                    mappings.map((row) => (
                      <tr key={row.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-3 font-semibold">{row.aansh_id}</td>
                        <td className="py-2 pr-3">{row.assignee_role || 'TELECALLER'}</td>
                        <td className="py-2 pr-3">
                          {row.assignee_name || row.assignee_email || row.assignee_phone || row.assignee_id || row.telecaller_id}
                        </td>
                        <td className="py-2 pr-3">
                          {formatDays(row.day_of_week)}
                        </td>
                        <td className="py-2 pr-3">
                          {formatTimeRange(row.time_from, row.time_to)}
                        </td>
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-700 font-semibold mr-3"
                            onClick={() => editRow(row)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-red-600 hover:text-red-700 font-semibold"
                            onClick={() => deleteRow(row)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'catalog' ? (
        <div className="space-y-6">
          {catalogError ? <div className="text-sm text-red-600">{catalogError}</div> : null}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Aansh Catalog</h2>
            <p className="text-xs text-gray-500 mb-3">Available Aansh IDs for session-based assignment. Telecallers/RSA managers claim from this list when they log in.</p>
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div>
                <label className="text-xs text-gray-600 block mb-1">New Aansh ID</label>
                <input
                  className="w-32 border rounded-md px-3 py-2 text-sm"
                  type="number"
                  min={0}
                  value={catalogNewId}
                  onChange={(e) => setCatalogNewId(e.target.value)}
                  placeholder="e.g. 123"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">System name</label>
                <input
                  className="w-48 border rounded-md px-3 py-2 text-sm"
                  type="text"
                  value={catalogNewName}
                  onChange={(e) => setCatalogNewName(e.target.value)}
                  placeholder="e.g. Line 1"
                />
              </div>
              <button
                type="button"
                className="btn btn-primary text-sm px-4 py-2"
                disabled={catalogSaving || !catalogNewId.trim()}
                onClick={async () => {
                  const id = catalogNewId.trim();
                  if (!id) return;
                  setCatalogSaving(true);
                  setCatalogError('');
                  try {
                    const res = await fetch('/api/super_admin/sarv-aansh-catalog', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        aansh_id: Number(id),
                        system_name: catalogNewName.trim() || null,
                      }),
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(json?.error || 'Add failed');
                    setCatalogNewId('');
                    setCatalogNewName('');
                    await loadCatalog();
                  } catch (e: any) {
                    setCatalogError(e?.message || 'Add failed');
                  } finally {
                    setCatalogSaving(false);
                  }
                }}
              >
                {catalogSaving ? 'Adding...' : 'Add'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3">Aansh ID</th>
                    <th className="py-2 pr-3">System name</th>
                    <th className="py-2 pr-3">Active</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogLoading ? (
                    <tr><td className="py-3 text-gray-500" colSpan={4}>Loading...</td></tr>
                  ) : catalogItems.length === 0 ? (
                    <tr><td className="py-3 text-gray-500" colSpan={4}>No catalog entries.</td></tr>
                  ) : (
                    catalogItems.map((row) => (
                      <tr key={row.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-3 font-semibold">{row.aansh_id}</td>
                        <td className="py-2 pr-3">
                          <input
                            className="w-full max-w-[180px] border rounded px-2 py-1 text-sm"
                            type="text"
                            defaultValue={row.system_name ?? ''}
                            placeholder="System name"
                            onBlur={async (e) => {
                              const v = e.target.value.trim();
                              if (v === (row.system_name ?? '')) return;
                              try {
                                const res = await fetch(`/api/super_admin/sarv-aansh-catalog/${row.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ system_name: v || null }),
                                });
                                if (!res.ok) throw new Error('Update failed');
                                await loadCatalog();
                              } catch {
                                setCatalogError('Update failed');
                              }
                            }}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            className={`text-sm px-2 py-1 rounded ${row.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/super_admin/sarv-aansh-catalog/${row.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ is_active: !row.is_active }),
                                });
                                if (!res.ok) throw new Error('Update failed');
                                await loadCatalog();
                              } catch {
                                setCatalogError('Update failed');
                              }
                            }}
                          >
                            {row.is_active ? 'Yes' : 'No'}
                          </button>
                        </td>
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            className="text-red-600 hover:text-red-700 font-semibold"
                            onClick={async () => {
                              if (!confirm('Remove this Aansh ID from catalog?')) return;
                              try {
                                const res = await fetch(`/api/super_admin/sarv-aansh-catalog/${row.id}`, { method: 'DELETE' });
                                if (!res.ok) throw new Error('Delete failed');
                                await loadCatalog();
                              } catch {
                                setCatalogError('Delete failed');
                              }
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'sessions' ? (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Active Aansh Sessions</h2>
            <p className="text-xs text-gray-500 mb-3">Currently claimed Aansh IDs (released on logout or manual remove by admin).</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3">Aansh ID</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Expires</th>
                    <th className="py-2 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionsLoading ? (
                    <tr><td className="py-3 text-gray-500" colSpan={5}>Loading...</td></tr>
                  ) : sessionsList.length === 0 ? (
                    <tr><td className="py-3 text-gray-500" colSpan={5}>No active sessions.</td></tr>
                  ) : (
                    sessionsList.map((s) => (
                      <tr key={s.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-3 font-semibold">{s.aansh_id}</td>
                        <td className="py-2 pr-3">{s.assignee_role}</td>
                        <td className="py-2 pr-3">{s.user_name || s.user_email || s.user_id}</td>
                        <td className="py-2 pr-3">{formatDateTime(s.expires_at)}</td>
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            className="text-red-600 hover:text-red-700 font-semibold disabled:text-gray-400"
                            onClick={() => removeSession(s.id)}
                            disabled={sessionRemovingId === s.id}
                          >
                            {sessionRemovingId === s.id ? 'Removing...' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <button type="button" className="mt-3 btn btn-outline text-sm" onClick={loadSessions}>Refresh</button>
          </div>
        </div>
      ) : null}

      {tab === 'report' ? (
        <div className="space-y-6">
          {reportError ? <div className="text-sm text-red-600">{reportError}</div> : null}

          <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-600">From</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  type="date"
                  value={reportFilters.from}
                  onChange={(e) => {
                    setReportPage(1);
                    setReportFilters((f) => ({ ...f, from: e.target.value }));
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">To</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  type="date"
                  value={reportFilters.to}
                  onChange={(e) => {
                    setReportPage(1);
                    setReportFilters((f) => ({ ...f, to: e.target.value }));
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Role</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={reportFilters.assignee_role}
                  onChange={(e) => {
                    const role = e.target.value;
                    setReportPage(1);
                    setReportFilters((f) => ({ ...f, assignee_role: role, assignee_id: '' }));
                  }}
                >
                  <option value="">All</option>
                  <option value="TELECALLER">Telecaller</option>
                  <option value="RSA_MANAGER">RSA Manager</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Assignee</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={reportFilters.assignee_id}
                  onChange={(e) => {
                    setReportPage(1);
                    setReportFilters((f) => ({ ...f, assignee_id: e.target.value }));
                  }}
                >
                  <option value="">All</option>
                  {reportAssignees.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name || t.email || t.phone || t.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Search</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  type="text"
                  placeholder="Call ID or customer number"
                  value={reportFilters.q}
                  onChange={(e) => {
                    setReportPage(1);
                    setReportFilters((f) => ({ ...f, q: e.target.value }));
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Call Rating</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={reportRatingFilter}
                  onChange={(e) => setReportRatingFilter(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="5">5</option>
                  <option value="4">4</option>
                  <option value="3">3</option>
                  <option value="2">2</option>
                  <option value="1">1</option>
                  <option value="unrated">Unrated</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={reportFilters.has_recording}
                    onChange={(e) => {
                      setReportPage(1);
                      setReportFilters((f) => ({ ...f, has_recording: e.target.checked }));
                    }}
                  />
                  Has recording
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Overview (Current Filter)</h2>
              <div className="text-xs text-gray-500">
                {activeReportOverview.totalCalls} calls • {activeReportOverview.totalCustomers} customers
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-md border border-gray-200">
                <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-b bg-gray-50">Disposition</div>
                <div className="max-h-56 overflow-y-auto">
                  {activeReportOverview.dispositions.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-500">No disposition data.</div>
                  ) : (
                    activeReportOverview.dispositions.map((row) => (
                      <button
                        key={row.name}
                        type="button"
                        onClick={() => openReportDrilldown('disposition', row.name)}
                        className="w-full px-3 py-2 text-xs border-b last:border-b-0 flex items-center justify-between hover:bg-gray-50 text-left"
                      >
                        <span className="text-gray-700 truncate pr-3">{row.name}</span>
                        <span className="font-semibold text-gray-900">{row.total}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-md border border-gray-200">
                <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-b bg-gray-50">City</div>
                <div className="max-h-56 overflow-y-auto">
                  {activeReportOverview.cities.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-500">No city data.</div>
                  ) : (
                    activeReportOverview.cities.map((row) => (
                      <button
                        key={row.name}
                        type="button"
                        onClick={() => openReportDrilldown('city', row.name)}
                        className="w-full px-3 py-2 text-xs border-b last:border-b-0 flex items-center justify-between hover:bg-gray-50 text-left"
                      >
                        <span className="text-gray-700 truncate pr-3">{row.name}</span>
                        <span className="font-semibold text-gray-900">{row.total}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Call Report</h2>
              <div className="text-xs text-gray-500">
                {reportLoading
                  ? 'Loading...'
                  : reportRatingFilter
                    ? `${groupedReportCalls.length} customers, ${filteredReportCalls.length} calls (filtered)`
                    : `${groupedReportCalls.length} customers, ${reportCalls.length} calls`}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3">Call Time</th>
                    <th className="py-2 pr-3">Employee</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">Talk</th>
                    <th className="py-2 pr-3">Disposition</th>
                    <th className="py-2 pr-3">Summary</th>
                    <th className="py-2 pr-3">Recording</th>
                    <th className="py-2 pr-3">Audit</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedReportCalls.length === 0 ? (
                    <tr>
                      <td className="py-3 text-gray-500" colSpan={9}>
                        No calls found.
                      </td>
                    </tr>
                  ) : (
                    groupedReportCalls.map((group) => {
                      const isOpen = expandedCustomers[group.customer] ?? false;
                      const latest = group.calls[0];
                      if (group.calls.length === 1) {
                        const row = latest;
                        const audit = auditByCallId[row.id] ?? null;
                        return (
                          <tr key={row.id} className="border-b last:border-b-0 align-top">
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {formatDateTime(row.custanswerstime || row.sarv_created_at || row.created_at)}
                            </td>
                            <td className="py-2 pr-3">
                              {row.assignee_name ||
                                row.assignee_email ||
                                row.assignee_phone ||
                                row.assigned_user_id ||
                                '—'}
                            </td>
                            <td className="py-2 pr-3">{row.assigned_role || '—'}</td>
                            <td className="py-2 pr-3">{row.cnumber || '—'}</td>
                            <td className="py-2 pr-3">{formatDuration(row.talkduration)}</td>
                            <td className="py-2 pr-3">{row.disposition || row.disposition_category || '—'}</td>
                            <td className="py-2 pr-3">
                              {row.summary ? (
                                <button
                                  type="button"
                                  className="text-blue-600 hover:text-blue-700 font-semibold"
                                  onClick={() => {
                                    closeReportDrilldown();
                                    openSummary(row);
                                  }}
                                >
                                  View Summary
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              {row.recording_url ? (
                                <div className="flex flex-col gap-2">
                                  <a
                                    className="text-blue-600 hover:text-blue-700 text-xs font-semibold"
                                    href={row.recording_url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Download
                                  </a>
                                  <audio controls preload="none" src={row.recording_url} className="w-80 min-w-[20rem] max-w-full h-10" />
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              <div className="flex flex-col gap-1">
                                <div className="text-[10px] text-gray-600">
                                  {audit?.audit_status ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5">
                                      <span className="font-semibold text-emerald-700">{audit.audit_status}</span>
                                      {audit.audit_score != null ? (
                                        <span className="text-emerald-700">({audit.audit_score}/5)</span>
                                      ) : null}
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className="text-emerald-700 hover:text-emerald-800 font-semibold"
                                  onClick={() => openAudit(row)}
                                >
                                  Audit
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <Fragment key={group.customer}>
                          <tr className="border-b bg-gray-50">
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {formatDateTime(latest.custanswerstime || latest.sarv_created_at || latest.created_at)}
                            </td>
                            <td className="py-2 pr-3">
                              {latest.assignee_name ||
                                latest.assignee_email ||
                                latest.assignee_phone ||
                                latest.assigned_user_id ||
                                '—'}
                            </td>
                            <td className="py-2 pr-3">{latest.assigned_role || '—'}</td>
                            <td className="py-2 pr-3 font-semibold">
                              <button
                                type="button"
                                className="text-left"
                                onClick={() =>
                                  setExpandedCustomers((prev) => ({
                                    ...prev,
                                    [group.customer]: !isOpen,
                                  }))
                                }
                              >
                                {group.customer} • {group.calls.length} calls
                              </button>
                            </td>
                            <td className="py-2 pr-3">{formatDuration(latest.talkduration)}</td>
                            <td className="py-2 pr-3">
                              {latest.disposition || latest.disposition_category || '—'}
                            </td>
                            <td className="py-2 pr-3">
                              {latest.summary ? (
                                <button
                                  type="button"
                                  className="text-blue-600 hover:text-blue-700 font-semibold"
                                  onClick={() => openSummary(latest)}
                                >
                                  View Summary
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              <button
                                type="button"
                                className="text-blue-600 hover:text-blue-700 font-semibold"
                                onClick={() =>
                                  setExpandedCustomers((prev) => ({
                                    ...prev,
                                    [group.customer]: !isOpen,
                                  }))
                                }
                              >
                                {isOpen ? 'Hide' : 'View'}
                              </button>
                            </td>
                            <td className="py-2 pr-3"> </td>
                          </tr>
                          {isOpen
                            ? group.calls.map((row) => (
                                (() => {
                                  const audit = auditByCallId[row.id] ?? null;
                                  return (
                                <tr key={row.id} className="border-b last:border-b-0 align-top">
                                  <td className="py-2 pr-3 whitespace-nowrap">
                                    {formatDateTime(row.custanswerstime || row.sarv_created_at || row.created_at)}
                                  </td>
                                  <td className="py-2 pr-3">
                                    {row.assignee_name ||
                                      row.assignee_email ||
                                      row.assignee_phone ||
                                      row.assigned_user_id ||
                                      '—'}
                                  </td>
                                  <td className="py-2 pr-3">{row.assigned_role || '—'}</td>
                                  <td className="py-2 pr-3">{row.cnumber || '—'}</td>
                                  <td className="py-2 pr-3">{formatDuration(row.talkduration)}</td>
                                  <td className="py-2 pr-3">
                                    {row.disposition || row.disposition_category || '—'}
                                  </td>
                                  <td className="py-2 pr-3">
                                    {row.summary ? (
                                      <button
                                        type="button"
                                        className="text-blue-600 hover:text-blue-700 font-semibold"
                                        onClick={() => openSummary(row)}
                                      >
                                        View Summary
                                      </button>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td className="py-2 pr-3">
                                    {row.recording_url ? (
                                      <div className="flex flex-col gap-2">
                                        <a
                                          className="text-blue-600 hover:text-blue-700 text-xs font-semibold"
                                          href={row.recording_url}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          Download
                                        </a>
                                        <audio controls preload="none" src={row.recording_url} className="w-80 min-w-[20rem] max-w-full h-10" />
                                      </div>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td className="py-2 pr-3">
                                    <div className="flex flex-col gap-1">
                                      <div className="text-[10px] text-gray-600">
                                        {audit?.audit_status ? (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5">
                                            <span className="font-semibold text-emerald-700">{audit.audit_status}</span>
                                            {audit.audit_score != null ? (
                                              <span className="text-emerald-700">({audit.audit_score}/5)</span>
                                            ) : null}
                                          </span>
                                        ) : (
                                          '—'
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        className="text-emerald-700 hover:text-emerald-800 font-semibold"
                                        onClick={() => openAudit(row)}
                                      >
                                        Audit
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                  );
                                })()
                              ))
                            : null}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-outline text-xs px-3 py-1.5"
                onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                disabled={!canGoPrevReportPage}
              >
                Prev
              </button>
              <div className="text-xs text-gray-500 whitespace-nowrap">
                Page {reportPage} of {reportTotalPages}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={reportTotalPages}
                  value={reportJumpPage}
                  onChange={(e) => setReportJumpPage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') jumpToReportPage();
                  }}
                  className="w-16 border rounded-md px-2 py-1 text-xs"
                  disabled={reportLoading}
                  title={`Enter page number (1-${reportTotalPages})`}
                />
                <button
                  type="button"
                  className="btn btn-outline text-xs px-2 py-1.5"
                  onClick={jumpToReportPage}
                  disabled={reportLoading}
                >
                  Go
                </button>
              </div>
              <button
                type="button"
                className="btn btn-outline text-xs px-3 py-1.5"
                onClick={() => setReportPage((p) => p + 1)}
                disabled={!canGoNextReportPage}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'overview' ? (
        <div className="space-y-6">
          {overviewError ? <div className="text-sm text-red-600">{overviewError}</div> : null}
          {trendError ? <div className="text-sm text-red-600">{trendError}</div> : null}
          {reconcileMessage ? <div className="text-sm text-green-700">{reconcileMessage}</div> : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn btn-outline text-xs px-3 py-1.5"
              onClick={reconcileStalePayments}
              disabled={overviewLoading || reconcileLoading}
              title="Sync stale LINK_GENERATED/CREATED payments from Razorpay"
            >
              {reconcileLoading ? 'Reconciling...' : 'Reconcile stale payments'}
            </button>
            <button
              type="button"
              className="btn btn-outline text-xs px-3 py-1.5"
              onClick={exportOverviewCSV}
              disabled={overviewLoading || overviewExportLoading}
              title="Export filtered customers CSV"
            >
              {overviewExportLoading ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              type="button"
              className="btn btn-outline text-xs px-3 py-1.5"
              onClick={() => setShowProfit((v) => !v)}
              disabled={overviewLoading}
              title="Toggle profit visibility"
            >
              {showProfit ? 'Hide Profit' : 'Show Profit'}
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-600">From (Date & Time)</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  type="datetime-local"
                  step={60}
                  value={overviewFilters.from}
                  onChange={(e) => setOverviewFilters((f) => ({ ...f, from: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">To (Date & Time)</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  type="datetime-local"
                  step={60}
                  value={overviewFilters.to}
                  onChange={(e) => setOverviewFilters((f) => ({ ...f, to: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Status</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={overviewFilters.status}
                  onChange={(e) => setOverviewFilters((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="">All Status</option>
                  {overviewStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              type="button"
              className="bg-white rounded-lg shadow-sm p-4 text-left hover:shadow-md transition disabled:opacity-70"
              onClick={() => loadOverviewLeads({ type: 'all', value: 'all', label: 'All' })}
              disabled={overviewLoading}
              title="Open customers list for total requests"
            >
              <div className="text-xs text-gray-500">Total Requests</div>
              <div className="text-2xl font-bold">
                {overviewLoading ? '—' : overviewData?.kpis.total_requests ?? 0}
              </div>
              <div className="text-[11px] text-blue-600 font-semibold mt-1">Open customers</div>
            </button>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-xs text-gray-500">Resolved</div>
              <div className="text-2xl font-bold text-green-600">
                {overviewLoading ? '—' : overviewData?.kpis.resolved ?? 0}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-xs text-gray-500">Pending</div>
              <div className="text-2xl font-bold text-orange-500">
                {overviewLoading ? '—' : overviewData?.kpis.pending ?? 0}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-xs text-gray-500">Avg Resolution</div>
              <div className="text-2xl font-bold text-blue-600">
                {overviewLoading ? '—' : formatHours(overviewData?.kpis.avg_resolution_hours ?? null)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-xs text-gray-500">Total Quoted</div>
              <div className="text-xl font-semibold">
                {overviewLoading ? '—' : formatCurrency(overviewData?.kpis.total_quoted ?? 0)}
              </div>
            </div>
            <button
              type="button"
              className="bg-white rounded-lg shadow-sm p-4 text-left hover:shadow-md transition"
              onClick={openMechanicCoverage}
              disabled={overviewLoading}
              title="View mechanic coverage by state/district"
            >
              <div className="text-xs text-gray-500">Total Mechanics</div>
              <div className="text-xl font-semibold">
                {overviewLoading ? '—' : (overviewData?.kpis as any)?.total_mechanics ?? 0}
              </div>
              <div className="text-[11px] text-blue-600 font-semibold mt-1">View coverage</div>
            </button>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-xs text-gray-500">Advance Amount</div>
              <div className="text-xl font-semibold">
                {overviewLoading ? '—' : formatCurrency((overviewData?.kpis as any)?.advance_amount ?? 0)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-xs text-gray-500">Mechanic Payment</div>
              <div className="text-xl font-semibold">
                {overviewLoading ? '—' : formatCurrency(overviewData?.kpis.payment_to_mechanic ?? 0)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-xs text-gray-500">Company Profit</div>
              <div className="text-xl font-semibold text-green-600">
                {overviewLoading ? '—' : showProfit ? formatCurrency(overviewData?.kpis.company_profit ?? 0) : '**'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setActivePaymentMetric('links')}
              className={`bg-white rounded-lg shadow-sm p-4 text-left hover:shadow-md transition ${
                activePaymentMetric === 'links' ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="text-xs text-gray-500">Total Link Generate</div>
              <div className="text-base font-semibold">
                {overviewLoading
                  ? '—'
                  : `${(overviewData?.kpis as any)?.total_link_generated_count ?? 0} / ${formatCurrency(
                      (overviewData?.kpis as any)?.total_link_generated_amount ?? 0
                    )}`}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActivePaymentMetric('captured')}
              className={`bg-white rounded-lg shadow-sm p-4 text-left hover:shadow-md transition ${
                activePaymentMetric === 'captured' ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="text-xs text-gray-500">Total Capture Payment</div>
              <div className="text-base font-semibold">
                {overviewLoading
                  ? '—'
                  : `${(overviewData?.kpis as any)?.total_captured_payment_count ?? 0} / ${formatCurrency(
                      (overviewData?.kpis as any)?.total_captured_payment_amount ?? 0
                    )}`}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActivePaymentMetric('refund')}
              className={`bg-white rounded-lg shadow-sm p-4 text-left hover:shadow-md transition ${
                activePaymentMetric === 'refund' ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="text-xs text-gray-500">Total Refund</div>
              <div className="text-base font-semibold">
                {overviewLoading
                  ? '—'
                  : `${(overviewData?.kpis as any)?.total_refund_count ?? 0} / ${formatCurrency(
                      (overviewData?.kpis as any)?.total_refund_amount ?? 0
                    )}`}
              </div>
            </button>
          </div>

          {activePaymentMetric ? (
            <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/40 px-4">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[82vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h3 className="text-sm font-semibold text-gray-800">{paymentMetricTitle} - Details</h3>
                  <button
                    type="button"
                    className="btn btn-outline text-xs px-3 py-1.5"
                    onClick={() => setActivePaymentMetric(null)}
                  >
                    Close
                  </button>
                </div>
                <div className="p-4 overflow-auto">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-gray-600">Search</label>
                      <input
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        placeholder="Order/Payment/Customer/Employee"
                        value={paymentSearch}
                        onChange={(e) => setPaymentSearch(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Status</label>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={paymentStatusFilter}
                        onChange={(e) => setPaymentStatusFilter(e.target.value)}
                      >
                        <option value="">All</option>
                        {paymentStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Role</label>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={paymentRoleFilter}
                        onChange={(e) => setPaymentRoleFilter(e.target.value)}
                      >
                        <option value="">All</option>
                        {paymentRoleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Employee Name</label>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={paymentEmployeeFilter}
                        onChange={(e) => setPaymentEmployeeFilter(e.target.value)}
                      >
                        <option value="">All</option>
                        {paymentEmployeeOptions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        className="btn btn-outline text-xs px-3 py-2 w-full"
                        onClick={() => {
                          setPaymentSearch('');
                          setPaymentStatusFilter('');
                          setPaymentRoleFilter('');
                          setPaymentEmployeeFilter('');
                        }}
                      >
                        Reset Filters
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="text-left text-gray-600 border-b">
                          <th className="py-2 pr-3">Payment ID</th>
                          <th className="py-2 pr-3">Customer</th>
                          <th className="py-2 pr-3">Employee</th>
                          <th className="py-2 pr-3">Role</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2 pr-3">Amount</th>
                          <th className="py-2 pr-3">Captured</th>
                          <th className="py-2 pr-3">Refunded</th>
                          <th className="py-2 pr-3">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPaymentMetricRows.length === 0 ? (
                          <tr>
                            <td className="py-3 text-gray-500" colSpan={9}>
                              No rows found for selected filter.
                            </td>
                          </tr>
                        ) : (
                          filteredPaymentMetricRows.map((row, idx) => (
                            <tr key={`${row.order_id || 'order'}-${idx}`} className="border-b last:border-b-0">
                              <td className="py-2 pr-3">{row.payment_id || '—'}</td>
                              <td className="py-2 pr-3">{row.customer_name || row.customer_phone || '—'}</td>
                              <td className="py-2 pr-3">{row.employee_name || '—'}</td>
                              <td className="py-2 pr-3">{row.employee_role || '—'}</td>
                              <td className="py-2 pr-3">
                                {(() => {
                                  const status = String(row.status || '—').toUpperCase();
                                  const cls =
                                    status === 'SUCCESS' || status === 'PAID'
                                      ? 'bg-green-100 text-green-700'
                                      : status === 'FAILED'
                                        ? 'bg-red-100 text-red-700'
                                        : status.includes('REFUND')
                                          ? 'bg-orange-100 text-orange-700'
                                          : status === 'CREATED' || status === 'LINK_GENERATED'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-gray-100 text-gray-700';
                                  return (
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
                                      {status}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="py-2 pr-3">{formatCurrency(row.amount || 0)}</td>
                              <td className="py-2 pr-3">{formatCurrency(row.captured_amount || 0)}</td>
                              <td className="py-2 pr-3">{formatCurrency(row.refunded_amount || 0)}</td>
                              <td className="py-2 pr-3">{formatDateTime(row.created_at)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4 lg:col-span-2">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">
                    Trend ({trendGranularity === 'hour' ? 'Hourly' : 'Daily'})
                  </h2>
                  <div className="text-[11px] text-gray-500">
                    {formatYMD(overviewFilters.from)} → {formatYMD(overviewFilters.to)} (UTC)
                  </div>
                </div>
                <div className="text-[11px] text-gray-600">4 metrics</div>
              </div>

              <div className="border rounded-lg p-3">
                {trendLoading ? (
                  <div className="text-xs text-gray-500">Loading…</div>
                ) : trendPoints.length === 0 ? (
                  <div className="text-xs text-gray-500">No trend data found.</div>
                ) : (
                  <div className="space-y-2">
                    {!showProfit ? (
                      <div className="text-[11px] text-gray-600">
                        Profit is hidden. Click <b>Show Profit</b> to show profit line + values.
                      </div>
                    ) : null}
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={trendPoints.map((p) => ({
                            ...p,
                            label:
                              trendGranularity === 'hour'
                                ? String(p.date).slice(11, 16) // HH:MM from YYYY-MM-DDTHH:00Z
                                : String(p.date).slice(5, 10), // MM-DD
                            profit_visible: showProfit ? p.company_profit : null,
                          }))}
                          margin={{ top: 5, right: 8, left: -10, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={12} />
                          <YAxis hide />
                          <ReTooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload || payload.length === 0) return null;
                              const row: any = payload[0]?.payload || {};
                              const title =
                                trendGranularity === 'hour'
                                  ? `${String(row.date).slice(0, 10)} ${String(label)}`
                                  : String(row.date);
                              return (
                                <div className="rounded-lg border bg-white shadow-sm px-3 py-2 text-xs">
                                  <div className="font-semibold text-gray-900">{title}</div>
                                  <div className="text-gray-700 mt-1">Requests: <b>{row.total_requests ?? 0}</b></div>
                                  <div className="text-gray-700">Resolved: <b>{row.resolved ?? 0}</b></div>
                                  <div className="text-gray-700">Quoted: <b>{formatCurrency(row.total_quoted ?? 0)}</b></div>
                                  <div className="text-gray-700">
                                    Profit: <b>{showProfit ? formatCurrency(row.company_profit ?? 0) : '**'}</b>
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Legend
                            verticalAlign="top"
                            height={18}
                            wrapperStyle={{ fontSize: 10 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="total_requests"
                            name="Requests"
                            stroke="#2563eb"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="resolved"
                            name="Resolved"
                            stroke="#16a34a"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="total_quoted"
                            name="Quoted"
                            stroke="#a855f7"
                            strokeWidth={2}
                            dot={false}
                          />
                          {showProfit ? (
                            <Line
                              type="monotone"
                              dataKey="profit_visible"
                              name="Profit"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              dot={false}
                            />
                          ) : null}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-[10px] text-gray-500">
                      Hover/cursor on chart to see values.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4 lg:col-span-3">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">Map (State Heatmap)</h2>
                  <div className="text-[11px] text-gray-500">
                    Google Map view (select a state from dropdown).
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-outline text-xs px-3 py-1.5"
                    onClick={() => {
                      if (activeStateId === '__ALL__' || !activeStateRow) {
                        loadOverviewLeads({ type: 'all', value: 'all', label: 'All' });
                        return;
                      }
                      loadOverviewLeads({ type: 'state', value: activeStateRow.key, label: activeStateRow.name });
                    }}
                    disabled={overviewLoading}
                    title="Open customers for selected state (or All)"
                  >
                    Open customers
                  </button>
                </div>
              </div>

              {overviewLoading ? (
                <div className="text-xs text-gray-500">Loading…</div>
              ) : (overviewData?.breakdowns.state || []).length === 0 ? (
                <div className="text-xs text-gray-500">No state data found.</div>
              ) : (
                (() => {
                  const rows = overviewData?.breakdowns.state || [];
                  const sorted = [...rows].sort((a, b) => (b.total || 0) - (a.total || 0));
                  return (
                    <div className="space-y-3">
                      <div className="rounded-lg border overflow-hidden">
                        <div className="relative h-72">
                          {activeStateId === '__ALL__' && googleMapsKey ? (
                            <GoogleStateHeatmapMap
                              className="w-full h-full"
                              apiKey={googleMapsKey}
                              points={allStatePoints}
                              activeId={null}
                              showProfit={showProfit}
                              onSelect={(id) => {
                                setActiveStateId(id);
                              }}
                              onOpenCustomers={(id) => {
                                const row = stateRows.find((r) => r.key === id);
                                if (!row) return;
                                setActiveStateId(id);
                                loadOverviewLeads({ type: 'state', value: row.key, label: row.name });
                              }}
                            />
                          ) : activeStateId === '__ALL__' ? (
                            <StateHeatmapLeafletVanillaMap
                              className="w-full h-full"
                              points={allStateLeafletPoints}
                              activeId={null}
                              showProfit={showProfit}
                              onSelect={(id) => setActiveStateId(id)}
                              onOpenCustomers={(id) => {
                                const row = stateRows.find((r) => r.key === id);
                                if (!row) return;
                                setActiveStateId(id);
                                loadOverviewLeads({ type: 'state', value: row.key, label: row.name });
                              }}
                            />
                          ) : (
                            <GoogleEmbedMap
                              className="w-full h-full"
                              center={activeStateCenter}
                              zoom={activeStateId === '__ALL__' ? 4 : 6}
                              query={activeStateId === '__ALL__' ? 'India' : undefined}
                              overlayLabel={
                                activeStateId === '__ALL__'
                                  ? googleMapsKey
                                    ? 'All states (heatmap)'
                                    : 'All states (add Google Maps API key for heatmap)'
                                  : activeStateRow?.name || ''
                              }
                            />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="text-xs text-gray-600">State</label>
                          <select
                            className="w-full border rounded-md px-3 py-2 text-sm"
                            value={activeStateId || ''}
                            onChange={(e) => setActiveStateId(e.target.value)}
                          >
                            <option value="__ALL__">All (All states)</option>
                            {sorted.map((s) => (
                              <option key={s.key} value={s.key}>
                                {s.name} ({s.total})
                              </option>
                            ))}
                          </select>
                          <div className="text-[11px] text-gray-500 mt-1">
                            Tip: dropdown select karke map center hoga, fir “Open customers”.
                          </div>
                        </div>
                        <div className="rounded-lg border bg-emerald-50 p-3">
                          <div className="text-xs text-gray-600">Selected</div>
                          <div className="text-sm font-semibold text-gray-900">
                            {activeStateId === '__ALL__' ? 'All states' : activeStateRow?.name || '—'}
                          </div>
                          <div className="text-[11px] text-gray-700 mt-1">
                            Total:{' '}
                            <b>
                              {activeStateId === '__ALL__'
                                ? overviewData?.kpis.total_requests ?? 0
                                : activeStateRow?.total ?? 0}
                            </b>{' '}
                            • Solved:{' '}
                            <b>
                              {activeStateId === '__ALL__' ? overviewData?.kpis.resolved ?? 0 : activeStateRow?.resolved ?? 0}
                            </b>
                          </div>
                          <div className="text-[11px] text-gray-700">
                            Profit:{' '}
                            <b className="text-emerald-900">
                              {showProfit
                                ? formatCurrency(
                                    activeStateId === '__ALL__'
                                      ? overviewData?.kpis.company_profit ?? 0
                                      : activeStateRow?.company_profit ?? 0
                                  )
                                : '**'}
                            </b>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Department Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3">Department</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Resolved</th>
                    <th className="py-2 pr-3">Rate</th>
                    <th className="py-2 pr-3">Revenue</th>
                    <th className="py-2 pr-3">Mechanic Payment</th>
                    <th className="py-2 pr-3">Company Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {(overviewData?.breakdowns.department || []).map((row) => (
                    <tr key={row.name} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 font-semibold">
                        <button
                          type="button"
                          className="text-blue-600 hover:text-blue-700"
                          onClick={() =>
                            loadOverviewLeads({ type: 'department', value: row.key, label: row.name })
                          }
                        >
                          {row.name}
                        </button>
                      </td>
                      <td className="py-2 pr-3">{row.total}</td>
                      <td className="py-2 pr-3">{row.resolved}</td>
                      <td className="py-2 pr-3">{formatRate(row.rate)}</td>
                      <td className="py-2 pr-3">{formatCurrency(row.revenue)}</td>
                      <td className="py-2 pr-3">{formatCurrency(row.mechanic_payment)}</td>
                      <td className="py-2 pr-3">{showProfit ? formatCurrency(row.company_profit) : '**'}</td>
                    </tr>
                  ))}
                  {overviewLoading || (overviewData?.breakdowns.department || []).length > 0 ? null : (
                    <tr>
                      <td className="py-3 text-gray-500" colSpan={7}>
                        No data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-800">District-wise Breakdown</h2>
                <button
                  type="button"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  onClick={() => setDistrictOpen(true)}
                  disabled={overviewLoading}
                >
                  Show more
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 pr-3">District</th>
                      <th className="py-2 pr-3">Total</th>
                      <th className="py-2 pr-3">Resolved</th>
                      <th className="py-2 pr-3">Rate</th>
                      <th className="py-2 pr-3">Revenue</th>
                      <th className="py-2 pr-3">Mechanic Payment</th>
                      <th className="py-2 pr-3">Company Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(overviewData?.breakdowns.district || []).slice(0, 10).map((row) => (
                      <tr key={row.name} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 font-semibold">
                        <button
                          type="button"
                          className="text-blue-600 hover:text-blue-700"
                          onClick={() =>
                            loadOverviewLeads({ type: 'district', value: row.key, label: row.name })
                          }
                        >
                          {row.name}
                        </button>
                      </td>
                        <td className="py-2 pr-3">{row.total}</td>
                        <td className="py-2 pr-3">{row.resolved}</td>
                        <td className="py-2 pr-3">{formatRate(row.rate)}</td>
                        <td className="py-2 pr-3">{formatCurrency(row.revenue)}</td>
                        <td className="py-2 pr-3">{formatCurrency(row.mechanic_payment)}</td>
                        <td className="py-2 pr-3">{showProfit ? formatCurrency(row.company_profit) : '**'}</td>
                      </tr>
                    ))}
                    {overviewLoading || (overviewData?.breakdowns.district || []).length > 0 ? null : (
                      <tr>
                        <td className="py-3 text-gray-500" colSpan={7}>
                          No data found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">State-wise Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 pr-3">State</th>
                      <th className="py-2 pr-3">Total</th>
                      <th className="py-2 pr-3">Resolved</th>
                      <th className="py-2 pr-3">Rate</th>
                      <th className="py-2 pr-3">Revenue</th>
                      <th className="py-2 pr-3">Mechanic Payment</th>
                      <th className="py-2 pr-3">Company Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(overviewData?.breakdowns.state || []).map((row) => (
                      <tr key={row.name} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 font-semibold">
                        <button
                          type="button"
                          className="text-blue-600 hover:text-blue-700"
                          onClick={() => loadOverviewLeads({ type: 'state', value: row.key, label: row.name })}
                        >
                          {row.name}
                        </button>
                      </td>
                        <td className="py-2 pr-3">{row.total}</td>
                        <td className="py-2 pr-3">{row.resolved}</td>
                        <td className="py-2 pr-3">{formatRate(row.rate)}</td>
                        <td className="py-2 pr-3">{formatCurrency(row.revenue)}</td>
                        <td className="py-2 pr-3">{formatCurrency(row.mechanic_payment)}</td>
                        <td className="py-2 pr-3">{showProfit ? formatCurrency(row.company_profit) : '**'}</td>
                      </tr>
                    ))}
                    {overviewLoading || (overviewData?.breakdowns.state || []).length > 0 ? null : (
                      <tr>
                        <td className="py-3 text-gray-500" colSpan={7}>
                          No data found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-800">Top Mechanics</h2>
                <button
                  type="button"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  onClick={() => setMechanicOpen(true)}
                  disabled={overviewLoading}
                >
                  Show more
                </button>
              </div>
              <div className="overflow-hidden rounded-lg border">
                {overviewLoading ? (
                  <div className="text-xs text-gray-500 p-3">Loading…</div>
                ) : (overviewData?.breakdowns as any)?.mechanic?.length ? (
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr className="text-left">
                        <th className="py-2 px-3">Mechanic</th>
                        <th className="py-2 px-3">Solved</th>
                        <th className="py-2 px-3 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((overviewData?.breakdowns as any).mechanic as OverviewBreakdownRow[])
                        .slice(0, 10)
                        .map((m) => (
                          <tr key={m.key} className="border-t">
                            <td className="py-2 px-3">
                              <button
                                type="button"
                                className="font-semibold text-blue-600 hover:text-blue-700 text-left"
                                onClick={() => loadOverviewLeads({ type: 'mechanic', value: m.key, label: m.name })}
                              >
                                {m.name}
                              </button>
                              <div className="text-[10px] text-gray-500">
                                Paid: <b>{formatCurrency(m.mechanic_payment)}</b>
                              </div>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <b>{m.resolved}</b> / {m.total}
                            </td>
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              <span className="font-semibold text-green-700">
                                {showProfit ? formatCurrency(m.company_profit) : '**'}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-xs text-gray-500 p-3">No mechanics found.</div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            {(() => {
              const callMap = new Map(employeeReportRows.map((r) => [r.user_id, r]));
              const leadRows = overviewData?.breakdowns.employee || [];
              const leadMap = new Map(leadRows.map((r) => [r.key, r]));
              const allIds = Array.from(new Set([...Array.from(leadMap.keys()), ...Array.from(callMap.keys())]));
              const roleRank = (role?: string | null) => {
                const r = String(role || '').toUpperCase();
                if (r === 'RSA_MANAGER') return 0;
                if (r === 'TELECALLER') return 1;
                return 2;
              };

              const combined = allIds
                .map((id) => {
                  const lead = leadMap.get(id) || null;
                  const call = callMap.get(id) || null;
                  const name = lead?.name || call?.name || '—';
                  const registeredBy = (call as any)?.registered_complaints ?? (lead as any)?.total ?? 0;
                  const completedBy = (call as any)?.completed_complaints ?? (lead as any)?.resolved ?? 0;
                  const regResolved = (call as any)?.registered_resolved_complaints ?? 0;
                  const rate = registeredBy ? (regResolved / registeredBy) * 100 : null;
                  const quoted = (call as any)?.total_quoted ?? (lead as any)?.revenue ?? 0;
                  const role = (call as any)?.role || '—';
                  return { id, name, role, registeredBy, completedBy, rate, quoted, lead, call };
                })
                .sort((a, b) => {
                  const rr = roleRank(a.role) - roleRank(b.role);
                  if (rr !== 0) return rr;
                  // case-wise: completed first, then registered
                  if ((b.completedBy || 0) !== (a.completedBy || 0)) return (b.completedBy || 0) - (a.completedBy || 0);
                  if ((b.registeredBy || 0) !== (a.registeredBy || 0)) return (b.registeredBy || 0) - (a.registeredBy || 0);
                  // tie-break: answered calls
                  const ac = (a.call as any)?.total_answer_calls ?? 0;
                  const bc = (b.call as any)?.total_answer_calls ?? 0;
                  return bc - ac;
                });
              const fmt = (v: number | null | undefined) => (v == null ? '—' : `${Number(v).toFixed(1)}/5`);
              return (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-800">Employee-wise Breakdown</h2>
                    {employeeReportLoading ? <div className="text-xs text-gray-500">Loading call metrics…</div> : null}
                  </div>
                  {employeeReportError ? <div className="text-xs text-red-600 mb-2">{employeeReportError}</div> : null}
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3">Employee</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Registered By</th>
                    <th className="py-2 pr-3">Completed By</th>
                    <th className="py-2 pr-3">Rate</th>
                    <th className="py-2 pr-3">Quoted</th>
                    <th className="py-2 pr-3">Advance</th>
                    <th className="py-2 pr-3">Reg Profit</th>
                    <th className="py-2 pr-3">Self Done (Mech/Profit)</th>
                    <th className="py-2 pr-3">Completed Only (Mech/Profit)</th>
                    <th className="py-2 pr-3">Answered Calls</th>
                    <th className="py-2 pr-3">Avg Call Rating</th>
                    <th className="py-2 pr-3">Avg Audit</th>
                  </tr>
                </thead>
                <tbody>
                  {combined.map((row, idx) => {
                    const call = row.call as any;
                    const groupLabel =
                      String(row.role || '').toUpperCase() === 'RSA_MANAGER'
                        ? 'RSA Managers'
                        : String(row.role || '').toUpperCase() === 'TELECALLER'
                          ? 'Telecallers'
                          : 'Others';
                    const prev = idx > 0 ? combined[idx - 1] : null;
                    const prevGroup =
                      prev
                        ? String(prev.role || '').toUpperCase() === 'RSA_MANAGER'
                          ? 'RSA Managers'
                          : String(prev.role || '').toUpperCase() === 'TELECALLER'
                            ? 'Telecallers'
                            : 'Others'
                        : null;
                    return (
                      <Fragment key={row.id}>
                        {idx === 0 || groupLabel !== prevGroup ? (
                        <tr className="bg-gray-50 border-b">
                            <td className="py-2 px-3 text-xs font-semibold text-gray-700" colSpan={13}>
                              {groupLabel}
                            </td>
                          </tr>
                        ) : null}
                        <tr className="border-b last:border-b-0">
                        <td className="py-2 pr-3 font-semibold">
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-700"
                            onClick={() => loadOverviewLeads({ type: 'employee', value: row.id, label: row.name })}
                            disabled={!row.id}
                            title="View employee customers"
                          >
                            {row.name}
                          </button>
                        </td>
                        <td className="py-2 pr-3">{row.role || '—'}</td>
                        <td className="py-2 pr-3">{row.registeredBy}</td>
                        <td className="py-2 pr-3">{row.completedBy}</td>
                        <td className="py-2 pr-3">{row.rate == null ? '—' : formatRate(row.rate)}</td>
                        <td className="py-2 pr-3">{formatCurrency(row.quoted)}</td>
                        <td className="py-2 pr-3">{formatCurrency(call?.registered_advance_amount ?? 0)}</td>
                        <td className="py-2 pr-3 font-semibold text-green-700">
                          {showProfit ? formatCurrency(call?.registered_profit ?? 0) : '**'}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {formatCurrency(call?.self_completed_mechanic_payment ?? 0)} /{' '}
                          <span className="font-semibold text-green-700">
                            {showProfit ? formatCurrency(call?.self_completed_profit ?? 0) : '**'}
                          </span>
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {formatCurrency(call?.completed_only_mechanic_payment ?? 0)} /{' '}
                          <span className="font-semibold text-green-700">
                            {showProfit ? formatCurrency(call?.completed_only_profit ?? 0) : '**'}
                          </span>
                        </td>
                        <td className="py-2 pr-3">{call?.total_answer_calls ?? 0}</td>
                        <td className="py-2 pr-3">{fmt(call?.avg_call_rating ?? null)}</td>
                        <td className="py-2 pr-3">{fmt(call?.avg_audit_rating ?? null)}</td>
                        </tr>
                      </Fragment>
                    );
                  })}
                  {overviewLoading || combined.length > 0 ? null : (
                    <tr>
                      <td className="py-3 text-gray-500" colSpan={13}>
                        No data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
                  <div className="text-[11px] text-gray-500 mt-2">
                    Note: call metrics come from SARV calls and audits in the selected date range.
                  </div>
                </>
              );
            })()}
          </div>

          {overviewSelection ? (
            <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/40 px-4">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-800">
                      Customers for {overviewSelection.type} - {overviewSelection.label}
                    </h2>
                    {overviewLeadsLoading ? <div className="text-xs text-gray-500">Loading...</div> : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline text-xs px-3 py-1.5"
                    onClick={() => setOverviewSelection(null)}
                  >
                    Close
                  </button>
                </div>
                {overviewLeadsError ? <div className="text-sm text-red-600 px-4 py-2">{overviewLeadsError}</div> : null}
                <div className="flex-1 overflow-auto">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 px-4">Customer</th>
                        <th className="py-2 px-4">Contact</th>
                        <th className="py-2 px-4">Executive</th>
                        <th className="py-2 px-4">Advisor</th>
                        <th className="py-2 px-4">Quoted</th>
                        <th className="py-2 px-4">Advance</th>
                        <th className="py-2 px-4">Mechanic</th>
                        <th className="py-2 px-4">Vehicle</th>
                        <th className="py-2 px-4">Service</th>
                        <th className="py-2 px-4">Status</th>
                        <th className="py-2 px-4">Registered</th>
                        <th className="py-2 px-4">Address</th>
                        <th className="py-2 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewLeads.length === 0 ? (
                        <tr>
                          <td className="py-3 text-gray-500 px-4" colSpan={13}>
                            No customers found.
                          </td>
                        </tr>
                      ) : (
                        overviewLeads.map((lead) => {
                          const draft = overviewFinanceDrafts[lead.id] || {
                            customer_quoted_amount: normalizeAmountInput((lead as any).customer_quoted_amount),
                            advance_payment: normalizeAmountInput((lead as any).advance_payment),
                            payment_to_mechanic: normalizeAmountInput((lead as any).payment_to_mechanic),
                            saving: false,
                            error: '',
                          };
                          return (
                            <tr key={lead.id} className="border-b last:border-b-0">
                              <td className="py-2 px-4 font-semibold">
                                {lead.id ? (
                                  <a
                                    className="text-blue-600 hover:text-blue-700"
                                    href={`/dashboard/super_admin/rsa/leads/${lead.id}`}
                                  >
                                    {lead.customer_name || '—'}
                                  </a>
                                ) : (
                                  lead.customer_name || '—'
                                )}
                              </td>
                              <td className="py-2 px-4">{lead.contact_number || '—'}</td>
                              <td className="py-2 px-4">{lead.registered_by_name || '—'}</td>
                              <td className="py-2 px-4">{lead.assigned_manager_name || '—'}</td>
                              <td className="py-2 px-4">
                                <input
                                  className="w-24 border rounded px-2 py-1"
                                  value={draft.customer_quoted_amount}
                                  onChange={(e) =>
                                    setOverviewFinanceField(lead.id, 'customer_quoted_amount', e.target.value)
                                  }
                                  placeholder="0"
                                />
                              </td>
                              <td className="py-2 px-4">
                                <input
                                  className="w-24 border rounded px-2 py-1"
                                  value={draft.advance_payment}
                                  onChange={(e) => setOverviewFinanceField(lead.id, 'advance_payment', e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td className="py-2 px-4">
                                <input
                                  className="w-24 border rounded px-2 py-1"
                                  value={draft.payment_to_mechanic}
                                  onChange={(e) =>
                                    setOverviewFinanceField(lead.id, 'payment_to_mechanic', e.target.value)
                                  }
                                  placeholder="0"
                                />
                              </td>
                              <td className="py-2 px-4">{lead.vehicle_number || '—'}</td>
                              <td className="py-2 px-4">{lead.service_type || lead.service_tag || '—'}</td>
                              <td className="py-2 px-4">{lead.lead_status || lead.complaint_status || '—'}</td>
                              <td className="py-2 px-4">{formatDateTime(lead.lead_registered_at)}</td>
                              <td className="py-2 px-4">{lead.address || lead.pincode || '—'}</td>
                              <td className="py-2 px-4">
                                <button
                                  type="button"
                                  className="btn btn-outline text-xs px-2 py-1"
                                  disabled={Boolean(draft.saving)}
                                  onClick={() => saveOverviewLeadFinance(lead.id)}
                                >
                                  {draft.saving ? 'Saving...' : 'Save'}
                                </button>
                                {draft.error ? <div className="text-[10px] text-red-600 mt-1">{draft.error}</div> : null}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {mechanicOpen ? (
            <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/40 px-4">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-800">Mechanic Performance</h2>
                    <div className="text-xs text-gray-500">Solved cases, payouts, profit</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline text-xs px-3 py-1.5"
                    onClick={() => setMechanicOpen(false)}
                  >
                    Close
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 px-4">Mechanic</th>
                        <th className="py-2 px-4">Total</th>
                        <th className="py-2 px-4">Solved</th>
                        <th className="py-2 px-4">Rate</th>
                        <th className="py-2 px-4">Quoted</th>
                        <th className="py-2 px-4">Mechanic Paid</th>
                        <th className="py-2 px-4">Company Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((overviewData?.breakdowns as any)?.mechanic || []).length === 0 ? (
                        <tr>
                          <td className="py-3 text-gray-500 px-4" colSpan={7}>
                            No mechanics found.
                          </td>
                        </tr>
                      ) : (
                        ((overviewData?.breakdowns as any).mechanic as OverviewBreakdownRow[]).map((m) => (
                          <tr key={m.key} className="border-b last:border-b-0">
                            <td className="py-2 px-4 font-semibold">
                              <button
                                type="button"
                                className="text-blue-600 hover:text-blue-700 text-left"
                                onClick={() => {
                                  setMechanicOpen(false);
                                  loadOverviewLeads({ type: 'mechanic', value: m.key, label: m.name });
                                }}
                              >
                                {m.name}
                              </button>
                            </td>
                            <td className="py-2 px-4">{m.total}</td>
                            <td className="py-2 px-4">{m.resolved}</td>
                            <td className="py-2 px-4">{formatRate(m.rate)}</td>
                            <td className="py-2 px-4">{formatCurrency(m.revenue)}</td>
                            <td className="py-2 px-4">{formatCurrency(m.mechanic_payment)}</td>
                            <td className="py-2 px-4">{showProfit ? formatCurrency(m.company_profit) : '**'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* District-wise breakdown (Show more) */}
      {districtOpen ? (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">All Districts</h2>
                <div className="text-xs text-gray-500">Click a district to open customers.</div>
              </div>
              <button
                type="button"
                className="btn btn-outline text-xs px-3 py-1.5"
                onClick={() => setDistrictOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                  <tr className="text-left border-b">
                    <th className="py-2 px-4">District</th>
                    <th className="py-2 px-4">Total</th>
                    <th className="py-2 px-4">Resolved</th>
                    <th className="py-2 px-4">Rate</th>
                    <th className="py-2 px-4">Revenue</th>
                    <th className="py-2 px-4">Mechanic Payment</th>
                    <th className="py-2 px-4">Company Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {(overviewData?.breakdowns.district || []).length === 0 ? (
                    <tr>
                      <td className="py-3 px-4 text-gray-500" colSpan={7}>
                        {overviewLoading ? 'Loading…' : 'No data found.'}
                      </td>
                    </tr>
                  ) : (
                    (overviewData?.breakdowns.district || []).map((row) => (
                      <tr key={row.key} className="border-b last:border-b-0">
                        <td className="py-2 px-4 font-semibold">
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-700"
                            onClick={() => {
                              setDistrictOpen(false);
                              loadOverviewLeads({ type: 'district', value: row.key, label: row.name });
                            }}
                          >
                            {row.name}
                          </button>
                        </td>
                        <td className="py-2 px-4">{row.total}</td>
                        <td className="py-2 px-4">{row.resolved}</td>
                        <td className="py-2 px-4">{formatRate(row.rate)}</td>
                        <td className="py-2 px-4">{formatCurrency(row.revenue)}</td>
                        <td className="py-2 px-4">{formatCurrency(row.mechanic_payment)}</td>
                        <td className="py-2 px-4">{showProfit ? formatCurrency(row.company_profit) : '**'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {reportDrilldownOpen ? (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-6xl max-h-[82vh] rounded-xl shadow-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <div className="text-sm font-semibold text-gray-900">{reportDrilldownTitle || 'Calls'}</div>
                <div className="text-xs text-gray-500">{reportDrilldownRows.length} calls</div>
              </div>
              <button type="button" className="btn btn-outline text-xs px-3 py-1.5" onClick={closeReportDrilldown}>
                Close
              </button>
            </div>
            <div className="p-4 overflow-auto">
              {reportDrilldownLoading ? (
                <div className="text-sm text-gray-500">Loading calls…</div>
              ) : reportDrilldownError ? (
                <div className="text-sm text-red-600">{reportDrilldownError}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 pr-3">Call Time</th>
                        <th className="py-2 pr-3">Employee</th>
                        <th className="py-2 pr-3">Designation</th>
                        <th className="py-2 pr-3">Customer</th>
                        <th className="py-2 pr-3">Talk</th>
                        <th className="py-2 pr-3">Disposition</th>
                        <th className="py-2 pr-3">Summary</th>
                        <th className="py-2 pr-3">Recording</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportDrilldownRows.length === 0 ? (
                        <tr>
                          <td className="py-3 text-gray-500" colSpan={8}>
                            No calls found.
                          </td>
                        </tr>
                      ) : (
                        reportDrilldownRows.map((row) => (
                          <tr key={row.id} className="border-b last:border-b-0 align-top">
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {formatDateTime(row.custanswerstime || row.sarv_created_at || row.created_at)}
                            </td>
                            <td className="py-2 pr-3">
                              {row.assignee_name || row.assignee_email || row.assignee_phone || row.assigned_user_id || '—'}
                            </td>
                            <td className="py-2 pr-3">{row.assigned_role || '—'}</td>
                            <td className="py-2 pr-3">{row.cnumber || '—'}</td>
                            <td className="py-2 pr-3">{formatDuration(row.talkduration)}</td>
                            <td className="py-2 pr-3">{row.disposition || row.disposition_category || '—'}</td>
                            <td className="py-2 pr-3">
                              {row.summary ? (
                                <button
                                  type="button"
                                  className="text-blue-600 hover:text-blue-700 font-semibold"
                                  onClick={() => openSummary(row)}
                                >
                                  View Summary
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              {row.recording_url ? (
                                <div className="flex flex-col gap-2">
                                  <a
                                    className="text-blue-600 hover:text-blue-700 text-xs font-semibold"
                                    href={row.recording_url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Download
                                  </a>
                                  <audio controls preload="none" src={row.recording_url} className="w-72 min-w-[16rem] max-w-full h-10" />
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Summary modal should render regardless of selected tab */}
      {summaryOpen ? (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-4xl max-h-[80vh] rounded-xl shadow-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <div className="text-sm font-semibold text-gray-900">AI Summary</div>
                <div className="text-xs text-gray-500">Call ID: {summaryCall?.callid || '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary text-xs px-3 py-1.5"
                  onClick={regenerateSummary}
                  disabled={regenLoading || !summaryCall?.id}
                  title={!summaryCall?.id ? 'Missing call id' : 'Regenerate transcription + summary'}
                >
                  {regenLoading ? 'Regenerating…' : 'Regenerate'}
                </button>
                <button type="button" className="btn btn-outline text-xs px-3 py-1.5" onClick={closeSummary}>
                  Close
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4 flex-1 overflow-auto">
              {regenError ? (
                <div className="text-xs sm:text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {regenError}
                </div>
              ) : null}
              {summaryCall?.summary ? (
                (() => {
                  const raw = String(summaryCall.summary || '').trim();
                  const extractRating = (text: string) => {
                    const m =
                      text.match(/Call Rating\s*\(1-5\)\s*[:\-–]?\s*([1-5])/i) ||
                      text.match(/\bRating\b\s*[:\-–]?\s*([1-5])/i);
                    if (!m) return null;
                    const n = Number(m[1]);
                    return n >= 1 && n <= 5 ? n : null;
                  };
                  const isRoadsideFormat =
                    /Full Transcription/i.test(raw) &&
                    /Customer Summary/i.test(raw) &&
                    /Employee Summary/i.test(raw) &&
                    /Actionable Outcome/i.test(raw);

                  if (isRoadsideFormat) {
                    const rating = extractRating(raw);
                    const parseRoadsideSummary = (text: string) => {
                      const lines = String(text || '')
                        .replace(/\r\n/g, '\n')
                        .split('\n')
                        .map((l) => l.replace(/\s+$/g, ''));

                      const buckets: Record<string, string[]> = {
                        transcription: [],
                        customerSummary: [],
                        employeeSummary: [],
                        outcome: [],
                      };

                      let section: keyof typeof buckets | null = null;
                      for (const line of lines) {
                        const t = line.trim();
                        if (/^Full Transcription$/i.test(t)) {
                          section = 'transcription';
                          continue;
                        }
                        if (/^Customer Summary$/i.test(t)) {
                          section = 'customerSummary';
                          continue;
                        }
                        if (/^Employee Summary$/i.test(t)) {
                          section = 'employeeSummary';
                          continue;
                        }
                        if (/^Actionable Outcome$/i.test(t)) {
                          section = 'outcome';
                          continue;
                        }
                        if (!section) continue;
                        buckets[section].push(line);
                      }

                      // Transcription: split speaker blocks.
                      const speaker = { customer: [] as string[], employee: [] as string[] };
                      let current: keyof typeof speaker | null = null;
                      for (const line of buckets.transcription) {
                        const trimmed = line.trim();
                        const m = trimmed.match(/^(Customer|Employee)\s*:\s*(.*)$/i);
                        if (m) {
                          current = m[1].toLowerCase() as any;
                          const rest = (m[2] || '').trim();
                          if (rest) speaker[current].push(rest);
                          continue;
                        }
                        if (current) speaker[current].push(line);
                      }
                      const transcriptionCustomer = speaker.customer.join('\n').trim();
                      const transcriptionEmployee = speaker.employee.join('\n').trim();

                      const normalizeBullets = (arr: string[]) =>
                        arr
                          .map((l) => l.trim())
                          .filter(Boolean)
                          .map((l) => l.replace(/^\s*[-•]\s*/, ''));

                      const customerSummary = normalizeBullets(buckets.customerSummary);
                      const employeeSummaryAll = normalizeBullets(buckets.employeeSummary);

                      // Employee Summary: extract Operational Insights + Confidence if present.
                      const employeeSummary: string[] = [];
                      const operationalInsights: string[] = [];
                      let confidence: string | null = null;
                      let mode: 'main' | 'ops' = 'main';
                      for (const item of employeeSummaryAll) {
                        if (/^Operational Insights\s*:/i.test(item)) {
                          mode = 'ops';
                          const rest = item.replace(/^Operational Insights\s*:/i, '').trim();
                          if (rest) operationalInsights.push(rest);
                          continue;
                        }
                        if (/^Confidence\s*:/i.test(item)) {
                          const rest = item.replace(/^Confidence\s*:/i, '').trim();
                          confidence = rest || null;
                          mode = 'main';
                          continue;
                        }
                        if (mode === 'ops') operationalInsights.push(item);
                        else employeeSummary.push(item);
                      }

                      const outcomeLines = buckets.outcome.map((l) => l.trim()).filter(Boolean);
                      const extractField = (label: string) => {
                        const re = new RegExp(`^${label}\\s*[:\\-–]?\\s*(.*)$`, 'i');
                        const hit = outcomeLines.find((l) => re.test(l));
                        if (!hit) return null;
                        const m = hit.match(re);
                        return (m?.[1] || '').trim() || null;
                      };
                      const callStatus = extractField('Call Status');
                      const missingInfo = extractField('Missing Info');
                      const nextStep = extractField('Next Step');

                      return {
                        transcriptionCustomer,
                        transcriptionEmployee,
                        customerSummary,
                        employeeSummary,
                        operationalInsights,
                        confidence,
                        callStatus,
                        missingInfo,
                        nextStep,
                      };
                    };

                    const parsed = parseRoadsideSummary(raw);
                    return (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-gray-600">
                            Call Rating: <b>{rating ? `${rating}/5` : '—'}</b>
                          </div>
                          {rating ? (
                            <div className="text-sm text-yellow-600" aria-label={`Rating ${rating} out of 5`}>
                              {'★'.repeat(rating)}
                              <span className="text-gray-300">{'★'.repeat(5 - rating)}</span>
                            </div>
                          ) : null}
                        </div>
                        <div className="max-h-[70vh] overflow-auto space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-lg border bg-white p-4">
                              <div className="text-xs font-semibold text-gray-700 mb-2">Customer Summary</div>
                              {parsed.customerSummary.length ? (
                                <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-gray-900">
                                  {parsed.customerSummary.map((it, idx) => (
                                    <li key={idx}>{it}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-xs sm:text-sm text-gray-600">—</div>
                              )}
                            </div>
                            <div className="rounded-lg border bg-white p-4 space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs font-semibold text-gray-700">Employee Summary</div>
                                {parsed.confidence ? (
                                  <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                    Confidence: {parsed.confidence}
                                  </span>
                                ) : null}
                              </div>

                              {parsed.employeeSummary.length ? (
                                <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-gray-900">
                                  {parsed.employeeSummary.map((it, idx) => (
                                    <li key={idx}>{it}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-xs sm:text-sm text-gray-600">—</div>
                              )}

                              {parsed.operationalInsights.length ? (
                                <div className="rounded-lg border bg-gray-50 p-3">
                                  <div className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">
                                    Operational Insights
                                  </div>
                                  <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-gray-900">
                                    {parsed.operationalInsights.map((it, idx) => (
                                      <li key={idx}>{it}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="rounded-lg border bg-gray-50 p-4">
                            <div className="text-xs font-semibold text-gray-700 mb-2">Actionable Outcome</div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="rounded-lg border bg-white p-3">
                                <div className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">
                                  Call Status
                                </div>
                                <div className="text-xs sm:text-sm text-gray-900">{parsed.callStatus || '—'}</div>
                              </div>
                              <div className="rounded-lg border bg-white p-3 md:col-span-2">
                                <div className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">
                                  Missing Info
                                </div>
                                <div className="text-xs sm:text-sm text-gray-900 whitespace-pre-wrap">
                                  {parsed.missingInfo || '—'}
                                </div>
                              </div>
                              <div className="rounded-lg border bg-white p-3 md:col-span-3">
                                <div className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">
                                  Next Step
                                </div>
                                <div className="text-xs sm:text-sm text-gray-900 whitespace-pre-wrap">
                                  {parsed.nextStep || '—'}
                                </div>
                              </div>
                            </div>
                          </div>

                          <details className="rounded-lg border bg-white p-4">
                            <summary className="cursor-pointer text-xs sm:text-sm font-semibold text-gray-700">
                              Full Transcription
                            </summary>
                            <div className="mt-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                <div className="inline-flex rounded-lg border bg-gray-50 p-1 text-xs">
                                  <button
                                    type="button"
                                    className={`px-2 py-1 rounded-md ${
                                      transcriptionView === 'raw'
                                        ? 'bg-white shadow-sm text-gray-900'
                                        : 'text-gray-600 hover:text-gray-800'
                                    }`}
                                    onClick={() => setTranscriptionView('raw')}
                                  >
                                    Raw (from recording)
                                  </button>
                                  <button
                                    type="button"
                                    className={`px-2 py-1 rounded-md ${
                                      transcriptionView === 'split'
                                        ? 'bg-white shadow-sm text-gray-900'
                                        : 'text-gray-600 hover:text-gray-800'
                                    }`}
                                    onClick={() => setTranscriptionView('split')}
                                  >
                                    AI speaker split
                                  </button>
                                </div>

                                {transcriptionView === 'split' ? (
                                  <button
                                    type="button"
                                    className="btn btn-outline text-xs px-3 py-1.5"
                                    onClick={() => setSwapSpeakers((v) => !v)}
                                  >
                                    Swap Customer/Employee
                                  </button>
                                ) : null}
                              </div>

                              {transcriptionView === 'raw' ? (
                                <div className="rounded-lg border bg-gray-50 p-3">
                                  <div className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">
                                    Transcription
                                  </div>
                                  <div className="text-xs sm:text-sm text-gray-900 whitespace-pre-wrap">
                                    {String(summaryCall?.transcription || '').trim() ||
                                      (parsed.transcriptionCustomer || parsed.transcriptionEmployee
                                        ? [parsed.transcriptionCustomer, parsed.transcriptionEmployee]
                                            .filter(Boolean)
                                            .join('\n\n')
                                        : '—')}
                                  </div>
                                  <div className="text-[11px] text-gray-500 mt-2">
                                    Note: this is the raw transcription generated directly from the recording.
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="rounded-lg border bg-gray-50 p-3">
                                    <div className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">
                                      Customer
                                    </div>
                                    <div className="text-xs sm:text-sm text-gray-900 whitespace-pre-wrap">
                                      {(swapSpeakers ? parsed.transcriptionEmployee : parsed.transcriptionCustomer) ||
                                        '—'}
                                    </div>
                                  </div>
                                  <div className="rounded-lg border bg-gray-50 p-3">
                                    <div className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">
                                      Employee
                                    </div>
                                    <div className="text-xs sm:text-sm text-gray-900 whitespace-pre-wrap">
                                      {(swapSpeakers ? parsed.transcriptionCustomer : parsed.transcriptionEmployee) ||
                                        '—'}
                                    </div>
                                  </div>
                                  <div className="md:col-span-2 text-[11px] text-gray-500">
                                    Note: speaker split is best-effort AI formatting; use “Raw” if speakers look
                                    swapped or unclear.
                                  </div>
                                </div>
                              )}
                            </div>
                          </details>
                        </div>
                      </>
                    );
                  }

                  const sections = parseSummarySections(summaryCall.summary);
                  const rating =
                    extractRating(raw) ||
                    (sections.sentiment && /negative|नकारात्मक/i.test(sections.sentiment)
                      ? 2
                      : sections.sentiment && /neutral|तटस्थ/i.test(sections.sentiment)
                        ? 3
                        : sections.sentiment && /positive|सकारात्मक/i.test(sections.sentiment)
                          ? 4
                          : null);
                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-lg border bg-red-50 p-4">
                          <div className="text-xs font-semibold text-red-700 mb-2">Customer Issue</div>
                          <div className="text-sm text-gray-800">{sections.customerIssue || '—'}</div>
                        </div>
                        <div className="rounded-lg border bg-green-50 p-4">
                          <div className="text-xs font-semibold text-green-700 mb-2">Resolution</div>
                          <div className="text-sm text-gray-800">{sections.resolution || '—'}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-lg border bg-white p-4">
                          <div className="text-xs font-semibold text-gray-700 mb-2">Sentiment</div>
                          <div className="text-sm text-gray-800">{sections.sentiment || '—'}</div>
                        </div>
                        <div className="rounded-lg border bg-white p-4">
                          <div className="text-xs font-semibold text-gray-700 mb-2">Action Items</div>
                          <div className="text-sm text-gray-800">{sections.actionItems || '—'}</div>
                        </div>
                      </div>
                      <div className="rounded-lg border bg-gray-50 p-4 flex items-center justify-between">
                        <div className="text-xs font-semibold text-gray-700">Call Rating</div>
                        <div className="text-sm text-gray-900">
                          {rating ? (
                            <span>
                              <span className="text-yellow-600">{'★'.repeat(rating)}</span>
                              <span className="text-gray-300">{'★'.repeat(5 - rating)}</span> ({rating}/5)
                            </span>
                          ) : (
                            '—'
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="text-sm text-gray-600">Summary not available.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Audit modal */}
      {auditOpen ? (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-3xl max-h-[80vh] rounded-xl shadow-lg overflow-hidden flex flex-col">
            <div className="bg-emerald-700 text-white px-5 py-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-lg font-semibold">Call Audit</div>
                <div className="text-xs opacity-90 truncate">Call ID: {auditCall?.callid || auditCall?.id || '—'}</div>
              </div>
              <button type="button" className="text-white/80 hover:text-white text-xl" onClick={closeAudit}>
                ×
              </button>
            </div>

            <div className="p-5 space-y-4 flex-1 overflow-auto">
              {auditError ? (
                <div className="text-xs sm:text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {auditError}
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border bg-emerald-50 p-4">
                  <div className="text-xs text-gray-600">Customer</div>
                  <div className="text-xl font-semibold text-gray-900">{auditCall?.cnumber || '—'}</div>
                </div>
                <div className="rounded-lg border bg-emerald-50 p-4">
                  <div className="text-xs text-gray-600">Agent</div>
                  <div className="text-xl font-semibold text-gray-900">
                    {auditCall?.assignee_name ||
                      auditCall?.assignee_email ||
                      auditCall?.assignee_phone ||
                      auditCall?.assigned_user_id ||
                      '—'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-600">Audit Status</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={auditForm.audit_status}
                    onChange={(e) => setAuditForm((f) => ({ ...f, audit_status: e.target.value }))}
                    disabled={auditLoading || auditSaving}
                  >
                    <option value="">Select status...</option>
                    <option value="PASS">PASS</option>
                    <option value="FAIL">FAIL</option>
                    <option value="NEEDS_IMPROVEMENT">NEEDS_IMPROVEMENT</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Score</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={auditForm.audit_score}
                    onChange={(e) => setAuditForm((f) => ({ ...f, audit_score: e.target.value }))}
                    disabled={auditLoading || auditSaving}
                  >
                    <option value="">—</option>
                    <option value="5">5</option>
                    <option value="4">4</option>
                    <option value="3">3</option>
                    <option value="2">2</option>
                    <option value="1">1</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600">Feedback</label>
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm min-h-[140px]"
                  placeholder="Write audit notes / feedback..."
                  value={auditForm.feedback}
                  onChange={(e) => setAuditForm((f) => ({ ...f, feedback: e.target.value }))}
                  disabled={auditLoading || auditSaving}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" className="btn btn-outline text-sm px-5 py-2" onClick={closeAudit} disabled={auditSaving}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn text-sm px-5 py-2 bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60"
                  onClick={saveAudit}
                  disabled={auditSaving || auditLoading || !auditForm.audit_status}
                >
                  {auditSaving ? 'Saving…' : 'Save Audit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Mechanic coverage modal */}
      {mechCoverageOpen ? (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Mechanic Coverage</h2>
                <div className="text-xs text-gray-500">Where we can provide service (from mechanic service areas)</div>
              </div>
              <button
                type="button"
                className="btn btn-outline text-xs px-3 py-1.5"
                onClick={() => setMechCoverageOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-auto">
              {mechCoverageError ? (
                <div className="text-sm text-red-600">{mechCoverageError}</div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border bg-gray-50 p-3">
                  <div className="text-xs text-gray-600">Total Mechanics (All)</div>
                  <div className="text-lg font-semibold">{mechCoverage?.kpis.total_mechanics_all ?? mechCoverage?.kpis.total_mechanics ?? '—'}</div>
                </div>
                <div className="rounded-lg border bg-gray-50 p-3">
                  <div className="text-xs text-gray-600">Active Mechanics</div>
                  <div className="text-lg font-semibold">{mechCoverage?.kpis.total_mechanics_active ?? '—'}</div>
                </div>
                <div className="rounded-lg border bg-gray-50 p-3">
                  <div className="text-xs text-gray-600">Active With Coverage</div>
                  <div className="text-lg font-semibold">{mechCoverage?.kpis.mechanics_with_coverage ?? '—'}</div>
                  <div className="text-[10px] text-gray-500">Scope: {mechCoverage?.kpis.breakdown_scope || 'active'}</div>
                </div>
              </div>

              <div className="text-[11px] text-gray-600">
                Note: KPI card shows <b>All mechanics</b>, but coverage breakdown is based on <b>active</b> mechanics (serviceable areas).
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={mechCoverageTab === 'state' ? 'btn btn-primary text-xs px-3 py-1.5' : 'btn btn-outline text-xs px-3 py-1.5'}
                  onClick={() => setMechCoverageTab('state')}
                >
                  State-wise
                </button>
                <button
                  type="button"
                  className={mechCoverageTab === 'district' ? 'btn btn-primary text-xs px-3 py-1.5' : 'btn btn-outline text-xs px-3 py-1.5'}
                  onClick={() => setMechCoverageTab('district')}
                >
                  District-wise
                </button>
                {mechCoverageLoading ? <div className="text-xs text-gray-500 ml-2">Loading…</div> : null}
              </div>

              <div className="overflow-auto border rounded-lg">
                {mechCoverageTab === 'state' ? (
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr className="text-left border-b">
                        <th className="py-2 px-3">State</th>
                        <th className="py-2 px-3">Mechanics</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(mechCoverage?.breakdowns.state || []).length === 0 ? (
                        <tr>
                          <td className="py-3 px-3 text-gray-500" colSpan={2}>
                            {mechCoverageLoading ? 'Loading…' : 'No data found.'}
                          </td>
                        </tr>
                      ) : (
                        (mechCoverage?.breakdowns.state || []).map((r) => (
                          <tr key={r.state} className="border-b last:border-b-0">
                            <td className="py-2 px-3 font-semibold">
                              <button
                                type="button"
                                className="text-blue-600 hover:text-blue-700"
                                title="Click to view districts"
                                onClick={() => {
                                  setMechCoverageFilterState(r.state);
                                  setMechCoverageTab('district');
                                }}
                              >
                                {r.state}
                              </button>
                            </td>
                            <td className="py-2 px-3">{r.mechanics}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : (
                  <div>
                    {mechCoverageFilterState ? (
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
                        <div className="text-xs text-gray-700">
                          Filter: <b>{mechCoverageFilterState}</b>
                        </div>
                        <button
                          type="button"
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                          onClick={() => setMechCoverageFilterState('')}
                        >
                          Clear
                        </button>
                      </div>
                    ) : null}
                    <table className="min-w-full text-xs sm:text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr className="text-left border-b">
                        <th className="py-2 px-3">District</th>
                        <th className="py-2 px-3">State</th>
                        <th className="py-2 px-3">Mechanics</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(mechCoverage?.breakdowns.district || []).length === 0 ? (
                        <tr>
                          <td className="py-3 px-3 text-gray-500" colSpan={3}>
                            {mechCoverageLoading ? 'Loading…' : 'No data found.'}
                          </td>
                        </tr>
                      ) : (
                        (mechCoverage?.breakdowns.district || [])
                          .filter((r) => (mechCoverageFilterState ? r.state === mechCoverageFilterState : true))
                          .map((r, idx) => (
                            <tr key={`${r.district}-${r.state}-${idx}`} className="border-b last:border-b-0">
                              <td className="py-2 px-3 font-semibold">
                                <button
                                  type="button"
                                  className="text-blue-600 hover:text-blue-700"
                                  title="Click to view mechanics list"
                                  onClick={() => openMechanicsList({ state: r.state, district: r.district })}
                                >
                                  {r.district}
                                </button>
                              </td>
                              <td className="py-2 px-3">{r.state}</td>
                              <td className="py-2 px-3">{r.mechanics}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Mechanics list modal (drill-down) */}
      {mechListOpen ? (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Mechanics - {mechListTitle || '—'}</h2>
                {mechListLoading ? <div className="text-xs text-gray-500">Loading…</div> : null}
              </div>
              <button
                type="button"
                className="btn btn-outline text-xs px-3 py-1.5"
                onClick={() => setMechListOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="p-4 space-y-2 flex-1 overflow-auto">
              {mechListError ? <div className="text-sm text-red-600">{mechListError}</div> : null}
              <div className="text-xs text-gray-600">Total mechanics: <b>{mechList.length}</b></div>

              <div className="overflow-auto border rounded-lg">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr className="text-left border-b">
                      <th className="py-2 px-3">Mechanic</th>
                      <th className="py-2 px-3">Phone</th>
                      <th className="py-2 px-3">Code</th>
                      <th className="py-2 px-3">Matched pincodes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mechListLoading ? (
                      <tr>
                        <td className="py-3 px-3 text-gray-500" colSpan={4}>Loading…</td>
                      </tr>
                    ) : mechList.length === 0 ? (
                      <tr>
                        <td className="py-3 px-3 text-gray-500" colSpan={4}>No mechanics found.</td>
                      </tr>
                    ) : (
                      mechList.map((m) => (
                        <tr key={m.id} className="border-b last:border-b-0">
                          <td className="py-2 px-3 font-semibold">{m.mechanic_name || '—'}</td>
                          <td className="py-2 px-3">{m.number || '—'}</td>
                          <td className="py-2 px-3">{m.code || '—'}</td>
                          <td className="py-2 px-3">
                            <div className="text-[11px] text-gray-700">
                              <b>{m.matched_pincode_count}</b>
                              {Array.isArray(m.matched_pincodes) && m.matched_pincodes.length ? (
                                <span className="text-gray-500"> • {m.matched_pincodes.join(', ')}</span>
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
