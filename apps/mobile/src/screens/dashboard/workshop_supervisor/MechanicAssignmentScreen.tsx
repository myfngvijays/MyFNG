import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useRoute } from '@react-navigation/native';

interface Job {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  service_types: string[];
  priority: string;
  status: string;
  assigned_mechanic_name?: string;
  estimated_hours?: number;
}

interface Mechanic {
  id: string;
  full_name: string;
  is_active: boolean;
  active_jobs_count: number;
  avg_completion_time?: number;
  quality_score?: number;
  total_jobs_completed?: number;
}

export default function MechanicAssignmentScreen({ navigation }: any) {
  const route = useRoute<any>();
  const preselectLeadId = route.params?.leadId as string | undefined;
  const didPreselect = useRef(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showMechanicModal, setShowMechanicModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    fetchData();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('mechanic-assignment-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'service_leads'
      }, () => {
        console.log('Mechanic Assignment: Real-time update received');
        fetchData();
      })
      .subscribe((status) => {
        console.log('Mechanic assignment subscription status:', status);
      });
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      const workshopId = userProfile?.workshop_id;
      if (!workshopId) return;

      // Fetch unassigned and accepted jobs
      const { data: leads } = await supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', workshopId)
        .in('status', ['ACCEPTED', 'IN_PROGRESS'])
        .order('created_at', { ascending: false });

      const formattedJobs = leads?.map((lead: any) => ({
        id: lead.id,
        lead_id: lead.id,
        lead_number: lead.lead_number,
        customer_name: lead.customer_name,
        vehicle_number: lead.vehicle_number,
        vehicle_make: lead.vehicle_make,
        vehicle_model: lead.vehicle_model,
        service_types: lead.service_types || [],
        priority: lead.priority || 'NORMAL',
        status: lead.status,
        estimated_hours: lead.estimated_hours,
      })) || [];

      setJobs(formattedJobs);

      // Fetch mechanics with their workload
      const { data: mechanicsData } = await supabase
        .from('users_login')
        .select(`
          *,
          role:role_id (role_code)
        `)
        .eq('workshop_id', workshopId)
        .eq('is_active', true);

      const filteredMechanics = mechanicsData?.filter(
        (u) => u.role?.role_code === 'WORKSHOP_MECHANIC'
      ) || [];

      // Get workload for each mechanic
      const mechanicsWithWorkload = await Promise.all(
        filteredMechanics.map(async (mech) => {
          const { count } = await supabase
            .from('mechanic_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('mechanic_id', mech.id)
            .in('mechanic_status', ['ASSIGNED', 'IN_PROGRESS']);

          // Get performance metrics
          const { data: metrics } = await supabase
            .from('mechanic_performance_metrics')
            .select('*')
            .eq('mechanic_id', mech.id)
            .single();

          return {
            id: mech.id,
            full_name: mech.full_name,
            is_active: mech.is_active,
            active_jobs_count: count || 0,
            avg_completion_time: metrics?.avg_completion_hours,
            quality_score: metrics?.quality_score,
            total_jobs_completed: metrics?.total_jobs_completed,
          };
        })
      );

      // Sort by workload (least busy first)
      mechanicsWithWorkload.sort((a, b) => a.active_jobs_count - b.active_jobs_count);
      setMechanics(mechanicsWithWorkload);

      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function assignMechanic(mechanicId: string, mechanicName: string) {
    if (!selectedJob) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      // Check if already assigned
      const { data: existing } = await supabase
        .from('mechanic_jobs')
        .select('id')
        .eq('lead_id', selectedJob.lead_id)
        .single();

      if (existing) {
        // Update existing assignment
        await supabase
          .from('mechanic_jobs')
          .update({
            mechanic_id: mechanicId,
            assigned_by: userProfile?.id,
            mechanic_status: 'ASSIGNED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // Create new assignment
        await supabase
          .from('mechanic_jobs')
          .insert({
            lead_id: selectedJob.lead_id,
            mechanic_id: mechanicId,
            assigned_by: userProfile?.id,
            mechanic_status: 'ASSIGNED',
            job_priority: selectedJob.priority,
          });
      }

      // Update lead status
      await supabase
        .from('service_leads')
        .update({
          assigned_to_id: mechanicId,
          status: 'IN_PROGRESS',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedJob.lead_id);

      // Log supervisor action
      await supabase
        .from('supervisor_actions')
        .insert({
          supervisor_id: userProfile?.id,
          lead_id: selectedJob.lead_id,
          action_type: 'MECHANIC_ASSIGNED',
          action_description: `Assigned to mechanic: ${mechanicName}`,
        });

      Alert.alert(
        'Success',
        `Job assigned to ${mechanicName} successfully!`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowMechanicModal(false);
              setSelectedJob(null);
              fetchData();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error assigning mechanic:', error);
      Alert.alert('Error', 'Failed to assign mechanic. Please try again.');
    }
  }

  function openMechanicModal(job: Job) {
    setSelectedJob(job);
    setShowMechanicModal(true);
  }

  useEffect(() => {
    if (!preselectLeadId || didPreselect.current || jobs.length === 0) return;
    const match = jobs.find((job) => job.lead_id === preselectLeadId || job.id === preselectLeadId);
    if (!match) return;
    didPreselect.current = true;
    openMechanicModal(match);
  }, [jobs, preselectLeadId]);

  function onRefresh() {
    setRefreshing(true);
    fetchData();
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

  function getWorkloadColor(count: number) {
    if (count === 0) return '#10b981';
    if (count <= 2) return '#f59e0b';
    return '#ef4444';
  }

  function renderJob({ item }: { item: Job }) {
    const hasAssignment = item.assigned_mechanic_name;

    return (
      <View style={styles.jobCard}>
        <View style={styles.jobHeader}>
          <View style={styles.jobInfo}>
            <Text style={styles.leadNumber}>{item.lead_number}</Text>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            {item.priority !== 'NORMAL' && (
              <View
                style={[
                  styles.priorityBadge,
                  { backgroundColor: getPriorityColor(item.priority) },
                ]}
              >
                <Text style={styles.priorityText}>{item.priority}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.jobDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vehicle:</Text>
            <Text style={styles.detailValue}>
              {item.vehicle_number} - {item.vehicle_make} {item.vehicle_model}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Service:</Text>
            <Text style={styles.detailValue}>
              {item.service_types?.join(', ')}
            </Text>
          </View>
          {item.estimated_hours && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Est. Time:</Text>
              <Text style={styles.detailValue}>
                {item.estimated_hours} hours
              </Text>
            </View>
          )}
          {hasAssignment && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Mechanic:</Text>
              <Text style={[styles.detailValue, { color: '#8b5cf6' }]}>
                {item.assigned_mechanic_name}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.assignButton,
            !!hasAssignment && styles.reassignButton,
          ]}
          onPress={() => openMechanicModal(item)}
        >
          <Text style={styles.assignButtonText}>
            {hasAssignment ? '🔄 Reassign Mechanic' : '👨‍🔧 Assign Mechanic'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderMechanic({ item }: { item: Mechanic }) {
    const workloadColor = getWorkloadColor(item.active_jobs_count);

    return (
      <TouchableOpacity
        style={styles.mechanicCard}
        onPress={() => {
          Alert.alert(
            'Confirm Assignment',
            `Assign this job to ${item.full_name}?\n\nCurrent workload: ${item.active_jobs_count} active jobs`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Assign',
                onPress: () => assignMechanic(item.id, item.full_name),
              },
            ]
          );
        }}
      >
        <View style={styles.mechanicHeader}>
          <View style={styles.mechanicAvatar}>
            <Text style={styles.avatarText}>
              {item.full_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.mechanicInfo}>
            <Text style={styles.mechanicName}>{item.full_name}</Text>
            <View style={styles.mechanicStats}>
              <View
                style={[
                  styles.workloadBadge,
                  { backgroundColor: workloadColor },
                ]}
              >
                <Text style={styles.workloadText}>
                  {item.active_jobs_count} active
                </Text>
              </View>
              {item.quality_score && (
                <Text style={styles.qualityScore}>
                  ⭐ {Math.round(item.quality_score)}%
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.mechanicMetrics}>
          {item.total_jobs_completed !== undefined && (
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                {item.total_jobs_completed}
              </Text>
              <Text style={styles.metricLabel}>Jobs Done</Text>
            </View>
          )}
          {item.avg_completion_time && (
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                {item.avg_completion_time.toFixed(1)}h
              </Text>
              <Text style={styles.metricLabel}>Avg Time</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  const unassignedCount = jobs.filter((j) => !j.assigned_mechanic_name).length;
  const availableMechanicsCount = mechanics.filter((m) => m.active_jobs_count < 3).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Mechanic Assignment</Text>
        <Text style={styles.subtitle}>
          {unassignedCount} jobs need assignment
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{jobs.length}</Text>
          <Text style={styles.statLabel}>Total Jobs</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>
            {unassignedCount}
          </Text>
          <Text style={styles.statLabel}>Unassigned</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#8b5cf6' }]}>
            {mechanics.length}
          </Text>
          <Text style={styles.statLabel}>Mechanics</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#10b981' }]}>
            {availableMechanicsCount}
          </Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
      </View>

      {/* Quick Mechanic Overview */}
      <View style={styles.mechanicsOverview}>
        <Text style={styles.overviewTitle}>Mechanics Workload</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.mechanicsScroll}
        >
          {mechanics.map((mech) => (
            <View key={mech.id} style={styles.quickMechanicCard}>
              <Text style={styles.quickMechanicName}>
                {mech.full_name.split(' ')[0]}
              </Text>
              <Text
                style={[
                  styles.quickMechanicJobs,
                  { color: getWorkloadColor(mech.active_jobs_count) },
                ]}
              >
                {mech.active_jobs_count} jobs
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Jobs List */}
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No jobs available</Text>
          </View>
        }
      />

      {/* Mechanic Selection Modal */}
      <Modal
        visible={showMechanicModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMechanicModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Mechanic</Text>

            {selectedJob && (
              <View style={styles.selectedJobInfo}>
                <Text style={styles.selectedJobNumber}>
                  {selectedJob.lead_number}
                </Text>
                <Text style={styles.selectedJobCustomer}>
                  {selectedJob.customer_name} - {selectedJob.vehicle_number}
                </Text>
                {selectedJob.estimated_hours && (
                  <Text style={styles.selectedJobTime}>
                    Estimated: {selectedJob.estimated_hours} hours
                  </Text>
                )}
              </View>
            )}

            <ScrollView style={styles.mechanicsList}>
              {mechanics.length > 0 ? (
                <FlatList
                  data={mechanics}
                  keyExtractor={(item) => item.id}
                  renderItem={renderMechanic}
                  scrollEnabled={false}
                />
              ) : (
                <Text style={styles.noMechanicsText}>
                  No mechanics available
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowMechanicModal(false);
                setSelectedJob(null);
              }}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  mechanicsOverview: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  overviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  mechanicsScroll: {
    flexDirection: 'row',
  },
  quickMechanicCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  quickMechanicName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  quickMechanicJobs: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  jobHeader: {
    marginBottom: 12,
  },
  jobInfo: {
    gap: 4,
  },
  leadNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  customerName: {
    fontSize: 16,
    color: '#374151',
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  jobDetails: {
    marginBottom: 12,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
  },
  detailLabel: {
    fontSize: 13,
    color: '#6b7280',
    width: 80,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
  },
  assignButton: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  reassignButton: {
    backgroundColor: '#f59e0b',
  },
  assignButtonText: {
    color: '#fff',
    fontSize: 14,
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
    color: '#6b7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  selectedJobInfo: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  selectedJobNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  selectedJobCustomer: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  selectedJobTime: {
    fontSize: 13,
    color: '#8b5cf6',
    marginTop: 4,
  },
  mechanicsList: {
    maxHeight: 400,
  },
  mechanicCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  mechanicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mechanicAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  mechanicInfo: {
    flex: 1,
  },
  mechanicName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  mechanicStats: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  workloadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  workloadText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  qualityScore: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f59e0b',
  },
  mechanicMetrics: {
    flexDirection: 'row',
    gap: 16,
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8b5cf6',
  },
  metricLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  noMechanicsText: {
    textAlign: 'center',
    color: '#6b7280',
    paddingVertical: 32,
  },
  modalCloseButton: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: '#6b7280',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

