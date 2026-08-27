'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Check,
  Delete,
  Eye,
  Loader2,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  RefreshCw,
  Search,
  UserRound,
  UserPlus,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { requestClickToCall, normalizeClickToCallPhone } from '@/lib/telecaller/clickToCall';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { formatDateTimeIST } from '@/lib/utils';
import { CallRecordingCardRow } from '@/components/telecaller/CallRecordingPlayer';
import { LeadBrainStrip } from '@/components/telecaller/crm/LeadBrainCard';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const;

type DialerTab = 'keypad' | 'recents' | 'missed';
type CallPhase = 'initiating' | 'ringing' | 'connected' | 'ended' | 'failed' | 'missed';

type HistoryRow = {
  id: string;
  created_at: string;
  call_type?: string | null;
  call_status?: string | null;
  call_duration?: number | null;
  phone_number?: string | null;
  is_missed?: boolean;
  has_recording?: boolean;
  lead?: {
    id: string;
    lead_number?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
  } | null;
};

type ContactGroup = {
  key: string;
  phone: string;
  name: string;
  leadId: string;
  leadNumber: string;
  calls: HistoryRow[];
  callCount: number;
  talkedCount: number;
  totalTalkSec: number;
  lastAt: string;
  hasMissed: boolean;
  recordingCount: number;
};

type ActiveCall = {
  to: string;
  name?: string | null;
  leadId?: string | null;
  phase: CallPhase;
  sessionId?: string | null;
  error?: string | null;
  answeredAt?: number | null;
  endedAt?: number | null;
  durationSec?: number | null;
};

