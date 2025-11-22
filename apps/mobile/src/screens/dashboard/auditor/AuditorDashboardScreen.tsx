/**
 * Auditor Dashboard Screen - React Native
 * Fraud Detection & Quality Control Mobile App
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function AuditorDashboardScreen({ navigation }: any) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    flagged: 0,
  });

  // Audit data
  const [auditScore, setAuditScore] = useState(80);
  const [auditNotes, setAuditNotes] = useState('');

  // Flag data
  const [flagReason, setFlagReason] = useState('FRAUD_SUSPECTED');
  const [severity, setSeverity] = useState('MEDIUM');
  const [flagDescription, setFlagDescription] = useState('');

  useEffect(() => {
    fetchData();
  }, [filter]);

  async function fetchData() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_leads')
        .select(`
          *,
          workshop:workshops!workshop_id(name, audit_score)
        `)
        .eq('audit_required', true)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      let filtered = data || [];
      if (filter === 'pending') {
        filtered = filtered.filter(l => !l.audit_status || l.audit_status === 'PENDING' || l.audit_status === 'AUDIT_PENDING');
      } else if (filter === 'approved') {
        filtered = filtered.filter(l => l.audit_status === 'AUDIT_APPROVED');
      } else if (filter === 'flagged') {
        filtered = filtered.filter(l => l.audit_status === 'AUDIT_FLAGGED');
      }

      setLeads(filtered);

      // Calculate stats
      setStats({
        total: data?.length || 0,
        pending: data?.filter(l => !l.audit_status || l.audit_status === 'PENDING' || l.audit_status === 'AUDIT_PENDING').length || 0,
        approved: data?.filter(l => l.audit_status === 'AUDIT_APPROVED').length || 0,
        flagged: data?.filter(l => l.audit_status === 'AUDIT_FLAGGED').length || 0,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleApproveAudit() {
    if (!selectedLead) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      const { error } = await supabase
        .from('service_leads')
        .update({
          audit_status: 'AUDIT_APPROVED',
          audit_performed_by: userProfile?.id,
          audit_performed_at: new Date().toISOString(),
          audit_notes: auditNotes,
          audit_score: auditScore,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedLead.id);

      if (error) throw error;

      Alert.alert('Success', '✅ Audit approved successfully!');
      setShowAuditModal(false);
      setSelectedLead(null);
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }

  async function handleFlagLead() {
    if (!selectedLead || !flagDescription) {
      Alert.alert('Error', 'Description is required');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      const { error } = await supabase
        .from('service_leads')
        .update({
          audit_status: 'AUDIT_FLAGGED',
          audit_performed_by: userProfile?.id,
          audit_performed_at: new Date().toISOString(),
          audit_notes: `FLAGGED: ${flagReason} - ${flagDescription}`,
          is_fraud: flagReason === 'FRAUD_SUSPECTED',
          is_escalated: severity === 'CRITICAL',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedLead.id);

      if (error) throw error;

      Alert.alert('Success', '🚩 Lead flagged successfully!');
      setShowFlagModal(false);
      setSelectedLead(null);
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }

  const renderStatCard = (title: string, value: number, icon: string, color: string) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Ionicons name={icon as any} size={32} color={color} />
    </View>
  );

  const renderLeadItem = ({ item }: any) => (
    <View style={styles.leadCard}>
      <View style={styles.leadHeader}>
        <Text style={styles.leadNumber}>{item.lead_number}</Text>
        <View style={[styles.statusBadge, getStatusColor(item.audit_status)]}>
          <Text style={styles.statusText}>{item.audit_status || 'PENDING'}</Text>
        </View>
      </View>

      <View style={styles.leadInfo}>
        <Text style={styles.customerName}>{item.customer_name}</Text>
        <Text style={styles.vehicle}>🚗 {item.vehicle_number}</Text>
        {item.workshop && (
          <Text style={styles.workshop}>
            🏢 {item.workshop.name}
            {item.workshop.audit_score && ` • ${item.workshop.audit_score.toFixed(1)}/5`}
          </Text>
        )}
      </View>

      {item.final_amount && (
        <View style={styles.amountRow}>
          <Text style={styles.amount}>₹{item.final_amount.toLocaleString()}</Text>
          {item.final_amount > 10000 && (
            <View style={styles.highValueBadge}>
              <Text style={styles.highValueText}>HIGH VALUE</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.button, styles.approveButton]}
          onPress={() => {
            setSelectedLead(item);
            setAuditScore(80);
            setAuditNotes('');
            setShowAuditModal(true);
          }}
        >
          <Ionicons name="checkmark-circle" size={16} color="#FFF" />
          <Text style={styles.buttonText}>Approve</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.flagButton]}
          onPress={() => {
            setSelectedLead(item);
            setFlagReason('FRAUD_SUSPECTED');
            setSeverity('MEDIUM');
            setFlagDescription('');
            setShowFlagModal(true);
          }}
        >
          <Ionicons name="flag" size={16} color="#FFF" />
          <Text style={styles.buttonText}>Flag</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.reviewButton]}
          onPress={() => navigation.navigate('AuditDetail', { leadId: item.id })}
        >
          <Ionicons name="eye" size={16} color="#FFF" />
          <Text style={styles.buttonText}>Review</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  function getStatusColor(status?: string) {
    switch (status) {
      case 'AUDIT_APPROVED': return { backgroundColor: '#10B981' };
      case 'AUDIT_FLAGGED': return { backgroundColor: '#EF4444' };
      default: return { backgroundColor: '#F59E0B' };
    }
  }

  const flagReasons = [
    'FRAUD_SUSPECTED',
    'IMAGE_MANIPULATION',
    'OVERCHARGING',
    'POOR_SERVICE',
    'MISSING_DOCUMENTATION',
    'OTHER'
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="shield-checkmark" size={28} color="#FFF" />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Auditor Dashboard</Text>
            <Text style={styles.headerSubtitle}>Quality Control & Fraud Detection</Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsContainer}>
        {renderStatCard('Total', stats.total, 'shield', '#6366F1')}
        {renderStatCard('Pending', stats.pending, 'time', '#F59E0B')}
        {renderStatCard('Approved', stats.approved, 'checkmark-circle', '#10B981')}
        {renderStatCard('Flagged', stats.flagged, 'flag', '#EF4444')}
      </ScrollView>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'pending' && styles.filterActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'approved' && styles.filterActive]}
          onPress={() => setFilter('approved')}
        >
          <Text style={[styles.filterText, filter === 'approved' && styles.filterTextActive]}>
            Approved
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'flagged' && styles.filterActive]}
          onPress={() => setFilter('flagged')}
        >
          <Text style={[styles.filterText, filter === 'flagged' && styles.filterTextActive]}>
            Flagged
          </Text>
        </TouchableOpacity>
      </View>

      {/* Leads List */}
      <FlatList
        data={leads}
        renderItem={renderLeadItem}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            fetchData();
          }} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-checkmark" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No leads to audit</Text>
            <Text style={styles.emptySubtext}>All caught up! 🎉</Text>
          </View>
        }
      />

      {/* Approve Audit Modal */}
      <Modal visible={showAuditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Approve Audit</Text>
              <Text style={styles.modalSubtitle}>{selectedLead?.lead_number}</Text>

              <Text style={styles.label}>Audit Score (0-100) *</Text>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderValue}>{auditScore}/100</Text>
                <View style={styles.sliderButtons}>
                  <TouchableOpacity
                    style={styles.sliderButton}
                    onPress={() => setAuditScore(Math.max(0, auditScore - 10))}
                  >
                    <Text style={styles.sliderButtonText}>−</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.sliderButton}
                    onPress={() => setAuditScore(Math.min(100, auditScore + 10))}
                  >
                    <Text style={styles.sliderButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.label}>Audit Notes</Text>
              <TextInput
                style={styles.textArea}
                value={auditNotes}
                onChangeText={setAuditNotes}
                multiline
                numberOfLines={4}
                placeholder="Detailed audit observations..."
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.successButton]}
                  onPress={handleApproveAudit}
                >
                  <Text style={styles.modalButtonText}>✅ Approve Audit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.secondaryButton]}
                  onPress={() => setShowAuditModal(false)}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Flag Lead Modal */}
      <Modal visible={showFlagModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>🚩 Flag Lead</Text>
              <Text style={styles.modalSubtitle}>{selectedLead?.lead_number}</Text>

              <Text style={styles.label}>Flag Reason *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {flagReasons.map(reason => (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.reasonChip,
                      flagReason === reason && styles.reasonChipActive
                    ]}
                    onPress={() => setFlagReason(reason)}
                  >
                    <Text style={[
                      styles.reasonText,
                      flagReason === reason && styles.reasonTextActive
                    ]}>
                      {reason.replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Severity *</Text>
              <View style={styles.severityButtons}>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(sev => (
                  <TouchableOpacity
                    key={sev}
                    style={[
                      styles.severityButton,
                      severity === sev && styles.severityButtonActive,
                      severity === sev && getSeverityColor(sev)
                    ]}
                    onPress={() => setSeverity(sev)}
                  >
                    <Text style={[
                      styles.severityText,
                      severity === sev && styles.severityTextActive
                    ]}>
                      {sev}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={styles.textArea}
                value={flagDescription}
                onChangeText={setFlagDescription}
                multiline
                numberOfLines={4}
                placeholder="Detailed description of the issue..."
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.dangerButton]}
                  onPress={handleFlagLead}
                  disabled={!flagDescription}
                >
                  <Text style={styles.modalButtonText}>🚩 Flag Lead</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.secondaryButton]}
                  onPress={() => setShowFlagModal(false)}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'CRITICAL': return { backgroundColor: '#EF4444' };
    case 'HIGH': return { backgroundColor: '#F97316' };
    case 'MEDIUM': return { backgroundColor: '#F59E0B' };
    default: return { backgroundColor: '#3B82F6' };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#6366F1',
    padding: 20,
    paddingTop: 50,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#C7D2FE',
    marginTop: 2,
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 120,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statTitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  filterActive: {
    backgroundColor: '#6366F1',
  },
  filterText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFF',
  },
  listContent: {
    padding: 16,
  },
  leadCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leadNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  leadInfo: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  vehicle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  workshop: {
    fontSize: 12,
    color: '#6366F1',
    marginTop: 4,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginRight: 8,
  },
  highValueBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  highValueText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1E40AF',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  flagButton: {
    backgroundColor: '#EF4444',
  },
  reviewButton: {
    backgroundColor: '#6366F1',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  sliderContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6366F1',
    marginBottom: 12,
  },
  sliderButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  sliderButton: {
    width: 50,
    height: 50,
    backgroundColor: '#EEF2FF',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  reasonChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    marginRight: 8,
  },
  reasonChipActive: {
    backgroundColor: '#EF4444',
  },
  reasonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  reasonTextActive: {
    color: '#FFF',
  },
  severityButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  severityButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  severityButtonActive: {
    // Color set dynamically
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  severityTextActive: {
    color: '#FFF',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#111827',
  },
  modalButtons: {
    marginTop: 20,
    gap: 10,
  },
  modalButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: '#10B981',
  },
  dangerButton: {
    backgroundColor: '#EF4444',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
});

