/**
 * Notification Context for Mobile App
 * Provides real-time notification system with Supabase
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Alert } from 'react-native';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  // Stored in DB as MyFNG NotificationType (e.g., TEAM_ASSIGNED, QC_REJECTED, SYSTEM_ALERT, etc.)
  type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  is_read: boolean;
  read_at: string | null;
  action_url: string | null;
  lead_number: string | null;
  lead_id: string | null;
  created_at: string;
  metadata: any;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  // Increments when a lead/job impacting notification arrives; consumers can refetch job lists.
  jobRefreshTick: number;
  // Increments when pickup/delivery impacting notification arrives; pickup boy screens can refetch task lists.
  pickupRefreshTick: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [jobRefreshTick, setJobRefreshTick] = useState(0);
  const [pickupRefreshTick, setPickupRefreshTick] = useState(0);

  // Fetch user ID from auth
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          if (__DEV__) console.log('No authenticated user');
          setLoading(false);
          return;
        }

        // Prefer users_login.id == auth.user.id, else fallback to email/phone
        const email = (user.email || '').trim();
        const phone = (user.phone || '').trim();

        const { data: byId } = await supabase
          .from('users_login')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        const { data: byEmail } = !byId && email
          ? await supabase.from('users_login').select('id').ilike('email', email).maybeSingle()
          : { data: null as any };

        const { data: byPhone } = !byId && !byEmail && phone
          ? await supabase.from('users_login').select('id').eq('phone', phone).maybeSingle()
          : { data: null as any };

        const profile = byId || byEmail || byPhone;
        if (profile?.id) setUserId(profile.id);
      } catch (error) {
        if (__DEV__) console.error('Error in fetchUser:', error);
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        if (error.code === 'PGRST204' || error.code === 'PGRST205') {
          if (__DEV__) console.log('Notifications table not found - feature will be available after database migration');
          setNotifications([]);
          setUnreadCount(0);
        } else if (__DEV__) {
          console.error('Error fetching notifications:', error);
        }
        return;
      }

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      if (__DEV__) console.error('Error:', error);
      // Don't crash, just set empty state
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchNotifications();
    }
  }, [userId, fetchNotifications]);

  // Real-time subscription for new and updated notifications
  useEffect(() => {
    if (!userId) return;

    if (__DEV__) console.log('Setting up notification subscription for user:', userId);

    const checkTable = async () => {
      const { error } = await supabase.from('notifications').select('id').limit(1);
      if (error) {
        if (__DEV__) console.log('Notifications table not available - skipping realtime subscription');
        return null;
      }
      return true;
    };

    checkTable().then((exists) => {
      if (!exists) return;

      const channel = supabase
        .channel('mobile_notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            if (__DEV__) console.log('New notification received');
            const newNotification = payload.new as Notification;

            // Add to notifications list
            setNotifications(prev => [newNotification, ...prev]);
            setUnreadCount(prev => prev + 1);

            // Signal job list refresh for mechanic/job-impacting notifications
            try {
              const type = String((newNotification as any)?.type || '');
              const leadId = (newNotification as any)?.lead_id;
              const kind = (newNotification as any)?.metadata?.kind;
              const jobTypes = new Set([
                'TEAM_ASSIGNED',
                'JOB_STARTED',
                'JOB_COMPLETED',
                'QC_APPROVED',
                'QC_REJECTED',
                'PICKUP_COMPLETED',
                'SLA_WARNING',
                'SLA_BREACH',
                'SYSTEM_ALERT',
                'CUSTOMER_COMPLAINT',
                'AUDIT_FLAGGED',
              ]);
              const isJobImpacting = Boolean(leadId) && (jobTypes.has(type) || String(kind || '').startsWith('MECH_') || String(kind || '').startsWith('MECHANIC_'));
              if (isJobImpacting) setJobRefreshTick((t) => t + 1);

              const pickupTypes = new Set([
                'PICKUP_TASK_ASSIGNED',
                'PICKUP_ACCEPTANCE_PENDING',
                'PICKUP_REASSIGNED',
                'PICKUP_NAV_REMINDER',
                'PICKUP_ARRIVED',
                'OTP_VERIFIED',
                'PICKUP_COMPLETED',
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
              ]);
              const isPickupImpacting = Boolean(leadId) && (pickupTypes.has(type) || String(kind || '').startsWith('PICKUP_'));
              if (isPickupImpacting) setPickupRefreshTick((t) => t + 1);
            } catch {
              // ignore
            }

            // Show native alert for important notifications
            if (newNotification.priority === 'URGENT' || newNotification.priority === 'HIGH') {
              Alert.alert(
                getPriorityIcon(newNotification.priority) + ' ' + newNotification.title,
                newNotification.message,
                [{ text: 'OK' }]
              );
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            const updatedNotification = payload.new as Notification;

            setNotifications(prev =>
              prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
            );

            // Update unread count if marked as read
            if (updatedNotification.is_read) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          }
        )
        .subscribe();

      return () => {
        if (__DEV__) console.log('Unsubscribing from notifications');
        channel.unsubscribe();
      };
    });
  }, [userId]);

  const getPriorityIcon = (priority: string): string => {
    const icons: Record<string, string> = {
      'URGENT': '🚨',
      'HIGH': '⚠️',
      'MEDIUM': '📌',
      'LOW': 'ℹ️'
    };
    return icons[priority] || 'ℹ️';
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) {
        if (__DEV__) console.error('Error marking notification as read:', error);
        return;
      }

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      if (__DEV__) console.error('Error:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        if (__DEV__) console.error('Error marking all as read:', error);
        return;
      }

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      if (__DEV__) console.error('Error:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        if (__DEV__) console.error('Error deleting notification:', error);
        return;
      }

      const deletedNotification = notifications.find(n => n.id === notificationId);

      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      if (__DEV__) console.error('Error:', error);
    }
  };

  const refreshNotifications = async () => {
    await fetchNotifications();
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        jobRefreshTick,
        pickupRefreshTick,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refreshNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

