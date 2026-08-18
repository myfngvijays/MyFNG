'use client';

import { useEffect, useMemo, useState, type ReactNode, type ComponentType } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { createClient } from '@/lib/supabase/client';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Car,
  Wrench,
  Calendar,
  FileText,
  ArrowLeft,
  Save,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { leadDisplayStatus } from '@/lib/telecaller/leadDisplayStatus';
import { extractInboundCustomerMessage } from '@/lib/telecaller/redactLeadSource';
import CrmServicePlanPicker from '@/components/telecaller/crm/CrmServicePlanPicker';
import CrmCarSearch from '@/components/telecaller/crm/CrmCarSearch';

const ACTIVITY_OPTIONS = [
  { id: 'INTERESTED', label: 'Interested', lead_status: null as string | null },
  { id: 'WILL_VISIT', label: 'He will visit', lead_status: null },
  { id: 'CALLBACK', label: 'Follow-up', lead_status: null },
  { id: 'BOOKING_CONFIRMED', label: 'Booking confirmed', lead_status: 'VALIDATED' },
  { id: 'IN_SERVICE', label: 'In Service', lead_status: 'IN_PROGRESS' },
  { id: 'SERVICE_DONE', label: 'Service Done', lead_status: 'COMPLETED' },
  { id: 'LOST', label: 'Lost', lead_status: 'REJECTED' },
  { id: 'RINGING', label: 'Ringing / No answer', lead_status: null },
] as const;

const LOST_REASONS = [
  'Not Interested',
  'Unqualified Lead',
  'No-Response to Calls',
  'Already Service Done',
  'Under Warranty',
  'Looking For Authorised Service Center',
  'Other Reasons',
];

function parseAddressParts(
  raw: string,
  meta: Record<string, unknown> | null | undefined,
): { flat_number: string; area: string; landmark: string } {
  if (meta && typeof meta === 'object') {
    const flat = String(meta.flat_number || '').trim();
    const area = String(meta.area || meta.pickup_address || '').trim();
    const landmark = String(meta.landmark || '')
      .replace(/^Near\s+/i, '')
      .trim();
    if (flat || area || landmark) return { flat_number: flat, area, landmark };
  }
  const parts = String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return { flat_number: '', area: '', landmark: '' };
  if (parts.length === 1) return { flat_number: '', area: parts[0], landmark: '' };
  const landmarkPart = parts.find((p) => /^near\s+/i.test(p));
  const landmark = landmarkPart ? landmarkPart.replace(/^Near\s+/i, '').trim() : '';
  const withoutLandmark = parts.filter((p) => p !== landmarkPart);
  // Drop trailing "City PIN" style chunk if present
  const maybeCityPin = withoutLandmark[withoutLandmark.length - 1] || '';
  const rest =
    /\d{6}/.test(maybeCityPin) && withoutLandmark.length > 1
      ? withoutLandmark.slice(0, -1)
      : withoutLandmark;
  if (rest.length === 1) return { flat_number: '', area: rest[0], landmark };
  return {
    flat_number: rest[0] || '',
    area: rest.slice(1).join(', '),
    landmark,
  };
}

function composeSmartAddress(parts: {
  flat_number: string;
  area: string;
  landmark: string;
  city: string;
  pincode: string;
}) {
  const landmark = parts.landmark.trim();
  return [
    parts.flat_number.trim(),
    parts.area.trim(),
    landmark ? `Near ${landmark}` : '',
    [parts.city.trim(), parts.pincode.trim()].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');
}

function fieldCls(hasError?: boolean, disabled?: boolean) {
  return [
    'w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition',
    'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#023D95]/20 focus:border-[#023D95]',
    disabled ? 'bg-slate-50 text-slate-600 cursor-not-allowed' : 'bg-white hover:border-slate-300',
    hasError ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-200',
  ].join(' ');
}

function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
      {children}
      {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
    </label>
  );
}

