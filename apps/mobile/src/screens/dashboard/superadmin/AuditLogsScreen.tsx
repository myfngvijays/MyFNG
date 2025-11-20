import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

interface AuditLog {
  id: string;
  action: string;
  user_id: { full_name: string; role: string };
  entity_type: string;
  entity_id: string;
  changes: any;
  created_at: string;
  ip_address: string;
}

export default function AuditLogsScreen() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, searchQuery, activeFilter]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);

      // Mock audit log data
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          action: 'LEAD_CREATED',
          user_id: { full_name: 'John Doe', role: 'TELECALLER' },
          entity_type: 'LEAD',
          entity_id: 'lead-123',
          changes: { status: 'NEW' },
          created_at: new Date().toISOString(),
          ip_address: '192.168.1.1',
        },
        {
          id: '2',
          action: 'LEAD_ASSIGNED',
          user_id: { full_name: 'Jane Smith', role: 'LEAD_MANAGER' },
          entity_type: 'LEAD',
          entity_id: 'lead-123',
          changes: { workshop_id: 'workshop-456' },
          created_at: new Date(Date.now() - 3600000).toISOString(),
          ip_address: '192.168.1.2',
        },
        {
          id: '3',
          action: 'USER_CREATED',
          user_id: { full_name: 'Admin User', role: 'SUPER_ADMIN' },
          entity_type: 'USER',
          entity_id: 'user-789',
          changes: { role: 'MECHANIC' },
          created_at: new Date(Date.now() - 7200000).toISOString(),
          ip_address: '192.168.1.3',
        },
      ];

      setLogs(mockLogs);

    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    // Apply entity filter
    if (activeFilter !== 'ALL') {
      filtered = filtered.filter(log => log.entity_type === activeFilter);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        log =>
          log.action.toLowerCase().includes(query) ||
          log.user_id.full_name.toLowerCase().includes(query) ||
          log.entity_id.toLowerCase().includes(query)
      );
    }

    setFilteredLogs(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAuditLogs();
  };

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return '#10b981';
    if (action.includes('UPDATE')) return '#3b82f6';
    if (action.includes('DELETE')) return '#ef4444';
    if (action.includes('ASSIGN')) return '#8b5cf6';
    return '#6b7280';
  };

  const getActionIcon = (action: string) => {
    if (action.includes('CREATE')) return '➕';
    if (action.includes('UPDATE')) return '✏️';
    if (action.includes('DELETE')) return '🗑️';
    if (action.includes('ASSIGN')) return '👤';
    return '📝';
  };

  const renderLogCard = ({ item }: { item: AuditLog }) => (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        <View style={styles.actionContainer}>
          <Text style={styles.actionIcon}>{getActionIcon(item.action)}</Text>
          <View style={[styles.actionBadge, { backgroundColor: getActionColor(item.action) }]}>
            <Text style={styles.actionText}>{item.action.replace(/_/g, ' ')}</Text>
          </View>
        </View>
        <Text style={styles.logTime}>
          {new Date(item.created_at).toLocaleString()}
        </Text>
      </View>

      <View style={styles.logBody}>
        <View style={styles.logRow}>
          <Text style={styles.logLabel}>User:</Text>
          <Text style={styles.logValue}>
            {item.user_id.full_name} ({item.user_id.role})
          </Text>
        </View>
        <View style={styles.logRow}>
          <Text style={styles.logLabel}>Entity:</Text>
          <Text style={styles.logValue}>
            {item.entity_type} - {item.entity_id.slice(0, 12)}...
          </Text>
        </View>
        {item.ip_address && (
          <View style={styles.logRow}>
            <Text style={styles.logLabel}>IP:</Text>
            <Text style={styles.logValue}>{item.ip_address}</Text>
          </View>
        )}
      </View>

      {item.changes && Object.keys(item.changes).length > 0 && (
        <View style={styles.changesContainer}>
          <Text style={styles.changesLabel}>Changes:</Text>
          <View style={styles.changesContent}>
            {Object.entries(item.changes).map(([key, value]) => (
              <Text key={key} style={styles.changeText}>
                • {key}: {JSON.stringify(value)}
              </Text>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const filters = [
    { label: 'All', value: 'ALL' },
    { label: 'Leads', value: 'LEAD' },
    { label: 'Users', value: 'USER' },
    { label: 'Workshops', value: 'WORKSHOP' },
    { label: 'Jobs', value: 'JOB' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading audit logs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Audit Logs 📋</Text>
        <Text style={styles.subtitle}>{filteredLogs.length} entries</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search logs..."
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
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logs List */}
      <FlatList
        data={filteredLogs}
        renderItem={renderLogCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No audit logs found</Text>
            <Text style={styles.emptySubtext}>System activity will be logged here</Text>
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
  searchContainer: {
    padding: 16,
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
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
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
  logCard: {
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
  logHeader: {
    marginBottom: 12,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  actionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flex: 1,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  logTime: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'right',
  },
  logBody: {
    gap: 8,
    marginBottom: 12,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logLabel: {
    fontSize: 12,
    color: '#6b7280',
    width: 60,
  },
  logValue: {
    fontSize: 12,
    color: '#111827',
    flex: 1,
  },
  changesContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  changesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  changesContent: {
    gap: 4,
  },
  changeText: {
    fontSize: 11,
    color: '#6b7280',
    fontFamily: 'monospace',
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

