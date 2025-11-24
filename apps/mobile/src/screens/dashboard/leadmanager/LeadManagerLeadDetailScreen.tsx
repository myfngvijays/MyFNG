import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert
} from 'react-native';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Removed - using emojis
import { Icon } from '../../../components/Icon';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING } from '../../../constants/theme';

export default function LeadManagerLeadDetailScreen({ navigation, route }: any) {
  const { leadId, mode = 'view' } = route.params;

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);

  // Editable fields state
  const [editedData, setEditedData] = useState({
    // Customer
    customer_name: '',
    customer_phone: '',
    customer_alternate_phone: '',
    customer_email: '',
    customer_address: '',
    
    // Vehicle
    vehicle_number: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_variant: '',
    vehicle_year: '',
    vehicle_fuel_type: '',
    odometer_km: '',
    
    // Service
    service_type: '',
    problem_description: '',
    
    // Pickup
    pickup_required: false,
    pickup_address: '',
    
    // Priority
    lead_priority: 'NORMAL',
    
    // Status
    status: 'NEW'
  });

  const [internalNotes, setInternalNotes] = useState('');
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [leadEvents, setLeadEvents] = useState<any[]>([]);

  useEffect(() => {
    fetchLeadDetails();
  }, []);

  const fetchLeadDetails = async () => {
    try {
      // Fetch lead with all relations
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        .select(`
          *,
          workshop:workshops(name, phone, city, address),
          assigned_telecaller:assigned_telecaller_id(full_name, phone),
          assigned_by_user:assigned_by(full_name),
          city_info:city_id(name)
        `)
        .eq('id', leadId)
        .single();

      if (leadError) throw leadError;
      setLead(leadData);

      // Set editable data
      setEditedData({
        customer_name: leadData.customer_name || '',
        customer_phone: leadData.customer_phone || '',
        customer_alternate_phone: leadData.customer_alternate_phone || '',
        customer_email: leadData.customer_email || '',
        customer_address: leadData.customer_address || '',
        vehicle_number: leadData.vehicle_number || '',
        vehicle_make: leadData.vehicle_make || '',
        vehicle_model: leadData.vehicle_model || '',
        vehicle_variant: leadData.vehicle_variant || '',
        vehicle_year: leadData.vehicle_year?.toString() || '',
        vehicle_fuel_type: leadData.vehicle_fuel_type || '',
        odometer_km: leadData.odometer_km?.toString() || '',
        service_type: leadData.service_type || '',
        problem_description: leadData.problem_description || '',
        pickup_required: leadData.pickup_required || false,
        pickup_address: leadData.pickup_address || '',
        lead_priority: leadData.lead_priority || 'NORMAL',
        status: leadData.status || 'NEW'
      });

      // Fetch call logs if telecaller assigned
      if (leadData.assigned_telecaller_id) {
        const { data: callsData } = await supabase
          .from('telecaller_call_logs')
          .select('*, telecaller:telecaller_id(full_name)')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false });
        
        setCallLogs(callsData || []);
      }

      // Fetch lead events
      const { data: eventsData } = await supabase
        .from('lead_events')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      setLeadEvents(eventsData || []);

    } catch (error) {
      console.error('Error fetching lead details:', error);
      Alert.alert('Error', 'Failed to load lead details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeadDetails();
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const updateData: any = {
        customer_name: editedData.customer_name,
        customer_phone: editedData.customer_phone,
        customer_alternate_phone: editedData.customer_alternate_phone || null,
        customer_email: editedData.customer_email || null,
        customer_address: editedData.customer_address || null,
        vehicle_number: editedData.vehicle_number || null,
        vehicle_make: editedData.vehicle_make || null,
        vehicle_model: editedData.vehicle_model || null,
        vehicle_variant: editedData.vehicle_variant || null,
        vehicle_year: editedData.vehicle_year ? parseInt(editedData.vehicle_year) : null,
        vehicle_fuel_type: editedData.vehicle_fuel_type || null,
        odometer_km: editedData.odometer_km ? parseInt(editedData.odometer_km) : null,
        service_type: editedData.service_type,
        problem_description: editedData.problem_description || null,
        pickup_required: editedData.pickup_required,
        pickup_address: editedData.pickup_address || null,
        lead_priority: editedData.lead_priority,
        status: editedData.status,
        updated_at: new Date().toISOString()
      };

      // Check if lead is now complete
      const isComplete = !!(
        updateData.customer_name &&
        updateData.customer_phone &&
        updateData.vehicle_model &&
        updateData.service_type
      );

      if (isComplete && lead.is_incomplete) {
        updateData.is_incomplete = false;
      }

      const { error } = await supabase
        .from('service_leads')
        .update(updateData)
        .eq('id', leadId);

      if (error) throw error;

      // Add internal note if provided
      if (internalNotes.trim()) {
        await supabase
          .from('lead_events')
          .insert([{
            lead_id: leadId,
            event_type: 'NOTE_ADDED',
            event_data: { notes: internalNotes },
            description: `Lead Manager added notes: ${internalNotes}`,
            created_at: new Date().toISOString()
          }]);
      }

      Alert.alert('Success', 'Lead updated successfully');
      setEditMode(false);
      setInternalNotes('');
      fetchLeadDetails();

    } catch (error) {
      console.error('Error saving lead:', error);
      Alert.alert('Error', 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!editedData.customer_name || !editedData.customer_phone || !editedData.vehicle_model || !editedData.service_type) {
      Alert.alert('Incomplete', 'Please fill all required fields: Customer Name, Phone, Vehicle Model, Service Type');
      return;
    }

    try {
      const { error } = await supabase
        .from('service_leads')
        .update({
          is_incomplete: false,
          status: 'VALIDATED',
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (!error) {
        Alert.alert('Success', 'Lead marked as complete and validated');
        fetchLeadDetails();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to mark complete');
    }
  };

  const handleAssignWorkshop = () => {
    navigation.navigate('assignWorkshop', { leadId: lead.id });
  };

  const handleSendToTelecaller = async () => {
    Alert.alert(
      'Send to Telecaller',
      'Send this lead back to telecaller for follow-up?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('service_leads')
                .update({
                  follow_up_required: true,
                  status: 'FOLLOW_UP'
                })
                .eq('id', leadId);

              if (!error) {
                Alert.alert('Success', 'Lead sent to telecaller');
                fetchLeadDetails();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to send lead');
            }
          }
        }
      ]
    );
  };

  const handleEscalate = async () => {
    Alert.alert(
      'Escalate Lead',
      'Mark this lead as escalated?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Escalate',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('service_leads')
                .update({
                  escalation: 'ESCALATED',
                  lead_priority: 'URGENT'
                })
                .eq('id', leadId);

              if (!error) {
                Alert.alert('Escalated', 'Lead has been escalated');
                fetchLeadDetails();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to escalate');
            }
          }
        }
      ]
    );
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Lead #{lead.lead_number}</Text>
          <Text style={styles.headerSubtitle}>{lead.customer_name}</Text>
        </View>
        {!editMode ? (
          <TouchableOpacity onPress={() => setEditMode(true)}>
            <Icon name="pencil" size={24} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Icon name="check" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* Status & Priority Row */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(lead.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(lead.status) }]}>{lead.status}</Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(lead.lead_priority || 'NORMAL') + '20' }]}>
            <Text style={[styles.priorityText, { color: getPriorityColor(lead.lead_priority || 'NORMAL') }]}>
              {lead.lead_priority || 'NORMAL'}
            </Text>
          </View>
          {lead.is_incomplete && (
            <View style={styles.incompleteBadge}>
              <Icon name="alert-circle" size={16} color={COLORS.orange} />
              <Text style={styles.incompleteText}>INCOMPLETE</Text>
            </View>
          )}
        </View>

        {/* SLA Alert */}
        {(lead.sla_state === 'BREACHED' || lead.sla_state === 'AT_RISK') && (
          <View style={[styles.alert, { backgroundColor: lead.sla_state === 'BREACHED' ? COLORS.red + '15' : COLORS.orange + '15' }]}>
            <Icon 
              name={lead.sla_state === 'BREACHED' ? 'alert-circle' : 'clock-alert'} 
              size={20} 
              color={lead.sla_state === 'BREACHED' ? COLORS.red : COLORS.orange} 
            />
            <Text style={[styles.alertText, { color: lead.sla_state === 'BREACHED' ? COLORS.red : COLORS.orange }]}>
              SLA {lead.sla_state === 'BREACHED' ? 'BREACHED!' : 'AT RISK'}
            </Text>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsBar}>
          {!lead.assigned_workshop_id && (
            <TouchableOpacity style={styles.quickAction} onPress={handleAssignWorkshop}>
              <Icon name="account-arrow-right" size={20} color={COLORS.green} />
              <Text style={styles.quickActionText}>Assign Workshop</Text>
            </TouchableOpacity>
          )}
          
          {lead.is_incomplete && (
            <TouchableOpacity style={styles.quickAction} onPress={handleMarkComplete}>
              <Icon name="check-circle" size={20} color={COLORS.blue} />
              <Text style={styles.quickActionText}>Mark Complete</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.quickAction} onPress={handleSendToTelecaller}>
            <Icon name="phone-forward" size={20} color={COLORS.teal} />
            <Text style={styles.quickActionText}>To Telecaller</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickAction} onPress={handleEscalate}>
            <Icon name="alert-octagon" size={20} color={COLORS.orange} />
            <Text style={styles.quickActionText}>Escalate</Text>
          </TouchableOpacity>
        </View>

        {/* Customer Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="account" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Customer Details</Text>
          </View>
          <View style={styles.sectionContent}>
            {editMode ? (
              <>
                <Text style={styles.fieldLabel}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.customer_name}
                  onChangeText={(text) => setEditedData({ ...editedData, customer_name: text })}
                  placeholder="Customer Name"
                  placeholderTextColor={COLORS.textSecondary}
                />
                
                <Text style={styles.fieldLabel}>Phone *</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.customer_phone}
                  onChangeText={(text) => setEditedData({ ...editedData, customer_phone: text })}
                  placeholder="Phone Number"
                  keyboardType="phone-pad"
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.fieldLabel}>Alternate Phone</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.customer_alternate_phone}
                  onChangeText={(text) => setEditedData({ ...editedData, customer_alternate_phone: text })}
                  placeholder="Alternate Phone"
                  keyboardType="phone-pad"
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.customer_email}
                  onChangeText={(text) => setEditedData({ ...editedData, customer_email: text })}
                  placeholder="Email Address"
                  keyboardType="email-address"
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.fieldLabel}>Address</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editedData.customer_address}
                  onChangeText={(text) => setEditedData({ ...editedData, customer_address: text })}
                  placeholder="Address"
                  multiline
                  numberOfLines={3}
                  placeholderTextColor={COLORS.textSecondary}
                />
              </>
            ) : (
              <>
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
                <InfoRow icon="city" label="City" value={lead.city_info?.name || lead.city || 'N/A'} />
              </>
            )}
          </View>
        </View>

        {/* Vehicle Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="car" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Vehicle Details</Text>
          </View>
          <View style={styles.sectionContent}>
            {editMode ? (
              <>
                <Text style={styles.fieldLabel}>Registration Number</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.vehicle_number}
                  onChangeText={(text) => setEditedData({ ...editedData, vehicle_number: text.toUpperCase() })}
                  placeholder="DL01AB1234"
                  autoCapitalize="characters"
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.fieldLabel}>Make</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.vehicle_make}
                  onChangeText={(text) => setEditedData({ ...editedData, vehicle_make: text })}
                  placeholder="Maruti, Hyundai, etc."
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.fieldLabel}>Model *</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.vehicle_model}
                  onChangeText={(text) => setEditedData({ ...editedData, vehicle_model: text })}
                  placeholder="Swift, i20, etc."
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.fieldLabel}>Variant</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.vehicle_variant}
                  onChangeText={(text) => setEditedData({ ...editedData, vehicle_variant: text })}
                  placeholder="VXI, Sportz, etc."
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.fieldLabel}>Year</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.vehicle_year}
                  onChangeText={(text) => setEditedData({ ...editedData, vehicle_year: text })}
                  placeholder="2020"
                  keyboardType="number-pad"
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.fieldLabel}>Fuel Type</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.vehicle_fuel_type}
                  onChangeText={(text) => setEditedData({ ...editedData, vehicle_fuel_type: text })}
                  placeholder="Petrol, Diesel, CNG"
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.fieldLabel}>Odometer (km)</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.odometer_km}
                  onChangeText={(text) => setEditedData({ ...editedData, odometer_km: text })}
                  placeholder="50000"
                  keyboardType="number-pad"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </>
            ) : (
              <>
                <InfoRow icon="card-text" label="Registration" value={lead.vehicle_number || 'Not provided'} />
                <InfoRow icon="car-side" label="Make" value={lead.vehicle_make || 'N/A'} />
                <InfoRow icon="car-info" label="Model" value={lead.vehicle_model || 'N/A'} />
                {lead.vehicle_variant && <InfoRow icon="tag" label="Variant" value={lead.vehicle_variant} />}
                {lead.vehicle_year && <InfoRow icon="calendar" label="Year" value={lead.vehicle_year.toString()} />}
                {lead.vehicle_fuel_type && <InfoRow icon="gas-station" label="Fuel" value={lead.vehicle_fuel_type} />}
                {lead.odometer_km && <InfoRow icon="counter" label="Odometer" value={`${lead.odometer_km} km`} />}
              </>
            )}
          </View>
        </View>

        {/* Service Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="wrench" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Service Details</Text>
          </View>
          <View style={styles.sectionContent}>
            {editMode ? (
              <>
                <Text style={styles.fieldLabel}>Service Type *</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.service_type}
                  onChangeText={(text) => setEditedData({ ...editedData, service_type: text })}
                  placeholder="General Service, Repair, etc."
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.fieldLabel}>Problem Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editedData.problem_description}
                  onChangeText={(text) => setEditedData({ ...editedData, problem_description: text })}
                  placeholder="Describe the issue..."
                  multiline
                  numberOfLines={4}
                  placeholderTextColor={COLORS.textSecondary}
                />
              </>
            ) : (
              <>
                <InfoRow icon="wrench" label="Service Type" value={lead.service_type || 'Not specified'} />
                {lead.problem_description && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Problem:</Text>
                    <Text style={[styles.infoValue, styles.italic]}>"{lead.problem_description}"</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Pickup Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="car-pickup" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Pickup Details</Text>
          </View>
          <View style={styles.sectionContent}>
            {editMode ? (
              <>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setEditedData({ ...editedData, pickup_required: !editedData.pickup_required })}
                >
                  <Icon
                    name={editedData.pickup_required ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={24}
                    color={COLORS.primary}
                  />
                  <Text style={styles.checkboxLabel}>Pickup Required</Text>
                </TouchableOpacity>

                {editedData.pickup_required && (
                  <>
                    <Text style={styles.fieldLabel}>Pickup Address</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={editedData.pickup_address}
                      onChangeText={(text) => setEditedData({ ...editedData, pickup_address: text })}
                      placeholder="Pickup address..."
                      multiline
                      numberOfLines={3}
                      placeholderTextColor={COLORS.textSecondary}
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <InfoRow icon="car-pickup" label="Pickup Required" value={lead.pickup_required ? 'Yes' : 'No'} />
                {lead.pickup_required && lead.pickup_address && (
                  <InfoRow icon="map-marker" label="Pickup Address" value={lead.pickup_address} />
                )}
                {lead.pickup_status && (
                  <InfoRow icon="information" label="Pickup Status" value={lead.pickup_status} />
                )}
              </>
            )}
          </View>
        </View>

        {/* Workshop Section */}
        {lead.workshop && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="store" size={24} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Assigned Workshop</Text>
            </View>
            <View style={styles.sectionContent}>
              <InfoRow icon="store" label="Name" value={lead.workshop.name} />
              <InfoRow icon="map-marker" label="City" value={lead.workshop.city} />
              <InfoRow icon="phone" label="Phone" value={lead.workshop.phone} />
              {lead.assigned_by_user && (
                <InfoRow icon="account-check" label="Assigned By" value={lead.assigned_by_user.full_name} />
              )}
            </View>
          </View>
        )}

        {/* Call Logs Section */}
        {callLogs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="phone-log" size={24} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Call History ({callLogs.length})</Text>
            </View>
            <View style={styles.sectionContent}>
              {callLogs.map((log) => (
                <View key={log.id} style={styles.logCard}>
                  <View style={styles.logHeader}>
                    <View style={[styles.logBadge, { backgroundColor: getCallStatusColor(log.call_status) + '30' }]}>
                      <Text style={styles.logBadgeText}>{log.call_status}</Text>
                    </View>
                    {log.call_duration && (
                      <Text style={styles.logDuration}>
                        {Math.floor(log.call_duration / 60)}m {log.call_duration % 60}s
                      </Text>
                    )}
                  </View>
                  {log.notes && <Text style={styles.logNotes}>{log.notes}</Text>}
                  <Text style={styles.logTime}>{new Date(log.created_at).toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Internal Notes Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="note-text" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Internal Notes (Lead Manager Only)</Text>
          </View>
          <View style={styles.sectionContent}>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={internalNotes}
              onChangeText={setInternalNotes}
              placeholder="Add internal notes..."
              multiline
              numberOfLines={4}
              placeholderTextColor={COLORS.textSecondary}
            />
            {leadEvents.length > 0 && (
              <View style={styles.eventsContainer}>
                <Text style={styles.eventsTitle}>Recent Events:</Text>
                {leadEvents.slice(0, 5).map((event) => (
                  <Text key={event.id} style={styles.eventText}>
                    • {event.description} - {new Date(event.created_at).toLocaleDateString()}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Save Button at bottom */}
        {editMode && (
          <View style={styles.saveButtonContainer}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="content-save" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setEditMode(false);
                fetchLeadDetails();
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
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
    case 'NEW': return COLORS.blue;
    case 'ASSIGNED': return COLORS.indigo;
    case 'ACCEPTED': return COLORS.green;
    case 'REJECTED': return COLORS.red;
    case 'IN_PROGRESS': return COLORS.orange;
    default: return COLORS.gray;
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'URGENT': return COLORS.red;
    case 'HIGH': return COLORS.orange;
    case 'NORMAL': return COLORS.blue;
    default: return COLORS.gray;
  }
}

function getCallStatusColor(status: string): string {
  switch (status) {
    case 'ANSWERED': return COLORS.green;
    case 'NO_ANSWER': return COLORS.orange;
    default: return COLORS.gray;
  }
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
    padding: SPACING.md,
    paddingTop: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: SPACING.xs,
    marginRight: SPACING.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.sm,
    backgroundColor: '#fff',
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  incompleteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.orange + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  incompleteText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.orange,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: 8,
    gap: SPACING.sm,
  },
  alertText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  quickActionsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.md,
    gap: SPACING.sm,
    backgroundColor: '#fff',
    marginBottom: SPACING.sm,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    gap: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  section: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
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
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.gray + '40',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  checkboxLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
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
  logCard: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray + '20',
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
  eventsContainer: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray + '20',
  },
  eventsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  eventText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  saveButtonContainer: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.gray + '20',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});

