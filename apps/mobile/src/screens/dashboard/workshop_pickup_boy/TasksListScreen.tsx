import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface PickupTask {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  vehicle_number: string;
  pickup_status: string;
  pickup_type: string;
  pickup_scheduled_time: string;
}

export default function TasksListScreen() {
  const navigation = useNavigation();
  const [tasks, setTasks] = useState<PickupTask[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<PickupTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [userId, setUserId] = useState<string | null>(null);

  const [stats, setStats] = useState({
    pending: 0,
    inTransit: 0,
    completed: 0,
    failed: 0,
  });

  useEffect(() => {
    fetchUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchTasks();

      // ✅ FIX: Setup realtime subscription (like web)
      let channel: RealtimeChannel;

      const setupRealtimeSubscription = () => {
        if (!userId) return;

        channel = supabase
          .channel('pickup-boy-tasks')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'service_leads'
            },
            (payload) => {
              fetchTasks();
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
  }, [userId]);

  useEffect(() => {
    filterTasks();
  }, [tasks, searchQuery, activeFilter]);

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
        setUserId(userProfile.id);
      }
    } catch (error) {
      // Error handled silently
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);

      if (!userId) return;

      // ✅ FIX: Use assigned_pickup_boy_id (like web)
      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('assigned_pickup_boy_id', userId)
        .eq('pickup_required', true)
        .not('status', 'in', '(REJECTED,CANCELLED)')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const formattedTasks = (data || []).map(item => ({
        id: item.id,
        lead_number: item.lead_number,
        customer_name: item.customer_name,
        customer_phone: item.customer_phone,
        customer_address: item.customer_address,
        vehicle_number: item.vehicle_number,
        pickup_status: item.pickup_status || 'PENDING',
        pickup_type: item.pickup_type || 'PICKUP',
        pickup_scheduled_time: item.pickup_scheduled_time,
      }));

      setTasks(formattedTasks);

      // Calculate stats
      const pending = formattedTasks.filter(t => t.pickup_status === 'PENDING').length;
      const inTransit = formattedTasks.filter(t => t.pickup_status === 'IN_TRANSIT').length;
      const completed = formattedTasks.filter(t => t.pickup_status === 'COMPLETED').length;
      const failed = formattedTasks.filter(t => t.pickup_status === 'FAILED').length;

      setStats({ pending, inTransit, completed, failed });
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterTasks = () => {
    let filtered = [...tasks];

    // Apply status filter
    if (activeFilter !== 'ALL') {
      filtered = filtered.filter(task => task.pickup_status === activeFilter);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        task =>
          task.lead_number?.toLowerCase().includes(query) ||
          task.customer_name?.toLowerCase().includes(query) ||
          task.vehicle_number?.toLowerCase().includes(query)
      );
    }

    setFilteredTasks(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      PENDING: '#f59e0b',
      IN_TRANSIT: '#3b82f6',
      COMPLETED: '#10b981',
      FAILED: '#ef4444',
    };
    return colors[status] || '#6b7280';
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleNavigate = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url);
  };

  const renderTaskCard = ({ item }: { item: PickupTask }) => (
    <TouchableOpacity
      style={styles.taskCard}
      onPress={() => navigation.navigate('PickupJobDetail' as never, { taskId: item.id } as never)}
    >
      <View style={styles.taskHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.leadNumber}>#{item.lead_number}</Text>
          <Text style={styles.customerName}>{item.customer_name}</Text>
          <Text style={styles.vehicle}>{item.vehicle_number}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.pickup_status) }]}>
          <Text style={styles.statusText}>{item.pickup_status}</Text>
        </View>
      </View>

      <View style={styles.typeTag}>
        <Text style={styles.typeText}>{item.pickup_type}</Text>
      </View>

      {item.customer_address && (
        <View style={styles.addressContainer}>
          <Text style={styles.addressLabel}>📍 Address:</Text>
          <Text style={styles.addressText}>{item.customer_address}</Text>
        </View>
      )}

      {item.pickup_scheduled_time && (
        <View style={styles.timeContainer}>
          <Text style={styles.timeLabel}>⏰ Scheduled:</Text>
          <Text style={styles.timeText}>
            {new Date(item.pickup_scheduled_time).toLocaleString()}
          </Text>
        </View>
      )}

      <View style={styles.taskActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleCall(item.customer_phone)}
        >
          <Text style={styles.actionButtonText}>📞 Call</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleNavigate(item.customer_address)}
        >
          <Text style={styles.actionButtonText}>🗺️ Navigate</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const filters = [
    { label: 'All', value: 'ALL', count: tasks.length },
    { label: 'Pending', value: 'PENDING', count: stats.pending },
    { label: 'In Transit', value: 'IN_TRANSIT', count: stats.inTransit },
    { label: 'Completed', value: 'COMPLETED', count: stats.completed },
    { label: 'Failed', value: 'FAILED', count: stats.failed },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading tasks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Tasks</Text>
        <Text style={styles.subtitle}>{filteredTasks.length} tasks</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
          <Text style={styles.statValue}>{stats.inTransit}</Text>
          <Text style={styles.statLabel}>In Transit</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
          <Text style={styles.statValue}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
          <Text style={styles.statValue}>{stats.failed}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search tasks..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        {filters.map(filter => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterChip,
              activeFilter === filter.value && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(filter.value)}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === filter.value && styles.filterTextActive,
              ]}
            >
              {filter.label} ({filter.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tasks List */}
      <FlatList
        data={filteredTasks}
        renderItem={renderTaskCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No tasks found</Text>
            <Text style={styles.emptySubtext}>Your pickup/dropoff tasks will appear here</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  leadNumber: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  vehicle: {
    fontSize: 13,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    height: 28,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  typeTag: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7c3aed',
  },
  addressContainer: {
    marginBottom: 8,
  },
  addressLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  addressText: {
    fontSize: 13,
    color: '#111827',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: 8,
  },
  timeText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  taskActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
});

