import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { AdminSectionTitle } from '../../components/admin/AdminUi';
import WorkshopStaffScreen from '../workshop/WorkshopStaffScreen';
import WorkshopLeadsScreen from '../workshop/WorkshopLeadsScreen';
import WorkshopProfileScreen from '../workshop/WorkshopProfileScreen';
import WorkshopCrmShell from '../../components/workshop/WorkshopCrmShell';
import {
  OWNER_CRM_NAV,
  OWNER_CRM_QUICK,
  WORKSHOP_CRM_TAB_TITLES,
} from '../../constants/workshopCrmNav';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { formatDateTime } from "@/lib/dateFormat";

export default function WorkshopAdminDashboard() {
  const navigation = useNavigation<any>();
  const [userProfile, setUserProfile] = React.useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [stats, setStats] = useState({
    pendingLeads: 0,
    activeLeads: 0,
    completedLeads: 0,
    totalStaff: 0,
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('users_login')
          .select(`
            *,
            workshop:workshops!workshop_id(*)
          `)
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) setUserProfile(data);
          });
      }
    });
  }, []);

  const fetchDashboardData = async () => {
    if (!userProfile?.workshop_id) return;

    try {
      // Fetch leads stats for this workshop
      const { count: pendingCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', userProfile.workshop_id)
        .in('lead_status', ['NEW', 'ASSIGNED']);

      const { count: activeCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', userProfile.workshop_id)
        .in('lead_status', ['ACCEPTED', 'IN_PROGRESS']);

      const { count: completedCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', userProfile.workshop_id)
        .eq('lead_status', 'COMPLETED');

      // Fetch staff count
      const { count: staffCount } = await supabase
        .from('users_login')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', userProfile.workshop_id);

      // Fetch recent activities (recent leads)
      const { data: activities } = await supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', userProfile.workshop_id)
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        pendingLeads: pendingCount || 0,
        activeLeads: activeCount || 0,
        completedLeads: completedCount || 0,
        totalStaff: staffCount || 0,
      });

      setRecentActivities(activities || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    if (userProfile?.workshop_id) {
      fetchDashboardData();
    }
  }, [userProfile]);

  const handleTabChange = (tab: string) => {
    setCurrentScreen(tab);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'staff':
        return React.createElement(WorkshopStaffScreen as any, { workshopId: userProfile?.workshop_id });
      case 'leads':
        return React.createElement(WorkshopLeadsScreen as any, { onBack: () => setCurrentScreen('dashboard') });
      case 'profile':
        return <WorkshopProfileScreen workshopId={userProfile?.workshop_id} />;
      default:
        return renderDashboard();
    }
  };

  const renderDashboard = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          colors={[COLORS.primary]}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.heroName}>{userProfile?.full_name || 'Workshop Owner'}</Text>
        <Text style={styles.heroMeta}>{userProfile?.workshop?.name || 'Workshop Owner'}</Text>
      </View>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate('WorkshopAdminAdditionalJobsMaster')}
      >
        <Text style={styles.actionButtonText}>Additional Jobs Master</Text>
      </TouchableOpacity>

      <AdminSectionTitle>Overview</AdminSectionTitle>
      <View style={styles.statsGrid}>
        <TouchableOpacity style={[styles.statCard, { backgroundColor: '#FEF3C7' }]} onPress={() => navigation.navigate('PendingLeads')}>
          <Text style={styles.statValue}>{stats.pendingLeads}</Text>
          <Text style={styles.statLabel}>Pending leads</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statCard, { backgroundColor: '#EFF6FF' }]} onPress={() => navigation.navigate('ActiveJobs')}>
          <Text style={styles.statValue}>{stats.activeLeads}</Text>
          <Text style={styles.statLabel}>Active jobs</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#D1FAE5' }]}>
          <Text style={styles.statValue}>{stats.completedLeads}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <TouchableOpacity style={[styles.statCard, { backgroundColor: '#E9D5FF' }]} onPress={() => navigation.navigate('WorkshopAdminStaffManagement')}>
          <Text style={styles.statValue}>{stats.totalStaff}</Text>
          <Text style={styles.statLabel}>Staff</Text>
        </TouchableOpacity>
      </View>

      <AdminSectionTitle>Recent leads</AdminSectionTitle>
      <View style={styles.card}>
        {recentActivities.length > 0 ? (
          recentActivities.map((activity, index) => (
            <View key={index} style={styles.activityItem}>
              <View style={styles.activityDot} />
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>
                  {activity.customer_name || 'Customer'}
                </Text>
                <Text style={styles.activityDescription}>
                  {activity.vehicle_make} {activity.vehicle_model} - {activity.lead_type}
                </Text>
                <Text style={styles.activityTime}>
                  {formatDateTime(activity.created_at)}
                </Text>
              </View>
              <View style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(activity.lead_status) }
              ]}>
                <Text style={styles.statusText}>{activity.lead_status}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No recent activities</Text>
        )}
      </View>
    </ScrollView>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return COLORS.primary;
      case 'ASSIGNED': return COLORS.secondary;
      case 'ACCEPTED': return COLORS.accent;
      case 'IN_PROGRESS': return COLORS.warning;
      case 'COMPLETED': return COLORS.success;
      default: return COLORS.gray[500];
    }
  };

  return (
    <WorkshopCrmShell
      title={
        currentScreen === 'profile'
          ? 'Workshop'
          : WORKSHOP_CRM_TAB_TITLES[currentScreen] || 'Home'
      }
      userName={userProfile?.full_name}
      userEmail={userProfile?.email}
      roleFallback="Workshop Owner"
      navigation={navigation}
      drawerItems={OWNER_CRM_NAV}
      quickItems={OWNER_CRM_QUICK}
      activeTab={currentScreen}
      onTabChange={handleTabChange}
    >
      {renderScreen()}
    </WorkshopCrmShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl + SPACING.lg,
  },
  hero: {
    marginBottom: SPACING.md,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.heading,
  },
  heroMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: 14,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    textAlign: 'center',
  },
  actionButton: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: SPACING.xs,
    marginRight: SPACING.sm,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.heading,
  },
  activityDescription: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[600],
    marginTop: 2,
  },
  activityTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[400],
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.white,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    padding: SPACING.lg,
  },
});
