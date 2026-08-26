/**
 * Telecaller Edit Lead — MyFNG blue theme, booking-flow style fields
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import { parseIds } from '@/lib/parseIds';
import {
  emptySecondCar,
  parseSecondCar,
  serializeSecondCar,
  type CrmSecondCar,
} from '@/lib/crmSecondCar';
import { COLORS, SPACING } from '@/constants/theme';
import CarModelSearchField from '@/components/CarModelSearchField';
import CrmServicePlanPicker from '@/components/telecaller/CrmServicePlanPicker';
import CrmPickupVisitStep, { type CrmPickupVisitValue } from '@/components/telecaller/CrmPickupVisitStep';
import {
  resolveVehicleClass,
  resolveVehicleClassByMakeModel,
} from '@/lib/servicePricing';

const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Hybrid'];

type FormData = {
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
  preferred_slot_start: string;
};

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
    // Use IST parts
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

function composeAddress(form: FormData) {
  const flat = form.flat_number.trim();
  const area = form.pickup_address.trim();
  const landmarkRaw = form.landmark.trim().replace(/^Near\s+/i, '');
  const city = form.city.trim();
  const pin = form.pincode.trim();
  return [
    flat,
    area,
    landmarkRaw ? `Near ${landmarkRaw}` : '',
    [city, pin].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');
}

/** Split composed pickup string into flat / area / landmark (no duplicates). */
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

  if (area) {
    return { flat, area, landmark };
  }

  let s = String(raw || meta?.pickup_address || '')
    .replace(/\s*\((home|work|other)\)/gi, '')
    .trim();

  const nearM = s.match(/,?\s*Near\s+(.+?)(?=,|$)/i);
  if (nearM) {
    const lm = nearM[1].trim().replace(/^Near\s+/i, '');
    if (!landmark) landmark = lm;
    s = s.replace(nearM[0], ',');
  }

  if (city) {
    s = s.replace(new RegExp(`,?\\s*${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig'), '');
  }
  const pin = String(pincode || '').trim();
  if (pin) s = s.replace(new RegExp(`\\b${pin}\\b`, 'g'), '');
  s = s.replace(/\b\d{6}\b/g, '');
  s = s
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

  // Drop leftover landmark / Near text from area
  area = area
    .replace(/,?\s*Near\s+.+$/i, '')
    .replace(/,{2,}/g, ',')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();

  return { flat, area, landmark };
}

type EditLeadProps = {
  navigation?: any;
  route?: any;
  /** When true, hide standalone header and use callbacks (embedded in Lead Details). */
  embedded?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
};

export default function TelecallerEditLeadScreen({
  navigation: navProp,
  route: routeProp,
  embedded = false,
  onSaved,
  onCancel,
}: EditLeadProps) {
  const route = useRoute();
  const navigationHook = useNavigation();
  const navigation = navProp || navigationHook;
  const insets = useSafeAreaInsets();
  const params = (routeProp?.params || (route as any)?.params || {}) as { leadId: string };
  const { leadId } = params;

  const handleClose = () => {
    if (onCancel) onCancel();
    else navigation.goBack();
  };

  const handleAfterSave = () => {
    if (onSaved) onSaved();
    else navigation.goBack();
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cities, setCities] = useState<any[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [carDisplay, setCarDisplay] = useState('');
  const [showSecondCar, setShowSecondCar] = useState(false);
  const [secondCar, setSecondCar] = useState<CrmSecondCar>(emptySecondCar());
  const [secondCarDisplay, setSecondCarDisplay] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [couponMeta, setCouponMeta] = useState<any>({});
  const [initialServiceTypes, setInitialServiceTypes] = useState<string[]>([]);
  const [initialServiceAddons, setInitialServiceAddons] = useState<string[]>([]);

  const [form, setForm] = useState<FormData>({
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
    preferred_slot_start: '',
  });

  const setField = (key: keyof FormData, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    (async () => {
      try {
        const [{ data: cityRows }, leadRes] = await Promise.all([
          supabase.from('cities').select('id, name, state').eq('is_active', true).order('name'),
          supabase.from('service_leads').select('*').eq('id', leadId).single(),
        ]);
        setCities(cityRows || []);

        if (leadRes.error) throw leadRes.error;
        const data = leadRes.data;

        const meta = data.coupon_meta && typeof data.coupon_meta === 'object' ? data.coupon_meta : {};
        setCouponMeta(meta);
        const slot = parseSlot(data.preferred_slot_start);
        const make = data.vehicle_make || '';
        const model = data.vehicle_model || '';
        setCarDisplay([make, model].filter(Boolean).join(' '));
        const existingSecond = parseSecondCar(meta);
        if (existingSecond) {
          setShowSecondCar(true);
          setSecondCar(existingSecond);
          setSecondCarDisplay(
            [existingSecond.vehicle_make, existingSecond.vehicle_model].filter(Boolean).join(' '),
          );
        } else {
          setShowSecondCar(false);
          setSecondCar(emptySecondCar());
          setSecondCarDisplay('');
        }

        const cityName = data.city || '';
        const pin = String(data.pincode || meta.pincode || '').replace(/\D/g, '').slice(0, 6);
        const rawAddr = String(data.pickup_address || data.customer_address || '');
        const parsed = parseComposedAddress(rawAddr, meta, cityName, pin);

        const serviceTypes = parseIds(data.service_type_ids);
        const serviceAddons = parseIds(data.subservice_ids);
        setInitialServiceTypes(serviceTypes);
        setInitialServiceAddons(serviceAddons);

        setForm({
          customer_name: data.customer_name || '',
          customer_phone: String(data.customer_phone || '').replace(/\D/g, '').slice(-10),
          customer_alternate_phone: data.customer_alternate_phone || '',
          customer_email: data.customer_email || '',
          city_id: data.city_id || '',
          city: cityName,
          pincode: pin,
          vehicle_number: data.vehicle_number || '',
          vehicle_make: make,
          model_id: data.model_id || '',
          vehicle_model: model,
          vehicle_class: data.vehicle_class || meta.vehicle_class || '',
          vehicle_fuel_type: data.vehicle_fuel_type || '',
          vehicle_year: data.vehicle_year?.toString() || '',
          odometer_km: data.odometer_km?.toString() || '',
          service_types: serviceTypes,
          service_addons: serviceAddons,
          problem_description: data.problem_description || '',
          pickup_required: data.pickup_required !== false,
          pickup_address: parsed.area,
          address_type: (meta.address_type as any) || 'home',
          flat_number: parsed.flat,
          landmark: parsed.landmark,
          pickup_date: meta.pickup_date || slot.date,
          pickup_time: meta.pickup_time || slot.time,
          workshop_id: data.workshop_id || '',
          workshop_name: '',
          preferred_slot_start: data.preferred_slot_start || '',
        });

        // Resolve city name if only id present
        if (data.city_id && !cityName && cityRows) {
          const c = cityRows.find((x: any) => x.id === data.city_id);
          if (c?.name) setForm((prev) => ({ ...prev, city: c.name }));
        }

        // Resolve city_id / vehicle_class for package ₹ pricing
        let resolvedCityId = String(data.city_id || '').trim();
        let resolvedModelId = String(data.model_id || '').trim();
        let resolvedClass = String(data.vehicle_class || meta.vehicle_class || '').trim();
        if (!resolvedCityId && cityName && cityRows?.length) {
          const hit = cityRows.find(
            (x: any) => String(x.name || '').toLowerCase() === cityName.toLowerCase(),
          );
          if (hit?.id) resolvedCityId = String(hit.id);
        }
        if (!resolvedClass && resolvedModelId) {
          resolvedClass = (await resolveVehicleClass(resolvedModelId)) || '';
        }
        if ((!resolvedClass || !resolvedModelId) && make && model) {
          const hit = await resolveVehicleClassByMakeModel(make, model);
          if (hit.class) resolvedClass = hit.class;
          if (hit.id) resolvedModelId = hit.id;
        }
        if (resolvedCityId || resolvedClass || resolvedModelId) {
          setForm((prev) => ({
            ...prev,
            ...(resolvedCityId ? { city_id: resolvedCityId } : {}),
            ...(resolvedModelId ? { model_id: resolvedModelId } : {}),
            ...(resolvedClass ? { vehicle_class: resolvedClass } : {}),
          }));
        }
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Failed to load lead');
      } finally {
        setLoading(false);
      }
    })();
  }, [leadId]);

  const cityOptions = useMemo(() => cities.slice(0, 50), [cities]);

  const pickupValue: CrmPickupVisitValue = {
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
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.customer_name.trim()) next.customer_name = 'Name required';
    if (!/^[6-9]\d{9}$/.test(form.customer_phone.replace(/\D/g, ''))) {
      next.customer_phone = 'Valid 10-digit phone required';
    }
    if (!form.city_id && !form.city) next.city_id = 'City required';
    if (!form.vehicle_make || !form.vehicle_model) next.vehicle = 'Select car model';
    if (showSecondCar && (!secondCar.vehicle_make || !secondCar.vehicle_model)) {
      next.second_vehicle = 'Select second car model';
    }
    if (!form.vehicle_fuel_type) next.vehicle_fuel_type = 'Fuel type required';
    if (form.service_types.length === 0) next.service_types = 'Select at least one service';
    if (form.pickup_required) {
      if (!form.vehicle_number.trim()) next.vehicle_number = 'Registration required';
      if (!form.pickup_date || !form.pickup_time) next.slot = 'Select date & time';
      if (form.pickup_address.trim().length < 4) next.pickup_address = 'Address required';
      if (form.landmark.trim().length < 2) next.landmark = 'Landmark required';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert('Missing info', 'Please fill required fields');
      return;
    }
    if (!leadId) {
      Alert.alert('Error', 'Lead id missing');
      return;
    }
    setSaving(true);
    try {
      const start = slotIso(form.pickup_date, form.pickup_time);
      const endHour = form.pickup_time
        ? `${String(Number(form.pickup_time.split(':')[0]) + 1).padStart(2, '0')}:00`
        : '';
      const end = slotIso(form.pickup_date, endHour);
      const composed = form.pickup_required ? composeAddress(form) : form.pickup_address;

      const nextMeta = {
        ...couponMeta,
        address_type: form.address_type,
        flat_number: form.flat_number || null,
        landmark: form.landmark.replace(/^Near\s+/i, '') || null,
        area: form.pickup_address || null,
        pickup_date: form.pickup_date || null,
        pickup_time: form.pickup_time || null,
        pickup_address: form.pickup_address || null,
        vehicle_class: form.vehicle_class || null,
        second_car: showSecondCar ? serializeSecondCar(secondCar) : null,
      };

      const sorted = (ids: string[]) => [...ids].map(String).sort();
      const servicesChangedLocal =
        sorted(initialServiceTypes).join('|') !== sorted(form.service_types).join('|') ||
        sorted(initialServiceAddons).join('|') !== sorted(form.service_addons).join('|');

      let quotePayload: any = null;
      if (servicesChangedLocal || form.service_types.length > 0) {
        try {
          const quoteRes = await apiFetch<any>('/api/telecaller/crm/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              service_type_ids: form.service_types,
              addon_ids: form.service_addons,
              city_id: form.city_id || null,
              workshop_id: form.pickup_required ? null : form.workshop_id || null,
              vehicle_class: form.vehicle_class || null,
            }),
          });
          quotePayload = quoteRes?.quote || null;
        } catch (e) {
          console.warn('[EditLead] quote failed', e);
        }
      }

      const payload = {
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.replace(/\D/g, '').slice(-10),
        customer_alternate_phone: form.customer_alternate_phone || null,
        customer_email: form.customer_email || null,
        customer_address: composed || form.pickup_address,
        city_id: form.city_id || null,
        city: form.city || null,
        pincode: form.pincode || null,
        vehicle_number: form.vehicle_number.toUpperCase().trim() || null,
        vehicle_make: form.vehicle_make,
        model_id: form.model_id || null,
        vehicle_model: form.vehicle_model,
        vehicle_fuel_type: form.vehicle_fuel_type,
        vehicle_year: form.vehicle_year ? parseInt(form.vehicle_year, 10) : null,
        odometer_km: form.odometer_km ? parseInt(form.odometer_km, 10) : null,
        vehicle_class: form.vehicle_class || null,
        service_types: form.service_types,
        service_addons: form.service_addons,
        problem_description: form.problem_description || null,
        pickup_required: form.pickup_required,
        pickup_address: form.pickup_required ? composed : null,
        workshop_id: form.pickup_required ? null : form.workshop_id || null,
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
      };

      let result: { success?: boolean; servicesChanged?: boolean; whatsapp?: any } | null = null;

      try {
        result = await apiFetch(`/api/telecaller/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (apiErr: any) {
        // Fallback: direct DB update if API path fails (e.g. deploy lag)
        console.warn('[EditLead] API failed, falling back to supabase', apiErr?.message);
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
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId);
        if (error) throw apiErr;
        result = { success: true, servicesChanged: servicesChangedLocal };
      }

      const servicesChanged = Boolean(result?.servicesChanged || servicesChangedLocal);
      let whatsapp = result?.whatsapp;

      // Always notify on package/service change (covers API miss + supabase fallback)
      if (servicesChanged && !whatsapp?.sent) {
        try {
          const notify = await apiFetch<{ success?: boolean; whatsapp?: any }>(
            `/api/telecaller/leads/${leadId}/notify-update`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                previousServiceIds: initialServiceTypes,
              }),
            },
          );
          whatsapp = notify?.whatsapp || whatsapp;
        } catch (notifyErr: any) {
          console.warn('[EditLead] WhatsApp notify failed', notifyErr?.message);
        }
      }

      if (servicesChanged) {
        setInitialServiceTypes(form.service_types);
        setInitialServiceAddons(form.service_addons);
      }

      const waNote =
        servicesChanged && whatsapp?.sent
          ? '\nCustomer notified on WhatsApp.'
          : servicesChanged
            ? '\nService updated — WhatsApp not sent (check Booking Confirmed automation).'
            : '';

      Alert.alert('Updated', `Lead saved successfully.${waNote}`, [
        { text: 'OK', onPress: handleAfterSave },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, embedded && { minHeight: 220 }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.muted}>Loading lead…</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={[styles.center, embedded && { minHeight: 220 }]}>
        <Text style={styles.errorBig}>{errorMessage}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleClose}>
          <Text style={styles.primaryBtnText}>{embedded ? 'Close' : 'Go Back'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, embedded && styles.containerEmbedded]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {!embedded ? (
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleClose}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Lead</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 24 },
          embedded && styles.contentEmbedded,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* Customer */}
        <View style={[styles.card, styles.customerCard]}>
          <View style={styles.customerHead}>
            <View style={styles.customerAvatar}>
              <Ionicons name="person" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Customer Details</Text>
              <Text style={styles.customerSub}>Name, phones & location</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Full name *</Text>
          <TextInput
            style={[styles.input, styles.inputPremium, errors.customer_name && styles.inputErr]}
            placeholder="Customer name"
            placeholderTextColor={COLORS.textSecondary}
            value={form.customer_name}
            onChangeText={(v) => setField('customer_name', v)}
          />

          <View style={styles.phoneRow}>
            <View style={styles.phoneCol}>
              <Text style={styles.fieldLabel}>Phone *</Text>
              <TextInput
                style={[styles.input, styles.inputPremium, errors.customer_phone && styles.inputErr]}
                placeholder="10-digit"
                placeholderTextColor={COLORS.textSecondary}
                value={form.customer_phone}
                onChangeText={(v) => setField('customer_phone', v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
            <View style={styles.phoneCol}>
              <Text style={styles.fieldLabel}>Alternate</Text>
              <TextInput
                style={[styles.input, styles.inputPremium]}
                placeholder="Optional"
                placeholderTextColor={COLORS.textSecondary}
                value={form.customer_alternate_phone}
                onChangeText={(v) =>
                  setField('customer_alternate_phone', v.replace(/\D/g, '').slice(0, 10))
                }
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={[styles.input, styles.inputPremium]}
            placeholder="Optional email"
            placeholderTextColor={COLORS.textSecondary}
            value={form.customer_email}
            onChangeText={(v) => setField('customer_email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>City *</Text>
          <TouchableOpacity style={[styles.dropdown, styles.inputPremium]} onPress={() => setCityOpen(true)}>
            <Text style={[styles.dropdownText, !form.city && styles.placeholder]}>
              {form.city || 'Select city'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {errors.city_id ? <Text style={styles.err}>{errors.city_id}</Text> : null}

          <Text style={styles.fieldLabel}>Pincode</Text>
          <TextInput
            style={[styles.input, styles.inputPremium]}
            placeholder="6-digit pincode"
            placeholderTextColor={COLORS.textSecondary}
            value={form.pincode}
            onChangeText={(v) => setField('pincode', v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>

        {/* Vehicle */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vehicle Details</Text>
          <CarModelSearchField
            label="Car model *"
            variant="website"
            displayValue={carDisplay}
            selectedMake={form.vehicle_make}
            selectedModel={form.vehicle_model}
            placeholder="Type model (e.g. Rapid, Swift)"
            onSelect={(make, model, display, meta) => {
              setCarDisplay(display);
              setForm((prev) => ({
                ...prev,
                vehicle_make: make,
                vehicle_model: model,
                model_id: meta?.id || prev.model_id,
                vehicle_class: meta?.class || prev.vehicle_class,
              }));
            }}
            onClear={() => {
              setCarDisplay('');
              setForm((prev) => ({
                ...prev,
                vehicle_make: '',
                vehicle_model: '',
                model_id: '',
                vehicle_class: '',
              }));
            }}
          />
          {errors.vehicle ? <Text style={styles.err}>{errors.vehicle}</Text> : null}
          {!showSecondCar ? (
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
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
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
              <TextInput
                style={[styles.input, styles.inputPremium]}
                placeholder="Reg. no or NA"
                placeholderTextColor={COLORS.textSecondary}
                value={secondCar.vehicle_number}
                onChangeText={(v) =>
                  setSecondCar((prev) => ({
                    ...prev,
                    vehicle_number: v.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12),
                  }))
                }
                autoCapitalize="characters"
                maxLength={12}
              />
              <CarModelSearchField
                label="Second car model *"
                variant="website"
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
              {errors.second_vehicle ? <Text style={styles.err}>{errors.second_vehicle}</Text> : null}
            </View>
          )}

          <Text style={styles.label}>Fuel type *</Text>
          <View style={styles.fuelRow}>
            {FUEL_TYPES.map((fuel) => {
              const active = form.vehicle_fuel_type === fuel;
              return (
                <TouchableOpacity
                  key={fuel}
                  style={[styles.fuelChip, active && styles.fuelChipActive]}
                  onPress={() => setField('vehicle_fuel_type', fuel)}
                >
                  <Text style={[styles.fuelText, active && styles.fuelTextActive]}>{fuel}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.vehicle_fuel_type ? <Text style={styles.err}>{errors.vehicle_fuel_type}</Text> : null}

          <View style={styles.row2}>
            <TextInput
              style={[styles.input, styles.half]}
              placeholder="Year"
              placeholderTextColor={COLORS.textSecondary}
              value={form.vehicle_year}
              onChangeText={(v) => setField('vehicle_year', v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
            />
            <TextInput
              style={[styles.input, styles.half]}
              placeholder="Odometer (km)"
              placeholderTextColor={COLORS.textSecondary}
              value={form.odometer_km}
              onChangeText={(v) => setField('odometer_km', v.replace(/\D/g, ''))}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Services */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Services</Text>
          <Text style={styles.hint}>Selected packages appear first. Tap to change.</Text>
          <CrmServicePlanPicker
            selectedIds={form.service_types}
            onChange={(ids) => setField('service_types', ids)}
            cityId={form.city_id}
            vehicleClass={form.vehicle_class}
            modelId={form.model_id}
            vehicleMake={form.vehicle_make}
            vehicleModel={form.vehicle_model}
            title=""
          />
          {errors.service_types ? <Text style={styles.err}>{errors.service_types}</Text> : null}

          <Text style={[styles.label, { marginTop: 12 }]}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any notes for workshop"
            placeholderTextColor={COLORS.textSecondary}
            value={form.problem_description}
            onChangeText={(v) => setField('problem_description', v)}
            multiline
          />
        </View>

        {/* Pickup / Visit */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pickup / Visit</Text>
          <CrmPickupVisitStep
            value={pickupValue}
            city={form.city}
            cityId={form.city_id}
            pincode={form.pincode}
            onChange={(patch) => {
              setForm((prev) => ({
                ...prev,
                ...patch,
                preferred_slot_start:
                  patch.pickup_date || patch.pickup_time
                    ? slotIso(
                        patch.pickup_date ?? prev.pickup_date,
                        patch.pickup_time ?? prev.pickup_time,
                      ) || prev.preferred_slot_start
                    : prev.preferred_slot_start,
              }));
            }}
          />
          {errors.vehicle_number ? <Text style={styles.err}>{errors.vehicle_number}</Text> : null}
          {errors.slot ? <Text style={styles.err}>{errors.slot}</Text> : null}
          {errors.pickup_address ? <Text style={styles.err}>{errors.pickup_address}</Text> : null}
          {errors.landmark ? <Text style={styles.err}>{errors.landmark}</Text> : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.stickyFooter,
          { paddingBottom: embedded ? 10 : Math.max(insets.bottom, 10) },
          embedded && styles.stickyFooterEmbedded,
        ]}
      >
        <TouchableOpacity
          style={[styles.submit, saving && { opacity: 0.6 }]}
          disabled={saving}
          onPress={handleSubmit}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.submitText}>Update Lead</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* City dropdown modal — tap list only (no search / keyboard) */}
      <Modal visible={cityOpen} transparent animationType="fade" onRequestClose={() => setCityOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCityOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Select City</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {cityOptions.map((c) => {
                const active = form.city_id === c.id || form.city === c.name;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.cityRow, active && styles.cityRowActive]}
                    onPress={() => {
                      setForm((prev) => ({ ...prev, city_id: c.id, city: c.name }));
                      setCityOpen(false);
                    }}
                  >
                    <Text style={[styles.cityRowText, active && styles.cityRowTextActive]}>
                      {c.name}
                    </Text>
                    {active ? <Ionicons name="checkmark" size={18} color={COLORS.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  containerEmbedded: { backgroundColor: 'transparent' },
  contentEmbedded: { paddingTop: 4, paddingBottom: 16 },
  stickyFooterEmbedded: {
    borderTopWidth: 0,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    shadowOpacity: 0,
    elevation: 0,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { marginTop: 10, color: COLORS.textSecondary },
  errorBig: { color: COLORS.red, textAlign: 'center', marginBottom: 16, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.OS === 'ios' ? 12 : 14,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  scroll: { flex: 1 },
  content: { padding: SPACING.md, paddingBottom: 48 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8EEF7',
  },
  customerCard: {
    borderColor: '#C9DCFF',
    backgroundColor: '#F7FAFF',
    shadowColor: '#004AAD',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  customerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5B6B82',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  phoneRow: { flexDirection: 'row', gap: 10 },
  phoneCol: { flex: 1 },
  inputPremium: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7E4F8',
    borderWidth: 1.5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textHeading,
    marginBottom: 0,
  },
  hint: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 12, lineHeight: 17 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: '#FAFCFF',
    marginBottom: 10,
  },
  inputErr: { borderColor: COLORS.red },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
    backgroundColor: '#FAFCFF',
  },
  dropdownText: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  placeholder: { color: COLORS.textSecondary, fontWeight: '500' },
  fuelRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8, marginBottom: 10 },
  fuelChip: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFCFF',
  },
  fuelChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  fuelText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  fuelTextActive: { color: '#fff' },
  row2: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  err: { color: COLORS.red, fontSize: 12, marginBottom: 8, marginTop: -4 },
  stickyFooter: {
    backgroundColor: '#fff',
    paddingHorizontal: SPACING.md,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E8EEF7',
    ...Platform.select({
      ios: {
        shadowColor: '#001F4D',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 10 },
    }),
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 14,
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalSheet: {
    backgroundColor: '#fff',
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 18,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textHeading, marginBottom: 10 },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cityRowActive: { backgroundColor: '#EAF2FF', borderRadius: 10, borderBottomWidth: 0 },
  cityRowText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
  cityRowTextActive: { color: COLORS.primary, fontWeight: '700' },
});
