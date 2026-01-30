import React, { useState } from 'react';
import type { WorkshopPublicPageFaq } from './types';

type WorkshopFaqsProps = {
  faqs: WorkshopPublicPageFaq[];
};

export default function WorkshopFaqs({ faqs }: WorkshopFaqsProps) {
  const [showAll, setShowAll] = useState(false);
  if (!faqs.length) return null;
  const visibleFaqs = showAll ? faqs : faqs.slice(0, 4);

  return (
    <section className="mt-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">FAQs</h3>
      <div className="space-y-3">
        {visibleFaqs.map((faq, index) => (
          <details
            key={`${faq.question}-${index}`}
            className="group rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-gray-900">
              <span>{faq.question}</span>
              <span className="text-gray-400 group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="mt-3 text-sm text-gray-600">{faq.answer}</p>
          </details>
        ))}
      </div>
      {faqs.length > 4 && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            {showAll ? 'Show Less' : 'See More'}
          </button>
        </div>
      )}
    </section>
  );
}
