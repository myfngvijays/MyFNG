'use client';

import { useEffect, useState } from 'react';
import { Loader2, LogIn, LogOut } from 'lucide-react';

/** Punch in/out, shown beside Select Aansh in the top bar. */
export default function TelecallerFloorHeaderButton() {
  const [punchedIn, setPunchedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [punching, setPunching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/telecaller/crm/attendance');
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setPunchedIn(Boolean(json?.is_punched_in));
      } catch {
        // header stays usable if attendance is down
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const punch = async () => {
    setPunching(true);
    try {
      const res = await fetch('/api/telecaller/crm/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: punchedIn ? 'punch_out' : 'punch_in' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Punch failed');
      setPunchedIn((v) => !v);
    } catch (e: any) {
      alert(e?.message || 'Punch failed');
    } finally {
      setPunching(false);
    }
  };

  if (!ready) return null;

  return (
    <button
      type="button"
      onClick={() => void punch()}
      disabled={punching}
      title={punchedIn ? 'Punch out' : 'Punch in'}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60 ${
        punchedIn ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'
      }`}
    >
      {punching ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : punchedIn ? (
        <LogOut className="h-3.5 w-3.5" />
      ) : (
        <LogIn className="h-3.5 w-3.5" />
      )}
      {punchedIn ? 'On Floor · Out' : 'Off Duty · In'}
    </button>
  );
}
