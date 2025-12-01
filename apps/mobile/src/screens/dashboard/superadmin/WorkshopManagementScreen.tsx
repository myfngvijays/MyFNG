import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert
} from 'react-native';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Removed - using emojis
import { Icon } from '../../../components/Icon';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING } from '../../../constants/theme';

export default function WorkshopManagementScreen({ navigation }: any) {
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedWorkshop, setSelectedWorkshop] = useState<any>(null);

  useEffect(() => {
    fetchWorkshops();
  }, [filter]);

  const fetchWorkshops = async () => {
    try {
      let query = supabase
        .from('workshops')
        .select('*')
        .order('created_at', { ascending: false });

      switch (filter) {
        case 'active':
          query = query.eq('is_active', true);
          break;
        case 'inactive':
          query = query.eq('is_active', false);
          break;
        case 'pending':
          query = query.eq('approval_status', 'PENDING');
          break;
      }

      if (searchTerm) {
        query = query.or(
          `name.ilike.%${searchTerm}%,` +
          `city.ilike.%${searchTerm}%,` +
          `phone.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      setWorkshops(data || []);
    } catch (error) {
      console.error('Error fetching workshops:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchWorkshops();
  };

  const handleApprove = async (workshopId: string) => {
    Alert.alert(
      'Approve Workshop',
      'Approve this workshop for operations?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('workshops')
                .update({
                  approval_status: 'APPROVED',
                  is_active: true,
                  approved_at: new Date().toISOString()
                })
                .eq('id', workshopId);

              if (!error) {
                Alert.alert('Success', 'Workshop approved successfully');
                fetchWorkshops();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to approve workshop');
            }
          }
        }
      ]
    );
  };

  const handleDisable = async (workshopId: string) => {
    Alert.alert(
      'Disable Workshop',
      'This will stop all lead assignments to this workshop.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('workshops')
                .update({
                  is_active: false,
                  disabled_at: new Date().toISOString()
                })
                .eq('id', workshopId);

              if (!error) {
                Alert.alert('Disabled', 'Workshop has been disabled');
                fetchWorkshops();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to disable workshop');
            }
          }
        }
      ]
    );
  };

  const handleEnable = async (workshopId: string) => {
    try {
      const { error } = await supabase
        .from('workshops')
        .update({
          is_active: true,
          disabled_at: null
        })
        .eq('id', workshopId);

      if (!error) {
        Alert.alert('Success', 'Workshop enabled successfully');
        fetchWorkshops();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to enable workshop');
    }
  };

  const handleBlacklist = async (workshopId: string) => {
    Alert.alert(
      'Blacklist Workshop',
      'This is a PERMANENT action. Workshop will be blacklisted for fraud/violations.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Blacklist',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('workshops')
                .update({
                  is_active: false,
                  is_blacklisted: true,
                  blacklisted_at: new Date().toISOString()
                })
                .eq('id', workshopId);

              if (!error) {
                Alert.alert('Blacklisted', 'Workshop has been blacklisted');
                fetchWorkshops();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to blacklist workshop');
            }
          }
        }
      ]
    );
  };

  const renderWorkshopCard = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        style={[
          styles.workshopCard,
          !item.is_active && styles.workshopCardInactive
        ]}
        onPress={() => {
          setSelectedWorkshop(item);
          setShowActionModal(true);
        }}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.workshopName}>{item.name}</Text>
            <View style={styles.locationRow}>
              <Icon name="map-marker" size={14} color={COLORS.textSecondary} />
              <Text style={styles.locationText}>{item.city}</Text>
            </View>
            <View style={styles.locationRow}>
              <Icon name="phone" size={14} color={COLORS.textSecondary} />
              <Text style={styles.locationText}>{item.phone}</Text>
            </View>
          </View>

          {/* Status Badge */}
          <View style={[
            styles.statusBadge,
            {
              backgroundColor: item.is_active
                ? COLORS.green + '20'
                : item.is_blacklisted
                ? COLORS.red + '20'
                : COLORS.gray + '20'
            }
          ]}>
            <Text style={[
              styles.statusText,
              {
                color: item.is_active
                  ? COLORS.green
                  : item.is_blacklisted
                  ? COLORS.red
                  : COLORS.gray
              }
            ]}>
              {item.is_blacklisted ? 'BLACKLISTED' : item.is_active ? 'ACTIVE' : 'INACTIVE'}
            </Text>
          </View>
        </View>

        {/* Info */}
        {item.approval_status === 'PENDING' && (
          <View style={styles.pendingBanner}>
            <Icon name="clock-alert" size={16} color={COLORS.orange} />
            <Text style={styles.pendingText}>Pending Approval</Text>
          </View>
        )}

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.total_jobs || 0}</Text>
            <Text style={styles.statLabel}>Jobs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.orange }]}>
              {item.rating || 4.5}⭐
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.total_mechanics || 0}</Text>
            <Text style={styles.statLabel}>Mechanics</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {item.approval_status === 'PENDING' && (
            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: COLORS.green + '20' }]}
              onPress={() => handleApprove(item.id)}
            >
              <Icon name="check" size={18} color={COLORS.green} />
              <Text style={[styles.quickActionText, { color: COLORS.green }]}>Approve</Text>
            </TouchableOpacity>
          )}

          {item.is_active ? (
            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: COLORS.orange + '20' }]}
              onPress={() => handleDisable(item.id)}
            >
              <Icon name="pause" size={18} color={COLORS.orange} />
              <Text style={[styles.quickActionText, { color: COLORS.orange }]}>Disable</Text>
            </TouchableOpacity>
          ) : (
            !item.is_blacklisted && (
              <TouchableOpacity
                style={[styles.quickActionBtn, { backgroundColor: COLORS.green + '20' }]}
                onPress={() => handleEnable(item.id)}
              >
                <Icon name="play" size={18} color={COLORS.green} />
                <Text style={[styles.quickActionText, { color: COLORS.green }]}>Enable</Text>
              </TouchableOpacity>
            )
          )}

          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: COLORS.purple + '20' }]}
            onPress={() => navigation.navigate('WorkshopRates', { workshopId: item.id, workshopName: item.name })}
          >
            <Icon name="currency-usd" size={18} color={COLORS.purple} />
            <Text style={[styles.quickActionText, { color: COLORS.purple }]}>Manage Rate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: COLORS.blue + '20' }]}
            onPress={() => {
              setSelectedWorkshop(item);
              setShowActionModal(true);
            }}
          >
            <Icon name="dots-horizontal" size={18} color={COLORS.blue} />
            <Text style={[styles.quickActionText, { color: COLORS.blue }]}>More</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading workshops...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workshop Management</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Icon name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search workshops..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'active' && styles.filterTabActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>
            Active
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'inactive' && styles.filterTabActive]}
          onPress={() => setFilter('inactive')}
        >
          <Text style={[styles.filterText, filter === 'inactive' && styles.filterTextActive]}>
            Inactive
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            Pending
          </Text>
        </TouchableOpacity>
      </View>

      {/* Count */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>{workshops.length} workshop(s) found</Text>
      </View>

      {/* List */}
      <FlatList
        data={workshops}
        renderItem={renderWorkshopCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="store-off" size={64} color={COLORS.gray} />
            <Text style={styles.emptyTitle}>No Workshops Found</Text>
            <Text style={styles.emptyText}>
              {searchTerm ? `No workshops match "${searchTerm}"` : `No workshops in ${filter} category`}
            </Text>
          </View>
        }
      />

      {/* Actions Modal */}
      <Modal
        visible={showActionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActionModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Workshop Actions</Text>
            <Text style={styles.modalSubtitle}>{selectedWorkshop?.name}</Text>

            <TouchableOpacity
              style={styles.modalAction}
              onPress={() => {
                setShowActionModal(false);
                // Navigate to details
              }}
            >
              <Icon name="eye" size={24} color={COLORS.blue} />
              <Text style={styles.modalActionText}>View Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalAction}
              onPress={() => {
                setShowActionModal(false);
                // Navigate to edit
              }}
            >
              <Icon name="pencil" size={24} color={COLORS.orange} />
              <Text style={styles.modalActionText}>Edit Workshop</Text>
            </TouchableOpacity>

            {!selectedWorkshop?.is_blacklisted && (
              <TouchableOpacity
                style={[styles.modalAction, styles.modalActionDanger]}
                onPress={() => {
                  setShowActionModal(false);
                  handleBlacklist(selectedWorkshop?.id);
                }}
              >
                <Icon name="cancel" size={24} color={COLORS.red} />
                <Text style={[styles.modalActionText, { color: COLORS.red }]}>Blacklist</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowActionModal(false)}
            >
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
  },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    paddingTop: SPACING.xl,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginLeft: SPACING.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    elevation: 2,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  filterTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.background,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  countBar: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#fff',
  },
  countText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  listContent: {
    padding: SPACING.md,
  },
  workshopCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    elevation: 2,
  },
  workshopCardInactive: {
    opacity: 0.7,
    borderWidth: 1,
    borderColor: COLORS.gray + '40',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  workshopName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    height: 24,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.orange + '15',
    padding: SPACING.sm,
    borderRadius: 8,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  pendingText: {
    fontSize: 12,
    color: COLORS.orange,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray + '20',
  },
  statItem: {
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.gray + '30',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    gap: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  modalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  modalActionDanger: {
    backgroundColor: COLORS.red + '10',
  },
  modalActionText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  modalCancel: {
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  modalCancelText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});

