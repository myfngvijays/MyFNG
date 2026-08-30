'use client';

import { useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronUp } from 'lucide-react';
import {
  CRM_DATE_PRESETS,
  resolveCrmDateRange,
  type CrmDatePreset,
} from '@/lib/telecaller/crmDateRange';

export function isoInRange(iso: string | null | undefined, startIso: string, endIso: string, allTime?: boolean) {
  if (allTime) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= new Date(startIso).getTime() && t <= new Date(endIso).getTime();
}

export default function WorkshopDateFilter({
  preset,
  customStart,
  customEnd,
  onChange,
}: {
  preset: CrmDatePreset;
  customStart: string;
  customEnd: string;
  onChange: (next: { datePreset: CrmDatePreset; customStart: string; customEnd: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const range = resolveCrmDateRange(preset, customStart, customEnd);
  const dateLabel = CRM_DATE_PRESETS.find((p) => p.value === preset)?.label || range.label;

  return (
    <div className="relative z-20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-[#004AAD]" />
        <span className="flex-1 truncate text-left text-[12px] font-bold text-slate-800">
          {preset === 'custom' ? range.label : dateLabel}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {CRM_DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                onChange({ datePreset: p.value, customStart, customEnd });
                if (p.value !== 'custom') setOpen(false);
              }}
              className={`flex w-full items-center justify-between border-b border-slate-100 px-3.5 py-2.5 text-[13px] font-semibold last:border-0 ${
                preset === p.value ? 'bg-blue-50 text-[#004AAD]' : 'text-slate-800'
              }`}
            >
              {p.label}
              {preset === p.value ? <Check className="h-4 w-4" /> : null}
            </button>
          ))}
          {preset === 'custom' ? (
            <div className="flex items-center gap-2 bg-slate-50 p-2.5">
              <input
                type="date"
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                value={customStart}
                onChange={(e) => onChange({ datePreset: 'custom', customStart: e.target.value, customEnd })}
              />
              <span className="text-xs text-slate-400">→</span>
              <input
                type="date"
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                value={customEnd}
                onChange={(e) => onChange({ datePreset: 'custom', customStart, customEnd: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-[#004AAD] px-3 py-1.5 text-xs font-bold text-white"
              >
                Apply
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
