import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

interface Analytics {
  totalJobs: number;
  completedJobs: number;
  activeJobs: number;
  overdueJobs: number;
  avgCompletionTime: number;
  qcPassRate: number;
  reworkRate: number;
  teamEfficiency: number;
  extraWorkApprovalRate: number;
  slaCompliance: number;
}

interface MechanicPerformance {
  id: string;
  name: string;
  activeJobs: number;
  completedJobs: number;
  avgTime: number;
  qualityScore: number;
  efficiency: number;
}

interface DailyStats {
  date: string;
  completed: number;
  assigned: number;
}

export default function SupervisorAnalyticsScreen() {
  const navigation = useNavigation();
  const [analytics, setAnalytics] = useState<Analytics>({
    totalJobs: 0,
    completedJobs: 0,
    activeJobs: 0,
    overdueJobs: 0,
    avgCompletionTime: 0,
    qcPassRate: 0,
    reworkRate: 0,
    teamEfficiency: 0,
    extraWorkApprovalRate: 0,
    slaCompliance: 0,
  });
  const [mechanicPerformance, setMechanicPerformance] = useState<MechanicPerformance[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [period, setPeriod] = useState<'TODAY' | 'WEEK' | 'MONTH'>('WEEK');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [navigation]);

  useEffect(() => {
    fetchAnalytics();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('analytics-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mechanic_jobs'
      }, () => {
        console.log('Analytics: Real-time update received');
        fetchAnalytics();
      })
      .subscribe((status) => {
        console.log('Analytics subscription status:', status);
      });
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [period]);

  async function fetchAnalytics() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      const workshopId = userProfile?.workshop_id;
      if (!workshopId) return;

      console.log('🔍 Analytics - Workshop ID:', workshopId);
      console.log('📅 Period:', period);

      // Calculate date range based on period
      const now = new Date();
      let startDate = new Date();
      
      if (period === 'TODAY') {
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'WEEK') {
        startDate.setDate(now.getDate() - 7);
      } else if (period === 'MONTH') {
        startDate.setDate(now.getDate() - 30);
      }

      console.log('📆 Date range:', startDate.toISOString(), 'to', now.toISOString());

      // ✅ FIX: Fetch mechanic jobs - remove qc_checks join (no direct relationship)
      const { data: jobs, error: jobsError } = await supabase
        .from('mechanic_jobs')
        .select(`
          *,
          service_leads!inner (workshop_id)
        `)
        .eq('service_leads.workshop_id', workshopId)
        .gte('assigned_at', startDate.toISOString());

      if (jobsError) {
        console.error('❌ Error fetching jobs:', jobsError);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      console.log('📊 Found', jobs?.length || 0, 'jobs in period');

      // ✅ FIX: Determine which jobs to use first
      let jobsToUse = jobs || [];
      
      if (!jobs || jobs.length === 0) {
        console.log('⚠️ No jobs found in this period - trying ALL jobs...');
        
        // Fetch ALL jobs if no jobs in period
        const { data: allJobs, error: allJobsError } = await supabase
          .from('mechanic_jobs')
          .select(`
            *,
            service_leads!inner (workshop_id)
          `)
          .eq('service_leads.workshop_id', workshopId);
        
        if (allJobsError) {
          console.error('❌ Error fetching all jobs:', allJobsError);
        }
        
        console.log('📊 Total jobs (all time):', allJobs?.length || 0);
        
        if (!allJobs || allJobs.length === 0) {
          setLoading(false);
          setRefreshing(false);
          return;
        }
        
        jobsToUse = allJobs;
      }

      // ✅ FIX: Fetch QC checks separately using lead_id from jobsToUse
      const leadIds = jobsToUse.map(j => j.lead_id) || [];
      let qcChecksMap: Record<string, any> = {};
      
      if (leadIds.length > 0) {
        const { data: qcChecks } = await supabase
          .from('qc_checks')
          .select('lead_id, qc_status')
          .in('lead_id', leadIds);
        
        // Create map for quick lookup
        qcChecks?.forEach(qc => {
          qcChecksMap[qc.lead_id] = qc;
        });
        
        console.log('✅ Found', qcChecks?.length || 0, 'QC checks');
      }

      // Calculate analytics
      const totalJobs = jobsToUse.length;
      const completedJobs = jobsToUse.filter((j) => j.mechanic_status === 'COMPLETED').length;
      const activeJobs = jobsToUse.filter((j) =>
        ['ASSIGNED', 'IN_PROGRESS'].includes(j.mechanic_status)
      ).length;
      
      const overdueJobs = jobsToUse.filter((j) => {
        const deadline = new Date(j.sla_expires_at || j.assigned_at);
        return deadline < now && j.mechanic_status !== 'COMPLETED';
      }).length;

      // Calculate average completion time
      const completedWithTime = jobsToUse.filter(
        (j) => j.mechanic_status === 'COMPLETED' && j.started_at && j.completed_at
      );
      const avgCompletionTime = completedWithTime.length > 0
        ? completedWithTime.reduce((sum, j) => {
            const start = new Date(j.started_at);
            const end = new Date(j.completed_at);
            return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          }, 0) / completedWithTime.length
        : 0;

      // ✅ FIX: QC metrics using qcChecksMap
      const qcChecksArray = Object.values(qcChecksMap);
      const qcPassRate = qcChecksArray.length > 0
        ? (qcChecksArray.filter((qc: any) => qc.qc_status === 'PASSED').length / qcChecksArray.length) * 100
        : 0;
      const reworkRate = qcChecksArray.length > 0
        ? (qcChecksArray.filter((qc: any) => qc.qc_status === 'REWORK_REQUIRED').length / qcChecksArray.length) * 100
        : 0;

      // Team efficiency (completed on time / total completed)
      const completedOnTime = jobsToUse.filter((j) => {
        if (j.mechanic_status !== 'COMPLETED') return false;
        const deadline = new Date(j.sla_expires_at || j.assigned_at);
        const completed = new Date(j.completed_at);
        return completed <= deadline;
      }).length;
      const teamEfficiency = completedJobs > 0
        ? (completedOnTime / completedJobs) * 100
        : 0;

      // Fetch extra work requests
      const { data: extraWork } = await supabase
        .from('lead_extra_charges')
        .select(`
          *,
          service_leads!inner (workshop_id)
        `)
        .eq('service_leads.workshop_id', workshopId)
        .gte('created_at', startDate.toISOString());

      const extraWorkApprovalRate = extraWork && extraWork.length > 0
        ? (extraWork.filter((e) => e.status === 'APPROVED').length / extraWork.length) * 100
        : 0;

      // SLA compliance
      const slaCompliance = totalJobs > 0
        ? ((totalJobs - overdueJobs) / totalJobs) * 100
        : 100;

      setAnalytics({
        totalJobs,
        completedJobs,
        activeJobs,
        overdueJobs,
        avgCompletionTime,
        qcPassRate,
        reworkRate,
        teamEfficiency,
        extraWorkApprovalRate,
        slaCompliance,
      });

      // Calculate mechanic performance
      const mechanics = await fetchMechanicPerformance(workshopId, startDate);
      setMechanicPerformance(mechanics);

      // Calculate daily stats for the last 7 days
      const daily = await fetchDailyStats(workshopId);
      setDailyStats(daily);

      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchMechanicPerformance(workshopId: string, startDate: Date) {
    const { data: mechanics } = await supabase
      .from('users_login')
      .select(`
        id,
        full_name,
        role:role_id (role_code)
      `)
      .eq('workshop_id', workshopId)
      .eq('is_active', true);

    const filteredMechanics = mechanics?.filter(
      (m) => m.role?.role_code === 'WORKSHOP_MECHANIC'
    ) || [];

    const performance = await Promise.all(
      filteredMechanics.map(async (mech) => {
        const { data: jobs } = await supabase
          .from('mechanic_jobs')
          .select('*')
          .eq('mechanic_id', mech.id)
          .gte('assigned_at', startDate.toISOString());

        const activeJobs = jobs?.filter((j) =>
          ['ASSIGNED', 'IN_PROGRESS'].includes(j.mechanic_status)
        ).length || 0;

        const completedJobs = jobs?.filter((j) => j.mechanic_status === 'COMPLETED').length || 0;

        const completedWithTime = jobs?.filter(
          (j) => j.mechanic_status === 'COMPLETED' && j.started_at && j.completed_at
        ) || [];

        const avgTime = completedWithTime.length > 0
          ? completedWithTime.reduce((sum, j) => {
              const start = new Date(j.started_at);
              const end = new Date(j.completed_at);
              return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            }, 0) / completedWithTime.length
          : 0;

        const { data: metrics } = await supabase
          .from('mechanic_performance_metrics')
          .select('quality_score')
          .eq('mechanic_id', mech.id)
          .single();

        const qualityScore = metrics?.quality_score || 0;
        const efficiency = completedJobs > 0 ? (completedJobs / (completedJobs + activeJobs)) * 100 : 0;

        return {
          id: mech.id,
          name: mech.full_name,
          activeJobs,
          completedJobs,
          avgTime,
          qualityScore,
          efficiency,
        };
      })
    );

    return performance.sort((a, b) => b.completedJobs - a.completedJobs);
  }

  async function fetchDailyStats(workshopId: string) {
    const stats: DailyStats[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(now.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);

      const { data: jobs } = await supabase
        .from('mechanic_jobs')
        .select(`
          *,
          service_leads!inner (workshop_id)
        `)
        .eq('service_leads.workshop_id', workshopId)
        .gte('assigned_at', date.toISOString())
        .lt('assigned_at', nextDate.toISOString());

      const completed = jobs?.filter((j) => j.mechanic_status === 'COMPLETED').length || 0;
      const assigned = jobs?.length || 0;

      stats.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        completed,
        assigned,
      });
    }

    return stats;
  }

  function onRefresh() {
    setRefreshing(true);
    fetchAnalytics();
  }

  function renderMetricCard(label: string, value: number, unit: string, color: string, isPercentage: boolean = false) {
    return (
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricValue, { color }]}>
          {isPercentage ? `${Math.round(value)}%` : Math.round(value)}
        </Text>
        <Text style={styles.metricUnit}>{unit}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics Dashboard</Text>
        <Text style={styles.subtitle}>Team performance overview</Text>
      </View>

      {/* Period Selector */}
      <View style={styles.periodContainer}>
        {(['TODAY', 'WEEK', 'MONTH'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodButton, period === p && styles.periodButtonActive]}
            onPress={() => setPeriod(p)}
          >
            <Text
              style={[
                styles.periodButtonText,
                period === p && styles.periodButtonTextActive,
              ]}
            >
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.metricsGrid}>
            {renderMetricCard('Total Jobs', analytics.totalJobs, 'jobs', '#3b82f6')}
            {renderMetricCard('Completed', analytics.completedJobs, 'jobs', '#10b981')}
            {renderMetricCard('Active', analytics.activeJobs, 'jobs', '#f59e0b')}
            {renderMetricCard('Overdue', analytics.overdueJobs, 'jobs', '#ef4444')}
          </View>
        </View>

        {/* Performance Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.metricsGrid}>
            {renderMetricCard('Avg Completion', analytics.avgCompletionTime, 'hours', '#8b5cf6')}
            {renderMetricCard('QC Pass Rate', analytics.qcPassRate, '', '#10b981', true)}
            {renderMetricCard('Team Efficiency', analytics.teamEfficiency, '', '#3b82f6', true)}
            {renderMetricCard('SLA Compliance', analytics.slaCompliance, '', '#10b981', true)}
          </View>
        </View>

        {/* Daily Stats Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last 7 Days Trend</Text>
          <View style={styles.chartContainer}>
            {dailyStats.map((stat, index) => {
              const maxValue = Math.max(...dailyStats.map((s) => s.assigned));
              const completedHeight = maxValue > 0 ? (stat.completed / maxValue) * 120 : 0;
              const assignedHeight = maxValue > 0 ? (stat.assigned / maxValue) * 120 : 0;

              return (
                <View key={index} style={styles.barGroup}>
                  <View style={styles.bars}>
                    <View
                      style={[
                        styles.bar,
                        styles.assignedBar,
                        { height: assignedHeight },
                      ]}
                    />
                    <View
                      style={[
                        styles.bar,
                        styles.completedBar,
                        { height: completedHeight },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{stat.date}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#3b82f6' }]} />
              <Text style={styles.legendText}>Assigned</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#10b981' }]} />
              <Text style={styles.legendText}>Completed</Text>
            </View>
          </View>
        </View>

        {/* Mechanic Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mechanic Performance</Text>
          {mechanicPerformance.map((mech) => (
            <View key={mech.id} style={styles.mechanicCard}>
              <View style={styles.mechanicHeader}>
                <View style={styles.mechanicAvatar}>
                  <Text style={styles.mechanicAvatarText}>
                    {mech.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.mechanicInfo}>
                  <Text style={styles.mechanicName}>{mech.name}</Text>
                  <Text style={styles.mechanicStats}>
                    {mech.completedJobs} completed • {mech.activeJobs} active
                  </Text>
                </View>
              </View>
              <View style={styles.mechanicMetrics}>
                <View style={styles.mechanicMetric}>
                  <Text style={styles.mechanicMetricLabel}>Avg Time</Text>
                  <Text style={styles.mechanicMetricValue}>
                    {mech.avgTime.toFixed(1)}h
                  </Text>
                </View>
                <View style={styles.mechanicMetric}>
                  <Text style={styles.mechanicMetricLabel}>Quality</Text>
                  <Text style={[styles.mechanicMetricValue, { color: '#10b981' }]}>
                    {Math.round(mech.qualityScore)}%
                  </Text>
                </View>
                <View style={styles.mechanicMetric}>
                  <Text style={styles.mechanicMetricLabel}>Efficiency</Text>
                  <Text style={[styles.mechanicMetricValue, { color: '#3b82f6' }]}>
                    {Math.round(mech.efficiency)}%
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Quality Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quality Control</Text>
          <View style={styles.qualityCard}>
            <View style={styles.qualityMetric}>
              <Text style={styles.qualityLabel}>QC Pass Rate</Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${analytics.qcPassRate}%`, backgroundColor: '#10b981' },
                  ]}
                />
              </View>
              <Text style={styles.qualityValue}>{Math.round(analytics.qcPassRate)}%</Text>
            </View>

            <View style={styles.qualityMetric}>
              <Text style={styles.qualityLabel}>Rework Rate</Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${analytics.reworkRate}%`, backgroundColor: '#f59e0b' },
                  ]}
                />
              </View>
              <Text style={styles.qualityValue}>{Math.round(analytics.reworkRate)}%</Text>
            </View>

            <View style={styles.qualityMetric}>
              <Text style={styles.qualityLabel}>Extra Work Approval Rate</Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${analytics.extraWorkApprovalRate}%`, backgroundColor: '#8b5cf6' },
                  ]}
                />
              </View>
              <Text style={styles.qualityValue}>
                {Math.round(analytics.extraWorkApprovalRate)}%
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  periodContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#8b5cf6',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: (width - 44) / 2,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricUnit: {
    fontSize: 12,
    color: '#9ca3af',
  },
  chartContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 180,
  },
  barGroup: {
    alignItems: 'center',
    gap: 8,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  bar: {
    width: 12,
    borderRadius: 4,
    minHeight: 4,
  },
  assignedBar: {
    backgroundColor: '#3b82f6',
  },
  completedBar: {
    backgroundColor: '#10b981',
  },
  barLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    color: '#6b7280',
  },
  mechanicCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mechanicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mechanicAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mechanicAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  mechanicInfo: {
    flex: 1,
  },
  mechanicName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  mechanicStats: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  mechanicMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mechanicMetric: {
    alignItems: 'center',
  },
  mechanicMetricLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 4,
  },
  mechanicMetricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8b5cf6',
  },
  qualityCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    gap: 16,
  },
  qualityMetric: {
    gap: 8,
  },
  qualityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  qualityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8b5cf6',
    textAlign: 'right',
  },
});

