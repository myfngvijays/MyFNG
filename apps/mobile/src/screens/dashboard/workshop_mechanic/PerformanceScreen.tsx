import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useNavigation } from '@react-navigation/native';

export default function PerformanceScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [metrics, setMetrics] = useState({
    totalJobs: 0,
    completedJobs: 0,
    avgCompletionTime: 0,
    qualityScore: 0,
    onTimeDelivery: 0,
    customerRating: 0,
    thisMonth: 0,
    thisWeek: 0,
    today: 0,
  });

  const [recentJobs, setRecentJobs] = useState<Array<any>>([]);

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
    fetchUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchPerformanceData();
    }
  }, [userId]);

  const fetchUserId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (userProfile?.id) {
        setUserId(userProfile.id);
      }
    } catch (error) {
      console.error('Error fetching user ID:', error);
    }
  };

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);

      if (!userId) return;

      // Fetch mechanic jobs
      const { data: jobs, error } = await supabase
        .from('mechanic_jobs')
        .select('*')
        .eq('mechanic_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const totalJobs = jobs?.length || 0;
      const completedJobs = jobs?.filter(j => j.status === 'COMPLETED').length || 0;

      // Calculate avg completion time
      const completedWithTime = jobs?.filter(j => 
        j.status === 'COMPLETED' && j.started_at && j.completed_at
      ) || [];
      
      let avgCompletionTime = 0;
      if (completedWithTime.length > 0) {
        const totalTime = completedWithTime.reduce((sum, j) => {
          const start = new Date(j.started_at).getTime();
          const end = new Date(j.completed_at).getTime();
          return sum + (end - start);
        }, 0);
        avgCompletionTime = totalTime / completedWithTime.length / (1000 * 60 * 60); // hours
      }

      // Calculate on-time delivery
      const onTimeJobs = completedWithTime.filter(j => {
        if (!j.estimated_completion_time) return true;
        const completedAt = new Date(j.completed_at).getTime();
        const estimatedAt = new Date(j.estimated_completion_time).getTime();
        return completedAt <= estimatedAt;
      }).length;

      const onTimeDelivery = completedWithTime.length > 0 
        ? (onTimeJobs / completedWithTime.length * 100) 
        : 0;

      // Period-based counts
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const today = completedWithTime.filter(j => 
        new Date(j.completed_at) >= todayStart
      ).length;

      const thisWeek = completedWithTime.filter(j => 
        new Date(j.completed_at) >= weekStart
      ).length;

      const thisMonth = completedWithTime.filter(j => 
        new Date(j.completed_at) >= monthStart
      ).length;

      setMetrics({
        totalJobs,
        completedJobs,
        avgCompletionTime,
        qualityScore: 92, // Mock
        onTimeDelivery,
        customerRating: 4.5, // Mock
        thisMonth,
        thisWeek,
        today,
      });

      setRecentJobs(jobs?.slice(0, 5) || []);

    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPerformanceData();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading performance...</Text>
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
          <Text style={styles.title}>My Performance</Text>
          <Text style={styles.subtitle}>Track your work metrics</Text>
        </View>

        {/* Overall Score Card */}
        <View style={styles.section}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Overall Score</Text>
            <Text style={styles.scoreValue}>{metrics.qualityScore}%</Text>
            <Text style={styles.scoreSubtext}>Excellent Performance! 🎯</Text>
          </View>
        </View>

        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.metricsGrid}>
            <MetricCard icon="📊" label="Total Jobs" value={metrics.totalJobs.toString()} />
            <MetricCard icon="✅" label="Completed" value={metrics.completedJobs.toString()} />
            <MetricCard icon="⏱️" label="Avg Time" value={`${metrics.avgCompletionTime.toFixed(1)}h`} />
            <MetricCard icon="⭐" label="Rating" value={metrics.customerRating.toFixed(1)} />
          </View>
        </View>

        {/* Performance Indicators */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Indicators</Text>
          <View style={styles.card}>
            <ProgressBar 
              label="Quality Score" 
              value={metrics.qualityScore} 
              color="#10b981" 
            />
            <ProgressBar 
              label="On-Time Delivery" 
              value={metrics.onTimeDelivery} 
              color="#3b82f6" 
            />
            <ProgressBar 
              label="Completion Rate" 
              value={metrics.totalJobs > 0 ? (metrics.completedJobs / metrics.totalJobs * 100) : 0} 
              color="#8b5cf6" 
            />
          </View>
        </View>

        {/* Period Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Period Statistics</Text>
          <View style={styles.periodCard}>
            <PeriodStat icon="📅" label="Today" value={metrics.today} />
            <PeriodStat icon="📆" label="This Week" value={metrics.thisWeek} />
            <PeriodStat icon="📊" label="This Month" value={metrics.thisMonth} />
          </View>
        </View>

        {/* Recent Jobs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Jobs</Text>
          <View style={styles.card}>
            {recentJobs.length > 0 ? (
              recentJobs.map((job, index) => (
                <JobRow key={index} job={job} />
              ))
            ) : (
              <Text style={styles.emptyText}>No recent jobs</Text>
            )}
          </View>
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Achievements 🏆</Text>
          <View style={styles.achievementsCard}>
            {metrics.qualityScore >= 90 && (
              <Achievement icon="🌟" title="Quality Master" desc="90%+ Quality Score" />
            )}
            {metrics.completedJobs >= 50 && (
              <Achievement icon="💪" title="Job Master" desc="50+ Jobs Completed" />
            )}
            {metrics.onTimeDelivery >= 80 && (
              <Achievement icon="⏰" title="Time Keeper" desc="80%+ On-Time Delivery" />
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const MetricCard = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricIcon}>{icon}</Text>
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

const PeriodStat = ({ icon, label, value }: { icon: string; label: string; value: number }) => (
  <View style={styles.periodStat}>
    <Text style={styles.periodIcon}>{icon}</Text>
    <Text style={styles.periodValue}>{value}</Text>
    <Text style={styles.periodLabel}>{label}</Text>
  </View>
);

const JobRow = ({ job }: { job: any }) => (
  <View style={styles.jobRow}>
    <View style={styles.jobInfo}>
      <Text style={styles.jobTitle}>Job #{job.id.slice(0, 8)}</Text>
      <Text style={styles.jobDate}>
        {new Date(job.created_at).toLocaleDateString()}
      </Text>
    </View>
    <View style={[styles.jobStatus, { backgroundColor: getStatusColor(job.status) }]}>
      <Text style={styles.jobStatusText}>{job.status}</Text>
    </View>
  </View>
);

const Achievement = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
  <View style={styles.achievement}>
    <Text style={styles.achievementIcon}>{icon}</Text>
    <View style={styles.achievementInfo}>
      <Text style={styles.achievementTitle}>{title}</Text>
      <Text style={styles.achievementDesc}>{desc}</Text>
    </View>
  </View>
);

const getStatusColor = (status: string) => {
  const colors: any = {
    ASSIGNED: '#f59e0b',
    IN_PROGRESS: '#3b82f6',
    COMPLETED: '#10b981',
    HOLD: '#ef4444',
  };
  return colors[status] || '#6b7280';
};

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
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  scoreCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#10b981',
    marginVertical: 8,
  },
  scoreSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  metricIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
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
  periodCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodStat: {
    flex: 1,
    alignItems: 'center',
  },
  periodIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  periodValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  periodLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  jobRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  jobDate: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  jobStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  jobStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  achievementsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  achievement: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  achievementIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  achievementDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
});

