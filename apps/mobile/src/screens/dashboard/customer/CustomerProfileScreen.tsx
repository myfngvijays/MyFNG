import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CustomerProfileScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' });

  const load = async () => {
    try {
      const res = await apiFetch<{ customer: any }>('/api/customer/profile');
      const c = res.customer || {};
      setForm({
        full_name: c.full_name || '',
        email: c.email || '',
        phone: c.phone || '',
      });
    } catch (e) {
      console.error('Failed to load profile', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    try {
      await apiFetch('/api/customer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: form.full_name, email: form.email }),
      });
      Alert.alert('Success', 'Profile updated');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update');
    }
  };

  return (
    <View style={styles.container}>
      <DashboardHeader title="My Profile" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroName}>{form.full_name || 'Customer'}</Text>
            <Text style={styles.heroSub}>{form.phone ? `+91 ${form.phone}` : 'Mobile not available'}</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <Ionicons name="person-outline" size={24} color={COLORS.primary} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Basic Details</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={form.full_name}
            onChangeText={(t) => setForm((s) => ({ ...s, full_name: t }))}
            placeholder="Enter full name"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={form.email}
            onChangeText={(t) => setForm((s) => ({ ...s, email: t }))}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="Enter email"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput style={[styles.input, styles.disabled]} value={form.phone} editable={false} />
          <Text style={styles.readonlyHint}>Phone number is linked with OTP login and cannot be edited.</Text>

          <TouchableOpacity style={styles.btn} onPress={save}>
            <Text style={styles.btnText}>Save Profile</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  heroCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLeft: { flex: 1 },
  heroName: { fontSize: SIZES.lg, fontWeight: '800', color: COLORS.textHeading },
  heroSub: { marginTop: 4, color: COLORS.textSecondary, fontSize: SIZES.sm },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { backgroundColor: COLORS.white, borderRadius: 10, padding: SPACING.md },
  sectionTitle: { fontSize: SIZES.md, color: COLORS.textHeading, fontWeight: '700', marginBottom: SPACING.sm },
  label: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginBottom: 6 },
  input: { height: 44, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: SPACING.md, marginBottom: SPACING.md, color: COLORS.text },
  disabled: { backgroundColor: COLORS.gray[100] },
  readonlyHint: { marginTop: -6, marginBottom: SPACING.md, color: COLORS.textSecondary, fontSize: SIZES.xs },
  btn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '700' },
});

