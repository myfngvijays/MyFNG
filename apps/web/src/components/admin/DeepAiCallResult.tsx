'use client';

import { useState } from 'react';
import type { CallIqSopAudit } from '@/lib/telecaller/callIqSop';
import { toCrmSuggestedStatus } from '@/lib/telecaller/callIqSop';
import SopAuditCard from '@/components/admin/SopAuditCard';

type QueryItem = {
  id: string;
  query: string;
  agent_answer: string | null;
  resolution: string;
  gap?: string | null;
};

export type DeepAiCallResultHit = {
  quality_score: number;
  quality_grade: string;
  summary?: string | null;
  customer_problem?: string | null;
  agent_solution?: string | null;
  coaching_tips?: string[];
  query_resolutions?: QueryItem[];
  overall_resolution?: string | null;
  queries_resolved?: number;
  queries_total?: number;
  engine?: string;
  sop_audit?: CallIqSopAudit | null;
};

function isDeepEngine(hit: DeepAiCallResultHit) {
  return (
    String(hit.engine || '').includes('openai') ||
    String(hit.sop_audit?.engine || '').includes('openai')
  );
}

function gradeTone(g: string) {
  if (g === 'A') return 'bg-emerald-600';
  if (g === 'B') return 'bg-teal-600';
  if (g === 'C') return 'bg-amber-500';
  if (g === 'D') return 'bg-orange-600';
  return 'bg-red-600';
}

function resolutionTone(r: string) {
  const u = String(r || '').toUpperCase();
  if (u === 'RESOLVED') return 'bg-emerald-100 text-emerald-800 ring-emerald-200';
  if (u === 'PARTIAL') return 'bg-amber-100 text-amber-900 ring-amber-200';
  if (u === 'UNRESOLVED') return 'bg-rose-100 text-rose-800 ring-rose-200';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

function ScoreBar({ label, value }: { label: string; value?: number | null }) {
  const n = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="min-w-0">
      <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-500">
        <span className="truncate">{label}</span>
        <span className="tabular-nums text-slate-700">{n}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${n >= 70 ? 'bg-emerald-500' : n >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
          style={{ width: `${n}%` }}
        />
      </div>
    </div>
  );
}

export default function DeepAiCallResult({ hit }: { hit: DeepAiCallResultHit }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const sop = hit.sop_audit || null;
  const deep = isDeepEngine(hit);
  const summary = String(sop?.summary_of_call || '').trim() || String(hit.summary || '').trim();
  const transcript = String(sop?.call_transcript || '').trim();
  const coaching = Array.from(
    new Set([...(sop?.improvement_suggestions || []), ...(hit.coaching_tips || [])].map(String).filter(Boolean)),
  ).slice(0, 6);
  const highlights = (sop?.positive_highlights || []).filter(Boolean).slice(0, 4);
  const queries = hit.query_resolutions || [];
  const suggested = sop ? toCrmSuggestedStatus(sop.suggested_lead_status) : null;
  const scores = sop?.section_scores;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-indigo-100 bg-indigo-50/80 px-3 py-2.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${gradeTone(hit.quality_grade)}`}>
          {hit.quality_grade} {hit.quality_score}
        </span>
        <span className="text-sm font-bold text-indigo-950">{deep ? 'Deep AI' : 'Free analyze'}</span>
        {sop?.overall_score != null ? (
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-indigo-800 ring-1 ring-indigo-200">
            SOP {sop.overall_score}/100
          </span>
        ) : null}
        {suggested ? (
          <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[11px] font-bold text-white">
            {suggested}
          </span>
        ) : null}
        {sop?.customer_intent_level ? (
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
            Intent {sop.customer_intent_level}
          </span>
        ) : null}
        {sop?.decision_stage ? (
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
            {sop.decision_stage}
          </span>
        ) : null}
        {sop?.closing_attempt ? (
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
            Close: {sop.closing_attempt}
          </span>
        ) : null}
        {hit.queries_total ? (
          <span className="ml-auto text-[11px] font-semibold text-slate-500">
            Queries {hit.queries_resolved || 0}/{hit.queries_total}
            {hit.overall_resolution ? ` · ${String(hit.overall_resolution).replace(/_/g, ' ')}` : ''}
          </span>
        ) : null}
      </div>

      <div className="space-y-3 p-3">
        {summary ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Call summary</p>
            <p className="mt-0.5 text-[13px] leading-snug text-slate-800">{summary}</p>
            {sop?.client_overview ? (
              <p className="mt-1 text-[12px] text-slate-500">{sop.client_overview}</p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-orange-100 bg-orange-50/70 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700">Customer problem</p>
            <p className="mt-0.5 text-[13px] text-slate-800">
              {hit.customer_problem || sop?.customer_problems_reported || sop?.customer_need || '—'}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Telecaller handling</p>
            <p className="mt-0.5 text-[13px] text-slate-800">
              {hit.agent_solution || sop?.objection_handling_notes || '—'}
            </p>
          </div>
        </div>

        {scores ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            <ScoreBar label="Reception" value={scores.reception} />
            <ScoreBar label="Qualify" value={scores.qualification} />
            <ScoreBar label="Pitch" value={scores.pitch} />
            <ScoreBar label="Objections" value={scores.objections} />
            <ScoreBar label="Closing" value={scores.closing} />
            <ScoreBar label="Soft skills" value={scores.soft_skills} />
            <ScoreBar label="Outcome" value={scores.outcome} />
          </div>
        ) : null}

        {queries.length ? (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Query → answer
            </p>
            {queries.map((q) => (
              <div key={q.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold text-slate-900">
                    <span className="text-orange-700">Q.</span> {q.query}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${resolutionTone(q.resolution)}`}
                  >
                    {q.resolution}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-slate-700">
                  <span className="font-semibold text-emerald-700">A.</span>{' '}
                  {q.agent_answer || 'No clear answer on the call'}
                </p>
                {q.gap ? <p className="mt-0.5 text-[12px] font-medium text-rose-700">Gap: {q.gap}</p> : null}
              </div>
            ))}
          </div>
        ) : null}

        {(highlights.length || coaching.length) ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {highlights.length ? (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Went well</p>
                <ul className="mt-1 space-y-0.5 text-[12px] text-emerald-900">
                  {highlights.map((t) => (
                    <li key={t}>• {t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {coaching.length ? (
              <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">Coaching</p>
                <ul className="mt-1 space-y-0.5 text-[12px] text-violet-950">
                  {coaching.map((t) => (
                    <li key={t}>→ {t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {sop ? <SopAuditCard sop={sop} hideHeader /> : null}

        {transcript ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => setShowTranscript((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] font-semibold text-slate-700"
            >
              Recording transcript
              <span className="text-[11px] text-indigo-700">{showTranscript ? 'Hide' : 'Show'}</span>
            </button>
            {showTranscript ? (
              <p className="max-h-48 overflow-y-auto border-t border-slate-200 px-3 py-2 text-[12px] leading-relaxed text-slate-600">
                {transcript}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
