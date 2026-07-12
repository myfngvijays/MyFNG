'use client';

import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { EXPORT_DATE_PRESETS, type ReportDatePreset } from '@/lib/report-date-range';

export type ExportDateRangeValue = {
  preset: ReportDatePreset;
  customStart: string;
  customEnd: string;
};

type ExportDateRangeMenuProps = {
  onExport: () => Promise<void>;
  onRangeChange?: (value: ExportDateRangeValue) => void;
  preset?: ReportDatePreset;
  customStart?: string;
  customEnd?: string;
  disabled?: boolean;
  className?: string;
  buttonLabel?: string;
};

export default function ExportDateRangeMenu({
  onExport,
  onRangeChange,
  preset: controlledPreset,
  customStart: controlledCustomStart,
  customEnd: controlledCustomEnd,
  disabled = false,
  className = '',
  buttonLabel = 'Export',
}: ExportDateRangeMenuProps) {
  const [internalPreset, setInternalPreset] = useState<ReportDatePreset>('all_time');
  const [internalCustomStart, setInternalCustomStart] = useState('');
  const [internalCustomEnd, setInternalCustomEnd] = useState('');
  const [exporting, setExporting] = useState(false);

  const preset = controlledPreset ?? internalPreset;
  const customStart = controlledCustomStart ?? internalCustomStart;
  const customEnd = controlledCustomEnd ?? internalCustomEnd;

  const updateRange = (next: Partial<ExportDateRangeValue>) => {
    const value: ExportDateRangeValue = {
      preset: next.preset ?? preset,
      customStart: next.customStart ?? customStart,
      customEnd: next.customEnd ?? customEnd,
    };
    if (controlledPreset === undefined) setInternalPreset(value.preset);
    if (controlledCustomStart === undefined) setInternalCustomStart(value.customStart);
    if (controlledCustomEnd === undefined) setInternalCustomEnd(value.customEnd);
    onRangeChange?.(value);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExport();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {preset === 'custom' ? (
        <>
          <input
            type="date"
            value={customStart}
            onChange={(e) => updateRange({ customStart: e.target.value })}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            aria-label="Filter from date"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => updateRange({ customEnd: e.target.value })}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            aria-label="Filter to date"
          />
        </>
      ) : null}
      <select
        value={preset}
        onChange={(e) => updateRange({ preset: e.target.value as ReportDatePreset })}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold min-w-[140px]"
        aria-label="Date range filter"
      >
        {EXPORT_DATE_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={disabled || exporting || (preset === 'custom' && (!customStart || !customEnd))}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {exporting ? 'Exporting...' : buttonLabel}
      </button>
    </div>
  );
}
