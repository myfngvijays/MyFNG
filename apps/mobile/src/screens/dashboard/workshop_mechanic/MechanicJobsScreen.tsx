import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { useNotifications } from '../../../context/NotificationContext';

interface Job {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  service_types: string[];
  mechanic_status: string;
  job_priority: string;
  sla_remaining_minutes: number;
  before_images_count: number;
  progress_images_count: number;
  after_images_count: number;
  has_pending_extra_work: boolean;
  has_parts_assigned: boolean;
  checklist_completed: boolean;
  assigned_at: string;
}

export default function MechanicJobsScreen({ navigation }: any) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { jobRefreshTick } = useNotifications();

  const filters = ['ALL', 'ASSIGNED', 'IN_PROGRESS', 'HOLD', 'COMPLETED'];

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [navigation]);

  useEffect(() => {
    fetchJobs();

    // Setup realtime subscription for mechanic jobs
    if (user?.id) {
      const channel = supabase
        .channel(`mechanic-jobs-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'mechanic_jobs',
            filter: `mechanic_id=eq.${user.id}`
          },
          () => {
            console.log('Mechanic jobs updated in real-time');
            fetchJobs();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'service_leads'
          },
          (payload) => {
            // If status changed to IN_PROGRESS (sent back), refresh jobs
            if (payload.new && payload.new.status === 'IN_PROGRESS') {
              console.log('Lead status changed to IN_PROGRESS, refreshing jobs');
              fetchJobs();
            }
          }
        )
        .subscribe((status) => {
          console.log('Mechanic jobs subscription status:', status);
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id]);

  // Refresh jobs when a job-impacting notification arrives (push/realtime safety net)
  useEffect(() => {
    if (!user?.id) return;
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobRefreshTick]);

  useEffect(() => {
    filterJobs();
  }, [activeFilter, jobs]);

  async function fetchJobs() {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('mechanic_dashboard')
        .select('*')
        .eq('mechanic_id', user.id)
        .order('assigned_at', { ascending: false });

      if (error) throw error;

      setJobs(data || []);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }

  function filterJobs() {
    if (activeFilter === 'ALL') {
      setFilteredJobs(jobs);
    } else {
      setFilteredJobs(jobs.filter(job => job.mechanic_status === activeFilter));
    }
  }

  function onRefresh() {
    setRefreshing(true);
    fetchJobs();
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'ASSIGNED':
        return '#10b981';
      case 'IN_PROGRESS':
        return '#3b82f6';
      case 'HOLD':
      case 'WAITING_APPROVAL':
        return '#f59e0b';
      case 'COMPLETED':
        return '#8b5cf6';
      default:
        return '#6b7280';
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'URGENT':
      case 'CRITICAL':
        return '#ef4444';
      case 'HIGH':
        return '#f97316';
      default:
        return '#3b82f6';
    }
  }

  function formatSLA(minutes: number) {
    if (minutes < 0) return `Overdue by ${Math.abs(minutes)}m`;
    if (minutes < 60) return `${minutes}m remaining`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  function renderJob({ item }: { item: Job }) {
    return (
      <TouchableOpacity
        style={[
          styles.jobCard,
          { borderLeftColor: getPriorityColor(item.job_priority), borderLeftWidth: 4 }
        ]}
        onPress={() => navigation.navigate('MechanicJobDetail', { jobId: item.lead_id })}
      >
        <View style={styles.jobHeader}>
          <Text style={styles.leadNumber}>{item.lead_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.mechanic_status) }]}>
            <Text style={styles.statusText}>{item.mechanic_status.replace('_', ' ')}</Text>
          </View>
        </View>

        {item.job_priority !== 'NORMAL' && (
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.job_priority) }]}>
            <Text style={styles.priorityText}>{item.job_priority}</Text>
          </View>
        )}

        <View style={styles.jobDetails}>
          <Text style={styles.detailLabel}>Vehicle</Text>
          <Text style={styles.detailValue}>{item.vehicle_number}</Text>
          <Text style={styles.detailSubValue}>
            {item.vehicle_make} {item.vehicle_model}
          </Text>
        </View>

        <View style={styles.jobDetails}>
          <Text style={styles.detailLabel}>Service</Text>
          <Text style={styles.detailValue}>{item.service_types?.join(', ')}</Text>
        </View>

        <View style={styles.slaContainer}>
          <Text style={styles.slaLabel}>SLA:</Text>
          <Text
            style={[
              styles.slaValue,
              { color: item.sla_remaining_minutes < 0 ? '#ef4444' : item.sla_remaining_minutes < 60 ? '#f59e0b' : '#10b981' }
            ]}
          >
            {formatSLA(item.sla_remaining_minutes)}
          </Text>
        </View>

        {/* Progress indicators */}
        <View style={styles.progressContainer}>
          <View style={styles.progressItem}>
            <Text style={styles.progressLabel}>📷 Before: {item.before_images_count}</Text>
          </View>
          <View style={styles.progressItem}>
            <Text style={styles.progressLabel}>📸 Progress: {item.progress_images_count}</Text>
          </View>
          <View style={styles.progressItem}>
            <Text style={styles.progressLabel}>✅ After: {item.after_images_count}</Text>
          </View>
        </View>

        {item.has_pending_extra_work && (
          <View style={styles.warningBadge}>
            <Text style={styles.warningText}>⚠️ Additional Jobs Pending</Text>
          </View>
        )}

        {item.checklist_completed && (
          <View style={styles.successBadge}>
            <Text style={styles.successText}>✓ Checklist Completed</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Jobs</Text>
        <Text style={styles.subtitle}>{filteredJobs.length} jobs</Text>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          data={filters}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterButton,
                activeFilter === item && styles.filterButtonActive
              ]}
              onPress={() => setActiveFilter(item)}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === item && styles.filterTextActive
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Jobs List */}
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No jobs found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leadNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  jobDetails: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  detailSubValue: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  slaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 12,
  },
  slaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginRight: 8,
  },
  slaValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  progressItem: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: '#374151',
  },
  warningBadge: {
    backgroundColor: '#fef3c7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600',
  },
  successBadge: {
    backgroundColor: '#d1fae5',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  successText: {
    fontSize: 12,
    color: '#065f46',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
  },
});

