import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SPACING } from '../../../constants/theme';

export default function TelecallerFollowUpsScreen({ navigation }: any) {
  const { user } = useAuth();

  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'missed'>('pending');

  useEffect(() => {
    fetchFollowUps();
  }, [filter]);

  const fetchFollowUps = async () => {
    try {
      const { data: profile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user?.email)
        .single();

      let query = supabase
        .from('telecaller_follow_ups')
        .select(`
          *,
          lead:lead_id(
            lead_number,
            customer_name,
            customer_phone,
            status,
            service_type
          ),
          telecaller:telecaller_id(full_name)
        `)
        .eq('telecaller_id', profile?.id)
        .order('scheduled_time', { ascending: true });

      if (filter !== 'all') {
        query = query.eq('status', filter.toUpperCase());
      }

      const { data, error } = await query;

      if (error) throw error;
      setFollowUps(data || []);

    } catch (error) {
      console.error('Error fetching follow-ups:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFollowUps();
  };

  const handleMarkCompleted = async (followUpId: string) => {
    Alert.alert(
      'Mark as Completed',
      'Mark this follow-up as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('telecaller_follow_ups')
                .update({
                  status: 'COMPLETED',
                  completed_at: new Date().toISOString()
                })
                .eq('id', followUpId);

              if (!error) {
                fetchFollowUps();
                Alert.alert('Success', 'Follow-up marked as completed!');
              }
            } catch (error) {
              console.error('Error updating follow-up:', error);
              Alert.alert('Error', 'Failed to update follow-up');
            }
          }
        }
      ]
    );
  };

  const handleMarkMissed = async (followUpId: string) => {
    Alert.alert(
      'Mark as Missed',
      'Mark this follow-up as missed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('telecaller_follow_ups')
                .update({ status: 'MISSED' })
                .eq('id', followUpId);

              if (!error) {
                fetchFollowUps();
                Alert.alert('Marked as Missed');
              }
            } catch (error) {
              console.error('Error updating follow-up:', error);
              Alert.alert('Error', 'Failed to update follow-up');
            }
          }
        }
      ]
    );
  };

  const handleReschedule = async (followUpId: string) => {
    Alert.alert('Reschedule', 'Feature coming soon!');
  };

  const handleViewLead = (leadId: string) => {
    navigation.navigate('TelecallerLeadDetail', { leadId });
  };

  const renderFollowUp = (item: any) => {
    const scheduledTime = new Date(item.scheduled_time);
    const isOverdue = scheduledTime < new Date() && item.status === 'PENDING';
    const isToday = scheduledTime.toDateString() === new Date().toDateString();

    return (
      <View key={item.id} style={[
        styles.followUpCard,
        isOverdue && styles.overdueCard
      ]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.customerInfo}>
              <MaterialCommunityIcons name="account" size={16} color={COLORS.primary} />
              <Text style={styles.customerName}>{item.lead?.customer_name}</Text>
            </View>
            <Text style={styles.leadNumber}>#{item.lead?.lead_number}</Text>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) }
          ]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        {/* Follow-up Details */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="calendar-clock" size={16} color={COLORS.textSecondary} />
            <Text style={[
              styles.detailText,
              isOverdue && styles.overdueText
            ]}>
              {scheduledTime.toLocaleString()}
              {isOverdue && ' (OVERDUE)'}
              {isToday && ' (Today)'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="phone-forward" size={16} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>{item.follow_up_type}</Text>
          </View>

          {item.reason && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="text" size={16} color={COLORS.textSecondary} />
              <Text style={styles.detailText}>{item.reason}</Text>
            </View>
          )}

          {item.priority && item.priority !== 'NORMAL' && (
            <View style={[
              styles.priorityBadge,
              { backgroundColor: getPriorityColor(item.priority) }
            ]}>
              <MaterialCommunityIcons name="alert-circle" size={14} color={COLORS.red} />
              <Text style={styles.priorityText}>{item.priority}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        {item.status === 'PENDING' && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.viewButton]}
              onPress={() => handleViewLead(item.lead_id)}
            >
              <MaterialCommunityIcons name="eye" size={18} color={COLORS.primary} />
              <Text style={styles.actionButtonText}>View Lead</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => handleMarkCompleted(item.id)}
            >
              <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.green} />
              <Text style={styles.actionButtonText}>Complete</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.missedButton]}
              onPress={() => handleMarkMissed(item.id)}
            >
              <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.red} />
              <Text style={styles.actionButtonText}>Missed</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'COMPLETED' && item.completed_at && (
          <View style={styles.completedInfo}>
            <MaterialCommunityIcons name="check" size={14} color={COLORS.green} />
            <Text style={styles.completedText}>
              Completed on {new Date(item.completed_at).toLocaleString()}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading follow-ups...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
            onPress={() => setFilter('pending')}
          >
            <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
              Pending
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
            style={[styles.filterTab, filter === 'completed' && styles.filterTabActive]}
            onPress={() => setFilter('completed')}
          >
            <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
              Completed
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filter === 'missed' && styles.filterTabActive]}
            onPress={() => setFilter('missed')}
          >
            <Text style={[styles.filterText, filter === 'missed' && styles.filterTextActive]}>
              Missed
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {followUps.filter(f => f.status === 'PENDING').length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.green }]}>
            {followUps.filter(f => f.status === 'COMPLETED').length}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.red }]}>
            {followUps.filter(f => {
              const scheduledTime = new Date(f.scheduled_time);
              return scheduledTime < new Date() && f.status === 'PENDING';
            }).length}
          </Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
      </View>

      {/* Follow-ups List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {followUps.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="calendar-check" size={64} color={COLORS.gray} />
            <Text style={styles.emptyTitle}>No Follow-ups</Text>
            <Text style={styles.emptyText}>
              {filter === 'pending'
                ? 'You have no pending follow-ups!'
                : `No ${filter} follow-ups found`}
            </Text>
          </View>
        ) : (
          followUps.map(renderFollowUp)
        )}
      </ScrollView>
    </View>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'PENDING': return COLORS.orange + '30';
    case 'COMPLETED': return COLORS.green + '30';
    case 'MISSED': return COLORS.red + '30';
    default: return COLORS.gray + '30';
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'URGENT': return COLORS.red + '20';
    case 'HIGH': return COLORS.orange + '20';
    default: return COLORS.gray + '20';
  }
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
    color: COLORS.textSecondary,
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray + '30',
  },
  filterTab: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.background,
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
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: SPACING.md,
    borderRadius: 12,
    padding: SPACING.md,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.gray + '30',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  followUpCard: {
    backgroundColor: '#fff',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: 12,
    padding: SPACING.md,
    elevation: 2,
  },
  overdueCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.red,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  leadNumber: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  detailsContainer: {
    marginBottom: SPACING.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.xs,
  },
  detailText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
  },
  overdueText: {
    color: COLORS.red,
    fontWeight: 'bold',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginTop: SPACING.xs,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.red,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    gap: 4,
  },
  viewButton: {
    backgroundColor: COLORS.primary + '20',
  },
  completeButton: {
    backgroundColor: COLORS.green + '20',
  },
  missedButton: {
    backgroundColor: COLORS.red + '20',
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  completedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray + '20',
  },
  completedText: {
    fontSize: 12,
    color: COLORS.green,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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

