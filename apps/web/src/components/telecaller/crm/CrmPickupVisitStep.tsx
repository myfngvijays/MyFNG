'use client';

import { useEffect, useMemo, useState } from 'react';
import { Briefcase, Calendar, Home, Loader2, MapPin, Navigation } from 'lucide-react';

export type CrmPickupVisitValue = {
  pickup_required: boolean;
  vehicle_number: string;
  pickup_date: string;
  pickup_time: string;
  pickup_address: string;
  address_type: 'home' | 'work' | 'other';
  flat_number: string;
  landmark: string;
  workshop_id: string;
  workshop_name?: string;
};

const TIME_SLOTS = Array.from({ length: 9 }, (_, i) => {
  const hour = 9 + i;
  const time24 = `${String(hour).padStart(2, '0')}:00`;
  const nextHour = hour + 1;
  const startH = hour === 12 ? 12 : hour > 12 ? hour - 12 : hour;
  const startSuffix = hour >= 12 ? 'PM' : 'AM';
  const endH = nextHour === 12 ? 12 : nextHour > 12 ? nextHour - 12 : nextHour;
  const endSuffix = nextHour >= 12 ? 'PM' : 'AM';
  return {
    value: time24,
    label: `${startH} ${startSuffix} - ${endH} ${endSuffix}`,
  };
});

const ADDR_TYPES = [
  { key: 'home' as const, label: 'Home', icon: Home },
  { key: 'work' as const, label: 'Work', icon: Briefcase },
  { key: 'other' as const, label: 'Other', icon: MapPin },
];

function getIndiaDate(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 3600000);
}

function formatDateYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDMShort(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const dt = new Date(`${dateStr}T00:00:00`);
    return `${dt.getDate()} ${dt.toLocaleString('en-US', { month: 'short' })}`;
  } catch {
    return dateStr;
  }
}

function getIndiaNowMinutes(): number {
  const d = getIndiaDate();
  return d.getHours() * 60 + d.getMinutes();
}

function isTimeSlotPastForDate(slotValue: string, pickupDate: string, todayYmd: string): boolean {
  if (!pickupDate || pickupDate !== todayYmd) return false;
  const hour = Number(String(slotValue).split(':')[0]);
  if (!Number.isFinite(hour)) return false;
  return getIndiaNowMinutes() >= (hour + 1) * 60;
}

type Props = {
  value: CrmPickupVisitValue;
  onChange: (patch: Partial<CrmPickupVisitValue>) => void;
  city?: string;
  cityId?: string;
  pincode?: string;
  forcePickup?: boolean;
  quoteTotal?: number;
};

