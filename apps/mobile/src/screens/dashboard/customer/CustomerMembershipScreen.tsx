import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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
    await apiFetch('/api/customer/membership/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: planId }),
    });
    await load();
  };

  return (
    <View style={styles.container}>
      <DashboardHeader title="Membership" onBack={() => navigation.goBack()} />
      <ScrollView>
        {membership && (
          <View style={styles.activeCard}>
            <Text style={styles.activeText}>Active: {membership.plan?.name || membership.plan_id}</Text>
          </View>
        )}
        {plans.map((plan) => (
          <View key={plan.id} style={styles.card}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planDesc}>{plan.description || 'Membership plan'}</Text>
            <Text style={styles.price}>₹{Number(plan.price || 0).toFixed(2)}</Text>
            {(groupedBenefits[plan.id] || []).map((b) => (
              <Text key={b.id} style={styles.benefit}>• {b.title}</Text>
            ))}
            <TouchableOpacity style={styles.btn} onPress={() => subscribe(plan.id)}>
              <Text style={styles.btnText}>Subscribe</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  activeCard: { margin: SPACING.md, backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#86EFAC', borderRadius: 10, padding: SPACING.md },
  activeText: { color: '#166534', fontWeight: '700' },
  card: { backgroundColor: COLORS.white, marginHorizontal: SPACING.md, marginBottom: SPACING.md, borderRadius: 10, padding: SPACING.md },
  planName: { fontSize: SIZES.lg, fontWeight: '800', color: COLORS.textHeading },
  planDesc: { marginTop: 4, color: COLORS.textSecondary },
  price: { marginTop: 8, fontSize: SIZES.lg, color: COLORS.primary, fontWeight: '700' },
  benefit: { marginTop: 4, color: COLORS.text, fontSize: SIZES.sm },
  btn: { marginTop: SPACING.md, backgroundColor: COLORS.primary, borderRadius: 8, alignItems: 'center', paddingVertical: 12 },
  btnText: { color: '#FFF', fontWeight: '700' },
});

