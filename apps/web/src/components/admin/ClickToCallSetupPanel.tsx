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
  Clock,
  CalendarDays,
  CalendarOff,
  Hash,
  PhoneOutgoing,
  Disc3,
} from 'lucide-react';
import PageHelpIcon from '@/components/PageHelpIcon';
import { getIstYmd, sanitizeLeaveRange } from '@/lib/telecaller/clickToCallHours';

type SectionId = 'gateway' | 'days' | 'leave' | 'did' | 'phones' | 'test' | 'recordings';

const CTC_NAV: {
  id: SectionId;
  label: string;
  icon: typeof Phone;
  description: string;
}[] = [
  { id: 'gateway', label: 'Gateway', icon: PhoneCall, description: 'URL, auto-dial & tokens' },
  { id: 'days', label: 'Working Days', icon: CalendarDays, description: 'Shift, weekly off & cover' },
  { id: 'leave', label: 'Leave', icon: CalendarOff, description: 'Emergency / planned leave' },
  { id: 'did', label: 'DID', icon: Hash, description: 'Exclusive number assignment' },
  { id: 'phones', label: 'From Numbers', icon: Phone, description: 'Telecaller callback phones' },
  { id: 'test', label: 'Test Call', icon: PhoneOutgoing, description: 'Place a test call' },
  { id: 'recordings', label: 'Recordings', icon: Disc3, description: 'Smartflo CDR sync' },
];

function isSectionId(value: string | null | undefined): value is SectionId {
  return Boolean(value && CTC_NAV.some((item) => item.id === value));
}

function readSectionFromUrl(fallback: SectionId): SectionId {
  if (typeof window === 'undefined') return fallback;
  const q = new URLSearchParams(window.location.search).get('section');
  return isSectionId(q) ? q : fallback;
}

const WEEKDAY_CHIPS = [
  { id: 0, label: 'Sun' },
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
] as const;

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
  auto_dial_hours_enabled?: boolean;
  auto_dial_start?: string;
  auto_dial_end?: string;
  auto_dial_days?: number[];
  auto_dial_days_label?: string;
  telecaller_hours?: Record<
    string,
    {
      start: string;
      end: string;
      days?: number[] | null;
      leave_from?: string | null;
      leave_to?: string | null;
      on_leave?: boolean;
      auto_dial_enabled?: boolean;
      offday_cover_id?: string | null;
      leave_cover_id?: string | null;
    }
  >;
  clock?: { now_hhmm: string; weekday_label: string; open: boolean; reason: string };
};

type HoursDraft = {
  start: string;
  end: string;
  days: number[];
  leave_from: string;
  leave_to: string;
  on_leave: boolean;
  auto_dial_enabled: boolean;
  offday_cover_id: string;
  leave_cover_id: string;
};

type TelecallerRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  missing_from: boolean;
  assigned_did?: string | null;
  dial_hours?: {
    start: string;
    end: string;
    days?: number[];
    source?: string;
    leave_from?: string | null;
    leave_to?: string | null;
    on_leave?: boolean;
  };
  dial_open_now?: boolean;
  on_leave?: boolean;
  auto_dial_enabled?: boolean;
  punched_in?: boolean;
  on_floor?: boolean;
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
  const [hoursEnabled, setHoursEnabled] = useState(true);
  const [hoursStart, setHoursStart] = useState('10:00');
  const [hoursEnd, setHoursEnd] = useState('19:00');
  const [hoursDays, setHoursDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [hourDrafts, setHourDrafts] = useState<Record<string, HoursDraft>>({});
  const [savingHours, setSavingHours] = useState(false);
  const [savingHoursId, setSavingHoursId] = useState<string | null>(null);
  const [selectedHoursId, setSelectedHoursId] = useState<string>('');
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
  const [section, setSection] = useState<SectionId>(() =>
    readSectionFromUrl(canEditSecrets ? 'gateway' : 'days'),
  );

  const goSection = (id: SectionId) => {
    setSection(id);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('section', id);
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  };

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
      setHoursEnabled(cfg.auto_dial_hours_enabled !== false);
      setHoursStart(String(cfg.auto_dial_start || '10:00'));
      setHoursEnd(String(cfg.auto_dial_end || '19:00'));
      setHoursDays(Array.isArray(cfg.auto_dial_days) && cfg.auto_dial_days.length ? cfg.auto_dial_days : [1, 2, 3, 4, 5, 6]);
      const customHours = cfg.telecaller_hours || {};
      const defaultStart = String(cfg.auto_dial_start || '10:00');
      const defaultEnd = String(cfg.auto_dial_end || '19:00');
      const defaultDays =
        Array.isArray(cfg.auto_dial_days) && cfg.auto_dial_days.length
          ? cfg.auto_dial_days
          : [1, 2, 3, 4, 5, 6];
      const drafts: Record<string, HoursDraft> = {};
      for (const t of (data.telecallers || []) as TelecallerRow[]) {
        const own = customHours[t.id];
        drafts[t.id] = {
          start: own?.start || defaultStart,
          end: own?.end || defaultEnd,
          days: Array.isArray(own?.days) && own.days.length ? own.days : defaultDays,
          leave_from: own?.leave_from || '',
          leave_to: own?.leave_to || '',
          on_leave: Boolean(own?.on_leave),
          auto_dial_enabled: own?.auto_dial_enabled !== false,
          offday_cover_id: own?.offday_cover_id || '',
          leave_cover_id: own?.leave_cover_id || '',
        };
      }
      setHourDrafts(drafts);
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
      setSelectedHoursId((prev) => {
        if (prev && list.some((t) => t.id === prev)) return prev;
        return list.find((t) => t.is_active)?.id || list[0]?.id || '';
      });
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
          auto_dial_hours_enabled: hoursEnabled,
          auto_dial_start: hoursStart,
          auto_dial_end: hoursEnd,
          auto_dial_days: hoursDays,
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

  const patchHourDraft = (id: string, patch: Partial<HoursDraft>) => {
    setHourDrafts((prev) => {
      const cur = prev[id] || {
        start: hoursStart,
        end: hoursEnd,
        days: hoursDays,
        leave_from: '',
        leave_to: '',
        on_leave: false,
        auto_dial_enabled: true,
        offday_cover_id: '',
        leave_cover_id: '',
      };
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  };

  const togglePersonDay = (id: string, day: number) => {
    const cur = hourDrafts[id]?.days || hoursDays;
    const next = cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day].sort((a, b) => a - b);
    if (!next.length) return;
    patchHourDraft(id, { days: next });
  };

  const buildHoursMap = () => {
    const telecaller_hours: Record<string, HoursDraft> = {};
    for (const t of telecallers) {
      const d = hourDrafts[t.id];
      if (!d) continue;
      telecaller_hours[t.id] = {
        start: d.start || hoursStart,
        end: d.end || hoursEnd,
        days: d.days?.length ? d.days : hoursDays,
        leave_from: d.leave_from || '',
        leave_to: d.leave_to || '',
        on_leave: Boolean(d.on_leave),
        auto_dial_enabled: d.auto_dial_enabled !== false,
        offday_cover_id: d.offday_cover_id || '',
        leave_cover_id: d.leave_cover_id || '',
      };
    }
    return telecaller_hours;
  };

  const saveTelecallerHours = async () => {
    setSavingHours(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/click-to-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          auto_dial_hours_enabled: hoursEnabled,
          auto_dial_start: hoursStart,
          auto_dial_end: hoursEnd,
          auto_dial_days: hoursDays,
          telecaller_hours: buildHoursMap(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Hours save failed');
      setMessage(data.message || 'Calling hours saved');
      setConfig(data.config);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Hours save failed');
    } finally {
      setSavingHours(false);
    }
  };

  const saveOneTelecallerHours = async (id: string) => {
    const d = hourDrafts[id];
    if (!d) return;
    const leave = sanitizeLeaveRange({
      leave_from: d.leave_from,
      leave_to: d.leave_to,
      on_leave: d.on_leave,
    });
    if (leave.error) {
      setError(leave.error);
      return;
    }
    setSavingHoursId(id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/click-to-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_telecaller_hours',
          telecaller_id: id,
          start: d.start,
          end: d.end,
          days: d.days,
          leave_from: leave.leave_from || '',
          leave_to: leave.leave_to || '',
          on_leave: leave.on_leave,
          auto_dial_enabled: d.auto_dial_enabled !== false,
          offday_cover_id: d.offday_cover_id || '',
          leave_cover_id: d.leave_cover_id || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Hours save failed');
      setMessage(data.message || 'Shift saved');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Hours save failed');
    } finally {
      setSavingHoursId(null);
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

  const currentNav = CTC_NAV.find((item) => item.id === section) || CTC_NAV[0];
  const helpHref =
    typeof window !== 'undefined' && window.location.pathname.includes('/lead_manager/')
      ? '/dashboard/lead_manager/click-to-call'
      : '/dashboard/super_admin/click-to-call';

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <PhoneCall className="w-6 h-6 text-indigo-600" />
              Click to Call
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {currentNav.label} — {currentNav.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <PageHelpIcon href={helpHref} label="Click to Call" />
          </div>
        </div>
        <div className="px-4 sm:px-5 py-2 overflow-x-auto border-t border-slate-100">
          <div className="flex gap-2 min-w-max pb-1">
            {CTC_NAV.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goSection(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition ${
                    active
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </div>
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

      {section === 'gateway' ? (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm max-w-4xl">
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
              phone, uthane pe customer (jaise Call button). Calling hours ke bahar skip
              hota hai; window khulte hi cron catch-up karta hai.
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
      ) : null}

      {section === 'days' || section === 'leave' ? (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm max-w-4xl">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-1">
          <Clock className="w-5 h-5 text-amber-600" />
          {section === 'leave' ? 'Leave & cover' : 'Working days & shift'}
        </h2>
        <p className="text-sm text-slate-500 mb-3">
          {section === 'leave'
            ? 'Emergency ya planned leave pe nayi lead is person ko nahi — cover telecaller auto-assign.'
            : 'Weekly off pe nayi lead is person ko nahi jayegi — cover telecaller auto-assign. Fresh auto-dial alag on/off. Manual Call kabhi block nahi.'}
        </p>

        {section === 'days' ? (
        <label className="mb-4 flex items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={hoursEnabled}
            onChange={(e) => setHoursEnabled(e.target.checked)}
            className="mt-1 rounded border-slate-300"
          />
          <span>
            <span className="font-semibold">Restrict auto-dial to each telecaller&apos;s hours</span>
            <span className="block text-xs text-slate-600 mt-0.5">
              Off-hours / leave pe lead pending — unke shift start pe automatic call.
            </span>
          </span>
        </label>
        ) : null}

        {section === 'days' ? (
        <details className="mb-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Fallback for new telecallers ({hoursStart}–{hoursEnd} IST)
          </summary>
          <div className="grid gap-3 sm:grid-cols-2 mt-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Default start</span>
              <input
                type="time"
                value={hoursStart}
                onChange={(e) => setHoursStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Default end</span>
              <input
                type="time"
                value={hoursEnd}
                onChange={(e) => setHoursEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={savingHours}
            onClick={() => void saveTelecallerHours()}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800"
          >
            {savingHours ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save fallback
          </button>
        </details>
        ) : null}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowInactive(false);
              const first = activeTelecallers[0];
              if (first) setSelectedHoursId(first.id);
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold border ${
              !showInactive
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            Active ({activeTelecallers.length})
          </button>
          <button
            type="button"
            onClick={() => setShowInactive(true)}
            className={`rounded-full px-3 py-1 text-xs font-semibold border ${
              showInactive
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            Show inactive ({inactiveTelecallers.length})
          </button>
        </div>

        <label className="block mb-4">
          <span className="text-xs font-medium text-slate-600">Select telecaller</span>
          <select
            value={
              visibleTelecallers.some((t) => t.id === selectedHoursId)
                ? selectedHoursId
                : visibleTelecallers[0]?.id || ''
            }
            onChange={(e) => setSelectedHoursId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
          >
            {visibleTelecallers.length === 0 ? (
              <option value="">No telecallers</option>
            ) : null}
            {visibleTelecallers.map((t) => {
              const off = hourDrafts[t.id]?.auto_dial_enabled === false;
              return (
                <option key={t.id} value={t.id}>
                  {t.full_name || t.email || t.id}
                  {!t.is_active ? ' (inactive)' : ''}
                  {off ? ' · autodial OFF' : ''}
                </option>
              );
            })}
          </select>
        </label>

        {(() => {
          const t =
            visibleTelecallers.find((row) => row.id === selectedHoursId) ||
            visibleTelecallers[0] ||
            null;
          if (!t) {
            return <p className="text-sm text-slate-500">No telecaller in this filter.</p>;
          }
          const d = hourDrafts[t.id] || {
            start: hoursStart,
            end: hoursEnd,
            days: hoursDays,
            leave_from: '',
            leave_to: '',
            on_leave: false,
            auto_dial_enabled: true,
            offday_cover_id: '',
            leave_cover_id: '',
          };
          const autodialOn = d.auto_dial_enabled !== false;
          const paused = t.on_leave || t.dial_open_now === false || !autodialOn;
          return (
            <div
              className={`rounded-xl border p-4 ${
                t.on_leave ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <div className="font-semibold text-slate-900">{t.full_name || t.email || 'Telecaller'}</div>
                  <div className="text-xs text-slate-500">{t.email}</div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        t.on_floor
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          t.on_floor ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                      {t.on_floor ? 'On floor' : 'Off duty'}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                    !autodialOn
                      ? 'bg-slate-200 text-slate-700'
                      : t.on_leave
                        ? 'bg-rose-100 text-rose-800'
                        : paused
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {!autodialOn ? 'Autodial off' : t.on_leave ? 'On leave' : paused ? 'Paused now' : 'Open now'}
                </span>
              </div>

              {section === 'days' ? (
              <>
              <label
                className={`mb-4 flex items-center justify-between gap-3 rounded-xl border px-3 py-3 ${
                  autodialOn
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Fresh auto-dial</span>
                  <span className="block text-xs text-slate-600">
                    Off = is person ko naya lead assign hone par call nahi jayega. Baaki
                    telecallers on reh sakte hain.
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autodialOn}
                  onClick={() => patchHourDraft(t.id, { auto_dial_enabled: !autodialOn })}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    autodialOn ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                      autodialOn ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Start (IST)</span>
                  <input
                    type="time"
                    value={d.start}
                    onChange={(e) => patchHourDraft(t.id, { start: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">End (IST)</span>
                  <input
                    type="time"
                    value={d.end}
                    onChange={(e) => patchHourDraft(t.id, { end: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="mt-3">
                <p className="text-xs font-medium text-slate-600 mb-1.5">Working days</p>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_CHIPS.map((chip) => {
                    const on = d.days.includes(chip.id);
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => togglePersonDay(t.id, chip.id)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                          on
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                    })}
                  </div>
                </div>

                {d.days.length < 7 ? (
                  <label className="mt-3 block rounded-lg border border-amber-100 bg-amber-50/70 p-3">
                    <span className="text-xs font-semibold text-amber-950">
                      Off-day leads assign to
                    </span>
                    <p className="text-[11px] text-amber-800 mt-0.5 mb-1.5">
                      Jo din orange nahi (jaise Tuesday off) — us din ki nayi lead is
                      person ko nahi, neeche wale ko auto-assign.
                    </p>
                    <select
                      value={d.offday_cover_id}
                      onChange={(e) => patchHourDraft(t.id, { offday_cover_id: e.target.value })}
                      className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">— Select cover telecaller —</option>
                      {activeTelecallers
                        .filter((o) => o.id !== t.id)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.full_name || o.email || o.id}
                            {o.on_floor ? ' · on floor' : ''}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
              </>
              ) : null}

                {section === 'leave' ? (() => {
                  const todayYmd = getIstYmd();
                  const fromMin = todayYmd;
                  const toMin =
                    d.leave_from && d.leave_from > todayYmd ? d.leave_from : todayYmd;
                  return (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs font-semibold text-slate-800">Leave dates</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Leave from–to wahi planned leave hai jo pehle se bol ke lete hain.
                        Emergency pe bhi date zaroori — 1 din default, extra din Leave to se.
                        Past date select nahi hogi.
                      </p>
                      <label className="mt-2 inline-flex items-start gap-2 text-sm text-slate-800">
                        <input
                          type="checkbox"
                          checked={d.on_leave}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (!checked) {
                              patchHourDraft(t.id, { on_leave: false });
                              return;
                            }
                            const from =
                              d.leave_from && d.leave_from >= todayYmd ? d.leave_from : todayYmd;
                            const to =
                              d.leave_to && d.leave_to >= from ? d.leave_to : from;
                            patchHourDraft(t.id, {
                              on_leave: true,
                              leave_from: from,
                              leave_to: to,
                            });
                          }}
                          className="mt-0.5 rounded border-slate-300"
                        />
                        <span>
                          On leave today (emergency)
                          <span className="block text-[11px] text-slate-500">
                            Tick karte hi aaj ki date aa jayegi. 2 din ho toh sirf Leave to badhao.
                          </span>
                        </span>
                      </label>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">
                            Leave from
                          </span>
                          <input
                            type="date"
                            min={fromMin}
                            value={d.leave_from}
                            onChange={(e) => {
                              const from = e.target.value;
                              const to =
                                d.leave_to && d.leave_to >= from ? d.leave_to : from;
                              patchHourDraft(t.id, { leave_from: from, leave_to: to });
                            }}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">
                            Leave to
                          </span>
                          <input
                            type="date"
                            min={toMin}
                            value={d.leave_to}
                            onChange={(e) => {
                              const to = e.target.value;
                              const from =
                                d.leave_from && d.leave_from <= to ? d.leave_from : to;
                              patchHourDraft(t.id, { leave_from: from, leave_to: to });
                            }}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })() : null}

              {section === 'leave' && (d.on_leave || d.leave_from || d.leave_to) ? (
                <label className="mt-3 block rounded-lg border border-rose-100 bg-rose-50/70 p-3">
                  <span className="text-xs font-semibold text-rose-950">
                    Leave leads assign to
                  </span>
                  <p className="text-[11px] text-rose-800 mt-0.5 mb-1.5">
                    On leave / date range mein nayi leads is cover ko jayengi.
                  </p>
                  <select
                    value={d.leave_cover_id || d.offday_cover_id}
                    onChange={(e) => patchHourDraft(t.id, { leave_cover_id: e.target.value })}
                    className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">— Select cover telecaller —</option>
                    {activeTelecallers
                      .filter((o) => o.id !== t.id)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.full_name || o.email || o.id}
                          {o.on_floor ? ' · on floor' : ''}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={savingHoursId === t.id}
                  onClick={() => void saveOneTelecallerHours(t.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-700 disabled:opacity-60"
                >
                  {savingHoursId === t.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save {t.full_name?.split(' ')[0] || 'shift'}
                </button>
              </div>
            </div>
          );
        })()}
      </div>
      ) : null}

      {section === 'did' ? (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm max-w-4xl">
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
      ) : null}

      {section === 'phones' ? (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm max-w-4xl">
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
        <p className="mt-3 text-xs text-slate-500">
          Shift / leave <button type="button" className="text-indigo-600 font-medium underline" onClick={() => goSection('days')}>Working Days</button>
          {' '}aur{' '}
          <button type="button" className="text-indigo-600 font-medium underline" onClick={() => goSection('leave')}>Leave</button>
          {' '}menu mein set karo.
        </p>
      </div>
      ) : null}

      {section === 'test' ? (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm max-w-4xl">
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
      ) : null}

      {section === 'recordings' ? (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm max-w-4xl">
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
            Token: Smartflo API token (<code>c2c</code>) Gateway menu mein save hona chahiye
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
          <p className="mt-2 text-xs text-amber-700">Pehle c2c token Gateway menu mein save karo, phir sync.</p>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}
