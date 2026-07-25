import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  BackHandler
} from 'react-native';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Removed - using emojis
import { Icon } from '../../../components/Icon';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';
import * as Location from 'expo-location';

export default function TelecallerCreateLeadScreen({ navigation }: any) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    // Customer Details
    customer_name: '',
    customer_phone: '',
    customer_alternate_phone: '',
    customer_email: '',
    customer_address: '',
    city_id: '',
    city: '',
    pincode: '',
    contact_method: 'CALL',
    customer_lat: '',
    customer_lng: '',
    
    // Vehicle Details
    vehicle_number: '',
    vehicle_make: '',
    model_id: '',
    vehicle_model: '',
    vehicle_variant: '',
    vehicle_year: '',
    vehicle_fuel_type: 'PETROL',
    odometer_km: '',
    
    // Service Details
    service_type_ids: [] as string[],
    subservice_ids: [] as string[],
    description: '',
    problem_description: '',
    payment_mode: '',
    coupon_code: '',
    
    // Additional
    pickup_required: false,
    pickup_address: '',
    preferred_slot_start: '',
    preferred_slot_end: '',
    notes: '',
    lead_priority: 'NORMAL'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cities, setCities] = useState<any[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [serviceAddons, setServiceAddons] = useState<any[]>([]);
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [couponMode, setCouponMode] = useState<'dropdown' | 'manual'>('dropdown');
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponsError, setCouponsError] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [navigation]);

  useEffect(() => {
    fetchOptionsData();
  }, []);

  useEffect(() => {
    if (formData.vehicle_make) {
      fetchModels(formData.vehicle_make);
    } else {
      setModels([]);
      setFormData(prev => ({ ...prev, model_id: '', vehicle_model: '' }));
    }
  }, [formData.vehicle_make]);

  useEffect(() => {
    fetchAvailableCoupons();
  }, [formData.city_id, formData.service_type_ids.join(',')]);

  const fetchOptionsData = async () => {
    try {
      // Cities via API (fallback to Supabase)
      try {
        const result = await apiFetch<{ cities: any[] }>('/api/cities');
        setCities(result.cities || []);
      } catch (apiError) {
        const { data: citiesData } = await supabase
          .from('cities')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        setCities(citiesData || []);
      }

      // Makes
      const { data: makesData } = await supabase
        .from('car_models')
        .select('make')
        .eq('is_active', true);
      const uniqueMakes = [...new Set((makesData || []).map((item: any) => item.make))];
      setMakes(uniqueMakes.sort());

      // Service types
      const { data: servicesData } = await supabase
        .from('service_types')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name');
      setServiceTypes(servicesData || []);

      // Service add-ons
      const { data: addonsData } = await supabase
        .from('service_addons')
        .select('id, name, description, price')
        .eq('is_active', true)
        .order('name');
      setServiceAddons(addonsData || []);
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  };

  const fetchModels = async (make: string) => {
    try {
      const { data } = await supabase
        .from('car_models')
        .select('id, model_name, variant')
        .eq('make', make)
        .eq('is_active', true)
        .order('model_name');
      setModels(data || []);
    } catch (error) {
      console.error('Error fetching models:', error);
      setModels([]);
    }
  };

  const fetchAvailableCoupons = async () => {
    setCouponsLoading(true);
    setCouponsError('');
    try {
      const params = new URLSearchParams();
      if (formData.city_id) params.set('city_id', formData.city_id);
      if (formData.service_type_ids.length > 0) {
        params.set('service_type_ids', formData.service_type_ids.join(','));
      }
      const data = await apiFetch<{ coupons: any[] }>(`/api/telecaller/coupons?${params.toString()}`);
      setAvailableCoupons(data.coupons || []);
    } catch (error: any) {
      setAvailableCoupons([]);
      setCouponsError(error?.message || 'Failed to load coupons');
    } finally {
      setCouponsLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setFormData(prev => ({
        ...prev,
        customer_lat: String(location.coords.latitude),
        customer_lng: String(location.coords.longitude),
      }));
    } catch (error) {
      console.error('Error fetching location:', error);
      Alert.alert('Error', 'Unable to fetch location');
    } finally {
      setLoadingLocation(false);
    }
  };

  const updateField = (field: string, value: any) => {
    // Auto-uppercase vehicle number
    const finalValue = field === 'vehicle_number' ? value.toUpperCase() : value;
    
    setFormData(prev => ({ ...prev, [field]: finalValue }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSelectCity = (city: any) => {
    setFormData(prev => ({
      ...prev,
      city_id: city.id,
      city: city.name,
    }));
  };

  const toggleServiceType = (id: string) => {
    setFormData(prev => ({
      ...prev,
      service_type_ids: prev.service_type_ids.includes(id)
        ? prev.service_type_ids.filter(t => t !== id)
        : [...prev.service_type_ids, id],
    }));
  };

  const toggleAddon = (id: string) => {
    setFormData(prev => ({
      ...prev,
      subservice_ids: prev.subservice_ids.includes(id)
        ? prev.subservice_ids.filter(a => a !== id)
        : [...prev.subservice_ids, id],
    }));
  };
  
  const validateVehicleNumber = (vehicleNumber: string): boolean => {
    // Indian vehicle number format: AB12CD1234
    const regex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
    const cleanNumber = vehicleNumber.replace(/[-\s]/g, '').toUpperCase();
    return regex.test(cleanNumber);
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.customer_name.trim()) newErrors.customer_name = 'Name required';
      if (!formData.customer_phone.trim()) newErrors.customer_phone = 'Phone required';
      if (formData.customer_phone && formData.customer_phone.length < 10) {
        newErrors.customer_phone = 'Enter valid 10-digit number';
      }
      if (!formData.city_id && !formData.city.trim()) newErrors.city = 'City required';
    }

    if (step === 2) {
      if (!formData.vehicle_number.trim()) newErrors.vehicle_number = 'Vehicle number required';
      if (!formData.vehicle_make.trim()) newErrors.vehicle_make = 'Vehicle make required';
      if (!formData.vehicle_model.trim()) newErrors.vehicle_model = 'Vehicle model required';
      
      // Vehicle number validation
      if (formData.vehicle_number && !validateVehicleNumber(formData.vehicle_number)) {
        newErrors.vehicle_number = 'Invalid format (e.g., MH12AB1234)';
      }
    }

    if (step === 3) {
      if (formData.service_type_ids.length === 0) newErrors.service_type = 'Service type required';
      
      // Pickup validation - only if pickup is required
      if (formData.pickup_required) {
        if (!formData.pickup_address && !formData.customer_address) {
          newErrors.pickup_address = 'Pickup address required';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setLoading(true);

    try {
      if (!user) throw new Error('User not authenticated');

      // Get telecaller profile
      const { data: profile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      // Generate lead number
      const leadNumber = `L-${Date.now().toString().slice(-8)}`;

      const selectedServiceNames = serviceTypes
        .filter((st: any) => formData.service_type_ids.includes(st.id))
        .map((st: any) => st.name);

      let couponMeta: Record<string, unknown> | null = null;
      let discountAmount = 0;
      const couponCode = String(formData.coupon_code || '').trim().toUpperCase();
      if (couponCode) {
        const validated = await apiFetch<any>('/api/coupons/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: couponCode,
            lead_context: {
              channel: 'TELECALLER',
              customer_phone: formData.customer_phone || null,
              service_type_ids: formData.service_type_ids,
              subservice_ids: formData.subservice_ids,
              city_id: formData.city_id || null,
              subtotal: 0,
              reserve_only: true,
            },
          }),
        });
        if (!validated?.valid) {
          Alert.alert('Invalid Coupon', String(validated?.error || 'Coupon cannot be applied to this lead.'));
          setLoading(false);
          return;
        }
        couponMeta = validated.coupon_meta || null;
        discountAmount = Number(validated.discount_amount || 0);
      }

      // Create lead
      const { data: lead, error: leadError } = await supabase
        .from('service_leads')
        .insert([{
          lead_number: leadNumber,
          created_by_id: profile?.id,
          created_from: 'TELECALLER',
          assigned_telecaller_id: profile?.id,
          telecaller_assigned_at: new Date().toISOString(),
          
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_alternate_phone: formData.customer_alternate_phone || null,
          customer_email: formData.customer_email || null,
          customer_address: formData.customer_address || null,
          city_id: formData.city_id || null,
          city: formData.city || null,
          pincode: formData.pincode || null,
          contact_method: formData.contact_method,
          customer_lat: formData.customer_lat || null,
          customer_lng: formData.customer_lng || null,
          
          vehicle_number: formData.vehicle_number, // Required field
          vehicle_make: formData.vehicle_make,
          model_id: formData.model_id || null,
          vehicle_model: formData.vehicle_model,
          vehicle_variant: formData.vehicle_variant || null,
          vehicle_year: formData.vehicle_year ? parseInt(formData.vehicle_year) : null,
          vehicle_fuel_type: formData.vehicle_fuel_type,
          odometer_km: formData.odometer_km ? parseInt(formData.odometer_km) : null,
          
          service_type: selectedServiceNames.join(', ') || null,
          service_type_ids: formData.service_type_ids,
          subservice_ids: formData.subservice_ids,
          description: formData.description || null,
          problem_description: formData.problem_description || null,
          payment_mode: formData.payment_mode || null,
          coupon_code: couponCode || null,
          discount_amount: discountAmount,
          coupon_meta: couponMeta,
          
          pickup_required: formData.pickup_required,
          pickup_address: formData.pickup_required ? (formData.pickup_address || formData.customer_address) : null,
          preferred_slot_start: formData.preferred_slot_start || null,
          preferred_slot_end: formData.preferred_slot_end || null,
          
          notes: formData.notes || null,
          lead_priority: formData.lead_priority,
          status: 'NEW',
          lead_type: 'NORMAL',
          is_incomplete: false
        }])
        .select()
        .single();

      if (leadError) throw leadError;

      // Create event log
      await supabase.from('lead_events').insert([{
        lead_id: lead.id,
        event_type: 'lead_created',
        event_category: 'LEAD',
        actor: `user:${profile?.id}`,
        actor_name: user.email,
        actor_role: 'TELECALLER',
        event_description: `Lead created by telecaller: ${leadNumber}`,
        metadata: { source: 'TELECALLER_MOBILE', created_from: 'manual_form' }
      }]);

      // Create call log
      await supabase.from('telecaller_call_logs').insert([{
        lead_id: lead.id,
        telecaller_id: profile?.id,
        call_type: 'OUTBOUND',
        call_status: 'COMPLETED',
        outcome: 'LEAD_CREATED',
        notes: 'Lead created via mobile app',
        phone_number: formData.customer_phone
      }]);

      Alert.alert(
        'Success!',
        `Lead created successfully!\nLead Number: ${leadNumber}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

    } catch (error) {
      console.error('Error creating lead:', error);
      Alert.alert('Error', 'Failed to create lead. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Customer Information</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Customer Name *</Text>
        <TextInput
          style={[styles.input, !!errors.customer_name && styles.inputError]}
          value={formData.customer_name}
          onChangeText={(value) => updateField('customer_name', value)}
          placeholder="Enter customer name"
          placeholderTextColor={COLORS.textSecondary}
        />
        {errors.customer_name && <Text style={styles.errorText}>{errors.customer_name}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Phone Number *</Text>
        <TextInput
          style={[styles.input, !!errors.customer_phone && styles.inputError]}
          value={formData.customer_phone}
          onChangeText={(value) => updateField('customer_phone', value)}
          placeholder="10-digit phone number"
          keyboardType="phone-pad"
          maxLength={10}
          placeholderTextColor={COLORS.textSecondary}
        />
        {errors.customer_phone && <Text style={styles.errorText}>{errors.customer_phone}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Alternate Phone</Text>
        <TextInput
          style={styles.input}
          value={formData.customer_alternate_phone}
          onChangeText={(value) => updateField('customer_alternate_phone', value)}
          placeholder="Optional"
          keyboardType="phone-pad"
          maxLength={10}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={formData.customer_email}
          onChangeText={(value) => updateField('customer_email', value)}
          placeholder="customer@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Address</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.customer_address}
          onChangeText={(value) => updateField('customer_address', value)}
          placeholder="Complete address"
          multiline
          numberOfLines={3}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>City *</Text>
        <TextInput
          style={[styles.input, !!errors.city && styles.inputError]}
          value={formData.city}
          onChangeText={(value) => {
            updateField('city', value);
            setFormData(prev => ({ ...prev, city_id: '' }));
          }}
          placeholder="Search city"
          placeholderTextColor={COLORS.textSecondary}
        />
        {formData.city.length > 0 && cities.length > 0 && (
          <View style={styles.optionList}>
            {cities
              .filter((c: any) => c.name.toLowerCase().includes(formData.city.toLowerCase()))
              .slice(0, 6)
              .map((c: any) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.optionItem}
                  onPress={() => handleSelectCity(c)}
                >
                  <Text style={styles.optionText}>{c.name}</Text>
                </TouchableOpacity>
              ))}
          </View>
        )}
        {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Pincode</Text>
        <TextInput
          style={styles.input}
          value={formData.pincode}
          onChangeText={(value) => updateField('pincode', value)}
          placeholder="6-digit pincode"
          keyboardType="number-pad"
          maxLength={6}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Vehicle Details</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Vehicle Registration Number *</Text>
        <TextInput
          style={[styles.input, !!errors.vehicle_number && styles.inputError]}
          value={formData.vehicle_number}
          onChangeText={(value) => updateField('vehicle_number', value.toUpperCase())}
          placeholder="MH12AB1234"
          autoCapitalize="characters"
          placeholderTextColor={COLORS.textSecondary}
        />
        {errors.vehicle_number && (
          <Text style={styles.errorText}>{errors.vehicle_number}</Text>
        )}
        <Text style={styles.helperText}>Format: AA00BB0000 (e.g., MH12AB1234)</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Vehicle Make / Brand *</Text>
        <TextInput
          style={[styles.input, !!errors.vehicle_make && styles.inputError]}
          value={formData.vehicle_make}
          onChangeText={(value) => updateField('vehicle_make', value)}
          placeholder="Search make"
          placeholderTextColor={COLORS.textSecondary}
        />
        {formData.vehicle_make.length > 0 && makes.length > 0 && (
          <View style={styles.optionList}>
            {makes
              .filter((m) => m.toLowerCase().includes(formData.vehicle_make.toLowerCase()))
              .slice(0, 6)
              .map((m) => (
                <TouchableOpacity
                  key={m}
                  style={styles.optionItem}
                  onPress={() => updateField('vehicle_make', m)}
                >
                  <Text style={styles.optionText}>{m}</Text>
                </TouchableOpacity>
              ))}
          </View>
        )}
        {errors.vehicle_make && <Text style={styles.errorText}>{errors.vehicle_make}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Vehicle Model *</Text>
        <TextInput
          style={[styles.input, !!errors.vehicle_model && styles.inputError]}
          value={formData.vehicle_model}
          onChangeText={(value) => updateField('vehicle_model', value)}
          placeholder="Select model"
          placeholderTextColor={COLORS.textSecondary}
        />
        {models.length > 0 && (
          <View style={styles.optionList}>
            {models.slice(0, 6).map((m: any) => (
              <TouchableOpacity
                key={m.id}
                style={styles.optionItem}
                onPress={() =>
                  setFormData(prev => ({
                    ...prev,
                    model_id: m.id,
                    vehicle_model: m.model_name,
                  }))
                }
              >
                <Text style={styles.optionText}>
                  {m.model_name}{m.variant ? ` (${m.variant})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {errors.vehicle_model && <Text style={styles.errorText}>{errors.vehicle_model}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Variant</Text>
        <TextInput
          style={styles.input}
          value={formData.vehicle_variant}
          onChangeText={(value) => updateField('vehicle_variant', value)}
          placeholder="e.g., VXI, SX"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Manufacturing Year</Text>
        <TextInput
          style={styles.input}
          value={formData.vehicle_year}
          onChangeText={(value) => updateField('vehicle_year', value)}
          placeholder="2020"
          keyboardType="number-pad"
          maxLength={4}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Fuel Type</Text>
        <View style={styles.radioGroup}>
          {['PETROL', 'DIESEL', 'CNG', 'EV'].map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.radioButton,
                formData.vehicle_fuel_type === type && styles.radioButtonActive
              ]}
              onPress={() => updateField('vehicle_fuel_type', type)}
            >
              <Text style={[
                styles.radioText,
                formData.vehicle_fuel_type === type && styles.radioTextActive
              ]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Odometer Reading (km)</Text>
        <TextInput
          style={styles.input}
          value={formData.odometer_km}
          onChangeText={(value) => updateField('odometer_km', value)}
          placeholder="50000"
          keyboardType="number-pad"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Service Requirements & Pickup</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Service Types *</Text>
        <View style={styles.serviceTypeGrid}>
          {serviceTypes.map((type: any) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.serviceTypeButton,
                formData.service_type_ids.includes(type.id) && styles.serviceTypeButtonActive
              ]}
              onPress={() => toggleServiceType(type.id)}
            >
              <Text style={[
                styles.serviceTypeText,
                formData.service_type_ids.includes(type.id) && styles.serviceTypeTextActive
              ]}>
                {type.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.service_type && <Text style={styles.errorText}>{errors.service_type}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Add-ons / Sub-services</Text>
        <View style={styles.serviceTypeGrid}>
          {serviceAddons.map((addon: any) => (
            <TouchableOpacity
              key={addon.id}
              style={[
                styles.serviceTypeButton,
                formData.subservice_ids.includes(addon.id) && styles.serviceTypeButtonActive
              ]}
              onPress={() => toggleAddon(addon.id)}
            >
              <Text style={[
                styles.serviceTypeText,
                formData.subservice_ids.includes(addon.id) && styles.serviceTypeTextActive
              ]}>
                {addon.name}{addon.price ? ` (₹${addon.price})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Service Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.description}
          onChangeText={(value) => updateField('description', value)}
          placeholder="Brief service description..."
          multiline
          numberOfLines={3}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Problem Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.problem_description}
          onChangeText={(value) => updateField('problem_description', value)}
          placeholder="What problem is the customer facing?..."
          multiline
          numberOfLines={4}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Payment Mode</Text>
        <TextInput
          style={styles.input}
          value={formData.payment_mode}
          onChangeText={(value) => updateField('payment_mode', value)}
          placeholder="Cash / Card / UPI"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Coupon</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, couponMode === 'dropdown' && styles.toggleButtonActive]}
            onPress={() => setCouponMode('dropdown')}
          >
            <Text style={[styles.toggleText, couponMode === 'dropdown' && styles.toggleTextActive]}>Select</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, couponMode === 'manual' && styles.toggleButtonActive]}
            onPress={() => setCouponMode('manual')}
          >
            <Text style={[styles.toggleText, couponMode === 'manual' && styles.toggleTextActive]}>Manual</Text>
          </TouchableOpacity>
        </View>

        {couponMode === 'manual' ? (
          <TextInput
            style={styles.input}
            value={formData.coupon_code}
            onChangeText={(value) => updateField('coupon_code', value.toUpperCase())}
            placeholder="Enter coupon code"
            placeholderTextColor={COLORS.textSecondary}
          />
        ) : (
          <View style={styles.optionList}>
            {couponsLoading && <Text style={styles.helperText}>Loading coupons...</Text>}
            {!!couponsError && <Text style={styles.errorText}>{couponsError}</Text>}
            {!couponsLoading && availableCoupons.length === 0 && (
              <Text style={styles.helperText}>No coupons available</Text>
            )}
            {availableCoupons.map((coupon: any) => (
              <TouchableOpacity
                key={coupon.id}
                style={styles.optionItem}
                onPress={() => updateField('coupon_code', coupon.code)}
              >
                <Text style={styles.optionText}>
                  {coupon.code} {coupon.description ? `• ${coupon.description}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Customer Location</Text>
        <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation} disabled={loadingLocation}>
          <Text style={styles.locationButtonEmoji}>📍</Text>
          <Text style={styles.locationButtonText}>
            {loadingLocation ? 'Fetching location...' : 'Get Current Location (Lat/Lng)'}
          </Text>
        </TouchableOpacity>
        {(formData.customer_lat || formData.customer_lng) && (
          <Text style={styles.helperText}>
            {formData.customer_lat}, {formData.customer_lng}
          </Text>
        )}
      </View>

      {/* Pickup Section */}
      <View style={styles.sectionDivider} />
      
      <View style={styles.checkboxGroup}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => updateField('pickup_required', !formData.pickup_required)}
        >
          <Text style={styles.checkboxEmoji}>{formData.pickup_required ? '✅' : '⬜'}</Text>
          <Text style={styles.checkboxLabel}>Customer requires vehicle pickup</Text>
        </TouchableOpacity>
      </View>

      {formData.pickup_required && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pickup Address</Text>
            <TextInput
              style={[styles.input, styles.textArea, !!errors.pickup_address && styles.inputError]}
              value={formData.pickup_address}
              onChangeText={(value) => updateField('pickup_address', value)}
              placeholder="Enter pickup address or leave empty to use customer address"
              multiline
              numberOfLines={2}
              placeholderTextColor={COLORS.textSecondary}
            />
            {errors.pickup_address && <Text style={styles.errorText}>{errors.pickup_address}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Preferred Slot Start</Text>
            <TextInput
              style={styles.input}
              value={formData.preferred_slot_start}
              onChangeText={(value) => updateField('preferred_slot_start', value)}
              placeholder="YYYY-MM-DDTHH:mm"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Preferred Slot End</Text>
            <TextInput
              style={styles.input}
              value={formData.preferred_slot_end}
              onChangeText={(value) => updateField('preferred_slot_end', value)}
              placeholder="YYYY-MM-DDTHH:mm"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
        </>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Lead Priority</Text>
        <View style={styles.radioGroup}>
          {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map(priority => (
            <TouchableOpacity
              key={priority}
              style={[
                styles.radioButton,
                formData.lead_priority === priority && styles.radioButtonActive
              ]}
              onPress={() => updateField('lead_priority', priority)}
            >
              <Text style={[
                styles.radioText,
                formData.lead_priority === priority && styles.radioTextActive
              ]}>
                {priority}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Internal Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.notes}
          onChangeText={(value) => updateField('notes', value)}
          placeholder="Any additional notes..."
          multiline
          numberOfLines={3}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>
    </View>
  );

  const renderStep4 = () => null; // No longer used - merged into step 3

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation?.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create New Lead</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        {[1, 2, 3].map(step => (
          <View key={step} style={styles.progressStep}>
            <View style={[
              styles.progressDot,
              currentStep >= step && styles.progressDotActive
            ]}>
              {currentStep > step ? (
                <Text style={styles.progressDotText}>✓</Text>
              ) : (
                <Text style={[
                  styles.progressDotText,
                  currentStep >= step && styles.progressDotTextActive
                ]}>
                  {step}
                </Text>
              )}
            </View>
            {step < 3 && (
              <View style={[
                styles.progressLine,
                currentStep > step && styles.progressLineActive
              ]} />
            )}
          </View>
        ))}
      </View>

      {/* Step Labels */}
      <View style={styles.stepLabels}>
        <Text style={[styles.stepLabel, currentStep === 1 && styles.stepLabelActive]}>Customer</Text>
        <Text style={[styles.stepLabel, currentStep === 2 && styles.stepLabelActive]}>Vehicle</Text>
        <Text style={[styles.stepLabel, currentStep === 3 && styles.stepLabelActive]}>Service & Pickup</Text>
      </View>

      {/* Form Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.buttonsContainer}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handlePrevious}
          >
            <Text style={styles.buttonSecondaryText}>Previous</Text>
          </TouchableOpacity>
        )}

        {currentStep < 3 ? (
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary, currentStep === 1 && styles.buttonFull]}
            onPress={handleNext}
          >
            <Text style={styles.buttonPrimaryText}>Next</Text>
            <Text style={styles.buttonPrimaryText}>→</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.buttonPrimaryText}>Creating...</Text>
            ) : (
              <>
                <Text style={styles.buttonPrimaryText}>Create Lead</Text>
                <Text style={styles.buttonPrimaryText}>✓</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: SPACING.md,
    elevation: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: '#fff',
    elevation: 2,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gray[500] + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotActive: {
    backgroundColor: COLORS.primary,
  },
  progressDotText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
  progressDotTextActive: {
    color: '#fff',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.gray[500] + '30',
    marginHorizontal: 4,
  },
  progressLineActive: {
    backgroundColor: COLORS.primary,
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: '#fff',
  },
  stepLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  stepLabelActive: {
    color: COLORS.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  stepContent: {
    paddingBottom: SPACING.xl,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  optionList: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginTop: SPACING.xs,
    overflow: 'hidden',
  },
  optionItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  optionText: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    backgroundColor: COLORS.white,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  toggleTextActive: {
    color: COLORS.white,
  },
  inputError: {
    borderColor: COLORS.red,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: COLORS.red,
    marginTop: 4,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  radioButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  radioButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  radioText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  radioTextActive: {
    color: '#fff',
  },
  checkboxGroup: {
    marginBottom: SPACING.md,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blue + '10',
    padding: SPACING.md,
    borderRadius: 8,
  },
  checkboxEmoji: {
    fontSize: 24,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#D1D5DB',
    marginVertical: SPACING.lg,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.green + '15',
    padding: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
    marginBottom: SPACING.md,
  },
  locationButtonEmoji: {
    fontSize: 20,
    marginRight: SPACING.xs,
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.green,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  serviceTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  serviceTypeButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    minWidth: '48%',
    alignItems: 'center',
  },
  serviceTypeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  serviceTypeText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  serviceTypeTextActive: {
    color: '#fff',
  },
  buttonsContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: '#fff',
    elevation: 4,
    gap: SPACING.sm,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: 8,
    gap: SPACING.xs,
  },
  buttonFull: {
    flex: 1,
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonSecondary: {
    backgroundColor: COLORS.gray[500] + '20',
  },
  buttonSecondaryText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

