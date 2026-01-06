/**
 * Lead Manager Workshops List Screen - Mobile
 * View and manage all workshops
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

interface Workshop {
  id: string;
  name: string;
  city: string;
  contact_person: string;
  phone: string;
  email: string;
  is_verified: boolean;
  audit_score: number | null;
  total_leads?: number;
  active_jobs?: number;
}

export default function LeadManagerWorkshopsScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [filteredWorkshops, setFilteredWorkshops] = useState<Workshop[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'VERIFIED' | 'UNVERIFIED'>('ALL');

  useEffect(() => {
    fetchWorkshops();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [search, filter, workshops]);

  const fetchWorkshops = async () => {
    try {
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch additional stats for each workshop
      const workshopsWithStats = await Promise.all(
        (data || []).map(async (workshop) => {
          const { count: totalLeads } = await supabase
            .from('service_leads')
            .select('*', { count: 'exact', head: true })
            .eq('workshop_id', workshop.id);

          const { count: activeJobs } = await supabase
            .from('service_leads')
            .select('*', { count: 'exact', head: true })
            .eq('workshop_id', workshop.id)
            .in('status', ['ACCEPTED', 'IN_PROGRESS', 'TEAM_ASSIGNED']);

          return {
            ...workshop,
            total_leads: totalLeads || 0,
            active_jobs: activeJobs || 0,
          };
        })
      );

      setWorkshops(workshopsWithStats);
    } catch (error) {
      console.error('Error fetching workshops:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...workshops];

    // Apply verification filter
    if (filter === 'VERIFIED') {
      filtered = filtered.filter(w => w.is_verified);
    } else if (filter === 'UNVERIFIED') {
      filtered = filtered.filter(w => !w.is_verified);
    }

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        w =>
          w.name.toLowerCase().includes(searchLower) ||
          w.city.toLowerCase().includes(searchLower) ||
          w.contact_person.toLowerCase().includes(searchLower)
      );
    }

    setFilteredWorkshops(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchWorkshops();
  };

  const handleWorkshopPress = (workshop: Workshop) => {
    navigation.navigate('LeadManagerWorkshopDetail', { workshopId: workshop.id });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Loading workshops...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏢 Workshops</Text>
        <Text style={styles.headerSubtitle}>{workshops.length} total workshops</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, city, or contact..."
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'ALL' && styles.filterTabActive]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.filterText, filter === 'ALL' && styles.filterTextActive]}>
            All ({workshops.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'VERIFIED' && styles.filterTabActive]}
          onPress={() => setFilter('VERIFIED')}
        >
          <Text style={[styles.filterText, filter === 'VERIFIED' && styles.filterTextActive]}>
            Verified ({workshops.filter(w => w.is_verified).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'UNVERIFIED' && styles.filterTabActive]}
          onPress={() => setFilter('UNVERIFIED')}
        >
          <Text style={[styles.filterText, filter === 'UNVERIFIED' && styles.filterTextActive]}>
            Unverified ({workshops.filter(w => !w.is_verified).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Workshops List */}
      <ScrollView
        style={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredWorkshops.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No workshops found</Text>
            <Text style={styles.emptySubtext}>
              {search ? 'Try a different search term' : 'No workshops available'}
            </Text>
          </View>
        ) : (
          filteredWorkshops.map((workshop) => (
            <TouchableOpacity
              key={workshop.id}
              style={styles.workshopCard}
              onPress={() => handleWorkshopPress(workshop)}
            >
              {/* Header Row */}
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.workshopName} numberOfLines={1}>
                    {workshop.name}
                  </Text>
                  {workshop.is_verified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  )}
                </View>
                {workshop.audit_score !== null && (
                  <View style={styles.scoreBadge}>
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={styles.scoreText}>{workshop.audit_score}</Text>
                  </View>
                )}
              </View>

              {/* Info Row */}
              <View style={styles.infoRow}>
                <Ionicons name="location" size={16} color="#6B7280" />
                <Text style={styles.infoText}>{workshop.city}</Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="person" size={16} color="#6B7280" />
                <Text style={styles.infoText}>{workshop.contact_person}</Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="call" size={16} color="#6B7280" />
                <Text style={styles.infoText}>{workshop.phone}</Text>
              </View>

              {/* Stats Row */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{workshop.total_leads}</Text>
                  <Text style={styles.statLabel}>Total Jobs</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#10B981' }]}>
                    {workshop.active_jobs}
                  </Text>
                  <Text style={styles.statLabel}>Active Jobs</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <TouchableOpacity style={styles.viewButton}>
                    <Text style={styles.viewButtonText}>View Details</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FF6B00" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#FF6B00',
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFF',
    marginTop: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    margin: 15,
    marginBottom: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#1F2937',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginBottom: 15,
    gap: 10,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFF',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 5,
  },
  workshopCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workshopName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF6B00',
  },
});

