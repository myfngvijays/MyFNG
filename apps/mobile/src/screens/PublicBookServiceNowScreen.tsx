import React, { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { ENV } from '../config/environment';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicPillNav';

type Props = { navigation: any };

type CityRow = { id: string; name: string; state?: string | null; zone_id?: string | null };
type CarModelRow = { id: string; make: string; model_name: string; variant?: string | null; class?: string | null };
type ServiceTypeRow = { id: string; name: string; description?: string | null };
type WorkshopRow = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
};

type BookingFormData = {
  city: CityRow | null;
  carModel: CarModelRow | null;
  customerName: string;
  customerPhone: string;
  vehicleNumber: string;
  selectedServices: string[];
  pickupRequired: boolean;
  selectedWorkshop: WorkshopRow | null;
  pickupDate: string; // YYYY-MM-DD
  pickupTime: string; // HH:mm
  pickupAddress: string; // free text (area/city/pincode)
  flatNumber: string;
  landmark: string;
  paymentMethod: 'PAY_LATER' | 'UPI' | 'CARD' | 'CASH';
};

function formatCar(m: CarModelRow) {
  const v = m.variant ? ` ${m.variant}` : '';
  return `${m.make} ${m.model_name}${v}`.trim();
}

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function getServiceCategory(serviceName: string): string {
  const name = (serviceName || '').toLowerCase().trim();
  const hasBrake = name.includes('brake') || name.includes('braking');
  const hasClutch = name.includes('clutch');
  const hasAC = /\bac\b/i.test(serviceName) || name.includes('air conditioning') || name.includes('air conditioner');
  const hasBattery = name.includes('battery') || name.includes('jump start');
  const hasEngine = name.includes('engine') || name.includes('motor');
  const hasTyreWheel = name.includes('tire') || name.includes('tyre') || name.includes('wheel');
  const hasPaint = name.includes('paint') || name.includes('denting');
  const hasCleaning = name.includes('cleaning') || name.includes('wash') || name.includes('detailing');

  if (!hasAC && !hasBrake && !hasClutch && !hasBattery && !hasEngine) {
    if (
      name.includes('basic service') ||
      name.includes('general service') ||
      name.includes('premium service') ||
      name.includes('platinum service') ||
      name.includes('periodic service') ||
      /\d+\s*points?/i.test(serviceName) ||
      (name.includes('service') && (name.includes('point') || /\d+/.test(serviceName)))
    ) {
      return 'PERIODIC SERVICE';
    }
  }
  if (hasAC && !hasBrake && !hasClutch && !hasBattery) return 'AC SERVICE';
  if (hasBattery && !hasAC) return 'BATTERY SERVICE';
  if (hasBrake) return 'BRAKE SERVICE';
  if (hasClutch) return 'CLUTCH SERVICE';
  if (hasPaint) return 'DENTING PAINTING';
  if (hasTyreWheel) return 'TYRE & WHEEL CARE';
  if (hasCleaning) return 'DETAILING SERVICE';
  if (hasEngine) return 'ENGINE SERVICE';
  return 'OTHER SERVICES';
}

