'use client';

import { useState } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import AgentConfigPanel from './AgentConfigPanel';

export default function FollowupAgentPanel() {
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Record<string, unknown> | null>(null);

  const runFollowupNow = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/whatsapp/agents/followup/run-now', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Run failed');
      setLastRun(json);
      const t = json.followup_triggers || {};
      toast.success(
        `Follow-up run done — telecaller: ${t.telecaller?.sent ?? 0}, booking: ${t.incompleteBooking?.sent ?? 0}, service: ${t.serviceDue?.sent ?? 0}, CSE: ${t.cseCallback?.sent ?? 0}`,
      );
    } catch (error: any) {
      toast.error(error?.message || 'Follow-up run failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <AgentConfigPanel
        agentType="FOLLOWUP"
        title="Follow-up Bot"
        subtitle="Sends scheduled gentle check-ins from telecaller follow-ups, incomplete bookings, and service reminders."
        showTriggers
        triggerFields={[
          { key: 'telecaller_follow_up', label: 'Telecaller scheduled follow-up', type: 'boolean' },
          {
            key: 'telecaller_offset_minutes',
            label: 'Telecaller offset (minutes after scheduled time)',
            type: 'number',
          },
          { key: 'incomplete_booking', label: 'Incomplete booking reminder', type: 'boolean' },
          {
            key: 'incomplete_booking_delay_hours',
            label: 'Incomplete booking delay (hours)',
            type: 'number',
          },
          { key: 'service_due_reminder', label: 'Service due reminder', type: 'boolean' },
          { key: 'cse_callback', label: 'CSE callback', type: 'boolean' },
          {
            key: 'outbound_template_name',
            label: 'Outbound Meta template (24h+ window)',
            type: 'string',
            placeholder: 'app_session_incomplete',
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
            <h3 className="text-sm font-semibold text-gray-900">Run Follow-up Now</h3>
            <p className="text-xs text-gray-500 mt-1">
              Polls due telecaller follow-ups, incomplete bookings, service due, and CSE callbacks.
            </p>
          </div>
          <button
            type="button"
            onClick={runFollowupNow}
            disabled={running}
            className="inline-flex items-center rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {running ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            {running ? 'Running...' : 'Run Follow-up Now'}
          </button>
        </div>
        {lastRun ? (
          <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-gray-900 p-2 text-[10px] text-green-300">
            {JSON.stringify(lastRun, null, 2)}
          </pre>
        ) : null}
      </div>

      <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-xs text-gray-600 space-y-1">
        <p className="font-semibold text-gray-800">Auto triggers</p>
        <p>✅ Telecaller schedules follow-up → bot messages customer at scheduled time</p>
        <p>✅ Incomplete booking (2h idle) → gentle AI check-in</p>
        <p>✅ Cron every 10 min → <span className="font-mono">/api/cron/whatsapp-agents</span></p>
        <p className="text-amber-700">
          Enable bot + set <span className="font-mono">outbound_template_name</span> for cold outbound (24h+ window).
        </p>
      </div>
    </div>
  );
}
