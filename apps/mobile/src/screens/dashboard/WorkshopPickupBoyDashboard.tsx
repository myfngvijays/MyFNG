import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import StatCard from '../../components/StatCard';
import BottomNav from '../../components/BottomNav';
import PickupTasksScreen from '../pickup/PickupTasksScreen';
import TaskHistoryScreen from '../pickup/TaskHistoryScreen';
import PickupBoyProfileScreen from '../pickup/PickupBoyProfileScreen';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';

export default function WorkshopPickupBoyDashboard() {
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

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('users_login')
          .select('*')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) setUserProfile(data);
          });
      }
    });
  }, []);

  const fetchDashboardData = async () => {
    if (!userProfile?.id) return;

    try {
      // Fetch pending tasks
      const { count: pendingCount } = await supabase
        .from('pickup_delivery_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to_id', userProfile.id)
        .eq('status', 'ASSIGNED');

      // Fetch in-transit tasks
      const { count: transitCount } = await supabase
        .from('pickup_delivery_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to_id', userProfile.id)
        .eq('status', 'IN_TRANSIT');

      // Fetch completed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: completedTodayCount } = await supabase
        .from('pickup_delivery_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to_id', userProfile.id)
        .eq('status', 'COMPLETED')
        .gte('completed_at', today.toISOString());

      // Fetch total completed
      const { count: totalCompletedCount } = await supabase
        .from('pickup_delivery_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to_id', userProfile.id)
        .eq('status', 'COMPLETED');

      // Fetch recent tasks
      const { data: tasks } = await supabase
        .from('pickup_delivery_tasks')
        .select('*')
        .eq('assigned_to_id', userProfile.id)
        .in('status', ['ASSIGNED', 'IN_TRANSIT'])
        .order('scheduled_time', { ascending: true })
        .limit(5);

      setStats({
        pendingTasks: pendingCount || 0,
        inTransit: transitCount || 0,
        completedToday: completedTodayCount || 0,
        totalCompleted: totalCompletedCount || 0,
      });

      setRecentTasks(tasks || []);
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
    if (userProfile?.id) {
      fetchDashboardData();
    }
  }, [userProfile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: '🏠' },
    { id: 'tasks', label: 'Tasks', icon: '🚗' },
    { id: 'history', label: 'History', icon: '📋' },
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'more', label: 'More', icon: '⚙️' },
  ];

  const handleTabChange = (tab: string) => {
    if (tab === 'more') {
      Alert.alert('Coming Soon', 'Additional features will be available soon!');
    } else {
      setCurrentScreen(tab);
    }
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

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case 'PICKUP': return '📦';
      case 'DELIVERY': return '🚚';
      case 'BOTH': return '🔄';
      default: return '📋';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ASSIGNED': return COLORS.warning;
      case 'IN_TRANSIT': return COLORS.primary;
      case 'COMPLETED': return COLORS.success;
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
            <View key={index} style={styles.taskItem}>
              <View style={styles.taskHeader}>
                <Text style={styles.taskType}>
                  {getTaskTypeIcon(task.task_type)} {task.task_type}
                </Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(task.status) }
                ]}>
                  <Text style={styles.statusText}>{task.status}</Text>
                </View>
              </View>
              
              <Text style={styles.taskCustomer}>
                {task.customer_name || 'Customer'}
              </Text>
              <Text style={styles.taskDetail}>
                📍 {task.pickup_address || task.delivery_address || 'Address not available'}
              </Text>
              {task.customer_phone && (
                <Text style={styles.taskDetail}>📞 {task.customer_phone}</Text>
              )}
              {task.scheduled_time && (
                <Text style={styles.taskTime}>
                  ⏰ {new Date(task.scheduled_time).toLocaleString()}
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
