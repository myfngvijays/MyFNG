import React, { useState, useEffect } from 'react';
import { formatDateDMY } from "@/lib/dateFormat";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function PendingLeadsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [userProfileId, setUserProfileId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingLeads();
  }, []);

  const fetchPendingLeads = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's workshop
      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id, workshop_id')
        .eq('id', user.id)
        .single();

      if (!userProfile?.workshop_id) return;
      setUserProfileId(userProfile.id);

      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', userProfile.workshop_id)
        .in('status', ['ASSIGNED_TO_WORKSHOP', 'ASSIGNED', 'VALIDATED'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      const enriched = await Promise.all((data || []).map(async (lead) => {
        let serviceTypeIds = lead.service_type_ids;
        if (typeof serviceTypeIds === 'string') {
          try {
            serviceTypeIds = JSON.parse(serviceTypeIds);
          } catch {
            serviceTypeIds = [];
          }
        }

        if (Array.isArray(serviceTypeIds) && serviceTypeIds.length > 0) {
          const { data: serviceTypes } = await supabase
            .from('service_types')
            .select('id, name')
            .in('id', serviceTypeIds);
          lead.service_type_names = serviceTypes?.map((s) => s.name).join(', ') || '';
        }

        return lead;
      }));

      setLeads(enriched);
    } catch (error) {
      console.error('Error fetching pending leads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPendingLeads();
  };

  const handleAcceptLead = async (leadId: string) => {
    Alert.alert(
      'Accept Lead',
      'Are you sure you want to accept this lead?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              setProcessingId(leadId);
              const { error } = await supabase
                .from('service_leads')
                .update({
                  status: 'ACCEPTED',
                  accepted_at: new Date().toISOString(),
                  workshop_accepted_by: userProfileId,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', leadId);

              if (error) throw error;
              if (userProfileId) {
                await supabase.from('lead_events').insert({
                  lead_id: leadId,
                  event_type: 'LEAD_ACCEPTED',
                  event_description: 'Workshop Admin accepted the lead',
                  created_by: userProfileId,
                });
              }
              Alert.alert('Success', 'Lead accepted');
              fetchPendingLeads();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to accept lead');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const openRejectModal = (leadId: string) => {
    setSelectedLeadId(leadId);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const handleRejectLead = async () => {
    if (!selectedLeadId) return;
    if (!rejectReason.trim()) {
      Alert.alert('Reason required', 'Please provide a rejection reason');
      return;
    }

    try {
      setProcessingId(selectedLeadId);
      const { error } = await supabase
        .from('service_leads')
        .update({
          status: 'REJECTED',
          rejected_reason: rejectReason.trim(),
          rejected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedLeadId);

      if (error) throw error;

      if (userProfileId) {
        await supabase.from('lead_events').insert({
          lead_id: selectedLeadId,
          event_type: 'LEAD_REJECTED',
          event_description: `Workshop Admin rejected the lead: ${rejectReason.trim()}`,
          created_by: userProfileId,
        });
      }

      setRejectModalVisible(false);
      Alert.alert('Success', 'Lead rejected');
      fetchPendingLeads();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reject lead');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading pending leads...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Pending Leads" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {leads.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No pending leads</Text>
          </View>
        ) : (
          leads.map((lead, index) => (
            <View key={lead.id || index} style={styles.leadCard}>
              <View style={styles.leadHeader}>
                <Text style={styles.leadNumber}>{lead.lead_number}</Text>
                <Text style={styles.leadDate}>
                  {formatDateDMY(lead.created_at)}
                </Text>
              </View>
              
              <Text style={styles.customerName}>{lead.customer_name}</Text>
              <Text style={styles.customerPhone}>{lead.customer_phone}</Text>
              {lead.vehicle_number && (
                <Text style={styles.vehicleNumber}>Vehicle: {lead.vehicle_number}</Text>
              )}
              {lead.service_type_names ? (
                <Text style={styles.serviceTypes}>Services: {lead.service_type_names}</Text>
              ) : null}
              
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => openRejectModal(lead.id)}
                  disabled={processingId === lead.id}
                >
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() => handleAcceptLead(lead.id)}
                  disabled={processingId === lead.id}
                >
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.viewButton]}
                  onPress={() => (navigation as any).navigate('WorkshopAdminLeadDetail', { leadId: lead.id })}
                >
                  <Text style={styles.viewButtonText}>View</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject Lead</Text>
            <Text style={styles.modalSubtitle}>Provide a reason for rejection</Text>
            <TextInput
              style={styles.modalInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Reason"
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleRejectLead}>
                <Text style={styles.modalConfirmText}>Reject</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
  },
  leadCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  leadNumber: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    flex: 1,
  },
  leadDate: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
  customerName: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  customerPhone: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  vehicleNumber: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  serviceTypes: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: 14,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: COLORS.danger,
  },
  acceptButton: {
    backgroundColor: COLORS.success,
  },
  viewButton: {
    backgroundColor: COLORS.primary,
  },
  rejectButtonText: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
  acceptButtonText: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
  viewButtonText: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
  },
  modalTitle: {
    fontSize: SIZES.lg,
    fontWeight: '700',
    color: COLORS.textHeading,
  },
  modalSubtitle: {
    marginTop: 4,
    color: COLORS.textSecondary,
  },
  modalInput: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.sm,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  modalCancel: {
    backgroundColor: COLORS.gray[200],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  modalCancelText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  modalConfirm: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  modalConfirmText: {
    color: COLORS.white,
    fontWeight: '700',
  },
});
