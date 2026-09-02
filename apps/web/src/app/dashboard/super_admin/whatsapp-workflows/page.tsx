'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Workflow,
  X,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  WORKFLOW_TRIGGER_EVENTS,
  createGraphForTriggerEvent,
  labelForTriggerEvent,
} from '@/lib/whatsappBotFlow/workflowEvents';

type FlowRow = {
  id: string;
  name: string;
  status: string;
  trigger_event?: string | null;
  description?: string | null;
  total_runs?: number | null;
  success_runs?: number | null;
  failed_runs?: number | null;
  last_run_at?: string | null;
  updated_at?: string | null;
  bot_flow_versions?: Array<{ id: string; status: string; version_no: number }>;
};

type RunRow = {
  id: string;
  bot_flow_id: string;
  trigger_event?: string;
  phone?: string | null;
  status: string;
  started_at?: string;
  finished_at?: string | null;
  error_message?: string | null;
};

export default function WhatsAppWorkflowsPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'workflows' | 'executions'>('workflows');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [eventSearch, setEventSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('whatsapp_incoming');
  const [creating, setCreating] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalRuns = flows.reduce((s, f) => s + Number(f.total_runs || 0), 0);
    const success = flows.reduce((s, f) => s + Number(f.success_runs || 0), 0);
    const failed = flows.reduce((s, f) => s + Number(f.failed_runs || 0), 0);
    const rate = totalRuns > 0 ? Math.round((success / totalRuns) * 100) : 100;
    return { totalRuns, success, failed, rate };
  }, [flows]);

  const filteredFlows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flows;
    return flows.filter((f) => {
      const name = String(f.name || '').toLowerCase();
      const ev = String(f.trigger_event || '').toLowerCase();
      return name.includes(q) || ev.includes(q) || labelForTriggerEvent(ev).toLowerCase().includes(q);
    });
  }, [flows, search]);

  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    return WORKFLOW_TRIGGER_EVENTS.filter((e) => {
      if (!q) return true;
      return (
        e.label.toLowerCase().includes(q) ||
        e.key.toLowerCase().includes(q) ||
        e.group.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
      );
    });
  }, [eventSearch]);

  const load = async () => {
    setLoading(true);
    try {
      const [flowsRes, runsRes] = await Promise.all([
        fetch('/api/whatsapp/bot-flow', { cache: 'no-store' }),
        fetch('/api/whatsapp/bot-flow/runs?limit=40', { cache: 'no-store' }),
      ]);
      const flowsJson = await flowsRes.json().catch(() => ({}));
      const runsJson = await runsRes.json().catch(() => ({}));
      if (!flowsRes.ok || !flowsJson?.success) throw new Error(flowsJson?.error || 'Failed to load workflows');
      setFlows(Array.isArray(flowsJson.flows) ? flowsJson.flows : []);
      setRuns(Array.isArray(runsJson?.runs) ? runsJson.runs : []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load');
      setFlows([]);
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createWorkflow = async () => {
    if (!selectedEvent) {
      toast.error('Select a trigger event');
      return;
    }
    setCreating(true);
    try {
      const label = labelForTriggerEvent(selectedEvent);
      const res = await fetch('/api/whatsapp/bot-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: label,
          trigger_event: selectedEvent,
          description: WORKFLOW_TRIGGER_EVENTS.find((e) => e.key === selectedEvent)?.description || '',
          graph_json: createGraphForTriggerEvent(selectedEvent),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Create failed');
      toast.success('Workflow created');
      setCreateOpen(false);
      router.push(`/dashboard/super_admin/bot-flow/builder?flowId=${json.flow.id}`);
    } catch (e: any) {
      toast.error(e?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const deleteWorkflow = async (flow: FlowRow) => {
    const ok = window.confirm(
      `Delete workflow “${flow.name}”?\n\nYe permanently delete ho jayega (versions + run logs).`,
    );
    if (!ok) return;
    setDeletingId(flow.id);
    try {
      const res = await fetch(`/api/whatsapp/bot-flow/${flow.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Delete failed');
      toast.success('Workflow deleted');
      setFlows((prev) => prev.filter((f) => f.id !== flow.id));
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const eventGroups = useMemo(() => {
    const map = new Map<string, typeof filteredEvents>();
    for (const ev of filteredEvents) {
      if (!map.has(ev.group)) map.set(ev.group, []);
      map.get(ev.group)!.push(ev);
    }
    return Array.from(map.entries());
  }, [filteredEvents]);

  return (
    <div className="min-h-screen bg-[#f4f6fb] p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">WhatsApp · Admin</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Workflow className="h-6 w-6 text-violet-600" />
              Workflow Builder
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              TeleCRM-style flows — synced with Bot Flow canvas, templates, and inbound WhatsApp.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" />
              Create workflow
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-3 text-sm text-violet-950">
          <p className="font-semibold">Flow kaise banaye</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs text-violet-900/90 sm:text-sm">
            <li>
              <strong>Create workflow</strong> → event choose karo (e.g. Incoming WhatsApp / Lead Status Change)
            </li>
            <li>
              Editor me left se <strong>Actions</strong> click karke blocks add karo (Send Message, Template…)
            </li>
            <li>
              Node ke <strong>dots</strong> se drag karke next block se connect karo → right panel me message/template set karo
            </li>
            <li>
              <strong>Save draft</strong> → phir <strong>Publish</strong> (tabhi live chalega)
            </li>
          </ol>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Total Runs</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{stats.totalRuns}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Success</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{stats.rate}%</p>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Failed</p>
            <p className="mt-1 text-3xl font-bold text-rose-600">{stats.failed}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-200">
          {(
            [
              ['workflows', 'Workflows'],
              ['executions', 'Executions'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
                tab === key
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
          <Link
            href="/dashboard/super_admin/bot-flow"
            className="ml-auto text-xs font-semibold text-violet-600 hover:underline"
          >
            Open classic Bot Flow hub →
          </Link>
        </div>

        {tab === 'workflows' ? (
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search workflows…"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Event</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Runs</th>
                    <th className="px-4 py-3 font-semibold">Updated</th>
                    <th className="px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Loading…
                      </td>
                    </tr>
                  ) : filteredFlows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No workflows yet. Create one from a trigger event.
                      </td>
                    </tr>
                  ) : (
                    filteredFlows.map((flow) => {
                      const published = (flow.bot_flow_versions || []).some(
                        (v) => String(v.status).toUpperCase() === 'PUBLISHED',
                      );
                      return (
                        <tr key={flow.id} className="border-t hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-medium text-slate-900">{flow.name}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {labelForTriggerEvent(String(flow.trigger_event || 'whatsapp_incoming'))}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                published
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-800'
                              }`}
                            >
                              {published ? 'Published' : String(flow.status || 'DRAFT')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {Number(flow.total_runs || 0)} · ✓{Number(flow.success_runs || 0)} · ✕
                            {Number(flow.failed_runs || 0)}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {flow.updated_at ? new Date(flow.updated_at).toLocaleString('en-IN') : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-3">
                              <Link
                                href={`/dashboard/super_admin/bot-flow/builder?flowId=${flow.id}`}
                                className="text-sm font-semibold text-violet-600 hover:underline"
                              >
                                Open editor
                              </Link>
                              <button
                                type="button"
                                disabled={deletingId === flow.id}
                                onClick={() => void deleteWorkflow(flow)}
                                className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 hover:underline disabled:opacity-50"
                                title="Delete workflow"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {deletingId === flow.id ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                    <th className="px-4 py-3 font-semibold">Event</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No executions logged yet.
                      </td>
                    </tr>
                  ) : (
                    runs.map((run) => (
                      <tr key={run.id} className="border-t">
                        <td className="px-4 py-3 text-slate-600">
                          {run.started_at ? new Date(run.started_at).toLocaleString('en-IN') : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{run.phone || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {labelForTriggerEvent(String(run.trigger_event || ''))}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold">
                            {String(run.status).toUpperCase() === 'SUCCESS' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : String(run.status).toUpperCase() === 'FAILED' ? (
                              <XCircle className="h-3.5 w-3.5 text-rose-600" />
                            ) : (
                              <Activity className="h-3.5 w-3.5 text-slate-400" />
                            )}
                            {run.status}
                          </span>
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-xs text-rose-600">
                          {run.error_message || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/40">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <p className="text-lg font-bold text-slate-900">Select event</p>
                <p className="text-xs text-slate-500">Select the event that will trigger the workflow.</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg p-1.5 hover:bg-slate-100">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="border-b px-5 py-3">
              <div className="flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  placeholder="Search for event e.g. whatsapp, payment, lead…"
                  className="w-full bg-transparent text-sm outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {eventGroups.map(([group, items]) => (
                <div key={group} className="mb-4">
                  <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{group}</p>
                  <div className="space-y-1">
                    {items.map((ev) => {
                      const active = selectedEvent === ev.key;
                      return (
                        <button
                          key={ev.key}
                          type="button"
                          onClick={() => setSelectedEvent(ev.key)}
                          className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                            active
                              ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-300'
                              : 'border-transparent hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">{ev.label}</p>
                            {ev.published ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                Live
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">{ev.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() => void createWorkflow()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {creating ? 'Creating…' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
