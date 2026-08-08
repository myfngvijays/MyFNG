import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, TextInput, RefreshControl } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

type EnquiryLead = {
  id: string;
  lead_number: string | null;
  lead_type: string;
  lead_status: string;
  lead_priority: string | null;
  lead_source: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  total_calls: number | null;
  next_follow_up_at: string | null;
  meta?: any;
};

export default function TelecallerEnquiryLeadsScreen({ navigation }: any) {
  const [leads, setLeads] = useState<EnquiryLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    setLoading(true);
    try {
      const data = await apiFetch<{ leads: EnquiryLead[] }>('/api/telecaller/enquiry-leads');
      setLeads(data.leads || []);
    } catch (e) {
      console.error('Failed to load enquiry leads', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeads();
  };

  const filteredLeads = leads.filter((lead) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      lead.customer_name?.toLowerCase().includes(search) ||
      lead.customer_phone?.includes(search) ||
      lead.lead_number?.toLowerCase().includes(search)
    );
  });

  const handleBack = () => {
    if (typeof navigation?.canGoBack === 'function' && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (typeof navigation?.goBack === 'function') {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.('TelecallerDashboard');
  };

  const renderItem = ({ item }: { item: EnquiryLead }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('TelecallerEnquiryLeadDetail', { leadId: item.id })}>
      <Text style={styles.cardTitle}>{item.lead_number || 'Lead'}</Text>
      <Text style={styles.cardMeta}>{item.customer_name || 'Customer'} • {item.customer_phone || '—'}</Text>
      <Text style={styles.cardMeta}>Type: {item.lead_type} • Priority: {item.lead_priority || 'NORMAL'}</Text>
      <Text style={styles.cardMeta}>Status: {item.lead_status}</Text>
      <Text style={styles.cardMeta}>Coupon: {item?.meta?.coupon?.code || '—'}</Text>
      <Text style={styles.cardMeta}>Calls: {item.total_calls ?? 0}</Text>
      <Text style={styles.cardMeta}>
        Next Follow-up: {item.next_follow_up_at ? new Date(item.next_follow_up_at).toLocaleString() : '—'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <DashboardHeader title="Enquiry Leads" onBack={handleBack} />
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, phone, lead number..."
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLeads}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: SPACING.md },
  searchRow: { padding: SPACING.md, paddingBottom: 0 },
  searchInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: SPACING.sm, backgroundColor: COLORS.white, color: COLORS.text },
  card: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: 8, marginBottom: SPACING.sm },
  cardTitle: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading },
  cardMeta: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
  loading: { alignItems: 'center', marginTop: SPACING.lg },
  loadingText: { marginTop: SPACING.sm, color: COLORS.textSecondary },
});
