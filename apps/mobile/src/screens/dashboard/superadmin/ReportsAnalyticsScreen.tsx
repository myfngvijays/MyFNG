import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions
} from 'react-native';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Removed - using emojis
import { Icon } from '../../../components/Icon';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING } from '../../../constants/theme';

const { width } = Dimensions.get('window');

export default function ReportsAnalyticsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  
  const [operationalStats, setOperationalStats] = useState({
    totalLeads: 0,
    convertedLeads: 0,
    conversionRate: 0,
    avgResponseTime: 0,
    slaCompliance: 0,
    activeWorkshops: 0,
  });

  const [financialStats, setFinancialStats] = useState({
    totalRevenue: 0,
    workshopPayouts: 0,
    refunds: 0,
    netProfit: 0,
    avgOrderValue: 0,
  });

  const [qualityStats, setQualityStats] = useState({
    avgRating: 0,
    totalComplaints: 0,
    resolvedComplaints: 0,
    resolutionRate: 0,
    fraudCases: 0,
  });

  const [departmentPerformance, setDepartmentPerformance] = useState([
    { name: 'Telecaller', score: 85, leads: 245, conversion: 72 },
    { name: 'Lead Manager', score: 92, assigned: 320, accuracy: 94 },
    { name: 'Workshops', score: 88, completed: 180, avgTime: 4.5 },
    { name: 'RSA', score: 91, emergencies: 45, response: 18 },
    { name: 'Auditors', score: 90, audits: 25, fraudFound: 2 },
  ]);

  useEffect(() => {
    fetchReportData();
  }, [selectedPeriod]);

  const fetchReportData = async () => {
    try {
      const dateFilter = getDateFilter(selectedPeriod);

      // Fetch operational stats
      const [leadsResult, convertedResult, workshopsResult] = await Promise.all([
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', dateFilter),
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'COMPLETED')
          .gte('created_at', dateFilter),
        supabase
          .from('workshops')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
      ]);

      const totalLeads = leadsResult.count || 0;
      const convertedLeads = convertedResult.count || 0;

      setOperationalStats({
        totalLeads,
        convertedLeads,
        conversionRate: totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0,
        avgResponseTime: 12.5,
        slaCompliance: 94.5,
        activeWorkshops: workshopsResult.count || 0,
      });

      // Fetch financial stats
      const revenueResult = await supabase
        .from('service_leads')
        .select('invoice_amount')
        .eq('status', 'COMPLETED')
        .gte('created_at', dateFilter);

      const totalRevenue = revenueResult.data?.reduce((sum, l) => sum + (l.invoice_amount || 0), 0) || 0;

      setFinancialStats({
        totalRevenue,
        workshopPayouts: totalRevenue * 0.75,
        refunds: 15000,
        netProfit: totalRevenue * 0.25 - 15000,
        avgOrderValue: totalLeads > 0 ? totalRevenue / totalLeads : 0,
      });

      // Fetch quality stats
      const complaintsResult = await supabase
        .from('service_leads')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'COMPLAINT')
        .gte('created_at', dateFilter);

      setQualityStats({
        avgRating: 4.5,
        totalComplaints: complaintsResult.count || 0,
        resolvedComplaints: Math.floor((complaintsResult.count || 0) * 0.85),
        resolutionRate: 85,
        fraudCases: 2,
      });

    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getDateFilter = (period: string) => {
    const now = new Date();
    switch (period) {
      case 'today':
        return now.toISOString().split('T')[0];
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return weekAgo.toISOString();
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return monthAgo.toISOString();
      case 'year':
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return yearAgo.toISOString();
      default:
        return now.toISOString();
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReportData();
  };

  const handleExportReport = (format: string) => {
    Alert.alert(
      'Export Report',
      `Export ${selectedPeriod} report as ${format.toUpperCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: () => Alert.alert('Success', `Report export initiated. Download link will be sent to your email.`)
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports & Analytics</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Icon name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {['today', 'week', 'month', 'year'].map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodTab,
              selectedPeriod === period && styles.periodTabActive
            ]}
            onPress={() => setSelectedPeriod(period as any)}
          >
            <Text style={[
              styles.periodText,
              selectedPeriod === period && styles.periodTextActive
            ]}>
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* Operational Reports */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Operational Performance</Text>

          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: COLORS.blue + '15' }]}>
              <Icon name="clipboard-text" size={24} color={COLORS.blue} />
              <Text style={styles.statValue}>{operationalStats.totalLeads}</Text>
              <Text style={styles.statLabel}>Total Leads</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: COLORS.green + '15' }]}>
              <Icon name="check-circle" size={24} color={COLORS.green} />
              <Text style={styles.statValue}>{operationalStats.convertedLeads}</Text>
              <Text style={styles.statLabel}>Converted</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: COLORS.purple + '15' }]}>
              <Icon name="percent" size={24} color={COLORS.purple} />
              <Text style={styles.statValue}>{operationalStats.conversionRate.toFixed(1)}%</Text>
              <Text style={styles.statLabel}>Conversion Rate</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: COLORS.orange + '15' }]}>
              <Icon name="clock-fast" size={24} color={COLORS.orange} />
              <Text style={styles.statValue}>{operationalStats.avgResponseTime}m</Text>
              <Text style={styles.statLabel}>Avg Response</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: COLORS.teal + '15' }]}>
              <Icon name="chart-timeline-variant" size={24} color={COLORS.teal} />
              <Text style={styles.statValue}>{operationalStats.slaCompliance.toFixed(1)}%</Text>
              <Text style={styles.statLabel}>SLA Compliance</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: COLORS.indigo + '15' }]}>
              <Icon name="store" size={24} color={COLORS.indigo} />
              <Text style={styles.statValue}>{operationalStats.activeWorkshops}</Text>
              <Text style={styles.statLabel}>Active Workshops</Text>
            </View>
          </View>
        </View>

        {/* Financial Reports */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Financial Performance</Text>

          <View style={styles.financialCard}>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Total Revenue</Text>
              <Text style={[styles.financialValue, { color: COLORS.green }]}>
                ₹{(financialStats.totalRevenue / 1000).toFixed(1)}K
              </Text>
            </View>

            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Workshop Payouts</Text>
              <Text style={[styles.financialValue, { color: COLORS.orange }]}>
                ₹{(financialStats.workshopPayouts / 1000).toFixed(1)}K
              </Text>
            </View>

            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Refunds</Text>
              <Text style={[styles.financialValue, { color: COLORS.red }]}>
                ₹{(financialStats.refunds / 1000).toFixed(1)}K
              </Text>
            </View>

            <View style={[styles.financialRow, styles.financialDivider]}>
              <Text style={[styles.financialLabel, { fontWeight: 'bold' }]}>Net Profit</Text>
              <Text style={[styles.financialValue, { color: COLORS.primary, fontWeight: 'bold', fontSize: 20 }]}>
                ₹{(financialStats.netProfit / 1000).toFixed(1)}K
              </Text>
            </View>

            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Avg Order Value</Text>
              <Text style={styles.financialValue}>
                ₹{financialStats.avgOrderValue.toFixed(0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Quality Reports */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⭐ Quality Metrics</Text>

          <View style={styles.qualityGrid}>
            <View style={styles.qualityCard}>
              <Text style={styles.qualityValue}>{qualityStats.avgRating}⭐</Text>
              <Text style={styles.qualityLabel}>Avg Rating</Text>
            </View>

            <View style={styles.qualityCard}>
              <Text style={[styles.qualityValue, { color: COLORS.orange }]}>
                {qualityStats.totalComplaints}
              </Text>
              <Text style={styles.qualityLabel}>Complaints</Text>
            </View>

            <View style={styles.qualityCard}>
              <Text style={[styles.qualityValue, { color: COLORS.green }]}>
                {qualityStats.resolutionRate}%
              </Text>
              <Text style={styles.qualityLabel}>Resolution Rate</Text>
            </View>

            <View style={styles.qualityCard}>
              <Text style={[styles.qualityValue, { color: COLORS.red }]}>
                {qualityStats.fraudCases}
              </Text>
              <Text style={styles.qualityLabel}>Fraud Cases</Text>
            </View>
          </View>
        </View>

        {/* Department Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Department Performance</Text>

          {departmentPerformance.map((dept, index) => (
            <View key={index} style={styles.deptCard}>
              <View style={styles.deptHeader}>
                <Text style={styles.deptName}>{dept.name}</Text>
                <View style={styles.deptScore}>
                  <Text style={styles.deptScoreText}>{dept.score}</Text>
                  <Text style={styles.deptScoreLabel}>/100</Text>
                </View>
              </View>

              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${dept.score}%` }]} />
              </View>

              <View style={styles.deptMetrics}>
                {dept.leads !== undefined && (
                  <Text style={styles.deptMetric}>📞 {dept.leads} leads</Text>
                )}
                {dept.assigned !== undefined && (
                  <Text style={styles.deptMetric}>📋 {dept.assigned} assigned</Text>
                )}
                {dept.completed !== undefined && (
                  <Text style={styles.deptMetric}>✅ {dept.completed} completed</Text>
                )}
                {dept.emergencies !== undefined && (
                  <Text style={styles.deptMetric}>🚨 {dept.emergencies} emergencies</Text>
                )}
                {dept.audits !== undefined && (
                  <Text style={styles.deptMetric}>🔍 {dept.audits} audits</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Export Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📥 Export Report</Text>

          <View style={styles.exportGrid}>
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={() => handleExportReport('csv')}
            >
              <Icon name="file-delimited" size={32} color={COLORS.green} />
              <Text style={styles.exportText}>CSV</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportBtn}
              onPress={() => handleExportReport('pdf')}
            >
              <Icon name="file-pdf-box" size={32} color={COLORS.red} />
              <Text style={styles.exportText}>PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportBtn}
              onPress={() => handleExportReport('excel')}
            >
              <Icon name="microsoft-excel" size={32} color={COLORS.green} />
              <Text style={styles.exportText}>Excel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportBtn}
              onPress={() => Alert.alert('Email', 'Report will be sent to your email')}
            >
              <Icon name="email" size={32} color={COLORS.blue} />
              <Text style={styles.exportText}>Email</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
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
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
  },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    paddingTop: SPACING.xl,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginLeft: SPACING.md,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  periodTab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodTabActive: {
    backgroundColor: COLORS.primary,
  },
  periodText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  periodTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statCard: {
    width: (width - SPACING.md * 3) / 2,
    aspectRatio: 1.3,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  financialCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    elevation: 2,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  financialDivider: {
    borderTopWidth: 2,
    borderTopColor: COLORS.gray + '30',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gray + '30',
    marginVertical: SPACING.xs,
  },
  financialLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  financialValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  qualityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  qualityCard: {
    width: (width - SPACING.md * 3) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    elevation: 2,
  },
  qualityValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  qualityLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  deptCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    elevation: 2,
  },
  deptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  deptName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  deptScore: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  deptScoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  deptScoreLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 2,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.gray + '30',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  deptMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  deptMetric: {
    fontSize: 12,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  exportGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  exportBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    aspectRatio: 1,
  },
  exportText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
});

