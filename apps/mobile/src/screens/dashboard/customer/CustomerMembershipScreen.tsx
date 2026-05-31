import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CustomerMembershipScreen({ navigation }: any) {
  const [plans, setPlans] = useState<any[]>([]);
  const [benefits, setBenefits] = useState<any[]>([]);
  const [membership, setMembership] = useState<any>(null);

  const load = async () => {
    const [plansRes, currentRes] = await Promise.all([
      apiFetch<{ plans: any[]; benefits: any[] }>('/api/customer/membership/plans'),
      apiFetch<{ membership: any }>('/api/customer/membership'),
    ]);
    setPlans(plansRes.plans || []);
    setBenefits(plansRes.benefits || []);
    setMembership(currentRes.membership || null);
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const groupedBenefits = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const b of benefits) {
      map[b.plan_id] = map[b.plan_id] || [];
      map[b.plan_id].push(b);
    }
    return map;
  }, [benefits]);

  const subscribe = async (planId: string) => {
    try {
      const orderRes = await apiFetch<any>('/api/customer/membership/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      });

      if (!orderRes?.order_id) {
        Alert.alert('Error', 'Could not create payment order. Please try again.');
        return;
      }

      let RazorpayCheckout: any = null;
      try {
        RazorpayCheckout = require('react-native-razorpay')?.default;
      } catch {
        RazorpayCheckout = null;
      }

      if (!RazorpayCheckout) {
        Alert.alert('Error', 'Payment module is not available. Please update the app.');
        return;
      }

      const options = {
        key: orderRes.razorpay_key,
        amount: orderRes.amount_paise,
        currency: 'INR',
        name: 'MyFNG',
        description: `${orderRes.plan_name} Membership`,
        order_id: orderRes.order_id,
        theme: { color: '#004AAD' },
      };

      const paymentResult = await RazorpayCheckout.open(options);

      await apiFetch('/api/customer/membership/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: planId,
          razorpay_payment_id: paymentResult.razorpay_payment_id,
          razorpay_order_id: paymentResult.razorpay_order_id,
          razorpay_signature: paymentResult.razorpay_signature,
        }),
      });

      Alert.alert('Success', `Membership activated successfully!`);
      await load();
    } catch (err: any) {
      const cancelled = err?.code === 'PAYMENT_CANCELLED' || err?.description?.includes('cancelled');
      if (cancelled) {
        Alert.alert('Payment Cancelled', 'No charges were made.');
      } else {
        Alert.alert('Subscription failed', err?.message || 'Unable to subscribe. Please try again.');
      }
    }
  };

  return (
    <View style={styles.container}>
      <DashboardHeader title="Membership" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {membership && (
          <View style={styles.activeCard}>
            <View style={styles.activeRow}>
              <View>
                <Text style={styles.activeLabel}>Current Plan</Text>
                <Text style={styles.activeText}>{membership.plan?.name || membership.plan_id}</Text>
              </View>
              <Ionicons name="ribbon-outline" size={22} color="#166534" />
            </View>
          </View>
        )}
        {plans.map((plan) => (
          <View key={plan.id} style={styles.card}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.price}>₹{Number(plan.price || 0).toFixed(2)}</Text>
            </View>
            <Text style={styles.planDesc}>{plan.description || 'Membership plan'}</Text>
            {(groupedBenefits[plan.id] || []).map((b) => (
              <Text key={b.id} style={styles.benefit}>• {b.title}</Text>
            ))}
            <TouchableOpacity
              style={[styles.btn, membership?.plan_id === plan.id && styles.btnDisabled]}
              onPress={() => subscribe(plan.id)}
              disabled={membership?.plan_id === plan.id}
            >
              <Text style={styles.btnText}>{membership?.plan_id === plan.id ? 'Active Plan' : 'Subscribe'}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  activeCard: { backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#86EFAC', borderRadius: 10, padding: SPACING.md, marginBottom: SPACING.md },
  activeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activeLabel: { color: '#166534', fontSize: SIZES.sm },
  activeText: { color: '#166534', fontWeight: '700', marginTop: 4, fontSize: SIZES.md },
  card: { backgroundColor: COLORS.white, marginBottom: SPACING.md, borderRadius: 10, padding: SPACING.md },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { fontSize: SIZES.lg, fontWeight: '800', color: COLORS.textHeading },
  planDesc: { marginTop: 4, color: COLORS.textSecondary },
  price: { fontSize: SIZES.md, color: COLORS.primary, fontWeight: '700' },
  benefit: { marginTop: 4, color: COLORS.text, fontSize: SIZES.sm },
  btn: { marginTop: SPACING.md, backgroundColor: COLORS.primary, borderRadius: 8, alignItems: 'center', paddingVertical: 12 },
  btnDisabled: { opacity: 0.65 },
  btnText: { color: '#FFF', fontWeight: '700' },
});

