import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

interface Workshop {
  id: string;
  name: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  is_verified: boolean;
  audit_score: number;
  created_at: string;
}

export default function WorkshopsManagementScreen({ navigation }: any) {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [filteredWorkshops, setFilteredWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'VERIFIED' | 'UNVERIFIED'>('ALL');

  useEffect(() => {
    fetchWorkshops();
  }, []);

  useEffect(() => {
    filterWorkshops();
  }, [workshops, searchQuery, filterStatus]);

  async function fetchWorkshops() {
    try {
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkshops(data || []);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching workshops:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }

  function filterWorkshops() {
    let filtered = [...workshops];

    if (searchQuery) {
      filtered = filtered.filter(
        (ws) =>
          ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ws.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ws.state.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterStatus === 'VERIFIED') {
      filtered = filtered.filter((ws) => ws.is_verified);
    } else if (filterStatus === 'UNVERIFIED') {
      filtered = filtered.filter((ws) => !ws.is_verified);
    }

    setFilteredWorkshops(filtered);
  }

  function onRefresh() {
    setRefreshing(true);
    fetchWorkshops();
  }

  function getScoreColor(score: number) {
    if (score >= 4.5) return '#10b981';
    if (score >= 4.0) return '#84cc16';
    if (score >= 3.5) return '#f59e0b';
    return '#ef4444';
  }

  function renderWorkshop({ item }: { item: Workshop }) {
    return (
      <TouchableOpacity
        style={styles.workshopCard}
        onPress={() => navigation.navigate('WorkshopDetail', { workshopId: item.id })}
      >
        <View style={styles.workshopHeader}>
          <View style={styles.workshopInfo}>
            <Text style={styles.workshopName}>{item.name}</Text>
            <Text style={styles.workshopLocation}>
              {item.city}, {item.state}
            </Text>
          </View>
          <View style={[
            styles.verificationBadge,
            { backgroundColor: item.is_verified ? '#10b981' : '#f59e0b' }
          ]}>
            <Text style={styles.verificationText}>
              {item.is_verified ? '✓ Verified' : '⏳ Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.workshopDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone:</Text>
            <Text style={styles.detailValue}>{item.phone}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email:</Text>
            <Text style={styles.detailValue}>{item.email}</Text>
          </View>
        </View>

        {item.audit_score > 0 && (
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Audit Score:</Text>
            <View style={[
              styles.scoreBadge,
              { backgroundColor: getScoreColor(item.audit_score) }
            ]}>
              <Text style={styles.scoreText}>
                ⭐ {item.audit_score.toFixed(1)}/5.0
              </Text>
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton]}
            onPress={() => navigation.navigate('WorkshopDetail', { workshopId: item.id })}
          >
            <Text style={styles.actionText}>View Details</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => navigation.navigate('EditWorkshop', { workshopId: item.id })}
          >
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.createdDate}>
          Added: {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </TouchableOpacity>
    );
  }

  const stats = {
    total: workshops.length,
    verified: workshops.filter(w => w.is_verified).length,
    unverified: workshops.filter(w => !w.is_verified).length,
    avgScore: workshops.length > 0
      ? (workshops.reduce((sum, w) => sum + (w.audit_score || 0), 0) / workshops.length).toFixed(1)
      : '0.0',
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Workshops</Text>
        <Text style={styles.subtitle}>{filteredWorkshops.length} workshops</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search workshops..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterButtons}>
        {(['ALL', 'VERIFIED', 'UNVERIFIED'] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              filterStatus === status && styles.filterButtonActive,
            ]}
            onPress={() => setFilterStatus(status)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterStatus === status && styles.filterButtonTextActive,
              ]}
            >
              {status}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.verified}</Text>
          <Text style={styles.statLabel}>Verified</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.unverified}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#8b5cf6' }]}>⭐ {stats.avgScore}</Text>
          <Text style={styles.statLabel}>Avg Score</Text>
        </View>
      </View>

      {/* Workshops List */}
      <FlatList
        data={filteredWorkshops}
        keyExtractor={(item) => item.id}
        renderItem={renderWorkshop}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No workshops found</Text>
          </View>
        }
      />

      {/* Add Workshop FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateWorkshop')}
      >
        <Text style={styles.fabText}>+ Add Workshop</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    padding: 16,
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
    backgroundColor: '#fff',
  },
  searchInput: {
    height: 44,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  filterButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
  },
  workshopCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  workshopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  workshopInfo: {
    flex: 1,
  },
  workshopName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  workshopLocation: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  verificationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  verificationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  workshopDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6b7280',
    width: 60,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginRight: 12,
  },
  scoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButton: {
    backgroundColor: '#2563eb',
  },
  editButton: {
    backgroundColor: '#8b5cf6',
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  createdDate: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'right',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
  },
});

