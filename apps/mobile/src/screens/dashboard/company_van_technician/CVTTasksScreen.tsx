import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CVTTasksScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('service_type', 'HOME_SERVICE')
        .eq('assigned_technician_id', user.id)
        .in('status', ['ASSIGNED', 'IN_PROGRESS', 'PENDING'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return COLORS.warning;
      case 'ASSIGNED':
        return COLORS.info;
      case 'IN_PROGRESS':
        return COLORS.primary;
      default:
        return COLORS.textSecondary;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading tasks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="My Tasks" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {tasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tasks assigned</Text>
          </View>
        ) : (
          tasks.map((task, index) => (
            <TouchableOpacity
              key={task.id || index}
              style={styles.taskCard}
              onPress={() => navigation.navigate('CVTTaskDetail', { taskId: task.id })}
            >
              <View style={styles.taskHeader}>
                <Text style={styles.taskNumber}>{task.lead_number}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(task.status) }
                  ]}
                >
                  <Text style={styles.statusText}>{task.status}</Text>
                </View>
              </View>
              
              <Text style={styles.customerName}>{task.customer_name}</Text>
              <Text style={styles.customerPhone}>{task.customer_phone}</Text>
              {task.service_address && (
                <Text style={styles.address}>📍 {task.service_address}</Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
  },
  taskCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  taskNumber: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: SIZES.xs,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  customerName: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  customerPhone: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  address: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
});
