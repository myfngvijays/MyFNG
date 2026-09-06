import React, { useState, useEffect } from 'react';
import { formatDateTime, formatDateDMY } from "@/lib/dateFormat";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  BackHandler,
  Platform,
  Modal,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Removed - using emojis
import { Icon } from '../../../components/Icon';
import { supabase, withTimeout } from '../../../lib/supabase';
import CarLoading from '../../../components/CarLoading';
import { workshopPublicPageAddress } from '../../../lib/workshopDisplay';
import { formatPreferredSlotLabel } from '../../../lib/preferredSlot';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';
import LeadBrainCard from '../../../components/telecaller/LeadBrainCard';
import { parseIds } from '../../../lib/parseIds';
import {
  emptySecondCar,
  parseSecondCar,
  serializeSecondCar,
  secondCarLabel,
  type CrmSecondCar,
} from '../../../lib/crmSecondCar';
import {
  parseReferredBy,
  serializeReferredBy,
  referredByLabel,
  referredByFromSearchHit,
  type CrmReferredBy,
  type CrmReferrerSearchHit,
} from '../../../lib/crmLeadReference';
import { openPhoneCall } from '../../../lib/phone';
import { clickToCallCustomer } from '../../../lib/clickToCall';
import { crmDispositionNeedsFullProfile } from '../../../lib/telecaller/crmStatusFilters';
import { serviceLeadVehicleNumber } from '../../../lib/telecaller/serviceLeadVehicleNumber';
import { COLORS, SPACING } from '../../../constants/theme';
import CarModelSearchField from '../../../components/CarModelSearchField';
import LeadTagsPicker from '../../../components/telecaller/LeadTagsPicker';
import CrmServicePlanPicker from '../../../components/telecaller/CrmServicePlanPicker';
import CrmPickupVisitStep, {
  type CrmPickupVisitValue,
} from '../../../components/telecaller/CrmPickupVisitStep';
import TelecallerWhatsAppChat from '../../../components/telecaller/TelecallerWhatsAppChat';
import CallRecordingInlinePlayer from '../../../components/telecaller/CallRecordingInlinePlayer';
import {
  resolveVehicleClass,
  resolveVehicleClassByMakeModel,
} from '../../../lib/servicePricing';
import {
  extractInboundCustomerMessage,
  redactLeadSourceForTelecaller,
} from '../../../lib/redactLeadSource';

const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Hybrid'];

type EditForm = {
  customer_name: string;
  customer_phone: string;
  customer_alternate_phone: string;
  customer_email: string;
  city_id: string;
  city: string;
  pincode: string;
  vehicle_number: string;
  vehicle_make: string;
  model_id: string;
  vehicle_model: string;
  vehicle_class: string;
  vehicle_fuel_type: string;
  vehicle_year: string;
  odometer_km: string;
  service_types: string[];
  service_addons: string[];
  problem_description: string;
  pickup_required: boolean;
  pickup_address: string;
  address_type: 'home' | 'work' | 'other';
  flat_number: string;
  landmark: string;
  pickup_date: string;
  pickup_time: string;
  workshop_id: string;
  workshop_name: string;
  lead_priority: string;
};

function emptyEditForm(): EditForm {
  return {
    customer_name: '',
    customer_phone: '',
    customer_alternate_phone: '',
    customer_email: '',
    city_id: '',
    city: '',
    pincode: '',
    vehicle_number: '',
    vehicle_make: '',
    model_id: '',
    vehicle_model: '',
    vehicle_class: '',
    vehicle_fuel_type: '',
    vehicle_year: '',
    odometer_km: '',
    service_types: [],
    service_addons: [],
    problem_description: '',
    pickup_required: true,
    pickup_address: '',
    address_type: 'home',
    flat_number: '',
    landmark: '',
    pickup_date: '',
    pickup_time: '',
    workshop_id: '',
    workshop_name: '',
    lead_priority: 'NORMAL',
  };
}

function slotIso(date: string, time: string) {
  if (!date || !time) return null;
  return `${date}T${time}:00+05:30`;
}

function parseSlot(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      const m = String(iso).match(/(\d{4}-\d{2}-\d{2}).*?(\d{2}:\d{2})/);
      return m ? { date: m[1], time: m[2] } : { date: '', time: '' };
    }
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
    return {
      date: `${get('year')}-${get('month')}-${get('day')}`,
      time: `${get('hour')}:${get('minute')}`,
    };
  } catch {
    return { date: '', time: '' };
  }
}

