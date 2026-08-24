'use client';

import { Phone, Filter, Timer, Sparkles } from 'lucide-react';
import type { CallIqWorkflowConfig } from '@/lib/telecaller/salesPlaybookDefaults';

function Node({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: typeof Phone;
  title: string;
  body: string;
  tone: 'trigger' | 'filter' | 'ai';
}) {
  const ring =
    tone === 'trigger'
      ? 'border-sky-200/80 bg-sky-50'
      : tone === 'ai'
        ? 'border-violet-200/80 bg-violet-50'
        : 'border-amber-200/80 bg-amber-50';
  return (
    <div className={`rounded-2xl border ${ring} p-3 shadow-sm min-w-0`}>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
          <Icon className="h-4 w-4 text-slate-700" />
        </span>
        <p className="text-sm font-bold text-slate-900">{title}</p>
      </div>
      <p className="mt-2 text-xs text-slate-600 leading-relaxed">{body}</p>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex justify-center py-1">
      <div className="h-6 w-px bg-slate-300" />
    </div>
  );
}

export default function CallIqFlowchart({ wf }: { wf: CallIqWorkflowConfig }) {
  const selected = wf.lead_statuses.slice(0, 3).join(', ');
  const extra = Math.max(0, wf.lead_statuses.length - 3);

  return (
    <div>
      <Node
        icon={Phone}
        tone="trigger"
        title="On call recording completed"
        body="Smartflo webhook / recordings cron attaches the recording."
      />
      <Arrow />
      <Node
        icon={Filter}
        tone="filter"
        title="Check If Lead"
        body={`Lead status is ${selected || '—'}${extra ? ` +${extra}` : ''}.`}
      />
      <Arrow />
      <Node
        icon={Timer}
        tone="filter"
        title="Duration check"
        body={`call_duration ≥ ${wf.min_duration_sec} seconds.`}
      />
      <Arrow />
      <Node
        icon={Sparkles}
        tone="ai"
        title="Call Audit SOP"
        body={
          wf.use_deep_ai
            ? 'Deep AI: recording → transcript → SOP. Free fallback if no audio.'
            : 'Free SOP from notes only (no listen).'
        }
      />
    </div>
  );
}
