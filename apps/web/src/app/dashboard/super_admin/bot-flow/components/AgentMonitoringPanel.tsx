'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, BarChart3, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

type Analytics = {
  period?: { from: string; to: string };
  totals?: {
    instances: number;
    messages_executed: number;
    messages_failed: number;
    actions_blocked: number;
  };
  booking?: { conversations: number; bookings_created: number; conversion_rate: number; active: number };
  followup?: { sent: number; replied: number; response_rate: number; completed: number; active: number };
  chase?: {
    active: number;
    converted: number;
    escalated: number;
    ended_max_attempts: number;
    conversion_rate: number;
    avg_follow_ups_to_convert: number;
  };
  agents_enabled?: Record<string, boolean>;
};

type AuditRow = {
  id: string;
  instance_id: string;
  event_type: string;
  validated_action: string | null;
  execution_status: string;
  block_reason: string | null;
  message_sent: string | null;
  reason: string | null;
  created_at: string;
  instance?: { agent_type?: string; phone?: string; status?: string } | null;
};

function pct(value: number) {
  return `${Math.round((value || 0) * 100)}%`;
}

export default function AgentMonitoringPanel() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [actions, setActions] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, actionsRes] = await Promise.all([
        fetch('/api/whatsapp/agents/analytics'),
        fetch('/api/whatsapp/agents/actions?limit=40'),
      ]);
      const analyticsJson = await analyticsRes.json();
      const actionsJson = await actionsRes.json();
      if (!analyticsRes.ok || !analyticsJson?.success) {
        throw new Error(analyticsJson?.error || 'Failed to load analytics');
      }
      if (!actionsRes.ok || !actionsJson?.success) {
        throw new Error(actionsJson?.error || 'Failed to load audit log');
      }
      setAnalytics(analyticsJson);
      setActions(Array.isArray(actionsJson.actions) ? actionsJson.actions : []);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-violet-600" />
            <h3 className="text-sm font-semibold text-gray-900">Agent Analytics (last 14 days)</h3>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className={`mr-1 h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading analytics...</p>
        ) : analytics ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="MISA AI"
              enabled={analytics.agents_enabled?.booking}
              lines={[
                `Conversations: ${analytics.booking?.conversations ?? 0}`,
                `Bookings: ${analytics.booking?.bookings_created ?? 0}`,
                `Conversion: ${pct(analytics.booking?.conversion_rate ?? 0)}`,
              ]}
            />
            <StatCard
              title="Follow-up Bot"
              enabled={analytics.agents_enabled?.followup}
              lines={[
                `Sent: ${analytics.followup?.sent ?? 0}`,
                `Replied: ${analytics.followup?.replied ?? 0}`,
                `Response: ${pct(analytics.followup?.response_rate ?? 0)}`,
              ]}
            />
            <StatCard
              title="Chase Bot"
              enabled={analytics.agents_enabled?.chase}
              lines={[
                `Active: ${analytics.chase?.active ?? 0}`,
                `Converted: ${analytics.chase?.converted ?? 0}`,
                `Rate: ${pct(analytics.chase?.conversion_rate ?? 0)}`,
              ]}
            />
            <StatCard
              title="Outbound Health"
              lines={[
                `Executed: ${analytics.totals?.messages_executed ?? 0}`,
                `Failed: ${analytics.totals?.messages_failed ?? 0}`,
                `Blocked: ${analytics.totals?.actions_blocked ?? 0}`,
              ]}
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Activity className="h-4 w-4 text-violet-600" />
          Audit Log (recent actions)
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading audit log...</p>
        ) : actions.length === 0 ? (
          <p className="text-sm text-gray-500">No agent actions logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Agent</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Detail</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-xs text-gray-600">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3">{row.instance?.agent_type || '—'}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.instance?.phone || '—'}</td>
                    <td className="py-2 pr-3">{row.validated_action || row.event_type}</td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={row.execution_status} />
                    </td>
                    <td className="py-2 pr-3 max-w-[280px] truncate text-xs text-gray-600">
                      {row.block_reason || row.message_sent || row.reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-xs text-gray-600 space-y-1">
        <p className="font-semibold text-gray-800">Production monitoring</p>
        <p>✅ Cron: <span className="font-mono">/api/cron/whatsapp-agents</span> every 10 min</p>
        <p>✅ Failed sends auto-retry up to 2× (15 min apart)</p>
        <p>✅ Stuck wakeups reset after 15 min</p>
        <p>📄 Runbook: <span className="font-mono">docs/whatsapp-agents/RUNBOOK.md</span></p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  enabled,
  lines,
}: {
  title: string;
  enabled?: boolean;
  lines: string[];
}) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{title}</p>
        {enabled != null ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {enabled ? 'ON' : 'OFF'}
          </span>
        ) : null}
      </div>
      <div className="space-y-1 text-sm text-gray-800">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status || '').toUpperCase();
  const styles =
    normalized === 'EXECUTED'
      ? 'bg-emerald-100 text-emerald-700'
      : normalized === 'FAILED'
        ? 'bg-red-100 text-red-700'
        : normalized === 'BLOCKED'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-gray-100 text-gray-600';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles}`}>{normalized}</span>;
}
