/**
 * Notifications Hook
 * Task: WA-801
 * React hook for managing notifications
 */

'use client';

import { useEffect, useState } from 'react';
import {
  subscribeToNotifications,
  getUnreadCount,
  getRecentNotifications,
  markAsRead,
  requestNotificationPermission,
  type Notification,
} from '@/lib/notifications/notificationService';

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Request notification permission
    requestNotificationPermission();

    // Fetch initial notifications
    async function fetchInitialData() {
      if (!userId) {
        setLoading(false);
        return;
      }
      
      const [notifs, count] = await Promise.all([
        getRecentNotifications(userId, 20),
        getUnreadCount(userId),
      ]);

      setNotifications(notifs);
      setUnreadCount(count);
      setLoading(false);
    }

    fetchInitialData();

    // Subscribe to real-time updates
    if (!userId) {
      return () => {};
    }
    
    const unsubscribe = subscribeToNotifications(userId, (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    return unsubscribe;
  }, [userId]);

  const markNotificationAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    const unreadNotifs = notifications.filter((n) => !n.is_read);
    await Promise.all(unreadNotifs.map((n) => markAsRead(n.id)));
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead: markNotificationAsRead,
    markAllAsRead,
  };
}

