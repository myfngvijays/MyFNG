import React, { useState, useEffect, useRef } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Icon } from '../../../components/Icon';
import { supabase, withTimeout } from '../../../lib/supabase';
import CarLoading from '../../../components/CarLoading';
import { workshopPublicPageAddress } from '../../../lib/workshopDisplay';
import { formatPreferredSlotLabel } from '../../../lib/preferredSlot';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';
import { closeLeadFollowUps, crmLeadClosedForFollowUp } from '../../../lib/telecaller/crmFollowUpClose';
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
import {
  ADMIN_CRM_STATUS_OPTIONS,
  resolveAdminCrmStatusId,
} from '../../../lib/telecaller/adminCrmStatus';
import { serviceLeadVehicleNumber } from '../../../lib/telecaller/serviceLeadVehicleNumber';
import { COLORS, SPACING } from '../../../constants/theme';
import CarModelSearchField from '../../../components/CarModelSearchField';
import LeadTagsPicker from '../../../components/telecaller/LeadTagsPicker';
import CrmServicePlanPicker from '../../../components/telecaller/CrmServicePlanPicker';
import CrmPickupVisitStep, {
  type CrmPickupVisitValue,
} from '../../../components/telecaller/CrmPickupVisitStep';
import CrmFollowUpDateTime, { snapTimeToTenMinutes } from '../../../components/telecaller/CrmFollowUpDateTime';
import { isoToIstParts, istDateTimeToIso, istHm, istWeekday, istYmd } from '../../../lib/crmDateRange';
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
  repeat_customer: boolean;
  telecaller_remark: string;
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
    repeat_customer: false,
    telecaller_remark: '',
  };
}

function activityStamp(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let hours = ist.getUTCHours();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  const time = `${hours}:${String(ist.getUTCMinutes()).padStart(2, '0')} ${ampm}`;
  const year = ist.getUTCFullYear() === now.getUTCFullYear() ? '' : ` ${String(ist.getUTCFullYear()).slice(2)}`;
  return `${ist.getUTCDate()} ${months[ist.getUTCMonth()]}${year}, ${time}`;
}

function splitActivityStamp(label: string): { date: string; time: string } {
  const text = String(label || '').trim();
  const match = text.match(/^(.*?),\s*(\d{1,2}:\d{2}\s*[ap]m.*)$/i);
  if (!match) return { date: text, time: '' };
  return { date: match[1].trim(), time: match[2].trim() };
}

function bareStatusNote(notes: string): string {
  const text = String(notes || '').trim();
  if (!/^[A-Z][A-Z0-9_ ]{1,28}$/.test(text)) return '';
  return text.replace(/_/g, ' ');
}

