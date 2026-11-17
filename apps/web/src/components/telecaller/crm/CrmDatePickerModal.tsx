'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  CRM_DATE_PRESETS,
  istWeekday,
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
  const firstDow = istWeekday(year, month0, 1);
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
  anchorRef?: { current: HTMLElement | null };
};

export default function CrmDatePickerModal({ open, onClose, value, onApply, anchorRef }: Props) {
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

  const panelRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = anchorRef?.current;
      const width = Math.min(520, window.innerWidth - 16);
      if (!el) {
        setBox({ top: 120, left: Math.max(8, (window.innerWidth - width) / 2) });
        return;
      }
      const r = el.getBoundingClientRect();
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      setBox({ top: r.bottom + 6, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, onClose, anchorRef]);

  if (!open || !mounted || !box) return null;

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

  const applyPreset = (preset: CrmDatePreset) => {
    const range = resolveCrmDateRange(preset, draftStart, draftEnd);
    onApply({ datePreset: preset, customStart: range.startYmd, customEnd: range.endYmd });
    onClose();
  };

  const applyCustom = () => {
    let customStart = draftStart;
    let customEnd = pickMode === 'single' ? draftStart : draftEnd;
    if (customStart > customEnd) {
      const t = customStart;
      customStart = customEnd;
      customEnd = t;
    }
    onApply({ datePreset: 'custom', customStart, customEnd });
    onClose();
  };

  const presets = CRM_DATE_PRESETS.filter((p) => p.value !== 'custom');

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[80] flex w-[min(520px,calc(100vw-16px))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
      style={{ top: box.top, left: box.left }}
    >
        <div className="w-[148px] shrink-0 border-r border-slate-200 bg-slate-50 py-1">
          {presets.map((p) => {
            const active = draftPreset === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => applyPreset(p.value)}
                className={`block w-full px-3 py-1.5 text-left text-[12px] font-semibold ${
                  active ? 'bg-[#E8F0FE] text-[#1A73E8]' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="min-w-0 flex-1 p-2.5">
          <div className="mb-1 flex items-center justify-between">
            <button
              type="button"
              className="rounded p-1 hover:bg-slate-100"
              onClick={() => {
                const next = addMonthsYm(viewYear, viewMonth0, -1);
                setViewYear(next.year);
                setViewMonth0(next.month0);
              }}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            </button>
            <p className="text-[13px] font-semibold text-slate-800">
              {MONTH_NAMES[viewMonth0]} {viewYear}
            </p>
            <div className="flex items-center">
              <button
                type="button"
                className="rounded p-1 hover:bg-slate-100"
                onClick={() => {
                  const next = addMonthsYm(viewYear, viewMonth0, 1);
                  setViewYear(next.year);
                  setViewMonth0(next.month0);
                }}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-1 flex justify-center gap-3 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => {
                setPickMode('single');
                setDraftPreset('custom');
                setDraftEnd(draftStart);
              }}
              className={pickMode === 'single' ? 'text-[#1A73E8]' : 'text-slate-400'}
            >
              Single
            </button>
            <button
              type="button"
              onClick={() => {
                setPickMode('range');
                setDraftPreset('custom');
                setRangeTap('start');
              }}
              className={pickMode === 'range' ? 'text-[#1A73E8]' : 'text-slate-400'}
            >
              Range
            </button>
          </div>

          <div className="mx-auto w-[224px]">
            <div className="mb-0.5 grid grid-cols-7">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={`${d}-${i}`} className="h-6 text-center text-[10px] font-semibold text-slate-400 leading-6">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {buildMonthCells(viewYear, viewMonth0).map((cell, idx) => {
                if (!cell.ymd) return <div key={`e-${idx}`} className="h-8" />;
                const ymd = cell.ymd;
                const lo = draftStart <= draftEnd ? draftStart : draftEnd;
                const hi = draftStart <= draftEnd ? draftEnd : draftStart;
                const selected =
                  draftPreset === 'custom' &&
                  (pickMode === 'single' ? ymd === draftStart : ymd === lo || ymd === hi);
                const inRange = draftPreset === 'custom' && pickMode === 'range' && ymd > lo && ymd < hi;
                const isToday = ymd === today;
                return (
                  <button
                    key={ymd}
                    type="button"
                    onClick={() => onDayPress(ymd)}
                    className={`mx-auto h-8 w-8 rounded-full text-[12px] font-medium ${
                      selected
                        ? 'bg-[#1A73E8] text-white'
                        : inRange
                          ? 'bg-[#E8F0FE] text-[#1A73E8]'
                          : isToday
                            ? 'text-[#1A73E8] font-bold hover:bg-slate-50'
                            : 'text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
            <p className="min-w-0 truncate text-[11px] font-medium text-slate-500">{summary}</p>
            <button
              type="button"
              onClick={applyCustom}
              className="h-7 shrink-0 rounded bg-[#1A73E8] px-3 text-[12px] font-semibold text-white"
            >
              Apply
            </button>
          </div>
        </div>
    </div>,
    document.body,
  );
}
