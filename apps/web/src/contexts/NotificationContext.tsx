'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Notification as NotificationRow } from '@/shared/types/notifications';
import { isNotificationWithinRetention, notificationRetentionCutoffIso } from '@/shared/types/notifications';
import toast from 'react-hot-toast';
import { ensureWebPushSubscribed } from '@/lib/push/registerWebPush';
import { usePathname } from 'next/navigation';

interface NotificationContextType {
  notifications: NotificationRow[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStaffApp = pathname?.startsWith('/dashboard') || pathname === '/login' || pathname?.startsWith('/login/');
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const supabase = createClient();

  // Ask once (per browser) to enable desktop notifications on app open
  useEffect(() => {
    if (!userId) return;
    if (typeof window === 'undefined') return;
    const BrowserNotification = (window as any).Notification as (typeof Notification | undefined);
    if (!BrowserNotification) return;

    const key = 'myfng_desktop_notif_prompt_v1';
    try {
      if (window.localStorage.getItem(key) === '1') return;
    } catch {
      // ignore storage errors
    }

    const perm = BrowserNotification.permission;
    if (perm === 'granted') return;

    // Show a one-time prompt (user can still enable later from the bell dropdown)
    toast.custom(
      (t) => (
        <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-4 w-[360px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">Enable desktop alerts?</div>
              <div className="text-xs text-gray-600 mt-1">
                Get notified instantly for lead updates while the app is open.
              </div>
              {perm === 'denied' && (
                <div className="text-xs text-red-600 mt-2">
                  Alerts are blocked in browser settings. Please allow notifications for this site.
                </div>
              )}
            </div>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600"
              onClick={() => {
                toast.dismiss(t.id);
                try {
                  window.localStorage.setItem(key, '1');
                } catch {
                  // ignore
                }
              }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
              onClick={() => {
                toast.dismiss(t.id);
                try {
                  window.localStorage.setItem(key, '1');
                } catch {
                  // ignore
                }
              }}
            >
              Later
            </button>
            <button
              type="button"
              disabled={perm === 'denied'}
              className={`text-xs px-3 py-1.5 rounded text-white ${
                perm === 'denied'
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-brand-primary hover:bg-brand-secondary'
              }`}
              onClick={async () => {
                try {
                  const p = await BrowserNotification.requestPermission();
                  if (p === 'granted') {
                    // Phase B: true web push subscription (best-effort)
                    try {
                      await ensureWebPushSubscribed();
                    } catch (e) {
                      console.warn('Web push subscribe failed:', e);
                    }
                    toast.success('Desktop notifications enabled');
                  }
                  else if (p === 'denied') toast.error('Desktop notifications blocked in browser settings');
                  else toast('Desktop notifications not enabled');
                } catch (e: any) {
                  toast.error(e?.message || 'Failed to enable desktop notifications');
                } finally {
                  toast.dismiss(t.id);
                  try {
                    window.localStorage.setItem(key, '1');
                  } catch {
                    // ignore
                  }
                }
              }}
            >
              Enable
            </button>
          </div>
        </div>
      ),
      { duration: Infinity }
    );
  }, [userId]);

  // Fetch user ID
  useEffect(() => {
    if (!isStaffApp) {
      setLoading(false);
      return;
    }
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Prefer users_login.id == auth.user.id (most reliable), then fallback to email/phone.
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
      }
    };

    fetchUser();
  }, [isStaffApp]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      console.log('[NotificationContext] No userId, skipping fetch');
      setLoading(false);
      return;
    }

    try {
      console.log('[NotificationContext] Fetching notifications for userId:', userId);
      const cutoff = notificationRetentionCutoffIso();
      void supabase.from('notifications').delete().eq('user_id', userId).lt('created_at', cutoff);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[NotificationContext] Error fetching notifications:', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          userId
        });
        return;
      }

      console.log('[NotificationContext] Fetched notifications:', { count: data?.length || 0, userId });
      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error: any) {
      console.error('[NotificationContext] Unexpected error:', {
        error: error?.message,
        stack: error?.stack,
        userId
      });
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

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newNotification = payload.new as NotificationRow;
          if (!isNotificationWithinRetention(newNotification.created_at)) return;

          // Add to notifications list
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Show toast notification
          if (newNotification.priority === 'URGENT') {
            toast.error(newNotification.title, {
              duration: 5000,
              icon: '🚨'
            });
          } else if (newNotification.priority === 'HIGH') {
            toast(newNotification.title, {
              duration: 4000,
              icon: '⚠️'
            });
          } else {
            toast.success(newNotification.title, {
              duration: 3000
            });
          }

          // Phase A: Desktop notification (only when app is open & permission granted)
          try {
            if (typeof window !== 'undefined') {
              const BrowserNotification = (window as any).Notification as (typeof Notification | undefined);
              if (BrowserNotification && BrowserNotification.permission === 'granted') {
                const n = new BrowserNotification(newNotification.title, {
                  body: newNotification.message,
                  icon: '/icon.png',
                });
                n.onclick = () => {
                  try {
                    window.focus();
                    if (newNotification.action_url) {
                      window.location.href = newNotification.action_url;
                    }
                  } catch {
                    // ignore
                  }
                };
              }
            }
          } catch {
            // ignore (desktop notifications are best-effort)
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
          const updatedNotification = payload.new as NotificationRow;
          
          setNotifications(prev => 
            prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
          );
          
          // Update unread count
          if (updatedNotification.is_read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

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
        console.error('Error marking notification as read:', error);
        return;
      }

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error:', error);
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
        console.error('Error marking all as read:', error);
        return;
      }

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        console.error('Error deleting notification:', error);
        return;
      }

      const deletedNotification = notifications.find(n => n.id === notificationId);
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error:', error);
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
