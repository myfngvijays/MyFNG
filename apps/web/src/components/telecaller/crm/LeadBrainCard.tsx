'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Brain, Loader2 } from 'lucide-react';
import MlScoreBadge from '@/components/telecaller/crm/MlScoreBadge';

type BrainPayload = {
  score: {
    conversion_score: number;
    temperature: string;
    ghost_risk: number;
    best_call_label: string | null;
    reasons: string[];
  } | null;
  voice: {
    emotion: string | null;
    voice_intent: string | null;
    transcript: string | null;
    tags: string[];
  } | null;
  similar: Array<{
    lead_id: string;
    customer_name: string | null;
    city: string | null;
    vehicle: string | null;
    similarity: number;
  }>;
  warning?: string;
};

export function useLeadBrain(leadId?: string | null) {
  const [data, setData] = useState<BrainPayload | null>(null);

  useEffect(() => {
    const id = String(leadId || '').trim();
    if (!id) {
      setData(null);
      return;
    }
    let cancelled = false;
    void fetch(`/api/telecaller/crm/lead-brain?lead_id=${encodeURIComponent(id)}`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then((res) => res.json().catch(() => ({})))
      .then((json) => {
        if (cancelled) return;
        setData({
          score: json.score || null,
          voice: json.voice || null,
          similar: Array.isArray(json.similar) ? json.similar : [],
          warning: json.warning,
        });
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  return data;
}

/** One-line strip for dialer / incoming ring — telecaller sees score while calling. */
export function LeadBrainStrip({ leadId }: { leadId?: string | null }) {
  const data = useLeadBrain(leadId);
  const score = data?.score;
  const voice = data?.voice;
  if (!score && !voice?.emotion && !voice?.voice_intent) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-[12px] text-orange-950">
      <MlScoreBadge score={score?.conversion_score} temperature={score?.temperature} compact />
      {score?.best_call_label ? (
        <span className="font-semibold">Call {score.best_call_label}</span>
      ) : null}
      {voice?.emotion || voice?.voice_intent ? (
        <span className="font-bold">
          Voice: {voice.emotion || '—'} · {voice.voice_intent || '—'}
        </span>
      ) : null}
    </div>
  );
}

export default function LeadBrainCard({
  leadId,
  basePath = '/dashboard/telecaller',
}: {
  leadId: string;
  basePath?: string;
}) {
  const [data, setData] = useState<BrainPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/telecaller/crm/lead-brain?lead_id=${encodeURIComponent(leadId)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      setData({
        score: json.score || null,
        voice: json.voice || null,
        similar: Array.isArray(json.similar) ? json.similar : [],
        warning: json.warning,
      });
      if (json.warning) setError(json.warning);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh(processDl: boolean) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/telecaller/crm/lead-brain', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, process_dl: processDl }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setData({
        score: json.score || null,
        voice: json.voice || null,
        similar: Array.isArray(json.similar) ? json.similar : [],
        warning: json.warning,
      });
      if (json.warning) setError(json.warning);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setRunning(false);
    }
  }

  const score = data?.score;
  const voice = data?.voice;

  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <Brain className="h-4 w-4 text-orange-700" />
          Lead Brain
          <span className="text-[10px] font-semibold text-slate-400">ML + DL</span>
        </h3>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={running}
            onClick={() => void refresh(false)}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Rescore'}
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => void refresh(true)}
            className="rounded-lg bg-orange-700 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            Voice DL
          </button>
        </div>
      </div>
      {error ? <p className="text-[11px] text-amber-800">{error}</p> : null}
      {loading ? (
        <p className="text-xs text-slate-400">Scoring lead…</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <MlScoreBadge score={score?.conversion_score} temperature={score?.temperature} />
            {score?.best_call_label ? (
              <span className="text-[11px] font-semibold text-slate-600">
                Best call: {score.best_call_label}
              </span>
            ) : null}
            {score != null && score.ghost_risk >= 40 ? (
              <span className="text-[11px] font-bold text-rose-700">Ghost {score.ghost_risk}%</span>
            ) : null}
          </div>
          {score?.reasons?.length ? (
            <ul className="text-[12px] text-slate-700 space-y-0.5 list-disc pl-4">
              {score.reasons.slice(0, 4).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">
              ML score from status, calls, and follow-up. Voice DL adds emotion after a recording.
            </p>
          )}
          {voice?.emotion || voice?.voice_intent ? (
            <div className="rounded-xl bg-orange-50 px-3 py-2 text-[12px] text-orange-950">
              <p className="font-bold">
                Voice: {voice.emotion || '—'} · {voice.voice_intent || '—'}
              </p>
              {voice.transcript ? (
                <p className="mt-1 text-orange-900/80 line-clamp-3">{voice.transcript}</p>
              ) : null}
            </div>
          ) : null}
          {data?.similar?.length ? (
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                Similar booked
              </p>
              <div className="space-y-1">
                {data.similar.map((s) => (
                  <Link
                    key={s.lead_id}
                    href={`${basePath}/leads/${s.lead_id}`}
                    className="block rounded-lg border border-slate-100 px-2.5 py-1.5 text-[12px] hover:bg-slate-50"
                  >
                    <span className="font-semibold text-slate-800">{s.customer_name || 'Booked lead'}</span>
                    <span className="text-slate-500">
                      {' '}
                      · {[s.city, s.vehicle].filter(Boolean).join(' · ')} · {Math.round(s.similarity * 100)}%
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
