'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Activity, Calendar, MessageSquare, ShieldCheck, TrendingUp, Zap } from 'lucide-react';

const RANGE_OPTIONS = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
];

type DashboardOverview = {
  kpis: {
    total_messages: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    delivery_rate: number;
    read_rate: number;
    failure_rate: number;
    total_templates: number;
    approved_templates: number;
  };
  top_templates: Array<{ name: string; count: number }>;
  recent_events: Array<{ id: string; status: string; note: string | null; time: string }>;
};

export default function SuperAdminWhatsAppDashboardPage() {
  const [range, setRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardOverview | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/whatsapp/dashboard/overview?range=${encodeURIComponent(range)}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json?.success) throw new Error(json?.error || 'Failed to load dashboard');
        setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const kpiCards = useMemo(
    () => [
      {
        title: 'Messages Processed',
        value: String(data?.kpis.total_messages || 0),
        delta: `${data?.kpis.sent || 0} sent`,
        icon: MessageSquare,
        tone: 'text-blue-600 bg-blue-50',
      },
      {
        title: 'Delivery Rate',
        value: `${(data?.kpis.delivery_rate || 0).toFixed(1)}%`,
        delta: `${data?.kpis.delivered || 0} delivered`,
        icon: Activity,
        tone: 'text-emerald-600 bg-emerald-50',
      },
      {
        title: 'Template Health',
        value: `${data?.kpis.approved_templates || 0}/${data?.kpis.total_templates || 0}`,
        delta: 'approved/total',
        icon: ShieldCheck,
        tone: 'text-violet-600 bg-violet-50',
      },
      {
        title: 'Read Rate',
        value: `${(data?.kpis.read_rate || 0).toFixed(1)}%`,
        delta: `${data?.kpis.read || 0} viewed`,
        icon: TrendingUp,
        tone: 'text-amber-600 bg-amber-50',
      },
    ],
    [data]
  );

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6 p-4 sm:p-6">
      <div className="rounded-xl bg-gradient-to-r from-brand-secondary to-brand-primary p-5 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-yellow-300">WhatsApp Dashboard</h1>
            <p className="mt-1 text-sm text-blue-100">
              Advanced monitoring for template lifecycle, delivery quality and channel operations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/super_admin/whatsapp-templates"
              className="inline-flex items-center rounded-lg bg-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/30"
            >
              Manage Templates
            </Link>
            <Link
              href="/dashboard/super_admin/bot-flow"
              className="inline-flex items-center rounded-lg bg-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/30"
            >
              Open Bot Flow
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <Calendar className="h-4 w-4 text-gray-500" />
            Time Range
          </div>
          <div className="flex gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setRange(option.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  range === option.id ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-500">{card.title}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{loading ? '—' : card.value}</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-600">{loading ? 'Loading...' : card.delta}</p>
                </div>
                <div className={`rounded-lg p-2 ${card.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Delivery Health Snapshot</h2>
            <span className="text-xs font-medium text-gray-500">Updated just now</span>
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                <span>Sent</span>
                <span>{loading ? '—' : `${data?.kpis.sent || 0}`}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div className="h-2 w-full rounded-full bg-blue-500" />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                <span>Delivered</span>
                <span>{loading ? '—' : `${(data?.kpis.delivery_rate || 0).toFixed(1)}%`}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, data?.kpis.delivery_rate || 0))}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                <span>Read</span>
                <span>{loading ? '—' : `${(data?.kpis.read_rate || 0).toFixed(1)}%`}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div className="h-2 rounded-full bg-violet-500" style={{ width: `${Math.max(0, Math.min(100, data?.kpis.read_rate || 0))}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                <span>Failed</span>
                <span>{loading ? '—' : `${(data?.kpis.failure_rate || 0).toFixed(1)}%`}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div className="h-2 rounded-full bg-red-500" style={{ width: `${Math.max(0, Math.min(100, data?.kpis.failure_rate || 0))}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Quick Actions</h3>
          <div className="mt-3 space-y-2">
            <Link href="/dashboard/super_admin/whatsapp-templates" className="block rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Sync & Review Templates
            </Link>
            <Link href="/dashboard/super_admin/bot-flow" className="block rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Configure Bot Branching
            </Link>
            <button type="button" className="w-full rounded-lg border px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
              Check Webhook Status
            </button>
            <button type="button" className="w-full rounded-lg border px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
              Export Delivery Report
            </button>
          </div>
          <div className="mt-4 rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Top Templates</p>
            <div className="mt-2 space-y-1 text-sm">
              {(data?.top_templates || []).length === 0 ? (
                <p className="text-gray-500">{loading ? 'Loading...' : 'No template usage in selected range.'}</p>
              ) : (
                (data?.top_templates || []).map((tpl) => (
                  <p key={tpl.name} className="flex items-center justify-between text-gray-700">
                    <span className="truncate pr-3">{tpl.name}</span>
                    <span className="font-semibold">{tpl.count}</span>
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-600" />
          <h3 className="text-base font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Event</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent_events || []).map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 text-gray-600">{new Date(row.time).toLocaleString()}</td>
                  <td className="py-2 pr-3 text-gray-800">{row.note || 'Webhook event processed'}</td>
                  <td className="py-2">
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                      {String(row.status || '').toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && (data?.recent_events || []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-sm text-gray-500">
                    No recent webhook activity for selected range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
