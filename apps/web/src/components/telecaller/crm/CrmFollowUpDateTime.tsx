'use client';

const MINUTE_STEPS = [0, 10, 20, 30, 40, 50] as const;

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

function fieldCls(hasError?: boolean) {
  return [
    'w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition',
    'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#023D95]/20 focus:border-[#023D95]',
    'bg-white hover:border-slate-300',
    hasError ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-200',
  ].join(' ');
}

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
  const snapped = snapTimeToTenMinutes(time);

  return (
    <div className="col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Date {required ? <span className="text-rose-500">*</span> : <span className="normal-case font-medium">(optional)</span>}
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => onChange({ date: e.target.value, time })}
          className={fieldCls(dateError)}
        />
        {dateError ? <p className="mt-1 text-xs text-rose-600">Date required</p> : null}
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Time {required ? <span className="text-rose-500">*</span> : <span className="normal-case font-medium">(optional)</span>}
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto rounded-xl border border-slate-200 p-3 bg-slate-50">
          {TIME_SLOTS.map((slot) => {
            const active = snapped === slot.value;
            return (
              <button
                key={slot.value}
                type="button"
                onClick={() =>
                  onChange({ date: date || new Date().toLocaleDateString('en-CA'), time: slot.value })
                }
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
        <p className="mt-1 text-[11px] text-slate-500">Every 10 minutes · 8:00 AM – 10:00 PM</p>
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
