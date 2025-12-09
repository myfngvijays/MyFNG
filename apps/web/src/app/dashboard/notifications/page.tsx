'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/contexts/NotificationContext';
import { Bell, Check, CheckCheck, Trash2, Clock, Filter, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function NotificationsPage() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
        <p>Loading notifications...</p>
      </div>
    </div>;
  }
  
  return <NotificationsContent />;
}

function NotificationsContent() {
  const router = useRouter();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'read') return n.is_read;
    return true;
  });

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'URGENT': 'border-l-4 border-red-500 bg-red-50',
      'HIGH': 'border-l-4 border-orange-500 bg-orange-50',
      'MEDIUM': 'border-l-4 border-yellow-500 bg-yellow-50',
      'LOW': 'border-l-4 border-blue-500 bg-blue-50'
    };
    return colors[priority] || 'border-l-4 border-gray-500 bg-gray-50';
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      'URGENT': { class: 'bg-red-100 text-red-800', text: '🚨 URGENT' },
      'HIGH': { class: 'bg-orange-100 text-orange-800', text: '⚠️ HIGH' },
      'MEDIUM': { class: 'bg-yellow-100 text-yellow-800', text: '📌 MEDIUM' },
      'LOW': { class: 'bg-blue-100 text-blue-800', text: 'ℹ️ LOW' }
    };
    return badges[priority] || badges['LOW'];
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    if (notification.action_url) {
      router.push(notification.action_url);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-48 sm:h-64">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-brand-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                <button
                  onClick={() => router.back()}
                  className="p-1.5 sm:p-2 hover:bg-white/20 rounded-lg transition flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <Bell className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex-shrink-0" />
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Notifications</h1>
              </div>
              <p className="text-white/90 text-xs sm:text-sm">
                {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-1.5 sm:gap-2 transition text-xs sm:text-sm w-full sm:w-auto justify-center"
              >
                <CheckCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Mark all as read</span>
                <span className="sm:hidden">Mark all read</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="card p-3 sm:p-4">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
            <button
              onClick={() => setFilter('all')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
                filter === 'all'
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
                filter === 'unread'
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
                filter === 'read'
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Read ({notifications.length - unreadCount})
            </button>
          </div>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <div className="card text-center py-8 sm:py-10 md:py-12">
            <Bell className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-3 sm:mb-4 text-gray-300" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-1.5 sm:mb-2">No Notifications</h3>
            <p className="text-gray-500 text-sm sm:text-base">
              {filter === 'unread' 
                ? "You're all caught up! No unread notifications."
                : filter === 'read'
                ? "No read notifications yet."
                : "You don't have any notifications yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {filteredNotifications.map((notification) => {
              const priorityBadge = getPriorityBadge(notification.priority);
              
              return (
                <div
                  key={notification.id}
                  className={`card hover:shadow-lg transition-all cursor-pointer p-3 sm:p-4 ${
                    getPriorityColor(notification.priority)
                  } ${!notification.is_read ? 'ring-2 ring-brand-primary/20' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
                    {/* Priority Badge */}
                    <div className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${priorityBadge.class} flex-shrink-0`}>
                      {priorityBadge.text}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
                        <h3 className={`text-sm sm:text-base md:text-lg font-semibold ${
                          !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {notification.title}
                        </h3>
                        {!notification.is_read && (
                          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-brand-primary rounded-full flex-shrink-0 mt-1"></span>
                        )}
                      </div>

                      <p className="text-gray-700 text-xs sm:text-sm md:text-base mb-2 sm:mb-3">
                        {notification.message}
                      </p>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span>{getRelativeTime(notification.created_at)}</span>
                          </div>
                          {notification.lead_number && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <span className="font-medium text-brand-primary">
                                {notification.lead_number}
                              </span>
                            </>
                          )}
                          {notification.related_user_name && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <span>By {notification.related_user_name}</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2">
                          {!notification.is_read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="p-1.5 sm:p-2 hover:bg-white rounded-lg transition"
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="p-1.5 sm:p-2 hover:bg-white rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

