import React, { useState, useEffect } from 'react';
import {
import { formatDateTime } from "@/lib/dateFormat";
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

interface Lead {
  id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  service_types: string[];
  priority: string;
  status: string;
  created_at: string;
}

interface Staff {
  id: string;
  full_name: string;
  role: {
    role_name: string;
    role_code: string;
  };
  is_active: boolean;
}

export default function JobAssignmentScreen({ navigation }: any) {
  const [unassignedLeads, setUnassignedLeads] = useState<Lead[]>([]);
  const [mechanics, setMechanics] = useState<Staff[]>([]);
  const [supervisors, setSupervisors] = useState<Staff[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignType, setAssignType] = useState<'MECHANIC' | 'SUPERVISOR'>('MECHANIC');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

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

      // Fetch unassigned leads
      const { data: leads } = await supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', workshopId)
        .eq('status', 'ACCEPTED')
        .is('assigned_to_id', null)
        .order('created_at', { ascending: false });

      setUnassignedLeads(leads || []);

      // Fetch mechanics
      const { data: mechanicsData } = await supabase
        .from('users_login')
        .select(`
          *,
          role:role_id (role_name, role_code)
        `)
        .eq('workshop_id', workshopId)
        .eq('is_active', true);

      const filteredMechanics = mechanicsData?.filter(
        (u) => u.role?.role_code === 'WORKSHOP_MECHANIC'
      ) || [];
      
      const filteredSupervisors = mechanicsData?.filter(
        (u) => u.role?.role_code === 'WORKSHOP_SUPERVISOR'
      ) || [];

      setMechanics(filteredMechanics);
      setSupervisors(filteredSupervisors);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function assignJob(staffId: string, staffName: string) {
    if (!selectedLead) return;

    try {
      const { error } = await supabase
        .from('service_leads')
        .update({
          assigned_to_id: staffId,
          status: 'IN_PROGRESS',
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedLead.id);

      if (error) throw error;

      // Create mechanic_jobs entry if assigning to mechanic
      if (assignType === 'MECHANIC') {
        await supabase
          .from('mechanic_jobs')
          .insert({
            lead_id: selectedLead.id,
            mechanic_id: staffId,
            assigned_by: (await supabase.auth.getUser()).data.user?.id,
            mechanic_status: 'ASSIGNED',
            job_priority: selectedLead.priority || 'NORMAL',
          });
      }

      Alert.alert(
        'Success',
        `Job assigned to ${staffName} successfully!`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowAssignModal(false);
              setSelectedLead(null);
              fetchData();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error assigning job:', error);
      Alert.alert('Error', 'Failed to assign job. Please try again.');
    }
  }

  function openAssignModal(lead: Lead, type: 'MECHANIC' | 'SUPERVISOR') {
    setSelectedLead(lead);
    setAssignType(type);
    setShowAssignModal(true);
  }

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

  function renderLead({ item }: { item: Lead }) {
    return (
      <View style={styles.leadCard}>
        <View style={styles.leadHeader}>
          <View style={styles.leadInfo}>
            <Text style={styles.leadNumber}>{item.lead_number}</Text>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            {item.priority && item.priority !== 'NORMAL' && (
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

        <View style={styles.leadDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vehicle:</Text>
            <Text style={styles.detailValue}>
              {item.vehicle_number} - {item.vehicle_make} {item.vehicle_model}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Service:</Text>
            <Text style={styles.detailValue}>{item.service_types?.join(', ')}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created:</Text>
            <Text style={styles.detailValue}>
              {formatDateTime(item.created_at)}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.mechanicButton]}
            onPress={() => openAssignModal(item, 'MECHANIC')}
          >
            <Text style={styles.actionButtonText}>🔧 Assign to Mechanic</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.supervisorButton]}
            onPress={() => openAssignModal(item, 'SUPERVISOR')}
          >
            <Text style={styles.actionButtonText}>👨‍💼 Assign to Supervisor</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.viewDetailsButton}
          onPress={() => navigation.navigate('LeadDetail', { leadId: item.id })}
        >
          <Text style={styles.viewDetailsText}>View Full Details →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderStaffMember({ item }: { item: Staff }) {
    return (
      <TouchableOpacity
        style={styles.staffCard}
        onPress={() => {
          Alert.alert(
            'Confirm Assignment',
            `Assign this job to ${item.full_name}?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Assign',
                onPress: () => assignJob(item.id, item.full_name),
              },
            ]
          );
        }}
      >
        <View style={styles.staffAvatar}>
          <Text style={styles.staffAvatarText}>
            {item.full_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.staffInfo}>
          <Text style={styles.staffName}>{item.full_name}</Text>
          <Text style={styles.staffRole}>{item.role?.role_name}</Text>
        </View>
        <View style={styles.statusIndicator} />
      </TouchableOpacity>
    );
  }

  const staffList = assignType === 'MECHANIC' ? mechanics : supervisors;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Job Assignment</Text>
        <Text style={styles.subtitle}>{unassignedLeads.length} unassigned jobs</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{unassignedLeads.length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{mechanics.length}</Text>
          <Text style={styles.statLabel}>Mechanics</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{supervisors.length}</Text>
          <Text style={styles.statLabel}>Supervisors</Text>
        </View>
      </View>

      {/* Leads List */}
      <FlatList
        data={unassignedLeads}
        keyExtractor={(item) => item.id}
        renderItem={renderLead}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>✅ All jobs assigned!</Text>
          </View>
        }
      />

      {/* Assignment Modal */}
      <Modal
        visible={showAssignModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Assign to {assignType === 'MECHANIC' ? 'Mechanic' : 'Supervisor'}
            </Text>

            {selectedLead && (
              <View style={styles.selectedLeadInfo}>
                <Text style={styles.selectedLeadNumber}>
                  {selectedLead.lead_number}
                </Text>
                <Text style={styles.selectedLeadCustomer}>
                  {selectedLead.customer_name}
                </Text>
              </View>
            )}

            <ScrollView style={styles.staffList}>
              {staffList.length > 0 ? (
                <FlatList
                  data={staffList}
                  keyExtractor={(item) => item.id}
                  renderItem={renderStaffMember}
                  scrollEnabled={false}
                />
              ) : (
                <Text style={styles.noStaffText}>
                  No {assignType === 'MECHANIC' ? 'mechanics' : 'supervisors'} available
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowAssignModal(false);
                setSelectedLead(null);
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
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
  },
  leadCard: {
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
  leadHeader: {
    marginBottom: 12,
  },
  leadInfo: {
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
  leadDetails: {
    marginBottom: 16,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
  },
  detailLabel: {
    fontSize: 13,
    color: '#6b7280',
    width: 70,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  mechanicButton: {
    backgroundColor: '#2563eb',
  },
  supervisorButton: {
    backgroundColor: '#8b5cf6',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  viewDetailsButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  viewDetailsText: {
    fontSize: 13,
    color: '#2563eb',
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
  selectedLeadInfo: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  selectedLeadNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  selectedLeadCustomer: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  staffList: {
    maxHeight: 400,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 12,
  },
  staffAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  staffAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  staffRole: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
  },
  noStaffText: {
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

