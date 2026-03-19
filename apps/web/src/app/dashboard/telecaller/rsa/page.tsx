'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { RSALeadCreateForm } from '@/components/telecaller/RSALeadCreateForm';
import WhatsAppMobilePreviewModal from '@/components/shared/WhatsAppMobilePreviewModal';
import { formatDateTimeIST, formatDateTimeISTAssumeUTC } from '@/lib/utils';
import Link from 'next/link';
import { Award, CheckCircle, Clock, Copy, ExternalLink, FileText, Pencil, PhoneCall, RefreshCw, Target, TrendingUp } from 'lucide-react';

type TelecallerPerformanceData = {
  callsReceived: number;
  registeredCount: number;
  totalQuotedAmount: number;
  todayFollowUpsDue: number;
  highPriorityPending: number;
  noRecording: number;
  noSummary: number;
  noDisposition: number;
  callTotal: number;
  funnel: { registered: number; inProgress: number; completed: number; dropOffPercent: number };
  avgTalkTimeSeconds: number | null;
  bestWindow: { key: string; label: string; count: number; completionRate: number } | null;
  personalQuality: {
    auditedCount: number;
    avgScore: number | null;
    lastFeedbackHighlights: { sarv_call_id: string; audit_score: number; feedback: string }[];
  };
  needsAttention: { id: string; customer_name: string; contact_number: string; lead_status: string; lead_registered_at: string }[];
  callsWithoutDisposition: { id: string; cnumber: string; created_at: string }[];
};

type TabKey = 'overview' | 'create' | 'created' | 'call_report' | 'car_service' | 'collect_payment';

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
  has_audit?: boolean;
};

type SarvCallAudit = {
  id: string;
  sarv_call_id: string;
  audit_status: string | null;
  audit_score: number | null;
  feedback: string | null;
  audited_at: string | null;
};

type GeneratedPaymentLink = {
  ref: string;
  link: string;
  amount: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  status: string;
  order_id: string | null;
  payment_id: string | null;
  created_at: string;
  updated_at: string | null;
};

type DirectPayStatusRow = {
  link_ref: string;
  order_id: string | null;
  payment_id: string | null;
  status: string | null;
  updated_at: string | null;
};

const DISPOSITION_OPTIONS = [
  'Registered',
  'Wrong Number',
  'Cancelled by Customer',
  'Follow-up Required',
  // keep only the allowed dispositions for telecaller
  'Out of Service Area',
  'Spam/Unwanted',
  'Test Call',
];

const SERVICE_TYPE_OPTIONS = [
  'Flat Tyre',
  'Towing',
  'Fuel Delivery',
  'Jump Start',
  'Car Service',
  'Other',
];

