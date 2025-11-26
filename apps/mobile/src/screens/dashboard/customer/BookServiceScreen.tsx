/**
 * Book Service Screen - Customer Portal
 * Service booking with 3-step form
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function BookServiceScreen({ navigation }: any) {
  const { userProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    vehicle_number: '', vehicle_model: '', service_type: '', description: '',
    name: userProfile?.full_name || '', phone: userProfile?.phone || '', address: ''
  });

  const handleSubmit = async () => {
    try {
      const { error } = await supabase.from('leads').insert({
        customer_id: userProfile?.id, vehicle_number: formData.vehicle_number,
        vehicle_model: formData.vehicle_model, service_type: formData.service_type,
        description: formData.description, customer_name: formData.name,
        customer_phone: formData.phone, pickup_address: formData.address,
        status: 'NEW', lead_source: 'MOBILE_APP'
      });
      if (error) throw error;
      Alert.alert('Success', 'Service booking created!');
      navigation?.goBack?.();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()}><Ionicons name="arrow-back" size={24} /></TouchableOpacity>
        <Text style={styles.title}>Book Service</Text>
      </View>

      <View style={styles.progress}>
        {[1, 2, 3].map(i => <View key={i} style={[styles.dot, step >= i && styles.dotActive]} />)}
      </View>

      {step === 1 && (
        <View style={styles.form}>
          <Text style={styles.stepTitle}>Vehicle Details</Text>
          <TextInput style={styles.input} placeholder="Vehicle Number" value={formData.vehicle_number} onChangeText={text => setFormData({ ...formData, vehicle_number: text })} />
          <TextInput style={styles.input} placeholder="Vehicle Model" value={formData.vehicle_model} onChangeText={text => setFormData({ ...formData, vehicle_model: text })} />
          <TouchableOpacity style={styles.btn} onPress={() => setStep(2)}><Text style={styles.btnText}>Next</Text></TouchableOpacity>
        </View>
      )}

      {step === 2 && (
        <View style={styles.form}>
          <Text style={styles.stepTitle}>Service Details</Text>
          <TextInput style={styles.input} placeholder="Service Type" value={formData.service_type} onChangeText={text => setFormData({ ...formData, service_type: text })} />
          <TextInput style={styles.input} placeholder="Description" value={formData.description} onChangeText={text => setFormData({ ...formData, description: text })} multiline />
          <TouchableOpacity style={styles.btn} onPress={() => setStep(3)}><Text style={styles.btnText}>Next</Text></TouchableOpacity>
        </View>
      )}

      {step === 3 && (
        <View style={styles.form}>
          <Text style={styles.stepTitle}>Contact Details</Text>
          <TextInput style={styles.input} placeholder="Name" value={formData.name} onChangeText={text => setFormData({ ...formData, name: text })} />
          <TextInput style={styles.input} placeholder="Phone" value={formData.phone} onChangeText={text => setFormData({ ...formData, phone: text })} />
          <TextInput style={styles.input} placeholder="Pickup Address" value={formData.address} onChangeText={text => setFormData({ ...formData, address: text })} multiline />
          <TouchableOpacity style={styles.btnSuccess} onPress={handleSubmit}><Text style={styles.btnText}>Submit Booking</Text></TouchableOpacity>
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
  btn: { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: SIZES.sm, alignItems: 'center', marginTop: SPACING.md },
  btnSuccess: { backgroundColor: COLORS.success, padding: SPACING.md, borderRadius: SIZES.sm, alignItems: 'center', marginTop: SPACING.md },
  btnText: { color: COLORS.white, fontSize: SIZES.md, fontWeight: '600' },
});

