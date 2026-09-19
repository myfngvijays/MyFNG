'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import {
  GOOGLE_ADS_DATE_PRESETS,
  datePresetLabel,
  istYmd,
  resolveDateBounds,
  type DateRangeInput,
  type GoogleAdsDatePreset,
} from '@/lib/google-ads/dateRange';

type Props = {
  value: DateRangeInput;
  onChange: (next: DateRangeInput) => void;
};

export default function GoogleAdsDatePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draftSince, setDraftSince] = useState(value.since || '');
  const [draftUntil, setDraftUntil] = useState(value.until || '');
  const box = useRef<HTMLDivElement | null>(null);
  const bounds = useMemo(() => resolveDateBounds(value), [value.during, value.since, value.until]);
  const today = istYmd();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (value.during === 'CUSTOM') {
      setDraftSince(value.since || bounds.since);
      setDraftUntil(value.until || bounds.until);
    }
  }, [value.during, value.since, value.until, bounds.since, bounds.until]);

  const pick = (id: GoogleAdsDatePreset) => {
    if (id === 'CUSTOM') {
      setDraftSince(bounds.since);
      setDraftUntil(bounds.until);
      return;
    }
    onChange({ during: id, since: '', until: '' });
    setOpen(false);
  };

  const applyCustom = () => {
    if (!draftSince || !draftUntil) return;
    onChange({ during: 'CUSTOM', since: draftSince, until: draftUntil });
    setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 shadow-sm hover:border-blue-200"
      >
        <CalendarDays className="h-4 w-4 text-[#004AAD]" />
        <span className="max-w-[16rem] truncate">{datePresetLabel(value)}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[22rem] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Date range</p>
          <div className="max-h-[22rem] overflow-y-auto">
            {GOOGLE_ADS_DATE_PRESETS.map((item) => {
              const active = (value.during || 'LAST_7_DAYS') === item.id;
              if (item.id === 'CUSTOM') {
                return (
                  <div key={item.id} className={`rounded-xl px-2 py-2 ${active ? 'bg-blue-50' : ''}`}>
                    <button
                      type="button"
                      onClick={() => pick('CUSTOM')}
                      className="flex w-full items-center justify-between text-sm font-semibold text-slate-800"
                    >
                      Custom
                      {active ? <Check className="h-4 w-4 text-[#004AAD]" /> : null}
                    </button>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="text-[11px] font-bold text-slate-500">
                        From
                        <input
                          type="date"
                          max={today}
                          value={draftSince || bounds.since}
                          onChange={(e) => setDraftSince(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-medium text-slate-800"
                        />
                      </label>
                      <label className="text-[11px] font-bold text-slate-500">
                        To
                        <input
                          type="date"
                          max={today}
                          value={draftUntil || bounds.until}
                          onChange={(e) => setDraftUntil(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-medium text-slate-800"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={applyCustom}
                      className="mt-2 w-full rounded-lg bg-[#004AAD] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Apply
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pick(item.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                    active ? 'bg-blue-50 font-bold text-[#004AAD]' : 'font-medium text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                  {active ? <Check className="h-4 w-4" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
