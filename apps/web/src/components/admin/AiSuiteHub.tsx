'use client';

import Link from 'next/link';
import { Activity, BookOpen, Brain, GitBranch, Sparkles } from 'lucide-react';
import PageHelpIcon from '@/components/PageHelpIcon';

export default function AiSuiteHub({
  base,
  helpHref,
}: {
  base: '/dashboard/super_admin' | '/dashboard/lead_manager';
  helpHref: string;
}) {
  const cards = [
    {
      href: `${base}/call-intelligence`,
      title: 'Call IQ',
      badge: 'Live',
      icon: Brain,
      body: 'Call-IQ agents (SOP New / Trans / SOP / Audit) + Version + structured output fields. Results tab pe SOP scans.',
      cta: 'Open Call IQ',
    },
    {
      href: `${base}/lead-iq`,
      title: 'Lead IQ',
      badge: 'Live',
      icon: Sparkles,
      body: 'Lead history + playbook se brief: intent, hidden risk, next move, WhatsApp script aur call script — lead profile pe.',
      cta: 'Open Lead IQ',
    },
    {
      href: `${base}/ai-suite/workflow`,
      title: 'Workflow',
      badge: 'Auto',
      icon: GitBranch,
      body: 'Recording complete → CRM lead status → duration ≥ 90s → Call Audit SOP. Status chips Lead Status page se aate hain.',
      cta: 'Open workflow',
    },
    {
      href: `${base}/ai-suite/playbook`,
      title: 'Sales Playbook',
      badge: 'Setup',
      icon: BookOpen,
      body: 'Voice & style, who we sell to, product USPs, pricing, objection handling, competitors — Call IQ / Lead IQ isi se ground hote hain.',
      cta: 'Edit playbook',
    },
    {
      href: `${base}/recordings`,
      title: 'Recordings',
      badge: 'QA',
      icon: Activity,
      body: 'Recording list se Analyze (free SOP) ya Deep AI (TeleCRM prompt + playbook). Audio auto-transcribe nahi.',
      cta: 'Open recordings',
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1100px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-violet-700" />
            AI Suite
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Call IQ + Lead IQ — MY FNG Sales SOP, structured fields, editable playbook.
          </p>
        </div>
        <PageHelpIcon href={helpHref} label="AI Suite" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-violet-200 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h2 className="text-lg font-bold text-slate-900">{c.title}</h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200">
                  {c.badge}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">{c.body}</p>
              <p className="mt-4 text-sm font-semibold text-violet-700">{c.cta} →</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
