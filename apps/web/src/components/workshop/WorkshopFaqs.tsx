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

  if (!faqs.length) return null;

  const toggle = (index: number) => {
    setActiveIndex((prev) => (prev === index ? -1 : index));
  };

  return (
    <section className="py-[60px] bg-[#f2f4f8]">
      <div className="w-[90%] max-w-[1100px] mx-auto">
        <h2 className="text-[32px] font-bold text-[#0a3d91] mb-[30px]">FAQs</h2>

        <div className="space-y-[18px]">
          {faqs.map((faq, index) => {
            const isActive = activeIndex === index;
            return (
              <div
                key={`faq-${index}`}
                className="bg-[#e9edf3] rounded-[16px] overflow-hidden transition-all duration-300"
              >
                <div
                  onClick={() => toggle(index)}
                  className="px-[25px] py-[22px] text-[16px] sm:text-[18px] font-semibold text-[#0a3d91] flex justify-between items-center cursor-pointer select-none"
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
      </div>
    </section>
  );
}
