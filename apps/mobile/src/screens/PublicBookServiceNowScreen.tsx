import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Platform,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  findNodeHandle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { supabase } from '../lib/supabase';
import { ENV } from '../config/environment';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicBottomNav';
import { getCustomerSessionToken } from '../lib/customerSession';
import { apiFetch } from '../lib/api';

type Props = { navigation: any; route?: any };

type CityRow = { id: string; name: string; state?: string | null; zone_id?: string | null };
type CarModelRow = { id: string; make: string; model_name: string; variant?: string | null; class?: string | null };
type ServiceTypeRow = {
  id: string;
  name: string;
  description?: string | null;
  category_uuid?: string | null;
  category?: string;
  points?: number;
};
type WorkshopRow = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
};
type SavedAddress = {
  id: string;
  label?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  landmark?: string | null;
  address_type?: string | null;
};

type BookingFormData = {
  city: CityRow | null;
  carModel: CarModelRow | null;
  customerName: string;
  customerPhone: string;
  selectedServices: string[];
  pickupRequired: boolean;
  selectedWorkshop: WorkshopRow | null;
  pickupDate: string;
  pickupTime: string;
  pickupAddress: string;
  flatNumber: string;
  landmark: string;
  paymentMethod: 'PAY_LATER' | 'PAY_NOW';
};

function formatCar(m: CarModelRow) {
  const v = m.variant ? ` ${m.variant}` : '';
  return `${m.make} ${m.model_name}${v}`.trim();
}

const CAR_IMG_BASE = 'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/car-brands-images';
function getCarImageUrl(make?: string, model?: string): string {
  const m = (make || '').trim().toLowerCase().replace(/\s+/g, '-');
  const md = (model || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!m) return `${CAR_IMG_BASE}/default-car.png`;
  if (!md) return `${CAR_IMG_BASE}/${m}.png`;
  const makePart = m.split('-')[0];
  return `${CAR_IMG_BASE}/${m}-cars/${makePart}-${md}.png`;
}

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

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

function formatDateDMY(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateDMShort(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const dt = new Date(dateStr + 'T00:00:00');
    const day = dt.getDate();
    const month = dt.toLocaleString('en-US', { month: 'short' });
    return `${day} ${month}`;
  } catch {
    return '';
  }
}

