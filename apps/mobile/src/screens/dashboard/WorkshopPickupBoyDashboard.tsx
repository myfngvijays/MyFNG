import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import WorkshopCrmShell from '../../components/workshop/WorkshopCrmShell';
import {
  PICKUP_CRM_NAV,
  PICKUP_CRM_QUICK,
  WORKSHOP_CRM_TAB_TITLES,
} from '../../constants/workshopCrmNav';
import PickupTasksScreen from '../pickup/PickupTasksScreen';
import TaskHistoryScreen from '../pickup/TaskHistoryScreen';
import PickupBoyProfileScreen from '../pickup/PickupBoyProfileScreen';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { formatDateTime } from "@/lib/dateFormat";
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import WorkshopDateFilter, { isoInRange } from '../../components/workshop/WorkshopDateFilter';
import { istYmd, resolveCrmDateRange, type CrmDatePreset } from '../../lib/crmDateRange';

export default function WorkshopPickupBoyDashboard() {
  const navigation = useNavigation<any>();
  const { pickupRefreshTick } = useNotifications();
  const { userProfile: authProfile, refreshUserProfile } = useAuth();
  const [userProfile, setUserProfile] = React.useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [stats, setStats] = useState({
    pendingTasks: 0,
    inTransit: 0,
    completedToday: 0,
    totalCompleted: 0,
  });
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>('today');
  const [customStart, setCustomStart] = useState(istYmd());
  const [customEnd, setCustomEnd] = useState(istYmd());
  const dateRange = resolveCrmDateRange(datePreset, customStart, customEnd);

  // ✅ FIX: Fetch user profile from users_login by email (like web)
  React.useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profileData, error } = await supabase
          .from('users_login')
          .select('id, full_name, first_name, last_name, email')
          .eq('email', user.email)
          .single();

        if (error) {
          return;
        }

        if (profileData) {
          setUserProfile(profileData);
        }
      } catch (error) {
        // Error handled silently
      }
    };

    fetchUserProfile();
  }, []);

  const fetchDashboardData = async () => {
    // ✅ FIX: Get user profile if not set
    let pickupBoyId = userProfile?.id;
    
    if (!pickupBoyId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!profileData) {
        return;
      }
      pickupBoyId = profileData.id;
    }

    try {
      // ✅ FIX: Fetch from service_leads table (like web)
      const { data: allTasks, error: tasksError } = await supabase
        .from('service_leads')
        .select('*')
        .eq('assigned_pickup_boy_id', pickupBoyId)
        .not('status', 'in', '(REJECTED,CANCELLED)');

      if (tasksError) {
        return;
      }

      // ✅ FIX: Calculate stats from service_leads data (like web)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Pending tasks (pickup required, not started)
      const pendingTasks = allTasks?.filter(t => 
        t.pickup_required && 
        (t.status === 'ACCEPTED' || t.status === 'ASSIGNED_TO_WORKSHOP') &&
        (!t.pickup_status || t.pickup_status === 'NOT_ASSIGNED')
      ) || [];

      // In transit tasks
      const inTransitTasks = allTasks?.filter(t => 
        t.pickup_status === 'IN_TRANSIT' || t.pickup_status === 'PICKED_UP'
      ) || [];

      // Completed in selected range
      const completedToday = allTasks?.filter(t => {
        const stamp = t.delivered_at || t.completed_at || t.updated_at;
        const done = t.pickup_status === 'DELIVERED' || t.pickup_status === 'PICKED_UP' || t.status === 'DELIVERED_TO_CUSTOMER' || t.status === 'CLOSED';
        if (!done) return false;
        return isoInRange(stamp, dateRange.start, dateRange.end, dateRange.allTime);
      }) || [];

      // Total completed
      const totalCompleted = allTasks?.filter(t => 
        t.pickup_status === 'PICKED_UP' || t.pickup_status === 'DELIVERED'
      ) || [];

      // Recent active tasks
      const recentTasks = allTasks
        ?.filter(t => 
          t.pickup_required && 
          (t.pickup_status === 'ASSIGNED' || t.pickup_status === 'IN_TRANSIT' || t.pickup_status === 'PICKED_UP')
        )
        .slice(0, 5) || [];

      setStats({
        pendingTasks: pendingTasks.length,
        inTransit: inTransitTasks.length,
        completedToday: completedToday.length,
        totalCompleted: totalCompleted.length,
      });

      setRecentTasks(recentTasks);
    } catch (error) {
      // Error handled silently
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    if (userProfile?.id) {
      fetchDashboardData();

      // ✅ FIX: Setup realtime subscription (like web)
      let channel: RealtimeChannel;

      const setupRealtimeSubscription = async () => {
        if (!userProfile?.id) return;

        channel = supabase
          .channel('pickup-boy-dashboard')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'service_leads'
            },
            (payload) => {
              fetchDashboardData();
            }
          )
          .subscribe();
      };

      setupRealtimeSubscription();

      return () => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      };
    }
  }, [userProfile]);

  // If a pickup-impacting notification arrives, refetch dashboard counts.
  useEffect(() => {
    if (userProfile?.id) {
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupRefreshTick, datePreset, customStart, customEnd]);

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
    'Pickupboy / Driver';

  const handleTabChange = (tab: string) => {
    setCurrentScreen(tab);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'tasks':
        return <PickupTasksScreen userId={userProfile?.id} />;
      case 'history':
        return <TaskHistoryScreen userId={userProfile?.id} />;
      case 'profile':
        return <PickupBoyProfileScreen userId={userProfile?.id} />;
      default:
        return renderDashboard();
    }
  };

  const getTaskTypeIcon = (task: any) => {
    if (task.pickup_required) return '📦';
    return '🚚';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ASSIGNED':
      case 'NOT_ASSIGNED': return COLORS.warning;
      case 'IN_TRANSIT':
      case 'PICKED_UP': return COLORS.primary;
      case 'DELIVERED': return COLORS.success;
      case 'CANCELLED': return COLORS.danger;
      default: return COLORS.gray[500];
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
        <Text style={styles.heroMeta}>Pickup & delivery</Text>
      </View>

      <WorkshopDateFilter
        preset={datePreset}
        customStart={customStart}
        customEnd={customEnd}
        onPreset={setDatePreset}
        onCustomStart={setCustomStart}
        onCustomEnd={setCustomEnd}
      />

      <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Overview</Text>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { borderLeftColor: '#D97706' }]}>
          <Text style={[styles.statValue, { color: '#D97706' }]}>{stats.pendingTasks}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#004AAD' }]}>
          <Text style={[styles.statValue, { color: '#004AAD' }]}>{stats.inTransit}</Text>
          <Text style={styles.statLabel}>In Transit</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#059669' }]}>
          <Text style={[styles.statValue, { color: '#059669' }]}>{stats.completedToday}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#EA580C' }]}>
          <Text style={[styles.statValue, { color: '#EA580C' }]}>{stats.totalCompleted}</Text>
          <Text style={styles.statLabel}>Total done</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Active Tasks</Text>
      {recentTasks.length > 0 ? (
        recentTasks.map((task, index) => (
          <TouchableOpacity
            key={task.id || index}
            style={styles.jobCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('PickupJobDetail', { taskId: task.id, leadId: task.id })}
          >
            <View style={styles.jobHeader}>
              <Text style={styles.jobName} numberOfLines={1}>
                {task.customer_name || 'Customer'}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.pickup_status || task.status) }]}>
                <Text style={styles.statusText}>{String(task.pickup_status || task.status || '').replace(/_/g, ' ')}</Text>
              </View>
            </View>
            <Text style={styles.taskType}>
              {getTaskTypeIcon(task)} {task.pickup_required ? 'PICKUP' : 'DELIVERY'}
            </Text>
            <Text style={styles.taskDetail}>
              {task.customer_address || task.address || 'Address not available'}
            </Text>
            {task.preferred_date ? (
              <Text style={styles.taskTime}>{formatDateTime(task.preferred_date)}</Text>
            ) : null}
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.jobCard}>
          <Text style={styles.emptyText}>No active tasks at the moment</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <WorkshopCrmShell
      title={WORKSHOP_CRM_TAB_TITLES[currentScreen] || 'Home'}
      userName={homeName}
      userEmail={userProfile?.email}
      roleFallback="Pickupboy / Driver"
      navigation={navigation}
      drawerItems={PICKUP_CRM_NAV}
      quickItems={PICKUP_CRM_QUICK}
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
    marginBottom: 4,
  },
  jobName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.heading,
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
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  taskItem: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
    marginBottom: SPACING.sm,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  taskType: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
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
  taskCustomer: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.xs,
  },
  taskDetail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: 4,
  },
  taskTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[400],
    marginTop: SPACING.xs,
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    padding: SPACING.lg,
  },
});
