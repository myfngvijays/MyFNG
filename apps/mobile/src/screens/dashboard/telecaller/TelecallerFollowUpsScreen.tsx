import React, { useState, useEffect } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  Linking,
  BackHandler
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Removed - using emojis
import { Icon } from '../../../components/Icon';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SPACING } from '../../../constants/theme';

export default function TelecallerFollowUpsScreen({ navigation, route, embedded = false }: any) {
  const { user } = useAuth();
  const initialFilter = route?.params?.filter;

  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'today' | 'overdue' | 'completed'>(
    initialFilter === 'today' || initialFilter === 'overdue' || initialFilter === 'completed' || initialFilter === 'pending'
      ? initialFilter
      : 'pending'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [rescheduleTarget, setRescheduleTarget] = useState<any | null>(null);
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [completionTarget, setCompletionTarget] = useState<any | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [showCompletion, setShowCompletion] = useState(false);

  useEffect(() => {
    const next = route?.params?.filter;
    if (next === 'today' || next === 'overdue' || next === 'completed' || next === 'pending') {
      setFilter(next);
    }
  }, [route?.params?.filter]);

  useEffect(() => {
    fetchFollowUps();
  }, [filter, searchTerm]);

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

      if (filter === 'completed') {
        query = query.eq('status', 'COMPLETED');
      } else {
        query = query.eq('status', 'PENDING');
      }

      const { data, error } = await query;

      if (error) throw error;

      let list = data || [];
      const now = new Date();
      if (filter === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        list = list.filter((fu: any) => {
          const t = new Date(fu.scheduled_time);
          return t >= start && t <= end;
        });
      }
      if (filter === 'overdue') {
        list = list.filter((fu: any) => new Date(fu.scheduled_time) < now);
      }
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        list = list.filter((fu: any) =>
          fu.lead?.customer_name?.toLowerCase().includes(search) ||
          fu.lead?.customer_phone?.includes(search) ||
          fu.lead?.lead_number?.toLowerCase().includes(search) ||
          fu.reason?.toLowerCase().includes(search)
        );
      }

      setFollowUps(list);

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

  const handleMarkCompleted = (followUpId: string) => {
    const target = followUps.find((f) => f.id === followUpId);
    setCompletionTarget(target || null);
    setCompletionNotes('');
    setShowCompletion(true);
  };

  const submitCompletion = async () => {
    if (!completionTarget) return;
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
                  completed_at: new Date().toISOString(),
                  completion_notes: completionNotes || null,
                })
                .eq('id', completionTarget.id);

              if (!error) {
                fetchFollowUps();
                Alert.alert('Success', 'Follow-up marked as completed!');
              }
            } catch (error) {
              console.error('Error updating follow-up:', error);
              Alert.alert('Error', 'Failed to update follow-up');
            } finally {
              setShowCompletion(false);
              setCompletionTarget(null);
            }
          }
        }
      ]
    );
  };

  const handleMarkMissed = async (followUpId: string) => {
    Alert.alert(
      'Cancel Follow-up',
      'Cancel this follow-up?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('telecaller_follow_ups')
                .update({ status: 'CANCELLED' })
                .eq('id', followUpId);

              if (!error) {
                fetchFollowUps();
                Alert.alert('Follow-up cancelled');
              }
            } catch (error) {
              console.error('Error updating follow-up:', error);
              Alert.alert('Error', 'Failed to cancel follow-up');
            }
          }
        }
      ]
    );
  };

  const handleReschedule = (followUpId: string) => {
    const target = followUps.find((f) => f.id === followUpId);
    setRescheduleTarget(target || null);
    setShowReschedulePicker(true);
  };

  const handleRescheduleChange = async (_event: any, selectedDate?: Date) => {
    setShowReschedulePicker(false);
    if (!selectedDate || !rescheduleTarget) return;
    try {
      const { error } = await supabase
        .from('telecaller_follow_ups')
        .update({ scheduled_time: selectedDate.toISOString() })
        .eq('id', rescheduleTarget.id);
      if (!error) {
        fetchFollowUps();
      }
    } catch (error) {
      console.error('Error rescheduling follow-up:', error);
      Alert.alert('Error', 'Failed to reschedule follow-up');
    } finally {
      setRescheduleTarget(null);
    }
  };

  const handleViewLead = (leadId: string) => {
    navigation.navigate('TelecallerLeadDetail', { leadId });
  };

  const renderFollowUp = (item: any) => {
    const scheduledTime = new Date(item.scheduled_time);
    const isOverdue = scheduledTime < new Date() && item.status === 'PENDING';
    const isToday = scheduledTime.toDateString() === new Date().toDateString();
    const whenLabel = formatDateTime(item.scheduled_time) || scheduledTime.toLocaleString();

    return (
      <View
        key={item.id}
        style={[styles.followUpCard, isOverdue && styles.overdueCard]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={styles.customerInfo}>
              <Icon name="account" size={16} color={COLORS.primary} />
              <Text style={styles.customerName} numberOfLines={1}>
                {item.lead?.customer_name || 'Customer'}
              </Text>
            </View>
            <Text style={styles.leadNumber}>#{item.lead?.lead_number || '—'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Icon name="calendar-clock" size={16} color={isOverdue ? COLORS.red : COLORS.textSecondary} />
            <Text style={[styles.detailText, isOverdue && styles.overdueText]}>
              {whenLabel}
              {isOverdue ? ' · Overdue' : isToday ? ' · Today' : ''}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Icon name="phone-forward" size={16} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>{String(item.follow_up_type || 'FOLLOW_UP').replace(/_/g, ' ')}</Text>
          </View>

          {item.reason ? (
            <View style={styles.detailRow}>
              <Icon name="text" size={16} color={COLORS.textSecondary} />
              <Text style={styles.detailText} numberOfLines={2}>{item.reason}</Text>
            </View>
          ) : null}

          {item.priority && item.priority !== 'NORMAL' ? (
            <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
              <Icon name="alert-circle" size={14} color={COLORS.red} />
              <Text style={styles.priorityText}>{item.priority}</Text>
            </View>
          ) : null}
        </View>

        {item.status === 'PENDING' ? (
          <View style={styles.actionsWrap}>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionPrimary]}
                onPress={() => Linking.openURL(`tel:${item.lead?.customer_phone}`)}
              >
                <Icon name="phone" size={16} color="#fff" />
                <Text style={styles.actionBtnTextOn}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionSecondary]}
                onPress={() => handleViewLead(item.lead_id)}
              >
                <Icon name="eye" size={16} color={COLORS.primary} />
                <Text style={styles.actionBtnText}>View</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionSuccess]}
                onPress={() => handleMarkCompleted(item.id)}
              >
                <Icon name="check-circle" size={15} color={COLORS.green} />
                <Text style={[styles.actionBtnText, { color: COLORS.green }]}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionDanger]}
                onPress={() => handleMarkMissed(item.id)}
              >
                <Icon name="close-circle" size={15} color={COLORS.red} />
                <Text style={[styles.actionBtnText, { color: COLORS.red }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionSecondary]}
                onPress={() => handleReschedule(item.id)}
              >
                <Icon name="calendar-clock" size={15} color={COLORS.primary} />
                <Text style={styles.actionBtnText}>Reschedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {item.status === 'COMPLETED' && item.completed_at ? (
          <View style={styles.completedInfo}>
            <Icon name="check" size={14} color={COLORS.green} />
            <View style={{ flex: 1 }}>
              <Text style={styles.completedText}>
                Completed on {formatDateTime(item.completed_at)}
              </Text>
              {item.completion_notes ? (
                <Text style={styles.completedNotes}>{item.completion_notes}</Text>
              ) : null}
            </View>
          </View>
        ) : null}
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
      {/* Header with Back Button — skipped when embedded in CRM Engage tab */}
      {!embedded ? (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Follow-ups</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : null}

      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search follow-ups..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

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
            style={[styles.filterTab, filter === 'today' && styles.filterTabActive]}
            onPress={() => setFilter('today')}
          >
            <Text style={[styles.filterText, filter === 'today' && styles.filterTextActive]}>
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filter === 'overdue' && styles.filterTabActive]}
            onPress={() => setFilter('overdue')}
          >
            <Text style={[styles.filterText, filter === 'overdue' && styles.filterTextActive]}>
              Overdue
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
        contentContainerStyle={{ paddingBottom: embedded ? 110 : 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {followUps.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="calendar-check" size={64} color={COLORS.gray[500]} />
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

      {showCompletion && (
        <View style={styles.completionCard}>
          <Text style={styles.completionTitle}>Completion Notes</Text>
          <TextInput
            style={styles.completionInput}
            placeholder="Optional notes..."
            value={completionNotes}
            onChangeText={setCompletionNotes}
            multiline
          />
          <View style={styles.completionActions}>
            <TouchableOpacity style={styles.completionButton} onPress={submitCompletion}>
              <Text style={styles.completionButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.completionButton, styles.completionButtonSecondary]}
              onPress={() => setShowCompletion(false)}
            >
              <Text style={styles.completionButtonTextSecondary}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showReschedulePicker && (
        <DateTimePicker
          value={rescheduleTarget?.scheduled_time ? new Date(rescheduleTarget.scheduled_time) : new Date()}
          mode="datetime"
          display="default"
          onChange={handleRescheduleChange}
        />
      )}
    </View>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'PENDING': return COLORS.orange + '30';
    case 'COMPLETED': return COLORS.green + '30';
    case 'CANCELLED': return COLORS.red + '30';
    default: return COLORS.gray[500] + '30';
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'URGENT': return COLORS.red + '20';
    case 'HIGH': return COLORS.orange + '20';
    default: return COLORS.gray[500] + '20';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: SPACING.md,
    elevation: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    borderRadius: 10,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    padding: SPACING.sm,
    color: COLORS.text,
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
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: COLORS.gray[100],
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    elevation: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.gray[200],
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  followUpCard: {
    backgroundColor: '#fff',
    marginHorizontal: SPACING.md,
    marginBottom: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
  },
  overdueCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.red,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  leadNumber: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  detailsContainer: {
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
  overdueText: {
    color: COLORS.red,
    fontWeight: '700',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
    marginTop: 2,
    marginBottom: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.red,
  },
  actionsWrap: {
    marginTop: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
    paddingTop: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 5,
  },
  actionPrimary: {
    backgroundColor: COLORS.primary,
  },
  actionSecondary: {
    backgroundColor: COLORS.primary + '12',
  },
  actionSuccess: {
    backgroundColor: COLORS.green + '14',
  },
  actionDanger: {
    backgroundColor: COLORS.red + '12',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  actionBtnTextOn: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  // legacy unused kept for safety
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
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
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  completedText: {
    fontSize: 12,
    color: COLORS.green,
    fontWeight: '600',
  },
  completedNotes: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
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
  completionCard: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
    padding: SPACING.md,
  },
  completionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: SPACING.sm,
  },
  completionInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.sm,
    minHeight: 70,
    textAlignVertical: 'top',
    backgroundColor: COLORS.white,
    color: COLORS.text,
  },
  completionActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  completionButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  completionButtonSecondary: {
    backgroundColor: COLORS.gray[200],
  },
  completionButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  completionButtonTextSecondary: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
});

