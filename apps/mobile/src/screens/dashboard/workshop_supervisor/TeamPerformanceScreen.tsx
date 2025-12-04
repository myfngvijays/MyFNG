/**
 * Team Performance Screen - Workshop Supervisor
 * Detailed performance metrics and analytics
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

const { width } = Dimensions.get('window');

export default function TeamPerformanceScreen() {
  const navigation = useNavigation();

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
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [performanceData, setPerformanceData] = useState<any>({
    mechanics: [],
    overall: {
      avgCompletionTime: 0,
      totalJobsCompleted: 0,
      qualityScore: 0,
      efficiency: 0,
    },
  });

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ No user found');
        setLoading(false);
        return;
      }

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      if (!userProfile?.workshop_id) {
        console.log('❌ No workshop_id found');
        setLoading(false);
        return;
      }

      console.log('✅ Team Performance - Workshop ID:', userProfile.workshop_id);
      setWorkshopId(userProfile.workshop_id);
      
      await fetchPerformanceData(userProfile.workshop_id);
      setupRealtimeSubscription(userProfile.workshop_id);
    } catch (error) {
      console.error('❌ Error initializing screen:', error);
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = (wid: string) => {
    const channel = supabase
      .channel('performance_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_jobs',
        },
        () => {
          fetchPerformanceData(wid);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const fetchPerformanceData = async (wid?: string) => {
    const workshopIdToUse = wid || workshopId;
    
    try {
      if (!workshopIdToUse) {
        console.log('❌ No workshop ID available');
        setLoading(false);
        return;
      }

      console.log('🔍 Fetching performance data for workshop:', workshopIdToUse);

      // ✅ FIX: Get mechanics with correct role relation
      const { data: mechanicsData, error: mechanicsError } = await supabase
        .from('users_login')
        .select(`
          id,
          full_name,
          role:role_id(role_code)
        `)
        .eq('workshop_id', workshopIdToUse)
        .eq('is_active', true);

      if (mechanicsError) {
        console.error('❌ Error fetching mechanics:', mechanicsError);
        throw mechanicsError;
      }

      // Filter only mechanics
      const mechanics = mechanicsData?.filter(m => m.role?.role_code === 'WORKSHOP_MECHANIC') || [];
      console.log('👨‍🔧 Found', mechanics.length, 'mechanics');

      // Get jobs data for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: jobs, error: jobsError } = await supabase
        .from('mechanic_jobs')
        .select('*')
        .in('mechanic_id', mechanics?.map(m => m.id) || [])
        .gte('assigned_at', thirtyDaysAgo.toISOString());

      if (jobsError) {
        console.error('❌ Error fetching jobs:', jobsError);
        throw jobsError;
      }

      console.log('📊 Found', jobs?.length || 0, 'jobs in last 30 days');

      // ✅ FIX: Calculate performance metrics with correct column (mechanic_status not status)
      const mechanicPerformance = mechanics?.map(mechanic => {
        const mechanicJobs = jobs?.filter(j => j.mechanic_id === mechanic.id) || [];
        const completed = mechanicJobs.filter(j => j.mechanic_status === 'COMPLETED');

        const avgTime = calculateAvgTime(completed);
        
        return {
          ...mechanic,
          totalJobs: mechanicJobs.length,
          completedJobs: completed.length,
          qualityScore: completed.length > 0 ? 85 : 0, // Default quality score
          avgCompletionTime: avgTime,
        };
      }) || [];

      console.log('📈 Performance calculated for', mechanicPerformance.length, 'mechanics');

      const totalCompleted = mechanicPerformance.reduce((sum, m) => sum + m.completedJobs, 0);
      const avgTime = mechanicPerformance.length > 0 
        ? mechanicPerformance.reduce((sum, m) => sum + m.avgCompletionTime, 0) / mechanicPerformance.length 
        : 0;
      const avgQuality = mechanicPerformance.length > 0
        ? mechanicPerformance.reduce((sum, m) => sum + m.qualityScore, 0) / mechanicPerformance.length
        : 0;

      setPerformanceData({
        mechanics: mechanicPerformance,
        overall: {
          avgCompletionTime: avgTime,
          totalJobsCompleted: totalCompleted,
          qualityScore: avgQuality,
          efficiency: totalCompleted > 0 ? 85 : 0,
        },
      });

      console.log('✅ Overall stats:', {
        totalCompleted,
        avgTime: avgTime.toFixed(2) + 'h',
        avgQuality: avgQuality.toFixed(0) + '%',
      });
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateAvgTime = (jobs: any[]) => {
    if (jobs.length === 0) return 0;
    const times = jobs.map(j => {
      const start = new Date(j.assigned_at || j.created_at);
      const end = new Date(j.completed_at || new Date());
      return (end.getTime() - start.getTime()) / (1000 * 60 * 60); // hours
    });
    return times.reduce((sum, t) => sum + t, 0) / times.length;
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPerformanceData(workshopId);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Team Performance</Text>
        <Text style={styles.headerSubtitle}>Last 30 days analytics</Text>
      </View>

      {/* Overall Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overall Performance</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-done-circle" size={32} color={COLORS.primary} />
            <Text style={styles.statValue}>{performanceData.overall.totalJobsCompleted}</Text>
            <Text style={styles.statLabel}>Jobs Completed</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="time" size={32} color={COLORS.info} />
            <Text style={styles.statValue}>{performanceData.overall.avgCompletionTime.toFixed(1)}h</Text>
            <Text style={styles.statLabel}>Avg Time</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="trophy" size={32} color={COLORS.warning} />
            <Text style={styles.statValue}>{performanceData.overall.qualityScore.toFixed(0)}%</Text>
            <Text style={styles.statLabel}>Quality Score</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="flash" size={32} color={COLORS.success} />
            <Text style={styles.statValue}>{performanceData.overall.efficiency}%</Text>
            <Text style={styles.statLabel}>Efficiency</Text>
          </View>
        </View>
      </View>

      {/* Individual Performance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mechanic Performance</Text>
        {performanceData.mechanics.map((mechanic: any) => (
          <View key={mechanic.id} style={styles.mechanicCard}>
            <View style={styles.mechanicHeader}>
              <Text style={styles.mechanicName}>{mechanic.full_name}</Text>
              <Text style={styles.mechanicScore}>{mechanic.qualityScore.toFixed(0)}%</Text>
            </View>
            
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${mechanic.qualityScore}%` }]} />
            </View>

            <View style={styles.mechanicStats}>
              <View style={styles.mechanicStat}>
                <Text style={styles.mechanicStatLabel}>Total Jobs</Text>
                <Text style={styles.mechanicStatValue}>{mechanic.totalJobs}</Text>
              </View>
              <View style={styles.mechanicStat}>
                <Text style={styles.mechanicStatLabel}>Completed</Text>
                <Text style={styles.mechanicStatValue}>{mechanic.completedJobs}</Text>
              </View>
              <View style={styles.mechanicStat}>
                <Text style={styles.mechanicStatLabel}>Avg Time</Text>
                <Text style={styles.mechanicStatValue}>{mechanic.avgCompletionTime.toFixed(1)}h</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={{ height: SPACING.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  header: {
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  headerTitle: {
    fontSize: SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.gray[900],
  },
  headerSubtitle: {
    fontSize: SIZES.sm,
    color: COLORS.gray[600],
    marginTop: SPACING.xs,
  },
  section: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: SIZES.sm,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginTop: SPACING.sm,
  },
  statLabel: {
    fontSize: SIZES.sm,
    color: COLORS.gray[600],
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  mechanicCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.sm,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  mechanicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  mechanicName: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.gray[900],
  },
  mechanicScore: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.gray[200],
    borderRadius: 4,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.success,
  },
  mechanicStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mechanicStat: {
    alignItems: 'center',
  },
  mechanicStatLabel: {
    fontSize: SIZES.xs,
    color: COLORS.gray[600],
  },
  mechanicStatValue: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginTop: SPACING.xs,
  },
});