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
  formatPickupHistoryStatus,
  formatPickupStatusLabel,
  getPickupHistoryCompletedAt,
  isHistoryTaskCancelled,
  isPickupBoyHistoryTask,
} from '../../lib/pickupTaskFlow';

type HistoryFilter = 'all' | 'completed' | 'cancelled';

const FILTER_LABELS: Record<HistoryFilter, string> = {
  all: 'All history',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function historyStatusColor(historyStatus: string) {
  if (historyStatus === 'COMPLETED') return COLORS.success;
  if (historyStatus === 'CANCELLED') return COLORS.danger;
  return COLORS.gray[500];
}

export default function TaskHistoryScreen({
  userId,
  initialFilter = 'all',
}: {
  userId?: string;
  initialFilter?: string;
}) {
  const navigation = useNavigation<any>();
  const [tasks, setTasks] = useState<any[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>(
    (['all', 'completed', 'cancelled'].includes(initialFilter)
      ? initialFilter
      : 'all') as HistoryFilter,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<string | undefined>(userId);

  useEffect(() => {
    if (['all', 'completed', 'cancelled'].includes(initialFilter)) {
      setFilter(initialFilter as HistoryFilter);
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
    if (id) await fetchHistory(id);
  };

  useEffect(() => {
    if (!resolvedUserId) return;

    const channel = supabase
      .channel(`pickup-boy-history-${resolvedUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads',
          filter: `assigned_pickup_boy_id=eq.${resolvedUserId}`,
        },
        () => {
          void fetchHistory(resolvedUserId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolvedUserId]);

  const fetchUserId = async () => {
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

  const fetchHistory = async (pickupBoyId?: string) => {
    const idToUse = pickupBoyId || resolvedUserId;
    if (!idToUse) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('assigned_pickup_boy_id', idToUse)
        .not('status', 'in', '(REJECTED)')
        .order('updated_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setTasks(
        (data || [])
          .filter((item) => isPickupBoyHistoryTask(item) || isHistoryTaskCancelled(item))
          .map((item) => {
            const historyStatus = formatPickupHistoryStatus(item);
            const rawStatus = String(item.pickup_status || item.status || '').toUpperCase();
            return {
              id: item.id,
              lead_number: item.lead_number,
              customer_name: item.customer_name,
              customer_phone: item.customer_phone,
              vehicle_number: item.vehicle_number,
              vehicle_make: item.vehicle_make,
              vehicle_model: item.vehicle_model,
              task_type: item.pickup_required ? 'PICKUP' : 'DELIVERY',
              historyStatus,
              statusLabel:
                historyStatus === 'COMPLETED'
                  ? 'Completed'
                  : historyStatus === 'CANCELLED'
                    ? 'Cancelled'
                    : formatPickupStatusLabel(rawStatus),
              pickup_address: item.customer_address || item.address,
              completed_at: getPickupHistoryCompletedAt(item),
            };
          }),
      );
    } catch {
      Alert.alert('Error', 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    if (filter === 'completed') return tasks.filter((t) => t.historyStatus === 'COMPLETED');
    if (filter === 'cancelled') return tasks.filter((t) => t.historyStatus === 'CANCELLED');
    return tasks;
  }, [filter, tasks]);

  const filterOptions = useMemo(
    () => [
      { key: 'all', label: 'All', count: tasks.length },
      {
        key: 'completed',
        label: 'Completed',
        count: tasks.filter((t) => t.historyStatus === 'COMPLETED').length,
      },
      {
        key: 'cancelled',
        label: 'Cancelled',
        count: tasks.filter((t) => t.historyStatus === 'CANCELLED').length,
      },
    ],
    [tasks],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
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
      statusColor={historyStatusColor(item.historyStatus)}
      address={item.pickup_address}
      footerText={
        item.completed_at
          ? `${item.historyStatus === 'COMPLETED' ? 'Completed' : 'Updated'} · ${formatDateTime(item.completed_at)}`
          : undefined
      }
      onPress={() => navigation.navigate('PickupJobDetail', { taskId: item.id, leadId: item.id })}
    />
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
    <View style={AC.page}>
      <Text style={AC.sub}>Completed & cancelled pickup / delivery jobs</Text>

      <PickupFilterDropdown
        activeKey={filter}
        options={filterOptions}
        onChange={(key) => setFilter(key as HistoryFilter)}
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
            <Text style={AC.emptySub}>Jobs finish here after workshop drop or delivery</Text>
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
