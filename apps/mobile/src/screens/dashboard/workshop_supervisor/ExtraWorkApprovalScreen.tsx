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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

interface ExtraWorkRequest {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  mechanic_name: string;
  issue_description: string;
  work_needed: string;
  estimated_cost: number;
  requested_at: string;
  approval_status: string;
  proof_images?: string[];
  mechanic_notes?: string;
}

export default function ExtraWorkApprovalScreen({ navigation }: any) {
  const [requests, setRequests] = useState<ExtraWorkRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<ExtraWorkRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ExtraWorkRequest | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [adjustedCost, setAdjustedCost] = useState('');
  const [filter, setFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [requests, filter]);

  async function fetchRequests() {
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

      const { data: extraCharges } = await supabase
        .from('lead_extra_charges')
        .select(`
          *,
          service_leads!inner (
            id,
            lead_number,
            customer_name,
            vehicle_number,
            workshop_id
          ),
          mechanic:requested_by (
            full_name
          )
        `)
        .eq('service_leads.workshop_id', workshopId)
        .order('requested_at', { ascending: false });

      const formattedRequests = extraCharges?.map((req: any) => ({
        id: req.id,
        lead_id: req.lead_id,
        lead_number: req.service_leads.lead_number,
        customer_name: req.service_leads.customer_name,
        vehicle_number: req.service_leads.vehicle_number,
        mechanic_name: req.mechanic?.full_name || 'Unknown',
        issue_description: req.issue_description,
        work_needed: req.work_needed,
        estimated_cost: req.estimated_cost,
        requested_at: req.requested_at,
        approval_status: req.approval_status,
        proof_images: req.proof_images || [],
        mechanic_notes: req.mechanic_notes,
      })) || [];

      setRequests(formattedRequests);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching requests:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }

  function filterRequests() {
    if (filter === 'PENDING') {
      setFilteredRequests(requests.filter((r) => r.approval_status === 'PENDING'));
    } else if (filter === 'APPROVED') {
      setFilteredRequests(requests.filter((r) => r.approval_status === 'APPROVED'));
    } else if (filter === 'REJECTED') {
      setFilteredRequests(requests.filter((r) => r.approval_status === 'REJECTED'));
    } else {
      setFilteredRequests(requests);
    }
  }

  function openApprovalModal(request: ExtraWorkRequest) {
    setSelectedRequest(request);
    setAdjustedCost(request.estimated_cost.toString());
    setShowApprovalModal(true);
  }

  async function handleApproval(decision: 'APPROVE' | 'REJECT') {
    if (!selectedRequest) return;

    if (decision === 'APPROVE' && !adjustedCost) {
      Alert.alert('Error', 'Please enter the approved cost.');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      const supervisorId = userProfile?.id;

      // Update extra charge request
      const { error: updateError } = await supabase
        .from('lead_extra_charges')
        .update({
          approval_status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          approved_by: supervisorId,
          approved_at: new Date().toISOString(),
          final_cost: decision === 'APPROVE' ? parseFloat(adjustedCost) : null,
          supervisor_notes: approvalNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      // Log supervisor action
      await supabase
        .from('supervisor_actions')
        .insert({
          supervisor_id: supervisorId,
          lead_id: selectedRequest.lead_id,
          action_type: decision === 'APPROVE' ? 'EXTRA_WORK_APPROVED' : 'EXTRA_WORK_REJECTED',
          action_description: `Extra work ${decision === 'APPROVE' ? 'approved' : 'rejected'}: ${selectedRequest.work_needed}`,
        });

      // If approved, update lead total cost
      if (decision === 'APPROVE') {
        const { data: currentLead } = await supabase
          .from('service_leads')
          .select('total_cost')
          .eq('id', selectedRequest.lead_id)
          .single();

        const currentTotal = currentLead?.total_cost || 0;
        const newTotal = currentTotal + parseFloat(adjustedCost);

        await supabase
          .from('service_leads')
          .update({
            total_cost: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedRequest.lead_id);
      }

      Alert.alert(
        'Success',
        `Extra work request ${decision === 'APPROVE' ? 'approved' : 'rejected'}!`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowApprovalModal(false);
              setSelectedRequest(null);
              setApprovalNotes('');
              setAdjustedCost('');
              fetchRequests();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error handling approval:', error);
      Alert.alert('Error', 'Failed to process request. Please try again.');
    }
  }

  function onRefresh() {
    setRefreshing(true);
    fetchRequests();
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'APPROVED':
        return '#10b981';
      case 'REJECTED':
        return '#ef4444';
      default:
        return '#f59e0b';
    }
  }

  function renderRequest({ item }: { item: ExtraWorkRequest }) {
    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.requestInfo}>
            <Text style={styles.leadNumber}>{item.lead_number}</Text>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item.approval_status) },
              ]}
            >
              <Text style={styles.statusText}>{item.approval_status}</Text>
            </View>
          </View>
          <View style={styles.costContainer}>
            <Text style={styles.costLabel}>Cost</Text>
            <Text style={styles.costValue}>₹{item.estimated_cost}</Text>
          </View>
        </View>

        <View style={styles.requestDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vehicle:</Text>
            <Text style={styles.detailValue}>{item.vehicle_number}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Mechanic:</Text>
            <Text style={styles.detailValue}>{item.mechanic_name}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Requested:</Text>
            <Text style={styles.detailValue}>
              {new Date(item.requested_at).toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.workDescription}>
          <Text style={styles.workTitle}>Issue Found:</Text>
          <Text style={styles.workText}>{item.issue_description}</Text>
          <Text style={styles.workTitle}>Work Needed:</Text>
          <Text style={styles.workText}>{item.work_needed}</Text>
          {item.mechanic_notes && (
            <>
              <Text style={styles.workTitle}>Mechanic Notes:</Text>
              <Text style={styles.workText}>{item.mechanic_notes}</Text>
            </>
          )}
        </View>

        {item.proof_images && item.proof_images.length > 0 && (
          <View style={styles.imagesContainer}>
            <Text style={styles.imagesLabel}>📷 {item.proof_images.length} proof images</Text>
          </View>
        )}

        {item.approval_status === 'PENDING' && (
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={() => openApprovalModal(item)}
          >
            <Text style={styles.reviewButtonText}>
              👁️ Review & Decide
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.viewDetailsButton}
          onPress={() =>
            navigation.navigate('ExtraWorkDetail', { requestId: item.id })
          }
        >
          <Text style={styles.viewDetailsText}>View Full Details →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stats = {
    pending: requests.filter((r) => r.approval_status === 'PENDING').length,
    approved: requests.filter((r) => r.approval_status === 'APPROVED').length,
    rejected: requests.filter((r) => r.approval_status === 'REJECTED').length,
    totalCost: requests
      .filter((r) => r.approval_status === 'APPROVED')
      .reduce((sum, r) => sum + r.estimated_cost, 0),
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Extra Work Approvals</Text>
        <Text style={styles.subtitle}>{stats.pending} pending requests</Text>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterButton,
                filter === f && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filter === f && styles.filterButtonTextActive,
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>
            {stats.pending}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#10b981' }]}>
            {stats.approved}
          </Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#ef4444' }]}>
            {stats.rejected}
          </Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#8b5cf6', fontSize: 16 }]}>
            ₹{stats.totalCost}
          </Text>
          <Text style={styles.statLabel}>Total Value</Text>
        </View>
      </View>

      {/* Requests List */}
      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        renderItem={renderRequest}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No extra work requests</Text>
          </View>
        }
      />

      {/* Approval Modal */}
      <Modal
        visible={showApprovalModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowApprovalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Review Extra Work Request</Text>

              {selectedRequest && (
                <>
                  <View style={styles.selectedRequestInfo}>
                    <Text style={styles.selectedRequestNumber}>
                      {selectedRequest.lead_number}
                    </Text>
                    <Text style={styles.selectedRequestCustomer}>
                      {selectedRequest.customer_name} - {selectedRequest.vehicle_number}
                    </Text>
                    <Text style={styles.selectedRequestMechanic}>
                      Requested by: {selectedRequest.mechanic_name}
                    </Text>
                  </View>

                  {/* Work Details */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Issue Found</Text>
                    <Text style={styles.sectionContent}>
                      {selectedRequest.issue_description}
                    </Text>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Work Needed</Text>
                    <Text style={styles.sectionContent}>
                      {selectedRequest.work_needed}
                    </Text>
                  </View>

                  {selectedRequest.mechanic_notes && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Mechanic Notes</Text>
                      <Text style={styles.sectionContent}>
                        {selectedRequest.mechanic_notes}
                      </Text>
                    </View>
                  )}

                  {/* Cost Adjustment */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Cost Details</Text>
                    <View style={styles.costAdjustment}>
                      <Text style={styles.estimatedCostLabel}>
                        Estimated by Mechanic:
                      </Text>
                      <Text style={styles.estimatedCostValue}>
                        ₹{selectedRequest.estimated_cost}
                      </Text>
                    </View>
                    <TextInput
                      style={styles.costInput}
                      placeholder="Enter approved cost"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                      value={adjustedCost}
                      onChangeText={setAdjustedCost}
                    />
                  </View>

                  {/* Supervisor Notes */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Notes (Optional)</Text>
                    <TextInput
                      style={styles.notesInput}
                      placeholder="Add your observations or instructions..."
                      placeholderTextColor="#9ca3af"
                      multiline
                      numberOfLines={3}
                      value={approvalNotes}
                      onChangeText={setApprovalNotes}
                    />
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => handleApproval('APPROVE')}
                    >
                      <Text style={styles.actionButtonText}>
                        ✅ Approve
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => handleApproval('REJECT')}
                    >
                      <Text style={styles.actionButtonText}>
                        ❌ Reject
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowApprovalModal(false);
                  setSelectedRequest(null);
                  setApprovalNotes('');
                  setAdjustedCost('');
                }}
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
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
  filterContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  filterButtonActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  filterButtonTextActive: {
    color: '#fff',
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
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
  },
  requestCard: {
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
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  requestInfo: {
    flex: 1,
    gap: 4,
  },
  leadNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  customerName: {
    fontSize: 14,
    color: '#374151',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  costContainer: {
    alignItems: 'flex-end',
  },
  costLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  costValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#8b5cf6',
  },
  requestDetails: {
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
  workDescription: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  workTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
    marginBottom: 4,
  },
  workText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  imagesContainer: {
    marginBottom: 12,
  },
  imagesLabel: {
    fontSize: 13,
    color: '#8b5cf6',
    fontWeight: '600',
  },
  reviewButton: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  viewDetailsButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  viewDetailsText: {
    fontSize: 13,
    color: '#8b5cf6',
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
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  selectedRequestInfo: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  selectedRequestNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  selectedRequestCustomer: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  selectedRequestMechanic: {
    fontSize: 13,
    color: '#8b5cf6',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  costAdjustment: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  estimatedCostLabel: {
    fontSize: 13,
    color: '#92400e',
  },
  estimatedCostValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#92400e',
  },
  costInput: {
    borderWidth: 2,
    borderColor: '#8b5cf6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    fontWeight: 'bold',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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

