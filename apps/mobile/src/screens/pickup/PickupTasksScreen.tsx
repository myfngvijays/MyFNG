import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  RefreshControl,
  ActivityIndicator,
  Linking
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';

export default function PickupTasksScreen({ userId }) {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [filter, setFilter] = useState('all'); // all, pickup, delivery, assigned, in_transit
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, [userId]);

  useEffect(() => {
    filterTasks();
  }, [filter, tasks]);

  const fetchTasks = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('pickup_delivery_tasks')
        .select('*')
        .eq('assigned_to_id', userId)
        .in('status', ['ASSIGNED', 'IN_TRANSIT'])
        .order('scheduled_time', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      Alert.alert('Error', 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const filterTasks = () => {
    if (filter === 'all') {
      setFilteredTasks(tasks);
    } else if (filter === 'pickup') {
      setFilteredTasks(tasks.filter(t => t.task_type === 'PICKUP' || t.task_type === 'BOTH'));
    } else if (filter === 'delivery') {
      setFilteredTasks(tasks.filter(t => t.task_type === 'DELIVERY' || t.task_type === 'BOTH'));
    } else if (filter === 'assigned') {
      setFilteredTasks(tasks.filter(t => t.status === 'ASSIGNED'));
    } else if (filter === 'in_transit') {
      setFilteredTasks(tasks.filter(t => t.status === 'IN_TRANSIT'));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const updates: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'IN_TRANSIT') {
        updates.started_at = new Date().toISOString();
      } else if (newStatus === 'COMPLETED') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('pickup_delivery_tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      Alert.alert('Success', `Task ${newStatus.toLowerCase()} successfully`);
      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const confirmAction = (taskId: string, action: string, taskInfo: string) => {
    const actionText = action === 'IN_TRANSIT' ? 'Start' : 'Complete';
    Alert.alert(
      `${actionText} Task`,
      `Are you sure you want to ${actionText.toLowerCase()} this task?\n\n${taskInfo}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText,
          onPress: () => updateTaskStatus(taskId, action)
        }
      ]
    );
  };

  const openMaps = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps');
    });
  };

  const callCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'Could not make call');
    });
  };

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case 'PICKUP': return '📦';
      case 'DELIVERY': return '🚚';
      case 'BOTH': return '🔄';
      default: return '📋';
    }
  };

  const getTaskTypeColor = (type: string) => {
    switch (type) {
      case 'PICKUP': return COLORS.primary;
      case 'DELIVERY': return COLORS.secondary;
      case 'BOTH': return COLORS.accent;
      default: return COLORS.gray[500];
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ASSIGNED': return COLORS.warning;
      case 'IN_TRANSIT': return COLORS.primary;
      case 'COMPLETED': return COLORS.success;
      default: return COLORS.gray[500];
    }
  };

  const renderTask = ({ item }) => {
    const taskInfo = `${item.customer_name}\n${item.task_type}`;
    const address = item.task_type === 'PICKUP' ? item.pickup_address : item.delivery_address;
    
    return (
      <View style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <View style={styles.taskTypeContainer}>
            <Text style={styles.taskTypeIcon}>{getTaskTypeIcon(item.task_type)}</Text>
            <View style={[
              styles.taskTypeBadge,
              { backgroundColor: getTaskTypeColor(item.task_type) + '20' }
            ]}>
              <Text style={[
                styles.taskTypeText,
                { color: getTaskTypeColor(item.task_type) }
              ]}>
                {item.task_type}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.taskBody}>
          <Text style={styles.customerName}>{item.customer_name}</Text>
          
          {address && (
            <TouchableOpacity 
              style={styles.addressContainer}
              onPress={() => openMaps(address)}
            >
              <Text style={styles.taskDetail}>📍 {address}</Text>
              <Text style={styles.directionsText}>Get Directions →</Text>
            </TouchableOpacity>
          )}
          
          {item.customer_phone && (
            <TouchableOpacity onPress={() => callCustomer(item.customer_phone)}>
              <Text style={[styles.taskDetail, styles.phoneLink]}>
                📞 {item.customer_phone} (Tap to call)
              </Text>
            </TouchableOpacity>
          )}
          
          {item.vehicle_details && (
            <Text style={styles.taskDetail}>🚗 {item.vehicle_details}</Text>
          )}
          
          {item.scheduled_time && (
            <Text style={styles.taskTime}>
              ⏰ Scheduled: {new Date(item.scheduled_time).toLocaleString()}
            </Text>
          )}
          
          {item.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>📝 Notes:</Text>
              <Text style={styles.notesText}>{item.notes}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {item.status === 'ASSIGNED' && (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: COLORS.success }]}
              onPress={() => confirmAction(item.id, 'IN_TRANSIT', taskInfo)}
            >
              <Text style={styles.actionButtonText}>▶️ Start Task</Text>
            </TouchableOpacity>
          )}
          
          {item.status === 'IN_TRANSIT' && (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
              onPress={() => confirmAction(item.id, 'COMPLETED', taskInfo)}
            >
              <Text style={styles.actionButtonText}>✓ Complete Task</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading tasks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Tasks</Text>
        <Text style={styles.subtitle}>Pickup & Delivery assignments</Text>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {['all', 'pickup', 'delivery', 'assigned', 'in_transit'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterButton, filter === status && styles.filterButtonActive]}
            onPress={() => setFilter(status)}
          >
            <Text style={[styles.filterText, filter === status && styles.filterTextActive]}>
              {status === 'all' ? 'All' : 
               status === 'in_transit' ? 'In Transit' : 
               status.charAt(0).toUpperCase() + status.slice(1)}
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
          <Text style={styles.statValue}>{tasks.filter(t => t.status === 'ASSIGNED').length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{tasks.filter(t => t.status === 'IN_TRANSIT').length}</Text>
          <Text style={styles.statLabel}>Active</Text>
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
            <Text style={styles.emptyText}>No tasks found</Text>
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
    flexWrap: 'wrap',
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
  taskTypeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  taskTypeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
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
  taskBody: {
    marginBottom: SPACING.sm,
  },
  customerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.xs,
  },
  addressContainer: {
    marginBottom: SPACING.xs,
  },
  taskDetail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: 4,
  },
  directionsText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  phoneLink: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  taskTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[400],
    marginTop: SPACING.xs,
  },
  notesContainer: {
    backgroundColor: COLORS.gray[100],
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.xs,
  },
  notesLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginBottom: 4,
  },
  notesText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
  },
  actionButtons: {
    marginTop: SPACING.sm,
  },
  actionButton: {
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
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

