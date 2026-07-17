'use client';

import { useState } from 'react';
import {
  BatteryCharging,
  ChevronDown,
  CircleDot,
  Cpu,
  Disc3,
  HelpCircle,
  Paintbrush,
  Settings,
  Shield,
  Sparkles,
  Wind,
  Wrench,
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import type { FaqPageSection, FaqSectionIcon } from '@/lib/public-faq-page';

const ICONS: Record<FaqSectionIcon, React.ReactNode> = {
  help: <HelpCircle className="w-5 h-5" />,
  wrench: <Wrench className="w-5 h-5" />,
  wind: <Wind className="w-5 h-5" />,
  cpu: <Cpu className="w-5 h-5" />,
  battery: <BatteryCharging className="w-5 h-5" />,
  disc: <Disc3 className="w-5 h-5" />,
  circle: <CircleDot className="w-5 h-5" />,
  paint: <Paintbrush className="w-5 h-5" />,
  sparkles: <Sparkles className="w-5 h-5" />,
  settings: <Settings className="w-5 h-5" />,
  shield: <Shield className="w-5 h-5" />,
};

function FaqQuestion({ question, answer, defaultOpen = false }: { question: string; answer: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-xl border transition-colors duration-200 ${open ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-3 p-4 text-left cursor-pointer select-none"
      >
        <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${open ? 'bg-blue-600' : 'bg-gray-200'}`}>
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180 text-white' : 'text-gray-500'}`} />
        </span>
        <span className={`flex-1 text-sm font-semibold leading-snug ${open ? 'text-blue-900' : 'text-gray-800'}`}>
          {question}
        </span>
      </button>
      {open ? (
        <div className="px-4 pb-4 pl-12">
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{answer}</p>
        </div>
      ) : null}
    </div>
  );
}

function FaqCategory({ section, defaultOpen = false }: { section: FaqPageSection; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-left cursor-pointer select-none group"
      >
        <span className={`flex-shrink-0 w-10 h-10 rounded-xl ${section.color} text-white flex items-center justify-center shadow-sm`}>
          {ICONS[section.icon]}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-base sm:text-lg font-bold text-gray-900 block">{section.title}</span>
          <span className="text-xs text-gray-500">{section.items.length} questions</span>
        </div>
        <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${open ? 'bg-blue-50' : 'bg-gray-50 group-hover:bg-gray-100'}`}>
          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ease-out ${open ? 'rotate-180 text-blue-600' : 'text-gray-400'}`} />
        </span>
      </button>
      {open ? (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-2">
          {section.items.map((item, idx) => (
            <FaqQuestion key={`${section.sectionKey}-${idx}`} question={item.q} answer={item.a} defaultOpen={idx === 0} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function FaqPageClient({ sections }: { sections: FaqPageSection[] }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Navbar />
      <main className="pt-20 sm:pt-24">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12 sm:px-6">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4">
              <HelpCircle className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Frequently Asked Questions</h1>
            <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
              Answers to the most common questions about My FNG services, bookings, pricing, and warranties.
            </p>
          </div>

          {sections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <p className="text-sm font-semibold text-gray-900">FAQs will appear here soon.</p>
              <p className="mt-2 text-sm text-gray-500">
                Manage website FAQs from Super Admin → Shared Content → FAQs (Web visibility ON).
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sections.map((section, idx) => (
                <FaqCategory key={`${section.faqGroup}-${section.sectionKey}`} section={section} defaultOpen={idx === 0} />
              ))}
            </div>
          )}

          <div className="mt-8 text-center">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <p className="text-sm font-semibold text-gray-900 mb-1">Still have questions?</p>
              <p className="text-sm text-gray-500 mb-4">Our customer support team is here to help.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="/contact-us"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Contact Us
                </a>
                <a
                  href="tel:+919152307030"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Call +91-9152307030
                </a>
              </div>
            </div>
          </div>

          <div className="h-8" />
        </div>
      </main>
      <Footer />
    </div>
  );
}
