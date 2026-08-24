'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import PageHelpIcon from '@/components/PageHelpIcon';
import CallIqAgentsPanel from '@/components/admin/CallIqAgentsPanel';
import CallIntelligencePanel from '@/components/admin/CallIntelligencePanel';

export default function CallIqWorkspace({
  helpHref,
  recordingsHref,
  suiteHref,
  playbookHref,
  workflowHref,
}: {
  helpHref: string;
  recordingsHref: string;
  suiteHref?: string;
  playbookHref?: string;
  workflowHref: string;
}) {
  const [tab, setTab] = useState<'agents' | 'results'>('agents');

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(1200px_500px_at_10%_-10%,rgba(124,58,237,0.12),transparent_50%),radial-gradient(900px_400px_at_90%_0%,rgba(16,185,129,0.08),transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      <div className="mx-auto max-w-[1440px] space-y-6 p-4 sm:p-6 lg:p-8">
        <header className="relative overflow-hidden rounded-3xl border border-white/60 bg-slate-950 px-5 py-6 text-white shadow-[0_20px_60px_-28px_rgba(15,23,42,0.65)] sm:px-8 sm:py-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200/80">
                AI Suite
              </p>
              <h1 className="mt-1 flex flex-wrap items-center gap-3 font-serif text-3xl tracking-tight text-white sm:text-4xl">
                Call-IQ
                <span className="rounded-full border border-amber-200/30 bg-amber-100/10 px-2.5 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100">
                  Beta
                </span>
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                Deep AI sales auditors — structured SOP fields, live agent, and call results in one desk.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PageHelpIcon href={helpHref} label="Call IQ" />
              <div className="flex rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
                {(['agents', 'results'] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition ${
                      tab === id
                        ? 'bg-white text-slate-950 shadow-lg shadow-black/20'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="relative mt-5 flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-amber-200" />
            Provider: Deep AI · Active agent runs workflow SOP
          </div>
        </header>

        {tab === 'agents' ? (
          <CallIqAgentsPanel workflowHref={workflowHref} />
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 shadow-xl shadow-slate-900/5 backdrop-blur">
            <CallIntelligencePanel
              helpHref={helpHref}
              recordingsHref={recordingsHref}
              suiteHref={suiteHref}
              playbookHref={playbookHref}
              workflowHref={workflowHref}
              embedded
            />
          </div>
        )}
      </div>
    </div>
  );
}
