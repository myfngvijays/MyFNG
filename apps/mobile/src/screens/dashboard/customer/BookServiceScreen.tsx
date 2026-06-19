/**
 * Book Service Screen - Customer Portal
 * Service booking with 3-step form
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';
import { ENV } from '../../../config/environment';

export default function BookServiceScreen({ navigation }: any) {
  const { userProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    vehicle_number: '', vehicle_model: '', service_type: '', description: '',
    name: userProfile?.full_name || '', phone: userProfile?.phone || '', address: ''
  });
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMeta, setCouponMeta] = useState<any | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponApplying, setCouponApplying] = useState(false);

  const applyCoupon = async () => {
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
            subtotal: 0,
            service_type_ids: [],
            service_items: [],
            customer_phone: formData.phone,
            channel: 'MOBILE',
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
  };

  const clearCoupon = () => {
    setCouponCode('');
    setCouponMeta(null);
    setCouponDiscount(0);
    setCouponError(null);
  };

  const handleSubmit = async () => {
    try {
      const response = await fetch(`${ENV.API_URL}/api/public/bookings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: {
            lead_number: `L-${Date.now().toString().slice(-8)}`,
            created_from: 'MOBILE_APP',
            status: 'NEW',
            lead_type: 'CAR_SERVICE',
            lead_source: 'App Booking',
            customer_name: formData.name,
            customer_phone: formData.phone,
            customer_address: formData.address,
            vehicle_number: formData.vehicle_number,
            vehicle_model: formData.vehicle_model,
            service_type: formData.service_type,
            problem_description: formData.description,
            pickup_required: true,
            pickup_address: formData.address,
            lead_priority: 'NORMAL',
          },
          coupon: couponMeta
            ? {
                code: couponCode,
                lead_context: {
                  subtotal: 0,
                  service_type_ids: [],
                  service_items: [],
                  customer_phone: formData.phone,
                },
              }
            : undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Failed to create booking');

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
          <TextInput style={styles.input} placeholder="Coupon Code (optional)" value={couponCode} onChangeText={text => setCouponCode(text.toUpperCase())} />
          <TouchableOpacity style={styles.btn} onPress={applyCoupon} disabled={couponApplying || !couponCode.trim()}>
            <Text style={styles.btnText}>{couponApplying ? 'Applying...' : 'Apply Coupon'}</Text>
          </TouchableOpacity>
          {couponMeta ? (
            <TouchableOpacity style={styles.btnOutline} onPress={clearCoupon}>
              <Text style={styles.btnOutlineText}>Remove Coupon</Text>
            </TouchableOpacity>
          ) : null}
          {couponError ? <Text style={styles.errorText}>{couponError}</Text> : null}
          {couponMeta ? <Text style={styles.successText}>Coupon applied: {couponMeta.code}</Text> : null}
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
  btnOutline: { borderWidth: 1, borderColor: COLORS.gray[300], padding: SPACING.md, borderRadius: SIZES.sm, alignItems: 'center', marginTop: SPACING.sm },
  btnOutlineText: { color: COLORS.gray[700], fontSize: SIZES.md, fontWeight: '600' },
  errorText: { color: '#DC2626', fontSize: SIZES.sm, marginTop: SPACING.sm },
  successText: { color: '#059669', fontSize: SIZES.sm, marginTop: SPACING.sm },
});

