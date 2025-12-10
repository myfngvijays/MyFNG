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

export default function CustomerServiceHistoryScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    fetchServiceHistory();
  }, [filter]);

  const fetchServiceHistory = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('email, phone')
        .eq('id', user.id)
        .single();

      if (!userProfile) return;

      let query = supabase
        .from('service_leads')
        .select('*, workshop:workshops(name, phone)')
        .or(`customer_email.eq.${userProfile.email},customer_phone.eq.${userProfile.phone}`)
        .order('created_at', { ascending: false });

      if (filter === 'completed') {
        query = query.eq('status', 'COMPLETED');
      } else if (filter === 'cancelled') {
        query = query.eq('status', 'CANCELLED');
      }

      const { data, error } = await query;

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching service history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchServiceHistory();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return COLORS.success;
      case 'CANCELLED':
        return COLORS.danger;
      case 'IN_PROGRESS':
        return COLORS.info;
      default:
        return COLORS.textSecondary;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading service history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Service History" onBack={() => navigation.goBack()} />
      
      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {(['all', 'completed', 'cancelled'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterButton,
              filter === f && styles.filterButtonActive
            ]}
            onPress={() => setFilter(f)}
          >
            <Text style={[
              styles.filterButtonText,
              filter === f && styles.filterButtonTextActive
            ]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {services.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No service history found</Text>
          </View>
        ) : (
          services.map((service, index) => (
            <View key={service.id || index} style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <Text style={styles.leadNumber}>{service.lead_number}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(service.status) }
                  ]}
                >
                  <Text style={styles.statusText}>{service.status}</Text>
                </View>
              </View>
              
              <Text style={styles.serviceType}>{service.service_type || 'General Service'}</Text>
              
              {service.workshop?.name && (
                <View style={styles.workshopInfo}>
                  <Text style={styles.workshopLabel}>Workshop:</Text>
                  <Text style={styles.workshopName}>{service.workshop.name}</Text>
                </View>
              )}
              
              <View style={styles.serviceDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(service.created_at).toLocaleDateString()}
                  </Text>
                </View>
                {service.actual_amount && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Amount:</Text>
                    <Text style={[styles.detailValue, styles.amountValue]}>
                      ₹{service.actual_amount}
                    </Text>
                  </View>
                )}
              </View>
              
              {service.customer_feedback && (
                <View style={styles.feedbackContainer}>
                  <Text style={styles.feedbackLabel}>Your Feedback:</Text>
                  <Text style={styles.feedbackText}>{service.customer_feedback}</Text>
                  {service.customer_satisfaction_score && (
                    <Text style={styles.ratingText}>
                      Rating: {'⭐'.repeat(service.customer_satisfaction_score)}
                    </Text>
                  )}
                </View>
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
  filterContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: COLORS.white,
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
  serviceCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  leadNumber: {
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
  serviceType: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  workshopInfo: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
    alignItems: 'center',
  },
  workshopLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginRight: SPACING.xs,
  },
  workshopName: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  serviceDetails: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  detailLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  amountValue: {
    color: COLORS.success,
    fontSize: SIZES.md,
  },
  feedbackContainer: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.gray[50],
    borderRadius: 8,
  },
  feedbackLabel: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  feedbackText: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  ratingText: {
    fontSize: SIZES.sm,
    color: COLORS.warning,
  },
});
