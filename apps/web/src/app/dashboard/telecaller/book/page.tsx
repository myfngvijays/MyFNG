'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import CrmCarSearch from '@/components/telecaller/crm/CrmCarSearch';
import CrmBookingCatalog, { type CrmCatalogSelection } from '@/components/telecaller/crm/CrmBookingCatalog';
import CrmPickupVisitStep from '@/components/telecaller/crm/CrmPickupVisitStep';
import { createClient } from '@/lib/supabase/client';
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  Diamond,
  Grid3X3,
  Loader2,
  Search,
  UserPlus,
  Wrench,
} from 'lucide-react';

const BOOKING_TYPES = [
  { id: 'PERIODIC', label: 'Periodic Service', icon: Wrench },
  { id: 'OTHER_SERVICES', label: 'Other Services', icon: Grid3X3 },
  { id: 'RSA', label: 'RSA', icon: AlertCircle },
  { id: 'MEMBERSHIP', label: 'Membership', icon: Diamond },
];

const PRICING_CATEGORIES = [
  { id: 'Car Periodic Service', label: 'Periodic' },
  { id: 'Car AC Service', label: 'AC' },
  { id: 'Car Battery Service', label: 'Battery' },
  { id: 'Car Brake Service', label: 'Brake' },
  { id: 'Car Clutch Service', label: 'Clutch' },
  { id: 'Car Denting & Painting', label: 'Denting' },
  { id: 'Car Detailing Service', label: 'Detailing' },
  { id: 'Car Engine Service', label: 'Engine' },
  { id: 'Car Tyre & Wheel Care', label: 'Tyre' },
  { id: 'Electrical & Battery Service', label: 'Electrical' },
  { id: 'Suspension & Steering Service', label: 'Suspension' },
];

const PAYMENT_MODES = [
  { id: 'PAY_LATER', label: 'Pay Later', hint: 'Pay at workshop / after service', disabled: false },
  { id: 'PAY_NOW', label: 'Pay Now', hint: 'Online payment (coming soon for telecaller)', disabled: true },
];

const STEP_META = [
  { title: "Let's get started!", subtitle: 'Select your location and car model' },
  { title: 'Almost there!', subtitle: 'Customer details (no OTP for telecaller)' },
  { title: 'Choose your service', subtitle: 'Choose your plan and continue' },
  { title: 'Pickup Details', subtitle: 'Pickup or visit workshop' },
  { title: 'Payment Options', subtitle: 'Choose preferred payment method' },
];

type FormState = {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  pincode: string;
  city_id: string;
  city: string;
  vehicle_number: string;
  vehicle_make: string;
  model_id: string;
  vehicle_model: string;
  vehicle_fuel_type: string;
  vehicle_class: string;
  booking_type: string;
  service_type_ids: string[];
  addon_ids: string[];
  coupon_code: string;
  workshop_id: string;
  workshop_name: string;
  payment_mode: string;
  pickup_required: boolean;
  pickup_date: string;
  pickup_time: string;
  pickup_address: string;
  address_type: 'home' | 'work' | 'other';
  flat_number: string;
  landmark: string;
  problem_description: string;
  membership_plan_id: string;
  membership_plan_name: string;
  membership_plan_price: number;
  rsa_service: string;
  package_label: string;
};

const initialForm: FormState = {
  customer_name: '',
  customer_phone: '',
  customer_address: '',
  pincode: '',
  city_id: '',
  city: '',
  vehicle_number: '',
  vehicle_make: '',
  model_id: '',
  vehicle_model: '',
  vehicle_fuel_type: '',
  vehicle_class: '',
  booking_type: 'PERIODIC',
  service_type_ids: [],
  addon_ids: [],
  coupon_code: '',
  workshop_id: '',
  workshop_name: '',
  payment_mode: 'PAY_LATER',
  pickup_required: true,
  pickup_date: '',
  pickup_time: '',
  pickup_address: '',
  address_type: 'home',
  flat_number: '',
  landmark: '',
  problem_description: '',
  membership_plan_id: '',
  membership_plan_name: '',
  membership_plan_price: 0,
  rsa_service: '',
  package_label: '',
};

