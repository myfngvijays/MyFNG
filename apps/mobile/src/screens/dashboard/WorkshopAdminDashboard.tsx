import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import WorkshopStaffScreen from '../workshop/WorkshopStaffScreen';
import WorkshopLeadsScreen from '../workshop/WorkshopLeadsScreen';
import WorkshopProfileScreen from '../workshop/WorkshopProfileScreen';
import WorkshopCrmShell from '../../components/workshop/WorkshopCrmShell';
import {
  OWNER_CRM_NAV,
  OWNER_CRM_QUICK,
  WORKSHOP_CRM_TAB_TITLES,
} from '../../constants/workshopCrmNav';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateTime } from "@/lib/dateFormat";
import { useAuth } from '../../context/AuthContext';

export default function WorkshopAdminDashboard() {
  const navigation = useNavigation<any>();
  const { userProfile: authProfile, refreshUserProfile } = useAuth();
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

  useFocusEffect(
    React.useCallback(() => {
      void refreshUserProfile();
    }, [refreshUserProfile]),
  );

  const homeName =
    [authProfile?.first_name, authProfile?.last_name].filter(Boolean).join(' ').trim() ||
    authProfile?.full_name ||
    [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ').trim() ||
    userProfile?.full_name ||
    'Workshop Owner';

  const handleTabChange = (tab: string) => {
    if (tab === 'me') {
      navigation.navigate('OwnerProfile');
      return;
    }
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
        <Text style={styles.heroName}>{homeName}</Text>
        <Text style={styles.heroMeta}>{userProfile?.workshop?.name || 'Workshop Owner'}</Text>
      </View>

      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsGrid}>
        <TouchableOpacity style={[styles.statCard, { borderLeftColor: '#D97706' }]} onPress={() => navigation.navigate('PendingLeads')}>
          <Text style={[styles.statValue, { color: '#D97706' }]}>{stats.pendingLeads}</Text>
          <Text style={styles.statLabel}>Pending leads</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statCard, { borderLeftColor: '#004AAD' }]} onPress={() => navigation.navigate('ActiveJobs')}>
          <Text style={[styles.statValue, { color: '#004AAD' }]}>{stats.activeLeads}</Text>
          <Text style={styles.statLabel}>Active jobs</Text>
        </TouchableOpacity>
        <View style={[styles.statCard, { borderLeftColor: '#059669' }]}>
          <Text style={[styles.statValue, { color: '#059669' }]}>{stats.completedLeads}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <TouchableOpacity style={[styles.statCard, { borderLeftColor: '#6D28D9' }]} onPress={() => navigation.navigate('WorkshopAdminStaffManagement')}>
          <Text style={[styles.statValue, { color: '#6D28D9' }]}>{stats.totalStaff}</Text>
          <Text style={styles.statLabel}>Staff</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent leads</Text>
      {recentActivities.length > 0 ? (
        recentActivities.map((activity, index) => (
          <TouchableOpacity
            key={activity.id || index}
            style={styles.jobCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('WorkshopAdminLeadDetail', { leadId: activity.id })}
          >
            <View style={styles.jobHeader}>
              <Text style={styles.jobName} numberOfLines={1}>
                {activity.customer_name || 'Customer'}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(activity.lead_status || activity.status) }]}>
                <Text style={styles.statusText}>
                  {String(activity.lead_status || activity.status || '').replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
            <Text style={styles.jobMeta}>
              {[activity.vehicle_number, `${activity.vehicle_make || ''} ${activity.vehicle_model || ''}`.trim()]
                .filter(Boolean)
                .join(' · ') || 'Vehicle'}
            </Text>
            <Text style={styles.jobMeta}>{formatDateTime(activity.created_at)}</Text>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.jobCard}>
          <Text style={styles.emptyText}>No recent activities</Text>
        </View>
      )}
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
      userName={homeName}
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
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  statCard: {
    width: '47.5%',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderLeftWidth: 4,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    textAlign: 'center',
    fontWeight: '600',
  },
  jobCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  jobName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.heading,
  },
  jobMeta: {
    fontSize: 13,
    color: COLORS.bodyText,
    marginTop: 4,
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
