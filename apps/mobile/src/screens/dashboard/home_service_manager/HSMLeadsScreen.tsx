import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function HSMLeadsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'assigned' | 'in_progress' | 'completed'>('all');

  useEffect(() => {
    fetchLeads();
  }, [filter]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('service_leads')
        .select('*, technician:users_login(full_name), van:service_vans(van_number)')
        .eq('service_type', 'HOME_SERVICE')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter.toUpperCase());
      }

      const { data, error } = await query;
      if (error) throw error;

      const filteredLeads = searchQuery
        ? (data || []).filter((lead: any) =>
            lead.lead_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lead.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : data || [];

      setLeads(filteredLeads);
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

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return COLORS.warning;
      case 'ASSIGNED':
        return COLORS.info;
      case 'IN_PROGRESS':
        return COLORS.primary;
      case 'COMPLETED':
        return COLORS.success;
      default:
        return COLORS.textSecondary;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading leads...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Home Service Leads" onBack={() => navigation.goBack()} />
      
      <View style={styles.headerActions}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search leads..."
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            fetchLeads();
          }}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      <View style={styles.filterContainer}>
        {(['all', 'pending', 'assigned', 'in_progress', 'completed'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterButton,
              filter === f && styles.filterButtonActive
            ]}
            onPress={() => setFilter(f)}
          >
            <Text style={[
              styles.filterButtonText,
              filter === f && styles.filterButtonTextActive
            ]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {leads.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No leads found</Text>
          </View>
        ) : (
          leads.map((lead, index) => (
            <TouchableOpacity
              key={lead.id || index}
              style={styles.leadCard}
              onPress={() => navigation.navigate('HSMLeadDetail', { leadId: lead.id })}
            >
              <View style={styles.leadHeader}>
                <Text style={styles.leadNumber}>{lead.lead_number}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(lead.status) }
                  ]}
                >
                  <Text style={styles.statusText}>{lead.status}</Text>
                </View>
              </View>
              
              <Text style={styles.customerName}>{lead.customer_name}</Text>
              <Text style={styles.customerPhone}>{lead.customer_phone}</Text>
              
              {lead.service_address && (
                <Text style={styles.address}>📍 {lead.service_address}</Text>
              )}
              
              {lead.technician && (
                <Text style={styles.technician}>👨‍🔧 {lead.technician.full_name}</Text>
              )}
              
              {lead.van && (
                <Text style={styles.van}>🚐 Van: {lead.van.van_number}</Text>
              )}
              
              <Text style={styles.leadDate}>
                {new Date(lead.created_at).toLocaleDateString()}
              </Text>
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
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
  },
  headerActions: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    fontSize: SIZES.sm,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: 8,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: SIZES.xs,
    color: COLORS.text,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
  },
  leadCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  leadNumber: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: SIZES.xs,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  customerName: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  customerPhone: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  address: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  technician: {
    fontSize: SIZES.sm,
    color: COLORS.info,
    marginBottom: SPACING.xs,
  },
  van: {
    fontSize: SIZES.sm,
    color: COLORS.info,
    marginBottom: SPACING.xs,
  },
  leadDate: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
});
