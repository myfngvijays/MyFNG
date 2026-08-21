'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Phone,
  PhoneCall,
  RefreshCw,
  Save,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

type DidAssignment = {
  did: string;
  telecaller_id: string | null;
};

type ConfigPublic = {
  enabled: boolean;
  gateway_url: string;
  did: string;
  provider: string;
  has_gateway_key: boolean;
  dids: string[];
  did_assignments: DidAssignment[];
};

type TelecallerRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  missing_from: boolean;
  assigned_did?: string | null;
};

export default function ClickToCallSetupPanel({ canEditSecrets = true }: { canEditSecrets?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDids, setSavingDids] = useState(false);
  const [config, setConfig] = useState<ConfigPublic | null>(null);
  const [telecallers, setTelecallers] = useState<TelecallerRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [gatewayUrl, setGatewayUrl] = useState('');
  const [did, setDid] = useState('');
  const [provider, setProvider] = useState('smartflo');
  const [enabled, setEnabled] = useState(true);
  const [gatewayKey, setGatewayKey] = useState('');
  const [clearKey, setClearKey] = useState(false);
  const [didAssignments, setDidAssignments] = useState<DidAssignment[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingPhoneId, setSavingPhoneId] = useState<string | null>(null);

  const [testFrom, setTestFrom] = useState('');
  const [testTo, setTestTo] = useState('');
  const [testDid, setTestDid] = useState('');
  const [testing, setTesting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/click-to-call', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const cfg = data.config as ConfigPublic;
      setConfig(cfg);
      setEnabled(Boolean(cfg.enabled));
      setGatewayUrl(String(cfg.gateway_url || ''));
      setDid(String(cfg.did || ''));
      setProvider(String(cfg.provider || 'smartflo'));
      setDidAssignments(
        Array.isArray(cfg.did_assignments)
          ? cfg.did_assignments.map((a) => ({
              did: String(a.did),
              telecaller_id: a.telecaller_id ? String(a.telecaller_id) : null,
            }))
          : [],
      );
      setGatewayKey('');
      setClearKey(false);
      const list = (data.telecallers || []) as TelecallerRow[];
      setTelecallers(list);
      const d: Record<string, string> = {};
      for (const t of list) d[t.id] = t.phone || '';
      setDrafts(d);
      setTestFrom((prev) => {
        if (prev) return prev;
        const first = list.find((t) => t.is_active && t.phone)?.phone;
        return first ? String(first).replace(/\D/g, '').slice(-10) : '';
      });
      setTestDid((prev) => prev || String(cfg.did || cfg.dids?.[0] || ''));
    } catch (e: any) {
      setError(e?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveConfig = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/click-to-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          enabled,
          gateway_url: gatewayUrl,
          did,
          provider,
          gateway_key: canEditSecrets && gatewayKey.trim() ? gatewayKey.trim() : undefined,
          clear_gateway_key: canEditSecrets && clearKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setMessage(data.message || 'Saved');
      setConfig(data.config);
      setGatewayKey('');
      setClearKey(false);
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveDidAssignments = async () => {
    setSavingDids(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/click-to-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_did_assignments',
          did_assignments: didAssignments,
          did,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'DID save failed');
      setMessage(data.message || 'DID assignments saved');
      setConfig(data.config);
      if (data.config?.did_assignments) {
        setDidAssignments(data.config.did_assignments);
      }
      await load();
    } catch (e: any) {
      setError(e?.message || 'DID save failed');
    } finally {
      setSavingDids(false);
    }
  };

  const setAssigneeForDid = (didNumber: string, telecallerId: string) => {
    const tid = telecallerId.trim() || null;
    setDidAssignments((prev) =>
      prev.map((row) => {
        if (row.did === didNumber) return { ...row, telecaller_id: tid };
        // One telecaller → one DID
        if (tid && row.telecaller_id === tid) return { ...row, telecaller_id: null };
        return row;
      }),
    );
  };

  const savePhone = async (id: string) => {
    setSavingPhoneId(id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/click-to-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_telecaller_phone',
          telecaller_id: id,
          phone: drafts[id] || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Phone save failed');
      setMessage(data.message || 'Phone saved');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Phone save failed');
    } finally {
      setSavingPhoneId(null);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setMessage(null);
    setError(null);
    try {
      const assignee = didAssignments.find((a) => a.did === testDid)?.telecaller_id || null;
      const res = await fetch('/api/super_admin/click-to-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_call',
          from: testFrom,
          to: testTo,
          did: testDid || undefined,
          telecaller_id: assignee || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Test call failed');
      setMessage(
        data.message
          ? `${data.message}${data.did ? ` (DID ${data.did})` : ''}`
          : 'Call started',
      );
    } catch (e: any) {
      setError(e?.message || 'Test call failed');
    } finally {
      setTesting(false);
    }
  };

  const missingCount = telecallers.filter((t) => t.missing_from && t.is_active).length;
  const activeTelecallers = telecallers.filter((t) => t.is_active);
  const inactiveTelecallers = telecallers.filter((t) => !t.is_active);
  const visibleTelecallers = showInactive
    ? [...activeTelecallers, ...inactiveTelecallers]
    : activeTelecallers;

  const telecallerById = useMemo(() => {
    const m = new Map<string, TelecallerRow>();
    for (const t of telecallers) m.set(t.id, t);
    return m;
  }, [telecallers]);

  const assigneeOptions = useMemo(() => {
    // Active first; include currently assigned inactive so dropdown doesn't lose label
    const ids = new Set(activeTelecallers.map((t) => t.id));
    for (const a of didAssignments) {
      if (a.telecaller_id) ids.add(a.telecaller_id);
    }
    return [...ids]
      .map((id) => telecallerById.get(id))
      .filter(Boolean) as TelecallerRow[];
  }, [activeTelecallers, didAssignments, telecallerById]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-600 py-12 justify-center">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading click-to-call setup…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-indigo-600" />
              Gateway settings
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Smartflo click-to-call: agent phone rings first (<code className="text-xs">from</code>), then
              customer (<code className="text-xs">to</code>).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-800 mb-4">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-slate-300"
          />
          Enabled (Call buttons use gateway when on)
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Gateway URL</span>
            <input
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="https://….supabase.co/functions/v1/click-to-call-gateway"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Fallback DID</span>
            <select
              value={did}
              onChange={(e) => setDid(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono bg-white"
            >
              {(config?.dids || []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-slate-400">
              Used when telecaller has no DID assigned below
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Provider</span>
            <input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="smartflo"
            />
          </label>
          {canEditSecrets ? (
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">
                Gateway Bearer key {config?.has_gateway_key ? '(saved — leave blank to keep)' : '(optional)'}
              </span>
              <input
                type="password"
                value={gatewayKey}
                onChange={(e) => setGatewayKey(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                placeholder={config?.has_gateway_key ? '••••••••' : 'Supabase anon / function key'}
                autoComplete="new-password"
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={clearKey}
                  onChange={(e) => setClearKey(e.target.checked)}
                />
                Clear saved key
              </label>
            </label>
          ) : null}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => void saveConfig()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save gateway settings
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-1">
          <PhoneCall className="w-5 h-5 text-violet-600" />
          DID assignment
        </h2>
        <p className="text-sm text-slate-500 mb-3">
          Apne 5 Smartflo DIDs — har number kisi telecaller ko assign / change karo. Example:{' '}
          <code className="text-xs bg-slate-100 px-1 rounded">919262190064</code> → Sitaram.
        </p>

        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">DID number</th>
                <th className="px-3 py-2">Assign to telecaller</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {didAssignments.map((row) => {
                const assigned = row.telecaller_id
                  ? telecallerById.get(row.telecaller_id)
                  : null;
                return (
                  <tr key={row.did}>
                    <td className="px-3 py-2.5 font-mono text-slate-900">{row.did}</td>
                    <td className="px-3 py-2.5">
                      <select
                        value={row.telecaller_id || ''}
                        onChange={(e) => setAssigneeForDid(row.did, e.target.value)}
                        className="w-full max-w-xs rounded-md border border-slate-200 px-2 py-1.5 text-sm bg-white"
                      >
                        <option value="">— Unassigned —</option>
                        {assigneeOptions.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name || t.email || t.id}
                            {!t.is_active ? ' (inactive)' : ''}
                          </option>
                        ))}
                      </select>
                      {assigned?.phone ? (
                        <div className="mt-1 text-[11px] text-slate-400">
                          from: {String(assigned.phone).replace(/\D/g, '').slice(-10)}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          disabled={savingDids}
          onClick={() => void saveDidAssignments()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-60"
        >
          {savingDids ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save DID assignments
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-1">
          <Phone className="w-5 h-5 text-emerald-600" />
          Telecaller from numbers
        </h2>
        <p className="text-sm text-slate-500 mb-3">
          Each telecaller&apos;s profile phone is the <strong>from</strong> number Smartflo dials first. Example:
          Mahendra → <code className="text-xs bg-slate-100 px-1 rounded">9594050288</code>.
        </p>
        {missingCount > 0 ? (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {missingCount} active telecaller(s) missing phone — Call will fail until set.
          </div>
        ) : (
          <div className="mb-3 flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            All active telecallers have a from number.
          </div>
        )}

        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">From phone</th>
                <th className="px-3 py-2">DID</th>
                <th className="px-3 py-2 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleTelecallers.map((t) => {
                const theirDid =
                  didAssignments.find((a) => a.telecaller_id === t.id)?.did ||
                  t.assigned_did ||
                  null;
                return (
                  <tr key={t.id} className={!t.is_active ? 'opacity-50' : undefined}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{t.full_name || '—'}</div>
                      <div className="text-xs text-slate-400">{t.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      {t.is_active ? (
                        <span className="text-emerald-700 text-xs font-medium">Active</span>
                      ) : (
                        <span className="text-slate-400 text-xs">Inactive</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={drafts[t.id] ?? ''}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [t.id]: e.target.value.replace(/\D/g, ''),
                          }))
                        }
                        className={`w-full max-w-[160px] rounded-md border px-2 py-1.5 font-mono text-sm ${
                          t.missing_from ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                        }`}
                        placeholder="10-digit mobile"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                      {theirDid || <span className="text-slate-300">fallback</span>}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={savingPhoneId === t.id}
                        onClick={() => void savePhone(t.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-900 text-white px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
                      >
                        {savingPhoneId === t.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visibleTelecallers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500 text-sm">
                    No active telecallers found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {inactiveTelecallers.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            {showInactive
              ? 'Hide inactive'
              : `Show inactive (${inactiveTelecallers.length})`}
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Test call</h2>
        <p className="text-sm text-slate-500 mb-3">
          Rings <code className="text-xs">from</code> first, then connects <code className="text-xs">to</code>.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">From (agent)</span>
            <input
              value={testFrom}
              onChange={(e) => setTestFrom(e.target.value.replace(/\D/g, ''))}
              className="mt-1 block w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">To (customer)</span>
            <input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value.replace(/\D/g, ''))}
              className="mt-1 block w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">DID</span>
            <select
              value={testDid}
              onChange={(e) => setTestDid(e.target.value)}
              className="mt-1 block w-44 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono bg-white"
            >
              {(config?.dids || didAssignments.map((a) => a.did)).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={testing || !testFrom || !testTo}
            onClick={() => void runTest()}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
            Place test call
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}
    </div>
  );
}
