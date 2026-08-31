import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  BackHandler,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import AdvisorFilterBar from '../../../components/workshop/AdvisorFilterBar';

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
  const navigation = useNavigation<any>();
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

      let jobsToUse = jobs || [];

      // Fallback: workshop activity from service_leads when mechanic_jobs RLS/rows missing
      if (!jobsToUse.length) {
        const { data: leadRows } = await supabase
          .from('service_leads')
          .select('id, status, assigned_mechanic_id, created_at, updated_at, sla_expires_at, sla_deadline')
          .eq('workshop_id', workshopId)
          .is('deleted_at', null)
          .gte('created_at', startDate.toISOString());

        const openLeads = (leadRows || []).filter((l) =>
          !['REJECTED', 'CANCELLED', 'CLOSED'].includes(String(l.status || '').toUpperCase()),
        );
        jobsToUse = openLeads.map((l) => ({
          lead_id: l.id,
          mechanic_status:
            l.status === 'IN_PROGRESS'
              ? 'IN_PROGRESS'
              : l.assigned_mechanic_id
                ? 'ASSIGNED'
                : 'UNASSIGNED',
          assigned_at: l.created_at,
          sla_expires_at: l.sla_expires_at || l.sla_deadline,
          completed_at: ['COMPLETED', 'CLOSED'].includes(String(l.status || '')) ? l.updated_at : null,
        })) as any[];
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

      // Fetch additional job requests
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

    const filteredMechanics =
      mechanics?.filter((m: any) => {
        const roleObj = Array.isArray(m.role) ? m.role[0] : m.role;
        return roleObj?.role_code === 'WORKSHOP_MECHANIC';
      }) || [];

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
        date: `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`,
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
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Workshop Analytics</Text>
        <Text style={styles.heroSub}>Team performance · quality · SLA</Text>
      </View>

      <AdvisorFilterBar
        subtitle={`${analytics.totalJobs} jobs in ${period.toLowerCase()}`}
        kpis={[
          { label: 'Total', value: analytics.totalJobs, color: '#004AAD' },
          { label: 'Completed', value: analytics.completedJobs, color: '#10B981' },
          { label: 'Active', value: analytics.activeJobs, color: '#F59E0B' },
          { label: 'Overdue', value: analytics.overdueJobs, color: '#EF4444' },
        ]}
        chips={[
          { key: 'TODAY', label: 'TODAY' },
          { key: 'WEEK', label: 'WEEK' },
          { key: 'MONTH', label: 'MONTH' },
        ]}
        activeChip={period}
        onChip={(p) => setPeriod(p as 'TODAY' | 'WEEK' | 'MONTH')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Performance Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.metricsGrid}>
            {renderMetricCard('Avg Completion', analytics.avgCompletionTime, 'hours', '#004AAD')}
            {renderMetricCard('QC Pass Rate', analytics.qcPassRate, '', '#10B981', true)}
            {renderMetricCard('Team Efficiency', analytics.teamEfficiency, '', '#004AAD', true)}
            {renderMetricCard('SLA Compliance', analytics.slaCompliance, '', '#10B981', true)}
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
                        { height: Math.max(assignedHeight, 4) },
                      ]}
                    />
                    <View
                      style={[
                        styles.bar,
                        styles.completedBar,
                        { height: Math.max(completedHeight, 4) },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel} numberOfLines={1}>
                    {stat.date}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#004AAD' }]} />
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
          {mechanicPerformance.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No mechanic activity in this period yet.</Text>
            </View>
          ) : (
            mechanicPerformance.map((mech) => (
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
                  <Text style={[styles.mechanicMetricValue, { color: '#004AAD' }]}>
                    {Math.round(mech.efficiency)}%
                  </Text>
                </View>
              </View>
            </View>
          ))
          )}
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
              <Text style={styles.qualityLabel}>Additional Jobs Approval Rate</Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${analytics.extraWorkApprovalRate}%`, backgroundColor: '#004AAD' },
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
  },
  hero: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    backgroundColor: '#004AAD',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  heroSub: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyCardText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  periodContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#004AAD',
    borderColor: '#004AAD',
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
    color: '#023D95',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    shadowColor: '#023D95',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,74,173,0.06)',
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
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 196,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    gap: 6,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 120,
  },
  bar: {
    width: 8,
    borderRadius: 4,
    minHeight: 4,
  },
  assignedBar: {
    backgroundColor: '#004AAD',
  },
  completedBar: {
    backgroundColor: '#10b981',
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
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
    backgroundColor: '#004AAD',
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
    color: '#023D95',
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
    color: '#004AAD',
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
    color: '#023D95',
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
    color: '#004AAD',
    textAlign: 'right',
  },
});

