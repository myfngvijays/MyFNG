import React, { useState, useEffect } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES } from '../../../constants/theme';

interface PendingLead {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  service_type: string;
  service_type_names?: string;
  estimated_amount: number;
  created_at: string;
  sla_accept_deadline?: string;
  pickup_required: boolean;
  pickup_address?: string;
  description?: string;
  status: string;
}

export default function PendingLeadsScreen() {
  const navigation = useNavigation<any>();
  const [leads, setLeads] = useState<PendingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

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
    fetchPendingLeads();

    // Setup realtime subscription
    const channel = supabase
      .channel('pending-leads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads',
        },
        () => {
          fetchPendingLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchPendingLeads() {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      if (!userProfile?.workshop_id) {
        Alert.alert('Error', 'Workshop not found');
        return;
      }

      setWorkshopId(userProfile.workshop_id);

      // Fetch leads with ASSIGNED status
      const { data: pendingLeads, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', userProfile.workshop_id)
        .in('status', ['ASSIGNED_TO_WORKSHOP', 'ASSIGNED'])
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching pending leads:', error);
        Alert.alert('Error', 'Failed to fetch pending leads');
        return;
      }

      // Fetch service type names for each lead
      const leadsWithServiceNames = await Promise.all(
        (pendingLeads || []).map(async (lead) => {
          let serviceTypeIds = lead.service_type_ids;
          if (typeof serviceTypeIds === 'string') {
            try {
              serviceTypeIds = JSON.parse(serviceTypeIds);
            } catch (e) {
              serviceTypeIds = [];
            }
          }

          if (serviceTypeIds && Array.isArray(serviceTypeIds) && serviceTypeIds.length > 0) {
            const { data: serviceTypes } = await supabase
              .from('service_types')
              .select('id, name')
              .in('id', serviceTypeIds);

            if (serviceTypes && serviceTypes.length > 0) {
              lead.service_type_names = serviceTypes.map((st: any) => st.name).join(', ');
            }
          }

          return lead;
        })
      );

      setLeads(leadsWithServiceNames || []);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'An error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleAcceptLead(leadId: string) {
    Alert.alert(
      'Accept Lead',
      'Accept this lead? You will be automatically assigned as the supervisor.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setProcessing(leadId);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              const { data: userProfile } = await supabase
                .from('users_login')
                .select('id')
                .eq('email', user.email)
                .single();

              if (!userProfile) {
                Alert.alert('Error', 'User profile not found');
                return;
              }

              // Update lead status to ACCEPTED and auto-assign supervisor
              const { error } = await supabase
                .from('service_leads')
                .update({
                  status: 'ACCEPTED',
                  assigned_supervisor_id: userProfile.id,
                  supervisor_assigned_at: new Date().toISOString(),
                  workshop_accepted_by: userProfile.id,
                  accepted_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', leadId);

              if (error) throw error;

              // Create lead event
              await supabase.from('lead_events').insert({
                lead_id: leadId,
                event_type: 'LEAD_ACCEPTED',
                event_description: 'Workshop Supervisor accepted the lead and was auto-assigned',
                created_by: userProfile.id,
              });

              Alert.alert('Success', 'Lead accepted successfully! You have been assigned as supervisor.');
              fetchPendingLeads();
            } catch (error) {
              console.error('Error accepting lead:', error);
              Alert.alert('Error', 'Failed to accept lead');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  }

  async function handleRejectLead(leadId: string) {
    Alert.prompt(
      'Reject Lead',
      'Enter rejection reason:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          onPress: async (reason) => {
            if (!reason) return;

            setProcessing(leadId);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              const { data: userProfile } = await supabase
                .from('users_login')
                .select('id')
                .eq('email', user.email)
                .single();

              // Update lead status to REJECTED
              const { error } = await supabase
                .from('service_leads')
                .update({
                  status: 'REJECTED',
                  rejected_reason: reason,
                  rejected_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', leadId);

              if (error) throw error;

              // Create lead event
              await supabase.from('lead_events').insert({
                lead_id: leadId,
                event_type: 'LEAD_REJECTED',
                event_description: `Workshop Supervisor rejected the lead: ${reason}`,
                created_by: userProfile?.id,
              });

              Alert.alert('Success', 'Lead rejected');
              fetchPendingLeads();
            } catch (error) {
              console.error('Error rejecting lead:', error);
              Alert.alert('Error', 'Failed to reject lead');
            } finally {
              setProcessing(null);
            }
          },
        },
      ],
      'plain-text'
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pending Leads</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⏰ Pending Leads</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchPendingLeads} />
        }
      >
        {leads.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptyText}>No pending leads waiting for approval</Text>
          </View>
        ) : (
          leads.map((lead) => (
            <View key={lead.id} style={styles.leadCard}>
              {/* Header */}
              <View style={styles.leadHeader}>
                <View>
                  <Text style={styles.leadNumber}>{lead.lead_number}</Text>
                  <Text style={styles.leadDate}>
                    Created: {formatDateTime(lead.created_at)}
                  </Text>
                </View>
                {lead.sla_accept_deadline && (
                  <View style={styles.slaBadge}>
                    <Text style={styles.slaLabel}>SLA Deadline</Text>
                    <Text style={styles.slaTime}>
                      {formatDateTime(lead.sla_accept_deadline)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Customer & Vehicle */}
              <View style={styles.detailsRow}>
                <View style={styles.detailCard}>
                  <View style={styles.detailHeader}>
                    <Ionicons name="person" size={20} color={COLORS.primary} />
                    <Text style={styles.detailTitle}>Customer</Text>
                  </View>
                  <Text style={styles.detailValue}>{lead.customer_name}</Text>
                  <Text style={styles.detailSubValue}>{lead.customer_phone}</Text>
                  {lead.pickup_address && (
                    <View style={styles.addressRow}>
                      <Ionicons name="location" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.addressText}>{lead.pickup_address}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.detailCard}>
                  <View style={styles.detailHeader}>
                    <Ionicons name="car" size={20} color={COLORS.secondary} />
                    <Text style={styles.detailTitle}>Vehicle</Text>
                  </View>
                  <Text style={styles.detailValue}>{lead.vehicle_number}</Text>
                  <Text style={styles.detailSubValue}>
                    {lead.vehicle_make} {lead.vehicle_model}
                  </Text>
                  {lead.pickup_required && (
                    <View style={styles.pickupBadge}>
                      <Text style={styles.pickupText}>🚗 Pickup Required</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Service Details */}
              <View style={styles.serviceCard}>
                <Text style={styles.serviceTitle}>Service Required</Text>
                <Text style={styles.serviceValue}>
                  {lead.service_type_names || lead.service_type}
                </Text>
                {lead.description && (
                  <Text style={styles.serviceDescription}>{lead.description}</Text>
                )}
                {lead.estimated_amount && (
                  <View style={styles.amountRow}>
                    <Ionicons name="cash" size={20} color={COLORS.success} />
                    <Text style={styles.amountValue}>
                      ₹{lead.estimated_amount.toLocaleString()}
                    </Text>
                    <Text style={styles.amountLabel}>(Estimated)</Text>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.viewButton}
                  onPress={() => navigation.navigate('JobDetail', { jobId: lead.id })}
                >
                  <Ionicons name="eye" size={18} color={COLORS.primary} />
                  <Text style={styles.viewButtonText}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.acceptButton, processing === lead.id && styles.buttonDisabled]}
                  onPress={() => handleAcceptLead(lead.id)}
                  disabled={processing === lead.id}
                >
                  {processing === lead.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rejectButton, processing === lead.id && styles.buttonDisabled]}
                  onPress={() => handleRejectLead(lead.id)}
                  disabled={processing === lead.id}
                >
                  <Ionicons name="close-circle" size={18} color="#fff" />
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    marginRight: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl * 2,
    marginTop: SPACING.xl * 2,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  leadCard: {
    backgroundColor: '#fff',
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  leadNumber: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  leadDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  slaBadge: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    padding: SPACING.sm,
    borderRadius: 8,
  },
  slaLabel: {
    fontSize: FONT_SIZES.xs,
    color: '#d97706',
    fontWeight: '600',
  },
  slaTime: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
    color: '#92400e',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  detailCard: {
    flex: 1,
    backgroundColor: '#f0f9ff',
    padding: SPACING.md,
    borderRadius: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  detailTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  detailValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  detailSubValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.sm,
  },
  addressText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    flex: 1,
  },
  pickupBadge: {
    backgroundColor: '#e9d5ff',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
  },
  pickupText: {
    fontSize: FONT_SIZES.xs,
    color: '#7c3aed',
    fontWeight: '600',
  },
  serviceCard: {
    backgroundColor: '#f9fafb',
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.md,
  },
  serviceTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  serviceValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  serviceDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  amountValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  amountLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
  },
  viewButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    backgroundColor: COLORS.success,
    borderRadius: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    backgroundColor: COLORS.error,
    borderRadius: 8,
  },
  rejectButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

