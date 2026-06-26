'use client';

import { useEffect, useState } from 'react';
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Bell,
  Send,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  History,
  XCircle,
  Apple,
  ArrowRight,
  Megaphone,
  CreditCard,
  Wrench,
  Calendar,
  Gift,
} from 'lucide-react';

type AdminProfile = {
  name: string;
  role: string;
  initials: string;
  greeting: string;
};

type DashboardData = {
  kpis: {
    active_devices: number;
    android_devices: number;
    ios_devices: number;
    total_notifications: number;
    successfully_delivered: number;
    failed_deliveries: number;
    delivery_rate: number;
    push_globally_enabled: boolean;
  };
  trend_7d: Array<{ day: string; sent: number; failed: number }>;
  type_breakdown: Record<string, number>;
  platform_status: {
    android: { label: string; status: string; message: string };
    ios: { label: string; status: string; message: string };
  };
  recent_broadcasts: Array<{
    id: string;
    recipient: string;
    status: string;
    sent_at: string;
    meta?: {
      title?: string;
      body?: string;
      delivered?: number;
      failed?: number;
      notification_type?: string;
    };
  }>;
};

const TYPE_META: Record<string, { label: string; color: string }> = {
  offer: { label: 'Offer', color: '#f97316' },
  promotional: { label: 'Promotional', color: '#ef4444' },
  reminder: { label: 'Reminder', color: '#3b82f6' },
  booking_update: { label: 'Booking Update', color: '#8b5cf6' },
  general: { label: 'General', color: '#64748b' },
  transactional: { label: 'General', color: '#64748b' },
  payment: { label: 'Payment', color: '#059669' },
  service_due: { label: 'Service Due', color: '#ea580c' },
  system: { label: 'General', color: '#64748b' },
};

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function typeIcon(type: string) {
  switch (type) {
    case 'offer':
    case 'promotional':
      return Gift;
    case 'payment':
      return CreditCard;
    case 'service_due':
      return Wrench;
    case 'booking_update':
      return Calendar;
    case 'reminder':
      return Bell;
    default:
      return Megaphone;
  }
}

