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

export default function CVDTaskDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { taskId } = route.params as any;
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<any>(null);

  useEffect(() => {
    fetchTripDetail();
  }, [taskId]);

  const fetchTripDetail = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_leads')
        .select('*, technician:users_login(full_name, phone)')
        .eq('id', taskId)
        .single();

      if (error) throw error;
      setTrip(data);
    } catch (error) {
      console.error('Error fetching trip:', error);
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
      fetchTripDetail();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update status');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading trip details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Trip Details" onBack={() => navigation.goBack()} />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.tripNumber}>{trip?.lead_number}</Text>
          <Text style={styles.status}>{trip?.status}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <Text style={styles.infoText}>Name: {trip?.customer_name}</Text>
          <Text style={styles.infoText}>Phone: {trip?.customer_phone}</Text>
          {trip?.service_address && (
            <Text style={styles.infoText}>Address: {trip.service_address}</Text>
          )}
        </View>

        {trip?.technician && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Technician</Text>
            <Text style={styles.infoText}>Name: {trip.technician.full_name}</Text>
            <Text style={styles.infoText}>Phone: {trip.technician.phone}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          {trip?.status === 'ASSIGNED' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleUpdateStatus('IN_PROGRESS')}
            >
              <Text style={styles.actionButtonText}>Start Trip</Text>
            </TouchableOpacity>
          )}
          {trip?.status === 'IN_PROGRESS' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.success }]}
              onPress={() => handleUpdateStatus('COMPLETED')}
            >
              <Text style={styles.actionButtonText}>Complete Trip</Text>
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
  tripNumber: {
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
