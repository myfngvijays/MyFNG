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
  Linking,
  Alert,
  TextInput,
  BackHandler
} from 'react-native';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Removed - using emojis
import { Icon } from '../../../components/Icon';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SPACING } from '../../../constants/theme';

export default function TelecallerLeadDetailScreen({ route, navigation }: any) {
  const { user } = useAuth();
  const { leadId } = route.params;

  const [lead, setLead] = useState<any>(null);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCallLogForm, setShowCallLogForm] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [serviceTypeNames, setServiceTypeNames] = useState<string[]>([]);
  const [subserviceNames, setSubserviceNames] = useState<string[]>([]);

  const [callLogData, setCallLogData] = useState({
    call_status: 'ANSWERED',
    call_duration: '',
    outcome: 'INFO_COLLECTED',
    notes: ''
  });

  const [followUpData, setFollowUpData] = useState({
    follow_up_type: 'CALLBACK',
    scheduled_time: '',
    reason: '',
    priority: 'NORMAL'
  });

  useEffect(() => {
    fetchLeadDetails();
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

  const fetchLeadDetails = async () => {
    try {
      // Fetch lead
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        .select(`
          *,
          workshop:workshops(name, phone, city),
          created_by:created_by_id(full_name),
          assigned_telecaller:assigned_telecaller_id(full_name)
        `)
        .eq('id', leadId)
        .single();

      if (leadError) throw leadError;
      setLead(leadData);

      // Fetch service type names if service_type_ids exists
      if (leadData.service_type_ids) {
        try {
          const serviceIds = JSON.parse(leadData.service_type_ids);
          if (Array.isArray(serviceIds) && serviceIds.length > 0) {
            const { data: serviceTypesData } = await supabase
              .from('service_types')
              .select('id, name')
              .in('id', serviceIds);
            
            if (serviceTypesData) {
              setServiceTypeNames(serviceTypesData.map(st => st.name));
            }
          }
        } catch (e) {
          console.error('Error parsing service_type_ids:', e);
        }
      }

      // Fetch subservice names if subservice_ids exists
      if (leadData.subservice_ids) {
        try {
          const subserviceIds = JSON.parse(leadData.subservice_ids);
          if (Array.isArray(subserviceIds) && subserviceIds.length > 0) {
            const { data: subservicesData } = await supabase
              .from('service_addons')
              .select('id, name')
              .in('id', subserviceIds);
            
            if (subservicesData) {
              setSubserviceNames(subservicesData.map(sa => sa.name));
            }
          }
        } catch (e) {
          console.error('Error parsing subservice_ids:', e);
        }
      }

      // Fetch call logs
      const { data: callsData } = await supabase
        .from('telecaller_call_logs')
        .select('*, telecaller:telecaller_id(full_name)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      setCallLogs(callsData || []);

      // Fetch follow-ups
      const { data: followUpsData } = await supabase
        .from('telecaller_follow_ups')
        .select('*, telecaller:telecaller_id(full_name)')
        .eq('lead_id', leadId)
        .order('scheduled_time', { ascending: false });

      setFollowUps(followUpsData || []);

    } catch (error) {
      console.error('Error fetching lead details:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeadDetails();
  };

  const handleAddCallLog = async () => {
    try {
      const { data: profile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user?.email)
        .single();

      const { error } = await supabase
        .from('telecaller_call_logs')
        .insert([{
          lead_id: leadId,
          telecaller_id: profile?.id,
          call_type: 'OUTBOUND',
          call_status: callLogData.call_status,
          call_duration: callLogData.call_duration ? parseInt(callLogData.call_duration) : null,
          outcome: callLogData.outcome,
          notes: callLogData.notes,
          phone_number: lead?.customer_phone
        }]);

      if (!error) {
        await supabase
          .from('service_leads')
          .update({
            last_call_at: new Date().toISOString(),
            total_calls: (lead?.total_calls || 0) + 1
          })
          .eq('id', leadId);

        setCallLogData({
          call_status: 'ANSWERED',
          call_duration: '',
          outcome: 'INFO_COLLECTED',
          notes: ''
        });
        setShowCallLogForm(false);
        fetchLeadDetails();
        Alert.alert('Success', 'Call log added successfully!');
      }
    } catch (error) {
      console.error('Error adding call log:', error);
      Alert.alert('Error', 'Failed to add call log');
    }
  };

  const handleAddFollowUp = async () => {
    try {
      const { data: profile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user?.email)
        .single();

      const { error } = await supabase
        .from('telecaller_follow_ups')
        .insert([{
          lead_id: leadId,
          telecaller_id: profile?.id,
          follow_up_type: followUpData.follow_up_type,
          scheduled_time: followUpData.scheduled_time,
          reason: followUpData.reason,
          priority: followUpData.priority,
          status: 'PENDING'
        }]);

      if (!error) {
        await supabase
          .from('service_leads')
          .update({
            follow_up_required: true,
            next_follow_up_at: followUpData.scheduled_time
          })
          .eq('id', leadId);

        setFollowUpData({
          follow_up_type: 'CALLBACK',
          scheduled_time: '',
          reason: '',
          priority: 'NORMAL'
        });
        setShowFollowUpForm(false);
        fetchLeadDetails();
        Alert.alert('Success', 'Follow-up scheduled!');
      }
    } catch (error) {
      console.error('Error adding follow-up:', error);
      Alert.alert('Error', 'Failed to schedule follow-up');
    }
  };

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
      <View style={styles.loadingContainer}>
        <Icon name="alert-circle" size={64} color={COLORS.red} />
        <Text style={styles.errorText}>Lead not found</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      {/* Header with Back Button */}
      <View style={styles.headerBar}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation?.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Lead Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{lead.customer_name}</Text>
          <Text style={styles.headerSubtitle}>Lead #{lead.lead_number}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(lead.status) }]}>
          <Text style={styles.statusText}>{lead.status}</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={() => Linking.openURL(`tel:${lead.customer_phone}`)}
        >
          <Icon name="phone" size={20} color="#fff" />
          <Text style={styles.actionButtonTextPrimary}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => Linking.openURL(`whatsapp://send?phone=${lead.customer_phone}`)}
        >
          <Icon name="whatsapp" size={20} color={COLORS.green} />
          <Text style={styles.actionButtonTextSecondary}>WhatsApp</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Icon name="phone" size={24} color={COLORS.primary} />
          <Text style={styles.statValue}>{lead.total_calls || 0}</Text>
          <Text style={styles.statLabel}>Total Calls</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Icon name="priority-high" size={24} color={COLORS.orange} />
          <Text style={styles.statValue}>{lead.lead_priority || 'NORMAL'}</Text>
          <Text style={styles.statLabel}>Priority</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Icon name="source-branch" size={24} color={COLORS.blue} />
          <Text style={styles.statValue}>{lead.created_from || 'N/A'}</Text>
          <Text style={styles.statLabel}>Source</Text>
        </View>
      </View>

      {/* Customer Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer Information</Text>
        <View style={styles.sectionContent}>
          <InfoRow icon="account" label="Name" value={lead.customer_name} />
          <InfoRow icon="phone" label="Phone" value={lead.customer_phone} />
          {lead.customer_alternate_phone && (
            <InfoRow icon="phone-plus" label="Alt Phone" value={lead.customer_alternate_phone} />
          )}
          {lead.customer_email && (
            <InfoRow icon="email" label="Email" value={lead.customer_email} />
          )}
          {lead.customer_address && (
            <InfoRow icon="map-marker" label="Address" value={lead.customer_address} />
          )}
          <InfoRow icon="city" label="City" value={lead.city || 'N/A'} />
        </View>
      </View>

      {/* Vehicle Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vehicle Information</Text>
        <View style={styles.sectionContent}>
          <InfoRow icon="car" label="Registration" value={lead.vehicle_number || 'Not provided'} />
          <InfoRow icon="car-side" label="Make" value={lead.vehicle_make || 'N/A'} />
          <InfoRow icon="car-info" label="Model" value={lead.vehicle_model || 'N/A'} />
          {lead.vehicle_variant && (
            <InfoRow icon="tag" label="Variant" value={lead.vehicle_variant} />
          )}
          {lead.vehicle_year && (
            <InfoRow icon="calendar" label="Year" value={lead.vehicle_year.toString()} />
          )}
          {lead.vehicle_fuel_type && (
            <InfoRow icon="gas-station" label="Fuel" value={lead.vehicle_fuel_type} />
          )}
        </View>
      </View>

      {/* Service Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service Details</Text>
        <View style={styles.sectionContent}>
          {/* Service Types - Show names instead of UUIDs */}
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Service Types:</Text>
            {serviceTypeNames.length > 0 ? (
              <View style={styles.tagsContainer}>
                {serviceTypeNames.map((name, idx) => (
                  <View key={idx} style={[styles.tag, styles.tagBlue]}>
                    <Text style={styles.tagText}>{name}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.infoValue}>Not specified</Text>
            )}
          </View>

          {/* Subservices / Add-ons */}
          {subserviceNames.length > 0 && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Add-ons / Sub-services:</Text>
              <View style={styles.tagsContainer}>
                {subserviceNames.map((name, idx) => (
                  <View key={idx} style={[styles.tag, styles.tagGreen]}>
                    <Text style={styles.tagText}>{name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {lead.description && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Description:</Text>
              <Text style={styles.infoValue}>{lead.description}</Text>
            </View>
          )}
          {lead.problem_description && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Problem:</Text>
              <Text style={[styles.infoValue, styles.italic]}>"{lead.problem_description}"</Text>
            </View>
          )}
          {lead.payment_mode && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Payment Mode:</Text>
              <Text style={[styles.infoValue, { fontWeight: '600' }]}>{lead.payment_mode}</Text>
            </View>
          )}
          {lead.pickup_required && (
            <View style={styles.pickupBadge}>
              <Icon name="car-pickup" size={16} color={COLORS.blue} />
              <Text style={styles.pickupText}>Pickup Required</Text>
            </View>
          )}
        </View>
      </View>

      {/* Workshop Info */}
      {lead.workshop && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workshop Assigned</Text>
          <View style={styles.sectionContent}>
            <InfoRow icon="store" label="Name" value={lead.workshop.name} />
            <InfoRow icon="map-marker" label="City" value={lead.workshop.city} />
            <InfoRow icon="phone" label="Phone" value={lead.workshop.phone} />
          </View>
        </View>
      )}

      {/* Call History */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Call History ({callLogs.length})</Text>
          <TouchableOpacity onPress={() => setShowCallLogForm(!showCallLogForm)}>
            <Icon name="plus-circle" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {showCallLogForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add Call Log</Text>
            <TextInput
              style={styles.input}
              placeholder="Call duration (seconds)"
              value={callLogData.call_duration}
              onChangeText={(value) => setCallLogData({ ...callLogData, call_duration: value })}
              keyboardType="number-pad"
              placeholderTextColor={COLORS.textSecondary}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Notes..."
              value={callLogData.notes}
              onChangeText={(value) => setCallLogData({ ...callLogData, notes: value })}
              multiline
              numberOfLines={3}
              placeholderTextColor={COLORS.textSecondary}
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.formButton, styles.formButtonPrimary]}
                onPress={handleAddCallLog}
              >
                <Text style={styles.formButtonTextPrimary}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formButton, styles.formButtonSecondary]}
                onPress={() => setShowCallLogForm(false)}
              >
                <Text style={styles.formButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.sectionContent}>
          {callLogs.length === 0 ? (
            <Text style={styles.emptyText}>No call logs yet</Text>
          ) : (
            callLogs.map((log) => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={[styles.logBadge, { backgroundColor: getCallStatusColor(log.call_status) }]}>
                    <Text style={styles.logBadgeText}>{log.call_status}</Text>
                  </View>
                  {log.call_duration && (
                    <Text style={styles.logDuration}>
                      {Math.floor(log.call_duration / 60)}m {log.call_duration % 60}s
                    </Text>
                  )}
                </View>
                {log.notes && <Text style={styles.logNotes}>{log.notes}</Text>}
                <Text style={styles.logTime}>
                  {formatDateTime(log.created_at)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Follow-ups */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Follow-ups ({followUps.length})</Text>
          <TouchableOpacity onPress={() => setShowFollowUpForm(!showFollowUpForm)}>
            <Icon name="plus-circle" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {showFollowUpForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Schedule Follow-up</Text>
            <TextInput
              style={styles.input}
              placeholder="Reason..."
              value={followUpData.reason}
              onChangeText={(value) => setFollowUpData({ ...followUpData, reason: value })}
              placeholderTextColor={COLORS.textSecondary}
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.formButton, styles.formButtonPrimary]}
                onPress={handleAddFollowUp}
              >
                <Text style={styles.formButtonTextPrimary}>Schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formButton, styles.formButtonSecondary]}
                onPress={() => setShowFollowUpForm(false)}
              >
                <Text style={styles.formButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.sectionContent}>
          {followUps.length === 0 ? (
            <Text style={styles.emptyText}>No follow-ups scheduled</Text>
          ) : (
            followUps.map((fu) => (
              <View key={fu.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <Text style={styles.followUpType}>{fu.follow_up_type}</Text>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(fu.priority) }]}>
                    <Text style={styles.priorityText}>{fu.priority}</Text>
                  </View>
                </View>
                <Text style={styles.logNotes}>{fu.reason}</Text>
                <Text style={styles.logTime}>
                  {formatDateTime(fu.scheduled_time)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
    </View>
  );
}

interface InfoRowProps {
  icon: string;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Icon name={icon as any} size={16} color={COLORS.textSecondary} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}:</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'NEW': return COLORS.blue + '30';
    case 'ASSIGNED': return COLORS.indigo + '30';
    case 'ACCEPTED': return COLORS.green + '30';
    case 'REJECTED': return COLORS.red + '30';
    default: return COLORS.gray[500] + '30';
  }
}

function getCallStatusColor(status: string): string {
  switch (status) {
    case 'ANSWERED': return COLORS.green + '30';
    case 'NO_ANSWER': return COLORS.orange + '30';
    default: return COLORS.gray[500] + '30';
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'URGENT': return COLORS.red + '30';
    case 'HIGH': return COLORS.orange + '30';
    default: return COLORS.gray[500] + '30';
  }
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: SPACING.md,
    elevation: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  headerBarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
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
    color: COLORS.textSecondary,
  },
  errorText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.red,
  },
  button: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  quickActions: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: 8,
    gap: SPACING.xs,
  },
  actionButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.green,
  },
  actionButtonTextPrimary: {
    color: '#fff',
    fontWeight: 'bold',
  },
  actionButtonTextSecondary: {
    color: COLORS.green,
    fontWeight: 'bold',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: SPACING.md,
    borderRadius: 12,
    padding: SPACING.md,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.gray[500] + '30',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  section: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  infoContent: {
    marginLeft: SPACING.sm,
    flex: 1,
  },
  infoItem: {
    marginBottom: SPACING.sm,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  italic: {
    fontStyle: 'italic',
  },
  pickupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blue + '20',
    padding: SPACING.sm,
    borderRadius: 8,
    marginTop: SPACING.xs,
  },
  pickupText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.blue,
    marginLeft: SPACING.xs,
  },
  formCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.gray[500] + '40',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  formButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  formButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
  formButtonSecondary: {
    backgroundColor: COLORS.gray[500] + '30',
  },
  formButtonTextPrimary: {
    color: '#fff',
    fontWeight: 'bold',
  },
  formButtonTextSecondary: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  logCard: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[500] + '20',
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  logBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  logBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  logDuration: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  logNotes: {
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  logTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  followUpType: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  priorityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    padding: SPACING.lg,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  tag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  tagBlue: {
    backgroundColor: '#DBEAFE',
  },
  tagGreen: {
    backgroundColor: '#D1FAE5',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});

