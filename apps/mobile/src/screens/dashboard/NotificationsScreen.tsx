import { formatDateDMY } from "@/lib/dateFormat";
/**
 * Notifications Screen - Mobile
 * Full screen view of all notifications with real-time updates
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications, Notification } from '../../context/NotificationContext';
import { COLORS, SIZES, SPACING } from '../../constants/theme';

export default function NotificationsScreen({ navigation }: any) {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  const getPriorityIcon = (priority: string): string => {
    const icons: Record<string, string> = {
      'URGENT': '🚨',
      'HIGH': '⚠️',
      'MEDIUM': '📌',
      'LOW': 'ℹ️',
    };
    return icons[priority] || 'ℹ️';
  };

  const getPriorityColor = (priority: string): string => {
    const colors: Record<string, string> = {
      'URGENT': COLORS.danger,
      'HIGH': COLORS.warning,
      'MEDIUM': COLORS.info,
      'LOW': COLORS.gray[500],
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

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Mechanic deep-link: if notification references a lead/job, open Mechanic Lead Detail.
    // (Other roles can extend this mapping later.)
    const leadId = notification.lead_id;
    const actionUrl = notification.action_url || '';
    const kind = (notification as any)?.metadata?.kind;
    const type = String((notification as any)?.type || '');

    if (
      leadId &&
      (String(actionUrl).includes('workshop_mechanic') ||
        String(kind || '').startsWith('MECH_') ||
        String(kind || '').startsWith('MECHANIC_') ||
        type === 'TEAM_ASSIGNED')
    ) {
      try {
        navigation.navigate('LeadDetail', { leadId });
        return;
      } catch {
        // fallthrough to alert
      }
    }

    // Default fallback
    Alert.alert(notification.title, notification.message);
  };

  const handleDelete = (notificationId: string) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteNotification(notificationId),
        },
      ]
    );
  };

  const handleMarkAllAsRead = () => {
    if (unreadCount === 0) return;
    
    Alert.alert(
      'Mark All as Read',
      `Mark all ${unreadCount} notifications as read?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark All', onPress: () => markAllAsRead() },
      ]
    );
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !item.is_read && styles.unreadItem,
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationContent}>
        {/* Priority Icon */}
        <View style={[styles.iconContainer, { borderColor: getPriorityColor(item.priority) }]}>
          <Text style={styles.priorityIcon}>{getPriorityIcon(item.priority)}</Text>
        </View>

        {/* Main Content */}
        <View style={styles.textContainer}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, !item.is_read && styles.unreadTitle]}>
              {item.title}
            </Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          
          <Text style={styles.message} numberOfLines={2}>
            {item.message}
          </Text>

          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={12} color={COLORS.gray[500]} />
            <Text style={styles.timeText}>{getRelativeTime(item.created_at)}</Text>
            {item.lead_number && (
              <>
                <Text style={styles.separator}>•</Text>
                <Text style={styles.leadNumber}>{item.lead_number}</Text>
              </>
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {!item.is_read && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                markAsRead(item.id);
              }}
              style={styles.actionButton}
            >
              <Ionicons name="checkmark" size={18} color={COLORS.success} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleDelete(item.id);
            }}
            style={styles.actionButton}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-outline" size={64} color={COLORS.gray[300]} />
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptyText}>You're all caught up!</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation?.goBack?.()} style={styles.backButton}>
            <Ionicons name="close" size={24} color={COLORS.gray[700]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
            <Ionicons name="checkmark-done" size={20} color={COLORS.primary} />
            <Text style={styles.markAllText}>Mark All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Unread Count */}
      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadBannerText}>
            {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Notifications List */}
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: SPACING.sm,
  },
  headerTitle: {
    fontSize: SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.gray[900],
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  markAllText: {
    color: COLORS.primary,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
  unreadBanner: {
    backgroundColor: COLORS.info + '20',
    padding: SPACING.sm,
    alignItems: 'center',
  },
  unreadBannerText: {
    color: COLORS.info,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
  notificationItem: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.xs,
    borderRadius: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  unreadItem: {
    backgroundColor: COLORS.info + '05',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  notificationContent: {
    flexDirection: 'row',
    padding: SPACING.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginRight: SPACING.sm,
  },
  priorityIcon: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[700],
    flex: 1,
  },
  unreadTitle: {
    color: COLORS.gray[900],
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: SPACING.xs,
  },
  message: {
    fontSize: SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: SPACING.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  timeText: {
    fontSize: SIZES.xs,
    color: COLORS.gray[500],
  },
  separator: {
    color: COLORS.gray[400],
  },
  leadNumber: {
    fontSize: SIZES.xs,
    color: COLORS.gray[700],
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'column',
    gap: SPACING.xs,
  },
  actionButton: {
    padding: SPACING.xs,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.gray[700],
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: SIZES.md,
    color: COLORS.gray[500],
    marginTop: SPACING.xs,
  },
});

