'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

export const BLOG_INPUT =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent';
export const BLOG_TEXTAREA = `${BLOG_INPUT} resize-y`;

export function BlogSectionCard({
  title,
  description,
  icon,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      <div className="flex items-start gap-3 mb-4 pb-3 border-b border-gray-100">
        {icon ? (
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-brand-primary flex items-center justify-center shrink-0">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-heading">{title}</h2>
          {description ? <p className="text-xs text-gray-500 mt-0.5">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function BlogChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${done ? 'text-emerald-700' : 'text-gray-500'}`}>
      {done ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
      <span>{label}</span>
    </div>
  );
}
