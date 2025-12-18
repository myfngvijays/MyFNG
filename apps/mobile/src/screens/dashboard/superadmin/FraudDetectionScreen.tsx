import React, { useState, useEffect } from 'react';
import {
import { formatDateTime } from "@/lib/dateFormat";
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

interface FraudAlert {
  id: string;
  alert_type: string;
  severity: string;
  description: string;
  entity_type: string;
  entity_id: string;
  detected_at: string;
  status: string;
  resolved_at: string;
}

export default function FraudDetectionScreen() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  const [stats, setStats] = useState({
    critical: 0,
    high: 0,
    medium: 0,
    resolved: 0,
  });

  useEffect(() => {
    fetchFraudAlerts();
  }, []);

  useEffect(() => {
    filterAlerts();
  }, [alerts, activeFilter]);

  const fetchFraudAlerts = async () => {
    try {
      setLoading(true);

      // Mock fraud detection data since table might not exist yet
      const mockAlerts: FraudAlert[] = [
        {
          id: '1',
          alert_type: 'DUPLICATE_LEAD',
          severity: 'HIGH',
          description: 'Same customer created multiple leads within 1 hour',
          entity_type: 'LEAD',
          entity_id: 'lead-123',
          detected_at: new Date().toISOString(),
          status: 'PENDING',
          resolved_at: '',
        },
        {
          id: '2',
          alert_type: 'PRICE_MANIPULATION',
          severity: 'CRITICAL',
          description: 'Lead amount changed significantly after acceptance',
          entity_type: 'LEAD',
          entity_id: 'lead-456',
          detected_at: new Date(Date.now() - 3600000).toISOString(),
          status: 'PENDING',
          resolved_at: '',
        },
        {
          id: '3',
          alert_type: 'SUSPICIOUS_WORKSHOP',
          severity: 'MEDIUM',
          description: 'Workshop has unusually high rejection rate (>50%)',
          entity_type: 'WORKSHOP',
          entity_id: 'workshop-789',
          detected_at: new Date(Date.now() - 7200000).toISOString(),
          status: 'INVESTIGATING',
          resolved_at: '',
        },
      ];

      setAlerts(mockAlerts);

      // Calculate stats
      const critical = mockAlerts.filter(a => a.severity === 'CRITICAL' && a.status !== 'RESOLVED').length;
      const high = mockAlerts.filter(a => a.severity === 'HIGH' && a.status !== 'RESOLVED').length;
      const medium = mockAlerts.filter(a => a.severity === 'MEDIUM' && a.status !== 'RESOLVED').length;
      const resolved = mockAlerts.filter(a => a.status === 'RESOLVED').length;

      setStats({ critical, high, medium, resolved });

    } catch (error) {
      console.error('Error fetching fraud alerts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterAlerts = () => {
    if (activeFilter === 'ALL') {
      setFilteredAlerts(alerts);
    } else {
      setFilteredAlerts(alerts.filter(a => a.severity === activeFilter || a.status === activeFilter));
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFraudAlerts();
  };

  const getSeverityColor = (severity: string) => {
    const colors: any = {
      CRITICAL: '#ef4444',
      HIGH: '#f59e0b',
      MEDIUM: '#3b82f6',
      LOW: '#10b981',
    };
    return colors[severity] || '#6b7280';
  };

  const handleResolve = async (alertId: string) => {
    Alert.alert(
      'Resolve Alert',
      'Mark this alert as resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: () => {
            // Update alert status
            setAlerts(prev => prev.map(a => 
              a.id === alertId 
                ? { ...a, status: 'RESOLVED', resolved_at: new Date().toISOString() }
                : a
            ));
            Alert.alert('Success', 'Alert marked as resolved');
          },
        },
      ]
    );
  };

  const renderAlertCard = ({ item }: { item: FraudAlert }) => (
    <View style={styles.alertCard}>
      <View style={styles.alertHeader}>
        <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(item.severity) }]}>
          <Text style={styles.severityText}>{item.severity}</Text>
        </View>
        <Text style={styles.alertTime}>
          {formatDateTime(item.detected_at)}
        </Text>
      </View>

      <Text style={styles.alertType}>{item.alert_type.replace(/_/g, ' ')}</Text>
      <Text style={styles.alertDescription}>{item.description}</Text>

      <View style={styles.alertMeta}>
        <Text style={styles.alertMetaText}>
          📍 {item.entity_type}: {item.entity_id.slice(0, 12)}...
        </Text>
      </View>

      <View style={[styles.statusTag, { 
        backgroundColor: item.status === 'RESOLVED' ? '#d1fae5' : '#fef3c7' 
      }]}>
        <Text style={[styles.statusText, { 
          color: item.status === 'RESOLVED' ? '#059669' : '#d97706' 
        }]}>
          {item.status}
        </Text>
      </View>

      {item.status !== 'RESOLVED' && (
        <View style={styles.alertActions}>
          <TouchableOpacity
            style={styles.investigateButton}
            onPress={() => Alert.alert('Info', 'Investigation tools coming soon')}
          >
            <Text style={styles.actionButtonText}>🔍 Investigate</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.resolveButton}
            onPress={() => handleResolve(item.id)}
          >
            <Text style={styles.actionButtonText}>✓ Resolve</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const filters = [
    { label: 'All', value: 'ALL' },
    { label: 'Critical', value: 'CRITICAL' },
    { label: 'High', value: 'HIGH' },
    { label: 'Medium', value: 'MEDIUM' },
    { label: 'Resolved', value: 'RESOLVED' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ef4444" />
          <Text style={styles.loadingText}>Loading fraud alerts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Fraud Detection 🚨</Text>
        <Text style={styles.subtitle}>{filteredAlerts.length} alerts</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
          <Text style={styles.statValue}>{stats.critical}</Text>
          <Text style={styles.statLabel}>Critical</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
          <Text style={styles.statValue}>{stats.high}</Text>
          <Text style={styles.statLabel}>High</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
          <Text style={styles.statValue}>{stats.medium}</Text>
          <Text style={styles.statLabel}>Medium</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
          <Text style={styles.statValue}>{stats.resolved}</Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </View>
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

      {/* Alerts List */}
      <FlatList
        data={filteredAlerts}
        renderItem={renderAlertCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ef4444']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>No fraud alerts</Text>
            <Text style={styles.emptySubtext}>All systems are secure</Text>
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
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
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
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  alertTime: {
    fontSize: 11,
    color: '#6b7280',
  },
  alertType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
  },
  alertDescription: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  alertMeta: {
    marginBottom: 12,
  },
  alertMetaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
  },
  investigateButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resolveButton: {
    flex: 1,
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
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

