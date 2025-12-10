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

export default function AuditorWorkshopsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workshops, setWorkshops] = useState<any[]>([]);

  useEffect(() => {
    fetchWorkshops();
  }, []);

  const fetchWorkshops = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setWorkshops(data || []);
    } catch (error) {
      console.error('Error fetching workshops:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchWorkshops();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading workshops...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Workshops" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {workshops.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No workshops found</Text>
          </View>
        ) : (
          workshops.map((workshop, index) => (
            <View key={workshop.id || index} style={styles.workshopCard}>
              <Text style={styles.workshopName}>{workshop.name}</Text>
              {workshop.city && (
                <Text style={styles.workshopCity}>📍 {workshop.city}</Text>
              )}
              <Text style={styles.workshopStatus}>
                Status: {workshop.is_verified ? 'Verified' : 'Pending'}
              </Text>
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
  workshopCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  workshopName: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.xs,
  },
  workshopCity: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  workshopStatus: {
    fontSize: SIZES.sm,
    color: COLORS.info,
  },
});
