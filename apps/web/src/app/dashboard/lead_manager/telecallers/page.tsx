'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, RefreshCw, UserPlus, Copy, Check } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';

type TelecallerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean | null;
  created_at?: string;
};

export default function LeadManagerTelecallerIdsPage() {
  const [rows, setRows] = useState<TelecallerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [listFilter, setListFilter] = useState<'active' | 'inactive'>('active');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
  });

  const rowsRef = useRef<TelecallerRow[]>([]);
  rowsRef.current = rows;

  const load = useCallback(async () => {
    setLoading(rowsRef.current.length === 0);
    setError(null);
    try {
      const res = await fetch('/api/lead-manager/telecallers');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load');
      setRows(Array.isArray(json.telecallers) ? json.telecallers : []);
    } catch (e: any) {
      if (!rowsRef.current.length) setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onVis = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  const activeCount = useMemo(
    () => rows.filter((r) => r.is_active !== false).length,
    [rows],
  );
  const inactiveCount = useMemo(
    () => rows.filter((r) => r.is_active === false).length,
    [rows],
  );
  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        listFilter === 'active' ? r.is_active !== false : r.is_active === false,
      ),
    [rows, listFilter],
  );

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const first_name = form.first_name.trim();
      const last_name = form.last_name.trim();
      const full_name = [first_name, last_name].filter(Boolean).join(' ');
      const res = await fetch('/api/lead-manager/telecallers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name,
          last_name,
          full_name,
          email: form.email.trim(),
          phone: form.phone,
          password: form.password,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Create failed');
      setOk(`Created: ${json?.telecaller?.email || form.email}`);
      setForm({ first_name: '', last_name: '', email: '', phone: '', password: '' });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const genPassword = () => {
    const p = `MyFNG${Math.random().toString(36).slice(2, 8)}!`;
    setForm((f) => ({ ...f, password: p }));
  };

  const copyCreds = async () => {
    const text = `Email: ${form.email}\nPassword: ${form.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <DashboardLayout role="LEAD_MANAGER">
      <div className="w-full min-w-0 max-w-3xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#023D95] flex items-center gap-2">
              <UserPlus className="h-6 w-6" />
              Telecaller IDs
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Create login IDs for your telecallers — they report to you automatically.
            </p>
          </div>
          <PageHelpIcon href="/dashboard/lead_manager/telecallers" label="Telecaller IDs" />
        </div>

        <form
          onSubmit={create}
          className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center gap-2 text-[#023D95] font-extrabold text-sm">
            <Plus className="h-4 w-4" /> New telecaller ID
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-slate-600">
              First name *
              <input
                required
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium"
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                placeholder="Rahul"
              />
            </label>
            <label className="block text-xs font-bold text-slate-600">
              Last name
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium"
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                placeholder="Sharma"
              />
            </label>
            <label className="block text-xs font-bold text-slate-600">
              Email (login) *
              <input
                required
                type="email"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="rahul@myfng.com"
              />
            </label>
            <label className="block text-xs font-bold text-slate-600">
              Phone
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                  }))
                }
                placeholder="10-digit"
                inputMode="numeric"
              />
            </label>
            <label className="block text-xs font-bold text-slate-600 sm:col-span-2">
              Password *
              <div className="mt-1 flex gap-2">
                <input
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="min 6 chars"
                />
                <button
                  type="button"
                  onClick={genPassword}
                  className="shrink-0 rounded-xl border border-slate-200 px-3 text-xs font-bold text-[#004AAD]"
                >
                  Generate
                </button>
              </div>
            </label>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#004AAD] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create ID
            </button>
            {form.email && form.password ? (
              <button
                type="button"
                onClick={() => void copyCreds()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copy email + password
              </button>
            ) : null}
          </div>
          {error ? <p className="text-sm text-red-600 font-medium">{error}</p> : null}
          {ok ? <p className="text-sm text-emerald-700 font-medium">{ok}</p> : null}
        </form>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-[#023D95]">
              Your telecallers ({filtered.length})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setListFilter('active')}
                className={`rounded-full px-3 py-1 text-[11px] font-bold border ${
                  listFilter === 'active'
                    ? 'bg-[#004AAD] text-white border-[#004AAD]'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setListFilter('inactive')}
                className={`rounded-full px-3 py-1 text-[11px] font-bold border ${
                  listFilter === 'inactive'
                    ? 'bg-[#004AAD] text-white border-[#004AAD]'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Show inactive ({inactiveCount})
              </button>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#004AAD]"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-12 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-slate-400 text-center">
              {listFilter === 'active' ? 'No active telecallers.' : 'No inactive telecallers.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {filtered.map((t) => (
                <li key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {t.full_name || 'Telecaller'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {t.email || '—'}
                      {t.phone ? ` · ${t.phone}` : ''}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full shrink-0 ${
                      t.is_active !== false
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {t.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
