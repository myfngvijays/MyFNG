import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../../constants/theme';
import { Icon } from '../../../components/Icon';
import BottomNav from '../../../components/BottomNav';

export default function AddMechanicScreen({ navigation, route }: any) {
  const { userProfile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    mechanic_code: '',
    mechanic_name: '',
    number: '',
    alternate_number1: '',
    alternate_number2: '',
    service_tag: '',
    service_tag2: '',
    service_tag3: '',
    timing: '',
    service_areas: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.mechanic_code || !formData.mechanic_name || !formData.number) {
      Alert.alert('Error', 'Please fill in all required fields (Code, Name, Number)');
      return;
    }

    setLoading(true);
    try {
      // Parse service areas (comma-separated pincodes)
      const serviceAreasArray = formData.service_areas
        ? formData.service_areas.split(',').map(area => area.trim()).filter(area => area)
        : [];

      const { data, error } = await supabase
        .from('company_mechanic_rsa')
        .insert({
          mechanic_code: formData.mechanic_code.trim(),
          mechanic_name: formData.mechanic_name.trim(),
          number: formData.number.trim(),
          alternate_number1: formData.alternate_number1.trim() || null,
          alternate_number2: formData.alternate_number2.trim() || null,
          service_tag: formData.service_tag.trim() || null,
          service_tag2: formData.service_tag2.trim() || null,
          service_tag3: formData.service_tag3.trim() || null,
          timing: formData.timing.trim() || null,
          service_areas: serviceAreasArray.length > 0 ? serviceAreasArray : null,
          active: true,
          is_available: true,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Error', 'Mechanic code already exists. Please use a different code.');
        } else {
          throw error;
        }
        return;
      }

      Alert.alert('Success', 'Mechanic added successfully!', [
        {
          text: 'OK',
          onPress: () => {
            // Reset form
            setFormData({
              mechanic_code: '',
              mechanic_name: '',
              number: '',
              alternate_number1: '',
              alternate_number2: '',
              service_tag: '',
              service_tag2: '',
              service_tag3: '',
              timing: '',
              service_areas: '',
            });
            // Navigate back or to mechanics list
            navigation.goBack();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error adding mechanic:', error);
      Alert.alert('Error', error.message || 'Failed to add mechanic');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Mechanic</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          {/* Required Fields Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information *</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mechanic Code *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter unique mechanic code"
                value={formData.mechanic_code}
                onChangeText={(value) => handleInputChange('mechanic_code', value)}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mechanic Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter mechanic name"
                value={formData.mechanic_name}
                onChangeText={(value) => handleInputChange('mechanic_name', value)}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter phone number"
                value={formData.number}
                onChangeText={(value) => handleInputChange('number', value)}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Contact Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Alternate Number 1</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional alternate number"
                value={formData.alternate_number1}
                onChangeText={(value) => handleInputChange('alternate_number1', value)}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Alternate Number 2</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional alternate number"
                value={formData.alternate_number2}
                onChangeText={(value) => handleInputChange('alternate_number2', value)}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Service Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Primary Service Tag</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., breakdown, flat_tire, battery"
                value={formData.service_tag}
                onChangeText={(value) => handleInputChange('service_tag', value)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Secondary Service Tag</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional secondary service"
                value={formData.service_tag2}
                onChangeText={(value) => handleInputChange('service_tag2', value)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tertiary Service Tag</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional tertiary service"
                value={formData.service_tag3}
                onChangeText={(value) => handleInputChange('service_tag3', value)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Availability Timing</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 9 AM - 6 PM"
                value={formData.timing}
                onChangeText={(value) => handleInputChange('timing', value)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Service Areas (Pincodes)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter pincodes separated by commas (e.g., 400001, 400002)"
                value={formData.service_areas}
                onChangeText={(value) => handleInputChange('service_areas', value)}
                multiline
                numberOfLines={2}
              />
              <Text style={styles.hint}>Separate multiple pincodes with commas</Text>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Icon name="check" size={20} color={COLORS.white} />
                <Text style={styles.submitButtonText}>Add Mechanic</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab="add_mechanic"
        onTabChange={(tab) => {
          if (tab === 'dashboard') {
            navigation.goBack();
          } else if (tab === 'mechanics') {
            navigation.navigate('RSAMechanics', {});
          }
        }}
        tabs={[
          { id: 'dashboard', label: 'Dashboard', icon: 'home' },
          { id: 'mechanics', label: 'Mechanics', icon: 'wrench' },
          { id: 'add_mechanic', label: 'Add', icon: 'plus' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.white,
    fontFamily: 'Poppins',
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: SPACING.md,
    paddingBottom: 100, // Space for bottom nav
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: SPACING.md,
    fontFamily: 'Poppins',
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textHeading,
    marginBottom: SPACING.xs,
    fontFamily: 'Poppins',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textBody,
    backgroundColor: COLORS.gray[50],
    fontFamily: 'Poppins',
  },
  hint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
    fontFamily: 'Poppins',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.lg,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
});

