'use client';

import { useState } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import AgentConfigPanel from './AgentConfigPanel';
import AgentLeadsDashboard from './AgentLeadsDashboard';

export default function ChaseAgentPanel() {
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Record<string, unknown> | null>(null);

  const runChaseNow = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/whatsapp/agents/chase/run-now', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Run failed');
      setLastRun(json);
      toast.success(
        `Chase run done — wakeups: ${json.chase_wakeups?.processed ?? 0}, new leads: ${json.chase_telecrm_leads?.created ?? 0}`,
      );
    } catch (error: any) {
      toast.error(error?.message || 'Chase run failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <AgentConfigPanel
        agentType="CHASE"
        title="Chase Bot"
        subtitle="Proactively follows up with TeleCRM leads until conversion. Persistent multi-day outreach with rule-based limits."
        showTriggers
        triggerFields={[
          { key: 'telecrm_new_lead', label: 'New TeleCRM lead', type: 'boolean' },
          { key: 'no_reply_hours', label: 'No-reply hours before retry', type: 'number' },
          { key: 'cold_lead_days', label: 'Cold lead days', type: 'number' },
          {
            key: 'outbound_template_name',
            label: 'Outbound Meta template (24h+ window)',
            type: 'string',
            placeholder: 'e.g. customer_reply_reopen',
          },
          {
            key: 'outbound_template_language',
            label: 'Template language',
            type: 'string',
            placeholder: 'en',
          },
        ]}
      />

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Run Chase Now</h3>
            <p className="text-xs text-gray-500 mt-1">
              Processes due wakeups + scans new TeleCRM leads (same as cron job).
            </p>
          </div>
          <button
            type="button"
            onClick={runChaseNow}
            disabled={running}
            className="inline-flex items-center rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {running ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            {running ? 'Running...' : 'Run Chase Now'}
          </button>
        </div>
        {lastRun ? (
          <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-gray-900 p-2 text-[10px] text-green-300">
            {JSON.stringify(lastRun, null, 2)}
          </pre>
        ) : null}
      </div>

      <AgentLeadsDashboard />

      <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-xs text-gray-600 space-y-1">
        <p className="font-semibold text-gray-800">Auto triggers (configured)</p>
        <p>✅ Sarv call webhook → telecrm_api insert → instant chase</p>
        <p>✅ Cron every 10 min → <span className="font-mono">/api/cron/whatsapp-agents</span></p>
        <p>✅ Manual → Run Chase Now button above</p>
        <p className="text-amber-700">
          Set <span className="font-mono">outbound_template_name</span> above (Meta UTILITY template) for first
          message outside WhatsApp 24h window.
        </p>
      </div>
    </div>
  );
}