function formatDuration(seconds?: number | null) {
  if (!Number.isFinite(seconds as number)) return '—';
  const total = Math.max(0, Number(seconds));
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
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

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeCityValue(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function titleCase(value: string) {
  const cleaned = normalizeCityValue(value);
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function matchesCity(city: string, query: string) {
  return city.toLowerCase().includes(query.toLowerCase());
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
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  let current: keyof typeof out = 'other';
  for (const line of lines) {
    const clean = line.replace(/^\s*[-•]\s*/, '').replace(/\*\*/g, '').trim();
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
function parseDispositionExtras(raw?: string | null) {
  if (!raw) return { note: '', service_type: '', price: '', city: '' };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        note: String(parsed.note || ''),
        service_type: String(parsed.service_type || ''),
        price: parsed.price != null ? String(parsed.price) : '',
        city: String(parsed.city || ''),
      };
    }
  } catch {
    // ignore parse errors
  }
  return { note: raw, service_type: '', price: '', city: '' };
}

function buildDispositionNote(form: { note: string; service_type: string; price: string; city: string }) {
  const note = String(form.note || '').trim();
  const service_type = String(form.service_type || '').trim();
  const city = titleCase(String(form.city || ''));
  const priceRaw = String(form.price || '').trim();
  const price = priceRaw ? Number(priceRaw) : null;
  const hasExtras = service_type || city || priceRaw;
  if (hasExtras) {
    return JSON.stringify({
      note: note || '',
      service_type,
      price: Number.isFinite(price as number) ? price : priceRaw,
      city,
    });
  }
  return note || null;
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
        active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function statusLabel(value: string) {
  return String(value || '')
    .replace(/[_\-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function statusBadgeClass(value: string) {
  const s = String(value || '').trim().toLowerCase();
  if (s === 'cancelled' || s === 'canceled') return 'bg-red-100 text-red-700 border-red-200';
  if (s === 'completed' || s === 'closed') return 'bg-green-100 text-green-700 border-green-200';
  if (s === 'pending' || s === 'registered') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (s === 'in_progress' || s === 'in progress') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (s.includes('assigned')) return 'bg-purple-100 text-purple-700 border-purple-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function leadRowClass(value: string) {
  const s = String(value || '').trim().toLowerCase();
  if (s === 'cancelled' || s === 'canceled') return 'bg-red-50';
  if (s === 'completed' || s === 'closed') return 'bg-green-50';
  if (s === 'pending' || s === 'registered') return 'bg-amber-50';
  if (s === 'in_progress' || s === 'in progress') return 'bg-blue-50';
  if (s.includes('assigned')) return 'bg-purple-50';
  return '';
}

function paymentStatusBadgeClass(value: string) {
  const s = String(value || '').trim().toUpperCase();
  if (s === 'SUCCESS' || s === 'PAID') return 'bg-green-100 text-green-700 border-green-200';
  if (s === 'REFUNDED') return 'bg-purple-100 text-purple-700 border-purple-200';
  if (s === 'PARTIALLY_REFUNDED') return 'bg-indigo-100 text-indigo-700 border-indigo-200';
  if (s === 'CREATED') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (s === 'FAILED') return 'bg-red-100 text-red-700 border-red-200';
  if (s === 'CANCELLED' || s === 'CANCELED') return 'bg-red-100 text-red-700 border-red-200';
  if (s === 'LINK_GENERATED') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function paymentStatusLabel(value: string) {
  const s = String(value || '').trim().toUpperCase();
  if (s === 'LINK_GENERATED') return 'Link Generated';
  if (s === 'CREATED') return 'Pending Payment';
  if (s === 'SUCCESS') return 'Paid';
  if (s === 'REFUNDED') return 'Refunded';
  if (s === 'PARTIALLY_REFUNDED') return 'Partially Refunded';
  if (s === 'FAILED') return 'Failed';
  if (s === 'CANCELLED' || s === 'CANCELED') return 'Cancelled';
  return statusLabel(value || 'Unknown');
}

function createPaymentLinkRef() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length <= 10 ? digits : digits.slice(-10);
}

export default function TelecallerRSAPage() {
  const formatNaiveDateTimeAsISTWallClock = (rawValue: string) => {
    const raw = String(rawValue || '').trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return '';
    const day = m[3];
    const month = m[2];
    const year = m[1];
    const h24 = Number(m[4]);
    const min = m[5];
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${day}-${month}-${year} ${String(h12).padStart(2, '0')}:${min} ${ampm}`;
  };

  const formatDateTimeForPanel = (value: string | null | undefined) => {
    if (!value) return '—';
    const raw = String(value).trim();
    if (!raw) return '—';
    const hasTimezone = /([zZ]|[+\-]\d{2}(:?\d{2})?)$/.test(raw);
    if (hasTimezone) return formatDateTimeIST(raw) || '—';
    const naive = formatNaiveDateTimeAsISTWallClock(raw);
    if (naive) return naive;
    return formatDateTimeIST(raw) || '—';
  };

  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [error, setError] = useState<string>('');
  const [createdLoading, setCreatedLoading] = useState(false);
  const [createdLeads, setCreatedLeads] = useState<any[]>([]);
  const [createdError, setCreatedError] = useState<string>('');
  const [callLoading, setCallLoading] = useState(false);
  const [callError, setCallError] = useState('');
  const [calls, setCalls] = useState<SarvCallRow[]>([]);
  const [callPage, setCallPage] = useState(1);
  const [callTotal, setCallTotal] = useState(0);
  const [callFilters, setCallFilters] = useState(() => {
    const today = new Date();
    const from = addDays(today, -7);
    return {
      from: formatDateInput(from),
      to: formatDateInput(today),
      q: '',
      has_recording: false,
      has_audit: '',
      limit: 50,
    };
  });
  const [cities, setCities] = useState<string[]>([]);
  const [dispositionOpen, setDispositionOpen] = useState(false);
  const [dispositionCall, setDispositionCall] = useState<SarvCallRow | null>(null);
  const [dispositionForm, setDispositionForm] = useState({
    service_type: '',
    disposition: '',
    price: '',
    city: '',
    disposition_note: '',
  });
  const [citySuggestOpen, setCitySuggestOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryCall, setSummaryCall] = useState<SarvCallRow | null>(null);
  const [transcriptionView, setTranscriptionView] = useState<'raw' | 'split'>('raw');
  const [swapSpeakers, setSwapSpeakers] = useState(false);
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditCall, setAuditCall] = useState<SarvCallRow | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditByCallId, setAuditByCallId] = useState<Record<string, SarvCallAudit | null>>({});
  const [waPreviewOpen, setWaPreviewOpen] = useState(false);
  const [waPreviewPhone, setWaPreviewPhone] = useState('');
  const [waPreviewMessage, setWaPreviewMessage] = useState('');
  const [waPreviewCustomerName, setWaPreviewCustomerName] = useState('');
  const [waQuickPhone, setWaQuickPhone] = useState('');

  const groupedCalls = useMemo(() => groupCallsByCustomer(calls), [calls]);
  const openWhatsAppPreview = (phone: string | null | undefined, row?: SarvCallRow | null, custName?: string) => {
    const value = normalizePhone(phone);
    if (!value) return;
    const summary = String(row?.summary || '').trim();
    const disposition = String(row?.disposition || row?.disposition_category || '').trim();
    const suggested =
      summary ||
      (disposition ? `Hi, aapke recent call (${disposition}) ke follow-up ke liye message kar raha hoon.` : '');
    setWaPreviewPhone(value);
    setWaPreviewMessage(suggested);
    setWaPreviewOpen(true);
    setWaQuickPhone(value);
    const nameFromPayments = generatedPayments.find(
      (p) => normalizePhone(p.customer_phone) === value && p.customer_name
    )?.customer_name || '';
    setWaPreviewCustomerName(custName || nameFromPayments || '');
  };
  const [sarvOpen, setSarvOpen] = useState(false);
  const [sarvLead, setSarvLead] = useState<any | null>(null);
  const [sarvCalls, setSarvCalls] = useState<any[]>([]);
  const [sarvLoading, setSarvLoading] = useState(false);
  const [sarvError, setSarvError] = useState('');
  const [carForm, setCarForm] = useState({
    customer_name: '',
    customer_phone: '',
    car_model: '',
    remark: '',
  });
  const [carSubmitLoading, setCarSubmitLoading] = useState(false);
  const [carSubmitError, setCarSubmitError] = useState('');
  const [carSubmitSuccess, setCarSubmitSuccess] = useState('');
  const [carViewOpen, setCarViewOpen] = useState(false);
  const [carViewLoading, setCarViewLoading] = useState(false);
  const [carViewError, setCarViewError] = useState('');
  const [carEnquiries, setCarEnquiries] = useState<any[]>([]);
  const [collectForm, setCollectForm] = useState({
    amount: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
  });
  const [collectError, setCollectError] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copySuccess, setCopySuccess] = useState('');
  const [collectRefreshLoading, setCollectRefreshLoading] = useState(false);
  const [collectRefreshError, setCollectRefreshError] = useState('');
  const [generatedPayments, setGeneratedPayments] = useState<GeneratedPaymentLink[]>([]);
  const [cancelLinkLoadingRef, setCancelLinkLoadingRef] = useState('');
  const [editLead, setEditLead] = useState<any | null>(null);
  const [editLeadLoading, setEditLeadLoading] = useState(false);
  const [leadStatusFilter, setLeadStatusFilter] = useState('');
  const [overviewDateRange, setOverviewDateRange] = useState(() => {
    const today = new Date();
    const from = addDays(today, -6);
    return {
      from: formatDateInput(from),
      to: formatDateInput(today),
    };
  });
  const OVERVIEW_PAGE_SIZE = 10;
  const [overviewPage, setOverviewPage] = useState(1);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelLead, setCancelLead] = useState<any | null>(null);
  const [cancelRemark, setCancelRemark] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [performanceOverview, setPerformanceOverview] = useState<TelecallerPerformanceData | null>(null);
  const [performanceOverviewLoading, setPerformanceOverviewLoading] = useState(false);
  const [hoveredServicePie, setHoveredServicePie] = useState<{ name: string; count: number; percent: number } | null>(null);

  const overviewLeadsInRange = useMemo(() => {
    const fromTs = overviewDateRange.from ? new Date(`${overviewDateRange.from}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const toTs = overviewDateRange.to ? new Date(`${overviewDateRange.to}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;

    if (!Number.isFinite(fromTs) || !Number.isFinite(toTs)) return leads;

    return leads.filter((row) => {
      const raw = row?.lead_registered_at || row?.requested_at;
      if (!raw) return false;
      const ts = new Date(raw).getTime();
      if (!Number.isFinite(ts)) return false;
      return ts >= fromTs && ts <= toTs;
    });
  }, [leads, overviewDateRange.from, overviewDateRange.to]);

  const stats = useMemo(() => {
    const total = overviewLeadsInRange.length;
    const pending = overviewLeadsInRange.filter((l) => String(l?.lead_status || '').toLowerCase() === 'pending').length;
    const completed = overviewLeadsInRange.filter((l) => String(l?.lead_status || '').toLowerCase() === 'completed').length;
    return { total, pending, completed };
  }, [overviewLeadsInRange]);

  const overviewServiceBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const lead of overviewLeadsInRange) {
      const s = String(lead?.service_type || 'Other').trim() || 'Other';
      map[s] = (map[s] || 0) + 1;
    }
    const total = overviewLeadsInRange.length;
    return Object.entries(map)
      .map(([name, count]) => ({
        name,
        count,
        percent: total ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [overviewLeadsInRange]);

  const getLeadStatusKey = (lead: any) =>
    String(lead?.lead_status || lead?.complaint_status || '')
      .trim()
      .toLowerCase();

  const statusFilterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of [...leads, ...createdLeads]) {
      const key = getLeadStatusKey(row);
      if (key) set.add(key);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [leads, createdLeads]);

  const filteredLeads = useMemo(() => {
    if (!leadStatusFilter) return overviewLeadsInRange;
    return overviewLeadsInRange.filter((row) => getLeadStatusKey(row) === leadStatusFilter);
  }, [overviewLeadsInRange, leadStatusFilter]);

  const overviewTotalPages = Math.max(1, Math.ceil(filteredLeads.length / OVERVIEW_PAGE_SIZE));

  const paginatedLeads = useMemo(() => {
    const start = (overviewPage - 1) * OVERVIEW_PAGE_SIZE;
    return filteredLeads.slice(start, start + OVERVIEW_PAGE_SIZE);
  }, [filteredLeads, overviewPage]);

  useEffect(() => {
    if (overviewPage > overviewTotalPages) {
      setOverviewPage(overviewTotalPages);
    }
  }, [overviewPage, overviewTotalPages]);

  useEffect(() => {
    setOverviewPage(1);
  }, [overviewDateRange.from, overviewDateRange.to]);

  useEffect(() => {
    let mounted = true;
    const fromISO = new Date(`${overviewDateRange.from}T00:00:00`).toISOString();
    const toISO = new Date(`${overviewDateRange.to}T23:59:59.999`).toISOString();
    setPerformanceOverviewLoading(true);
    fetch(
      `/api/telecaller/performance-overview?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (mounted && !data.error) setPerformanceOverview(data);
      })
      .catch(() => {
        if (mounted) setPerformanceOverview(null);
      })
      .finally(() => {
        if (mounted) setPerformanceOverviewLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [overviewDateRange.from, overviewDateRange.to]);

  const filteredCreatedLeads = useMemo(() => {
    if (!leadStatusFilter) return createdLeads;
    return createdLeads.filter((row) => getLeadStatusKey(row) === leadStatusFilter);
  }, [createdLeads, leadStatusFilter]);

  const fetchLeads = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/telecaller/rsa-complaints?limit=200');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load RSA leads');
      setLeads(Array.isArray(json?.leads) ? json.leads : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load RSA leads');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCreatedLeads = async () => {
    setCreatedLoading(true);
    setCreatedError('');
    try {
      // Show ONLY RSA leads created by this telecaller
      const res = await fetch('/api/telecaller/rsa-complaints?limit=200');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load created leads');
      setCreatedLeads(Array.isArray(json?.leads) ? json.leads : []);
    } catch (e: any) {
      setCreatedError(e?.message || 'Failed to load created leads');
      setCreatedLeads([]);
    } finally {
      setCreatedLoading(false);
    }
  };

  const fetchCities = async () => {
    try {
      const res = await fetch('/api/rsa/cities');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load cities');
      const normalized = Array.isArray(json?.cities)
        ? json.cities
            .map((c: string) => titleCase(c))
            .filter((c: string) => c)
        : [];
      const unique = Array.from(new Set(normalized.map((c) => c.toLowerCase()))).map(
        (lc) => normalized.find((c) => c.toLowerCase() === lc) as string
      );
      setCities(unique);
    } catch {
      setCities([]);
    }
  };

  const fetchCarEnquiries = async () => {
    setCarViewLoading(true);
    setCarViewError('');
    try {
      const res = await fetch('/api/telecaller/car-service-enquiries?limit=200');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load enquiries');
      setCarEnquiries(Array.isArray(json?.enquiries) ? json.enquiries : []);
    } catch (e: any) {
      setCarViewError(e?.message || 'Failed to load enquiries');
      setCarEnquiries([]);
    } finally {
      setCarViewLoading(false);
    }
  };

  const submitCarEnquiry = async () => {
    setCarSubmitLoading(true);
    setCarSubmitError('');
    setCarSubmitSuccess('');
    try {
      const res = await fetch('/api/telecaller/car-service-enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: carForm.customer_name,
          customer_phone: carForm.customer_phone,
          car_model: carForm.car_model,
          remark: carForm.remark,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to submit enquiry');
      setCarSubmitSuccess('Enquiry submitted successfully.');
      setCarForm({ customer_name: '', customer_phone: '', car_model: '', remark: '' });
      if (carViewOpen) {
        fetchCarEnquiries();
      }
    } catch (e: any) {
      setCarSubmitError(e?.message || 'Failed to submit enquiry');
    } finally {
      setCarSubmitLoading(false);
    }
  };

  const fetchGeneratedPaymentLinks = async () => {
    setCollectRefreshLoading(true);
    setCollectRefreshError('');
    try {
      const res = await fetch('/api/telecaller/direct-pay-links?limit=200');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load payment links');
      const rows = Array.isArray(json?.rows) ? json.rows : [];
      setGeneratedPayments(
        rows.map((row: any) => ({
          ref: String(row?.ref || ''),
          link: String(row?.link || ''),
          amount: Number(row?.amount || 0),
          customer_name: String(row?.customer_name || ''),
          customer_phone: String(row?.customer_phone || ''),
          customer_email: String(row?.customer_email || ''),
          status: String(row?.status || 'LINK_GENERATED'),
          order_id: row?.order_id ? String(row.order_id) : null,
          payment_id: row?.payment_id ? String(row.payment_id) : null,
          created_at: String(row?.created_at || new Date().toISOString()),
          updated_at: row?.updated_at ? String(row.updated_at) : null,
        }))
      );
    } catch (e: any) {
      setCollectRefreshError(e?.message || 'Failed to load payment links');
    } finally {
      setCollectRefreshLoading(false);
    }
  };

  const generatePaymentLink = async () => {
    setCollectError('');
    setCopySuccess('');
    const amount = Number(collectForm.amount);
    const customerName = collectForm.customer_name.trim();
    const customerPhone = collectForm.customer_phone.trim();
    const customerEmail = collectForm.customer_email.trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      setCollectError('Please enter a valid amount.');
      setGeneratedLink('');
      return;
    }
    if (!customerName) {
      setCollectError('Please enter customer name.');
      setGeneratedLink('');
      return;
    }
    if (!customerPhone) {
      setCollectError('Please enter customer phone.');
      setGeneratedLink('');
      return;
    }

    const params = new URLSearchParams();
    params.set('amount', String(amount));
    params.set('name', customerName);
    params.set('phone', customerPhone);
    const linkRef = createPaymentLinkRef();
    params.set('ref', linkRef);
    if (customerEmail) {
      params.set('email', customerEmail);
    }

    const envBaseUrl = String(process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
    const baseUrl =
      envBaseUrl ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    const link = `${baseUrl}/pay-now?${params.toString()}`;
    try {
      const res = await fetch('/api/telecaller/direct-pay-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: linkRef,
          link,
          amount,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to save payment link');

      const row = json?.row || null;
      if (row) {
        setGeneratedPayments((prev) => {
          const next = prev.filter((item) => item.ref !== String(row.ref || ''));
          next.unshift({
            ref: String(row.ref || ''),
            link: String(row.link || link),
            amount: Number(row.amount || amount),
            customer_name: String(row.customer_name || customerName),
            customer_phone: String(row.customer_phone || customerPhone),
            customer_email: String(row.customer_email || customerEmail),
            status: String(row.status || 'LINK_GENERATED'),
            order_id: row.order_id ? String(row.order_id) : null,
            payment_id: row.payment_id ? String(row.payment_id) : null,
            created_at: String(row.created_at || new Date().toISOString()),
            updated_at: row.updated_at ? String(row.updated_at) : null,
          });
          return next;
        });
      } else {
        fetchGeneratedPaymentLinks();
      }
      setGeneratedLink(link);
      setCopySuccess('Payment link generated.');
    } catch (e: any) {
      setCollectError(e?.message || 'Failed to save payment link');
      setGeneratedLink('');
    }
  };

  const copyPaymentLink = async (linkValue?: string) => {
    const toCopy = linkValue || generatedLink;
    if (!toCopy) return;
    setCopySuccess('');
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopySuccess('Payment link copied.');
    } catch {
      setCollectError('Unable to copy link. Please copy manually.');
    }
  };

  const canCancelLink = (statusValue: string) => {
    const status = String(statusValue || '').trim().toUpperCase();
    return status === 'LINK_GENERATED' || status === 'CREATED' || status === 'FAILED';
  };

  const cancelGeneratedPaymentLink = async (ref: string) => {
    if (!ref) return;
    const ok = window.confirm('Customer ne mana kiya hai? Is payment link ko cancel karna hai?');
    if (!ok) return;

    setCollectError('');
    setCopySuccess('');
    setCollectRefreshError('');
    setCancelLinkLoadingRef(ref);
    try {
      const res = await fetch('/api/telecaller/direct-pay-links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to cancel payment link');
      setGeneratedPayments((prev) =>
        prev.map((item) =>
          item.ref === ref
            ? {
                ...item,
                status: 'CANCELLED',
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );
      setCopySuccess('Payment link cancelled.');
    } catch (e: any) {
      setCollectRefreshError(e?.message || 'Failed to cancel payment link');
    } finally {
      setCancelLinkLoadingRef('');
    }
  };

  const refreshGeneratedPaymentStatuses = async () => {
    const refs = Array.from(new Set(generatedPayments.map((row) => row.ref).filter(Boolean)));
    if (refs.length === 0) return;

    setCollectRefreshLoading(true);
    setCollectRefreshError('');
    try {
      const res = await fetch('/api/telecaller/direct-pay-links/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refs }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to refresh payment status');
      const rows: DirectPayStatusRow[] = Array.isArray(json?.rows) ? json.rows : [];
      const byRef = new Map<string, DirectPayStatusRow>();
      for (const row of rows) {
        const ref = String(row?.link_ref || '').trim();
        if (ref) byRef.set(ref, row);
      }

      setGeneratedPayments((prev) =>
        prev.map((item) => {
          const matched = byRef.get(item.ref);
          if (!matched) return item;
          return {
            ...item,
            status: String(matched.status || item.status),
            order_id: matched.order_id || item.order_id,
            payment_id: matched.payment_id || item.payment_id,
            updated_at: matched.updated_at || item.updated_at,
          };
        })
      );
    } catch (e: any) {
      setCollectRefreshError(e?.message || 'Failed to refresh payment status');
    } finally {
      setCollectRefreshLoading(false);
    }
  };

  const findLeadByPhone = (rows: any[], phoneValue: string) => {
    const target = normalizePhone(phoneValue);
    if (!target) return null;
    return (
      rows.find((row: any) => {
        const primary = normalizePhone(row?.contact_number);
        const alternate = normalizePhone(row?.alternate_number);
        return primary === target || alternate === target;
      }) || null
    );
  };

  const viewComplaintByPhone = async (phoneValue: string) => {
    const targetPhone = normalizePhone(phoneValue);
    if (!targetPhone) {
      setCollectError('Valid customer phone not available.');
      return;
    }

    setCollectError('');
    let matchedLead = findLeadByPhone(createdLeads, targetPhone) || findLeadByPhone(leads, targetPhone);

    if (!matchedLead) {
      try {
        const res = await fetch('/api/telecaller/rsa-complaints?limit=200');
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Failed to load complaints');
        const latestLeads = Array.isArray(json?.leads) ? json.leads : [];
        setCreatedLeads(latestLeads);
        matchedLead = findLeadByPhone(latestLeads, targetPhone);
      } catch (e: any) {
        setCollectError(e?.message || 'Failed to load complaints');
        return;
      }
    }

    if (!matchedLead?.id) {
      setCollectError('Is number se koi complaint nahi mili.');
      return;
    }

    router.push(`/dashboard/telecaller/rsa/complaints/${encodeURIComponent(String(matchedLead.id))}`);
  };

  const openComplaintDetails = (lead: any) => {
    if (!lead?.id) return;
    router.push(`/dashboard/telecaller/rsa/complaints/${encodeURIComponent(String(lead.id))}`);
  };

  const fetchCalls = async () => {
    setCallLoading(true);
    setCallError('');
    try {
      const params = new URLSearchParams();
      if (callFilters.from) {
        params.set('from', new Date(`${callFilters.from}T00:00:00`).toISOString());
      }
      if (callFilters.to) {
        params.set('to', new Date(`${callFilters.to}T23:59:59`).toISOString());
      }
      if (callFilters.q.trim()) {
        params.set('q', callFilters.q.trim());
      }
      if (callFilters.has_recording) {
        params.set('has_recording', 'true');
      }
      if (callFilters.has_audit === 'true' || callFilters.has_audit === 'false') {
        params.set('has_audit', callFilters.has_audit);
      }
      params.set('limit', String(callFilters.limit));
      params.set('page', String(callPage));

      const res = await fetch(`/api/telecaller/sarv-calls?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load calls');
      setCalls(Array.isArray(json?.calls) ? json.calls : []);
      setCallTotal(Number(json?.pagination?.total || 0));
    } catch (e: any) {
      setCallError(e?.message || 'Failed to load calls');
      setCalls([]);
      setCallTotal(0);
    } finally {
      setCallLoading(false);
    }
  };

  const openDisposition = (call: SarvCallRow) => {
    const extras = parseDispositionExtras(call.disposition_note);
    setDispositionCall(call);
    setDispositionForm({
      service_type: call.disposition_category || extras.service_type || '',
      disposition: call.disposition || '',
      price: extras.price || '',
      city: extras.city || '',
      disposition_note: extras.note || '',
    });
    setDispositionOpen(true);
  };

  const openSummary = (call: SarvCallRow) => {
    setSummaryCall(call);
    setSummaryOpen(true);
    setTranscriptionView('raw');
    setSwapSpeakers(false);
  };

  const closeSummary = () => {
    setSummaryOpen(false);
    setSummaryCall(null);
    setTranscriptionView('raw');
    setSwapSpeakers(false);
  };

  const openAudit = async (call: SarvCallRow) => {
    setAuditCall(call);
    setAuditOpen(true);
    setAuditError('');
    if (!call?.id) return;

    setAuditLoading(true);
    try {
      const res = await fetch(`/api/sarv-calls/${encodeURIComponent(String(call.id))}/audit`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load audit');
      const audit = (json?.audit || null) as SarvCallAudit | null;
      setAuditByCallId((prev) => ({ ...prev, [call.id]: audit }));
    } catch (e: any) {
      setAuditError(e?.message || 'Failed to load audit');
      setAuditByCallId((prev) => ({ ...prev, [call.id]: null }));
    } finally {
      setAuditLoading(false);
    }
  };

  const closeAudit = () => {
    setAuditOpen(false);
    setAuditCall(null);
    setAuditLoading(false);
    setAuditError('');
  };

  const closeDisposition = () => {
    setDispositionOpen(false);
    setDispositionCall(null);
  };

  const saveDisposition = async () => {
    if (!dispositionCall?.id) return;
    const payloadNote = buildDispositionNote({
      note: dispositionForm.disposition_note,
      service_type: dispositionForm.service_type,
      price: dispositionForm.price,
      city: dispositionForm.city,
    });
    const payload = {
      disposition: dispositionForm.disposition,
      disposition_category: dispositionForm.service_type || null,
      disposition_note: payloadNote,
    };
    try {
      const res = await fetch(`/api/sarv-calls/${dispositionCall.id}/disposition`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to save disposition');
      setDispositionOpen(false);
      setDispositionCall(null);
      fetchCalls();
    } catch (e: any) {
      alert(e?.message || 'Failed to save disposition');
    }
  };

  const formatDateTime = (value: string | null | undefined) => {
    return formatDateTimeForPanel(value);
  };

  const formatDateTimeISTLocal = (value: string | null | undefined) => {
    return formatDateTimeForPanel(value);
  };

  const formatDateTimeISTFromUTC = (value: string | null | undefined) => {
    if (!value) return '—';
    return formatDateTimeISTAssumeUTC(value) || '—';
  };

  const isPendingComplaint = (lead: any) => {
    const leadStatus = String(lead?.lead_status || '').trim().toLowerCase();
    const complaintStatus = String(lead?.complaint_status || '').trim().toLowerCase();
    return (
      leadStatus === 'pending' ||
      complaintStatus === 'pending' ||
      complaintStatus === 'registered'
    );
  };

  const openSarvCalls = async (lead: any) => {
    if (!lead?.id) return;
    setSarvLead(lead);
    setSarvOpen(true);
    setSarvLoading(true);
    setSarvError('');
    try {
      const res = await fetch(`/api/telecaller/rsa-complaints/${lead.id}/sarv-calls`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load SARV calls');
      setSarvCalls(Array.isArray(json?.calls) ? json.calls : []);
    } catch (e: any) {
      setSarvError(e?.message || 'Failed to load SARV calls');
      setSarvCalls([]);
    } finally {
      setSarvLoading(false);
    }
  };

  const closeSarvCalls = () => {
    setSarvOpen(false);
    setSarvLead(null);
    setSarvCalls([]);
    setSarvError('');
  };

  const openCancelLead = (lead: any) => {
    setCancelLead(lead);
    setCancelRemark('');
    setCancelError('');
    setCancelOpen(true);
  };

  const closeCancelLead = () => {
    setCancelOpen(false);
    setCancelLead(null);
    setCancelRemark('');
    setCancelError('');
    setCancelLoading(false);
  };

  const submitCancelLead = async () => {
    if (!cancelLead?.id) return;
    setCancelLoading(true);
    setCancelError('');
    try {
      const res = await fetch(`/api/telecaller/rsa-complaints/${encodeURIComponent(String(cancelLead.id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_status: 'cancelled',
          complaint_status: 'cancelled',
          cancelled_remark: cancelRemark.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to cancel complaint');
      closeCancelLead();
      fetchLeads();
      fetchCreatedLeads();
    } catch (e: any) {
      setCancelError(e?.message || 'Failed to cancel complaint');
    } finally {
      setCancelLoading(false);
    }
  };

  const openEditLead = async (lead: any) => {
    if (!lead?.id) return;
    setEditLeadLoading(true);
    setEditLead(null);
    try {
      const res = await fetch(`/api/telecaller/rsa-complaints/${encodeURIComponent(lead.id)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load lead');
      setEditLead(json?.lead || null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load lead');
    } finally {
      setEditLeadLoading(false);
    }
  };

  const closeEditLead = () => {
    setEditLead(null);
  };

  const onLeadUpdated = () => {
    setEditLead(null);
    fetchLeads();
    fetchCreatedLeads();
  };

  useEffect(() => {
    fetchLeads();
    fetchCities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab !== 'call_report') return;
    fetchCalls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, callFilters, callPage]);

  useEffect(() => {
    if (tab !== 'collect_payment') return;
    fetchGeneratedPaymentLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const generatedPaymentRefsKey = useMemo(
    () => generatedPayments.map((row) => row.ref).join('|'),
    [generatedPayments]
  );

  const hasPendingPayments = useMemo(
    () => generatedPayments.some((row) => {
      const s = String(row.status || '').toUpperCase();
      return !['PAID', 'SUCCESS', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED', 'FAILED'].includes(s);
    }),
    [generatedPayments]
  );

  useEffect(() => {
    if (tab !== 'collect_payment') return;
    if (!generatedPaymentRefsKey) return;
    refreshGeneratedPaymentStatuses();
    if (!hasPendingPayments) return;
    const timer = window.setInterval(() => {
      refreshGeneratedPaymentStatuses();
    }, 30000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, generatedPaymentRefsKey, hasPendingPayments]);

  return (
    <DashboardLayout role="telecaller">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5 md:space-y-6 px-3 sm:px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading">RSA</h1>
            <p className="text-text-body text-xs sm:text-sm mt-1 sm:mt-2">
              Overview and creation of RSA leads.
            </p>
          </div>

          {tab === 'overview' ? (
            <button
              type="button"
              className="btn btn-outline text-xs sm:text-sm px-4 py-2 flex items-center gap-2 w-full sm:w-auto"
              onClick={fetchLeads}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          ) : tab === 'created' ? (
            <button
              type="button"
              className="btn btn-outline text-xs sm:text-sm px-4 py-2 flex items-center gap-2 w-full sm:w-auto"
              onClick={fetchCreatedLeads}
              disabled={createdLoading}
            >
              <RefreshCw className={`w-4 h-4 ${createdLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          ) : tab === 'call_report' ? (
            <button
              type="button"
              className="btn btn-outline text-xs sm:text-sm px-4 py-2 flex items-center gap-2 w-full sm:w-auto"
              onClick={fetchCalls}
              disabled={callLoading}
            >
              <RefreshCw className={`w-4 h-4 ${callLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          ) : null}
        </div>

        <div className="flex gap-2">
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
            Overview
          </TabButton>
          <TabButton active={tab === 'create'} onClick={() => setTab('create')}>
            Create RSA lead
          </TabButton>
          <TabButton
            active={tab === 'created'}
            onClick={() => {
              setTab('created');
              if (createdLeads.length === 0) fetchCreatedLeads();
            }}
          >
            Created Leads
          </TabButton>
          <TabButton active={tab === 'car_service'} onClick={() => setTab('car_service')}>
            Car Service Enquiry
          </TabButton>
          <TabButton active={tab === 'collect_payment'} onClick={() => setTab('collect_payment')}>
            Collect Payment
          </TabButton>
          <TabButton active={tab === 'call_report'} onClick={() => setTab('call_report')}>
            Call Report
          </TabButton>
        </div>

        {tab === 'overview' ? (
          <div className="space-y-4">
            {error ? (
              <div className="bg-red-50 border border-red-200 text-red-800 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3 flex flex-wrap items-end justify-between gap-3">
                <div className="text-xs text-gray-600">
                  Overview stats and recent leads are filtered by selected date range (default: last 7 days).
                </div>
                <div className="flex items-end gap-2">
                  <label className="text-xs text-gray-600">
                    From
                    <input
                      type="date"
                      className="block mt-1 border rounded-md px-2 py-1.5 text-xs"
                      value={overviewDateRange.from}
                      max={overviewDateRange.to || undefined}
                      onChange={(e) =>
                        setOverviewDateRange((prev) => ({
                          ...prev,
                          from: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    To
                    <input
                      type="date"
                      className="block mt-1 border rounded-md px-2 py-1.5 text-xs"
                      value={overviewDateRange.to}
                      min={overviewDateRange.from || undefined}
                      onChange={(e) =>
                        setOverviewDateRange((prev) => ({
                          ...prev,
                          to: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
              <div className="card flex items-center gap-3">
                <PhoneCall className="w-5 h-5 text-indigo-600" />
                <div>
                  <div className="text-xs text-gray-600">Calls received</div>
                  <div className="text-lg font-bold text-indigo-600">
                    {performanceOverviewLoading ? '—' : performanceOverview ? performanceOverview.callsReceived : '—'}
                  </div>
                </div>
              </div>
              <div className="card flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-xs text-gray-600">Registered</div>
                  <div className="text-lg font-bold text-blue-600">
                    {performanceOverviewLoading ? '—' : performanceOverview ? performanceOverview.registeredCount : '—'}
                  </div>
                </div>
              </div>
              <div className="card flex items-center gap-3">
                <Target className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="text-xs text-gray-600">Total quoted (completed)</div>
                  <div className="text-lg font-bold text-emerald-700">
                    {performanceOverviewLoading || !performanceOverview
                      ? '—'
                      : `₹${Number(performanceOverview.totalQuotedAmount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                  </div>
                </div>
              </div>
              <div className="card flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-xs text-gray-600">Total leads</div>
                  <div className="text-lg font-bold">{stats.total}</div>
                </div>
              </div>
              <div className="card flex items-center gap-3">
                <Clock className="w-5 h-5 text-orange-600" />
                <div>
                  <div className="text-xs text-gray-600">Pending</div>
                  <div className="text-lg font-bold">{stats.pending}</div>
                </div>
              </div>
              <div className="card flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-xs text-gray-600">Completed</div>
                  <div className="text-lg font-bold">{stats.completed}</div>
                </div>
              </div>
            </div>

            {/* My Daily Focus */}
            <div className="card">
              <h2 className="text-sm sm:text-base font-bold text-text-heading mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                My Daily Focus
              </h2>
              {performanceOverviewLoading ? (
                <div className="text-sm text-gray-500 py-4 text-center">Loading focus metrics…</div>
              ) : performanceOverview ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="rounded-lg border p-3">
                      <div className="text-[10px] sm:text-xs text-gray-500">Today follow-ups due</div>
                      <div className="text-lg font-bold text-blue-600">{performanceOverview.todayFollowUpsDue}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-[10px] sm:text-xs text-gray-500">High priority pending</div>
                      <div className="text-lg font-bold text-amber-600">{performanceOverview.highPriorityPending}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-[10px] sm:text-xs text-gray-500">No recording</div>
                      <div className="text-lg font-bold text-gray-700">{performanceOverview.noRecording}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-[10px] sm:text-xs text-gray-500">No summary</div>
                      <div className="text-lg font-bold text-gray-700">{performanceOverview.noSummary}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-[10px] sm:text-xs text-gray-500">No disposition</div>
                      <div className="text-lg font-bold text-gray-700">{performanceOverview.noDisposition}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-[10px] sm:text-xs text-gray-500">Conversion drop-off</div>
                      <div className="text-lg font-bold text-gray-900">{performanceOverview.funnel.dropOffPercent}%</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
                    {performanceOverview.avgTalkTimeSeconds != null && (
                      <span className="flex items-center gap-1 text-gray-700">
                        <PhoneCall className="w-3.5 h-3.5" />
                        Avg talk: {Math.floor(performanceOverview.avgTalkTimeSeconds / 60)}m {performanceOverview.avgTalkTimeSeconds % 60}s
                      </span>
                    )}
                    {performanceOverview.bestWindow && (
                      <span className="flex items-center gap-1 text-green-700 font-medium">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Best window: {performanceOverview.bestWindow.label} ({performanceOverview.bestWindow.completionRate}% completion)
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-gray-700">
                      <Award className="w-3.5 h-3.5" />
                      Audited: {performanceOverview.personalQuality.auditedCount}
                      {performanceOverview.personalQuality.avgScore != null && ` / ${performanceOverview.personalQuality.avgScore} avg`}
                    </span>
                  </div>
                  {performanceOverview.personalQuality.lastFeedbackHighlights.length > 0 && (
                    <div>
                      <div className="text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">Recent audit feedback</div>
                      <ul className="text-xs text-gray-700 space-y-0.5">
                        {performanceOverview.personalQuality.lastFeedbackHighlights.slice(0, 3).map((a) => (
                          <li key={a.sarv_call_id}>
                            Score {a.audit_score} — {a.feedback ? `${a.feedback.slice(0, 80)}…` : '—'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500 py-4 text-center">Focus metrics unavailable for this range.</div>
              )}
            </div>

            {/* Needs Attention + Service breakdown (half & half) */}
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left half: Needs Attention */}
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-text-heading mb-3">Needs Attention</h2>
                  {performanceOverview && (performanceOverview.needsAttention.length > 0 || performanceOverview.callsWithoutDisposition.length > 0) ? (
                    <div className="space-y-3">
                      {performanceOverview.needsAttention.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="text-left border-b text-gray-600">
                                <th className="py-1.5 pr-2">Customer</th>
                                <th className="py-1.5 pr-2">Phone</th>
                                <th className="py-1.5 pr-2">Status</th>
                                <th className="py-1.5 pr-2">Registered</th>
                                <th className="py-1.5 pr-2">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {performanceOverview.needsAttention.slice(0, 10).map((row) => (
                                <tr key={row.id} className="border-b last:border-b-0">
                                  <td className="py-1.5 pr-2 font-medium">{row.customer_name || '—'}</td>
                                  <td className="py-1.5 pr-2">{row.contact_number || '—'}</td>
                                  <td className="py-1.5 pr-2">{row.lead_status || '—'}</td>
                                  <td className="py-1.5 pr-2 whitespace-nowrap">
                                    {formatDateTimeISTFromUTC(row.lead_registered_at)}
                                  </td>
                                  <td className="py-1.5 pr-2">
                                    <Link
                                      href={`/dashboard/telecaller/rsa/complaints/${row.id}`}
                                      className="text-blue-600 hover:text-blue-700 font-semibold"
                                    >
                                      Open
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {performanceOverview.callsWithoutDisposition.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-amber-700 mb-1">Calls missing disposition</div>
                          <ul className="text-xs text-gray-700 space-y-1">
                            {performanceOverview.callsWithoutDisposition.slice(0, 5).map((c) => (
                              <li key={c.id}>
                                <button
                                  type="button"
                                  className="text-left w-full rounded px-2 py-1.5 hover:bg-amber-50 hover:text-amber-800 text-blue-600 hover:underline cursor-pointer"
                                  onClick={() => {
                                    setTab('call_report');
                                    setCallFilters((prev) => ({ ...prev, q: c.cnumber || '' }));
                                    setCallPage(1);
                                  }}
                                >
                                  {c.cnumber || '—'} — {formatDateTimeISTFromUTC(c.created_at)}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 py-4">No items needing attention.</div>
                  )}
                </div>
                {/* Right half: Service breakdown pie */}
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-text-heading mb-3">Services (selected range)</h2>
                  {overviewServiceBreakdown.length > 0 ? (
                    (() => {
                      const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                      const size = 140;
                      const cx = size / 2;
                      const cy = size / 2;
                      const r = (size / 2) - 6;
                      const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
                      const getXY = (angleDeg: number) => ({
                        x: cx + r * Math.cos(toRad(angleDeg)),
                        y: cy + r * Math.sin(toRad(angleDeg)),
                      });
                      let acc = 0;
                      const slices = overviewServiceBreakdown.map((row, i) => {
                        const startDeg = acc * 3.6;
                        acc += row.percent;
                        const endDeg = acc * 3.6;
                        const start = getXY(startDeg);
                        const end = getXY(endDeg);
                        const large = row.percent > 50 ? 1 : 0;
                        const d = `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
                        return { ...row, d, color: colors[i % colors.length] };
                      });
                      return (
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <div
                            className="relative flex-shrink-0"
                            onMouseLeave={() => setHoveredServicePie(null)}
                          >
                            <svg width={size} height={size}>
                              {slices.map((slice) => (
                                <path
                                  key={slice.name}
                                  d={slice.d}
                                  fill={slice.color}
                                  className="cursor-pointer transition-opacity hover:opacity-90"
                                  onMouseEnter={() => setHoveredServicePie({ name: slice.name, count: slice.count, percent: slice.percent })}
                                />
                              ))}
                            </svg>
                            {hoveredServicePie && (
                              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full z-10 mb-1 pointer-events-none">
                                <div className="bg-gray-900 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                                  <div className="font-semibold">{hoveredServicePie.name}</div>
                                  <div>Count: {hoveredServicePie.count}</div>
                                  <div>{hoveredServicePie.percent}% of total</div>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="space-y-1 min-w-0">
                            {overviewServiceBreakdown.map((row, i) => (
                              <div
                                key={row.name}
                                className="flex items-center gap-2 text-xs rounded px-1 py-0.5 cursor-pointer hover:bg-gray-100"
                                onMouseEnter={() => setHoveredServicePie({ name: row.name, count: row.count, percent: row.percent })}
                                onMouseLeave={() => setHoveredServicePie(null)}
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                  style={{ backgroundColor: colors[i % colors.length] }}
                                />
                                <span className="text-gray-700 truncate">{row.name}</span>
                                <span className="font-semibold text-gray-900 whitespace-nowrap">{row.count} ({row.percent}%)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-xs text-gray-500 py-4">No service data in selected range.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm sm:text-base font-bold text-text-heading">Recent RSA leads</h2>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500">
                    Showing {filteredLeads.length === 0 ? 0 : (overviewPage - 1) * OVERVIEW_PAGE_SIZE + 1}-
                    {Math.min(overviewPage * OVERVIEW_PAGE_SIZE, filteredLeads.length)} of {filteredLeads.length}
                    {leadStatusFilter ? ` / ${overviewLeadsInRange.length}` : ''} {loading ? '(loading...)' : ''}
                  </div>
                  <div className="min-w-[170px]">
                    <select
                      className="w-full border rounded-md px-2 py-1.5 text-xs"
                      value={leadStatusFilter}
                      onChange={(e) => {
                        setLeadStatusFilter(e.target.value);
                        setOverviewPage(1);
                      }}
                    >
                      <option value="">All Status</option>
                      {statusFilterOptions.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {filteredLeads.length === 0 ? (
                <div className="text-sm text-gray-600 py-6 text-center">
                  No RSA leads found.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="text-left text-gray-600 border-b">
                          <th className="py-2 pr-3">Customer</th>
                          <th className="py-2 pr-3">Phone</th>
                          <th className="py-2 pr-3">Vehicle</th>
                          <th className="py-2 pr-3">Service</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2 pr-3">Registered</th>
                          <th className="py-2 pr-3">Calls</th>
                          <th className="py-2 pr-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedLeads.map((l) => (
                          <tr
                            key={l.id}
                            className={`border-b last:border-b-0 cursor-pointer ${leadRowClass(l.lead_status || l.complaint_status || '')}`}
                            onClick={() => openComplaintDetails(l)}
                          >
                            <td className="py-2 pr-3 font-semibold">{l.customer_name || '—'}</td>
                            <td className="py-2 pr-3">{l.contact_number || '—'}</td>
                            <td className="py-2 pr-3">
                              {l.vehicle_number ? (
                                <span className="font-mono">{l.vehicle_number}</span>
                              ) : (
                                <span className="text-gray-600">{l.vehicle_model || '—'}</span>
                              )}
                            </td>
                            <td className="py-2 pr-3">{l.service_type || '—'}</td>
                            <td className="py-2 pr-3">
                              <span
                                className={`px-2 py-1 rounded-full border ${statusBadgeClass(
                                  l.lead_status || l.complaint_status || ''
                                )}`}
                              >
                                {statusLabel(l.lead_status || l.complaint_status || '—')}
                              </span>
                            </td>
                            <td className="py-2 pr-3">
                              {formatDateTimeISTFromUTC(l.lead_registered_at || l.requested_at)}
                            </td>
                            <td className="py-2 pr-3">
                              <button
                                type="button"
                                className="text-blue-600 hover:text-blue-700 font-semibold"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSarvCalls(l);
                                }}
                              >
                                View calls
                              </button>
                            </td>
                            <td className="py-2 pr-3">
                              {!l.assigned_mechanic_id ? (
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditLead(l);
                                    }}
                                    title="Edit lead (allowed until mechanic is assigned)"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    Edit
                                  </button>
                                  {isPendingComplaint(l) ? (
                                    <button
                                      type="button"
                                      className="text-red-600 hover:text-red-700 font-semibold"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openCancelLead(l);
                                      }}
                                      title="Cancel this pending complaint"
                                    >
                                      Cancel
                                    </button>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredLeads.length > OVERVIEW_PAGE_SIZE ? (
                    <div className="flex items-center justify-end gap-2 mt-3 text-xs">
                      <button
                        type="button"
                        className="px-2 py-1 border rounded disabled:opacity-50"
                        disabled={overviewPage === 1}
                        onClick={() => setOverviewPage((prev) => Math.max(1, prev - 1))}
                      >
                        Previous
                      </button>
                      <span className="text-gray-600">
                        Page {overviewPage} of {overviewTotalPages}
                      </span>
                      <button
                        type="button"
                        className="px-2 py-1 border rounded disabled:opacity-50"
                        disabled={overviewPage >= overviewTotalPages}
                        onClick={() => setOverviewPage((prev) => Math.min(overviewTotalPages, prev + 1))}
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : tab === 'created' ? (
          <div className="space-y-4">
            {createdError ? (
              <div className="bg-red-50 border border-red-200 text-red-800 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
                {createdError}
              </div>
            ) : null}

            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm sm:text-base font-bold text-text-heading">RSA leads created by you</h2>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500">
                    Showing {filteredCreatedLeads.length}
                    {leadStatusFilter ? ` / ${createdLeads.length}` : ''} {createdLoading ? '(loading...)' : ''}
                  </div>
                  <div className="min-w-[170px]">
                    <select
                      className="w-full border rounded-md px-2 py-1.5 text-xs"
                      value={leadStatusFilter}
                      onChange={(e) => setLeadStatusFilter(e.target.value)}
                    >
                      <option value="">All Status</option>
                      {statusFilterOptions.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {filteredCreatedLeads.length === 0 ? (
                <div className="text-sm text-gray-600 py-6 text-center">No created leads found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 pr-3">Customer</th>
                        <th className="py-2 pr-3">Phone</th>
                        <th className="py-2 pr-3">Vehicle</th>
                        <th className="py-2 pr-3">Service</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Registered</th>
                        <th className="py-2 pr-3">Calls</th>
                        <th className="py-2 pr-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCreatedLeads.map((l) => (
                        <tr
                          key={l.id}
                          className={`border-b last:border-b-0 cursor-pointer ${leadRowClass(l.lead_status || l.complaint_status || '')}`}
                          onClick={() => openComplaintDetails(l)}
                        >
                          <td className="py-2 pr-3 font-semibold">{l.customer_name || '—'}</td>
                          <td className="py-2 pr-3">{l.contact_number || '—'}</td>
                          <td className="py-2 pr-3">
                            {l.vehicle_number ? (
                              <span className="font-mono">{l.vehicle_number}</span>
                            ) : (
                              <span className="text-gray-600">{l.vehicle_model || '—'}</span>
                            )}
                          </td>
                          <td className="py-2 pr-3">{l.service_type || '—'}</td>
                          <td className="py-2 pr-3">
                            <span
                              className={`px-2 py-1 rounded-full border ${statusBadgeClass(
                                l.lead_status || l.complaint_status || ''
                              )}`}
                            >
                              {statusLabel(l.lead_status || l.complaint_status || '—')}
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            {formatDateTimeISTFromUTC(l.lead_registered_at || l.requested_at)}
                          </td>
                          <td className="py-2 pr-3">
                            <button
                              type="button"
                              className="text-blue-600 hover:text-blue-700 font-semibold"
                              onClick={(e) => {
                                e.stopPropagation();
                                openSarvCalls(l);
                              }}
                            >
                              View calls
                            </button>
                          </td>
                          <td className="py-2 pr-3">
                            {!l.assigned_mechanic_id ? (
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditLead(l);
                                  }}
                                  title="Edit lead (allowed until mechanic is assigned)"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  Edit
                                </button>
                                {isPendingComplaint(l) ? (
                                  <button
                                    type="button"
                                    className="text-red-600 hover:text-red-700 font-semibold"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openCancelLead(l);
                                    }}
                                    title="Cancel this pending complaint"
                                  >
                                    Cancel
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : tab === 'car_service' ? (
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm sm:text-base font-bold text-text-heading">Create Car Service Enquiry</h2>
              </div>

              {carSubmitError ? (
                <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm mb-3">
                  {carSubmitError}
                </div>
              ) : null}
              {carSubmitSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg text-sm mb-3">
                  {carSubmitSuccess}
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600">Customer Name</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    type="text"
                    placeholder="Name"
                    value={carForm.customer_name}
                    onChange={(e) => setCarForm((f) => ({ ...f, customer_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Phone</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    type="text"
                    placeholder="Phone"
                    value={carForm.customer_phone}
                    onChange={(e) => setCarForm((f) => ({ ...f, customer_phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Car Model</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    type="text"
                    placeholder="Car model"
                    value={carForm.car_model}
                    onChange={(e) => setCarForm((f) => ({ ...f, car_model: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Remark</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    type="text"
                    placeholder="Remark"
                    value={carForm.remark}
                    onChange={(e) => setCarForm((f) => ({ ...f, remark: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  className="btn btn-primary text-xs px-4 py-2"
                  onClick={submitCarEnquiry}
                  disabled={carSubmitLoading}
                >
                  {carSubmitLoading ? 'Submitting...' : 'Submit'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline text-xs px-4 py-2"
                  onClick={() => {
                    const next = !carViewOpen;
                    setCarViewOpen(next);
                    if (next && carEnquiries.length === 0) fetchCarEnquiries();
                  }}
                >
                  {carViewOpen ? 'Hide' : 'View'}
                </button>
              </div>
            </div>

            {carViewOpen ? (
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-text-heading">Submitted Enquiries</h2>
                    <div className="text-xs text-gray-500">
                      Showing {carEnquiries.length} {carViewLoading ? '(loading...)' : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline text-xs px-3 py-1.5"
                    onClick={fetchCarEnquiries}
                    disabled={carViewLoading}
                  >
                    Refresh
                  </button>
                </div>

                {carViewError ? (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm">
                    {carViewError}
                  </div>
                ) : null}

                {carEnquiries.length === 0 ? (
                  <div className="text-sm text-gray-600 py-6 text-center">No enquiries found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="text-left text-gray-600 border-b">
                          <th className="py-2 pr-3">Created</th>
                          <th className="py-2 pr-3">Name</th>
                          <th className="py-2 pr-3">Phone</th>
                          <th className="py-2 pr-3">Car Model</th>
                          <th className="py-2 pr-3">Remark</th>
                          <th className="py-2 pr-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {carEnquiries.map((row) => (
                          <tr key={row.id} className="border-b last:border-b-0">
                            <td className="py-2 pr-3">{formatDateTimeISTLocal(row.created_at)}</td>
                            <td className="py-2 pr-3 font-semibold">{row.customer_name || '—'}</td>
                            <td className="py-2 pr-3">{row.customer_phone_raw || row.customer_phone_norm || '—'}</td>
                            <td className="py-2 pr-3">{row.car_model || '—'}</td>
                            <td className="py-2 pr-3">{row.remark || '—'}</td>
                            <td className="py-2 pr-3">
                              {row.external_error ? (
                                <span className="text-red-700">Failed</span>
                              ) : row.external_status ? (
                                <span className="text-green-700">Success</span>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : tab === 'collect_payment' ? (
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm sm:text-base font-bold text-text-heading">Generate Payment Link</h2>
              </div>
              <p className="text-xs text-gray-600 mb-4">
                Telecaller details se payment link banega. Customer page par amount, name aur phone locked rahenge;
                sirf optional details editable hongi.
              </p>

              {collectError ? (
                <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm mb-3">
                  {collectError}
                </div>
              ) : null}
              {copySuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg text-sm mb-3">
                  {copySuccess}
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600">Amount (INR)</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    type="number"
                    min="1"
                    placeholder="Enter amount"
                    value={collectForm.amount}
                    onChange={(e) => setCollectForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Customer Name</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    type="text"
                    placeholder="Customer full name"
                    value={collectForm.customer_name}
                    onChange={(e) => setCollectForm((f) => ({ ...f, customer_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Customer Phone</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    type="tel"
                    placeholder="9876543210"
                    value={collectForm.customer_phone}
                    onChange={(e) => setCollectForm((f) => ({ ...f, customer_phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Customer Email (optional)</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    type="email"
                    placeholder="you@example.com"
                    value={collectForm.customer_email}
                    onChange={(e) => setCollectForm((f) => ({ ...f, customer_email: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary text-xs px-4 py-2"
                  onClick={generatePaymentLink}
                >
                  Generate Link
                </button>
                {generatedLink ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline text-xs px-4 py-2 flex items-center gap-1"
                      onClick={copyPaymentLink}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </button>
                    <a
                      href={generatedLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline text-xs px-4 py-2 inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Link
                    </a>
                  </>
                ) : null}
              </div>

              {generatedLink ? (
                <div className="mt-4">
                  <label className="text-xs text-gray-600">Generated Payment Link</label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-xs mt-1 bg-gray-50"
                    rows={3}
                    value={generatedLink}
                    readOnly
                  />
                </div>
              ) : null}
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-text-heading">Generated Payment Links</h3>
                  <div className="text-xs text-gray-500">
                    {generatedPayments.length} links {collectRefreshLoading ? '(refreshing...)' : ''}
                  </div>
                </div>
                {generatedPayments.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-outline text-xs px-3 py-1.5"
                    onClick={fetchGeneratedPaymentLinks}
                    disabled={collectRefreshLoading}
                  >
                    Refresh
                  </button>
                ) : null}
              </div>

              {collectRefreshError ? (
                <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm mb-3">
                  {collectRefreshError}
                </div>
              ) : null}

              {generatedPayments.length === 0 ? (
                <div className="text-sm text-gray-600 py-3">No payment links generated yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 pr-3">Customer</th>
                        <th className="py-2 pr-3">Phone</th>
                        <th className="py-2 pr-3">Amount</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Updated</th>
                        <th className="py-2 pr-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedPayments.map((row) => (
                        <tr key={row.ref} className="border-b last:border-b-0">
                          <td className="py-2 pr-3 font-semibold">{row.customer_name || '—'}</td>
                          <td className="py-2 pr-3">{row.customer_phone || '—'}</td>
                          <td className="py-2 pr-3">₹{row.amount}</td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-1 rounded-full border ${paymentStatusBadgeClass(row.status)}`}>
                              {paymentStatusLabel(row.status)}
                            </span>
                          </td>
                          <td className="py-2 pr-3">{formatDateTime(row.updated_at || row.created_at)}</td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                className="text-blue-600 hover:text-blue-700 font-semibold"
                                onClick={() => copyPaymentLink(row.link)}
                              >
                                Copy
                              </button>
                              <a
                                href={row.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-700 font-semibold"
                              >
                                Open
                              </a>
                              <button
                                type="button"
                                className="text-blue-600 hover:text-blue-700 font-semibold"
                                onClick={() => viewComplaintByPhone(row.customer_phone)}
                              >
                                View
                              </button>
                              {canCancelLink(row.status) ? (
                                <button
                                  type="button"
                                  className="text-red-600 hover:text-red-700 font-semibold disabled:opacity-60"
                                  onClick={() => cancelGeneratedPaymentLink(row.ref)}
                                  disabled={cancelLinkLoadingRef === row.ref}
                                >
                                  {cancelLinkLoadingRef === row.ref ? 'Cancelling...' : 'Cancel'}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : tab === 'call_report' ? (
          <div className="space-y-4">
            {callError ? (
              <div className="bg-red-50 border border-red-200 text-red-800 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
                {callError}
              </div>
            ) : null}

            <div className="card p-3 sm:p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-xs text-gray-600">From</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    type="date"
                    value={callFilters.from}
                    onChange={(e) => {
                      setCallPage(1);
                      setCallFilters((f) => ({ ...f, from: e.target.value }));
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">To</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    type="date"
                    value={callFilters.to}
                    onChange={(e) => {
                      setCallPage(1);
                      setCallFilters((f) => ({ ...f, to: e.target.value }));
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Search</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    type="text"
                    placeholder="Call ID or customer number"
                    value={callFilters.q}
                    onChange={(e) => {
                      setCallPage(1);
                      setCallFilters((f) => ({ ...f, q: e.target.value }));
                    }}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={callFilters.has_recording}
                      onChange={(e) => {
                        setCallPage(1);
                        setCallFilters((f) => ({ ...f, has_recording: e.target.checked }));
                      }}
                    />
                    Has recording
                  </label>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Audit</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={callFilters.has_audit}
                    onChange={(e) => {
                      setCallPage(1);
                      setCallFilters((f) => ({ ...f, has_audit: e.target.value }));
                    }}
                  >
                    <option value="">All</option>
                    <option value="true">Audited</option>
                    <option value="false">Not Audited</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="w-full sm:max-w-xs">
                  <label className="text-xs text-gray-600">Open WhatsApp by number</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    type="text"
                    placeholder="Enter mobile number"
                    value={waQuickPhone}
                    onChange={(e) => setWaQuickPhone(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      openWhatsAppPreview(waQuickPhone, null);
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary text-sm px-4 py-2 w-full sm:w-auto"
                  onClick={() => openWhatsAppPreview(waQuickPhone, null)}
                >
                  Open WhatsApp
                </button>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm sm:text-base font-bold text-text-heading">Call Report</h2>
                <div className="text-xs text-gray-500">
                  {callLoading ? 'Loading...' : `${calls.length} rows`}
                </div>
              </div>

              {calls.length === 0 ? (
                <div className="text-sm text-gray-600 py-6 text-center">No calls found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 pr-3">Call Time</th>
                        <th className="py-2 pr-3">Customer</th>
                        <th className="py-2 pr-3">Talk</th>
                        <th className="py-2 pr-3">Disposition</th>
                        <th className="py-2 pr-3">Summary</th>
                        <th className="py-2 pr-3">Recording</th>
                        <th className="py-2 pr-3">Audit</th>
                        <th className="py-2 pr-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedCalls.map((group) => {
                        const isOpen = expandedCustomers[group.customer] ?? false;
                        const latest = group.calls[0];
                        if (group.calls.length === 1) {
                          const call = latest;
                          const audit = auditByCallId[call.id] ?? null;
                          return (
                            <tr key={call.id} className="border-b last:border-b-0 align-top">
                              <td className="py-2 pr-3 whitespace-nowrap">
                                {formatDateTime(call.custanswerstime || call.sarv_created_at || call.created_at)}
                              </td>
                              <td className="py-2 pr-3">
                                {call.cnumber ? (
                                  <button
                                    type="button"
                                    className="text-green-700 hover:text-green-800 font-semibold underline underline-offset-2"
                                    onClick={() => openWhatsAppPreview(call.cnumber, call)}
                                    title="Open WhatsApp style chat preview"
                                  >
                                    {call.cnumber}
                                  </button>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-2 pr-3">{formatDuration(call.talkduration)}</td>
                              <td className="py-2 pr-3">
                                {call.disposition || call.disposition_category || '—'}
                              </td>
                              <td className="py-2 pr-3">
                                {call.summary ? (
                                  <button
                                    type="button"
                                    className="text-blue-600 hover:text-blue-700 font-semibold"
                                    onClick={() => openSummary(call)}
                                  >
                                    View Summary
                                  </button>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-2 pr-3">
                                {call.recording_url ? (
                                  <div className="flex flex-col gap-2">
                                    <a
                                      className="text-blue-600 hover:text-blue-700 text-xs font-semibold"
                                      href={call.recording_url}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Download
                                    </a>
                                    <audio controls preload="none" src={call.recording_url} className="w-80 min-w-[20rem] max-w-full h-10" />
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
                                    ) : call?.has_audit ? (
                                      <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-blue-700 font-semibold">
                                        Audited
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    className="text-emerald-700 hover:text-emerald-800 font-semibold"
                                    onClick={() => openAudit(call)}
                                  >
                                    View
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 pr-3">
                                <button
                                  type="button"
                                  className="text-blue-600 hover:text-blue-700 font-semibold"
                                  onClick={() => openDisposition(call)}
                                >
                                  Disposition
                                </button>
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
                              <td className="py-2 pr-3 font-semibold">
                                <div className="flex flex-col gap-1">
                                  <button
                                    type="button"
                                    className="text-left text-gray-800"
                                    onClick={() =>
                                      setExpandedCustomers((prev) => ({
                                        ...prev,
                                        [group.customer]: !isOpen,
                                      }))
                                    }
                                  >
                                    {group.calls.length} calls {isOpen ? '(hide)' : '(view)'}
                                  </button>
                                  {group.customer && group.customer !== 'Unknown' ? (
                                    <button
                                      type="button"
                                      className="w-fit text-green-700 hover:text-green-800 underline underline-offset-2"
                                      onClick={() => openWhatsAppPreview(group.customer, latest)}
                                      title="Open WhatsApp style chat preview"
                                    >
                                      {group.customer}
                                    </button>
                                  ) : (
                                    <span className="text-gray-500">Unknown</span>
                                  )}
                                </div>
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
                              <td className="py-2 pr-3"> </td>
                              <td className="py-2 pr-3"> </td>
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
                            </tr>
                            {isOpen
                              ? group.calls.map((call) => (
                                  (() => {
                                    const audit = auditByCallId[call.id] ?? null;
                                    return (
                                  <tr key={call.id} className="border-b last:border-b-0 align-top">
                                    <td className="py-2 pr-3 whitespace-nowrap">
                                      {formatDateTime(
                                        call.custanswerstime || call.sarv_created_at || call.created_at
                                      )}
                                    </td>
                                    <td className="py-2 pr-3">
                                      {call.cnumber ? (
                                        <button
                                          type="button"
                                          className="text-green-700 hover:text-green-800 font-semibold underline underline-offset-2"
                                          onClick={() => openWhatsAppPreview(call.cnumber, call)}
                                          title="Open WhatsApp style chat preview"
                                        >
                                          {call.cnumber}
                                        </button>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                    <td className="py-2 pr-3">{formatDuration(call.talkduration)}</td>
                                    <td className="py-2 pr-3">
                                      {call.disposition || call.disposition_category || '—'}
                                    </td>
                                    <td className="py-2 pr-3">
                                      {call.summary ? (
                                        <button
                                          type="button"
                                          className="text-blue-600 hover:text-blue-700 font-semibold"
                                          onClick={() => openSummary(call)}
                                        >
                                          View Summary
                                        </button>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                    <td className="py-2 pr-3">
                                      {call.recording_url ? (
                                        <div className="flex flex-col gap-2">
                                          <a
                                            className="text-blue-600 hover:text-blue-700 text-xs font-semibold"
                                            href={call.recording_url}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            Download
                                          </a>
                                          <audio controls preload="none" src={call.recording_url} className="w-80 min-w-[20rem] max-w-full h-10" />
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
                                          ) : call?.has_audit ? (
                                            <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-blue-700 font-semibold">
                                              Audited
                                            </span>
                                          ) : (
                                            '—'
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          className="text-emerald-700 hover:text-emerald-800 font-semibold"
                                          onClick={() => openAudit(call)}
                                        >
                                          View
                                        </button>
                                      </div>
                                    </td>
                                    <td className="py-2 pr-3">
                                      <button
                                        type="button"
                                        className="text-blue-600 hover:text-blue-700 font-semibold"
                                        onClick={() => openDisposition(call)}
                                      >
                                        Disposition
                                      </button>
                                    </td>
                                  </tr>
                                    );
                                  })()
                                ))
                              : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-outline text-xs px-3 py-1.5"
                  onClick={() => setCallPage((p) => Math.max(1, p - 1))}
                  disabled={callPage <= 1 || callLoading}
                >
                  Prev
                </button>
                <div className="text-xs text-gray-500">Page {callPage}</div>
                <button
                  type="button"
                  className="btn btn-outline text-xs px-3 py-1.5"
                  onClick={() => setCallPage((p) => p + 1)}
                  disabled={callLoading || callPage * callFilters.limit >= callTotal}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <RSALeadCreateForm
              embedded
              onCreated={() => {
                // After creation, show it in Overview.
                setTab('overview');
                fetchLeads();
              }}
              onCancel={() => setTab('overview')}
            />
          </div>
        )}
      </div>

      {sarvOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg p-4 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-text-heading">SARV Calls</h3>
                <p className="text-xs text-gray-500">
                  {sarvLead?.customer_name || 'Unknown'} • {sarvLead?.contact_number || '—'}
                </p>
              </div>
              <button
                type="button"
                className="text-gray-600 hover:text-gray-800 font-semibold"
                onClick={closeSarvCalls}
              >
                Close
              </button>
            </div>

            {sarvLoading ? (
              <div className="text-sm text-gray-600">Loading calls...</div>
            ) : sarvError ? (
              <div className="text-sm text-red-600">{sarvError}</div>
            ) : sarvCalls.length === 0 ? (
              <div className="text-sm text-gray-600">No SARV calls found for this complaint.</div>
            ) : (
              <div className="space-y-3">
                {sarvCalls.map((call) => (
                  <div key={call.callid} className="border rounded-lg p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                      <span>Call ID: {call.callid}</span>
                      <span>Status: {call.callstatus ?? '—'}</span>
                      <span>Type: {call.ctype || '—'}</span>
                      <span>Talk: {call.talkduration ?? 0}s</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Answered: {formatDateTime(call.custanswerstime)} • Ended: {formatDateTime(call.custansweretime)}
                    </div>
                    {call.recording_url ? (
                      <audio controls className="w-full">
                        <source src={call.recording_url} />
                      </audio>
                    ) : null}
                    <details className="text-sm">
                      <summary className="cursor-pointer font-semibold">Transcription</summary>
                      <div className="mt-2 text-gray-700 whitespace-pre-wrap">
                        {call.transcription || 'Not available yet.'}
                      </div>
                    </details>
                    <details className="text-sm">
                      <summary className="cursor-pointer font-semibold">Summary</summary>
                      <div className="mt-2 text-gray-700 whitespace-pre-wrap">
                        {call.summary || 'Not available yet.'}
                      </div>
                    </details>
                    {call.disposition || call.disposition_note ? (
                      <div className="text-xs text-gray-600">
                        Disposition: {call.disposition || '—'} • Note: {call.disposition_note || '—'}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {editLeadLoading || editLead ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3 py-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-text-heading">Edit RSA lead</h3>
              <button
                type="button"
                className="text-gray-600 hover:text-gray-800 font-semibold"
                onClick={closeEditLead}
                disabled={editLeadLoading}
              >
                Close
              </button>
            </div>
            {editLeadLoading ? (
              <div className="text-sm text-gray-600 py-6">Loading lead...</div>
            ) : editLead ? (
              <RSALeadCreateForm
                embedded
                initialLead={editLead}
                onUpdated={onLeadUpdated}
                onCancel={closeEditLead}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {cancelOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-lg p-4 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-text-heading">Cancel Complaint</h3>
                <p className="text-xs text-gray-500">
                  {cancelLead?.customer_name || 'Customer'} • {cancelLead?.contact_number || '—'}
                </p>
              </div>
              <button
                type="button"
                className="text-gray-600 hover:text-gray-800 font-semibold"
                onClick={closeCancelLead}
                disabled={cancelLoading}
              >
                Close
              </button>
            </div>

            {cancelError ? <div className="text-sm text-red-600">{cancelError}</div> : null}

            <div>
              <label className="text-xs text-gray-600">Cancel Remark (optional)</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[90px]"
                placeholder="Reason for cancellation (optional)"
                value={cancelRemark}
                onChange={(e) => setCancelRemark(e.target.value)}
                disabled={cancelLoading}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn btn-outline text-sm px-4 py-2"
                onClick={closeCancelLead}
                disabled={cancelLoading}
              >
                Back
              </button>
              <button
                type="button"
                className="btn text-sm px-4 py-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                onClick={submitCancelLead}
                disabled={cancelLoading}
              >
                {cancelLoading ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dispositionOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-xl rounded-xl shadow-lg overflow-visible">
            <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Call Disposition</div>
                <div className="text-xs opacity-90">Call ID: {dispositionCall?.callid || '—'}</div>
              </div>
              <button type="button" className="text-white/80 hover:text-white" onClick={closeDisposition}>
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-gray-600">Service Type</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={dispositionForm.service_type}
                  onChange={(e) => setDispositionForm((f) => ({ ...f, service_type: e.target.value }))}
                >
                  <option value="">Select service type</option>
                  {SERVICE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Disposition *</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={dispositionForm.disposition}
                  onChange={(e) => setDispositionForm((f) => ({ ...f, disposition: e.target.value }))}
                >
                  <option value="">Select disposition</option>
                  {DISPOSITION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Price</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  type="number"
                  value={dispositionForm.price}
                  onChange={(e) => setDispositionForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">City</label>
                <div className="relative">
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    type="text"
                    value={dispositionForm.city}
                    onChange={(e) => setDispositionForm((f) => ({ ...f, city: e.target.value }))}
                    onFocus={() => setCitySuggestOpen(true)}
                    onBlur={(e) => {
                      setDispositionForm((f) => ({ ...f, city: titleCase(e.target.value) }));
                      setTimeout(() => setCitySuggestOpen(false), 150);
                    }}
                  />
                  {citySuggestOpen ? (
                    (() => {
                      const query = normalizeCityValue(dispositionForm.city);
                      const options = query
                        ? cities.filter((c) => matchesCity(c, query)).slice(0, 8)
                        : cities.slice(0, 8);
                      if (options.length === 0) return null;
                      return (
                        <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-auto text-sm">
                          {options.map((city) => (
                            <button
                              key={city}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-gray-100"
                              onMouseDown={() => {
                                setDispositionForm((f) => ({ ...f, city }));
                                setCitySuggestOpen(false);
                              }}
                            >
                              {city}
                            </button>
                          ))}
                        </div>
                      );
                    })()
                  ) : null}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600">Notes / Detail</label>
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm min-h-[90px]"
                  value={dispositionForm.disposition_note}
                  onChange={(e) => setDispositionForm((f) => ({ ...f, disposition_note: e.target.value }))}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button type="button" className="btn btn-outline text-sm px-4 py-2" onClick={closeDisposition}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary text-sm px-4 py-2"
                  onClick={saveDisposition}
                  disabled={!dispositionForm.disposition}
                >
                  Save Disposition
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {summaryOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <div className="text-sm font-semibold text-gray-900">AI Summary</div>
                <div className="text-xs text-gray-500">Call ID: {summaryCall?.callid || '—'}</div>
              </div>
              <button type="button" className="btn btn-outline text-xs px-3 py-1.5" onClick={closeSummary}>
                Close
              </button>
            </div>
            <div className="p-4 space-y-4">
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

      {auditOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg overflow-hidden">
            <div className="bg-emerald-700 text-white px-5 py-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-lg font-semibold">Call Audit</div>
                <div className="text-xs opacity-90 truncate">Call ID: {auditCall?.callid || auditCall?.id || '—'}</div>
              </div>
              <button type="button" className="text-white/80 hover:text-white text-xl" onClick={closeAudit}>
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              {auditError ? (
                <div className="text-xs sm:text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {auditError}
                </div>
              ) : null}

              <div className="rounded-lg border bg-emerald-50 p-4">
                <div className="text-xs text-gray-600">Customer</div>
                <div className="text-xl font-semibold text-gray-900">{auditCall?.cnumber || '—'}</div>
              </div>

              {(() => {
                const audit = auditCall?.id ? auditByCallId[auditCall.id] : null;
                if (auditLoading) {
                  return <div className="text-sm text-gray-600">Loading audit…</div>;
                }
                if (!audit) {
                  return <div className="text-sm text-gray-600">No audit found for this call yet.</div>;
                }
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-lg border p-4">
                        <div className="text-xs text-gray-600">Audit Status</div>
                        <div className="text-base font-semibold text-gray-900">{audit.audit_status || '—'}</div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-xs text-gray-600">Score</div>
                        <div className="text-base font-semibold text-gray-900">
                          {audit.audit_score != null ? `${audit.audit_score}/5` : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border p-4">
                      <div className="text-xs text-gray-600">Feedback</div>
                      <div className="text-sm text-gray-900 whitespace-pre-wrap">{audit.feedback || '—'}</div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Audited at: {audit.audited_at ? formatDateTime(audit.audited_at) : '—'}
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end pt-2">
                <button type="button" className="btn btn-outline text-sm px-5 py-2" onClick={closeAudit}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <WhatsAppMobilePreviewModal
        isOpen={waPreviewOpen}
        phoneNumber={waPreviewPhone}
        customerName={waPreviewCustomerName}
        title="WhatsApp Chat"
        previewMessage={waPreviewMessage}
        onClose={() => setWaPreviewOpen(false)}
      />
    </DashboardLayout>
  );
}

