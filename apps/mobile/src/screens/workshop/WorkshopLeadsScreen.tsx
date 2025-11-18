/**
 * Workshop Leads Screen - Mobile
 * Enhanced lead management with SLA tracking
 * Task: WA-302
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import LeadCardMobile from '../../components/LeadCardMobile';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';

type FilterStatus = 'ALL' | 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED';

export default function WorkshopLeadsScreen({ onBack }: { onBack: () => void }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<any[]>([]);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    initializeScreen();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [leads, searchQuery, statusFilter]);

  // Real-time subscription
  useEffect(() => {
    if (!workshopId) return;

    const channel = supabase
      .channel('workshop-leads-mobile')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads',
          filter: `workshop_id=eq.${workshopId}`,
        },
        () => {
          fetchLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workshopId]);

  async function initializeScreen() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('workshop_id')
        .eq('id', user.id)
        .single();

      if (userProfile?.workshop_id) {
        setWorkshopId(userProfile.workshop_id);
        await fetchLeads(userProfile.workshop_id);
      }
    } catch (error) {
      console.error('Error initializing:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLeads(wId?: string) {
    const targetWorkshopId = wId || workshopId;
    if (!targetWorkshopId) return;

    try {
      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', targetWorkshopId)
        .eq('lead_type', 'NORMAL')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching leads:', error);
        return;
      }

      setLeads(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  function applyFilters() {
    let filtered = [...leads];

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(lead =>
        lead.lead_number?.toLowerCase().includes(query) ||
        lead.customer_name?.toLowerCase().includes(query) ||
        lead.customer_phone?.includes(query) ||
        lead.vehicle_number?.toLowerCase().includes(query)
      );
    }

    setFilteredLeads(filtered);
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLeads();
    setRefreshing(false);
  };

  async function handleAcceptLead(leadId: string) {
    if (actionLoading) return;

    Alert.alert(
      'Accept Lead',
      'Are you sure you want to accept this lead?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setActionLoading(true);
            try {
              // Call API
              // For now, simulate success
              Alert.alert('Success', 'Lead accepted successfully!');
              await fetchLeads();
            } catch (error) {
              Alert.alert('Error', 'Failed to accept lead');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }

  function handleRejectLead(leadId: string) {
    setSelectedLeadId(leadId);
    setRejectReason('');
    setShowRejectModal(true);
  }

  async function submitRejection() {
    if (!rejectReason.trim() || rejectReason.length < 10) {
      Alert.alert('Error', 'Please provide a rejection reason (minimum 10 characters)');
      return;
    }

    setActionLoading(true);
    try {
      // Call API
      // For now, simulate success
      Alert.alert('Success', 'Lead rejected successfully!');
      setShowRejectModal(false);
      setSelectedLeadId(null);
      await fetchLeads();
    } catch (error) {
      Alert.alert('Error', 'Failed to reject lead');
    } finally {
      setActionLoading(false);
    }
  }

  function handleLeadPress(leadId: string) {
    // Navigate to lead detail
    Alert.alert('Info', `Lead detail view coming soon. Lead ID: ${leadId}`);
  }

  const stats = {
    total: leads.length,
    assigned: leads.filter(l => l.status === 'ASSIGNED').length,
    accepted: leads.filter(l => l.status === 'ACCEPTED').length,
    inProgress: leads.filter(l => l.status === 'IN_PROGRESS').length,
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading leads...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Manage Leads</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.warning }]}>{stats.assigned}</Text>
          <Text style={styles.statLabel}>Assigned</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.success }]}>{stats.accepted}</Text>
          <Text style={styles.statLabel}>Accepted</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.secondary }]}>{stats.inProgress}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
      </View>

      {/* Search & Filter */}
      <View style={styles.filterContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search leads..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={COLORS.gray[400]}
        />
        
        <View style={styles.filterButtons}>
          {['ALL', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                statusFilter === status && styles.filterButtonActive,
              ]}
              onPress={() => setStatusFilter(status as FilterStatus)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  statusFilter === status && styles.filterButtonTextActive,
                ]}
              >
                {status.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Leads List */}
      <FlatList
        data={filteredLeads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <LeadCardMobile
            lead={item}
            onAccept={handleAcceptLead}
            onReject={handleRejectLead}
            onPress={handleLeadPress}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery || statusFilter !== 'ALL'
                ? 'No leads match your filters'
                : 'No leads assigned yet'}
            </Text>
          </View>
        }
      />

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Lead</Text>
            
            <Text style={styles.modalLabel}>
              Rejection Reason <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.modalTextArea}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Minimum 10 characters required..."
              placeholderTextColor={COLORS.gray[400]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>
              {rejectReason.length}/10 characters minimum
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowRejectModal(false)}
                disabled={actionLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalRejectButton]}
                onPress={submitRejection}
                disabled={actionLoading || rejectReason.length < 10}
              >
                <Text style={styles.modalRejectText}>
                  {actionLoading ? 'Rejecting...' : 'Reject Lead'}
                </Text>
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
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[600],
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  backButton: {
    marginBottom: SPACING.sm,
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[600],
    marginTop: 4,
  },
  filterContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  searchInput: {
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    marginBottom: SPACING.sm,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  filterButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.gray[100],
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[700],
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: COLORS.white,
  },
  listContent: {
    padding: SPACING.md,
  },
  emptyContainer: {
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
  },
  modalLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  required: {
    color: COLORS.danger,
  },
  modalTextArea: {
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    minHeight: 100,
    marginBottom: SPACING.xs,
  },
  charCount: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[600],
    marginBottom: SPACING.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modalButton: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: COLORS.gray[200],
  },
  modalRejectButton: {
    backgroundColor: COLORS.danger,
  },
  modalCancelText: {
    color: COLORS.gray[700],
    fontWeight: 'bold',
  },
  modalRejectText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
});
