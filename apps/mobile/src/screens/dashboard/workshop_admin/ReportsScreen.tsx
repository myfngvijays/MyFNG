import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function ReportsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'TODAY' | 'WEEK' | 'MONTH'>('WEEK');
  const [workshopId, setWorkshopId] = useState<string | null>(null);

  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    acceptedLeads: 0,
    completedLeads: 0,
    rejectedLeads: 0,
    totalRevenue: 0,
    avgCompletionTime: 0,
    acceptanceRate: 0,
    completionRate: 0,
    customerSatisfaction: 0,
    slaCompliance: 0,
  });

  const [dailyData, setDailyData] = useState<Array<{ day: string; completed: number; revenue: number }>>([]);

  useEffect(() => {
    fetchWorkshopId();
  }, []);

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
    if (workshopId) {
      fetchReportData();
    }
  }, [workshopId, selectedPeriod]);

  const fetchWorkshopId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      if (userProfile?.workshop_id) {
        setWorkshopId(userProfile.workshop_id);
      }
    } catch (error) {
      console.error('Error fetching workshop ID:', error);
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);

      if (!workshopId) return;

      const startDate = getStartDate(selectedPeriod);

      // Fetch leads data
      const { data: leads, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', workshopId)
        .gte('created_at', startDate);

      if (error) throw error;

      const totalLeads = leads?.length || 0;
      const acceptedLeads = leads?.filter(l => ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(l.status)).length || 0;
      const completedLeads = leads?.filter(l => l.status === 'COMPLETED').length || 0;
      const rejectedLeads = leads?.filter(l => l.status === 'REJECTED').length || 0;

      const totalRevenue = leads?.filter(l => l.status === 'COMPLETED')
        .reduce((sum, l) => sum + (l.actual_amount || l.estimated_amount || 0), 0) || 0;

      const acceptanceRate = totalLeads > 0 ? (acceptedLeads / totalLeads * 100) : 0;
      const completionRate = acceptedLeads > 0 ? (completedLeads / acceptedLeads * 100) : 0;

      // Calculate avg completion time
      const completedWithTime = leads?.filter(l => 
        l.status === 'COMPLETED' && l.accepted_at && l.completed_at
      ) || [];
      
      let avgCompletionTime = 0;
      if (completedWithTime.length > 0) {
        const totalTime = completedWithTime.reduce((sum, l) => {
          const start = new Date(l.accepted_at).getTime();
          const end = new Date(l.completed_at).getTime();
          return sum + (end - start);
        }, 0);
        avgCompletionTime = totalTime / completedWithTime.length / (1000 * 60 * 60); // hours
      }

      setMetrics({
        totalLeads,
        acceptedLeads,
        completedLeads,
        rejectedLeads,
        totalRevenue,
        avgCompletionTime,
        acceptanceRate,
        completionRate,
        customerSatisfaction: 4.5, // Mock data
        slaCompliance: 85, // Mock data
      });

      // Generate daily data for chart
      generateDailyData(leads || [], selectedPeriod);

    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStartDate = (period: string) => {
    const now = new Date();
    switch (period) {
      case 'TODAY':
        now.setHours(0, 0, 0, 0);
        return now.toISOString();
      case 'WEEK':
        now.setDate(now.getDate() - 7);
        return now.toISOString();
      case 'MONTH':
        now.setDate(now.getDate() - 30);
        return now.toISOString();
      default:
        return now.toISOString();
    }
  };

  const generateDailyData = (leads: any[], period: string) => {
    const days = period === 'TODAY' ? 1 : period === 'WEEK' ? 7 : 30;
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const dayStart = date.toISOString();
      const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const dayLeads = leads.filter(l => 
        l.completed_at && 
        l.completed_at >= dayStart && 
        l.completed_at < dayEnd
      );

      const completed = dayLeads.length;
      const revenue = dayLeads.reduce((sum, l) => sum + (l.actual_amount || l.estimated_amount || 0), 0);

      data.push({
        day: date.getDate().toString(),
        completed,
        revenue,
      });
    }

    setDailyData(data);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReportData();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Reports & Analytics</Text>
          <Text style={styles.subtitle}>Performance metrics</Text>
        </View>

        {/* Period Selector */}
        <View style={styles.periodContainer}>
          {['TODAY', 'WEEK', 'MONTH'].map(period => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period as any)}
            >
              <Text
                style={[
                  styles.periodText,
                  selectedPeriod === period && styles.periodTextActive,
                ]}
              >
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.metricsGrid}>
            <MetricCard label="Total Leads" value={metrics.totalLeads.toString()} color="#3b82f6" />
            <MetricCard label="Accepted" value={metrics.acceptedLeads.toString()} color="#10b981" />
            <MetricCard label="Completed" value={metrics.completedLeads.toString()} color="#8b5cf6" />
            <MetricCard label="Rejected" value={metrics.rejectedLeads.toString()} color="#ef4444" />
          </View>
        </View>

        {/* Revenue */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenue</Text>
          <View style={styles.revenueCard}>
            <Text style={styles.revenueLabel}>Total Revenue</Text>
            <Text style={styles.revenueValue}>₹{(metrics.totalRevenue / 1000).toFixed(1)}K</Text>
            <Text style={styles.revenueSubtext}>
              From {metrics.completedLeads} completed jobs
            </Text>
          </View>
        </View>

        {/* Performance Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.performanceCard}>
            <ProgressBar label="Acceptance Rate" value={metrics.acceptanceRate} color="#10b981" />
            <ProgressBar label="Completion Rate" value={metrics.completionRate} color="#3b82f6" />
            <ProgressBar label="SLA Compliance" value={metrics.slaCompliance} color="#8b5cf6" />
          </View>
        </View>

        {/* Additional Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Metrics</Text>
          <View style={styles.additionalCard}>
            <InfoRow 
              icon="⏱️" 
              label="Avg Completion Time" 
              value={`${metrics.avgCompletionTime.toFixed(1)} hours`} 
            />
            <InfoRow 
              icon="⭐" 
              label="Customer Satisfaction" 
              value={`${metrics.customerSatisfaction.toFixed(1)}/5.0`} 
            />
            <InfoRow 
              icon="📊" 
              label="Acceptance Rate" 
              value={`${metrics.acceptanceRate.toFixed(1)}%`} 
            />
          </View>
        </View>

        {/* Daily Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Completions</Text>
          <View style={styles.chartCard}>
            <View style={styles.chart}>
              {dailyData.map((item, index) => {
                const maxCompleted = Math.max(...dailyData.map(d => d.completed), 1);
                const height = (item.completed / maxCompleted) * 120;
                
                return (
                  <View key={index} style={styles.barContainer}>
                    <View style={[styles.bar, { height: height || 4 }]} />
                    <Text style={styles.barLabel}>{item.day}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const MetricCard = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <View style={[styles.metricCard, { borderLeftColor: color }]}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const ProgressBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <View style={styles.progressContainer}>
    <View style={styles.progressHeader}>
      <Text style={styles.progressLabel}>{label}</Text>
      <Text style={[styles.progressValue, { color }]}>{value.toFixed(0)}%</Text>
    </View>
    <View style={styles.progressBarBg}>
      <View style={[styles.progressBarFill, { width: `${value}%`, backgroundColor: color }]} />
    </View>
  </View>
);

const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoIcon}>{icon}</Text>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    padding: 20,
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
    gap: 8,
  },
  periodButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  periodTextActive: {
    color: '#fff',
  },
  section: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
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
    width: (width - 48) / 2,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  revenueCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  revenueLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  revenueValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#10b981',
    marginVertical: 8,
  },
  revenueSubtext: {
    fontSize: 12,
    color: '#6b7280',
  },
  performanceCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  progressContainer: {
    gap: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  additionalCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoLabel: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  chartCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '70%',
    backgroundColor: '#3b82f6',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
  },
});

