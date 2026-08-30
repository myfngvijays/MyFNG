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
import { supabase } from '../../../lib/supabase';
import { useRoute } from '@react-navigation/native';
import { AC } from '../../../components/workshop/advisorCrmUi';
import GlossyButton from '../../../components/workshop/GlossyButton';

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
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  active_jobs_count: number;
  avg_completion_time?: number;
  quality_score?: number;
  total_jobs_completed?: number;
}

function mechanicDisplayName(m: { first_name?: string; last_name?: string; full_name?: string }) {
  const joined = [m.first_name, m.last_name]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' ');
  return joined || String(m.full_name || '').trim() || 'Mechanic';
}

function workloadAccent(count: number) {
  if (count >= 5) return '#DC2626';
  if (count >= 3) return '#D97706';
  return '#059669';
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
        .is('deleted_at', null)
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
            full_name: mechanicDisplayName(mech),
            first_name: mech.first_name,
            last_name: mech.last_name,
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
        return '#004AAD';
    }
  }

  function getWorkloadColor(count: number) {
    if (count === 0) return '#10b981';
    if (count <= 2) return '#f59e0b';
    return '#ef4444';
  }

  function renderJob({ item }: { item: Job }) {
    const hasAssignment = item.assigned_mechanic_name;
    const priorityColor = getPriorityColor(item.priority);

    return (
      <View style={AC.listCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <Text style={AC.name} numberOfLines={1}>
            {item.customer_name || 'Customer'}
          </Text>
          {item.priority && item.priority !== 'NORMAL' ? (
            <View style={[AC.statusPill, { backgroundColor: priorityColor }]}>
              <Text style={AC.statusPillTxt}>{item.priority}</Text>
            </View>
          ) : null}
        </View>
        <Text style={AC.meta} numberOfLines={2}>
          {[item.vehicle_number, item.vehicle_make, item.vehicle_model].filter(Boolean).join(' · ')}
        </Text>
        <Text style={[AC.meta, { color: hasAssignment ? '#059669' : '#EA580C', fontWeight: '700' }]}>
          {hasAssignment ? `Mechanic: ${item.assigned_mechanic_name}` : 'Unassigned'}
        </Text>
        <View style={AC.btnRow}>
          <GlossyButton
            label={hasAssignment ? 'Reassign' : 'Assign mechanic'}
            color={hasAssignment ? '#F59E0B' : '#004AAD'}
            onPress={() => openMechanicModal(item)}
          />
        </View>
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
    <View style={AC.page}>
      <Text style={AC.sub}>{unassignedCount} jobs need assignment</Text>

      <View style={AC.kpiRow}>
        <View style={AC.kpi}>
          <Text style={[AC.kpiVal, { color: '#004AAD' }]}>{jobs.length}</Text>
          <Text style={AC.kpiLab}>Total</Text>
        </View>
        <View style={AC.kpi}>
          <Text style={[AC.kpiVal, { color: '#F59E0B' }]}>{unassignedCount}</Text>
          <Text style={AC.kpiLab}>Unassigned</Text>
        </View>
        <View style={AC.kpi}>
          <Text style={[AC.kpiVal, { color: '#023D95' }]}>{mechanics.length}</Text>
          <Text style={AC.kpiLab}>Mechanics</Text>
        </View>
        <View style={AC.kpi}>
          <Text style={[AC.kpiVal, { color: '#10B981' }]}>{availableMechanicsCount}</Text>
          <Text style={AC.kpiLab}>Available</Text>
        </View>
      </View>

      {mechanics.length > 0 ? (
        <>
          <Text style={AC.section}>Mechanics workload</Text>
          <View style={styles.workGrid}>
            {mechanics.map((mech) => {
              const accent = workloadAccent(mech.active_jobs_count);
              const count = mech.active_jobs_count;
              return (
                <View key={mech.id} style={[styles.workTile, { borderLeftColor: accent }]}>
                  <Text style={styles.workName} numberOfLines={2}>
                    {mechanicDisplayName(mech)}
                  </Text>
                  <Text style={[styles.workJobs, { color: accent }]}>
                    {count === 0 ? 'Free' : `${count} active job${count === 1 ? '' : 's'}`}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#004AAD']} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={AC.empty}>
            <Text style={AC.emptyTxt}>No jobs available</Text>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.leadAvatar}>
                    <Text style={styles.leadAvatarTxt}>
                      {(selectedJob.customer_name || 'C').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedJobNumber}>
                      {selectedJob.customer_name || 'Customer'}
                    </Text>
                    <Text style={styles.selectedJobCustomer}>
                      {[selectedJob.vehicle_number, selectedJob.vehicle_make, selectedJob.vehicle_model]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {selectedJob.estimated_hours ? (
                      <Text style={styles.selectedJobTime}>
                        Estimated: {selectedJob.estimated_hours} hours
                      </Text>
                    ) : null}
                  </View>
                </View>
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

            <View style={{ marginTop: 12 }}>
              <GlossyButton
                label="Cancel"
                color="#64748B"
                onPress={() => {
                  setShowMechanicModal(false);
                  setSelectedJob(null);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  workGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  workTile: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderLeftWidth: 4,
    minHeight: 72,
  },
  workName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#023D95',
  },
  workJobs: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
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
    color: '#023D95',
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
    color: '#004AAD',
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
    color: '#023D95',
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
    color: '#023D95',
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
    borderRadius: 14,
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
    color: '#023D95',
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
    color: '#023D95',
  },
  assignButton: {
    backgroundColor: '#004AAD',
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
    color: '#023D95',
    marginBottom: 16,
  },
  selectedJobInfo: {
    backgroundColor: '#EAF2FF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,74,173,0.15)',
  },
  leadAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#004AAD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadAvatarTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },
  selectedJobNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#023D95',
  },
  selectedJobCustomer: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  selectedJobTime: {
    fontSize: 13,
    color: '#004AAD',
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
    backgroundColor: '#004AAD',
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
    color: '#023D95',
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
    color: '#004AAD',
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

