'use client';

import { useState } from 'react';
import type { CallIqSopAudit } from '@/lib/telecaller/callIqSop';
import { MYFNG_USPS, toCrmSuggestedStatus } from '@/lib/telecaller/callIqSop';

function tone(ok?: string) {
  const u = String(ok || '');
  if (u === 'Yes' || u === 'Strong' || u === 'Clear Ask' || u === 'High' || u === 'Closing' || u === 'Listened Well') {
    return 'bg-emerald-100 text-emerald-800';
  }
  if (u === 'No' || u === 'Weak' || u === 'No Ask' || u === 'Low' || u === 'Poor') {
    return 'bg-rose-100 text-rose-800';
  }
  return 'bg-slate-100 text-slate-700';
}

function Pill({ value }: { value?: string | null }) {
  const v = value || '—';
  return (
    <span className={`inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none ${tone(v)}`}>
      {v}
    </span>
  );
}

function clip(s?: string | null, n = 72) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '—';
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function Row({
  label,
  value,
  text,
}: {
  label: string;
  value?: string | null;
  text?: string | null;
}) {
  return (
    <div className="grid grid-cols-[112px_1fr] items-center gap-2 border-b border-slate-100 py-1 last:border-0">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <div className="min-w-0 flex items-center gap-1.5">
        {value != null ? <Pill value={value} /> : null}
        {text ? (
          <span className="truncate text-[12px] text-slate-800" title={text}>
            {clip(text, 80)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

const TABS = [
  { id: 'sop', label: 'SOP' },
  { id: 'pitch', label: 'Pitch' },
  { id: 'soft', label: 'Soft' },
  { id: 'notes', label: 'Notes' },
] as const;

function FieldGrid({ sop }: { sop: CallIqSopAudit }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('sop');
  const hit = new Set(sop.usps_highlighted || []);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
              tab === t.id ? 'bg-violet-700 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] font-semibold text-slate-500">
          {sop.overall_score}/100 · {toCrmSuggestedStatus(sop.suggested_lead_status)}
        </span>
      </div>

      {tab === 'sop' ? (
        <div className="grid md:grid-cols-2">
          <div className="px-3 py-1.5 md:border-r md:border-slate-100">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Qualification
            </p>
            <Row label="Location" value={sop.asked_location} text={sop.customer_location} />
            <Row label="Car model" value={sop.asked_car_model} text={sop.customer_car_model} />
            <Row label="Last service" value={sop.asked_last_service} text={sop.last_service} />
            <Row label="Urgency" value={sop.asked_urgency} text={sop.urgency} />
            <Row label="Reg before ₹" value={sop.registration_before_pricing} text={sop.registration_number} />
            <Row label="Service type" value={sop.service_type_confirmed} text={sop.service_type} />
          </div>
          <div className="px-3 py-1.5">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Reception / close / outcome
            </p>
            <Row label="Source tagged" value={sop.lead_source_tagged} text={sop.customer_reference_source} />
            <Row label="Pickup offered" value={sop.pickup_option_asked} text={sop.service_type_preference} />
            <Row label="Closing ask" value={sop.closing_attempt} />
            <Row label="FOMO" value={sop.urgency_fomo_used} text={sop.next_follow_up} />
            <Row label="Intent / stage" value={sop.customer_intent_level} text={sop.decision_stage} />
            <Row
              label="Suggested"
              text={`${toCrmSuggestedStatus(sop.suggested_lead_status)}${sop.lead_status_updated ? ` · CRM ${sop.lead_status_updated}` : ''}${sop.lost_reason ? ` · ${sop.lost_reason}` : ''}`}
            />
          </div>
        </div>
      ) : null}

      {tab === 'pitch' ? (
        <div className="px-3 py-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] text-slate-500">Intro</span>
            <Pill value={sop.myfng_introduced} />
            <span className="text-[11px] text-slate-500">Consultative</span>
            <Pill value={sop.consultative_pitch} />
          </div>
          <div className="flex flex-wrap gap-1">
            {MYFNG_USPS.map((u) => {
              const on = hit.has(u);
              return (
                <span
                  key={u}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                    on ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-slate-50 text-slate-500 ring-1 ring-slate-200'
                  }`}
                >
                  {on ? '✓ ' : '– '}
                  {u}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {tab === 'soft' ? (
        <div className="grid sm:grid-cols-2 px-3 py-1.5">
          <Row label="Tone" value={sop.tone_and_confidence} />
          <Row label="Listening" value={sop.listening_vs_talking} />
          <Row label="Language" value={sop.language_adaptability} />
          <Row label="Professional" value={sop.professionalism} />
          <Row label="Objections" value={sop.objection_handling_quality} text={sop.customer_objections} />
          <Row label="Handling" text={sop.objection_handling_notes} />
        </div>
      ) : null}

      {tab === 'notes' ? (
        <div className="px-3 py-2 space-y-1.5 text-[12px] leading-snug">
          <p className="text-[11px] font-semibold text-slate-500">
            Source: {sop.audit_source === 'transcript' ? 'Recording transcript' : 'Agent notes (no listen)'}
          </p>
          {sop.call_transcript ? (
            <p>
              <span className="font-semibold text-slate-500">Transcript </span>
              <span className="text-slate-800">{clip(sop.call_transcript, 360)}</span>
            </p>
          ) : null}
          <p>
            <span className="font-semibold text-slate-500">Summary </span>
            <span className="text-slate-800">{clip(sop.summary_of_call, 220)}</span>
          </p>
          <p>
            <span className="font-semibold text-slate-500">Client </span>
            <span className="text-slate-800">{clip(sop.client_overview, 160)}</span>
          </p>
          <p>
            <span className="font-semibold text-slate-500">Need / issues </span>
            <span className="text-slate-800">
              {clip([sop.customer_need, sop.customer_problems_reported].filter(Boolean).join(' · '), 200)}
            </span>
          </p>
          {sop.positive_highlights?.length ? (
            <p className="text-emerald-800">+ {sop.positive_highlights.slice(0, 3).join(' · ')}</p>
          ) : null}
          {sop.improvement_suggestions?.length ? (
            <p className="text-violet-800">→ {sop.improvement_suggestions.slice(0, 3).join(' · ')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function SopAuditCard({
  sop,
  compact = true,
  defaultOpen = false,
  hideHeader = false,
}: {
  sop?: CallIqSopAudit | null;
  compact?: boolean;
  defaultOpen?: boolean;
  hideHeader?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!sop) return null;

  if (hideHeader) {
    return <FieldGrid sop={sop} />;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-1.5 flex flex-wrap items-center gap-1.5"
      >
        <span className="rounded bg-violet-700 px-2 py-0.5 text-[10px] font-bold text-white">
          {sop.overall_score}/100
        </span>
        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${tone(sop.customer_intent_level)}`}>
          {sop.customer_intent_level}
        </span>
        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${tone(sop.decision_stage)}`}>
          {sop.decision_stage}
        </span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
          {toCrmSuggestedStatus(sop.suggested_lead_status)}
        </span>
        <span className="ml-auto text-[10px] font-semibold text-violet-700">{open ? 'Hide' : 'Fields'}</span>
      </button>
      {sop.summary_of_call && !compact ? (
        <p className="px-3 pb-2 text-[11px] text-slate-600 line-clamp-2">{sop.summary_of_call}</p>
      ) : null}
      {open ? (
        <div className="border-t border-slate-100 p-2">
          <FieldGrid sop={sop} />
        </div>
      ) : null}
    </div>
  );
}