function StatCard({
  label,
  value,
  hint,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="push-stat-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {hint ? <div className="text-xs mt-1.5">{hint}</div> : null}
        </div>
        <div
          className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function PushDashboardSection({
  onNavigate,
  admin,
}: {
  onNavigate: (section: 'dashboard' | 'firebase' | 'compose' | 'history') => void;
  admin: AdminProfile;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/super_admin/notifications/dashboard');
        const json = await res.json();
        if (res.ok) setData(json);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const k = data?.kpis;
  const firstName = admin.name.split(' ')[0] || 'Admin';

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-28 push-card" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 push-stat-card" />
          ))}
        </div>
      </div>
    );
  }

  const typeData = Object.entries(data?.type_breakdown || {})
    .map(([key, value]) => ({
      key,
      name: TYPE_META[key]?.label || key.replace(/_/g, ' '),
      value,
      fill: TYPE_META[key]?.color || '#64748b',
    }))
    .sort((a, b) => b.value - a.value);

  const defaultTypes = [
    'offer',
    'promotional',
    'reminder',
    'booking_update',
    'general',
    'payment',
    'service_due',
  ];
  if (typeData.length === 0) {
    defaultTypes.forEach((key) => {
      typeData.push({
        key,
        name: TYPE_META[key].label,
        value: 0,
        fill: TYPE_META[key].color,
      });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
            {admin.greeting}, {firstName} 👋
          </h2>
          <p className="text-gray-600 mt-2">
            Here&apos;s what&apos;s happening with your push notifications today.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <button
            type="button"
            className="push-btn-primary inline-flex items-center gap-2"
            onClick={() => onNavigate('compose')}
          >
            <Send className="w-4 h-4" />
            Send Notification
          </button>
          <button
            type="button"
            className="push-btn-secondary inline-flex items-center gap-2"
            onClick={() => onNavigate('history')}
          >
            <History className="w-4 h-4" />
            View History
          </button>
        </div>
      </div>

      {!k?.push_globally_enabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong>Push is disabled globally.</strong> Enable it in Firebase Settings before sending
            broadcasts.
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Notifications"
          value={k?.total_notifications || 0}
          hint={<span className="text-gray-500">All-time campaigns sent</span>}
          icon={<Bell className="w-5 h-5" />}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Successfully Delivered"
          value={k?.successfully_delivered || 0}
          hint={
            <span className="text-blue-600 font-semibold">
              {k?.delivery_rate || 0}% delivery rate
            </span>
          }
          icon={<CheckCircle2 className="w-5 h-5" />}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Failed Deliveries"
          value={k?.failed_deliveries || 0}
          hint={<span className="text-gray-500">Auto-retried &amp; logged</span>}
          icon={<XCircle className="w-5 h-5" />}
          iconBg="bg-red-50"
          iconColor="text-red-500"
        />
        <StatCard
          label="Active Devices"
          value={k?.active_devices || 0}
          hint={
            <span className="text-gray-500">
              {k?.android_devices || 0} Android · {k?.ios_devices || 0} iOS
            </span>
          }
          icon={<Smartphone className="w-5 h-5" />}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="push-card p-5">
          <div className="mb-4">
            <h3 className="font-bold text-gray-900">Delivery Trend</h3>
            <p className="text-xs text-gray-500 mt-0.5">Last 7 days</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.trend_7d || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                  <Line
                  type="monotone"
                  dataKey="sent"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Sent"
                />
                <Line
                  type="monotone"
                  dataKey="failed"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Failed"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="push-card p-5">
          <div className="mb-4">
            <h3 className="font-bold text-gray-900">Notifications by Type</h3>
            <p className="text-xs text-gray-500 mt-0.5">Last 7 days</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="push-card p-5">
          <div className="mb-4">
            <h3 className="font-bold text-gray-900">Platform Connection Status</h3>
            <p className="text-xs text-gray-500 mt-0.5">FCM HTTP v1 API</p>
          </div>
          <div className="space-y-3">
            {[
              {
                key: 'android',
                icon: Smartphone,
                data: data?.platform_status?.android,
              },
              {
                key: 'ios',
                icon: Apple,
                data: data?.platform_status?.ios,
              },
            ].map(({ key, icon: Icon, data: platform }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-gray-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{platform?.label}</p>
                    <p className="text-xs text-gray-500 truncate">{platform?.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      platform?.status === 'connected'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {platform?.status === 'connected' ? 'Connected' : 'Pending'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('firebase')}
                    className="text-xs font-semibold text-blue-600 inline-flex items-center gap-0.5 hover:underline"
                  >
                    Configure
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
            Push delivery uses Firebase Cloud Messaging. iOS device tokens are routed through Apple
            Push Notification service (APNs) via Firebase.
          </p>
        </div>

        <div className="push-card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Recent Notifications</h3>
            <p className="text-xs text-gray-500 mt-0.5">Last 5 campaigns sent</p>
          </div>
          <div className="divide-y divide-gray-100">
            {(data?.recent_broadcasts || []).length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">No broadcasts sent yet.</div>
            ) : (
              (data?.recent_broadcasts || []).map((log) => {
                const type = log.meta?.notification_type || 'general';
                const typeLabel = TYPE_META[type]?.label || type.replace(/_/g, ' ');
                const Icon = typeIcon(type);
                const delivered = log.meta?.delivered || 0;
                const failed = log.meta?.failed || 0;
                const isFailed = log.status === 'FCM_FAILED' || log.status === 'NO_DEVICES';
                const isCompleted = log.status === 'SENT' && delivered > 0;

                return (
                  <div key={log.id} className="px-5 py-4 flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {log.meta?.title || log.recipient}
                        </p>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            isFailed
                              ? 'bg-red-100 text-red-700'
                              : isCompleted
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isFailed ? 'Failed' : isCompleted ? 'Completed' : log.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {typeLabel} · {formatRelativeTime(log.sent_at)}
                      </p>
                      {delivered > 0 || failed > 0 ? (
                        <p className="text-xs text-gray-400 mt-1">
                          {delivered} successful · {failed} failed
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="px-5 py-3 border-t border-gray-100">
            <button
              type="button"
              className="text-sm font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
              onClick={() => onNavigate('history')}
            >
              View all notifications
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
