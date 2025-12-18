import React, { useState, useEffect } from 'react';
import {
import { formatDateDMY } from "@/lib/dateFormat";
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

interface Lead {
  id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  service_type: string;
  status: string;
  estimated_amount: number;
  created_at: string;
  workshop_id: { name: string } | null;
  sla_state: string;
  priority: string;
}

export default function LeadsManagementScreen() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    assigned: 0,
    completed: 0,
    slaBreached: 0,
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, searchQuery, activeFilter]);

  const fetchLeads = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('service_leads')
        .select('*, workshop_id(name)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setLeads(data || []);

      // Calculate stats
      const total = data?.length || 0;
      const newLeads = data?.filter(l => l.status === 'NEW').length || 0;
      const assigned = data?.filter(l => l.workshop_id !== null).length || 0;
      const completed = data?.filter(l => l.status === 'COMPLETED').length || 0;
      const slaBreached = data?.filter(l => l.sla_state === 'BREACHED').length || 0;

      setStats({ total, new: newLeads, assigned, completed, slaBreached });

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
      if (activeFilter === 'SLA_BREACHED') {
        filtered = filtered.filter(lead => lead.sla_state === 'BREACHED');
      } else if (activeFilter === 'ASSIGNED') {
        filtered = filtered.filter(lead => lead.workshop_id !== null);
      } else {
        filtered = filtered.filter(lead => lead.status === activeFilter);
      }
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        lead =>
          lead.lead_number?.toLowerCase().includes(query) ||
          lead.customer_name?.toLowerCase().includes(query) ||
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
      NEW: '#f59e0b',
      ASSIGNED: '#3b82f6',
      ACCEPTED: '#8b5cf6',
      IN_PROGRESS: '#10b981',
      COMPLETED: '#059669',
      REJECTED: '#ef4444',
      CANCELLED: '#6b7280',
    };
    return colors[status] || '#6b7280';
  };

  const renderLeadCard = ({ item }: { item: Lead }) => (
    <View style={styles.leadCard}>
      <View style={styles.leadHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.leadNumber}>#{item.lead_number}</Text>
          <Text style={styles.customerName}>{item.customer_name}</Text>
          <Text style={styles.vehicle}>{item.vehicle_number}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.leadInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Service:</Text>
          <Text style={styles.value}>{item.service_type}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Amount:</Text>
          <Text style={styles.value}>₹{item.estimated_amount?.toLocaleString()}</Text>
        </View>
        {item.workshop_id && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Workshop:</Text>
            <Text style={styles.value}>{item.workshop_id.name}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.label}>Created:</Text>
          <Text style={styles.value}>
            {formatDateDMY(item.created_at)}
          </Text>
        </View>
      </View>

      {item.sla_state && item.sla_state !== 'SAFE' && (
        <View style={[
          styles.slaWarning,
          { backgroundColor: item.sla_state === 'BREACHED' ? '#fee2e2' : '#fef3c7' }
        ]}>
          <Text style={[
            styles.slaText,
            { color: item.sla_state === 'BREACHED' ? '#dc2626' : '#d97706' }
          ]}>
            {item.sla_state === 'BREACHED' ? '🚨 SLA BREACHED' : '⚠️ SLA AT RISK'}
          </Text>
        </View>
      )}

      {item.priority === 'URGENT' && (
        <View style={styles.urgentBadge}>
          <Text style={styles.urgentText}>🚨 URGENT</Text>
        </View>
      )}
    </View>
  );

  const filters = [
    { label: 'All', value: 'ALL', count: stats.total },
    { label: 'New', value: 'NEW', count: stats.new },
    { label: 'Assigned', value: 'ASSIGNED', count: stats.assigned },
    { label: 'Completed', value: 'COMPLETED', count: stats.completed },
    { label: 'SLA Breached', value: 'SLA_BREACHED', count: stats.slaBreached },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading leads...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Leads Management 📊</Text>
        <Text style={styles.subtitle}>{filteredLeads.length} leads</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
          <Text style={styles.statValue}>{stats.new}</Text>
          <Text style={styles.statLabel}>New</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
          <Text style={styles.statValue}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
          <Text style={styles.statValue}>{stats.slaBreached}</Text>
          <Text style={styles.statLabel}>SLA</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No leads found</Text>
            <Text style={styles.emptySubtext}>Leads will appear here</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

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
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
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
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 10,
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
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterText: {
    fontSize: 11,
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
    borderRadius: 12,
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
    marginBottom: 2,
  },
  vehicle: {
    fontSize: 13,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    height: 28,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  leadInfo: {
    gap: 6,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
  },
  value: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
  },
  slaWarning: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
  },
  slaText: {
    fontSize: 11,
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
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
    textAlign: 'center',
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

