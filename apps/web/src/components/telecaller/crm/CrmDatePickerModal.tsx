'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  CRM_DATE_PRESETS,
  istYmd,
  resolveCrmDateRange,
  type CrmDatePreset,
} from '@/lib/telecaller/crmDateRange';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatYmdShort(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

function addMonthsYm(year: number, month0: number, delta: number) {
  const d = new Date(year, month0 + delta, 1);
  return { year: d.getFullYear(), month0: d.getMonth() };
}

function ymdFromParts(y: number, m0: number, day: number) {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildMonthCells(year: number, month0: number) {
  const firstDow = new Date(year, month0, 1).getDay();
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const cells: Array<{ ymd: string | null; day: number | null }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ ymd: null, day: null });
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ ymd: ymdFromParts(year, month0, day), day });
  }
  while (cells.length % 7 !== 0) cells.push({ ymd: null, day: null });
  return cells;
}

export type CrmDatePickerValue = {
  datePreset: CrmDatePreset;
  customStart: string;
  customEnd: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  value: CrmDatePickerValue;
  onApply: (next: CrmDatePickerValue) => void;
};

export default function CrmDatePickerModal({ open, onClose, value, onApply }: Props) {
  const today = istYmd();
  const [mounted, setMounted] = useState(false);
  const [pickMode, setPickMode] = useState<'single' | 'range'>('single');
  const [rangeTap, setRangeTap] = useState<'start' | 'end'>('start');
  const [draftStart, setDraftStart] = useState(value.customStart || today);
  const [draftEnd, setDraftEnd] = useState(value.customEnd || today);
  const [draftPreset, setDraftPreset] = useState<CrmDatePreset>(value.datePreset);
  const startParts = (value.customStart || today).split('-').map(Number);
  const [viewYear, setViewYear] = useState(startParts[0] || new Date().getFullYear());
  const [viewMonth0, setViewMonth0] = useState((startParts[1] || 1) - 1);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setDraftPreset(value.datePreset);
    const start = value.customStart || today;
    const end = value.customEnd || start;
    setDraftStart(start);
    setDraftEnd(end);
    setPickMode(start === end ? 'single' : 'range');
    setRangeTap('start');
    const [y, m] = start.split('-').map(Number);
    if (y && m) {
      setViewYear(y);
      setViewMonth0(m - 1);
    }
  }, [open, value.datePreset, value.customStart, value.customEnd, today]);

  const summary = useMemo(() => {
    if (draftPreset !== 'custom') {
      return resolveCrmDateRange(draftPreset, draftStart, draftEnd).label;
    }
    if (pickMode === 'single' || draftStart === draftEnd) {
      return `Selected: ${formatYmdShort(draftStart)}`;
    }
    const lo = draftStart <= draftEnd ? draftStart : draftEnd;
    const hi = draftStart <= draftEnd ? draftEnd : draftStart;
    return `${formatYmdShort(lo)} → ${formatYmdShort(hi)}`;
  }, [draftPreset, draftStart, draftEnd, pickMode]);

  if (!open || !mounted) return null;

  const onDayPress = (ymd: string) => {
    setDraftPreset('custom');
    if (pickMode === 'single') {
      setDraftStart(ymd);
      setDraftEnd(ymd);
      return;
    }
    if (rangeTap === 'start') {
      setDraftStart(ymd);
      setDraftEnd(ymd);
      setRangeTap('end');
      return;
    }
    setDraftEnd(ymd);
    setRangeTap('start');
  };

  const apply = () => {
    let customStart = draftStart;
    let customEnd = draftEnd;
    if (draftPreset === 'custom') {
      if (pickMode === 'single') {
        customEnd = customStart;
      } else if (customStart > customEnd) {
        const t = customStart;
        customStart = customEnd;
        customEnd = t;
      }
    } else {
      const range = resolveCrmDateRange(draftPreset, customStart, customEnd);
      customStart = range.startYmd;
      customEnd = range.endYmd;
    }
    onApply({ datePreset: draftPreset, customStart, customEnd });
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl p-4 sm:p-5 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-extrabold text-[#023D95]">Select date</h2>
            <p className="text-xs font-semibold text-[#004AAD]/90 mt-0.5">
              Single date ya range — calendar pe tap karke choose karo
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {CRM_DATE_PRESETS.filter((p) => p.value !== 'custom').map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setDraftPreset(p.value)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                draftPreset === p.value
                  ? 'bg-[#004AAD] text-white border-[#004AAD]'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="inline-flex w-full rounded-xl bg-slate-100 p-0.5 mb-3">
          <button
            type="button"
            onClick={() => {
              setPickMode('single');
              setDraftPreset('custom');
              setDraftEnd(draftStart);
            }}
            className={`flex-1 rounded-[10px] px-3 py-2 text-sm font-bold ${
              pickMode === 'single' && draftPreset === 'custom'
                ? 'bg-white text-[#004AAD] shadow-sm ring-1 ring-[#004AAD]/30'
                : 'text-slate-600'
            }`}
          >
            Single date
          </button>
          <button
            type="button"
            onClick={() => {
              setPickMode('range');
              setDraftPreset('custom');
              setRangeTap('start');
            }}
            className={`flex-1 rounded-[10px] px-3 py-2 text-sm font-bold ${
              pickMode === 'range' && draftPreset === 'custom'
                ? 'bg-white text-[#004AAD] shadow-sm ring-1 ring-[#004AAD]/30'
                : 'text-slate-600'
            }`}
          >
            Date range
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-slate-100"
              onClick={() => {
                const next = addMonthsYm(viewYear, viewMonth0, -1);
                setViewYear(next.year);
                setViewMonth0(next.month0);
              }}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5 text-[#004AAD]" />
            </button>
            <p className="text-sm font-extrabold text-slate-800">
              {MONTH_NAMES[viewMonth0]} {viewYear}
            </p>
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-slate-100"
              onClick={() => {
                const next = addMonthsYm(viewYear, viewMonth0, 1);
                setViewYear(next.year);
                setViewMonth0(next.month0);
              }}
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5 text-[#004AAD]" />
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={`${d}-${i}`} className="text-center text-[11px] font-bold text-slate-400 py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {buildMonthCells(viewYear, viewMonth0).map((cell, idx) => {
              if (!cell.ymd) return <div key={`e-${idx}`} className="aspect-square" />;
              const ymd = cell.ymd;
              const lo = draftStart <= draftEnd ? draftStart : draftEnd;
              const hi = draftStart <= draftEnd ? draftEnd : draftStart;
              const selected =
                draftPreset === 'custom' &&
                (pickMode === 'single' ? ymd === draftStart : ymd === lo || ymd === hi);
              const inRange =
                draftPreset === 'custom' && pickMode === 'range' && ymd > lo && ymd < hi;
              const isToday = ymd === today;
              return (
                <button
                  key={ymd}
                  type="button"
                  onClick={() => onDayPress(ymd)}
                  className={`aspect-square rounded-full text-sm font-semibold flex items-center justify-center transition ${
                    selected
                      ? 'bg-[#004AAD] text-white shadow-sm'
                      : inRange
                        ? 'bg-blue-100 text-[#004AAD]'
                        : isToday
                          ? 'text-[#004AAD] font-extrabold hover:bg-slate-50'
                          : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs font-semibold text-slate-500">{summary}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded-xl bg-[#004AAD] px-4 py-3 text-sm font-bold text-white"
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
