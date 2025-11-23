/**
 * Lead Manager Reports Screen - Mobile
 * Complete analytics dashboard with charts and metrics
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface Stats {
  total_leads: number;
  validated_leads: number;
  incomplete_leads: number;
  assigned_leads: number;
  validation_rate: number;
}

interface SLAStats {
  on_time: number;
  at_risk: number;
  breached: number;
  on_time_percentage: number;
  at_risk_percentage: number;
  breached_percentage: number;
}

interface DailyTrend {
  date: string;
  total: number;
  validated: number;
  assigned: number;
}

export default function LeadManagerReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [stats, setStats] = useState<Stats>({
    total_leads: 0,
    validated_leads: 0,
    incomplete_leads: 0,
    assigned_leads: 0,
    validation_rate: 0,
  });
  const [slaStats, setSlaStats] = useState<SLAStats>({
    on_time: 0,
    at_risk: 0,
    breached: 0,
    on_time_percentage: 0,
    at_risk_percentage: 0,
    breached_percentage: 0,
  });
  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);
  const [priorityDistribution, setPriorityDistribution] = useState<any[]>([]);

  useEffect(() => {
    fetchAllReports();
  }, [dateRange]);

  const fetchAllReports = async () => {
    try {
      await Promise.all([
        fetchSummaryStats(),
        fetchSLAStats(),
        fetchDailyTrends(),
        fetchStatusDistribution(),
        fetchPriorityDistribution(),
      ]);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSummaryStats = async () => {
    const { count: totalLeads } = await supabase
      .from('service_leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    const { count: validatedLeads } = await supabase
      .from('service_leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'VALIDATED')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    const { count: incompleteLeads } = await supabase
      .from('service_leads')
      .select('*', { count: 'exact', head: true })
      .eq('is_incomplete', true)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    const { count: assignedLeads } = await supabase
      .from('service_leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ASSIGNED_TO_WORKSHOP')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    const validationRate = totalLeads > 0 ? (validatedLeads / totalLeads) * 100 : 0;

    setStats({
      total_leads: totalLeads || 0,
      validated_leads: validatedLeads || 0,
      incomplete_leads: incompleteLeads || 0,
      assigned_leads: assignedLeads || 0,
      validation_rate: parseFloat(validationRate.toFixed(2)),
    });
  };

  const fetchSLAStats = async () => {
    const { data, error } = await supabase
      .from('service_leads')
      .select('sla_state, sla_status')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    if (error || !data) return;

    let onTime = 0;
    let atRisk = 0;
    let breached = 0;

    data.forEach(lead => {
      const slaState = lead.sla_state || lead.sla_status || 'ON_TIME';
      if (slaState === 'ON_TIME') onTime++;
      else if (slaState === 'AT_RISK') atRisk++;
      else if (slaState === 'BREACHED') breached++;
    });

    const total = data.length || 1;

    setSlaStats({
      on_time: onTime,
      at_risk: atRisk,
      breached: breached,
      on_time_percentage: Math.round((onTime / total) * 100),
      at_risk_percentage: Math.round((atRisk / total) * 100),
      breached_percentage: Math.round((breached / total) * 100),
    });
  };

  const fetchDailyTrends = async () => {
    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (13 - i));
      return date.toISOString().split('T')[0];
    });

    const trends = await Promise.all(
      last14Days.map(async (date) => {
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().split('T')[0];

        const { count: total } = await supabase
          .from('service_leads')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', date)
          .lt('created_at', nextDateStr);

        const { count: validated } = await supabase
          .from('service_leads')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'VALIDATED')
          .gte('created_at', date)
          .lt('created_at', nextDateStr);

        const { count: assigned } = await supabase
          .from('service_leads')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'ASSIGNED_TO_WORKSHOP')
          .gte('created_at', date)
          .lt('created_at', nextDateStr);

        return {
          date,
          total: total || 0,
          validated: validated || 0,
          assigned: assigned || 0,
        };
      })
    );

    setDailyTrends(trends);
  };

  const fetchStatusDistribution = async () => {
    const { data, error } = await supabase
      .from('service_leads')
      .select('status')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    if (error || !data) return;

    const statusCounts: Record<string, number> = {};
    data.forEach(lead => {
      const status = lead.status || 'NEW';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const distribution = Object.entries(statusCounts)
      .map(([status, count]) => ({
        status,
        count,
        percentage: ((count / data.length) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count);

    setStatusDistribution(distribution);
  };

  const fetchPriorityDistribution = async () => {
    const { data, error } = await supabase
      .from('service_leads')
      .select('priority')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    if (error || !data) return;

    const priorityCounts: Record<string, number> = {};
    data.forEach(lead => {
      const priority = lead.priority || 'MEDIUM';
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    });

    const distribution = Object.entries(priorityCounts)
      .map(([priority, count]) => ({
        priority,
        count,
        percentage: ((count / data.length) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count);

    setPriorityDistribution(distribution);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllReports();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return '#3B82F6';
      case 'VALIDATED': return '#6366F1';
      case 'ASSIGNED_TO_WORKSHOP': return '#8B5CF6';
      case 'ACCEPTED': return '#10B981';
      case 'IN_PROGRESS': return '#F59E0B';
      case 'COMPLETED': return '#14B8A6';
      case 'REJECTED': return '#EF4444';
      case 'INCOMPLETE': return '#F97316';
      default: return '#6B7280';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return '#9CA3AF';
      case 'MEDIUM': return '#F59E0B';
      case 'HIGH': return '#F97316';
      case 'URGENT': return '#EF4444';
      case 'CRITICAL': return '#7C3AED';
      default: return '#6B7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Reports & Analytics</Text>
        <Text style={styles.headerSubtitle}>Last 30 days</Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, { backgroundColor: '#EFF6FF' }]}>
          <Ionicons name="document-text" size={24} color="#3B82F6" />
          <Text style={styles.summaryValue}>{stats.total_leads}</Text>
          <Text style={styles.summaryLabel}>Total Leads</Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#F0FDF4' }]}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          <Text style={styles.summaryValue}>{stats.validated_leads}</Text>
          <Text style={styles.summaryLabel}>Validated</Text>
          <Text style={styles.summaryBadge}>{stats.validation_rate}%</Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#FFF7ED' }]}>
          <Ionicons name="alert-circle" size={24} color="#F97316" />
          <Text style={styles.summaryValue}>{stats.incomplete_leads}</Text>
          <Text style={styles.summaryLabel}>Incomplete</Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#F5F3FF' }]}>
          <Ionicons name="business" size={24} color="#8B5CF6" />
          <Text style={styles.summaryValue}>{stats.assigned_leads}</Text>
          <Text style={styles.summaryLabel}>Assigned</Text>
        </View>
      </View>

      {/* Daily Trends */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📈 Daily Trends (Last 14 Days)</Text>
        <View style={styles.chartContainer}>
          {dailyTrends.length > 0 ? (
            dailyTrends.map((trend, index) => {
              const maxValue = Math.max(...dailyTrends.map(t => t.total));
              const height = maxValue > 0 ? (trend.total / maxValue) * 100 : 0;
              return (
                <View key={index} style={styles.chartBar}>
                  <View style={styles.barGroup}>
                    <View style={[styles.bar, { height: `${height}%`, backgroundColor: '#3B82F6' }]} />
                  </View>
                  <Text style={styles.chartLabel}>{new Date(trend.date).getDate()}</Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.noData}>No trend data available</Text>
          )}
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.legendText}>Total</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>Validated</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#8B5CF6' }]} />
            <Text style={styles.legendText}>Assigned</Text>
          </View>
        </View>
      </View>

      {/* SLA Tracking */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⏱️ SLA Performance</Text>
        
        <View style={styles.slaCard}>
          <View style={[styles.slaItem, { backgroundColor: '#F0FDF4', borderLeftColor: '#10B981' }]}>
            <View style={styles.slaHeader}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.slaTitle}>On Time</Text>
            </View>
            <Text style={[styles.slaValue, { color: '#10B981' }]}>{slaStats.on_time}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${slaStats.on_time_percentage}%`, backgroundColor: '#10B981' }]} />
            </View>
            <Text style={styles.slaPercentage}>{slaStats.on_time_percentage}%</Text>
          </View>

          <View style={[styles.slaItem, { backgroundColor: '#FFFBEB', borderLeftColor: '#F59E0B' }]}>
            <View style={styles.slaHeader}>
              <Ionicons name="warning" size={20} color="#F59E0B" />
              <Text style={styles.slaTitle}>At Risk</Text>
            </View>
            <Text style={[styles.slaValue, { color: '#F59E0B' }]}>{slaStats.at_risk}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${slaStats.at_risk_percentage}%`, backgroundColor: '#F59E0B' }]} />
            </View>
            <Text style={styles.slaPercentage}>{slaStats.at_risk_percentage}%</Text>
          </View>

          <View style={[styles.slaItem, { backgroundColor: '#FEF2F2', borderLeftColor: '#EF4444' }]}>
            <View style={styles.slaHeader}>
              <Ionicons name="close-circle" size={20} color="#EF4444" />
              <Text style={styles.slaTitle}>Breached</Text>
            </View>
            <Text style={[styles.slaValue, { color: '#EF4444' }]}>{slaStats.breached}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${slaStats.breached_percentage}%`, backgroundColor: '#EF4444' }]} />
            </View>
            <Text style={styles.slaPercentage}>{slaStats.breached_percentage}%</Text>
          </View>
        </View>

        <View style={styles.complianceCard}>
          <Text style={styles.complianceLabel}>Overall SLA Compliance</Text>
          <Text style={styles.complianceValue}>{slaStats.on_time_percentage}%</Text>
          <Text style={styles.complianceStatus}>
            {slaStats.on_time_percentage >= 90 ? '🎉 Excellent!' :
             slaStats.on_time_percentage >= 75 ? '👍 Good' :
             slaStats.on_time_percentage >= 50 ? '⚠️ Needs Improvement' :
             '🚨 Critical'}
          </Text>
        </View>
      </View>

      {/* Status Distribution */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Status Distribution</Text>
        {statusDistribution.map((item, index) => (
          <View key={index} style={styles.distributionItem}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <Text style={styles.distributionLabel}>{item.status.replace(/_/g, ' ')}</Text>
            <Text style={styles.distributionCount}>{item.count}</Text>
            <Text style={styles.distributionPercentage}>{item.percentage}%</Text>
            <View style={styles.distributionBar}>
              <View style={[styles.distributionFill, { width: `${item.percentage}%`, backgroundColor: getStatusColor(item.status) }]} />
            </View>
          </View>
        ))}
      </View>

      {/* Priority Distribution */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 Priority Distribution</Text>
        {priorityDistribution.map((item, index) => (
          <View key={index} style={styles.distributionItem}>
            <View style={[styles.statusDot, { backgroundColor: getPriorityColor(item.priority) }]} />
            <Text style={styles.distributionLabel}>{item.priority}</Text>
            <Text style={styles.distributionCount}>{item.count}</Text>
            <Text style={styles.distributionPercentage}>{item.percentage}%</Text>
            <View style={styles.distributionBar}>
              <View style={[styles.distributionFill, { width: `${item.percentage}%`, backgroundColor: getPriorityColor(item.priority) }]} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#FF6B00',
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFF',
    marginTop: 5,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  summaryCard: {
    width: (width - 30) / 2,
    margin: 5,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 10,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 5,
  },
  summaryBadge: {
    fontSize: 10,
    color: '#10B981',
    marginTop: 5,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFF',
    margin: 10,
    padding: 15,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 15,
  },
  chartContainer: {
    flexDirection: 'row',
    height: 120,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
  },
  barGroup: {
    flex: 1,
    width: '80%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 2,
  },
  chartLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 5,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
    gap: 15,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
  },
  noData: {
    textAlign: 'center',
    color: '#9CA3AF',
    padding: 20,
  },
  slaCard: {
    gap: 15,
  },
  slaItem: {
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  slaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  slaValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  slaPercentage: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 5,
    fontWeight: '600',
  },
  complianceCard: {
    backgroundColor: '#F9FAFB',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
  },
  complianceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  complianceValue: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FF6B00',
    marginTop: 10,
  },
  complianceStatus: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 5,
  },
  distributionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  distributionLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  distributionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 10,
  },
  distributionPercentage: {
    fontSize: 12,
    color: '#6B7280',
    width: 45,
    textAlign: 'right',
  },
  distributionBar: {
    position: 'absolute',
    left: 35,
    right: 100,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  distributionFill: {
    height: '100%',
    borderRadius: 2,
  },
});

