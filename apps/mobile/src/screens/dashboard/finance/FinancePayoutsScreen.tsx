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
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function FinancePayoutsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'completed'>('all');

  useEffect(() => {
    fetchPayouts();
  }, [filter]);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('workshop_payouts')
        .select('*, workshop:workshops(name)')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter.toUpperCase());
      }

      const { data, error } = await query;
      if (error) throw error;
      setPayouts(data || []);
    } catch (error) {
      console.error('Error fetching payouts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPayouts();
  };

  const handleApprovePayout = async (id: string) => {
    Alert.alert(
      'Approve Payout',
      'Are you sure you want to approve this payout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('workshop_payouts')
                .update({
                  status: 'APPROVED',
                  approved_at: new Date().toISOString(),
                })
                .eq('id', id);

              if (error) throw error;
              Alert.alert('Success', 'Payout approved');
              fetchPayouts();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to approve payout');
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
        return COLORS.info;
      case 'COMPLETED':
        return COLORS.success;
      case 'FAILED':
        return COLORS.danger;
      default:
        return COLORS.textSecondary;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading payouts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Payouts" onBack={() => navigation.goBack()} />
      
      <View style={styles.filterContainer}>
        {(['all', 'pending', 'approved', 'completed'] as const).map((f) => (
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
        {payouts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No payouts found</Text>
          </View>
        ) : (
          payouts.map((payout, index) => (
            <View key={payout.id || index} style={styles.payoutCard}>
              <View style={styles.payoutHeader}>
                <View style={styles.payoutLeft}>
                  <Text style={styles.payoutId}>#{payout.id?.slice(0, 8)}</Text>
                  <Text style={styles.workshopName}>
                    {payout.workshop?.name || 'Workshop'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(payout.status) }
                  ]}
                >
                  <Text style={styles.statusText}>{payout.status}</Text>
                </View>
              </View>
              
              <View style={styles.payoutDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount:</Text>
                  <Text style={styles.amountValue}>
                    ₹{payout.net_amount_after_tax || payout.amount || 0}
                  </Text>
                </View>
                <Text style={styles.payoutDate}>
                  {formatDateDMY(payout.created_at)}
                </Text>
              </View>
              
              {payout.status === 'PENDING' && (
                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={() => handleApprovePayout(payout.id)}
                >
                  <Text style={styles.approveButtonText}>Approve Payout</Text>
                </TouchableOpacity>
              )}
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
  payoutCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  payoutLeft: {
    flex: 1,
  },
  payoutId: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.xs,
  },
  workshopName: {
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
  payoutDetails: {
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
  amountValue: {
    fontSize: SIZES.md,
    color: COLORS.success,
    fontWeight: 'bold',
  },
  payoutDate: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
  approveButton: {
    backgroundColor: COLORS.success,
    padding: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  approveButtonText: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
});
