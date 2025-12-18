import React, { useState, useEffect } from 'react';
import {
import { formatDateDMY } from "@/lib/dateFormat";
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

export default function DMLeadsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_leads')
        .select('*, campaign:marketing_campaigns(name)')
        .not('source', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

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
      case 'COMPLETED':
        return COLORS.success;
      case 'IN_PROGRESS':
        return COLORS.primary;
      case 'PENDING':
        return COLORS.warning;
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
      <DashboardHeader title="Marketing Leads" onBack={() => navigation.goBack()} />
      
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

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {leads.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No marketing leads found</Text>
          </View>
        ) : (
          leads.map((lead, index) => (
            <View key={lead.id || index} style={styles.leadCard}>
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
              <Text style={styles.source}>Source: {lead.source || 'Unknown'}</Text>
              {lead.campaign?.name && (
                <Text style={styles.campaign}>Campaign: {lead.campaign.name}</Text>
              )}
              <Text style={styles.leadDate}>
                {formatDateDMY(lead.created_at)}
              </Text>
            </View>
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
  source: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  campaign: {
    fontSize: SIZES.sm,
    color: COLORS.info,
    marginBottom: SPACING.xs,
  },
  leadDate: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
});
