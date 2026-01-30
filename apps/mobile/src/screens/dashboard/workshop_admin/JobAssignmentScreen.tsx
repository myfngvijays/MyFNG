import React, { useState, useEffect } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { apiFetch } from '../../../lib/api';

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
  pickup_required?: boolean;
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
  const [pickupBoys, setPickupBoys] = useState<Staff[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMechanicId, setSelectedMechanicId] = useState<string>('');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('');
  const [selectedPickupBoyId, setSelectedPickupBoyId] = useState<string>('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

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
      const filteredPickupBoys = mechanicsData?.filter(
        (u) => u.role?.role_code === 'WORKSHOP_PICKUP_BOY'
      ) || [];
      setPickupBoys(filteredPickupBoys);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function submitAssignment() {
    if (!selectedLead) return;
    if (!selectedMechanicId) {
      Alert.alert('Required', 'Please select a mechanic');
      return;
    }
    if (selectedLead.pickup_required && !selectedPickupBoyId) {
      Alert.alert('Required', 'Pickup boy is required for this lead');
      return;
    }

    try {
      setSaving(true);
      await apiFetch(`/api/workshop/leads/${selectedLead.id}/assign-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mechanic_id: selectedMechanicId,
          supervisor_id: selectedSupervisorId || null,
          pickup_boy_id: selectedPickupBoyId || null,
          notes: assignmentNotes || null,
        }),
      });

      Alert.alert('Success', 'Team assigned successfully', [
        {
          text: 'OK',
          onPress: () => {
            setShowAssignModal(false);
            setSelectedLead(null);
            setSelectedMechanicId('');
            setSelectedSupervisorId('');
            setSelectedPickupBoyId('');
            setAssignmentNotes('');
            fetchData();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to assign team');
    } finally {
      setSaving(false);
    }
  }

  function openAssignModal(lead: Lead) {
    setSelectedLead(lead);
    setSelectedMechanicId('');
    setSelectedSupervisorId('');
    setSelectedPickupBoyId('');
    setAssignmentNotes('');
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
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pickup:</Text>
            <Text style={styles.detailValue}>
              {item.pickup_required ? 'Required' : 'Not required'}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.assignButton]}
            onPress={() => openAssignModal(item)}
          >
            <Text style={styles.actionButtonText}>Assign Team</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.viewDetailsButton}
          onPress={() => navigation.navigate('WorkshopAdminLeadDetail', { leadId: item.id })}
        >
          <Text style={styles.viewDetailsText}>View Full Details →</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{pickupBoys.length}</Text>
          <Text style={styles.statLabel}>Pickup Boys</Text>
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
            <Text style={styles.modalTitle}>Assign Team</Text>

            {selectedLead && (
              <View style={styles.selectedLeadInfo}>
                <Text style={styles.selectedLeadNumber}>
                  {selectedLead.lead_number}
                </Text>
                <Text style={styles.selectedLeadCustomer}>
                  {selectedLead.customer_name}
                </Text>
                {selectedLead.pickup_required && (
                  <Text style={styles.selectedLeadBadge}>Pickup Required</Text>
                )}
              </View>
            )}

            <ScrollView style={styles.staffList}>
              <Text style={styles.sectionLabel}>Select Mechanic *</Text>
              <View style={styles.optionRow}>
                {mechanics.map((staff) => (
                  <TouchableOpacity
                    key={staff.id}
                    style={[
                      styles.optionChip,
                      selectedMechanicId === staff.id && styles.optionChipActive,
                    ]}
                    onPress={() => setSelectedMechanicId(staff.id)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selectedMechanicId === staff.id && styles.optionTextActive,
                      ]}
                    >
                      {staff.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Supervisor (optional)</Text>
              <View style={styles.optionRow}>
                {supervisors.map((staff) => (
                  <TouchableOpacity
                    key={staff.id}
                    style={[
                      styles.optionChip,
                      selectedSupervisorId === staff.id && styles.optionChipActive,
                    ]}
                    onPress={() =>
                      setSelectedSupervisorId(
                        selectedSupervisorId === staff.id ? '' : staff.id
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selectedSupervisorId === staff.id && styles.optionTextActive,
                      ]}
                    >
                      {staff.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Pickup Boy</Text>
              <View style={styles.optionRow}>
                {pickupBoys.map((staff) => (
                  <TouchableOpacity
                    key={staff.id}
                    style={[
                      styles.optionChip,
                      selectedPickupBoyId === staff.id && styles.optionChipActive,
                    ]}
                    onPress={() =>
                      setSelectedPickupBoyId(
                        selectedPickupBoyId === staff.id ? '' : staff.id
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selectedPickupBoyId === staff.id && styles.optionTextActive,
                      ]}
                    >
                      {staff.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Assignment Notes</Text>
              <TextInput
                style={styles.notesInput}
                value={assignmentNotes}
                onChangeText={setAssignmentNotes}
                placeholder="Notes for team"
                multiline
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowAssignModal(false);
                  setSelectedLead(null);
                }}
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={submitAssignment}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Assigning...' : 'Assign'}
                </Text>
              </TouchableOpacity>
            </View>
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
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 120,
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
  assignButton: {
    backgroundColor: '#2563eb',
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
  selectedLeadBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  staffList: {
    maxHeight: 400,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  optionChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  optionText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },
  optionTextActive: {
    color: '#fff',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalCloseButton: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: '#6b7280',
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

