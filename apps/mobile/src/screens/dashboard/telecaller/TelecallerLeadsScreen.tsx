import React, { useState, useEffect } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Linking,
  Modal,
  BackHandler
} from 'react-native';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Removed - using emojis
import { Icon } from '../../../components/Icon';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SPACING } from '../../../constants/theme';

export default function TelecallerLeadsScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const filterParam = route.params?.filter || 'all';
  
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState(filterParam);
  const [showPhone, setShowPhone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchLeads();
  }, [activeFilter]);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true; // Prevent default behavior
      }
      return false;
    });

    return () => backHandler.remove();
  }, [navigation]);

  const fetchLeads = async () => {
    try {
      if (!user) return;

      const { data: profile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      const teleCallerId = profile?.id;

      let query = supabase
        .from('service_leads')
        .select('*, workshop:workshops(name)');

      // Apply filters
      switch (activeFilter) {
        case 'new':
          query = query
            .or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId}`)
            .eq('status', 'NEW')
            .is('last_call_at', null);
          break;
        case 'callback':
          query = query
            .eq('assigned_telecaller_id', teleCallerId)
            .eq('follow_up_required', true)
            .lte('next_follow_up_at', new Date().toISOString());
          break;
        case 'incomplete':
          query = query
            .or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId}`)
            .eq('is_incomplete', true);
          break;
        case 'follow_up':
          query = query
            .eq('assigned_telecaller_id', teleCallerId)
            .eq('follow_up_required', true);
          break;
        default:
          query = query.or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId},created_by_id.eq.${teleCallerId}`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLeads(data || []);
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

  const filteredLeads = leads.filter(lead => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      lead.customer_name?.toLowerCase().includes(search) ||
      lead.customer_phone?.includes(search) ||
      lead.lead_number?.toLowerCase().includes(search) ||
      lead.vehicle_number?.toLowerCase().includes(search)
    );
  });

  const togglePhoneVisibility = (leadId: string) => {
    setShowPhone(prev => ({ ...prev, [leadId]: !prev[leadId] }));
  };

  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 4) return phone;
    return phone.slice(0, 2) + '****' + phone.slice(-2);
  };

  const makeCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const renderLeadCard = ({ item }: { item: any }) => (
    <View style={styles.leadCard}>
      {/* Header */}
      <View style={styles.leadHeader}>
        <View style={styles.leadHeaderLeft}>
          <Text style={styles.leadName}>{item.customer_name || 'Unknown'}</Text>
          <Text style={styles.leadNumber}>{item.lead_number}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      {/* Badges */}
      <View style={styles.badgesRow}>
        {item.is_incomplete && (
          <View style={[styles.badge, { backgroundColor: COLORS.yellow + '30' }]}>
            <Icon name="alert-circle" size={12} color={COLORS.yellow} />
            <Text style={[styles.badgeText, { color: COLORS.yellow }]}>Incomplete</Text>
          </View>
        )}
        {item.follow_up_required && (
          <View style={[styles.badge, { backgroundColor: COLORS.purple + '30' }]}>
            <Icon name="calendar-clock" size={12} color={COLORS.purple} />
            <Text style={[styles.badgeText, { color: COLORS.purple }]}>Follow-up</Text>
          </View>
        )}
      </View>

      {/* Contact Info */}
      <View style={styles.infoRow}>
        <Icon name="phone" size={16} color={COLORS.textSecondary} />
        <Text style={styles.infoText}>
          {showPhone[item.id] ? item.customer_phone : maskPhone(item.customer_phone)}
        </Text>
        <TouchableOpacity onPress={() => togglePhoneVisibility(item.id)}>
          <Text style={styles.showHideText}>{showPhone[item.id] ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoRow}>
        <Icon name="car" size={16} color={COLORS.textSecondary} />
        <Text style={styles.infoText}>
          {item.vehicle_make || 'N/A'} {item.vehicle_model || ''}
          {item.vehicle_number ? ` (${item.vehicle_number})` : ''}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Icon name="map-marker" size={16} color={COLORS.textSecondary} />
        <Text style={styles.infoText}>{item.city || 'N/A'}</Text>
      </View>

      {/* Service Type */}
      {item.service_type && (
        <View style={styles.infoRow}>
          <Icon name="wrench" size={16} color={COLORS.textSecondary} />
          <Text style={styles.infoText}>{item.service_type}</Text>
        </View>
      )}

      {/* Last Call / Follow-up Time */}
      {(item.last_call_at || item.next_follow_up_at) && (
        <View style={styles.timeInfo}>
          {item.last_call_at && (
            <Text style={styles.timeText}>
              Last call: {formatDateTime(item.last_call_at)}
            </Text>
          )}
          {item.next_follow_up_at && (
            <Text style={[styles.timeText, { color: COLORS.purple }]}>
              Next follow-up: {formatDateTime(item.next_follow_up_at)}
            </Text>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={() => makeCall(item.customer_phone)}
        >
          <Icon name="phone" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Call Now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => navigation.navigate('TelecallerLeadDetail', { leadId: item.id })}
        >
          <Icon name="eye" size={18} color={COLORS.primary} />
          <Text style={styles.secondaryButtonText}>View</Text>
        </TouchableOpacity>

        {item.is_incomplete && (
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => navigation.navigate('TelecallerCreateLead', { editLeadId: item.id })}
          >
            <Icon name="pencil" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Footer */}
      {item.total_calls > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>Total Calls: {item.total_calls}</Text>
          <Text style={styles.footerText}>Source: {item.created_from || 'Unknown'}</Text>
        </View>
      )}
    </View>
  );

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
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation?.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leads Queue</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, phone, lead number..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersContainer}>
        <FilterChip
          label="All"
          active={activeFilter === 'all'}
          onPress={() => setActiveFilter('all')}
        />
        <FilterChip
          label="New"
          active={activeFilter === 'new'}
          onPress={() => setActiveFilter('new')}
          color={COLORS.blue}
        />
        <FilterChip
          label="Callback"
          active={activeFilter === 'callback'}
          onPress={() => setActiveFilter('callback')}
          color={COLORS.orange}
        />
        <FilterChip
          label="Incomplete"
          active={activeFilter === 'incomplete'}
          onPress={() => setActiveFilter('incomplete')}
          color={COLORS.yellow}
        />
        <FilterChip
          label="Follow-up"
          active={activeFilter === 'follow_up'}
          onPress={() => setActiveFilter('follow_up')}
          color={COLORS.purple}
        />
      </View>

      {/* Leads List */}
      <FlatList
        data={filteredLeads}
        renderItem={renderLeadCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="phone-off" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No leads found</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('TelecallerCreateLead')}
      >
        <Icon name="plus" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
}

function FilterChip({ label, active, onPress, color = COLORS.gray }: FilterChipProps) {
  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        active && { backgroundColor: color },
      ]}
      onPress={onPress}
    >
      <Text style={[
        styles.filterChipText,
        active && styles.filterChipTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'NEW': return COLORS.blue + '30';
    case 'ASSIGNED': return COLORS.indigo + '30';
    case 'ACCEPTED': return COLORS.green + '30';
    case 'REJECTED': return COLORS.red + '30';
    default: return COLORS.gray + '30';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    backgroundColor: COLORS.gray + '30',
    marginRight: SPACING.xs,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: '#fff',
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
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  leadHeaderLeft: {
    flex: 1,
  },
  leadName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  leadNumber: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
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
  badgesRow: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: SPACING.xs,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    flex: 1,
  },
  showHideText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  timeInfo: {
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray + '30',
  },
  timeText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: SPACING.xs,
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: COLORS.primary + '20',
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: SPACING.xs,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray + '30',
  },
  footerText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});

