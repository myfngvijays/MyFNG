import React, { useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '@/lib/dateFormat';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { AC } from '../../components/workshop/advisorCrmUi';
import PickupLeadCard from '../../components/workshop/PickupLeadCard';
import PickupFilterDropdown from '../../components/workshop/PickupFilterDropdown';
import {
  isActivePickupBoyTask,
  isActiveDeliveryBoyTask,
  isPickupInTransit,
  isPickupScheduled,
  formatPickupStatusLabel,
} from '../../lib/pickupTaskFlow';

type TaskFilter = 'all' | 'pickup' | 'delivery' | 'assigned' | 'in_transit';

const FILTER_LABELS: Record<TaskFilter, string> = {
  all: 'All tasks',
  pickup: 'Pickup',
  delivery: 'Delivery',
  assigned: 'Assigned',
  in_transit: 'In transit',
};

function statusColor(rawStatus: string) {
  const s = String(rawStatus || '').toUpperCase();
  if (['ASSIGNED', 'NOT_ASSIGNED', 'PENDING', 'ACCEPTED'].includes(s)) return '#D97706';
  if (['IN_TRANSIT', 'VEHICLE_IN_TRANSIT', 'ON_THE_WAY', 'OTP_VERIFIED', 'PICKED', 'PICKED_UP'].includes(s)) {
    return COLORS.primary;
  }
  if (s === 'READY_FOR_DELIVERY' || s === 'COD_PENDING') return '#0284C7';
  return COLORS.gray[500];
}

export default function PickupTasksScreen({
  userId,
  initialFilter = 'all',
}: {
  userId?: string;
  initialFilter?: string;
}) {
  const navigation = useNavigation<any>();
  const [tasks, setTasks] = useState<any[]>([]);
  const [filter, setFilter] = useState<TaskFilter>(
    (['all', 'pickup', 'delivery', 'assigned', 'in_transit'].includes(initialFilter)
      ? initialFilter
      : 'all') as TaskFilter,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<string | undefined>(userId);

  useEffect(() => {
    if (['all', 'pickup', 'delivery', 'assigned', 'in_transit'].includes(initialFilter)) {
      setFilter(initialFilter as TaskFilter);
    }
  }, [initialFilter]);

  useEffect(() => {
    setResolvedUserId(userId);
  }, [userId]);

  useEffect(() => {
    void bootstrap();
  }, [resolvedUserId]);

  const bootstrap = async () => {
    let id = resolvedUserId;
    if (!id) {
      id = (await fetchUserId()) || undefined;
      if (id) setResolvedUserId(id);
    }
    if (id) await fetchTasks(id);
  };

  useEffect(() => {
    if (!resolvedUserId) return;

    const channel = supabase
      .channel(`pickup-tasks-${resolvedUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads',
          filter: `assigned_pickup_boy_id=eq.${resolvedUserId}`,
        },
        () => {
          void fetchTasks(resolvedUserId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolvedUserId]);

  const fetchUserId = async () => {
    if (userId) return userId;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();
      return userProfile?.id || null;
    } catch {
      return null;
    }
  };

  const fetchTasks = async (pickupBoyId?: string) => {
    const id = pickupBoyId || resolvedUserId;
    if (!id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('assigned_pickup_boy_id', id)
        .not('status', 'in', '(REJECTED,CANCELLED)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const openRows = (data || []).filter(
        (item) => isActivePickupBoyTask(item) || isActiveDeliveryBoyTask(item),
      );

      setTasks(
        openRows.map((item) => {
          const rawStatus = String(item.pickup_status || item.status || 'ASSIGNED').toUpperCase();
          const isDelivery =
            !item.pickup_required ||
            item.status === 'READY_FOR_DELIVERY' ||
            item.status === 'COD_PENDING';
          return {
            id: item.id,
            lead_number: item.lead_number,
            customer_name: item.customer_name,
            customer_phone: item.customer_phone,
            customer_address: item.customer_address || item.address,
            vehicle_number: item.vehicle_number,
            vehicle_make: item.vehicle_make,
            vehicle_model: item.vehicle_model,
            task_type: isDelivery ? 'DELIVERY' : 'PICKUP',
            rawStatus,
            statusLabel: formatPickupStatusLabel(rawStatus),
            scheduled_time: item.preferred_date || item.created_at,
            isScheduled: isPickupScheduled(item),
            isInTransit: isPickupInTransit(item),
          };
        }),
      );
    } catch {
      Alert.alert('Error', 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    if (filter === 'pickup') return tasks.filter((t) => t.task_type === 'PICKUP');
    if (filter === 'delivery') return tasks.filter((t) => t.task_type === 'DELIVERY');
    if (filter === 'assigned') return tasks.filter((t) => t.isScheduled);
    if (filter === 'in_transit') return tasks.filter((t) => t.isInTransit);
    return tasks;
  }, [filter, tasks]);

  const filterOptions = useMemo(
    () => [
      { key: 'all', label: 'All', count: tasks.length },
      { key: 'pickup', label: 'Pickup', count: tasks.filter((t) => t.task_type === 'PICKUP').length },
      { key: 'delivery', label: 'Delivery', count: tasks.filter((t) => t.task_type === 'DELIVERY').length },
      { key: 'assigned', label: 'Assigned', count: tasks.filter((t) => t.isScheduled).length },
      { key: 'in_transit', label: 'In transit', count: tasks.filter((t) => t.isInTransit).length },
    ],
    [tasks],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  };

  const renderTask = ({ item }: { item: any }) => (
    <PickupLeadCard
      leadNumber={item.lead_number}
      customerName={item.customer_name}
      customerPhone={item.customer_phone}
      vehicleNumber={item.vehicle_number}
      vehicleMake={item.vehicle_make}
      vehicleModel={item.vehicle_model}
      taskType={item.task_type}
      statusLabel={item.statusLabel}
      statusColor={statusColor(item.rawStatus)}
      address={item.customer_address}
      footerText={
        item.scheduled_time ? `Scheduled · ${formatDateTime(item.scheduled_time)}` : undefined
      }
      onPress={() => navigation.navigate('PickupJobDetail', { taskId: item.id, leadId: item.id })}
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading tasks...</Text>
      </View>
    );
  }

  return (
    <View style={AC.page}>
      <Text style={AC.sub}>Active pickup & delivery jobs assigned to you</Text>

      <PickupFilterDropdown
        activeKey={filter}
        options={filterOptions}
        onChange={(key) => setFilter(key as TaskFilter)}
        summary={`${filteredTasks.length} ${FILTER_LABELS[filter].toLowerCase()}`}
      />

      <FlatList
        data={filteredTasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={AC.empty}>
            <Text style={AC.emptyTxt}>No {FILTER_LABELS[filter].toLowerCase()}</Text>
            <Text style={AC.emptySub}>Finished jobs appear in History tab</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  listContainer: {
    paddingBottom: SPACING.xxl + SPACING.lg,
    paddingTop: 4,
  },
});
