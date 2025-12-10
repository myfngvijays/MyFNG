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

export default function CSECallbacksScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [callbacks, setCallbacks] = useState<any[]>([]);

  useEffect(() => {
    fetchCallbacks();
  }, []);

  const fetchCallbacks = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('service_leads')
        .select('*, workshop:workshops(name)')
        .eq('follow_up_required', true)
        .not('next_follow_up_at', 'is', null)
        .order('next_follow_up_at', { ascending: true });

      if (error) throw error;
      setCallbacks(data || []);
    } catch (error) {
      console.error('Error fetching callbacks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCallbacks();
  };

  const handleCompleteCallback = async (leadId: string) => {
    try {
      const { error } = await supabase
        .from('service_leads')
        .update({
          follow_up_required: false,
          cse_followup_completed: true,
        })
        .eq('id', leadId);

      if (error) throw error;
      fetchCallbacks();
    } catch (error) {
      console.error('Error completing callback:', error);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading callbacks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Callbacks" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {callbacks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No pending callbacks</Text>
          </View>
        ) : (
          callbacks.map((callback, index) => (
            <View key={callback.id || index} style={styles.callbackCard}>
              <View style={styles.callbackHeader}>
                <Text style={styles.leadNumber}>{callback.lead_number}</Text>
                <Text style={styles.callbackTime}>
                  {new Date(callback.next_follow_up_at).toLocaleString()}
                </Text>
              </View>
              
              <Text style={styles.customerName}>{callback.customer_name}</Text>
              <Text style={styles.customerPhone}>{callback.customer_phone}</Text>
              
              {callback.workshop?.name && (
                <Text style={styles.workshopName}>Workshop: {callback.workshop.name}</Text>
              )}
              
              <TouchableOpacity
                style={styles.completeButton}
                onPress={() => handleCompleteCallback(callback.id)}
              >
                <Text style={styles.completeButtonText}>Mark as Completed</Text>
              </TouchableOpacity>
            </View>
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
  callbackCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  callbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  leadNumber: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
  },
  callbackTime: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
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
  workshopName: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  completeButton: {
    backgroundColor: COLORS.success,
    padding: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonText: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
});
