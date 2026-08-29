'use client';

import type { ReactNode } from 'react';

/** CRM-style page header (Lead Manager / Telecaller): white strip, navy title. */
export function AdvisorPageHeader({
  eyebrow = 'Workshop Advisor',
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  href?: string;
  right?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-3.5">
      <div className="flex flex-col gap-3 min-[900px]:flex-row min-[900px]:items-start min-[900px]:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#004AAD]/70">{eyebrow}</p>
          ) : null}
          <h1 className="mt-0.5 min-w-0 break-words text-lg font-extrabold leading-tight text-[#023D95] sm:text-xl md:text-2xl">
            {title}
          </h1>
          {subtitle ? <p className="mt-1 text-xs text-slate-500 sm:text-sm">{subtitle}</p> : null}
        </div>
        {right ? <div className="w-full min-w-0 min-[900px]:w-auto min-[900px]:shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}

export function AdvisorCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-3.5 ${className}`}>
      {children}
    </div>
  );
}
