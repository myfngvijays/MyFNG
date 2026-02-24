import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';
import { apiFetch } from '../../../lib/api';

export default function RSACarServiceEnquiryScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', car_model: '', remark: '' });

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>('/api/rsa_manager/car-service-enquiries?limit=200');
      setRows(Array.isArray(data?.enquiries) ? data.enquiries : []);
    } catch (e) {
      console.error('car enquiry load failed', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    try {
      await apiFetch('/api/rsa_manager/car-service-enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm({ customer_name: '', customer_phone: '', car_model: '', remark: '' });
      load();
    } catch (e) {
      console.error('car enquiry submit failed', e);
    }
  };

  const handleBack = () => {
    if (typeof navigation?.canGoBack === 'function' && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (typeof navigation?.goBack === 'function') {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.('RSAManagerDashboard');
  };

  return (
    <View style={styles.container}>
      <DashboardHeader title="Car Service Enquiry" onBack={handleBack} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Create Enquiry</Text>
            <TextInput style={styles.input} placeholder="Customer Name" value={form.customer_name} onChangeText={(v) => setForm((p) => ({ ...p, customer_name: v }))} />
            <TextInput style={styles.input} placeholder="Phone" value={form.customer_phone} onChangeText={(v) => setForm((p) => ({ ...p, customer_phone: v }))} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="Car Model" value={form.car_model} onChangeText={(v) => setForm((p) => ({ ...p, car_model: v }))} />
            <TextInput style={styles.input} placeholder="Remark" value={form.remark} onChangeText={(v) => setForm((p) => ({ ...p, remark: v }))} />
            <TouchableOpacity style={styles.primaryBtn} onPress={submit}><Text style={styles.primaryBtnText}>Submit</Text></TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Submitted Enquiries</Text>
            {rows.map((row: any) => (
              <View key={row.id} style={styles.listItem}>
                <Text style={styles.title}>{row.customer_name || 'Customer'} ({row.customer_phone_raw || row.customer_phone_norm || '—'})</Text>
                <Text style={styles.subtle}>{row.car_model || '—'} • {row.remark || '—'}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
  card: { backgroundColor: COLORS.white, borderRadius: 10, padding: SPACING.sm, gap: SPACING.xs },
  sectionTitle: { fontSize: SIZES.sm, fontWeight: '700', color: COLORS.textHeading },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.white, padding: SPACING.sm },
  primaryBtn: { marginTop: SPACING.xs, backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: SPACING.sm, alignItems: 'center' },
  primaryBtnText: { color: COLORS.white, fontSize: SIZES.sm, fontWeight: '700' },
  listItem: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.xs, marginTop: SPACING.xs },
  title: { fontSize: SIZES.sm, fontWeight: '600', color: COLORS.textHeading },
  subtle: { fontSize: SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
});
