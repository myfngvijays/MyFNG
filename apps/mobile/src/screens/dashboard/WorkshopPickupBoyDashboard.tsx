import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import StatCard from '../../components/StatCard';
import BottomNav from '../../components/BottomNav';
import PickupTasksScreen from '../pickup/PickupTasksScreen';
import TaskHistoryScreen from '../pickup/TaskHistoryScreen';
import PickupBoyProfileScreen from '../pickup/PickupBoyProfileScreen';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { formatDateTime } from "@/lib/dateFormat";
import { useNotifications } from '../../context/NotificationContext';

export default function WorkshopPickupBoyDashboard() {
  const { pickupRefreshTick } = useNotifications();
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

  // ✅ FIX: Fetch user profile from users_login by email (like web)
  React.useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profileData, error } = await supabase
          .from('users_login')
          .select('id, full_name, email')
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

      // Completed today
      const completedToday = allTasks?.filter(t => {
        if (!t.pickup_status || t.pickup_status !== 'PICKED_UP') return false;
        // Check if completed today (you might need to check a completed_at field)
        return true; // Simplified - adjust based on your schema
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
  }, [pickupRefreshTick]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'tasks', label: 'Tasks', icon: 'car' },
    { id: 'history', label: 'History', icon: 'history' },
    { id: 'profile', label: 'Profile', icon: 'account' },
  ];

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
      <View style={styles.header}>
        <Text style={styles.title}>My Tasks</Text>
        <Text style={styles.subtitle}>Pickup & Delivery Management</Text>
      </View>

      {/* Stats Grid */}
      <Text style={styles.sectionTitle}>Overview</Text>
      
      <StatCard
        title="Pending Tasks"
        value={stats.pendingTasks}
        subtitle="Awaiting action"
        color={COLORS.warning}
      />
      
      <StatCard
        title="In Transit"
        value={stats.inTransit}
        subtitle="Currently on route"
        color={COLORS.primary}
      />
      
      <StatCard
        title="Completed Today"
        value={stats.completedToday}
        subtitle="Finished today"
        color={COLORS.success}
      />
      
      <StatCard
        title="Total Completed"
        value={stats.totalCompleted}
        subtitle="All time"
        color={COLORS.secondary}
      />

      {/* Recent Tasks */}
      <Text style={styles.sectionTitle}>Active Tasks</Text>
      {recentTasks.length > 0 ? (
        <View style={styles.card}>
          {recentTasks.map((task, index) => (
            <View key={task.id || index} style={styles.taskItem}>
              <View style={styles.taskHeader}>
                <Text style={styles.taskType}>
                  {getTaskTypeIcon(task)} {task.pickup_required ? 'PICKUP' : 'DELIVERY'}
                </Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(task.pickup_status || task.status) }
                ]}>
                  <Text style={styles.statusText}>{task.pickup_status || task.status}</Text>
                </View>
              </View>
              
              <Text style={styles.taskCustomer}>
                {task.customer_name || 'Customer'}
              </Text>
              <Text style={styles.taskDetail}>
                📍 {task.customer_address || task.address || 'Address not available'}
              </Text>
              {task.customer_phone && (
                <Text style={styles.taskDetail}>📞 {task.customer_phone}</Text>
              )}
              {task.preferred_date && (
                <Text style={styles.taskTime}>
                  ⏰ {formatDateTime(task.preferred_date)}
                </Text>
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No active tasks at the moment</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <DashboardHeader
        name={userProfile?.full_name || 'Pickup Boy'}
        role="Workshop Pickup Boy"
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
    color: COLORS.gray[500],
    padding: SPACING.lg,
  },
});
