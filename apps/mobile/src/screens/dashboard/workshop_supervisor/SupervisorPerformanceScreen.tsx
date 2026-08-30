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
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function SupervisorPerformanceScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalJobsManaged: 0,
    jobsCompleted: 0,
    avgCompletionTime: 0,
    teamSize: 0,
    qcPassRate: 0,
  });

  useEffect(() => {
    fetchPerformance();
  }, []);

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('id', user.id)
        .single();

      if (!userProfile?.workshop_id) return;

      const { data: jobs } = await supabase
        .from('service_leads')
        .select('id, status, completed_at, accepted_at')
        .eq('workshop_id', userProfile.workshop_id);

      const totalJobsManaged = jobs?.length || 0;
      const jobsCompleted = jobs?.filter((j: any) => j.status === 'COMPLETED').length || 0;

      setStats({
        totalJobsManaged,
        jobsCompleted,
        avgCompletionTime: 4.5,
        teamSize: 5,
        qcPassRate: 95.5,
      });
    } catch (error) {
      console.error('Error fetching performance:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPerformance();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading performance...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalJobsManaged}</Text>
            <Text style={styles.statLabel}>Jobs Managed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.jobsCompleted}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.avgCompletionTime}h</Text>
            <Text style={styles.statLabel}>Avg Time</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.teamSize}</Text>
            <Text style={styles.statLabel}>Team Size</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.qcPassRate}%</Text>
            <Text style={styles.statLabel}>QC Pass Rate</Text>
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
