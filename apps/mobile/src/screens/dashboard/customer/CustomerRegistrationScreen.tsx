/**
 * Customer Registration Screen
 * New customer signup with vehicle details
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CustomerRegistrationScreen({ navigation }: any) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    full_name: '', email: '', phone: '', address: '',
    vehicle_number: '', vehicle_make: '', vehicle_model: '', vehicle_year: '',
    password: '', confirm_password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    try {
      if (formData.password !== formData.confirm_password) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }

      setLoading(true);

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      // Create customer profile
      const { error: profileError } = await supabase.from('users_login').insert({
        email: formData.email,
        full_name: formData.full_name,
        phone: formData.phone,
        role_id: '(SELECT id FROM roles WHERE role_code = \'CUSTOMER\')',
        is_active: true,
      });

      if (profileError) throw profileError;

      // Add vehicle
      const { error: vehicleError } = await supabase.from('customer_vehicles').insert({
        customer_id: authData.user?.id,
        vehicle_number: formData.vehicle_number,
        vehicle_make: formData.vehicle_make,
        vehicle_model: formData.vehicle_model,
        vehicle_year: formData.vehicle_year,
      });

      if (vehicleError) throw vehicleError;

      Alert.alert('Success', 'Registration successful! Please login.');
      // ✅ FIX: Use signOut to trigger auth state change (handles navigation automatically)
      await supabase.auth.signOut();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()}><Ionicons name="arrow-back" size={24} /></TouchableOpacity>
        <Text style={styles.title}>Customer Registration</Text>
      </View>

      <View style={styles.progress}>
        {[1, 2, 3].map(i => <View key={i} style={[styles.dot, step >= i && styles.dotActive]} />)}
      </View>

      {step === 1 && (
        <View style={styles.form}>
          <Text style={styles.stepTitle}>Personal Details</Text>
          <TextInput style={styles.input} placeholder="Full Name *" value={formData.full_name} onChangeText={text => setFormData({ ...formData, full_name: text })} />
          <TextInput style={styles.input} placeholder="Email *" value={formData.email} onChangeText={text => setFormData({ ...formData, email: text })} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Phone *" value={formData.phone} onChangeText={text => setFormData({ ...formData, phone: text })} keyboardType="phone-pad" />
          <TextInput style={styles.input} placeholder="Address" value={formData.address} onChangeText={text => setFormData({ ...formData, address: text })} multiline />
          <TouchableOpacity style={styles.btn} onPress={() => setStep(2)}><Text style={styles.btnText}>Next</Text></TouchableOpacity>
        </View>
      )}

      {step === 2 && (
        <View style={styles.form}>
          <Text style={styles.stepTitle}>Vehicle Details</Text>
          <TextInput style={styles.input} placeholder="Vehicle Number *" value={formData.vehicle_number} onChangeText={text => setFormData({ ...formData, vehicle_number: text })} autoCapitalize="characters" />
          <TextInput style={styles.input} placeholder="Make (Maruti/Hyundai) *" value={formData.vehicle_make} onChangeText={text => setFormData({ ...formData, vehicle_make: text })} />
          <TextInput style={styles.input} placeholder="Model (Swift/i20) *" value={formData.vehicle_model} onChangeText={text => setFormData({ ...formData, vehicle_model: text })} />
          <TextInput style={styles.input} placeholder="Year (2020)" value={formData.vehicle_year} onChangeText={text => setFormData({ ...formData, vehicle_year: text })} keyboardType="numeric" />
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(1)}><Text style={styles.btnText}>Back</Text></TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={() => setStep(3)}><Text style={styles.btnText}>Next</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={styles.form}>
          <Text style={styles.stepTitle}>Create Password</Text>
          <TextInput style={styles.input} placeholder="Password *" value={formData.password} onChangeText={text => setFormData({ ...formData, password: text })} secureTextEntry />
          <TextInput style={styles.input} placeholder="Confirm Password *" value={formData.confirm_password} onChangeText={text => setFormData({ ...formData, confirm_password: text })} secureTextEntry />
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(2)}><Text style={styles.btnText}>Back</Text></TouchableOpacity>
            <TouchableOpacity style={styles.btnSuccess} onPress={handleRegister} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'Creating...' : 'Complete Registration'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, backgroundColor: COLORS.white, gap: SPACING.md },
  title: { fontSize: SIZES.xl, fontWeight: 'bold' },
  progress: { flexDirection: 'row', justifyContent: 'center', padding: SPACING.lg, gap: SPACING.sm },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.gray[300] },
  dotActive: { backgroundColor: COLORS.primary, width: 24 },
  form: { padding: SPACING.lg },
  stepTitle: { fontSize: SIZES.lg, fontWeight: 'bold', marginBottom: SPACING.md },
  input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[300], borderRadius: SIZES.sm, padding: SPACING.md, marginBottom: SPACING.md, fontSize: SIZES.md },
  btn: { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: SIZES.sm, alignItems: 'center', marginTop: SPACING.md, flex: 1 },
  btnSecondary: { backgroundColor: COLORS.gray[400], padding: SPACING.md, borderRadius: SIZES.sm, alignItems: 'center', marginTop: SPACING.md, flex: 1 },
  btnSuccess: { backgroundColor: COLORS.success, padding: SPACING.md, borderRadius: SIZES.sm, alignItems: 'center', marginTop: SPACING.md, flex: 1 },
  btnText: { color: COLORS.white, fontSize: SIZES.md, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: SPACING.md },
});

