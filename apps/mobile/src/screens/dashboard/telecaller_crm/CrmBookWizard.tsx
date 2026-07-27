import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiFetch } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';
import CrmBookingCatalog, { type CrmCatalogSelection } from '../../../components/telecaller/CrmBookingCatalog';
import CrmPickupVisitStep from '../../../components/telecaller/CrmPickupVisitStep';
import CarModelSearchField from '../../../components/CarModelSearchField';

/**
 * Telecaller CRM booking — same flow as https://myfng.in/book-service
 * Steps (5): City+Car → Customer (no OTP) → Services → Pickup/Visit → Payment
 */

const BOOKING_TYPES = [
  { id: 'PERIODIC', label: 'Periodic Service', icon: 'construct-outline' as const },
  { id: 'OTHER_SERVICES', label: 'Other Services', icon: 'grid-outline' as const },
  { id: 'RSA', label: 'RSA', icon: 'alert-circle-outline' as const },
  { id: 'MEMBERSHIP', label: 'Membership', icon: 'diamond-outline' as const },
];

const PAYMENT_MODES = [
  { id: 'PAY_LATER', label: 'Pay Later', hint: 'Pay at workshop / after service', disabled: false },
  { id: 'PAY_NOW', label: 'Pay Now', hint: 'Online payment (coming soon for telecaller)', disabled: true },
];

/** Same statuses as Lead Details call-activity flow */
const LEAD_STATUS_OPTIONS = [
  { id: 'INTERESTED', label: 'Interested', call_status: 'ANSWERED', outcome: 'INFO_COLLECTED', lead_status: 'NEW' },
  { id: 'WILL_VISIT', label: 'He will visit', call_status: 'ANSWERED', outcome: 'INFO_COLLECTED', lead_status: 'NEW' },
  {
    id: 'BOOKING_CONFIRMED',
    label: 'Booking confirmed',
    call_status: 'ANSWERED',
    outcome: 'LEAD_CREATED',
    lead_status: 'VALIDATED',
  },
  {
    id: 'IN_SERVICE',
    label: 'In Service',
    call_status: 'ANSWERED',
    outcome: 'INFO_COLLECTED',
    lead_status: 'IN_PROGRESS',
  },
  {
    id: 'SERVICE_DONE',
    label: 'Service Done',
    call_status: 'ANSWERED',
    outcome: 'INFO_COLLECTED',
    lead_status: 'COMPLETED',
  },
  {
    id: 'LOST',
    label: 'Lost',
    call_status: 'ANSWERED',
    outcome: 'NOT_INTERESTED',
    lead_status: 'REJECTED',
  },
];

const LOST_REASONS = [
  'Not Interested',
  'Unqualified Lead',
  'No-Response to Calls',
  'Already Service Done',
  'Under Warranty',
  'Looking For Authorised Service Center',
  'Other Reasons',
];

function todayDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const STEP_META = [
  { title: "Let's get started!", subtitle: 'Select your location and car model' },
  { title: 'Almost there!', subtitle: 'Customer details (no OTP for telecaller)' },
  { title: 'Choose your service', subtitle: 'Choose your plan and continue' },
  { title: 'Pickup Details', subtitle: 'Pickup or visit workshop' },
  { title: 'Payment Options', subtitle: 'Choose preferred payment method' },
];

type Props = {
  onDone: (leadId: string) => void;
  onCancel?: () => void;
  initialMode?: 'book' | 'lead';
  hideModeSwitch?: boolean;
};

