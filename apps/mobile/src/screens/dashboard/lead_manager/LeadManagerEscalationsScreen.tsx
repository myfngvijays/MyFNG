import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  BackHandler
} from 'react-native';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Removed - using emojis
import { Icon } from '../../../components/Icon';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

export default function LeadManagerEscalationsScreen({ navigation }: any) {
  const [escalations, setEscalations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active');

  useEffect(() => {
    fetchEscalations();
  }, [filter]);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [navigation]);

  const fetchEscalations = async () => {
    try {
      const data = await apiFetch<any>(`/api/lead-manager/escalations?filter=${encodeURIComponent(filter)}`);
      setEscalations(Array.isArray(data?.escalations) ? data.escalations : []);
    } catch {
      setEscalations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchEscalations();
  };

  const handleResolveEscalation = async (leadId: string) => {
    Alert.alert(
      'Resolve Escalation',
      'Mark this escalation as resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: async () => {
            try {
              const json = await apiFetch<any>('/api/lead-manager/escalations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lead_id: leadId }),
              });
              if (json?.success) {
                Alert.alert('Success', 'Escalation resolved');
                fetchEscalations();
              } else {
                Alert.alert('Error', json?.error || 'Failed to resolve escalation');
              }
            } catch {
              Alert.alert('Error', 'Failed to resolve escalation');
            }
          }
        }
      ]
    );
  };

  const getEscalationReason = (lead: any) => {
    if (lead.sla_state === 'BREACHED') return 'SLA Breached';
    if (lead.status === 'REJECTED') return 'Workshop Rejected';
    if (!lead.workshop_id && lead.reopen_count > 0) return 'Reopened Lead';
    if (lead.lead_priority === 'URGENT') return 'Urgent Priority';
    return 'Customer Complaint';
  };

  const renderEscalationCard = ({ item }: { item: any }) => {
    const reason = getEscalationReason(item);

    return (
      <TouchableOpacity
        style={styles.escalationCard}
        onPress={() => navigation.navigate('LeadManagerLeadDetail', { leadId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.leadNumber}>#{item.lead_number}</Text>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            <Text style={styles.customerPhone}>{item.customer_phone}</Text>
          </View>
          <View style={[
            styles.escalationBadge,
            { backgroundColor: item.escalation === 'ESCALATED' ? COLORS.red : COLORS.green }
          ]}>
            <Icon
              name={item.escalation === 'ESCALATED' ? 'alert-octagon' : 'check-circle'}
              size={16}
              color="#fff"
            />
            <Text style={styles.escalationText}>{item.escalation}</Text>
          </View>
        </View>

        <View style={styles.reasonRow}>
          <Icon name="information-outline" size={16} color={COLORS.orange} />
          <Text style={styles.reasonText}>{reason}</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Icon name="map-marker" size={14} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>{item.city_info?.name || item.city}</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="car" size={14} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>{item.vehicle_model}</Text>
          </View>
          {item.workshop && (
            <View style={styles.infoItem}>
              <Icon name="store" size={14} color={COLORS.textSecondary} />
              <Text style={styles.infoText}>{item.workshop.name}</Text>
            </View>
          )}
        </View>

        {item.sla_state && (
          <View style={[
            styles.slaBar,
            {
              backgroundColor: item.sla_state === 'BREACHED'
                ? COLORS.red + '20'
                : COLORS.orange + '20'
            }
          ]}>
            <Icon
              name={item.sla_state === 'BREACHED' ? 'alert-circle' : 'clock-alert'}
              size={16}
              color={item.sla_state === 'BREACHED' ? COLORS.red : COLORS.orange}
            />
            <Text style={[
              styles.slaText,
              { color: item.sla_state === 'BREACHED' ? COLORS.red : COLORS.orange }
            ]}>
              SLA {item.sla_state}
            </Text>
          </View>
        )}

        {item.escalation === 'ESCALATED' && (
          <TouchableOpacity
            style={styles.resolveButton}
            onPress={() => handleResolveEscalation(item.id)}
          >
            <Icon name="check" size={18} color={COLORS.green} />
            <Text style={styles.resolveButtonText}>Mark Resolved</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading escalations...</Text>
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
        <Text style={styles.headerTitle}>Escalations</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Icon name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'active' && styles.filterTabActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>
            Active
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'resolved' && styles.filterTabActive]}
          onPress={() => setFilter('resolved')}
        >
          <Text style={[styles.filterText, filter === 'resolved' && styles.filterTextActive]}>
            Resolved
          </Text>
        </TouchableOpacity>
      </View>

      {/* Escalations List */}
      <FlatList
        data={escalations}
        renderItem={renderEscalationCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon
              name={filter === 'resolved' ? 'check-all' : 'alert-octagon-outline'}
              size={64}
              color={COLORS.gray}
            />
            <Text style={styles.emptyTitle}>No Escalations</Text>
            <Text style={styles.emptyText}>
              {filter === 'resolved'
                ? 'No resolved escalations found'
                : 'No active escalations at the moment'}
            </Text>
          </View>
        }
      />
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
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  filterTab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  listContent: {
    padding: SPACING.md,
  },
  escalationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.red,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  leadNumber: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  customerPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  escalationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  escalationText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.orange + '15',
    padding: SPACING.sm,
    borderRadius: 8,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  reasonText: {
    fontSize: 13,
    color: COLORS.orange,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  slaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: 8,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  slaText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.green + '15',
    padding: SPACING.sm,
    borderRadius: 8,
    gap: SPACING.xs,
  },
  resolveButtonText: {
    fontSize: 13,
    color: COLORS.green,
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
});

