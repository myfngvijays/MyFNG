import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useNavigation } from '@react-navigation/native';

interface Lead {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  vehicle_number: string;
  service_type: string;
  status: string;
  estimated_amount: number;
  created_at: string;
  sla_state: string;
  priority: string;
}

export default function LeadsListScreen() {
  const navigation = useNavigation<any>();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [workshopId, setWorkshopId] = useState<string | null>(null);

  const [stats, setStats] = useState({
    pending: 0,
    accepted: 0,
    inProgress: 0,
    completed: 0,
  });

  useEffect(() => {
    fetchWorkshopId();
  }, []);

  useEffect(() => {
    if (workshopId) {
      fetchLeads();
    }
  }, [workshopId]);

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
    filterLeads();
  }, [leads, searchQuery, activeFilter]);

  const fetchWorkshopId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      if (userProfile?.workshop_id) {
        setWorkshopId(userProfile.workshop_id);
      }
    } catch (error) {
      console.error('Error fetching workshop ID:', error);
    }
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);

      if (!workshopId) return;

      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', workshopId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLeads(data || []);

      // Calculate stats
      const pending = data?.filter(l => l.status === 'ASSIGNED').length || 0;
      const accepted = data?.filter(l => l.status === 'ACCEPTED').length || 0;
      const inProgress = data?.filter(l => l.status === 'IN_PROGRESS').length || 0;
      const completed = data?.filter(l => l.status === 'COMPLETED').length || 0;

      setStats({ pending, accepted, inProgress, completed });
    } catch (error) {
      console.error('Error fetching leads:', error);
      Alert.alert('Error', 'Failed to load leads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterLeads = () => {
    let filtered = [...leads];

    // Apply status filter
    if (activeFilter !== 'ALL') {
      filtered = filtered.filter(lead => lead.status === activeFilter);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        lead =>
          lead.lead_number?.toLowerCase().includes(query) ||
          lead.customer_name?.toLowerCase().includes(query) ||
          lead.customer_phone?.includes(query) ||
          lead.vehicle_number?.toLowerCase().includes(query)
      );
    }

    setFilteredLeads(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeads();
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

  const getSLAColor = (slaState: string) => {
    const colors: any = {
      SAFE: '#10b981',
      AT_RISK: '#f59e0b',
      BREACHED: '#ef4444',
    };
    return colors[slaState] || '#6b7280';
  };

  const handleAcceptLead = async (leadId: string) => {
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
      fetchLeads();
    } catch (error) {
      console.error('Error accepting lead:', error);
      Alert.alert('Error', 'Failed to accept lead');
    }
  };

  const handleRejectLead = (leadId: string) => {
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
              fetchLeads();
            } catch (error) {
              console.error('Error rejecting lead:', error);
              Alert.alert('Error', 'Failed to reject lead');
            }
          },
        },
      ]
    );
  };

  const renderLeadCard = ({ item }: { item: Lead }) => (
    <TouchableOpacity
      style={styles.leadCard}
      onPress={() => navigation.navigate('WorkshopAdminLeadDetail' as never, { leadId: item.id } as never)}
    >
      <View style={styles.leadHeader}>
        <View>
          <Text style={styles.leadNumber} numberOfLines={1}>{item.customer_name || 'Customer'}</Text>
          <Text style={styles.customerName}>{item.vehicle_number}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.leadInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Vehicle:</Text>
          <Text style={styles.value}>{item.vehicle_number}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Service:</Text>
          <Text style={styles.value}>{item.service_type}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Amount:</Text>
          <Text style={styles.value}>₹{item.estimated_amount?.toLocaleString()}</Text>
        </View>
      </View>

      {item.sla_state && item.sla_state !== 'SAFE' && (
        <View style={[styles.slaWarning, { backgroundColor: getSLAColor(item.sla_state) + '20' }]}>
          <Text style={[styles.slaText, { color: getSLAColor(item.sla_state) }]}>
            SLA {item.sla_state}
          </Text>
        </View>
      )}

      {item.priority === 'URGENT' && (
        <View style={styles.urgentBadge}>
          <Text style={styles.urgentText}>🚨 URGENT</Text>
        </View>
      )}

      {item.status === 'ASSIGNED' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAcceptLead(item.id)}
          >
            <Text style={styles.buttonText}>✓ Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => handleRejectLead(item.id)}
          >
            <Text style={styles.buttonText}>✕ Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  const filters = [
    { label: 'All', value: 'ALL', count: leads.length },
    { label: 'Pending', value: 'ASSIGNED', count: stats.pending },
    { label: 'Accepted', value: 'ACCEPTED', count: stats.accepted },
    { label: 'In Progress', value: 'IN_PROGRESS', count: stats.inProgress },
    { label: 'Completed', value: 'COMPLETED', count: stats.completed },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#004AAD" />
          <Text style={styles.loadingText}>Loading leads...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Leads</Text>
        <Text style={styles.subtitle}>{filteredLeads.length} leads</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
          <Text style={styles.statValue}>{stats.accepted}</Text>
          <Text style={styles.statLabel}>Accepted</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#ede9fe' }]}>
          <Text style={styles.statValue}>{stats.inProgress}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
          <Text style={styles.statValue}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search leads..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        {filters.map(filter => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterChip,
              activeFilter === filter.value && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(filter.value)}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === filter.value && styles.filterTextActive,
              ]}
            >
              {filter.label} ({filter.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Leads List */}
      <FlatList
        data={filteredLeads}
        renderItem={renderLeadCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#004AAD']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No leads found</Text>
            <Text style={styles.emptySubtext}>Leads will appear here when assigned</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
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
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#023D95',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#004AAD',
    borderColor: '#004AAD',
  },
  filterText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
  },
  leadCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  leadNumber: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  customerName: {
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
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  leadInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    color: '#6b7280',
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  slaWarning: {
    marginTop: 12,
    padding: 8,
    borderRadius: 8,
  },
  slaText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  urgentBadge: {
    marginTop: 8,
    backgroundColor: '#fee2e2',
    padding: 6,
    borderRadius: 6,
  },
  urgentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
});

