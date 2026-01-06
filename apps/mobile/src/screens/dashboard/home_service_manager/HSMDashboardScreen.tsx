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

export default function HSMDashboardScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalLeads: 0,
    pendingLeads: 0,
    activeServices: 0,
    completedServices: 0,
    availableVans: 0,
    assignedTechnicians: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch home service leads
      const { data: leads, error: leadsError } = await supabase
        .from('service_leads')
        .select('id, status')
        .eq('service_type', 'HOME_SERVICE');

      if (leadsError) throw leadsError;

      const totalLeads = leads?.length || 0;
      const pendingLeads = leads?.filter((l: any) => l.status === 'PENDING').length || 0;
      const activeServices = leads?.filter((l: any) => 
        ['ASSIGNED', 'IN_PROGRESS'].includes(l.status)
      ).length || 0;
      const completedServices = leads?.filter((l: any) => l.status === 'COMPLETED').length || 0;

      // Fetch vans and technicians (adjust table names as needed)
      const availableVans = 5; // Placeholder
      const assignedTechnicians = 8; // Placeholder

      setStats({
        totalLeads,
        pendingLeads,
        activeServices,
        completedServices,
        availableVans,
        assignedTechnicians,
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
      <DashboardHeader title="Home Service Manager" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalLeads}</Text>
            <Text style={styles.statLabel}>Total Leads</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.pendingLeads}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.activeServices}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.completedServices}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.availableVans}</Text>
            <Text style={styles.statLabel}>Available Vans</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.assignedTechnicians}</Text>
            <Text style={styles.statLabel}>Technicians</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('HSMLeads')}
            >
              <Text style={styles.actionIcon}>📋</Text>
              <Text style={styles.actionLabel}>Manage Leads</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('HSMVans')}
            >
              <Text style={styles.actionIcon}>🚐</Text>
              <Text style={styles.actionLabel}>Manage Vans</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('HSMTechnicians')}
            >
              <Text style={styles.actionIcon}>👨‍🔧</Text>
              <Text style={styles.actionLabel}>Technicians</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('HSMReports')}
            >
              <Text style={styles.actionIcon}>📊</Text>
              <Text style={styles.actionLabel}>Reports</Text>
            </TouchableOpacity>
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
  actionsSection: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
