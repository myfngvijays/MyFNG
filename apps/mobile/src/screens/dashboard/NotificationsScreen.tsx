/**
 * Notifications Screen - Mobile
 * Safe-area aware header + filters for reminders / unread.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDateDMY } from "@/lib/dateFormat";
import { useNotifications, Notification } from '../../context/NotificationContext';
import { COLORS, SIZES, SPACING } from '../../constants/theme';

type NotifFilter = 'all' | 'unread' | 'reminders';

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

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const rows = Array.isArray(notifications) ? notifications : [];
    if (filter === 'unread') return rows.filter((n) => !n.is_read);
    if (filter === 'reminders') {
      return rows.filter((n) => {
        const kind = String((n as any)?.metadata?.kind || '').toUpperCase();
        const type = String((n as any)?.type || '').toUpperCase();
        const title = String(n.title || '').toLowerCase();
        return (
          kind.includes('FOLLOWUP') ||
          type.includes('FOLLOW_UP') ||
          title.includes('callback') ||
          title.includes('follow-up') ||
          title.includes('reminder')
        );
      });
    }
    return rows;
  }, [notifications, filter]);

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
    if (!notification.is_read) await markAsRead(notification.id);

    const leadId = notification.lead_id;
    const actionUrl = notification.action_url || '';
    const kind = (notification as any)?.metadata?.kind;
    const type = String((notification as any)?.type || '');

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
        unreadCount > 0 ? (
          <View style={styles.header}>
            <View style={{ width: 36 }} />
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAll}>
              <Ionicons name="checkmark-done" size={18} color={COLORS.primary} />
              <Text style={styles.markAllText}>Mark all</Text>
            </TouchableOpacity>
          </View>
        ) : null
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

      <View style={styles.filters}>
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'unread', label: `Unread${unreadCount ? ` (${unreadCount})` : ''}` },
            { id: 'reminders', label: 'Reminders' },
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
      </View>

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
              {filter === 'reminders'
                ? 'Callback reminders yahan dikhenge jab due honge.'
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
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
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
