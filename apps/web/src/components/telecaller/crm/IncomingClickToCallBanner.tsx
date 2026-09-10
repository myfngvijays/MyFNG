'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle2, ExternalLink, Minus, UserRound, X, XCircle } from 'lucide-react';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { LeadBrainStrip } from '@/components/telecaller/crm/LeadBrainCard';

type DialLead = {
  id?: string | null;
  lead_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  vehicle_number?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  city?: string | null;
  status?: string | null;
};

type CallerCard = {
  id: string;
  status?: string | null;
  lead_id?: string | null;
  direction?: 'inbound' | 'outbound' | null;
  fromPush?: boolean;
  lead?: DialLead | null;
};

function vehicleLine(lead?: DialLead | null): string {
  return [lead?.vehicle_make, lead?.vehicle_model, lead?.vehicle_number]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' ');
}

function initialOf(name: string): string {
  const ch = name.trim().charAt(0);
  return ch ? ch.toUpperCase() : '?';
}

export default function IncomingClickToCallBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const { base, isLeadManager } = getCrmDashboardBase(pathname);
  const [card, setCard] = useState<CallerCard | null>(null);
  const [minimized, setMinimized] = useState(false);
  const lastIdRef = useRef<string | null>(null);
  const hiddenIdsRef = useRef<Set<string>>(new Set());
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyCard = useCallback((next: CallerCard | null) => {
    if (!next?.id) {
      setCard(null);
      return;
    }
    if (hiddenIdsRef.current.has(next.id)) {
      setCard(null);
      return;
    }
    if (lastIdRef.current !== next.id) {
      lastIdRef.current = next.id;
      setMinimized(false);
    }
    setCard(next);
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/telecaller/crm/dial-session?active=1', {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const next = (json?.session || null) as {
        id?: string;
        status?: string | null;
        lead_id?: string | null;
        lead?: DialLead | null;
      } | null;
      const st = String(next?.status || '').toUpperCase();
      if (!next?.id || !['INITIATED', 'RINGING', 'ANSWERED'].includes(st)) {
        setCard((prev) => (prev && !prev.fromPush ? null : prev));
        return;
      }
      applyCard({
        id: next.id,
        status: st,
        lead_id: next.lead_id || next.lead?.id || null,
        direction: 'outbound',
        fromPush: false,
        lead: next.lead || null,
      });
    } catch {
      /* keep last */
    }
  }, [applyCard]);

  useEffect(() => {
    void poll();
    const id = setInterval(poll, 1500);
    const onVis = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [poll]);

  useEffect(() => {
    const onCallerId = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const leadId = String(detail.leadId || '').trim();
      if (!leadId) return;
      const sessionId = String(detail.sessionId || '').trim();
      const id = sessionId || `push:${leadId}`;
      const inbound = String(detail.direction || '').toLowerCase() === 'inbound';
      applyCard({
        id,
        status: inbound ? 'RINGING' : 'INITIATED',
        lead_id: leadId,
        direction: inbound ? 'inbound' : 'outbound',
        fromPush: true,
        lead: {
          id: leadId,
          lead_number: detail.leadNumber || null,
          customer_name: detail.customerName || null,
        },
      });
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        setCard((prev) => (prev?.id === id && prev.fromPush ? null : prev));
      }, 90_000);
    };
    window.addEventListener('crm:callerId', onCallerId);
    return () => {
      window.removeEventListener('crm:callerId', onCallerId);
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [applyCard]);

  const lead = card?.lead || null;
  const leadId = String(card?.lead_id || lead?.id || '').trim();
  const name = String(lead?.customer_name || '').trim();
  const leadNumber = String(lead?.lead_number || '').trim();
  const phone = String(lead?.customer_phone || '').trim();
  const vehicle = useMemo(() => vehicleLine(lead), [lead]);
  const city = String(lead?.city || '').trim();
  const status = String(card?.status || '').toUpperCase();
  const connected = status === 'ANSWERED';
  const inbound = card?.direction === 'inbound';

  if (!card) return null;

  const title = name || leadNumber || 'MyFNG customer';
  const placeLine = [vehicle, city].filter(Boolean).join(', ');
  const statusLine = connected ? 'Live call' : inbound ? 'Incoming call' : 'Calling now';
  const leadHref = leadId ? `${base}/leads/${leadId}` : `${base}/leads`;

  const hideCard = () => {
    if (card?.id) hiddenIdsRef.current.add(card.id);
    setCard(null);
  };

  const openLead = () => {
    if (!leadId) return;
    setMinimized(true);
    router.push(leadHref);
  };

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed left-1/2 z-[90] flex w-[min(94vw,26rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-white px-3 py-2 text-left text-slate-900 shadow-2xl ring-1 ring-black/5 top-[max(0.65rem,env(safe-area-inset-top))]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-extrabold">
          {initialOf(title)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[10px] font-bold text-slate-500">myfng</span>
          <span className="block truncate text-sm font-bold">{title}</span>
        </span>
      </button>
    );
  }

  return (
    <div className="fixed left-1/2 z-[90] w-[min(96vw,28rem)] -translate-x-1/2 rounded-[22px] bg-white px-4 pb-1.5 pt-3 text-slate-900 shadow-2xl ring-1 ring-black/5 top-[max(0.65rem,env(safe-area-inset-top))]">
      <div className="mb-3 flex items-center">
        <span className="text-[15px] font-bold tracking-tight">myfng</span>
        <span className="ml-2 flex-1 truncate text-[11px] text-slate-400">{statusLine}</span>
        <button
          type="button"
          onClick={hideCard}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-bold ${
            connected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-900'
          }`}
        >
          {initialOf(title)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-xl font-bold">{title}</p>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0B57D0]" />
          </div>
          <button
            type="button"
            onClick={openLead}
            disabled={!leadId}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#0B57D0] px-3 py-1 text-[13px] font-bold text-[#0B57D0] hover:bg-blue-50 disabled:opacity-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open lead
          </button>
        </div>
      </div>

      {phone || leadNumber ? (
        <p className="mt-3.5 truncate text-[15px] text-slate-900">{phone || leadNumber}</p>
      ) : null}
      <p className="mt-0.5 truncate text-[13px] text-slate-500">
        {[leadNumber && leadNumber !== phone ? leadNumber : null, placeLine || 'MyFNG customer']
          .filter(Boolean)
          .join(' · ')}
      </p>
      {isLeadManager && leadId ? (
        <div className="mt-2">
          <LeadBrainStrip leadId={leadId} />
        </div>
      ) : null}

      <div className="mt-3.5 grid grid-cols-3 border-t border-slate-200">
        <button
          type="button"
          onClick={openLead}
          disabled={!leadId}
          className="flex flex-col items-center gap-1 py-3 text-[11px] font-bold tracking-wide text-slate-900 disabled:opacity-50"
        >
          <UserRound className="h-4 w-4" />
          OPEN
        </button>
        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="flex flex-col items-center gap-1 py-3 text-[11px] font-bold tracking-wide text-slate-900"
        >
          <Minus className="h-4 w-4" />
          HIDE
        </button>
        <button
          type="button"
          onClick={hideCard}
          className="flex flex-col items-center gap-1 py-3 text-[11px] font-bold tracking-wide text-slate-900"
        >
          <XCircle className="h-4 w-4" />
          CLOSE
        </button>
      </div>
    </div>
  );
}
