'use client';

import React, { useState } from 'react';
import type { WorkshopPublicPageFaq } from './types';

type WorkshopFaqsProps = {
  faqs: WorkshopPublicPageFaq[];
  workshopName?: string;
  city?: string;
};

export default function WorkshopFaqs({ faqs, workshopName, city }: WorkshopFaqsProps) {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [showAll, setShowAll] = useState(false);

  if (!faqs.length) return null;

  const toggle = (index: number) => {
    setActiveIndex((prev) => (prev === index ? -1 : index));
  };

  const visibleFaqs = showAll ? faqs : faqs.slice(0, 5);

  return (
    <section className="py-10 bg-[#f2f4f8]">
      <div className="w-[90%] max-w-[1100px] mx-auto">
        <h2 className="text-[32px] font-bold text-[#0a3d91] mb-6">FAQs</h2>

        <div className="space-y-3">
          {visibleFaqs.map((faq, index) => {
            const isActive = activeIndex === index;
            return (
              <div
                key={`faq-${index}`}
                className="bg-[#e9edf3] rounded-[16px] overflow-hidden transition-all duration-300"
              >
                <div
                  onClick={() => toggle(index)}
                  className="px-[25px] py-[18px] text-[15px] sm:text-[17px] font-semibold text-[#0a3d91] flex justify-between items-center cursor-pointer select-none"
                >
                  <span>{faq.question}</span>
                  <span
                    className={`text-[22px] font-bold transition-transform duration-300 ${
                      isActive ? 'rotate-45' : ''
                    }`}
                  >
                    +
                  </span>
                </div>
                <div
                  className="bg-white overflow-hidden transition-all duration-400 ease-in-out"
                  style={{
                    maxHeight: isActive ? '800px' : '0px',
                    padding: isActive ? '0 25px' : '0 25px',
                  }}
                >
                  <p className="py-5 text-[14px] text-[#444] leading-[1.7]">{faq.answer}</p>
                </div>
              </div>
            );
          })}
        </div>

        {faqs.length > 5 && (
          <div className="text-center mt-5">
            <button
              onClick={() => setShowAll((p) => !p)}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-white border border-[#0a3d91] text-[#0a3d91] rounded-full text-[14px] font-semibold hover:bg-[#0a3d91] hover:text-white transition-colors cursor-pointer"
            >
              {showAll ? 'Show Less' : `Show More (${faqs.length - 5} more)`}
              <svg className={`w-4 h-4 transition-transform ${showAll ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
