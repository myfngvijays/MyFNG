'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { LeadIqBriefView } from '@/components/admin/LeadIqPanel';
import type { LeadIqBrief } from '@/lib/telecaller/leadIq';

export default function LeadIqCard({ leadId }: { leadId: string }) {
  const [brief, setBrief] = useState<LeadIqBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/super_admin/lead-iq?lead_id=${encodeURIComponent(leadId)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      setBrief(json.brief || null);
    } catch {
      setBrief(null);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate(deep: boolean) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/lead-iq', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, deep }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed');
      setBrief(json.brief);
      if (json.warning && !/database\/|\.sql/i.test(String(json.warning))) setError(json.warning);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-violet-700" />
          Lead IQ
        </h3>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={running}
            onClick={() => void generate(false)}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Generate'}
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => void generate(true)}
            className="rounded-lg bg-violet-700 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            Deep AI
          </button>
        </div>
      </div>
      {error ? <p className="text-[11px] text-amber-800">{error}</p> : null}
      {loading ? (
        <p className="text-xs text-slate-400">Loading brief…</p>
      ) : brief ? (
        <LeadIqBriefView brief={brief} compact />
      ) : (
        <p className="text-xs text-slate-500">
          History padhke intent + next move. Generate (free) ya Deep AI (playbook).
        </p>
      )}
    </div>
  );
}
