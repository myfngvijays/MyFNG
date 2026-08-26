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
  has_smartflo_api_token?: boolean;
  dids: string[];
  did_assignments: DidAssignment[];
  auto_dial_on_fresh_assign?: boolean;
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
  const [autoDialFresh, setAutoDialFresh] = useState(true);
  const [gatewayKey, setGatewayKey] = useState('');
  const [clearKey, setClearKey] = useState(false);
  const [smartfloToken, setSmartfloToken] = useState('');
  const [clearSmartfloToken, setClearSmartfloToken] = useState(false);
  const [didAssignments, setDidAssignments] = useState<DidAssignment[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingPhoneId, setSavingPhoneId] = useState<string | null>(null);

  const [testFrom, setTestFrom] = useState('');
  const [testTo, setTestTo] = useState('');
  const [testDid, setTestDid] = useState('');
  const [testing, setTesting] = useState(false);
  const [syncingRec, setSyncingRec] = useState(false);
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
      setAutoDialFresh(Boolean(cfg.auto_dial_on_fresh_assign));
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
      setSmartfloToken('');
      setClearSmartfloToken(false);
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
          auto_dial_on_fresh_assign: autoDialFresh,
          gateway_key: canEditSecrets && gatewayKey.trim() ? gatewayKey.trim() : undefined,
          clear_gateway_key: canEditSecrets && clearKey,
          smartflo_api_token:
            canEditSecrets && smartfloToken.trim() ? smartfloToken.trim() : undefined,
          clear_smartflo_api_token: canEditSecrets && clearSmartfloToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setMessage(data.message || 'Saved');
      setConfig(data.config);
      setGatewayKey('');
      setClearKey(false);
      setSmartfloToken('');
      setClearSmartfloToken(false);
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

  const syncRecordings = async () => {
    setSyncingRec(true);
    setMessage(null);
    setError(null);
    const controller = new AbortController();
    const kill = setTimeout(() => controller.abort(), 70_000);
    try {
      const res = await fetch('/api/super_admin/click-to-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_recordings', hours_back: 6, max_pages: 3 }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Recording sync failed');
      setMessage(
        data.message ||
          `Synced ${data.with_recording ?? 0} recording(s) from ${data.fetched ?? 0} CDR row(s)`,
      );
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setError(
          'Sync timed out (~70s). Smartflo CDR slow hai — cron har 15 min auto-try karega, ya thodi der baad dubara Sync dabao.',
        );
      } else {
        setError(e?.message || 'Recording sync failed');
      }
    } finally {
      clearTimeout(kill);
      setSyncingRec(false);
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

  const fallbackAssignedTo = useMemo(() => {
    const row = didAssignments.find((a) => a.did === did && a.telecaller_id);
    return row?.telecaller_id ? telecallerById.get(row.telecaller_id) || null : null;
  }, [didAssignments, did, telecallerById]);

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
              Sirf tumhara gateway URL hit hota hai (
              <code className="text-xs">?from=&amp;to=&amp;did=&amp;provider=</code>
              ). Call button aur Fresh auto-dial dono same URL use karte hain.
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

        <label className="flex items-center gap-2 text-sm font-medium text-slate-800 mb-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-slate-300"
          />
          Enabled (Call + Fresh auto-dial use this URL when on)
        </label>

        <label className="mb-4 flex items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={autoDialFresh}
            onChange={(e) => setAutoDialFresh(e.target.checked)}
            className="mt-1 rounded border-slate-300"
          />
          <span>
            <span className="font-semibold">Auto-dial Fresh leads</span>
            <span className="block text-xs text-slate-600 mt-0.5">
              Naya Fresh/NEW lead assign hote hi same gateway URL hit — pehle telecaller
              phone, uthane pe customer (jaise Call button).
            </span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Gateway URL</span>
            <input
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
              placeholder="https://….supabase.co/functions/v1/click-to-call-gateway"
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              Example:{' '}
              <code className="text-[10px] break-all">
                …/click-to-call-gateway?from=TELECALLER&amp;to=CUSTOMER&amp;did=DID&amp;provider=smartflo
              </code>
            </span>
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
              Only used if this number is still Unassigned. Assigned DIDs (Ajit / Mahendra
              etc.) are exclusive and never shared.
            </span>
            {fallbackAssignedTo ? (
              <span className="mt-1 block text-[11px] text-amber-700">
                This fallback is assigned to {fallbackAssignedTo.full_name || 'a telecaller'} —
                others cannot use it.
              </span>
            ) : null}
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
            <>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">
                  Gateway Bearer key{' '}
                  {config?.has_gateway_key ? '(saved — leave blank to keep)' : '(optional)'}
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
                  Clear saved gateway key
                </label>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">
                  Smartflo API token (`c2c`){' '}
                  {config?.has_smartflo_api_token
                    ? '(saved — leave blank to keep)'
                    : '(for CDR / recordings)'}
                </span>
                <input
                  type="password"
                  value={smartfloToken}
                  onChange={(e) => setSmartfloToken(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                  placeholder={
                    config?.has_smartflo_api_token
                      ? '••••••••'
                      : 'Paste token from Smartflo → API Connect → API Tokens'
                  }
                  autoComplete="new-password"
                />
                <span className="mt-1 block text-[11px] text-slate-500">
                  Smartflo portal → API Connect → API Tokens → copy <code>c2c</code> token. Used for
                  call recordings / CDR (not the Supabase gateway key above).
                </span>
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={clearSmartfloToken}
                    onChange={(e) => setClearSmartfloToken(e.target.checked)}
                  />
                  Clear saved Smartflo token
                </label>
              </label>
            </>
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
          Assigned DID is exclusive — sirf wahi telecaller us number se customer ko dikhata
          hai. Koi aur (Vijay / dialer / auto-dial) us number ko use nahi kar sakta.
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
                    <td className="px-3 py-2.5 font-mono text-slate-900">
                      {row.did}
                      {assigned ? (
                        <span className="ml-2 text-[10px] font-sans font-semibold uppercase tracking-wide text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">
                          Exclusive
                        </span>
                      ) : null}
                    </td>
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

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-1">
          <RefreshCw className="w-5 h-5 text-sky-600" />
          Call recordings
        </h2>
        <p className="text-sm text-slate-500 mb-3">
          Smartflo CDR se <code className="text-xs bg-slate-100 px-1 rounded">recording_url</code>{' '}
          pull karke lead Call history pe Play dikhata hai. Only recordings from{' '}
          <strong>22 Aug 2026</strong> onwards. Cron ON/OFF + interval:{' '}
          <a href="/dashboard/super_admin/whatsapp-cron" className="text-sky-700 underline font-medium">
            WhatsApp Cron Jobs
          </a>{' '}
          → Call recordings (Smartflo). Manual sync yahan se bhi.
        </p>
        <ul className="text-xs text-slate-600 space-y-1 mb-4 list-disc pl-5">
          <li>
            Token: Smartflo API token (<code>c2c</code>) upar save hona chahiye
          </li>
          <li>
            Optional webhook:{' '}
            <code className="bg-slate-100 px-1 rounded break-all">
              https://www.myfng.in/api/webhooks/smartflo
            </code>{' '}
            — event <strong>Call hangup (Missed or Answered)</strong>
          </li>
          <li>
            Migration: <code className="bg-slate-100 px-1 rounded">337_smartflo_call_recordings.sql</code>
          </li>
        </ul>
        <button
          type="button"
          disabled={syncingRec || !config?.has_smartflo_api_token}
          onClick={() => void syncRecordings()}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
        >
          {syncingRec ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncingRec ? 'Syncing (max ~1 min)…' : 'Sync last 6h recordings'}
        </button>
        {!config?.has_smartflo_api_token ? (
          <p className="mt-2 text-xs text-amber-700">Pehle c2c token save karo, phir sync.</p>
        ) : null}
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
