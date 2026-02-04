'use client';

import { useEffect, useMemo, useState } from 'react';

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
  effective_from: string;
  effective_to: string | null;
  day_of_week?: number[] | null;
  time_from?: string | null;
  time_to?: string | null;
  assignee?: Telecaller | null;
};

type TabKey = 'mapping';

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

export default function SuperAdminRSASettingsPage() {
  const [tab] = useState<TabKey>('mapping');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);
  const [backfillLoading, setBackfillLoading] = useState(false);
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
    setError('');
    try {
      const mapRes = await fetch('/api/super_admin/sarv-aansh-mappings');
      const mapJson = await mapRes.json().catch(() => ({}));
      if (!mapRes.ok) throw new Error(mapJson?.error || 'Failed to load mappings');
      setMappings(Array.isArray(mapJson?.mappings) ? mapJson.mappings : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
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
      setError(e?.message || 'Failed to load users');
      setTelecallers([]);
    }
  };

  useEffect(() => {
    loadMappings();
    loadAssignees(form.assignee_role);
  }, []);

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
      setError(e?.message || 'Save failed');
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
    setError('');
    try {
      const res = await fetch(`/api/super_admin/sarv-aansh-mappings/${row.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Delete failed');
      loadMappings();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  const runBackfill = async () => {
    if (!confirm('Run backfill for unmapped SARV calls?')) return;
    setBackfillLoading(true);
    setError('');
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
      setError(e?.message || 'Backfill failed');
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

      {tab === 'mapping' ? (
        <div className="space-y-6">
          {error ? <div className="text-sm text-red-600">{error}</div> : null}

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
                          {row.assignee?.full_name || row.assignee?.email || row.assignee?.phone || row.assignee_id || row.telecaller_id}
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
    </div>
  );
}
