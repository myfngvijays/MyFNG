'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { istYmd } from '@/lib/telecaller/crmDateRange';

const MINUTE_STEPS = [0, 10, 20, 30, 40, 50] as const;
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
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

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function snapTimeToTenMinutes(hm: string): string {
  if (!hm) return '';
  const [hStr, mStr] = hm.split(':');
  let h = Number(hStr);
  let m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  m = Math.round(m / 10) * 10;
  if (m === 60) {
    m = 0;
    h = (h + 1) % 24;
  }
  return `${pad(h)}:${pad(m)}`;
}

function ymdFromParts(y: number, m0: number, day: number) {
  return `${y}-${pad(m0 + 1)}-${pad(day)}`;
}

function parseYmd(ymd: string): { y: number; m0: number; d: number } | null {
  const [y, m, d] = String(ymd || '')
    .split('-')
    .map(Number);
  if (!y || !m || !d) return null;
  return { y, m0: m - 1, d };
}

function buildMonthCells(year: number, month0: number) {
  const firstDow = new Date(year, month0, 1).getDay();
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const cells: Array<{ ymd: string | null; day: number | null }> = [];
  for (let i = 0; i < firstDow; i += 1) cells.push({ ymd: null, day: null });
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ ymd: ymdFromParts(year, month0, day), day });
  }
  while (cells.length % 7 !== 0) cells.push({ ymd: null, day: null });
  return cells;
}

function timeSlots() {
  const out: Array<{ value: string; label: string }> = [];
  for (let h = 8; h <= 22; h += 1) {
    for (const m of MINUTE_STEPS) {
      if (h === 22 && m > 0) break;
      const value = `${pad(h)}:${pad(m)}`;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      out.push({ value, label: `${h12}:${pad(m)} ${ampm}` });
    }
  }
  return out;
}

const TIME_SLOTS = timeSlots();

type Props = {
  date: string;
  time: string;
  onChange: (next: { date: string; time: string }) => void;
  required?: boolean;
  dateError?: boolean;
  timeError?: boolean;
};

export default function CrmFollowUpDateTime({
  date,
  time,
  onChange,
  required,
  dateError,
  timeError,
}: Props) {
  const today = istYmd();
  const parsed = parseYmd(date) || parseYmd(today)!;
  const [viewYear, setViewYear] = useState(parsed.y);
  const [viewMonth0, setViewMonth0] = useState(parsed.m0);
  const snapped = snapTimeToTenMinutes(time);
  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth0), [viewYear, viewMonth0]);

  useEffect(() => {
    const p = parseYmd(date);
    if (!p) return;
    setViewYear(p.y);
    setViewMonth0(p.m0);
  }, [date]);

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth0 + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth0(next.getMonth());
  };

  return (
    <div className="col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Date (IST){' '}
          {required ? <span className="text-rose-500">*</span> : <span className="normal-case font-medium">(optional)</span>}
        </label>
        <div className={`rounded-xl border bg-white p-3 ${dateError ? 'border-rose-400' : 'border-slate-200'}`}>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Previous month">
              <ChevronLeft className="h-4 w-4 text-[#023D95]" />
            </button>
            <p className="text-sm font-extrabold text-slate-800">
              {MONTHS[viewMonth0]} {viewYear}
            </p>
            <button type="button" onClick={() => shiftMonth(1)} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Next month">
              <ChevronRight className="h-4 w-4 text-[#023D95]" />
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1 text-center text-[10px] font-bold text-slate-400">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => {
              if (!cell.ymd) return <div key={`e-${idx}`} className="aspect-square" />;
              const ymd = cell.ymd;
              const selected = ymd === date;
              const isToday = ymd === today;
              const isPast = ymd < today;
              return (
                <button
                  key={ymd}
                  type="button"
                  onClick={() => onChange({ date: ymd, time })}
                  className={`aspect-square rounded-full text-xs font-semibold ${
                    selected
                      ? 'bg-[#023D95] text-white'
                      : isToday
                        ? 'text-[#023D95] font-extrabold hover:bg-slate-100'
                        : isPast
                          ? 'text-slate-400 hover:bg-slate-50'
                          : 'text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="mt-2 w-full text-center text-[11px] font-semibold text-[#023D95]"
            onClick={() => {
              const t = istYmd();
              const p = parseYmd(t);
              if (p) {
                setViewYear(p.y);
                setViewMonth0(p.m0);
              }
              onChange({ date: t, time });
            }}
          >
            Today (IST)
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Aaj aur aage ki koi bhi date — next month arrow se.</p>
        {dateError ? <p className="mt-1 text-xs text-rose-600">Date required</p> : null}
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Time (IST){' '}
          {required ? <span className="text-rose-500">*</span> : <span className="normal-case font-medium">(optional)</span>}
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto rounded-xl border border-slate-200 p-3 bg-slate-50">
          {TIME_SLOTS.map((slot) => {
            const active = snapped === slot.value;
            return (
              <button
                key={slot.value}
                type="button"
                onClick={() => onChange({ date: date || today, time: slot.value })}
                className={`rounded-md px-1 py-1.5 text-[10px] font-bold ${
                  active
                    ? 'bg-[#023D95] text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-[#023D95]/40'
                }`}
              >
                {slot.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Every 10 minutes · 8:00 AM – 10:00 PM IST</p>
        {timeError ? <p className="mt-1 text-xs text-rose-600">Time required</p> : null}
      </div>
      {date || time ? (
        <button
          type="button"
          onClick={() => onChange({ date: '', time: '' })}
          className="sm:col-span-2 text-left text-xs font-semibold text-[#023D95]"
        >
          Clear date & time
        </button>
      ) : null}
    </div>
  );
}
