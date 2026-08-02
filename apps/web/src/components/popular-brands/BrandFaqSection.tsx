'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

type Faq = { question: string; answer: string };

type Props = {
  faqs: Faq[];
  initialCount?: number;
};

export default function BrandFaqSection({ faqs, initialCount = 5 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? faqs : faqs.slice(0, initialCount);
  const hasMore = faqs.length > initialCount;

  return (
    <>
      <div className="space-y-3">
        {visible.map((faq) => (
          <details
            key={faq.question}
            className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm open:border-brand-primary/30 open:shadow-md"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-bold text-gray-900 marker:hidden transition hover:bg-gray-50/80 sm:gap-4 sm:px-5 sm:py-4 sm:text-base">
              <span>{faq.question}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-brand-primary transition-transform duration-200 group-open:rotate-180 sm:h-5 sm:w-5" />
            </summary>
            <div className="border-t border-gray-100 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
              <p className="text-sm leading-relaxed text-gray-600">{faq.answer}</p>
            </div>
          </details>
        ))}
      </div>
      {hasMore ? (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-brand-primary/30 bg-white px-6 py-2.5 text-sm font-bold text-brand-primary shadow-sm transition hover:bg-brand-primary/5"
          >
            {expanded ? 'Show less' : `Show ${faqs.length - initialCount} more FAQs`}
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      ) : null}
    </>
  );
}
