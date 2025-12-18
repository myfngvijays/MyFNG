import React, { useEffect, useState } from 'react';
import { 
import { formatDateTime } from "@/lib/dateFormat";
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import type { RealtimeChannel } from '@supabase/supabase-js';

export default function TaskHistoryScreen({ userId }) {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all'); // all, completed, cancelled
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✅ FIX: Fetch userId if not provided
    if (!userId) {
      fetchUserId();
    } else {
      fetchHistory();
    }
  }, [userId]);

  useEffect(() => {
    // ✅ FIX: Setup realtime subscription when userId is available
    if (!userId) return;

    let channel: RealtimeChannel;

    const setupRealtimeSubscription = () => {
      channel = supabase
        .channel('pickup-boy-history')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'service_leads'
          },
            (payload) => {
              fetchHistory();
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
  }, [userId]);

  useEffect(() => {
    filterTasks();
  }, [filter, tasks]);

  // ✅ FIX: Fetch user ID by email (like web)
  const fetchUserId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (userProfile?.id) {
        // Update userId state to trigger fetchHistory and realtime subscription
        // Note: This component receives userId as prop, so we'll call fetchHistory directly
        await fetchHistory(userProfile.id);
      }
    } catch (error) {
      // Error handled silently
    }
  };

  const fetchHistory = async (pickupBoyId?: string) => {
    const idToUse = pickupBoyId || userId;
    if (!idToUse) return;

    try {
      setLoading(true);

      // ✅ FIX: Fetch from service_leads table (like web)
      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('assigned_pickup_boy_id', idToUse)
        .eq('pickup_required', true)
        .not('status', 'in', '(REJECTED)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      // ✅ FIX: Format tasks for display
      const formattedTasks = (data || []).map(item => ({
        id: item.id,
        lead_number: item.lead_number,
        customer_name: item.customer_name,
        customer_phone: item.customer_phone,
        customer_address: item.customer_address || item.address,
        vehicle_number: item.vehicle_number,
        vehicle_make: item.vehicle_make,
        vehicle_model: item.vehicle_model,
        task_type: item.pickup_required ? 'PICKUP' : 'DELIVERY',
        pickup_address: item.customer_address || item.address,
        delivery_address: item.workshop_address,
        status: item.pickup_status === 'PICKED_UP' || item.pickup_status === 'DELIVERED' ? 'COMPLETED' : 
                item.status === 'CANCELLED' ? 'CANCELLED' : item.pickup_status || item.status,
        completed_at: item.pickup_completed_at || item.updated_at,
        created_at: item.created_at,
      }));

      setTasks(formattedTasks);
    } catch (error) {
      Alert.alert('Error', 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const filterTasks = () => {
    if (filter === 'all') {
      setFilteredTasks(tasks);
    } else if (filter === 'completed') {
      setFilteredTasks(tasks.filter(t => 
        t.status === 'COMPLETED' || 
        t.pickup_status === 'PICKED_UP' || 
        t.pickup_status === 'DELIVERED'
      ));
    } else if (filter === 'cancelled') {
      setFilteredTasks(tasks.filter(t => 
        t.status === 'CANCELLED' || 
        t.status === 'REJECTED'
      ));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
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
    return status === 'COMPLETED' ? COLORS.success : COLORS.danger;
  };

  const renderTask = ({ item }) => (
    <View style={styles.taskCard}>
      <View style={styles.taskHeader}>
        <View style={styles.taskTypeContainer}>
          <Text style={styles.taskTypeIcon}>{getTaskTypeIcon(item.task_type)}</Text>
          <Text style={styles.taskType}>{item.task_type}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <Text style={styles.customerName}>{item.customer_name}</Text>
      
      {item.pickup_address && (
        <Text style={styles.taskDetail}>📍 Pickup: {item.pickup_address}</Text>
      )}
      {item.delivery_address && (
        <Text style={styles.taskDetail}>📍 Delivery: {item.delivery_address}</Text>
      )}
      
      {item.completed_at && (
        <Text style={styles.taskTime}>
          ✓ Completed: {formatDateTime(item.completed_at)}
        </Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Task History</Text>
        <Text style={styles.subtitle}>Completed & cancelled tasks</Text>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {['all', 'completed', 'cancelled'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterButton, filter === status && styles.filterButtonActive]}
            onPress={() => setFilter(status)}
          >
            <Text style={[styles.filterText, filter === status && styles.filterTextActive]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{tasks.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {tasks.filter(t => 
              t.status === 'COMPLETED' || 
              t.pickup_status === 'PICKED_UP' || 
              t.pickup_status === 'DELIVERED'
            ).length}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {tasks.filter(t => 
              t.status === 'CANCELLED' || 
              t.status === 'REJECTED'
            ).length}
          </Text>
          <Text style={styles.statLabel}>Cancelled</Text>
        </View>
      </View>

      <FlatList
        data={filteredTasks}
        renderItem={renderTask}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No history found</Text>
          </View>
        }
      />
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
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[600],
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    opacity: 0.9,
    marginTop: SPACING.xs,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  filterButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[200],
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[700],
    fontWeight: '500',
  },
  filterTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[600],
    marginTop: 2,
  },
  listContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl + SPACING.lg,
  },
  taskCard: {
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
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  taskTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  taskTypeIcon: {
    fontSize: 24,
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
  customerName: {
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
  emptyContainer: {
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
  },
});

