import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
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
      <ScrollView>
        <View style={styles.card}>
          <Text style={styles.label}>Your Referral Code</Text>
          <Text style={styles.code}>{code || 'Generating...'}</Text>
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
              <Text style={styles.rowStatus}>{e.status}</Text>
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
  card: { backgroundColor: COLORS.white, margin: SPACING.md, padding: SPACING.md, borderRadius: 10 },
  label: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginBottom: 6 },
  code: { fontSize: SIZES.xl, fontWeight: 'bold', color: COLORS.textHeading },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: SPACING.md, height: 44, color: COLORS.text },
  btn: { marginTop: SPACING.sm, backgroundColor: COLORS.primary, borderRadius: 8, alignItems: 'center', paddingVertical: 12 },
  btnText: { color: '#FFF', fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: SPACING.sm },
  rowText: { color: COLORS.textHeading, fontWeight: '600' },
  rowStatus: { color: COLORS.textSecondary },
  empty: { color: COLORS.textSecondary },
});

