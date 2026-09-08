'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCcw, Scale, Search } from 'lucide-react';

type RightsRow = {
  id: string;
  request_type: string;
  request_type_label?: string;
  full_name: string;
  email: string;
  phone?: string | null;
  details?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  processed_at?: string | null;
};

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-800 ring-amber-200',
  IN_PROGRESS: 'bg-sky-50 text-sky-800 ring-sky-200',
  DONE: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-800 ring-rose-200',
};

function fmt(dt?: string | null) {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dt;
  }
}

export default function DataRightsInboxApp() {
  const [rows, setRows] = useState<RightsRow[]>([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, in_progress: 0, done: 0, rejected: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [types, setTypes] = useState<Array<{ id: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status !== 'ALL') params.set('status', status);
      if (type !== 'ALL') params.set('type', type);
      const res = await fetch(`/api/super_admin/data-rights?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setRows(json.requests || []);
      setCounts(json.counts || { all: 0, pending: 0, in_progress: 0, done: 0, rejected: 0 });
      setTypes(json.types || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [search, status, type]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchRow(id: string, nextStatus: string, notes?: string) {
    setSavingId(id);
    try {
      const res = await fetch('/api/super_admin/data-rights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: nextStatus, notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Update failed');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4 p-3 sm:p-5 md:p-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900">
            <Scale className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <h1 className="!text-slate-900 text-xl font-bold sm:text-2xl">Data Rights</h1>
            <p className="mt-1 text-sm text-slate-600">
              DPDP form submissions from /data-rights — access, correct, erase, withdraw, nominate, grievance.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ['All', counts.all, 'ALL'],
          ['Pending', counts.pending, 'PENDING'],
          ['In progress', counts.in_progress, 'IN_PROGRESS'],
          ['Done', counts.done, 'DONE'],
          ['Rejected', counts.rejected, 'REJECTED'],
        ].map(([label, value, key]) => (
          <button
            key={String(key)}
            type="button"
            onClick={() => setStatus(String(key))}
            className={`rounded-lg border px-3 py-2 text-left ${
              status === key ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
            <div className="text-lg font-bold text-slate-900">{value as number}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
            placeholder="Search name, email, phone, details"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="ALL">All types</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading requests…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No data-rights requests match this filter.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const open = openId === row.id;
            const st = String(row.status || 'PENDING').toUpperCase();
            return (
              <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() => {
                    setOpenId(open ? null : row.id);
                    setNoteDraft((prev) => ({ ...prev, [row.id]: prev[row.id] ?? row.notes ?? '' }));
                  }}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{row.full_name}</span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ${STATUS_TONE[st] || 'bg-slate-50 text-slate-700 ring-slate-200'}`}
                      >
                        {st.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {row.request_type_label || row.request_type} · {row.email}
                      {row.phone ? ` · ${row.phone}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">{fmt(row.created_at)}</p>
                  </div>
                </button>
                {open ? (
                  <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                    <p className="whitespace-pre-wrap text-sm text-slate-800">
                      {row.details || 'No extra details.'}
                    </p>
                    <label className="block text-xs font-medium text-slate-600">
                      Internal notes
                      <textarea
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        rows={3}
                        value={noteDraft[row.id] ?? row.notes ?? ''}
                        onChange={(e) => setNoteDraft((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['PENDING', 'IN_PROGRESS', 'DONE', 'REJECTED'].map((next) => (
                        <button
                          key={next}
                          type="button"
                          disabled={savingId === row.id}
                          onClick={() => void patchRow(row.id, next, noteDraft[row.id] ?? row.notes ?? '')}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                            st === next ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                          } disabled:opacity-50`}
                        >
                          {savingId === row.id && st !== next ? 'Saving…' : next.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                    {row.processed_at ? (
                      <p className="text-xs text-slate-400">Processed {fmt(row.processed_at)}</p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
