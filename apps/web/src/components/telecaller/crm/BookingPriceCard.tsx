'use client';

import { useEffect, useState } from 'react';
import type { LeadPriceSummary } from '@/lib/leadPriceSummary';
import { formatDateTimeIST } from '@/lib/utils';

const inr = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

/**
 * "Booking & price" for one lead — same breakdown as App Customers, without wallet balance
 * or account data. Hidden when the telecaller's template turns "Booking ka price dekhna" off,
 * or when the lead has no booking price.
 */
export default function BookingPriceCard({
  leadId,
  className = '',
  emptyText,
}: {
  leadId: string;
  className?: string;
  /** Shown instead of nothing when there is no price to show (e.g. in a popup). */
  emptyText?: string;
}) {
  const [summary, setSummary] = useState<LeadPriceSummary | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'hidden'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    fetch(`/api/telecaller/crm/leads/${encodeURIComponent(leadId)}/booking-price`, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !json?.summary) {
          setState('hidden');
          return;
        }
        const s = json.summary as LeadPriceSummary;
        if (!(s.subtotal > 0 || s.payable > 0 || s.lines.length)) {
          setState('hidden');
          return;
        }
        setSummary(s);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('hidden');
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (state === 'hidden') {
    return emptyText ? <div className={`rounded-2xl bg-white p-4 text-sm text-slate-600 ${className}`}>{emptyText}</div> : null;
  }
  if (state === 'loading' || !summary) {
    return <div className={`h-24 animate-pulse rounded-2xl bg-[#004AAD]/20 ${className}`} />;
  }

  const s = summary;
  const linesTotal = s.lines.reduce((sum, l) => sum + (Number(l.price) || 0), 0);
  const saved = s.couponDiscount + s.referralDiscount + s.membershipDiscount + s.walletUsed;
  const Row = ({ label, value, tone, sign }: { label: string; value: number; tone: string; sign: '−' | '+' | '' }) => (
    <div className={`flex justify-between gap-3 ${tone}`}>
      <span>{label}</span>
      <span className="font-semibold">
        {sign}
        {inr(value)}
      </span>
    </div>
  );

  return (
    <div className={`rounded-2xl border border-[#023D95] bg-[#004AAD] p-4 text-sm text-white shadow-sm ${className}`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-black !text-white" style={{ color: '#ffffff' }}>Booking &amp; price</h3>
        <span className="text-[11px] text-blue-100">
          {[s.source, s.bookedAt ? formatDateTimeIST(s.bookedAt) : null].filter(Boolean).join(' · ')}
        </span>
      </div>
      <div className="space-y-1 text-xs">
        {s.lines.length ? (
          s.lines.map((l, idx) => (
            <div key={`${l.name}-${idx}`} className="flex justify-between gap-3">
              <span>
                {l.kind === 'addon' ? (
                  <span className="mr-1 rounded bg-white/20 px-1 py-px text-[10px] font-bold">ADD-ON</span>
                ) : null}
                {l.name}
              </span>
              <span className="font-semibold">{l.price > 0 ? inr(l.price) : '—'}</span>
            </div>
          ))
        ) : s.subtotal > 0 ? (
          <Row label={s.serviceLabel || 'Service amount'} value={s.subtotal} tone="text-white" sign="" />
        ) : null}
        {s.lines.length > 1 || (s.lines.length && s.subtotal > 0 && Math.abs(s.subtotal - linesTotal) > 1) ? (
          <div className="flex justify-between gap-3 border-t border-dashed border-white/30 pt-1">
            <span className="font-semibold">Subtotal</span>
            <span className="font-bold">{inr(s.subtotal > 0 ? s.subtotal : linesTotal)}</span>
          </div>
        ) : null}
        {s.couponDiscount > 0 ? (
          <Row label={`Coupon discount${s.couponCode ? ` (${s.couponCode})` : ''}`} value={s.couponDiscount} tone="text-emerald-200" sign="−" />
        ) : null}
        {s.referralDiscount > 0 ? <Row label="Referral reward" value={s.referralDiscount} tone="text-emerald-200" sign="−" /> : null}
        {s.membershipDiscount > 0 && s.membershipFee <= 0 ? (
          <Row label="Membership discount (on service)" value={s.membershipDiscount} tone="text-emerald-200" sign="−" />
        ) : null}
        {s.walletUsed > 0 ? (
          <Row label={`Wallet used${s.walletPercent ? ` (${s.walletPercent}%)` : ''}`} value={s.walletUsed} tone="text-sky-200" sign="−" />
        ) : null}
        {s.membershipFee > 0 ? (
          <div className="rounded-md bg-white px-2 py-1.5 text-amber-800">
            <div className="flex justify-between gap-3">
              <span className="font-semibold">MyFNG membership (bought with booking)</span>
              <span className="font-semibold">+{inr(s.membershipFee)}</span>
            </div>
            {s.membershipDiscount > 0 ? (
              <div className="flex justify-between gap-3 text-emerald-700">
                <span>Booking + membership discount</span>
                <span className="font-semibold">−{inr(s.membershipDiscount)}</span>
              </div>
            ) : null}
            <div className="mt-1 flex justify-between gap-3 border-t border-amber-200 pt-1">
              <span>Membership net · collect with service</span>
              <span className="font-bold">{inr(Math.max(0, s.membershipFee - s.membershipDiscount))}</span>
            </div>
          </div>
        ) : null}
        {s.membershipPaidOnline ? (
          <div className="rounded-md bg-white px-2 py-1.5 text-blue-800">
            <div className="flex justify-between gap-3">
              <span className="font-semibold">MyFNG membership · paid online ✓</span>
              <span className="font-bold">
                {s.membershipPlanPrice > 0 ? inr(Math.max(0, s.membershipPlanPrice - s.membershipDiscount)) : 'Paid'}
              </span>
            </div>
            <div className="text-[11px]">Not part of payable below</div>
          </div>
        ) : null}
        <div className="mt-1 flex justify-between gap-3 border-t border-white/30 pt-1.5">
          <span className="font-bold">Actual payable</span>
          <span className="text-sm font-extrabold">{inr(s.payable)}</span>
        </div>
        {saved > 0 ? <div className="text-[11px] font-semibold text-emerald-200">Total saved {inr(saved)}</div> : null}
        {s.slot ? <div className="text-[11px] text-blue-100">Slot: {s.slot.includes('T') ? formatDateTimeIST(s.slot) : s.slot}</div> : null}
      </div>
    </div>
  );
}
