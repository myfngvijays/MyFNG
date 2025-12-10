import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CMRSATaskDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { taskId } = route.params as any;
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<any>(null);

  useEffect(() => {
    fetchTaskDetail();
  }, [taskId]);

  const fetchTaskDetail = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('id', taskId)
        .single();

      if (error) throw error;
      setTask(data);
    } catch (error) {
      console.error('Error fetching task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('service_leads')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (error) throw error;
      Alert.alert('Success', 'Status updated successfully');
      fetchTaskDetail();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update status');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading task details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Task Details" onBack={() => navigation.goBack()} />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.taskNumber}>{task?.lead_number}</Text>
          <Text style={styles.status}>{task?.status}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <Text style={styles.infoText}>Name: {task?.customer_name}</Text>
          <Text style={styles.infoText}>Phone: {task?.customer_phone}</Text>
          {task?.service_location && (
            <Text style={styles.infoText}>Location: {task.service_location}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          {task?.status === 'ASSIGNED' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleUpdateStatus('IN_PROGRESS')}
            >
              <Text style={styles.actionButtonText}>Start Service</Text>
            </TouchableOpacity>
          )}
          {task?.status === 'IN_PROGRESS' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.success }]}
              onPress={() => handleUpdateStatus('COMPLETED')}
            >
              <Text style={styles.actionButtonText}>Mark as Completed</Text>
            </TouchableOpacity>
          )}
        </View>
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
  section: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    margin: SPACING.md,
    marginTop: 0,
    borderRadius: 8,
  },
  taskNumber: {
    fontSize: SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.xs,
  },
  status: {
    fontSize: SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.sm,
  },
  infoText: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: SIZES.md,
    fontWeight: '600',
  },
});
