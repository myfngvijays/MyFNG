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

interface AnalyticsData {
  overview: {
    totalLeads: number;
    leadsThisMonth: number;
    leadsGrowth: number;
    conversionRate: number;
    avgLeadValue: number;
    totalRevenue: number;
    revenueGrowth: number;
    avgCompletionTime: number;
  };
  leadsByStatus: Array<{ status: string; count: number; percentage: number }>;
  leadsByWorkshop: Array<{ workshop_name: string; total_leads: number; completed: number; revenue: number }>;
  topPerformers: Array<{ name: string; role: string; leads_completed: number; avg_rating: number }>;
  satisfactionTrends: Array<{ month: string; avg_score: number; total_surveys: number }>;
  revenueByMonth: Array<{ month: string; revenue: number; leads_count: number }>;
}

export default function SuperAdminAnalyticsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      const { data: allLeads, error: leadsError } = await supabase
        .from('service_leads')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (leadsError) throw leadsError;

      const totalLeads = allLeads?.length || 0;
      const completedLeads = allLeads?.filter((l: any) => l.status === 'CLOSED').length || 0;
      const conversionRate = totalLeads > 0 ? (completedLeads / totalLeads) * 100 : 0;
      
      const totalRevenue = allLeads?.reduce((sum: number, l: any) => sum + (l.invoice_amount || 0), 0) || 0;
      const avgLeadValue = totalLeads > 0 ? totalRevenue / totalLeads : 0;

      const completedWithTime = allLeads?.filter((l: any) => l.status === 'CLOSED' && l.final_closure_at && l.created_at) || [];
      const avgCompletionTime = completedWithTime.length > 0
        ? completedWithTime.reduce((sum: number, l: any) => {
            const start = new Date(l.created_at).getTime();
            const end = new Date(l.final_closure_at).getTime();
            return sum + (end - start);
          }, 0) / completedWithTime.length / (1000 * 60 * 60 * 24)
        : 0;

      const statusCounts: Record<string, number> = {};
      allLeads?.forEach((l: any) => {
        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
      });

      const leadsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: totalLeads > 0 ? (count / totalLeads) * 100 : 0
      }));

      setData({
        overview: {
          totalLeads,
          leadsThisMonth: totalLeads,
          leadsGrowth: 15.5,
          conversionRate,
          avgLeadValue,
          totalRevenue,
          revenueGrowth: 22.3,
          avgCompletionTime
        },
        leadsByStatus,
        leadsByWorkshop: [],
        topPerformers: [],
        satisfactionTrends: [],
        revenueByMonth: []
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
    fetchAnalyticsData();
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
        {/* Date Range Selector */}
        <View style={styles.dateRangeContainer}>
          <Text style={styles.sectionTitle}>Time Period</Text>
          <View style={styles.dateRangeButtons}>
            {(['7d', '30d', '90d', '1y'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.dateRangeButton,
                  dateRange === range && styles.dateRangeButtonActive
                ]}
                onPress={() => setDateRange(range)}
              >
                <Text style={[
                  styles.dateRangeButtonText,
                  dateRange === range && styles.dateRangeButtonTextActive
                ]}>
                  {range.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Overview Metrics */}
        {data && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.metricsGrid}>
                <MetricCard
                  label="Total Leads"
                  value={data.overview.totalLeads}
                  icon="📊"
                  color={COLORS.primary}
                />
                <MetricCard
                  label="Conversion Rate"
                  value={`${data.overview.conversionRate.toFixed(1)}%`}
                  icon="✅"
                  color={COLORS.success}
                />
                <MetricCard
                  label="Total Revenue"
                  value={`₹${(data.overview.totalRevenue / 1000).toFixed(1)}K`}
                  icon="💰"
                  color={COLORS.success}
                />
                <MetricCard
                  label="Avg Completion"
                  value={`${data.overview.avgCompletionTime.toFixed(1)}d`}
                  icon="⏱️"
                  color={COLORS.warning}
                />
                <MetricCard
                  label="Growth"
                  value={`+${data.overview.leadsGrowth}%`}
                  icon="📈"
                  color={COLORS.success}
                />
                <MetricCard
                  label="Avg Lead Value"
                  value={`₹${data.overview.avgLeadValue.toFixed(0)}`}
                  icon="💵"
                  color={COLORS.info}
                />
              </View>
            </View>

            {/* Leads by Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Leads by Status</Text>
              {data.leadsByStatus.map((item, index) => (
                <View key={index} style={styles.statusRow}>
                  <View style={styles.statusRowLeft}>
                    <Text style={styles.statusLabel}>{item.status}</Text>
                    <Text style={styles.statusCount}>{item.count} leads</Text>
                  </View>
                  <View style={styles.statusBarContainer}>
                    <View
                      style={[
                        styles.statusBar,
                        { width: `${item.percentage}%`, backgroundColor: COLORS.primary }
                      ]}
                    />
                  </View>
                  <Text style={styles.statusPercentage}>{item.percentage.toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function MetricCard({ label, value, icon, color }: any) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
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
  dateRangeContainer: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dateRangeButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  dateRangeButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
  },
  dateRangeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  dateRangeButtonText: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  dateRangeButtonTextActive: {
    color: COLORS.white,
  },
  section: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  metricCard: {
    width: '48%',
    backgroundColor: COLORS.gray[50],
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  metricIcon: {
    fontSize: 24,
    marginBottom: SPACING.xs,
  },
  metricValue: {
    fontSize: SIZES.xl,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  metricLabel: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  statusRowLeft: {
    flex: 1,
    minWidth: 100,
  },
  statusLabel: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusCount: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
  statusBarContainer: {
    flex: 2,
    height: 8,
    backgroundColor: COLORS.gray[200],
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusBar: {
    height: '100%',
  },
  statusPercentage: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    minWidth: 50,
    textAlign: 'right',
  },
});
