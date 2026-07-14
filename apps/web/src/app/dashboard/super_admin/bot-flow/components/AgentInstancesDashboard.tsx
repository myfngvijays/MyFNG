'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pause, RefreshCw, Target, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';

type AgentLead = {
  id: string;
  phone: string;
  status: string;
  follow_up_count: number;
  next_wakeup_at: string | null;
  updated_at: string;
  metadata?: Record<string, unknown>;
  memory?: {
    buying_intent?: string;
    sentiment?: string;
    conversation_summary?: string;
    crm_snapshot?: Record<string, unknown>;
  } | null;
};

const THEME: Record<
  'CHASE' | 'FOLLOWUP',
  { badge: string; icon: string; leadsPath: string }
> = {
  CHASE: {
    badge: 'bg-violet-100 text-violet-700',
    icon: 'text-violet-600',
    leadsPath: '/api/whatsapp/agents/chase/leads',
  },
  FOLLOWUP: {
    badge: 'bg-sky-100 text-sky-700',
    icon: 'text-sky-600',
    leadsPath: '/api/whatsapp/agents/followup/leads',
  },
};

export default function AgentInstancesDashboard({
  agentType,
  title,
  emptyMessage,
}: {
  agentType: 'CHASE' | 'FOLLOWUP';
  title: string;
  emptyMessage: string;
}) {
  const [leads, setLeads] = useState<AgentLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const theme = THEME[agentType];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(theme.leadsPath);
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load instances');
      setLeads(Array.isArray(json.leads) ? json.leads : []);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load active instances');
    } finally {
      setLoading(false);
    }
  }, [theme.leadsPath]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (id: string, action: 'pause' | 'escalate') => {
    setActionId(id);
    try {
      const res = await fetch(`/api/whatsapp/agents/instances/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'pause'
            ? { reason: 'Paused from Bot Flow dashboard' }
            : { note: 'Escalated from Bot Flow dashboard' },
        ),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || `${action} failed`);
      toast.success(action === 'pause' ? 'Instance paused' : 'Escalated to human');
      await load();
    } catch (error: any) {
      toast.error(error?.message || `Failed to ${action}`);
    } finally {
      setActionId(null);
    }
  };

  const formatSource = (lead: AgentLead) => {
    const sourceType = String(lead.metadata?.source_type || lead.metadata?.source || '—');
    const sourceId = lead.metadata?.source_id ? String(lead.metadata.source_id).slice(0, 8) : null;
    return sourceId ? `${sourceType} (${sourceId}…)` : sourceType;
  };

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className={`flex items-center gap-2 text-sm font-semibold text-gray-800`}>
          <Target className={`h-4 w-4 ${theme.icon}`} />
          {title}
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
        <p className="text-sm text-gray-500">Loading...</p>
      ) : leads.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Status</th>
                {agentType === 'FOLLOWUP' ? <th className="py-2 pr-3">Source</th> : null}
                <th className="py-2 pr-3">Follow-ups</th>
                {agentType === 'CHASE' ? <th className="py-2 pr-3">Intent</th> : null}
                <th className="py-2 pr-3">Next wakeup</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const busy = actionId === lead.id;
                const canAct = ['ACTIVE', 'WAITING', 'PAUSED'].includes(lead.status);
                return (
                  <tr key={lead.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono">{lead.phone}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${theme.badge}`}>
                        {lead.status}
                      </span>
                    </td>
                    {agentType === 'FOLLOWUP' ? (
                      <td className="py-2 pr-3 text-xs text-gray-600">{formatSource(lead)}</td>
                    ) : null}
                    <td className="py-2 pr-3">{lead.follow_up_count}</td>
                    {agentType === 'CHASE' ? (
                      <td className="py-2 pr-3">{lead.memory?.buying_intent || '—'}</td>
                    ) : null}
                    <td className="py-2 pr-3 text-xs text-gray-600">
                      {lead.next_wakeup_at
                        ? new Date(lead.next_wakeup_at).toLocaleString('en-IN')
                        : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1.5">
                        {lead.status !== 'PAUSED' && lead.status !== 'ESCALATED' && lead.status !== 'ENDED' ? (
                          <button
                            type="button"
                            disabled={busy || !canAct}
                            onClick={() => runAction(lead.id, 'pause')}
                            className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                          >
                            <Pause className="mr-1 h-3 w-3" />
                            Pause
                          </button>
                        ) : null}
                        {lead.status !== 'ESCALATED' && lead.status !== 'ENDED' ? (
                          <button
                            type="button"
                            disabled={busy || !canAct}
                            onClick={() => runAction(lead.id, 'escalate')}
                            className="inline-flex items-center rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                          >
                            <UserRound className="mr-1 h-3 w-3" />
                            Escalate
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