export default function CrmBookWizard({
  onDone,
  onCancel,
  initialMode = 'book',
  hideModeSwitch = false,
}: Props) {
  /** book = full 5-step booking; lead = basic details → save incomplete lead */
  const [mode, setMode] = useState<'book' | 'lead'>(initialMode);
  const [step, setStep] = useState(0); // 0..4 like book-service
  const [saving, setSaving] = useState(false);
  const [quoting, setQuoting] = useState(false);

  const [cities, setCities] = useState<any[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [carDisplay, setCarDisplay] = useState('');
  const [resolvingCity, setResolvingCity] = useState(false);
  const [leadStatusId, setLeadStatusId] = useState('INTERESTED');
  const [lostReason, setLostReason] = useState('');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [lostMenuOpen, setLostMenuOpen] = useState(false);
  const [activityDate, setActivityDate] = useState(todayDateStr);
  const [activityTime, setActivityTime] = useState(nowTimeStr);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);

  const [form, setForm] = useState({
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
    service_type_ids: [] as string[],
    addon_ids: [] as string[],
    coupon_code: '',
    workshop_id: '',
    workshop_name: '',
    payment_mode: 'PAY_LATER',
    pickup_required: true,
    pickup_date: '',
    pickup_time: '',
    pickup_address: '',
    address_type: 'home' as 'home' | 'work' | 'other',
    flat_number: '',
    landmark: '',
    problem_description: '',
    membership_plan_id: '',
    membership_plan_name: '',
    membership_plan_price: 0,
    rsa_service: '',
    package_label: '',
  });

  const [quote, setQuote] = useState<any>(null);
  const [catalogMeta, setCatalogMeta] = useState<Partial<CrmCatalogSelection>>({});
  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [showAllCoupons, setShowAllCoupons] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [citiesApi, citiesDb] = await Promise.all([
          apiFetch<any>('/api/cities').catch(() => null),
          supabase
            .from('cities')
            .select('id, name, state, city_pincodes')
            .eq('is_active', true)
            .order('name'),
        ]);
        const fromApi = Array.isArray(citiesApi?.cities)
          ? citiesApi.cities
          : Array.isArray(citiesApi)
            ? citiesApi
            : [];
        const fromDb = Array.isArray(citiesDb.data) ? citiesDb.data : [];
        // Prefer DB rows when they include pincode mapping for auto city
        setCities(fromDb.length > 0 ? fromDb : fromApi);
      } catch (e) {
        console.error('book wizard bootstrap failed', e);
      }
    })();
  }, []);

  const setField = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const resolveCityFromPincode = async (pin: string) => {
    const pincode = String(pin || '').replace(/\D/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(pincode)) {
      setField('city', '');
      setField('city_id', '');
      return;
    }
    setResolvingCity(true);
    try {
      let rows = cities;
      if (!rows.some((c) => c.city_pincodes != null)) {
        const { data } = await supabase
          .from('cities')
          .select('id, name, state, city_pincodes')
          .eq('is_active', true);
        rows = Array.isArray(data) ? data : [];
        if (rows.length) setCities(rows);
      }
      const hit = (rows || []).find((c: any) => {
        const raw = String(c.city_pincodes || '');
        return raw.includes(pincode);
      });
      if (hit?.name) {
        setForm((prev) => ({
          ...prev,
          pincode,
          city: hit.name,
          city_id: hit.id || prev.city_id,
        }));
      } else {
        setForm((prev) => ({ ...prev, pincode, city: prev.city, city_id: prev.city_id }));
      }
    } catch {
      /* ignore */
    } finally {
      setResolvingCity(false);
    }
  };

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

  const fetchQuote = async (workshopId?: string, couponOverride?: string) => {
    setQuoting(true);
    try {
      const data = await apiFetch<any>('/api/telecaller/crm/quote', {
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
      setQuote(data?.quote || null);
      return data?.quote || null;
    } catch (e: any) {
      Alert.alert('Quote', e?.message || 'Failed to fetch price');
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
      const data = await apiFetch<any>(`/api/telecaller/coupons?${params.toString()}`);
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

  const couponDiscLabel = (c: any) => {
    if (String(c?.coupon_kind || '').toUpperCase() === 'FREE_SERVICE') return 'Free service';
    if (String(c?.discount_mode || '').toUpperCase() === 'PERCENT') {
      return `${Number(c?.discount_value || 0)}% off`;
    }
    return `₹${Number(c?.discount_value || 0)} off`;
  };

  const bookingTypeLabel =
    BOOKING_TYPES.find((t) => t.id === form.booking_type)?.label || form.booking_type;

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
      const names = (quote.line_items as any[])
        .filter((i) => i.kind !== 'addon' || true)
        .map((i) => i.name)
        .filter(Boolean);
      if (names.length) rows.push({ label: 'Services', value: names.join(', ') });
    }
    if (needsPickupStep && form.pickup_date) {
      rows.push({
        label: form.pickup_required ? 'Pickup' : 'Visit',
        value: formatSlotLabel(form.pickup_date, form.pickup_time),
      });
    }
    if (form.pickup_required && form.pickup_address) {
      rows.push({
        label: 'Address',
        value: composePickupAddress(),
      });
    }
    if (!form.pickup_required && (form.workshop_name || form.workshop_id)) {
      rows.push({
        label: 'Workshop',
        value: form.workshop_name || form.workshop_id,
      });
    }
    rows.push({ label: 'Payment', value: 'Pay Later' });
    if (form.coupon_code) {
      rows.push({ label: 'Coupon', value: form.coupon_code });
    }
    if (quote && Number(quote.total || 0) > 0) {
      rows.push({
        label: 'Payable',
        value: `₹${Number(quote.total || 0).toLocaleString('en-IN')}`,
      });
    }
    return rows;
  }, [form, quote, catalogMeta, bookingTypeLabel, needsPickupStep]);

  const slotIso = (date: string, time: string) => {
    if (!date || !time) return null;
    return `${date}T${time}:00+05:30`;
  };

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
        return (
          form.pickup_address.trim().length > 5 &&
          form.landmark.trim().length > 2
        );
      }
      return true;
    }
    if (step === 4) return Boolean(form.payment_mode);
    return true;
  }, [mode, step, form, catalogMeta, needsPickupStep, canSaveLead]);

  const saveAsLead = async () => {
    if (!canSaveLead) {
      Alert.alert('Missing info', 'Customer name and 10-digit phone required');
      return;
    }
    const pin = form.pincode.replace(/\D/g, '').slice(0, 6);
    const statusOpt =
      LEAD_STATUS_OPTIONS.find((s) => s.id === leadStatusId) || LEAD_STATUS_OPTIONS[0];
    if (statusOpt.id === 'LOST' && !lostReason.trim()) {
      Alert.alert('Lost reason', 'Lost select kiya hai — reason choose karo');
      return;
    }
    // Date/Time = kab baat hui (call activity), NOT follow-up schedule
    const activityIso =
      activityDate && activityTime ? `${activityDate}T${activityTime}:00+05:30` : null;
    if (!activityIso) {
      Alert.alert('Call time', 'Kab baat hui — date & time dalo');
      return;
    }
    const statusLabel =
      statusOpt.id === 'LOST' && lostReason
        ? `Lost · ${lostReason}`
        : statusOpt.label;

    setSaving(true);
    try {
      const data = await apiFetch<any>('/api/telecaller/crm/save-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: form.customer_name.trim(),
          customer_phone: form.customer_phone.trim(),
          city_id: form.city_id || null,
          city: form.city || null,
          pincode: pin || null,
          vehicle_number: 'PENDING',
          vehicle_make: form.vehicle_make || null,
          vehicle_model: form.vehicle_model || null,
          model_id: form.model_id || null,
          vehicle_class: form.vehicle_class || null,
          vehicle_fuel_type: form.vehicle_fuel_type || null,
          booking_type: 'CAR_SERVICE',
          service_type_ids: [],
          problem_description: form.problem_description || null,
          package_label: 'Enquiry',
          status: statusOpt.lead_status || 'NEW',
          call_status: statusOpt.call_status,
          outcome: statusOpt.outcome,
          call_result: statusOpt.id,
          call_label: statusLabel,
          call_notes: form.problem_description || null,
          lost_reason: statusOpt.id === 'LOST' ? lostReason : null,
          activity_at: activityIso,
        }),
      });
      if (!data?.lead?.id && !data?.success) {
        throw new Error(data?.error || 'Failed to save lead');
      }
      const leadId = String(data.lead?.id || '');
      Alert.alert(
        'Lead saved',
        data.message || 'Lead created. Complete booking later from Lead Details.',
      );
      if (leadId) onDone(leadId);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (mode === 'lead') {
      await saveAsLead();
      return;
    }
    if (!canNext) {
      Alert.alert('Missing info', 'Please fill required fields');
      return;
    }
    if (step === 2) {
      if (form.booking_type === 'MEMBERSHIP') {
        const price = Number(form.membership_plan_price || catalogMeta.membership_plan_price || 0);
        setQuote({
          line_items: [{ id: form.membership_plan_id || 'membership', name: form.membership_plan_name || 'Membership', price, kind: 'membership' }],
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
          line_items: [{ id: 'rsa', name: form.rsa_service || catalogMeta.rsa_service || 'RSA', price: 0, kind: 'rsa' }],
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
    if (step === 0) {
      onCancel?.();
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

      const composedAddress = form.pickup_required
        ? composePickupAddress()
        : form.customer_address;

      const data = await apiFetch<any>('/api/telecaller/crm/book', {
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
      const leadId = data?.lead?.id;
      Alert.alert('Booked', `Lead ${data?.lead?.lead_number || ''} created`);
      if (leadId) onDone(leadId);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Booking failed');
    } finally {
      setSaving(false);
    }
  };

  const meta = STEP_META[step];
  const selectedLeadStatus =
    LEAD_STATUS_OPTIONS.find((s) => s.id === leadStatusId) || LEAD_STATUS_OPTIONS[0];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={styles.topBar}>
        {!hideModeSwitch ? (
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeChip, mode === 'book' && styles.modeChipActive]}
              onPress={() => {
                setMode('book');
                setStep(0);
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={15}
                color={mode === 'book' ? '#fff' : COLORS.primary}
              />
              <Text style={[styles.modeChipText, mode === 'book' && styles.modeChipTextActive]}>
                Full Booking
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeChip, mode === 'lead' && styles.modeChipActive]}
              onPress={() => {
                setMode('lead');
                setStep(0);
              }}
            >
              <Ionicons
                name="person-add-outline"
                size={15}
                color={mode === 'lead' ? '#fff' : COLORS.primary}
              />
              <Text style={[styles.modeChipText, mode === 'lead' && styles.modeChipTextActive]}>
                Add Lead
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {mode === 'book' ? (
          <>
            <View style={styles.progress}>
              {[0, 1, 2, 3, 4].map((s) => (
                <View key={s} style={[styles.dot, step >= s && styles.dotActive]} />
              ))}
            </View>
            <Text style={styles.stepOf}>Step {step + 1} of 5</Text>
            <Text style={styles.stepTitle}>{meta.title}</Text>
            <Text style={styles.stepSub}>{meta.subtitle}</Text>
          </>
        ) : (
          <>
            <Text style={styles.stepOf}>Quick save</Text>
            <Text style={styles.stepTitle}>Add Lead</Text>
            <Text style={styles.stepSub}>
              Name, phone, pin → city auto · call notes & status
            </Text>
          </>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {mode === 'lead' && (
          <>
            <Field
              label="Customer Name *"
              value={form.customer_name}
              onChange={(v) => setField('customer_name', v)}
              placeholder="Customer name"
            />
            <Field
              label="Phone *"
              value={form.customer_phone}
              onChange={(v) => setField('customer_phone', v)}
              keyboardType="phone-pad"
              maxLength={15}
              placeholder="10-digit mobile"
            />
            <Field
              label="Pincode"
              value={form.pincode}
              onChange={(v) => {
                const pin = v.replace(/\D/g, '').slice(0, 6);
                setField('pincode', pin);
                if (pin.length === 6) void resolveCityFromPincode(pin);
                if (pin.length < 6) {
                  setField('city', '');
                  setField('city_id', '');
                }
              }}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="6-digit pincode"
            />
            {resolvingCity ? (
              <Text style={styles.hint}>Finding city…</Text>
            ) : form.city ? (
              <View style={styles.cityAutoRow}>
                <Ionicons name="location-outline" size={16} color={COLORS.primary} />
                <Text style={styles.cityAutoText}>{form.city}</Text>
              </View>
            ) : form.pincode.length === 6 ? (
              <Text style={styles.hint}>City not found for this pincode</Text>
            ) : null}

            <View style={{ marginTop: 6 }}>
              <CarModelSearchField
                label="Car Model"
                displayValue={carDisplay}
                selectedMake={form.vehicle_make}
                selectedModel={form.vehicle_model}
                placeholder="e.g. Swift, Rapid"
                onSelect={(make, model, display, meta) => {
                  setField('vehicle_make', make);
                  setField('vehicle_model', model);
                  setField('model_id', meta?.id || '');
                  setField('vehicle_class', meta?.class || '');
                  setCarDisplay(display);
                }}
                onClear={() => {
                  setField('vehicle_make', '');
                  setField('vehicle_model', '');
                  setField('model_id', '');
                  setField('vehicle_class', '');
                  setCarDisplay('');
                }}
              />
            </View>

            <Text style={styles.sectionLabel}>Lead Status</Text>
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={() => setStatusMenuOpen(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.selectBtnText}>{selectedLeadStatus.label}</Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>

            {leadStatusId === 'LOST' ? (
              <>
                <Text style={styles.sectionLabel}>Lost reason *</Text>
                <TouchableOpacity
                  style={styles.selectBtn}
                  onPress={() => setLostMenuOpen(true)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.selectBtnText,
                      !lostReason && { color: COLORS.textSecondary },
                    ]}
                  >
                    {lostReason || 'Select lost reason'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </>
            ) : null}

            <Field
              label="Call Activity"
              value={form.problem_description}
              onChange={(v) => setField('problem_description', v)}
              placeholder="Kya baat hui — notes"
              multiline
              style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
            />

            <Text style={styles.sectionLabel}>Call date & time (kab baat hui)</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={[styles.selectBtn, { flex: 1 }]}
                onPress={() => setPickerMode('date')}
              >
                <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                <Text style={styles.selectBtnText}>{activityDate || 'Date'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.selectBtn, { flex: 1 }]}
                onPress={() => setPickerMode('time')}
              >
                <Ionicons name="time-outline" size={16} color={COLORS.primary} />
                <Text style={styles.selectBtnText}>{activityTime || 'Time'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.infoText}>
                Incomplete lead save. Book later from Lead Details — Send Pricing bhi wahan se.
              </Text>
            </View>
          </>
        )}

        {/* Step 0: City + Car (book-service) */}
        {mode === 'book' && step === 0 && (
          <>
            <Text style={styles.sectionLabel}>Booking type</Text>
            <View style={styles.typeGrid}>
              {BOOKING_TYPES.map((t) => {
                const active = form.booking_type === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typeCard, active && styles.typeCardActive]}
                    onPress={() => {
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
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={t.icon}
                      size={22}
                      color={active ? '#fff' : COLORS.primary}
                    />
                    <Text style={[styles.typeCardText, active && styles.typeCardTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Select City *</Text>
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={() => setCityOpen((v) => !v)}
            >
              <Text style={styles.selectBtnText}>{form.city || 'Select city'}</Text>
              <Ionicons name={cityOpen ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {cityOpen ? (
              <View style={styles.menu}>
                <TextInput
                  style={styles.menuSearch}
                  value={cityQuery}
                  onChangeText={setCityQuery}
                  placeholder="Search city"
                  placeholderTextColor={COLORS.textSecondary}
                />
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredCities.map((c: any) => {
                    const name = c.name || c.city_name || '';
                    return (
                      <TouchableOpacity
                        key={c.id || name}
                        style={styles.menuItem}
                        onPress={() => {
                          setField('city', name);
                          setField('city_id', c.id || '');
                          setCityOpen(false);
                          setCityQuery('');
                        }}
                      >
                        <Text style={styles.menuItemText}>{name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View style={{ marginTop: 14 }}>
              <CarModelSearchField
                label="Select Car Model"
                variant="website"
                displayValue={carDisplay}
                selectedMake={form.vehicle_make}
                selectedModel={form.vehicle_model}
                placeholder="Enter Model (e.g. Rapid, Swift, City)"
                onSelect={(make, model, display, meta) => {
                  setField('vehicle_make', make);
                  setField('vehicle_model', model);
                  setField('model_id', meta?.id || '');
                  setField('vehicle_class', meta?.class || '');
                  setCarDisplay(display);
                }}
                onClear={() => {
                  setField('vehicle_make', '');
                  setField('vehicle_model', '');
                  setField('model_id', '');
                  setField('vehicle_class', '');
                  setCarDisplay('');
                }}
              />
            </View>
          </>
        )}

        {/* Step 1: Customer — no OTP */}
        {mode === 'book' && step === 1 && (
          <>
            <Field label="Customer Name *" value={form.customer_name} onChange={(v) => setField('customer_name', v)} />
            <Field
              label="Phone *"
              value={form.customer_phone}
              onChange={(v) => setField('customer_phone', v)}
              keyboardType="phone-pad"
              maxLength={15}
            />
            <Field
              label="Pincode *"
              value={form.pincode}
              onChange={(v) => setField('pincode', v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="e.g. 400601"
            />
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.infoText}>
                OTP verification skipped for telecaller booking. City: {form.city || '—'} · {form.vehicle_make}{' '}
                {form.vehicle_model}
              </Text>
            </View>
          </>
        )}

        {/* Step 2: Services */}
        {mode === 'book' && step === 2 && (
          <CrmBookingCatalog
            bookingType={form.booking_type}
            selectedIds={form.service_type_ids}
            onChangeIds={(ids) => setField('service_type_ids', ids)}
            cityId={form.city_id || null}
            vehicleClass={form.vehicle_class || null}
            modelId={form.model_id || null}
            couponCode={form.coupon_code}
            onCouponChange={(v) => setField('coupon_code', v)}
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
                ...(patch.membership_plan_id != null ? { membership_plan_id: patch.membership_plan_id } : {}),
                ...(patch.membership_plan_name != null ? { membership_plan_name: patch.membership_plan_name } : {}),
                ...(patch.membership_plan_price != null ? { membership_plan_price: patch.membership_plan_price } : {}),
                ...(patch.rsa_service != null ? { rsa_service: patch.rsa_service } : {}),
                ...(patch.package_label != null ? { package_label: patch.package_label } : {}),
                ...(patch.problem_description != null ? { problem_description: patch.problem_description } : {}),
              }));
            }}
          />
        )}

        {/* Step 3: Pickup / Visit */}
        {mode === 'book' && step === 3 && (
          <CrmPickupVisitStep
            forcePickup={false}
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

        {/* Step 4: Payment */}
        {mode === 'book' && step === 4 && (
          <>
            {PAYMENT_MODES.map((m) => {
              const active = form.payment_mode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.payCard,
                    active && styles.payCardActive,
                    m.disabled && styles.payCardDisabled,
                  ]}
                  disabled={m.disabled}
                  onPress={() => {
                    if (!m.disabled) setField('payment_mode', m.id);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.payName,
                        active && { color: COLORS.primary },
                        m.disabled && { color: COLORS.gray[400] },
                      ]}
                    >
                      {m.label}
                    </Text>
                    <Text style={styles.hint}>{m.hint}</Text>
                  </View>
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={m.disabled ? COLORS.gray[300] : active ? COLORS.primary : COLORS.gray[400]}
                  />
                </TouchableOpacity>
              );
            })}

            <View style={styles.couponSection}>
              <View style={styles.couponHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionLabel}>Active Coupons</Text>
                  <Text style={styles.hint}>Apply a coupon for this booking</Text>
                </View>
                {coupons.length > 1 ? (
                  <TouchableOpacity onPress={() => setShowAllCoupons(true)} hitSlop={8}>
                    <Text style={styles.viewAllText}>View all</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {couponsLoading ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
              ) : coupons.length === 0 ? (
                <Text style={[styles.hint, { marginTop: 8 }]}>No active telecaller coupons for this city/service.</Text>
              ) : (
                (() => {
                  const c = coupons[0];
                  const active = form.coupon_code === String(c.code || '').toUpperCase();
                  return (
                    <TouchableOpacity
                      style={[styles.couponCard, active && styles.couponCardActive]}
                      onPress={() => (active ? clearCoupon() : applyCoupon(c.code))}
                      disabled={quoting}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.couponCode, active && { color: COLORS.primary }]}>{c.code}</Text>
                        <Text style={styles.hint}>
                          {couponDiscLabel(c)}
                          {c.description ? ` · ${c.description}` : ''}
                        </Text>
                      </View>
                      <Ionicons
                        name={active ? 'checkmark-circle' : 'add-circle-outline'}
                        size={22}
                        color={active ? COLORS.primary : COLORS.gray[400]}
                      />
                    </TouchableOpacity>
                  );
                })()
              )}
              {form.coupon_code ? (
                <View style={styles.appliedBar}>
                  <Text style={styles.appliedText}>Applied: {form.coupon_code}</Text>
                  <TouchableOpacity onPress={clearCoupon}>
                    <Text style={styles.clearCoupon}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {quote ? (
              <View style={styles.quoteCard}>
                <Text style={styles.quoteTitle}>Booking total</Text>
                {(quote.line_items || []).map((item: any, idx: number) => (
                  <View key={`${item.id}-${idx}`} style={styles.quoteRow}>
                    <Text style={styles.quoteName}>{item.name}</Text>
                    <Text style={styles.quotePrice}>
                      {Number(item.price || 0) > 0 ? `₹${Number(item.price || 0).toFixed(0)}` : 'As per dispatch'}
                    </Text>
                  </View>
                ))}
                {Number(quote.discount || 0) > 0 ? (
                  <View style={styles.quoteRow}>
                    <Text style={[styles.quoteName, { color: COLORS.green }]}>Discount</Text>
                    <Text style={[styles.quotePrice, { color: COLORS.green }]}>
                      -₹{Number(quote.discount || 0).toFixed(0)}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.quoteDivider} />
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteTotal}>Payable</Text>
                  <Text style={styles.quoteTotal}>₹{Number(quote.total || 0).toFixed(0)}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Booking Summary</Text>
              {summaryRows.map((row) => (
                <View key={row.label} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{row.label}</Text>
                  <Text style={styles.summaryValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={showAllCoupons}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllCoupons(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowAllCoupons(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <Text style={styles.summaryTitle}>All active coupons</Text>
              <TouchableOpacity onPress={() => setShowAllCoupons(false)}>
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {coupons.map((c) => {
                const active = form.coupon_code === String(c.code || '').toUpperCase();
                return (
                  <TouchableOpacity
                    key={c.id || c.code}
                    style={[styles.couponCard, active && styles.couponCardActive]}
                    onPress={async () => {
                      if (active) await clearCoupon();
                      else await applyCoupon(c.code);
                      setShowAllCoupons(false);
                    }}
                    disabled={quoting}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.couponCode, active && { color: COLORS.primary }]}>{c.code}</Text>
                      <Text style={styles.hint}>
                        {couponDiscLabel(c)}
                        {c.description ? ` · ${c.description}` : ''}
                      </Text>
                    </View>
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'add-circle-outline'}
                      size={22}
                      color={active ? COLORS.primary : COLORS.gray[400]}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={styles.footer}>
        {mode === 'lead' && !canNext ? (
          <Text style={styles.footerHint}>Name and 10-digit phone required</Text>
        ) : null}
        {mode === 'book' && !canNext && step === 0 ? (
          <Text style={styles.footerHint}>Select city and car model (type to search)</Text>
        ) : null}
        {mode === 'book' && !canNext && step === 1 ? (
          <Text style={styles.footerHint}>Name, 10-digit phone and 6-digit pincode required</Text>
        ) : null}
        {mode === 'book' && !canNext && step === 2 ? (
          <Text style={styles.footerHint}>Select at least one service / plan</Text>
        ) : null}
        {mode === 'book' && !canNext && step === 3 ? (
          <Text style={styles.footerHint}>
            Vehicle number, date, time
            {form.pickup_required ? ', address & landmark' : ''} required
          </Text>
        ) : null}
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={goBack}>
            <Text style={styles.backText}>
              {mode === 'lead' || step === 0 ? 'Close' : 'Back'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.nextBtn, (!canNext || saving) && styles.nextBtnDisabled]}
            disabled={!canNext || saving}
            onPress={next}
          >
            {saving || quoting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextText}>
                {mode === 'lead' ? 'Save Lead' : step === 4 ? 'Create Booking' : 'Continue'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {pickerMode ? (
        <DateTimePicker
          value={
            pickerMode === 'date'
              ? activityDate
                ? new Date(`${activityDate}T12:00:00`)
                : new Date()
              : activityTime
                ? new Date(`1970-01-01T${activityTime}:00`)
                : new Date()
          }
          mode={pickerMode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_e, date) => {
            const modeNow = pickerMode;
            if (Platform.OS === 'android') setPickerMode(null);
            if (!date) {
              if (Platform.OS === 'ios') setPickerMode(null);
              return;
            }
            if (modeNow === 'date') {
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, '0');
              const d = String(date.getDate()).padStart(2, '0');
              setActivityDate(`${y}-${m}-${d}`);
              if (Platform.OS === 'ios') setPickerMode(null);
            } else {
              setActivityTime(
                `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
              );
              if (Platform.OS === 'ios') setPickerMode(null);
            }
          }}
        />
      ) : null}

      <Modal
        visible={statusMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusMenuOpen(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setStatusMenuOpen(false)}>
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>Select status</Text>
            {LEAD_STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={styles.menuSheetItem}
                onPress={() => {
                  setLeadStatusId(opt.id);
                  if (opt.id !== 'LOST') setLostReason('');
                  setStatusMenuOpen(false);
                }}
              >
                <Text style={styles.menuSheetItemText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={lostMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLostMenuOpen(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setLostMenuOpen(false)}>
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>Lost reason</Text>
            {LOST_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={styles.menuSheetItem}
                onPress={() => {
                  setLostReason(reason);
                  setLostMenuOpen(false);
                }}
              >
                <Text style={styles.menuSheetItemText}>{reason}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  [key: string]: any;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { paddingHorizontal: SPACING.md, paddingTop: 4, paddingBottom: 8 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  modeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeChipText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  modeChipTextActive: { color: '#fff' },
  pricingChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  pricingChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  pricingChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '14',
  },
  pricingChipText: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  pricingChipTextActive: { color: COLORS.primary },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.gray[200] },
  dotActive: { backgroundColor: COLORS.primary },
  stepOf: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
  stepTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textHeading },
  stepSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  scroll: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: SPACING.md, paddingBottom: 16, flexGrow: 1 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, marginTop: 4 },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  typeCard: {
    width: '47%',
    minHeight: 72,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...SHADOWS.small,
  },
  typeCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeCardText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  typeCardTextActive: { color: '#fff' },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectBtnText: { flex: 1, color: COLORS.textPrimary, fontWeight: '600' },
  dateTimeRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  cityAutoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: -4,
  },
  cityAutoText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  menuSheet: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuSheetItem: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray[100],
  },
  menuSheetItemText: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  menu: {
    marginTop: 6,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  menuSearch: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  menuItemText: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: COLORS.textPrimary,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.primary + '12',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  infoText: { flex: 1, fontSize: 12, color: COLORS.primary, fontWeight: '600', lineHeight: 17 },
  hint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  payCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  payCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  payCardDisabled: { opacity: 0.55, backgroundColor: COLORS.gray[50] },
  payName: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  couponSection: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  couponHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  viewAllText: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 4 },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  couponCardActive: { backgroundColor: COLORS.primary + '08', borderRadius: 10, paddingHorizontal: 8 },
  couponCode: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  appliedBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: COLORS.primary + '12',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  appliedText: { fontWeight: '700', color: COLORS.primary, fontSize: 13 },
  clearCoupon: { fontWeight: '700', color: COLORS.red || '#EF4444', fontSize: 13 },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 8,
    maxHeight: '75%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.gray[300],
    marginBottom: 10,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  applyCoupon: {
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyCouponText: { color: '#fff', fontWeight: '700' },
  quoteCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  quoteTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textHeading, marginBottom: 8 },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  quoteName: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  quotePrice: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  quoteTotal: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  quoteDivider: { height: 1, backgroundColor: COLORS.gray[100], marginVertical: 8 },
  summary: {
    marginTop: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    ...SHADOWS.small,
  },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textHeading, marginBottom: 10 },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[100],
  },
  summaryLabel: { width: 92, fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  summaryValue: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 18 },
  footer: {
    paddingHorizontal: SPACING.md,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
    backgroundColor: COLORS.white,
  },
  footerHint: { fontSize: 11, color: COLORS.orange, fontWeight: '600', marginBottom: 6 },
  footerRow: { flexDirection: 'row', gap: 10 },
  backBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
  },
  backText: { fontWeight: '700', color: COLORS.textPrimary },
  nextBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  nextBtnDisabled: { opacity: 0.45 },
  nextText: { fontWeight: '700', color: '#fff', fontSize: 15 },
});
