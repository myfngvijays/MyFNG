import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { AC } from '../../components/workshop/advisorCrmUi';
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
import { formatDateTime } from '@/lib/dateFormat';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import WorkshopDateFilter, { isoInRange } from '../../components/workshop/WorkshopDateFilter';
import { istYmd, resolveCrmDateRange, type CrmDatePreset } from '../../lib/crmDateRange';
import PickupLeadCard from '../../components/workshop/PickupLeadCard';
import {
  isActivePickupBoyTask,
  isActiveDeliveryBoyTask,
  isPickupLegComplete,
  isHistoryTaskCompleted,
  classifyPickupBoyDashboardTask,
  formatPickupStatusLabel,
  getPickupHistoryCompletedAt,
} from '../../lib/pickupTaskFlow';

export default function WorkshopPickupBoyDashboard() {
  const navigation = useNavigation<any>();
  const { pickupRefreshTick } = useNotifications();
  const { userProfile: authProfile, refreshUserProfile } = useAuth();
  const [userProfile, setUserProfile] = React.useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [tasksInitialFilter, setTasksInitialFilter] = useState('all');
  const [historyInitialFilter, setHistoryInitialFilter] = useState('all');
  const [stats, setStats] = useState({
    pendingTasks: 0,
    inTransit: 0,
    completedToday: 0,
    totalCompleted: 0,
  });
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([]);
  const [ongoingTasks, setOngoingTasks] = useState<any[]>([]);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
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
    let pickupBoyId = authProfile?.id || userProfile?.id;

    if (!pickupBoyId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('users_login')
        .select('id, full_name, first_name, last_name, email')
        .eq('email', user.email)
        .single();

      if (!profileData) return;
      pickupBoyId = profileData.id;
      setUserProfile((prev: any) => prev?.id ? prev : profileData);
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

      const openTasks = (allTasks || []).filter(
        (t) => isActivePickupBoyTask(t) || isActiveDeliveryBoyTask(t),
      );

      const upcoming = openTasks.filter((t) => classifyPickupBoyDashboardTask(t) === 'upcoming');
      const ongoing = openTasks.filter((t) => classifyPickupBoyDashboardTask(t) === 'ongoing');

      const completed =
        allTasks?.filter((t) => {
          if (!isHistoryTaskCompleted(t)) return false;
          const stamp = getPickupHistoryCompletedAt(t);
          return isoInRange(stamp, dateRange.start, dateRange.end, dateRange.allTime);
        }) || [];

      const pendingTasks = upcoming;
      const inTransitTasks = ongoing;

      const completedToday = completed;

      const totalCompleted =
        allTasks?.filter(
          (t) =>
            isPickupLegComplete(t) ||
            isHistoryTaskCompleted(t) ||
            t.status === 'DELIVERED' ||
            t.status === 'DELIVERED_TO_CUSTOMER' ||
            t.status === 'CLOSED',
        ) || [];

      setStats({
        pendingTasks: pendingTasks.length,
        inTransit: inTransitTasks.length,
        completedToday: completedToday.length,
        totalCompleted: totalCompleted.length,
      });

      setUpcomingTasks(upcoming);
      setOngoingTasks(ongoing);
      setCompletedTasks(completed);
    } catch (error) {
      // Error handled silently
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const pickupBoyId = authProfile?.id || userProfile?.id;

  useEffect(() => {
    if (authProfile?.id && !userProfile?.id) {
      setUserProfile(authProfile);
    }
  }, [authProfile?.id]);

  useEffect(() => {
    if (!pickupBoyId) return;

    void fetchDashboardData();

    const channel = supabase
      .channel(`pickup-boy-dashboard-${pickupBoyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads',
          filter: `assigned_pickup_boy_id=eq.${pickupBoyId}`,
        },
        () => {
          void fetchDashboardData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupBoyId]);

  useEffect(() => {
    if (pickupBoyId) {
      void fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupRefreshTick, datePreset, customStart, customEnd]);

  useFocusEffect(
    React.useCallback(() => {
      void refreshUserProfile();
      void fetchDashboardData();
    }, [refreshUserProfile, pickupBoyId, datePreset, customStart, customEnd]),
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

  const openTasks = (filter = 'all') => {
    setTasksInitialFilter(filter);
    setCurrentScreen('tasks');
  };

  const openHistory = (filter = 'all') => {
    setHistoryInitialFilter(filter);
    setCurrentScreen('history');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'tasks':
        return (
          <PickupTasksScreen
            userId={authProfile?.id || userProfile?.id}
            initialFilter={tasksInitialFilter}
          />
        );
      case 'history':
        return (
          <TaskHistoryScreen
            userId={authProfile?.id || userProfile?.id}
            initialFilter={historyInitialFilter}
          />
        );
      case 'profile':
        return <PickupBoyProfileScreen userId={userProfile?.id} />;
      default:
        return renderDashboard();
    }
  };

  const getStatusColor = (status: string) => {
    switch (String(status || '').toUpperCase()) {
      case 'ASSIGNED':
      case 'NOT_ASSIGNED':
      case 'PENDING':
      case 'ACCEPTED':
        return '#D97706';
      case 'IN_TRANSIT':
      case 'PICKED_UP':
      case 'ON_THE_WAY':
      case 'VEHICLE_IN_TRANSIT':
      case 'OTP_VERIFIED':
      case 'PICKED':
        return COLORS.primary;
      case 'VEHICLE_DROPPED_AT_WORKSHOP':
      case 'ARRIVED_AT_WORKSHOP':
      case 'DROPPED':
      case 'DELIVERED':
      case 'DELIVERED_TO_CUSTOMER':
        return COLORS.success;
      case 'CANCELLED':
      case 'FAILED_PICKUP':
        return COLORS.danger;
      default:
        return COLORS.gray[500];
    }
  };

  const freshLeads = [...ongoingTasks, ...upcomingTasks];
  const recentCompleted = completedTasks.slice(0, 3);

  const renderTaskCard = (task: any, index: number, isCompleted = false) => {
    const address = task.customer_address || task.pickup_address || task.address;
    const status = String(task.pickup_status || task.status || 'ASSIGNED');
    const isDelivery =
      !task.pickup_required ||
      task.status === 'READY_FOR_DELIVERY' ||
      task.status === 'COD_PENDING';
    const taskType = isDelivery ? 'DELIVERY' : 'PICKUP';
    const completedAt = getPickupHistoryCompletedAt(task);

    return (
      <PickupLeadCard
        key={task.id || index}
        leadNumber={task.lead_number}
        customerName={task.customer_name}
        customerPhone={task.customer_phone}
        vehicleNumber={task.vehicle_number}
        vehicleMake={task.vehicle_make}
        vehicleModel={task.vehicle_model}
        taskType={taskType as 'PICKUP' | 'DELIVERY'}
        statusLabel={formatPickupStatusLabel(status)}
        statusColor={getStatusColor(status)}
        address={address}
        footerText={
          isCompleted && completedAt
            ? `Completed · ${formatDateTime(completedAt)}`
            : task.preferred_date
              ? `Scheduled · ${formatDateTime(task.preferred_date)}`
              : undefined
        }
        onPress={() =>
          navigation.navigate('PickupJobDetail', { taskId: task.id, leadId: task.id })
        }
      />
    );
  };

  const renderJobSection = (
    title: string,
    tasks: any[],
    emptyTitle: string,
    emptySub: string,
    onViewAll: () => void,
    isCompleted = false,
  ) => (
    <View style={styles.jobSection}>
      <View style={styles.sectionRow}>
        <Text style={styles.jobSectionTitle}>{title}</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.seeAllLink}>View all</Text>
        </TouchableOpacity>
      </View>
      {tasks.length > 0 ? (
        tasks.map((task, index) => renderTaskCard(task, index, isCompleted))
      ) : (
        <View style={styles.sectionEmpty}>
          <Text style={styles.sectionEmptyTxt}>{emptyTitle}</Text>
          <Text style={styles.sectionEmptySub}>{emptySub}</Text>
        </View>
      )}
    </View>
  );

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
        <TouchableOpacity
          style={[styles.statCard, { borderLeftColor: '#D97706' }]}
          activeOpacity={0.85}
          onPress={() => openTasks('assigned')}
        >
          <Text style={[styles.statValue, { color: '#D97706' }]}>{stats.pendingTasks}</Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, { borderLeftColor: '#004AAD' }]}
          activeOpacity={0.85}
          onPress={() => openTasks('in_transit')}
        >
          <Text style={[styles.statValue, { color: '#004AAD' }]}>{stats.inTransit}</Text>
          <Text style={styles.statLabel}>Ongoing</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, { borderLeftColor: '#059669' }]}
          activeOpacity={0.85}
          onPress={() => openHistory('completed')}
        >
          <Text style={[styles.statValue, { color: '#059669' }]}>{stats.completedToday}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, { borderLeftColor: '#EA580C' }]}
          activeOpacity={0.85}
          onPress={() => openHistory('all')}
        >
          <Text style={[styles.statValue, { color: '#EA580C' }]}>{stats.totalCompleted}</Text>
          <Text style={styles.statLabel}>Total done</Text>
        </TouchableOpacity>
      </View>

      {renderJobSection(
        'Fresh leads — to do',
        freshLeads,
        'No pending jobs',
        'New pickup/delivery assignments will show here',
        () => openTasks('all'),
      )}

      {renderJobSection(
        'Recently completed',
        recentCompleted,
        'No completed jobs',
        'Finished jobs for selected date range appear here',
        () => openHistory('completed'),
        true,
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
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  addressRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  directionsLink: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    paddingHorizontal: 0,
  },
  jobSection: {
    marginTop: SPACING.md,
  },
  jobSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textHeading,
    flex: 1,
  },
  sectionEmpty: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    marginHorizontal: 16,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  sectionEmptyTxt: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textHeading,
  },
  sectionEmptySub: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  seeAllLink: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.primary,
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
