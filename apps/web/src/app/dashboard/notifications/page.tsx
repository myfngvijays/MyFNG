'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/contexts/NotificationContext';
import { Bell, Check, CheckCheck, Trash2, Clock, Filter, Phone, MessageCircle } from 'lucide-react';
import { formatDateDMY } from "@/lib/utils";
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';

export const dynamic = 'force-dynamic';

export default function NotificationsPage() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
            <p className="text-slate-600">Loading notifications...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  return <NotificationsContent />;
}

function NotificationsContent() {
  const router = useRouter();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  
  type NotifTab = 'all' | 'missed_calls' | 'missed_reminders' | 'whatsapp';
  const [filter, setFilter] = useState<NotifTab>('all');
  const [missedCalls, setMissedCalls] = useState<any[]>([]);
  const [missedReminders, setMissedReminders] = useState<any[]>([]);
  const [waMessages, setWaMessages] = useState<any[]>([]);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data: calls } = await supabase
        .from('telecaller_call_logs')
        .select('id, customer_number, call_status, created_at, call_duration')
        .eq('telecaller_id', uid)
        .neq('call_status', 'ANSWERED')
        .order('created_at', { ascending: false })
        .limit(40);
      setMissedCalls(calls || []);
      const { data: reminders } = await supabase
        .from('telecaller_follow_ups')
        .select('id, reason, scheduled_time, status, lead:service_leads(customer_name, lead_number)')
        .eq('telecaller_id', uid)
        .eq('status', 'PENDING')
        .lt('scheduled_time', new Date().toISOString())
        .order('scheduled_time', { ascending: false })
        .limit(40);
      setMissedReminders(reminders || []);
    })();
    void fetch('/api/whatsapp/recent-inbound')
      .then((res) => res.json())
      .then((json) => setWaMessages(Array.isArray(json?.messages) ? json.messages : []))
      .catch(() => setWaMessages([]));
  }, []);

  const blobOf = (n: any) => `${n?.type || ''} ${n?.title || ''} ${n?.message || ''}`.toLowerCase();
  const filteredNotifications = notifications.filter((n) => {
    const blob = blobOf(n);
    if (filter === 'missed_calls') return /missed call|call missed|no answer|not answered/.test(blob);
    if (filter === 'missed_reminders') return /reminder|follow-up|follow up|callback/.test(blob);
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
    return formatDateDMY(date);
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
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#004AAD]"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
            <p className="text-sm text-slate-500">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          {unreadCount > 0 ? (
            <button
              onClick={markAllAsRead}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all as read
            </button>
          ) : null}
        </div>

        {/* Filter Tabs */}
        <div className="card p-3 sm:p-4">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
            {(
              [
                { id: 'all' as const, label: 'All notifications', count: notifications.length },
                { id: 'missed_calls' as const, label: 'Missed calls', count: missedCalls.length },
                { id: 'missed_reminders' as const, label: 'Missed reminders', count: missedReminders.length },
                { id: 'whatsapp' as const, label: 'WhatsApp', count: waMessages.length },
              ]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
                  filter === tab.id
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        {filter === 'missed_calls' ? (
          missedCalls.length === 0 ? (
            <div className="card text-center py-10">
              <Phone className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-700">No missed calls</h3>
            </div>
          ) : (
            <div className="space-y-2">
              {missedCalls.map((call) => (
                <div key={call.id} className="card flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{call.customer_number || 'Unknown number'}</p>
                    <p className="text-xs text-gray-500">{call.call_status || 'MISSED'}</p>
                  </div>
                  <span className="text-xs text-gray-400">{call.created_at ? getRelativeTime(call.created_at) : ''}</span>
                </div>
              ))}
            </div>
          )
        ) : filter === 'whatsapp' ? (
          waMessages.length === 0 ? (
            <div className="card text-center py-10">
              <MessageCircle className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-700">No WhatsApp messages</h3>
            </div>
          ) : (
            <div className="space-y-2">
              {waMessages.map((msg) => (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('myfng:open-wa-chat', {
                        detail: { phone: msg.phone, preview: msg.text },
                      }),
                    );
                  }}
                  className="card flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{msg.name || msg.phone}</p>
                    <p className="truncate text-xs text-gray-500">{msg.text}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">{msg.created_at ? getRelativeTime(msg.created_at) : ''}</span>
                </button>
              ))}
            </div>
          )
        ) : filter === 'missed_reminders' ? (
          missedReminders.length === 0 ? (
            <div className="card text-center py-10">
              <Clock className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-700">No missed reminders</h3>
            </div>
          ) : (
            <div className="space-y-2">
              {missedReminders.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => router.push('/dashboard/telecaller/followups')}
                  className="card flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{row.lead?.customer_name || 'Reminder'}</p>
                    <p className="text-xs text-gray-500">{row.reason || 'Follow-up overdue'}</p>
                  </div>
                  <span className="text-xs text-red-500">{row.scheduled_time ? getRelativeTime(row.scheduled_time) : ''}</span>
                </button>
              ))}
            </div>
          )
        ) : filteredNotifications.length === 0 ? (
          <div className="card text-center py-8 sm:py-10 md:py-12">
            <Bell className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-3 sm:mb-4 text-gray-300" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-1.5 sm:mb-2">No Notifications</h3>
            <p className="text-gray-500 text-sm sm:text-base">
              {filter === 'whatsapp' ? 'No WhatsApp notifications yet.' : "You don't have any notifications yet."}
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
    </DashboardLayout>
  );
}

