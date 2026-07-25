/**
 * Telecaller Edit Lead Screen - Mobile
 * Complete lead editing with multi-select service types and dynamic dropdowns
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { parseIds } from '@/lib/parseIds';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';

interface FormData {
  customer_name: string;
  customer_phone: string;
  customer_alternate_phone: string;
  customer_email: string;
  customer_address: string;
  city_id: string;
  vehicle_number: string;
  vehicle_make: string;
  model_id: string;
  vehicle_model: string;
  vehicle_fuel_type: string;
  vehicle_year: string;
  odometer_km: string;
  service_types: string[];
  service_addons: string[];
  problem_description: string;
  pickup_required: boolean;
  pickup_address: string;
  preferred_slot_start: string;
}

export default function TelecallerEditLeadScreen({ navigation: navProp, route: routeProp }: any) {
  const route = useRoute();
  const navigationHook = useNavigation();
  const navigation = navProp || navigationHook;
  const params = (routeProp?.params || (route as any)?.params || {}) as { leadId: string };
  const { leadId } = params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState<FormData>({
    customer_name: '',
    customer_phone: '',
    customer_alternate_phone: '',
    customer_email: '',
    customer_address: '',
    city_id: '',
    vehicle_number: '',
    vehicle_make: '',
    model_id: '',
    vehicle_model: '',
    vehicle_fuel_type: '',
    vehicle_year: '',
    odometer_km: '',
    service_types: [],
    service_addons: [],
    problem_description: '',
    pickup_required: false,
    pickup_address: '',
    preferred_slot_start: '',
  });

  const [cities, setCities] = useState<any[]>([]);
  const [makes, setMakes] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [serviceAddons, setServiceAddons] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      await Promise.all([
        fetchLeadDetails(),
        fetchCities(),
        fetchMakes(),
        fetchServiceTypes(),
        fetchServiceAddons(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load lead data');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadDetails = async () => {
    const { data, error } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (error) throw error;

    if (!['NEW', 'CONTACTED', 'INCOMPLETE'].includes(String(data.status || ''))) {
      setErrorMessage(`Cannot edit lead with status: ${data.status}`);
      return;
    }

    // Parse service_type_ids and subservice_ids from JSONB / string / array
    const serviceTypeIds = parseIds(data.service_type_ids);
    const subserviceIds = parseIds(data.subservice_ids);

    setFormData({
      customer_name: data.customer_name || '',
      customer_phone: data.customer_phone || '',
      customer_alternate_phone: data.customer_alternate_phone || '',
      customer_email: data.customer_email || '',
      customer_address: data.customer_address || '',
      city_id: data.city_id || '',
      vehicle_number: data.vehicle_number || '',
      vehicle_make: data.vehicle_make || '',
      model_id: data.model_id || '',
      vehicle_model: data.vehicle_model || '',
      vehicle_fuel_type: data.vehicle_fuel_type || '',
      vehicle_year: data.vehicle_year?.toString() || '',
      odometer_km: data.odometer_km?.toString() || '',
      service_types: serviceTypeIds,
      service_addons: subserviceIds,
      problem_description: data.problem_description || '',
      pickup_required: data.pickup_required || false,
      pickup_address: data.pickup_address || '',
      preferred_slot_start: data.preferred_slot_start || '',
    });

    // Fetch models if make is already selected
    if (data.vehicle_make) {
      fetchModels(data.vehicle_make);
    }
  };

  const fetchCities = async () => {
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) setCities(data);
  };

  const fetchMakes = async () => {
    const { data, error } = await supabase
      .from('car_models')
      .select('make')
      .eq('is_active', true);

    if (!error && data) {
      const uniqueMakes = [...new Set(data.map(item => item.make))];
      setMakes(uniqueMakes.sort().map(make => ({ make })));
    }
  };

  const fetchModels = async (make: string) => {
    const { data, error } = await supabase
      .from('car_models')
      .select('*')
      .eq('make', make)
      .eq('is_active', true)
      .order('model_name');

    if (!error && data) setModels(data);
  };

  const fetchServiceTypes = async () => {
    const { data, error } = await supabase
      .from('service_types')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) setServiceTypes(data);
  };

  const fetchServiceAddons = async () => {
    const { data, error } = await supabase
      .from('service_addons')
      .select('id, name, price')
      .eq('is_active', true)
      .order('name');

    if (!error && data) setServiceAddons(data);
  };

  const handleChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Handle vehicle make change
    if (field === 'vehicle_make') {
      setFormData(prev => ({ ...prev, model_id: '', vehicle_model: '' }));
      setModels([]);
      if (value) {
        fetchModels(value);
      }
    }

    // Handle model selection
    if (field === 'model_id') {
      const selectedModel = models.find(m => m.id === value);
      if (selectedModel) {
        setFormData(prev => ({ ...prev, vehicle_model: selectedModel.model_name }));
      }
    }
  };

  const toggleServiceType = (id: string) => {
    setFormData(prev => ({
      ...prev,
      service_types: prev.service_types.includes(id)
        ? prev.service_types.filter(t => t !== id)
        : [...prev.service_types, id],
    }));
  };

  const toggleServiceAddon = (id: string) => {
    setFormData(prev => ({
      ...prev,
      service_addons: prev.service_addons.includes(id)
        ? prev.service_addons.filter(a => a !== id)
        : [...prev.service_addons, id],
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Customer validation
    if (!formData.customer_name.trim()) newErrors.customer_name = 'Name is required';
    if (!formData.customer_phone.trim()) newErrors.customer_phone = 'Phone is required';
    else if (!/^[6-9]\d{9}$/.test(formData.customer_phone.replace(/\D/g, ''))) {
      newErrors.customer_phone = 'Invalid Indian phone number';
    }
    if (!formData.customer_address.trim()) newErrors.customer_address = 'Address is required';
    if (!formData.city_id) newErrors.city_id = 'City is required';

    // Vehicle validation
    if (!formData.vehicle_number.trim()) newErrors.vehicle_number = 'Vehicle number is required';
    else if (!/^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,3}[ -]?[0-9]{4}$/.test(formData.vehicle_number.toUpperCase())) {
      newErrors.vehicle_number = 'Invalid vehicle number format';
    }
    if (!formData.vehicle_make) newErrors.vehicle_make = 'Make is required';
    if (!formData.model_id) newErrors.model_id = 'Model is required';
    if (!formData.vehicle_fuel_type) newErrors.vehicle_fuel_type = 'Fuel type is required';

    // Service validation
    if (formData.service_types.length === 0) newErrors.service_types = 'Select at least one service type';
    if (!formData.problem_description.trim()) newErrors.problem_description = 'Problem description is required';

    // Pickup validation
    if (formData.pickup_required) {
      if (!formData.pickup_address.trim() && !formData.customer_address.trim()) {
        newErrors.pickup_address = 'Pickup address is required';
      }
      if (!formData.preferred_slot_start) {
        newErrors.preferred_slot_start = 'Preferred pickup time is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fill all required fields correctly');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('service_leads')
        .update({
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_alternate_phone: formData.customer_alternate_phone || null,
          customer_email: formData.customer_email || null,
          customer_address: formData.customer_address,
          city_id: formData.city_id,
          vehicle_number: formData.vehicle_number.toUpperCase(),
          vehicle_make: formData.vehicle_make,
          model_id: formData.model_id,
          vehicle_model: formData.vehicle_model,
          vehicle_fuel_type: formData.vehicle_fuel_type,
          vehicle_year: formData.vehicle_year ? parseInt(formData.vehicle_year) : null,
          odometer_km: formData.odometer_km ? parseInt(formData.odometer_km) : null,
          service_type_ids: JSON.stringify(formData.service_types),
          subservice_ids: JSON.stringify(formData.service_addons),
          problem_description: formData.problem_description,
          pickup_required: formData.pickup_required,
          pickup_address: formData.pickup_required ? (formData.pickup_address || formData.customer_address) : null,
          preferred_slot_start: formData.pickup_required ? formData.preferred_slot_start : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (error) throw error;

      Alert.alert('Success', 'Lead updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      console.error('Error updating lead:', error);
      Alert.alert('Error', error.message || 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Loading lead...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Lead</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        {/* Customer Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Customer Details</Text>
          
          <TextInput
            style={[styles.input, !!errors.customer_name && styles.inputError]}
            placeholder="Customer Name *"
            value={formData.customer_name}
            onChangeText={(v) => handleChange('customer_name', v)}
          />
          {errors.customer_name && <Text style={styles.errorText}>{errors.customer_name}</Text>}

          <TextInput
            style={[styles.input, !!errors.customer_phone && styles.inputError]}
            placeholder="Phone Number *"
            value={formData.customer_phone}
            onChangeText={(v) => handleChange('customer_phone', v)}
            keyboardType="phone-pad"
            maxLength={10}
          />
          {errors.customer_phone && <Text style={styles.errorText}>{errors.customer_phone}</Text>}

          <TextInput
            style={styles.input}
            placeholder="Alternate Phone"
            value={formData.customer_alternate_phone}
            onChangeText={(v) => handleChange('customer_alternate_phone', v)}
            keyboardType="phone-pad"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={formData.customer_email}
            onChangeText={(v) => handleChange('customer_email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={[styles.input, styles.textArea, !!errors.customer_address && styles.inputError]}
            placeholder="Address *"
            value={formData.customer_address}
            onChangeText={(v) => handleChange('customer_address', v)}
            multiline
            numberOfLines={3}
          />
          {errors.customer_address && <Text style={styles.errorText}>{errors.customer_address}</Text>}

          <View style={styles.pickerContainer}>
            <Ionicons name="location" size={20} color="#6B7280" />
            <Text style={styles.pickerLabel}>City *</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
            {cities.map(city => (
              <TouchableOpacity
                key={city.id}
                style={[styles.chip, formData.city_id === city.id && styles.chipSelected]}
                onPress={() => handleChange('city_id', city.id)}
              >
                <Text style={[styles.chipText, formData.city_id === city.id && styles.chipTextSelected]}>
                  {city.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {errors.city_id && <Text style={styles.errorText}>{errors.city_id}</Text>}
        </View>

        {/* Vehicle Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚗 Vehicle Details</Text>

          <TextInput
            style={[styles.input, !!errors.vehicle_number && styles.inputError]}
            placeholder="Vehicle Number (e.g., MH 01 AB 1234) *"
            value={formData.vehicle_number}
            onChangeText={(v) => handleChange('vehicle_number', v.toUpperCase())}
            autoCapitalize="characters"
          />
          {errors.vehicle_number && <Text style={styles.errorText}>{errors.vehicle_number}</Text>}

          <View style={styles.pickerContainer}>
            <Ionicons name="car" size={20} color="#6B7280" />
            <Text style={styles.pickerLabel}>Vehicle Make *</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
            {makes.map((make, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.chip, formData.vehicle_make === make.make && styles.chipSelected]}
                onPress={() => handleChange('vehicle_make', make.make)}
              >
                <Text style={[styles.chipText, formData.vehicle_make === make.make && styles.chipTextSelected]}>
                  {make.make}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {errors.vehicle_make && <Text style={styles.errorText}>{errors.vehicle_make}</Text>}

          {formData.vehicle_make && (
            <>
              <View style={styles.pickerContainer}>
                <Ionicons name="car-sport" size={20} color="#6B7280" />
                <Text style={styles.pickerLabel}>Vehicle Model *</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                {models.map(model => (
                  <TouchableOpacity
                    key={model.id}
                    style={[styles.chip, formData.model_id === model.id && styles.chipSelected]}
                    onPress={() => handleChange('model_id', model.id)}
                  >
                    <Text style={[styles.chipText, formData.model_id === model.id && styles.chipTextSelected]}>
                      {model.model_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {errors.model_id && <Text style={styles.errorText}>{errors.model_id}</Text>}
            </>
          )}

          <View style={styles.pickerContainer}>
            <Ionicons name="water" size={20} color="#6B7280" />
            <Text style={styles.pickerLabel}>Fuel Type *</Text>
          </View>
          <View style={styles.row}>
            {['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'].map(fuel => (
              <TouchableOpacity
                key={fuel}
                style={[styles.chip, formData.vehicle_fuel_type === fuel && styles.chipSelected]}
                onPress={() => handleChange('vehicle_fuel_type', fuel)}
              >
                <Text style={[styles.chipText, formData.vehicle_fuel_type === fuel && styles.chipTextSelected]}>
                  {fuel}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.vehicle_fuel_type && <Text style={styles.errorText}>{errors.vehicle_fuel_type}</Text>}

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Year"
              value={formData.vehicle_year}
              onChangeText={(v) => handleChange('vehicle_year', v)}
              keyboardType="number-pad"
              maxLength={4}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Odometer (km)"
              value={formData.odometer_km}
              onChangeText={(v) => handleChange('odometer_km', v)}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Service Requirements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔧 Service Requirements</Text>

          <Text style={styles.label}>Service Types * (Select all that apply)</Text>
          <View style={styles.checkboxGroup}>
            {serviceTypes.map(type => (
              <TouchableOpacity
                key={type.id}
                style={styles.checkboxItem}
                onPress={() => toggleServiceType(type.id.toString())}
              >
                <Ionicons
                  name={formData.service_types.includes(type.id.toString()) ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={formData.service_types.includes(type.id.toString()) ? '#FF6B00' : '#9CA3AF'}
                />
                <Text style={styles.checkboxLabel}>{type.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.service_types && <Text style={styles.errorText}>{errors.service_types}</Text>}

          <Text style={styles.label}>Add-ons (Optional)</Text>
          <View style={styles.checkboxGroup}>
            {serviceAddons.map(addon => (
              <TouchableOpacity
                key={addon.id}
                style={styles.checkboxItem}
                onPress={() => toggleServiceAddon(addon.id.toString())}
              >
                <Ionicons
                  name={formData.service_addons.includes(addon.id.toString()) ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={formData.service_addons.includes(addon.id.toString()) ? '#FF6B00' : '#9CA3AF'}
                />
                <Text style={styles.checkboxLabel}>{addon.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[styles.input, styles.textArea, !!errors.problem_description && styles.inputError]}
            placeholder="Problem Description *"
            value={formData.problem_description}
            onChangeText={(v) => handleChange('problem_description', v)}
            multiline
            numberOfLines={4}
          />
          {errors.problem_description && <Text style={styles.errorText}>{errors.problem_description}</Text>}
        </View>

        {/* Pickup Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚚 Pickup Details</Text>

          <TouchableOpacity
            style={styles.checkboxItem}
            onPress={() => handleChange('pickup_required', !formData.pickup_required)}
          >
            <Ionicons
              name={formData.pickup_required ? 'checkbox' : 'square-outline'}
              size={24}
              color={formData.pickup_required ? '#FF6B00' : '#9CA3AF'}
            />
            <Text style={styles.checkboxLabel}>Pickup Required</Text>
          </TouchableOpacity>

          {formData.pickup_required && (
            <>
              <TextInput
                style={[styles.input, styles.textArea, !!errors.pickup_address && styles.inputError]}
                placeholder="Pickup Address (Leave empty to use customer address)"
                value={formData.pickup_address}
                onChangeText={(v) => handleChange('pickup_address', v)}
                multiline
                numberOfLines={2}
              />
              {errors.pickup_address && <Text style={styles.errorText}>{errors.pickup_address}</Text>}

              <TextInput
                style={[styles.input, !!errors.preferred_slot_start && styles.inputError]}
                placeholder="Preferred Pickup Time (e.g., 10:00 AM) *"
                value={formData.preferred_slot_start}
                onChangeText={(v) => handleChange('preferred_slot_start', v)}
              />
              {errors.preferred_slot_start && <Text style={styles.errorText}>{errors.preferred_slot_start}</Text>}
            </>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, saving && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#FFF" />
              <Text style={styles.submitButtonText}>Update Lead</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#FF6B00',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FF6B00',
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  form: {
    flex: 1,
    padding: 15,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 12,
    backgroundColor: '#FFF',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  halfInput: {
    flex: 1,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  chipContainer: {
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  chipText: {
    fontSize: 13,
    color: '#6B7280',
  },
  chipTextSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  checkboxGroup: {
    marginBottom: 15,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: -8,
    marginBottom: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FF6B00',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
});

