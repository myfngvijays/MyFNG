'use client';

import { useEffect, useState } from 'react';
import {
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
  Users,
  AlertTriangle,
  CheckCircle2,
  History,
  Flame,
  TrendingUp,
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
    customer_devices: number;
    staff_devices: number;
    legacy_expo_devices: number;
    customers_push_on: number;
    customers_push_off: number;
    broadcasts_today: number;
    broadcasts_today_sent: number;
    broadcasts_today_failed: number;
    broadcasts_week: number;
    broadcasts_week_sent: number;
    devices_delivered_week: number;
    active_templates: number;
    push_globally_enabled: boolean;
  };
  trend_7d: Array<{ day: string; sent: number; failed: number }>;
  role_breakdown: Record<string, number>;
  recent_broadcasts: Array<{
    id: string;
    recipient: string;
    status: string;
    sent_at: string;
    meta?: { title?: string; body?: string; devices?: number; sent_by?: string };
  }>;
};

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="push-stat-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          {hint ? <p className="text-xs text-gray-500 mt-1">{hint}</p> : null}
        </div>
        <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
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
        <div className="h-40 push-card" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 push-stat-card" />
          ))}
        </div>
      </div>
    );
  }

  const roleData = Object.entries(data?.role_breakdown || {}).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value,
  }));

  return (
    <div className="space-y-6">
      <div className="push-card p-6 md:p-8">
        <p className="text-sm text-gray-500">{admin.greeting},</p>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-1">
          {firstName} 👋
        </h2>
        <p className="text-gray-600 mt-3 text-base md:text-lg">
          Here&apos;s what&apos;s happening with your push notifications today.
        </p>
        <div className="flex flex-wrap gap-3 mt-6">
          <button type="button" className="push-btn-primary inline-flex items-center gap-2" onClick={() => onNavigate('compose')}>
            <Send className="w-4 h-4" />
            Send Notification
          </button>
          <button type="button" className="push-btn-secondary inline-flex items-center gap-2" onClick={() => onNavigate('history')}>
            <History className="w-4 h-4" />
            View History
          </button>
        </div>
      </div>

      {!k?.push_globally_enabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong>Push is disabled globally.</strong> Enable it in Firebase Settings before sending broadcasts.
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Active Devices"
          value={k?.active_devices || 0}
          hint={`${k?.customer_devices || 0} customer · ${k?.staff_devices || 0} staff`}
          icon={<Smartphone className="w-5 h-5" />}
        />
        <StatCard
          label="Broadcasts Today"
          value={k?.broadcasts_today || 0}
          hint={`${k?.broadcasts_today_sent || 0} sent · ${k?.broadcasts_today_failed || 0} failed`}
          icon={<Bell className="w-5 h-5" />}
        />
        <StatCard
          label="Delivered This Week"
          value={k?.devices_delivered_week || 0}
          hint={`${k?.broadcasts_week_sent || 0} successful broadcasts`}
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <StatCard
          label="Push Enabled Users"
          value={k?.customers_push_on || 0}
          hint={`${k?.customers_push_off || 0} opted out`}
          icon={<Users className="w-5 h-5" />}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="push-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-gray-900">7-Day Broadcast Trend</h3>
              <p className="text-xs text-gray-500">Sent vs failed admin broadcasts</p>
            </div>
          </div>
          <div className="h-56">
            {(data?.trend_7d || []).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.trend_7d}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="sent" fill="#2563eb" name="Sent" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" fill="#f59e0b" name="Failed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">
                No broadcasts in the last 7 days yet.
              </div>
            )}
          </div>
        </div>

        <div className="push-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-orange-500" />
            <div>
              <h3 className="font-bold text-gray-900">Audience Breakdown</h3>
              <p className="text-xs text-gray-500">Broadcasts by target role (7d)</p>
            </div>
          </div>
          <div className="h-56">
            {roleData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roleData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">
                No role breakdown data yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="push-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">Recent Broadcasts</h3>
            <p className="text-xs text-gray-500 mt-0.5">Latest notifications sent from admin</p>
          </div>
          <button type="button" className="text-sm font-semibold text-blue-600 hover:text-blue-700" onClick={() => onNavigate('history')}>
            View all
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {(data?.recent_broadcasts || []).length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">No broadcasts sent yet.</div>
          ) : (
            (data?.recent_broadcasts || []).map((log) => (
              <div key={log.id} className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">
                    {log.meta?.title || log.recipient}
                  </p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{log.meta?.body || '—'}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(log.sent_at).toLocaleString('en-IN')} · {log.recipient}
                  </p>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    log.status === 'SENT' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {log.status === 'SENT' ? `${log.meta?.devices || 0} sent` : log.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
