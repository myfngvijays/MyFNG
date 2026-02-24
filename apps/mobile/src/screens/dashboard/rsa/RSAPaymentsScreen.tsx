import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Linking } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';
import { apiFetch } from '../../../lib/api';

export default function RSAPaymentsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', amount: '', notes: '' });
  const [refundId, setRefundId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const linksRes = await apiFetch<any>('/api/telecaller/direct-pay-links?limit=200');
      setLinks(Array.isArray(linksRes?.links) ? linksRes.links : []);
      const payRes = await apiFetch<any>('/api/rsa_manager/payments?limit=200');
      setPayments(Array.isArray(payRes?.payments) ? payRes.payments : []);
    } catch (e) {
      console.error('load rsa payments failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    try {
      await apiFetch('/api/telecaller/direct-pay-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          amount: Number(form.amount || 0),
          notes: form.notes || null,
        }),
      });
      setForm({ customer_name: '', customer_phone: '', amount: '', notes: '' });
      load();
    } catch (e) {
      console.error('generate link failed', e);
    }
  };

  const refreshStatus = async () => {
    try {
      await apiFetch('/api/telecaller/direct-pay-links/status', { method: 'POST' });
      load();
    } catch (e) {
      console.error('status refresh failed', e);
    }
  };

  const cancelLink = async (ref: string) => {
    try {
      await apiFetch('/api/telecaller/direct-pay-links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref, action: 'cancel' }),
      });
      load();
    } catch (e) {
      console.error('cancel link failed', e);
    }
  };

  const submitRefund = async () => {
    if (!refundId || !refundAmount) return;
    try {
      await apiFetch('/api/rsa_manager/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: refundId, amount: Number(refundAmount) }),
      });
      setRefundId('');
      setRefundAmount('');
      load();
    } catch (e) {
      console.error('refund failed', e);
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
      <DashboardHeader title="RSA Payments" onBack={handleBack} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Generate Payment Link</Text>
            <TextInput style={styles.input} placeholder="Customer Name" value={form.customer_name} onChangeText={(v) => setForm((p) => ({ ...p, customer_name: v }))} />
            <TextInput style={styles.input} placeholder="Phone" value={form.customer_phone} onChangeText={(v) => setForm((p) => ({ ...p, customer_phone: v }))} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="Amount" value={form.amount} onChangeText={(v) => setForm((p) => ({ ...p, amount: v }))} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Notes" value={form.notes} onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))} />
            <View style={styles.row}>
              <TouchableOpacity style={styles.primaryBtn} onPress={generate}><Text style={styles.primaryBtnText}>Generate</Text></TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={refreshStatus}><Text style={styles.secondaryBtnText}>Refresh Status</Text></TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Generated Links</Text>
            {links.map((row: any) => (
              <View key={row.id || row.ref} style={styles.listItem}>
                <Text style={styles.listTitle}>{row.customer_name || row.customer_phone || 'Link'}</Text>
                <Text style={styles.subtle}>Status: {row.status || '—'}</Text>
                <View style={styles.row}>
                  {row.link ? <TouchableOpacity style={styles.secondaryBtn} onPress={() => Linking.openURL(String(row.link))}><Text style={styles.secondaryBtnText}>Open</Text></TouchableOpacity> : null}
                  {row.ref ? <TouchableOpacity style={styles.dangerBtn} onPress={() => cancelLink(String(row.ref))}><Text style={styles.primaryBtnText}>Cancel</Text></TouchableOpacity> : null}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Refund</Text>
            <TextInput style={styles.input} placeholder="Payment ID" value={refundId} onChangeText={setRefundId} />
            <TextInput style={styles.input} placeholder="Amount" value={refundAmount} onChangeText={setRefundAmount} keyboardType="numeric" />
            <TouchableOpacity style={styles.dangerBtn} onPress={submitRefund}><Text style={styles.primaryBtnText}>Submit Refund</Text></TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payments</Text>
            {payments.map((row: any, idx: number) => (
              <View key={row.id || idx} style={styles.listItem}>
                <Text style={styles.listTitle}>{row.customer_name || row.customer_phone || row.id}</Text>
                <Text style={styles.subtle}>Amount: {row.amount || row.paid_amount || 0} • Status: {row.status || '—'}</Text>
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
  sectionTitle: { fontSize: SIZES.sm, fontWeight: '700', color: COLORS.textHeading, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: SPACING.sm, backgroundColor: COLORS.white },
  row: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  primaryBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: SPACING.sm, alignItems: 'center' },
  primaryBtnText: { color: COLORS.white, fontSize: SIZES.xs, fontWeight: '700' },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, paddingVertical: SPACING.sm, alignItems: 'center' },
  secondaryBtnText: { color: COLORS.primary, fontSize: SIZES.xs, fontWeight: '700' },
  dangerBtn: { flex: 1, backgroundColor: COLORS.error, borderRadius: 8, paddingVertical: SPACING.sm, alignItems: 'center' },
  listItem: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.xs, marginTop: SPACING.xs },
  listTitle: { fontSize: SIZES.sm, fontWeight: '600', color: COLORS.textHeading },
  subtle: { fontSize: SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
});
