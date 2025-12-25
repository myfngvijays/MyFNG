import React, { useState, useEffect } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useNavigation } from '@react-navigation/native';

interface PickupTask {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  vehicle_number: string;
  pickup_status: string;
  pickup_type: string;
  scheduled_time: string;
  pickup_boy_id: { full_name: string };
  created_at: string;
}

export default function PickupTrackingScreen() {
  const navigation = useNavigation();
  const [pickups, setPickups] = useState<PickupTask[]>([]);
  const [filteredPickups, setFilteredPickups] = useState<PickupTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [workshopId, setWorkshopId] = useState<string | null>(null);

  const [stats, setStats] = useState({
    pending: 0,
    inTransit: 0,
    completed: 0,
    failed: 0,
  });

  useEffect(() => {
    fetchWorkshopId();
  }, []);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [navigation]);

  useEffect(() => {
    if (workshopId) {
      fetchPickups();
    }
  }, [workshopId]);

  useEffect(() => {
    filterPickups();
  }, [pickups, activeFilter]);

  const fetchWorkshopId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      if (userProfile?.workshop_id) {
        setWorkshopId(userProfile.workshop_id);
      }
    } catch (error) {
      console.error('Error fetching workshop ID:', error);
    }
  };

  const fetchPickups = async () => {
    try {
      setLoading(true);

      if (!workshopId) return;

      const { data, error } = await supabase
        .from('service_leads')
        .select('id, lead_number, customer_name, customer_phone, customer_address, vehicle_number, pickup_status, pickup_type, pickup_scheduled_time, pickup_boy_id(full_name), created_at')
        .eq('workshop_id', workshopId)
        .eq('pickup_required', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = (data || []).map(item => ({
        id: item.id,
        lead_number: item.lead_number,
        customer_name: item.customer_name,
        customer_phone: item.customer_phone,
        customer_address: item.customer_address,
        vehicle_number: item.vehicle_number,
        pickup_status: item.pickup_status || 'PENDING',
        pickup_type: item.pickup_type || 'PICKUP',
        scheduled_time: item.pickup_scheduled_time,
        pickup_boy_id: item.pickup_boy_id,
        created_at: item.created_at,
      }));

      setPickups(formattedData);

      // Calculate stats
      const pending = formattedData.filter(p => p.pickup_status === 'PENDING').length;
      const inTransit = formattedData.filter(p => p.pickup_status === 'IN_TRANSIT').length;
      const completed = formattedData.filter(p => p.pickup_status === 'COMPLETED').length;
      const failed = formattedData.filter(p => p.pickup_status === 'FAILED').length;

      setStats({ pending, inTransit, completed, failed });
    } catch (error) {
      console.error('Error fetching pickups:', error);
      Alert.alert('Error', 'Failed to load pickup tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterPickups = () => {
    if (activeFilter === 'ALL') {
      setFilteredPickups(pickups);
    } else {
      setFilteredPickups(pickups.filter(p => p.pickup_status === activeFilter));
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPickups();
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

  const handleCallCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleCallPickupBoy = (pickupBoyId: string) => {
    // Fetch pickup boy's phone and call
    Alert.alert('Info', 'Calling pickup boy...');
  };

  const renderPickupCard = ({ item }: { item: PickupTask }) => (
    <View style={styles.pickupCard}>
      <View style={styles.cardHeader}>
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

      {item.scheduled_time && (
        <View style={styles.timeContainer}>
          <Text style={styles.timeLabel}>⏰ Scheduled:</Text>
          <Text style={styles.timeText}>
            {formatDateTime(item.scheduled_time)}
          </Text>
        </View>
      )}

      {item.pickup_boy_id && (
        <View style={styles.assigneeContainer}>
          <Text style={styles.assigneeLabel}>👤 Assigned To:</Text>
          <Text style={styles.assigneeText}>{item.pickup_boy_id.full_name}</Text>
        </View>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.callButton}
          onPress={() => handleCallCustomer(item.customer_phone)}
        >
          <Text style={styles.callButtonText}>📞 Customer</Text>
        </TouchableOpacity>
        {item.pickup_boy_id && (
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => handleCallPickupBoy(item.id)}
          >
            <Text style={styles.callButtonText}>📞 Pickup Boy</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const filters = [
    { label: 'All', value: 'ALL', count: pickups.length },
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
          <Text style={styles.loadingText}>Loading pickup tasks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Pickup Tracking</Text>
        <Text style={styles.subtitle}>{filteredPickups.length} tasks</Text>
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

      {/* Pickups List */}
      <FlatList
        data={filteredPickups}
        renderItem={renderPickupCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🚗</Text>
            <Text style={styles.emptyText}>No pickup tasks</Text>
            <Text style={styles.emptySubtext}>Pickup tasks will appear here</Text>
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
  pickupCard: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    marginBottom: 8,
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
  assigneeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  assigneeLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: 8,
  },
  assigneeText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  callButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  callButtonText: {
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

