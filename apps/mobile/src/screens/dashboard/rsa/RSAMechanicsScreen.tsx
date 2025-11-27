import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { COLORS, SIZES, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../../constants/theme';
import { Icon } from '../../../components/Icon';
import BottomNav from '../../../components/BottomNav';

export default function RSAMechanicsScreen({ navigation, route }: any) {
  const { userProfile } = useAuth();
  const { leadId, pincode, serviceTag } = route.params || {};
  
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPincode, setFilterPincode] = useState(pincode || '');
  const [filterServiceTag, setFilterServiceTag] = useState(serviceTag || '');
  const [filterAvailability, setFilterAvailability] = useState<'all' | 'available' | 'busy'>('all');

  useEffect(() => {
    fetchMechanics();
  }, [filterPincode, filterServiceTag, filterAvailability]);

  const fetchMechanics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('rsa_manager_search_mechanics', {
        p_pincode: filterPincode || null,
        p_service_tag: filterServiceTag || null,
        p_search_term: searchTerm || null,
      });
      
      if (error) throw error;
      
      let filteredData = data || [];
      
      // Filter by availability
      if (filterAvailability === 'available') {
        filteredData = filteredData.filter((m: any) => m.is_available);
      } else if (filterAvailability === 'busy') {
        filteredData = filteredData.filter((m: any) => !m.is_available);
      }
      
      setMechanics(filteredData);
    } catch (error) {
      console.error('Error fetching mechanics:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMechanics();
    setRefreshing(false);
  };

  const handleSearch = () => {
    fetchMechanics();
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const renderMechanicCard = (mechanic: any) => (
    <TouchableOpacity
      key={mechanic.id}
      style={styles.mechanicCard}
      onPress={() => {
        if (navigation.navigate) {
          navigation.navigate('RSAMechanicDetail', { mechanicId: mechanic.id });
        }
      }}
    >
      <View style={styles.mechanicHeader}>
        <View style={styles.mechanicInfo}>
          <Text style={styles.mechanicName}>{mechanic.mechanic_name}</Text>
          <Text style={styles.mechanicCode}>Code: {mechanic.mechanic_code}</Text>
        </View>
        <View
          style={[
            styles.availabilityBadge,
            {
              backgroundColor: mechanic.is_available
                ? COLORS.success + '20'
                : COLORS.error + '20',
            },
          ]}
        >
          {mechanic.is_available ? (
            <Icon name="check-circle" size={16} color={COLORS.success} />
          ) : (
            <Icon name="x-circle" size={16} color={COLORS.error} />
          )}
          <Text
            style={[
              styles.availabilityText,
              {
                color: mechanic.is_available ? COLORS.success : COLORS.error,
              },
            ]}
          >
            {mechanic.is_available ? 'Available' : 'Busy'}
          </Text>
        </View>
      </View>

      <View style={styles.mechanicDetails}>
        <TouchableOpacity
          style={styles.contactRow}
          onPress={() => handleCall(mechanic.number)}
        >
          <Icon name="phone" size={18} color={COLORS.primary} />
          <Text style={styles.contactText}>{mechanic.number}</Text>
        </TouchableOpacity>
        
        {mechanic.alternate_number1 && (
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => handleCall(mechanic.alternate_number1)}
          >
            <Icon name="phone" size={18} color={COLORS.gray[500]} />
            <Text style={styles.contactText}>Alt: {mechanic.alternate_number1}</Text>
          </TouchableOpacity>
        )}

        {mechanic.service_tag && (
          <View style={styles.serviceTags}>
            <Icon name="wrench" size={16} color={COLORS.gray[500]} />
            <Text style={styles.serviceTagText}>
              {mechanic.service_tag}
              {mechanic.service_tag2 && `, ${mechanic.service_tag2}`}
              {mechanic.service_tag3 && `, ${mechanic.service_tag3}`}
            </Text>
          </View>
        )}

        {mechanic.service_areas && mechanic.service_areas.length > 0 && (
          <View style={styles.serviceAreas}>
            <Icon name="map-pin" size={16} color={COLORS.gray[500]} />
            <Text style={styles.serviceAreaText}>
              Areas: {mechanic.service_areas.join(', ')}
            </Text>
          </View>
        )}

        {mechanic.timing && (
          <View style={styles.timingRow}>
            <Icon name="clock" size={16} color={COLORS.gray[500]} />
            <Text style={styles.timingText}>{mechanic.timing}</Text>
          </View>
        )}

        <View style={styles.statsRow}>
          {mechanic.rating !== undefined && (
            <View style={styles.statItem}>
              <Icon name="star" size={16} color={COLORS.warning} />
              <Text style={styles.statText}>{mechanic.rating.toFixed(1)}</Text>
            </View>
          )}
          {mechanic.total_jobs_completed !== undefined && (
            <View style={styles.statItem}>
              <Text style={styles.statText}>
                {mechanic.total_jobs_completed} jobs
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search Mechanics</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Icon name="search" size={20} color={COLORS.gray[500]} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, code, or number..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <Text style={styles.filterLabel}>Pincode</Text>
          <TextInput
            style={styles.filterInput}
            placeholder="Enter pincode"
            value={filterPincode}
            onChangeText={setFilterPincode}
            keyboardType="numeric"
          />

          <Text style={styles.filterLabel}>Service Tag</Text>
          <TextInput
            style={styles.filterInput}
            placeholder="Enter service tag"
            value={filterServiceTag}
            onChangeText={setFilterServiceTag}
          />

          <Text style={styles.filterLabel}>Availability</Text>
          <View style={styles.availabilityFilters}>
            {(['all', 'available', 'busy'] as const).map((avail) => (
              <TouchableOpacity
                key={avail}
                style={[
                  styles.availabilityFilterButton,
                  filterAvailability === avail && styles.availabilityFilterButtonActive,
                ]}
                onPress={() => setFilterAvailability(avail)}
              >
                <Text
                  style={[
                    styles.availabilityFilterText,
                    filterAvailability === avail && styles.availabilityFilterTextActive,
                  ]}
                >
                  {avail.charAt(0).toUpperCase() + avail.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Mechanics List */}
        <View style={styles.mechanicsContainer}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading mechanics...</Text>
            </View>
          ) : mechanics.length === 0 ? (
            <View style={styles.centerContainer}>
              <Icon name="wrench" size={48} color={COLORS.gray[500]} />
              <Text style={styles.emptyText}>No mechanics found</Text>
            </View>
          ) : (
            <>
              <Text style={styles.resultsCount}>{mechanics.length} mechanics found</Text>
              {mechanics.map(renderMechanicCard)}
            </>
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab="mechanics"
        onTabChange={(tab) => {
          if (tab === 'dashboard') {
            navigation.goBack();
          } else if (tab === 'add_mechanic') {
            navigation.navigate('AddMechanic', {});
          }
        }}
        tabs={[
          { id: 'dashboard', label: 'Dashboard', icon: 'home' },
          { id: 'mechanics', label: 'Mechanics', icon: 'wrench' },
          { id: 'add_mechanic', label: 'Add', icon: 'plus' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.white,
    fontFamily: 'Poppins',
  },
  scrollView: {
    flex: 1,
    paddingBottom: 80, // Space for bottom nav
  },
  searchContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textBody,
    fontFamily: 'Poppins',
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  searchButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  filtersContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  filterLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textHeading,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
    fontFamily: 'Poppins',
  },
  filterInput: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textBody,
    backgroundColor: COLORS.gray[50],
    fontFamily: 'Poppins',
  },
  availabilityFilters: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  availabilityFilterButton: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  availabilityFilterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  availabilityFilterText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textBody,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  availabilityFilterTextActive: {
    color: COLORS.white,
  },
  mechanicsContainer: {
    padding: SPACING.md,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontFamily: 'Poppins',
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    fontFamily: 'Poppins',
  },
  resultsCount: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textHeading,
    marginBottom: SPACING.md,
    fontFamily: 'Poppins',
  },
  mechanicCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
  },
  mechanicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  mechanicInfo: {
    flex: 1,
  },
  mechanicName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: SPACING.xs,
    fontFamily: 'Poppins',
  },
  mechanicCode: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontFamily: 'Poppins',
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  availabilityText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  mechanicDetails: {
    gap: SPACING.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  contactText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontFamily: 'Poppins',
    fontWeight: '500',
  },
  serviceTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  serviceTagText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textBody,
    fontFamily: 'Poppins',
    fontWeight: '500',
  },
  serviceAreas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  serviceAreaText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    flex: 1,
    fontFamily: 'Poppins',
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  timingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontFamily: 'Poppins',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textBody,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
});

