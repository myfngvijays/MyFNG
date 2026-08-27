'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronUp, Phone, UserRound, X } from 'lucide-react';
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

type DialSession = {
  id: string;
  status?: string | null;
  customer_phone?: string | null;
  lead_id?: string | null;
  lead?: DialLead | null;
};

function vehicleLine(lead?: DialLead | null): string {
  return [lead?.vehicle_make, lead?.vehicle_model, lead?.vehicle_number]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' ');
}

export default function IncomingClickToCallBanner() {
  const pathname = usePathname();
  const { base, isLeadManager } = getCrmDashboardBase(pathname);
  const [session, setSession] = useState<DialSession | null>(null);
  const [minimized, setMinimized] = useState(false);
  const lastIdRef = useRef<string | null>(null);
  const hiddenIdsRef = useRef<Set<string>>(new Set());

  const onDialer = String(pathname || '').includes('/dialer');

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/telecaller/crm/dial-session?active=1', {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const next = (json?.session || null) as DialSession | null;
      const st = String(next?.status || '').toUpperCase();
      if (!next?.id || !['INITIATED', 'RINGING', 'ANSWERED'].includes(st)) {
        setSession(null);
        return;
      }
      if (hiddenIdsRef.current.has(next.id)) {
        setSession(null);
        return;
      }
      if (lastIdRef.current !== next.id) {
        lastIdRef.current = next.id;
        setMinimized(false);
      }
      setSession(next);
    } catch {
      /* keep last */
    }
  }, []);

  useEffect(() => {
    void poll();
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [poll]);

  const lead = session?.lead || null;
  const leadId = String(session?.lead_id || lead?.id || '').trim();
  const name = String(lead?.customer_name || '').trim();
  const leadNumber = String(lead?.lead_number || '').trim();
  const vehicle = useMemo(() => vehicleLine(lead), [lead]);
  const city = String(lead?.city || '').trim();
  const status = String(session?.status || '').toUpperCase();
  const connected = status === 'ANSWERED';

  if (!session || onDialer) return null;

  const title = name || leadNumber || 'Lead call';
  const subtitle = [leadNumber && leadNumber !== title ? leadNumber : null, vehicle, city]
    .filter(Boolean)
    .join(' · ');

  const leadHref = leadId ? `${base}/leads/${leadId}` : `${base}/leads`;

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed z-[80] flex max-w-[min(92vw,22rem)] items-center gap-2 rounded-full bg-[#023D95] px-3 py-2 text-left text-white shadow-2xl bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] left-[max(1rem,env(safe-area-inset-left))]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-white">
          <Phone className="h-4 w-4 fill-current" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">
            {connected ? 'Live call' : 'Phone ringing'}
          </span>
          <span className="block truncate text-sm font-bold">{title}</span>
        </span>
        <ChevronUp className="h-4 w-4 shrink-0 opacity-80" />
      </button>
    );
  }

  return (
    <div className="fixed z-[80] w-[min(94vw,24rem)] rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] left-[max(1rem,env(safe-area-inset-left))]">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white ${
            connected ? 'bg-[#023D95]' : 'bg-emerald-500 animate-pulse'
          }`}
        >
          <Phone className="h-5 w-5 fill-current" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-600">
            {connected ? 'Customer connected' : 'Phone ringing — this lead'}
          </p>
          <p className="mt-0.5 truncate text-base font-black text-[#023D95]">{title}</p>
          {subtitle ? <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p> : null}
          <p className="mt-1 text-[11px] text-slate-400">
            Phone pe DID dikhega. Lead yahan se open karo.
          </p>
          {isLeadManager && leadId ? <div className="mt-2"><LeadBrainStrip leadId={leadId} /></div> : null}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Minimize"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (session?.id) hiddenIdsRef.current.add(session.id);
              setSession(null);
            }}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Hide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Link
          href={leadHref}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#023D95] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#012f75]"
        >
          <UserRound className="h-4 w-4" />
          Open lead
        </Link>
      </div>
    </div>
  );
}
