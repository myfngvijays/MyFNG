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
  TextInput,
  Alert,
  Image,
  BackHandler,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { ENV } from '../../../config/environment';
import { useNavigation } from '@react-navigation/native';
import { AC } from '../../../components/workshop/advisorCrmUi';
import AdvisorFilterBar from '../../../components/workshop/AdvisorFilterBar';
import GlossyButton from '../../../components/workshop/GlossyButton';

interface ExtraWorkRequest {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  mechanic_name: string;
  description: string;
  reason: string;
  amount: number;
  category: string;
  is_urgent: boolean;
  created_at: string;
  status: string;
  image_url?: string;
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
    fetchRequests();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('extra-work-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lead_extra_charges'
      }, () => {
        console.log('Additional Jobs: Real-time update received');
        fetchRequests();
      })
      .subscribe((status) => {
        console.log('Extra work subscription status:', status);
      });
    
    return () => {
      supabase.removeChannel(channel);
    };
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

      console.log('🔍 Fetching additional job requests for workshop:', workshopId);

      // ✅ FIX: Match web app - correct column names
      const { data: extraCharges, error } = await supabase
        .from('lead_extra_charges')
        .select(`
          id,
          lead_id,
          description,
          reason,
          amount,
          category,
          is_urgent,
          created_at,
          status,
          requested_by,
          image_url,
          service_leads!inner(
            lead_number,
            customer_name,
            vehicle_number,
            workshop_id,
            deleted_at
          )
        `)
        .eq('service_leads.workshop_id', workshopId)
        .eq('status', 'PENDING')
        .is('service_leads.deleted_at', null)
        .order('is_urgent', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error fetching additional job:', error);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      console.log('✅ Found', extraCharges?.length || 0, 'additional job requests');

      // Fetch mechanic names
      const requestsWithMechanics = await Promise.all((extraCharges || []).map(async (req: any) => {
        const { data: mechanic } = await supabase
          .from('users_login')
          .select('full_name')
          .eq('id', req.requested_by)
          .single();

        return {
          id: req.id,
          lead_id: req.lead_id,
          lead_number: req.service_leads.lead_number,
          customer_name: req.service_leads.customer_name,
          vehicle_number: req.service_leads.vehicle_number,
          mechanic_name: mechanic?.full_name || 'Unknown',
          description: req.description,
          reason: req.reason,
          amount: parseFloat(req.amount),
          category: req.category || 'EXTRA_WORK',
          is_urgent: req.is_urgent || false,
          created_at: req.created_at,
          status: req.status,
          image_url: req.image_url,
        };
      }));

      setRequests(requestsWithMechanics);
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
      setFilteredRequests(requests.filter((r) => r.status === 'PENDING'));
    } else if (filter === 'APPROVED') {
      setFilteredRequests(requests.filter((r) => r.status === 'APPROVED'));
    } else if (filter === 'REJECTED') {
      setFilteredRequests(requests.filter((r) => r.status === 'REJECTED'));
    } else {
      setFilteredRequests(requests);
    }
  }

  function openApprovalModal(request: ExtraWorkRequest) {
    setSelectedRequest(request);
    setAdjustedCost(request.amount.toString());
    setShowApprovalModal(true);
  }

  async function handleApproval(decision: 'APPROVE' | 'REJECT') {
    if (!selectedRequest) return;

    if (decision === 'APPROVE' && !adjustedCost) {
      Alert.alert('Error', 'Please enter the approved cost.');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      if (decision === 'APPROVE') {
        const response = await fetch(`${ENV.API_URL}/api/supervisor/extra-work/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            id: selectedRequest.id,
            part_price_type: 'OEM',
            oem_price: parseFloat(adjustedCost),
            labour_price: 0,
            notes: approvalNotes || undefined,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.error || 'Failed to approve');
      } else {
        const response = await fetch(
          `${ENV.API_URL}/api/supervisor/extra-work/${selectedRequest.id}/reject`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ notes: approvalNotes || 'Rejected by advisor' }),
          }
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.error || 'Failed to reject');
      }

      Alert.alert(
        'Success',
        `Additional job request ${decision === 'APPROVE' ? 'approved' : 'rejected'}!`,
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
    const statusColor =
      item.status === 'APPROVED' ? '#10B981' : item.status === 'REJECTED' ? '#EF4444' : '#F59E0B';
    return (
      <View style={AC.listCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <Text style={AC.name} numberOfLines={1}>
            {item.customer_name || 'Customer'}
          </Text>
          <Text style={[AC.name, { color: '#004AAD' }]}>₹{item.amount}</Text>
        </View>
        <Text style={AC.meta} numberOfLines={1}>
          {item.vehicle_number}
          {item.mechanic_name ? ` · ${item.mechanic_name}` : ''}
        </Text>
        <Text style={AC.meta}>{formatDateTime(item.created_at)}</Text>
        {item.description ? (
          <Text style={AC.meta} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <View style={[AC.statusPill, { backgroundColor: statusColor }]}>
            <Text style={AC.statusPillTxt}>{item.status}</Text>
          </View>
        </View>
        {item.status === 'PENDING' ? (
          <View style={AC.btnRow}>
            <GlossyButton label="Review" color="#004AAD" onPress={() => openApprovalModal(item)} />
          </View>
        ) : null}
      </View>
    );
  }

  const stats = {
    pending: requests.filter((r) => r.status === 'PENDING').length,
    approved: requests.filter((r) => r.status === 'APPROVED').length,
    rejected: requests.filter((r) => r.status === 'REJECTED').length,
    totalCost: requests
      .filter((r) => r.status === 'APPROVED')
      .reduce((sum, r) => sum + r.amount, 0),
  };

  return (
    <View style={AC.page}>
      <AdvisorFilterBar
        subtitle={`${stats.pending} pending requests`}
        kpis={[
          { label: 'Pending', value: stats.pending, color: '#F59E0B' },
          { label: 'Approved', value: stats.approved, color: '#10B981' },
          { label: 'Rejected', value: stats.rejected, color: '#EF4444' },
          { label: 'Value', value: `₹${stats.totalCost}`, color: '#004AAD' },
        ]}
        chips={[
          { key: 'PENDING', label: 'PENDING' },
          { key: 'APPROVED', label: 'APPROVED' },
          { key: 'REJECTED', label: 'REJECTED' },
          { key: 'ALL', label: 'ALL' },
        ]}
        activeChip={filter}
        onChip={setFilter}
      />

      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        renderItem={renderRequest}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#004AAD']} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={AC.empty}>
            <Text style={AC.emptyTxt}>No additional job requests</Text>
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
              <Text style={styles.modalTitle}>Review Additional Job Request</Text>

              {selectedRequest && (
                <>
                  <View style={styles.leadViewCard}>
                    <View style={styles.leadViewTop}>
                      <View style={styles.leadAvatar}>
                        <Text style={styles.leadAvatarTxt}>
                          {(selectedRequest.customer_name || 'C').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.leadViewName}>
                          {selectedRequest.customer_name || 'Customer'}
                        </Text>
                        <Text style={styles.leadViewMeta}>{selectedRequest.vehicle_number}</Text>
                        <Text style={styles.leadViewMeta}>
                          Requested by {selectedRequest.mechanic_name || 'mechanic'}
                        </Text>
                      </View>
                      <Text style={styles.leadViewCost}>₹{selectedRequest.amount}</Text>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.sectionContent}>
                      {selectedRequest.description || '—'}
                    </Text>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Reason</Text>
                    <Text style={styles.sectionContent}>
                      {selectedRequest.reason || '—'}
                    </Text>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Approved cost</Text>
                    <View style={styles.costAdjustment}>
                      <Text style={styles.estimatedCostLabel}>Mechanic estimate</Text>
                      <Text style={styles.estimatedCostValue}>₹{selectedRequest.amount}</Text>
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

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your notes (optional)</Text>
                    <TextInput
                      style={styles.notesInput}
                      placeholder="Add observations or instructions..."
                      placeholderTextColor="#9ca3af"
                      multiline
                      numberOfLines={3}
                      value={approvalNotes}
                      onChangeText={setApprovalNotes}
                    />
                  </View>

                  <View style={styles.glossyRow}>
                    <GlossyButton
                      label="Approve"
                      color="#10B981"
                      onPress={() => handleApproval('APPROVE')}
                    />
                    <GlossyButton
                      label="Reject"
                      color="#EF4444"
                      onPress={() => handleApproval('REJECT')}
                    />
                    <GlossyButton
                      label="Cancel"
                      color="#64748B"
                      onPress={() => {
                        setShowApprovalModal(false);
                        setSelectedRequest(null);
                        setApprovalNotes('');
                        setAdjustedCost('');
                      }}
                    />
                  </View>
                </>
              )}
            </ScrollView>
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  filterButtonActive: {
    backgroundColor: '#004AAD',
    borderColor: '#004AAD',
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
    borderRadius: 14,
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
    color: '#023D95',
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
    color: '#004AAD',
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
    color: '#023D95',
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
    color: '#023D95',
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
    color: '#004AAD',
    fontWeight: '600',
  },
  reviewButton: {
    backgroundColor: '#004AAD',
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
    color: '#004AAD',
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
    fontSize: 18,
    fontWeight: '800',
    color: '#023D95',
    marginBottom: 14,
  },
  leadViewCard: {
    backgroundColor: '#EAF2FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,74,173,0.15)',
  },
  leadViewTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  leadAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#004AAD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadAvatarTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },
  leadViewName: { fontSize: 16, fontWeight: '800', color: '#023D95' },
  leadViewMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  leadViewCost: { fontSize: 18, fontWeight: '800', color: '#004AAD' },
  glossyRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 8 },
  selectedRequestInfo: {
    backgroundColor: '#EAF2FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  selectedRequestNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#023D95',
  },
  selectedRequestCustomer: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  selectedRequestMechanic: {
    fontSize: 13,
    color: '#004AAD',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#023D95',
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
    borderColor: '#004AAD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#023D95',
    fontWeight: 'bold',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#023D95',
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


