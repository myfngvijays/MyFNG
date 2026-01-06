'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/contexts/NotificationContext';
import { Bell, Check, CheckCheck, Trash2, X, ExternalLink } from 'lucide-react';
import type { Notification as NotificationRow } from '@/shared/types/notifications';
import { formatDateDMY } from "@/lib/utils";
import toast from 'react-hot-toast';
import { ensureWebPushSubscribed } from '@/lib/push/registerWebPush';

export default function NotificationCenter() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Track browser notification permission
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setDesktopPermission(Notification.permission);
      } else {
        setDesktopPermission('unsupported');
      }
    } catch {
      setDesktopPermission('unsupported');
    }
  }, []);

  const requestDesktopPermission = async () => {
    try {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        toast.error('Desktop notifications not supported in this browser');
        return;
      }
      if (Notification.permission === 'denied') {
        toast.error('Desktop notifications are blocked in browser settings');
        return;
      }
      const permission = await Notification.requestPermission();
      setDesktopPermission(permission);
      if (permission === 'granted') {
        // Phase B: true web push subscription (best-effort)
        try {
          const subRes = await ensureWebPushSubscribed();
          if (!subRes.ok && subRes.reason !== 'no_push_manager') {
            console.warn('Web push subscribe skipped:', subRes.reason);
          }
        } catch (e) {
          console.warn('Web push subscribe failed:', e);
        }
        toast.success('Desktop notifications enabled');
      }
      else if (permission === 'denied') toast.error('Desktop notifications blocked in browser settings');
      else toast('Desktop notifications not enabled');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to enable desktop notifications');
    }
  };

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-500';
      case 'HIGH':
        return 'bg-orange-500';
      case 'MEDIUM':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      LEAD_CREATED: '📋',
      LEAD_ASSIGNED: '🎯',
      LEAD_ACCEPTED: '✅',
      LEAD_REJECTED: '❌',
      TEAM_ASSIGNED: '👥',
      JOB_STARTED: '🔧',
      JOB_COMPLETED: '✔️',
      QC_APPROVED: '⭐',
      QC_REJECTED: '⚠️',
      EXTRA_WORK_REQUESTED: '💰',
      EXTRA_WORK_APPROVED: '👍',
      EXTRA_WORK_REJECTED: '👎',
      PICKUP_SCHEDULED: '📅',
      PICKUP_STARTED: '🚚',
      PICKUP_COMPLETED: '📦',
      INVOICE_GENERATED: '🧾',
      INVOICE_SENT: '📧',
      PAYMENT_RECEIVED: '💵',
      FOLLOW_UP_DUE: '⏰',
      LEAD_CLOSED: '🔒',
      STATUS_CHANGED: '🔄',
      SYSTEM_ALERT: '🔔'
    };
    return icons[type] || '📬';
  };

  const handleNotificationClick = async (notification: NotificationRow) => {
    // Mark as read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Navigate to action URL if exists
    if (notification.action_url) {
      router.push(notification.action_url);
      setIsOpen(false);
    }
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDateDMY(date);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full min-w-[20px]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-h-[600px] bg-white rounded-lg shadow-2xl border border-gray-200 z-50 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-800">Notifications</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              {/* Filter Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 text-sm rounded-full transition ${
                    filter === 'all'
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1 text-sm rounded-full transition ${
                    filter === 'unread'
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Ask to enable desktop notifications when not enabled */}
                {desktopPermission !== 'unsupported' && desktopPermission !== 'granted' && (
                  desktopPermission === 'denied' ? (
                    <button
                      type="button"
                      onClick={() => toast.error('Alerts are blocked. Enable notifications for this site in browser settings.')}
                      className="text-xs text-red-600 hover:text-red-700 font-semibold"
                      title="Desktop notifications are blocked"
                    >
                      Alerts blocked
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={requestDesktopPermission}
                      className="text-xs text-gray-700 hover:text-gray-900 font-semibold"
                      title="Enable desktop notifications"
                    >
                      Enable alerts
                    </button>
                  )
                )}

              {/* Mark All Read Button */}
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-brand-primary hover:text-brand-secondary font-semibold flex items-center gap-1"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark all read
                </button>
              )}
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <Bell className="w-12 h-12 mb-2 opacity-30" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      !notification.is_read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon & Priority */}
                      <div className="flex-shrink-0">
                        <div className="relative">
                          <span className="text-2xl">{getTypeIcon(notification.type)}</span>
                          <span
                            className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${getPriorityColor(notification.priority)}`}
                          />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className={`text-sm font-semibold text-gray-800 ${!notification.is_read ? 'font-bold' : ''}`}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            {notification.lead_number && (
                              <p className="text-xs text-brand-primary font-medium mt-1">
                                #{notification.lead_number}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              {getRelativeTime(notification.created_at)}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-2">
                          {notification.action_url && (
                            <button
                              onClick={() => handleNotificationClick(notification)}
                              className="text-xs text-brand-primary hover:text-brand-secondary font-semibold flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </button>
                          )}
                          {!notification.is_read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              Mark read
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => {
                  router.push('/dashboard/notifications');
                  setIsOpen(false);
                }}
                className="w-full text-sm text-center text-brand-primary hover:text-brand-secondary font-semibold"
              >
                View All Notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

