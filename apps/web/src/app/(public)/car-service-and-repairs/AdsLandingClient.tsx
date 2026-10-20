'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_SERVICES } from '@/lib/services/catalog';
import { ADS_LP_FAQS } from './faqs';
import { getLeadSourceFromUtm, parseUtmParams, type UtmParams } from '@/lib/utm';
import {
  Shield,
  Clock,
  Star,
  Phone,
  Wrench,
  Camera,
  BadgeCheck,
  Truck,
  Quote,
  ChevronDown,
  CheckCircle2,
  Loader2,
  MapPin,
} from 'lucide-react';

const PHONE_TEL = '+919152307030';
const PHONE_LABEL = '91523 07030';

const CITIES = ['Mumbai', 'Thane', 'Navi Mumbai'];

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

function WhatsAppUpdateShot() {
  return (
    <div className="mx-auto flex h-[560px] w-full max-w-[280px] flex-col overflow-hidden rounded-[1.6rem] bg-[#0b141a] shadow-xl ring-1 ring-black/10">
      <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2.5 text-white">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-[#075e54]">
          MF
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">MY FNG</p>
          <p className="text-[10px] text-white/80">online</p>
        </div>
      </div>
      <div
        className="flex min-h-0 flex-1 flex-col space-y-2 bg-[#efeae2] px-2.5 py-3"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,.35) 0 1px, transparent 1px), radial-gradient(circle at 80% 60%, rgba(0,0,0,.04) 0 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-2 py-1.5 shadow-sm">
          <p className="text-[12px] leading-4 text-[#111b21]">Car received at the workshop. Sharing live photos of the job.</p>
          <p className="mt-0.5 text-right text-[10px] text-[#667781]">11:42 am</p>
        </div>
        <div className="ml-auto max-w-[92%] overflow-hidden rounded-lg rounded-tr-none bg-[#d9fdd3] shadow-sm">
          <img
            src="/media/workshop-covers/source-actual-workshop.webp"
            alt="Workshop photo sent on WhatsApp"
            className="h-[7.25rem] w-full object-cover"
          />
          <div className="px-2 py-1.5">
            <p className="text-[12px] leading-4 text-[#111b21]">Bonnet open. Inspection started.</p>
            <p className="text-right text-[10px] text-[#667781]">11:43 am</p>
          </div>
        </div>
        <div className="ml-auto max-w-[92%] overflow-hidden rounded-lg rounded-tr-none bg-[#d9fdd3] shadow-sm">
          <div className="relative">
            <img
              src="/media/Service_image_public/MyFNG_Car_Engine_Service.webp"
              alt="Job video thumbnail sent on WhatsApp"
              className="h-[7.25rem] w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-[#075e54]">
                <span className="ml-0.5 border-y-[7px] border-l-[12px] border-y-transparent border-l-[#075e54]" />
              </span>
            </div>
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              0:18
            </span>
          </div>
          <div className="px-2 py-1.5">
            <p className="text-[12px] leading-4 text-[#111b21]">Video of the engine bay after the service.</p>
            <p className="text-right text-[10px] text-[#667781]">11:46 am</p>
          </div>
        </div>
        <div className="max-w-[88%] rounded-lg rounded-tl-none bg-white px-2 py-1.5 shadow-sm">
          <p className="text-[12px] leading-4 text-[#111b21]">Seen. Go ahead.</p>
          <p className="mt-0.5 text-right text-[10px] text-[#667781]">11:47 am</p>
        </div>
      </div>
    </div>
  );
}

