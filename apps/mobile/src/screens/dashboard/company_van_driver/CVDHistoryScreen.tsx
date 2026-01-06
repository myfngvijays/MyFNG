import React, { useState, useEffect } from 'react';
import { formatDateDMY } from "@/lib/dateFormat";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CVDHistoryScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('service_type', 'HOME_SERVICE')
        .eq('assigned_driver_id', user.id)
        .eq('status', 'COMPLETED')
        .order('completed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Trip History" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No completed trips found</Text>
          </View>
        ) : (
          history.map((trip, index) => (
            <View key={trip.id || index} style={styles.tripCard}>
              <Text style={styles.tripNumber}>{trip.lead_number}</Text>
              <Text style={styles.customerName}>{trip.customer_name}</Text>
              {trip.completed_at && (
                <Text style={styles.completedDate}>
                  Completed: {formatDateDMY(trip.completed_at)}
                </Text>
              )}
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
  tripCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  tripNumber: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.xs,
  },
  customerName: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  completedDate: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
});