export default function CrmPickupVisitStep({
  value,
  onChange,
  city,
  cityId,
  pincode = '',
  forcePickup = false,
  quoteTotal,
}: Props) {
  const pickupRequired = forcePickup ? true : value.pickup_required;
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [loadingWs, setLoadingWs] = useState(false);

  const todayStr = formatDateYMD(getIndiaDate());
  const tomorrow = new Date(getIndiaDate());
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateYMD(tomorrow);

  const slots = TIME_SLOTS;
  const todayClosed = !slots.some((s) => !isTimeSlotPastForDate(s.value, todayStr, todayStr));

  const dateOptions = useMemo(() => {
    if (todayClosed) {
      return [{ key: 'tomorrow', dateStr: tomorrowStr, label: `Tomorrow, ${formatDateDMShort(tomorrowStr)}` }];
    }
    return [
      { key: 'today', dateStr: todayStr, label: `Today, ${formatDateDMShort(todayStr)}` },
      { key: 'tomorrow', dateStr: tomorrowStr, label: `Tomorrow, ${formatDateDMShort(tomorrowStr)}` },
    ];
  }, [todayClosed, todayStr, tomorrowStr]);

  useEffect(() => {
    if (forcePickup && !value.pickup_required) {
      onChange({ pickup_required: true, workshop_id: '', workshop_name: '' });
    }
  }, [forcePickup, value.pickup_required, onChange]);

  useEffect(() => {
    if (pickupRequired) return;
    let cancelled = false;
    (async () => {
      setLoadingWs(true);
      try {
        const params = new URLSearchParams();
        const pin = String(pincode || '').trim();
        if (pin) params.set('pincode', pin);
        if (city) params.set('city', city);
        if (cityId) params.set('city_id', cityId);

        const res = await fetch(`/api/telecaller/crm/workshops?${params.toString()}`);
        const json = await res.json().catch(() => ({}));
        const list = Array.isArray(json?.workshops) ? json.workshops : [];
        if (!cancelled) setWorkshops(list);
      } catch {
        if (!cancelled) setWorkshops([]);
      } finally {
        if (!cancelled) setLoadingWs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickupRequired, city, cityId, pincode]);

  const setMode = (pickup: boolean) => {
    if (forcePickup && !pickup) return;
    onChange({
      pickup_required: pickup,
      ...(pickup
        ? { workshop_id: '', workshop_name: '' }
        : { pickup_address: '', flat_number: '', landmark: '' }),
    });
  };

  return (
    <div>
      <h3 className="text-base font-extrabold text-gray-900">Pickup Details</h3>
      <p className="mt-1 text-sm text-gray-500">Choose doorstep pickup or visit a workshop.</p>

      {!forcePickup ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-bold text-gray-800">Service Preference *</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode(true)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-bold transition ${
                pickupRequired
                  ? 'border-[#004AAD] bg-[#004AAD] text-white'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-[#004AAD]/40'
              }`}
            >
              <Navigation className="h-4 w-4" />
              Doorstep Pickup
            </button>
            <button
              type="button"
              onClick={() => setMode(false)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-bold transition ${
                !pickupRequired
                  ? 'border-[#023D95] bg-[#023D95] text-white'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-[#023D95]/40'
              }`}
            >
              <MapPin className="h-4 w-4" />
              Visit Workshop
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-[#004AAD]/10 px-4 py-3 text-sm font-semibold text-[#004AAD]">
          Home service — doorstep pickup is required.
        </div>
      )}

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="mb-2 block text-sm font-bold text-gray-800">Vehicle Number *</label>
        <input
          type="text"
          value={value.vehicle_number}
          onChange={(e) =>
            onChange({
              vehicle_number: e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12),
            })
          }
          placeholder="e.g. MH01BJ7842"
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold uppercase tracking-wider text-gray-900 focus:border-[#004AAD] focus:outline-none focus:ring-2 focus:ring-[#004AAD]/20"
        />
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="mb-2 block text-sm font-bold text-gray-800">
          {pickupRequired ? 'Pickup Date *' : 'Visit Date *'}
        </label>
        <div className="flex flex-wrap gap-2">
          {dateOptions.map((opt) => {
            const active = value.pickup_date === opt.dateStr;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onChange({ pickup_date: opt.dateStr, pickup_time: '' })}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  active
                    ? 'border-[#004AAD] bg-[#004AAD] text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-[#004AAD]/40'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
          <label className="relative inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 hover:border-[#004AAD]/40">
            <Calendar className="h-3.5 w-3.5" />
            <input
              type="date"
              value={value.pickup_date}
              min={todayClosed ? tomorrowStr : todayStr}
              onChange={(e) => onChange({ pickup_date: e.target.value, pickup_time: '' })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            Pick date
          </label>
        </div>
        {value.pickup_date ? (
          <p className="mt-2 text-xs text-gray-500">Selected: {formatDateDMShort(value.pickup_date)}</p>
        ) : null}
      </div>

      {value.pickup_date ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <label className="mb-2 block text-sm font-bold text-gray-800">
            {pickupRequired ? 'Pickup Time *' : 'Visit Time *'}
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {slots.map((slot) => {
              const past = isTimeSlotPastForDate(slot.value, value.pickup_date, todayStr);
              const active = value.pickup_time === slot.value;
              return (
                <button
                  key={slot.value}
                  type="button"
                  disabled={past}
                  onClick={() => onChange({ pickup_time: slot.value })}
                  className={`rounded-xl border px-2 py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    active
                      ? 'border-[#004AAD] bg-[#004AAD] text-white'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-[#004AAD]/40'
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {pickupRequired ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap gap-2">
            {ADDR_TYPES.map(({ key, label, icon: Icon }) => {
              const active = (value.address_type || 'home') === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange({ address_type: key })}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    active
                      ? 'border-[#004AAD] bg-[#004AAD] text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-[#004AAD]/40'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>

          <label className="mb-2 block text-sm font-bold text-gray-800">
            Address * <span className="text-xs font-normal text-gray-500">(PIN {pincode || '—'})</span>
          </label>
          <textarea
            value={value.pickup_address}
            onChange={(e) => onChange({ pickup_address: e.target.value })}
            rows={3}
            placeholder="Area, street, locality"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-[#004AAD] focus:outline-none focus:ring-2 focus:ring-[#004AAD]/20"
          />

          {value.pickup_address.trim() ? (
            <>
              <label className="mb-2 mt-3 block text-sm font-bold text-gray-800">
                Flat / House Number <span className="text-xs font-normal text-gray-500">(Optional)</span>
              </label>
              <input
                type="text"
                value={value.flat_number}
                onChange={(e) => onChange({ flat_number: e.target.value })}
                placeholder="e.g. Flat 201, House No. 123"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-[#004AAD] focus:outline-none focus:ring-2 focus:ring-[#004AAD]/20"
              />

              <label className="mb-2 mt-3 block text-sm font-bold text-gray-800">
                Landmark * <span className="text-xs font-normal text-red-500">(Required)</span>
              </label>
              <input
                type="text"
                value={value.landmark}
                onChange={(e) => onChange({ landmark: e.target.value })}
                placeholder="e.g. Near ABC Mall, Behind XYZ Bank"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-[#004AAD] focus:outline-none focus:ring-2 focus:ring-[#004AAD]/20"
              />
            </>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-bold text-gray-800">Nearby Workshops</p>
          {!/^\d{6}$/.test(String(pincode || '').trim()) ? (
            <p className="text-sm text-gray-500">
              Enter a 6-digit pincode in customer details to find nearby workshops.
            </p>
          ) : loadingWs ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-[#004AAD]" />
            </div>
          ) : workshops.length === 0 ? (
            <p className="text-sm text-gray-500">
              No workshops near PIN {pincode}. You can still continue and assign later.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-gray-500">Showing workshops for PIN {pincode}</p>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {workshops.map((w) => {
                  const active = value.workshop_id === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => onChange({ workshop_id: w.id, workshop_name: w.name })}
                      className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                        active
                          ? 'border-[#004AAD] bg-[#004AAD]/5'
                          : 'border-gray-200 hover:border-[#004AAD]/40'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900">{w.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {[w.address, w.city || city, w.pincode].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div
                        className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${
                          active ? 'border-[#004AAD] bg-[#004AAD]' : 'border-gray-300'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {quoteTotal != null && quoteTotal > 0 ? (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-[#004AAD]/10 px-4 py-3">
          <span className="text-sm font-semibold text-gray-600">Estimated total</span>
          <span className="text-lg font-extrabold text-[#004AAD]">
            ₹{Math.round(quoteTotal).toLocaleString('en-IN')}
          </span>
        </div>
      ) : null}
    </div>
  );
}
