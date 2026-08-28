'use client';

import { useState } from 'react';
import { Gift, Wallet, X } from 'lucide-react';

type ApplyResult = {
  coupon_amount?: number;
  welcome_amount?: number;
  wallet_total?: number;
  coupon_code?: string;
  society?: boolean;
};

function inr(amount: number) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function InstallCouponModal({
  open,
  onClose,
  welcomeAmount = 1000,
}: {
  open: boolean;
  onClose: () => void;
  welcomeAmount?: number;
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState<ApplyResult | null>(null);

  if (!open) return null;

  const apply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Enter a coupon or society code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/customer/wallet/claim-install-coupon', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || 'Could not apply this coupon.');
        return;
      }
      setApplied(json);
    } catch {
      setError('Could not apply this coupon.');
    } finally {
      setLoading(false);
    }
  };

  const extra = Number(applied?.coupon_amount || 0);
  const welcome = Number(applied?.welcome_amount || welcomeAmount);
  const total = Number(applied?.wallet_total || welcome + extra);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {applied ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Wallet className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-black text-gray-900">Coupon added!</h2>
            <p className="mt-3 text-sm font-semibold text-emerald-700">{inr(total)} in wallet</p>
            <p className="mt-2 text-sm text-gray-600">
              Welcome {inr(welcome)} + {applied.coupon_code || 'coupon'} {inr(extra)}. Same wallet
              rules apply on the full balance.
              {applied.society ? ' Society member tagged.' : ''}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Gift className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-black text-gray-900">Have a coupon?</h2>
            <p className="mt-2 text-sm text-gray-600">
              You already have {inr(welcomeAmount)} welcome bonus. Add a festive or society code
              and it stacks in the same wallet.
            </p>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="DIWALI26 or society code"
              className={`mt-4 w-full rounded-xl border px-3 py-3 text-center text-sm font-bold tracking-wide ${
                error ? 'border-red-400' : 'border-gray-200'
              }`}
              autoCapitalize="characters"
            />
            {error ? <p className="mt-2 text-xs font-semibold text-red-500">{error}</p> : null}
            <button
              type="button"
              onClick={() => void apply()}
              disabled={loading}
              className="mt-4 w-full rounded-xl bg-brand-primary py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {loading ? 'Adding…' : 'Add to wallet'}
            </button>
            <button type="button" onClick={onClose} className="mt-3 text-sm font-semibold text-gray-500">
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
