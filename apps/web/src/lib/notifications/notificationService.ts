/**
 * Real-time Notification Service
 * Task: WA-801
 * Handles push notifications for lead events
 */

import { createClient } from '@/lib/supabase/client';

export type NotificationType =
  | 'LEAD_ASSIGNED'
  | 'LEAD_ACCEPTED'
  | 'LEAD_REJECTED'
  | 'STATUS_UPDATE'
  | 'MECHANIC_ASSIGNED'
  | 'PICKUP_ASSIGNED'
  | 'EXTRA_CHARGE_REQUESTED'
  | 'EXTRA_CHARGE_APPROVED'
  | 'MEDIA_UPLOADED'
  | 'JOB_CARD_CREATED'
  | 'INVOICE_GENERATED'
  | 'AUDIT_COMPLETED'
  | 'SLA_BREACHED';

export interface Notification {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  lead_id?: string;
  is_read: boolean;
  created_at: string;
}

/**
 * Subscribe to real-time notifications for a user
 */
export function subscribeToNotifications(
  userId: string,
  onNotification: (notification: Notification) => void
) {
  const supabase = createClient();

  const channel = supabase
    .channel('user_notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const notification = payload.new as Notification;
        onNotification(notification);
        
        // Show browser notification if permitted
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification(notification.title, {
              body: notification.message,
              icon: '/icon.png',
              badge: '/badge.png',
            });
          }
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Request browser notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string) {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
  }
}

/**
 * Fetch unread notifications count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = createClient();
  
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Fetch recent notifications
 */
export async function getRecentNotifications(
  userId: string,
  limit: number = 10
): Promise<Notification[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return data || [];
}

/**
 * Create a notification (server-side use)
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  leadId?: string
) {
  const supabase = createClient();
  
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    notification_type: type,
    title,
    message,
    lead_id: leadId,
    is_read: false,
  });

  if (error) {
    console.error('Error creating notification:', error);
  }
}

