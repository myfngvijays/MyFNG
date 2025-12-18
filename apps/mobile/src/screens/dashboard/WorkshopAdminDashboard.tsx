import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import StatCard from '../../components/StatCard';
import BottomNav from '../../components/BottomNav';
import WorkshopStaffScreen from '../workshop/WorkshopStaffScreen';
import WorkshopLeadsScreen from '../workshop/WorkshopLeadsScreen';
import WorkshopProfileScreen from '../workshop/WorkshopProfileScreen';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { formatDateTime } from "@/lib/dateFormat";

export default function WorkshopAdminDashboard() {
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: '🏠' },
    { id: 'staff', label: 'Staff', icon: '👥' },
    { id: 'leads', label: 'Leads', icon: '📋' },
    { id: 'profile', label: 'Workshop', icon: '🏭' },
    { id: 'more', label: 'More', icon: '⚙️' },
  ];

  const handleTabChange = (tab: string) => {
    if (tab === 'more') {
      Alert.alert('Coming Soon', 'Reports and Settings will be available soon!');
    } else {
      setCurrentScreen(tab);
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'staff':
        return <WorkshopStaffScreen workshopId={userProfile?.workshop_id} />;
      case 'leads':
        return <WorkshopLeadsScreen workshopId={userProfile?.workshop_id} />;
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
      <View style={styles.header}>
        <Text style={styles.title}>Workshop Dashboard</Text>
        <Text style={styles.subtitle}>
          {userProfile?.workshop?.name || 'Workshop Management'}
        </Text>
      </View>

      {/* Stats Grid */}
      <Text style={styles.sectionTitle}>Overview</Text>
      
      <StatCard
        title="Pending Leads"
        value={stats.pendingLeads}
        subtitle="Awaiting action"
        color={COLORS.warning}
      />
      
      <StatCard
        title="Active Leads"
        value={stats.activeLeads}
        subtitle="In progress"
        color={COLORS.primary}
      />
      
      <StatCard
        title="Completed"
        value={stats.completedLeads}
        subtitle="Finished jobs"
        color={COLORS.success}
      />
      
      <StatCard
        title="Total Staff"
        value={stats.totalStaff}
        subtitle="Team members"
        color={COLORS.secondary}
      />

      {/* Recent Activity */}
      <Text style={styles.sectionTitle}>Recent Leads</Text>
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
    <View style={styles.container}>
      <DashboardHeader
        name={userProfile?.full_name || 'Admin'}
        role="Workshop Admin"
        onLogout={handleLogout}
      />
      
      {renderScreen()}

      <BottomNav 
        activeTab={currentScreen} 
        onTabChange={handleTabChange}
        tabs={tabs}
      />
    </View>
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
  header: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.heading,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    marginTop: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    color: COLORS.gray[500],
    padding: SPACING.lg,
  },
});
