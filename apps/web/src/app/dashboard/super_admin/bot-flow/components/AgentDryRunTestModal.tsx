'use client';

import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import toast from 'react-hot-toast';

const DEFAULT_MESSAGES: Record<'FOLLOWUP' | 'CHASE', string> = {
  CHASE: 'Hi, I got your message about Swift service. Still interested?',
  FOLLOWUP: 'Following up on our call about periodic service for your Swift.',
};

export default function AgentDryRunTestModal({
  title,
  agentType,
  onClose,
}: {
  title: string;
  agentType: 'FOLLOWUP' | 'CHASE';
  onClose: () => void;
}) {
  const [testMessage, setTestMessage] = useState(DEFAULT_MESSAGES[agentType]);
  const [testResult, setTestResult] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const runTest = async () => {
    setTestLoading(true);
    setTestResult('');
    try {
      const res = await fetch('/api/whatsapp/agents/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_type: agentType,
          phone: '9999999999',
          event_type: agentType === 'FOLLOWUP' ? 'FOLLOWUP_TRIGGER' : 'NEW_LEAD',
          customer_message: testMessage,
          mock_crm: { name: 'Rahul', vehicle_model: 'Swift', disposition: 'Interested' },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Test failed');
      setTestResult(
        JSON.stringify(
          agentType === 'CHASE'
            ? {
                decision: json.decision,
                route: json.route,
                skipped_reason: json.skipped_reason,
              }
            : json.decision || json,
          null,
          2,
        ),
      );
    } catch (error: any) {
      toast.error(error?.message || 'Test failed');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Test {title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-gray-500 hover:text-gray-800"
          >
            Close
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Dry-run only — no WhatsApp message is sent. Uses your saved prompt and rules.
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Test phone</label>
            <input defaultValue="9999999999" className="w-full rounded-lg border px-3 py-2 text-sm" readOnly />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">
              {agentType === 'FOLLOWUP' ? 'Outbound check-in context' : 'Customer message'}
            </label>
            <textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={runTest}
            disabled={testLoading}
            className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <FlaskConical className="mr-1.5 h-4 w-4" />
            {testLoading ? 'Running...' : 'Run dry test (no WhatsApp send)'}
          </button>
          {testResult ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">AI result</p>
              <pre className="max-h-64 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-green-300 whitespace-pre-wrap">
                {testResult}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