function formatDur(sec: unknown): string {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return '';
  const s = Math.round(n);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatLiveTimer(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function wasTalked(row: HistoryRow): boolean {
  const dur = Number(row.call_duration) || 0;
  if (dur > 0) return true;
  return String(row.call_status || '').toUpperCase() === 'ANSWERED';
}

function groupCallsByContact(rows: HistoryRow[]): ContactGroup[] {
  const map = new Map<string, ContactGroup>();
  for (const row of rows) {
    const phone =
      normalizeClickToCallPhone(row.phone_number) ||
      normalizeClickToCallPhone(row.lead?.customer_phone) ||
      '';
    const leadId = row.lead?.id ? String(row.lead.id) : '';
    const key = leadId ? `lead:${leadId}` : phone ? `phone:${phone}` : `call:${row.id}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        phone,
        name: String(row.lead?.customer_name || '').trim(),
        leadId,
        leadNumber: String(row.lead?.lead_number || '').trim(),
        calls: [],
        callCount: 0,
        talkedCount: 0,
        totalTalkSec: 0,
        lastAt: row.created_at,
        hasMissed: false,
        recordingCount: 0,
      };
      map.set(key, g);
    }
    g.calls.push(row);
    g.callCount += 1;
    if (wasTalked(row)) {
      g.talkedCount += 1;
      g.totalTalkSec += Math.max(0, Number(row.call_duration) || 0);
    }
    if (row.is_missed) g.hasMissed = true;
    if (row.has_recording) g.recordingCount += 1;
    if (!g.name && row.lead?.customer_name) g.name = String(row.lead.customer_name).trim();
    if (!g.leadId && leadId) g.leadId = leadId;
    if (!g.leadNumber && row.lead?.lead_number) g.leadNumber = String(row.lead.lead_number);
    if (!g.phone && phone) g.phone = phone;
    if (new Date(row.created_at).getTime() > new Date(g.lastAt).getTime()) {
      g.lastAt = row.created_at;
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
  );
}

function contactKeyForRow(row: HistoryRow): string {
  const phone =
    normalizeClickToCallPhone(row.phone_number) ||
    normalizeClickToCallPhone(row.lead?.customer_phone) ||
    '';
  const leadId = row.lead?.id ? String(row.lead.id) : '';
  if (leadId) return `lead:${leadId}`;
  if (phone) return `phone:${phone}`;
  return `call:${row.id}`;
}

function istYmd(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch {
    return String(iso || '').slice(0, 10);
  }
}

function daySectionTitle(iso: string): string {
  const day = istYmd(iso);
  const today = istYmd(new Date().toISOString());
  const yest = istYmd(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if (day === today) return 'Today';
  if (day === yest) return 'Yesterday';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return day;
  }
}

function buildDaySections(rows: HistoryRow[]): { title: string; data: HistoryRow[] }[] {
  const order: string[] = [];
  const map = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    const title = daySectionTitle(row.created_at);
    if (!map.has(title)) {
      map.set(title, []);
      order.push(title);
    }
    map.get(title)!.push(row);
  }
  return order.map((title) => ({ title, data: map.get(title)! }));
}

export default function CrmDialerPanel() {
  const pathname = usePathname();
  const { base, isLeadManager } = getCrmDashboardBase(pathname);
  const [tab, setTab] = useState<DialerTab>('keypad');
  const [digits, setDigits] = useState('');
  const [calling, setCalling] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [q, setQ] = useState('');
  const [qApplied, setQApplied] = useState('');
  const [loadingHist, setLoadingHist] = useState(false);
  const [calls, setCalls] = useState<HistoryRow[]>([]);
  const [missedCount, setMissedCount] = useState(0);
  const [historyGroup, setHistoryGroup] = useState<ContactGroup | null>(null);
  const [digitBump, setDigitBump] = useState(0);
  const dismissedSessionIds = useRef<Set<string>>(new Set());

  const display = useMemo(() => {
    const d = digits.replace(/\D/g, '');
    if (d.length <= 5) return d;
    if (d.length <= 10) return `${d.slice(0, 5)} ${d.slice(5)}`;
    return d;
  }, [digits]);

  const canCall = Boolean(normalizeClickToCallPhone(digits));

  const bumpDigit = useCallback(() => {
    setDigitBump((n) => n + 1);
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHist(true);
    try {
      const params = new URLSearchParams({
        filter: tab === 'missed' ? 'missed' : 'all',
        days: '14',
        limit: '80',
      });
      if (qApplied.trim()) params.set('q', qApplied.trim());
      const res = await fetch(`/api/telecaller/crm/dialer-history?${params.toString()}`, {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load history');
      setCalls(Array.isArray(json.calls) ? json.calls : []);
      setMissedCount(Number(json.missed_count || 0));
    } catch (e: any) {
      setCalls([]);
      toast.error(e?.message || 'History load failed');
    } finally {
      setLoadingHist(false);
    }
  }, [tab, qApplied]);

  useEffect(() => {
    const t = setTimeout(() => setQApplied(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (tab === 'keypad') return;
    setHistoryGroup(null);
    void loadHistory();
  }, [tab, loadHistory]);

  const contactGroups = useMemo(() => groupCallsByContact(calls), [calls]);
  const daySections = useMemo(() => buildDaySections(calls), [calls]);

  const openContactHistory = useCallback(
    (row: HistoryRow) => {
      const key = contactKeyForRow(row);
      const found = contactGroups.find((g) => g.key === key);
      if (found) {
        setHistoryGroup(found);
        return;
      }
      const phone =
        normalizeClickToCallPhone(row.phone_number) ||
        normalizeClickToCallPhone(row.lead?.customer_phone) ||
        '';
      setHistoryGroup({
        key,
        phone,
        name: String(row.lead?.customer_name || '').trim(),
        leadId: row.lead?.id ? String(row.lead.id) : '',
        leadNumber: String(row.lead?.lead_number || '').trim(),
        calls: [row],
        callCount: 1,
        talkedCount: wasTalked(row) ? 1 : 0,
        totalTalkSec: Math.max(0, Number(row.call_duration) || 0),
        lastAt: row.created_at,
        hasMissed: Boolean(row.is_missed),
        recordingCount: row.has_recording ? 1 : 0,
      });
    },
    [contactGroups],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/telecaller/crm/dialer-history?filter=all&days=14&limit=80', {
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setMissedCount(Number(json.missed_count || 0));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sessionId = activeCall?.sessionId;
    if (
      !sessionId ||
      !activeCall ||
      activeCall.phase === 'failed' ||
      activeCall.phase === 'ended' ||
      activeCall.phase === 'missed'
    ) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/telecaller/crm/dial-session?id=${encodeURIComponent(sessionId)}`,
          { cache: 'no-store' },
        );
        const json = await res.json().catch(() => ({}));
        const s = json?.session;
        if (cancelled || !res.ok || !s) return;
        const st = String(s.status || '').toUpperCase();
        if (st === 'ANSWERED') {
          setActiveCall((prev) =>
            prev && prev.sessionId === sessionId
              ? {
                  ...prev,
                  phase: 'connected',
                  answeredAt: s.answered_at
                    ? new Date(s.answered_at).getTime()
                    : prev.answeredAt || Date.now(),
                }
              : prev,
          );
          if (typeof s.elapsed_seconds === 'number') setElapsedSec(s.elapsed_seconds);
        } else if (st === 'ENDED') {
          setActiveCall((prev) =>
            prev && prev.sessionId === sessionId
              ? {
                  ...prev,
                  phase: 'ended',
                  answeredAt: s.answered_at
                    ? new Date(s.answered_at).getTime()
                    : prev.answeredAt,
                  endedAt: s.ended_at ? new Date(s.ended_at).getTime() : Date.now(),
                  durationSec: s.duration_seconds ?? s.elapsed_seconds ?? prev.durationSec ?? null,
                }
              : prev,
          );
          if (typeof s.elapsed_seconds === 'number') setElapsedSec(s.elapsed_seconds);
          else if (typeof s.duration_seconds === 'number') setElapsedSec(s.duration_seconds);
        } else if (st === 'MISSED' || st === 'FAILED') {
          setActiveCall((prev) =>
            prev && prev.sessionId === sessionId
              ? {
                  ...prev,
                  phase: st === 'MISSED' ? 'missed' : 'failed',
                  error: s.error_message || (st === 'MISSED' ? 'Customer missed' : 'Call failed'),
                  endedAt: Date.now(),
                }
              : prev,
          );
        }
      } catch {
        /* keep honest state */
      }
    };

    void poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeCall?.sessionId, activeCall?.phase]);

  useEffect(() => {
    if (!activeCall || activeCall.phase !== 'connected' || !activeCall.answeredAt) return;
    const tick = () => {
      setElapsedSec(Math.floor((Date.now() - Number(activeCall.answeredAt)) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeCall?.phase, activeCall?.answeredAt]);

  const dismissCall = useCallback(() => {
    setActiveCall((prev) => {
      if (prev?.sessionId) dismissedSessionIds.current.add(prev.sessionId);
      return null;
    });
    setElapsedSec(0);
  }, []);

  useEffect(() => {
    if (activeCall) return;
    let cancelled = false;
    const adopt = async () => {
      try {
        const res = await fetch('/api/telecaller/crm/dial-session?active=1', {
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        const s = json?.session;
        if (cancelled || !res.ok || !s?.id) return;
        const st = String(s.status || '').toUpperCase();
        if (!['INITIATED', 'RINGING', 'ANSWERED'].includes(st)) return;
        if (dismissedSessionIds.current.has(String(s.id))) return;
        setActiveCall({
          to: String(s.customer_phone || ''),
          name: s.lead?.customer_name || null,
          leadId: s.lead_id || s.lead?.id || null,
          phase: st === 'ANSWERED' ? 'connected' : 'ringing',
          sessionId: String(s.id),
          answeredAt: s.answered_at ? new Date(s.answered_at).getTime() : null,
        });
        if (typeof s.elapsed_seconds === 'number') setElapsedSec(s.elapsed_seconds);
      } catch {
        /* ignore */
      }
    };
    void adopt();
    const id = setInterval(adopt, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeCall]);

  const append = useCallback(
    (ch: string) => {
      setDigits((prev) => `${prev}${ch}`.replace(/[^\d*#]/g, '').slice(0, 15));
      bumpDigit();
    },
    [bumpDigit],
  );

  const backspace = useCallback(() => {
    setDigits((p) => p.slice(0, -1));
    bumpDigit();
  }, [bumpDigit]);

  const dial = useCallback(
    async (raw?: string, meta?: { name?: string | null; leadId?: string | null }) => {
      const to = normalizeClickToCallPhone(raw ?? digits);
      if (!to) {
        toast.error('Enter a valid 10-digit mobile number');
        return;
      }
      if (calling) return;
      setDigits(to);
      setElapsedSec(0);
      setActiveCall({
        to,
        name: meta?.name || null,
        leadId: meta?.leadId || null,
        phase: 'initiating',
      });
      setCalling(true);
      try {
        const attempt = () => requestClickToCall({ to, leadId: meta?.leadId });
        let result = await Promise.race([
          attempt(),
          new Promise<{ ok: false; timedOut: true }>((resolve) =>
            setTimeout(() => resolve({ ok: false, timedOut: true }), 32_000),
          ),
        ]);

        if (
          !('timedOut' in result && result.timedOut) &&
          !result.ok &&
          /providers?\s+failed|temporarily|busy|try again/i.test(String(result.error || '')) &&
          !/missed by agent/i.test(String(result.error || ''))
        ) {
          await new Promise((r) => setTimeout(r, 1500));
          result = await Promise.race([
            attempt(),
            new Promise<{ ok: false; timedOut: true }>((resolve) =>
              setTimeout(() => resolve({ ok: false, timedOut: true }), 32_000),
            ),
          ]);
        }

        if ('timedOut' in result && result.timedOut) {
          setActiveCall((prev) =>
            prev
              ? {
                  ...prev,
                  phase: 'failed',
                  error:
                    'Server did not respond within 32s. Try again; verify your phone in Click to Call setup.',
                }
              : {
                  to,
                  name: meta?.name || null,
                  leadId: meta?.leadId || null,
                  phase: 'failed',
                  error: 'Server timeout — retry karo',
                },
          );
          return;
        }
        if (!result.ok) {
          setActiveCall((prev) =>
            prev
              ? { ...prev, phase: 'failed', error: result.error || 'Call failed' }
              : {
                  to,
                  name: meta?.name || null,
                  leadId: meta?.leadId || null,
                  phase: 'failed',
                  error: result.error || 'Call failed',
                },
          );
          return;
        }
        setActiveCall((prev) =>
          prev
            ? { ...prev, phase: 'ringing', sessionId: result.sessionId || null }
            : {
                to,
                name: meta?.name || null,
                leadId: meta?.leadId || null,
                phase: 'ringing',
                sessionId: result.sessionId || null,
              },
        );
        if (tab !== 'keypad') void loadHistory();
      } finally {
        setCalling(false);
      }
    },
    [digits, calling, tab, loadHistory],
  );

  return (
    <div className="relative mx-auto w-full max-w-md">
      <style>{`
        @keyframes crmDialPop {
          0% { transform: scale(0.9); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div className="mb-4 text-center">
        <h1 className="text-xl font-extrabold text-[#023D95]">Dialer</h1>
        <p className="mt-0.5 text-xs text-slate-500">Click-to-call</p>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-200/80 p-1">
        {(
          [
            { id: 'keypad' as const, label: 'Keypad' },
            { id: 'recents' as const, label: 'Recents' },
            { id: 'missed' as const, label: 'Missed' },
          ] as const
        ).map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative rounded-lg px-2 py-2.5 text-xs font-bold transition ${
                on ? 'bg-white text-[#023D95] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
              {t.id === 'missed' && missedCount > 0 ? (
                <span className="ml-1 inline-flex min-w-[1.1rem] justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                  {missedCount > 99 ? '99+' : missedCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === 'keypad' ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
          <div className="mb-1 flex min-h-[2.75rem] items-center gap-2">
            <p
              key={digitBump}
              className="min-w-0 flex-1 text-center text-3xl font-light tracking-wide text-[#023D95] transition-transform duration-150 ease-out"
              style={{
                animation: 'crmDialPop 220ms ease-out',
              }}
            >
              {display || '\u00a0'}
            </p>
            <button
              type="button"
              onClick={backspace}
              onContextMenu={(e) => {
                e.preventDefault();
                setDigits('');
              }}
              disabled={!digits || calling}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40"
              aria-label="Backspace"
              title="Backspace"
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>
          <input
            type="tel"
            inputMode="tel"
            value={digits}
            onChange={(e) => {
              setDigits(e.target.value.replace(/[^\d*#+]/g, '').slice(0, 15));
              bumpDigit();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void dial();
              }
            }}
            placeholder="Type or paste number"
            className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm text-slate-700 outline-none focus:border-sky-300 focus:bg-white"
          />

          <div className="mx-auto grid max-w-[280px] grid-cols-3 gap-3">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                disabled={calling}
                onClick={() => append(k)}
                className="flex aspect-square items-center justify-center rounded-full bg-slate-50 text-2xl font-medium text-[#023D95] transition hover:bg-sky-50 active:scale-95 disabled:opacity-50"
              >
                {k}
              </button>
            ))}
          </div>

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              disabled={!canCall || calling}
              onClick={() => void dial()}
              className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600 disabled:opacity-40"
              aria-label="Call"
            >
              {calling ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Phone className="h-6 w-6 fill-current" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-md">
            <div className="mb-3 flex items-center gap-2">
            <div className="relative flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, phone, lead #"
                className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${q ? 'pr-6' : ''}`}
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => {
                    setQ('');
                    setQApplied('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void loadHistory()}
              disabled={loadingHist}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label="Refresh"
            >
              {loadingHist ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </button>
          </div>

          {loadingHist && calls.length === 0 ? (
            <div className="flex justify-center py-12 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : calls.length === 0 ? (
            <div className="py-12 text-center">
              <PhoneMissed className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {tab === 'missed' ? 'No missed calls' : 'No recent calls'}
              </p>
            </div>
          ) : (
            <div className="max-h-[28rem] space-y-3 overflow-y-auto">
              {daySections.map((section) => (
                <div key={section.title}>
                  <p className="sticky top-0 z-10 mb-2 bg-[#EEF4FB] py-1.5 text-xs font-extrabold text-[#023D95]">
                    {section.title}
                  </p>
                  <ul className="space-y-2">
                    {section.data.map((row) => {
                      const phone =
                        normalizeClickToCallPhone(row.phone_number) ||
                        normalizeClickToCallPhone(row.lead?.customer_phone) ||
                        '';
                      const name = String(row.lead?.customer_name || '').trim();
                      const leadId = row.lead?.id ? String(row.lead.id) : '';
                      const inbound = String(row.call_type || '').toUpperCase() === 'INBOUND';
                      const DirIcon = row.is_missed
                        ? PhoneMissed
                        : inbound
                          ? PhoneIncoming
                          : PhoneOutgoing;
                      return (
                        <li
                          key={row.id}
                          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
                            row.is_missed
                              ? 'border-rose-100 bg-rose-50/60'
                              : 'border-slate-100 bg-slate-50/80'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => openContactHistory(row)}
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                              row.is_missed
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-sky-100 text-[#023D95]'
                            }`}
                            aria-label="Open call history"
                            title="Call history"
                          >
                            {(name || phone || '?').charAt(0).toUpperCase()}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <DirIcon
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  row.is_missed ? 'text-rose-600' : 'text-slate-500'
                                }`}
                              />
                              <p
                                className={`truncate text-sm font-bold ${
                                  row.is_missed ? 'text-rose-700' : 'text-slate-900'
                                }`}
                              >
                                {name || phone || 'Unknown'}
                              </p>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {phone || '—'}
                              {row.lead?.lead_number ? ` · ${row.lead.lead_number}` : ''}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-400">
                              {[
                                formatDateTimeIST(row.created_at),
                                row.is_missed
                                  ? 'Missed'
                                  : wasTalked(row)
                                    ? 'Talked'
                                    : 'No answer',
                                formatDur(row.call_duration) || null,
                                row.has_recording ? 'Rec' : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {phone ? (
                              <button
                                type="button"
                                disabled={calling}
                                onClick={() => void dial(phone, { name, leadId: leadId || null })}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
                                aria-label="Call"
                                title="Call"
                              >
                                <Phone className="h-4 w-4 fill-current" />
                              </button>
                            ) : null}
                            {leadId ? (
                              <Link
                                href={`${base}/leads/${leadId}`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-[#023D95] hover:bg-sky-200"
                                aria-label="View lead"
                                title="View lead"
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                            ) : phone ? (
                              <Link
                                href={`${base}/book?mode=lead&phone=${encodeURIComponent(phone)}`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200"
                                aria-label="Add lead"
                                title="Add lead"
                              >
                                <UserPlus className="h-4 w-4" />
                              </Link>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {historyGroup ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => setHistoryGroup(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="truncate text-center text-base font-extrabold text-[#023D95]">
                {historyGroup.name || historyGroup.phone || 'Call history'}
              </h2>
              <span className="w-7" />
            </div>
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-500">
                {historyGroup.phone || '—'}
                {historyGroup.leadNumber ? ` · ${historyGroup.leadNumber}` : ''}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {[
                  `${historyGroup.callCount} call${historyGroup.callCount === 1 ? '' : 's'}`,
                  `${historyGroup.talkedCount} talked`,
                  formatDur(historyGroup.totalTalkSec)
                    ? `${formatDur(historyGroup.totalTalkSec)} talk`
                    : null,
                  historyGroup.recordingCount > 0
                    ? `${historyGroup.recordingCount} recording${
                        historyGroup.recordingCount === 1 ? '' : 's'
                      }`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {historyGroup.phone ? (
                  <button
                    type="button"
                    disabled={calling}
                    onClick={() => {
                      const g = historyGroup;
                      setHistoryGroup(null);
                      void dial(g.phone, { name: g.name, leadId: g.leadId || null });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    <Phone className="h-3.5 w-3.5 fill-current" />
                    Call
                  </button>
                ) : null}
                {historyGroup.leadId ? (
                  <Link
                    href={`${base}/leads/${historyGroup.leadId}`}
                    onClick={() => setHistoryGroup(null)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3.5 py-2 text-xs font-bold text-[#023D95] hover:bg-sky-200"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View lead
                  </Link>
                ) : historyGroup.phone ? (
                  <Link
                    href={`${base}/book?mode=lead&phone=${encodeURIComponent(historyGroup.phone)}`}
                    onClick={() => setHistoryGroup(null)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-200"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add lead
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="space-y-2 overflow-y-auto px-4 py-3">
              {historyGroup.calls.map((c) => {
                const cIn = String(c.call_type || '').toUpperCase() === 'INBOUND';
                const CIcon = c.is_missed
                  ? PhoneMissed
                  : cIn
                    ? PhoneIncoming
                    : PhoneOutgoing;
                return (
                  <CallRecordingCardRow
                    key={c.id}
                    callLogId={c.id}
                    hasRecording={Boolean(c.has_recording)}
                    durationSeconds={c.call_duration}
                  >
                    <div className="flex items-start gap-2">
                      <CIcon
                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                          c.is_missed ? 'text-rose-600' : 'text-slate-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800">
                          {formatDateTimeIST(c.created_at)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {[
                            c.is_missed ? 'Missed' : wasTalked(c) ? 'Talked' : 'No answer',
                            formatDur(c.call_duration) || null,
                            String(c.call_status || '').replace(/_/g, ' ') || null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {!c.has_recording ? (
                          <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                            No recording
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </CallRecordingCardRow>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {activeCall ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={dismissCall}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {activeCall.phase === 'initiating' || activeCall.phase === 'ringing' ? (
              <>
                <p className="text-center text-[11px] font-extrabold tracking-[0.16em] text-emerald-600">
                  {activeCall.phase === 'initiating' ? 'CONNECTING…' : 'RINGING…'}
                </p>
                <div className="mx-auto mt-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40">
                  {activeCall.phase === 'initiating' ? (
                    <Loader2 className="h-9 w-9 animate-spin" />
                  ) : (
                    <Phone className="h-9 w-9 fill-current" />
                  )}
                </div>
                <h2 className="mt-4 text-center text-xl font-black text-[#023D95]">
                  {activeCall.phase === 'initiating'
                    ? 'Call is starting'
                    : 'Pick up your phone'}
                </h2>
                <p className="mt-2 text-center text-sm text-slate-500">
                  Your phone will ring first. Live duration will show here after the customer
                  connects.
                </p>
                <p className="mt-4 text-center text-lg font-extrabold text-slate-900">
                  {activeCall.name || activeCall.to}
                </p>
                {activeCall.name ? (
                  <p className="text-center font-mono text-sm text-slate-500">{activeCall.to}</p>
                ) : null}
                {isLeadManager && activeCall.leadId ? (
                  <div className="mt-3">
                    <LeadBrainStrip leadId={activeCall.leadId} />
                  </div>
                ) : null}
                <div className="mt-5 space-y-2">
                  {activeCall.leadId ? (
                    <Link
                      href={`${base}/leads/${activeCall.leadId}`}
                      onClick={dismissCall}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-100 py-3 text-sm font-bold text-[#023D95] hover:bg-sky-200"
                    >
                      <UserRound className="h-4 w-4" />
                      View lead
                    </Link>
                  ) : activeCall.to ? (
                    <Link
                      href={`${base}/book?mode=lead&phone=${encodeURIComponent(activeCall.to)}`}
                      onClick={dismissCall}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-100 py-3 text-sm font-bold text-amber-800 hover:bg-amber-200"
                    >
                      <UserPlus className="h-4 w-4" />
                      Add lead
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={dismissCall}
                    className="w-full rounded-xl bg-[#023D95] py-3 text-sm font-bold text-white hover:bg-[#012f75]"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}

            {activeCall.phase === 'connected' ? (
              <>
                <p className="text-center text-[11px] font-extrabold tracking-[0.16em] text-emerald-600">
                  LIVE · CUSTOMER CONNECTED
                </p>
                <div className="mx-auto mt-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#023D95] text-white">
                  <Phone className="h-9 w-9 fill-current" />
                </div>
                <p className="mt-4 text-center font-mono text-4xl font-light tracking-widest text-[#023D95]">
                  {formatLiveTimer(elapsedSec)}
                </p>
                <h2 className="mt-2 text-center text-xl font-black text-[#023D95]">
                  Call in progress
                </h2>
                <p className="mt-2 text-center text-sm text-slate-500">
                  This timer started after the customer answered. Status will update after you hang
                  up.
                </p>
                <p className="mt-4 text-center text-lg font-extrabold text-slate-900">
                  {activeCall.name || activeCall.to}
                </p>
                {activeCall.name ? (
                  <p className="text-center font-mono text-sm text-slate-500">{activeCall.to}</p>
                ) : null}
                {isLeadManager && activeCall.leadId ? (
                  <div className="mt-3">
                    <LeadBrainStrip leadId={activeCall.leadId} />
                  </div>
                ) : null}
                <div className="mt-5 space-y-2">
                  {activeCall.leadId ? (
                    <Link
                      href={`${base}/leads/${activeCall.leadId}`}
                      onClick={dismissCall}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-100 py-3 text-sm font-bold text-[#023D95] hover:bg-sky-200"
                    >
                      <UserRound className="h-4 w-4" />
                      View lead
                    </Link>
                  ) : activeCall.to ? (
                    <Link
                      href={`${base}/book?mode=lead&phone=${encodeURIComponent(activeCall.to)}`}
                      onClick={dismissCall}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-100 py-3 text-sm font-bold text-amber-800 hover:bg-amber-200"
                    >
                      <UserPlus className="h-4 w-4" />
                      Add lead
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={dismissCall}
                    className="w-full rounded-xl bg-[#023D95] py-3 text-sm font-bold text-white hover:bg-[#012f75]"
                  >
                    Minimize
                  </button>
                </div>
              </>
            ) : null}

            {activeCall.phase === 'ended' ? (
              <>
                <p className="text-center text-[11px] font-extrabold tracking-[0.16em] text-slate-500">
                  CALL ENDED
                </p>
                <div className="mx-auto mt-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-500 text-white">
                  <Check className="h-9 w-9" />
                </div>
                <p className="mt-4 text-center font-mono text-4xl font-light tracking-widest text-[#023D95]">
                  {formatLiveTimer(
                    activeCall.durationSec != null ? activeCall.durationSec : elapsedSec,
                  )}
                </p>
                <h2 className="mt-2 text-center text-xl font-black text-[#023D95]">Call complete</h2>
                <p className="mt-2 text-center text-sm text-slate-500">
                  Duration is from the call. Recording may sync in Activity.
                </p>
                <p className="mt-4 text-center text-lg font-extrabold text-slate-900">
                  {activeCall.name || activeCall.to}
                </p>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={dismissCall}
                    className="w-full rounded-xl bg-[#023D95] py-3 text-sm font-bold text-white hover:bg-[#012f75]"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : null}

            {activeCall.phase === 'missed' || activeCall.phase === 'failed' ? (
              <>
                <p className="text-center text-[11px] font-extrabold tracking-[0.16em] text-rose-600">
                  {activeCall.phase === 'missed' ? 'MISSED' : 'CALL FAILED'}
                </p>
                <div className="mx-auto mt-4 flex h-20 w-20 items-center justify-center rounded-full bg-rose-500 text-white">
                  <X className="h-9 w-9" />
                </div>
                <h2 className="mt-4 text-center text-xl font-black text-[#023D95]">
                  {activeCall.phase === 'missed' ? 'Connect nahi hua' : 'Call nahi lagi'}
                </h2>
                <p className="mt-2 text-center text-sm text-slate-500">
                  {activeCall.error || 'Call gateway error'}
                </p>
                <p className="mt-4 text-center text-lg font-extrabold text-slate-900">
                  {activeCall.name || activeCall.to}
                </p>
                <div className="mt-5 space-y-2">
                  <button
                    type="button"
                    disabled={calling}
                    onClick={() =>
                      void dial(activeCall.to, {
                        name: activeCall.name,
                        leadId: activeCall.leadId,
                      })
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${calling ? 'animate-spin' : ''}`} />
                    {calling ? 'Retrying…' : 'Retry call'}
                  </button>
                  <button
                    type="button"
                    onClick={dismissCall}
                    className="w-full rounded-xl bg-sky-100 py-3 text-sm font-bold text-[#023D95] hover:bg-sky-200"
                  >
                    Dismiss
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}