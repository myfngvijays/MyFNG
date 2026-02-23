import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CustomerReferScreen({ navigation }: any) {
  const [code, setCode] = useState('');
  const [applyCode, setApplyCode] = useState('');
  const [events, setEvents] = useState<any[]>([]);

  const load = async () => {
    const res = await apiFetch<{ code: any; events: any[] }>('/api/customer/referral');
    setCode(res.code?.code || '');
    setEvents(res.events || []);
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const onApply = async () => {
    try {
      await apiFetch('/api/customer/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referral_code: applyCode.trim().toUpperCase() }),
      });
      setApplyCode('');
      Alert.alert('Success', 'Referral code applied');
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to apply code');
    }
  };

  return (
    <View style={styles.container}>
      <DashboardHeader title="Refer & Earn" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View>
            <Text style={styles.labelLight}>Your Referral Code</Text>
            <Text style={styles.code}>{code || 'Generating...'}</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <Ionicons name="gift-outline" size={22} color={COLORS.white} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Apply Referral Code</Text>
          <TextInput style={styles.input} value={applyCode} onChangeText={setApplyCode} placeholder="Enter code" autoCapitalize="characters" />
          <TouchableOpacity style={styles.btn} onPress={onApply}>
            <Text style={styles.btnText}>Apply</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Referral Events</Text>
          {events.map((e) => (
            <View key={e.id} style={styles.row}>
              <Text style={styles.rowText}>{e.referral_code}</Text>
              <View style={styles.statusPill}>
                <Text style={styles.rowStatus}>{e.status}</Text>
              </View>
            </View>
          ))}
          {events.length === 0 && <Text style={styles.empty}>No referral events yet</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  heroCard: {
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: 10, marginBottom: SPACING.md },
  labelLight: { fontSize: SIZES.sm, color: 'rgba(255,255,255,0.82)', marginBottom: 6 },
  label: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginBottom: 6 },
  code: { fontSize: SIZES.xl, fontWeight: 'bold', color: COLORS.white },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: SPACING.md, height: 44, color: COLORS.text },
  btn: { marginTop: SPACING.sm, backgroundColor: COLORS.primary, borderRadius: 8, alignItems: 'center', paddingVertical: 12 },
  btnText: { color: '#FFF', fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: SPACING.sm },
  rowText: { color: COLORS.textHeading, fontWeight: '600' },
  statusPill: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  rowStatus: { color: COLORS.primary, fontWeight: '700', fontSize: 11 },
  empty: { color: COLORS.textSecondary },
});

