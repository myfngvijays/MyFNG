/**
 * Payment Tracking Screen - Billing
 * Track payment status and history with real-time updates
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function PaymentTrackingScreen({ navigation }: any) {
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetchPayments();
    const channel = supabase.channel('payments').on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchPayments).subscribe();
    return () => { channel.unsubscribe(); };
  }, [filter]);

  const fetchPayments = async () => {
    try {
      let query = supabase.from('payments').select('*, invoice:invoice_id(invoice_number, total_amount), lead:lead_id(lead_number, customer_name)').order('created_at', { ascending: false });
      
      if (filter !== 'ALL') {
        query = query.eq('status', filter);
      }

      const { data } = await query;
      setPayments(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return COLORS.success;
      case 'PENDING': return COLORS.warning;
      case 'FAILED': return COLORS.danger;
      case 'REFUNDED': return COLORS.info;
      default: return COLORS.gray[500];
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'CASH': return 'cash';
      case 'CARD': return 'card';
      case 'UPI': return 'logo-google';
      case 'BANK_TRANSFER': return 'business';
      default: return 'wallet';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Payment Tracking</Text>
        <Text style={styles.count}>{payments.length} Payments</Text>
      </View>

      <View style={styles.filters}>
        {['ALL', 'PENDING', 'PAID', 'FAILED'].map(status => (
          <TouchableOpacity key={status} style={[styles.filterBtn, filter === status && styles.filterBtnActive]} onPress={() => setFilter(status)}>
            <Text style={[styles.filterText, filter === status && styles.filterTextActive]}>{status}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList data={payments} keyExtractor={item => item.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPayments(); }} />} renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => navigation?.navigate('PaymentDetail', { id: item.id })}>
          <View style={styles.cardHeader}>
            <Ionicons name={getPaymentMethodIcon(item.payment_method)} size={24} color={COLORS.primary} />
            <View style={styles.cardInfo}>
              <Text style={styles.invoiceNo}>{item.invoice?.invoice_number}</Text>
              <Text style={styles.leadNo}>{item.lead?.lead_number} • {item.lead?.customer_name}</Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.amount}>₹{item.amount?.toFixed(2)}</Text>
              <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>
          </View>
          {item.transaction_id && (
            <View style={styles.transactionRow}>
              <Ionicons name="information-circle" size={16} color={COLORS.gray[500]} />
              <Text style={styles.transactionText}>Txn: {item.transaction_id}</Text>
            </View>
          )}
        </TouchableOpacity>
      )} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: { padding: SPACING.lg, backgroundColor: COLORS.white },
  title: { fontSize: SIZES.xxl, fontWeight: 'bold' },
  count: { fontSize: SIZES.sm, color: COLORS.gray[600], marginTop: SPACING.xs },
  filters: { flexDirection: 'row', padding: SPACING.md, gap: SPACING.sm },
  filterBtn: { flex: 1, padding: SPACING.sm, borderRadius: SIZES.xs, backgroundColor: COLORS.white, alignItems: 'center', borderWidth: 1, borderColor: COLORS.gray[300] },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: SIZES.sm, color: COLORS.gray[700], fontWeight: '600' },
  filterTextActive: { color: COLORS.white },
  card: { backgroundColor: COLORS.white, margin: SPACING.md, marginTop: 0, padding: SPACING.md, borderRadius: SIZES.sm, borderWidth: 1, borderColor: COLORS.gray[200] },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cardInfo: { flex: 1 },
  invoiceNo: { fontSize: SIZES.md, fontWeight: 'bold', color: COLORS.gray[900] },
  leadNo: { fontSize: SIZES.sm, color: COLORS.gray[600], marginTop: 4 },
  date: { fontSize: SIZES.xs, color: COLORS.gray[500], marginTop: 4 },
  cardRight: { alignItems: 'flex-end' },
  amount: { fontSize: SIZES.lg, fontWeight: 'bold', color: COLORS.primary, marginBottom: SPACING.xs },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: SIZES.xs },
  badgeText: { color: COLORS.white, fontSize: SIZES.xs, fontWeight: '600' },
  transactionRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.gray[100], gap: SPACING.xs },
  transactionText: { fontSize: SIZES.xs, color: COLORS.gray[500] },
});

