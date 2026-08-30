import React, { useState, useEffect } from 'react';
import { formatDateDMY } from "@/lib/dateFormat";
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
import { supabase } from '../../../lib/supabase';
import { COLORS } from '../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { AC } from '../../../components/workshop/advisorCrmUi';

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
  }, [sortBy, showOnlyUnassigned]);

  useEffect(() => {
    const channel = supabase
      .channel(`day-planning-updates-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_leads' },
        () => fetchData(),
      )
      .subscribe();

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
      NORMAL: '#004AAD',
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
    const serviceLabel = String(item.service_type || '').trim();
    const showService = serviceLabel && !/^[0-9a-f-]{20,}$/i.test(serviceLabel);

    return (
      <TouchableOpacity
        style={[AC.navy, isSelected && { borderWidth: 2, borderColor: '#FDE68A' }]}
        onPress={() => toggleJobSelection(item.id)}
        activeOpacity={0.9}
      >
        <View style={AC.navyRow}>
          <Text style={AC.navyName} numberOfLines={1}>
            {isSelected ? '✓ ' : ''}
            {item.customer_name || 'Customer'}
          </Text>
          <View style={AC.navyBadge}>
            <Text style={AC.navyBadgeTxt}>{item.priority}</Text>
          </View>
        </View>
        <Text style={AC.navyMeta}>{item.vehicle_number}</Text>
        {showService ? <Text style={AC.navyMeta}>{serviceLabel}</Text> : null}
        <Text style={AC.navyMeta}>
          {item.assigned_mechanic?.full_name || 'Unassigned'}
          {item.estimated_duration ? ` · ${item.estimated_duration} min` : ''}
        </Text>
      </TouchableOpacity>
    );
  }

  const urgentJobs = jobs.filter(j => j.priority === 'URGENT' || (j.sla_remaining_minutes && j.sla_remaining_minutes < 60));
  const vipJobs = jobs.filter(j => j.is_vip_customer);
  const repeatJobs = jobs.filter(j => j.is_repeat_complaint);

  return (
    <View style={AC.page}>
      <Text style={AC.sub}>
        {formatDateDMY(new Date().toISOString())} · {jobs.length} jobs to manage
      </Text>

      <View style={AC.kpiRow}>
        <View style={AC.kpi}>
          <Text style={[AC.kpiVal, { color: '#EF4444' }]}>{urgentJobs.length}</Text>
          <Text style={AC.kpiLab}>Urgent</Text>
        </View>
        <View style={AC.kpi}>
          <Text style={[AC.kpiVal, { color: '#D97706' }]}>{vipJobs.length}</Text>
          <Text style={AC.kpiLab}>VIP</Text>
        </View>
        <View style={AC.kpi}>
          <Text style={[AC.kpiVal, { color: '#EA580C' }]}>{repeatJobs.length}</Text>
          <Text style={AC.kpiLab}>Repeat</Text>
        </View>
        <View style={AC.kpi}>
          <Text style={[AC.kpiVal, { color: '#004AAD' }]}>{selectedJobs.size}</Text>
          <Text style={AC.kpiLab}>Selected</Text>
        </View>
      </View>

      <View style={AC.chipWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['priority', 'sla', 'duration'] as const).map((sort) => (
            <TouchableOpacity
              key={sort}
              style={[AC.chip, sortBy === sort && AC.chipOn]}
              onPress={() => setSortBy(sort)}
            >
              <Text style={[AC.chipTxt, sortBy === sort && AC.chipTxtOn]}>
                {sort === 'priority' ? 'Priority' : sort === 'sla' ? 'SLA' : 'Duration'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, gap: 8 }}
        onPress={() => setShowOnlyUnassigned(!showOnlyUnassigned)}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: '#004AAD',
            backgroundColor: showOnlyUnassigned ? '#004AAD' : '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {showOnlyUnassigned ? <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text> : null}
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#023D95' }}>Show only unassigned</Text>
      </TouchableOpacity>

      {selectedJobs.size > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
          <TouchableOpacity style={[AC.navyBtnGhost, { flex: 1, backgroundColor: '#fff' }]} onPress={() => setSelectedJobs(new Set())}>
            <Text style={[AC.navyBtnTxt, { color: '#023D95' }]}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={AC.navyBtn} onPress={() => setShowMechanicModal(true)}>
            <Text style={AC.navyBtnTxt}>Assign mechanic</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#004AAD']} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={AC.empty}>
            <Text style={AC.emptyTxt}>All clear</Text>
            <Text style={AC.emptySub}>No jobs requiring planning</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#004AAD',
    borderColor: '#004AAD',
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
    backgroundColor: '#004AAD',
    borderColor: '#004AAD',
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
    backgroundColor: '#004AAD',
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
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  jobCardSelected: {
    borderColor: '#004AAD',
    backgroundColor: '#EAF2FF',
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
    backgroundColor: '#004AAD',
    borderColor: '#004AAD',
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
    color: '#023D95',
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
    color: '#023D95',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 64,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#023D95',
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
    color: '#023D95',
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
    backgroundColor: '#004AAD',
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
    color: '#023D95',
  },
  mechanicJobs: {
    fontSize: 12,
    color: '#6b7280',
  },
  assignArrow: {
    fontSize: 24,
    color: '#004AAD',
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