function WhatsAppApprovalShot() {
  return (
    <div className="mx-auto flex h-[560px] w-full max-w-[280px] flex-col overflow-hidden rounded-[1.6rem] bg-[#0b141a] shadow-xl ring-1 ring-black/10">
      <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2.5 text-white">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-[#075e54]">
          MF
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">MY FNG</p>
          <p className="text-[10px] text-white/80">online</p>
        </div>
      </div>
      <div
        className="flex min-h-0 flex-1 flex-col space-y-2 bg-[#efeae2] px-2.5 py-3"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,.35) 0 1px, transparent 1px), radial-gradient(circle at 80% 60%, rgba(0,0,0,.04) 0 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-2 py-1.5 shadow-sm">
          <p className="text-[12px] leading-4 text-[#111b21]">Inspection done. Front brake pads need replacement. Need your approval before we start.</p>
          <p className="mt-0.5 text-right text-[10px] text-[#667781]">12:18 pm</p>
        </div>
        <div className="ml-auto max-w-[92%] overflow-hidden rounded-lg rounded-tr-none bg-[#d9fdd3] shadow-sm">
          <img
            src="/media/ads/brake-pads-photo.jpg"
            alt="Worn brake pads compared with a new pad, sent for customer approval"
            className="h-56 w-full object-cover object-[center_42%]"
          />
          <div className="px-2 py-1.5">
            <p className="text-[12px] leading-4 text-[#111b21]">Photo of the worn pads. Extra work starts only if you approve.</p>
            <p className="text-right text-[10px] text-[#667781]">12:19 pm</p>
          </div>
        </div>
        <div className="max-w-[88%] rounded-lg rounded-tl-none bg-white px-2 py-1.5 shadow-sm">
          <p className="text-[12px] font-semibold leading-4 text-[#111b21]">Approved. Go ahead.</p>
          <p className="mt-0.5 text-right text-[10px] text-[#667781]">12:21 pm</p>
        </div>
        <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-2 py-1.5 shadow-sm">
          <p className="text-[12px] leading-4 text-[#111b21]">Approved. Starting the extra work now.</p>
          <p className="mt-0.5 text-right text-[10px] text-[#667781]">12:22 pm</p>
        </div>
      </div>
    </div>
  );
}

/** Current URL UTMs win. This page never reuses an older blog/session campaign. */
function utmForThisPage(): UtmParams {
  const fromUrl = typeof window === 'undefined' ? {} : parseUtmParams(window.location.search);
  return {
    utm_source: 'website',
    utm_medium: 'landing',
    utm_campaign: 'car-service-and-repairs',
    utm_content: 'book-form',
    utm_term: 'car service and repairs',
    ...fromUrl,
  };
}

const USPS = [
  {
    icon: Shield,
    title: 'Verified workshops',
    desc: 'Audited multi-brand garages. Your car is not handed to a random mechanic.',
  },
  {
    icon: BadgeCheck,
    title: 'Prices after OTP',
    desc: 'We do not quote a random price here. After OTP you get a link for your car and pincode.',
  },
  {
    icon: Truck,
    title: 'Free pickup & drop',
    desc: 'We collect the car from your home or office and bring it back.',
  },
  {
    icon: Camera,
    title: 'Photo updates',
    desc: 'Live photos and videos on WhatsApp while the repair is on.',
  },
  {
    icon: Wrench,
    title: 'OEM / OES parts',
    desc: 'Genuine or OEM-recommended parts, not cheap duplicates.',
  },
  {
    icon: Clock,
    title: 'Warranty included',
    desc: 'Labour and parts warranty after periodic service and repairs.',
  },
];

const STEPS = [
  { n: '1', title: 'Fill this form', desc: 'Name, phone, car and the job you need. It stays on this page.' },
  { n: '2', title: 'We call you', desc: 'A MYFNG advisor confirms the slot, estimate and pickup time.' },
  { n: '3', title: 'Free pickup', desc: 'The car is collected, serviced at a verified workshop, and returned.' },
  { n: '4', title: 'Updates + warranty', desc: 'Photos of the job, then delivery with labour and parts warranty.' },
];

