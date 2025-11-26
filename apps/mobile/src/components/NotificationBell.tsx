/**
 * Notification Bell Component for Mobile
 * Displays notification badge with unread count
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
import { COLORS } from '../constants/theme';

interface NotificationBellProps {
  onPress: () => void;
  size?: number;
  color?: string;
}

export default function NotificationBell({ onPress, size = 24, color = COLORS.gray[700] }: NotificationBellProps) {
  const { unreadCount } = useNotifications();

  return (
    <TouchableOpacity onPress={onPress} style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="notifications-outline" size={size} color={color} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
});

