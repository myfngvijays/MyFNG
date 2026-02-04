'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';

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
  assignee_name?: string | null;
  assignee_email?: string | null;
  assignee_phone?: string | null;
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
};

type OverviewSelection = {
  type: 'district' | 'state' | 'employee' | 'department';
  value: string;
  label: string;
};

type OverviewData = {
  kpis: {
    total_requests: number;
    resolved: number;
    pending: number;
    avg_resolution_hours: number | null;
    total_quoted: number;
    payment_received: number;
    payment_to_mechanic: number;
    company_profit: number;
  };
  breakdowns: {
    department: OverviewBreakdownRow[];
    district: OverviewBreakdownRow[];
    state: OverviewBreakdownRow[];
    employee: OverviewBreakdownRow[];
  };
};

type TabKey = 'mapping' | 'report' | 'overview';

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
  const [reportPage, setReportPage] = useState(1);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportAssignees, setReportAssignees] = useState<Telecaller[]>([]);
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [overviewSelection, setOverviewSelection] = useState<OverviewSelection | null>(null);
  const [overviewLeads, setOverviewLeads] = useState<OverviewLeadRow[]>([]);
  const [overviewLeadsLoading, setOverviewLeadsLoading] = useState(false);
  const [overviewLeadsError, setOverviewLeadsError] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryCall, setSummaryCall] = useState<SarvCallRow | null>(null);
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
    const today = new Date();
    const from = addDays(today, -7);
    return {
      from: formatDateInput(from),
      to: formatDateInput(today),
    };
  });
  const [reportFilters, setReportFilters] = useState(() => {
    const today = new Date();
    const from = addDays(today, -7);
    return {
      from: formatDateInput(from),
      to: formatDateInput(today),
      assignee_role: '',
      assignee_id: '',
      has_recording: false,
      q: '',
      limit: 50,
    };
  });

  const groupedReportCalls = useMemo(() => groupCallsByCustomer(reportCalls), [reportCalls]);

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
      params.set('limit', String(reportFilters.limit));
      params.set('page', String(reportPage));

      const res = await fetch(`/api/super_admin/sarv-calls?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load calls');
      setReportCalls(Array.isArray(json?.calls) ? json.calls : []);
      setReportTotal(Number(json?.pagination?.total || 0));
    } catch (e: any) {
      setReportError(e?.message || 'Failed to load calls');
      setReportCalls([]);
      setReportTotal(0);
    } finally {
      setReportLoading(false);
    }
  };

  const openSummary = (call: SarvCallRow) => {
    setSummaryCall(call);
    setSummaryOpen(true);
  };

  const closeSummary = () => {
    setSummaryOpen(false);
    setSummaryCall(null);
  };

  const loadOverview = async () => {
    setOverviewLoading(true);
    setOverviewError('');
    try {
      const params = new URLSearchParams();
      if (overviewFilters.from) {
        params.set('from', new Date(`${overviewFilters.from}T00:00:00`).toISOString());
      }
      if (overviewFilters.to) {
        params.set('to', new Date(`${overviewFilters.to}T23:59:59`).toISOString());
      }
      const res = await fetch(`/api/super_admin/rsa-overview?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load overview');
      setOverviewData(json || null);
    } catch (e: any) {
      setOverviewError(e?.message || 'Failed to load overview');
      setOverviewData(null);
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadOverviewLeads = async (selection: OverviewSelection) => {
    setOverviewSelection(selection);
    setOverviewLeadsLoading(true);
    setOverviewLeadsError('');
    try {
      const params = new URLSearchParams();
      if (overviewFilters.from) {
        params.set('from', new Date(`${overviewFilters.from}T00:00:00`).toISOString());
      }
      if (overviewFilters.to) {
        params.set('to', new Date(`${overviewFilters.to}T23:59:59`).toISOString());
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
    if (tab !== 'overview') return;
    setOverviewSelection(null);
    setOverviewLeads([]);
    loadOverview();
  }, [tab, overviewFilters]);

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
              <h2 className="text-sm font-semibold text-gray-800">Call Report</h2>
              <div className="text-xs text-gray-500">
                {reportLoading ? 'Loading...' : `${reportCalls.length} rows`}
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
                  </tr>
                </thead>
                <tbody>
                  {groupedReportCalls.length === 0 ? (
                    <tr>
                      <td className="py-3 text-gray-500" colSpan={7}>
                        No calls found.
                      </td>
                    </tr>
                  ) : (
                    groupedReportCalls.map((group) => {
                      const isOpen = expandedCustomers[group.customer] ?? false;
                      const latest = group.calls[0];
                      if (group.calls.length === 1) {
                        const row = latest;
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
                                  <audio controls preload="none" src={row.recording_url} className="w-56" />
                                </div>
                              ) : (
                                '—'
                              )}
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
                          </tr>
                          {isOpen
                            ? group.calls.map((row) => (
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
                                        <audio controls preload="none" src={row.recording_url} className="w-56" />
                                      </div>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                </tr>
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
                disabled={reportPage <= 1 || reportLoading}
              >
                Prev
              </button>
              <div className="text-xs text-gray-500">Page {reportPage}</div>
              <button
                type="button"
                className="btn btn-outline text-xs px-3 py-1.5"
                onClick={() => setReportPage((p) => p + 1)}
                disabled={reportLoading || reportPage * reportFilters.limit >= reportTotal}
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

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">From</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  type="date"
                  value={overviewFilters.from}
                  onChange={(e) => setOverviewFilters((f) => ({ ...f, from: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">To</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  type="date"
                  value={overviewFilters.to}
                  onChange={(e) => setOverviewFilters((f) => ({ ...f, to: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-xs text-gray-500">Total Requests</div>
              <div className="text-2xl font-bold">
                {overviewLoading ? '—' : overviewData?.kpis.total_requests ?? 0}
              </div>
            </div>
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-xs text-gray-500">Total Quoted</div>
              <div className="text-xl font-semibold">
                {overviewLoading ? '—' : formatCurrency(overviewData?.kpis.total_quoted ?? 0)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-xs text-gray-500">Mechanic Payment</div>
              <div className="text-xl font-semibold">
                {overviewLoading ? '—' : formatCurrency(overviewData?.kpis.payment_to_mechanic ?? 0)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-xs text-gray-500">Payment Received</div>
              <div className="text-xl font-semibold">
                {overviewLoading ? '—' : formatCurrency(overviewData?.kpis.payment_received ?? 0)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-xs text-gray-500">Company Profit</div>
              <div className="text-xl font-semibold text-green-600">
                {overviewLoading ? '—' : formatCurrency(overviewData?.kpis.company_profit ?? 0)}
              </div>
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
                      <td className="py-2 pr-3">{formatCurrency(row.company_profit)}</td>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">District-wise Breakdown</h2>
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
                    </tr>
                  </thead>
                  <tbody>
                    {(overviewData?.breakdowns.district || []).map((row) => (
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
                      </tr>
                    ))}
                    {overviewLoading || (overviewData?.breakdowns.district || []).length > 0 ? null : (
                      <tr>
                        <td className="py-3 text-gray-500" colSpan={6}>
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
                      </tr>
                    ))}
                    {overviewLoading || (overviewData?.breakdowns.state || []).length > 0 ? null : (
                      <tr>
                        <td className="py-3 text-gray-500" colSpan={6}>
                          No data found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Employee-wise Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3">Employee</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Resolved</th>
                    <th className="py-2 pr-3">Rate</th>
                    <th className="py-2 pr-3">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(overviewData?.breakdowns.employee || []).map((row) => (
                    <tr key={row.name} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 font-semibold">
                        <button
                          type="button"
                          className="text-blue-600 hover:text-blue-700"
                          onClick={() =>
                            loadOverviewLeads({ type: 'employee', value: row.key, label: row.name })
                          }
                        >
                          {row.name}
                        </button>
                      </td>
                      <td className="py-2 pr-3">{row.total}</td>
                      <td className="py-2 pr-3">{row.resolved}</td>
                      <td className="py-2 pr-3">{formatRate(row.rate)}</td>
                      <td className="py-2 pr-3">{formatCurrency(row.revenue)}</td>
                    </tr>
                  ))}
                  {overviewLoading || (overviewData?.breakdowns.employee || []).length > 0 ? null : (
                    <tr>
                      <td className="py-3 text-gray-500" colSpan={5}>
                        No data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {overviewSelection ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl max-h-[80vh] overflow-hidden">
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
                <div className="overflow-auto">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 px-4">Customer</th>
                        <th className="py-2 px-4">Contact</th>
                        <th className="py-2 px-4">Vehicle</th>
                        <th className="py-2 px-4">Service</th>
                        <th className="py-2 px-4">Status</th>
                        <th className="py-2 px-4">Registered</th>
                        <th className="py-2 px-4">Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewLeads.length === 0 ? (
                        <tr>
                          <td className="py-3 text-gray-500 px-4" colSpan={7}>
                            No customers found.
                          </td>
                        </tr>
                      ) : (
                        overviewLeads.map((lead) => (
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
                            <td className="py-2 px-4">{lead.vehicle_number || '—'}</td>
                            <td className="py-2 px-4">{lead.service_type || lead.service_tag || '—'}</td>
                            <td className="py-2 px-4">{lead.lead_status || lead.complaint_status || '—'}</td>
                            <td className="py-2 px-4">{formatDateTime(lead.lead_registered_at)}</td>
                            <td className="py-2 px-4">{lead.address || lead.pincode || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
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
        </div>
      ) : null}
    </div>
  );
}
