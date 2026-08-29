'use client';

import { Fragment, useMemo, useState, useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import DashboardLayout from '@/components/DashboardLayout';
import { RSAManagerService } from '@/lib/services/rsaManagerService';
import { formatDateTimeIST, formatDateTimeISTAssumeUTC } from '@/lib/utils';
import {
  AlertCircle, Clock, CheckCircle, XCircle, Users,
  Search, Filter, Eye, ChevronRight, Wrench, MapPin
} from 'lucide-react';

type TabKey = 'overview' | 'call_report';

type SarvCallRow = {
  id: string;
  callid: string;
  cnumber: string | null;
  did: string | null;
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
  previous_disposition: string | null;
  previous_disposition_category: string | null;
  previous_disposition_note: string | null;
  previous_disposition_callid: string | null;
  previous_disposition_at: string | null;
  previous_disposition_assigned_user_id: string | null;
  previous_disposition_assigned_user_name: string | null;
  previous_disposition_summary: string | null;
  previous_disposition_talkduration: number | null;
  previous_disposition_recording_url: string | null;
  sarv_created_at: string | null;
  created_at: string;
};

type SarvCallAudit = {
  id: string;
  sarv_call_id: string;
  audit_status: string | null;
  audit_score: number | null;
  feedback: string | null;
  audited_at: string | null;
};

const DISPOSITION_OPTIONS = [
  'Registered',
  'Follow-up Required',
  'Garage Complaints',
  'Spam/Unwanted',
  'Out of Service Area',
  'Price Issue Cancellation',
  'Time Issue Cancellation',
  'Voice Issue',
  'Non-RSA Complaint',
];

const SERVICE_TYPE_OPTIONS = [
  'Battery',
  'Flat Tyre',
  'Towing',
  'Fuel Delivery',
  'Jump Start',
  'Emergency Roadside',
  'Other',
];

function formatDuration(seconds?: number | null) {
  if (!Number.isFinite(seconds as number)) return '—';
  const total = Math.max(0, Number(seconds));
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function normalizeCallType(value: string | null | undefined) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '—';
  if (raw === 'IBD' || raw === 'INBOUND' || raw === 'IN') return 'Inbound';
  if (raw === 'OBD' || raw === 'OUTBOUND' || raw === 'OUT') return 'Outbound';
  if (raw === 'MISSED') return 'Missed';
  if (raw === 'IVR') return 'IVR';
  return raw;
}

function formatSarvCallDateTime(value: string | number | Date | null | undefined): string {
  if (typeof value !== 'string') return formatDateTimeIST(value);
  const raw = value.trim();
  if (!raw) return '';

  const hasTimezone = /([zZ]|[+\-]\d{2}(:?\d{2})?)$/.test(raw);
  if (hasTimezone) return formatDateTimeIST(raw);

  const looksLikeDateTime =
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/.test(raw);
  if (!looksLikeDateTime) return formatDateTimeIST(raw);

  // SARV naive datetime values are already in IST; pin +05:30 so they are not shifted again.
  return formatDateTimeIST(`${raw.replace(' ', 'T')}+05:30`);
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
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function toISTBoundaryISO(dateText: string, endOfDay: boolean): string | null {
  const match = String(dateText || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hours = endOfDay ? 23 : 0;
  const minutes = endOfDay ? 59 : 0;
  const seconds = endOfDay ? 59 : 0;
  const istOffsetMs = 330 * 60 * 1000;
  const utcMs = Date.UTC(year, monthIndex, day, hours, minutes, seconds) - istOffsetMs;
  return new Date(utcMs).toISOString();
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
import Link from 'next/link';
import WhatsAppMobilePreviewModal from '@/components/shared/WhatsAppMobilePreviewModal';

export default function RSAManagerDashboard() {
  const supabase = getBrowserClient();
  
  const [tab, setTab] = useState<TabKey>('overview');
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
  
  const [filter, setFilter] = useState<'assigned' | 'pending' | 'completed' | 'cancelled'>('assigned');
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState<any>(null);
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
  const [previousDetailsOpen, setPreviousDetailsOpen] = useState(false);
  const [previousDetailsCall, setPreviousDetailsCall] = useState<SarvCallRow | null>(null);
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

  const groupedCalls = useMemo(() => groupCallsByCustomer(calls), [calls]);

  const openWhatsAppPreview = (phone: string | null | undefined, call?: SarvCallRow | null) => {
    const value = String(phone || '').trim();
    const summary = String(call?.summary || '').trim();
    const disposition = String(call?.disposition || call?.disposition_category || '').trim();
    const suggested =
      summary ||
      (disposition ? `Hi, regarding your recent call (${disposition}), hum aapki मदद ke liye available hain.` : '');
    setWaPreviewPhone(value);
    setWaPreviewMessage(suggested);
    setWaPreviewOpen(true);
  };

  useEffect(() => {
    fetchUser();
    fetchCities();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    if (tab !== 'call_report') return;
    fetchCalls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, callFilters, callPage]);

  const fetchUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id, full_name, email')
        .eq('id', authUser.id)
        .single();
      setUser(userProfile);
    }
  };

  const fetchCities = async () => {
    try {
      const res = await fetch('/api/rsa/cities');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load cities');
      const normalized: string[] = Array.isArray(json?.cities)
        ? json.cities
            .map((c: string) => titleCase(c))
            .filter((c: string) => c)
        : [];
      const unique = Array.from(new Set(normalized.map((c: string) => c.toLowerCase()))).map(
        (lc: string) => normalized.find((c: string) => c.toLowerCase() === lc) as string
      );
      setCities(unique);
    } catch {
      setCities([]);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const managerId = user?.id;

      // Always enforce "only my assigned complaints" on RSA manager dashboard.
      const leadsData = await RSAManagerService.getAllLeads(managerId, '', false);
      const assignedOnly = (Array.isArray(leadsData) ? leadsData : []).filter(
        (lead: any) => lead?.assigned_manager_id && lead.assigned_manager_id === managerId
      );
      setLeads(assignedOnly);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCalls = async () => {
    setCallLoading(true);
    setCallError('');
    try {
      const params = new URLSearchParams();
      if (callFilters.from) {
        const fromISO = toISTBoundaryISO(callFilters.from, false);
        if (fromISO) params.set('from', fromISO);
      }
      if (callFilters.to) {
        const toISO = toISTBoundaryISO(callFilters.to, true);
        if (toISO) params.set('to', toISO);
      }
      if (callFilters.q.trim()) {
        params.set('q', callFilters.q.trim());
      }
      if (callFilters.has_recording) {
        params.set('has_recording', 'true');
      }
      params.set('limit', String(callFilters.limit));
      params.set('page', String(callPage));

      const res = await fetch(`/api/rsa/sarv-calls?${params.toString()}`);
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

  const openPreviousDetails = (call: SarvCallRow) => {
    setPreviousDetailsCall(call);
    setPreviousDetailsOpen(true);
  };

  const closePreviousDetails = () => {
    setPreviousDetailsOpen(false);
    setPreviousDetailsCall(null);
  };

  const jumpToPreviousCall = (call: SarvCallRow) => {
    const prevCallId = String(call.previous_disposition_callid || '').trim();
    if (!prevCallId) return;
    setCallPage(1);
    setCallFilters((f) => ({ ...f, q: prevCallId }));
    setPreviousDetailsOpen(false);
  };

  const renderDispositionCell = (call: SarvCallRow) => {
    const current = call.disposition || call.disposition_category || '';
    const previous = call.previous_disposition || call.previous_disposition_category || '';
    if (!previous) {
      return <div>{current || '—'}</div>;
    }
    const agent = String(call.previous_disposition_assigned_user_name || '').trim() || 'Unknown Agent';
    const time = formatSarvCallDateTime(call.previous_disposition_at);
    return (
      <div className="space-y-0.5">
        <div>{current || '—'}</div>
        <button
          type="button"
          className="text-[11px] text-blue-600 hover:text-blue-700 text-left"
          onClick={() => openPreviousDetails(call)}
          title="View previous call details"
        >
          Prev: {previous} • {agent} • {time || '—'}
        </button>
      </div>
    );
  };

  const openAudit = async (call: SarvCallRow) => {
    setAuditCall(call);
    setAuditOpen(true);
    setAuditError('');
    if (!call?.id) return;

    // Use cached audit if present (still load fresh).
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
    if (!dispositionCall?.id || !dispositionForm.service_type || !dispositionForm.city?.trim()) return;
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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
      'assigned': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Assigned' },
      'assigned_to_manager': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Assigned to Manager' },
      'assigned_to_mechanic': { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Assigned to Mechanic' },
      'in_progress': { bg: 'bg-orange-100', text: 'text-orange-800', label: 'In Progress' },
      'completed': { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
      'cancelled': { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
    };
    
    const badge = badges[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      'low': { bg: 'bg-gray-100', text: 'text-gray-600' },
      'medium': { bg: 'bg-blue-100', text: 'text-blue-600' },
      'high': { bg: 'bg-orange-100', text: 'text-orange-600' },
      'urgent': { bg: 'bg-red-100', text: 'text-red-600' },
    };
    
    const badge = badges[priority?.toLowerCase()] || badges['medium'];
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${badge.bg} ${badge.text}`}>
        {priority?.toUpperCase() || 'MEDIUM'}
      </span>
    );
  };

  const normalizeStatus = (lead: any) =>
    String(lead?.lead_status || lead?.complaint_status || '').toLowerCase();

  const isCompleted = (s: string) => s === 'completed' || s === 'closed';
  const isCancelled = (s: string) => s === 'cancelled';
  const isPending = (s: string) => !isCompleted(s) && !isCancelled(s);

  const overviewLeadsInRange = useMemo(() => {
    const fromISO = overviewDateRange.from ? toISTBoundaryISO(overviewDateRange.from, false) : null;
    const toISO = overviewDateRange.to ? toISTBoundaryISO(overviewDateRange.to, true) : null;
    const fromTs = fromISO ? new Date(fromISO).getTime() : Number.NEGATIVE_INFINITY;
    const toTs = toISO ? new Date(toISO).getTime() : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(fromTs) || !Number.isFinite(toTs)) return leads;

    return leads.filter((lead) => {
      const raw = lead?.lead_registered_at || lead?.requested_at;
      if (!raw) return false;
      const ts = new Date(raw).getTime();
      if (!Number.isFinite(ts)) return false;
      return ts >= fromTs && ts <= toTs;
    });
  }, [leads, overviewDateRange.from, overviewDateRange.to]);

  const overviewStats = useMemo(() => ({
    total_leads: overviewLeadsInRange.length,
    pending_leads: overviewLeadsInRange.filter((l: any) => isPending(normalizeStatus(l))).length,
    completed_leads: overviewLeadsInRange.filter((l: any) => isCompleted(normalizeStatus(l))).length,
    cancelled_leads: overviewLeadsInRange.filter((l: any) => isCancelled(normalizeStatus(l))).length,
  }), [overviewLeadsInRange]);

  const statusFilteredLeads = useMemo(() => {
    return overviewLeadsInRange.filter((lead: any) => {
      const s = normalizeStatus(lead);
      if (filter === 'assigned') return true;
      if (filter === 'pending') return isPending(s);
      if (filter === 'completed') return isCompleted(s);
      if (filter === 'cancelled') return isCancelled(s);
      return true;
    });
  }, [overviewLeadsInRange, filter]);

  const filteredLeads = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return statusFilteredLeads;
    return statusFilteredLeads.filter((lead) =>
      lead.customer_name?.toLowerCase().includes(q) ||
      lead.contact_number?.includes(searchTerm) ||
      lead.vehicle_number?.toLowerCase().includes(q)
    );
  }, [statusFilteredLeads, searchTerm]);

  const overviewTotalPages = Math.max(1, Math.ceil(filteredLeads.length / OVERVIEW_PAGE_SIZE));
  const paginatedLeads = useMemo(() => {
    const start = (overviewPage - 1) * OVERVIEW_PAGE_SIZE;
    return filteredLeads.slice(start, start + OVERVIEW_PAGE_SIZE);
  }, [filteredLeads, overviewPage]);

  useEffect(() => {
    setOverviewPage(1);
  }, [overviewDateRange.from, overviewDateRange.to, filter, searchTerm]);

  useEffect(() => {
    if (overviewPage > overviewTotalPages) {
      setOverviewPage(overviewTotalPages);
    }
  }, [overviewPage, overviewTotalPages]);

  return (
    <DashboardLayout role="rsa_manager">
      <div className="w-full min-w-0 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg mb-6 sm:mb-7 md:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-lg">🚨 RSA Manager Dashboard</h1>
          <p className="text-white/90 font-medium text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">Roadside Assistance Lead Management & Mechanic Assignment</p>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setTab('overview')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              tab === 'overview' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setTab('call_report')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              tab === 'call_report' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Call Report
          </button>
        </div>

        {tab === 'call_report' ? (
          <div className="space-y-4">
            {callError ? (
              <div className="bg-red-50 border border-red-200 text-red-800 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
                {callError}
              </div>
            ) : null}

            <div className="bg-white rounded-lg shadow p-3 sm:p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Call Report</h2>
                  <div className="text-xs text-gray-500">
                    {callLoading ? 'Loading...' : `${calls.length} rows`}
                  </div>
                </div>

                {calls.length === 0 ? (
                  <div className="text-sm text-gray-600 py-6 text-center">
                    No calls found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="text-left text-gray-600 border-b">
                          <th className="py-2 pr-3">Call Time</th>
                          <th className="py-2 pr-3">Customer</th>
                          <th className="py-2 pr-3">Call Type</th>
                          <th className="py-2 pr-3">DID Number</th>
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
                          const groupDisposition = group.calls.find(c => c.disposition || c.disposition_category);
                          if (group.calls.length === 1) {
                            const call = latest;
                            const audit = auditByCallId[call.id] ?? null;
                            return (
                              <tr key={call.id} className="border-b last:border-b-0 align-top">
                                <td className="py-2 pr-3 whitespace-nowrap">
                                  {formatSarvCallDateTime(call.custanswerstime || call.sarv_created_at || call.created_at)}
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
                                <td className="py-2 pr-3">{normalizeCallType(call.ctype)}</td>
                                <td className="py-2 pr-3">{call.did || '—'}</td>
                                <td className="py-2 pr-3">{formatDuration(call.talkduration)}</td>
                                <td className="py-2 pr-3">
                                  {renderDispositionCell(call)}
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
                                        href={`/api/sarv-calls/${call.id}/stream`}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        Download
                                      </a>
                                      <audio controls preload="none" src={`/api/sarv-calls/${call.id}/stream`} className="w-80 min-w-[20rem] max-w-full h-10" />
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
                              <tr key={`${group.customer}-header`} className="border-b bg-gray-50">
                                <td className="py-2 pr-3 whitespace-nowrap">
                                  {formatSarvCallDateTime(latest.custanswerstime || latest.sarv_created_at || latest.created_at)}
                                </td>
                                <td className="py-2 pr-3 font-semibold">
                                  <button
                                    type="button"
                                    className="text-left text-green-700 hover:text-green-800 underline underline-offset-2"
                                    onClick={() => openWhatsAppPreview(group.customer, latest)}
                                    title="Open WhatsApp style chat preview"
                                  >
                                    {group.customer} • {group.calls.length} calls
                                  </button>
                                </td>
                                <td className="py-2 pr-3">{normalizeCallType(latest.ctype)}</td>
                                <td className="py-2 pr-3">{latest.did || '—'}</td>
                                <td className="py-2 pr-3">{formatDuration(latest.talkduration)}</td>
                                <td className="py-2 pr-3">
                                  {renderDispositionCell(groupDisposition || latest)}
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
                                        {formatSarvCallDateTime(
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
                                      <td className="py-2 pr-3">{normalizeCallType(call.ctype)}</td>
                                      <td className="py-2 pr-3">{call.did || '—'}</td>
                                      <td className="py-2 pr-3">{formatDuration(call.talkduration)}</td>
                                      <td className="py-2 pr-3">
                                        {renderDispositionCell(call)}
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
                                              href={`/api/sarv-calls/${call.id}/stream`}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              Download
                                            </a>
                                            <audio controls preload="none" src={`/api/sarv-calls/${call.id}/stream`} className="w-80 min-w-[20rem] max-w-full h-10" />
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
          </div>
        ) : null}

        {tab === 'overview' ? (
        <div className="space-y-4">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="text-xs text-gray-600">
              Overview defaults to last 7 days. Stats and RSA Leads both follow this date range.
            </div>
            <div className="flex items-end gap-2">
              <label className="text-xs text-gray-600">
                From
                <input
                  className="block mt-1 border rounded-md px-2 py-1.5 text-xs"
                  type="date"
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
                  className="block mt-1 border rounded-md px-2 py-1.5 text-xs"
                  type="date"
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
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-7 md:mb-8">
          <Link href="/dashboard/rsa_manager/leads?status=assigned">
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600">My Complaints</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{overviewStats.total_leads}</p>
                </div>
                <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500 flex-shrink-0" />
              </div>
            </div>
          </Link>

          <Link href="/dashboard/rsa_manager/leads?status=pending">
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600">Pending</p>
                  <p className="text-xl sm:text-2xl font-bold text-yellow-600">{overviewStats.pending_leads}</p>
                </div>
                <Clock className="w-7 h-7 sm:w-8 sm:h-8 text-yellow-500 flex-shrink-0" />
              </div>
            </div>
          </Link>

          <Link href="/dashboard/rsa_manager/leads?status=completed">
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600">Completed</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600">{overviewStats.completed_leads}</p>
                </div>
                <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-green-500 flex-shrink-0" />
              </div>
            </div>
          </Link>

          <Link href="/dashboard/rsa_manager/leads?status=cancelled">
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600">Cancelled</p>
                  <p className="text-xl sm:text-2xl font-bold text-red-600">{overviewStats.cancelled_leads}</p>
                </div>
                <XCircle className="w-7 h-7 sm:w-8 sm:h-8 text-red-500 flex-shrink-0" />
              </div>
            </div>
          </Link>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-5 md:mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  placeholder="Search by customer name, phone, or vehicle number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['assigned', 'pending', 'completed', 'cancelled'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm ${
                    filter === f
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f === 'assigned' ? 'My Complaints' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Leads List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">RSA Leads</h2>
              <div className="text-xs text-gray-500">
                Showing {filteredLeads.length === 0 ? 0 : (overviewPage - 1) * OVERVIEW_PAGE_SIZE + 1}-
                {Math.min(overviewPage * OVERVIEW_PAGE_SIZE, filteredLeads.length)} of {filteredLeads.length}
              </div>
            </div>
            
            {loading ? (
              <div className="text-center py-8 sm:py-10 md:py-12">
                <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-red-600 mx-auto"></div>
                <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">Loading leads...</p>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-8 sm:py-10 md:py-12">
                <AlertCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
                <p className="text-gray-600 text-sm sm:text-base">No leads found</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {paginatedLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/dashboard/rsa_manager/leads/${lead.id}`}
                    className="block border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                            {lead.customer_name}
                          </h3>
                          {getStatusBadge(lead.lead_status || lead.complaint_status)}
                          {getPriorityBadge(lead.priority)}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4 mt-2 sm:mt-3">
                          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                            <span className="font-medium">Phone:</span>
                            <button
                              type="button"
                              className="truncate text-green-700 hover:text-green-800 underline underline-offset-2"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openWhatsAppPreview(lead.contact_number);
                              }}
                            >
                              {lead.contact_number || '—'}
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                            <span className="font-medium">Vehicle:</span>
                            <span className="truncate">{lead.vehicle_number} {lead.vehicle_model ? `(${lead.vehicle_model})` : ''}</span>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600 sm:col-span-2 lg:col-span-1">
                            <span className="font-medium">Service:</span>
                            <span className="truncate">{lead.service_type || 'N/A'}</span>
                          </div>
                        </div>

                        {lead.assigned_manager_name && (
                          <div className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-gray-600">
                            <span className="font-medium">Manager:</span> <span className="truncate">{lead.assigned_manager_name}</span>
                          </div>
                        )}

                        {lead.assigned_mechanic_name && (
                          <div className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-gray-600">
                            <span className="font-medium">Mechanic:</span> <span className="truncate">{lead.assigned_mechanic_name}</span>
                          </div>
                        )}

                        {lead.address && (
                          <div className="mt-1.5 sm:mt-2 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span className="truncate">{lead.address} {lead.pincode ? `- ${lead.pincode}` : ''}</span>
                          </div>
                        )}

                        <div className="mt-2 sm:mt-3 text-[10px] sm:text-xs text-gray-500">
                          Registered: {formatDateTimeISTAssumeUTC(lead.lead_registered_at || lead.requested_at)}
                        </div>
                      </div>
                      
                      <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 ml-2 sm:ml-4 flex-shrink-0" />
                    </div>
                  </Link>
                ))}
                {filteredLeads.length > OVERVIEW_PAGE_SIZE ? (
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      className="btn btn-outline text-xs px-3 py-1.5"
                      onClick={() => setOverviewPage((p) => Math.max(1, p - 1))}
                      disabled={overviewPage <= 1}
                    >
                      Prev
                    </button>
                    <div className="text-xs text-gray-500">
                      Page {overviewPage} of {overviewTotalPages}
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline text-xs px-3 py-1.5"
                      onClick={() => setOverviewPage((p) => Math.min(overviewTotalPages, p + 1))}
                      disabled={overviewPage >= overviewTotalPages}
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
        </div>
        ) : null}
      </div>

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
                <label className="text-xs text-gray-600">Service Type <span className="text-red-500">*</span></label>
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
                <label className="text-xs text-gray-600">City <span className="text-red-500">*</span></label>
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
                  disabled={!dispositionForm.disposition || !dispositionForm.service_type || !dispositionForm.city?.trim()}
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
                          current = m[1].toLowerCase() === 'customer' ? 'customer' : 'employee';
                          const rest = (m[2] || '').trim();
                          if (rest && current) speaker[current].push(rest);
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

      {previousDetailsOpen && previousDetailsCall ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 sm:px-4 py-4 sm:py-6">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-blue-700 text-white px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-lg font-semibold">Previous Call Details</div>
                <div className="text-xs opacity-90 truncate">
                  Customer:{' '}
                  {previousDetailsCall.cnumber ? (
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={() => openWhatsAppPreview(previousDetailsCall.cnumber, previousDetailsCall)}
                    >
                      {previousDetailsCall.cnumber}
                    </button>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
              <button
                type="button"
                className="text-white/80 hover:text-white text-xl"
                onClick={closePreviousDetails}
              >
                ×
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              <div className="rounded-lg border bg-blue-50 p-3 sm:p-4">
                <div className="text-xs text-gray-600">Previous Disposition</div>
                <div className="text-base font-semibold text-gray-900">
                  {previousDetailsCall.previous_disposition ||
                    previousDetailsCall.previous_disposition_category ||
                    '—'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 bg-white">
                  <div className="text-xs text-gray-600">Agent</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {previousDetailsCall.previous_disposition_assigned_user_name || 'Unknown Agent'}
                  </div>
                </div>
                <div className="rounded-lg border p-3 bg-white">
                  <div className="text-xs text-gray-600">Previous Call Time</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {formatSarvCallDateTime(previousDetailsCall.previous_disposition_at)}
                  </div>
                </div>
                <div className="rounded-lg border p-3 bg-white">
                  <div className="text-xs text-gray-600">Talk Duration</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {formatDuration(previousDetailsCall.previous_disposition_talkduration)}
                  </div>
                </div>
              </div>

              {(() => {
                const extras = parseDispositionExtras(previousDetailsCall.previous_disposition_note);
                const serviceType = String(extras.service_type || '').trim();
                const price = String(extras.price || '').trim();
                const city = String(extras.city || '').trim();
                const note = String(extras.note || previousDetailsCall.previous_disposition_note || '').trim();
                return (
                  <div className="rounded-lg border p-3 bg-white">
                    <div className="text-xs text-gray-600 mb-2">Notes</div>
                    {(serviceType || price || city) ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                        <div className="rounded border bg-gray-50 px-2 py-1.5">
                          <div className="text-[10px] text-gray-500">Service</div>
                          <div className="text-xs font-medium text-gray-900">{serviceType || '—'}</div>
                        </div>
                        <div className="rounded border bg-gray-50 px-2 py-1.5">
                          <div className="text-[10px] text-gray-500">Price</div>
                          <div className="text-xs font-medium text-gray-900">{price || '—'}</div>
                        </div>
                        <div className="rounded border bg-gray-50 px-2 py-1.5">
                          <div className="text-[10px] text-gray-500">City</div>
                          <div className="text-xs font-medium text-gray-900">{city || '—'}</div>
                        </div>
                      </div>
                    ) : null}
                    <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                      {note || '—'}
                    </div>
                  </div>
                );
              })()}

              <div className="rounded-lg border p-3 bg-white">
                <div className="text-xs text-gray-600 mb-2">Summary</div>
                <div className="max-h-72 overflow-y-auto rounded border bg-gray-50 p-3 text-xs sm:text-sm text-gray-900 whitespace-pre-wrap break-words">
                  {previousDetailsCall.previous_disposition_summary || '—'}
                </div>
              </div>

              {previousDetailsCall.previous_disposition_recording_url && previousDetailsCall.previous_disposition_callid ? (
                <div className="rounded-lg border p-3 bg-white">
                  <div className="text-xs text-gray-600 mb-2">Recording</div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <a
                      className="text-blue-600 hover:text-blue-700 text-xs font-semibold"
                      href={`/api/sarv-calls/${previousDetailsCall.previous_disposition_callid}/stream`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open / Download Recording
                    </a>
                    <audio
                      controls
                      preload="none"
                      src={`/api/sarv-calls/${previousDetailsCall.previous_disposition_callid}/stream`}
                      className="w-full sm:w-96 h-10"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 px-4 sm:px-5 py-3 border-t bg-white">
                <button
                  type="button"
                  className="btn btn-outline text-sm px-4 py-2"
                  onClick={closePreviousDetails}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary text-sm px-4 py-2"
                  onClick={() => jumpToPreviousCall(previousDetailsCall)}
                  disabled={!String(previousDetailsCall.previous_disposition_callid || '').trim()}
                >
                  Open Related Call
                </button>
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
                <div className="text-xl font-semibold text-gray-900">
                  {auditCall?.cnumber ? (
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={() => openWhatsAppPreview(auditCall.cnumber, auditCall)}
                    >
                      {auditCall.cnumber}
                    </button>
                  ) : (
                    '—'
                  )}
                </div>
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
                      Audited at: {audit.audited_at ? formatDateTimeISTAssumeUTC(audit.audited_at) : '—'}
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
        title="WhatsApp Chat"
        previewMessage={waPreviewMessage}
        onClose={() => setWaPreviewOpen(false)}
      />
    </DashboardLayout>
  );
}

