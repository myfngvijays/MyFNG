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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { ENV } from '../config/environment';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicBottomNav';
import { getCustomerSessionToken } from '../lib/customerSession';
import { apiFetch } from '../lib/api';

type Props = { navigation: any };

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

export default function PublicBookServiceNowScreen({ navigation }: Props) {
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

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

  const [carQuery, setCarQuery] = useState('');
  const [carSuggestions, setCarSuggestions] = useState<CarModelRow[]>([]);
  const [showCarSuggestions, setShowCarSuggestions] = useState(false);

  const [serviceTypes, setServiceTypes] = useState<ServiceTypeRow[]>([]);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [pricing, setPricing] = useState<Record<string, number>>({});
  const [pricingLoading, setPricingLoading] = useState(false);
  const [servicePoints, setServicePoints] = useState<Record<string, number>>({});

  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMeta, setCouponMeta] = useState<any | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponApplying, setCouponApplying] = useState(false);

  const [workshops, setWorkshops] = useState<WorkshopRow[]>([]);
  const [workshopLoading, setWorkshopLoading] = useState(false);
  const [workshopModal, setWorkshopModal] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);
  const [addressDetecting, setAddressDetecting] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of serviceTypes) {
      if (s.category) set.add(s.category);
    }
    const arr = Array.from(set);
    arr.sort((a, b) => a.localeCompare(b));
    return arr.length ? arr : [];
  }, [serviceTypes]);

  const servicesInCategory = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    return serviceTypes
      .filter((s) => s.category === selectedCategory)
      .filter((s) => (q ? s.name.toLowerCase().includes(q) : true));
  }, [serviceTypes, selectedCategory, serviceSearch]);

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

  useEffect(() => {
    if (couponMeta && form.selectedServices.length > 0) {
      setCouponMeta(null);
      setCouponDiscount(0);
      setCouponError('Coupon cleared. Please re-apply after changing services.');
    }
  }, [form.selectedServices, couponMeta]);

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
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationDetecting(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&zoom=10&addressdetails=1`,
        { headers: { 'User-Agent': 'MyFNG-App/1.0' } }
      );
      if (response.ok) {
        const data = await response.json();
        const addr = data?.address || {};
        const detectedCity = addr.city || addr.town || addr.village || addr.county || '';
        if (detectedCity) {
          const normalised = detectedCity.toLowerCase();
          const match = list.find(
            (c) =>
              c.name.toLowerCase() === normalised ||
              c.name.toLowerCase().includes(normalised) ||
              normalised.includes(c.name.toLowerCase())
          );
          if (match) {
            setForm((p) => ({ ...p, city: match }));
          }
        }
      }
    } catch {
      // silently ignore
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
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
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
      const { data, error } = await supabase
        .from('car_models')
        .select('id,make,model_name,variant,class')
        .eq('is_active', true)
        .or(`make.ilike.%${safe}%,model_name.ilike.%${safe}%`)
        .order('make')
        .order('model_name')
        .limit(10);
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
            .select('service_type_id, points')
            .in('service_type_id', ids);
          if (tplRows) {
            const pts: Record<string, number> = {};
            (tplRows as any[]).forEach((r: any) => {
              if (r.service_type_id && typeof r.points === 'number') {
                pts[r.service_type_id] = r.points;
              }
            });
            setServicePoints(pts);
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

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code) {
      setCouponError('Please enter a coupon code.');
      return;
    }
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
        address_line1: a.address_line1 || a.address || null,
        address_line2: a.address_line2 || null,
        city: a.city || null,
        state: a.state || null,
        pincode: a.pincode || null,
        landmark: a.landmark || null,
        address_type: a.address_type || null,
      }));
      setSavedAddresses(addresses);
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
    if (!form.pickupRequired && !form.selectedWorkshop) {
      Alert.alert('Select workshop', 'Please select a workshop for visit.');
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
              form.pickupRequired && form.pickupDate && form.pickupTime
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
                Alert.alert(
                  'Payment Successful',
                  `Your booking ${json?.lead?.lead_number || leadNumber} has been created and payment received.\n\nWe will contact you shortly.`
                );
              } catch (payErr: any) {
                const cancelled =
                  payErr?.code === 'PAYMENT_CANCELLED' ||
                  payErr?.description?.includes('cancelled');
                Alert.alert(
                  cancelled ? 'Payment Cancelled' : 'Payment Failed',
                  `Your booking has been created (${json?.lead?.lead_number || leadNumber}). ${
                    cancelled
                      ? 'You can pay later.'
                      : 'Payment could not be processed. You can pay later.'
                  }`
                );
              }
            } else {
              Alert.alert(
                'Booking Created',
                `Lead: ${json?.lead?.lead_number || leadNumber}\n\nPayment module not available. You can pay later from your bookings.`
              );
            }
          } else {
            Alert.alert(
              'Booking Created',
              `Lead: ${json?.lead?.lead_number || leadNumber}\n\nPayment could not be initiated. You can pay later.`
            );
          }
        } catch {
          Alert.alert(
            'Booking Created',
            `Lead: ${json?.lead?.lead_number || leadNumber}\n\nPayment gateway unavailable. You can pay later.`
          );
        }
      } else {
        Alert.alert(
          'Booking Created',
          `Lead: ${json?.lead?.lead_number || leadNumber}\n\nWe will contact you shortly.`
        );
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
      goStep(0);
    } catch {
      Alert.alert('Failed', 'Could not create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Effects ─────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const cityList = await fetchCities();
      autoDetectLocation(cityList);
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
      if (!selectedCategory || !categories.includes(selectedCategory)) {
        setSelectedCategory(categories[0] || '');
      }
      fetchPricing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceTypes.length, step, form.city?.id, form.carModel?.id]);

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
    if (step === 1) return Boolean(form.customerPhone.trim().length >= 10);
    if (step === 2) return form.selectedServices.length > 0;
    if (step === 3) {
      if (form.pickupRequired) return Boolean(form.pickupAddress.trim() && form.landmark.trim());
      return Boolean(form.selectedWorkshop);
    }
    return true;
  };

  const onNext = () => {
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
    const line1 = addr.address_line1 || '';
    const cityState = [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
    setForm((p) => ({
      ...p,
      pickupAddress: [line1, cityState].filter(Boolean).join(', '),
      flatNumber: addr.address_line2 || '',
      landmark: addr.landmark || '',
    }));
  };

  const todayStr = formatDateYMD(getIndiaDate());
  const tomorrowDate = new Date(getIndiaDate());
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = formatDateYMD(tomorrowDate);

  // ── Render ──────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Top header */}
          <View style={styles.top}>
            <View style={styles.topRow}>
              <Text style={styles.brand}>MY FNG</Text>
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
                    <View style={styles.carSuggestionList}>
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
                    </View>
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
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Phone *</Text>
                  <TextInput
                    value={form.customerPhone}
                    onChangeText={(t) =>
                      setForm((p) => ({ ...p, customerPhone: t.replace(/\D/g, '').slice(0, 10) }))
                    }
                    style={styles.input}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={COLORS.gray[500]}
                    keyboardType="phone-pad"
                  />
                </View>
              </>
            ) : null}

            {/* ── Step 2: Services ── */}
            {step === 2 ? (
              <>
                {categories.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabs}
                  >
                    {categories.map((c) => (
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
                      return (
                        <TouchableOpacity
                          key={s.id}
                          style={[styles.serviceRow, selected ? styles.serviceRowActive : null]}
                          onPress={() => handleServiceToggle(s.id)}
                          activeOpacity={0.9}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.serviceName}>{s.name}</Text>
                            {pts > 0 ? (
                              <Text style={styles.servicePoints}>{pts} Points</Text>
                            ) : null}
                            {s.description ? (
                              <Text style={styles.serviceDesc} numberOfLines={2}>
                                {s.description}
                              </Text>
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
                <View style={styles.switchRow}>
                  <TouchableOpacity
                    style={[styles.choice, form.pickupRequired ? styles.choiceActive : null]}
                    onPress={() => setForm((p) => ({ ...p, pickupRequired: true }))}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="car" size={16} color={form.pickupRequired ? '#fff' : COLORS.primary} />
                    <Text
                      style={[styles.choiceText, form.pickupRequired ? styles.choiceTextActive : null]}
                    >
                      Pickup
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.choice, !form.pickupRequired ? styles.choiceActive : null]}
                    onPress={() => {
                      setForm((p) => ({ ...p, pickupRequired: false }));
                      fetchWorkshops();
                    }}
                    activeOpacity={0.9}
                  >
                    <Ionicons
                      name="navigate"
                      size={16}
                      color={!form.pickupRequired ? '#fff' : COLORS.primary}
                    />
                    <Text
                      style={[styles.choiceText, !form.pickupRequired ? styles.choiceTextActive : null]}
                    >
                      Visit
                    </Text>
                  </TouchableOpacity>
                </View>

                {form.pickupRequired ? (
                  <>
                    {/* Saved address selection */}
                    {isLoggedIn && savedAddresses.length > 0 ? (
                      <View style={styles.savedAddrSection}>
                        <Text style={styles.savedAddrTitle}>Saved Addresses</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.savedAddrRow}
                        >
                          {savedAddresses.map((addr) => {
                            const isActive = selectedSavedAddressId === addr.id;
                            return (
                              <TouchableOpacity
                                key={addr.id}
                                style={[styles.savedAddrCard, isActive ? styles.savedAddrCardActive : null]}
                                onPress={() => selectSavedAddress(addr)}
                                activeOpacity={0.9}
                              >
                                <Text style={[styles.savedAddrLabel, isActive ? styles.savedAddrLabelActive : null]}>
                                  {addr.address_type || addr.label || 'Address'}
                                </Text>
                                <Text
                                  style={[styles.savedAddrLine, isActive ? styles.savedAddrLineActive : null]}
                                  numberOfLines={2}
                                >
                                  {addr.address_line1 || ''}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                          <TouchableOpacity
                            style={styles.savedAddrCard}
                            onPress={() => {
                              setSelectedSavedAddressId(null);
                              setForm((p) => ({ ...p, pickupAddress: '', flatNumber: '', landmark: '' }));
                            }}
                            activeOpacity={0.9}
                          >
                            <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                            <Text style={styles.savedAddrLabel}>New Address</Text>
                          </TouchableOpacity>
                        </ScrollView>
                      </View>
                    ) : null}

                    {/* Pickup address */}
                    <View style={styles.field}>
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
                      />
                    </View>

                    <View style={styles.row2}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Flat / House (optional)</Text>
                        <TextInput
                          value={form.flatNumber}
                          onChangeText={(t) => setForm((p) => ({ ...p, flatNumber: t }))}
                          style={styles.input}
                          placeholder="Flat no."
                          placeholderTextColor={COLORS.gray[500]}
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
                        />
                      </View>
                    </View>

                    {/* Date picker */}
                    <View style={styles.field}>
                      <Text style={styles.label}>Pickup Date *</Text>
                      <View style={styles.dateQuickRow}>
                        <TouchableOpacity
                          style={[styles.dateQuickBtn, form.pickupDate === todayStr ? styles.dateQuickBtnActive : null]}
                          onPress={() => setForm((p) => ({ ...p, pickupDate: todayStr }))}
                        >
                          <Text
                            style={[
                              styles.dateQuickBtnText,
                              form.pickupDate === todayStr ? styles.dateQuickBtnTextActive : null,
                            ]}
                          >
                            Today
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.dateQuickBtn,
                            form.pickupDate === tomorrowStr ? styles.dateQuickBtnActive : null,
                          ]}
                          onPress={() => setForm((p) => ({ ...p, pickupDate: tomorrowStr }))}
                        >
                          <Text
                            style={[
                              styles.dateQuickBtnText,
                              form.pickupDate === tomorrowStr ? styles.dateQuickBtnTextActive : null,
                            ]}
                          >
                            Tomorrow
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.dateQuickBtn}
                          onPress={() => setShowDatePicker(true)}
                        >
                          <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                          <Text style={styles.dateQuickBtnText}>Pick Date</Text>
                        </TouchableOpacity>
                      </View>
                      {form.pickupDate ? (
                        <Text style={styles.dateSelectedText}>
                          Selected: {formatDateDMY(form.pickupDate)}
                        </Text>
                      ) : null}
                      {showDatePicker ? (
                        <DateTimePicker
                          value={form.pickupDate ? new Date(form.pickupDate) : getIndiaDate()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          minimumDate={getIndiaDate()}
                          onChange={onDateChange}
                        />
                      ) : null}
                    </View>

                    {/* Time slots */}
                    {form.pickupDate ? (
                      <View style={styles.field}>
                        <Text style={styles.label}>Pickup Time *</Text>
                        <View style={styles.timeSlotsGrid}>
                          {TIME_SLOTS.map((slot) => {
                            const isActive = form.pickupTime === slot.value;
                            return (
                              <TouchableOpacity
                                key={slot.value}
                                style={[styles.timeSlotBtn, isActive ? styles.timeSlotBtnActive : null]}
                                onPress={() => setForm((p) => ({ ...p, pickupTime: slot.value }))}
                                activeOpacity={0.9}
                              >
                                <Text
                                  style={[
                                    styles.timeSlotText,
                                    isActive ? styles.timeSlotTextActive : null,
                                  ]}
                                >
                                  {slot.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ) : (
                      <View style={styles.fieldHint}>
                        <Text style={styles.fieldHintText}>Select a date to choose time slot</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.inputRow}
                      onPress={() => setWorkshopModal(true)}
                      activeOpacity={0.9}
                    >
                      <Ionicons name="business" size={16} color={COLORS.primary} />
                      <Text style={styles.inputRowText}>
                        {form.selectedWorkshop
                          ? form.selectedWorkshop.name
                          : workshopLoading
                          ? 'Loading workshops…'
                          : 'Select workshop'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={COLORS.gray[500]} />
                    </TouchableOpacity>
                  </>
                )}
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
                  <View style={styles.couponRow}>
                    <TextInput
                      value={couponCode}
                      onChangeText={(t) => setCouponCode(t.toUpperCase())}
                      style={[styles.input, styles.couponInput]}
                      placeholder="Coupon code"
                      placeholderTextColor={COLORS.gray[500]}
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity
                      style={[
                        styles.couponBtn,
                        couponApplying || !couponCode.trim() ? styles.couponBtnDisabled : null,
                      ]}
                      onPress={applyCoupon}
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
                    <Text style={styles.successText}>Coupon applied: {couponMeta.code}</Text>
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
                    <Text style={styles.reviewLine}>
                      <Text style={styles.reviewLabel}>Workshop: </Text>
                      {form.selectedWorkshop.name}
                    </Text>
                  ) : null}
                  <View style={styles.reviewDivider} />
                  <Text style={styles.reviewLine}>
                    <Text style={styles.reviewLabel}>Estimated: </Text>
                    {totalPrice ? inr(totalPrice) : '—'}
                  </Text>
                  {couponMeta ? (
                    <>
                      <Text style={styles.reviewLine}>
                        <Text style={styles.reviewLabel}>Discount: </Text>
                        <Text style={{ color: '#059669' }}>-{inr(couponDiscount || 0)}</Text>
                      </Text>
                      <Text style={[styles.reviewLine, { fontWeight: '900' }]}>
                        <Text style={styles.reviewLabel}>Payable: </Text>
                        {inr(couponAdjustedTotal)}
                      </Text>
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
                {loading ? <ActivityIndicator color="#fff" /> : null}
                <Text style={styles.primaryText}>
                  {step === steps.length - 1
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
              navigation.navigate('AIBooking', { city: form.city?.name || undefined });
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
      </View>
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
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    shadowColor: '#0B1F44',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primaryDark,
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
    borderColor: COLORS.gray[200],
    borderRadius: 12,
    backgroundColor: '#fff',
    maxHeight: 200,
    overflow: 'hidden',
  },
  carSuggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.04)',
  },
  carSuggestionText: { fontSize: 13, fontWeight: '800', color: COLORS.primaryDark },
  carSuggestionEmpty: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gray[500],
  },
  carHint: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray[500],
    paddingHorizontal: 4,
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

  dateQuickRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
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

  timeSlotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
});
