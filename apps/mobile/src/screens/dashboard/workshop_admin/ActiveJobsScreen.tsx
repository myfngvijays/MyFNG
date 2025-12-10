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

export default function ActiveJobsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    fetchActiveJobs();
  }, []);

  const fetchActiveJobs = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('id', user.id)
        .single();

      if (!userProfile?.workshop_id) return;

      const { data, error } = await supabase
        .from('service_leads')
        .select('*, mechanic:users_login(full_name)')
        .eq('workshop_id', userProfile.workshop_id)
        .in('status', ['ACCEPTED', 'IN_PROGRESS'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching active jobs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchActiveJobs();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACCEPTED':
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
        <Text style={styles.loadingText}>Loading active jobs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Active Jobs" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {jobs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No active jobs</Text>
          </View>
        ) : (
          jobs.map((job, index) => (
            <TouchableOpacity
              key={job.id || index}
              style={styles.jobCard}
              onPress={() => navigation.navigate('WorkshopAdminLeadDetail', { leadId: job.id })}
            >
              <View style={styles.jobHeader}>
                <Text style={styles.jobNumber}>{job.lead_number}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(job.status) }
                  ]}
                >
                  <Text style={styles.statusText}>{job.status}</Text>
                </View>
              </View>
              
              <Text style={styles.customerName}>{job.customer_name}</Text>
              {job.mechanic && (
                <Text style={styles.mechanic}>Mechanic: {job.mechanic.full_name}</Text>
              )}
              <Text style={styles.jobDate}>
                {new Date(job.created_at).toLocaleDateString()}
              </Text>
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
  jobCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  jobNumber: {
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
  mechanic: {
    fontSize: SIZES.sm,
    color: COLORS.info,
    marginBottom: SPACING.xs,
  },
  jobDate: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
});
