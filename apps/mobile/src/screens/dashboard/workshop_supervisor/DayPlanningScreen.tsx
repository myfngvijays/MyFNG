import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { COLORS } from '../../../constants/theme';
import { useNavigation } from '@react-navigation/native';

interface JobWithPriority {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  service_type: string;
  status: string;
  assigned_mechanic: any;
  sla_remaining_minutes: number | null;
  estimated_duration: number;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  is_vip_customer: boolean;
  is_repeat_complaint: boolean;
  created_at: string;
  supervisor_notes?: string;
}

interface Mechanic {
  id: string;
  full_name: string;
  profile_image?: string;
  activeJobs: number;
}

export default function DayPlanningScreen() {
  const navigation = useNavigation();
  const [jobs, setJobs] = useState<JobWithPriority[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'priority' | 'sla' | 'duration'>('priority');
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false);
  const [showMechanicModal, setShowMechanicModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
    setupRealtimeSubscription();
  }, [sortBy, showOnlyUnassigned]);

  function setupRealtimeSubscription() {
    const channel = supabase
      .channel('day-planning-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_leads' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async function fetchData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      if (!userProfile?.workshop_id) return;

      // Fetch jobs
      let query = supabase
        .from('service_leads')
        .select(`
          id,
          lead_number,
          customer_name,
          vehicle_number,
          service_type,
          status,
          assigned_mechanic_id,
          priority,
          is_vip_customer,
          is_repeat_complaint,
          created_at,
          sla_expires_at,
          estimated_duration,
          supervisor_notes,
          mechanic:assigned_mechanic_id(id, full_name, profile_image)
        `)
        .eq('workshop_id', userProfile.workshop_id)
        .in('status', ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'HOLD']);

      if (showOnlyUnassigned) {
        query = query.is('assigned_mechanic_id', null);
      }

      const { data: jobsData } = await query;

      // Calculate SLA remaining
      const jobsWithSLA = (jobsData || []).map((job: any) => {
        let slaRemaining = null;
        if (job.sla_expires_at) {
          const now = new Date().getTime();
          const deadline = new Date(job.sla_expires_at).getTime();
          slaRemaining = Math.floor((deadline - now) / (1000 * 60));
        }

        return {
          ...job,
          lead_id: job.id,
          sla_remaining_minutes: slaRemaining,
          assigned_mechanic: job.mechanic,
        };
      });

      // Sort jobs
      const sortedJobs = jobsWithSLA.sort((a: any, b: any) => {
        if (sortBy === 'sla') {
          return (a.sla_remaining_minutes || 999999) - (b.sla_remaining_minutes || 999999);
        } else if (sortBy === 'priority') {
          const priorityOrder: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
          return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
        } else if (sortBy === 'duration') {
          return (a.estimated_duration || 0) - (b.estimated_duration || 0);
        }
        return 0;
      });

      setJobs(sortedJobs);

      // Fetch mechanics
      const { data: mechanicsData } = await supabase
        .from('users_login')
        .select(`
          id,
          full_name,
          profile_image,
          roles!inner(role_code)
        `)
        .eq('workshop_id', userProfile.workshop_id)
        .eq('roles.role_code', 'WORKSHOP_MECHANIC')
        .eq('is_active', true);

      // Get active jobs count for each mechanic
      const mechanicsWithJobs = await Promise.all(
        (mechanicsData || []).map(async (mechanic: any) => {
          const { count } = await supabase
            .from('service_leads')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_mechanic_id', mechanic.id)
            .in('status', ['ASSIGNED', 'IN_PROGRESS']);

          return {
            id: mechanic.id,
            full_name: mechanic.full_name,
            profile_image: mechanic.profile_image,
            activeJobs: count || 0,
          };
        })
      );

      setMechanics(mechanicsWithJobs);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function toggleJobSelection(jobId: string) {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  }

  async function assignJobsToMechanic(mechanicId: string, mechanicName: string) {
    if (selectedJobs.size === 0) return;

    try {
      const jobIds = Array.from(selectedJobs);

      const { error } = await supabase
        .from('service_leads')
        .update({
          assigned_mechanic_id: mechanicId,
          status: 'ASSIGNED',
          updated_at: new Date().toISOString(),
        })
        .in('id', jobIds);

      if (error) throw error;

      Alert.alert(
        'Success',
        `Assigned ${jobIds.length} job(s) to ${mechanicName}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowMechanicModal(false);
              setSelectedJobs(new Set());
              fetchData();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error assigning jobs:', error);
      Alert.alert('Error', 'Failed to assign jobs');
    }
  }

  async function updateJobPriority(jobId: string, newPriority: string) {
    try {
      const { error } = await supabase
        .from('service_leads')
        .update({ priority: newPriority })
        .eq('id', jobId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error updating priority:', error);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    fetchData();
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      URGENT: '#ef4444',
      HIGH: '#f97316',
      NORMAL: '#3b82f6',
      LOW: '#6b7280',
    };
    return colors[priority] || colors.NORMAL;
  };

  const getSLAColor = (minutes: number | null) => {
    if (minutes === null) return '#6b7280';
    if (minutes < 0) return '#ef4444';
    if (minutes < 60) return '#f97316';
    if (minutes < 120) return '#eab308';
    return '#10b981';
  };

  function renderJob({ item }: { item: JobWithPriority }) {
    const isSelected = selectedJobs.has(item.id);

    return (
      <TouchableOpacity
        style={[styles.jobCard, isSelected && styles.jobCardSelected]}
        onPress={() => toggleJobSelection(item.id)}
      >
        <View style={styles.jobCardHeader}>
          <View style={styles.checkboxContainer}>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </View>
          <View style={styles.jobMainInfo}>
            <View style={styles.jobTitleRow}>
              <Text style={styles.leadNumber}>#{item.lead_number}</Text>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
                <Text style={styles.priorityText}>{item.priority}</Text>
              </View>
            </View>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            <Text style={styles.vehicleNumber}>{item.vehicle_number}</Text>
            
            {/* Tags */}
            <View style={styles.tagsRow}>
              {item.is_vip_customer && (
                <View style={styles.vipTag}>
                  <Text style={styles.vipText}>VIP</Text>
                </View>
              )}
              {item.is_repeat_complaint && (
                <View style={styles.repeatTag}>
                  <Text style={styles.repeatText}>REPEAT</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.jobDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Service:</Text>
            <Text style={styles.detailValue}>{item.service_type}</Text>
          </View>
          
          {item.estimated_duration && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Duration:</Text>
              <Text style={styles.detailValue}>{item.estimated_duration} min</Text>
            </View>
          )}

          {item.sla_remaining_minutes !== null && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>SLA:</Text>
              <Text style={[styles.detailValue, { color: getSLAColor(item.sla_remaining_minutes) }]}>
                {item.sla_remaining_minutes < 0
                  ? `OVERDUE ${Math.abs(item.sla_remaining_minutes)} min`
                  : `${Math.floor(item.sla_remaining_minutes / 60)}h ${item.sla_remaining_minutes % 60}m`}
              </Text>
            </View>
          )}

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Mechanic:</Text>
            <Text style={styles.detailValue}>
              {item.assigned_mechanic ? item.assigned_mechanic.full_name : '❌ UNASSIGNED'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const urgentJobs = jobs.filter(j => j.priority === 'URGENT' || (j.sla_remaining_minutes && j.sla_remaining_minutes < 60));
  const vipJobs = jobs.filter(j => j.is_vip_customer);
  const repeatJobs = jobs.filter(j => j.is_repeat_complaint);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📅 Day Planning</Text>
        <Text style={styles.subtitle}>
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        <Text style={styles.jobCount}>{jobs.length} jobs to manage</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#fef2f2' }]}>
          <Text style={[styles.statValue, { color: '#ef4444' }]}>{urgentJobs.length}</Text>
          <Text style={styles.statLabel}>⚠️ Urgent</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fefce8' }]}>
          <Text style={[styles.statValue, { color: '#eab308' }]}>{vipJobs.length}</Text>
          <Text style={styles.statLabel}>⭐ VIP</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fff7ed' }]}>
          <Text style={[styles.statValue, { color: '#f97316' }]}>{repeatJobs.length}</Text>
          <Text style={styles.statLabel}>🔄 Repeat</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#eff6ff' }]}>
          <Text style={[styles.statValue, { color: '#3b82f6' }]}>{selectedJobs.size}</Text>
          <Text style={styles.statLabel}>✓ Selected</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Sort by:</Text>
          <View style={styles.sortButtons}>
            {(['priority', 'sla', 'duration'] as const).map((sort) => (
              <TouchableOpacity
                key={sort}
                style={[styles.sortButton, sortBy === sort && styles.sortButtonActive]}
                onPress={() => setSortBy(sort)}
              >
                <Text style={[styles.sortButtonText, sortBy === sort && styles.sortButtonTextActive]}>
                  {sort === 'priority' ? 'Priority' : sort === 'sla' ? 'SLA' : 'Duration'}
              </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowOnlyUnassigned(!showOnlyUnassigned)}
        >
          <View style={[styles.filterCheckbox, showOnlyUnassigned && styles.filterCheckboxActive]}>
            {showOnlyUnassigned && <Text style={styles.filterCheckmark}>✓</Text>}
          </View>
          <Text style={styles.filterText}>Show only unassigned</Text>
        </TouchableOpacity>

        {selectedJobs.size > 0 && (
          <View style={styles.actionBar}>
            <Text style={styles.actionBarText}>{selectedJobs.size} job(s) selected</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setSelectedJobs(new Set())}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.assignButton}
                onPress={() => setShowMechanicModal(true)}
              >
                <Text style={styles.assignButtonText}>Assign to Mechanic</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Jobs List */}
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>✅ All Clear!</Text>
            <Text style={styles.emptySubtext}>No jobs requiring planning</Text>
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
            <Text style={styles.modalSubtitle}>
              Assigning {selectedJobs.size} job(s)
            </Text>

            <ScrollView style={styles.mechanicList}>
              {mechanics.map((mechanic) => (
                <TouchableOpacity
                  key={mechanic.id}
                  style={[
                    styles.mechanicCard,
                    mechanic.activeJobs === 0
                      ? styles.mechanicCardAvailable
                      : mechanic.activeJobs <= 2
                      ? styles.mechanicCardBusy
                      : styles.mechanicCardFull,
                  ]}
                  onPress={() => assignJobsToMechanic(mechanic.id, mechanic.full_name)}
                >
                  <View style={styles.mechanicInfo}>
                    <View style={styles.mechanicAvatar}>
                      <Text style={styles.mechanicAvatarText}>
                        {mechanic.full_name.charAt(0)}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.mechanicName}>{mechanic.full_name}</Text>
                      <Text style={styles.mechanicJobs}>
                        {mechanic.activeJobs} active job{mechanic.activeJobs !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.assignArrow}>→</Text>
                </TouchableOpacity>
              ))}
    </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowMechanicModal(false)}
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
  jobCount: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
  },
  controls: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  controlRow: {
    marginBottom: 12,
  },
  controlLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
  },
  sortButtonActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  sortButtonTextActive: {
    color: '#fff',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterCheckboxActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  filterCheckmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  filterText: {
    fontSize: 13,
    color: '#374151',
  },
  actionBar: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  actionBarText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  assignButton: {
    flex: 2,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
  },
  assignButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  listContainer: {
    padding: 12,
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  jobCardSelected: {
    borderColor: '#8b5cf6',
    backgroundColor: '#faf5ff',
  },
  jobCardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  jobMainInfo: {
    flex: 1,
  },
  jobTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  leadNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  vehicleNumber: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  vipTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#fef3c7',
    borderRadius: 10,
  },
  vipText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#92400e',
  },
  repeatTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#fed7aa',
    borderRadius: 10,
  },
  repeatText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9a3412',
  },
  jobDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    gap: 6,
  },
  detailItem: {
    flexDirection: 'row',
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
    width: 80,
  },
  detailValue: {
    flex: 1,
    fontSize: 12,
    color: '#111827',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 64,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
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
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  mechanicList: {
    marginBottom: 20,
  },
  mechanicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
  },
  mechanicCardAvailable: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  mechanicCardBusy: {
    backgroundColor: '#fefce8',
    borderColor: '#fde047',
  },
  mechanicCardFull: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  mechanicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mechanicAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mechanicAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  mechanicName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  mechanicJobs: {
    fontSize: 12,
    color: '#6b7280',
  },
  assignArrow: {
    fontSize: 24,
    color: '#8b5cf6',
  },
  modalCloseButton: {
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
