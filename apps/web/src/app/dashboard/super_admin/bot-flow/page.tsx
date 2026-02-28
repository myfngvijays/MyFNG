'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bot, Edit3, Plus, RefreshCw, Workflow } from 'lucide-react';
import toast from 'react-hot-toast';

type BotFlow = {
  id: string;
  name: string;
  status: string;
  channel?: string;
  updated_at?: string;
  created_at?: string;
};

export default function SuperAdminBotFlowPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<BotFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadFlows = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/bot-flow');
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load bot flows');
      setFlows(Array.isArray(json.flows) ? json.flows : []);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load bot flows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlows();
  }, []);

  const handleCreateNew = async () => {
    const name = window.prompt('New flow name:', 'WhatsApp Bot Flow');
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/whatsapp/bot-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success || !json?.flow?.id) {
        throw new Error(json?.error || 'Failed to create flow');
      }
      toast.success('Flow created');
      router.push(`/dashboard/super_admin/bot-flow/builder?flowId=${json.flow.id}`);
    } catch (error: any) {
      toast.error(error?.message || 'Create flow failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4 p-4 sm:space-y-5 sm:p-6 md:space-y-6">
      <div className="rounded-xl bg-gradient-to-r from-brand-secondary to-brand-primary p-5 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-yellow-300 sm:text-3xl">Bot Flows</h1>
            <p className="mt-1 text-sm text-blue-100">
              Manage created flows and open the dedicated visual builder.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadFlows}
              disabled={loading}
              className="inline-flex items-center rounded-lg bg-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/30 disabled:opacity-60"
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleCreateNew}
              disabled={creating}
              className="inline-flex items-center rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
            >
              <Plus className="mr-1 h-4 w-4" />
              {creating ? 'Creating...' : 'Create New'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Workflow className="h-4 w-4 text-gray-500" />
          Created Flow List
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-500">Loading flows...</div>
        ) : flows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Bot className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-gray-800">No bot flows created yet</p>
            <p className="mt-1 text-xs text-gray-500">Create a new flow to start building automation.</p>
            <button
              type="button"
              onClick={handleCreateNew}
              disabled={creating}
              className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Plus className="mr-1 h-4 w-4" />
              {creating ? 'Creating...' : 'Create New Flow'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3">Flow</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Updated</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {flows.map((flow) => (
                  <tr key={flow.id} className="border-b last:border-0">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-gray-800">{flow.name}</div>
                      <div className="text-xs text-gray-500">{flow.id}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                        {String(flow.status || 'DRAFT').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-gray-600">
                      {flow.updated_at ? new Date(flow.updated_at).toLocaleString() : '--'}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/dashboard/super_admin/bot-flow/builder?flowId=${flow.id}`)
                        }
                        className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        <Edit3 className="mr-1 h-3.5 w-3.5" />
                        Open Builder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
