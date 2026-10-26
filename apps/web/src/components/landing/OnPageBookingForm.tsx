'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Phone } from 'lucide-react';
import { DEFAULT_SERVICES } from '@/lib/services/catalog';
import { getLeadSourceFromUtm, parseUtmParams, type UtmParams } from '@/lib/utm';

const PHONE_TEL = '+919152307030';
const PHONE_LABEL = '91523 07030';

const VISIT_SLOTS = Array.from({ length: 6 }, (_, i) => {
  const hour = 10 + i;
  const value = `${String(hour).padStart(2, '0')}:00`;
  const labelHour = hour > 12 ? hour - 12 : hour;
  const next = hour + 1;
  const nextLabel = next > 12 ? next - 12 : next;
  const startPeriod = hour >= 12 ? 'PM' : 'AM';
  const endPeriod = next >= 12 ? 'PM' : 'AM';
  return { value, label: `${labelHour}:00 ${startPeriod} – ${nextLabel}:00 ${endPeriod}` };
});

type CarHit = { id: string; make: string; model?: string; model_name?: string; variant?: string | null };

function carLabel(car: CarHit) {
  return `${car.make} ${car.model || car.model_name || ''}`.replace(/\s+/g, ' ').trim();
}

function digitsOnly(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('91')) return digits.slice(-10);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits.slice(0, 10);
}

export type OnPageBookingFormHandle = {
  focus: (next?: { service?: string; city?: string }) => void;
};

type Props = {
  page: string;
  source: string;
  campaign: string;
  term: string;
  cities?: string[];
  defaultCity?: string;
  defaultService?: string;
  areaName?: string;
  stickyClassName?: string;
  onState?: (state: { city: string; service: string }) => void;
};

