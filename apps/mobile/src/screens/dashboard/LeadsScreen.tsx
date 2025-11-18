import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Search } from 'lucide-react-native';
import LeadCard from '../../components/LeadCard';
import { COLORS, SIZES } from '../../constants/theme';

export default function LeadsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const statuses = ['ALL', 'NEW', 'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'];

  // Mock data - replace with actual data from Supabase
  const leads = [
    { id: '1', leadNumber: 'LN000123', customerName: 'Rajesh Kumar', vehicleNumber: 'MH 01 AB 1234', status: 'PENDING', serviceType: 'General Service' },
    { id: '2', leadNumber: 'LN000124', customerName: 'Amit Sharma', vehicleNumber: 'MH 02 CD 5678', status: 'IN_PROGRESS', serviceType: 'Engine Repair' },
    { id: '3', leadNumber: 'LN000125', customerName: 'Priya Singh', vehicleNumber: 'MH 03 EF 9012', status: 'ACCEPTED', serviceType: 'AC Service' },
  ];

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.leadNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         lead.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'ALL' || lead.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search color={COLORS.textGray} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search leads..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        {statuses.map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterTab, filterStatus === status && styles.filterTabActive]}
            onPress={() => setFilterStatus(status)}
          >
            <Text style={[styles.filterText, filterStatus === status && styles.filterTextActive]}>
              {status}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Leads List */}
      <ScrollView style={styles.leadsList} showsVerticalScrollIndicator={false}>
        {filteredLeads.length > 0 ? (
          filteredLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              leadNumber={lead.leadNumber}
              customerName={lead.customerName}
              vehicleNumber={lead.vehicleNumber}
              status={lead.status}
              serviceType={lead.serviceType}
              onPress={() => {/* Navigate to details */}}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No leads found</Text>
          </View>
        )}

        <View style={{ height: SIZES.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchContainer: {
    padding: SIZES.lg,
    backgroundColor: COLORS.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    gap: SIZES.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: SIZES.md,
    color: COLORS.textBody,
  },
  filterContainer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.lg,
    paddingBottom: SIZES.md,
  },
  filterTab: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    marginRight: SIZES.sm,
    borderRadius: SIZES.radiusSm,
    backgroundColor: COLORS.background,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: SIZES.base,
    color: COLORS.textGray,
    fontWeight: '500',
  },
  filterTextActive: {
    color: COLORS.white,
  },
  leadsList: {
    flex: 1,
    padding: SIZES.lg,
  },
  emptyState: {
    padding: SIZES.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: SIZES.md,
    color: COLORS.textGray,
  },
});

