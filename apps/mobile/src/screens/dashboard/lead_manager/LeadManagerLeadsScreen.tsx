import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  BackHandler
} from 'react-native';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Removed - using emojis
import { Icon } from '../../../components/Icon';
import { supabase } from '../../../lib/supabase';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

export default function LeadManagerLeadsScreen({ navigation, route }: any) {
  const filterParam = route.params?.filter || 'all';
  
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState(filterParam);
  const [sortBy, setSortBy] = useState<'priority' | 'sla' | 'created'>('priority');
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [sourceChip, setSourceChip] = useState('ALL');
  const [couponChip, setCouponChip] = useState('ALL');
  const [dateChip, setDateChip] = useState('last_7_days');

  const filters = [
    { value: 'all', label: 'All', icon: 'format-list-bulleted' },
    { value: 'NEW', label: 'New', icon: 'new-box' },
    { value: 'INCOMPLETE', label: 'Incomplete', icon: 'clipboard-alert' },
    { value: 'NEED_ASSIGNMENT', label: 'Need Assignment', icon: 'hand-pointing-right' },
    { value: 'WORKSHOP_REJECTED', label: 'Rejected', icon: 'close-circle' },
    { value: 'TELECALLER_PENDING', label: 'Tel. Pending', icon: 'phone-forward' },
    { value: 'SLA_AT_RISK', label: 'SLA Risk', icon: 'clock-alert' },
    { value: 'SLA_BREACHED', label: 'SLA Breach', icon: 'alert-circle' },
  ];

  useEffect(() => {
    fetchLeads();
  }, [activeFilter, sortBy, sourceChip, couponChip, dateChip]);

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

  const fetchLeads = async () => {
    try {
      const params = new URLSearchParams({ limit: '100', page: '1' });
      if (searchTerm.trim()) params.set('q', searchTerm.trim());
      if (sourceChip !== 'ALL') params.set('source', sourceChip);
      if (couponChip !== 'ALL') params.set('has_coupon', couponChip);
      if (activeFilter === 'NEW') params.set('filter', 'new');
      else if (activeFilter === 'INCOMPLETE') params.set('filter', 'incomplete');
      else if (activeFilter === 'WORKSHOP_REJECTED') params.set('filter', 'lost');
      else if (activeFilter === 'TELECALLER_PENDING') params.set('filter', 'follow_up');
      if (dateChip !== 'all_time') {
        const end = new Date();
        const start = new Date();
        if (dateChip === 'today') start.setHours(0, 0, 0, 0);
        else if (dateChip === 'last_7_days') start.setDate(start.getDate() - 6);
        else if (dateChip === 'last_30_days') start.setDate(start.getDate() - 29);
        params.set('from', start.toISOString());
        params.set('to', end.toISOString());
      }
      const data = await apiFetch<any>(`/api/telecaller/crm/leads?${params.toString()}`);
      setLeads(Array.isArray(data?.leads) ? data.leads : []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeads();
  };

  const handleLeadAction = (lead: any, action: string) => {
    setSelectedLead(lead);
    setShowActionsModal(false);

    switch (action) {
      case 'VIEW':
        navigation.navigate('LeadManagerLeadDetail', { leadId: lead.id });
        break;
      case 'ASSIGN':
        navigation.navigate('LeadManagerAssignWorkshop', { leadId: lead.id });
        break;
      case 'COMPLETE':
        handleCompleteInformation(lead);
        break;
      case 'SEND_TO_TELECALLER':
        handleSendToTelecaller(lead);
        break;
      case 'REASSIGN':
        handleReassign(lead);
        break;
      case 'ESCALATE':
        handleEscalate(lead);
        break;
      case 'CANCEL':
        handleCancel(lead);
        break;
    }
  };

  const handleCompleteInformation = async (lead: any) => {
    // Navigate to edit mode
    navigation.navigate('LeadManagerLeadDetail', { leadId: lead.id, mode: 'edit' });
  };

  const handleSendToTelecaller = async (lead: any) => {
    Alert.alert(
      'Send to Telecaller',
      'Assign this lead to a telecaller for follow-up?',
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
                .eq('id', lead.id);

              if (!error) {
                Alert.alert('Success', 'Lead sent to telecaller');
                fetchLeads();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to send lead');
            }
          }
        }
      ]
    );
  };

  const handleReassign = async (lead: any) => {
    navigation.navigate('LeadManagerAssignWorkshop', { leadId: lead.id, mode: 'reassign' });
  };

  const handleEscalate = async (lead: any) => {
    Alert.alert(
      'Escalate Lead',
      'Mark this lead as escalated and notify Super Admin?',
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
                .eq('id', lead.id);

              if (!error) {
                Alert.alert('Escalated', 'Lead has been escalated to Super Admin');
                fetchLeads();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to escalate lead');
            }
          }
        }
      ]
    );
  };

  const handleCancel = async (lead: any) => {
    Alert.alert(
      'Cancel Lead',
      'Are you sure you want to cancel this lead? This requires admin approval.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('service_leads')
                .update({
                  status: 'CANCELLED',
                  deleted_at: new Date().toISOString()
                })
                .eq('id', lead.id);

              if (!error) {
                Alert.alert('Cancelled', 'Lead has been cancelled');
                fetchLeads();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel lead');
            }
          }
        }
      ]
    );
  };

  const getSLAColor = (lead: any) => {
    if (lead.sla_state === 'BREACHED') return COLORS.red;
    if (lead.sla_state === 'AT_RISK') return COLORS.orange;
    return COLORS.green;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return COLORS.red;
      case 'HIGH': return COLORS.orange;
      case 'NORMAL': return COLORS.blue;
      default: return COLORS.gray[500];
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return COLORS.blue;
      case 'ASSIGNED': return COLORS.indigo;
      case 'ACCEPTED': return COLORS.green;
      case 'REJECTED': return COLORS.red;
      case 'IN_PROGRESS': return COLORS.orange;
      case 'FOLLOW_UP': return COLORS.purple;
      default: return COLORS.gray[500];
    }
  };

  const renderLeadCard = ({ item }: { item: any }) => {
    const slaColor = getSLAColor(item);
    const priorityColor = getPriorityColor(item.lead_priority || 'NORMAL');
    const statusColor = getStatusColor(item.status);
    const canAssign = item.status === 'VALIDATED' || item.status === 'ASSIGNED_TO_WORKSHOP';

    return (
      <TouchableOpacity
        style={[
          styles.leadCard,
          item.sla_state === 'BREACHED' && styles.leadCardBreached
        ]}
        onPress={() => handleLeadAction(item, 'VIEW')}
      >
        {/* Header Row */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.leadHeaderRow}>
              <Text style={styles.leadNumber}>#{item.lead_number}</Text>
              {item.reopen_count > 0 && (
                <View style={styles.reopenBadge}>
                  <Icon name="refresh-circle" size={14} color={COLORS.red} />
                  <Text style={styles.reopenText}>Reopened ({item.reopen_count})</Text>
                </View>
              )}
            </View>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            <Text style={styles.customerPhone}>{item.customer_phone}</Text>
          </View>
          
          {/* Priority Badge */}
          <View style={[styles.priorityBadge, { backgroundColor: priorityColor + '20' }]}>
            <Icon name="priority-high" size={16} color={priorityColor} />
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {item.lead_priority || 'NORMAL'}
            </Text>
          </View>
        </View>

        {/* Info Row */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Icon name="map-marker" size={14} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>{item.city_info?.name || item.city || 'N/A'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="car" size={14} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>{item.vehicle_model || 'N/A'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="source-branch" size={14} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>{item.created_from || 'N/A'}</Text>
          </View>
        </View>

        {/* Workshop Assignment */}
        {item.workshop ? (
          <View style={styles.workshopRow}>
            <Icon name="store" size={16} color={COLORS.primary} />
            <Text style={styles.workshopText}>{item.workshop.name}</Text>
          </View>
        ) : (
          <View style={[styles.workshopRow, { backgroundColor: COLORS.orange + '15' }]}>
            <Icon name="alert" size={16} color={COLORS.orange} />
            <Text style={[styles.workshopText, { color: COLORS.orange }]}>Not Assigned</Text>
          </View>
        )}

        {/* SLA & Status Row */}
        <View style={styles.bottomRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
          
          {item.sla_expires_at && (
            <View style={[styles.slaBadge, { backgroundColor: slaColor + '20' }]}>
              <Icon name="clock-outline" size={14} color={slaColor} />
              <Text style={[styles.slaText, { color: slaColor }]}>
                {item.sla_state || 'ON_TRACK'}
              </Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => handleLeadAction(item, 'VIEW')}
          >
            <Icon name="eye" size={18} color={COLORS.primary} />
            <Text style={styles.quickActionText}>View</Text>
          </TouchableOpacity>

          {!item.workshop_id && canAssign && (
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => handleLeadAction(item, 'ASSIGN')}
            >
              <Icon name="account-arrow-right" size={18} color={COLORS.green} />
              <Text style={styles.quickActionText}>Assign</Text>
            </TouchableOpacity>
          )}

          {item.is_incomplete && (
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => handleLeadAction(item, 'COMPLETE')}
            >
              <Icon name="clipboard-check" size={18} color={COLORS.orange} />
              <Text style={styles.quickActionText}>Complete</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => {
              setSelectedLead(item);
              setShowActionsModal(true);
            }}
          >
            <Icon name="dots-horizontal" size={18} color={COLORS.gray} />
            <Text style={styles.quickActionText}>More</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading leads...</Text>
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
        <Text style={styles.headerTitle}>Lead Management</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Icon name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search leads..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          onSubmitEditing={() => fetchLeads()}
          returnKeyType="search"
          placeholderTextColor={COLORS.textSecondary}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <Icon name="close-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {(
        [
          { value: dateChip, set: setDateChip, opts: [
            { id: 'today', label: 'Today' },
            { id: 'last_7_days', label: '7 days' },
            { id: 'last_30_days', label: '30 days' },
            { id: 'all_time', label: 'All time' },
          ] },
          { value: sourceChip, set: setSourceChip, opts: [
            { id: 'ALL', label: 'All sources' },
            { id: 'APP', label: 'App' },
            { id: 'WEBSITE', label: 'Website' },
            { id: 'MISA', label: 'MISA' },
            { id: 'GOOGLE', label: 'Google' },
            { id: 'META', label: 'Meta' },
          ] },
          { value: couponChip, set: setCouponChip, opts: [
            { id: 'ALL', label: 'All discounts' },
            { id: 'YES', label: 'Any discount' },
            { id: 'PROMO', label: 'Promo' },
            { id: 'REFERRAL', label: 'Refer & Rise' },
            { id: 'NO', label: 'No discount' },
          ] },
        ] as const
      ).map((group, idx) => (
        <View key={idx} style={styles.bookingFilterRow}>
          {group.opts.map((opt) => {
            const on = group.value === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.bookingChip, on && styles.bookingChipOn]}
                onPress={() => group.set(opt.id as any)}
              >
                <Text style={[styles.bookingChipTxt, on && styles.bookingChipTxtOn]} numberOfLines={1}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={filters}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterTab,
                activeFilter === item.value && styles.filterTabActive
              ]}
              onPress={() => setActiveFilter(item.value)}
            >
              <Icon
                name={item.icon as any}
                size={16}
                color={activeFilter === item.value ? '#fff' : COLORS.textSecondary}
              />
              <Text
                style={[
                  styles.filterText,
                  activeFilter === item.value && styles.filterTextActive
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.value}
        />
      </View>

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <TouchableOpacity
          style={[styles.sortBtn, sortBy === 'priority' && styles.sortBtnActive]}
          onPress={() => setSortBy('priority')}
        >
          <Text style={[styles.sortText, sortBy === 'priority' && styles.sortTextActive]}>Priority</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortBtn, sortBy === 'sla' && styles.sortBtnActive]}
          onPress={() => setSortBy('sla')}
        >
          <Text style={[styles.sortText, sortBy === 'sla' && styles.sortTextActive]}>SLA</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortBtn, sortBy === 'created' && styles.sortBtnActive]}
          onPress={() => setSortBy('created')}
        >
          <Text style={[styles.sortText, sortBy === 'created' && styles.sortTextActive]}>Latest</Text>
        </TouchableOpacity>
      </View>

      {/* Results Count */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsText}>{leads.length} leads found</Text>
      </View>

      {/* Leads List */}
      <FlatList
        data={leads}
        renderItem={renderLeadCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="inbox" size={64} color={COLORS.gray} />
            <Text style={styles.emptyTitle}>No Leads Found</Text>
            <Text style={styles.emptyText}>
              {searchTerm
                ? `No leads match "${searchTerm}"`
                : `No leads in ${activeFilter} filter`}
            </Text>
          </View>
        }
      />

      {/* Actions Modal */}
      <Modal
        visible={showActionsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActionsModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionsModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Lead Actions</Text>
            
            <TouchableOpacity
              style={styles.modalAction}
              onPress={() => handleLeadAction(selectedLead, 'SEND_TO_TELECALLER')}
            >
              <Icon name="phone-forward" size={24} color={COLORS.teal} />
              <Text style={styles.modalActionText}>Send to Telecaller</Text>
            </TouchableOpacity>

            {selectedLead?.workshop_id && (
              <TouchableOpacity
                style={styles.modalAction}
                onPress={() => handleLeadAction(selectedLead, 'REASSIGN')}
              >
                <Icon name="swap-horizontal" size={24} color={COLORS.blue} />
                <Text style={styles.modalActionText}>Reassign Workshop</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.modalAction}
              onPress={() => handleLeadAction(selectedLead, 'ESCALATE')}
            >
              <Icon name="alert-octagon" size={24} color={COLORS.orange} />
              <Text style={styles.modalActionText}>Escalate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalAction, styles.modalActionDanger]}
              onPress={() => handleLeadAction(selectedLead, 'CANCEL')}
            >
              <Icon name="close-circle" size={24} color={COLORS.red} />
              <Text style={[styles.modalActionText, { color: COLORS.red }]}>Cancel Lead</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowActionsModal(false)}
            >
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
    color: COLORS.textSecondary,
  },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    paddingTop: SPACING.xl,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginLeft: SPACING.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    elevation: 2,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray + '30',
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.background,
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  sortLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginRight: SPACING.xs,
  },
  sortBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 16,
    backgroundColor: COLORS.background,
  },
  sortBtnActive: {
    backgroundColor: COLORS.primary + '20',
  },
  sortText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  sortTextActive: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  resultsBar: {
    backgroundColor: '#fff',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray + '20',
  },
  resultsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  listContent: {
    padding: SPACING.md,
  },
  leadCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    elevation: 2,
  },
  leadCardBreached: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.red,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  leadHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  leadNumber: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  reopenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.red + '15',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  reopenText: {
    fontSize: 10,
    color: COLORS.red,
    fontWeight: 'bold',
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 2,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  workshopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    padding: SPACING.sm,
    borderRadius: 8,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  workshopText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
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
  slaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  slaText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  quickActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray + '20',
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    gap: 4,
  },
  quickActionText: {
    fontSize: 11,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  modalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  modalActionDanger: {
    backgroundColor: COLORS.red + '10',
  },
  modalActionText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  modalCancel: {
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  modalCancelText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  bookingFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingBottom: 6,
  },
  bookingChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  bookingChipOn: {
    backgroundColor: '#004AAD',
    borderColor: '#004AAD',
  },
  bookingChipTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  bookingChipTxtOn: {
    color: '#fff',
  },
});

