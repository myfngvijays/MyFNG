'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Target } from 'lucide-react';
import toast from 'react-hot-toast';

type ChaseLead = {
  id: string;
  phone: string;
  status: string;
  follow_up_count: number;
  next_wakeup_at: string | null;
  updated_at: string;
  memory?: {
    buying_intent?: string;
    sentiment?: string;
    conversation_summary?: string;
    crm_snapshot?: Record<string, unknown>;
  } | null;
};

export default function AgentLeadsDashboard() {
  const [leads, setLeads] = useState<ChaseLead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/agents/chase/leads');
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load leads');
      setLeads(Array.isArray(json.leads) ? json.leads : []);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load chase leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Target className="h-4 w-4 text-violet-600" />
          Active Chase Leads
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : leads.length === 0 ? (
        <p className="text-sm text-gray-500">
          No active chase leads. Enable Chase Bot and run cron or TeleCRM webhook to create instances.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Follow-ups</th>
                <th className="py-2 pr-3">Intent</th>
                <th className="py-2 pr-3">Next wakeup</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-mono">{lead.phone}</td>
                  <td className="py-2 pr-3">
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                      {lead.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{lead.follow_up_count}</td>
                  <td className="py-2 pr-3">{lead.memory?.buying_intent || '—'}</td>
                  <td className="py-2 pr-3 text-xs text-gray-600">
                    {lead.next_wakeup_at
                      ? new Date(lead.next_wakeup_at).toLocaleString('en-IN')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
