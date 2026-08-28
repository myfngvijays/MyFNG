'use client';

import { useEffect, useState } from 'react';

function inr(amount: number) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function RedeemInstallCouponCard({ onApplied }: { onApplied?: () => void }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [canClaim, setCanClaim] = useState(true);
  const [claimedCode, setClaimedCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/customer/wallet/claim-install-coupon', { credentials: 'include' });
        const json = res.ok ? await res.json().catch(() => ({})) : {};
        if (cancelled) return;
        setCanClaim(json?.can_claim !== false && !json?.already_claimed);
        if (json?.already_claimed) setClaimedCode(json.code || 'applied');
      } catch {
        if (!cancelled) setCanClaim(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const apply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Enter a festive or society code');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
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
      const extra = Number(json?.coupon_amount || 0);
      const total = Number(json?.wallet_total || 0);
      setClaimedCode(json?.coupon_code || trimmed);
      setCanClaim(false);
      setCode('');
      setSuccess(`${inr(extra)} added. Wallet total ${inr(total)}. Same wallet rules apply.`);
      onApplied?.();
    } catch {
      setError('Could not apply this coupon.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

  if (!canClaim && claimedCode) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
        Wallet code applied{claimedCode !== 'applied' ? `: ${claimedCode}` : ''}
        {success ? <p className="mt-1 font-medium text-emerald-700">{success}</p> : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900">Have a festive or society code?</h3>
      <p className="mt-1 text-xs text-gray-500">
        Missed it at login? Enter here — amount adds to your welcome wallet.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError('');
          }}
          placeholder="Enter code"
          className={`min-h-11 flex-1 rounded-lg border px-3 text-sm font-bold tracking-wide ${
            error ? 'border-red-400' : 'border-gray-200'
          }`}
          autoCapitalize="characters"
        />
        <button
          type="button"
          onClick={() => void apply()}
          disabled={loading}
          className="min-h-11 rounded-lg bg-brand-primary px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? 'Adding…' : 'Add to wallet'}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs font-semibold text-red-500">{error}</p> : null}
    </div>
  );
}