function activityAccent(item: { kind?: string; title?: string }): string {
  const title = String(item.title || '');
  if (item.kind === 'call') return '#2563EB';
  if (/whatsapp received/i.test(title)) return '#059669';
  if (/whatsapp sent/i.test(title)) return '#0284C7';
  if (/reminder/i.test(title)) return '#D97706';
  if (/created/i.test(title)) return '#16A34A';
  return '#64748B';
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
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    return {
      date: `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`,
      time: `${String(ist.getUTCHours()).padStart(2, '0')}:${String(ist.getUTCMinutes()).padStart(2, '0')}`,
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
    telecaller_remark: String(data?.notes || '').trim(),
    repeat_customer: (() => {
      const flag = meta.repeat_customer;
      if (flag === true || flag === 1) return true;
      const text = String(flag || '').trim().toLowerCase();
      if (text === 'yes' || text === 'true' || text === '1' || text === 'checked') return true;
      const imported =
        data?.meta?.import_fields && typeof data.meta.import_fields === 'object' ? data.meta.import_fields : {};
      const marked = String(imported['Repeat Customer'] || '').trim().toLowerCase();
      return marked === 'yes' || marked === 'true' || marked === '1' || marked === 'checked';
    })(),
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
  { id: 'RINGING', label: 'Ringing', call_status: 'NO_ANSWER', outcome: null },
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
  {
    id: 'OTHER',
    label: 'Other',
    call_status: 'ANSWERED',
    outcome: 'INFO_COLLECTED',
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
  const ymd = dateYmd || istYmd();
  const hm = snapTimeToTenMinutes(timeHm) || timeHm || istHm();
  return istDateTimeToIso(ymd, hm);
}

function activityResultFromLead(data: any): string {
  const raw = String(data?.coupon_meta?.last_call_result || '')
    .toUpperCase()
    .trim();
  if (raw) return raw;
  const st = String(data?.status || '').toUpperCase();
  if (st === 'VALIDATED') return 'BOOKING_CONFIRMED';
  if (st === 'IN_PROGRESS') return 'IN_SERVICE';
  if (st === 'COMPLETED') return 'SERVICE_DONE';
  if (st === 'REJECTED') return 'LOST';
  return 'RINGING';
}

export default function TelecallerLeadDetailScreen({
  route,
  navigation,
  embedded = false,
  initialEditing = true,
  showLeadIq: showLeadIqProp,
}: any) {
  const { user, userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const detailScrollRef = useRef<ScrollView>(null);
  const remindersY = useRef(0);
  const saveBarBottomPad = Math.max(insets.bottom, 10) + 16;
  const { leadId } = route.params;
  const roleCode = String(userProfile?.role?.role_code || '').toUpperCase();
  const showLeadIq =
    showLeadIqProp !== false &&
    (roleCode === 'TELECALLER' ||
      roleCode === 'LEAD_MANAGER' ||
      roleCode === 'SUPER_ADMIN' ||
      roleCode === 'SUB_ADMIN' ||
      showLeadIqProp === true);
  const canSeeMlDl = showLeadIq;

  const [lead, setLead] = useState<any>(null);
  const [repeatCustomer, setRepeatCustomer] = useState(false);
  const [hasMembership, setHasMembership] = useState(false);
  const [repeatRemark, setRepeatRemark] = useState<string | null>(null);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [showAllReminders, setShowAllReminders] = useState(false);
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [addingReminder, setAddingReminder] = useState(false);
  const [editFollowUp, setEditFollowUp] = useState({ type: 'CALLBACK', date: '', time: '', reason: '' });
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
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [statusDraftId, setStatusDraftId] = useState('');
  const [showLostMenu, setShowLostMenu] = useState(false);
  const [showOtherMenu, setShowOtherMenu] = useState(false);
  const [otherDraft, setOtherDraft] = useState('');
  const [serviceTypeNames, setServiceTypeNames] = useState<string[]>([]);
  const [subserviceNames, setSubserviceNames] = useState<string[]>([]);
  const [pricingItems, setPricingItems] = useState<Array<{ name: string; price: number }>>([]);
  const [couponInput, setCouponInput] = useState('');
  const [activeCoupons, setActiveCoupons] = useState<Array<{ id: string; code: string; description?: string }>>([]);
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
    otherReason: '',
    notes: '',
    date: '',
    time: '',
    serviceDate: '',
  });
  const [statusOptions, setStatusOptions] =
    useState<CallDisposition[]>(DEFAULT_STATUS_OPTIONS);
  const [lostReasons, setLostReasons] = useState<string[]>(DEFAULT_LOST_REASONS);
  const [otherReasons, setOtherReasons] = useState<string[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<Array<{ id: string; name: string }>>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  const setEditField = (key: keyof EditForm, value: any) =>
    setEditForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    setRepeatCustomer(false);
    setRepeatRemark(null);
    setHasMembership(false);
    apiFetch<{ repeat_customer?: boolean; repeat_remark?: string | null; has_membership?: boolean }>(
      `/api/crm/repeat-customer?lead_id=${encodeURIComponent(String(leadId))}`,
    )
      .then((data) => {
        if (cancelled) return;
        setRepeatCustomer(Boolean(data?.repeat_customer));
        setRepeatRemark(data?.repeat_remark ? String(data.repeat_remark) : null);
        setHasMembership(Boolean(data?.has_membership));
      })
      .catch(() => {
        if (!cancelled) {
          setRepeatCustomer(false);
          setRepeatRemark(null);
          setHasMembership(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const lastPhoneLookupRef = React.useRef<string>('');
  const activityTouchedRef = React.useRef(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ coupons?: Array<{ id: string; code: string; description?: string }> }>('/api/telecaller/coupons')
      .then((data) => {
        if (!cancelled) setActiveCoupons(Array.isArray(data?.coupons) ? data.coupons : []);
      })
      .catch(() => {
        if (!cancelled) setActiveCoupons([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<any>('/api/lead-manager/statuses');
        const rows = Array.isArray(data?.statuses) ? data.statuses : [];
        if (!cancelled && rows.length) {
          const mapped: CallDisposition[] = rows.map((r: any) => ({
            id: String(r.code || '').toUpperCase(),
            label: String(r.name || r.code),
            call_status: String(r.call_status || 'ANSWERED').toUpperCase(),
            outcome: r.outcome ? String(r.outcome).toUpperCase() : null,
            lead_status: r.pipeline_status ? String(r.pipeline_status).toUpperCase() : null,
            requires_follow_up: Boolean(r.requires_follow_up),
            requires_lost_reason:
              Boolean(r.requires_lost_reason) || String(r.code).toUpperCase() === 'LOST',
          }));
          const withoutRinging = mapped.filter((o) => o.id !== 'RINGING');
          setStatusOptions([RINGING, ...withoutRinging]);
        }
        const reasons = Array.isArray(data?.lost_reasons) ? data.lost_reasons : [];
        if (!cancelled && reasons.length) {
          setLostReasons(
            reasons.map((r: any) => String(r.name || '').trim()).filter(Boolean),
          );
        }
        const others = Array.isArray(data?.other_reasons) ? data.other_reasons : [];
        if (!cancelled) {
          setOtherReasons(others.map((r: any) => String(r.name || '').trim()).filter(Boolean));
        }
        const fieldRes = await apiFetch<any>('/api/lead-manager/fields');
        if (!cancelled) {
          setCustomFieldDefs(Array.isArray(fieldRes?.fields) ? fieldRes.fields : []);
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
    const followUp = isoToIstParts(data?.next_follow_up_at);
    setActivityData((prev) => ({
      ...prev,
      result: activityResultFromLead(data),
      lostReason: String(meta.last_lost_reason || ''),
      otherReason: String(meta.last_other_reason || ''),
      serviceDate: (() => {
        const imported =
          data?.meta?.import_fields && typeof data.meta.import_fields === 'object'
            ? data.meta.import_fields
            : {};
        const raw = String(
          meta.service_done_at || data?.meta?.service_date || imported['Service Date'] || imported['Service Done Date'] || '',
        ).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
        const d = new Date(raw);
        if (!raw || Number.isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      })(),
    }));
    const bag = meta.custom_fields;
    setCustomFieldValues(
      bag && typeof bag === 'object' && !Array.isArray(bag)
        ? Object.fromEntries(Object.entries(bag).map(([k, v]) => [String(k), String(v ?? '')]))
        : {},
    );
    setActivityData((prev) => ({
      ...prev,
      ...(activityTouchedRef.current
        ? {}
        : {
            date: followUp?.ymd || '',
            time: followUp ? snapTimeToTenMinutes(followUp.hm) : '',
          }),
    }));
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
        telecaller_remarks: activityData.notes.trim() || null,
        repeat_customer: Boolean(editForm.repeat_customer),
        service_done_at:
          activityData.result === 'SERVICE_DONE'
            ? activityData.serviceDate
            : couponMeta.service_done_at || null,
      };

      let dispositionStatus: string | null = null;
      const selected =
        statusOptions.find((r) => r.id === activityData.result) || RINGING;
      const otherItem = selected.id === 'OTHER' ? activityData.otherReason.trim() : '';
      const statusLabel =
        selected.id === 'LOST'
          ? `Lost · ${activityData.lostReason.trim() || 'Other Reasons'}`
          : otherItem
            ? `Other · ${otherItem}`
            : selected.label;
      nextMeta.last_call_status = selected.call_status;
      nextMeta.last_call_result = selected.id;
      nextMeta.last_call_label = statusLabel;
      nextMeta.last_lost_reason =
        selected.id === 'LOST' ? activityData.lostReason.trim() || 'Other Reasons' : null;
      nextMeta.last_other_reason = selected.id === 'OTHER' ? otherItem || null : null;
      nextMeta.custom_fields = customFieldValues;
      nextMeta.last_call_at = new Date().toISOString();
      if (selected.lead_status) dispositionStatus = selected.lead_status;
      const servicesChangedLocal = servicesIdsChanged(
        initialServiceTypes,
        editForm.service_types,
        initialServiceAddons,
        editForm.service_addons,
      );
      const bookingConfirmed = selected.id === 'BOOKING_CONFIRMED';

      const originalForm = buildFormFromLead(lead);
      const changeLines: string[] = [];
      const changedTo = (label: string, before: unknown, after: unknown) => {
        const prev = String(before ?? '').trim();
        const next = String(after ?? '').trim();
        if (prev === next) return;
        changeLines.push(next ? `${label} updated to ${next}` : `${label} removed`);
      };
      changedTo('Name', lead?.customer_name, editForm.customer_name.trim());
      changedTo('Phone', String(lead?.customer_phone || '').slice(-10), editForm.customer_phone);
      changedTo('Alternate phone', lead?.customer_alternate_phone, editForm.customer_alternate_phone);
      changedTo('Email', lead?.customer_email, editForm.customer_email);
      changedTo('City', lead?.city, editForm.city);
      changedTo('Pincode', lead?.pincode, editForm.pincode);
      changedTo('Car number', lead?.vehicle_number, editForm.vehicle_number);
      if (
        String(lead?.vehicle_make || '') !== editForm.vehicle_make ||
        String(lead?.vehicle_model || '') !== editForm.vehicle_model
      ) {
        changeLines.push(`Car model updated to ${`${editForm.vehicle_make} ${editForm.vehicle_model}`.trim()}`);
      }
      changedTo('Year', lead?.vehicle_year, editForm.vehicle_year);
      changedTo('Priority', lead?.lead_priority, editForm.lead_priority);
      if (String(lead?.workshop_id || '') !== String(editForm.workshop_id || '')) {
        changeLines.push(
          editForm.workshop_name
            ? `Workshop updated to ${editForm.workshop_name}`
            : 'Workshop updated',
        );
      }
      if (originalForm.pickup_date !== editForm.pickup_date) {
        changeLines.push(
          editForm.pickup_date ? `Pickup date selected: ${editForm.pickup_date}` : 'Pickup date removed',
        );
      }
      if (originalForm.pickup_time !== editForm.pickup_time) {
        changeLines.push(
          editForm.pickup_time ? `Pickup time selected: ${editForm.pickup_time}` : 'Pickup time removed',
        );
      }
      if (servicesChangedLocal) {
        const prevIds = initialServiceTypes || [];
        const nextIds = editForm.service_types || [];
        const prevSet = new Set(prevIds);
        const nextSet = new Set(nextIds);
        const changedIds = [
          ...nextIds.filter((id) => !prevSet.has(id)),
          ...prevIds.filter((id) => !nextSet.has(id)),
        ];
        const nameById: Record<string, string> = {};
        if (changedIds.length) {
          const { data: serviceRows } = await supabase
            .from('service_types')
            .select('id, name')
            .in('id', changedIds);
          for (const row of serviceRows || []) nameById[String(row.id)] = String(row.name || 'Package');
        }
        for (const id of nextIds) {
          if (!prevSet.has(id)) changeLines.push(`Package selected: ${nameById[id] || 'Package'}`);
        }
        for (const id of prevIds) {
          if (!nextSet.has(id)) changeLines.push(`Package removed: ${nameById[id] || 'Package'}`);
        }
      }
      if (String(couponMeta.last_call_result || '') !== String(activityData.result || '')) {
        changeLines.push(`Status set to ${statusLabel}`);
      }
      const prevRemark = String(couponMeta.telecaller_remarks || '').trim();
      const nextRemark = activityData.notes.trim();
      if (prevRemark !== nextRemark) {
        if (!prevRemark && nextRemark) changeLines.push(`Workshop remark added: ${nextRemark}`);
        else if (prevRemark && !nextRemark) changeLines.push('Workshop remark removed');
        else changeLines.push(`Workshop remark updated: ${nextRemark}`);
      }
      const prevTeleRemark = String(lead?.notes || '').trim();
      const nextTeleRemark = editForm.telecaller_remark.trim();
      if (prevTeleRemark !== nextTeleRemark) {
        if (!prevTeleRemark && nextTeleRemark) changeLines.push(`Telecaller remark added: ${nextTeleRemark}`);
        else if (prevTeleRemark && !nextTeleRemark) changeLines.push('Telecaller remark removed');
        else changeLines.push(`Telecaller remark updated: ${nextTeleRemark}`);
      }
      if (bookingConfirmed) changeLines.push('Booking confirmed');

      const historyEntry = changeLines.length
        ? {
            at: new Date().toISOString(),
            summary: changeLines.join('\n'),
            remark: null,
            status: activityData.result,
            workshop_id: editForm.workshop_id || null,
            workshop_name: editForm.workshop_name || null,
            city: editForm.city || null,
            pincode: editForm.pincode || null,
          }
        : null;
      const prevHistory = Array.isArray(couponMeta.profile_history) ? couponMeta.profile_history : [];
      nextMeta.profile_history = historyEntry ? [historyEntry, ...prevHistory].slice(0, 50) : prevHistory;

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
              workshop_id: editForm.workshop_id || null,
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
        notes: editForm.telecaller_remark.trim() || null,
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
            notes: payload.notes,
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

      // Persist activity disposition (including Ringing)
      try {
        const selected =
          statusOptions.find((r) => r.id === activityData.result) || RINGING;
        const otherItem = selected.id === 'OTHER' ? activityData.otherReason.trim() : '';
        const statusLabel =
          selected.requires_lost_reason || selected.id === 'LOST'
            ? `Lost · ${activityData.lostReason}`
            : otherItem
              ? `Other · ${otherItem}`
              : selected.label;
        const whenIso = combineDateAndTime(activityData.date, activityData.time);
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
          last_other_reason: selected.id === 'OTHER' ? activityData.otherReason.trim() || null : null,
          last_call_at: new Date().toISOString(),
        };
        const leadUpdate: Record<string, unknown> = {
          last_call_at: new Date().toISOString(),
          total_calls: (lead?.total_calls || 0) + 1,
          coupon_meta: nextCallMeta,
          updated_at: new Date().toISOString(),
        };
        if (selected.lead_status) leadUpdate.status = selected.lead_status;
        const wantsFollowUp = (selected.requires_follow_up || selected.id === 'CALLBACK') && whenIso;
        if (wantsFollowUp) {
          leadUpdate.follow_up_required = true;
          leadUpdate.next_follow_up_at = whenIso;
        } else if (
          crmLeadClosedForFollowUp({
            status: selected.lead_status,
            coupon_meta: { last_call_result: selected.id },
          })
        ) {
          leadUpdate.follow_up_required = false;
          leadUpdate.next_follow_up_at = null;
        }
        await supabase.from('service_leads').update(leadUpdate).eq('id', leadId);

        if (wantsFollowUp) {
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
        } else if (
          crmLeadClosedForFollowUp({
            status: selected.lead_status,
            coupon_meta: { last_call_result: selected.id },
          })
        ) {
          await closeLeadFollowUps(supabase, leadId, {
            note: `Auto-closed — ${statusLabel}`,
          });
        }
      } catch (actErr) {
        console.warn('[LeadDetail] activity log during save failed', actErr);
      }

      activityTouchedRef.current = false;
      setActivityData({
        result: activityData.result,
        lostReason: activityData.result === 'LOST' ? activityData.lostReason : '',
        otherReason: activityData.result === 'OTHER' ? activityData.otherReason : '',
        notes: '',
        date: '',
        time: '',
        serviceDate: activityData.serviceDate,
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
    statusOptions.find((r) => r.id === activityData.result) || RINGING;

  const openStatusMenu = () => {
    setStatusDraftId(activityData.result || selectedResult.id);
    setShowLostMenu(false);
    setShowOtherMenu(false);
    setEditing(true);
    setShowStatusMenu(true);
  };

  const applyStatusChoice = (opt: CallDisposition) => {
    setEditing(true);
    setActivityData((prev) => ({
      ...prev,
      result: opt.id,
      lostReason: opt.requires_lost_reason || opt.id === 'LOST' ? prev.lostReason : '',
      otherReason: opt.id === 'OTHER' ? prev.otherReason : '',
    }));
    if (opt.id === 'BOOKING_CONFIRMED') {
      setEditForm((prev) => ({ ...prev, pickup_required: true }));
    }
    setShowStatusMenu(false);
    if (opt.id === 'LOST' || opt.requires_lost_reason) setShowLostMenu(true);
    if (opt.id === 'OTHER') setShowOtherMenu(true);
  };

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
          : /whatsapp received/i.test(String(item.title || ''))
            ? '#D1FAE5'
            : /whatsapp sent/i.test(String(item.title || ''))
              ? '#E0F2FE'
              : COLORS.orange + '22',
        timeLabel: item.at
          ? `${activityStamp(item.at)}${item?.meta?.by ? ` · ${item.meta.by}` : ''}`
          : '',
        noRecordingYet: isCall && !hasRecording,
      });
    }

    const crmId = resolveAdminCrmStatusId(lead);
    const crmLabel =
      ADMIN_CRM_STATUS_OPTIONS.find((opt) => opt.id === crmId)?.label || crmId;
    const lastCallAt = String(couponMeta.last_call_at || '').trim();
    if (crmId && crmId !== 'FRESH' && lastCallAt) {
      const already = out.some(
        (row) =>
          String(row.title || '').toLowerCase().includes(crmLabel.toLowerCase()) ||
          (crmId === 'RINGING' && /\bringing\b/i.test(String(row.title || ''))),
      );
      if (!already) {
        pushUnique(out, {
          id: `disp-local-${crmId}-${lastCallAt}`,
          kind: 'update',
          callLogId: '',
          hasRecording: false,
          sortAt: lastCallAt,
          title: `Lead updated · ${crmLabel}`,
          notes: String(lead?.telecaller_remarks || couponMeta.telecaller_remarks || '').trim(),
          badgeColor: COLORS.orange + '22',
          timeLabel: activityStamp(lastCallAt),
          noRecordingYet: false,
        });
      }
    }

    // 2) Local User History (coupon_meta.profile_history) — merge into Activity
    for (let i = 0; i < (profileHistory || []).length; i++) {
      const h = profileHistory[i] || {};
      const at = String(h.at || '').trim();
      if (!at) continue;
      const remark = h.remark ? String(h.remark).trim() : '';
      const summaryLines = String(h.summary || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const statusLine = summaryLines.find((line) => /^status\b/i.test(line)) || '';
      const detailLines = summaryLines.filter((line) => line !== statusLine);
      let title = statusLine || summaryLines[0] || String(h.event || 'Updated');
      if (String(h.status || '').toUpperCase() === 'RINGING' || /\bringing\b/i.test(remark)) {
        title = 'Ringing';
      }
      const notes = [remark, ...detailLines].filter(Boolean).join('\n');
      pushUnique(out, {
        id: `hist-local-${i}-${at}`,
        kind: 'update',
        callLogId: '',
        hasRecording: false,
        sortAt: at,
        title,
        notes,
        badgeColor: COLORS.orange + '22',
        timeLabel: activityStamp(at),
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
        timeLabel: activityStamp(log.created_at),
        noRecordingYet: !hasRecording,
      });
    }

    for (const fu of followUps || []) {
      if (out.some((row) => row.id === `fu-created-${fu.id}` || row.id === `fu-done-${fu.id}`)) continue;
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
          ? `Due ${activityStamp(fu.scheduled_time)}`
          : activityStamp(fu.created_at),
        noRecordingYet: false,
      });
    }

    return out.sort(
      (a, b) => new Date(b.sortAt || 0).getTime() - new Date(a.sortAt || 0).getTime(),
    );
  }, [timelineItems, callLogs, followUps, profileHistory]);

  const detailActivity = React.useMemo(
    () => activityItems.filter((item) => !/whatsapp/i.test(item.title)),
    [activityItems],
  );
  const whatsappActivity = React.useMemo(
    () => activityItems.filter((item) => /whatsapp/i.test(item.title)),
    [activityItems],
  );

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
        canSeeMlDl
          ? apiFetch<{ items?: any[] }>(
              `/api/super_admin/app-activity?lead_id=${encodeURIComponent(leadId)}`,
            ).catch(() => ({ items: [] }))
          : Promise.resolve({ items: [] as any[] }),
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
          let resolvedName = String(hit?.name || '').trim();
          let resolvedId = String(hit?.id || '').trim();
          if (!resolvedName) {
            try {
              const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
              const json = await res.json().catch(() => []);
              resolvedName = String(json?.[0]?.PostOffice?.[0]?.District || '').trim();
            } catch {
              resolvedName = '';
            }
          }
          if (resolvedName) {
            setEditForm((prev) => ({
              ...prev,
              city: resolvedName,
              city_id: resolvedId || prev.city_id,
              pincode,
              pickup_address: String(prev.pickup_address || '').trim() ? prev.pickup_address : resolvedName,
            }));
            cityName = resolvedName;
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
            .select('id, name, workshop_name, workshop_area, near_famous_area, city, state, address, short_address, landmark, pincode, phone, is_verified, is_active')
            .eq('is_verified', true)
            .eq('is_active', true)
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
    activityTouchedRef.current = false;
  }, [leadId]);

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
      if (showOtherMenu) {
        setShowOtherMenu(false);
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
  }, [embedded, navigation, showWaChat, showStatusMenu, showLostMenu, showOtherMenu]);

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

  const beginEditFollowUp = (fu: any) => {
    if (editingFollowUpId === String(fu.id)) {
      setEditingFollowUpId(null);
      return;
    }
    const when = fu?.scheduled_time ? new Date(fu.scheduled_time) : null;
    const ok = when && !Number.isNaN(when.getTime());
    setEditFollowUp({
      type: String(fu?.follow_up_type || 'CALLBACK'),
      date: ok ? istYmd(when) : '',
      time: ok ? istHm(when).slice(0, 5) : '',
      reason: String(fu?.reason || ''),
    });
    setEditingFollowUpId(String(fu.id));
  };

  const saveEditedFollowUp = async () => {
    if (!editingFollowUpId) return;
    const scheduledIso = istDateTimeToIso(editFollowUp.date, editFollowUp.time);
    if (!scheduledIso) {
      Alert.alert('Date and time', 'Pick a valid date and time');
      return;
    }
    const { error } = await supabase
      .from('telecaller_follow_ups')
      .update({
        follow_up_type: editFollowUp.type || 'CALLBACK',
        scheduled_time: scheduledIso,
        reason: editFollowUp.reason,
      })
      .eq('id', editingFollowUpId);
    if (error) {
      Alert.alert('Could not update', error.message || 'Try again');
      return;
    }
    await supabase
      .from('service_leads')
      .update({ follow_up_required: true, next_follow_up_at: scheduledIso })
      .eq('id', leadId);
    setEditingFollowUpId(null);
    fetchLeadDetails();
  };

  const saveNewReminder = async () => {
    const scheduledIso = istDateTimeToIso(editFollowUp.date, editFollowUp.time);
    if (!scheduledIso) {
      Alert.alert('Date and time', 'Pick a valid date and time');
      return;
    }
    const { data: profile } = await supabase
      .from('users_login')
      .select('id')
      .eq('email', user?.email)
      .maybeSingle();
    const { error } = await supabase.from('telecaller_follow_ups').insert([
      {
        lead_id: leadId,
        telecaller_id: profile?.id,
        follow_up_type: 'CALLBACK',
        scheduled_time: scheduledIso,
        reason: editFollowUp.reason || '',
        priority: 'NORMAL',
        status: 'PENDING',
      },
    ]);
    if (error) {
      Alert.alert('Could not add', error.message || 'Try again');
      return;
    }
    await supabase
      .from('service_leads')
      .update({ follow_up_required: true, next_follow_up_at: scheduledIso })
      .eq('id', leadId);
    setAddingReminder(false);
    setEditFollowUp({ type: 'CALLBACK', date: '', time: '', reason: '' });
    fetchLeadDetails();
  };

  const handleSaveActivity = async () => {
    try {
      const selected = selectedResult;
      if (selected.id === 'CALLBACK' && (!activityData.date || !activityData.time)) {
        Alert.alert('Follow-up time', 'Follow-up ke liye date aur time dono select karo.');
        return;
      }

      const whenIso = combineDateAndTime(activityData.date, activityData.time);
      const otherItem = selected.id === 'OTHER' ? activityData.otherReason.trim() : '';
      const statusLabel =
        selected.id === 'LOST'
          ? `Lost · ${activityData.lostReason.trim() || 'Other Reasons'}`
          : otherItem
            ? `Other · ${otherItem}`
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
      const prevRemark = String(
        (lead?.coupon_meta && lead.coupon_meta.telecaller_remarks) || '',
      ).trim();
      const nextRemark = activityData.notes.trim();
      const remarkLine = !nextRemark
        ? prevRemark
          ? 'Workshop remark removed'
          : ''
        : prevRemark === nextRemark
          ? ''
          : prevRemark
            ? `Workshop remark updated: ${nextRemark}`
            : `Workshop remark added: ${nextRemark}`;
      const historyEntry = {
        at: new Date().toISOString(),
        summary: [statusLabel, remarkLine].filter(Boolean).join('\n'),
        remark: null,
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
        last_other_reason: selected.id === 'OTHER' ? activityData.otherReason.trim() || null : null,
        last_call_at: new Date().toISOString(),
        telecaller_remarks: activityData.notes.trim() || null,
        profile_history: [historyEntry, ...prevHistory].slice(0, 50),
      };

      const leadUpdate: Record<string, unknown> = {
        last_call_at: new Date().toISOString(),
        total_calls: (lead?.total_calls || 0) + 1,
        notes: editForm.telecaller_remark.trim() || null,
        coupon_meta: nextMeta,
        updated_at: new Date().toISOString(),
        is_incomplete: false,
      };
      if (selected.lead_status) {
        leadUpdate.status = selected.lead_status;
      }
      const wantsFollowUp = (selected.requires_follow_up || selected.id === 'CALLBACK') && whenIso;
      if (wantsFollowUp) {
        leadUpdate.follow_up_required = true;
        leadUpdate.next_follow_up_at = whenIso;
      } else if (
        crmLeadClosedForFollowUp({
          status: selected.lead_status,
          coupon_meta: { last_call_result: selected.id },
        })
      ) {
        leadUpdate.follow_up_required = false;
        leadUpdate.next_follow_up_at = null;
      }

      await supabase.from('service_leads').update(leadUpdate).eq('id', leadId);

      if (wantsFollowUp) {
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
      } else if (
        crmLeadClosedForFollowUp({
          status: selected.lead_status,
          coupon_meta: { last_call_result: selected.id },
        })
      ) {
        await closeLeadFollowUps(supabase, leadId, {
          note: `Auto-closed — ${statusLabel}`,
        });
      }

      activityTouchedRef.current = false;
      setActivityData({
        result: selected.id,
        lostReason: selected.id === 'LOST' ? activityData.lostReason : '',
        otherReason: selected.id === 'OTHER' ? activityData.otherReason : '',
        notes: '',
        date: '',
        time: '',
        serviceDate: activityData.serviceDate,
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

  const handleApplyCoupon = async (codeOverride?: string) => {
    const code = String(codeOverride || couponInput).trim().toUpperCase();
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
  const shownName = editing ? editForm.customer_name || lead.customer_name : lead.customer_name;
  const shownPhone = String(editing ? editForm.customer_phone : lead.customer_phone || '').trim();
  const ownerName = String(
    lead?.assigned_telecaller?.full_name || lead?.created_by?.full_name || '',
  ).trim();
  const serviceChip = [lead?.service_type, lead?.city].filter(Boolean).join(' · ');
  const createdLabel = lead?.created_at ? activityStamp(lead.created_at) : '';

  return (
    <KeyboardAvoidingView
      style={styles.mainContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={detailScrollRef}
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, editing && { paddingBottom: 88 + saveBarBottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          editing ? undefined : (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          )
        }
      >
        <View style={[styles.leadHero, { backgroundColor: '#004AAD', paddingTop: embedded ? 12 : Math.max(insets.top, 12) }]}>
          <View style={styles.leadHeroTop}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack?.()}>
              <Icon name="arrow-left" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.leadHeroKicker}>Lead details</Text>
              <Text style={styles.leadHeroNumber} numberOfLines={1}>#{lead.lead_number || '—'}</Text>
            </View>
            <TouchableOpacity
              style={styles.leadHeroIconBtn}
              onPress={() => setEditing((v) => !v)}
              accessibilityLabel={editing ? 'Close edit' : 'Edit lead'}
            >
              <Icon name="pencil" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.leadIdentity}>
            <View style={styles.leadAvatar}>
              <Text style={styles.leadAvatarText}>{leadInitials(shownName)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {hasMembership ? <Icon name="crown" size={16} color="#E9D5FF" /> : null}
                <Text style={styles.leadHeroName} numberOfLines={2}>{shownName || 'Customer'}</Text>
              </View>
              <TouchableOpacity
                style={styles.leadStatusPill}
                onPress={openStatusMenu}
              >
                <View style={[styles.leadStatusDot, { backgroundColor: badge.fg }]} />
                <Text style={styles.leadStatusPillText} numberOfLines={1}>
                  {editing ? selectedResult.label : formatStatusLabel(headerStatus)}
                </Text>
                <Icon name="chevron-down" size={12} color="#312E81" />
              </TouchableOpacity>
              {repeatCustomer || editForm.repeat_customer ? (
                <Text style={styles.leadRepeat} numberOfLines={2}>
                  Repeat Customer{repeatRemark ? ` · ${repeatRemark}` : ''}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.leadPhoneBar}>
            <Icon name="phone" size={16} color="#fff" />
            <Text style={styles.leadPhoneText} numberOfLines={1}>{shownPhone || 'No phone'}</Text>
            {shownPhone ? (
              <TouchableOpacity
                onPress={() => void Clipboard.setStringAsync(shownPhone)}
                accessibilityLabel="Copy phone"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="content-copy" size={16} color="#fff" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.leadActionCard}>
          <View style={styles.leadActionRow}>
          <TouchableOpacity
            style={styles.leadAction}
            onPress={() =>
              void clickToCallCustomer({
                customerPhone: shownPhone,
                leadId: lead?.id,
              })
            }
          >
            <View style={[styles.leadActionIcon, { backgroundColor: '#1D4ED8' }]}>
              <Icon name="phone" size={20} color="#fff" />
            </View>
            <Text style={styles.leadActionLabel}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.leadAction} onPress={handleOpenWhatsApp}>
            <View style={[styles.leadActionIcon, { backgroundColor: '#D1FAE5' }]}>
              <Icon name="whatsapp" size={20} color="#059669" />
            </View>
            <Text style={styles.leadActionLabel}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.leadAction}
            disabled={sendingPricing}
            onPress={handleSendPricingWhatsApp}
          >
            <View style={[styles.leadActionIcon, { backgroundColor: '#EDE9FE' }]}>
              {sendingPricing ? (
                <ActivityIndicator color="#6D28D9" size="small" />
              ) : (
                <Icon name="cash" size={20} color="#6D28D9" />
              )}
            </View>
            <Text style={styles.leadActionLabel}>Pricing</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.leadAction}
            onPress={() => detailScrollRef.current?.scrollTo({ y: Math.max(remindersY.current - 8, 0), animated: true })}
          >
            <View style={[styles.leadActionIcon, { backgroundColor: '#FEF3C7' }]}>
              <Icon name="alarm" size={20} color="#B45309" />
            </View>
            <Text style={styles.leadActionLabel}>Remind</Text>
          </TouchableOpacity>
          </View>

          {serviceChip || createdLabel || ownerName ? (
            <View style={styles.leadMetaBlock}>
              {serviceChip ? (
                <View style={styles.leadMetaChip}>
                  <Text style={styles.leadMetaChipText} numberOfLines={1}>{serviceChip}</Text>
                </View>
              ) : null}
              <View style={styles.leadMetaRow}>
                {createdLabel ? (
                  <View style={styles.leadMetaSoft}>
                    <Text style={styles.leadMetaSoftText} numberOfLines={1}>Created {createdLabel}</Text>
                  </View>
                ) : null}
                {ownerName ? (
                  <View style={styles.leadMetaSoft}>
                    <Text style={styles.leadMetaSoftText} numberOfLines={1}>Owner · {ownerName}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
            {activityData.result === 'LOST' ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.formLabel}>Lost reason</Text>
                <TouchableOpacity
                  style={styles.selectBtn}
                  onPress={() => {
                    setEditing(true);
                    setShowStatusMenu(false);
                    setShowOtherMenu(false);
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
              </View>
            ) : null}
            {activityData.result === 'OTHER' ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.formLabel}>Other</Text>
                <TouchableOpacity
                  style={styles.selectBtn}
                  onPress={() => {
                    setEditing(true);
                    setShowStatusMenu(false);
                    setShowLostMenu(false);
                    setShowOtherMenu(true);
                  }}
                >
                  <Text
                    style={[
                      styles.selectBtnText,
                      !activityData.otherReason && { color: COLORS.textSecondary },
                    ]}
                  >
                    {activityData.otherReason || 'Other item select karo'}
                  </Text>
                  <Icon name="chevron-down" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : null}

      {canSeeMlDl ? (
        <LeadBrainCard
          leadId={leadId}
          onOpenSimilar={(id) => navigation?.navigate?.('TelecallerLeadDetail', { leadId: id })}
        />
      ) : null}

      <View
        style={styles.section}
        onLayout={(e) => {
          remindersY.current = e.nativeEvent.layout.y;
        }}
      >
        <View style={styles.reminderHead}>
          <View style={styles.reminderIcon}>
            <Icon name="alarm" size={16} color="#B45309" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.reminderTitle}>Call reminders</Text>
            <Text style={styles.reminderSub} numberOfLines={1}>
              {followUps.length === 0 ? 'No reminders yet' : `${followUps.length} reminder${followUps.length === 1 ? '' : 's'}`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.reminderAddBtn}
            onPress={() => {
              setEditingFollowUpId(null);
              setEditFollowUp({ type: 'CALLBACK', date: '', time: '', reason: '' });
              setAddingReminder((v) => !v);
            }}
          >
            <Text style={styles.reminderAddText}>{addingReminder ? 'Close' : '+ Add'}</Text>
          </TouchableOpacity>
        </View>
        {(addingReminder || followUps.length > 0) ? (
        <View style={styles.sectionContent}>
          {addingReminder ? (
            <View style={{ gap: 8, marginBottom: 8 }}>
              <CrmFollowUpDateTime
                date={editFollowUp.date}
                time={editFollowUp.time}
                onChange={({ date, time }) => setEditFollowUp((prev) => ({ ...prev, date, time }))}
              />
              <TextInput
                value={editFollowUp.reason}
                onChangeText={(reason) => setEditFollowUp((prev) => ({ ...prev, reason }))}
                placeholder="Note"
                placeholderTextColor={COLORS.textSecondary}
                style={styles.input}
              />
              <TouchableOpacity onPress={() => void saveNewReminder()} style={styles.reminderSaveBtn}>
                <Text style={styles.reminderSaveText}>Add reminder</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {followUps.length > 0 ? (
            <>
              {(showAllReminders ? followUps : followUps.slice(0, 2)).map((fu) => (
                <View key={String(fu.id)} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reminderType}>{fu.follow_up_type || 'Reminder'}</Text>
                      <Text style={styles.reminderWhen}>
                        {fu.scheduled_time ? formatDateTime(fu.scheduled_time) : '—'}
                        {fu.reason ? ` · ${fu.reason}` : ''}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity onPress={() => beginEditFollowUp(fu)}>
                        <Text style={styles.reminderModify}>Modify</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityLabel="Delete reminder"
                        onPress={() => {
                          Alert.alert('Delete reminder', 'Remove this reminder?', [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => {
                                void (async () => {
                                  const id = String(fu.id);
                                  const { error } = await supabase.from('telecaller_follow_ups').delete().eq('id', id);
                                  if (error) {
                                    await supabase.from('telecaller_follow_ups').update({ status: 'CANCELLED' }).eq('id', id);
                                  }
                                  if (editingFollowUpId === id) setEditingFollowUpId(null);
                                  fetchLeadDetails();
                                })();
                              },
                            },
                          ]);
                        }}
                      >
                        <Icon name="trash" size={14} color="#E11D48" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {editingFollowUpId === String(fu.id) ? (
                    <View style={{ marginTop: 8, gap: 6 }}>
                      <TextInput
                        value={editFollowUp.date}
                        onChangeText={(date) => setEditFollowUp((prev) => ({ ...prev, date }))}
                        placeholder="YYYY-MM-DD"
                        style={styles.input}
                      />
                      <TextInput
                        value={editFollowUp.time}
                        onChangeText={(time) => setEditFollowUp((prev) => ({ ...prev, time }))}
                        placeholder="HH:MM"
                        style={styles.input}
                      />
                      <TextInput
                        value={editFollowUp.reason}
                        onChangeText={(reason) => setEditFollowUp((prev) => ({ ...prev, reason }))}
                        placeholder="Note"
                        style={styles.input}
                      />
                      <TouchableOpacity onPress={() => void saveEditedFollowUp()} style={styles.actionButtonPrimary}>
                        <Text style={styles.actionButtonTextPrimary}>Update</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ))}
              {followUps.length > 2 ? (
                <TouchableOpacity onPress={() => setShowAllReminders((v) => !v)}>
                  <Text style={[styles.repeatTitle, { color: COLORS.primary }]}>
                    {showAllReminders ? 'Show less' : 'Show all reminders'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}
        </View>
        ) : null}
      </View>

      {showLeadIq ? (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lead IQ</Text>
        <View style={styles.sectionContent}>
          <View style={styles.iqBtnRow}>
            <TouchableOpacity
              style={styles.iqBtnGenerate}
              disabled={leadIqRunning}
              onPress={() => void generateLeadIq(false)}
            >
              <Text style={styles.iqBtnGenerateText}>{leadIqRunning ? '…' : 'Generate'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iqBtnDeep}
              disabled={leadIqRunning}
              onPress={() => void generateLeadIq(true)}
            >
              <Text style={styles.iqBtnDeepText}>Deep AI</Text>
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
              <View style={{ gap: 8 }}>
                {activeCoupons.length > 0 ? (
                  <View style={styles.couponChipRow}>
                    {activeCoupons.map((c) => (
                      <TouchableOpacity
                        key={c.id || c.code}
                        style={styles.couponChip}
                        onPress={() => void handleApplyCoupon(c.code)}
                      >
                        <Text style={styles.couponChipText}>{c.code}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
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
                  onPress={() => void handleApplyCoupon()}
                >
                  <Text style={styles.formButtonTextPrimary}>Apply</Text>
                </TouchableOpacity>
              </View>
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

              {customFieldDefs.map((field) => (
                <View key={field.id}>
                  <Text style={styles.fieldCaption}>{field.name}</Text>
                  <TextInput
                    style={styles.input}
                    value={customFieldValues[field.id] || ''}
                    onChangeText={(text) =>
                      setCustomFieldValues((prev) => ({ ...prev, [field.id]: text }))
                    }
                    placeholder={field.name}
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              ))}

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
              {String(lead?.coupon_meta?.telecaller_remarks || '').trim() ? (
                <DetailRow
                  icon="message-text"
                  label="Workshop Remark"
                  value={String(lead.coupon_meta.telecaller_remarks).trim()}
                />
              ) : null}
              {String(lead?.notes || '').trim() ? (
                <DetailRow icon="message-text" label="Telecaller Remark" value={String(lead.notes).trim()} />
              ) : null}
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

      {/* Vehicle Information */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIconWrap, { backgroundColor: '#E0E7FF' }]}>
            <Icon name="car" size={16} color={COLORS.indigo} />
          </View>
          <Text style={styles.sectionTitle}>Vehicle</Text>
          <View style={styles.fillPill}>
            <Text style={styles.fillPillText}>
              {[
                editing ? editForm.vehicle_number : lead?.vehicle_number,
                editing ? editForm.vehicle_model || carDisplay : lead?.vehicle_model,
                editing ? editForm.vehicle_fuel_type : lead?.vehicle_fuel_type,
                editing ? editForm.vehicle_year : lead?.vehicle_year,
                editing ? editForm.odometer_km : lead?.odometer_km,
              ].filter((v) => String(v || '').trim()).length}{' '}
              of 5 filled
            </Text>
          </View>
        </View>
        <View style={styles.sectionContent}>
          {editing ? (
            <>
              <Text style={styles.fieldCaption}>Registration number</Text>
              <View style={styles.plateRow}>
                <View style={styles.plateInd}>
                  <Text style={styles.plateIndText}>IND</Text>
                </View>
                <TextInput
                  style={styles.plateInput}
                  value={formatPlate(editForm.vehicle_number)}
                  autoCapitalize="characters"
                  maxLength={16}
                  placeholder="MH 04 AB 1234"
                  placeholderTextColor="#94A3B8"
                  onChangeText={(v) =>
                    setEditField(
                      'vehicle_number',
                      v.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12),
                    )
                  }
                />
              </View>
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
              <View style={styles.fuelTray}>
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldCaption}>Year</Text>
                  <TextInput
                    style={styles.softInput}
                    value={editForm.vehicle_year}
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholder="YYYY"
                    placeholderTextColor="#94A3B8"
                    onChangeText={(v) => setEditField('vehicle_year', v.replace(/\D/g, '').slice(0, 4))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldCaption}>Odometer</Text>
                  <View style={styles.odoRow}>
                    <TextInput
                      style={[styles.softInput, { flex: 1, marginBottom: 0 }]}
                      value={editForm.odometer_km}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      onChangeText={(v) => setEditField('odometer_km', v.replace(/\D/g, ''))}
                    />
                    <Text style={styles.odoUnit}>km</Text>
                  </View>
                </View>
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
                style={styles.secondCarBtn}
                onPress={() => {
                  setShowSecondCar(true);
                  setSecondCar(emptySecondCar());
                  setSecondCarDisplay('');
                }}
              >
                <Text style={styles.secondCarBtnText}>+ Add second car</Text>
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
              style={styles.secondCarBtn}
              onPress={() => {
                setEditing(true);
                setShowSecondCar(true);
                setSecondCar(emptySecondCar());
                setSecondCarDisplay('');
              }}
            >
              <Text style={styles.secondCarBtnText}>+ Add second car</Text>
            </TouchableOpacity>
          ) : null}
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
          <View style={styles.overviewTiles}>
            <View style={styles.ovTile}>
              <Text style={styles.ovLabel}>Lead #</Text>
              <Text
                style={styles.ovLeadId}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {lead?.lead_number || '—'}
              </Text>
            </View>
            <View style={styles.ovTile}>
              <Text style={styles.ovLabel}>Status</Text>
              <Text style={[styles.ovValue, { color: '#1D4ED8' }]} numberOfLines={2}>
                {formatStatusLabel(headerStatus)}
              </Text>
            </View>
            <View style={styles.ovTile}>
              <Text style={styles.ovLabel}>Created</Text>
              <Text
                style={styles.ovLeadId}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {lead?.created_at ? activityStamp(lead.created_at) : '—'}
              </Text>
            </View>
          </View>
          {editing ? (
            <View style={{ marginBottom: 4 }}>
              <Text style={styles.fieldCaption}>Priority</Text>
              <View style={styles.priorityRow}>
                {([
                  ['NORMAL', '#1D4ED8'],
                  ['HIGH', '#B45309'],
                  ['URGENT', '#DC2626'],
                ] as const).map(([p, dot]) => {
                  const active = String(editForm.lead_priority || 'NORMAL') === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setEditField('lead_priority', p)}
                      style={[styles.priorityChip, active && { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' }]}
                    >
                      <View style={[styles.priorityDot, { backgroundColor: active ? '#fff' : dot }]} />
                      <Text style={[styles.priorityText, active && { color: '#fff' }]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
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
                placeholder="Search CRM lead or app customer"
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
          <View style={styles.repeatSwitchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.repeatTitle}>Repeat customer</Text>
              <Text style={styles.repeatHint}>Has serviced with MyFNG before</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="switch"
              accessibilityState={{ checked: Boolean(editForm.repeat_customer) }}
              onPress={() => setEditField('repeat_customer', !editForm.repeat_customer)}
              style={[styles.switchTrack, editForm.repeat_customer && styles.switchTrackOn]}
            >
              <View style={[styles.switchThumb, editForm.repeat_customer && styles.switchThumbOn]} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Service Details */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIconWrap, { backgroundColor: '#D1FAE5' }]}>
            <Icon name="wrench" size={16} color={COLORS.green} />
          </View>
          <Text style={styles.sectionTitle}>Service & Price</Text>
          <View style={styles.nonePill}>
            <Text style={styles.nonePillText}>
              {(editing ? editForm.service_types : serviceTypeNames).length
                ? `${(editing ? editForm.service_types : serviceTypeNames).length} added`
                : 'None added'}
            </Text>
          </View>
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

              <View style={styles.callResultCard}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: '#DBEAFE' }]}>
                    <Icon name="phone" size={16} color="#1D4ED8" />
                  </View>
                  <Text style={styles.sectionTitle}>Call result</Text>
                </View>
                <Text style={styles.fieldCaption}>Status after this call</Text>
                <TouchableOpacity
                  style={styles.statusSelect}
                  onPress={openStatusMenu}
                >
                  <View style={[styles.leadStatusDot, { backgroundColor: '#1D4ED8' }]} />
                  <Text style={[styles.selectBtnText, { flex: 1 }]} numberOfLines={1}>
                    {selectedResult.label}
                  </Text>
                  <Icon name="chevron-down" size={18} color="#64748B" />
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

              {activityData.result === 'OTHER' ? (
                <>
                  <Text style={styles.formLabel}>Other</Text>
                  <TouchableOpacity
                    style={styles.selectBtn}
                    onPress={() => {
                      setShowStatusMenu(false);
                      setShowLostMenu(false);
                      setShowOtherMenu(true);
                    }}
                  >
                    <Text
                      style={[
                        styles.selectBtnText,
                        !activityData.otherReason && { color: COLORS.textSecondary },
                      ]}
                    >
                      {activityData.otherReason || 'Other only — tap to pick or add'}
                    </Text>
                    <Icon name="chevron-down" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </>
              ) : null}

              {activityData.result === 'SERVICE_DONE' ? (
                <>
                  <Text style={styles.formLabel}>Service done date</Text>
                  <TextInput
                    style={styles.inlineNotes}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={COLORS.textSecondary}
                    value={activityData.serviceDate}
                    onChangeText={(serviceDate) =>
                      setActivityData((prev) => ({ ...prev, serviceDate }))
                    }
                  />
                </>
              ) : null}
              <Text style={styles.fieldCaption}>
                {activityData.result === 'CALLBACK'
                  ? 'Follow-up date & time (required)'
                  : 'Date & time (optional)'}
              </Text>
              <View style={styles.quickSlotRow}>
                {callQuickSlots().map((slot) => {
                  const on = activityData.date === slot.date && activityData.time === slot.time;
                  return (
                    <TouchableOpacity
                      key={slot.label}
                      style={[styles.quickSlot, on && styles.quickSlotOn]}
                      onPress={() => {
                        activityTouchedRef.current = true;
                        setActivityData((prev) => ({ ...prev, date: slot.date, time: slot.time }));
                      }}
                    >
                      <Text style={[styles.quickSlotText, on && styles.quickSlotTextOn]} numberOfLines={1}>
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <CrmFollowUpDateTime
                date={activityData.date}
                time={activityData.time}
                required={activityData.result === 'CALLBACK'}
                onChange={({ date, time }) => {
                  activityTouchedRef.current = true;
                  setActivityData((prev) => ({ ...prev, date, time }));
                }}
              />
              {activityData.result === 'CALLBACK' ? (
                <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginBottom: 8 }}>
                  Is time pe telecaller ko in-app + push reminder milega.
                </Text>
              ) : null}

              <Text style={styles.fieldCaption}>Workshop remark</Text>
              <TextInput
                style={styles.inlineNotes}
                placeholder="Visible to the workshop team"
                placeholderTextColor="#94A3B8"
                value={activityData.notes}
                onChangeText={(v) => setActivityData({ ...activityData, notes: v })}
                multiline
              />
              <Text style={styles.fieldCaption}>Telecaller remark</Text>
              <TextInput
                style={styles.inlineNotes}
                placeholder="What did the customer say?"
                placeholderTextColor="#94A3B8"
                value={editForm.telecaller_remark}
                onChangeText={(v) => setEditField('telecaller_remark', v)}
                multiline
              />
              </View>

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
                      <View style={{ gap: 8 }}>
                        {activeCoupons.length > 0 ? (
                          <View style={styles.couponChipRow}>
                            {activeCoupons.map((c) => (
                              <TouchableOpacity
                                key={c.id || c.code}
                                style={styles.couponChip}
                                onPress={() => void handleApplyCoupon(c.code)}
                              >
                                <Text style={styles.couponChipText}>{c.code}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        ) : null}
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
                          onPress={() => void handleApplyCoupon()}
                        >
                          <Text style={styles.formButtonTextPrimary}>Apply</Text>
                        </TouchableOpacity>
                      </View>
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

            <Text style={styles.formLabel}>Status</Text>
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={openStatusMenu}
            >
              <Text style={styles.selectBtnText}>
                {selectedResult.label}
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

            {activityData.result === 'OTHER' ? (
              <>
                <Text style={styles.formLabel}>Other</Text>
                <TouchableOpacity
                  style={styles.selectBtn}
                  onPress={() => {
                    setShowStatusMenu(false);
                    setShowLostMenu(false);
                    setShowOtherMenu(true);
                  }}
                >
                  <Text
                    style={[
                      styles.selectBtnText,
                      !activityData.otherReason && { color: COLORS.textSecondary },
                    ]}
                  >
                    {activityData.otherReason || 'Other only — tap to pick or add'}
                  </Text>
                  <Icon name="chevron-down" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </>
            ) : null}

            {activityData.result === 'SERVICE_DONE' ? (
              <>
                <Text style={styles.formLabel}>Service done date</Text>
                <TextInput
                  style={styles.inlineNotes}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textSecondary}
                  value={activityData.serviceDate}
                  onChangeText={(serviceDate) =>
                    setActivityData((prev) => ({ ...prev, serviceDate }))
                  }
                />
              </>
            ) : null}
            <Text style={styles.formLabel}>
              {activityData.result === 'CALLBACK'
                ? 'Follow-up date & time (required)'
                : 'Date & time (optional)'}
            </Text>
            <CrmFollowUpDateTime
              date={activityData.date}
              time={activityData.time}
              required={activityData.result === 'CALLBACK'}
              onChange={({ date, time }) => {
                activityTouchedRef.current = true;
                setActivityData((prev) => ({ ...prev, date, time }));
              }}
            />
            {activityData.result === 'CALLBACK' ? (
              <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginBottom: 8 }}>
                Is time pe telecaller ko in-app + push reminder milega.
              </Text>
            ) : null}

            <Text style={styles.formLabel}>Workshop Remark</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Workshop remark"
              value={activityData.notes}
              onChangeText={(value) => setActivityData({ ...activityData, notes: value })}
              multiline
              numberOfLines={3}
              placeholderTextColor={COLORS.textSecondary}
            />
            <Text style={styles.formLabel}>Telecaller Remark</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Telecaller remark"
              value={editForm.telecaller_remark}
              onChangeText={(value) => setEditField('telecaller_remark', value)}
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
              {(activityShowAll ? detailActivity : detailActivity.slice(0, 10)).map((item, index, list) => {
              const isPlaying =
                item.kind === 'call' &&
                item.hasRecording &&
                item.callLogId &&
                playingCallLogId === item.callLogId;
              const statusOnly = bareStatusNote(item.notes);
              const stamp = splitActivityStamp(item.timeLabel);
              return (
                <View
                  key={item.id}
                  style={[styles.actRow, index === list.length - 1 && styles.actRowLast]}
                >
                  <View style={[styles.actDot, { backgroundColor: activityAccent(item) }]} />
                  <View style={styles.actCopy}>
                    <View style={styles.actHead}>
                      <Text style={styles.actTitle}>{item.title}</Text>
                      {item.timeLabel ? (
                        <View style={styles.actTimeCol}>
                          <Text style={styles.actTime}>{stamp.date}</Text>
                          {stamp.time ? <Text style={styles.actTimeSub}>{stamp.time}</Text> : null}
                        </View>
                      ) : null}
                    </View>
                    {statusOnly ? (
                      <Text style={styles.actStatus}>{statusOnly}</Text>
                    ) : item.notes ? (
                      <Text style={styles.actBody}>{item.notes}</Text>
                    ) : null}
                    {item.kind === 'call' && item.hasRecording && item.callLogId ? (
                      <TouchableOpacity
                        onPress={() =>
                          setPlayingCallLogId((prev) =>
                            prev === item.callLogId ? null : item.callLogId,
                          )
                        }
                        style={styles.actPlay}
                      >
                        <Text style={styles.actPlayText}>{isPlaying ? 'Stop' : 'Play recording'}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {item.noRecordingYet ? (
                      <Text style={styles.actMuted}>No recording yet</Text>
                    ) : null}
                    {isPlaying ? (
                      <CallRecordingInlinePlayer
                        callLogId={item.callLogId}
                        onClose={() => setPlayingCallLogId(null)}
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
              {detailActivity.length > 10 ? (
                <TouchableOpacity
                  onPress={() => setActivityShowAll((v) => !v)}
                  style={{ paddingVertical: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>
                    {activityShowAll
                      ? 'View less'
                      : `View more (${detailActivity.length - 10})`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.waHead}>
          <Text style={styles.sectionTitle}>WhatsApp{whatsappActivity.length ? ` (${whatsappActivity.length})` : ''}</Text>
          <TouchableOpacity onPress={handleOpenWhatsApp}>
            <Text style={styles.waOpen}>Open chat</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.sectionContent}>
          {whatsappActivity.length === 0 ? (
            <View style={styles.waEmpty}>
              <Icon name="message-text" size={28} color="#94A3B8" />
              <Text style={styles.waEmptyTitle}>No WhatsApp messages</Text>
              <Text style={styles.waEmptySub}>Pricing and reminders you send will show here.</Text>
            </View>
          ) : (
            whatsappActivity.slice(0, 8).map((item) => (
              <View
                key={item.id}
                style={[
                  styles.logCard,
                  /received/i.test(item.title)
                    ? { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }
                    : { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
                ]}
              >
                <Text style={styles.logBadgeText}>{item.title}</Text>
                {item.notes ? <Text style={styles.logNotes}>{item.notes}</Text> : null}
                <Text style={styles.logTime}>{item.timeLabel}</Text>
              </View>
            ))
          )}
        </View>
      </View>

      {canSeeMlDl ? (
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
      ) : null}

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

    <Modal visible={showStatusMenu} transparent animationType="slide" onRequestClose={() => setShowStatusMenu(false)}>
      <View style={styles.menuOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowStatusMenu(false)} />
        <View style={[styles.statusSheet, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.statusSheetHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.statusSheetTitle}>Update status</Text>
              <Text style={styles.statusSheetSub} numberOfLines={1}>
                {[shownName, [lead?.vehicle_make, lead?.vehicle_model].filter(Boolean).join(' ') || carDisplay]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <TouchableOpacity style={styles.statusClose} onPress={() => setShowStatusMenu(false)}>
              <Icon name="close" size={18} color="#334155" />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.statusGrid}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {statusOptions.map((opt) => {
              const active = statusDraftId === opt.id;
              const dot = statusChoiceColor(opt.id);
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.statusChoice, active && { borderColor: dot, backgroundColor: '#F8FAFC' }]}
                  onPress={() => setStatusDraftId(opt.id)}
                >
                  <View style={[styles.statusChoiceDot, { backgroundColor: dot }]} />
                  <Text style={styles.statusChoiceText} numberOfLines={1}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={[styles.statusSaveBtn, !statusDraftId && { opacity: 0.5 }]}
            disabled={!statusDraftId}
            onPress={() => {
              const opt = statusOptions.find((r) => r.id === statusDraftId);
              if (opt) applyStatusChoice(opt);
            }}
          >
            <Text style={styles.statusSaveText}>
              Save · {statusOptions.find((r) => r.id === statusDraftId)?.label || 'status'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    <Modal visible={showOtherMenu} transparent animationType="fade" onRequestClose={() => setShowOtherMenu(false)}>
      <Pressable style={styles.menuOverlay} onPress={() => setShowOtherMenu(false)}>
        <View style={styles.menuSheet}>
          <Text style={styles.menuTitle}>Other</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setActivityData({ ...activityData, otherReason: '' });
              setShowOtherMenu(false);
            }}
          >
            <Text style={styles.menuItemText}>Other only</Text>
          </TouchableOpacity>
          {otherReasons.map((reason) => (
            <TouchableOpacity
              key={reason}
              style={styles.menuItem}
              onPress={() => {
                setActivityData({ ...activityData, otherReason: reason });
                setShowOtherMenu(false);
              }}
            >
              <Text style={styles.menuItemText}>{reason}</Text>
            </TouchableOpacity>
          ))}
          {otherReasons.length === 0 ? (
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, paddingVertical: 8 }}>
              Abhi koi other item nahi.
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TextInput
              value={otherDraft}
              onChangeText={setOtherDraft}
              placeholder="Naya item"
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.selectBtn, { flex: 1, marginBottom: 0 }]}
            />
            <TouchableOpacity
              style={[styles.selectBtn, { backgroundColor: COLORS.primary, marginBottom: 0 }]}
              onPress={async () => {
                const name = otherDraft.trim();
                if (!name) return;
                try {
                  const json = await apiFetch<any>('/api/lead-manager/statuses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'create_other_reason', name }),
                  });
                  const saved = String(json?.reason?.name || name);
                  setOtherReasons((prev) =>
                    prev.some((n) => n.toLowerCase() === saved.toLowerCase()) ? prev : [...prev, saved],
                  );
                  setActivityData({ ...activityData, otherReason: saved });
                  setOtherDraft('');
                  setShowOtherMenu(false);
                } catch (e: any) {
                  const msg = String(e?.message || '');
                  if (/already exists/i.test(msg)) {
                    setActivityData({ ...activityData, otherReason: name });
                    setOtherDraft('');
                    setShowOtherMenu(false);
                    return;
                  }
                  Alert.alert('Other', msg || 'Could not add');
                }
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text>
            </TouchableOpacity>
          </View>
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
      <View style={[styles.saveBar, { paddingBottom: saveBarBottomPad }]}>
        <TouchableOpacity
          style={[styles.saveBarBtn, saving && { opacity: 0.65 }]}
          disabled={saving}
          onPress={saveLeadEdits}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon name="check" size={16} color="#fff" />
              <Text style={styles.saveBarBtnText}>Save & update booking</Text>
            </>
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

function formatPlate(raw: string) {
  const v = String(raw || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (!v) return '';
  const head = v.slice(0, 4);
  const tail = v.slice(4);
  const num = tail.match(/\d{1,4}$/)?.[0] || '';
  const series = num ? tail.slice(0, tail.length - num.length) : tail;
  return [head.slice(0, 2), head.slice(2, 4), series, num].filter(Boolean).join(' ');
}

function shiftIstYmd(days: number) {
  const today = istYmd();
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function callQuickSlots() {
  const today = istYmd();
  const [y, m, d] = today.split('-').map(Number);
  const dow = istWeekday(y, (m || 1) - 1, d || 1);
  const daysToSat = (6 - dow + 7) % 7 || 7;
  return [
    { label: 'Today 6 PM', date: today, time: '18:00' },
    { label: 'Tmrw 11 AM', date: shiftIstYmd(1), time: '11:00' },
    { label: 'Sat 11 AM', date: shiftIstYmd(daysToSat), time: '11:00' },
  ];
}

function leadInitials(name?: string | null) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '•';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
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
    if (result === 'RINGING') {
      resolved = 'Ringing';
    } else if (result) {
      const fromOpt = DEFAULT_STATUS_OPTIONS.find((o) => o.id === result);
      if (fromOpt) resolved = fromOpt.label;
    }

    if (!resolved) {
      const hist = Array.isArray(lead?.coupon_meta?.profile_history)
        ? lead.coupon_meta.profile_history
        : [];
      for (const entry of hist) {
        const s = String(entry?.status || '').toUpperCase();
        if (s === 'RINGING') {
          resolved = 'Ringing';
          break;
        }
        if (s) {
          const fromOpt = DEFAULT_STATUS_OPTIONS.find((o) => o.id === s);
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

function statusChoiceColor(id: string) {
  switch (id) {
    case 'FRESH': return '#2563EB';
    case 'INTERESTED': return '#D97706';
    case 'WILL_VISIT': return '#7C3AED';
    case 'CALLBACK': return '#1D4ED8';
    case 'BOOKING_CONFIRMED': return '#16A34A';
    case 'IN_SERVICE': return '#0F766E';
    case 'SERVICE_DONE': return '#22C55E';
    case 'LOST': return '#DC2626';
    case 'RINGING': return '#F59E0B';
    default: return '#64748B';
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
  leadHero: {
    paddingHorizontal: 16,
    paddingBottom: 56,
  },
  leadHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leadHeroKicker: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  leadHeroNumber: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  leadHeroIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  leadIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  leadAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadAvatarText: {
    color: '#1E3A8A',
    fontSize: 16,
    fontWeight: '800',
  },
  leadHeroName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  leadStatusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  leadStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  leadStatusPillText: {
    color: '#312E81',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  leadRepeat: {
    marginTop: 6,
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '700',
  },
  leadPhoneBar: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  leadPhoneText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  leadActionCard: {
    marginTop: -40,
    marginHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  leadActionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  leadAction: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  leadActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  leadMetaBlock: {
    marginTop: 12,
    paddingTop: 10,
    paddingHorizontal: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  leadMetaChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  leadMetaChipText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  leadMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  leadMetaSoft: {
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  leadMetaSoftText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
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
  headerSaveBtn: {
    minWidth: 60,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSaveBtnText: {
    color: '#023D95',
    fontSize: 14,
    fontWeight: '800',
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
  repeatRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  repeatCheck: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  createdSide: { alignItems: 'flex-end' },
  createdSideLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textAlign: 'right' },
  createdSideDate: { fontSize: 11, fontWeight: '700', color: '#334155', textAlign: 'right' },
  createdSideTime: { fontSize: 10, color: '#94A3B8', textAlign: 'right', marginTop: 1 },
  repeatBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatBoxOn: { backgroundColor: '#D97706', borderColor: '#D97706' },
  repeatTick: { color: '#fff', fontSize: 12, fontWeight: '800' },
  repeatTitle: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  repeatHint: { fontSize: 12, color: '#64748B', marginTop: 2 },
  repeatBanner: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    color: '#78350F',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
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
  iqBtnRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  iqBtnGenerate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#34D399',
  },
  iqBtnGenerateText: { color: '#047857', fontWeight: '800', fontSize: 14 },
  iqBtnDeep: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#1D4ED8',
  },
  iqBtnDeepText: { color: '#fff', fontWeight: '800', fontSize: 14 },
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
    fontSize: 15,
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
  fuelTray: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    gap: 4,
    marginBottom: 10,
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0F172A',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFBEB',
    marginBottom: 8,
  },
  plateInd: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 10,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  plateIndText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  plateInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.4,
  },
  softInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 8,
  },
  odoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  odoUnit: { color: '#64748B', fontSize: 13, fontWeight: '700' },
  fillPill: {
    marginLeft: 'auto',
    backgroundColor: '#FEE2E2',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  fillPillText: { color: '#BE123C', fontSize: 11, fontWeight: '700' },
  nonePill: {
    marginLeft: 'auto',
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nonePillText: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  secondCarBtn: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#93C5FD',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondCarBtnText: { fontSize: 13, fontWeight: '800', color: '#1D4ED8' },
  overviewTiles: { flexDirection: 'row', gap: 8 },
  ovTile: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 8,
    minHeight: 64,
  },
  ovLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  ovValue: { marginTop: 4, fontSize: 12, fontWeight: '800', color: '#0F172A' },
  ovLeadId: { marginTop: 4, fontSize: 11, fontWeight: '800', color: '#0F172A' },
  priorityRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  priorityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  priorityDot: { width: 7, height: 7, borderRadius: 4 },
  priorityText: { fontSize: 11, fontWeight: '800', color: '#334155' },
  repeatSwitchRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
  },
  repeatHint: { marginTop: 2, fontSize: 11, color: '#94A3B8' },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#CBD5E1',
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackOn: { backgroundColor: '#1D4ED8' },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  switchThumbOn: { alignSelf: 'flex-end' },
  callResultCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#fff',
    gap: 8,
  },
  statusSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#1D4ED8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  quickSlotRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: 6 },
  quickSlot: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  quickSlotOn: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  quickSlotText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  quickSlotTextOn: { color: '#fff' },
  reminderHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EEF7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  reminderIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  reminderSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
  reminderAddBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  reminderAddText: { color: '#1D4ED8', fontSize: 14, fontWeight: '800' },
  reminderSaveBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reminderSaveText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  waHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  waOpen: { color: '#059669', fontSize: 13, fontWeight: '800' },
  waEmpty: { alignItems: 'center', paddingVertical: 18, gap: 4 },
  waEmptyTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 6 },
  waEmptySub: { fontSize: 12, color: '#64748B', textAlign: 'center' },
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
    flexDirection: 'row',
    gap: 8,
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
  callResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  callResultLabel: { marginTop: 0, marginBottom: 0 },
  callResultStatus: { flex: 1, marginBottom: 0, paddingVertical: 8 },
  couponChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  couponChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  couponChipText: { color: COLORS.primary, fontWeight: '800', fontSize: 12 },
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
  statusSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '82%',
  },
  statusSheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  statusSheetTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  statusSheetSub: { marginTop: 2, fontSize: 12, color: '#64748B', fontWeight: '600' },
  statusClose: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  statusChoice: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 14,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  statusChoiceDot: { width: 8, height: 8, borderRadius: 4 },
  statusChoiceText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#0F172A' },
  statusSaveBtn: {
    marginTop: 8,
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statusSaveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  menuSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    maxHeight: '72%',
    overflow: 'hidden',
  },
  menuScroll: { flexGrow: 0, maxHeight: 460 },
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
  actRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6EDF5',
  },
  actRowLast: { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 },
  actDot: { width: 7, height: 7, borderRadius: 4, marginTop: 4 },
  actCopy: { flex: 1, minWidth: 0, gap: 2 },
  actHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  actTitle: { flex: 1, fontSize: 12, fontWeight: '700', color: '#0F2744', lineHeight: 16 },
  actBody: { fontSize: 11, color: '#475569', lineHeight: 15 },
  actStatus: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    color: '#334155',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  actTimeCol: { flexShrink: 0, alignItems: 'flex-end' },
  actTime: { fontSize: 10, color: '#94A3B8', lineHeight: 13, textAlign: 'right' },
  actTimeSub: { fontSize: 10, color: '#94A3B8', lineHeight: 13, textAlign: 'right' },
  actMuted: { fontSize: 11, color: '#94A3B8' },
  actPlay: {
    alignSelf: 'flex-start',
    marginTop: 2,
    backgroundColor: '#EDE9FE',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  actPlayText: { color: '#5B21B6', fontSize: 11, fontWeight: '700' },
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
  reminderType: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  reminderWhen: { fontSize: 11, color: '#64748B', marginTop: 1 },
  reminderModify: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
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