export default function TelecallerCrmBookPage() {
  const router = useRouter();
  /** book = full 5-step booking; lead = basic details → save incomplete lead */
  const [mode, setMode] = useState<'book' | 'lead'>('book');
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [sendingPricing, setSendingPricing] = useState(false);
  const [error, setError] = useState('');
  const [pricingCategories, setPricingCategories] = useState<string[]>([]);

  const [cities, setCities] = useState<any[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [carDisplay, setCarDisplay] = useState('');

  const [form, setForm] = useState<FormState>(initialForm);
  const [quote, setQuote] = useState<any>(null);
  const [catalogMeta, setCatalogMeta] = useState<Partial<CrmCatalogSelection>>({});
  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [showAllCoupons, setShowAllCoupons] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [citiesApi, citiesDb] = await Promise.all([
          fetch('/api/cities')
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          createClient()
            .from('cities')
            .select('id, name, state')
            .eq('is_active', true)
            .order('name'),
        ]);
        const fromApi = Array.isArray(citiesApi?.cities)
          ? citiesApi.cities
          : Array.isArray(citiesApi)
            ? citiesApi
            : [];
        const fromDb = Array.isArray(citiesDb.data) ? citiesDb.data : [];
        setCities(fromApi.length > 0 ? fromApi : fromDb);
      } catch (e) {
        console.error('book wizard bootstrap failed', e);
      }
    })();
  }, []);

  const setField = (key: keyof FormState, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const needsPickupStep =
    form.booking_type === 'PERIODIC' || form.booking_type === 'OTHER_SERVICES';

  const apiBookingType =
    form.booking_type === 'RSA' || form.booking_type === 'MEMBERSHIP'
      ? form.booking_type
      : 'CAR_SERVICE';

  const filteredCities = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return cities.slice(0, 40);
    return cities.filter((c) => String(c.name || '').toLowerCase().includes(q)).slice(0, 40);
  }, [cities, cityQuery]);

  const bookingTypeLabel =
    BOOKING_TYPES.find((t) => t.id === form.booking_type)?.label || form.booking_type;

  const composePickupAddress = () => {
    const flat = form.flat_number.trim();
    const area = form.pickup_address.trim();
    const landmark = form.landmark.trim();
    const pin = form.pincode.trim();
    const city = form.city.trim();
    const parts = [
      flat,
      area,
      landmark ? `Near ${landmark}` : '',
      [city, pin].filter(Boolean).join(' '),
    ].filter(Boolean);
    return parts.join(', ');
  };

  const formatSlotLabel = (dateStr: string, timeStr: string) => {
    if (!dateStr) return '—';
    try {
      const dt = new Date(`${dateStr}T${timeStr || '00:00'}:00`);
      const datePart = dt.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      if (!timeStr) return datePart;
      const [h] = timeStr.split(':').map(Number);
      const hour12 = h % 12 || 12;
      const suffix = h >= 12 ? 'PM' : 'AM';
      return `${datePart}, ${hour12}:00 ${suffix}`;
    } catch {
      return `${dateStr} ${timeStr || ''}`.trim();
    }
  };

  const slotIso = (date: string, time: string) => {
    if (!date || !time) return null;
    return `${date}T${time}:00+05:30`;
  };

  const fetchQuote = async (workshopId?: string, couponOverride?: string) => {
    setQuoting(true);
    try {
      const res = await fetch('/api/telecaller/crm/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workshop_id: workshopId || form.workshop_id || null,
          city_id: form.city_id || null,
          city: form.city || null,
          vehicle_class: form.vehicle_class || null,
          service_type_ids: form.service_type_ids,
          addon_ids: form.addon_ids,
          coupon_code: (couponOverride ?? form.coupon_code) || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch price');
      setQuote(data?.quote || null);
      return data?.quote || null;
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch price');
      return null;
    } finally {
      setQuoting(false);
    }
  };

  const loadCoupons = async () => {
    setCouponsLoading(true);
    try {
      const params = new URLSearchParams();
      if (form.city_id) params.set('city_id', form.city_id);
      if (form.service_type_ids.length > 0) {
        params.set('service_type_ids', form.service_type_ids.join(','));
      }
      const res = await fetch(`/api/telecaller/coupons?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      setCoupons(Array.isArray(data?.coupons) ? data.coupons : []);
    } catch {
      setCoupons([]);
    } finally {
      setCouponsLoading(false);
    }
  };

  const applyCoupon = async (code: string) => {
    const next = String(code || '').trim().toUpperCase();
    setField('coupon_code', next);
    if (form.service_type_ids.length > 0) {
      await fetchQuote(form.workshop_id || undefined, next);
    }
  };

  const clearCoupon = async () => {
    setField('coupon_code', '');
    if (form.service_type_ids.length > 0) {
      await fetchQuote(form.workshop_id || undefined, '');
    }
  };

  const couponDiscLabel = (c: any) => {
    if (String(c?.coupon_kind || '').toUpperCase() === 'FREE_SERVICE') return 'Free service';
    if (String(c?.discount_mode || '').toUpperCase() === 'PERCENT') {
      return `${Number(c?.discount_value || 0)}% off`;
    }
    return `₹${Number(c?.discount_value || 0)} off`;
  };

  const summaryRows = useMemo(() => {
    const rows: Array<{ label: string; value: string }> = [
      { label: 'Customer', value: `${form.customer_name || '—'} · ${form.customer_phone || '—'}` },
      { label: 'City / PIN', value: [form.city, form.pincode].filter(Boolean).join(' · ') || '—' },
      {
        label: 'Vehicle',
        value: [form.vehicle_make, form.vehicle_model, form.vehicle_number].filter(Boolean).join(' · ') || '—',
      },
      { label: 'Booking type', value: bookingTypeLabel },
    ];
    if (form.booking_type === 'RSA' && (form.rsa_service || catalogMeta.rsa_service)) {
      rows.push({ label: 'RSA', value: form.rsa_service || catalogMeta.rsa_service || '—' });
    }
    if (form.booking_type === 'MEMBERSHIP') {
      rows.push({
        label: 'Membership',
        value: form.membership_plan_name || catalogMeta.membership_plan_name || '—',
      });
    }
    if (form.service_type_ids.length > 0 && quote?.line_items?.length) {
      const names = (quote.line_items as any[]).map((i) => i.name).filter(Boolean);
      if (names.length) rows.push({ label: 'Services', value: names.join(', ') });
    }
    if (needsPickupStep && form.pickup_date) {
      rows.push({
        label: form.pickup_required ? 'Pickup' : 'Visit',
        value: formatSlotLabel(form.pickup_date, form.pickup_time),
      });
    }
    if (form.pickup_required && form.pickup_address) {
      rows.push({ label: 'Address', value: composePickupAddress() });
    }
    if (!form.pickup_required && (form.workshop_name || form.workshop_id)) {
      rows.push({ label: 'Workshop', value: form.workshop_name || form.workshop_id });
    }
    rows.push({ label: 'Payment', value: 'Pay Later' });
    if (form.coupon_code) rows.push({ label: 'Coupon', value: form.coupon_code });
    if (quote && Number(quote.total || 0) > 0) {
      rows.push({
        label: 'Payable',
        value: `₹${Number(quote.total || 0).toLocaleString('en-IN')}`,
      });
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, quote, catalogMeta, bookingTypeLabel, needsPickupStep]);

  const canSaveLead = useMemo(() => {
    return (
      form.customer_name.trim().length > 0 &&
      form.customer_phone.trim().replace(/\D/g, '').length >= 10
    );
  }, [form.customer_name, form.customer_phone]);

  const canNext = useMemo(() => {
    if (mode === 'lead') return canSaveLead;
    if (step === 0) return Boolean(form.city && form.vehicle_make && form.vehicle_model);
    if (step === 1) {
      return (
        form.customer_name.trim().length > 0 &&
        form.customer_phone.trim().replace(/\D/g, '').length >= 10 &&
        /^\d{6}$/.test(form.pincode.trim())
      );
    }
    if (step === 2) {
      if (form.booking_type === 'RSA') return Boolean(form.rsa_service || catalogMeta.rsa_service);
      if (form.booking_type === 'MEMBERSHIP') {
        return Boolean(form.membership_plan_id || catalogMeta.membership_plan_id);
      }
      return form.service_type_ids.length > 0;
    }
    if (step === 3) {
      if (!needsPickupStep) return true;
      if (!form.vehicle_number.trim() || form.vehicle_number.trim().length < 4) return false;
      if (!form.pickup_date || !form.pickup_time) return false;
      if (form.pickup_required) {
        return form.pickup_address.trim().length > 5 && form.landmark.trim().length > 2;
      }
      return true;
    }
    if (step === 4) return Boolean(form.payment_mode);
    return true;
  }, [mode, step, form, catalogMeta, needsPickupStep, canSaveLead]);

  const togglePricingCategory = (id: string) => {
    setPricingCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const saveAsLead = async () => {
    const pin = form.pincode.replace(/\D/g, '').slice(0, 6);
    const carModel = [form.vehicle_make, form.vehicle_model].filter(Boolean).join(' ').trim();
    const wantsPricing = pricingCategories.length > 0;
    if (wantsPricing && (!/^\d{6}$/.test(pin) || !carModel)) {
      setError(
        'To share pricing, fill 6-digit pincode and car model (or clear pricing categories).',
      );
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/telecaller/crm/save-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: form.customer_name.trim(),
          customer_phone: form.customer_phone.trim(),
          city_id: form.city_id || null,
          city: form.city || null,
          pincode: form.pincode || null,
          vehicle_number: 'PENDING',
          vehicle_make: form.vehicle_make || null,
          vehicle_model: form.vehicle_model || null,
          model_id: form.model_id || null,
          vehicle_class: form.vehicle_class || null,
          vehicle_fuel_type: form.vehicle_fuel_type || null,
          booking_type: form.booking_type,
          service_type_ids: form.service_type_ids,
          problem_description: form.problem_description || null,
          pricing_categories: pricingCategories,
          package_label:
            BOOKING_TYPES.find((t) => t.id === form.booking_type)?.label || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (!data?.lead?.id && !data?.success)) {
        throw new Error(data?.error || 'Failed to save lead');
      }
      const leadId = String(data.lead?.id || '');

      if (leadId && wantsPricing && /^\d{6}$/.test(pin) && carModel) {
        const sendNow = window.confirm(
          `Lead saved. Send ${pricingCategories.length} pricing categor${
            pricingCategories.length === 1 ? 'y' : 'ies'
          } on WhatsApp now?\n\nNeeds open 24h WhatsApp chat.`,
        );
        if (sendNow) {
          setSendingPricing(true);
          try {
            const priceRes = await fetch(`/api/telecaller/leads/${leadId}/send-pricing`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pincode: pin, carModel, categories: pricingCategories }),
            });
            const priceData = await priceRes.json().catch(() => ({}));
            if (!priceRes.ok || !priceData?.success) {
              window.alert(
                priceData?.message ||
                  priceData?.error ||
                  'Pricing send failed. Open lead and retry when WhatsApp session is active.',
              );
            } else {
              window.alert(priceData.message || 'Pricing sent.');
            }
          } finally {
            setSendingPricing(false);
          }
        }
      }

      if (leadId) router.push(`/dashboard/telecaller/leads/${leadId}`);
      else router.push('/dashboard/telecaller/leads');
    } catch (e: any) {
      setError(e?.message || 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    setError('');
    if (mode === 'lead') {
      if (!canSaveLead) {
        setError('Customer name and 10-digit phone required.');
        return;
      }
      await saveAsLead();
      return;
    }
    if (!canNext) {
      setError('Please fill all required fields.');
      return;
    }
    if (step === 2) {
      if (form.booking_type === 'MEMBERSHIP') {
        const price = Number(form.membership_plan_price || catalogMeta.membership_plan_price || 0);
        setQuote({
          line_items: [
            {
              id: form.membership_plan_id || 'membership',
              name: form.membership_plan_name || 'Membership',
              price,
              kind: 'membership',
            },
          ],
          subtotal: price,
          discount: 0,
          total: price,
        });
        await loadCoupons();
        setStep(4);
        return;
      }
      if (form.booking_type === 'RSA') {
        setQuote({
          line_items: [
            {
              id: 'rsa',
              name: form.rsa_service || catalogMeta.rsa_service || 'RSA',
              price: 0,
              kind: 'rsa',
            },
          ],
          subtotal: 0,
          discount: 0,
          total: 0,
        });
        await loadCoupons();
        setStep(4);
        return;
      }
      await fetchQuote();
      setStep(3);
      return;
    }
    if (step === 3) {
      if (form.workshop_id) await fetchQuote(form.workshop_id);
      else await fetchQuote();
      await loadCoupons();
      setStep(4);
      return;
    }
    if (step === 4) {
      await submit();
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const goBack = () => {
    setError('');
    if (step === 0) {
      router.push('/dashboard/telecaller/leads');
      return;
    }
    if (step === 4 && !needsPickupStep) {
      setStep(2);
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      if (form.coupon_code && form.service_type_ids.length > 0) {
        await fetchQuote(form.workshop_id || undefined);
      }
      const start = slotIso(form.pickup_date, form.pickup_time);
      const endHour = form.pickup_time
        ? `${String(Number(form.pickup_time.split(':')[0]) + 1).padStart(2, '0')}:00`
        : '';
      const end = slotIso(form.pickup_date, endHour);
      const notesParts = [
        form.problem_description,
        form.rsa_service ? `RSA: ${form.rsa_service}` : '',
        form.membership_plan_name ? `Membership: ${form.membership_plan_name}` : '',
        form.package_label ? `Package: ${form.package_label}` : '',
      ].filter(Boolean);

      const composedAddress = form.pickup_required ? composePickupAddress() : form.customer_address;

      const res = await fetch('/api/telecaller/crm/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quote,
          service_type: apiBookingType,
          booking_type: apiBookingType,
          payment_mode: 'PAY_LATER',
          pickup_required: Boolean(form.pickup_required),
          pickup_address: form.pickup_required ? composedAddress : null,
          customer_address: composedAddress || form.customer_address,
          workshop_id: form.pickup_required ? null : form.workshop_id || null,
          preferred_slot_start: start,
          preferred_slot_end: end,
          problem_description: notesParts.join(' · ') || null,
          description: notesParts[0] || `${bookingTypeLabel} booking`,
          coupon_meta: {
            booking_type: form.booking_type,
            catalog_type: form.booking_type,
            membership_plan_id: form.membership_plan_id || null,
            rsa_service: form.rsa_service || null,
            package_label: form.package_label || null,
            pickup_date: form.pickup_date || null,
            pickup_time: form.pickup_time || null,
            address_type: form.address_type || null,
            flat_number: form.flat_number || null,
            landmark: form.landmark || null,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Booking failed');
      const leadId = data?.lead?.id;
      if (leadId) {
        router.push(`/dashboard/telecaller/leads/${leadId}`);
      } else {
        router.push('/dashboard/telecaller/leads');
      }
    } catch (e: any) {
      setError(e?.message || 'Booking failed');
    } finally {
      setSaving(false);
    }
  };

  const meta = STEP_META[step];

  return (
    <DashboardLayout role="telecaller">
      <div className="mx-auto max-w-3xl pb-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">Advanced CRM</h1>
          <p className="mt-1 text-sm text-gray-500">
            Full booking or quick Add Lead — same as mobile telecaller
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('book');
                setStep(0);
                setError('');
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-extrabold transition ${
                mode === 'book'
                  ? 'border-[#004AAD] bg-[#004AAD] text-white'
                  : 'border-[#004AAD] bg-white text-[#004AAD]'
              }`}
            >
              <Calendar className="h-4 w-4" />
              Full Booking
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('lead');
                setStep(0);
                setError('');
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-extrabold transition ${
                mode === 'lead'
                  ? 'border-[#004AAD] bg-[#004AAD] text-white'
                  : 'border-[#004AAD] bg-white text-[#004AAD]'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              Add Lead
            </button>
          </div>
          {mode === 'book' ? (
            <>
              <div className="mb-3 flex gap-1.5">
                {[0, 1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`h-1 flex-1 rounded-full ${step >= s ? 'bg-[#004AAD]' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
              <p className="text-xs font-bold text-[#004AAD]">Step {step + 1} of 5</p>
              <h2 className="mt-1 text-xl font-extrabold text-gray-900">{meta.title}</h2>
              <p className="text-sm text-gray-500">{meta.subtitle}</p>
            </>
          ) : (
            <>
              <p className="text-xs font-bold text-[#004AAD]">Quick save</p>
              <h2 className="mt-1 text-xl font-extrabold text-gray-900">Add Lead</h2>
              <p className="text-sm text-gray-500">
                Basic details only — save now, book later from Lead Details
              </p>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {mode === 'lead' && (
            <>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                Interest (optional)
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {BOOKING_TYPES.map((t) => {
                  const active = form.booking_type === t.id;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setField('booking_type', t.id)}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition ${
                        active
                          ? 'border-[#004AAD] bg-[#004AAD] text-white'
                          : 'border-gray-200 bg-white text-gray-800 hover:border-[#004AAD]/40'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-extrabold">{t.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-3">
                <Field
                  label="Customer Name *"
                  value={form.customer_name}
                  onChange={(v) => setField('customer_name', v)}
                  placeholder="Customer name"
                />
                <Field
                  label="Phone *"
                  value={form.customer_phone}
                  onChange={(v) => setField('customer_phone', v.replace(/\D/g, '').slice(0, 15))}
                  inputMode="tel"
                  placeholder="10-digit mobile"
                />
              </div>

              <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                City (optional)
              </p>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCityOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-3 py-2.5 text-left text-sm font-semibold text-gray-900"
                >
                  <span>{form.city || 'Select city'}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition ${cityOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {cityOpen ? (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                    <div className="relative border-b border-gray-100">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        value={cityQuery}
                        onChange={(e) => setCityQuery(e.target.value)}
                        placeholder="Search city"
                        className="w-full py-2.5 pl-9 pr-3 text-sm focus:outline-none"
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {filteredCities.map((c: any) => {
                        const name = c.name || c.city_name || '';
                        return (
                          <button
                            key={c.id || name}
                            type="button"
                            onClick={() => {
                              setField('city', name);
                              setField('city_id', c.id || '');
                              setCityOpen(false);
                              setCityQuery('');
                            }}
                            className="block w-full border-b border-gray-50 px-3 py-2.5 text-left text-sm font-medium text-gray-800 hover:bg-[#004AAD]/5 last:border-0"
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 space-y-3">
                <Field
                  label={
                    pricingCategories.length ? 'Pincode * (for pricing)' : 'Pincode (optional)'
                  }
                  value={form.pincode}
                  onChange={(v) => setField('pincode', v.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  placeholder="e.g. 400601"
                />
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                  {pricingCategories.length ? 'Car Model * (for pricing)' : 'Car Model (optional)'}
                </p>
                <CrmCarSearch
                  displayValue={carDisplay}
                  onSelect={(car) => {
                    setField('vehicle_make', car.make);
                    setField('vehicle_model', car.model);
                    setField('model_id', car.id);
                    setField('vehicle_class', car.vehicleClass || '');
                    setCarDisplay([car.make, car.model, car.variant].filter(Boolean).join(' '));
                  }}
                  onClear={() => {
                    setField('vehicle_make', '');
                    setField('vehicle_model', '');
                    setField('model_id', '');
                    setField('vehicle_class', '');
                    setCarDisplay('');
                  }}
                />
              </div>

              <div className="mt-4">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                  Pricing to share (optional)
                </p>
                <p className="mb-2 text-xs text-gray-500">
                  Select which pricing to send on WhatsApp after save. Clear all to save without
                  pricing.
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRICING_CATEGORIES.map((c) => {
                    const active = pricingCategories.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => togglePricingCategory(c.id)}
                        className={`rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition ${
                          active
                            ? 'border-[#004AAD] bg-[#004AAD]/10 text-[#004AAD]'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-[#004AAD]/40'
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3">
                <Field
                  label="Notes / Customer message (optional)"
                  value={form.problem_description}
                  onChange={(v) => setField('problem_description', v)}
                  placeholder="e.g. Asked for pricing, will decide later"
                />
              </div>

              <div className="mt-3 rounded-xl bg-[#004AAD]/10 px-4 py-3 text-sm font-semibold text-[#004AAD]">
                Saves as incomplete lead. After save you can send the selected pricing on WhatsApp
                (24h chat window required).
              </div>
            </>
          )}

          {mode === 'book' && step === 0 && (
            <>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Booking type</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {BOOKING_TYPES.map((t) => {
                  const active = form.booking_type === t.id;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          booking_type: t.id,
                          service_type_ids: [],
                          pickup_required: true,
                          membership_plan_id: '',
                          membership_plan_name: '',
                          rsa_service: '',
                          package_label: '',
                        }));
                        setCatalogMeta({});
                        setQuote(null);
                      }}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition ${
                        active
                          ? 'border-[#004AAD] bg-[#004AAD] text-white'
                          : 'border-gray-200 bg-white text-gray-800 hover:border-[#004AAD]/40'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-extrabold">{t.label}</span>
                    </button>
                  );
                })}
              </div>

              <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-gray-500">
                Select City *
              </p>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCityOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-3 py-2.5 text-left text-sm font-semibold text-gray-900"
                >
                  <span>{form.city || 'Select city'}</span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition ${cityOpen ? 'rotate-180' : ''}`} />
                </button>
                {cityOpen ? (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                    <div className="relative border-b border-gray-100">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        value={cityQuery}
                        onChange={(e) => setCityQuery(e.target.value)}
                        placeholder="Search city"
                        className="w-full py-2.5 pl-9 pr-3 text-sm focus:outline-none"
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {filteredCities.map((c: any) => {
                        const name = c.name || c.city_name || '';
                        return (
                          <button
                            key={c.id || name}
                            type="button"
                            onClick={() => {
                              setField('city', name);
                              setField('city_id', c.id || '');
                              setCityOpen(false);
                              setCityQuery('');
                            }}
                            className="block w-full border-b border-gray-50 px-3 py-2.5 text-left text-sm font-medium text-gray-800 hover:bg-[#004AAD]/5 last:border-0"
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-4">
                <CrmCarSearch
                  displayValue={carDisplay}
                  onSelect={(car) => {
                    setField('vehicle_make', car.make);
                    setField('vehicle_model', car.model);
                    setField('model_id', car.id);
                    setField('vehicle_class', car.vehicleClass || '');
                    setCarDisplay([car.make, car.model, car.variant].filter(Boolean).join(' '));
                  }}
                  onClear={() => {
                    setField('vehicle_make', '');
                    setField('vehicle_model', '');
                    setField('model_id', '');
                    setField('vehicle_class', '');
                    setCarDisplay('');
                  }}
                />
              </div>
            </>
          )}

          {mode === 'book' && step === 1 && (
            <>
              <Field
                label="Customer Name *"
                value={form.customer_name}
                onChange={(v) => setField('customer_name', v)}
              />
              <Field
                label="Phone *"
                value={form.customer_phone}
                onChange={(v) => setField('customer_phone', v.replace(/\D/g, '').slice(0, 15))}
                inputMode="tel"
              />
              <Field
                label="Pincode *"
                value={form.pincode}
                onChange={(v) => setField('pincode', v.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="e.g. 400601"
              />
              <div className="mt-3 rounded-xl bg-[#004AAD]/10 px-4 py-3 text-sm font-semibold text-[#004AAD]">
                OTP verification skipped for telecaller booking. City: {form.city || '—'} ·{' '}
                {form.vehicle_make} {form.vehicle_model}
              </div>
            </>
          )}

          {mode === 'book' && step === 2 && (
            <CrmBookingCatalog
              bookingType={form.booking_type}
              selectedIds={form.service_type_ids}
              onChangeIds={(ids) => setField('service_type_ids', ids)}
              cityId={form.city_id || null}
              vehicleClass={form.vehicle_class || null}
              modelId={form.model_id || null}
              showQuotePrices
              notes={form.problem_description}
              onNotesChange={(v) => setField('problem_description', v)}
              selectionMeta={{
                service_type_ids: form.service_type_ids,
                pickup_required: form.pickup_required,
                membership_plan_id: form.membership_plan_id,
                membership_plan_name: form.membership_plan_name,
                membership_plan_price: form.membership_plan_price,
                rsa_service: form.rsa_service,
                package_label: form.package_label,
                problem_description: form.problem_description,
                ...catalogMeta,
              }}
              onMetaChange={(patch) => {
                setCatalogMeta((prev) => ({ ...prev, ...patch }));
                setForm((prev) => ({
                  ...prev,
                  ...(patch.service_type_ids ? { service_type_ids: patch.service_type_ids } : {}),
                  ...(patch.pickup_required != null ? { pickup_required: patch.pickup_required } : {}),
                  ...(patch.membership_plan_id != null
                    ? { membership_plan_id: patch.membership_plan_id }
                    : {}),
                  ...(patch.membership_plan_name != null
                    ? { membership_plan_name: patch.membership_plan_name }
                    : {}),
                  ...(patch.membership_plan_price != null
                    ? { membership_plan_price: patch.membership_plan_price }
                    : {}),
                  ...(patch.rsa_service != null ? { rsa_service: patch.rsa_service } : {}),
                  ...(patch.package_label != null ? { package_label: patch.package_label } : {}),
                  ...(patch.problem_description != null
                    ? { problem_description: patch.problem_description }
                    : {}),
                }));
              }}
              showQuotePrices
            />
          )}

          {mode === 'book' && step === 3 && (
            <CrmPickupVisitStep
              city={form.city}
              cityId={form.city_id}
              pincode={form.pincode}
              quoteTotal={Number(quote?.total || 0)}
              value={{
                pickup_required: form.pickup_required,
                vehicle_number: form.vehicle_number,
                pickup_date: form.pickup_date,
                pickup_time: form.pickup_time,
                pickup_address: form.pickup_address,
                address_type: form.address_type,
                flat_number: form.flat_number,
                landmark: form.landmark,
                workshop_id: form.workshop_id,
                workshop_name: form.workshop_name,
              }}
              onChange={(patch) => {
                setForm((prev) => ({
                  ...prev,
                  ...(patch.pickup_required != null ? { pickup_required: patch.pickup_required } : {}),
                  ...(patch.vehicle_number != null ? { vehicle_number: patch.vehicle_number } : {}),
                  ...(patch.pickup_date != null ? { pickup_date: patch.pickup_date } : {}),
                  ...(patch.pickup_time != null ? { pickup_time: patch.pickup_time } : {}),
                  ...(patch.pickup_address != null ? { pickup_address: patch.pickup_address } : {}),
                  ...(patch.address_type != null ? { address_type: patch.address_type } : {}),
                  ...(patch.flat_number != null ? { flat_number: patch.flat_number } : {}),
                  ...(patch.landmark != null ? { landmark: patch.landmark } : {}),
                  ...(patch.workshop_id != null ? { workshop_id: patch.workshop_id } : {}),
                  ...(patch.workshop_name != null ? { workshop_name: patch.workshop_name } : {}),
                }));
                if (patch.workshop_id) fetchQuote(patch.workshop_id);
              }}
            />
          )}

          {mode === 'book' && step === 4 && (
            <>
              {PAYMENT_MODES.map((m) => {
                const active = form.payment_mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={m.disabled}
                    onClick={() => {
                      if (!m.disabled) setField('payment_mode', m.id);
                    }}
                    className={`mb-2 flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      active
                        ? 'border-[#004AAD] bg-[#004AAD]/5'
                        : 'border-gray-200 bg-white hover:border-[#004AAD]/30'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-extrabold ${active ? 'text-[#004AAD]' : 'text-gray-900'}`}>
                        {m.label}
                      </p>
                      <p className="text-xs text-gray-500">{m.hint}</p>
                    </div>
                    <div
                      className={`h-5 w-5 rounded-full border-2 ${
                        active ? 'border-[#004AAD] bg-[#004AAD]' : 'border-gray-300'
                      }`}
                    />
                  </button>
                );
              })}

              <div className="mt-4 rounded-xl border border-gray-200 p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Active Coupons</p>
                    <p className="text-xs text-gray-500">Apply a coupon for this booking</p>
                  </div>
                  {coupons.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllCoupons(true)}
                      className="text-xs font-bold text-[#004AAD]"
                    >
                      View all
                    </button>
                  ) : null}
                </div>
                {couponsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-[#004AAD]" />
                  </div>
                ) : coupons.length === 0 ? (
                  <p className="text-xs text-gray-500">No active telecaller coupons for this city/service.</p>
                ) : (
                  (() => {
                    const c = coupons[0];
                    const active = form.coupon_code === String(c.code || '').toUpperCase();
                    return (
                      <button
                        type="button"
                        onClick={() => (active ? clearCoupon() : applyCoupon(c.code))}
                        disabled={quoting}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left ${
                          active ? 'border-[#004AAD] bg-[#004AAD]/5' : 'border-gray-200'
                        }`}
                      >
                        <div>
                          <p className={`text-sm font-extrabold ${active ? 'text-[#004AAD]' : 'text-gray-900'}`}>
                            {c.code}
                          </p>
                          <p className="text-xs text-gray-500">
                            {couponDiscLabel(c)}
                            {c.description ? ` · ${c.description}` : ''}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-[#004AAD]">{active ? 'Applied' : 'Apply'}</span>
                      </button>
                    );
                  })()
                )}
                {form.coupon_code ? (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-[#004AAD]/10 px-3 py-2">
                    <span className="text-sm font-bold text-[#004AAD]">Applied: {form.coupon_code}</span>
                    <button type="button" onClick={clearCoupon} className="text-xs font-bold text-red-600">
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>

              {quote ? (
                <div className="mt-4 rounded-xl border border-gray-200 p-4">
                  <p className="mb-3 text-sm font-bold text-gray-900">Booking total</p>
                  {(quote.line_items || []).map((item: any, idx: number) => (
                    <div key={`${item.id}-${idx}`} className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-600">{item.name}</span>
                      <span className="font-semibold text-gray-900">
                        {Number(item.price || 0) > 0
                          ? `₹${Number(item.price || 0).toFixed(0)}`
                          : 'As per dispatch'}
                      </span>
                    </div>
                  ))}
                  {Number(quote.discount || 0) > 0 ? (
                    <div className="mb-1 flex justify-between text-sm text-emerald-600">
                      <span>Discount</span>
                      <span>-₹{Number(quote.discount || 0).toFixed(0)}</span>
                    </div>
                  ) : null}
                  <div className="mt-2 border-t border-gray-100 pt-2 flex justify-between">
                    <span className="font-extrabold text-[#004AAD]">Payable</span>
                    <span className="font-extrabold text-[#004AAD]">
                      ₹{Number(quote.total || 0).toFixed(0)}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-xl border border-gray-200 p-4">
                <p className="mb-3 text-sm font-bold text-gray-900">Booking Summary</p>
                {summaryRows.map((row) => (
                  <div key={row.label} className="flex gap-3 border-b border-gray-50 py-2 last:border-0">
                    <span className="w-24 shrink-0 text-xs font-bold text-gray-500">{row.label}</span>
                    <span className="text-sm font-semibold text-gray-900">{row.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {!canNext ? (
          <p className="mt-3 text-xs font-semibold text-amber-600">
            {mode === 'lead' && 'Name and 10-digit phone required.'}
            {mode === 'book' && step === 0 && 'Select city and car model (type to search).'}
            {mode === 'book' && step === 1 && 'Name, 10-digit phone and 6-digit pincode required.'}
            {mode === 'book' && step === 2 && 'Select at least one service / plan.'}
            {mode === 'book' &&
              step === 3 &&
              `Vehicle number, date, time${form.pickup_required ? ', address & landmark' : ''} required.`}
          </p>
        ) : null}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={goBack}
            className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-sm font-bold text-gray-800 hover:bg-gray-200"
          >
            {mode === 'lead' || step === 0 ? 'Cancel' : 'Back'}
          </button>
          <button
            type="button"
            disabled={!canNext || saving || quoting || sendingPricing}
            onClick={next}
            className="flex-[2] rounded-xl bg-[#004AAD] px-4 py-3 text-sm font-bold text-white hover:bg-[#023D95] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving || quoting || sendingPricing ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Please wait…
              </span>
            ) : mode === 'lead' ? (
              'Save Lead'
            ) : step === 4 ? (
              'Create Booking'
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </div>

      {showAllCoupons ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[75vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <p className="font-bold text-gray-900">All active coupons</p>
              <button
                type="button"
                onClick={() => setShowAllCoupons(false)}
                className="text-sm font-bold text-gray-500"
              >
                Close
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-4 py-2">
              {coupons.map((c) => {
                const active = form.coupon_code === String(c.code || '').toUpperCase();
                return (
                  <button
                    key={c.id || c.code}
                    type="button"
                    onClick={async () => {
                      if (active) await clearCoupon();
                      else await applyCoupon(c.code);
                      setShowAllCoupons(false);
                    }}
                    disabled={quoting}
                    className={`mb-2 flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left ${
                      active ? 'border-[#004AAD] bg-[#004AAD]/5' : 'border-gray-200'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-extrabold ${active ? 'text-[#004AAD]' : 'text-gray-900'}`}>
                        {c.code}
                      </p>
                      <p className="text-xs text-gray-500">
                        {couponDiscLabel(c)}
                        {c.description ? ` · ${c.description}` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[#004AAD]">{active ? 'Applied' : 'Apply'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-[#004AAD] focus:outline-none focus:ring-2 focus:ring-[#004AAD]/20"
      />
    </div>
  );
}
