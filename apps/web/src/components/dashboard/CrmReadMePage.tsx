'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';
import {
  getLeadManagerReadme,
  getTelecallerReadme,
  type ReadmeSection,
} from '@/lib/dashboard/menuHelpCopy';

function ReadMeContent({
  role,
  sections,
}: {
  role: 'LEAD_MANAGER' | 'TELECALLER';
  sections: ReadmeSection[];
}) {
  const base = role === 'LEAD_MANAGER' ? '/dashboard/lead_manager' : '/dashboard/telecaller';

  return (
    <DashboardLayout role={role}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-[#023D95] flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            ReadMe
            <PageHelpIcon
              href={`${base}/readme`}
              label="ReadMe"
            />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Har menu kya hai aur kya karta hai — short guide. Page pe sirf ek{' '}
            <span className="font-semibold text-slate-700">i</span> bhi dikhega us page ke baare mein.
          </p>
        </div>

        {sections.map((section) => (
          <section key={section.heading} className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
              {section.heading}
            </h2>
            <ul className="space-y-3">
              {section.items.map((item) => (
                <li
                  key={`${section.heading}-${item.title}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-[#023D95]">{item.title}</h3>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="text-xs font-bold text-[#004AAD] hover:underline"
                      >
                        Open →
                      </Link>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                    {item.body}
                  </p>
                  {item.tips && item.tips.length > 0 ? (
                    <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                      {item.tips.map((tip) => (
                        <li key={tip} className="flex gap-2 text-xs text-slate-600">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </DashboardLayout>
  );
}

export function LeadManagerReadMePage() {
  return <ReadMeContent role="LEAD_MANAGER" sections={getLeadManagerReadme()} />;
}

export function TelecallerReadMePage() {
  return <ReadMeContent role="TELECALLER" sections={getTelecallerReadme()} />;
}
