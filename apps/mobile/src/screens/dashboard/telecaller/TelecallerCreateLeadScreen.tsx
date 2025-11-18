import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SPACING } from '../../../constants/theme';

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
    city: '',
    pincode: '',
    contact_method: 'CALL',
    
    // Vehicle Details
    vehicle_number: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_variant: '',
    vehicle_year: '',
    vehicle_fuel_type: 'PETROL',
    odometer_km: '',
    
    // Service Details
    service_type: '',
    description: '',
    problem_description: '',
    
    // Additional
    pickup_required: false,
    pickup_address: '',
    preferred_slot_start: '',
    notes: '',
    lead_priority: 'NORMAL'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.customer_name.trim()) newErrors.customer_name = 'Name required';
      if (!formData.customer_phone.trim()) newErrors.customer_phone = 'Phone required';
      if (formData.customer_phone && formData.customer_phone.length < 10) {
        newErrors.customer_phone = 'Enter valid 10-digit number';
      }
      if (!formData.city.trim()) newErrors.city = 'City required';
    }

    if (step === 2) {
      if (!formData.vehicle_make.trim()) newErrors.vehicle_make = 'Vehicle make required';
      if (!formData.vehicle_model.trim()) newErrors.vehicle_model = 'Vehicle model required';
    }

    if (step === 3) {
      if (!formData.service_type.trim()) newErrors.service_type = 'Service type required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
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
          city: formData.city,
          pincode: formData.pincode || null,
          contact_method: formData.contact_method,
          
          vehicle_number: formData.vehicle_number || null,
          vehicle_make: formData.vehicle_make,
          vehicle_model: formData.vehicle_model,
          vehicle_variant: formData.vehicle_variant || null,
          vehicle_year: formData.vehicle_year ? parseInt(formData.vehicle_year) : null,
          vehicle_fuel_type: formData.vehicle_fuel_type,
          odometer_km: formData.odometer_km ? parseInt(formData.odometer_km) : null,
          
          service_type: formData.service_type,
          description: formData.description || null,
          problem_description: formData.problem_description || null,
          
          pickup_required: formData.pickup_required,
          pickup_address: formData.pickup_required ? (formData.pickup_address || formData.customer_address) : null,
          preferred_slot_start: formData.preferred_slot_start || null,
          
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
          style={[styles.input, errors.customer_name && styles.inputError]}
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
          style={[styles.input, errors.customer_phone && styles.inputError]}
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
          style={[styles.input, errors.city && styles.inputError]}
          value={formData.city}
          onChangeText={(value) => updateField('city', value)}
          placeholder="City name"
          placeholderTextColor={COLORS.textSecondary}
        />
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
        <Text style={styles.label}>Vehicle Registration Number</Text>
        <TextInput
          style={styles.input}
          value={formData.vehicle_number}
          onChangeText={(value) => updateField('vehicle_number', value.toUpperCase())}
          placeholder="MH01AB1234"
          autoCapitalize="characters"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Vehicle Make / Brand *</Text>
        <TextInput
          style={[styles.input, errors.vehicle_make && styles.inputError]}
          value={formData.vehicle_make}
          onChangeText={(value) => updateField('vehicle_make', value)}
          placeholder="e.g., Maruti, Hyundai"
          placeholderTextColor={COLORS.textSecondary}
        />
        {errors.vehicle_make && <Text style={styles.errorText}>{errors.vehicle_make}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Vehicle Model *</Text>
        <TextInput
          style={[styles.input, errors.vehicle_model && styles.inputError]}
          value={formData.vehicle_model}
          onChangeText={(value) => updateField('vehicle_model', value)}
          placeholder="e.g., Swift, Creta"
          placeholderTextColor={COLORS.textSecondary}
        />
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
      <Text style={styles.stepTitle}>Service Requirements</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Service Type *</Text>
        <View style={styles.serviceTypeGrid}>
          {[
            { value: 'GENERAL_SERVICE', label: 'General Service' },
            { value: 'OIL_CHANGE', label: 'Oil Change' },
            { value: 'BRAKE_SERVICE', label: 'Brake Service' },
            { value: 'AC_SERVICE', label: 'AC Service' },
            { value: 'BATTERY', label: 'Battery' },
            { value: 'TIRE_SERVICE', label: 'Tire Service' },
            { value: 'ENGINE_REPAIR', label: 'Engine Repair' },
            { value: 'DENTING_PAINTING', label: 'Denting' },
          ].map(type => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.serviceTypeButton,
                formData.service_type === type.value && styles.serviceTypeButtonActive
              ]}
              onPress={() => updateField('service_type', type.value)}
            >
              <Text style={[
                styles.serviceTypeText,
                formData.service_type === type.value && styles.serviceTypeTextActive
              ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.service_type && <Text style={styles.errorText}>{errors.service_type}</Text>}
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
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Additional Information</Text>

      <View style={styles.checkboxGroup}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => updateField('pickup_required', !formData.pickup_required)}
        >
          <MaterialCommunityIcons
            name={formData.pickup_required ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={24}
            color={formData.pickup_required ? COLORS.primary : COLORS.textSecondary}
          />
          <Text style={styles.checkboxLabel}>Customer requires vehicle pickup</Text>
        </TouchableOpacity>
      </View>

      {formData.pickup_required && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pickup Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.pickup_address}
              onChangeText={(value) => updateField('pickup_address', value)}
              placeholder="Leave empty to use customer address"
              multiline
              numberOfLines={2}
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4].map(step => (
          <View key={step} style={styles.progressStep}>
            <View style={[
              styles.progressDot,
              currentStep >= step && styles.progressDotActive
            ]}>
              {currentStep > step ? (
                <MaterialCommunityIcons name="check" size={16} color="#fff" />
              ) : (
                <Text style={[
                  styles.progressDotText,
                  currentStep >= step && styles.progressDotTextActive
                ]}>
                  {step}
                </Text>
              )}
            </View>
            {step < 4 && (
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
        <Text style={[styles.stepLabel, currentStep === 3 && styles.stepLabelActive]}>Service</Text>
        <Text style={[styles.stepLabel, currentStep === 4 && styles.stepLabelActive]}>Additional</Text>
      </View>

      {/* Form Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
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

        {currentStep < 4 ? (
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary, currentStep === 1 && styles.buttonFull]}
            onPress={handleNext}
          >
            <Text style={styles.buttonPrimaryText}>Next</Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
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
                <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
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
    backgroundColor: COLORS.gray + '30',
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
    backgroundColor: COLORS.gray + '30',
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
    borderColor: COLORS.gray + '40',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 14,
    color: COLORS.textPrimary,
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
    borderColor: COLORS.gray + '40',
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
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: SPACING.sm,
    flex: 1,
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
    borderColor: COLORS.gray + '40',
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
    backgroundColor: COLORS.gray + '20',
  },
  buttonSecondaryText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

