'use client';

import { Fragment, useMemo, useState, useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import DashboardLayout from '@/components/DashboardLayout';
import { RSAManagerService } from '@/lib/services/rsaManagerService';
import { formatDateTime } from '@/lib/utils';
import {
  AlertCircle, Clock, CheckCircle, XCircle, Users,
  Search, Filter, Eye, ChevronRight, Wrench, MapPin
} from 'lucide-react';

type TabKey = 'overview' | 'call_report';

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
};

const DISPOSITION_OPTIONS = [
  'Completed / Service Provided',
  'Not Linked (No Complaint)',
  'Wrong Number',
  'Cancelled by Customer',
  'Follow-up Required',
  'No Service Needed',
  'Out of Service Area',
  'Spam/Unwanted',
  'Test Call',
  'Other',
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
import Link from 'next/link';

export default function RSAManagerDashboard() {
  const supabase = getBrowserClient();
  
  const [tab, setTab] = useState<TabKey>('overview');
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_leads: 0,
    pending_leads: 0,
    completed_leads: 0,
    cancelled_leads: 0,
    assigned_to_me: 0,
    unassigned_leads: 0
  });
  
  const [filter, setFilter] = useState<'all' | 'assigned' | 'unassigned' | 'pending' | 'completed'>('all');
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
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});

  const groupedCalls = useMemo(() => groupCallsByCustomer(calls), [calls]);

  useEffect(() => {
    fetchUser();
    fetchCities();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, filter]);

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const managerId = user?.id;
      const status = filter === 'all' ? '' : filter === 'assigned' ? 'assigned' : filter;
      const showAll = filter === 'all' || filter === 'unassigned';
      
      const [leadsData, statsData] = await Promise.all([
        RSAManagerService.getAllLeads(managerId, status, showAll),
        managerId ? RSAManagerService.getManagerStatistics(managerId) : Promise.resolve(stats)
      ]);
      
      setLeads(leadsData);
      setStats(statsData);
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
  };

  const closeSummary = () => {
    setSummaryOpen(false);
    setSummaryCall(null);
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

  const filteredLeads = leads.filter(lead =>
    lead.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.contact_number?.includes(searchTerm) ||
    lead.vehicle_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout role="rsa_manager">
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 mb-6 sm:mb-7 md:mb-8">
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
                          <th className="py-2 pr-3">Talk</th>
                          <th className="py-2 pr-3">Disposition</th>
                          <th className="py-2 pr-3">Summary</th>
                          <th className="py-2 pr-3">Recording</th>
                          <th className="py-2 pr-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedCalls.map((group) => {
                          const isOpen = expandedCustomers[group.customer] ?? false;
                          const latest = group.calls[0];
                          if (group.calls.length === 1) {
                            const call = latest;
                            return (
                              <tr key={call.id} className="border-b last:border-b-0 align-top">
                                <td className="py-2 pr-3 whitespace-nowrap">
                                  {formatDateTime(call.custanswerstime || call.sarv_created_at || call.created_at)}
                                </td>
                                <td className="py-2 pr-3">{call.cnumber || '—'}</td>
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
                                      <audio controls preload="none" src={call.recording_url} className="w-56" />
                                    </div>
                                  ) : (
                                    '—'
                                  )}
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
                                  {formatDateTime(latest.custanswerstime || latest.sarv_created_at || latest.created_at)}
                                </td>
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
                                    <tr key={call.id} className="border-b last:border-b-0 align-top">
                                      <td className="py-2 pr-3 whitespace-nowrap">
                                        {formatDateTime(
                                          call.custanswerstime || call.sarv_created_at || call.created_at
                                        )}
                                      </td>
                                      <td className="py-2 pr-3">{call.cnumber || '—'}</td>
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
                                            <audio controls preload="none" src={call.recording_url} className="w-56" />
                                          </div>
                                        ) : (
                                          '—'
                                        )}
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
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-7 md:mb-8">
          <Link href="/dashboard/rsa_manager/leads?status=all">
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600">Total Leads</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total_leads}</p>
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
                  <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.pending_leads}</p>
                </div>
                <Clock className="w-7 h-7 sm:w-8 sm:h-8 text-yellow-500 flex-shrink-0" />
              </div>
            </div>
          </Link>

          <Link href="/dashboard/rsa_manager/leads?status=assigned">
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600">Assigned to Me</p>
                  <p className="text-xl sm:text-2xl font-bold text-purple-600">{stats.assigned_to_me}</p>
                </div>
                <Users className="w-7 h-7 sm:w-8 sm:h-8 text-purple-500 flex-shrink-0" />
              </div>
            </div>
          </Link>

          <Link href="/dashboard/rsa_manager/leads?status=unassigned">
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600">Unassigned</p>
                  <p className="text-xl sm:text-2xl font-bold text-orange-600">{stats.unassigned_leads}</p>
                </div>
                <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8 text-orange-500 flex-shrink-0" />
              </div>
            </div>
          </Link>

          <Link href="/dashboard/rsa_manager/leads?status=completed">
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600">Completed</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.completed_leads}</p>
                </div>
                <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-green-500 flex-shrink-0" />
              </div>
            </div>
          </Link>

          <Link href="/dashboard/rsa_manager/leads?status=cancelled" className="sm:col-span-2 lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600">Cancelled</p>
                  <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.cancelled_leads}</p>
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
              {(['all', 'assigned', 'unassigned', 'pending', 'completed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm ${
                    filter === f
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Leads List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-5 md:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">RSA Leads</h2>
            
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
                {filteredLeads.map((lead) => (
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
                            <span className="truncate">{lead.contact_number}</span>
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
                          Registered: {formatDateTime(lead.lead_registered_at || lead.requested_at)}
                        </div>
                      </div>
                      
                      <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 ml-2 sm:ml-4 flex-shrink-0" />
                    </div>
                  </Link>
                ))}
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
                  const sections = parseSummarySections(summaryCall.summary);
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
    </DashboardLayout>
  );
}