function SectionCard({
  title,
  icon: Icon,
  tone = 'slate',
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  tone?: 'slate' | 'emerald' | 'sky' | 'amber' | 'violet' | 'indigo';
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    slate: 'border-slate-200 bg-white',
    emerald: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white',
    sky: 'border-sky-200/80 bg-gradient-to-br from-sky-50/70 to-white',
    amber: 'border-amber-200/80 bg-gradient-to-br from-amber-50/70 to-white',
    violet: 'border-violet-200/80 bg-gradient-to-br from-violet-50/60 to-white',
    indigo: 'border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 to-white',
  };
  return (
    <section className={`rounded-2xl border p-4 sm:p-5 shadow-sm ${tones[tone]}`}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#023D95] text-white shadow-sm">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-base sm:text-lg font-black text-[#023D95]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export type CrmLeadEditFormProps = {
  leadId: string;
  embedded?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
};

export default function CrmLeadEditForm({
  leadId,
  embedded = false,
  onCancel,
  onSaved,
}: CrmLeadEditFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { base } = getCrmDashboardBase(pathname);

  const handleCancel = () => {
    if (onCancel) onCancel();
    else router.push(`${base}/leads/${leadId}`);
  };

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Service add-ons (optional; catalog picker handles service types)
  const [serviceAddons, setServiceAddons] = useState<any[]>([]);
  const SHOW_SERVICE_ADDONS = false;

  // Coupons (multi-select)
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponsError, setCouponsError] = useState('');
  const [couponCodes, setCouponCodes] = useState<string[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<string>('');
  const [manualCoupon, setManualCoupon] = useState('');
  const [couponSaving, setCouponSaving] = useState(false);

  const [cities, setCities] = useState<any[]>([]);
  const [carDisplay, setCarDisplay] = useState('');
  const [resolvingCity, setResolvingCity] = useState(false);
  const [lookingUpPhone, setLookingUpPhone] = useState(false);
  const [lookupHint, setLookupHint] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_alternate_phone: '',
    customer_email: '',
    customer_address: '',
    flat_number: '',
    area: '',
    landmark: '',
    city_id: '',
    city: '',
    pincode: '',

    vehicle_number: '',
    vehicle_make: '',
    model_id: '',
    vehicle_model: '',
    vehicle_variant: '',
    vehicle_year: '',
    vehicle_fuel_type: 'PETROL',
    odometer_km: '',
    vehicle_class: '',

    service_types: [] as string[],
    service_addons: [] as string[],
    service_type: '',
    problem_description: '',
    description: '',

    pickup_required: false,
    pickup_address: '',
    pickup_flat: '',
    pickup_area: '',
    pickup_landmark: '',
    pickup_date: '',
    pickup_time: '',

    notes: '',
    lead_priority: 'NORMAL',
    activity_result: 'INTERESTED',
    lost_reason: '',
    activity_notes: '',
    callback_date: '',
    callback_time: '',
  });

  useEffect(() => {
    fetchLeadDetails();
    if (SHOW_SERVICE_ADDONS) fetchServiceAddons();
    fetchCities();
  }, [leadId]);

  useEffect(() => {
    fetchAvailableCouponsForForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.city_id, formData.service_types.join(',')]);

  async function fetchAvailableCouponsForForm() {
    setCouponsLoading(true);
    setCouponsError('');
    try {
      const params = new URLSearchParams();
      if (formData.city_id) params.set('city_id', formData.city_id);
      if (formData.service_types.length > 0) params.set('service_type_ids', formData.service_types.join(','));
      const res = await fetch(`/api/telecaller/coupons?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load coupons');
      setAvailableCoupons(json?.coupons || []);
    } catch (e: any) {
      setCouponsError(e?.message || 'Failed to load coupons');
      setAvailableCoupons([]);
    } finally {
      setCouponsLoading(false);
    }
  }

  const selectedCodes = useMemo(
    () => couponCodes.map((c) => String(c || '').trim().toUpperCase()).filter(Boolean),
    [couponCodes]
  );

  const addCouponCode = (codeRaw: string) => {
    const code = String(codeRaw || '').trim().toUpperCase();
    if (!code) return;
    setCouponCodes((prev) => {
      const next = prev.includes(code) ? prev : [...prev, code];
      if (!appliedCoupon) setAppliedCoupon(code);
      return next;
    });
  };

  const removeCouponCode = (codeRaw: string) => {
    const code = String(codeRaw || '').trim().toUpperCase();
    if (!code) return;
    setCouponCodes((prev) => {
      const next = prev.filter((c) => c !== code);
      if (appliedCoupon === code) setAppliedCoupon(next[0] || '');
      return next;
    });
  };

  async function saveCouponsOnly() {
    setCouponSaving(true);
    try {
      const supabase = createClient();
      const applied = String(appliedCoupon || '').trim().toUpperCase();
      const nextApplied = applied && selectedCodes.includes(applied) ? applied : (selectedCodes[0] || '');
      const nextCouponMeta =
        selectedCodes.length > 0
          ? {
              selected_codes: selectedCodes,
              applied_code: nextApplied || null,
            }
          : null;

      const { error } = await supabase
        .from('service_leads')
        .update({
          coupon_code: nextApplied || null,
          discount_amount: 0,
          coupon_meta: nextCouponMeta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (error) throw error;

      // Keep local lead state in sync without resetting formData edits
      setLead((prev: any) =>
        prev
          ? {
              ...prev,
              coupon_code: nextApplied || null,
              coupon_meta: nextCouponMeta,
              discount_amount: 0,
            }
          : prev
      );
      alert('Coupon saved');
    } catch (e: any) {
      alert(e?.message || 'Failed to save coupon');
    } finally {
      setCouponSaving(false);
    }
  }

  async function fetchCities() {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, state, city_pincodes')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCities(data || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  }

  const resolveCityFromPincode = async (pinRaw: string) => {
    const pincode = String(pinRaw || '')
      .replace(/\D/g, '')
      .slice(0, 6);
    if (!/^\d{6}$/.test(pincode)) return;
    setResolvingCity(true);
    try {
      let rows = cities;
      if (!rows.some((c) => c.city_pincodes != null)) {
        const { data } = await createClient()
          .from('cities')
          .select('id, name, state, city_pincodes')
          .eq('is_active', true);
        rows = Array.isArray(data) ? data : [];
        if (rows.length) setCities(rows);
      }
      const hit = (rows || []).find((c: any) => String(c.city_pincodes || '').includes(pincode));
      if (hit?.name) {
        setFormData((prev) => ({
          ...prev,
          pincode,
          city: hit.name,
          city_id: hit.id || prev.city_id,
        }));
      }
    } catch {
      /* ignore */
    } finally {
      setResolvingCity(false);
    }
  };

  const lookupCustomerByPhone = async (phoneRaw: string) => {
    const phone10 = String(phoneRaw || '')
      .replace(/\D/g, '')
      .slice(-10);
    if (phone10.length !== 10) return;
    setLookingUpPhone(true);
    setLookupHint(null);
    try {
      const res = await fetch(`/api/telecaller/crm/customer-lookup?phone=${phone10}`);
      const json = await res.json();
      if (!res.ok || !json?.found) {
        setLookupHint('No past customer match for this number');
        return;
      }
      const fill = json.fill || {};
      setFormData((prev) => {
        const next = { ...prev };
        const empty = (v: string) => !String(v || '').trim();
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
        const addr = String(fill.customer_address || fill.pickup_address || '');
        if (empty(next.area) && empty(next.flat_number) && addr) {
          const parsed = parseAddressParts(addr, null);
          next.flat_number = parsed.flat_number;
          next.area = parsed.area || addr;
          next.landmark = parsed.landmark;
          next.customer_address = addr;
        }
        return next;
      });
      if (fill.vehicle_make || fill.vehicle_model) {
        setCarDisplay([fill.vehicle_make, fill.vehicle_model].filter(Boolean).join(' '));
      }
      if (fill.pincode && String(fill.pincode).replace(/\D/g, '').length === 6) {
        void resolveCityFromPincode(String(fill.pincode));
      }
      setLookupHint('Details auto-filled from past records (empty fields only)');
    } catch {
      setLookupHint('Lookup failed — fill manually');
    } finally {
      setLookingUpPhone(false);
    }
  };

  async function fetchServiceAddons() {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('service_addons')
        .select('id, name, price')
        .eq('is_active', true);
      
      if (error) throw error;
      setServiceAddons(data || []);
    } catch (error) {
      console.error('Error fetching service addons:', error);
    }
  }

  async function fetchLeadDetails() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError) throw leadError;
      
      // Check if lead can be edited
      if (!['NEW', 'CONTACTED', 'INCOMPLETE', 'PENDING', 'VALIDATED', 'ASSIGNED', 'IN_PROGRESS'].includes(leadData.status)) {
        setError(`Cannot edit lead with status: ${leadData.status}.`);
        setLoading(false);
        return;
      }

      setLead(leadData);

      // Parse service_type_ids and subservice_ids
      let serviceTypeIds = [];
      let subserviceIds = [];
      
      if (leadData.service_type_ids) {
        try {
          serviceTypeIds = typeof leadData.service_type_ids === 'string' 
            ? JSON.parse(leadData.service_type_ids) 
            : leadData.service_type_ids;
        } catch (e) {
          console.error('Error parsing service_type_ids:', e);
        }
      }
      
      if (leadData.subservice_ids) {
        try {
          subserviceIds = typeof leadData.subservice_ids === 'string' 
            ? JSON.parse(leadData.subservice_ids) 
            : leadData.subservice_ids;
        } catch (e) {
          console.error('Error parsing subservice_ids:', e);
        }
      }

      const meta =
        leadData.coupon_meta && typeof leadData.coupon_meta === 'object'
          ? leadData.coupon_meta
          : {};
      const addrParts = parseAddressParts(
        String(leadData.customer_address || leadData.pickup_address || ''),
        meta,
      );
      
      // Populate form with existing data
      setFormData({
        customer_name: leadData.customer_name || '',
        customer_phone: leadData.customer_phone || '',
        customer_alternate_phone: leadData.customer_alternate_phone || '',
        customer_email: leadData.customer_email || '',
        customer_address: leadData.customer_address || '',
        flat_number: addrParts.flat_number,
        area: addrParts.area || leadData.customer_address || '',
        landmark: addrParts.landmark,
        city_id: leadData.city_id || '',
        city: leadData.city || '',
        pincode: leadData.pincode || '',
        
        vehicle_number: leadData.vehicle_number || '',
        vehicle_make: leadData.vehicle_make || '',
        model_id: leadData.model_id || '',
        vehicle_model: leadData.vehicle_model || '',
        vehicle_variant: leadData.vehicle_variant || '',
        vehicle_year: leadData.vehicle_year?.toString() || '',
        vehicle_fuel_type: leadData.vehicle_fuel_type || 'PETROL',
        odometer_km: leadData.odometer_km?.toString() || '',
        vehicle_class: leadData.vehicle_class || meta.vehicle_class || '',
        
        service_types: serviceTypeIds || [],
        service_addons: subserviceIds || [],
        service_type: leadData.service_type || '',
        problem_description:
          extractInboundCustomerMessage(leadData.problem_description) ||
          extractInboundCustomerMessage(leadData.description) ||
          '',
        description:
          extractInboundCustomerMessage(leadData.description) ||
          extractInboundCustomerMessage(leadData.problem_description) ||
          '',
        
        pickup_required: leadData.pickup_required || false,
        pickup_address: leadData.pickup_address || '',
        ...(() => {
          const fromMeta = {
            pickup_flat: String(meta.pickup_flat || '').trim(),
            pickup_area: String(meta.pickup_area || '').trim(),
            pickup_landmark: String(meta.pickup_landmark || '')
              .replace(/^Near\s+/i, '')
              .trim(),
          };
          if (fromMeta.pickup_flat || fromMeta.pickup_area || fromMeta.pickup_landmark) {
            return fromMeta;
          }
          const parsed = parseAddressParts(String(leadData.pickup_address || ''), null);
          return {
            pickup_flat: parsed.flat_number,
            pickup_area: parsed.area,
            pickup_landmark: parsed.landmark,
          };
        })(),
        pickup_date: (() => {
          const slot = leadData.preferred_slot_start || leadData.preferred_date;
          if (!slot) return '';
          try {
            const d = new Date(slot);
            if (Number.isNaN(d.getTime())) return String(slot).slice(0, 10);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          } catch {
            return '';
          }
        })(),
        pickup_time: (() => {
          const slot = leadData.preferred_slot_start;
          if (!slot) return '';
          try {
            const d = new Date(slot);
            if (Number.isNaN(d.getTime())) return '';
            const hh = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            return `${hh}:${mi}`;
          } catch {
            return '';
          }
        })(),

        notes: leadData.notes || '',
        lead_priority: leadData.lead_priority || 'NORMAL',
        activity_result: String(leadData?.coupon_meta?.last_call_result || 'INTERESTED').toUpperCase() || 'INTERESTED',
        lost_reason: String(leadData?.coupon_meta?.last_lost_reason || ''),
        activity_notes: String(leadData?.coupon_meta?.telecaller_remarks || ''),
      });
      setCarDisplay(
        [leadData.vehicle_make, leadData.vehicle_model].filter(Boolean).join(' '),
      );

      // Initialize coupons from stored data (best-effort)
      const existingSelected = Array.isArray((leadData as any)?.coupon_meta?.selected_codes)
        ? (leadData as any).coupon_meta.selected_codes.map((c: any) => String(c || '').trim().toUpperCase()).filter(Boolean)
        : [];
      const existingApplied = String((leadData as any)?.coupon_code || '').trim().toUpperCase();
      const init = existingSelected.length > 0 ? existingSelected : (existingApplied ? [existingApplied] : []);
      setCouponCodes(init);
      setAppliedCoupon(existingApplied && init.includes(existingApplied) ? existingApplied : (init[0] || ''));

    } catch (error) {
      console.error('Error fetching lead:', error);
      setError('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleMultiSelect = (name: string, value: string, checked: boolean) => {
    setFormData(prev => {
      const currentArray = prev[name as keyof typeof prev] as string[];
      const newArray = checked
        ? [...currentArray, value]
        : currentArray.filter(item => item !== value);
      
      return {
        ...prev,
        [name]: newArray
      };
    });
    
    // Clear error
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  function validateVehicleNumber(vehicleNumber: string): boolean {
    // Indian vehicle number format: AB12CD1234 or AB-12-CD-1234 or AB 12 CD 1234
    const regex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
    const cleanNumber = vehicleNumber.replace(/[-\s]/g, '').toUpperCase();
    return regex.test(cleanNumber);
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Customer validation
    if (!formData.customer_name.trim()) newErrors.customer_name = 'Customer name is required';
    if (!formData.customer_phone.trim()) newErrors.customer_phone = 'Phone number is required';
    if (formData.customer_phone && formData.customer_phone.replace(/\D/g, '').length < 10) {
      newErrors.customer_phone = 'Please enter valid 10-digit phone number';
    }
    if (!formData.area.trim() && !formData.flat_number.trim()) {
      newErrors.area = 'Address (flat / area) is required';
    }
    if (!formData.city_id && !formData.city) newErrors.city_id = 'City is required (enter pincode)';
    if (!formData.pincode || formData.pincode.replace(/\D/g, '').length !== 6) {
      newErrors.pincode = '6-digit pincode required';
    }

    // Vehicle validation — NA allowed for soft leads
    const vNum = formData.vehicle_number.trim().toUpperCase();
    if (!vNum) newErrors.vehicle_number = 'Vehicle number is required (or NA)';
    if (!formData.vehicle_make.trim() || !formData.vehicle_model.trim()) {
      newErrors.vehicle_make = 'Search and select car model';
    }
    if (!formData.vehicle_fuel_type) newErrors.vehicle_fuel_type = 'Fuel type is required';

    if (vNum && vNum !== 'NA' && !validateVehicleNumber(vNum)) {
      newErrors.vehicle_number = 'Please enter valid vehicle number (e.g., MH12AB1234) or NA';
    }

    // Service validation
    if (formData.service_types.length === 0) newErrors.service_types = 'Please select at least one service type';

    if (formData.activity_result === 'CALLBACK') {
      if (!formData.callback_date) newErrors.callback_date = 'Follow-up date required';
      if (!formData.callback_time) newErrors.callback_time = 'Follow-up time required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      alert('Please fill all required fields correctly');
      return;
    }
    
    setSaving(true);

    try {
      const applied = String(appliedCoupon || '').trim().toUpperCase();
      const nextApplied = applied && selectedCodes.includes(applied) ? applied : (selectedCodes[0] || '');

      const customerMessage =
        extractInboundCustomerMessage(formData.problem_description) ||
        String(formData.problem_description || '').trim() ||
        null;
      const selectedActivity =
        ACTIVITY_OPTIONS.find((o) => o.id === formData.activity_result) || ACTIVITY_OPTIONS[0];
      const prevMeta =
        lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
      const statusLabel =
        selectedActivity.id === 'LOST' && formData.lost_reason
          ? `Lost · ${formData.lost_reason}`
          : selectedActivity.label;
      const historyEntry = {
        at: new Date().toISOString(),
        summary: `Updated ${statusLabel}`,
        remark: formData.activity_notes.trim() || null,
        status: selectedActivity.id,
      };
      const prevHistory = Array.isArray((prevMeta as any).profile_history)
        ? (prevMeta as any).profile_history
        : [];
      const composedAddress = composeSmartAddress({
        flat_number: formData.flat_number,
        area: formData.area,
        landmark: formData.landmark,
        city: formData.city,
        pincode: formData.pincode,
      });
      const nextMeta = {
        ...prevMeta,
        last_call_result: selectedActivity.id,
        last_call_label: statusLabel,
        last_call_at: new Date().toISOString(),
        telecaller_remarks: formData.activity_notes.trim() || null,
        last_lost_reason:
          selectedActivity.id === 'LOST' ? formData.lost_reason || null : (prevMeta as any).last_lost_reason || null,
        profile_history: [historyEntry, ...prevHistory].slice(0, 50),
        flat_number: formData.flat_number.trim() || null,
        landmark: formData.landmark.trim() || null,
        area: formData.area.trim() || null,
        vehicle_class: formData.vehicle_class || (prevMeta as any).vehicle_class || null,
        pickup_flat: formData.pickup_flat.trim() || null,
        pickup_area: formData.pickup_area.trim() || null,
        pickup_landmark: formData.pickup_landmark.trim() || null,
      };

      const payload: any = {
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone.replace(/\D/g, '').slice(-10),
        customer_alternate_phone: formData.customer_alternate_phone || null,
        customer_email: formData.customer_email || null,
        customer_address: composedAddress || null,
        city_id: formData.city_id || null,
        city: formData.city || null,
        pincode: formData.pincode || null,

        vehicle_number: formData.vehicle_number.trim().toUpperCase() || null,
        vehicle_make: formData.vehicle_make,
        model_id: formData.model_id || null,
        vehicle_model: formData.vehicle_model,
        vehicle_variant: null,
        vehicle_year: formData.vehicle_year ? parseInt(formData.vehicle_year) : null,
        vehicle_fuel_type: formData.vehicle_fuel_type,
        odometer_km: formData.odometer_km ? parseInt(formData.odometer_km) : null,

        service_types: formData.service_types,
        service_addons: formData.service_addons,
        service_type: formData.service_type,
        // Only customer message — never re-save WhatsApp/Trigger wrappers
        problem_description: customerMessage,
        description: customerMessage,

        pickup_required: formData.pickup_required,
        pickup_address: formData.pickup_required
          ? composeSmartAddress({
              flat_number: formData.pickup_flat,
              area: formData.pickup_area || formData.area,
              landmark: formData.pickup_landmark,
              city: formData.city,
              pincode: formData.pincode,
            }) || composedAddress
          : formData.pickup_address || composedAddress || null,
        preferred_slot_start:
          formData.pickup_required && formData.pickup_date
            ? (() => {
                const local = new Date(
                  `${formData.pickup_date}T${formData.pickup_time || '10:00'}:00`,
                );
                return Number.isNaN(local.getTime()) ? null : local.toISOString();
              })()
            : null,

        notes: formData.notes || null,
        lead_priority: formData.lead_priority,
        ...(selectedActivity.lead_status ? { status: selectedActivity.lead_status } : {}),
        coupon_meta: nextMeta,

        coupon_codes: selectedCodes,
        applied_coupon: nextApplied || null,
      };

      if (selectedActivity.id === 'CALLBACK' && formData.callback_date && formData.callback_time) {
        const local = new Date(`${formData.callback_date}T${formData.callback_time}:00`);
        if (!Number.isNaN(local.getTime())) {
          payload.follow_up_required = true;
          payload.next_follow_up_at = local.toISOString();
        }
      }

      const res = await fetch(`/api/telecaller/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to update lead');

      if (selectedActivity.id === 'CALLBACK' && payload.next_follow_up_at) {
        try {
          await fetch('/api/telecaller/follow-ups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lead_id: leadId,
              follow_up_type: 'CALLBACK',
              scheduled_time: payload.next_follow_up_at,
              reason: formData.activity_notes.trim() || 'Follow-up',
              priority: formData.lead_priority || 'NORMAL',
            }),
          });
        } catch {
          // best-effort reminder row
        }
      }

      if (onSaved) onSaved();
      else router.push(`${base}/leads/${leadId}`);

    } catch (error: any) {
      console.error('Error updating lead:', error);
      alert('Failed to update lead: ' + (error?.message || String(error)));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedded ? 'py-16' : 'min-h-[50vh]'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">Loading lead details...</p>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="card text-center py-8 sm:py-10 md:py-12 px-4 sm:px-6">
        <AlertCircle className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-red-500 mx-auto mb-3 sm:mb-4" />
        <p className="text-gray-700 mb-3 sm:mb-4 text-sm sm:text-base">{error || 'Lead not found'}</p>
        <button type="button" onClick={handleCancel} className="btn btn-primary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div
      className={`${embedded ? 'w-full' : 'max-w-5xl mx-auto'} space-y-4 pb-28 ${embedded ? '' : 'px-3 sm:px-4'}`}
    >
      <div className="relative overflow-hidden rounded-2xl bg-[#023D95] text-white p-4 sm:p-5 shadow-lg">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.12),_transparent_55%)]" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-xl bg-white/15 hover:bg-white/25 p-2 shrink-0 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-100">Edit lead</p>
              <h1 className="text-xl sm:text-2xl font-black truncate mt-0.5">
                {lead.customer_name || 'Lead'}
              </h1>
              <p className="text-sm text-blue-100/90 mt-1 font-mono font-semibold">#{lead.lead_number}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold ring-1 ring-white/30">
            <AlertCircle className="w-3.5 h-3.5" />
            {leadDisplayStatus(lead)}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <SectionCard title="Customer Details" icon={User} tone="emerald">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Customer Name</FieldLabel>
              <input type="text" name="customer_name" value={formData.customer_name} onChange={handleChange} className={fieldCls(Boolean(errors.customer_name))} required />
              {errors.customer_name ? <p className="mt-1 text-xs text-rose-600">{errors.customer_name}</p> : null}
            </div>
            <div>
              <FieldLabel required>Phone Number</FieldLabel>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  name="customer_phone"
                  value={formData.customer_phone}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData((prev) => ({ ...prev, customer_phone: v }));
                    setLookupHint(null);
                  }}
                  onBlur={(e) => void lookupCustomerByPhone(e.target.value)}
                  className={`${fieldCls(Boolean(errors.customer_phone))} pl-9`}
                  maxLength={10}
                  required
                />
              </div>
              {lookingUpPhone ? (
                <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Checking past records…
                </p>
              ) : lookupHint ? (
                <p className="mt-1 text-xs font-semibold text-[#004AAD]">{lookupHint}</p>
              ) : (
                <p className="mt-1 text-[10px] text-slate-400">Auto-fills name / car / address if this number exists in DB</p>
              )}
              {errors.customer_phone ? <p className="mt-1 text-xs text-rose-600">{errors.customer_phone}</p> : null}
            </div>
            <div>
              <FieldLabel>Alternate Phone</FieldLabel>
              <input type="tel" name="customer_alternate_phone" value={formData.customer_alternate_phone} onChange={handleChange} className={fieldCls()} maxLength={10} />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="email" name="customer_email" value={formData.customer_email} onChange={handleChange} className={`${fieldCls()} pl-9`} />
              </div>
            </div>
            <div>
              <FieldLabel required>Pincode</FieldLabel>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={(e) => {
                    const pin = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setFormData((prev) => ({
                      ...prev,
                      pincode: pin,
                      ...(pin.length < 6 ? { city: '', city_id: '' } : {}),
                    }));
                    if (pin.length === 6) void resolveCityFromPincode(pin);
                  }}
                  className={`${fieldCls(Boolean(errors.pincode))} pl-9`}
                  maxLength={6}
                  inputMode="numeric"
                />
              </div>
              {resolvingCity ? (
                <p className="mt-1 text-xs text-slate-500">Finding city…</p>
              ) : formData.city ? (
                <p className="mt-1 text-xs font-semibold text-[#004AAD]">{formData.city}</p>
              ) : formData.pincode.length === 6 ? (
                <p className="mt-1 text-xs text-amber-600">City not found for this pincode</p>
              ) : null}
              {errors.pincode || errors.city_id ? (
                <p className="mt-1 text-xs text-rose-600">{errors.pincode || errors.city_id}</p>
              ) : null}
            </div>
            <div>
              <FieldLabel>Flat / Building</FieldLabel>
              <input type="text" name="flat_number" value={formData.flat_number} onChange={handleChange} className={fieldCls()} placeholder="Flat / house no." />
            </div>
            <div>
              <FieldLabel required>Area / Street</FieldLabel>
              <input type="text" name="area" value={formData.area} onChange={handleChange} className={fieldCls(Boolean(errors.area))} placeholder="Society, road, locality" />
              {errors.area ? <p className="mt-1 text-xs text-rose-600">{errors.area}</p> : null}
            </div>
            <div>
              <FieldLabel>Landmark</FieldLabel>
              <input type="text" name="landmark" value={formData.landmark} onChange={handleChange} className={fieldCls()} placeholder="Near …" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Lead Overview" icon={FileText} tone="slate">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <FieldLabel>Lead Number</FieldLabel>
              <input type="text" value={lead.lead_number || '—'} disabled className={fieldCls(false, true)} />
            </div>
            <div>
              <FieldLabel>Priority</FieldLabel>
              <select name="lead_priority" value={formData.lead_priority} onChange={handleChange} className={fieldCls()}>
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
            <div>
              <FieldLabel>Created</FieldLabel>
              <input
                type="text"
                value={
                  lead.created_at
                    ? new Date(lead.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'
                }
                disabled
                className={fieldCls(false, true)}
              />
            </div>
            <div>
              <FieldLabel>Activity / Disposition</FieldLabel>
              <select name="activity_result" value={formData.activity_result} onChange={handleChange} className={fieldCls()}>
                {ACTIVITY_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
            {formData.activity_result === 'LOST' ? (
              <div className="sm:col-span-2">
                <FieldLabel>Lost Reason</FieldLabel>
                <select name="lost_reason" value={formData.lost_reason} onChange={handleChange} className={fieldCls()}>
                  <option value="">Select reason</option>
                  {LOST_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {formData.activity_result === 'CALLBACK' ? (
              <>
                <div>
                  <FieldLabel required>Follow-up date</FieldLabel>
                  <input
                    type="date"
                    name="callback_date"
                    value={formData.callback_date}
                    onChange={handleChange}
                    className={fieldCls(Boolean(errors.callback_date))}
                  />
                  {errors.callback_date ? (
                    <p className="mt-1 text-xs text-rose-600">{errors.callback_date}</p>
                  ) : null}
                </div>
                <div>
                  <FieldLabel required>Follow-up time</FieldLabel>
                  <input
                    type="time"
                    name="callback_time"
                    value={formData.callback_time}
                    onChange={handleChange}
                    className={fieldCls(Boolean(errors.callback_time))}
                  />
                  {errors.callback_time ? (
                    <p className="mt-1 text-xs text-rose-600">{errors.callback_time}</p>
                  ) : null}
                </div>
              </>
            ) : null}
            <div className="col-span-2 lg:col-span-4">
              <FieldLabel>Remarks</FieldLabel>
              <textarea name="activity_notes" value={formData.activity_notes} onChange={handleChange} className={fieldCls()} rows={3} placeholder="Call notes / remarks for this lead" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Vehicle Details" icon={Car} tone="sky">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="col-span-2 lg:col-span-1">
              <FieldLabel required>Vehicle Number</FieldLabel>
              <input
                type="text"
                name="vehicle_number"
                value={formData.vehicle_number}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    vehicle_number: e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12),
                  }))
                }
                className={`${fieldCls(Boolean(errors.vehicle_number))} uppercase tracking-wide font-semibold`}
                placeholder="MH12AB1234 or NA"
              />
              {errors.vehicle_number ? <p className="mt-1 text-xs text-rose-600">{errors.vehicle_number}</p> : null}
            </div>
            <div className="col-span-2 lg:col-span-3">
              <CrmCarSearch
                label="Car Model *"
                placeholder="Type model (e.g. Swift, City, Rapid)"
                displayValue={carDisplay}
                onSelect={(car) => {
                  setFormData((prev) => ({
                    ...prev,
                    vehicle_make: car.make,
                    vehicle_model: car.model,
                    model_id: car.id,
                    vehicle_variant: '',
                    vehicle_class: car.vehicleClass || '',
                  }));
                  setCarDisplay([car.make, car.model].filter(Boolean).join(' '));
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.vehicle_make;
                    delete next.model_id;
                    return next;
                  });
                }}
                onClear={() => {
                  setFormData((prev) => ({
                    ...prev,
                    vehicle_make: '',
                    vehicle_model: '',
                    model_id: '',
                    vehicle_class: '',
                  }));
                  setCarDisplay('');
                }}
              />
              {errors.vehicle_make ? <p className="mt-1 text-xs text-rose-600">{errors.vehicle_make}</p> : null}
            </div>
            <div>
              <FieldLabel>Year</FieldLabel>
              <input type="number" name="vehicle_year" value={formData.vehicle_year} onChange={handleChange} className={fieldCls()} min="1900" max={new Date().getFullYear() + 1} />
            </div>
            <div>
              <FieldLabel required>Fuel Type</FieldLabel>
              <select name="vehicle_fuel_type" value={formData.vehicle_fuel_type} onChange={handleChange} className={fieldCls(Boolean(errors.vehicle_fuel_type))}>
                <option value="PETROL">Petrol</option>
                <option value="DIESEL">Diesel</option>
                <option value="CNG">CNG</option>
                <option value="ELECTRIC">Electric</option>
                <option value="HYBRID">Hybrid</option>
              </select>
              {errors.vehicle_fuel_type ? <p className="mt-1 text-xs text-rose-600">{errors.vehicle_fuel_type}</p> : null}
            </div>
            <div>
              <FieldLabel>Odometer (km)</FieldLabel>
              <input type="number" name="odometer_km" value={formData.odometer_km} onChange={handleChange} className={fieldCls()} />
            </div>
            <div>
              <FieldLabel>Make / Model</FieldLabel>
              <input
                type="text"
                value={[formData.vehicle_make, formData.vehicle_model].filter(Boolean).join(' ') || '—'}
                disabled
                className={fieldCls(false, true)}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Service Details" icon={Wrench} tone="amber">
          <div className="space-y-4">
            <CrmServicePlanPicker
              selectedIds={formData.service_types}
              onChange={(ids) => {
                setFormData((prev) => ({ ...prev, service_types: ids }));
                if (errors.service_types) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.service_types;
                    return next;
                  });
                }
              }}
              title="Service Types"
              subtitle="Segregated by category — Periodic, Engine, AC, Brake, Battery…"
            />
            {errors.service_types ? <p className="text-xs text-rose-600">{errors.service_types}</p> : null}

            {SHOW_SERVICE_ADDONS && (
              <div>
                <FieldLabel>Service Add-ons (Optional)</FieldLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {serviceAddons.map((addon) => (
                    <label key={addon.id} className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 hover:border-[#023D95]/40 cursor-pointer transition">
                      <input type="checkbox" checked={formData.service_addons.includes(addon.id)} onChange={(e) => handleMultiSelect('service_addons', addon.id, e.target.checked)} className="mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-slate-900">{addon.name}</div>
                        {addon.price ? <div className="text-xs font-bold text-[#023D95] mt-0.5">₹{addon.price}</div> : null}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <FieldLabel>Coupons</FieldLabel>
                <button type="button" className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200" onClick={saveCouponsOnly} disabled={couponSaving}>
                  {couponSaving ? 'Saving…' : 'Save coupons'}
                </button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 max-h-44 overflow-auto">
                {couponsLoading ? (
                  <div className="text-xs text-slate-500 p-2">Loading coupons…</div>
                ) : availableCoupons.length === 0 ? (
                  <div className="text-xs text-slate-500 p-2">{couponsError ? `Unable to load coupons: ${couponsError}` : 'No active coupons available.'}</div>
                ) : (
                  <div className="space-y-1.5">
                    {availableCoupons.map((c) => {
                      const code = String(c.code || '').toUpperCase();
                      const label =
                        c.coupon_kind === 'TOTAL_DISCOUNT'
                          ? `${code} — ${c.discount_mode === 'PERCENT' ? `${c.discount_value}% off` : `₹${c.discount_value} off`}${c.min_order_value ? ` (min ₹${c.min_order_value})` : ''}`
                          : `${code} — Free Service${c.target_custom_label ? ` (${c.target_custom_label})` : ''}`;
                      const checked = selectedCodes.includes(code);
                      return (
                        <label key={c.id} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer ${checked ? 'bg-blue-50 text-[#023D95]' : 'hover:bg-slate-50 text-slate-800'}`}>
                          <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => { if (e.target.checked) addCouponCode(code); else removeCouponCode(code); }} />
                          <span className="font-medium">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <input className={`${fieldCls()} flex-1`} placeholder="Add coupon code manually" value={manualCoupon} onChange={(e) => setManualCoupon((e.target.value || '').toUpperCase())} />
                <button type="button" className="rounded-xl bg-slate-100 px-3 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50" onClick={() => { addCouponCode(manualCoupon); setManualCoupon(''); }} disabled={!manualCoupon.trim()}>Add</button>
              </div>
              {selectedCodes.length > 0 ? (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {selectedCodes.map((code) => (
                      <button key={code} type="button" className="text-xs px-2.5 py-1 rounded-full bg-[#023D95]/10 text-[#023D95] font-bold hover:bg-[#023D95]/15" onClick={() => removeCouponCode(code)}>{code} ×</button>
                    ))}
                  </div>
                  <select className={fieldCls()} value={appliedCoupon} onChange={(e) => setAppliedCoupon(e.target.value)}>
                    <option value="">Applied coupon (optional)</option>
                    {selectedCodes.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                  <button type="button" className="w-full rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50" onClick={() => { setCouponCodes([]); setAppliedCoupon(''); setManualCoupon(''); }}>Clear all coupons</button>
                </div>
              ) : null}
            </div>

            <div>
              <FieldLabel>Customer Message</FieldLabel>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 whitespace-pre-wrap min-h-[4.5rem]">
                {formData.problem_description?.trim() || (
                  <span className="text-slate-400">No customer message</span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Read-only — customer enquiry text (WhatsApp number / trigger hidden).
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Pickup Details" icon={Calendar} tone="violet">
          <div className="space-y-3">
            <label className="flex items-center gap-3 rounded-xl border border-violet-200 bg-white px-4 py-3 cursor-pointer hover:bg-violet-50/50 transition">
              <input type="checkbox" name="pickup_required" checked={formData.pickup_required} onChange={handleChange} className="h-4 w-4 rounded border-slate-300 text-[#023D95]" />
              <span className="text-sm font-bold text-slate-800">Pickup required</span>
            </label>
            {formData.pickup_required ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <FieldLabel>Flat / Building</FieldLabel>
                  <input
                    type="text"
                    name="pickup_flat"
                    value={formData.pickup_flat}
                    onChange={handleChange}
                    className={fieldCls()}
                    placeholder="Flat / house no."
                  />
                </div>
                <div>
                  <FieldLabel>Area / Street</FieldLabel>
                  <input
                    type="text"
                    name="pickup_area"
                    value={formData.pickup_area}
                    onChange={handleChange}
                    className={fieldCls()}
                    placeholder="Society, road, locality"
                  />
                </div>
                <div>
                  <FieldLabel>Landmark</FieldLabel>
                  <input
                    type="text"
                    name="pickup_landmark"
                    value={formData.pickup_landmark}
                    onChange={handleChange}
                    className={fieldCls()}
                    placeholder="Near …"
                  />
                </div>
                <div className="hidden lg:block" />
                <div>
                  <FieldLabel>Pickup Date</FieldLabel>
                  <input
                    type="date"
                    name="pickup_date"
                    value={formData.pickup_date}
                    onChange={handleChange}
                    className={fieldCls()}
                  />
                </div>
                <div>
                  <FieldLabel>Pickup Time</FieldLabel>
                  <input
                    type="time"
                    name="pickup_time"
                    value={formData.pickup_time}
                    onChange={handleChange}
                    className={fieldCls()}
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] text-slate-500 pt-6">
                    Leave area blank to reuse customer address area. Date + time save as preferred slot.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Additional Information" icon={FileText} tone="indigo">
          <div>
            <FieldLabel>Notes</FieldLabel>
            <textarea name="notes" value={formData.notes} onChange={handleChange} className={fieldCls()} rows={3} placeholder="Any additional notes or comments" />
          </div>
        </SectionCard>

        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-3 py-3 sm:px-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex max-w-5xl flex-col sm:flex-row gap-2 sm:gap-3">
            <button type="button" onClick={handleCancel} className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <X className="w-4 h-4" /> Cancel
            </button>
            <button type="submit" disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#023D95] px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#012f73] disabled:opacity-60">
              {saving ? (<><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>) : (<><Save className="w-4 h-4" /> Save Changes</>)}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}


