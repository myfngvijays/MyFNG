import React, { useState, useEffect } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { COLORS, SIZES, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../../constants/theme';
import { Icon } from '../../../components/Icon';
import { openPhoneCall } from '../../../lib/phone';

export default function RSALeadDetailScreen({ navigation, route }: any) {
  const { userProfile } = useAuth();
  const { leadId } = route.params;
  
  const [lead, setLead] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [managers, setManagers] = useState<any[]>([]);
  const [mechanics, setMechanics] = useState<any[]>([]);
  
  // Modals
  const [showAssignManager, setShowAssignManager] = useState(false);
  const [showAssignMechanic, setShowAssignMechanic] = useState(false);
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);
  
  // Form states
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [selectedMechanicId, setSelectedMechanicId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');

  useEffect(() => {
    fetchLeadDetail();
    fetchTimeline();
    fetchManagers();
  }, [leadId]);

  const fetchLeadDetail = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('rsa_manager_get_lead_detail', {
        p_lead_id: leadId,
      });
      
      if (error) throw error;
      setLead(data && data.length > 0 ? data[0] : null);
    } catch (error) {
      console.error('Error fetching lead:', error);
      Alert.alert('Error', 'Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeline = async () => {
    try {
      const { data, error } = await supabase.rpc('rsa_manager_get_lead_timeline', {
        p_lead_id: leadId,
      });
      
      if (error) throw error;
      setTimeline(data || []);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    }
  };

  const fetchManagers = async () => {
    try {
      const { data, error } = await supabase.rpc('rsa_manager_get_all_managers');
      if (error) throw error;
      setManagers(data || []);
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchLeadDetail(), fetchTimeline()]);
    setRefreshing(false);
  };

  const handleClaimLead = async () => {
    if (!userProfile) return;
    
    try {
      const { data, error } = await supabase.rpc('rsa_manager_self_assign_lead', {
        p_lead_id: leadId,
        p_manager_id: userProfile.id,
        p_manager_name: userProfile.full_name || userProfile.email,
      });
      
      if (error) throw error;
      
      if (data && data.length > 0 && data[0].success) {
        Alert.alert('Success', 'Lead claimed successfully!');
        fetchLeadDetail();
        fetchTimeline();
      } else {
        Alert.alert('Error', data?.[0]?.message || 'Failed to claim lead');
      }
    } catch (error: any) {
      console.error('Error claiming lead:', error);
      Alert.alert('Error', error.message || 'Failed to claim lead');
    }
  };

  const handleAssignToManager = async () => {
    if (!selectedManagerId || !userProfile) return;
    
    try {
      const { data, error } = await supabase.rpc('rsa_manager_assign_lead', {
        p_lead_id: leadId,
        p_assigner_id: userProfile.id,
        p_target_manager_id: selectedManagerId,
        p_assigner_name: userProfile.full_name || userProfile.email,
      });
      
      if (error) throw error;
      
      if (data && data.length > 0 && data[0].success) {
        Alert.alert('Success', 'Lead assigned successfully!');
        setShowAssignManager(false);
        setSelectedManagerId('');
        fetchLeadDetail();
        fetchTimeline();
      } else {
        Alert.alert('Error', data?.[0]?.message || 'Failed to assign lead');
      }
    } catch (error: any) {
      console.error('Error assigning lead:', error);
      Alert.alert('Error', error.message || 'Failed to assign lead');
    }
  };

  const handleSearchMechanics = async () => {
    if (!lead) return;
    
    try {
      const { data, error } = await supabase.rpc('rsa_manager_search_mechanics', {
        p_pincode: lead.pincode || null,
        p_service_tag: lead.service_type || null,
        p_search_term: null,
      });
      
      if (error) throw error;
      setMechanics(data || []);
      setShowAssignMechanic(true);
    } catch (error: any) {
      console.error('Error searching mechanics:', error);
      Alert.alert('Error', error.message || 'Failed to search mechanics');
    }
  };

  const handleAssignMechanic = async () => {
    if (!selectedMechanicId) return;
    
    try {
      const { data, error } = await supabase.rpc('rsa_manager_assign_mechanic', {
        p_lead_id: leadId,
        p_mechanic_id: selectedMechanicId,
        p_payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        p_remark: remark || null,
      });
      
      if (error) throw error;
      
      if (data && data.length > 0 && data[0].success) {
        Alert.alert('Success', 'Mechanic assigned successfully!');
        setShowAssignMechanic(false);
        setSelectedMechanicId('');
        setPaymentAmount('');
        setRemark('');
        fetchLeadDetail();
        fetchTimeline();
      } else {
        Alert.alert('Error', data?.[0]?.message || 'Failed to assign mechanic');
      }
    } catch (error: any) {
      console.error('Error assigning mechanic:', error);
      Alert.alert('Error', error.message || 'Failed to assign mechanic');
    }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return;
    
    try {
      const { data, error } = await supabase.rpc('rsa_manager_update_lead_status', {
        p_lead_id: leadId,
        p_status: newStatus,
        p_notes: statusNotes || null,
      });
      
      if (error) throw error;
      
      if (data && data.length > 0 && data[0].success) {
        Alert.alert('Success', 'Status updated successfully!');
        setShowUpdateStatus(false);
        setNewStatus('');
        setStatusNotes('');
        fetchLeadDetail();
        fetchTimeline();
      } else {
        Alert.alert('Error', data?.[0]?.message || 'Failed to update status');
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      Alert.alert('Error', error.message || 'Failed to update status');
    }
  };

  const handleCall = (phone: string) => {
    openPhoneCall(phone);
  };

  const handleOpenMap = (link: string) => {
    Linking.openURL(link);
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      'pending': COLORS.warning,
      'assigned': COLORS.primary,
      'assigned_to_manager': COLORS.secondary,
      'assigned_to_mechanic': '#6366f1',
      'in_progress': COLORS.orange,
      'completed': COLORS.success,
      'cancelled': COLORS.error,
    };
    return colors[status] || COLORS.gray[500];
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading lead details...</Text>
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="alert-circle" size={64} color={COLORS.error} />
        <Text style={styles.errorText}>Lead not found</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lead Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Status and Priority */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: (getStatusColor(lead.lead_status || lead.complaint_status) as string) + '20' },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(lead.lead_status || lead.complaint_status) as string },
              ]}
            >
              {lead.lead_status || lead.complaint_status}
            </Text>
          </View>
          {lead.priority && (
            <View style={[styles.priorityBadge, { backgroundColor: COLORS.primary + '20' }]}>
              <Text style={[styles.priorityText, { color: COLORS.primary }]}>
                {lead.priority.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <Text style={styles.customerName}>{lead.customer_name}</Text>
          
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => handleCall(lead.contact_number)}
          >
            <Icon name="phone" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>{lead.contact_number}</Text>
          </TouchableOpacity>
          
          {lead.alternate_number && (
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => handleCall(lead.alternate_number)}
            >
              <Icon name="phone" size={20} color={COLORS.gray[500]} />
              <Text style={styles.infoText}>Alt: {lead.alternate_number}</Text>
            </TouchableOpacity>
          )}
          
          {lead.address && (
            <View style={styles.infoRow}>
              <Icon name="map-pin" size={20} color={COLORS.gray[500]} />
              <Text style={styles.infoText}>
                {lead.address} {lead.pincode ? `- ${lead.pincode}` : ''}
              </Text>
            </View>
          )}
          
          {lead.location_link && (
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => handleOpenMap(lead.location_link)}
            >
              <Icon name="map-pin" size={20} color={COLORS.primary} />
              <Text style={[styles.infoText, { color: COLORS.primary }]}>View on Map</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Vehicle Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          <View style={styles.infoRow}>
            <Icon name="car" size={20} color={COLORS.gray[500]} />
            <Text style={styles.infoText}>
              {lead.vehicle_number} {lead.vehicle_model ? `(${lead.vehicle_model})` : ''}
            </Text>
          </View>
          {lead.service_type && (
            <View style={styles.infoRow}>
              <Icon name="wrench" size={20} color={COLORS.gray[500]} />
              <Text style={styles.infoText}>Service: {lead.service_type}</Text>
            </View>
          )}
          {lead.problem && (
            <Text style={styles.problemText}>{lead.problem}</Text>
          )}
        </View>

        {/* Assignment Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assignment Information</Text>
          {lead.registered_by_name && (
            <View style={styles.assignmentRow}>
              <Text style={styles.assignmentLabel}>Registered By:</Text>
              <Text style={styles.assignmentValue}>{lead.registered_by_name}</Text>
            </View>
          )}
          {lead.assigned_manager_name && (
            <View style={styles.assignmentRow}>
              <Text style={styles.assignmentLabel}>Assigned Manager:</Text>
              <Text style={styles.assignmentValue}>{lead.assigned_manager_name}</Text>
            </View>
          )}
          {lead.assigned_mechanic_name && (
            <View style={styles.assignmentRow}>
              <Text style={styles.assignmentLabel}>Assigned Mechanic:</Text>
              <Text style={styles.assignmentValue}>
                {lead.assigned_mechanic_name}
                {lead.assigned_mechanic_contact && ` (${lead.assigned_mechanic_contact})`}
              </Text>
            </View>
          )}
        </View>

        {/* Payment Info */}
        {lead.customer_quoted_amount && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Information</Text>
            <View style={styles.assignmentRow}>
              <Text style={styles.assignmentLabel}>Quoted Amount:</Text>
              <Text style={[styles.assignmentValue, { fontWeight: 'bold' }]}>
                ₹{lead.customer_quoted_amount}
              </Text>
            </View>
            {lead.payment_to_mechanic && (
              <View style={styles.assignmentRow}>
                <Text style={styles.assignmentLabel}>Payment to Mechanic:</Text>
                <Text style={styles.assignmentValue}>₹{lead.payment_to_mechanic}</Text>
              </View>
            )}
          </View>
        )}

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          {timeline.map((entry) => (
            <View key={entry.id} style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStatus}>{entry.status}</Text>
                {entry.status_description && (
                  <Text style={styles.timelineDescription}>{entry.status_description}</Text>
                )}
                {entry.updated_by_name && (
                  <Text style={styles.timelineBy}>By: {entry.updated_by_name}</Text>
                )}
                <Text style={styles.timelineDate}>
                  {formatDateTime(entry.updated_at)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {!lead.assigned_manager_id && (
          <TouchableOpacity style={styles.actionButton} onPress={handleClaimLead}>
            <Text style={styles.actionButtonText}>Claim Lead</Text>
          </TouchableOpacity>
        )}
        {lead.assigned_manager_id === userProfile?.id && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.gray[500] }]}
              onPress={() => setShowUpdateStatus(true)}
            >
              <Text style={styles.actionButtonText}>Update Status</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
              onPress={() => setShowAssignManager(true)}
            >
              <Text style={styles.actionButtonText}>Assign to Manager</Text>
            </TouchableOpacity>
            {!lead.assigned_mechanic_id && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.success }]}
                onPress={handleSearchMechanics}
              >
                <Text style={styles.actionButtonText}>Assign Mechanic</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Update Status Modal */}
      <Modal visible={showUpdateStatus} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Status</Text>
            
            <Text style={styles.modalLabel}>New Status</Text>
            <ScrollView style={styles.statusOptions}>
              {['pending', 'in_progress', 'completed', 'cancelled'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusOption,
                    newStatus === status && styles.statusOptionSelected,
                  ]}
                  onPress={() => setNewStatus(status)}
                >
                  <Text
                    style={[
                      styles.statusOptionText,
                      newStatus === status && styles.statusOptionTextSelected,
                    ]}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>Notes (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={statusNotes}
              onChangeText={setStatusNotes}
              placeholder="Enter notes about status change"
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: COLORS.gray[200] }]}
                onPress={() => {
                  setShowUpdateStatus(false);
                  setNewStatus('');
                  setStatusNotes('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: COLORS.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: COLORS.primary }]}
                onPress={handleUpdateStatus}
                disabled={!newStatus}
              >
                <Text style={styles.modalButtonText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Manager Modal */}
      <Modal visible={showAssignManager} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign to Manager</Text>
            
            <Text style={styles.modalLabel}>Select Manager</Text>
            <ScrollView style={styles.selectContainer}>
              {managers.map((manager) => (
                <TouchableOpacity
                  key={manager.id}
                  style={[
                    styles.selectOption,
                    selectedManagerId === manager.id && styles.selectOptionSelected,
                  ]}
                  onPress={() => setSelectedManagerId(manager.id)}
                >
                  <Text
                    style={[
                      styles.selectOptionText,
                      selectedManagerId === manager.id && styles.selectOptionTextSelected,
                    ]}
                  >
                    {manager.name} ({manager.email})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: COLORS.gray[200] }]}
                onPress={() => {
                  setShowAssignManager(false);
                  setSelectedManagerId('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: COLORS.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: COLORS.primary }]}
                onPress={handleAssignToManager}
                disabled={!selectedManagerId}
              >
                <Text style={styles.modalButtonText}>Assign</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Mechanic Modal */}
      <Modal visible={showAssignMechanic} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Assign Mechanic</Text>
            
            <Text style={styles.modalLabel}>Select Mechanic</Text>
            <ScrollView style={styles.selectContainer}>
              {mechanics.map((mechanic) => (
                <TouchableOpacity
                  key={mechanic.id}
                  style={[
                    styles.selectOption,
                    selectedMechanicId === mechanic.id && styles.selectOptionSelected,
                  ]}
                  onPress={() => setSelectedMechanicId(mechanic.id)}
                >
                  <Text
                    style={[
                      styles.selectOptionText,
                      selectedMechanicId === mechanic.id && styles.selectOptionTextSelected,
                    ]}
                  >
                    {mechanic.mechanic_name} ({mechanic.mechanic_code}) -{' '}
                    {mechanic.is_available ? 'Available' : 'Busy'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>Payment Amount (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              placeholder="Enter payment amount"
              keyboardType="numeric"
            />

            <Text style={styles.modalLabel}>Remark (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={remark}
              onChangeText={setRemark}
              placeholder="Enter any remarks"
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: COLORS.gray[200] }]}
                onPress={() => {
                  setShowAssignMechanic(false);
                  setSelectedMechanicId('');
                  setPaymentAmount('');
                  setRemark('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: COLORS.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: COLORS.success }]}
                onPress={handleAssignMechanic}
                disabled={!selectedMechanicId}
              >
                <Text style={styles.modalButtonText}>Assign Mechanic</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontFamily: 'Poppins',
  },
  errorText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.error,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    fontFamily: 'Poppins',
    fontWeight: '600',
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.white,
    fontFamily: 'Poppins',
  },
  scrollView: {
    flex: 1,
    paddingBottom: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  priorityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  priorityText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  section: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: SPACING.md,
    fontFamily: 'Poppins',
  },
  customerName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: SPACING.md,
    fontFamily: 'Poppins',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  infoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    flex: 1,
    fontFamily: 'Poppins',
  },
  problemText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textBody,
    marginTop: SPACING.sm,
    lineHeight: 20,
    fontFamily: 'Poppins',
  },
  assignmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  assignmentLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  assignmentValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textBody,
    flex: 1,
    textAlign: 'right',
    fontFamily: 'Poppins',
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    marginRight: SPACING.md,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStatus: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textHeading,
    fontFamily: 'Poppins',
  },
  timelineDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontFamily: 'Poppins',
  },
  timelineBy: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
    fontFamily: 'Poppins',
  },
  timelineDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
    fontFamily: 'Poppins',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: SPACING.lg,
    fontFamily: 'Poppins',
  },
  modalLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textHeading,
    marginBottom: SPACING.sm,
    fontFamily: 'Poppins',
  },
  statusOptions: {
    maxHeight: 200,
    marginBottom: SPACING.md,
  },
  statusOption: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[100],
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  statusOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusOptionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textBody,
    fontFamily: 'Poppins',
  },
  statusOptionTextSelected: {
    color: COLORS.white,
    fontWeight: '600',
  },
  selectContainer: {
    maxHeight: 200,
    marginBottom: SPACING.md,
  },
  selectOption: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[100],
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  selectOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  selectOptionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textBody,
    fontFamily: 'Poppins',
  },
  selectOptionTextSelected: {
    color: COLORS.white,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textBody,
    marginBottom: SPACING.md,
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily: 'Poppins',
    backgroundColor: COLORS.gray[50],
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  modalButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
});

