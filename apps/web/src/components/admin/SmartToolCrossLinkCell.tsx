'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

type Props = {
  checked: boolean;
  count?: number;
  latestId?: string | null;
  adminPath: string;
  label: string;
};

export default function SmartToolCrossLinkCell({ checked, count = 0, latestId, adminPath, label }: Props) {
  if (!checked || !latestId) {
    return (
      <div className="min-w-[118px]">
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-1.5">
          <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">Not checked</p>
      </div>
    );
  }

  return (
    <div className="min-w-[118px]">
      <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">{label}</span>
      </div>
      <Link
        href={`${adminPath}?open=${latestId}`}
        className="inline-flex mt-1.5 text-[11px] font-bold text-violet-700 hover:text-violet-900 hover:underline"
      >
        View{count > 1 ? ` (${count})` : ''}
      </Link>
    </div>
  );
}
