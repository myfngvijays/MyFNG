/**
 * Billing Dashboard Screen - Mobile
 * Overview of billing and invoices
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function BillingDashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, paid: 0, overdue: 0 });

  useEffect(() => {
    fetchBillingStats();
    const channel = supabase.channel('billing').on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, fetchBillingStats).subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  const fetchBillingStats = async () => {
    try {
      const { data } = await supabase.from('invoices').select('*');
      setStats({
        total: data?.length || 0,
        pending: data?.filter(i => i.status === 'PENDING').length || 0,
        paid: data?.filter(i => i.status === 'PAID').length || 0,
        overdue: data?.filter(i => i.status === 'OVERDUE').length || 0,
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBillingStats(); }} />}>
      <View style={styles.header}><Text style={styles.title}>Billing Dashboard</Text></View>
      <View style={styles.grid}>
        <View style={styles.card}><Ionicons name="document-text" size={32} color={COLORS.primary} /><Text style={styles.value}>{stats.total}</Text><Text style={styles.label}>Total Invoices</Text></View>
        <View style={styles.card}><Ionicons name="time" size={32} color={COLORS.warning} /><Text style={styles.value}>{stats.pending}</Text><Text style={styles.label}>Pending</Text></View>
        <View style={styles.card}><Ionicons name="checkmark-circle" size={32} color={COLORS.success} /><Text style={styles.value}>{stats.paid}</Text><Text style={styles.label}>Paid</Text></View>
        <View style={styles.card}><Ionicons name="alert-circle" size={32} color={COLORS.danger} /><Text style={styles.value}>{stats.overdue}</Text><Text style={styles.label}>Overdue</Text></View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: { padding: SPACING.lg, backgroundColor: COLORS.white },
  title: { fontSize: SIZES.xxl, fontWeight: 'bold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: SPACING.md, gap: SPACING.md },
  card: { flex: 1, minWidth: '45%', backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: SIZES.sm, alignItems: 'center' },
  value: { fontSize: SIZES.xxl, fontWeight: 'bold', marginTop: SPACING.sm },
  label: { fontSize: SIZES.sm, color: COLORS.gray[600], marginTop: SPACING.xs, textAlign: 'center' },
});

