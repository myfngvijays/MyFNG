import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useRoute, useNavigation } from '@react-navigation/native';

interface LeadDetail {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  service_type: string;
  problem_description: string;
  status: string;
  estimated_amount: number;
  actual_amount: number;
  created_at: string;
  accepted_at: string;
  completed_at: string;
  priority: string;
  sla_state: string;
  pickup_required: boolean;
  pickup_status: string;
  assigned_to_id: { full_name: string };
}

export default function LeadDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { leadId } = route.params as { leadId: string };

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeadDetail();
  }, [leadId]);

  const fetchLeadDetail = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('service_leads')
        .select('*, assigned_to_id(full_name)')
        .eq('id', leadId)
        .single();

      if (error) throw error;

      setLead(data);
    } catch (error) {
      console.error('Error fetching lead detail:', error);
      Alert.alert('Error', 'Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    Alert.alert(
      'Accept Lead',
      'Are you sure you want to accept this lead?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('service_leads')
                .update({
                  status: 'ACCEPTED',
                  accepted_at: new Date().toISOString(),
                })
                .eq('id', leadId);

              if (error) throw error;

              Alert.alert('Success', 'Lead accepted successfully');
              fetchLeadDetail();
            } catch (error) {
              console.error('Error accepting lead:', error);
              Alert.alert('Error', 'Failed to accept lead');
            }
          },
        },
      ]
    );
  };

  const handleReject = async () => {
    Alert.alert(
      'Reject Lead',
      'Are you sure you want to reject this lead?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('service_leads')
                .update({
                  status: 'REJECTED',
                  rejected_at: new Date().toISOString(),
                })
                .eq('id', leadId);

              if (error) throw error;

              Alert.alert('Success', 'Lead rejected');
              navigation.goBack();
            } catch (error) {
              console.error('Error rejecting lead:', error);
              Alert.alert('Error', 'Failed to reject lead');
            }
          },
        },
      ]
    );
  };

  const handleCall = () => {
    if (lead?.customer_phone) {
      Linking.openURL(`tel:${lead.customer_phone}`);
    }
  };

  const handleStartJob = () => {
    navigation.navigate('JobAssignment' as never, { leadId: lead?.id } as never);
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      ASSIGNED: '#f59e0b',
      ACCEPTED: '#3b82f6',
      IN_PROGRESS: '#8b5cf6',
      COMPLETED: '#10b981',
      REJECTED: '#ef4444',
      CANCELLED: '#6b7280',
    };
    return colors[status] || '#6b7280';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading lead details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!lead) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>❌</Text>
          <Text style={styles.errorText}>Lead not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.leadNumber}>#{lead.lead_number}</Text>
            <Text style={styles.customerName}>{lead.customer_name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(lead.status) }]}>
            <Text style={styles.statusText}>{lead.status}</Text>
          </View>
        </View>

        {/* Priority & SLA */}
        {(lead.priority === 'URGENT' || lead.sla_state === 'AT_RISK' || lead.sla_state === 'BREACHED') && (
          <View style={styles.alertsContainer}>
            {lead.priority === 'URGENT' && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>🚨 URGENT PRIORITY</Text>
              </View>
            )}
            {lead.sla_state !== 'SAFE' && (
              <View style={[styles.slaBadge, { backgroundColor: lead.sla_state === 'BREACHED' ? '#fee2e2' : '#fef3c7' }]}>
                <Text style={[styles.slaText, { color: lead.sla_state === 'BREACHED' ? '#dc2626' : '#d97706' }]}>
                  SLA {lead.sla_state}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Customer Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Name" value={lead.customer_name} />
            <InfoRow label="Phone" value={lead.customer_phone} />
            {lead.customer_email && <InfoRow label="Email" value={lead.customer_email} />}
            {lead.customer_address && <InfoRow label="Address" value={lead.customer_address} />}
          </View>
        </View>

        {/* Vehicle Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Registration" value={lead.vehicle_number} />
            {lead.vehicle_make && <InfoRow label="Make" value={lead.vehicle_make} />}
            {lead.vehicle_model && <InfoRow label="Model" value={lead.vehicle_model} />}
          </View>
        </View>

        {/* Service Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Information</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Service Type" value={lead.service_type} />
            {lead.problem_description && (
              <View style={styles.descriptionContainer}>
                <Text style={styles.label}>Problem Description:</Text>
                <Text style={styles.descriptionText}>{lead.problem_description}</Text>
              </View>
            )}
            <InfoRow 
              label="Estimated Amount" 
              value={`₹${lead.estimated_amount?.toLocaleString()}`} 
              valueStyle={{ fontWeight: 'bold', color: '#10b981' }}
            />
            {lead.actual_amount && lead.actual_amount > 0 && (
              <InfoRow 
                label="Actual Amount" 
                value={`₹${lead.actual_amount?.toLocaleString()}`}
                valueStyle={{ fontWeight: 'bold', color: '#2563eb' }}
              />
            )}
          </View>
        </View>

        {/* Pickup Information */}
        {lead.pickup_required && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pickup Information</Text>
            <View style={styles.infoCard}>
              <InfoRow label="Pickup Required" value="Yes" />
              <InfoRow label="Pickup Status" value={lead.pickup_status || 'PENDING'} />
            </View>
          </View>
        )}

        {/* Assignment Information */}
        {lead.assigned_to_id && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assignment Information</Text>
            <View style={styles.infoCard}>
              <InfoRow label="Assigned To" value={lead.assigned_to_id.full_name} />
            </View>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.infoCard}>
            <InfoRow 
              label="Created" 
              value={new Date(lead.created_at).toLocaleString()} 
            />
            {lead.accepted_at && (
              <InfoRow 
                label="Accepted" 
                value={new Date(lead.accepted_at).toLocaleString()} 
              />
            )}
            {lead.completed_at && (
              <InfoRow 
                label="Completed" 
                value={new Date(lead.completed_at).toLocaleString()} 
              />
            )}
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.callButton} onPress={handleCall}>
          <Text style={styles.actionButtonText}>📞 Call</Text>
        </TouchableOpacity>

        {lead.status === 'ASSIGNED' && (
          <>
            <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
              <Text style={styles.actionButtonText}>✓ Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectButton} onPress={handleReject}>
              <Text style={styles.actionButtonText}>✕ Reject</Text>
            </TouchableOpacity>
          </>
        )}

        {lead.status === 'ACCEPTED' && (
          <TouchableOpacity style={styles.startButton} onPress={handleStartJob}>
            <Text style={styles.actionButtonText}>▶ Start Job</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const InfoRow = ({ label, value, valueStyle }: { label: string; value: string; valueStyle?: any }) => (
  <View style={styles.infoRow}>
    <Text style={styles.label}>{label}:</Text>
    <Text style={[styles.value, valueStyle]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#6b7280',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leadNumber: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  alertsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  urgentBadge: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
  },
  urgentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
    textAlign: 'center',
  },
  slaBadge: {
    padding: 12,
    borderRadius: 8,
  },
  slaText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    flex: 2,
    textAlign: 'right',
  },
  descriptionContainer: {
    gap: 4,
  },
  descriptionText: {
    fontSize: 13,
    color: '#111827',
    lineHeight: 20,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  callButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#10b981',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButton: {
    flex: 2,
    backgroundColor: '#8b5cf6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

