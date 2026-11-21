'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, X } from 'lucide-react';
import {
  PHONE_DIAL_EVENT,
  PHONE_DIAL_MS,
  requestClickToCall,
} from '@/lib/telecaller/clickToCall';

type DialWait = {
  callLogId?: string;
  phone: string;
  startedAt: number;
};

export function WebPhoneCallLink({
  phone,
  leadId,
  className,
  title,
  ariaLabel,
  children,
}: {
  phone: string;
  leadId?: string | null;
  className?: string;
  title?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={`tel:${phone}`}
      title={title || 'Call'}
      aria-label={ariaLabel || 'Call'}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void requestClickToCall({ to: phone, leadId: leadId || undefined });
      }}
    >
      {children}
    </a>
  );
}

export default function PhoneDialHandoffBanner() {
  const [wait, setWait] = useState<DialWait | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const onDial = (event: Event) => {
      const detail = (event as CustomEvent<DialWait>).detail;
      if (!detail?.phone) return;
      setWait({
        phone: String(detail.phone),
        callLogId: detail.callLogId ? String(detail.callLogId) : undefined,
        startedAt: Number(detail.startedAt) || Date.now(),
      });
      setNow(Date.now());
    };
    window.addEventListener(PHONE_DIAL_EVENT, onDial);
    return () => window.removeEventListener(PHONE_DIAL_EVENT, onDial);
  }, []);

  useEffect(() => {
    if (!wait) return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [wait]);

  const elapsed = wait ? now - wait.startedAt : 0;
  const fraction = wait ? Math.min(1, Math.max(0, elapsed / PHONE_DIAL_MS)) : 0;

  useEffect(() => {
    if (!wait || elapsed < PHONE_DIAL_MS) return;
    const id = wait.callLogId;
    setWait(null);
    if (id) {
      void fetch('/api/telecaller/phone-dial', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'cancel' }),
      });
    }
  }, [wait, elapsed]);

  if (!wait) return null;

  const cancel = () => {
    const id = wait.callLogId;
    setWait(null);
    if (!id) return;
    void fetch('/api/telecaller/phone-dial', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'cancel' }),
    });
  };

  const ring = (
    <span
      aria-hidden
      className="h-8 w-8 shrink-0 rounded-full"
      style={{
        background: `conic-gradient(#4C1D95 ${Math.round(fraction * 360)}deg, #E9E4F8 0deg)`,
      }}
    />
  );
  const close = (
    <button
      type="button"
      onClick={cancel}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
      aria-label="Cancel call"
    >
      <X className="h-4 w-4" />
    </button>
  );

  // Countdown (45s → 0) shown as a clock instead of the pie.
  const secondsLeft = Math.max(0, Math.ceil((PHONE_DIAL_MS - elapsed) / 1000));
  const clockText = `0:${String(secondsLeft).padStart(2, '0')}`;

  // On a lead page: a purple card right above Quick stats (same card shape), not a floating toast.
  const slot = typeof document !== 'undefined' ? document.getElementById('lead-dial-handoff-slot') : null;
  if (slot) {
    return createPortal(
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl bg-gradient-to-br from-[#6D28D9] to-[#4C1D95] p-4 text-white shadow-md"
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-xl" aria-hidden>
            📱
          </span>
          <div className="min-w-0 flex-1">
            {/* explicit white: global h3 styles otherwise paint it dark blue */}
            <p className="text-[15px] font-semibold leading-tight !text-white">Open your MyFNG app</p>
            <p className="mt-0.5 text-xs font-normal leading-snug text-violet-100">Call is waiting on your phone</p>
          </div>
          <button
            type="button"
            onClick={cancel}
            className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-violet-100 hover:bg-white/15"
            aria-label="Cancel call"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1">
            <Clock className="h-4 w-4 text-violet-100" aria-hidden />
            <span className="text-sm font-semibold tabular-nums leading-none">{clockText}</span>
          </div>
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-200 ease-linear"
              style={{ width: `${Math.round((1 - fraction) * 100)}%` }}
            />
          </div>
        </div>
      </div>,
      slot,
    );
  }

  return (
    <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-[80] flex w-[min(640px,calc(100%-1.5rem))] -translate-x-1/2 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-lg">
      <p className="min-w-0 flex-1 text-[13px] font-extrabold uppercase tracking-wide text-[#3F2E8C]">
        Open your MyFNG app to complete the action.
      </p>
      {ring}
      {close}
    </div>
  );
}
