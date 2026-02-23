import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
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
      <ScrollView>
        <View style={styles.card}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} value={form.full_name} onChangeText={(t) => setForm((s) => ({ ...s, full_name: t }))} />
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={form.email} onChangeText={(t) => setForm((s) => ({ ...s, email: t }))} keyboardType="email-address" />
          <Text style={styles.label}>Phone</Text>
          <TextInput style={[styles.input, styles.disabled]} value={form.phone} editable={false} />
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
  card: { backgroundColor: COLORS.white, margin: SPACING.md, borderRadius: 10, padding: SPACING.md },
  label: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginBottom: 6 },
  input: { height: 44, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: SPACING.md, marginBottom: SPACING.md, color: COLORS.text },
  disabled: { backgroundColor: COLORS.gray[100] },
  btn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '700' },
});

