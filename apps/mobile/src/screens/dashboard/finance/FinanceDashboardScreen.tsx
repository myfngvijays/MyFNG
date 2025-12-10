import React, { useState, useEffect } from 'react';
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

export default function FinanceDashboardScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    pendingPayouts: 0,
    pendingRefunds: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const { data: payouts } = await supabase
        .from('workshop_payouts')
        .select('amount')
        .eq('status', 'PENDING');

      const { data: refunds } = await supabase
        .from('refund_requests')
        .select('amount')
        .eq('status', 'PENDING');

      const pendingPayouts = payouts?.length || 0;
      const pendingRefunds = refunds?.length || 0;

      setStats({
        pendingPayouts,
        pendingRefunds,
        totalRevenue: 2450000,
        monthlyRevenue: 125000,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Finance Dashboard" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.pendingPayouts}</Text>
            <Text style={styles.statLabel}>Pending Payouts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.pendingRefunds}</Text>
            <Text style={styles.statLabel}>Pending Refunds</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { fontSize: SIZES.md }]}>
              ₹{(stats.totalRevenue / 100000).toFixed(1)}L
            </Text>
            <Text style={styles.statLabel}>Total Revenue</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { fontSize: SIZES.md }]}>
              ₹{(stats.monthlyRevenue / 1000).toFixed(1)}K
            </Text>
            <Text style={styles.statLabel}>Monthly Revenue</Text>
          </View>
        </View>

        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('FinancePayouts')}
            >
              <Text style={styles.actionIcon}>💰</Text>
              <Text style={styles.actionLabel}>Payouts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('FinanceRefunds')}
            >
              <Text style={styles.actionIcon}>↩️</Text>
              <Text style={styles.actionLabel}>Refunds</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('FinanceReconciliation')}
            >
              <Text style={styles.actionIcon}>📊</Text>
              <Text style={styles.actionLabel}>Reconciliation</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('FinanceChargebacks')}
            >
              <Text style={styles.actionIcon}>⚠️</Text>
              <Text style={styles.actionLabel}>Chargebacks</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('FinanceAuditTrail')}
            >
              <Text style={styles.actionIcon}>📜</Text>
              <Text style={styles.actionLabel}>Audit Trail</Text>
            </TouchableOpacity>
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  statCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  actionsSection: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  actionButton: {
    width: '48%',
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: SPACING.sm,
  },
  actionLabel: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'center',
  },
});
