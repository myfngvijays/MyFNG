import React, { useState, useEffect } from 'react';
import { formatDateDMY } from "@/lib/dateFormat";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function BillingPaymentTrackingScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [stats, setStats] = useState({
    totalPaid: 0,
    totalPending: 0,
    totalOverdue: 0,
    totalAmount: 0,
  });

  useEffect(() => {
    fetchPayments();
  }, [filter]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('service_leads')
        .select('*, workshop:workshops(name)')
        .not('invoice_amount', 'is', null)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('payment_status', filter.toUpperCase());
      }

      const { data, error } = await query;
      if (error) throw error;

      const paymentsData = data || [];
      setPayments(paymentsData);

      // Calculate stats
      const totalPaid = paymentsData.filter((p: any) => p.payment_status === 'PAID').length;
      const totalPending = paymentsData.filter((p: any) => 
        p.payment_status === 'PENDING' || !p.payment_status
      ).length;
      const totalOverdue = paymentsData.filter((p: any) => p.payment_status === 'OVERDUE').length;
      const totalAmount = paymentsData.reduce((sum: number, p: any) => 
        sum + (p.invoice_amount || 0), 0
      );

      setStats({
        totalPaid,
        totalPending,
        totalOverdue,
        totalAmount,
      });
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPayments();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PAID':
        return COLORS.success;
      case 'PENDING':
        return COLORS.warning;
      case 'OVERDUE':
        return COLORS.danger;
      default:
        return COLORS.textSecondary;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading payments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Payment Tracking" onBack={() => navigation.goBack()} />
      
      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalPaid}</Text>
          <Text style={styles.statLabel}>Paid</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalPending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalOverdue}</Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { fontSize: SIZES.md }]}>
            ₹{(stats.totalAmount / 1000).toFixed(1)}K
          </Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {(['all', 'paid', 'pending', 'overdue'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterButton,
              filter === f && styles.filterButtonActive
            ]}
            onPress={() => setFilter(f)}
          >
            <Text style={[
              styles.filterButtonText,
              filter === f && styles.filterButtonTextActive
            ]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {payments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No payments found</Text>
          </View>
        ) : (
          payments.map((payment, index) => (
            <TouchableOpacity
              key={payment.id || index}
              style={styles.paymentCard}
              onPress={() => navigation.navigate('BillingInvoiceDetail', { invoiceId: payment.id })}
            >
              <View style={styles.paymentHeader}>
                <View style={styles.paymentLeft}>
                  <Text style={styles.invoiceNumber}>
                    {payment.invoice_number || payment.lead_number}
                  </Text>
                  <Text style={styles.customerName}>{payment.customer_name}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(payment.payment_status) }
                  ]}
                >
                  <Text style={styles.statusText}>
                    {payment.payment_status || 'PENDING'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.paymentDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount:</Text>
                  <Text style={styles.amountValue}>₹{payment.invoice_amount || 0}</Text>
                </View>
                {payment.workshop?.name && (
                  <Text style={styles.workshopName}>{payment.workshop.name}</Text>
                )}
                <Text style={styles.paymentDate}>
                  {formatDateDMY(payment.created_at)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
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
  statsContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: SIZES.xs,
    color: COLORS.text,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
  },
  paymentCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  paymentLeft: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.xs,
  },
  customerName: {
    fontSize: SIZES.sm,
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: SIZES.xs,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  paymentDetails: {
    marginTop: SPACING.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  detailLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
  amountValue: {
    fontSize: SIZES.md,
    color: COLORS.success,
    fontWeight: 'bold',
  },
  workshopName: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  paymentDate: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
});
