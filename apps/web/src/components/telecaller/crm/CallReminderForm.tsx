'use client';

import { useEffect, useRef, useState } from 'react';
import { Flag } from 'lucide-react';
import { istHm, istYmd } from '@/lib/telecaller/crmDateRange';

export type CallReminderDraft = {
  follow_up_type: string;
  scheduled_time: string;
  reason: string;
  priority: string;
};

const TYPES = [
  { value: 'CALLBACK', label: 'Follow-up / Reminder' },
  { value: 'PRICE_CONFIRMATION', label: 'Price Confirmation' },
  { value: 'INFO_PENDING', label: 'Info Pending' },
  { value: 'SLOT_CONFIRMATION', label: 'Slot Confirmation' },
];

const PRIORITIES = [
  { id: 'LOW', label: 'Low', color: 'text-slate-400' },
  { id: 'NORMAL', label: 'Normal', color: 'text-blue-600' },
  { id: 'HIGH', label: 'High', color: 'text-amber-500' },
  { id: 'URGENT', label: 'Urgent', color: 'text-rose-600' },
];

const QUICK = [
  { id: '5', label: '5 min', minutes: 5 },
  { id: '15', label: '15 min', minutes: 15 },
  { id: '60', label: '1 hr', minutes: 60 },
] as const;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function snapHmToTen(hm: string) {
  const [hStr, mStr] = String(hm || '').split(':');
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

function istStamp(offsetMin: number) {
  const d = new Date(Date.now() + offsetMin * 60_000);
  return `${istYmd(d)}T${istHm(d)}`;
}

function prettyStamp(value: string) {
  if (!value || !value.includes('T')) return '';
  const [ymd, hm] = value.split('T');
  const [y, m, d] = ymd.split('-').map(Number);
  const [hStr, mStr] = hm.split(':');
  const h = Number(hStr);
  const min = Number(mStr);
  if (!y || !m || !d || !Number.isFinite(h) || !Number.isFinite(min)) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} · ${h12}:${pad(min)} ${ampm}`;
}

export default function CallReminderForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = 'Schedule reminder',
}: {
  value: CallReminderDraft;
  onChange: (next: CallReminderDraft) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [mode, setMode] = useState<string>('');
  const [flagsOpen, setFlagsOpen] = useState(false);
  const customRef = useRef<HTMLInputElement>(null);
  const priority = PRIORITIES.find((p) => p.id === value.priority) || PRIORITIES[1];

  useEffect(() => {
    if (mode !== 'custom') return;
    const el = customRef.current;
    if (!el) return;
    el.focus();
    try {
      el.showPicker?.();
    } catch {
      /* picker already open or blocked */
    }
  }, [mode]);

  const pickQuick = (id: string, minutes: number) => {
    setMode(id);
    setFlagsOpen(false);
    onChange({ ...value, scheduled_time: istStamp(minutes) });
  };

  const pickCustom = () => {
    setMode('custom');
    setFlagsOpen(false);
  };

  return (
    <div className="mb-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
      <div className="flex items-center gap-1.5">
        <select
          value={value.follow_up_type}
          onChange={(e) => onChange({ ...value, follow_up_type: e.target.value })}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="relative shrink-0">
          <button
            type="button"
            title={`Priority: ${priority.label}`}
            aria-label={`Priority ${priority.label}`}
            onClick={() => setFlagsOpen((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
          >
            <Flag className={`h-4 w-4 ${priority.color}`} fill="currentColor" />
          </button>
          {flagsOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-28 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange({ ...value, priority: p.id });
                    setFlagsOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-slate-50 ${
                    value.priority === p.id ? 'bg-slate-50' : ''
                  }`}
                >
                  <Flag className={`h-3.5 w-3.5 ${p.color}`} fill="currentColor" />
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold text-slate-500">In</span>
        {QUICK.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => pickQuick(q.id, q.minutes)}
            className={`rounded-lg border px-2 py-1 text-xs font-bold ${
              mode === q.id
                ? 'border-[#023D95] bg-[#023D95] text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-[#023D95]/40'
            }`}
          >
            {q.label}
          </button>
        ))}
        <button
          type="button"
          onClick={pickCustom}
          className={`rounded-lg border px-2 py-1 text-xs font-bold ${
            mode === 'custom'
              ? 'border-[#023D95] bg-[#023D95] text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:border-[#023D95]/40'
          }`}
        >
          Custom
        </button>
      </div>

      {mode === 'custom' ? (
        <input
          ref={customRef}
          type="datetime-local"
          step={600}
          value={value.scheduled_time}
          onChange={(e) => {
            const raw = e.target.value;
            if (!raw.includes('T')) {
              onChange({ ...value, scheduled_time: '' });
              return;
            }
            const [ymd, hm] = raw.split('T');
            const snapped = snapHmToTen(hm.slice(0, 5));
            onChange({ ...value, scheduled_time: snapped ? `${ymd}T${snapped}` : '' });
          }}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
        />
      ) : value.scheduled_time ? (
        <p className="text-[11px] font-semibold text-[#023D95]">{prettyStamp(value.scheduled_time)}</p>
      ) : null}

      <textarea
        placeholder="Reason / notes..."
        value={value.reason}
        onChange={(e) => onChange({ ...value, reason: e.target.value })}
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
        rows={2}
      />
      <div className="flex items-center justify-between gap-2">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="text-xs font-semibold text-slate-500 underline">
            Cancel
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-lg bg-[#004AAD] px-4 py-1.5 text-xs font-bold text-white"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
