import React, { useState, useEffect } from 'react';
import {
import { formatDateDMY } from "@/lib/dateFormat";
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function FinanceRefundsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    fetchRefunds();
  }, [filter]);

  const fetchRefunds = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('refund_requests')
        .select('*, lead:service_leads(lead_number, customer_name, invoice_amount)')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter.toUpperCase());
      }

      const { data, error } = await query;

      if (error) throw error;
      setRefunds(data || []);
    } catch (error) {
      console.error('Error fetching refunds:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRefunds();
  };

  const handleApproveRefund = async (id: string) => {
    Alert.alert(
      'Approve Refund',
      'Are you sure you want to approve this refund?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('refund_requests')
                .update({
                  status: 'APPROVED',
                  approved_at: new Date().toISOString(),
                })
                .eq('id', id);

              if (error) throw error;
              Alert.alert('Success', 'Refund approved');
              fetchRefunds();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to approve refund');
            }
          },
        },
      ]
    );
  };

  const handleRejectRefund = async (id: string) => {
    Alert.alert(
      'Reject Refund',
      'Are you sure you want to reject this refund?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('refund_requests')
                .update({
                  status: 'REJECTED',
                  rejected_at: new Date().toISOString(),
                })
                .eq('id', id);

              if (error) throw error;
              Alert.alert('Success', 'Refund rejected');
              fetchRefunds();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to reject refund');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return COLORS.warning;
      case 'APPROVED':
        return COLORS.success;
      case 'REJECTED':
        return COLORS.danger;
      default:
        return COLORS.textSecondary;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading refunds...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Refunds" onBack={() => navigation.goBack()} />
      
      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
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
        {refunds.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No refund requests found</Text>
          </View>
        ) : (
          refunds.map((refund, index) => (
            <View key={refund.id || index} style={styles.refundCard}>
              <View style={styles.refundHeader}>
                <View style={styles.refundLeft}>
                  <Text style={styles.refundId}>#{refund.id.slice(0, 8)}</Text>
                  <Text style={styles.leadNumber}>
                    {refund.lead?.lead_number || 'N/A'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(refund.status) }
                  ]}
                >
                  <Text style={styles.statusText}>{refund.status}</Text>
                </View>
              </View>
              
              <View style={styles.refundDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Customer:</Text>
                  <Text style={styles.detailValue}>{refund.lead?.customer_name || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount:</Text>
                  <Text style={[styles.amountValue]}>₹{refund.amount || 0}</Text>
                </View>
                {refund.reason && (
                  <View style={styles.reasonContainer}>
                    <Text style={styles.reasonLabel}>Reason:</Text>
                    <Text style={styles.reasonText}>{refund.reason}</Text>
                  </View>
                )}
              </View>
              
              {refund.status === 'PENDING' && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleRejectRefund(refund.id)}
                  >
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => handleApproveRefund(refund.id)}
                  >
                    <Text style={styles.approveButtonText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              <Text style={styles.refundDate}>
                Requested: {formatDateDMY(refund.created_at)}
              </Text>
            </View>
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
  refundCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  refundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  refundLeft: {
    flex: 1,
  },
  refundId: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.xs,
  },
  leadNumber: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
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
  refundDetails: {
    marginBottom: SPACING.sm,
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
  detailValue: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  amountValue: {
    fontSize: SIZES.md,
    color: COLORS.success,
    fontWeight: 'bold',
  },
  reasonContainer: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.gray[50],
    borderRadius: 8,
  },
  reasonLabel: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  reasonText: {
    fontSize: SIZES.sm,
    color: COLORS.text,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: COLORS.danger,
  },
  approveButton: {
    backgroundColor: COLORS.success,
  },
  rejectButtonText: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
  approveButtonText: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
  refundDate: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
});
