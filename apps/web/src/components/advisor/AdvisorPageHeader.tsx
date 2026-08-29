'use client';

import type { ReactNode } from 'react';

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
    <div className="overflow-hidden rounded-xl border border-[#004AAD]/20 bg-gradient-to-br from-[#023D95] via-[#004AAD] to-[#0369A1] p-3 text-white shadow-lg sm:rounded-2xl sm:p-4 md:p-5">
      <div className="flex flex-col gap-3 min-[900px]:flex-row min-[900px]:items-start min-[900px]:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100/80">{eyebrow}</p>
          <h1 className="mt-0.5 min-w-0 break-words text-lg font-black !text-white sm:mt-1 sm:text-xl md:text-2xl">
            {title}
          </h1>
          {subtitle ? <p className="mt-1 text-xs text-blue-100/90 sm:text-sm">{subtitle}</p> : null}
        </div>
        {right ? <div className="w-full min-w-0 min-[900px]:w-auto min-[900px]:shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}

export function AdvisorCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-4 md:p-5 ${className}`}>
      {children}
    </div>
  );
}
