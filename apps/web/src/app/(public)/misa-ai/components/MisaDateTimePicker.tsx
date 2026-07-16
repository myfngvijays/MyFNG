'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, CheckCircle, Clock } from 'lucide-react';
import {
  addDaysToIsoDate,
  formatDateForButton,
  formatDateForChat,
  getAvailableSlotsForDate,
  getCurrentDateIST,
  getDefaultPickupDate,
  getNextDateIST,
  isSameDayBookingAllowed,
  type PickupTimeSlot,
} from './misaPickupUtils';

export function assistantAsksForPickupDate(text: string): boolean {
  const t = String(text || '').toLowerCase();
  if (/registration number|vehicle number|car registration|booking summary|what time/i.test(t)) return false;
  return /when would you like|schedule the service|preferred date|pickup date|select a future date/i.test(t);
}

export function assistantAsksForPickupTime(text: string): boolean {
  const t = String(text || '').toLowerCase();
  if (/registration number|vehicle number|car registration|booking summary/i.test(t)) return false;
  return (
    /what time would you prefer/i.test(t) ||
    (/pickup service is available between/i.test(t) && !/registration number|car registration/i.test(t)) ||
    /available slots.*10 am/i.test(t)
  );
}

export function extractPickupTimePrompt(text: string): string {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const question = lines.find((l) => /what time would you prefer/i.test(l));
  return question || 'Select your pickup time below';
}

export function extractPickupDatePrompt(text: string): string {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const question = lines.find((l) => /when would you like|schedule the service|select a future date/i.test(l));
  return question || 'Select your pickup date below';
}

function buildQuickDates(minDate: string, count = 7): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(addDaysToIsoDate(minDate, i));
  }
  return out;
}

type DatePickerProps = {
  onConfirm: (isoDate: string, displayLabel: string) => void;
};

export function MisaPickupDatePicker({ onConfirm }: DatePickerProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const today = getCurrentDateIST();
  const tomorrow = getNextDateIST();
  const sameDayAllowed = isSameDayBookingAllowed() && getAvailableSlotsForDate(today).length > 0;
  const minDate = sameDayAllowed ? today : tomorrow;
  const quickDates = useMemo(() => buildQuickDates(minDate, 7), [minDate]);

  const [pickupDate, setPickupDate] = useState(getDefaultPickupDate);

  useEffect(() => {
    setPickupDate(getDefaultPickupDate());
  }, []);

  const selectedLabel = formatDateForChat(pickupDate);

  function openDatePicker() {
    const el = dateInputRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === 'function') {
        el.showPicker();
        return;
      }
    } catch {
      // showPicker can throw if not triggered by user gesture in some browsers
    }
    el.click();
  }

  return (
    <div className="mt-3 rounded-2xl border border-brand-primary/15 bg-gradient-to-br from-white to-gray-50/50 p-3 shadow-sm sm:p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-md">
          <Calendar className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">Select pickup date</p>
          <p className="text-xs text-gray-500">Today available only before 4 PM IST</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {sameDayAllowed && (
          <button
            type="button"
            onClick={() => setPickupDate(today)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition sm:text-sm ${
              pickupDate === today
                ? 'bg-brand-primary text-white shadow-sm'
                : 'border border-gray-200 bg-white text-gray-700 hover:border-brand-primary/50'
            }`}
          >
            {formatDateForButton(today)}
          </button>
        )}
        <button
          type="button"
          onClick={() => setPickupDate(tomorrow)}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition sm:text-sm ${
            pickupDate === tomorrow
              ? 'bg-brand-primary text-white shadow-sm'
              : 'border border-gray-200 bg-white text-gray-700 hover:border-brand-primary/50'
          }`}
        >
          {formatDateForButton(tomorrow)}
        </button>

        <button
          type="button"
          onClick={openDatePicker}
          className="flex h-9 min-w-[9rem] items-center justify-center gap-1.5 rounded-full border border-brand-primary/30 bg-white px-3 text-xs font-bold text-brand-primary shadow-sm transition hover:border-brand-primary hover:bg-brand-primary/5"
        >
          <Calendar className="h-4 w-4 shrink-0" />
          Pick a date
        </button>
        <input
          ref={dateInputRef}
          type="date"
          value={pickupDate}
          min={minDate}
          onChange={(e) => {
            const selected = e.target.value;
            if (selected >= minDate) setPickupDate(selected);
          }}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {quickDates.map((iso) => (
          <button
            key={iso}
            type="button"
            onClick={() => setPickupDate(iso)}
            className={`shrink-0 rounded-xl border px-3 py-2 text-left transition ${
              pickupDate === iso
                ? 'border-brand-primary bg-brand-primary/10 ring-2 ring-brand-primary/20'
                : 'border-gray-200 bg-white hover:border-brand-primary/40'
            }`}
          >
            <span className="block text-[10px] font-semibold uppercase text-gray-400">
              {formatDateForButton(iso).split(',')[0]}
            </span>
            <span className="block text-sm font-bold text-gray-900">
              {new Date(iso + 'T00:00:00+05:30').getDate()}{' '}
              {new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }).format(
                new Date(iso + 'T00:00:00+05:30'),
              )}
            </span>
          </button>
        ))}
      </div>

      {!sameDayAllowed && (
        <p className="mt-2 text-xs text-amber-700">
          After 4 PM IST, same-day pickup is not available. Next available date is selected.
        </p>
      )}

      <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-brand-primary">
        <CheckCircle className="h-4 w-4" />
        Selected: {selectedLabel}
      </p>

      <button
        type="button"
        onClick={() => onConfirm(pickupDate, selectedLabel)}
        className="mt-4 w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:bg-brand-primary-hover"
      >
        Continue · {selectedLabel}
      </button>
    </div>
  );
}

type TimePickerProps = {
  preferredDate?: string;
  onConfirm: (timeLabel: string) => void;
};

export function MisaPickupTimePicker({ preferredDate, onConfirm }: TimePickerProps) {
  const dateIso = preferredDate || getDefaultPickupDate();
  const [selected, setSelected] = useState<string | null>(null);

  const availableSlots = useMemo(() => getAvailableSlotsForDate(dateIso), [dateIso]);

  useEffect(() => {
    setSelected(null);
  }, [dateIso]);

  if (availableSlots.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        No pickup slots left for today. Please pick a future date first.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-brand-primary/15 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 shadow-md">
          <Clock className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">Select pickup time</p>
          <p className="text-xs text-gray-500">Available 10 AM – 4 PM · past slots hidden</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {availableSlots.map((slot: PickupTimeSlot) => {
          const isSelected = selected === slot.value;
          return (
            <button
              key={slot.value}
              type="button"
              onClick={() => setSelected(slot.value)}
              className={`rounded-xl px-2 py-2.5 text-xs font-semibold transition sm:text-sm ${
                isSelected
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg ring-2 ring-purple-300'
                  : 'border-2 border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:shadow-md'
              }`}
            >
              {slot.label}
            </button>
          );
        })}
      </div>

      {selected && (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-purple-600">
          <CheckCircle className="h-4 w-4" />
          Selected: {selected}
        </p>
      )}

      <button
        type="button"
        disabled={!selected}
        onClick={() => selected && onConfirm(selected)}
        className="mt-4 w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {selected ? `Continue · ${selected}` : 'Select a time slot'}
      </button>
    </div>
  );
}
