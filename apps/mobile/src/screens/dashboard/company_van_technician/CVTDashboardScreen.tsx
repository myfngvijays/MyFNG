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

export default function CVTDashboardScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    activeTasks: 0,
    completedToday: 0,
    pendingTasks: 0,
    totalCompleted: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tasks } = await supabase
        .from('service_leads')
        .select('id, status')
        .eq('service_type', 'HOME_SERVICE')
        .eq('assigned_technician_id', user.id);

      const activeTasks = tasks?.filter((t: any) => 
        ['ASSIGNED', 'IN_PROGRESS'].includes(t.status)
      ).length || 0;
      const completedToday = tasks?.filter((t: any) => 
        t.status === 'COMPLETED' && 
        new Date(t.completed_at).toDateString() === new Date().toDateString()
      ).length || 0;
      const pendingTasks = tasks?.filter((t: any) => t.status === 'PENDING').length || 0;
      const totalCompleted = tasks?.filter((t: any) => t.status === 'COMPLETED').length || 0;

      setStats({
        activeTasks,
        completedToday,
        pendingTasks,
        totalCompleted,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Van Technician Dashboard" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.activeTasks}</Text>
            <Text style={styles.statLabel}>Active Tasks</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.completedToday}</Text>
            <Text style={styles.statLabel}>Completed Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.pendingTasks}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalCompleted}</Text>
            <Text style={styles.statLabel}>Total Completed</Text>
          </View>
        </View>

        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('CVTTasks')}
          >
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionLabel}>My Tasks</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('CVTHistory')}
          >
            <Text style={styles.actionIcon}>📜</Text>
            <Text style={styles.actionLabel}>Job History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('CVTProfile')}
          >
            <Text style={styles.actionIcon}>👤</Text>
            <Text style={styles.actionLabel}>My Profile</Text>
          </TouchableOpacity>
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
  actionsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  actionButton: {
    width: '48%',
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: SPACING.sm,
  },
  actionLabel: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'center',
  },
});
