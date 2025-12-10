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

export default function DMAnalyticsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState({
    totalLeads: 0,
    conversions: 0,
    conversionRate: 0,
    totalRevenue: 0,
    avgLeadValue: 0,
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { data: leads } = await supabase
        .from('service_leads')
        .select('id, status, invoice_amount')
        .not('source', 'is', null);

      const totalLeads = leads?.length || 0;
      const conversions = leads?.filter((l: any) => l.status === 'COMPLETED').length || 0;
      const conversionRate = totalLeads > 0 ? (conversions / totalLeads) * 100 : 0;
      const totalRevenue = leads?.reduce((sum: number, l: any) => sum + (l.invoice_amount || 0), 0) || 0;
      const avgLeadValue = totalLeads > 0 ? totalRevenue / totalLeads : 0;

      setAnalytics({
        totalLeads,
        conversions,
        conversionRate,
        totalRevenue,
        avgLeadValue,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Analytics" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{analytics.totalLeads}</Text>
            <Text style={styles.statLabel}>Total Leads</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{analytics.conversions}</Text>
            <Text style={styles.statLabel}>Conversions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{analytics.conversionRate.toFixed(1)}%</Text>
            <Text style={styles.statLabel}>Conversion Rate</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { fontSize: SIZES.md }]}>
              ₹{(analytics.totalRevenue / 1000).toFixed(1)}K
            </Text>
            <Text style={styles.statLabel}>Total Revenue</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>₹{analytics.avgLeadValue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Avg Lead Value</Text>
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
});