const TIME_SLOTS = Array.from({ length: 6 }, (_, i) => {
  const hour = 10 + i;
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

export default function PublicBookServiceNowScreen({ navigation, route }: Props) {
  const paramServiceCategory = route?.params?.serviceCategory;
  const paramServiceCategoryName: string | null = route?.params?.serviceCategoryName ?? null;
  const paramSelectedServiceId = route?.params?.selectedServiceId;
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const scrollToInput = (reactNode: any) => {
    if (scrollRef.current && reactNode) {
      setTimeout(() => {
        (scrollRef.current as any)?.scrollResponderScrollNativeHandleToKeyboard?.(
          findNodeHandle(reactNode), 150, true
        );
      }, 300);
    }
  };

  const [form, setForm] = useState<BookingFormData>({
    city: null,
    carModel: null,
    customerName: '',
    customerPhone: '',
    selectedServices: [],
    pickupRequired: true,
    selectedWorkshop: null,
    pickupDate: '',
    pickupTime: '',
    pickupAddress: '',
    flatNumber: '',
    landmark: '',
    paymentMethod: 'PAY_LATER',
  });

  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [cityModal, setCityModal] = useState(false);
  const [locationDetecting, setLocationDetecting] = useState(false);
  const [detectedCityNotServiceable, setDetectedCityNotServiceable] = useState<string | null>(null);

  const [carQuery, setCarQuery] = useState('');
  const [carSuggestions, setCarSuggestions] = useState<CarModelRow[]>([]);
  const [showCarSuggestions, setShowCarSuggestions] = useState(false);

  const [serviceTypes, setServiceTypes] = useState<ServiceTypeRow[]>([]);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedOilType, setSelectedOilType] = useState<'semi' | 'full'>('semi');
  const [pricing, setPricing] = useState<Record<string, number>>({});
  const [pricingLoading, setPricingLoading] = useState(false);
  const [servicePoints, setServicePoints] = useState<Record<string, number>>({});

  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMeta, setCouponMeta] = useState<any | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);

  const [workshops, setWorkshops] = useState<WorkshopRow[]>([]);
  const [workshopLoading, setWorkshopLoading] = useState(false);
  const [workshopModal, setWorkshopModal] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [savedVehicles, setSavedVehicles] = useState<any[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);
  const [addressDetecting, setAddressDetecting] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpConfirmation, setOtpConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [serviceChecklists, setServiceChecklists] = useState<
    Record<string, Array<{ name: string; category?: string }>>
  >({});
  const [detailsService, setDetailsService] = useState<ServiceTypeRow | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<{
    leadNumber: string;
    title: string;
    message: string;
    isPaid: boolean;
  } | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of serviceTypes) {
      if (s.category) set.add(s.category);
    }
    const arr = Array.from(set);
    arr.sort((a, b) => a.localeCompare(b));
    return arr.length ? arr : [];
  }, [serviceTypes]);

  // Filter the visible category pills when the user came from a specific
  // service tile (e.g. "Periodic Service" → only show Periodic-related pills).
  const visibleCategories = useMemo(() => {
    const keyword = String(paramServiceCategory || '').trim().toUpperCase();
    if (!keyword) return categories;
    const matched = categories.filter((c) => c.toUpperCase().includes(keyword));
    return matched.length > 0 ? matched : categories;
  }, [categories, paramServiceCategory]);

  const isCategoryScoped = useMemo(
    () => Boolean(paramServiceCategory) && visibleCategories.length > 0 && visibleCategories.length < categories.length,
    [paramServiceCategory, visibleCategories.length, categories.length],
  );

  const isPeriodicCategory = useMemo(
    () => String(selectedCategory || '').toUpperCase().includes('PERIODIC'),
    [selectedCategory],
  );

  const getOilTypeForService = (service: any): 'semi' | 'full' | 'unknown' => {
    const text = `${String(service?.name || '')} ${String(service?.description || '')}`.toLowerCase();
    const hasSemi =
      text.includes('semi synthetic') || text.includes('semi-synthetic') || text.includes('(semi)') || /\bsemi\b/.test(text);
    const hasFull =
      text.includes('fully synthetic') || text.includes('full synthetic') || text.includes('synthetic full') ||
      text.includes('(fully)') || text.includes('(full)') || /\bfully\b/.test(text) || /\bfull\b/.test(text);
    if (hasSemi && hasFull) return 'unknown';
    if (hasFull) return 'full';
    if (hasSemi) return 'semi';
    return 'unknown';
  };

  const servicesInCategory = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    return serviceTypes
      .filter((s) => s.category === selectedCategory)
      .filter((s) => (q ? s.name.toLowerCase().includes(q) : true))
      .filter((s) => {
        if (!isPeriodicCategory) return true;
        const oilType = getOilTypeForService(s);
        if (oilType === 'unknown') return true;
        return oilType === selectedOilType;
      });
  }, [serviceTypes, selectedCategory, serviceSearch, isPeriodicCategory, selectedOilType]);

  const totalPrice = useMemo(() => {
    return form.selectedServices.reduce((sum, id) => sum + (pricing[id] || 0), 0);
  }, [form.selectedServices, pricing]);

  const serviceItemsForCoupon = useMemo(() => {
    return form.selectedServices.map((serviceId) => {
      const service = serviceTypes.find((s) => s.id === serviceId);
      return {
        service_type_id: serviceId,
        label: service?.name || null,
        price: pricing[serviceId] || 0,
      };
    });
  }, [form.selectedServices, pricing, serviceTypes]);

  const couponAdjustedTotal = Math.max(totalPrice - (couponDiscount || 0), 0);

  const prevServicesKeyRef = useRef<string>('');
  useEffect(() => {
    const key = [...form.selectedServices].sort().join('|');
    // Only clear an applied coupon when the selected services actually change
    // (not when the coupon itself is applied).
    if (prevServicesKeyRef.current && prevServicesKeyRef.current !== key && couponMeta) {
      setCouponMeta(null);
      setCouponDiscount(0);
      setCouponError('Coupon cleared. Please re-apply after changing services.');
    }
    prevServicesKeyRef.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.selectedServices]);

  const steps = [
    { title: "Let's get started!", subtitle: 'Select your location and car model' },
    { title: 'Almost there!', subtitle: 'Just a few more details' },
    { title: 'Choose your services', subtitle: 'Select services with transparent pricing' },
    { title: 'Pickup Details', subtitle: 'When and where should we pick up your vehicle?' },
    { title: 'Payment Options', subtitle: 'Choose your preferred payment method' },
  ];

  const goStep = (next: number) => {
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // ── Data Fetching ───────────────────────────────────────────────

  async function fetchCities() {
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('id,name,state,zone_id,is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setCities((data as any[]) || []);
      return (data as CityRow[]) || [];
    } catch {
      const fallback: CityRow[] = [
        { id: '1', name: 'Mumbai', state: 'Maharashtra' },
        { id: '2', name: 'Pune', state: 'Maharashtra' },
        { id: '3', name: 'Bangalore', state: 'Karnataka' },
        { id: '4', name: 'Delhi', state: 'Delhi' },
      ];
      setCities(fallback);
      return fallback;
    }
  }

  const autoDetectLocation = useCallback(async (cityList?: CityRow[]) => {
    const list = cityList && cityList.length > 0 ? cityList : cities;
    if (list.length === 0) return;
    setLocationDetecting(true);
    setDetectedCityNotServiceable(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationDetecting(false);
        Alert.alert('Permission denied', 'Location permission is needed to auto-detect your city.');
        return;
      }
      const last = await Location.getLastKnownPositionAsync();
      const loc = last || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&zoom=14&addressdetails=1`,
        { headers: { 'User-Agent': 'MyFNG-App/1.0' } }
      );
      if (response.ok) {
        const data = await response.json();
        const addr = data?.address || {};
        const detectedCity = addr.city || addr.town || addr.state_district || addr.county || addr.village || '';
        const displayLocation = [
          addr.suburb || addr.neighbourhood || addr.village || '',
          addr.city || addr.town || addr.state_district || '',
        ].filter(Boolean).join(', ') || detectedCity;
        if (detectedCity) {
          const normalised = detectedCity.toLowerCase();
          const districtNorm = (addr.state_district || '').toLowerCase();
          const match = list.find(
            (c) => {
              const cn = c.name.toLowerCase();
              return cn === normalised ||
                cn.includes(normalised) ||
                normalised.includes(cn) ||
                (districtNorm && (cn === districtNorm || cn.includes(districtNorm) || districtNorm.includes(cn)));
            }
          );
          if (match) {
            setForm((p) => ({ ...p, city: match }));
            setDetectedCityNotServiceable(null);
          } else {
            setDetectedCityNotServiceable(displayLocation || detectedCity);
          }
        } else {
          setDetectedCityNotServiceable('your area');
        }
      }
    } catch {
      Alert.alert('Detection failed', 'Unable to detect your location. Please select city manually.');
    } finally {
      setLocationDetecting(false);
    }
  }, [cities]);

  const autoDetectAddress = useCallback(async () => {
    setAddressDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is needed to auto-detect address.');
        setAddressDetecting(false);
        return;
      }
      const last = await Location.getLastKnownPositionAsync();
      const loc = last || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&zoom=18&addressdetails=1`,
        { headers: { 'User-Agent': 'MyFNG-App/1.0' } }
      );
      if (response.ok) {
        const data = await response.json();
        const addr = data?.address || {};
        const parts = [
          addr.neighbourhood || addr.suburb || addr.locality || '',
          addr.city || addr.town || addr.village || '',
          addr.state || '',
          addr.postcode || '',
        ].filter(Boolean);
        if (parts.length > 0) {
          setForm((p) => ({ ...p, pickupAddress: parts.join(', ') }));
          setSelectedSavedAddressId(null);
        }
      }
    } catch {
      Alert.alert('Error', 'Could not detect address. Please enter manually.');
    } finally {
      setAddressDetecting(false);
    }
  }, []);

  async function searchCarModels(q: string) {
    const query = q.trim();
    if (query.length < 2) {
      setCarSuggestions([]);
      return;
    }
    try {
      const safe = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const tokens = safe.split(' ').filter(Boolean);
      // Build an OR filter that matches the make OR model on every token so
      // multi-word queries like "skoda rapid" and single brand queries both work.
      const orFilters: string[] = [`make.ilike.%${safe}%`, `model_name.ilike.%${safe}%`];
      for (const t of tokens) {
        orFilters.push(`make.ilike.%${t}%`);
        orFilters.push(`model_name.ilike.%${t}%`);
      }
      const { data, error } = await supabase
        .from('car_models')
        .select('id,make,model_name,variant,class')
        .eq('is_active', true)
        .or(orFilters.join(','))
        .order('make')
        .order('model_name')
        .limit(100);
      if (error) throw error;
      setCarSuggestions(((data as any[]) || []) as any);
    } catch {
      setCarSuggestions([]);
    }
  }

  async function fetchServiceTypes() {
    if (!form.city || !form.carModel) return;
    setServiceLoading(true);
    try {
      const { data: catRows } = await supabase
        .from('categories')
        .select('uuid, category, category_icon')
        .order('category');

      const categoryMap: Record<string, string> = {};
      ((catRows as any[]) || []).forEach((c: any) => {
        if (c.uuid && c.category) {
          categoryMap[c.uuid] = c.category.toUpperCase();
        }
      });

      const { data, error } = await supabase
        .from('service_types')
        .select('id,name,description,is_active,category_uuid')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;

      const enriched: ServiceTypeRow[] = ((data as any[]) || []).map((s: any) => ({
        ...s,
        category: s.category_uuid ? categoryMap[s.category_uuid] || 'OTHER SERVICES' : 'OTHER SERVICES',
      }));

      setServiceTypes(enriched);

      const ids = enriched.map((s) => s.id).filter(Boolean);
      if (ids.length > 0) {
        try {
          const { data: tplRows } = await supabase
            .from('service_type_checklist_templates')
            .select('service_type_id, points, checklist_items')
            .in('service_type_id', ids);
          if (tplRows) {
            const pts: Record<string, number> = {};
            const lists: Record<string, Array<{ name: string; category?: string }>> = {};
            (tplRows as any[]).forEach((r: any) => {
              if (r.service_type_id) {
                if (typeof r.points === 'number') pts[r.service_type_id] = r.points;
                if (Array.isArray(r.checklist_items)) {
                  const items = r.checklist_items
                    .map((it: any) => {
                      if (!it) return null;
                      if (typeof it === 'string') return { name: it, category: 'General' };
                      const name = String(it?.name || it?.title || it?.label || '').trim();
                      if (!name) return null;
                      const category = String(it?.category || 'General').trim() || 'General';
                      return { name, category };
                    })
                    .filter(Boolean);
                  if (items.length > 0) lists[r.service_type_id] = items;
                }
              }
            });
            setServicePoints(pts);
            setServiceChecklists(lists);
          }
        } catch {
          // checklist templates table might not exist yet
        }
      }
    } catch {
      setServiceTypes([]);
    } finally {
      setServiceLoading(false);
    }
  }

  async function fetchPriceForService(
    serviceTypeId: string,
    cityId: string,
    zoneId: string | null,
    vehicleClass: string | null
  ) {
    const tryPrice = async (filters: Record<string, any>) => {
      let q = supabase
        .from('workshop_service_pricing')
        .select('custom_price')
        .eq('service_type_id', serviceTypeId)
        .eq('is_active', true)
        .limit(1);
      for (const [k, v] of Object.entries(filters)) {
        if (v === null) q = q.is(k, null);
        else q = q.eq(k, v);
      }
      const { data } = await q.maybeSingle();
      const p = Number((data as any)?.custom_price || 0);
      return Number.isFinite(p) ? p : 0;
    };

    if (cityId && vehicleClass) {
      const p = await tryPrice({ city_id: cityId, class: vehicleClass });
      if (p) return p;
    }
    if (cityId) {
      const p = await tryPrice({ city_id: cityId, class: null });
      if (p) return p;
    }
    if (zoneId && vehicleClass) {
      const p = await tryPrice({ zone_id: zoneId, class: vehicleClass });
      if (p) return p;
    }
    if (zoneId) {
      const p = await tryPrice({ zone_id: zoneId, class: null });
      if (p) return p;
    }
    if (vehicleClass) {
      const p = await tryPrice({ class: vehicleClass, city_id: null, zone_id: null });
      if (p) return p;
    }

    // Final fallback: any active pricing for this service (cheapest)
    // Matches the website's logic so Fully Synthetic and other variants
    // still show a price even when city/zone/class-specific rows aren't configured.
    try {
      const { data } = await supabase
        .from('workshop_service_pricing')
        .select('custom_price')
        .eq('service_type_id', serviceTypeId)
        .eq('is_active', true)
        .gt('custom_price', 0)
        .order('custom_price', { ascending: true })
        .limit(1)
        .maybeSingle();
      const p = Number((data as any)?.custom_price || 0);
      if (Number.isFinite(p) && p > 0) return p;
    } catch {
      // ignore
    }
    return 0;
  }

  async function fetchPricing() {
    if (!form.city || !form.carModel || serviceTypes.length === 0) return;
    setPricingLoading(true);
    try {
      const cityId = form.city.id;
      const zoneId = form.city.zone_id || null;
      const vehicleClass = form.carModel.class || null;

      const next: Record<string, number> = {};
      const list = serviceTypes.slice(0, 120);
      await Promise.all(
        list.map(async (s) => {
          const p = await fetchPriceForService(s.id, cityId, zoneId, vehicleClass);
          if (p > 0) next[s.id] = p;
        })
      );
      setPricing(next);
    } catch {
      setPricing({});
    } finally {
      setPricingLoading(false);
    }
  }

  async function fetchWorkshops() {
    if (!form.city) return;
    setWorkshopLoading(true);
    try {
      const { data, error } = await supabase
        .from('workshops')
        .select('id,name,address,city,state,pincode,phone,is_active,is_verified')
        .eq('is_active', true)
        .eq('is_verified', true)
        .ilike('city', `%${form.city.name}%`)
        .order('name')
        .limit(200);
      if (error) throw error;
      setWorkshops(((data as any[]) || []) as any);
    } catch {
      setWorkshops([]);
    } finally {
      setWorkshopLoading(false);
    }
  }

  async function fetchAvailableCoupons() {
    // Public, unauthenticated fetch (booking flow works for logged-out users too).
    // The coupons table has RLS so a direct anon Supabase query won't work — must go via the API.
    try {
      const res = await fetch(`${ENV.API_URL}/api/coupons/active`);
      const json = await res.json().catch(() => ({}));
      const list = Array.isArray(json?.coupons) ? json.coupons : [];
      setAvailableCoupons(list);
    } catch {
      setAvailableCoupons([]);
    }
  }

  function describeCoupon(c: any): string {
    const mode = String(c?.discount_mode || '').toUpperCase();
    const val = Number(c?.discount_value || 0);
    if (c?.coupon_kind === 'FREE_SERVICE') return 'Free service';
    if (mode === 'PERCENT' && val > 0) return `${val}% OFF`;
    if ((mode === 'AMOUNT' || mode === 'FLAT' || mode === 'FIXED') && val > 0) return `₹${val} OFF`;
    if (c?.description) return String(c.description);
    return 'Offer';
  }

  async function applyCoupon(overrideCode?: string) {
    const code = (overrideCode ?? couponCode).trim();
    if (!code) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    if (overrideCode) setCouponCode(overrideCode.toUpperCase());
    setCouponApplying(true);
    setCouponError(null);
    try {
      const response = await fetch(`${ENV.API_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          lead_context: {
            subtotal: totalPrice,
            service_type_ids: form.selectedServices,
            service_items: serviceItemsForCoupon,
            customer_phone: form.customerPhone,
          },
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.valid) {
        throw new Error(json?.error || 'Coupon validation failed.');
      }
      setCouponMeta(json.coupon_meta || null);
      setCouponDiscount(Number(json.discount_amount || 0));
      setCouponError(null);
      Alert.alert('Coupon applied', `Code: ${json?.coupon?.code || code}`);
    } catch (error: any) {
      setCouponMeta(null);
      setCouponDiscount(0);
      setCouponError(error?.message || 'Invalid coupon.');
    } finally {
      setCouponApplying(false);
    }
  }

  function clearCoupon() {
    setCouponCode('');
    setCouponMeta(null);
    setCouponDiscount(0);
    setCouponError(null);
  }

  async function fetchProfileIfLoggedIn() {
    try {
      const token = await getCustomerSessionToken();
      if (!token) return;
      setIsLoggedIn(true);

      const profileRes = await apiFetch<any>('/api/customer/profile');
      const customer = profileRes?.customer || {};

      setForm((p) => ({
        ...p,
        customerName: customer.full_name || customer.name || p.customerName,
        customerPhone: customer.phone || p.customerPhone,
      }));

      const addresses: SavedAddress[] = (profileRes?.addresses || []).map((a: any) => ({
        id: String(a.id),
        label: a.label || a.address_type || null,
        address_line1: a.address_line1 || a.line1 || a.address || null,
        address_line2: a.address_line2 || a.line2 || null,
        city: a.city || null,
        state: a.state || null,
        pincode: a.pincode || null,
        landmark: a.landmark || null,
        address_type: a.address_type || null,
      }));
      setSavedAddresses(addresses);

      // If no saved addresses from API, pull from past orders + customer record
      if (addresses.length === 0) {
        const fallbackAddresses: SavedAddress[] = [];
        const seen = new Set<string>();

        // Customer's own address from profile
        const custAddr = customer.address || customer.customer_address || '';
        if (custAddr && !seen.has(custAddr.toLowerCase().trim())) {
          seen.add(custAddr.toLowerCase().trim());
          fallbackAddresses.push({
            id: 'customer_primary',
            address_line1: custAddr,
            city: customer.city || null,
            address_type: 'Home',
            label: 'Home',
            address_line2: null, state: null, pincode: null, landmark: null,
          });
        }

        // Past bookings (orders + leads)
        try {
          const [ordersRes, leadsRes] = await Promise.all([
            apiFetch<any>('/api/customer/orders').catch(() => null),
            apiFetch<any>('/api/customer/leads').catch(() => null),
          ]);
          const allLeads = [
            ...(Array.isArray(ordersRes?.orders) ? ordersRes.orders : []),
            ...(Array.isArray(leadsRes?.leads) ? leadsRes.leads : []),
          ];
          for (const o of allLeads) {
            const addr = o.address || o.customer_address || o.pickup_address || '';
            if (!addr || seen.has(addr.toLowerCase().trim())) continue;
            seen.add(addr.toLowerCase().trim());
            fallbackAddresses.push({
              id: `lead_${o.id}`,
              address_line1: addr,
              city: o.city || null,
              address_type: 'Saved Address',
              label: 'Saved Address',
              address_line2: null, state: null, pincode: null, landmark: null,
            });
          }
        } catch {}

        if (fallbackAddresses.length > 0) setSavedAddresses(fallbackAddresses.slice(0, 5));
      }

      try {
        const vehiclesRes = await apiFetch<any>('/api/customer/vehicles');
        const savedV = Array.isArray(vehiclesRes?.vehicles) ? vehiclesRes.vehicles : [];
        if (savedV.length > 0) {
          setSavedVehicles(savedV);
        } else {
          // Fallback: pull vehicles from past orders/leads
          try {
            const [ordersRes, leadsRes] = await Promise.all([
              apiFetch<any>('/api/customer/orders').catch(() => null),
              apiFetch<any>('/api/customer/leads').catch(() => null),
            ]);
            const allLeads = [
              ...(Array.isArray(ordersRes?.orders) ? ordersRes.orders : []),
              ...(Array.isArray(leadsRes?.leads) ? leadsRes.leads : []),
            ];
            const vehicleMap = new Map<string, any>();
            for (const o of allLeads) {
              const make = o.vehicle_make || o.car_make || '';
              const model = o.vehicle_model || o.car_model || '';
              const plate = String(o.vehicle_number || o.car_number || '').trim().toUpperCase();
              const key = plate || `${make}-${model}`;
              if (!key || vehicleMap.has(key)) continue;
              vehicleMap.set(key, {
                id: o.id,
                make,
                model,
                vehicle_number: plate,
                fuel_type: o.fuel_type || null,
              });
            }
            setSavedVehicles(Array.from(vehicleMap.values()).slice(0, 5));
          } catch {}
        }
      } catch {}

    } catch {
      // not logged in or API failed
    }
  }

  async function submitLead() {
    if (!form.city || !form.carModel) return;
    if (!form.customerPhone.trim()) {
      Alert.alert('Phone required', 'Please enter your phone number.');
      return;
    }
    if (!form.pickupDate || !form.pickupTime) {
      Alert.alert('Date & time required', 'Please select your preferred date and time.');
      return;
    }
    if (form.pickupRequired && (!form.pickupAddress.trim() || !form.landmark.trim())) {
      Alert.alert('Address required', 'Please enter pickup address and landmark.');
      return;
    }

    setLoading(true);
    try {
      const leadNumber = `L-${Date.now().toString().slice(-8)}`;
      const addressParts = [form.pickupAddress.trim()];
      if (form.flatNumber.trim()) addressParts.unshift(form.flatNumber.trim());
      if (form.landmark.trim()) addressParts.push(form.landmark.trim());
      const completeAddress = addressParts.filter((p) => p.length > 0).join(', ');

      const response = await fetch(`${ENV.API_URL}/api/public/bookings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: {
            lead_number: leadNumber,
            created_from: 'MOBILE_PUBLIC',
            status: 'NEW',
            lead_type: 'CAR_SERVICE',
            lead_source: 'App Booking',
            customer_name: form.customerName || null,
            customer_phone: form.customerPhone.trim(),
            city: form.city.name,
            city_id: form.city.id,
            vehicle_make: form.carModel.make,
            model_id: form.carModel.id,
            vehicle_model: form.carModel.model_name,
            vehicle_variant: form.carModel.variant || null,
            service_type_ids: form.selectedServices.length > 0 ? form.selectedServices : null,
            pickup_required: form.pickupRequired,
            workshop_id: form.pickupRequired ? null : form.selectedWorkshop?.id || null,
            address: form.pickupRequired ? completeAddress : form.selectedWorkshop?.address || null,
            customer_address: form.pickupRequired ? completeAddress : form.selectedWorkshop?.address || null,
            pickup_address: form.pickupRequired ? completeAddress : null,
            preferred_slot_start:
              form.pickupDate && form.pickupTime
                ? `${form.pickupDate}T${form.pickupTime}:00`
                : null,
            estimated_amount: totalPrice > 0 ? totalPrice : null,
            lead_priority: 'NORMAL',
            created_at: new Date().toISOString(),
          },
          coupon: couponMeta
            ? {
                code: couponCode,
                lead_context: {
                  subtotal: totalPrice,
                  service_type_ids: form.selectedServices,
                  service_items: serviceItemsForCoupon,
                  customer_phone: form.customerPhone,
                },
              }
            : undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Failed to create booking');

      const createdLeadId = json?.lead?.id;

      if (form.paymentMethod === 'PAY_NOW' && couponAdjustedTotal > 0 && createdLeadId) {
        try {
          const intentRes = await fetch(`${ENV.API_URL}/api/payments/create-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lead_id: createdLeadId,
              payment_type: 'ADVANCE',
              amount: couponAdjustedTotal,
              payment_method: 'RAZORPAY',
            }),
          });
          const intentJson = await intentRes.json();
          if (intentRes.ok && intentJson?.success) {
            const pi = intentJson.payment_intent;
            let RazorpayCheckout: any = null;
            try {
              RazorpayCheckout = require('react-native-razorpay')?.default;
            } catch {
              RazorpayCheckout = null;
            }
            if (RazorpayCheckout) {
              try {
                const options = {
                  key: pi.razorpay_key,
                  amount: pi.amount_paise,
                  currency: 'INR',
                  name: 'MyFNG',
                  description: `Booking ${leadNumber}`,
                  order_id: pi.order_id,
                  prefill: {
                    contact: form.customerPhone,
                    name: form.customerName || undefined,
                  },
                  theme: { color: '#004AAD' },
                };
                await RazorpayCheckout.open(options);
                setBookingSuccess({
                  leadNumber: json?.lead?.lead_number || leadNumber,
                  title: 'Payment Successful!',
                  message:
                    'Your booking has been confirmed and payment received. Our team will reach out to you shortly with pickup details.',
                  isPaid: true,
                });
              } catch (payErr: any) {
                const cancelled =
                  payErr?.code === 'PAYMENT_CANCELLED' ||
                  payErr?.description?.includes('cancelled');
                setBookingSuccess({
                  leadNumber: json?.lead?.lead_number || leadNumber,
                  title: 'Booking Confirmed!',
                  message: cancelled
                    ? 'Your booking has been created. Payment was cancelled \u2014 you can pay later from your bookings.'
                    : 'Your booking has been created. Payment could not be processed \u2014 you can pay later from your bookings.',
                  isPaid: false,
                });
              }
            } else {
              setBookingSuccess({
                leadNumber: json?.lead?.lead_number || leadNumber,
                title: 'Booking Confirmed!',
                message:
                  'Your booking has been created. Payment module is not available \u2014 you can pay later from your bookings.',
                isPaid: false,
              });
            }
          } else {
            setBookingSuccess({
              leadNumber: json?.lead?.lead_number || leadNumber,
              title: 'Booking Confirmed!',
              message:
                'Your booking has been created. Payment could not be initiated \u2014 you can pay later from your bookings.',
              isPaid: false,
            });
          }
        } catch {
          setBookingSuccess({
            leadNumber: json?.lead?.lead_number || leadNumber,
            title: 'Booking Confirmed!',
            message:
              'Your booking has been created. Payment gateway is currently unavailable \u2014 you can pay later from your bookings.',
            isPaid: false,
          });
        }
      } else {
        setBookingSuccess({
          leadNumber: json?.lead?.lead_number || leadNumber,
          title: 'Booking Confirmed!',
          message:
            'Thank you for choosing MyFNG! Our team will contact you shortly to confirm pickup details and finalise your service.',
          isPaid: false,
        });
      }

      setForm((prev) => ({
        ...prev,
        selectedServices: [],
        pickupDate: '',
        pickupTime: '',
        pickupAddress: '',
        flatNumber: '',
        landmark: '',
        selectedWorkshop: null,
      }));
    } catch {
      Alert.alert('Failed', 'Could not create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Effects ─────────────────────────────────────────────────────

  useEffect(() => {
    fetchAvailableCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const cityList = await fetchCities();
      const rebook = route?.params?.rebookOrder;
      if (rebook) {
        const cityName = String(rebook.city || '').trim().toLowerCase();
        const matchedCity = cityList.find((c) => c.name.toLowerCase() === cityName);
        const addressText = String(rebook.address || '').trim();
        const rebookFormUpdates: Partial<BookingFormData> = {};
        if (matchedCity) rebookFormUpdates.city = matchedCity;
        if (addressText) {
          rebookFormUpdates.pickupAddress = addressText;
          rebookFormUpdates.landmark = addressText;
        }
        const make = String(rebook.vehicle_make || '').trim();
        const model = String(rebook.vehicle_model || '').trim();
        if (make && model) {
          rebookFormUpdates.carModel = { id: `rebook-${Date.now()}`, make, model_name: model, variant: rebook.fuel_type || null };
          setCarQuery(`${make} ${model}`);
        }
        setForm((prev) => ({ ...prev, ...rebookFormUpdates }));
        if (!matchedCity) autoDetectLocation(cityList);
        if (matchedCity || make) setStep(1);
      } else {
        autoDetectLocation(cityList);
      }
    })();
    fetchProfileIfLoggedIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (form.city && !form.pickupRequired) {
      fetchWorkshops();
    } else {
      setWorkshops([]);
      setForm((p) => ({ ...p, selectedWorkshop: null }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.city?.id, form.pickupRequired]);

  useEffect(() => {
    if (step === 2 && form.city && form.carModel) {
      fetchServiceTypes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.city?.id, form.carModel?.id]);

  useEffect(() => {
    if (step === 2 && form.city && form.carModel && serviceTypes.length > 0) {
      const allowed = visibleCategories.length > 0 ? visibleCategories : categories;
      if (!selectedCategory || !allowed.includes(selectedCategory)) {
        const keyword = String(paramServiceCategory || '').trim().toUpperCase();
        const fromKeyword = keyword
          ? allowed.find((c) => c.toUpperCase().includes(keyword))
          : undefined;
        const exact = paramServiceCategory && allowed.includes(paramServiceCategory)
          ? paramServiceCategory
          : undefined;
        setSelectedCategory(fromKeyword || exact || allowed[0] || '');
      }
      fetchPricing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceTypes.length, step, form.city?.id, form.carModel?.id, visibleCategories.length]);

  useEffect(() => {
    if (step === 2 && serviceTypes.length > 0 && paramSelectedServiceId && form.selectedServices.length === 0) {
      const exists = serviceTypes.find((s) => s.id === paramSelectedServiceId);
      if (exists) {
        setForm((prev) => ({ ...prev, selectedServices: [paramSelectedServiceId] }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, serviceTypes.length, paramSelectedServiceId]);

  // ── Handlers ────────────────────────────────────────────────────

  const handleServiceToggle = useCallback(
    (serviceId: string) => {
      setForm((prev) => {
        const target = serviceTypes.find((s) => s.id === serviceId);
        if (!target?.category_uuid) {
          const has = prev.selectedServices.includes(serviceId);
          return {
            ...prev,
            selectedServices: has
              ? prev.selectedServices.filter((x) => x !== serviceId)
              : [...prev.selectedServices, serviceId],
          };
        }
        const fromOtherCategories = prev.selectedServices.filter((id) => {
          const s = serviceTypes.find((it) => it.id === id);
          return s?.category_uuid !== target.category_uuid;
        });
        const alreadySelected = prev.selectedServices.includes(serviceId);
        if (alreadySelected) {
          return { ...prev, selectedServices: fromOtherCategories };
        }
        return { ...prev, selectedServices: [...fromOtherCategories, serviceId] };
      });
    },
    [serviceTypes]
  );

  const canNext = () => {
    if (step === 0) return Boolean(form.city && form.carModel);
    if (step === 1) {
      if (!form.customerPhone.trim() || form.customerPhone.trim().length < 10) return false;
      if (!isLoggedIn && !otpVerified) return false;
      return true;
    }
    if (step === 2) return form.selectedServices.length > 0;
    if (step === 3) {
      if (form.pickupRequired)
        return Boolean(form.pickupDate && form.pickupTime && form.pickupAddress.trim() && form.landmark.trim());
      return Boolean(form.pickupDate && form.pickupTime);
    }
    return true;
  };

  const handleSendOtp = async () => {
    const cleanPhone = form.customerPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number');
      return;
    }
    setOtpLoading(true);
    try {
      if (__DEV__) {
        try { auth().settings.appVerificationDisabledForTesting = true; } catch {}
      }
      const result = await auth().signInWithPhoneNumber(`+91${cleanPhone}`);
      setOtpConfirmation(result);
      setOtpSent(true);
      Alert.alert('OTP Sent', `OTP sent to +91${cleanPhone}`);
    } catch (error: any) {
      Alert.alert('OTP Failed', error?.message || 'Unable to send OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.trim().length < 4) {
      Alert.alert('Invalid OTP', 'Please enter the OTP sent to your number');
      return;
    }
    setOtpLoading(true);
    try {
      if (!otpConfirmation) throw new Error('OTP expired. Please resend.');
      await otpConfirmation.confirm(otpValue.trim());
      setOtpVerified(true);
      Alert.alert('Verified', 'Phone number verified successfully!');
    } catch (error: any) {
      Alert.alert('Verification Failed', error?.message || 'Invalid OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const onNext = () => {
    if (step === 1 && !isLoggedIn && !otpVerified) {
      if (!otpSent) {
        handleSendOtp();
      } else {
        handleVerifyOtp();
      }
      return;
    }
    if (!canNext()) {
      Alert.alert('Complete this step', 'Please fill the required details.');
      return;
    }
    if (step < steps.length - 1) goStep(step + 1);
    else submitLead();
  };

  const onBack = () => goStep(Math.max(0, step - 1));

  const onDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setForm((p) => ({ ...p, pickupDate: formatDateYMD(selectedDate) }));
    }
  };

  const selectSavedAddress = (addr: SavedAddress) => {
    setSelectedSavedAddressId(addr.id);
    const raw = addr.address_line1 || '';
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);

    let flatNumber = addr.address_line2 || '';
    let landmark = addr.landmark || '';
    let pickupAddress = raw;

    if (!flatNumber && parts.length >= 3) {
      const pincodeIdx = parts.findIndex((p) => /^\d{6}$/.test(p));
      const nonPinParts = parts.filter((p) => !/^\d{6}$/.test(p));
      if (nonPinParts.length >= 2) {
        flatNumber = nonPinParts[0] || '';
        landmark = nonPinParts[1] || '';
        pickupAddress = nonPinParts.slice(1).join(', ');
      }
    } else if (!flatNumber && parts.length === 2) {
      flatNumber = parts[0] || '';
      pickupAddress = parts[1] || '';
    }

    if (!pickupAddress) {
      const cityState = [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
      pickupAddress = [raw, cityState].filter(Boolean).join(', ');
    }

    setForm((p) => ({
      ...p,
      pickupAddress,
      flatNumber,
      landmark,
    }));
  };

  const todayStr = formatDateYMD(getIndiaDate());
  const tomorrowDate = new Date(getIndiaDate());
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = formatDateYMD(tomorrowDate);

  // ── Render ──────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 80}>
      <View style={styles.screen}>
        <ScrollView ref={scrollRef} contentContainerStyle={[styles.container, keyboardVisible && { paddingBottom: 350 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Top header */}
          <View style={styles.top}>
            <View style={styles.topRow}>
              <Image source={require('../../assets/logo.png')} style={styles.brandLogo} resizeMode="contain" />
              {!isLoggedIn ? (
                <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginBtn}>
                  <Text style={styles.loginText}>Login</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.loggedInBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                  <Text style={styles.loggedInText}>Logged In</Text>
                </View>
              )}
            </View>
            <Text style={styles.h1}>Book Service Now</Text>
            <Text style={styles.h2}>{steps[step].subtitle}</Text>

            <View style={styles.stepper}>
              {steps.map((_, i) => (
                <View key={i} style={[styles.stepDot, i <= step ? styles.stepDotActive : null]} />
              ))}
            </View>
          </View>

          {/* Step cards */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{steps[step].title}</Text>

            {/* ── Step 0: City + Car ── */}
            {step === 0 ? (
              <>
                <TouchableOpacity style={styles.inputRow} onPress={() => setCityModal(true)} activeOpacity={0.9}>
                  <Ionicons name="location" size={16} color={COLORS.primary} />
                  <Text style={styles.inputRowText}>
                    {form.city
                      ? `${form.city.name}${form.city.state ? `, ${form.city.state}` : ''}`
                      : 'Select city'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.gray[500]} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.autoDetectBtn}
                  onPress={() => autoDetectLocation()}
                  disabled={locationDetecting}
                  activeOpacity={0.9}
                >
                  {locationDetecting ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Ionicons name="navigate" size={14} color={COLORS.primary} />
                  )}
                  <Text style={styles.autoDetectText}>
                    {locationDetecting ? 'Detecting…' : 'Auto Detect Location'}
                  </Text>
                </TouchableOpacity>

                {detectedCityNotServiceable ? (
                  <View style={styles.notServiceableBanner}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Ionicons name="location" size={16} color="#EA580C" style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.notServiceableTitle}>
                          We currently don't serve <Text style={{ fontWeight: '900' }}>{detectedCityNotServiceable}</Text>
                        </Text>
                        <Text style={styles.notServiceableSub}>
                          Please select from our available cities below — we're expanding soon!
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {/* Inline car search */}
                <View style={styles.carSearchWrap}>
                  <View style={styles.carSearchRow}>
                    <Ionicons name="car-sport" size={16} color={COLORS.primary} />
                    <TextInput
                      value={form.carModel ? formatCar(form.carModel) : carQuery}
                      onChangeText={(t) => {
                        if (form.carModel) setForm((p) => ({ ...p, carModel: null }));
                        setCarQuery(t);
                        setShowCarSuggestions(true);
                        searchCarModels(t);
                      }}
                      onFocus={() => {
                        if (carSuggestions.length > 0) setShowCarSuggestions(true);
                      }}
                      placeholder="Type make or model (e.g. Tata Nexon)"
                      placeholderTextColor={COLORS.gray[500]}
                      style={styles.carSearchInput}
                    />
                    {form.carModel ? (
                      <TouchableOpacity
                        onPress={() => {
                          setForm((p) => ({ ...p, carModel: null }));
                          setCarQuery('');
                          setCarSuggestions([]);
                        }}
                      >
                        <Ionicons name="close-circle" size={18} color={COLORS.gray[400]} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {showCarSuggestions && carSuggestions.length > 0 ? (
                    <ScrollView
                      style={styles.carSuggestionList}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator
                    >
                      {carSuggestions.map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          style={styles.carSuggestionRow}
                          onPress={() => {
                            setForm((p) => ({ ...p, carModel: m }));
                            setCarQuery('');
                            setShowCarSuggestions(false);
                          }}
                        >
                          <Text style={styles.carSuggestionText}>{formatCar(m)}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : null}

                  {showCarSuggestions && carQuery.length >= 2 && carSuggestions.length === 0 ? (
                    <View style={styles.carSuggestionList}>
                      <Text style={styles.carSuggestionEmpty}>No models found</Text>
                    </View>
                  ) : null}

                  {!showCarSuggestions && carQuery.length > 0 && carQuery.length < 2 ? (
                    <Text style={styles.carHint}>Type at least 2 letters to search</Text>
                  ) : null}
                </View>

                {isLoggedIn && savedVehicles.length > 0 && !form.carModel ? (
                  <View style={styles.savedVehicleSection}>
                    <Text style={styles.savedVehicleLabel}>YOUR SAVED VEHICLE</Text>
                    {savedVehicles.map((v) => (
                      <TouchableOpacity
                        key={v.id}
                        style={styles.savedVehicleCard}
                        activeOpacity={0.85}
                        onPress={async () => {
                          const make = v.make || '';
                          const model = v.model || '';
                          const { data } = await supabase
                            .from('car_models')
                            .select('id,make,model_name,variant,class')
                            .eq('is_active', true)
                            .ilike('make', make)
                            .ilike('model_name', model)
                            .limit(1);
                          if (data && data.length > 0) {
                            setForm((p) => ({ ...p, carModel: data[0] as any }));
                          } else {
                            setForm((p) => ({ ...p, carModel: { id: v.id, make, model_name: model, variant: v.variant || null } as any }));
                          }
                        }}
                      >
                        <Image
                          source={{ uri: getCarImageUrl(v.make, v.model) }}
                          style={styles.savedVehicleImg}
                          resizeMode="contain"
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.savedVehicleName}>{[v.make, v.model].filter(Boolean).join(' ') || 'Vehicle'}</Text>
                          {v.vehicle_number ? <Text style={styles.savedVehicleNumber}>{v.vehicle_number}</Text> : null}
                          {v.fuel_type ? <Text style={styles.savedVehicleFuel}>{v.fuel_type}</Text> : null}
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                <View style={styles.tip}>
                  <Ionicons name="sparkles" size={16} color={COLORS.purple} />
                  <Text style={styles.tipText}>Book Your Service Under 60 Seconds</Text>
                </View>
              </>
            ) : null}

            {/* ── Step 1: Name + Phone ── */}
            {step === 1 ? (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Name (optional)</Text>
                  <TextInput
                    value={form.customerName}
                    onChangeText={(t) => setForm((p) => ({ ...p, customerName: t }))}
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor={COLORS.gray[500]}
                    onFocus={(e) => scrollToInput(e.target)}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Phone *</Text>
                  <TextInput
                    value={form.customerPhone}
                    onChangeText={(t) => {
                      setForm((p) => ({ ...p, customerPhone: t.replace(/\D/g, '').slice(0, 10) }));
                      if (otpSent) { setOtpSent(false); setOtpVerified(false); setOtpValue(''); }
                    }}
                    style={styles.input}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={COLORS.gray[500]}
                    keyboardType="phone-pad"
                    editable={!otpVerified}
                    onFocus={(e) => scrollToInput(e.target)}
                  />
                </View>
                {!isLoggedIn && otpSent && !otpVerified ? (
                  <View style={styles.field}>
                    <Text style={styles.label}>Enter OTP *</Text>
                    <TextInput
                      value={otpValue}
                      onChangeText={setOtpValue}
                      style={styles.input}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor={COLORS.gray[500]}
                      keyboardType="number-pad"
                      maxLength={6}
                      onFocus={(e) => scrollToInput(e.target)}
                    />
                    <TouchableOpacity onPress={handleSendOtp} style={{ marginTop: 8 }} disabled={otpLoading}>
                      <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700' }}>Resend OTP</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {!isLoggedIn && otpVerified ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Ionicons name="checkmark-circle" size={16} color="#059669" />
                    <Text style={{ color: '#059669', fontSize: 12, fontWeight: '700' }}>Phone verified</Text>
                  </View>
                ) : null}
                {isLoggedIn ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Ionicons name="checkmark-circle" size={16} color="#059669" />
                    <Text style={{ color: '#059669', fontSize: 12, fontWeight: '700' }}>Logged in - OTP not required</Text>
                  </View>
                ) : null}
              </>
            ) : null}

            {/* ── Step 2: Services ── */}
            {step === 2 ? (
              <>
                {isCategoryScoped ? (
                  <View style={styles.scopedHintRow}>
                    <Ionicons name="filter" size={12} color={COLORS.primary} />
                    <Text style={styles.scopedHintText}>
                      Showing {paramServiceCategoryName || 'selected service'} plans
                    </Text>
                    <TouchableOpacity
                      onPress={() => navigation.setParams({ serviceCategory: null, serviceCategoryName: null } as never)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.scopedHintClear}>View all</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {visibleCategories.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabs}
                  >
                    {visibleCategories.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.tab, c === selectedCategory ? styles.tabActive : null]}
                        onPress={() => setSelectedCategory(c)}
                        activeOpacity={0.9}
                      >
                        <Text
                          style={[styles.tabText, c === selectedCategory ? styles.tabTextActive : null]}
                        >
                          {c}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : null}

                <View style={styles.searchRow}>
                  <Ionicons name="search" size={16} color={COLORS.gray[500]} />
                  <TextInput
                    value={serviceSearch}
                    onChangeText={setServiceSearch}
                    placeholder="Search in services"
                    placeholderTextColor={COLORS.gray[500]}
                    style={styles.searchInput}
                  />
                  {pricingLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
                </View>

                {isPeriodicCategory ? (
                  <View style={styles.oilTypeRow}>
                    <Text style={styles.oilTypeLabel}>Engine Oil:</Text>
                    <TouchableOpacity
                      style={[styles.oilTypePill, selectedOilType === 'semi' ? styles.oilTypePillActive : null]}
                      onPress={() => setSelectedOilType('semi')}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="water-outline" size={14} color={selectedOilType === 'semi' ? '#FFFFFF' : COLORS.primary} />
                      <Text numberOfLines={1} style={[styles.oilTypePillText, selectedOilType === 'semi' ? styles.oilTypePillTextActive : null]}>Semi Synthetic</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.oilTypePill, selectedOilType === 'full' ? styles.oilTypePillActive : null]}
                      onPress={() => setSelectedOilType('full')}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="water" size={14} color={selectedOilType === 'full' ? '#FFFFFF' : COLORS.primary} />
                      <Text numberOfLines={1} style={[styles.oilTypePillText, selectedOilType === 'full' ? styles.oilTypePillTextActive : null]}>Fully Synthetic</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {serviceLoading ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading services…</Text>
                  </View>
                ) : (
                  <View style={styles.serviceList}>
                    {servicesInCategory.map((s) => {
                      const selected = form.selectedServices.includes(s.id);
                      const price = pricing[s.id] || 0;
                      const pts = servicePoints[s.id] || s.points || 0;
                      const checklistItems = serviceChecklists[s.id] || [];
                      const visibleItems = checklistItems.slice(0, 5);
                      return (
                        <View
                          key={s.id}
                          style={[styles.planCard, selected ? styles.planCardActive : null]}
                        >
                          <TouchableOpacity
                            style={styles.planCardHeader}
                            onPress={() => handleServiceToggle(s.id)}
                            activeOpacity={0.85}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.serviceName}>{s.name}</Text>
                              {pts > 0 ? (
                                <Text style={styles.servicePoints}>{pts} Points</Text>
                              ) : null}
                            </View>
                            <View style={styles.serviceRight}>
                              <Text style={styles.servicePrice}>{price ? inr(price) : '—'}</Text>
                              <Ionicons
                                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                                size={20}
                                color={selected ? COLORS.success : COLORS.gray[400]}
                              />
                            </View>
                          </TouchableOpacity>

                          {visibleItems.length > 0 ? (
                            <View style={styles.planCardItems}>
                              {visibleItems.map((it, idx) => (
                                <View key={`${s.id}-it-${idx}`} style={styles.planCardItemRow}>
                                  <Ionicons
                                    name="checkmark-circle"
                                    size={14}
                                    color="#16A34A"
                                    style={{ marginTop: 2 }}
                                  />
                                  <Text style={styles.planCardItemText} numberOfLines={2}>
                                    {it.name}
                                  </Text>
                                </View>
                              ))}
                              {checklistItems.length > 5 ? (
                                <TouchableOpacity
                                  onPress={() => setDetailsService(s)}
                                  activeOpacity={0.7}
                                  style={styles.planViewAllBtn}
                                >
                                  <Text style={styles.planViewAllText}>
                                    View all points ({checklistItems.length})
                                  </Text>
                                  <Ionicons
                                    name="chevron-forward"
                                    size={14}
                                    color={COLORS.primary}
                                  />
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          ) : s.description ? (
                            <Text style={styles.serviceDesc} numberOfLines={2}>
                              {s.description}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={styles.totalBar}>
                  <Text style={styles.totalLabel}>Estimated total</Text>
                  <Text style={styles.totalValue}>{totalPrice ? inr(totalPrice) : '—'}</Text>
                </View>
              </>
            ) : null}

            {/* ── Step 3: Pickup / Visit ── */}
            {step === 3 ? (
              <>
                {/* Service Preference Card */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionCardHeader}>
                    <View style={[styles.sectionIcoBox, { backgroundColor: '#6366F1' }]}>
                      <Ionicons name="car" size={16} color="#FFFFFF" />
                    </View>
                    <Text style={styles.sectionCardTitle}>Service Preference</Text>
                    <Text style={styles.requiredStar}>*</Text>
                  </View>
                  <View style={styles.servicePrefRow}>
                    <TouchableOpacity
                      style={styles.servicePrefSide}
                      onPress={() => setForm((p) => ({ ...p, pickupRequired: true, selectedWorkshop: null }))}
                      activeOpacity={0.85}
                    >
                      <View
                        style={[
                          styles.servicePrefIcoBox,
                          form.pickupRequired
                            ? { backgroundColor: '#6366F1' }
                            : { backgroundColor: '#D1D5DB' },
                        ]}
                      >
                        <Ionicons
                          name="navigate"
                          size={18}
                          color={form.pickupRequired ? '#FFFFFF' : '#6B7280'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.servicePrefLabel,
                          form.pickupRequired ? { color: '#4338CA' } : { color: '#6B7280' },
                        ]}
                      >
                        Pickup
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        if (form.pickupRequired) {
                          setForm((p) => ({
                            ...p,
                            pickupRequired: false,
                            pickupDate: '',
                            pickupTime: '',
                            pickupAddress: '',
                            flatNumber: '',
                            landmark: '',
                          }));
                          fetchWorkshops();
                        } else {
                          setForm((p) => ({ ...p, pickupRequired: true, selectedWorkshop: null }));
                        }
                      }}
                      style={[
                        styles.servicePrefToggle,
                        form.pickupRequired
                          ? { backgroundColor: '#6366F1' }
                          : { backgroundColor: '#10B981' },
                      ]}
                    >
                      <View
                        style={[
                          styles.servicePrefKnob,
                          form.pickupRequired ? { left: 3 } : { right: 3 },
                        ]}
                      >
                        <Ionicons
                          name={form.pickupRequired ? 'navigate' : 'location'}
                          size={16}
                          color={form.pickupRequired ? '#6366F1' : '#10B981'}
                        />
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.servicePrefSide, { justifyContent: 'flex-end' }]}
                      onPress={() => {
                        setForm((p) => ({
                          ...p,
                          pickupRequired: false,
                          pickupDate: '',
                          pickupTime: '',
                          pickupAddress: '',
                          flatNumber: '',
                          landmark: '',
                        }));
                        fetchWorkshops();
                      }}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.servicePrefLabel,
                          !form.pickupRequired ? { color: '#047857' } : { color: '#6B7280' },
                        ]}
                      >
                        Visit
                      </Text>
                      <View
                        style={[
                          styles.servicePrefIcoBox,
                          !form.pickupRequired
                            ? { backgroundColor: '#10B981' }
                            : { backgroundColor: '#D1D5DB' },
                        ]}
                      >
                        <Ionicons
                          name="location"
                          size={18}
                          color={!form.pickupRequired ? '#FFFFFF' : '#6B7280'}
                        />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                {form.pickupRequired ? (
                  <>
                    {/* Pickup Date Card */}
                    <View style={styles.sectionCard}>
                      <View style={styles.sectionCardHeader}>
                        <View style={[styles.sectionIcoBox, { backgroundColor: '#3B82F6' }]}>
                          <Ionicons name="calendar" size={16} color="#FFFFFF" />
                        </View>
                        <Text style={styles.sectionCardTitle}>Pickup Date</Text>
                        <Text style={styles.requiredStar}>*</Text>
                      </View>
                      <View style={styles.dateQuickRow}>
                        <TouchableOpacity
                          style={[
                            styles.datePill,
                            form.pickupDate === todayStr ? styles.datePillActive : null,
                          ]}
                          onPress={() => setForm((p) => ({ ...p, pickupDate: todayStr }))}
                        >
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.datePillText,
                              form.pickupDate === todayStr ? styles.datePillTextActive : null,
                            ]}
                          >
                            Today, {formatDateDMShort(todayStr)}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.datePill,
                            form.pickupDate === tomorrowStr ? styles.datePillActive : null,
                          ]}
                          onPress={() => setForm((p) => ({ ...p, pickupDate: tomorrowStr }))}
                        >
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.datePillText,
                              form.pickupDate === tomorrowStr ? styles.datePillTextActive : null,
                            ]}
                          >
                            Tomorrow, {formatDateDMShort(tomorrowStr)}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.dateCalendarBtn}
                          onPress={() => setShowDatePicker(true)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="calendar" size={16} color="#FFFFFF" />
                          {form.pickupDate &&
                          form.pickupDate !== todayStr &&
                          form.pickupDate !== tomorrowStr ? (
                            <Text style={styles.dateCalendarBtnText}>
                              {new Date(form.pickupDate + 'T00:00:00').getDate()}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Pickup Time Card */}
                    {form.pickupDate ? (
                      <View style={styles.sectionCard}>
                        <View style={styles.sectionCardHeader}>
                          <View style={[styles.sectionIcoBox, { backgroundColor: '#A855F7' }]}>
                            <Ionicons name="time" size={16} color="#FFFFFF" />
                          </View>
                          <Text style={styles.sectionCardTitle}>Pickup Time</Text>
                          <Text style={styles.requiredStar}>*</Text>
                        </View>
                        <View style={styles.timeSlotsGrid}>
                          {TIME_SLOTS.map((slot) => {
                            const isActive = form.pickupTime === slot.value;
                            return (
                              <TouchableOpacity
                                key={slot.value}
                                style={[
                                  styles.timeSlotTile,
                                  isActive ? styles.timeSlotTileActive : null,
                                ]}
                                onPress={() => setForm((p) => ({ ...p, pickupTime: slot.value }))}
                                activeOpacity={0.9}
                              >
                                <Text
                                  style={[
                                    styles.timeSlotTileText,
                                    isActive ? styles.timeSlotTileTextActive : null,
                                  ]}
                                >
                                  {slot.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        {form.pickupTime ? (
                          <View style={styles.timeSelectedRow}>
                            <Ionicons name="checkmark-circle" size={14} color="#9333EA" />
                            <Text style={styles.timeSelectedText}>
                              Selected:{' '}
                              {TIME_SLOTS.find((s) => s.value === form.pickupTime)?.label}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <View style={styles.fieldHintCard}>
                        <Text style={styles.fieldHintText}>
                          Select a pickup date to choose a time slot.
                        </Text>
                      </View>
                    )}

                    {/* Pickup Address Card */}
                    {form.pickupTime ? (
                      <View style={styles.sectionCard}>
                        <View style={styles.sectionCardHeader}>
                          <View style={[styles.sectionIcoBox, { backgroundColor: '#F97316' }]}>
                            <Ionicons name="home" size={16} color="#FFFFFF" />
                          </View>
                          <Text style={styles.sectionCardTitle}>Pickup Address</Text>
                          <Text style={styles.requiredStar}>*</Text>
                        </View>

                        {savedAddresses.length > 0 ? (
                          <View style={{ marginBottom: 10 }}>
                            <Text style={styles.savedAddrTitle}>Saved Addresses</Text>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              contentContainerStyle={styles.savedAddrRow}
                            >
                              {savedAddresses.map((addr) => {
                                const isActive = selectedSavedAddressId === addr.id;
                                const displayAddr = (() => {
                                  const raw = addr.address_line1 || '';
                                  const parts = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
                                  const seen = new Set<string>();
                                  const unique = parts.filter((p: string) => {
                                    const key = p.toLowerCase();
                                    if (seen.has(key) || /^\d{6}$/.test(p)) return false;
                                    seen.add(key);
                                    return true;
                                  });
                                  return unique.slice(0, 3).join(', ');
                                })();
                                return (
                                  <TouchableOpacity
                                    key={addr.id}
                                    style={[
                                      styles.savedAddrCard,
                                      isActive ? styles.savedAddrCardActive : null,
                                    ]}
                                    onPress={() => selectSavedAddress(addr)}
                                    activeOpacity={0.9}
                                  >
                                    <Text
                                      style={[
                                        styles.savedAddrLine,
                                        isActive ? styles.savedAddrLineActive : null,
                                      ]}
                                      numberOfLines={2}
                                    >
                                      {displayAddr || 'Address'}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                              <TouchableOpacity
                                style={styles.savedAddrCard}
                                onPress={() => {
                                  setSelectedSavedAddressId(null);
                                  setForm((p) => ({
                                    ...p,
                                    pickupAddress: '',
                                    flatNumber: '',
                                    landmark: '',
                                  }));
                                }}
                                activeOpacity={0.9}
                              >
                                <Ionicons
                                  name="add-circle-outline"
                                  size={20}
                                  color={COLORS.primary}
                                />
                                <Text style={styles.savedAddrLabel}>New Address</Text>
                              </TouchableOpacity>
                            </ScrollView>
                          </View>
                        ) : null}

                        <View style={styles.fieldHeader}>
                          <Text style={styles.label}>Pickup address *</Text>
                          <TouchableOpacity
                            onPress={autoDetectAddress}
                            disabled={addressDetecting}
                            style={styles.autoDetectSmall}
                          >
                            {addressDetecting ? (
                              <ActivityIndicator size="small" color={COLORS.primary} />
                            ) : (
                              <Ionicons name="navigate" size={12} color={COLORS.primary} />
                            )}
                            <Text style={styles.autoDetectSmallText}>
                              {addressDetecting ? 'Detecting…' : 'Auto Detect'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <TextInput
                          value={form.pickupAddress}
                          onChangeText={(t) => {
                            setForm((p) => ({ ...p, pickupAddress: t }));
                            setSelectedSavedAddressId(null);
                          }}
                          style={styles.input}
                          placeholder="Area, city, pincode"
                          placeholderTextColor={COLORS.gray[500]}
                          onFocus={(e) => scrollToInput(e.target)}
                        />
                        <View style={[styles.row2, { marginTop: 10 }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Flat / House</Text>
                            <TextInput
                              value={form.flatNumber}
                              onChangeText={(t) => setForm((p) => ({ ...p, flatNumber: t }))}
                              style={styles.input}
                              placeholder="Flat no."
                              placeholderTextColor={COLORS.gray[500]}
                              onFocus={(e) => scrollToInput(e.target)}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Landmark *</Text>
                            <TextInput
                              value={form.landmark}
                              onChangeText={(t) => setForm((p) => ({ ...p, landmark: t }))}
                              style={styles.input}
                              placeholder="Near…"
                              placeholderTextColor={COLORS.gray[500]}
                              onFocus={(e) => scrollToInput(e.target)}
                            />
                          </View>
                        </View>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <>
                    <View style={styles.sectionCard}>
                      <View style={styles.sectionCardHeader}>
                        <View style={[styles.sectionIcoBox, { backgroundColor: '#3B82F6' }]}>
                          <Ionicons name="calendar" size={16} color="#FFFFFF" />
                        </View>
                        <Text style={styles.sectionCardTitle}>Visit Date</Text>
                        <Text style={styles.requiredStar}>*</Text>
                      </View>
                      <View style={styles.dateQuickRow}>
                        <TouchableOpacity
                          style={[styles.datePill, form.pickupDate === todayStr ? styles.datePillActive : null]}
                          onPress={() => setForm((p) => ({ ...p, pickupDate: todayStr }))}
                        >
                          <Text numberOfLines={1} style={[styles.datePillText, form.pickupDate === todayStr ? styles.datePillTextActive : null]}>
                            Today, {formatDateDMShort(todayStr)}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.datePill, form.pickupDate === tomorrowStr ? styles.datePillActive : null]}
                          onPress={() => setForm((p) => ({ ...p, pickupDate: tomorrowStr }))}
                        >
                          <Text numberOfLines={1} style={[styles.datePillText, form.pickupDate === tomorrowStr ? styles.datePillTextActive : null]}>
                            Tomorrow, {formatDateDMShort(tomorrowStr)}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.dateCalendarBtn}
                          onPress={() => setShowDatePicker(true)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="calendar" size={16} color="#FFFFFF" />
                          {form.pickupDate && form.pickupDate !== todayStr && form.pickupDate !== tomorrowStr ? (
                            <Text style={styles.dateCalendarBtnText}>
                              {new Date(form.pickupDate + 'T00:00:00').getDate()}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      </View>
                    </View>

                    {form.pickupDate ? (
                      <View style={styles.sectionCard}>
                        <View style={styles.sectionCardHeader}>
                          <View style={[styles.sectionIcoBox, { backgroundColor: '#A855F7' }]}>
                            <Ionicons name="time" size={16} color="#FFFFFF" />
                          </View>
                          <Text style={styles.sectionCardTitle}>Visit Time</Text>
                          <Text style={styles.requiredStar}>*</Text>
                        </View>
                        <View style={styles.timeSlotsGrid}>
                          {TIME_SLOTS.filter((slot) => slot.value < '13:00').map((slot) => {
                            const isActive = form.pickupTime === slot.value;
                            return (
                              <TouchableOpacity
                                key={slot.value}
                                style={[styles.timeSlotTile, isActive ? styles.timeSlotTileActive : null]}
                                onPress={() => setForm((p) => ({ ...p, pickupTime: slot.value }))}
                                activeOpacity={0.9}
                              >
                                <Text style={[styles.timeSlotTileText, isActive ? styles.timeSlotTileTextActive : null]}>
                                  {slot.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        {form.pickupTime ? (
                          <View style={styles.timeSelectedRow}>
                            <Ionicons name="checkmark-circle" size={14} color="#9333EA" />
                            <Text style={styles.timeSelectedText}>
                              Selected: {TIME_SLOTS.find((s) => s.value === form.pickupTime)?.label}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                )}

                {showDatePicker && Platform.OS === 'android' ? (
                  <DateTimePicker
                    value={form.pickupDate ? new Date(form.pickupDate) : getIndiaDate()}
                    mode="date"
                    display="default"
                    minimumDate={getIndiaDate()}
                    onChange={onDateChange}
                  />
                ) : null}

                {Platform.OS === 'ios' ? (
                  <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
                    <View style={styles.datePickerModalOverlay}>
                      <View style={styles.datePickerModalCard}>
                        <View style={styles.datePickerModalHeader}>
                          <Text style={styles.datePickerModalTitle}>Select Date</Text>
                          <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                            <Text style={styles.datePickerModalDone}>Done</Text>
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={form.pickupDate ? new Date(form.pickupDate) : getIndiaDate()}
                          mode="date"
                          display="spinner"
                          minimumDate={getIndiaDate()}
                          onChange={onDateChange}
                        />
                      </View>
                    </View>
                  </Modal>
                ) : null}
              </>
            ) : null}

            {/* ── Step 4: Payment + Coupon + Summary ── */}
            {step === 4 ? (
              <>
                {/* Pay Later */}
                <TouchableOpacity
                  style={[styles.payRow, form.paymentMethod === 'PAY_LATER' ? styles.payRowActive : null]}
                  onPress={() => setForm((p) => ({ ...p, paymentMethod: 'PAY_LATER' }))}
                  activeOpacity={0.9}
                >
                  <Ionicons
                    name="time"
                    size={18}
                    color={form.paymentMethod === 'PAY_LATER' ? '#fff' : COLORS.primary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.payTitle,
                        form.paymentMethod === 'PAY_LATER' ? styles.payTitleActive : null,
                      ]}
                    >
                      Pay Later (Recommended)
                    </Text>
                    <Text
                      style={[
                        styles.paySub,
                        form.paymentMethod === 'PAY_LATER' ? styles.paySubActive : null,
                      ]}
                    >
                      Pay after inspection / final approval.
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Pay Now */}
                <TouchableOpacity
                  style={[styles.payRow, form.paymentMethod === 'PAY_NOW' ? styles.payRowActive : null]}
                  onPress={() => setForm((p) => ({ ...p, paymentMethod: 'PAY_NOW' }))}
                  activeOpacity={0.9}
                >
                  <Ionicons
                    name="card"
                    size={18}
                    color={form.paymentMethod === 'PAY_NOW' ? '#fff' : COLORS.primary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.payTitle,
                        form.paymentMethod === 'PAY_NOW' ? styles.payTitleActive : null,
                      ]}
                    >
                      Pay Now
                    </Text>
                    <Text
                      style={[
                        styles.paySub,
                        form.paymentMethod === 'PAY_NOW' ? styles.paySubActive : null,
                      ]}
                    >
                      Pay securely via UPI, Card, or Netbanking.
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Coupon */}
                <View style={styles.couponBox}>
                  <Text style={styles.label}>Apply Coupon</Text>

                  {/* Available coupon cards - like saved addresses */}
                  {availableCoupons.length > 0 ? (
                    <View style={{ marginBottom: 10 }}>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                      >
                        {availableCoupons.map((c) => {
                          const isApplied = couponMeta?.code && String(couponMeta.code).toUpperCase() === String(c.code).toUpperCase();
                          return (
                            <TouchableOpacity
                              key={c.id}
                              style={{
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                borderRadius: 12,
                                borderWidth: 1.5,
                                borderColor: isApplied ? '#047857' : '#E2E8F0',
                                backgroundColor: isApplied ? '#ECFDF5' : '#F8FAFC',
                                minWidth: 120,
                              }}
                              activeOpacity={0.85}
                              onPress={() => isApplied ? clearCoupon() : applyCoupon(c.code)}
                              disabled={couponApplying}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="pricetag" size={14} color={isApplied ? '#047857' : COLORS.primary} />
                                <Text style={{ fontSize: 13, fontWeight: '800', color: isApplied ? '#047857' : '#1E293B' }}>{c.code}</Text>
                              </View>
                              <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }} numberOfLines={1}>
                                {describeCoupon(c)}
                              </Text>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: isApplied ? '#047857' : COLORS.primary, marginTop: 4 }}>
                                {isApplied ? '✓ APPLIED' : 'TAP TO APPLY'}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : null}

                  <View style={styles.couponRow}>
                    <TextInput
                      value={couponCode}
                      onChangeText={(t) => setCouponCode(t.toUpperCase())}
                      style={[styles.input, styles.couponInput]}
                      placeholder="Or enter coupon code"
                      placeholderTextColor={COLORS.gray[500]}
                      autoCapitalize="characters"
                      onFocus={(e) => scrollToInput(e.target)}
                    />
                    <TouchableOpacity
                      style={[
                        styles.couponBtn,
                        couponApplying || !couponCode.trim() ? styles.couponBtnDisabled : null,
                      ]}
                      onPress={() => applyCoupon()}
                      disabled={couponApplying || !couponCode.trim()}
                    >
                      <Text style={styles.couponBtnText}>
                        {couponApplying ? 'Applying…' : 'Apply'}
                      </Text>
                    </TouchableOpacity>
                    {couponMeta ? (
                      <TouchableOpacity style={styles.couponRemoveBtn} onPress={clearCoupon}>
                        <Text style={styles.couponRemoveText}>Remove</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {couponError ? <Text style={styles.errorText}>{couponError}</Text> : null}
                  {couponMeta ? (
                    <View style={styles.couponAppliedBanner}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <View style={styles.couponAppliedCheck}>
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.couponAppliedTitle}>{couponMeta.code} applied</Text>
                          {couponDiscount > 0 ? (
                            <Text style={styles.couponAppliedSub}>You saved {inr(couponDiscount)}</Text>
                          ) : null}
                        </View>
                      </View>
                      <TouchableOpacity onPress={clearCoupon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.couponAppliedRemove}>REMOVE</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>

                {/* Summary */}
                <View style={styles.reviewBox}>
                  <Text style={styles.reviewTitle}>Summary</Text>
                  <Text style={styles.reviewLine}>
                    <Text style={styles.reviewLabel}>Location: </Text>
                    {form.city?.name || '—'}
                  </Text>
                  <Text style={styles.reviewLine}>
                    <Text style={styles.reviewLabel}>Vehicle: </Text>
                    {form.carModel ? formatCar(form.carModel) : '—'}
                  </Text>
                  <Text style={styles.reviewLine}>
                    <Text style={styles.reviewLabel}>Services: </Text>
                    {form.selectedServices.length} selected
                  </Text>
                  {form.pickupRequired && form.pickupDate ? (
                    <Text style={styles.reviewLine}>
                      <Text style={styles.reviewLabel}>Pickup: </Text>
                      {formatDateDMY(form.pickupDate)}
                      {form.pickupTime
                        ? ` at ${TIME_SLOTS.find((s) => s.value === form.pickupTime)?.label || form.pickupTime}`
                        : ''}
                    </Text>
                  ) : null}
                  {!form.pickupRequired && form.selectedWorkshop ? (
                    <>
                      <Text style={styles.reviewLine}>
                        <Text style={styles.reviewLabel}>Workshop: </Text>
                        {form.selectedWorkshop.name}
                      </Text>
                      {form.pickupDate ? (
                        <Text style={styles.reviewLine}>
                          <Text style={styles.reviewLabel}>Visit: </Text>
                          {formatDateDMY(form.pickupDate)}
                          {form.pickupTime
                            ? ` at ${TIME_SLOTS.find((s) => s.value === form.pickupTime)?.label || form.pickupTime}`
                            : ''}
                        </Text>
                      ) : null}
                    </>
                  ) : null}
                  <View style={styles.reviewDivider} />
                  <Text style={styles.reviewLine}>
                    <Text style={styles.reviewLabel}>Estimated: </Text>
                    {couponMeta && couponDiscount > 0 ? (
                      <Text style={{ textDecorationLine: 'line-through', color: COLORS.gray[500] }}>
                        {totalPrice ? inr(totalPrice) : '—'}
                      </Text>
                    ) : (
                      <Text>{totalPrice ? inr(totalPrice) : '—'}</Text>
                    )}
                  </Text>
                  {couponMeta ? (
                    <>
                      <Text style={styles.reviewLine}>
                        <Text style={styles.reviewLabel}>Discount ({couponMeta.code}): </Text>
                        <Text style={{ color: '#059669', fontWeight: '800' }}>-{inr(couponDiscount || 0)}</Text>
                      </Text>
                      <View style={styles.payableBar}>
                        <Text style={styles.payableLabel}>Payable</Text>
                        <Text style={styles.payableValue}>{inr(couponAdjustedTotal)}</Text>
                      </View>
                    </>
                  ) : null}
                </View>
              </>
            ) : null}

            {/* Bottom actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.secondaryBtn, step === 0 ? styles.secondaryBtnDisabled : null]}
                onPress={onBack}
                disabled={step === 0}
                activeOpacity={0.9}
              >
                <Ionicons
                  name="arrow-back"
                  size={16}
                  color={step === 0 ? COLORS.gray[400] : COLORS.primary}
                />
                <Text style={[styles.secondaryText, step === 0 ? styles.secondaryTextDisabled : null]}>
                  Back
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={onNext}
                activeOpacity={0.9}
                disabled={loading}
              >
                {(loading || otpLoading) ? <ActivityIndicator color="#fff" /> : null}
                <Text style={styles.primaryText}>
                  {step === 1 && !isLoggedIn && !otpVerified
                    ? (otpSent ? 'Verify OTP' : 'Send OTP')
                    : step === steps.length - 1
                      ? form.paymentMethod === 'PAY_NOW'
                        ? 'Pay & Book'
                        : 'Book Service'
                      : 'Continue'}
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footerPad} />
        </ScrollView>

        <PublicPillNav
          activeTab="services"
          onPressTab={(tab: PublicPillNavTab) => {
            if (tab === 'home') navigation.navigate('PublicHome');
            if (tab === 'services')
              navigation.navigate('PublicServicePackages', { city: form.city?.name || undefined });
            if (tab === 'ai')
              navigation.navigate('AIBooking', { city: form.city?.name || undefined, fullScreen: true });
            if (tab === 'roadside')
              navigation.navigate('RoadsideAssistance', { city: form.city?.name || undefined });
            if (tab === 'account') navigation.navigate('Settings');
            if (tab === 'profile') navigation.navigate('Settings');
            if (tab === 'settings')
              Alert.alert('Support', 'Use AI booking or call support from the home screen.');
          }}
        />

        {/* City modal */}
        <Modal
          visible={cityModal}
          transparent
          animationType="fade"
          onRequestClose={() => setCityModal(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setCityModal(false)}>
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <Text style={styles.modalTitle}>Select City</Text>
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {cities.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.modalRow}
                    onPress={() => {
                      setForm((p) => ({ ...p, city: c }));
                      setCityModal(false);
                    }}
                  >
                    <Text style={styles.modalRowText}>{`${c.name}${c.state ? `, ${c.state}` : ''}`}</Text>
                    <Ionicons
                      name={form.city?.id === c.id ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={form.city?.id === c.id ? COLORS.success : COLORS.gray[400]}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Workshop modal */}
        <Modal
          visible={workshopModal}
          transparent
          animationType="fade"
          onRequestClose={() => setWorkshopModal(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setWorkshopModal(false)}>
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <Text style={styles.modalTitle}>Select Workshop</Text>
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {workshops.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    style={styles.modalRow}
                    onPress={() => {
                      setForm((p) => ({ ...p, selectedWorkshop: w }));
                      setWorkshopModal(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalRowText}>{w.name}</Text>
                      {w.address ? (
                        <Text style={styles.modalSub} numberOfLines={1}>
                          {w.address}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={form.selectedWorkshop?.id === w.id ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={form.selectedWorkshop?.id === w.id ? COLORS.success : COLORS.gray[400]}
                    />
                  </TouchableOpacity>
                ))}
                {workshopLoading ? (
                  <Text style={styles.modalEmpty}>Loading workshops…</Text>
                ) : null}
                {!workshopLoading && !workshops.length ? (
                  <Text style={styles.modalEmpty}>No workshops found for this city.</Text>
                ) : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Service Details / View All Points modal */}
        <Modal
          visible={!!detailsService}
          transparent
          animationType="fade"
          onRequestClose={() => setDetailsService(null)}
        >
          <View style={styles.detailsOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setDetailsService(null)}
            />
            <View style={styles.detailsCard}>
              {detailsService ? (
                <>
                  <View style={styles.detailsHeader}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.detailsTitle} numberOfLines={2}>
                        {detailsService.name}
                      </Text>
                      <View style={styles.detailsMetaRow}>
                        <Text style={styles.detailsMetaText}>Checklist</Text>
                        {Number(servicePoints[detailsService.id] || detailsService.points) > 0 ? (
                          <View style={styles.detailsPtsPill}>
                            <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                            <Text style={styles.detailsPtsPillText}>
                              {servicePoints[detailsService.id] || detailsService.points} pts
                            </Text>
                          </View>
                        ) : null}
                        <View style={styles.detailsOfficialPill}>
                          <Text style={styles.detailsOfficialText}>Official</Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => setDetailsService(null)}
                      style={styles.detailsCloseBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={20} color="#374151" />
                    </TouchableOpacity>
                  </View>

                  {(() => {
                    const categoryId = String(detailsService?.category || selectedCategory || '').toUpperCase();
                    const isPeriodic = categoryId.includes('PERIODIC');
                    const isDenting = categoryId.includes('DENTING') || categoryId.includes('PAINTING');
                    const isDetailing = categoryId.includes('DETAIL');

                    const usps = isPeriodic
                      ? ['Live Photos & Videos Updates', 'Same-Day Servicing', 'Free Pickup & Drop', 'Genuine OEM/OES Parts', 'Detailed Inspection Report', 'Car Delivery At Your Doorstep']
                      : isDenting
                        ? ['Live Photos & Videos Updates', 'Transparent Pricing', 'Free Pickup & Drop', 'Color Matching', 'Premium Finish']
                        : isDetailing
                          ? ['Live Photos & Videos Updates', 'Transparent Pricing', 'Free Pickup & Drop', 'Interior Deep Clean', 'Exterior Polish']
                          : ['Live Photos & Videos Updates', 'Transparent Pricing', 'Free Pickup & Drop', 'Genuine OEM/OES Parts'];

                    const warrantyLabel = isPeriodic
                      ? '1000 kms / 1 Month'
                      : isDenting
                        ? 'Depends on Package'
                        : 'NA';

                    let disclaimer = '';
                    if (isPeriodic) {
                      disclaimer = '* Spare part replacements charged at actual cost. Service packages use company-recommended oil and filters.';
                    } else if (isDenting) {
                      disclaimer = '* Major panel denting will incur additional charges. Rates do not apply to rusted vehicles.';
                    } else if (!isDetailing) {
                      disclaimer = '* This includes only labor charges, If any additional parts are required, they will be billed at actual cost.';
                    }

                    const uspRows: string[][] = [];
                    for (let i = 0; i < usps.length; i += 3) {
                      uspRows.push(usps.slice(i, i + 3));
                    }

                    return (
                      <>
                        {/* Price + Warranty + Proceed (green box) */}
                        <View style={styles.detailsPriceRow}>
                          <View>
                            <Text style={styles.detailsPriceText}>
                              {pricing[detailsService.id] && pricing[detailsService.id] > 0
                                ? `\u20B9${pricing[detailsService.id].toLocaleString('en-IN')}`
                                : '\u2014'}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                              <Ionicons name="shield-checkmark" size={12} color="#16A34A" />
                              <Text style={{ fontSize: 11, fontWeight: '600', color: '#065F46' }}>Warranty: {warrantyLabel}</Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => {
                              const sid = detailsService.id;
                              setForm((p) => ({
                                ...p,
                                selectedServices: Array.from(
                                  new Set([...(p.selectedServices || []), sid])
                                ),
                              }));
                              setDetailsService(null);
                              setTimeout(() => onNext(), 0);
                            }}
                            style={styles.detailsProceedBtn}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.detailsProceedText}>Proceed to Book</Text>
                            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.detailsBodyWrap}>
                          <ScrollView
                            style={styles.detailsBody}
                            contentContainerStyle={styles.detailsBodyContent}
                            showsVerticalScrollIndicator
                            nestedScrollEnabled
                          >
                            {/* What you get (USPs in 3-column rows) */}
                            <View style={{ backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1, borderColor: '#DBEAFE', padding: 12, marginBottom: 16 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>What you get</Text>
                              </View>
                              {uspRows.map((row, rIdx) => (
                                <View key={rIdx} style={{ flexDirection: 'row', gap: 6, marginBottom: rIdx < uspRows.length - 1 ? 6 : 0 }}>
                                  {row.map((usp) => (
                                    <View key={usp} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 20, borderWidth: 1, borderColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 5 }}>
                                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#2563EB' }} />
                                      <Text style={{ fontSize: 10, fontWeight: '600', color: '#374151' }} numberOfLines={1}>{usp}</Text>
                                    </View>
                                  ))}
                                  {row.length < 3 ? Array.from({ length: 3 - row.length }).map((_, i) => <View key={`empty-${i}`} style={{ flex: 1 }} />) : null}
                                </View>
                              ))}
                            </View>

                            {/* Checklist points */}
                            {(() => {
                              const items = serviceChecklists[detailsService.id] || [];
                              if (!items.length) {
                                return (
                                  <Text style={styles.detailsEmpty}>
                                    No checklist available for this service.
                                  </Text>
                                );
                              }
                              const rows: Array<typeof items> = [];
                              for (let i = 0; i < items.length; i += 2) {
                                rows.push(items.slice(i, i + 2));
                              }
                              return (
                                <View style={styles.detailsGrid}>
                                  {rows.map((row, rIdx) => (
                                    <View key={rIdx} style={styles.detailsGridRow}>
                                      {row.map((it, idx) => (
                                        <View key={`${rIdx}-${idx}`} style={styles.detailsGridItem}>
                                          <Ionicons
                                            name="checkmark-circle"
                                            size={16}
                                            color="#16A34A"
                                            style={{ marginTop: 2 }}
                                          />
                                          <Text style={styles.detailsGridItemText}>{it.name}</Text>
                                        </View>
                                      ))}
                                      {row.length === 1 ? (
                                        <View style={styles.detailsGridItem} />
                                      ) : null}
                                    </View>
                                  ))}
                                </View>
                              );
                            })()}

                            {/* Disclaimer */}
                            {disclaimer ? (
                              <Text style={{ marginTop: 12, fontSize: 11, fontStyle: 'italic', color: '#DC2626' }}>{disclaimer}</Text>
                            ) : null}
                          </ScrollView>
                        </View>
                      </>
                    );
                  })()}
                </>
              ) : null}
            </View>
          </View>
        </Modal>

        {/* Booking Success modal */}
        <Modal
          visible={!!bookingSuccess}
          transparent
          animationType="fade"
          onRequestClose={() => undefined}
        >
          <View style={styles.successOverlay}>
            <View style={styles.successCard}>
              <View style={styles.successIconWrap}>
                <View style={styles.successIconRingOuter}>
                  <View style={styles.successIconRingInner}>
                    <Ionicons
                      name={bookingSuccess?.isPaid ? 'checkmark-done' : 'checkmark'}
                      size={44}
                      color="#FFFFFF"
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.successTitle}>
                {bookingSuccess?.title || 'Booking Confirmed!'}
              </Text>

              {bookingSuccess?.leadNumber ? (
                <View style={styles.successLeadPill}>
                  <Ionicons name="receipt-outline" size={13} color="#047857" />
                  <Text style={styles.successLeadText}>
                    Booking ID: {bookingSuccess.leadNumber}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.successMessage}>
                {bookingSuccess?.message ||
                  'Thank you for choosing MyFNG! We will contact you shortly.'}
              </Text>

              <View style={styles.successInfoRow}>
                <View style={styles.successInfoItem}>
                  <View style={[styles.successInfoIco, { backgroundColor: '#DBEAFE' }]}>
                    <Ionicons name="call-outline" size={16} color="#2563EB" />
                  </View>
                  <Text style={styles.successInfoText}>We'll call to confirm</Text>
                </View>
                <View style={styles.successInfoItem}>
                  <View style={[styles.successInfoIco, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="car-outline" size={16} color="#D97706" />
                  </View>
                  <Text style={styles.successInfoText}>Doorstep pickup</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.successPrimaryBtn}
                onPress={() => {
                  setBookingSuccess(null);
                  goStep(0);
                  navigation.navigate('PublicHome');
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="home" size={16} color="#FFFFFF" />
                <Text style={styles.successPrimaryBtnText}>Go to Home</Text>
              </TouchableOpacity>

              {isLoggedIn ? (
                <TouchableOpacity
                  style={styles.successSecondaryBtn}
                  onPress={() => {
                    setBookingSuccess(null);
                    goStep(0);
                    navigation.navigate('Settings', { subPage: 'Order History' });
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.successSecondaryBtnText}>View My Bookings</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </Modal>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.gray[50] },
  screen: { flex: 1, backgroundColor: COLORS.gray[50] },
  container: { paddingBottom: 120 },
  top: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 18, fontWeight: '900', color: COLORS.primaryDark },
  brandLogo: { width: 110, height: 36 },
  loginBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#EEF6FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.16)',
  },
  loginText: { fontSize: FONT_SIZES.xs, fontWeight: '900', color: COLORS.primaryDark },
  loggedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#ECFDF5',
  },
  loggedInText: { fontSize: 11, fontWeight: '800', color: '#059669' },
  h1: { marginTop: 10, fontSize: 28, fontWeight: '900', color: COLORS.primaryDark },
  h2: { marginTop: 6, fontSize: 13, fontWeight: '700', color: COLORS.gray[600] },
  stepper: { marginTop: 12, flexDirection: 'row', gap: 8 },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(17,24,39,0.12)',
  },
  stepDotActive: { backgroundColor: COLORS.primary },
  card: {
    marginTop: SPACING.sm,
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: SPACING.md,
    borderWidth: 0,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: SPACING.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  inputRowText: { flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.primaryDark },

  autoDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.2)',
    backgroundColor: '#EEF6FF',
    marginBottom: 12,
  },
  autoDetectText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },

  notServiceableBanner: { padding: 14, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDBA74', borderRadius: 14, marginBottom: 12 },
  notServiceableTitle: { fontSize: 13, fontWeight: '700', color: '#9A3412' },
  notServiceableSub: { fontSize: 11, fontWeight: '600', color: '#C2410C', marginTop: 4 },

  carSearchWrap: { marginBottom: 12, zIndex: 10 },
  carSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  carSearchInput: { flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.primaryDark },
  carSuggestionList: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#0A2540',
    borderRadius: 12,
    backgroundColor: '#0A2540',
    maxHeight: 240,
  },
  carSuggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  carSuggestionText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  carSuggestionEmpty: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  carHint: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray[500],
    paddingHorizontal: 4,
  },

  savedVehicleSection: {
    marginTop: 12,
  },
  savedVehicleLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 8,
  },
  savedVehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F0F7FF',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    marginBottom: 8,
  },
  savedVehicleImg: {
    width: 72,
    height: 48,
    borderRadius: 8,
  },
  savedVehicleName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  savedVehicleNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 2,
  },
  savedVehicleFuel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  tip: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(139,92,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.14)',
  },
  tipText: { flex: 1, fontSize: 12, fontWeight: '800', color: COLORS.primaryDark },
  field: { marginBottom: 12 },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: { marginBottom: 6, fontSize: 12, fontWeight: '900', color: COLORS.gray[700] },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryDark,
    backgroundColor: '#fff',
  },
  row2: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  tabs: { paddingBottom: 10, gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  tabActive: { backgroundColor: '#EEF6FF', borderColor: 'rgba(0,136,232,0.18)' },
  tabText: { fontSize: 11, fontWeight: '900', color: COLORS.gray[700] },
  tabTextActive: { color: COLORS.primaryDark },
  scopedHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#EEF6FF',
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.18)',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  scopedHintText: { fontSize: 11, fontWeight: '800', color: COLORS.primaryDark },
  scopedHintClear: { marginLeft: 4, fontSize: 11, fontWeight: '900', color: COLORS.primary, textDecorationLine: 'underline' },
  searchRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.primaryDark },
  datePickerModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  datePickerModalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  datePickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  datePickerModalTitle: { fontSize: 15, fontWeight: '900', color: COLORS.primaryDark },
  datePickerModalDone: { fontSize: 15, fontWeight: '900', color: COLORS.primary },
  oilTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  oilTypeLabel: { fontSize: 11, fontWeight: '800', color: COLORS.gray[600] },
  oilTypePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: '#FFFFFF',
  },
  oilTypePillActive: { backgroundColor: COLORS.primary },
  oilTypePillText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  oilTypePillTextActive: { color: '#FFFFFF' },
  loadingBox: { paddingVertical: 18, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 12, fontWeight: '800', color: COLORS.gray[600] },
  serviceList: { marginTop: 10, gap: 10 },
  serviceRow: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    borderRadius: 18,
    padding: 12,
    backgroundColor: '#fff',
  },
  serviceRowActive: { borderColor: 'rgba(0,136,232,0.28)', backgroundColor: '#EEF6FF' },
  serviceName: { fontSize: 13, fontWeight: '900', color: COLORS.primaryDark },
  servicePoints: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  serviceDesc: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray[600],
    lineHeight: 15,
  },
  serviceRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
  servicePrice: { fontSize: 12, fontWeight: '900', color: COLORS.primaryDark },
  totalBar: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#0B1220',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.72)' },
  totalValue: { fontSize: 14, fontWeight: '900', color: '#fff' },
  switchRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  choice: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.18)',
    backgroundColor: '#EEF6FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  choiceActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  choiceText: { fontSize: 12, fontWeight: '900', color: COLORS.primaryDark },
  choiceTextActive: { color: '#fff' },

  autoDetectSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EEF6FF',
  },
  autoDetectSmallText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },

  savedAddrSection: { marginBottom: 12 },
  savedAddrTitle: { fontSize: 12, fontWeight: '900', color: COLORS.gray[700], marginBottom: 8 },
  savedAddrRow: { gap: 8 },
  savedAddrCard: {
    width: 140,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
    backgroundColor: '#fff',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedAddrCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#EEF6FF',
  },
  savedAddrLabel: { fontSize: 11, fontWeight: '900', color: COLORS.primaryDark },
  savedAddrLabelActive: { color: COLORS.primary },
  savedAddrLine: { fontSize: 10, fontWeight: '700', color: COLORS.gray[600], textAlign: 'center' },
  savedAddrLineActive: { color: COLORS.primaryDark },

  dateQuickRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  dateQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    backgroundColor: '#fff',
  },
  dateQuickBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#EEF6FF',
  },
  dateQuickBtnText: { fontSize: 12, fontWeight: '800', color: COLORS.primaryDark },
  dateQuickBtnTextActive: { color: COLORS.primary },
  dateSelectedText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },

  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
  },
  timeSlotBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    backgroundColor: '#fff',
  },
  timeSlotBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  timeSlotText: { fontSize: 11, fontWeight: '800', color: COLORS.primaryDark },
  timeSlotTextActive: { color: '#fff' },

  fieldHint: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  fieldHintText: { fontSize: 12, fontWeight: '700', color: COLORS.gray[500] },

  payRow: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
    backgroundColor: '#EEF6FF',
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  payRowActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  payTitle: { fontSize: 13, fontWeight: '900', color: COLORS.primaryDark },
  payTitleActive: { color: '#fff' },
  paySub: { marginTop: 2, fontSize: 11, fontWeight: '700', color: COLORS.gray[600] },
  paySubActive: { color: 'rgba(255,255,255,0.8)' },
  couponBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    backgroundColor: '#fff',
  },
  couponRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  couponInput: { flex: 1 },
  availCouponWrap: { marginTop: 12, gap: 8 },
  availCouponHeading: { fontSize: 12, fontWeight: '900', color: COLORS.gray[600], marginBottom: 2 },
  availCouponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    backgroundColor: '#F8FAFF',
  },
  availCouponCardActive: { borderStyle: 'solid', borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  availCouponLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  availCouponCode: { fontSize: 13, fontWeight: '900', color: COLORS.primaryDark },
  availCouponDesc: { fontSize: 11, fontWeight: '700', color: COLORS.gray[600], marginTop: 1 },
  availCouponAction: { fontSize: 12, fontWeight: '900', color: COLORS.primary },
  availCouponActionActive: { color: '#047857' },
  couponBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  couponBtnDisabled: { backgroundColor: COLORS.gray[300] },
  couponBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  couponRemoveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    backgroundColor: '#fff',
  },
  couponRemoveText: { fontSize: 12, fontWeight: '900', color: COLORS.gray[700] },
  errorText: { marginTop: 6, fontSize: 11, fontWeight: '700', color: '#DC2626' },
  successText: { marginTop: 6, fontSize: 11, fontWeight: '800', color: '#059669' },
  couponAppliedBanner: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  couponAppliedCheck: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#059669',
    alignItems: 'center', justifyContent: 'center',
  },
  couponAppliedTitle: { fontSize: 13, fontWeight: '800', color: '#047857' },
  couponAppliedSub: { fontSize: 11, fontWeight: '700', color: '#059669', marginTop: 1 },
  couponAppliedRemove: { fontSize: 11, fontWeight: '900', color: '#DC2626', letterSpacing: 0.5 },
  payableBar: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  payableLabel: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  payableValue: { fontSize: 18, fontWeight: '900', color: COLORS.primary },
  reviewBox: {
    marginTop: 6,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    backgroundColor: '#fff',
  },
  reviewTitle: { fontSize: 13, fontWeight: '900', color: COLORS.primaryDark },
  reviewLine: { marginTop: 6, fontSize: 12, fontWeight: '800', color: COLORS.gray[700] },
  reviewLabel: { fontWeight: '900', color: COLORS.gray[500] },
  reviewDivider: {
    height: 1,
    backgroundColor: 'rgba(17,24,39,0.06)',
    marginTop: 8,
    marginBottom: 2,
  },
  actions: { marginTop: SPACING.md, flexDirection: 'row', gap: 12 },
  secondaryBtn: {
    width: 110,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: '#EEF6FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: 'rgba(17,24,39,0.06)',
  },
  secondaryText: { fontWeight: '900', color: COLORS.primary, fontSize: 12 },
  secondaryTextDisabled: { color: COLORS.gray[400] },
  primaryBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  footerPad: { height: 40 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: COLORS.primaryDark, marginBottom: 10 },
  modalRow: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.06)',
    gap: 10,
  },
  modalRowText: { flex: 1, fontSize: 13, fontWeight: '900', color: COLORS.primaryDark },
  modalSub: { marginTop: 3, fontSize: 11, fontWeight: '700', color: COLORS.gray[600] },
  modalEmpty: { paddingVertical: 14, fontSize: 12, fontWeight: '800', color: COLORS.gray[600] },

  // Step 2 — plan card with checklist preview
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 12,
  },
  planCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0F7FF',
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planCardItems: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(17,24,39,0.06)',
    gap: 6,
  },
  planCardItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  planCardItemText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#374151',
    lineHeight: 17,
  },
  planViewAllBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  planViewAllText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.primary,
  },

  // Step 3 — flat section (matches Cart page clean UI)
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0,
    borderColor: 'transparent',
    paddingHorizontal: 0,
    paddingTop: 14,
    paddingBottom: 16,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIcoBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  requiredStar: {
    fontSize: 18,
    fontWeight: '900',
    color: '#EF4444',
    marginLeft: 2,
  },

  // Service Preference toggle
  servicePrefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  servicePrefSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  servicePrefIcoBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servicePrefLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  servicePrefToggle: {
    width: 64,
    height: 36,
    borderRadius: 999,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  servicePrefKnob: {
    position: 'absolute',
    top: 3,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  // Date pills (Step 3) — matched to Cart page styling
  datePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  datePillActive: {
    borderColor: '#1D4ED8',
    backgroundColor: '#EFF6FF',
  },
  datePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  datePillTextActive: {
    color: '#1D4ED8',
  },
  dateCalendarBtn: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: '#1D4ED8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dateCalendarBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },

  // Time slot tiles (Step 3) — matched to Cart page styling
  timeSlotTile: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSlotTileActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#7C3AED',
  },
  timeSlotTileText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  timeSlotTileTextActive: {
    color: '#7C3AED',
  },
  timeSelectedRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeSelectedText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#9333EA',
  },
  fieldHintCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
  },

  // Service Details / View All Points modal
  detailsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 40,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  detailsHeader: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  detailsMetaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailsMetaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  detailsPtsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  detailsPtsPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#374151',
  },
  detailsOfficialPill: {
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  detailsOfficialText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  detailsCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsPriceRow: {
    marginHorizontal: 18,
    marginTop: 14,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailsPriceText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  detailsProceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: '#16A34A',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  detailsProceedText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  detailsBodyWrap: {
    height: Math.min(520, Dimensions.get('window').height * 0.55),
  },
  detailsBody: {
    flex: 1,
  },
  detailsBodyContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 22,
  },
  detailsEmpty: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  detailsGrid: {
    flexDirection: 'column',
  },
  detailsGridRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  detailsGridItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  detailsGridItemText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 17,
  },

  // Booking Success modal
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  successCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  successIconWrap: {
    marginBottom: 18,
  },
  successIconRingOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconRingInner: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
  },
  successLeadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  successLeadText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#047857',
  },
  successMessage: {
    fontSize: 13.5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  successInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
    marginBottom: 18,
  },
  successInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  successInfoIco: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successInfoText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  successPrimaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  successPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  successSecondaryBtn: {
    marginTop: 10,
    paddingVertical: 10,
  },
  successSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
});