function composeAddress(form: EditForm) {
  const flat = form.flat_number.trim();
  const area = form.pickup_address.trim();
  const landmarkRaw = form.landmark.trim().replace(/^Near\s+/i, '');
  const city = form.city.trim();
  const pin = form.pincode.trim();
  return [flat, area, landmarkRaw ? `Near ${landmarkRaw}` : '', [city, pin].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
}

/** No plan selected → full category pricing; default Periodic (all 4 tiers). */
function inferLeadPricingCategories(meta: any, serviceType?: string | null): string[] {
  const hints = [
    meta?.booking_type,
    meta?.package_label,
    meta?.interest_label,
    serviceType,
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  for (const hint of hints) {
    const u = hint.toUpperCase();
    if (u.includes('PERIODIC')) return ['Car Periodic Service'];
    if (u.includes('AC')) return ['Car AC Service'];
    if (u.includes('BATTERY')) return ['Car Battery Service'];
    if (u.includes('BRAKE')) return ['Car Brake Service'];
    if (u.includes('CLUTCH')) return ['Car Clutch Service'];
    if (u.includes('DENT')) return ['Car Denting & Painting'];
    if (u.includes('DETAIL')) return ['Car Detailing Service'];
    if (u.includes('ENGINE')) return ['Car Engine Service'];
    if (u.includes('TYRE') || u.includes('WHEEL')) return ['Car Tyre & Wheel Care'];
  }
  return ['Car Periodic Service'];
}

function parseComposedAddress(
  raw: string,
  meta: any,
  city?: string,
  pincode?: string,
): { flat: string; area: string; landmark: string } {
  let flat = String(meta?.flat_number || '').trim();
  let landmark = String(meta?.landmark || '')
    .trim()
    .replace(/^Near\s+/i, '');
  let area = String(meta?.area || '').trim();
  if (area) return { flat, area, landmark };

  let s = String(raw || meta?.pickup_address || '')
    .replace(/\s*\((home|work|other)\)/gi, '')
    .trim();
  const nearM = s.match(/,?\s*Near\s+(.+?)(?=,|$)/i);
  if (nearM) {
    if (!landmark) landmark = nearM[1].trim().replace(/^Near\s+/i, '');
    s = s.replace(nearM[0], ',');
  }
  if (city) {
    s = s.replace(new RegExp(`,?\\s*${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig'), '');
  }
  const pin = String(pincode || '').trim();
  if (pin) s = s.replace(new RegExp(`\\b${pin}\\b`, 'g'), '');
  s = s
    .replace(/\b\d{6}\b/g, '')
    .replace(/,{2,}/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();
  const parts = s
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (!flat && parts.length >= 2 && /^(flat\s*)?\d+[A-Za-z0-9\/\-]*$/i.test(parts[0])) {
    flat = parts[0].replace(/^flat\s*/i, '');
    area = parts.slice(1).join(', ');
  } else if (flat && parts[0] === flat) {
    area = parts.slice(1).join(', ');
  } else {
    area = parts.join(', ');
  }
  area = area
    .replace(/,?\s*Near\s+.+$/i, '')
    .replace(/,{2,}/g, ',')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();
  return { flat, area, landmark };
}

function buildFormFromLead(data: any): EditForm {
  const meta = data?.coupon_meta && typeof data.coupon_meta === 'object' ? data.coupon_meta : {};
  const slot = parseSlot(data?.preferred_slot_start);
  const cityName = data?.city || '';
  const pin = String(data?.pincode || meta.pincode || '')
    .replace(/\D/g, '')
    .slice(0, 6);
  const parsed = parseComposedAddress(
    String(data?.pickup_address || data?.customer_address || ''),
    meta,
    cityName,
    pin,
  );
  return {
    customer_name: data?.customer_name || '',
    customer_phone: String(data?.customer_phone || '')
      .replace(/\D/g, '')
      .slice(-10),
    customer_alternate_phone: data?.customer_alternate_phone || '',
    customer_email: data?.customer_email || '',
    city_id: data?.city_id || '',
    city: cityName,
    pincode: pin,
    vehicle_number: data?.vehicle_number || '',
    vehicle_make: data?.vehicle_make || '',
    model_id: data?.model_id || '',
    vehicle_model: data?.vehicle_model || '',
    vehicle_class: data?.vehicle_class || meta.vehicle_class || '',
    vehicle_fuel_type: data?.vehicle_fuel_type || '',
    vehicle_year: data?.vehicle_year?.toString() || '',
    odometer_km: data?.odometer_km?.toString() || '',
    service_types: parseIds(data?.service_type_ids),
    service_addons: parseIds(data?.subservice_ids),
    problem_description: data?.problem_description || '',
    pickup_required: data?.pickup_required !== false,
    pickup_address: parsed.area,
    address_type: (meta.address_type as any) || 'home',
    flat_number: parsed.flat,
    landmark: parsed.landmark,
    pickup_date: meta.pickup_date || slot.date,
    pickup_time: meta.pickup_time || slot.time,
    workshop_id: data?.workshop_id || '',
    workshop_name: data?.workshop?.name || '',
    lead_priority: data?.lead_priority || 'NORMAL',
  };
}

function servicesIdsChanged(
  aTypes: string[],
  bTypes: string[],
  aAddons: string[],
  bAddons: string[],
) {
  const sorted = (ids: string[]) => [...ids].map(String).sort().join('|');
  return sorted(aTypes) !== sorted(bTypes) || sorted(aAddons) !== sorted(bAddons);
}

type CallDisposition = {
  id: string;
  label: string;
  call_status: string;
  outcome: string | null;
  lead_status?: string | null;
  requires_follow_up?: boolean;
  requires_lost_reason?: boolean;
};

const RINGING: CallDisposition = {
  id: 'RINGING',
  label: 'Ringing',
  call_status: 'NO_ANSWER',
  outcome: null,
};

const DEFAULT_STATUS_OPTIONS: CallDisposition[] = [
  { id: 'FRESH', label: 'Fresh', call_status: 'ANSWERED', outcome: 'INFO_COLLECTED' },
  { id: 'INTERESTED', label: 'Interested', call_status: 'ANSWERED', outcome: 'INFO_COLLECTED' },
  { id: 'WILL_VISIT', label: 'He will visit', call_status: 'ANSWERED', outcome: 'INFO_COLLECTED' },
  {
    id: 'CALLBACK',
    label: 'Follow-up',
    call_status: 'ANSWERED',
    outcome: 'INFO_COLLECTED',
    requires_follow_up: true,
  },
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
    requires_lost_reason: true,
  },
];

const DEFAULT_LOST_REASONS = [
  'Not Interested',
  'Unqualified Lead',
  'No-Response to Calls',
  'Already Service Done',
  'Under Warranty',
  'Looking For Authorised Service Center',
  'Other Reasons',
];

function combineDateAndTime(dateYmd: string, timeHm: string): string | null {
  if (!dateYmd && !timeHm) return null;
  const now = new Date();
  const ymd =
    dateYmd ||
    [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
  const hm =
    timeHm ||
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const iso = new Date(`${ymd}T${hm}:00`);
  if (Number.isNaN(iso.getTime())) return null;
  return iso.toISOString();
}

function formatDisplayDate(ymd: string): string {
  if (!ymd) return 'Select date';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return formatDateDMY(new Date(y, m - 1, d)) || ymd;
}

function formatDisplayTime(hm: string): string {
  if (!hm) return 'Select time';
  const [hStr, mStr] = hm.split(':');
  let h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function TelecallerLeadDetailScreen({
  route,
  navigation,
  embedded = false,
  initialEditing = true,
  showLeadIq: showLeadIqProp,
}: any) {
  const { user, userProfile } = useAuth();
  const { leadId } = route.params;
  const roleCode = String(userProfile?.role?.role_code || '').toUpperCase();
  const showLeadIq =
    showLeadIqProp === true ||
    (showLeadIqProp !== false &&
      (roleCode === 'LEAD_MANAGER' || roleCode === 'SUPER_ADMIN' || roleCode === 'SUB_ADMIN'));
  const canSeeMlDl = showLeadIq;

  const [lead, setLead] = useState<any>(null);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [timelineItems, setTimelineItems] = useState<any[]>([]);
  const [activityShowAll, setActivityShowAll] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [appActivityItems, setAppActivityItems] = useState<any[]>([]);
  const [appActivityLoading, setAppActivityLoading] = useState(false);
  const [appActivityShowAll, setAppActivityShowAll] = useState(false);
  const [leadIq, setLeadIq] = useState<any>(null);
  const [leadIqRunning, setLeadIqRunning] = useState(false);
  const [playingCallLogId, setPlayingCallLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(true);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showLostMenu, setShowLostMenu] = useState(false);
  const [serviceTypeNames, setServiceTypeNames] = useState<string[]>([]);
  const [subserviceNames, setSubserviceNames] = useState<string[]>([]);
  const [pricingItems, setPricingItems] = useState<Array<{ name: string; price: number }>>([]);
  const [couponInput, setCouponInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingPricing, setSendingPricing] = useState(false);
  const [showWaChat, setShowWaChat] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm);
  const [carDisplay, setCarDisplay] = useState('');
  const [showSecondCar, setShowSecondCar] = useState(false);
  const [secondCar, setSecondCar] = useState<CrmSecondCar>(emptySecondCar());
  const [secondCarDisplay, setSecondCarDisplay] = useState('');
  const [referredBy, setReferredBy] = useState<CrmReferredBy | null>(null);
  const [referredTo, setReferredTo] = useState<
    { id: string; lead_number: string; customer_name: string; customer_phone: string }[]
  >([]);
  const [referrerQuery, setReferrerQuery] = useState('');
  const [referrerHits, setReferrerHits] = useState<CrmReferrerSearchHit[]>([]);
  const [referrerSearching, setReferrerSearching] = useState(false);
  const [cities, setCities] = useState<any[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [couponMeta, setCouponMeta] = useState<any>({});
  const [initialServiceTypes, setInitialServiceTypes] = useState<string[]>([]);
  const [initialServiceAddons, setInitialServiceAddons] = useState<string[]>([]);
  const [pinWorkshops, setPinWorkshops] = useState<any[]>([]);
  const [loadingPinWs, setLoadingPinWs] = useState(false);
  const [showAllWorkshops, setShowAllWorkshops] = useState(false);
  const [profileHistory, setProfileHistory] = useState<any[]>([]);

  const [activityData, setActivityData] = useState({
    result: 'RINGING',
    lostReason: '',
    notes: '',
    date: '',
    time: '',
  });
  const [statusOptions, setStatusOptions] =
    useState<CallDisposition[]>(DEFAULT_STATUS_OPTIONS);
  const [lostReasons, setLostReasons] = useState<string[]>(DEFAULT_LOST_REASONS);

  const setEditField = (key: keyof EditForm, value: any) =>
    setEditForm((prev) => ({ ...prev, [key]: value }));

  const lastPhoneLookupRef = React.useRef<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<any>('/api/lead-manager/statuses');
        const rows = Array.isArray(data?.statuses) ? data.statuses : [];
        if (!cancelled && rows.length) {
          const mapped: CallDisposition[] = rows
            .filter((r: any) => String(r.code || '').toUpperCase() !== 'RINGING')
            .map((r: any) => ({
              id: String(r.code || '').toUpperCase(),
              label: String(r.name || r.code),
              call_status: String(r.call_status || 'ANSWERED').toUpperCase(),
              outcome: r.outcome ? String(r.outcome).toUpperCase() : null,
              lead_status: r.pipeline_status ? String(r.pipeline_status).toUpperCase() : null,
              requires_follow_up: Boolean(r.requires_follow_up),
              requires_lost_reason:
                Boolean(r.requires_lost_reason) || String(r.code).toUpperCase() === 'LOST',
            }));
          if (mapped.length) setStatusOptions(mapped);
        }
        const reasons = Array.isArray(data?.lost_reasons) ? data.lost_reasons : [];
        if (!cancelled && reasons.length) {
          setLostReasons(
            reasons.map((r: any) => String(r.name || '').trim()).filter(Boolean),
          );
        }
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const term = referrerQuery.trim();
    if (term.length < 4) {
      setReferrerHits([]);
      return;
    }
    const t = setTimeout(() => {
      setReferrerSearching(true);
      apiFetch<any>(
        `/api/telecaller/crm/lead-reference?q=${encodeURIComponent(term)}&exclude=${encodeURIComponent(String(leadId || ''))}`,
      )
        .then((json) => setReferrerHits(Array.isArray(json?.results) ? json.results : []))
        .catch(() => setReferrerHits([]))
        .finally(() => setReferrerSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [referrerQuery, leadId]);

  const lookupCustomerByPhone = async (phoneRaw: string) => {
    const phone10 = String(phoneRaw || '')
      .replace(/\D/g, '')
      .slice(-10);
    if (phone10.length !== 10 || phone10 === lastPhoneLookupRef.current) return;
    lastPhoneLookupRef.current = phone10;
    try {
      const res = await apiFetch<any>(`/api/telecaller/crm/customer-lookup?phone=${phone10}`);
      if (!res?.found || !res?.fill) return;
      const fill = res.fill;
      setEditForm((prev) => {
        const empty = (v: string) => !String(v || '').trim();
        const next = { ...prev };
        if (empty(next.customer_name) && fill.customer_name) next.customer_name = String(fill.customer_name);
        if (empty(next.customer_email) && fill.customer_email) next.customer_email = String(fill.customer_email);
        if (empty(next.vehicle_number) && fill.vehicle_number) {
          next.vehicle_number = String(fill.vehicle_number);
        }
        if (empty(next.vehicle_make) && fill.vehicle_make) next.vehicle_make = String(fill.vehicle_make);
        if (empty(next.vehicle_model) && fill.vehicle_model) next.vehicle_model = String(fill.vehicle_model);
        if (empty(next.city) && fill.city) next.city = String(fill.city);
        if (empty(next.city_id) && fill.city_id) next.city_id = String(fill.city_id);
        if (empty(next.pincode) && fill.pincode) next.pincode = String(fill.pincode);
        if (
          empty(next.pickup_address) &&
          empty(next.flat_number) &&
          (fill.customer_address || fill.pickup_address)
        ) {
          const addr = String(fill.pickup_address || fill.customer_address);
          const parsed = parseComposedAddress(addr, fill, fill.city, fill.pincode);
          if (parsed.flat) next.flat_number = parsed.flat;
          if (parsed.area) next.pickup_address = parsed.area;
          if (parsed.landmark) next.landmark = parsed.landmark;
        }
        return next;
      });
      if (fill.vehicle_make || fill.vehicle_model) {
        setCarDisplay([fill.vehicle_make, fill.vehicle_model].filter(Boolean).join(' '));
      }
    } catch {
      /* ignore */
    }
  };

  // Direct list — no search / cityQuery (tap to select)
  const cityOptions = cities;

  const pickupValue: CrmPickupVisitValue = {
    pickup_required: editForm.pickup_required,
    vehicle_number: editForm.vehicle_number,
    pickup_date: editForm.pickup_date,
    pickup_time: editForm.pickup_time,
    pickup_address: editForm.pickup_address,
    address_type: editForm.address_type,
    flat_number: editForm.flat_number,
    landmark: editForm.landmark,
    workshop_id: editForm.workshop_id,
    workshop_name: editForm.workshop_name,
  };

  const seedEditForm = (data: any) => {
    const next = buildFormFromLead(data);
    setEditForm(next);
    setCarDisplay([next.vehicle_make, next.vehicle_model].filter(Boolean).join(' '));
    const phone10 = String(next.customer_phone || '')
      .replace(/\D/g, '')
      .slice(-10);
    if (phone10.length === 10) lastPhoneLookupRef.current = phone10;
    const meta = data?.coupon_meta && typeof data.coupon_meta === 'object' ? data.coupon_meta : {};
    setCouponMeta(meta);
    setReferredBy(parseReferredBy(meta));
    void apiFetch<any>(`/api/telecaller/crm/lead-reference?lead_id=${encodeURIComponent(String(data?.id || ''))}`)
      .then((json) => {
        if (json?.referred_by) setReferredBy(json.referred_by);
        setReferredTo(Array.isArray(json?.referred_to) ? json.referred_to : []);
      })
      .catch(() => setReferredTo([]));
    const existingSecond = parseSecondCar(meta);
    if (existingSecond) {
      setShowSecondCar(true);
      setSecondCar(existingSecond);
      setSecondCarDisplay([existingSecond.vehicle_make, existingSecond.vehicle_model].filter(Boolean).join(' '));
    } else {
      setShowSecondCar(false);
      setSecondCar(emptySecondCar());
      setSecondCarDisplay('');
    }
    setInitialServiceTypes(next.service_types);
    setInitialServiceAddons(next.service_addons);
    const hist = Array.isArray(meta.profile_history) ? meta.profile_history : [];
    setProfileHistory(hist);
  };

  /** Fill city_id / vehicle_class so package prices can resolve (Wagon R etc.). */
  const enrichEditFormForPricing = async (data: any) => {
    const base = buildFormFromLead(data);
    let cityId = String(base.city_id || '').trim();
    let modelId = String(base.model_id || '').trim();
    let vehicleClass = String(base.vehicle_class || '').trim();
    const cityName = String(base.city || '').trim();

    if (!cityId && cityName) {
      try {
        const { data: cityRow } = await supabase
          .from('cities')
          .select('id')
          .eq('is_active', true)
          .ilike('name', cityName)
          .limit(1)
          .maybeSingle();
        if (cityRow?.id) cityId = String(cityRow.id);
      } catch {
        /* ignore */
      }
    }

    if (!vehicleClass && modelId) {
      vehicleClass = (await resolveVehicleClass(modelId)) || '';
    }
    if ((!vehicleClass || !modelId) && base.vehicle_make && base.vehicle_model) {
      const hit = await resolveVehicleClassByMakeModel(base.vehicle_make, base.vehicle_model);
      if (hit.class) vehicleClass = hit.class;
      if (hit.id) modelId = hit.id;
    }

    if (!cityId && !vehicleClass && !modelId) return;
    setEditForm((prev) => ({
      ...prev,
      ...(cityId ? { city_id: cityId } : {}),
      ...(modelId ? { model_id: modelId } : {}),
      ...(vehicleClass ? { vehicle_class: vehicleClass } : {}),
    }));
  };

  const cancelEditing = () => {
    setEditing(false);
    setCityOpen(false);
    navigation?.goBack?.();
  };

  const saveLeadEdits = async () => {
    if (!leadId) return;
    if (!editForm.customer_name.trim()) {
      Alert.alert('Missing info', 'Customer name required');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(editForm.customer_phone.replace(/\D/g, ''))) {
      Alert.alert('Missing info', 'Valid 10-digit phone required');
      return;
    }
    if (crmDispositionNeedsFullProfile(activityData.result)) {
      if (!editForm.city_id && !editForm.city) {
        Alert.alert('Missing info', 'City required');
        return;
      }
      if (!editForm.vehicle_make || !editForm.vehicle_model) {
        Alert.alert('Missing info', 'Select car model');
        return;
      }
      if (showSecondCar && (!secondCar.vehicle_make || !secondCar.vehicle_model)) {
        Alert.alert('Missing info', 'Select second car model');
        return;
      }
    }

    const bookingConfirmed = activityData.result === 'BOOKING_CONFIRMED';
    // Service plan required only when confirming booking — soft leads can save without plan
    if (bookingConfirmed && editForm.service_types.length === 0) {
      Alert.alert('Missing info', 'Select at least one service to confirm booking');
      return;
    }
    if (bookingConfirmed) {
      if (!editForm.vehicle_number.trim()) {
        Alert.alert('Missing info', 'Registration required');
        return;
      }
      if (editForm.pickup_required) {
        if (!editForm.pickup_date || !editForm.pickup_time) {
          Alert.alert('Missing info', 'Select date & time');
          return;
        }
        if (editForm.pickup_address.trim().length < 4) {
          Alert.alert('Missing info', 'Address required');
          return;
        }
        if (editForm.landmark.trim().length < 2) {
          Alert.alert('Missing info', 'Landmark required');
          return;
        }
      } else if (!editForm.workshop_id) {
        Alert.alert('Missing info', 'Select a workshop');
        return;
      }
    }
    const selectedForSave =
      statusOptions.find((r) => r.id === activityData.result) || RINGING;
    if (
      (activityData.result === 'CALLBACK' || selectedForSave.requires_follow_up) &&
      (!activityData.date || !activityData.time)
    ) {
      Alert.alert('Follow-up time', 'Follow-up ke liye date aur time dono select karo.');
      return;
    }

    setSaving(true);
    try {
      const start = slotIso(editForm.pickup_date, editForm.pickup_time);
      const endHour = editForm.pickup_time
        ? `${String(Number(editForm.pickup_time.split(':')[0]) + 1).padStart(2, '0')}:00`
        : '';
      const end = slotIso(editForm.pickup_date, endHour);
      const composed = editForm.pickup_required ? composeAddress(editForm) : editForm.pickup_address;
      const nextMeta = {
        ...couponMeta,
        address_type: editForm.address_type,
        flat_number: editForm.flat_number || null,
        landmark: editForm.landmark.replace(/^Near\s+/i, '') || null,
        area: editForm.pickup_address || null,
        pickup_date: editForm.pickup_date || null,
        pickup_time: editForm.pickup_time || null,
        pickup_address: editForm.pickup_address || null,
        vehicle_class: editForm.vehicle_class || null,
        second_car: showSecondCar ? serializeSecondCar(secondCar) : null,
        referred_by: serializeReferredBy(referredBy),
        first_message: couponMeta.first_message || lead?.problem_description || null,
        last_inbound_message:
          couponMeta.last_inbound_message ||
          couponMeta.first_message ||
          lead?.problem_description ||
          null,
        telecaller_remarks: activityData.notes.trim() || couponMeta.telecaller_remarks || null,
      };

      let dispositionStatus: string | null = null;
      if (activityData.result !== 'RINGING') {
        const selected =
          statusOptions.find((r) => r.id === activityData.result) || RINGING;
        const statusLabel =
          selected.id === 'LOST'
            ? `Lost · ${activityData.lostReason.trim() || 'Other Reasons'}`
            : selected.label;
        nextMeta.last_call_status = selected.call_status;
        nextMeta.last_call_result = selected.id;
        nextMeta.last_call_label = statusLabel;
        nextMeta.last_lost_reason =
          selected.id === 'LOST' ? activityData.lostReason.trim() || 'Other Reasons' : null;
        nextMeta.last_call_at = new Date().toISOString();
        if (selected.lead_status) dispositionStatus = selected.lead_status;
      }
      const servicesChangedLocal = servicesIdsChanged(
        initialServiceTypes,
        editForm.service_types,
        initialServiceAddons,
        editForm.service_addons,
      );

      const changeBits: string[] = [];
      if (lead?.customer_name !== editForm.customer_name.trim()) changeBits.push('name');
      if (String(lead?.customer_phone || '').slice(-10) !== editForm.customer_phone) changeBits.push('phone');
      if (String(lead?.city || '') !== String(editForm.city || '')) changeBits.push('city');
      if (String(lead?.pincode || '') !== String(editForm.pincode || '')) changeBits.push('pincode');
      if (String(lead?.vehicle_number || '') !== String(editForm.vehicle_number || '')) {
        changeBits.push('registration');
      }
      if (
        String(lead?.vehicle_make || '') !== editForm.vehicle_make ||
        String(lead?.vehicle_model || '') !== editForm.vehicle_model
      ) {
        changeBits.push('vehicle');
      }
      if (String(lead?.workshop_id || '') !== String(editForm.workshop_id || '')) changeBits.push('workshop');
      if (servicesChangedLocal) changeBits.push('services');
      if (activityData.result !== 'RINGING') {
        const lbl =
          statusOptions.find((r) => r.id === activityData.result)?.label || activityData.result;
        changeBits.push(lbl);
      }
      if (bookingConfirmed) changeBits.push('booking');

      const historyEntry = {
        at: new Date().toISOString(),
        summary: changeBits.length ? `Updated ${changeBits.join(', ')}` : 'Profile updated',
        remark: activityData.notes.trim() || null,
        status: activityData.result !== 'RINGING' ? activityData.result : null,
        workshop_id: editForm.workshop_id || null,
        workshop_name: editForm.workshop_name || null,
        city: editForm.city || null,
        pincode: editForm.pincode || null,
      };
      const prevHistory = Array.isArray(couponMeta.profile_history) ? couponMeta.profile_history : [];
      nextMeta.profile_history = [historyEntry, ...prevHistory].slice(0, 50);

      let quotePayload: any = null;
      const hasServices =
        editForm.service_types.length > 0 || editForm.service_addons.length > 0;
      if (hasServices) {
        try {
          const quoteRes = await apiFetch<any>('/api/telecaller/crm/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              service_type_ids: editForm.service_types,
              addon_ids: editForm.service_addons,
              city_id: editForm.city_id || null,
              workshop_id: editForm.pickup_required ? null : editForm.workshop_id || null,
              vehicle_class: editForm.vehicle_class || null,
            }),
          });
          quotePayload = quoteRes?.quote || null;
        } catch (e) {
          console.warn('[LeadDetail] quote failed', e);
        }
      }

      const payload = {
        customer_name: editForm.customer_name.trim(),
        customer_phone: editForm.customer_phone.replace(/\D/g, '').slice(-10),
        customer_alternate_phone: editForm.customer_alternate_phone || null,
        customer_email: editForm.customer_email || null,
        customer_address: composed || editForm.pickup_address,
        city_id: editForm.city_id || null,
        city: editForm.city || null,
        pincode: editForm.pincode || null,
        vehicle_number: serviceLeadVehicleNumber(editForm.vehicle_number, lead?.vehicle_number),
        vehicle_make: editForm.vehicle_make,
        model_id: editForm.model_id || null,
        vehicle_model: editForm.vehicle_model,
        vehicle_fuel_type: editForm.vehicle_fuel_type,
        vehicle_year: editForm.vehicle_year ? parseInt(editForm.vehicle_year, 10) : null,
        odometer_km: editForm.odometer_km ? parseInt(editForm.odometer_km, 10) : null,
        vehicle_class: editForm.vehicle_class || null,
        service_types: editForm.service_types,
        service_addons: editForm.service_addons,
        problem_description:
          lead?.problem_description ||
          couponMeta.last_inbound_message ||
          couponMeta.first_message ||
          null,
        pickup_required: editForm.pickup_required,
        pickup_address: editForm.pickup_required ? composed : null,
        workshop_id: editForm.workshop_id || null,
        lead_priority: editForm.lead_priority || 'NORMAL',
        preferred_slot_start: start,
        preferred_slot_end: end,
        coupon_meta: nextMeta,
        quote: quotePayload,
        estimated_amount: Number(quotePayload?.total || 0) || undefined,
        force_requote: servicesChangedLocal,
        service_type:
          (quotePayload?.line_items || [])
            .map((i: any) => String(i?.name || '').trim())
            .filter(Boolean)
            .join(', ') || undefined,
        ...(dispositionStatus ? { status: dispositionStatus } : {}),
        // booking_confirmed WhatsApp ONLY when status = Booking confirmed
        send_booking_confirmed_whatsapp: bookingConfirmed,
        // Never auto-fire update WA for Interested / Lost / etc.
        send_booking_updated_whatsapp: false,
      };

      let result: { success?: boolean; servicesChanged?: boolean; whatsapp?: any } | null = null;
      try {
        result = await apiFetch(`/api/telecaller/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (apiErr: any) {
        console.warn('[LeadDetail] API failed, falling back', apiErr?.message);
        const serviceLabel =
          payload.service_type ||
          (quotePayload?.line_items || [])
            .map((i: any) => String(i?.name || '').trim())
            .filter(Boolean)
            .join(', ');
        const { error } = await supabase
          .from('service_leads')
          .update({
            customer_name: payload.customer_name,
            customer_phone: payload.customer_phone,
            customer_alternate_phone: payload.customer_alternate_phone,
            customer_email: payload.customer_email,
            customer_address: payload.customer_address,
            city_id: payload.city_id,
            city: payload.city,
            pincode: payload.pincode,
            vehicle_number: payload.vehicle_number,
            vehicle_make: payload.vehicle_make,
            model_id: payload.model_id,
            vehicle_model: payload.vehicle_model,
            vehicle_fuel_type: payload.vehicle_fuel_type,
            vehicle_year: payload.vehicle_year,
            odometer_km: payload.odometer_km,
            service_type_ids: JSON.stringify(payload.service_types),
            subservice_ids: JSON.stringify(payload.service_addons),
            ...(serviceLabel ? { service_type: serviceLabel } : {}),
            ...(Number(quotePayload?.total || 0) > 0
              ? {
                  estimated_amount: Number(quotePayload.total),
                  discount_amount: Number(quotePayload.discount || 0) || 0,
                }
              : {}),
            problem_description: payload.problem_description,
            pickup_required: payload.pickup_required,
            pickup_address: payload.pickup_address,
            workshop_id: payload.workshop_id,
            preferred_slot_start: payload.preferred_slot_start,
            preferred_slot_end: payload.preferred_slot_end,
            coupon_meta: {
              ...payload.coupon_meta,
              ...(serviceLabel ? { package_label: serviceLabel } : {}),
            },
            ...(dispositionStatus ? { status: dispositionStatus } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId);
        if (error) throw apiErr;
        result = { success: true, servicesChanged: servicesChangedLocal };
      }

      const whatsapp = result?.whatsapp;
      const waNote =
        bookingConfirmed && whatsapp?.sent
          ? '\nBooking confirmation sent on WhatsApp.'
          : bookingConfirmed
            ? '\nBooking saved — WhatsApp confirmation not sent.'
            : '';

      // Persist activity disposition when set during edit
      if (activityData.result !== 'RINGING') {
        try {
          const selected =
            activityData.result === 'RINGING'
              ? RINGING
              : statusOptions.find((r) => r.id === activityData.result) || RINGING;
          const statusLabel =
            selected.requires_lost_reason || selected.id === 'LOST'
              ? `Lost · ${activityData.lostReason}`
              : selected.label;
          const whenIso =
            selected.requires_follow_up || selected.id === 'CALLBACK'
              ? combineDateAndTime(activityData.date, activityData.time)
              : null;
          if ((selected.requires_follow_up || selected.id === 'CALLBACK') && !whenIso) {
            Alert.alert('Follow-up time', 'Follow-up ke liye date aur time dono select karo.');
            setSaving(false);
            return;
          }
          const notesParts = [
            `[${statusLabel}]`,
            activityData.notes.trim() || null,
          ].filter(Boolean);
          await apiFetch('/api/telecaller/calls/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lead_id: leadId,
              call_type: 'OUTBOUND',
              call_status: selected.call_status,
              call_duration: null,
              outcome: selected.outcome,
              activity: selected.id,
              pipeline_status: selected.lead_status || null,
              notes: notesParts.join(' '),
              phone_number: editForm.customer_phone || lead?.customer_phone,
              next_action: whenIso ? 'FOLLOW_UP' : null,
              next_action_time: whenIso,
            }),
          });
          const nextCallMeta = {
            ...nextMeta,
            last_call_status: selected.call_status,
            last_call_result: selected.id,
            last_call_label: statusLabel,
            last_lost_reason:
              selected.requires_lost_reason || selected.id === 'LOST'
                ? activityData.lostReason
                : null,
            last_call_at: new Date().toISOString(),
          };
          const leadUpdate: Record<string, unknown> = {
            last_call_at: new Date().toISOString(),
            total_calls: (lead?.total_calls || 0) + 1,
            coupon_meta: nextCallMeta,
            updated_at: new Date().toISOString(),
          };
          if (selected.lead_status) leadUpdate.status = selected.lead_status;
          if (whenIso) {
            leadUpdate.follow_up_required = true;
            leadUpdate.next_follow_up_at = whenIso;
          }
          await supabase.from('service_leads').update(leadUpdate).eq('id', leadId);

          if (whenIso) {
            const { data: profile } = await supabase
              .from('users_login')
              .select('id')
              .eq('email', user?.email)
              .single();
            await supabase
              .from('telecaller_follow_ups')
              .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
              .eq('lead_id', leadId)
              .eq('status', 'PENDING');
            await supabase.from('telecaller_follow_ups').insert([
              {
                lead_id: leadId,
                telecaller_id: profile?.id,
                follow_up_type: 'CALLBACK',
                scheduled_time: whenIso,
                reason: activityData.notes || statusLabel,
                priority: 'NORMAL',
                status: 'PENDING',
              },
            ]);
          }
        } catch (actErr) {
          console.warn('[LeadDetail] activity log during save failed', actErr);
        }
      }

      setActivityData({
        result: 'RINGING',
        lostReason: '',
        notes: '',
        date: '',
        time: '',
      });
      setEditing(true);
      await fetchLeadDetails();
      void fetchActivityTimeline();
      Alert.alert('Updated', `Lead saved successfully.${waNote}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  const selectedResult: CallDisposition =
    activityData.result === 'RINGING'
      ? RINGING
      : statusOptions.find((r) => r.id === activityData.result) || RINGING;

  const activityItems = React.useMemo(() => {
    type Item = {
      id: string;
      kind: 'call' | 'update' | 'followup' | 'other';
      callLogId: string;
      hasRecording: boolean;
      sortAt: string;
      title: string;
      notes: string;
      badgeColor: string;
      timeLabel: string;
      noRecordingYet: boolean;
    };

    const dedupeKey = (title: string, at: string) =>
      `${String(title || '')
        .trim()
        .toLowerCase()
        .slice(0, 80)}|${String(at || '').slice(0, 16)}`;

    const seen = new Set<string>();
    const pushUnique = (list: Item[], item: Item) => {
      const key = dedupeKey(item.title, item.sortAt || '');
      if (seen.has(key)) return;
      seen.add(key);
      list.push(item);
    };

    const out: Item[] = [];

    // 1) CRM timeline (calls + system + hist from API)
    for (const item of timelineItems || []) {
      const isCall = item.kind === 'call';
      const callLogId = String(item?.meta?.call_log_id || '').trim();
      const hasRecording =
        (Boolean(item?.meta?.call_recording_url) ||
          Boolean(item?.meta?.has_call_recording)) &&
        Boolean(callLogId);
      const isHist =
        String(item.id || '').startsWith('hist-') ||
        item.kind === 'system' ||
        item.kind === 'booking';
      pushUnique(out, {
        id: String(item.id || `${item.kind}-${item.at}`),
        kind: isCall ? 'call' : isHist ? 'update' : 'other',
        callLogId,
        hasRecording,
        sortAt: String(item.at || ''),
        title: String(item.title || 'Update'),
        notes: String(item.body || '')
                .replace(/\[Smartflo\]\s*/gi, '')
                .replace(/\bSmartflo\b/gi, '')
                .trim(),
        badgeColor: isCall
          ? getCallStatusColor(item?.meta?.call_status, item?.meta?.outcome)
          : COLORS.orange + '22',
        timeLabel: item.at
          ? `${formatDateTime(item.at)}${item?.meta?.by ? ` · ${item.meta.by}` : ''}`
          : '',
        noRecordingYet: isCall && !hasRecording,
      });
    }

    // 2) Local User History (coupon_meta.profile_history) — merge into Activity
    for (let i = 0; i < (profileHistory || []).length; i++) {
      const h = profileHistory[i] || {};
      const at = String(h.at || '').trim();
      if (!at) continue;
      const title = String(h.summary || h.event || 'Updated').slice(0, 80);
      const notes = h.remark ? String(h.remark).trim() : '';
      pushUnique(out, {
        id: `hist-local-${i}-${at}`,
        kind: 'update',
        callLogId: '',
        hasRecording: false,
        sortAt: at,
        title,
        notes,
        badgeColor: COLORS.orange + '22',
        timeLabel: formatDateTime(at),
        noRecordingYet: false,
      });
    }

    // 3) Call logs fallback / fill gaps when timeline empty or missing a log
    for (const log of callLogs || []) {
      const id = String(log.id || '');
      if (id && out.some((x) => x.callLogId === id)) continue;
      const hasRecording =
        Boolean(log.call_recording_url) || Boolean(log.has_call_recording);
      pushUnique(out, {
        id: `call-${id || log.created_at}`,
        kind: 'call',
        callLogId: id,
        hasRecording,
        sortAt: String(log.created_at || ''),
        title: formatCallLogLabel(log.call_status, log.outcome, log.notes),
        notes: stripDispositionPrefix(log.notes || ''),
        badgeColor: getCallStatusColor(log.call_status, log.outcome),
        timeLabel: formatDateTime(log.created_at),
        noRecordingYet: !hasRecording,
      });
    }

    for (const fu of followUps || []) {
      pushUnique(out, {
        id: `fu-${fu.id}`,
        kind: 'followup',
        callLogId: '',
        hasRecording: false,
        sortAt: String(fu.scheduled_time || fu.created_at || ''),
        title: 'Follow-up',
        notes: fu.reason || '',
        badgeColor: COLORS.primary + '22',
        timeLabel: fu.scheduled_time
          ? `Due ${formatDateTime(fu.scheduled_time)}`
          : formatDateTime(fu.created_at),
        noRecordingYet: false,
      });
    }

    return out.sort(
      (a, b) => new Date(b.sortAt || 0).getTime() - new Date(a.sortAt || 0).getTime(),
    );
  }, [timelineItems, callLogs, followUps, profileHistory]);

  const fetchLeadIq = async () => {
    if (!leadId) return;
    try {
      const data = await apiFetch<any>(
        `/api/super_admin/lead-iq?lead_id=${encodeURIComponent(leadId)}`,
      );
      setLeadIq(data?.brief || null);
    } catch {
      setLeadIq(null);
    }
  };

  const generateLeadIq = async (deep: boolean) => {
    if (!leadId) return;
    setLeadIqRunning(true);
    try {
      const data = await apiFetch<any>('/api/super_admin/lead-iq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, deep }),
      });
      setLeadIq(data?.brief || null);
    } catch (e: any) {
      Alert.alert('Lead IQ', e?.message || 'Failed');
    } finally {
      setLeadIqRunning(false);
    }
  };

  const fetchActivityTimeline = async () => {
    if (!leadId) return;
    try {
      setTimelineLoading(true);
      setAppActivityLoading(true);
      const [data, appData] = await Promise.all([
        apiFetch<{ items?: any[] }>(
          `/api/telecaller/crm/lead-timeline?lead_id=${encodeURIComponent(leadId)}`,
        ),
        apiFetch<{ items?: any[] }>(
          `/api/super_admin/app-activity?lead_id=${encodeURIComponent(leadId)}`,
        ).catch(() => ({ items: [] })),
      ]);
      setTimelineItems(Array.isArray(data?.items) ? data.items : []);
      setAppActivityItems(Array.isArray(appData?.items) ? appData.items : []);
    } catch (error) {
      console.error('Error fetching activity timeline:', error);
      setTimelineItems([]);
      setAppActivityItems([]);
    } finally {
      setTimelineLoading(false);
      setAppActivityLoading(false);
    }
  };

  const customerMessage = React.useMemo(() => {
    const meta = lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
    return (
      extractInboundCustomerMessage(meta.last_inbound_message as string) ||
      extractInboundCustomerMessage(meta.first_message as string) ||
      extractInboundCustomerMessage(lead?.problem_description) ||
      ''
    );
  }, [lead]);

  const loadWorkshopsForPincode = async (pin: string, cityName?: string) => {
    const pincode = String(pin || '').replace(/\D/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(pincode)) {
      setPinWorkshops([]);
      return;
    }
    setLoadingPinWs(true);
    try {
      // Auto-fill city from pincode mapping when possible
      if (!cityName) {
        try {
          const { data: cityRows } = await supabase
            .from('cities')
            .select('id, name, city_pincodes')
            .eq('is_active', true);
          const hit = (cityRows || []).find((c: any) => {
            const raw = String(c.city_pincodes || '');
            return raw.includes(pincode);
          });
          if (hit?.name) {
            setEditForm((prev) => ({
              ...prev,
              city: hit.name,
              city_id: hit.id || prev.city_id,
              pincode,
            }));
            cityName = hit.name;
          }
        } catch {
          /* ignore */
        }
      }

      const params = new URLSearchParams();
      params.set('pincode', pincode);
      if (cityName) params.set('city', cityName);
      const apiData = await apiFetch<any>(`/api/telecaller/crm/workshops?${params.toString()}`).catch(
        () => null,
      );
      let list = Array.isArray(apiData?.workshops) ? apiData.workshops : [];
      if (list.length === 0) {
        const [{ data: rows }, { data: pageRows }] = await Promise.all([
          supabase
            .from('workshops')
            .select('id, name, workshop_name, workshop_area, near_famous_area, city, state, address, short_address, landmark, pincode, phone, is_verified')
            .eq('is_verified', true)
            .limit(80),
          supabase
            .from('workshop_public_pages')
            .select('workshop_id, gmb_data')
            .eq('is_published', true),
        ]);
        const gmbByWorkshop = new Map<string, Record<string, unknown>>();
        for (const page of (pageRows as any[]) || []) {
          const workshopId = String(page?.workshop_id || '').trim();
          const gmb = page?.gmb_data;
          if (workshopId && gmb && typeof gmb === 'object') {
            gmbByWorkshop.set(workshopId, gmb as Record<string, unknown>);
          }
        }
        list = (rows || []).map((w: any) => {
          const gmb = gmbByWorkshop.get(String(w.id)) || null;
          return {
            id: w.id,
            name: w.name || w.workshop_name,
            city: w.city,
            address: workshopPublicPageAddress(w, gmb),
            short_address: w.short_address,
            pincode: w.pincode,
            phone: w.phone,
          };
        });
        if (cityName) {
          list = list.filter((w: any) =>
            String(w.city || '').toLowerCase().includes(String(cityName).toLowerCase()),
          );
        }
      }
      setPinWorkshops(list.slice(0, 30));
    } catch {
      setPinWorkshops([]);
    } finally {
      setLoadingPinWs(false);
    }
  };

  useEffect(() => {
    if (!editing) return;
    const pin = String(editForm.pincode || '').trim();
    if (!/^\d{6}$/.test(pin)) {
      setPinWorkshops([]);
      return;
    }
    const t = setTimeout(() => {
      loadWorkshopsForPincode(pin, editForm.city || undefined);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, editForm.pincode, editForm.city]);

  useEffect(() => {
    if (!editing) return;
    const phone = String(editForm.customer_phone || '').replace(/\D/g, '').slice(-10);
    if (phone.length !== 10) return;
    const t = setTimeout(() => {
      void lookupCustomerByPhone(phone);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, editForm.customer_phone]);

  useEffect(() => {
    fetchLeadDetails();
    void fetchActivityTimeline();
    if (showLeadIq) void fetchLeadIq();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, showLeadIq]);

  useEffect(() => {
    if (!lead) return;
    seedEditForm(lead);
    setEditing(true);
    void enrichEditFormForPricing(lead);
    (async () => {
      if (cities.length > 0) return;
      try {
        const { data: cityRows } = await supabase
          .from('cities')
          .select('id, name, state')
          .eq('is_active', true)
          .order('name');
        setCities(cityRows || []);
      } catch {
        /* ignore */
      }
    })();
  }, [leadId, lead?.id]);

  // Handle hardware back button — leave the screen, don't just toggle edit mode.
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showWaChat) {
        setShowWaChat(false);
        return true;
      }
      if (showStatusMenu) {
        setShowStatusMenu(false);
        return true;
      }
      if (showLostMenu) {
        setShowLostMenu(false);
        return true;
      }
      if (embedded) {
        navigation?.goBack?.();
        return true;
      }
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
        return true;
      }
      navigation?.goBack?.();
      return true;
    });

    return () => backHandler.remove();
  }, [embedded, navigation, showWaChat, showStatusMenu, showLostMenu]);

  const fetchLeadDetails = async () => {
    let settled = false;
    const watchdog = setTimeout(() => {
      if (settled) return;
      setLoading(false);
      setRefreshing(false);
      setLoadError((prev) => prev || 'Taking too long. Check your connection and retry.');
    }, 12000);
    try {
      setLoadError(null);
      // Fetch lead
      const { data: leadData, error: leadError } = await withTimeout(
        Promise.resolve(
          supabase
            .from('service_leads')
            .select(`
          *,
          workshop:workshops(name, phone, city),
          created_by:created_by_id(full_name),
          assigned_telecaller:assigned_telecaller_id(full_name)
        `)
            .eq('id', leadId)
            .single(),
        ),
        10000,
        'Lead details',
      );

      if (leadError) throw leadError;
      const safeLead = redactLeadSourceForTelecaller(leadData as Record<string, any>);
      setLead(safeLead);
      const meta =
        safeLead?.coupon_meta && typeof safeLead.coupon_meta === 'object'
          ? safeLead.coupon_meta
          : {};
      setCouponMeta(meta);
      setProfileHistory(Array.isArray(meta.profile_history) ? meta.profile_history : []);

      // Pricing snapshot (line items) for display
      try {
        const { data: priceRows } = await supabase
          .from('lead_pricing_items')
          .select('item_name, total_price, unit_price')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: true });
        setPricingItems(
          (priceRows || []).map((r: any) => ({
            name: String(r.item_name || '').trim(),
            price: Number(r.total_price ?? r.unit_price ?? 0) || 0,
          })).filter((r: any) => r.name),
        );
      } catch {
        setPricingItems([]);
      }

      // Fetch service type names if service_type_ids exists
      if (leadData.service_type_ids) {
        try {
          const serviceIds = parseIds(leadData.service_type_ids);
          if (serviceIds.length > 0) {
            const { data: serviceTypesData } = await supabase
              .from('service_types')
              .select('id, name')
              .in('id', serviceIds);
            
            if (serviceTypesData?.length) {
              const byId = new Map(serviceTypesData.map((st: any) => [String(st.id), String(st.name || '')]));
              setServiceTypeNames(serviceIds.map((id) => byId.get(id) || '').filter(Boolean));
            } else if (leadData.service_type) {
              setServiceTypeNames(
                String(leadData.service_type)
                  .split(',')
                  .map((s: string) => s.trim())
                  .filter(Boolean),
              );
            }
          } else if (leadData.service_type) {
            setServiceTypeNames(
              String(leadData.service_type)
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean),
            );
          }
        } catch (e) {
          console.error('Error resolving service_type_ids:', e);
          if (leadData.service_type) {
            setServiceTypeNames(
              String(leadData.service_type)
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean),
            );
          }
        }
      } else if (leadData.service_type) {
        setServiceTypeNames(
          String(leadData.service_type)
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean),
        );
      }

      // Fetch subservice names if subservice_ids exists
      if (leadData.subservice_ids) {
        try {
          const subserviceIds = parseIds(leadData.subservice_ids);
          if (subserviceIds.length > 0) {
            const { data: subservicesData } = await supabase
              .from('service_addons')
              .select('id, name')
              .in('id', subserviceIds);
            
            if (subservicesData) {
              setSubserviceNames(subservicesData.map(sa => sa.name));
            }
          }
        } catch (e) {
          console.error('Error resolving subservice_ids:', e);
        }
      }

      // Fetch call logs via API (matches web behavior; mobile Bearer auth)
      try {
        const callData = await apiFetch<{ call_logs: any[]; total?: number }>(
          `/api/telecaller/calls/${leadId}`,
        );
        const logs = Array.isArray(callData.call_logs) ? callData.call_logs : [];
        setCallLogs(logs);
        const total = Number(callData.total ?? logs.length) || 0;
        setLead((prev: any) => (prev ? { ...prev, total_calls: total } : prev));
      } catch (err) {
        console.error('Error fetching call logs:', err);
        setCallLogs([]);
      }

      // Fetch follow-ups
      const { data: followUpsData } = await supabase
        .from('telecaller_follow_ups')
        .select('*, telecaller:telecaller_id(full_name)')
        .eq('lead_id', leadId)
        .order('scheduled_time', { ascending: false });

      setFollowUps(followUpsData || []);

    } catch (error) {
      console.error('Error fetching lead details:', error);
      setLoadError(error instanceof Error ? error.message : 'Could not load lead');
    } finally {
      settled = true;
      clearTimeout(watchdog);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeadDetails();
    void fetchActivityTimeline();
  };

  const handlePickerChange = (_event: any, selectedDate?: Date) => {
    const mode = pickerMode;
    if (Platform.OS === 'android') setPickerMode(null);
    if (!selectedDate || !mode) {
      if (Platform.OS === 'ios') setPickerMode(null);
      return;
    }
    if (mode === 'date') {
      const ymd = [
        selectedDate.getFullYear(),
        String(selectedDate.getMonth() + 1).padStart(2, '0'),
        String(selectedDate.getDate()).padStart(2, '0'),
      ].join('-');
      setActivityData((prev) => ({ ...prev, date: ymd }));
    } else {
      const hm = `${String(selectedDate.getHours()).padStart(2, '0')}:${String(
        selectedDate.getMinutes(),
      ).padStart(2, '0')}`;
      setActivityData((prev) => ({ ...prev, time: hm }));
    }
    if (Platform.OS === 'ios') setPickerMode(null);
  };

  const handleSaveActivity = async () => {
    try {
      const selected = selectedResult;
      if (selected.id === 'CALLBACK' && (!activityData.date || !activityData.time)) {
        Alert.alert('Follow-up time', 'Follow-up ke liye date aur time dono select karo.');
        return;
      }

      const whenIso = combineDateAndTime(activityData.date, activityData.time);
      const statusLabel =
        selected.id === 'LOST'
          ? `Lost · ${activityData.lostReason.trim() || 'Other Reasons'}`
          : selected.label;
      const notesParts = [
        `[${statusLabel}]`,
        activityData.notes.trim() || null,
      ].filter(Boolean);

      await apiFetch('/api/telecaller/calls/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          call_type: 'OUTBOUND',
          call_status: selected.call_status,
          call_duration: null,
          outcome: selected.outcome,
          notes: notesParts.join(' '),
          phone_number: lead?.customer_phone,
          next_action: whenIso ? 'FOLLOW_UP' : null,
          next_action_time: whenIso,
        }),
      });

      const prevMeta =
        lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? { ...lead.coupon_meta } : {};
      const prevHistory = Array.isArray(prevMeta.profile_history) ? prevMeta.profile_history : [];
      const historyEntry = {
        at: new Date().toISOString(),
        summary: statusLabel,
        remark: activityData.notes.trim() || null,
        status: selected.id,
        event: 'STATUS',
        previous_status: lead?.status || null,
        previous_label: prevMeta.last_call_label || null,
      };
      const nextMeta = {
        ...prevMeta,
        last_call_status: selected.call_status,
        last_call_result: selected.id,
        last_call_label: statusLabel,
        last_lost_reason: selected.id === 'LOST' ? activityData.lostReason.trim() || 'Other Reasons' : null,
        last_call_at: new Date().toISOString(),
        profile_history: [historyEntry, ...prevHistory].slice(0, 50),
      };

      const leadUpdate: Record<string, unknown> = {
        last_call_at: new Date().toISOString(),
        total_calls: (lead?.total_calls || 0) + 1,
        coupon_meta: nextMeta,
        updated_at: new Date().toISOString(),
        ...(selected.id !== 'RINGING' ? { is_incomplete: false } : {}),
      };
      if (selected.lead_status) {
        leadUpdate.status = selected.lead_status;
      }
      if (whenIso) {
        leadUpdate.follow_up_required = true;
        leadUpdate.next_follow_up_at = whenIso;
      }

      await supabase.from('service_leads').update(leadUpdate).eq('id', leadId);

      if (whenIso) {
        const { data: profile } = await supabase
          .from('users_login')
          .select('id')
          .eq('email', user?.email)
          .single();

        await supabase
          .from('telecaller_follow_ups')
          .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
          .eq('lead_id', leadId)
          .eq('status', 'PENDING');

        await supabase.from('telecaller_follow_ups').insert([
          {
            lead_id: leadId,
            telecaller_id: profile?.id,
            follow_up_type: 'CALLBACK',
            scheduled_time: whenIso,
            reason: activityData.notes || statusLabel,
            priority: 'NORMAL',
            status: 'PENDING',
          },
        ]);
      }

      setActivityData({
        result: 'RINGING',
        lostReason: '',
        notes: '',
        date: '',
        time: '',
      });
      setShowActivityForm(false);
      fetchLeadDetails();
      void fetchActivityTimeline();
      Alert.alert('Saved', statusLabel);
    } catch (error) {
      console.error('Error saving activity:', error);
      Alert.alert('Error', 'Failed to save');
    }
  };

  const handleOpenWhatsApp = () => {
    const phone = String(editing ? editForm.customer_phone : lead?.customer_phone || '').trim();
    if (!phone.replace(/\D/g, '')) {
      Alert.alert('WhatsApp', 'Customer phone number missing.');
      return;
    }
    setShowWaChat(true);
  };

  const handleSendPricingWhatsApp = async () => {
    const pincode = String(editing ? editForm.pincode : lead?.pincode || '')
      .replace(/\D/g, '')
      .slice(0, 6);
    const carModel = String(
      editing
        ? [editForm.vehicle_make, editForm.vehicle_model].filter(Boolean).join(' ')
        : [lead?.vehicle_make, lead?.vehicle_model].filter(Boolean).join(' ') ||
            lead?.vehicle_model ||
            '',
    ).trim();
    const serviceTypeIds = editing
      ? [...(editForm.service_types || []), ...(editForm.service_addons || [])]
      : parseIds(lead?.service_type_ids);
    const meta =
      lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
    const savedCategories = Array.isArray((meta as any).pricing_categories)
      ? (meta as any).pricing_categories.map((c: any) => String(c || '').trim()).filter(Boolean)
      : [];
    // No plan selected → send full category (default Periodic = all 4 tiers Semi+Fully)
    const pricingCategories = savedCategories.length
      ? savedCategories
      : inferLeadPricingCategories(meta, lead?.service_type);

    if (!/^\d{6}$/.test(pincode)) {
      Alert.alert('Pricing', 'Enter 6-digit pincode first (City / Pincode).');
      return;
    }
    if (!carModel) {
      Alert.alert('Pricing', 'Select car model first (Vehicle section).');
      return;
    }

    const modeHint = serviceTypeIds.length
      ? `Selected plan(s) only for ${carModel} · PIN ${pincode}.`
      : `All ${pricingCategories.join(', ') || 'Periodic'} plans for ${carModel} · PIN ${pincode}.`;

    Alert.alert(
      'Send pricing on WhatsApp?',
      `${modeHint}\n\nCreates a pricing page link (valid 3 hours) and sends it on WhatsApp.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSendingPricing(true);
            try {
              const res = await apiFetch<any>(`/api/telecaller/leads/${leadId}/send-pricing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  pincode,
                  carModel,
                  serviceTypeIds: serviceTypeIds.length ? serviceTypeIds : undefined,
                  // Empty ids → API sends all plans in category (default Periodic)
                  categories: serviceTypeIds.length
                    ? pricingCategories.length
                      ? pricingCategories
                      : undefined
                    : pricingCategories.length
                      ? pricingCategories
                      : ['Car Periodic Service'],
                }),
              });
              if (!res?.success && !res?.shareUrl) {
                throw new Error(res?.message || res?.error || 'Failed to send pricing');
              }
              Alert.alert(
                res?.success ? 'Sent' : 'Pricing link ready',
                res.message ||
                  (res.shareUrl
                    ? `Link: ${res.shareUrl}`
                    : 'Pricing link sent on WhatsApp (valid ~3 hours).'),
              );
            } catch (e: any) {
              Alert.alert(
                'WhatsApp',
                e?.message ||
                  'Could not send. Need open WhatsApp chat, or approve pricing_share_link template.',
              );
            } finally {
              setSendingPricing(false);
            }
          },
        },
      ],
    );
  };

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      Alert.alert('Coupon', 'Enter a coupon code');
      return;
    }
    try {
      await apiFetch(`/api/telecaller/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: lead.customer_name,
          customer_phone: lead.customer_phone,
          customer_alternate_phone: lead.customer_alternate_phone,
          customer_email: lead.customer_email,
          customer_address: lead.customer_address,
          city_id: lead.city_id,
          city: lead.city,
          pincode: lead.pincode,
          vehicle_number: lead.vehicle_number,
          vehicle_make: lead.vehicle_make,
          model_id: lead.model_id,
          vehicle_model: lead.vehicle_model,
          vehicle_variant: lead.vehicle_variant,
          vehicle_year: lead.vehicle_year,
          vehicle_fuel_type: lead.vehicle_fuel_type,
          odometer_km: lead.odometer_km,
          service_types: parseIds(lead.service_type_ids),
          service_addons: parseIds(lead.subservice_ids),
          service_type: lead.service_type,
          problem_description: lead.problem_description,
          description: lead.description,
          pickup_required: lead.pickup_required,
          pickup_address: lead.pickup_address,
          notes: lead.notes,
          lead_priority: lead.lead_priority,
          coupon_codes: [code],
          applied_coupon: code,
        }),
      });
      setCouponInput('');
      await fetchLeadDetails();
      Alert.alert('Success', 'Coupon applied');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to apply coupon');
    }
  };

  const handleRemoveCoupon = async () => {
    try {
      await apiFetch(`/api/telecaller/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: lead.customer_name,
          customer_phone: lead.customer_phone,
          customer_alternate_phone: lead.customer_alternate_phone,
          customer_email: lead.customer_email,
          customer_address: lead.customer_address,
          city_id: lead.city_id,
          city: lead.city,
          pincode: lead.pincode,
          vehicle_number: lead.vehicle_number,
          vehicle_make: lead.vehicle_make,
          model_id: lead.model_id,
          vehicle_model: lead.vehicle_model,
          vehicle_variant: lead.vehicle_variant,
          vehicle_year: lead.vehicle_year,
          vehicle_fuel_type: lead.vehicle_fuel_type,
          odometer_km: lead.odometer_km,
          service_types: parseIds(lead.service_type_ids),
          service_addons: parseIds(lead.subservice_ids),
          service_type: lead.service_type,
          problem_description: lead.problem_description,
          description: lead.description,
          pickup_required: lead.pickup_required,
          pickup_address: lead.pickup_address,
          notes: lead.notes,
          lead_priority: lead.lead_priority,
          coupon_codes: [],
          applied_coupon: '',
        }),
      });
      await fetchLeadDetails();
      Alert.alert('Removed', 'Coupon removed');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to remove coupon');
    }
  };

  if (loading && !lead) {
    return (
      <View style={styles.loadingContainer}>
        <CarLoading size="compact" label="Loading lead details..." />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.loadingContainer}>
        <Icon name="alert-circle" size={64} color={COLORS.red} />
        <Text style={styles.errorText}>{loadError || 'Lead not found'}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setLoading(true);
            void fetchLeadDetails();
          }}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const headerStatus = resolveLeadDisplayStatus(lead, callLogs);
  const badge = getCallStatusBadge(headerStatus);

  return (
    <KeyboardAvoidingView
      style={styles.mainContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header with Back Button */}
      <View style={[styles.headerBar, embedded && styles.headerBarEmbedded]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation?.goBack?.()}
        >
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Lead Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, editing && { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          editing ? undefined : (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          )
        }
      >
            <View style={styles.header}>
              <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                <Text style={styles.headerTitle} numberOfLines={2}>
                  {editing ? editForm.customer_name || lead.customer_name : lead.customer_name}
                </Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  Lead #{lead.lead_number}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.statusText, { color: badge.fg }]} numberOfLines={1}>
                  {formatStatusLabel(headerStatus)}
                </Text>
              </View>
            </View>

      {canSeeMlDl ? (
        <LeadBrainCard
          leadId={leadId}
          onOpenSimilar={(id) => navigation?.navigate?.('TelecallerLeadDetail', { leadId: id })}
        />
      ) : null}

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary, styles.actionButtonCall]}
          onPress={() =>
            void clickToCallCustomer({
              customerPhone: editing ? editForm.customer_phone : lead.customer_phone,
              leadId: lead?.id,
            })
          }
        >
          <Icon name="phone" size={18} color="#fff" />
          <Text style={styles.actionButtonTextPrimary}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary, styles.actionButtonWa]}
          onPress={handleOpenWhatsApp}
        >
          <Icon name="whatsapp" size={18} color={COLORS.green} />
          <Text style={styles.actionButtonTextSecondary}>WhatsApp</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.pricingSendWrap}>
        <TouchableOpacity
          style={[styles.pricingSendBtn, sendingPricing && { opacity: 0.7 }]}
          disabled={sendingPricing}
          onPress={handleSendPricingWhatsApp}
        >
          {sendingPricing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon name="cash" size={18} color="#fff" />
              <Text style={styles.pricingSendBtnText}>Send Pricing on WhatsApp</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <View style={[styles.statIconWrap, { backgroundColor: COLORS.primary + '15' }]}>
            <Icon name="phone" size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.statValue}>{callLogs.length || lead.total_calls || 0}</Text>
          <Text style={styles.statLabel}>Total Calls</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <View style={[styles.statIconWrap, { backgroundColor: COLORS.orange + '15' }]}>
            <Icon name="priority-high" size={18} color={COLORS.orange} />
          </View>
          <Text style={styles.statValue} numberOfLines={1}>{lead.lead_priority || 'NORMAL'}</Text>
          <Text style={styles.statLabel}>Priority</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <View style={[styles.statIconWrap, { backgroundColor: COLORS.blue + '15' }]}>
            <Icon name="location-on" size={18} color={COLORS.blue} />
          </View>
          <Text style={styles.statValue} numberOfLines={2}>
            {lead.city || '—'}
          </Text>
          <Text style={styles.statLabel}>City</Text>
        </View>
      </View>

      {showLeadIq ? (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lead IQ</Text>
        <View style={styles.sectionContent}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              disabled={leadIqRunning}
              onPress={() => void generateLeadIq(false)}
            >
              <Text style={styles.actionButtonTextSecondary}>
                {leadIqRunning ? '…' : 'Generate'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              disabled={leadIqRunning}
              onPress={() => void generateLeadIq(true)}
            >
              <Text style={styles.actionButtonTextPrimary}>Deep AI</Text>
            </TouchableOpacity>
          </View>
          {leadIq ? (
            <>
              <Text style={{ fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 }}>
                {leadIq.verdict}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}>
                {leadIq.intent_level} · {leadIq.decision_stage} · {leadIq.temperature}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.textPrimary }}>{leadIq.next_move}</Text>
            </>
          ) : (
            <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>
              History se intent + next move. Generate free, Deep AI playbook use karta hai.
            </Text>
          )}
        </View>
      </View>
      ) : null}

      {/* Coupon — view only at top; in edit mode it lives under Booking confirmed → Pickup */}
      {!editing ? (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Coupon</Text>
        <View style={styles.sectionContent}>
          {(() => {
            const code = String(
              lead?.coupon_code ?? lead?.coupon ?? lead?.applied_coupon_code ?? ''
            ).trim();
            if (code) {
              return (
                <View style={styles.couponBanner}>
                  <View style={styles.couponHeader}>
                    <Text style={styles.couponTitle}>Applied</Text>
                    <Text style={styles.couponCode}>{code}</Text>
                  </View>
                  <TouchableOpacity onPress={handleRemoveCoupon}>
                    <Text style={{ color: COLORS.red, fontWeight: '600', fontSize: 12, marginTop: 6 }}>
                      Remove coupon
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }
            return (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Enter coupon code"
                  value={couponInput}
                  onChangeText={setCouponInput}
                  autoCapitalize="characters"
                  placeholderTextColor={COLORS.textSecondary}
                />
                <TouchableOpacity
                  style={[styles.formButton, styles.formButtonPrimary, { flex: 0, paddingHorizontal: 16 }]}
                  onPress={handleApplyCoupon}
                >
                  <Text style={styles.formButtonTextPrimary}>Apply</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
      </View>
      ) : null}

      {/* Customer Information */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIconWrap, { backgroundColor: '#DBEAFE' }]}>
            <Icon name="account" size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.sectionTitle}>Customer Details</Text>
        </View>
        <View style={styles.sectionContent}>
          {editing ? (
            <>
              <DetailRow
                icon="account"
                label="Name"
                value={editForm.customer_name}
                editing
                onChangeText={(v) => setEditField('customer_name', v)}
                placeholder="Customer name"
              />
              <View style={styles.detailGrid}>
                <DetailRow
                  icon="phone"
                  label="Phone"
                  value={editForm.customer_phone}
                  compact
                  editing
                  keyboardType="phone-pad"
                  maxLength={10}
                  onChangeText={(v) => setEditField('customer_phone', v.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit"
                />
                <DetailRow
                  icon="phone-plus"
                  label="Alternate"
                  value={editForm.customer_alternate_phone}
                  compact
                  editing
                  keyboardType="phone-pad"
                  maxLength={10}
                  onChangeText={(v) =>
                    setEditField('customer_alternate_phone', v.replace(/\D/g, '').slice(0, 10))
                  }
                  placeholder="Optional"
                />
              </View>
              <Text style={[styles.mutedValue, { marginBottom: 8 }]}>
                10-digit phone auto-fills name / car / address if found in DB
              </Text>
              <DetailRow
                icon="email"
                label="Email"
                value={editForm.customer_email}
                editing
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={(v) => setEditField('customer_email', v)}
                placeholder="Optional email"
              />
              <DetailRow
                icon="building"
                label="Flat / Building"
                value={editForm.flat_number}
                editing
                onChangeText={(v) => setEditField('flat_number', v)}
                placeholder="Flat / house no."
              />
              <DetailRow
                icon="map-marker"
                label="Area / Street"
                value={editForm.pickup_address}
                editing
                onChangeText={(v) => setEditField('pickup_address', v)}
                placeholder="Society, road, locality"
              />
              <DetailRow
                icon="navigation"
                label="Landmark"
                value={editForm.landmark}
                editing
                onChangeText={(v) => setEditField('landmark', v)}
                placeholder="Near …"
              />
              <View style={styles.detailGrid}>
                <DetailRow
                  icon="map-pin"
                  label="Pincode"
                  value={editForm.pincode}
                  compact
                  editing
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={(v) => setEditField('pincode', v.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit"
                />
                <TouchableOpacity style={{ flex: 1 }} onPress={() => setCityOpen(true)} activeOpacity={0.85}>
                  <DetailRow icon="city" label="City" value={editForm.city || 'Select city'} compact />
                </TouchableOpacity>
              </View>

              {/^\d{6}$/.test(editForm.pincode) ? (
                <View style={styles.workshopPickBox}>
                  <View style={styles.workshopPickHead}>
                    <Text style={styles.fieldCaption}>Workshop for this lead</Text>
                    {pinWorkshops.length > 1 ? (
                      <TouchableOpacity onPress={() => setShowAllWorkshops(true)} hitSlop={8}>
                        <Text style={styles.viewAllText}>View all</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {loadingPinWs ? (
                    <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 10 }} />
                  ) : pinWorkshops.length === 0 ? (
                    <Text style={styles.mutedValue}>No workshops found for this pincode</Text>
                  ) : (
                    (() => {
                      const preview =
                        pinWorkshops.find((w) => w.id === editForm.workshop_id) || pinWorkshops[0];
                      const w = preview;
                      const active = editForm.workshop_id === w.id;
                      const areaName = w.workshop_name || w.name || 'Workshop';
                      const centerName = w.service_center_name || null;
                      const address = w.short_address || w.address || null;
                      return (
                        <TouchableOpacity
                          key={w.id}
                          style={[styles.workshopPickRow, active && styles.workshopPickRowActive]}
                          onPress={() =>
                            setEditForm((prev) => ({
                              ...prev,
                              workshop_id: w.id,
                              workshop_name: areaName,
                            }))
                          }
                          activeOpacity={0.85}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.workshopPickName} numberOfLines={1}>
                              {areaName}
                            </Text>
                            {centerName && centerName !== areaName ? (
                              <Text style={styles.workshopPickCenter} numberOfLines={1}>
                                {centerName}
                              </Text>
                            ) : null}
                            {address ? (
                              <Text style={styles.workshopPickSub} numberOfLines={2}>
                                {address}
                              </Text>
                            ) : null}
                            <Text style={styles.workshopPickSub} numberOfLines={1}>
                              {[w.city, w.pincode || editForm.pincode].filter(Boolean).join(' · ')}
                            </Text>
                          </View>
                          <Icon
                            name={active ? 'check-circle' : 'circle-outline'}
                            size={20}
                            color={active ? COLORS.primary : COLORS.gray[400]}
                          />
                        </TouchableOpacity>
                      );
                    })()
                  )}
                </View>
              ) : (
                <Text style={[styles.mutedValue, { marginTop: 4 }]}>
                  Enter 6-digit pincode to see nearby workshops
                </Text>
              )}

              {customerMessage ? (
                <View style={styles.customerMsgBox}>
                  <Text style={styles.fieldCaption}>Customer message</Text>
                  <Text style={styles.customerMsgText}>{customerMessage}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <DetailRow icon="account" label="Name" value={lead.customer_name} />
              <View style={styles.detailGrid}>
                <DetailRow icon="phone" label="Phone" value={lead.customer_phone} compact />
                {lead.customer_alternate_phone ? (
                  <DetailRow
                    icon="phone-plus"
                    label="Alternate"
                    value={lead.customer_alternate_phone}
                    compact
                  />
                ) : (
                  <View style={{ flex: 1 }} />
                )}
              </View>
              {lead.customer_email ? (
                <DetailRow icon="email" label="Email" value={lead.customer_email} />
              ) : null}
              <DetailRow
                icon="map-marker"
                label="Address"
                value={
                  formatLeadAddress(
                    lead.pickup_address || lead.customer_address,
                    lead.city,
                    lead.pincode,
                  ) || '—'
                }
              />
              <View style={styles.detailGrid}>
                <DetailRow icon="city" label="City" value={lead.city || '—'} compact />
                <DetailRow
                  icon="map-pin"
                  label="Pincode"
                  value={lead.pincode ? String(lead.pincode) : '—'}
                  compact
                />
              </View>
              {customerMessage ? (
                <View style={styles.customerMsgBox}>
                  <Text style={styles.fieldCaption}>Customer message</Text>
                  <Text style={styles.customerMsgText}>{customerMessage}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>

      {/* Lead Overview — no source / UTM */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIconWrap, { backgroundColor: '#FEF3C7' }]}>
            <Icon name="clipboard-list" size={16} color="#B45309" />
          </View>
          <Text style={styles.sectionTitle}>Lead Overview</Text>
        </View>
        <View style={styles.sectionContent}>
          <DetailRow icon="pound" label="Lead #" value={lead?.lead_number || '—'} />
          <DetailRow
            icon="flag"
            label="Status"
            value={String(lead?.status || '—').replace(/_/g, ' ')}
          />
          {editing ? (
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.fieldCaption}>Priority</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {(['NORMAL', 'HIGH', 'URGENT'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setEditField('lead_priority', p)}
                    style={[
                      styles.fuelChip,
                      String(editForm.lead_priority || 'NORMAL') === p && styles.fuelChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.fuelChipText,
                        String(editForm.lead_priority || 'NORMAL') === p && styles.fuelChipTextActive,
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <DetailRow icon="flag-outline" label="Priority" value={lead?.lead_priority || 'NORMAL'} />
          )}
          {leadId ? (
            <LeadTagsPicker
              leadId={leadId}
              canManage={['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(
                String(
                  (user as any)?.role?.role_code ||
                    (user as any)?.roles?.role_code ||
                    '',
                ).toUpperCase(),
              )}
            />
          ) : null}
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', marginTop: 12, marginBottom: 6 }}>
            REFERRED BY
          </Text>
          {referredBy ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F5F3FF',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#DDD6FE',
                padding: 10,
                gap: 8,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#1E293B' }}>
                  {referredByLabel(referredBy)}
                </Text>
                {referredBy.lead_number ? (
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{referredBy.lead_number}</Text>
                ) : null}
              </View>
              {referredBy.lead_id ? (
                <TouchableOpacity
                  onPress={() => navigation?.navigate?.('TelecallerLeadDetail', { leadId: referredBy.lead_id })}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#5B21B6' }}>Open</Text>
                </TouchableOpacity>
              ) : null}
              {editing ? (
                <TouchableOpacity onPress={() => setReferredBy(null)}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B' }}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : editing ? (
            <View>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: '#fff',
                  color: '#0F172A',
                }}
                placeholder="Search referrer — CRM lead or app customer"
                placeholderTextColor="#94A3B8"
                value={referrerQuery}
                onChangeText={setReferrerQuery}
                keyboardType="default"
              />
              {referrerSearching ? (
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Searching…</Text>
              ) : null}
              {referrerHits.map((hit) => (
                <TouchableOpacity
                  key={hit.id}
                  style={{
                    paddingVertical: 10,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: '#E2E8F0',
                  }}
                  onPress={() => {
                    setReferredBy(referredByFromSearchHit(hit));
                    setReferrerQuery('');
                    setReferrerHits([]);
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                    {hit.customer_name || 'Unknown'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>
                    {hit.customer_phone}
                    {hit.lead_number ? ` · ${hit.lead_number}` : ''}
                    {hit.source === 'customer' ? ' · app' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 13, color: '#94A3B8' }}>Not set</Text>
          )}
          {referredTo.length > 0 ? (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 6 }}>
                THEY REFERRED
              </Text>
              {referredTo.map((row) => (
                <TouchableOpacity
                  key={row.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 8,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: '#E2E8F0',
                  }}
                  onPress={() => navigation?.navigate?.('TelecallerLeadDetail', { leadId: row.id })}
                >
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                      {row.customer_name || '—'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748B' }}>{row.customer_phone || '—'}</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.primary }}>
                    {row.lead_number || 'Open'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <DetailRow
            icon="clock-outline"
            label="Created"
            value={
              lead?.created_at
                ? new Date(lead.created_at).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'
            }
          />
        </View>
      </View>

      {/* Vehicle Information */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIconWrap, { backgroundColor: '#E0E7FF' }]}>
            <Icon name="car" size={16} color={COLORS.indigo} />
          </View>
          <Text style={styles.sectionTitle}>Vehicle</Text>
        </View>
        <View style={styles.sectionContent}>
          {editing ? (
            <>
              <DetailRow
                icon="car"
                label="Registration"
                value={editForm.vehicle_number}
                editing
                autoCapitalize="characters"
                maxLength={12}
                onChangeText={(v) =>
                  setEditField(
                    'vehicle_number',
                    v.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12),
                  )
                }
                placeholder="e.g. MH01BJ7842"
              />
              <CarModelSearchField
                label="CAR MODEL"
                variant="default"
                hideVariant
                displayValue={carDisplay}
                selectedMake={editForm.vehicle_make}
                selectedModel={editForm.vehicle_model}
                placeholder="Type model (e.g. Rapid, Swift)"
                onSelect={(make, model, display, meta) => {
                  setCarDisplay(display);
                  setEditForm((prev) => ({
                    ...prev,
                    vehicle_make: make,
                    vehicle_model: model,
                    model_id: meta?.id || prev.model_id,
                    vehicle_class: meta?.class || prev.vehicle_class,
                  }));
                }}
                onClear={() => {
                  setCarDisplay('');
                  setEditForm((prev) => ({
                    ...prev,
                    vehicle_make: '',
                    vehicle_model: '',
                    model_id: '',
                    vehicle_class: '',
                  }));
                }}
              />
              <Text style={styles.fieldCaption}>Fuel type</Text>
              <View style={styles.fuelRow}>
                {FUEL_TYPES.map((fuel) => {
                  const active = editForm.vehicle_fuel_type === fuel;
                  return (
                    <TouchableOpacity
                      key={fuel}
                      style={[styles.fuelChip, active && styles.fuelChipActive]}
                      onPress={() => setEditField('vehicle_fuel_type', fuel)}
                    >
                      <Text style={[styles.fuelChipText, active && styles.fuelChipTextActive]}>
                        {fuel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.detailGrid}>
                <DetailRow
                  icon="calendar"
                  label="Year"
                  value={editForm.vehicle_year}
                  compact
                  editing
                  keyboardType="number-pad"
                  maxLength={4}
                  onChangeText={(v) => setEditField('vehicle_year', v.replace(/\D/g, '').slice(0, 4))}
                  placeholder="YYYY"
                />
                <DetailRow
                  icon="car"
                  label="Odometer"
                  value={editForm.odometer_km}
                  compact
                  editing
                  keyboardType="number-pad"
                  onChangeText={(v) => setEditField('odometer_km', v.replace(/\D/g, ''))}
                  placeholder="km"
                />
              </View>
            </>
          ) : (
            <>
              <DetailRow
                icon="car"
                label="Registration"
                value={lead.vehicle_number || 'Not provided'}
              />
              <View style={styles.detailGrid}>
                <DetailRow
                  icon="car-side"
                  label="Make / Model"
                  value={
                    [lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ') || '—'
                  }
                  compact
                />
              </View>
              <View style={styles.detailGrid}>
                <DetailRow
                  icon="gas-station"
                  label="Fuel"
                  value={lead.vehicle_fuel_type || '—'}
                  compact
                />
                <DetailRow
                  icon="calendar"
                  label="Year"
                  value={lead.vehicle_year ? String(lead.vehicle_year) : '—'}
                  compact
                />
              </View>
              {lead.vehicle_variant ? (
                <DetailRow icon="tag" label="Variant" value={lead.vehicle_variant} />
              ) : null}
              {(() => {
                const second = parseSecondCar(lead?.coupon_meta);
                return second ? (
                  <DetailRow icon="car" label="Second car" value={secondCarLabel(second) || '—'} />
                ) : null;
              })()}
            </>
          )}
          {editing ? (
            !showSecondCar ? (
              <TouchableOpacity
                style={{
                  marginTop: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#BAE6FD',
                  backgroundColor: '#F0F9FF',
                  paddingVertical: 10,
                  alignItems: 'center',
                }}
                onPress={() => {
                  setShowSecondCar(true);
                  setSecondCar(emptySecondCar());
                  setSecondCarDisplay('');
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0369A1' }}>Add second car</Text>
              </TouchableOpacity>
            ) : (
              <View
                style={{
                  marginTop: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#BAE6FD',
                  backgroundColor: '#F0F9FF',
                  padding: 12,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0C4A6E' }}>Second car</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowSecondCar(false);
                      setSecondCar(emptySecondCar());
                      setSecondCarDisplay('');
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B' }}>Remove</Text>
                  </TouchableOpacity>
                </View>
                <DetailRow
                  icon="car"
                  label="Registration"
                  value={secondCar.vehicle_number}
                  editing
                  autoCapitalize="characters"
                  maxLength={12}
                  onChangeText={(v) =>
                    setSecondCar((prev) => ({
                      ...prev,
                      vehicle_number: v.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12),
                    }))
                  }
                  placeholder="e.g. MH01BJ7842 or NA"
                />
                <CarModelSearchField
                  label="SECOND CAR MODEL"
                  variant="default"
                  hideVariant
                  displayValue={secondCarDisplay}
                  selectedMake={secondCar.vehicle_make}
                  selectedModel={secondCar.vehicle_model}
                  placeholder="Type second car model"
                  onSelect={(make, model, display, meta) => {
                    setSecondCarDisplay(display);
                    setSecondCar((prev) => ({
                      ...prev,
                      vehicle_make: make,
                      vehicle_model: model,
                      model_id: meta?.id || prev.model_id,
                      vehicle_class: meta?.class || prev.vehicle_class,
                    }));
                  }}
                  onClear={() => {
                    setSecondCarDisplay('');
                    setSecondCar((prev) => ({
                      ...prev,
                      vehicle_make: '',
                      vehicle_model: '',
                      model_id: '',
                      vehicle_class: '',
                    }));
                  }}
                />
              </View>
            )
          ) : !parseSecondCar(lead?.coupon_meta) ? (
            <TouchableOpacity
              style={{
                marginTop: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#BAE6FD',
                backgroundColor: '#F0F9FF',
                paddingVertical: 10,
                alignItems: 'center',
              }}
              onPress={() => {
                setEditing(true);
                setShowSecondCar(true);
                setSecondCar(emptySecondCar());
                setSecondCarDisplay('');
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0369A1' }}>Add second car</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Service Details */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIconWrap, { backgroundColor: '#D1FAE5' }]}>
            <Icon name="wrench" size={16} color={COLORS.green} />
          </View>
          <Text style={styles.sectionTitle}>Service & Price</Text>
        </View>
        <View style={styles.sectionContent}>
          {!editing ? (
            (() => {
              const estimated = Number(lead.estimated_amount || 0) || 0;
              const discount = Number(lead.discount_amount || 0) || 0;
              const payable = Math.max(0, estimated);
              const lineSum = pricingItems.reduce((s, i) => s + (Number(i.price) || 0), 0);
              const showAmount = estimated > 0 || lineSum > 0;
              if (!showAmount) {
                return (
                  <View style={styles.priceEmpty}>
                    <Text style={styles.priceEmptyText}>
                      Price not set yet — add services & quote below
                    </Text>
                  </View>
                );
              }
              return (
                <View style={styles.priceCard}>
                  <View style={styles.priceCardTop}>
                    <Text style={styles.priceCardLabel}>Booking amount</Text>
                    <Text style={styles.priceCardValue}>
                      ₹{(estimated > 0 ? estimated : lineSum).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  {discount > 0 ? (
                    <View style={styles.priceMetaRow}>
                      <Text style={styles.priceMetaLabel}>Discount</Text>
                      <Text style={[styles.priceMetaValue, { color: COLORS.green }]}>
                        −₹{discount.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.priceMetaRow}>
                    <Text style={styles.priceMetaLabel}>Payable</Text>
                    <Text style={styles.pricePayable}>
                      ₹
                      {(estimated > 0 ? payable : Math.max(0, lineSum - discount)).toLocaleString(
                        'en-IN',
                      )}
                    </Text>
                  </View>
                  {lead.payment_mode ? (
                    <Text style={styles.priceMode}>{formatPaymentMode(lead.payment_mode)}</Text>
                  ) : null}
                </View>
              );
            })()
          ) : null}

          {editing ? (
            <>
              <Text style={styles.fieldCaption}>Packages</Text>
              <CrmServicePlanPicker
                selectedIds={editForm.service_types}
                onChange={(ids) => setEditField('service_types', ids)}
                cityId={editForm.city_id}
                vehicleClass={editForm.vehicle_class}
                modelId={editForm.model_id}
                vehicleMake={editForm.vehicle_make}
                vehicleModel={editForm.vehicle_model}
                title=""
              />

              <Text style={[styles.fieldCaption, { marginTop: 14 }]}>Call result</Text>
              <Text style={styles.formLabel}>Quick</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, activityData.result === 'RINGING' && styles.chipActive]}
                  onPress={() =>
                    setActivityData({
                      ...activityData,
                      result: 'RINGING',
                      lostReason: '',
                    })
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      activityData.result === 'RINGING' && styles.chipTextActive,
                    ]}
                  >
                    Ringing
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.formLabel}>Status</Text>
              <TouchableOpacity
                style={styles.selectBtn}
                onPress={() => {
                  setShowLostMenu(false);
                  setShowStatusMenu(true);
                }}
              >
                <Text
                  style={[
                    styles.selectBtnText,
                    activityData.result === 'RINGING' && { color: COLORS.textSecondary },
                  ]}
                >
                  {activityData.result === 'RINGING' ? 'Select status' : selectedResult.label}
                </Text>
                <Icon name="chevron-down" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>

              {activityData.result === 'LOST' || selectedResult.requires_lost_reason ? (
                <>
                  <Text style={styles.formLabel}>Lost reason</Text>
                  <TouchableOpacity
                    style={styles.selectBtn}
                    onPress={() => {
                      setShowStatusMenu(false);
                      setShowLostMenu(true);
                    }}
                  >
                    <Text
                      style={[
                        styles.selectBtnText,
                        !activityData.lostReason && { color: COLORS.textSecondary },
                      ]}
                    >
                      {activityData.lostReason || 'Select lost reason'}
                    </Text>
                    <Icon name="chevron-down" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </>
              ) : null}

              <Text style={styles.formLabel}>
                {activityData.result === 'CALLBACK'
                  ? 'Follow-up date & time (required)'
                  : 'Date & time (optional)'}
              </Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity
                  style={[styles.datetimeButton, { flex: 1 }]}
                  onPress={() => setPickerMode('date')}
                >
                  <Text style={styles.datetimeButtonText}>{formatDisplayDate(activityData.date)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.datetimeButton, { flex: 1 }]}
                  onPress={() => setPickerMode('time')}
                >
                  <Text style={styles.datetimeButtonText}>{formatDisplayTime(activityData.time)}</Text>
                </TouchableOpacity>
              </View>
              {activityData.result === 'CALLBACK' ? (
                <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginBottom: 8 }}>
                  Is time pe telecaller ko in-app + push reminder milega.
                </Text>
              ) : null}
              {activityData.date || activityData.time ? (
                <TouchableOpacity
                  onPress={() => setActivityData({ ...activityData, date: '', time: '' })}
                  style={{ marginBottom: 8 }}
                >
                  <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '600' }}>
                    Clear date & time
                  </Text>
                </TouchableOpacity>
              ) : null}

              <Text style={styles.formLabel}>Remark</Text>
              <TextInput
                style={styles.inlineNotes}
                placeholder="Your remark (optional)"
                placeholderTextColor={COLORS.textSecondary}
                value={activityData.notes}
                onChangeText={(v) => setActivityData({ ...activityData, notes: v })}
                multiline
              />

              {activityData.result === 'BOOKING_CONFIRMED' ? (
                <>
                  <Text style={[styles.fieldCaption, { marginTop: 14 }]}>Pickup / Visit</Text>
                  <CrmPickupVisitStep
                    value={pickupValue}
                    city={editForm.city}
                    cityId={editForm.city_id}
                    pincode={editForm.pincode}
                    hideVehicleNumber
                    hideWorkshopPicker={Boolean(editForm.workshop_id)}
                    onChange={(patch) => {
                      setEditForm((prev) => ({
                        ...prev,
                        ...patch,
                      }));
                    }}
                  />

                  <Text style={[styles.fieldCaption, { marginTop: 14 }]}>Coupon</Text>
                  {(() => {
                    const code = String(
                      lead?.coupon_code ?? lead?.coupon ?? lead?.applied_coupon_code ?? '',
                    ).trim();
                    if (code) {
                      return (
                        <View style={styles.couponBanner}>
                          <View style={styles.couponHeader}>
                            <Text style={styles.couponTitle}>Applied</Text>
                            <Text style={styles.couponCode}>{code}</Text>
                          </View>
                          <TouchableOpacity onPress={handleRemoveCoupon}>
                            <Text
                              style={{
                                color: COLORS.red,
                                fontWeight: '600',
                                fontSize: 12,
                                marginTop: 6,
                              }}
                            >
                              Remove coupon
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    }
                    return (
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <TextInput
                          style={[styles.input, { flex: 1, marginBottom: 0 }]}
                          placeholder="Enter coupon code"
                          value={couponInput}
                          onChangeText={setCouponInput}
                          autoCapitalize="characters"
                          placeholderTextColor={COLORS.textSecondary}
                        />
                        <TouchableOpacity
                          style={[
                            styles.formButton,
                            styles.formButtonPrimary,
                            { flex: 0, paddingHorizontal: 16 },
                          ]}
                          onPress={handleApplyCoupon}
                        >
                          <Text style={styles.formButtonTextPrimary}>Apply</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })()}
                </>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.fieldCaption}>Packages</Text>
              {serviceTypeNames.length > 0 ? (
                <View style={styles.tagsContainer}>
                  {serviceTypeNames.map((name, idx) => (
                    <View key={`${name}-${idx}`} style={[styles.tag, styles.tagBlue]}>
                      <Text style={styles.tagText}>{name}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.mutedValue}>Not specified</Text>
              )}

              {pricingItems.length > 0 ? (
                <View style={styles.lineItemsBox}>
                  {pricingItems.map((item, idx) => (
                    <View key={`${item.name}-${idx}`} style={styles.lineItemRow}>
                      <Text style={styles.lineItemName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.lineItemPrice}>
                        {item.price > 0 ? `₹${item.price.toLocaleString('en-IN')}` : '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {subserviceNames.length > 0 ? (
                <>
                  <Text style={[styles.fieldCaption, { marginTop: 12 }]}>Add-ons</Text>
                  <View style={styles.tagsContainer}>
                    {subserviceNames.map((name, idx) => (
                      <View key={`${name}-${idx}`} style={[styles.tag, styles.tagGreen]}>
                        <Text style={styles.tagText}>{name}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              {(() => {
                const schedule = formatLeadSchedule(lead);
                if (!schedule) return null;
                return <DetailRow icon="calendar-clock" label="Schedule" value={schedule} />;
              })()}

              <DetailRow
                icon="car-pickup"
                label="Service mode"
                value={lead.pickup_required ? 'Doorstep pickup' : 'Workshop visit'}
              />

              {(() => {
                const notes = String(lead.problem_description || '').trim();
                if (!notes) return null;
                if (/^(pickup|visit)\s*:/i.test(notes) && notes.length < 40) return null;
                // Customer WhatsApp text is shown under Customer → Customer message
                if (customerMessage && notes === customerMessage) return null;
                return <DetailRow icon="message-text" label="Notes" value={notes} />;
              })()}

              {(() => {
                const code = String(
                  lead?.coupon_code ?? lead?.coupon ?? lead?.applied_coupon_code ?? '',
                ).trim();
                const discountAmount =
                  Number(
                    lead?.discount_amount ??
                      lead?.coupon_discount_amount ??
                      lead?.coupon_discount ??
                      0,
                  ) || 0;
                if (!code) return null;
                return (
                  <View style={styles.couponBanner}>
                    <View style={styles.couponHeader}>
                      <Text style={styles.couponTitle}>Coupon Applied</Text>
                      <Text style={styles.couponCode}>{code}</Text>
                    </View>
                    <Text style={styles.couponText}>
                      {discountAmount > 0
                        ? `Discount: ₹${discountAmount.toLocaleString('en-IN')}`
                        : 'Note: Discount will reflect at billing time.'}
                    </Text>
                  </View>
                );
              })()}
            </>
          )}
        </View>
      </View>

      {/* Activity timeline — always visible in edit + view (same CRM API as web / LM) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Activity{activityItems.length > 0 ? ` (${activityItems.length})` : ''}
          </Text>
          {!editing ? (
            <TouchableOpacity
              style={styles.addIconBtn}
              onPress={() => setShowActivityForm(!showActivityForm)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="plus-circle" size={26} color={COLORS.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {!editing && showActivityForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Log Call</Text>

            <Text style={styles.formLabel}>Quick</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, activityData.result === 'RINGING' && styles.chipActive]}
                onPress={() =>
                  setActivityData({
                    ...activityData,
                    result: 'RINGING',
                    lostReason: '',
                  })
                }
              >
                <Text
                  style={[
                    styles.chipText,
                    activityData.result === 'RINGING' && styles.chipTextActive,
                  ]}
                >
                  Ringing
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.formLabel}>Status</Text>
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={() => {
                setShowLostMenu(false);
                setShowStatusMenu(true);
              }}
            >
              <Text
                style={[
                  styles.selectBtnText,
                  activityData.result === 'RINGING' && { color: COLORS.textSecondary },
                ]}
              >
                {activityData.result === 'RINGING' ? 'Select status' : selectedResult.label}
              </Text>
              <Icon name="chevron-down" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            {activityData.result === 'LOST' || selectedResult.requires_lost_reason ? (
              <>
                <Text style={styles.formLabel}>Lost reason</Text>
                <TouchableOpacity
                  style={styles.selectBtn}
                  onPress={() => {
                    setShowStatusMenu(false);
                    setShowLostMenu(true);
                  }}
                >
                  <Text
                    style={[
                      styles.selectBtnText,
                      !activityData.lostReason && { color: COLORS.textSecondary },
                    ]}
                  >
                    {activityData.lostReason || 'Select lost reason'}
                  </Text>
                  <Icon name="chevron-down" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </>
            ) : null}

            <Text style={styles.formLabel}>
              {activityData.result === 'CALLBACK'
                ? 'Follow-up date & time (required)'
                : 'Date & time (optional)'}
            </Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={[styles.datetimeButton, { flex: 1 }]}
                onPress={() => setPickerMode('date')}
              >
                <Text style={styles.datetimeButtonText}>{formatDisplayDate(activityData.date)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.datetimeButton, { flex: 1 }]}
                onPress={() => setPickerMode('time')}
              >
                <Text style={styles.datetimeButtonText}>{formatDisplayTime(activityData.time)}</Text>
              </TouchableOpacity>
            </View>
            {activityData.result === 'CALLBACK' ? (
              <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginBottom: 8 }}>
                Is time pe telecaller ko in-app + push reminder milega.
              </Text>
            ) : null}
            {activityData.date || activityData.time ? (
              <TouchableOpacity
                onPress={() => setActivityData({ ...activityData, date: '', time: '' })}
                style={{ marginBottom: 8 }}
              >
                <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '600' }}>
                  Clear date & time
                </Text>
              </TouchableOpacity>
            ) : null}

            <Text style={styles.formLabel}>Remark</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Your remark (optional)"
              value={activityData.notes}
              onChangeText={(value) => setActivityData({ ...activityData, notes: value })}
              multiline
              numberOfLines={3}
              placeholderTextColor={COLORS.textSecondary}
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.formButton, styles.formButtonPrimary]}
                onPress={async () => {
                  await handleSaveActivity();
                  void fetchActivityTimeline();
                }}
              >
                <Text style={styles.formButtonTextPrimary}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formButton, styles.formButtonSecondary]}
                onPress={() => setShowActivityForm(false)}
              >
                <Text style={styles.formButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionContent}>
          {timelineLoading && activityItems.length === 0 ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
          ) : activityItems.length === 0 ? (
            <Text style={styles.emptyText}>No activity yet</Text>
          ) : (
            <>
              {(activityShowAll ? activityItems : activityItems.slice(0, 10)).map((item) => {
              const isPlaying =
                item.kind === 'call' &&
                item.hasRecording &&
                item.callLogId &&
                playingCallLogId === item.callLogId;
              return (
                <View key={item.id} style={styles.logCard}>
                  <View style={styles.logHeader}>
                    <View style={[styles.logBadge, { backgroundColor: item.badgeColor }]}>
                      <Text style={styles.logBadgeText}>{item.title}</Text>
                    </View>
                    {item.kind === 'call' && item.hasRecording && item.callLogId ? (
                      <TouchableOpacity
                        onPress={() =>
                          setPlayingCallLogId((prev) =>
                            prev === item.callLogId ? null : item.callLogId,
                          )
                        }
                        style={{
                          marginLeft: 'auto',
                          backgroundColor: isPlaying ? '#DDD6FE' : '#EDE9FE',
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                        }}
                      >
                        <Text style={{ color: '#5B21B6', fontSize: 11, fontWeight: '700' }}>
                          {isPlaying ? '■ Stop' : '▶ Play'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {item.notes ? <Text style={styles.logNotes}>{item.notes}</Text> : null}
                  <Text style={styles.logTime}>{item.timeLabel}</Text>
                  {item.noRecordingYet ? (
                    <Text style={[styles.logNotes, { color: COLORS.textSecondary }]}>
                      No recording yet
                    </Text>
                  ) : null}
                  {isPlaying ? (
                    <CallRecordingInlinePlayer
                      callLogId={item.callLogId}
                      onClose={() => setPlayingCallLogId(null)}
                    />
                  ) : null}
                </View>
              );
            })}
              {activityItems.length > 10 ? (
                <TouchableOpacity
                  onPress={() => setActivityShowAll((v) => !v)}
                  style={{ paddingVertical: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>
                    {activityShowAll
                      ? 'View less'
                      : `View more (${activityItems.length - 10})`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            App activity{appActivityItems.length > 0 ? ` (${appActivityItems.length})` : ''}
          </Text>
        </View>
        {appActivityLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
        ) : appActivityItems.length === 0 ? (
          <Text style={[styles.logNotes, { color: COLORS.textSecondary, paddingVertical: 8 }]}>
            No app activity yet
          </Text>
        ) : (
          <>
            {(appActivityShowAll ? appActivityItems : appActivityItems.slice(0, 10)).map((item: any) => (
              <View key={item.id || `${item.kind}-${item.at}`} style={styles.logCard}>
                <Text style={styles.logBadgeText}>{item.title}</Text>
                {item.body ? <Text style={styles.logNotes}>{String(item.body)}</Text> : null}
                <Text style={styles.logTime}>{item.at ? formatDateTime(item.at) : '—'}</Text>
              </View>
            ))}
            {appActivityItems.length > 10 ? (
              <TouchableOpacity
                onPress={() => setAppActivityShowAll((v) => !v)}
                style={{ paddingVertical: 10, alignItems: 'center' }}
              >
                <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>
                  {appActivityShowAll
                    ? 'View less'
                    : `View more (${appActivityItems.length - 10})`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>

      {/* Workshop Info */}
      {lead.workshop && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workshop Assigned</Text>
          <View style={styles.sectionContent}>
            <InfoRow icon="store" label="Name" value={lead.workshop.name} />
            <InfoRow icon="map-marker" label="City" value={lead.workshop.city} />
            <InfoRow icon="phone" label="Phone" value={lead.workshop.phone} />
          </View>
        </View>
      )}
    </ScrollView>

    {pickerMode ? (
      <DateTimePicker
        value={
          pickerMode === 'date'
            ? (activityData.date ? new Date(`${activityData.date}T12:00:00`) : new Date())
            : (activityData.time
                ? new Date(`1970-01-01T${activityData.time}:00`)
                : new Date())
        }
        mode={pickerMode}
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={handlePickerChange}
      />
    ) : null}

    <Modal visible={showStatusMenu} transparent animationType="fade" onRequestClose={() => setShowStatusMenu(false)}>
      <Pressable style={styles.menuOverlay} onPress={() => setShowStatusMenu(false)}>
        <View style={styles.menuSheet}>
          <Text style={styles.menuTitle}>Select status</Text>
          {statusOptions.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={styles.menuItem}
              onPress={() => {
                setActivityData({
                  ...activityData,
                  result: opt.id,
                  lostReason: opt.requires_lost_reason || opt.id === 'LOST' ? activityData.lostReason : '',
                });
                setShowStatusMenu(false);
              }}
            >
              <Text style={styles.menuItemText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>

    <Modal visible={showLostMenu} transparent animationType="fade" onRequestClose={() => setShowLostMenu(false)}>
      <Pressable style={styles.menuOverlay} onPress={() => setShowLostMenu(false)}>
        <View style={styles.menuSheet}>
          <Text style={styles.menuTitle}>Lost reason</Text>
          {lostReasons.map((reason) => (
            <TouchableOpacity
              key={reason}
              style={styles.menuItem}
              onPress={() => {
                setActivityData({ ...activityData, lostReason: reason });
                setShowLostMenu(false);
              }}
            >
              <Text style={styles.menuItemText}>{reason}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>

    <Modal visible={cityOpen} transparent animationType="fade" onRequestClose={() => setCityOpen(false)}>
      <Pressable style={styles.cityOverlay} onPress={() => setCityOpen(false)}>
        <Pressable style={styles.citySheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.menuTitle}>Select City</Text>
          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
            {cityOptions.map((c) => {
              const active = editForm.city_id === c.id || editForm.city === c.name;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.cityRow, active && styles.cityRowActive]}
                  onPress={() => {
                    setEditForm((prev) => ({ ...prev, city_id: c.id, city: c.name }));
                    setCityOpen(false);
                  }}
                >
                  <Text style={[styles.cityRowText, active && styles.cityRowTextActive]}>{c.name}</Text>
                  {active ? <Icon name="check" size={18} color={COLORS.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal
      visible={showAllWorkshops}
      transparent
      animationType="slide"
      onRequestClose={() => setShowAllWorkshops(false)}
    >
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowAllWorkshops(false)} />
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.menuTitle}>Nearby workshops</Text>
            <TouchableOpacity onPress={() => setShowAllWorkshops(false)} hitSlop={8}>
              <Icon name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {pinWorkshops.map((w) => {
              const active = editForm.workshop_id === w.id;
              const areaName = w.workshop_name || w.name || 'Workshop';
              const centerName = w.service_center_name || null;
              const address = w.short_address || w.address || null;
              return (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.workshopPickRow, active && styles.workshopPickRowActive]}
                  onPress={() => {
                    setEditForm((prev) => ({
                      ...prev,
                      workshop_id: w.id,
                      workshop_name: areaName,
                    }));
                    setShowAllWorkshops(false);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.workshopPickName} numberOfLines={1}>
                      {areaName}
                    </Text>
                    {centerName && centerName !== areaName ? (
                      <Text style={styles.workshopPickCenter} numberOfLines={1}>
                        {centerName}
                      </Text>
                    ) : null}
                    {address ? (
                      <Text style={styles.workshopPickSub} numberOfLines={2}>
                        {address}
                      </Text>
                    ) : null}
                    <Text style={styles.workshopPickSub} numberOfLines={1}>
                      {[w.city, w.pincode || editForm.pincode].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Icon
                    name={active ? 'check-circle' : 'circle-outline'}
                    size={20}
                    color={active ? COLORS.primary : COLORS.gray[400]}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>

    <Modal
      visible={showWaChat}
      animationType="slide"
      onRequestClose={() => setShowWaChat(false)}
    >
      <TelecallerWhatsAppChat
        phone={String(editing ? editForm.customer_phone : lead?.customer_phone || '')}
        customerName={String(editing ? editForm.customer_name : lead?.customer_name || '') || null}
        onBack={() => setShowWaChat(false)}
      />
    </Modal>

    {editing ? (
      <View style={styles.saveBar}>
        <TouchableOpacity
          style={[styles.saveBarBtn, saving && { opacity: 0.65 }]}
          disabled={saving}
          onPress={saveLeadEdits}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBarBtnText}>Save & Update Booking</Text>
          )}
        </TouchableOpacity>
      </View>
    ) : null}
    </KeyboardAvoidingView>
  );
}

interface DetailRowProps {
  icon: string;
  label: string;
  value: string;
  compact?: boolean;
  editing?: boolean;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

function DetailRow({
  icon,
  label,
  value,
  compact,
  editing,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
  autoCapitalize,
}: DetailRowProps) {
  return (
    <View style={[styles.detailRow, compact && styles.detailRowCompact]}>
      <View style={styles.detailIcon}>
        <Icon name={icon as any} size={14} color={COLORS.primary} />
      </View>
      <View style={styles.detailBody}>
        <Text style={styles.detailLabel}>{label}</Text>
        {editing ? (
          <TextInput
            style={styles.detailInput}
            value={value || ''}
            onChangeText={onChangeText}
            placeholder={placeholder || label}
            placeholderTextColor={COLORS.textSecondary}
            keyboardType={keyboardType}
            maxLength={maxLength}
            autoCapitalize={autoCapitalize}
          />
        ) : (
          <Text style={styles.detailValue}>{value || '—'}</Text>
        )}
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <DetailRow icon={icon} label={label} value={value} />;
}

function formatStatusLabel(raw: string | null | undefined): string {
  return String(raw || '—')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Badge UI only — full "Lost · reason" stays in coupon_meta for history/filters. */
function shortLeadStatusLabel(label: string): string {
  const s = String(label || '').trim();
  if (/^lost\b/i.test(s)) return 'Lost';
  return s;
}

function resolveLeadDisplayStatus(lead: any, callLogs?: any[]): string {
  let resolved = '';
  const metaLabel = String(lead?.coupon_meta?.last_call_label || '').trim();
  if (metaLabel) {
    resolved = metaLabel;
  } else {
    const result = String(lead?.coupon_meta?.last_call_result || '').toUpperCase();
    if (result && result !== 'RINGING') {
      const fromOpt = statusOptions.find((o) => o.id === result);
      if (fromOpt) resolved = fromOpt.label;
    }

    if (!resolved) {
      const hist = Array.isArray(lead?.coupon_meta?.profile_history)
        ? lead.coupon_meta.profile_history
        : [];
      for (const entry of hist) {
        const s = String(entry?.status || '').toUpperCase();
        if (s && s !== 'RINGING') {
          const fromOpt = statusOptions.find((o) => o.id === s);
          if (fromOpt) {
            resolved = fromOpt.label;
            break;
          }
        }
      }
    }

    if (!resolved) {
      const latestNotes = callLogs?.[0]?.notes;
      const tagged = String(latestNotes || '').match(/^\[([^\]]+)\]/);
      if (tagged?.[1]) resolved = tagged[1];
    }

    if (!resolved) {
      const status = String(lead?.status || '').toUpperCase();
      switch (status) {
        case 'NEW':
          resolved = 'New';
          break;
        case 'VALIDATED':
          resolved = 'Booking confirmed';
          break;
        case 'IN_PROGRESS':
          resolved = 'In Service';
          break;
        case 'COMPLETED':
          resolved = 'Service Done';
          break;
        case 'REJECTED':
          resolved = 'Lost';
          break;
        case 'CONTACTED':
          resolved = 'Contacted';
          break;
        case 'ASSIGNED':
          resolved = 'Assigned';
          break;
        case 'ACCEPTED':
          resolved = 'Accepted';
          break;
        default:
          resolved = formatStatusLabel(status || 'New');
      }
    }
  }

  return shortLeadStatusLabel(resolved);
}

function stripDispositionPrefix(notes: string): string {
  return String(notes || '').replace(/^\[[^\]]+\]\s*/, '').trim();
}

function formatCallLogLabel(
  callStatus: string | null | undefined,
  outcome: string | null | undefined,
  notes?: string | null,
): string {
  const tagged = String(notes || '').match(/^\[([^\]]+)\]/);
  if (tagged?.[1]) return tagged[1];
  const status = String(callStatus || '').toUpperCase();
  const out = String(outcome || '').toUpperCase();
  if (status === 'NO_ANSWER' || status === 'BUSY' || status === 'SWITCHED_OFF') return 'Ringing';
  if (out === 'LEAD_CREATED') return 'Booking confirmed';
  if (out === 'NOT_INTERESTED') return 'Lost';
  if (out === 'INFO_COLLECTED') return 'Interested';
  if (status === 'ANSWERED') return 'Connected';
  return formatStatusLabel(callStatus);
}

function formatPaymentMode(raw: string | null | undefined): string {
  const v = String(raw || '').toUpperCase();
  if (v === 'PAY_LATER') return 'Pay Later';
  if (v === 'PAY_NOW') return 'Pay Now';
  if (v === 'CASH') return 'Cash';
  if (v === 'UPI') return 'UPI';
  if (v === 'ONLINE') return 'Online';
  return String(raw || '').replace(/_/g, ' ');
}

function formatLeadAddress(
  address: string | null | undefined,
  city?: string | null,
  pincode?: string | null,
): string {
  let cleaned = String(address || '')
    .replace(/\s*\((home|work|other)\)/gi, '')
    .replace(/,?\s*Landmark:\s*/gi, ', Near ')
    .replace(/,?\s*PIN\s*(\d{6})/gi, ', $1')
    .replace(/,{2,}/g, ',')
    .replace(/,\s*,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();
  const c = String(city || '').trim();
  const p = String(pincode || '').trim();
  if (c && !cleaned.toLowerCase().includes(c.toLowerCase())) cleaned = cleaned ? `${cleaned}, ${c}` : c;
  if (p && !cleaned.includes(p)) cleaned = cleaned ? `${cleaned} ${p}` : p;
  return cleaned || '—';
}

function formatLeadSchedule(lead: any): string {
  const meta = lead?.coupon_meta || {};
  return (
    formatPreferredSlotLabel({
      preferred_slot_start: lead?.preferred_slot_start,
      preferred_date: meta.pickup_date || lead?.preferred_date,
      preferred_time_slot: meta.pickup_time || lead?.preferred_time_slot,
    }) || ''
  );
}

function getStatusBg(status: string): string {
  switch (status) {
    case 'NEW': return '#DBEAFE';
    case 'ASSIGNED': return '#E0E7FF';
    case 'ACCEPTED': return '#D1FAE5';
    case 'REJECTED': return '#FEE2E2';
    case 'COMPLETED': return '#D1FAE5';
    default: return 'rgba(255,255,255,0.25)';
  }
}

function getStatusFg(status: string): string {
  switch (status) {
    case 'NEW': return COLORS.primary;
    case 'ASSIGNED': return COLORS.indigo;
    case 'ACCEPTED': return COLORS.green;
    case 'REJECTED': return COLORS.red;
    case 'COMPLETED': return COLORS.green;
    default: return '#fff';
  }
}

function getCallStatusBadge(status: string): { bg: string; fg: string } {
  const key = String(status || '').toUpperCase();
  if (key === 'ANSWERED' || key === 'CONNECTED') {
    return { bg: '#D1FAE5', fg: '#047857' };
  }
  if (
    key.includes('BOOKING') ||
    key === 'VALIDATED' ||
    key === 'SERVICE DONE' ||
    key === 'COMPLETED'
  ) {
    return { bg: '#D1FAE5', fg: '#047857' };
  }
  if (key.includes('INTERESTED') || key.includes('WILL VISIT') || key === 'IN SERVICE' || key === 'IN_PROGRESS') {
    return { bg: '#DBEAFE', fg: COLORS.primary };
  }
  if (key.includes('LOST') || key === 'REJECTED' || key === 'WRONG_NUMBER') {
    return { bg: '#FEE2E2', fg: '#B91C1C' };
  }
  switch (key) {
    case 'NO_ANSWER':
    case 'BUSY':
    case 'RINGING':
      return { bg: '#FEF3C7', fg: '#B45309' };
    case 'SWITCHED_OFF':
      return { bg: '#E5E7EB', fg: '#374151' };
    case 'NEW':
      return { bg: '#DBEAFE', fg: COLORS.primary };
    default:
      return { bg: 'rgba(255,255,255,0.22)', fg: '#fff' };
  }
}

function getStatusColor(status: string): string {
  return getStatusBg(status);
}

function getCallStatusColor(status: string, outcome?: string | null): string {
  const out = String(outcome || '').toUpperCase();
  if (out === 'NOT_INTERESTED') return COLORS.red + '30';
  if (out === 'LEAD_CREATED') return COLORS.green + '30';
  switch (status) {
    case 'ANSWERED': return COLORS.green + '30';
    case 'NO_ANSWER': return COLORS.orange + '30';
    case 'BUSY': return COLORS.orange + '30';
    case 'SWITCHED_OFF': return COLORS.gray[500] + '30';
    case 'WRONG_NUMBER': return COLORS.red + '30';
    default: return COLORS.gray[500] + '30';
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'URGENT': return COLORS.red + '30';
    case 'HIGH': return COLORS.orange + '30';
    default: return COLORS.gray[500] + '30';
  }
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: SPACING.md,
  },
  headerBarEmbedded: {
    paddingTop: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    zIndex: 2,
  },
  headerBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
  },
  errorText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.red,
  },
  button: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: '46%',
    flexShrink: 0,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 6,
  },
  actionButtonCall: {
    flex: 0.9,
    paddingHorizontal: 10,
  },
  actionButtonWa: {
    flex: 1.35,
    paddingHorizontal: 12,
  },
  actionButtonIconOnly: {
    flex: 0,
    width: 48,
    paddingHorizontal: 0,
  },
  actionButtonPrimary: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonSecondary: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#34D399',
  },
  actionButtonEdit: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
  },
  actionButtonTextPrimary: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  actionButtonTextSecondary: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 13,
  },
  pricingSendWrap: {
    paddingHorizontal: SPACING.md,
    paddingTop: 10,
  },
  pricingSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#004AAD',
    borderRadius: 14,
    paddingVertical: 13,
  },
  pricingSendBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  pricingSendHint: {
    marginTop: 6,
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionButtonTextEdit: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E8EEF7',
    shadowColor: '#023D95',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statDivider: {
    width: 1,
    height: 48,
    alignSelf: 'center',
    backgroundColor: COLORS.gray[200],
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  section: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconBtn: {
    padding: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textHeading,
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EEF7',
    shadowColor: '#023D95',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    gap: 8,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  detailRowCompact: {
    flex: 1,
  },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  detailBody: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  detailInput: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#D6E4F7',
    borderRadius: 10,
    backgroundColor: '#F8FBFF',
    marginTop: 2,
  },
  fuelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  fuelChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D6E4F7',
    backgroundColor: '#F8FBFF',
  },
  fuelChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  fuelChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  fuelChipTextActive: {
    color: '#fff',
  },
  inlineNotes: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#D6E4F7',
    borderRadius: 12,
    padding: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: '#F8FBFF',
    textAlignVertical: 'top',
  },
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.md,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 18 : 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: 1,
    borderTopColor: '#E8EEF7',
  },
  saveBarBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBarBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  cityOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  citySheet: {
    backgroundColor: '#fff',
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cityRowActive: {
    backgroundColor: '#F0F7FF',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  cityRowText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  cityRowTextActive: {
    color: COLORS.primary,
  },
  workshopPickBox: {
    marginTop: 10,
    gap: 6,
  },
  workshopPickHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
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
  workshopPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EEF7',
    backgroundColor: '#F8FBFF',
    marginTop: 4,
  },
  workshopPickRowActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#EAF2FF',
  },
  workshopPickName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  workshopPickCenter: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 2,
  },
  workshopPickSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  customerMsgBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  customerMsgText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
    backgroundColor: '#F8FBFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E8EEF7',
  },
  fieldCaption: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
    marginBottom: 2,
  },
  mutedValue: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  priceCard: {
    backgroundColor: '#F0F7FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 6,
  },
  priceCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  priceCardValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  priceMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  priceMetaLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  priceMetaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  pricePayable: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textHeading,
  },
  priceMode: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  priceEmpty: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 4,
  },
  priceEmptyText: {
    fontSize: 12,
    color: '#9A3412',
    fontWeight: '600',
  },
  lineItemsBox: {
    marginTop: 6,
    backgroundColor: '#FAFCFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EEF7',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    gap: 10,
  },
  lineItemName: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  lineItemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textHeading,
  },
  outcomeHint: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoContent: {
    marginLeft: 10,
    flex: 1,
  },
  infoItem: {
    marginBottom: SPACING.sm,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: 2,
    lineHeight: 20,
  },
  couponBanner: {
    backgroundColor: COLORS.yellow + '20',
    borderRadius: 10,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  couponHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  couponTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.orange,
  },
  couponCode: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.orange,
    backgroundColor: COLORS.yellow + '40',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  couponText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  italic: {
    fontStyle: 'italic',
  },
  pickupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blue + '20',
    padding: SPACING.sm,
    borderRadius: 8,
    marginTop: SPACING.xs,
  },
  pickupText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.blue,
    marginLeft: SPACING.xs,
  },
  formCard: {
    backgroundColor: '#F8FBFF',
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#DCE8F8',
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textHeading,
    marginBottom: SPACING.sm,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  chipTextActive: {
    color: COLORS.white,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.gray[200] || '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  selectBtnText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    maxHeight: '70%',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 10,
  },
  menuItem: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[200] || '#E5E7EB',
  },
  menuItemText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  datetimeButton: {
    borderWidth: 1,
    borderColor: COLORS.gray[500] + '40',
    borderRadius: 8,
    padding: SPACING.sm,
    backgroundColor: COLORS.white,
    marginBottom: SPACING.sm,
  },
  datetimeButtonText: {
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.gray[500] + '40',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  formButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  formButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
  formButtonSecondary: {
    backgroundColor: COLORS.gray[500] + '30',
  },
  formButtonTextPrimary: {
    color: '#fff',
    fontWeight: 'bold',
  },
  formButtonTextSecondary: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  logCard: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[500] + '20',
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  logBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  logBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  logDuration: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  logNotes: {
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  logTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  followUpType: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  priorityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    padding: SPACING.lg,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  tag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  tagBlue: {
    backgroundColor: '#DBEAFE',
  },
  tagGreen: {
    backgroundColor: '#D1FAE5',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});