const REVIEWS = [
  {
    name: 'Nikhil Sawant',
    location: 'Thane',
    vehicle: 'Honda City',
    text: 'Pickup was on time and the bill matched what they told me on the call. No extra amount at the end.',
  },
  {
    name: 'Rutuja Patil',
    location: 'Navi Mumbai',
    vehicle: 'Maruti Swift',
    text: 'AC was not cooling. They booked a workshop the same day and sent photos of the job.',
  },
  {
    name: 'Imran Shaikh',
    location: 'Mumbai',
    vehicle: 'Hyundai Creta',
    text: 'Brake work was done with the parts they had listed. The car came back the same evening.',
  },
  {
    name: 'Ketan Deshmukh',
    location: 'Thane',
    vehicle: 'Tata Nexon',
    text: 'Periodic service was straightforward. Warranty card was shared after delivery.',
  },
];

function ReviewCarousel() {
  const scroller = useRef<HTMLDivElement>(null);
  const paused = useRef(false);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const timer = window.setInterval(() => {
      if (paused.current) return;
      const card = el.querySelector<HTMLElement>('[data-review]');
      const step = (card?.offsetWidth || el.clientWidth) + 8;
      const max = el.scrollWidth - el.clientWidth - 4;
      el.scrollTo({ left: el.scrollLeft >= max ? 0 : el.scrollLeft + step, behavior: 'smooth' });
    }, 2800);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      ref={scroller}
      onPointerDown={() => {
        paused.current = true;
      }}
      onPointerUp={() => {
        paused.current = false;
      }}
      onPointerCancel={() => {
        paused.current = false;
      }}
      className="mt-3 flex w-full min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {REVIEWS.map((review) => (
        <blockquote
          key={review.name}
          data-review
          className="w-[calc(50%-4px)] shrink-0 snap-start rounded-2xl bg-white p-3 shadow-sm ring-1 ring-blue-100"
        >
          <div className="flex items-center justify-between">
            <Quote className="h-4 w-4 text-blue-500" />
            <div className="flex text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-amber-400" />
              ))}
            </div>
          </div>
          <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-700">{review.text}</p>
          <footer className="mt-2 text-sm font-bold text-slate-950">
            {review.name}
            <span className="mt-0.5 block text-[11px] font-medium text-slate-500">
              {review.vehicle} · {review.location}
            </span>
          </footer>
        </blockquote>
      ))}
    </div>
  );
}

const TRUST = [
  { k: '100+', v: 'Workshops' },
  { k: '10,000+', v: 'Customers' },
  { k: '4.8★', v: 'Rated' },
  { k: 'Same day', v: 'Most services' },
];

function digitsOnly(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('91')) return digits.slice(-10);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits.slice(0, 10);
}

