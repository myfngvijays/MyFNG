import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function FinanceReconciliationScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reconciliation, setReconciliation] = useState<any>({
    totalRevenue: 0,
    totalPayouts: 0,
    totalRefunds: 0,
    netAmount: 0,
    discrepancies: [],
  });

  useEffect(() => {
    fetchReconciliation();
  }, []);

  const fetchReconciliation = async () => {
    try {
      setLoading(true);
      
      // Fetch revenue
      const { data: revenueData } = await supabase
        .from('service_leads')
        .select('invoice_amount, actual_amount')
        .in('status', ['COMPLETED', 'CLOSED']);

      const totalRevenue = (revenueData || []).reduce(
        (sum: number, lead: any) => sum + (lead.invoice_amount || lead.actual_amount || 0),
        0
      );

      // Fetch payouts
      const { data: payoutData } = await supabase
        .from('workshop_payouts')
        .select('net_amount_after_tax')
        .eq('status', 'COMPLETED');

      const totalPayouts = (payoutData || []).reduce(
        (sum: number, payout: any) => sum + (payout.net_amount_after_tax || 0),
        0
      );

      // Fetch refunds
      const { data: refundData } = await supabase
        .from('refund_requests')
        .select('amount')
        .eq('status', 'APPROVED');

      const totalRefunds = (refundData || []).reduce(
        (sum: number, refund: any) => sum + (refund.amount || 0),
        0
      );

      const netAmount = totalRevenue - totalPayouts - totalRefunds;

      setReconciliation({
        totalRevenue,
        totalPayouts,
        totalRefunds,
        netAmount,
        discrepancies: [],
      });
    } catch (error) {
      console.error('Error fetching reconciliation:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReconciliation();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading reconciliation...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Reconciliation" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Revenue</Text>
            <Text style={[styles.summaryValue, { color: COLORS.success }]}>
              ₹{reconciliation.totalRevenue.toLocaleString()}
            </Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Payouts</Text>
            <Text style={[styles.summaryValue, { color: COLORS.info }]}>
              ₹{reconciliation.totalPayouts.toLocaleString()}
            </Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Refunds</Text>
            <Text style={[styles.summaryValue, { color: COLORS.warning }]}>
              ₹{reconciliation.totalRefunds.toLocaleString()}
            </Text>
          </View>
          
          <View style={[styles.summaryCard, styles.netCard]}>
            <Text style={styles.summaryLabel}>Net Amount</Text>
            <Text style={[
              styles.summaryValue,
              { color: reconciliation.netAmount >= 0 ? COLORS.success : COLORS.danger }
            ]}>
              ₹{reconciliation.netAmount.toLocaleString()}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  summaryContainer: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: 8,
    alignItems: 'center',
  },
  netCard: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  summaryLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  summaryValue: {
    fontSize: SIZES.xxl,
    fontWeight: 'bold',
  },
});
