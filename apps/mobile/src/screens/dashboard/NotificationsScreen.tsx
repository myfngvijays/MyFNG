/**
 * Notifications Screen - Mobile
 * Safe-area aware header + filters for reminders / unread.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDateDMY } from "@/lib/dateFormat";
import { useNotifications, Notification } from '../../context/NotificationContext';
import { COLORS, SIZES, SPACING } from '../../constants/theme';
import { apiFetch } from '../../lib/api';

type NotifFilter = 'all' | 'missed_calls' | 'missed_reminders' | 'whatsapp';

export default function NotificationsScreen({ navigation, hideChrome }: any) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<NotifFilter>('all');
  const [missedCalls, setMissedCalls] = useState<Notification[]>([]);
  const [missedReminders, setMissedReminders] = useState<Notification[]>([]);
  const [waMessages, setWaMessages] = useState<Notification[]>([]);

  const loadFeed = async () => {
    try {
      const json = await apiFetch<{
        calls?: Array<{ id: string; phone?: string; name?: string; status?: string; created_at?: string }>;
        reminders?: Array<{ id: string; name?: string; reason?: string; scheduled_time?: string; lead_id?: string }>;
        whatsapp?: Array<{ id: string; phone?: string; name?: string; text?: string; created_at?: string }>;
      }>('/api/telecaller/notifications-feed');
      setMissedCalls(
        (json?.calls || []).map((call) => ({
          id: `call-${call.id}`,
          title: call.name || call.phone || 'Missed call',
          message: call.status || 'MISSED',
          created_at: call.created_at || new Date().toISOString(),
          is_read: true,
          type: 'SYSTEM_ALERT',
          priority: 'MEDIUM',
          user_id: '',
          read_at: null,
          action_url: null,
          lead_number: null,
          lead_id: null,
          metadata: { phone: call.phone },
        })) as Notification[],
      );
      setMissedReminders(
        (json?.reminders || []).map((row) => ({
          id: `rem-${row.id}`,
          title: row.name || 'Missed reminder',
          message: row.reason || 'Follow-up overdue',
          created_at: row.scheduled_time || new Date().toISOString(),
          is_read: true,
          type: 'FOLLOW_UP_DUE',
          priority: 'HIGH',
          user_id: '',
          read_at: null,
          action_url: null,
          lead_number: null,
          lead_id: row.lead_id || null,
          metadata: {},
        })) as Notification[],
      );
      setWaMessages(
        (json?.whatsapp || []).map((msg) => ({
          id: `wa-${msg.id}`,
          title: msg.name || msg.phone || 'WhatsApp',
          message: msg.text || 'Message',
          created_at: msg.created_at || new Date().toISOString(),
          is_read: true,
          type: 'WHATSAPP',
          priority: 'MEDIUM',
          user_id: '',
          read_at: null,
          action_url: null,
          lead_number: null,
          lead_id: null,
          metadata: { phone: msg.phone },
        })) as Notification[],
      );
    } catch {
      setMissedCalls([]);
      setMissedReminders([]);
      setWaMessages([]);
    }
  };

  useEffect(() => {
    void loadFeed();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshNotifications(), loadFeed()]);
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const rows = Array.isArray(notifications) ? notifications : [];
    if (filter === 'whatsapp') return waMessages;
    if (filter === 'missed_calls') return missedCalls;
    if (filter === 'missed_reminders') return missedReminders;
    const seen = new Set<string>();
    const merged = [...rows, ...missedCalls, ...missedReminders, ...waMessages].filter((row) => {
      const id = String(row?.id || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return merged.sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    );
  }, [notifications, filter, missedCalls, missedReminders, waMessages]);

  const getPriorityColor = (priority: string): string => {
    const colors: Record<string, string> = {
      URGENT: COLORS.danger,
      HIGH: COLORS.warning,
      MEDIUM: COLORS.info,
      LOW: COLORS.gray[500],
    };
    return colors[priority] || COLORS.gray[500];
  };

  const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDateDMY(date);
  };

  const isReminder = (n: Notification) => {
    const kind = String((n as any)?.metadata?.kind || '').toUpperCase();
    const type = String((n as any)?.type || '').toUpperCase();
    return kind.includes('FOLLOWUP') || type.includes('FOLLOW_UP');
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.is_read && !String(notification.id).startsWith('call-') && !String(notification.id).startsWith('rem-')) {
      await markAsRead(notification.id);
    }

    const leadId = notification.lead_id;
    const actionUrl = notification.action_url || '';
    const kind = (notification as any)?.metadata?.kind;
    const type = String((notification as any)?.type || '');
    const extraWorkType = type === 'EXTRA_WORK_APPROVED' || type === 'EXTRA_WORK_REJECTED' || type === 'EXTRA_WORK_REQUESTED';

    const isPendingQcNotif =
      String(kind || '') === 'PENDING_QC' ||
      String(actionUrl).includes('/workshop-advisor/jobs/') &&
        String(actionUrl).includes('/review') ||
      String(actionUrl).includes('/workshop-advisor/qc-queue');

    if (leadId && isPendingQcNotif) {
      try {
        navigation.navigate('QCReview', { jobId: leadId });
        return;
      } catch {
        /* fallthrough */
      }
      try {
        navigation.navigate('QCCheck');
        return;
      } catch {
        /* fallthrough */
      }
    }

    if (leadId && extraWorkType) {
      try {
        navigation.navigate('JobDetail', { jobId: leadId, leadId, tab: 'extra' });
        return;
      } catch {
        /* fallthrough */
      }
      try {
        navigation.navigate('ExtraWorkApproval');
        return;
      } catch {
        /* fallthrough */
      }
    }

    if (
      leadId &&
      (String(actionUrl).includes('workshop_mechanic') ||
        [
          'QC_APPROVED',
          'QC_REJECTED',
          'JOB_ASSIGNED',
          'JOB_COMPLETED',
        ].includes(type))
    ) {
      try {
        navigation.navigate('JobDetail', { jobId: leadId, leadId });
        return;
      } catch {
        /* fallthrough */
      }
    }

    if (
      String(kind || '') === 'DELIVERY_REASSIGNED' ||
      type === 'DELIVERY_ASSIGNED' ||
      String(actionUrl).includes('workshop-advisor/pickup-delivery')
    ) {
      if (String(actionUrl).includes('workshop_pickup_boy') && leadId) {
        try {
          navigation.navigate('PickupJobDetail', { leadId });
          return;
        } catch {
          /* fallthrough */
        }
      }
      try {
        navigation.navigate('PickupDeliveryTracking');
        return;
      } catch {
        /* fallthrough */
      }
    }

    if (
      leadId &&
      (String(actionUrl).includes('workshop_pickup_boy') ||
        String(kind || '').startsWith('PICKUP_') ||
        [
          'PICKUP_TASK_ASSIGNED',
          'PICKUP_ACCEPTANCE_PENDING',
          'PICKUP_REASSIGNED',
          'PICKUP_NAV_REMINDER',
          'OTP_VERIFIED',
          'PICKUP_COMPLETED',
          'PICKUP_ARRIVED',
          'HANDOVER_PENDING',
          'DELIVERY_ASSIGNED',
          'DELIVERY_COMPLETED',
          'DELIVERY_FAILED',
          'ROUTE_DEVIATION',
          'ROUTE_DELAY',
          'PICKUP_OBSERVATION_REQUIRED',
          'PICKUP_OBSERVATION_PENDING',
          'PICKUP_DOCUMENTS_REQUIRED',
          'SOS_ACTIVATED',
        ].includes(type))
    ) {
      try {
        navigation.navigate('PickupJobDetail', { leadId });
        return;
      } catch {
        /* fallthrough */
      }
    }

    if (leadId) {
      try {
        navigation.navigate('TelecallerLeadDetail', { leadId });
        return;
      } catch {
        /* ignore */
      }
    }

    if (isReminder(notification)) {
      try {
        navigation.navigate('TelecallerFollowUps');
      } catch {
        /* ignore */
      }
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Remove this notification?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteNotification(id),
      },
    ]);
  };

  const handleMarkAllAsRead = () => {
    Alert.alert('Mark all read?', 'All notifications will be marked as read.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark all', onPress: () => markAllAsRead() },
    ]);
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const reminder = isReminder(item);
    return (
      <TouchableOpacity
        style={[styles.card, !item.is_read && styles.cardUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.85}
      >
        <View
          style={[
            styles.iconWrap,
            { borderColor: getPriorityColor(item.priority || 'MEDIUM') },
          ]}
        >
          <Ionicons
            name={reminder ? 'alarm-outline' : 'notifications-outline'}
            size={20}
            color={getPriorityColor(item.priority || 'MEDIUM')}
          />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !item.is_read && styles.titleUnread]} numberOfLines={2}>
              {item.title}
            </Text>
            {!item.is_read ? <View style={styles.dot} /> : null}
          </View>
          {item.message ? (
            <Text style={styles.message} numberOfLines={3}>
              {item.message}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            {reminder ? (
              <View style={styles.reminderPill}>
                <Ionicons name="time-outline" size={12} color="#0369A1" />
                <Text style={styles.reminderPillText}>Reminder</Text>
              </View>
            ) : null}
            <Text style={styles.time}>{getRelativeTime(item.created_at)}</Text>
            {item.lead_number ? (
              <Text style={styles.leadNo}>#{item.lead_number}</Text>
            ) : null}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => handleDelete(item.id)}
          style={styles.trashBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={hideChrome ? ['left', 'right'] : ['top', 'left', 'right']}>
      {hideChrome ? (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation?.goBack?.()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={26} color={COLORS.gray[800]} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAll}>
              <Ionicons name="checkmark-done" size={18} color={COLORS.primary} />
              <Text style={styles.markAllText}>Mark all</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 72 }} />
          )}
        </View>
      ) : (
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAll}>
            <Ionicons name="checkmark-done" size={18} color={COLORS.primary} />
            <Text style={styles.markAllText}>Mark all</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 72 }} />
        )}
      </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filters}
        contentContainerStyle={styles.filtersContent}
      >
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'missed_calls', label: 'Missed calls' },
            { id: 'missed_reminders', label: 'Missed reminders' },
            { id: 'whatsapp', label: 'WhatsApp' },
          ] as const
        ).map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterChip, filter === f.id && styles.filterChipOn]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.filterText, filter === f.id && styles.filterTextOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={filtered.length === 0 ? styles.emptyWrap : styles.listPad}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={56} color={COLORS.gray[300]} />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySub}>
              {filter === 'missed_calls'
                ? 'Missed calls yahan dikhenge.'
                : filter === 'missed_reminders'
                ? 'Overdue reminders yahan dikhenge.'
                : filter === 'whatsapp'
                ? 'WhatsApp notifications yahan dikhenge.'
                : "You're all caught up!"}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[200],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray[100],
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.gray[900],
  },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 72, justifyContent: 'flex-end' },
  markAllText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  filters: {
    backgroundColor: COLORS.white,
    flexGrow: 0,
  },
  filtersContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.gray[100],
  },
  filterChipOn: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 12, fontWeight: '700', color: COLORS.gray[600] },
  filterTextOn: { color: '#fff' },
  listPad: { padding: SPACING.md, paddingBottom: 40 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },
  empty: { alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: COLORS.gray[800], marginTop: 8 },
  emptySub: { fontSize: 13, color: COLORS.gray[500], textAlign: 'center', lineHeight: 18 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  cardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    backgroundColor: '#F0F9FF',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray[50],
    marginRight: 10,
  },
  cardBody: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.gray[700] },
  titleUnread: { fontWeight: '800', color: COLORS.gray[900] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  message: { marginTop: 4, fontSize: 13, color: COLORS.gray[600], lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  reminderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  reminderPillText: { fontSize: 11, fontWeight: '700', color: '#0369A1' },
  time: { fontSize: 11, color: COLORS.gray[500], fontWeight: '600' },
  leadNo: { fontSize: 11, color: COLORS.primary, fontWeight: '700' },
  trashBtn: { padding: 6, marginLeft: 4 },
});
