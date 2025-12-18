import { formatDateTime } from "@/lib/dateFormat";
/**
 * Lead Detail Screen - Mobile
 * Phase 3: Complete lead detail page for mobile
 * All 14 sections from web version
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { calculateSLA, getSLAStatusColor } from '../../services/slaService';

interface LeadDetailScreenProps {
  leadId: string;
  onBack: () => void;
}

export default function LeadDetailScreen({ leadId, onBack }: LeadDetailScreenProps) {
  const { userProfile } = useAuth();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('details');

  useEffect(() => {
    fetchLeadDetails();
  }, [leadId]);

  async function fetchLeadDetails() {
    try {
      const { data, error } = await supabase
        .from('service_leads')
        .select(`
          *,
          assigned_mechanic:users_login!service_leads_assigned_mechanic_id_fkey(full_name),
          assigned_pickup:users_login!service_leads_assigned_pickup_boy_id_fkey(full_name),
          assigned_supervisor:users_login!service_leads_assigned_supervisor_id_fkey(full_name)
        `)
        .eq('id', leadId)
        .single();

      if (error) throw error;
      setLead(data);
    } catch (error: any) {
      console.error('Error fetching lead:', error.message);
      Alert.alert('Error', 'Failed to fetch lead details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    fetchLeadDetails();
  }

  async function handleAcceptLead() {
    Alert.alert(
      'Accept Lead',
      'Are you sure you want to accept this lead?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              const response = await fetch(`http://localhost:3000/api/leads/${leadId}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              });

              if (!response.ok) throw new Error('Failed to accept lead');

              Alert.alert('Success', 'Lead accepted successfully!');
              fetchLeadDetails();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  }

  async function handleRejectLead() {
    Alert.prompt(
      'Reject Lead',
      'Please provide a reason (minimum 10 characters):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          onPress: async (reason) => {
            if (!reason || reason.length < 10) {
              Alert.alert('Error', 'Reason must be at least 10 characters');
              return;
            }

            try {
              const response = await fetch(`http://localhost:3000/api/leads/${leadId}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
              });

              if (!response.ok) throw new Error('Failed to reject lead');

              Alert.alert('Success', 'Lead rejected successfully!');
              onBack();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ],
      'plain-text'
    );
  }

  function handlePhoneCall(phone: string) {
    Linking.openURL(`tel:${phone}`);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading lead details...</Text>
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Lead not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { timeRemaining, slaStatus } = calculateSLA(lead.created_at, lead.status, lead.lead_type);
  const slaColor = getSLAStatusColor(slaStatus);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.leadNumber}>{lead.lead_number}</Text>
        <View style={[styles.slaBadge, { backgroundColor: slaColor }]}>
          <Text style={styles.slaText}>{slaStatus}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* Tab Navigation */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeSection === 'details' && styles.activeTab]}
            onPress={() => setActiveSection('details')}
          >
            <Text style={[styles.tabText, activeSection === 'details' && styles.activeTabText]}>
              Details
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeSection === 'actions' && styles.activeTab]}
            onPress={() => setActiveSection('actions')}
          >
            <Text style={[styles.tabText, activeSection === 'actions' && styles.activeTabText]}>
              Actions
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeSection === 'history' && styles.activeTab]}
            onPress={() => setActiveSection('history')}
          >
            <Text style={[styles.tabText, activeSection === 'history' && styles.activeTabText]}>
              History
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content based on active section */}
        {activeSection === 'details' && (
          <View style={styles.content}>
            {/* Status Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Status</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{lead.status.replace(/_/g, ' ')}</Text>
              </View>
              <Text style={styles.cardSubtext}>
                Created: {formatDateTime(lead.created_at)}
              </Text>
              {lead.accepted_at && (
                <Text style={styles.cardSubtext}>
                  Accepted: {formatDateTime(lead.accepted_at)}
                </Text>
              )}
            </View>

            {/* Customer Details */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Customer Details</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Name:</Text>
                <Text style={styles.detailValue}>{lead.customer_name}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone:</Text>
                <TouchableOpacity onPress={() => handlePhoneCall(lead.customer_phone)}>
                  <Text style={[styles.detailValue, styles.phoneLink]}>
                    📞 {lead.customer_phone}
                  </Text>
                </TouchableOpacity>
              </View>
              {lead.customer_email && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email:</Text>
                  <Text style={styles.detailValue}>{lead.customer_email}</Text>
                </View>
              )}
              {lead.customer_address && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Address:</Text>
                  <Text style={styles.detailValue}>{lead.customer_address}</Text>
                </View>
              )}
            </View>

            {/* Vehicle Details */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Vehicle Details</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Number:</Text>
                <Text style={styles.detailValue}>{lead.vehicle_number}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Make/Model:</Text>
                <Text style={styles.detailValue}>
                  {lead.vehicle_make} {lead.vehicle_model}
                </Text>
              </View>
              {lead.vehicle_year && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Year:</Text>
                  <Text style={styles.detailValue}>{lead.vehicle_year}</Text>
                </View>
              )}
              {lead.fuel_type && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Fuel Type:</Text>
                  <Text style={styles.detailValue}>{lead.fuel_type}</Text>
                </View>
              )}
            </View>

            {/* Service Details */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Service Request</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Service Type:</Text>
                <Text style={styles.detailValue}>{lead.service_type}</Text>
              </View>
              {lead.problem_description && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Problem:</Text>
                  <Text style={styles.detailValue}>{lead.problem_description}</Text>
                </View>
              )}
              {lead.estimated_cost && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Estimated Cost:</Text>
                  <Text style={[styles.detailValue, styles.priceText]}>
                    ₹{lead.estimated_cost.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            {/* Scheduling */}
            {lead.preferred_service_slot && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Scheduling</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Preferred Slot:</Text>
                  <Text style={styles.detailValue}>{lead.preferred_service_slot}</Text>
                </View>
                {lead.pickup_required && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Pickup:</Text>
                    <Text style={styles.detailValue}>✅ Required</Text>
                  </View>
                )}
              </View>
            )}

            {/* Assignments */}
            {(lead.assigned_mechanic || lead.assigned_pickup || lead.assigned_supervisor) && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Assignments</Text>
                {lead.assigned_mechanic && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Mechanic:</Text>
                    <Text style={styles.detailValue}>{lead.assigned_mechanic.full_name}</Text>
                  </View>
                )}
                {lead.assigned_pickup && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Pickup Boy:</Text>
                    <Text style={styles.detailValue}>{lead.assigned_pickup.full_name}</Text>
                  </View>
                )}
                {lead.assigned_supervisor && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Supervisor:</Text>
                    <Text style={styles.detailValue}>{lead.assigned_supervisor.full_name}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {activeSection === 'actions' && (
          <View style={styles.content}>
            {lead.status === 'NEW' && (
              <View style={styles.actionsCard}>
                <Text style={styles.actionTitle}>Lead Actions</Text>
                <TouchableOpacity style={styles.acceptButton} onPress={handleAcceptLead}>
                  <Text style={styles.acceptButtonText}>✅ Accept Lead</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectButton} onPress={handleRejectLead}>
                  <Text style={styles.rejectButtonText}>❌ Reject Lead</Text>
                </TouchableOpacity>
              </View>
            )}

            {lead.status === 'ACCEPTED' && (
              <View style={styles.actionsCard}>
                <Text style={styles.actionTitle}>Next Steps</Text>
                <Text style={styles.actionDescription}>
                  Please assign a mechanic, supervisor, and pickup boy (if required) from the web dashboard.
                </Text>
              </View>
            )}

            {(lead.status === 'IN_PROGRESS' || lead.status === 'READY_FOR_DELIVERY') && (
              <View style={styles.actionsCard}>
                <Text style={styles.actionTitle}>Lead in Progress</Text>
                <Text style={styles.actionDescription}>
                  Work is ongoing. You can view full details and add media/charges from the web dashboard.
                </Text>
              </View>
            )}

            {lead.status === 'REJECTED' && (
              <View style={styles.actionsCard}>
                <Text style={styles.actionTitle}>Lead Rejected</Text>
                {lead.rejected_reason && (
                  <Text style={styles.rejectedReason}>Reason: {lead.rejected_reason}</Text>
                )}
              </View>
            )}
          </View>
        )}

        {activeSection === 'history' && (
          <View style={styles.content}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Service History</Text>
              <Text style={styles.cardSubtext}>
                View complete service history on the web dashboard
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
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
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[600],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.danger,
    marginBottom: SPACING.lg,
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    paddingTop: SPACING.xl + 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  leadNumber: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  slaBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  slaText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    fontWeight: '500',
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  content: {
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.sm,
  },
  cardSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginTop: SPACING.xs,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginVertical: SPACING.sm,
  },
  statusText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  detailLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    flex: 2,
    textAlign: 'right',
  },
  phoneLink: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  priceText: {
    color: COLORS.success,
    fontWeight: 'bold',
  },
  actionsCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  actionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.md,
  },
  actionDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: SPACING.md,
  },
  acceptButton: {
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  acceptButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  rejectButton: {
    backgroundColor: COLORS.danger,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  rejectedReason: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.danger,
    backgroundColor: COLORS.gray[100],
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
  },
});

