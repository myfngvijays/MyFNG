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

export default function HSMVansScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vans, setVans] = useState<any[]>([]);

  useEffect(() => {
    fetchVans();
  }, []);

  const fetchVans = async () => {
    try {
      setLoading(true);
      // Adjust table name as needed
      const { data, error } = await supabase
        .from('service_vans')
        .select('*')
        .order('van_number', { ascending: true });

      if (error && error.code !== 'PGRST116') throw error;
      
      // Fallback if table doesn't exist
      setVans(data || []);
    } catch (error) {
      console.error('Error fetching vans:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchVans();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'AVAILABLE':
        return COLORS.success;
      case 'BUSY':
        return COLORS.warning;
      case 'MAINTENANCE':
        return COLORS.danger;
      default:
        return COLORS.textSecondary;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading vans...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Service Vans" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {vans.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No vans found</Text>
          </View>
        ) : (
          vans.map((van, index) => (
            <View key={van.id || index} style={styles.vanCard}>
              <View style={styles.vanHeader}>
                <Text style={styles.vanNumber}>{van.van_number || `Van ${index + 1}`}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(van.status || 'AVAILABLE') }
                  ]}
                >
                  <Text style={styles.statusText}>{van.status || 'AVAILABLE'}</Text>
                </View>
              </View>
              
              {van.driver_name && (
                <Text style={styles.driverName}>Driver: {van.driver_name}</Text>
              )}
              {van.location && (
                <Text style={styles.location}>📍 {van.location}</Text>
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
  vanCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  vanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  vanNumber: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
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
  driverName: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  location: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
});
