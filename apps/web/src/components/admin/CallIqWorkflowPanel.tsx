'use client';

import Link from 'next/link';
import { GitBranch } from 'lucide-react';
import PageHelpIcon from '@/components/PageHelpIcon';
import CallIqFlowchart from '@/components/admin/CallIqFlowchart';

export default function CallIqWorkflowPanel({
  helpHref,
  suiteHref,
  callIqHref,
}: {
  helpHref: string;
  suiteHref: string;
  callIqHref: string;
}) {
  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[720px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <GitBranch className="h-7 w-7 text-violet-700" />
            Call IQ Workflow
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Recording complete → your CRM lead status → duration check → Sales SOP audit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PageHelpIcon href={helpHref} label="Workflow" />
          <Link
            href={suiteHref}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            AI Suite
          </Link>
          <Link
            href={callIqHref}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Call IQ
          </Link>
        </div>
      </div>
      <CallIqFlowchart editable />
    </div>
  );
}