function scrollToBook() {
  document.getElementById('book-service')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function AdsLandingClient() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [carQuery, setCarQuery] = useState('');
  const [carHits, setCarHits] = useState<CarHit[]>([]);
  const [carModel, setCarModel] = useState('');
  const [carModelId, setCarModelId] = useState('');
  const [city, setCity] = useState('');
  const [service, setService] = useState(DEFAULT_SERVICES[0]?.title || 'Periodic Car Service');
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
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [highlight, setHighlight] = useState(false);

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
          metadata: { source: 'car-service-and-repairs' },
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
          source: 'car-service-and-repairs',
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

  function focusBook(next?: { service?: string; city?: string }) {
    if (next?.service) setService(next.service);
    if (next?.city) setCity(next.city);
    setHighlight(true);
    window.setTimeout(() => setHighlight(false), 900);
    scrollToBook();
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
      const pickupLabel = isPickup ? `Pickup · pincode ${pincode}` : `Workshop visit · ${visitDate} ${visitTime}`;
      const summary = `${service} · ${carModel} · ${city} · ${pickupLabel}`;

      void fetch('/api/public/dpdp/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'car-service-and-repairs',
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
          page: '/car-service-and-repairs',
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
            address: isPickup ? `Pincode ${pincode}, ${city}` : city,
            customer_address: isPickup ? `Pincode ${pincode}, ${city}` : city,
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
              page: '/car-service-and-repairs',
              service,
              city,
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
          booking_step: 'ads_sidebar',
          page_path: '/car-service-and-repairs',
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
    <div className="min-h-screen bg-[#e7f2ff] text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <img src="/logo.png" alt="MYFNG" className="h-10 w-auto sm:h-12" />
          <a
            href={`tel:${PHONE_TEL}`}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-bold text-white"
          >
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">Call</span> {PHONE_LABEL}
          </a>
        </div>
      </header>

      <main className="mx-auto grid min-w-0 max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8 lg:py-8">
        <section className="min-w-0 overflow-x-hidden lg:col-start-1 lg:row-start-1">
          <p className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-800">
            Mumbai · Thane · Navi Mumbai
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-slate-950 sm:text-4xl lg:text-[2.6rem]">
            Car Service and Repairs Near You
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
            Book a verified MYFNG workshop from this page. Transparent estimate, free pickup and drop, photo updates, and warranty on the job.
          </p>
          <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2">
            {[
              ['Same Day Service'],
              ['Warranty on Service'],
              ['Free doorstep pickup', '& drop'],
              ['Genuine OEM / OES parts'],
            ].map((lines) => (
              <li key={lines.join(' ')} className="flex min-w-0 items-start gap-1.5 text-[13px] font-semibold leading-5 text-slate-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>
                  {lines.map((line) => (
                    <span key={line} className={lines.length > 1 ? 'block whitespace-nowrap' : undefined}>
                      {line}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TRUST.map((item) => (
              <div key={item.v} className="rounded-2xl bg-white px-2 py-3 text-center shadow-sm ring-1 ring-slate-200">
                <p className="text-sm font-extrabold text-blue-800 sm:text-base">{item.k}</p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-xs">{item.v}</p>
              </div>
            ))}
          </div>
        </section>

        <aside
          id="book-service"
          className={`scroll-mt-24 lg:sticky lg:top-20 lg:z-30 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto ${
            highlight ? 'rounded-3xl ring-2 ring-blue-500 ring-offset-2 ring-offset-[#e7f2ff]' : ''
          }`}
        >
          <div className="overflow-hidden rounded-3xl bg-white shadow-xl ring-2 ring-blue-600">
            <div className="bg-slate-950 px-4 py-3 text-white">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300">Book on this page</p>
              <h2 className="text-lg font-extrabold leading-tight text-white" style={{ color: '#ffffff' }}>Book car service</h2>
              <p className="text-xs text-slate-300">We call you to confirm. Nothing opens on another page.</p>
            </div>

            {done ? (
              <div className="px-5 py-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-lg font-extrabold text-slate-950">Booking received</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Our team will call you on <span className="font-bold text-slate-900">{phone}</span> to confirm {service.toLowerCase()} in {city}.
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
                      <button type="button" onClick={() => { otpSendLock.current = ''; void sendOtp(phone); }} className="ml-1 font-bold text-blue-700">
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
                      {CITIES.map((item) => (
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
        </aside>

        <div className="min-w-0 space-y-5 overflow-x-hidden pb-8 lg:col-start-1 lg:row-start-2">
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <img
              src="/media/workshop-covers/source-actual-workshop.webp"
              alt="MYFNG multi-brand car workshop"
              className="h-44 w-full object-cover sm:h-52"
            />
            <div className="p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">How booking works</p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-950">Four steps. One form.</h2>
              <ol className="mt-3 grid grid-cols-2 gap-2">
                {STEPS.map((step) => (
                  <li key={step.n} className="rounded-2xl bg-blue-50 p-2.5">
                    <p className="text-[11px] font-extrabold text-blue-700">Step {step.n}</p>
                    <p className="mt-1 text-sm font-bold leading-5 text-slate-900">{step.title}</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-600">{step.desc}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-extrabold text-slate-950">Why car owners book MYFNG</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {USPS.map((usp) => {
                const Icon = usp.icon;
                return (
                  <article key={usp.title} className="rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-blue-100">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <h3 className="text-[13px] font-bold leading-4 text-slate-950">{usp.title}</h3>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-4 text-slate-600">{usp.desc}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="grid items-start gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#075e54]">On WhatsApp</p>
                <h2 className="mt-1 text-xl font-extrabold text-slate-950">Live photos and videos of your car</h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  While the job is on, MYFNG sends workshop photos and a short video on WhatsApp. You see the work before anything extra starts.
                </p>
                <div className="mt-3">
                  <WhatsAppUpdateShot />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#075e54]">On WhatsApp</p>
                <h2 className="mt-1 text-xl font-extrabold text-slate-950">Extra work only after you approve</h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  If the workshop finds extra work, they send the photo on WhatsApp. Nothing extra starts until you reply Approved.
                </p>
                <div className="mt-3">
                  <WhatsAppApprovalShot />
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-950">Pick a service</h2>
                <p className="mt-1 text-sm text-slate-600">Tap a job. It fills the booking form on this page.</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {DEFAULT_SERVICES.map((item) => {
                const active = service === item.title;
                return (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => focusBook({ service: item.title })}
                    className={`flex min-w-0 flex-col items-center gap-1.5 rounded-2xl bg-white px-1.5 py-3 text-center ring-1 transition ${
                      active ? 'ring-2 ring-blue-600' : 'ring-blue-100'
                    }`}
                  >
                    <img src={item.iconImage || item.image} alt="" className="h-10 w-10 object-contain" />
                    <span className="line-clamp-2 text-[11px] font-bold leading-4 text-slate-900">{item.title}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-extrabold text-slate-950">Customer reviews</h2>
            <ReviewCarousel />
          </section>

          <section>
            <h2 className="text-2xl font-extrabold text-slate-950">Car service near you</h2>
            <p className="mt-1 text-sm text-slate-600">Choose your area. It is added to the booking form.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CITIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => focusBook({ city: item })}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold ${
                    city === item ? 'bg-blue-600 text-white' : 'bg-white text-blue-800 ring-1 ring-blue-200'
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {item}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-extrabold text-slate-950">Car service and repairs FAQs</h2>
            <div className="mt-3 space-y-2">
              {ADS_LP_FAQS.map((faq, idx) => {
                const open = openFaq === idx;
                return (
                  <div key={faq.question} className="rounded-2xl bg-white ring-1 ring-slate-200">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      onClick={() => setOpenFaq(open ? null : idx)}
                    >
                      <span className="text-sm font-bold text-slate-950">{faq.question}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open ? <p className="px-4 pb-4 text-sm leading-6 text-slate-600">{faq.answer}</p> : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl bg-slate-950 px-5 py-6 text-white">
            <h2 className="text-xl font-extrabold text-white" style={{ color: '#ffffff' }}>Ready to book car service?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              The form is on this page. Or call {PHONE_LABEL} and we will book it for you.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => focusBook()}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-bold"
              >
                Go to booking form
              </button>
              <a
                href={`tel:${PHONE_TEL}`}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-slate-950"
              >
                Call now
              </a>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} MYFNG · Car service and repairs</p>
          <p>
            <a href="/privacy-notice" className="font-semibold text-blue-700 underline">
              Privacy Notice
            </a>
            <span className="mx-2">·</span>
            <a href={`tel:${PHONE_TEL}`} className="font-semibold text-slate-800">
              {PHONE_LABEL}
            </a>
          </p>
        </div>
      </footer>

      <div className="h-16 lg:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <a href={`tel:${PHONE_TEL}`} className="flex h-14 items-center justify-center gap-2 bg-slate-950 text-sm font-bold text-white">
          <Phone className="h-4 w-4" /> Call
        </a>
        <button type="button" onClick={() => focusBook()} className="flex h-14 items-center justify-center bg-blue-600 text-sm font-bold text-white">
          Book service
        </button>
      </div>
    </div>
  );
}
