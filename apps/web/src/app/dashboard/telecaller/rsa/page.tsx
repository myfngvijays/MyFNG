'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { RSALeadCreateForm } from '@/components/telecaller/RSALeadCreateForm';
import { CheckCircle, Clock, FileText, RefreshCw } from 'lucide-react';

type TabKey = 'overview' | 'create' | 'created' | 'call_report';

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

export default function TelecallerRSAPage() {
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
  const [sarvOpen, setSarvOpen] = useState(false);
  const [sarvLead, setSarvLead] = useState<any | null>(null);
  const [sarvCalls, setSarvCalls] = useState<any[]>([]);
  const [sarvLoading, setSarvLoading] = useState(false);
  const [sarvError, setSarvError] = useState('');

  const stats = useMemo(() => {
    const total = leads.length;
    const pending = leads.filter((l) => String(l?.lead_status || '').toLowerCase() === 'pending').length;
    const completed = leads.filter((l) => String(l?.lead_status || '').toLowerCase() === 'completed').length;
    return { total, pending, completed };
  }, [leads]);

  const fetchLeads = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/telecaller/rsa-complaints?limit=50');
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

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return '—';
    return String(value).replace('T', ' ').slice(0, 19);
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
              <div className="card flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-xs text-gray-600">Total</div>
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

            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm sm:text-base font-bold text-text-heading">Recent RSA leads</h2>
                <div className="text-xs text-gray-500">
                  Showing {leads.length} {loading ? '(loading...)' : ''}
                </div>
              </div>

              {leads.length === 0 ? (
                <div className="text-sm text-gray-600 py-6 text-center">
                  No RSA leads found.
                </div>
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
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((l) => (
                        <tr key={l.id} className="border-b last:border-b-0">
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
                            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                              {l.lead_status || l.complaint_status || '—'}
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            {formatDateTime(l.lead_registered_at || l.requested_at)}
                          </td>
                          <td className="py-2 pr-3">
                            <button
                              type="button"
                              className="text-blue-600 hover:text-blue-700 font-semibold"
                              onClick={() => openSarvCalls(l)}
                            >
                              View calls
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                <div className="text-xs text-gray-500">
                  Showing {createdLeads.length} {createdLoading ? '(loading...)' : ''}
                </div>
              </div>

              {createdLeads.length === 0 ? (
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
                      </tr>
                    </thead>
                    <tbody>
                      {createdLeads.map((l) => (
                        <tr key={l.id} className="border-b last:border-b-0">
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
                            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                              {l.lead_status || l.complaint_status || '—'}
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            {formatDateTime(l.lead_registered_at || l.requested_at)}
                          </td>
                          <td className="py-2 pr-3">
                            <button
                              type="button"
                              className="text-blue-600 hover:text-blue-700 font-semibold"
                              onClick={() => openSarvCalls(l)}
                            >
                              View calls
                            </button>
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
                            <tr className="border-b bg-gray-50">
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

