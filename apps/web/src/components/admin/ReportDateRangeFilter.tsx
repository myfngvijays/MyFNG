'use client';

import React from 'react';
import { Calendar, CalendarRange } from 'lucide-react';
import { REPORT_DATE_PRESETS, type ReportDatePreset } from '@/lib/report-date-range';

export type ReportDateRangeValue = {
  preset: ReportDatePreset;
  customStart: string;
  customEnd: string;
};

const QUICK_DATE_PRESETS: ReportDatePreset[] = [
  'today',
  'yesterday',
  'last_7_days',
  'last_30_days',
  'this_month',
  'all_time',
  'custom',
];

type ReportDateRangeFilterProps = {
  preset: ReportDatePreset;
  customStart: string;
  customEnd: string;
  onChange: (value: ReportDateRangeValue) => void;
  className?: string;
  variant?: 'default' | 'compact';
};

function presetLabel(value: ReportDatePreset) {
  return REPORT_DATE_PRESETS.find((p) => p.value === value)?.label || value;
}

export default function ReportDateRangeFilter({
  preset,
  customStart,
  customEnd,
  onChange,
  className = '',
  variant = 'default',
}: ReportDateRangeFilterProps) {
  const update = (next: Partial<ReportDateRangeValue>) => {
    onChange({
      preset: next.preset ?? preset,
      customStart: next.customStart ?? customStart,
      customEnd: next.customEnd ?? customEnd,
    });
  };

  if (variant === 'compact') {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <select
          value={preset}
          onChange={(e) => update({ preset: e.target.value as ReportDatePreset })}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800"
          aria-label="Date range"
        >
          {REPORT_DATE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {preset === 'custom' ? (
          <>
            <input
              type="date"
              value={customStart}
              onChange={(e) => update({ customStart: e.target.value })}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
              aria-label="From date"
            />
            <span className="text-xs text-gray-400">–</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => update({ customEnd: e.target.value })}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
              aria-label="To date"
            />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {QUICK_DATE_PRESETS.map((value) => {
          const active = preset === value;
          const isCustom = value === 'custom';
          return (
            <button
              key={value}
              type="button"
              onClick={() => update({ preset: value })}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                active
                  ? isCustom
                    ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
                    : 'border-blue-600 bg-blue-600 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {isCustom ? <CalendarRange className="h-3.5 w-3.5" /> : null}
              {presetLabel(value)}
            </button>
          );
        })}
      </div>

      {preset === 'custom' ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5">
          <Calendar className="h-4 w-4 text-violet-600 shrink-0" />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => update({ customStart: e.target.value })}
              className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
              aria-label="From date"
            />
            <span className="text-xs font-semibold text-violet-700">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => update({ customEnd: e.target.value })}
              className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
              aria-label="To date"
            />
          </div>
        </div>
      ) : null}

      <details className="mt-2 group">
        <summary className="cursor-pointer list-none text-[11px] font-semibold text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
          <span className="group-open:hidden">More date options</span>
          <span className="hidden group-open:inline">Hide date options</span>
        </summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {REPORT_DATE_PRESETS.filter((p) => !QUICK_DATE_PRESETS.includes(p.value)).map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => update({ preset: p.value })}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                preset === p.value
                  ? 'border-slate-700 bg-slate-700 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