export default function PublicBookServiceNowScreen({ navigation }: Props) {
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const [form, setForm] = useState<BookingFormData>({
    city: null,
    carModel: null,
    customerName: '',
    customerPhone: '',
    vehicleNumber: '',
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

  const [carQuery, setCarQuery] = useState('');
  const [carSuggestions, setCarSuggestions] = useState<CarModelRow[]>([]);
  const [carModal, setCarModal] = useState(false);

  const [serviceTypes, setServiceTypes] = useState<ServiceTypeRow[]>([]);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('PERIODIC SERVICE');
  const [pricing, setPricing] = useState<Record<string, number>>({});
  const [pricingLoading, setPricingLoading] = useState(false);

  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMeta, setCouponMeta] = useState<any | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponApplying, setCouponApplying] = useState(false);

  const [workshops, setWorkshops] = useState<WorkshopRow[]>([]);
  const [workshopLoading, setWorkshopLoading] = useState(false);
  const [workshopModal, setWorkshopModal] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of serviceTypes) set.add(getServiceCategory(s.name));
    const arr = Array.from(set);
    const order = [
      'PERIODIC SERVICE',
      'AC SERVICE',
      'BATTERY SERVICE',
      'BRAKE SERVICE',
      'CLUTCH SERVICE',
      'DENTING PAINTING',
      'TYRE & WHEEL CARE',
      'DETAILING SERVICE',
      'ENGINE SERVICE',
      'OTHER SERVICES',
    ];
    arr.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return arr.length ? arr : order;
  }, [serviceTypes]);

  const servicesInCategory = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    return serviceTypes
      .filter((s) => getServiceCategory(s.name) === selectedCategory)
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

  async function fetchCities() {
    try {
      const { data, error } = await supabase.from('cities').select('id,name,state,zone_id,is_active').eq('is_active', true).order('name');
      if (error) throw error;
      setCities((data as any[]) || []);
    } catch {
      setCities([
        { id: '1', name: 'Mumbai', state: 'Maharashtra' },
        { id: '2', name: 'Pune', state: 'Maharashtra' },
        { id: '3', name: 'Bangalore', state: 'Karnataka' },
        { id: '4', name: 'Delhi', state: 'Delhi' },
      ]);
    }
  }

  async function searchCarModels(q: string) {
    const query = q.trim();
    if (query.length < 2) {
      setCarSuggestions([]);
      return;
    }
    try {
      const safe = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      // OR filter via PostgREST: `or` expects a string like "make.ilike.%tata%,model_name.ilike.%tigor%"
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
      const { data, error } = await supabase
        .from('service_types')
        .select('id,name,description,is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setServiceTypes(((data as any[]) || []) as any);
    } catch {
      setServiceTypes([]);
    } finally {
      setServiceLoading(false);
    }
  }

  async function fetchPriceForService(serviceTypeId: string, cityId: string, zoneId: string | null, vehicleClass: string | null) {
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

    // City + Class
    if (cityId && vehicleClass) {
      const p = await tryPrice({ city_id: cityId, class: vehicleClass });
      if (p) return p;
    }
    // City only
    if (cityId) {
      const p = await tryPrice({ city_id: cityId, class: null });
      if (p) return p;
    }
    // Zone + Class
    if (zoneId && vehicleClass) {
      const p = await tryPrice({ zone_id: zoneId, class: vehicleClass });
      if (p) return p;
    }
    // Zone only
    if (zoneId) {
      const p = await tryPrice({ zone_id: zoneId, class: null });
      if (p) return p;
    }
    // Class only
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
      // price only for visible subset (current category) for speed
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

  async function submitLead() {
    if (!form.city || !form.carModel) return;
    if (!form.customerPhone.trim()) {
      Alert.alert('Phone required', 'Please enter your phone number.');
      return;
    }
    if (!form.pickupRequired && !form.selectedWorkshop) {
      Alert.alert('Select workshop', 'Please select a workshop for self drop.');
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
            vehicle_number: form.vehicleNumber || null,
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

      Alert.alert('Booking created', `Lead: ${json?.lead?.lead_number || leadNumber}\n\nWe will contact you shortly.`);
      // Reset to step 0 for now
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

  useEffect(() => {
    fetchCities();
  }, []);

  useEffect(() => {
    // When city toggles pickup/self drop
    if (form.city && !form.pickupRequired) {
      fetchWorkshops();
    } else {
      setWorkshops([]);
      setForm((p) => ({ ...p, selectedWorkshop: null }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.city?.id, form.pickupRequired]);

  useEffect(() => {
    // Load services when step 2 reached (like web step3)
    if (step === 2 && form.city && form.carModel) {
      fetchServiceTypes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.city?.id, form.carModel?.id]);

  useEffect(() => {
    if (step === 2 && form.city && form.carModel && serviceTypes.length > 0) {
      if (!categories.includes(selectedCategory)) setSelectedCategory(categories[0] || 'PERIODIC SERVICE');
      fetchPricing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceTypes.length, step, form.city?.id, form.carModel?.id]);

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

  const toggleService = (id: string) => {
    setForm((p) => {
      const has = p.selectedServices.includes(id);
      return { ...p, selectedServices: has ? p.selectedServices.filter((x) => x !== id) : [...p.selectedServices, id] };
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Top header */}
          <View style={styles.top}>
            <View style={styles.topRow}>
              <Text style={styles.brand}>MY FNG</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginBtn}>
                <Text style={styles.loginText}>Login</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.h1}>Book Service Now</Text>
            <Text style={styles.h2}>{steps[step].subtitle}</Text>

            {/* Stepper */}
            <View style={styles.stepper}>
              {steps.map((_, i) => (
                <View key={i} style={[styles.stepDot, i <= step ? styles.stepDotActive : null]} />
              ))}
            </View>
          </View>

          {/* Step cards */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{steps[step].title}</Text>

            {step === 0 ? (
              <>
                <TouchableOpacity style={styles.inputRow} onPress={() => setCityModal(true)} activeOpacity={0.9}>
                  <Ionicons name="location" size={16} color={COLORS.primary} />
                  <Text style={styles.inputRowText}>{form.city ? `${form.city.name}${form.city.state ? `, ${form.city.state}` : ''}` : 'Select city'}</Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.gray[500]} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.inputRow} onPress={() => setCarModal(true)} activeOpacity={0.9}>
                  <Ionicons name="car-sport" size={16} color={COLORS.primary} />
                  <Text style={styles.inputRowText}>{form.carModel ? formatCar(form.carModel) : 'Select car model'}</Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.gray[500]} />
                </TouchableOpacity>

                <View style={styles.tip}>
                  <Ionicons name="sparkles" size={16} color={COLORS.purple} />
                  <Text style={styles.tipText}>Book Your Service Under 60 Seconds</Text>
                </View>
              </>
            ) : null}

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
                    onChangeText={(t) => setForm((p) => ({ ...p, customerPhone: t.replace(/\D/g, '').slice(0, 10) }))}
                    style={styles.input}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={COLORS.gray[500]}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Vehicle number (optional)</Text>
                  <TextInput
                    value={form.vehicleNumber}
                    onChangeText={(t) => setForm((p) => ({ ...p, vehicleNumber: t.toUpperCase() }))}
                    style={styles.input}
                    placeholder="MH12AB1234"
                    placeholderTextColor={COLORS.gray[500]}
                    autoCapitalize="characters"
                  />
                </View>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.tab, c === selectedCategory ? styles.tabActive : null]}
                      onPress={() => setSelectedCategory(c)}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.tabText, c === selectedCategory ? styles.tabTextActive : null]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

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
                      return (
                        <TouchableOpacity
                          key={s.id}
                          style={[styles.serviceRow, selected ? styles.serviceRowActive : null]}
                          onPress={() => toggleService(s.id)}
                          activeOpacity={0.9}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.serviceName}>{s.name}</Text>
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

            {step === 3 ? (
              <>
                <View style={styles.switchRow}>
                  <TouchableOpacity
                    style={[styles.choice, form.pickupRequired ? styles.choiceActive : null]}
                    onPress={() => setForm((p) => ({ ...p, pickupRequired: true }))}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="car" size={16} color={form.pickupRequired ? '#fff' : COLORS.primary} />
                    <Text style={[styles.choiceText, form.pickupRequired ? styles.choiceTextActive : null]}>Pickup & Drop</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.choice, !form.pickupRequired ? styles.choiceActive : null]}
                    onPress={() => {
                      setForm((p) => ({ ...p, pickupRequired: false }));
                      fetchWorkshops();
                    }}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="navigate" size={16} color={!form.pickupRequired ? '#fff' : COLORS.primary} />
                    <Text style={[styles.choiceText, !form.pickupRequired ? styles.choiceTextActive : null]}>Self Drop</Text>
                  </TouchableOpacity>
                </View>

                {form.pickupRequired ? (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.label}>Pickup address *</Text>
                      <TextInput
                        value={form.pickupAddress}
                        onChangeText={(t) => setForm((p) => ({ ...p, pickupAddress: t }))}
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
                    <View style={styles.row2}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Date (optional)</Text>
                        <TextInput
                          value={form.pickupDate}
                          onChangeText={(t) => setForm((p) => ({ ...p, pickupDate: t }))}
                          style={styles.input}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={COLORS.gray[500]}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Time (optional)</Text>
                        <TextInput
                          value={form.pickupTime}
                          onChangeText={(t) => setForm((p) => ({ ...p, pickupTime: t }))}
                          style={styles.input}
                          placeholder="HH:mm"
                          placeholderTextColor={COLORS.gray[500]}
                        />
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={styles.inputRow} onPress={() => setWorkshopModal(true)} activeOpacity={0.9}>
                      <Ionicons name="business" size={16} color={COLORS.primary} />
                      <Text style={styles.inputRowText}>
                        {form.selectedWorkshop ? form.selectedWorkshop.name : workshopLoading ? 'Loading workshops…' : 'Select workshop'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={COLORS.gray[500]} />
                    </TouchableOpacity>
                  </>
                )}
              </>
            ) : null}

            {step === 4 ? (
              <>
                <TouchableOpacity
                  style={[styles.payRow, form.paymentMethod === 'PAY_LATER' ? styles.payRowActive : null]}
                  onPress={() => setForm((p) => ({ ...p, paymentMethod: 'PAY_LATER' }))}
                  activeOpacity={0.9}
                >
                  <Ionicons name="time" size={18} color={form.paymentMethod === 'PAY_LATER' ? '#fff' : COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.payTitle, form.paymentMethod === 'PAY_LATER' ? styles.payTitleActive : null]}>Pay Later (Recommended)</Text>
                    <Text style={[styles.paySub, form.paymentMethod === 'PAY_LATER' ? styles.paySubActive : null]}>
                      Pay after inspection / final approval.
                    </Text>
                  </View>
                </TouchableOpacity>

                {(['UPI', 'CARD', 'CASH'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.payRow, form.paymentMethod === m ? styles.payRowActive : null]}
                    onPress={() => setForm((p) => ({ ...p, paymentMethod: m }))}
                    activeOpacity={0.9}
                  >
                    <Ionicons
                      name={m === 'UPI' ? 'qr-code' : m === 'CARD' ? 'card' : 'cash'}
                      size={18}
                      color={form.paymentMethod === m ? '#fff' : COLORS.primary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.payTitle, form.paymentMethod === m ? styles.payTitleActive : null]}>{m}</Text>
                      <Text style={[styles.paySub, form.paymentMethod === m ? styles.paySubActive : null]}>
                        {m === 'UPI' ? 'Google Pay / PhonePe / Paytm' : m === 'CARD' ? 'Credit / Debit card' : 'Cash at pickup/workshop'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}

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
                      style={[styles.couponBtn, couponApplying || !couponCode.trim() ? styles.couponBtnDisabled : null]}
                      onPress={applyCoupon}
                      disabled={couponApplying || !couponCode.trim()}
                    >
                      <Text style={styles.couponBtnText}>{couponApplying ? 'Applying…' : 'Apply'}</Text>
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

                <View style={styles.reviewBox}>
                  <Text style={styles.reviewTitle}>Summary</Text>
                  <Text style={styles.reviewLine}>
                    {form.city?.name || '—'} • {form.carModel ? formatCar(form.carModel) : '—'}
                  </Text>
                  <Text style={styles.reviewLine}>{form.selectedServices.length} service(s) selected</Text>
                  <Text style={styles.reviewLine}>Estimated: {totalPrice ? inr(totalPrice) : '—'}</Text>
                  {couponMeta ? (
                    <>
                      <Text style={styles.reviewLine}>Discount: -{inr(couponDiscount || 0)}</Text>
                      <Text style={styles.reviewLine}>Payable: {inr(couponAdjustedTotal)}</Text>
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
                <Ionicons name="arrow-back" size={16} color={step === 0 ? COLORS.gray[400] : COLORS.primary} />
                <Text style={[styles.secondaryText, step === 0 ? styles.secondaryTextDisabled : null]}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryBtn} onPress={onNext} activeOpacity={0.9} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : null}
                <Text style={styles.primaryText}>{step === steps.length - 1 ? 'Book Service' : 'Continue'}</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footerPad} />
        </ScrollView>

        <PublicPillNav
          activeTab="ai"
          onPressTab={(tab: PublicPillNavTab) => {
            if (tab === 'ai') navigation.navigate('AIBooking', { city: form.city?.name || undefined });
            if (tab === 'search') navigation.navigate('PublicWorkshopLocator', { city: form.city?.name || undefined });
            if (tab === 'profile') navigation.navigate('Login');
            if (tab === 'settings') Alert.alert('Support', 'Use AI booking or call support from the home screen.');
          }}
        />

        {/* City modal */}
        <Modal visible={cityModal} transparent animationType="fade" onRequestClose={() => setCityModal(false)}>
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

        {/* Car modal */}
        <Modal visible={carModal} transparent animationType="fade" onRequestClose={() => setCarModal(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setCarModal(false)}>
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <Text style={styles.modalTitle}>Select Car Model</Text>
              <View style={styles.modalSearchRow}>
                <Ionicons name="search" size={16} color={COLORS.gray[500]} />
                <TextInput
                  value={carQuery}
                  onChangeText={(t) => {
                    setCarQuery(t);
                    searchCarModels(t);
                  }}
                  placeholder="Type make or model (e.g. Tata Nexon)"
                  placeholderTextColor={COLORS.gray[500]}
                  style={styles.modalSearchInput}
                />
              </View>
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {carSuggestions.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.modalRow}
                    onPress={() => {
                      setForm((p) => ({ ...p, carModel: m }));
                      setCarModal(false);
                    }}
                  >
                    <Text style={styles.modalRowText}>{formatCar(m)}</Text>
                    <Ionicons
                      name={form.carModel?.id === m.id ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={form.carModel?.id === m.id ? COLORS.success : COLORS.gray[400]}
                    />
                  </TouchableOpacity>
                ))}
                {!carSuggestions.length ? (
                  <Text style={styles.modalEmpty}>Type at least 2 letters to search…</Text>
                ) : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Workshop modal */}
        <Modal visible={workshopModal} transparent animationType="fade" onRequestClose={() => setWorkshopModal(false)}>
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
                      {w.address ? <Text style={styles.modalSub} numberOfLines={1}>{w.address}</Text> : null}
                    </View>
                    <Ionicons
                      name={form.selectedWorkshop?.id === w.id ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={form.selectedWorkshop?.id === w.id ? COLORS.success : COLORS.gray[400]}
                    />
                  </TouchableOpacity>
                ))}
                {workshopLoading ? <Text style={styles.modalEmpty}>Loading workshops…</Text> : null}
                {!workshopLoading && !workshops.length ? <Text style={styles.modalEmpty}>No workshops found for this city.</Text> : null}
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
  top: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md },
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
  h1: { marginTop: 10, fontSize: 28, fontWeight: '900', color: COLORS.primaryDark },
  h2: { marginTop: 6, fontSize: 13, fontWeight: '700', color: COLORS.gray[600] },
  stepper: { marginTop: 12, flexDirection: 'row', gap: 8 },
  stepDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: 'rgba(17,24,39,0.12)' },
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
  cardTitle: { fontSize: 16, fontWeight: '900', color: COLORS.primaryDark, marginBottom: SPACING.md },
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
  serviceDesc: { marginTop: 4, fontSize: 11, fontWeight: '700', color: COLORS.gray[600], lineHeight: 15 },
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
  secondaryBtnDisabled: { backgroundColor: '#F3F4F6', borderColor: 'rgba(17,24,39,0.06)' },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 18 },
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
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  modalSearchInput: { flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.primaryDark },
});


