import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useNavigation } from '@react-navigation/native';

interface WorkshopSettings {
  id: string;
  name: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
  email: string;
  capacity: number;
  operating_hours_start: string;
  operating_hours_end: string;
  is_verified: boolean;
  accepts_pickup: boolean;
  accepts_dropoff: boolean;
}

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [settings, setSettings] = useState<WorkshopSettings | null>(null);

  useEffect(() => {
    fetchWorkshopId();
  }, []);

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
    if (workshopId) {
      fetchSettings();
    }
  }, [workshopId]);

  const fetchWorkshopId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      if (userProfile?.workshop_id) {
        setWorkshopId(userProfile.workshop_id);
      }
    } catch (error) {
      console.error('Error fetching workshop ID:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);

      if (!workshopId) return;

      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .eq('id', workshopId)
        .single();

      if (error) throw error;

      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings || !workshopId) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('workshops')
        .update({
          name: settings.name,
          address: settings.address,
          city: settings.city,
          pincode: settings.pincode,
          phone: settings.phone,
          email: settings.email,
          capacity: settings.capacity,
          operating_hours_start: settings.operating_hours_start,
          operating_hours_end: settings.operating_hours_end,
          accepts_pickup: settings.accepts_pickup,
          accepts_dropoff: settings.accepts_dropoff,
        })
        .eq('id', workshopId);

      if (error) throw error;

      Alert.alert('Success', 'Settings updated successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!settings) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚙️</Text>
          <Text style={styles.errorText}>Settings not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Workshop Settings</Text>
          <Text style={styles.subtitle}>Manage your workshop configuration</Text>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <View style={styles.card}>
            <InputField
              label="Workshop Name"
              value={settings.name}
              onChangeText={(value) => updateSetting('name', value)}
              placeholder="Enter workshop name"
            />
            <InputField
              label="Phone"
              value={settings.phone}
              onChangeText={(value) => updateSetting('phone', value)}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
            />
            <InputField
              label="Email"
              value={settings.email}
              onChangeText={(value) => updateSetting('email', value)}
              placeholder="Enter email"
              keyboardType="email-address"
            />
          </View>
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          <View style={styles.card}>
            <InputField
              label="Address"
              value={settings.address}
              onChangeText={(value) => updateSetting('address', value)}
              placeholder="Enter full address"
              multiline
            />
            <InputField
              label="City"
              value={settings.city}
              onChangeText={(value) => updateSetting('city', value)}
              placeholder="Enter city"
            />
            <InputField
              label="Pincode"
              value={settings.pincode}
              onChangeText={(value) => updateSetting('pincode', value)}
              placeholder="Enter pincode"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Operating Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operating Hours</Text>
          <View style={styles.card}>
            <InputField
              label="Start Time"
              value={settings.operating_hours_start || '09:00'}
              onChangeText={(value) => updateSetting('operating_hours_start', value)}
              placeholder="09:00"
            />
            <InputField
              label="End Time"
              value={settings.operating_hours_end || '18:00'}
              onChangeText={(value) => updateSetting('operating_hours_end', value)}
              placeholder="18:00"
            />
          </View>
        </View>

        {/* Capacity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capacity</Text>
          <View style={styles.card}>
            <InputField
              label="Maximum Concurrent Jobs"
              value={settings.capacity?.toString() || '10'}
              onChangeText={(value) => updateSetting('capacity', parseInt(value) || 0)}
              placeholder="10"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Service Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Options</Text>
          <View style={styles.card}>
            <SwitchField
              label="Accept Pickup Services"
              value={settings.accepts_pickup || false}
              onValueChange={(value) => updateSetting('accepts_pickup', value)}
            />
            <SwitchField
              label="Accept Dropoff Services"
              value={settings.accepts_dropoff || false}
              onValueChange={(value) => updateSetting('accepts_dropoff', value)}
            />
          </View>
        </View>

        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Verification Status:</Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: settings.is_verified ? '#d1fae5' : '#fee2e2' }
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: settings.is_verified ? '#059669' : '#dc2626' }
                ]}>
                  {settings.is_verified ? '✓ Verified' : '✕ Not Verified'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>💾 Save Settings</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const InputField = ({ label, value, onChangeText, placeholder, keyboardType, multiline }: any) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.inputMultiline]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboardType}
      multiline={multiline}
      placeholderTextColor="#9ca3af"
    />
  </View>
);

const SwitchField = ({ label, value, onValueChange }: any) => (
  <View style={styles.switchContainer}>
    <Text style={styles.switchLabel}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
      thumbColor={value ? '#2563eb' : '#f3f4f6'}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#6b7280',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputContainer: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

