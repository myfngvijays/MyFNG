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

export default function FinanceChargebacksScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chargebacks, setChargebacks] = useState<any[]>([]);

  useEffect(() => {
    fetchChargebacks();
  }, []);

  const fetchChargebacks = async () => {
    try {
      setLoading(true);
      // Adjust table name as needed
      const { data, error } = await supabase
        .from('chargebacks')
        .select('*, lead:service_leads(lead_number, customer_name, invoice_amount)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error && error.code !== 'PGRST116') throw error;
      
      setChargebacks(data || []);
    } catch (error) {
      console.error('Error fetching chargebacks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchChargebacks();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return COLORS.warning;
      case 'RESOLVED':
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
        <Text style={styles.loadingText}>Loading chargebacks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Chargebacks" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {chargebacks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No chargebacks found</Text>
          </View>
        ) : (
          chargebacks.map((chargeback, index) => (
            <View key={chargeback.id || index} style={styles.chargebackCard}>
              <View style={styles.chargebackHeader}>
                <View style={styles.chargebackLeft}>
                  <Text style={styles.chargebackId}>#{chargeback.id?.slice(0, 8)}</Text>
                  <Text style={styles.leadNumber}>
                    {chargeback.lead?.lead_number || 'N/A'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(chargeback.status) }
                  ]}
                >
                  <Text style={styles.statusText}>{chargeback.status || 'PENDING'}</Text>
                </View>
              </View>
              
              <View style={styles.chargebackDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Customer:</Text>
                  <Text style={styles.detailValue}>{chargeback.lead?.customer_name || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount:</Text>
                  <Text style={[styles.amountValue]}>₹{chargeback.amount || 0}</Text>
                </View>
                {chargeback.reason && (
                  <Text style={styles.reasonText}>Reason: {chargeback.reason}</Text>
                )}
              </View>
              
              <Text style={styles.chargebackDate}>
                Date: {new Date(chargeback.created_at).toLocaleDateString()}
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
  chargebackCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  chargebackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  chargebackLeft: {
    flex: 1,
  },
  chargebackId: {
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
  chargebackDetails: {
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
    color: COLORS.danger,
    fontWeight: 'bold',
  },
  reasonText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  chargebackDate: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
});