const OnPageBookingForm = forwardRef<OnPageBookingFormHandle, Props>(function OnPageBookingForm(
  {
    page,
    source,
    campaign,
    term,
    cities = ['Mumbai', 'Thane', 'Navi Mumbai'],
    defaultCity = '',
    defaultService = DEFAULT_SERVICES[0]?.title || 'Periodic Car Service',
    areaName,
    stickyClassName = '',
    onState,
  },
  ref,
) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [carQuery, setCarQuery] = useState('');
  const [carHits, setCarHits] = useState<CarHit[]>([]);
  const [carModel, setCarModel] = useState('');
  const [carModelId, setCarModelId] = useState('');
  const [city, setCity] = useState(defaultCity);
  const [service, setService] = useState(defaultService);
  const [visitMode, setVisitMode] = useState<'pickup' | 'visit'>('pickup');
  const [pincode, setPincode] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [visitTime, setVisitTime] = useState('');
  const [consent, setConsent] = useState(true);
  const [otpChannelLabel, setOtpChannelLabel] = useState('');
  const otpSendLock = useRef('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [pricingUrl, setPricingUrl] = useState('');
  const [pricingLoading, setPricingLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [highlight, setHighlight] = useState(false);

  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  useEffect(() => {
    onStateRef.current?.({ city, service });
  }, [city, service]);

  useImperativeHandle(ref, () => ({
    focus(next) {
      if (next?.service) setService(next.service);
      if (next?.city) setCity(next.city);
      setHighlight(true);
      window.setTimeout(() => setHighlight(false), 900);
      document.getElementById('book-service')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  }));

  useEffect(() => {
    if (otpTimer <= 0) return;
    const timer = window.setTimeout(() => setOtpTimer((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [otpTimer]);

  useEffect(() => {
    const q = carQuery.trim();
    if (q.length < 2 || (carModel && q === carModel)) {
      setCarHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      fetch(`/api/car-models/search?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((json) => setCarHits(Array.isArray(json?.models) ? json.models : []))
        .catch(() => setCarHits([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [carQuery, carModel]);

  useEffect(() => {
    if (visitMode !== 'pickup' || !otpVerified || !carModel || !/^\d{6}$/.test(pincode)) {
      setPricingUrl('');
      return;
    }
    let cancelled = false;
    setPricingLoading(true);
    fetch('/api/public/ads-pricing-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        carModel,
        pincode,
        city,
        customerName: name.trim(),
      }),
    })
      .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (cancelled) return;
        setPricingUrl(ok && json?.url ? String(json.url) : '');
      })
      .catch(() => {
        if (!cancelled) setPricingUrl('');
      })
      .finally(() => {
        if (!cancelled) setPricingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visitMode, otpVerified, carModel, pincode, phone, city, name]);

  function onPhoneChange(value: string) {
    const next = digitsOnly(value);
    if (next !== phone) {
      setOtpSent(false);
      setOtpCode('');
      setOtpVerified(false);
      setOtpChannelLabel('');
      setPricingUrl('');
      if (next.length < 10) otpSendLock.current = '';
    }
    setPhone(next);
  }

  async function sendOtp(targetPhone = phone) {
    if (!/^[6-9]\d{9}$/.test(targetPhone)) return;
    setError('');
    setOtpLoading(true);
    try {
      const res = await fetch('/api/booking/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: targetPhone,
          channel: 'SMS',
          fallbackWhatsapp: true,
          metadata: { source },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not send OTP.');
      const onWhatsapp = String(json.channel || '').toUpperCase() === 'WHATSAPP';
      setOtpChannelLabel(onWhatsapp ? 'OTP sent on WhatsApp' : 'OTP sent by SMS');
      setOtpSent(true);
      setOtpVerified(false);
      setOtpCode('');
      setOtpTimer(30);
    } catch (err) {
      otpSendLock.current = '';
      setError(err instanceof Error ? err.message : 'Could not send OTP.');
    } finally {
      setOtpLoading(false);
    }
  }

  useEffect(() => {
    if (!/^[6-9]\d{9}$/.test(phone)) return;
    if (otpSendLock.current === phone) return;
    otpSendLock.current = phone;
    void sendOtp(phone);
    // Auto-send once when a full mobile number is entered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  async function verifyOtp() {
    setError('');
    if (!/^\d{6}$/.test(otpCode)) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch('/api/booking/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          otp: otpCode,
          source,
          channel: 'WEB',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.verified) throw new Error(json?.error || 'Invalid or expired OTP.');
      setOtpVerified(true);
    } catch (err) {
      setOtpVerified(false);
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setOtpLoading(false);
    }
  }

  function inboundUtm(): UtmParams {
    return typeof window === 'undefined' ? {} : parseUtmParams(window.location.search);
  }

  function utmForThisPage(): UtmParams {
    const fromUrl = inboundUtm();
    return {
      utm_source: fromUrl.utm_source || 'website',
      utm_medium: fromUrl.utm_medium || 'landing',
      utm_campaign: campaign,
      utm_content: page,
      utm_term: term,
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const customerName = name.trim();
    const customerPhone = digitsOnly(phone);
    const vehicleNumber = vehicle.trim().toUpperCase();
    if (customerName.length < 2) {
      setError('Enter your name.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(customerPhone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (!otpVerified) {
      setError('Verify the OTP before you submit.');
      return;
    }
    if (!carModel) {
      setError('Select your car.');
      return;
    }
    if (vehicleNumber.length < 4) {
      setError('Enter your vehicle number.');
      return;
    }
    if (!city) {
      setError('Select your city.');
      return;
    }
    if (!service) {
      setError('Select a service.');
      return;
    }
    if (visitMode === 'pickup' && !/^\d{6}$/.test(pincode)) {
      setError('Enter a 6-digit pincode.');
      return;
    }
    if (visitMode === 'visit' && (!visitDate || !visitTime)) {
      setError('Choose the date and time you will visit.');
      return;
    }
    if (!consent) {
      setError('Tick the consent box so we can call you about this booking.');
      return;
    }

    setSubmitting(true);
    try {
      const utmParams = utmForThisPage();
      const leadSource = getLeadSourceFromUtm(utmParams.utm_source, utmParams.utm_medium);
      const isPickup = visitMode === 'pickup';
      const [make, ...modelParts] = carModel.split(' ');
      const place = areaName && areaName !== city ? `${areaName}, ${city}` : city;
      const pickupLabel = isPickup ? `Pickup · pincode ${pincode}` : `Workshop visit · ${visitDate} ${visitTime}`;
      const summary = `${service} · ${carModel} · ${place} · ${pickupLabel}`;

      void fetch('/api/public/dpdp/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          subject_name: customerName,
          subject_phone: customerPhone,
          consents: [{ purpose: 'service', granted: true }],
        }),
      }).catch(() => undefined);

      const response = await fetch('/api/public/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          ignore_stored_utm: true,
          page,
          utm: utmParams,
          lead: {
            lead_number: `L-${Date.now().toString().slice(-8)}`,
            created_from: 'WEB',
            status: 'NEW',
            lead_type: 'CAR_SERVICE',
            lead_source: leadSource,
            customer_name: customerName,
            customer_phone: customerPhone,
            vehicle_number: vehicleNumber,
            vehicle_make: make || null,
            vehicle_model: modelParts.join(' ') || carModel,
            model_id: /^[0-9a-f-]{36}$/i.test(carModelId) ? carModelId : null,
            address: isPickup ? `Pincode ${pincode}, ${place}` : place,
            customer_address: isPickup ? `Pincode ${pincode}, ${place}` : place,
            pincode: isPickup ? pincode : null,
            city,
            pickup_required: isPickup,
            preferred_date: isPickup ? null : visitDate,
            preferred_time_slot: isPickup ? null : visitTime,
            preferred_slot_start: isPickup ? null : `${visitDate}T${visitTime}:00`,
            service_type: service.slice(0, 100),
            problem_description: summary,
            lead_priority: 'NORMAL',
            created_at: new Date().toISOString(),
            meta: {
              ...utmParams,
              page,
              inbound_utm: inboundUtm(),
              service,
              city,
              area: areaName || city,
              car_model: carModel,
              pincode: isPickup ? pincode : null,
              pickup_required: isPickup,
              visit_date: isPickup ? null : visitDate,
              visit_time: isPickup ? null : visitTime,
              pricing_url: pricingUrl || null,
            },
          },
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || 'Could not book. Please call us.');
      }

      if (typeof window !== 'undefined') {
        const w = window as Window & { dataLayer?: Array<Record<string, unknown>> };
        w.dataLayer = w.dataLayer || [];
        w.dataLayer.push({
          event: 'generate_lead',
          booking_step: page === '/car-service-and-repairs' ? 'ads_sidebar' : 'city_page',
          page_path: page,
          service,
          city,
          lead_source: leadSource,
        });
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not book. Please call us.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`${stickyClassName} ${highlight ? 'rounded-3xl ring-2 ring-blue-500 ring-offset-2 ring-offset-[#e7f2ff]' : ''}`}
    >
      <div className="overflow-hidden rounded-3xl bg-white shadow-xl ring-2 ring-blue-600">
        <div className="bg-slate-950 px-4 py-3 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300">Book on this page</p>
          <h2 className="text-lg font-extrabold leading-tight text-white" style={{ color: '#ffffff' }}>
            Book car service
          </h2>
          <p className="text-xs text-slate-300">We call you to confirm. Nothing opens on another page.</p>
        </div>

        {done ? (
          <div className="px-5 py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-extrabold text-slate-950">Booking received</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Our team will call you on <span className="font-bold text-slate-900">{phone}</span> to confirm {service.toLowerCase()} in {areaName || city}.
            </p>
            <a
              href={`tel:${PHONE_TEL}`}
              className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white"
            >
              <Phone className="h-4 w-4" /> Call {PHONE_LABEL}
            </a>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="pt-3">
            <div className="space-y-2 px-4 pb-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Your name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Rahul Sharma"
                  className="h-10 w-full rounded-xl border border-blue-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <div>
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Mobile number</span>
                <input
                  value={phone}
                  onChange={(e) => onPhoneChange(e.target.value)}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="10-digit mobile"
                  className="h-10 w-full rounded-xl border border-blue-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  {otpLoading
                    ? 'Sending OTP…'
                    : otpVerified
                      ? 'Mobile verified'
                      : otpChannelLabel
                        ? `${otpChannelLabel}${otpTimer > 0 ? ` · Resend in ${otpTimer}s` : ''}`
                        : 'OTP is sent when the number is complete. SMS first, then WhatsApp.'}
                  {otpSent && !otpVerified && otpTimer === 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        otpSendLock.current = '';
                        void sendOtp(phone);
                      }}
                      className="ml-1 font-bold text-blue-700"
                    >
                      Resend
                    </button>
                  ) : null}
                </p>
              </div>
              {otpSent && !otpVerified ? (
                <div>
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">OTP</span>
                  <div className="flex gap-2">
                    <input
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit OTP"
                      className="h-10 min-w-0 flex-1 rounded-xl border border-blue-200 px-3 text-sm tracking-[0.2em] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={verifyOtp}
                      disabled={otpLoading}
                      className="h-10 shrink-0 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {otpLoading ? 'Checking…' : 'Verify'}
                    </button>
                  </div>
                </div>
              ) : null}
              {otpVerified ? (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mobile verified. You can submit after the other details.
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <div className="relative min-w-0">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Car</span>
                  <input
                    value={carQuery}
                    onChange={(e) => {
                      setCarQuery(e.target.value);
                      setCarModel('');
                      setCarModelId('');
                      setPricingUrl('');
                    }}
                    placeholder="Swift, Creta"
                    className="h-10 w-full rounded-xl border border-blue-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  {carHits.length > 0 ? (
                    <ul className="absolute z-20 mt-1 max-h-40 w-64 overflow-y-auto rounded-xl border border-blue-200 bg-white shadow-lg">
                      {carHits.map((hit) => (
                        <li key={hit.id}>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                            onClick={() => {
                              const label = carLabel(hit);
                              setCarModel(label);
                              setCarModelId(String(hit.id));
                              setCarQuery(label);
                              setCarHits([]);
                            }}
                          >
                            {carLabel(hit)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <label className="block min-w-0">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Vehicle number</span>
                  <input
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value.toUpperCase())}
                    autoComplete="off"
                    placeholder="MH04 AB 1234"
                    className="h-10 w-full rounded-xl border border-blue-200 px-3 text-sm uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">City</span>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select city</option>
                    {cities.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Service</span>
                  <select
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className="h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {DEFAULT_SERVICES.map((item) => (
                      <option key={item.slug} value={item.title}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">How should we take the car?</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVisitMode('pickup')}
                    className={`h-10 rounded-xl text-xs font-bold ${visitMode === 'pickup' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                  >
                    Pickup
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisitMode('visit')}
                    className={`h-10 rounded-xl text-xs font-bold ${visitMode === 'visit' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                  >
                    I will visit
                  </button>
                </div>
              </div>
              {visitMode === 'pickup' ? (
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Pincode</span>
                  <input
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    placeholder="400601"
                    className="h-10 w-full rounded-xl border border-blue-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                    Pickup needs only the pincode. We will ask the full address on the call.
                  </span>
                </label>
              ) : null}
              {visitMode === 'visit' ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Visit date</span>
                    <input
                      type="date"
                      value={visitDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setVisitDate(e.target.value)}
                      className="h-10 w-full rounded-xl border border-blue-200 px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Visit time</span>
                    <select
                      value={visitTime}
                      onChange={(e) => setVisitTime(e.target.value)}
                      className="h-10 w-full rounded-xl border border-blue-200 bg-white px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select</option>
                      {VISIT_SLOTS.map((slot) => (
                        <option key={slot.value} value={slot.value}>
                          {slot.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              {visitMode === 'visit' ? (
                <p className="text-center text-[11px] font-medium text-slate-500">
                  Prices are not shown here. We share the estimate on the call.
                </p>
              ) : otpVerified && carModel && /^\d{6}$/.test(pincode) ? (
                pricingUrl ? (
                  <a
                    href={pricingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-sm font-bold text-blue-800"
                  >
                    Check prices for your car
                  </a>
                ) : (
                  <p className="text-center text-[11px] font-medium text-slate-500">
                    {pricingLoading ? 'Opening your price list…' : 'Price list will show here after OTP, car and pincode.'}
                  </p>
                )
              ) : (
                <p className="text-center text-[11px] font-medium text-slate-500">
                  Prices are not shown here. Verify OTP, then open the price list for your car.
                </p>
              )}
              <label className="flex items-start gap-2.5 text-xs leading-5 text-slate-600">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-blue-700"
                />
                <span>
                  I agree to be called about this booking.{' '}
                  <a href="/privacy-notice" className="whitespace-nowrap font-semibold text-blue-700 underline">
                    Privacy Notice
                  </a>
                </span>
              </label>
              {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
            </div>
            <button
              type="submit"
              disabled={submitting || !otpVerified}
              className="flex h-12 w-full items-center justify-center gap-2 bg-blue-600 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-600 disabled:text-white disabled:opacity-100"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? 'Booking…' : 'Book service'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
});

export default OnPageBookingForm;
