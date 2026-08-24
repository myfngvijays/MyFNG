'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Copy,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import PageHelpIcon from '@/components/PageHelpIcon';
import CallIqTelecrmFlowEditor from '@/components/admin/CallIqTelecrmFlowEditor';
import { defaultCallIqAgents } from '@/lib/telecaller/callIqAgents';
import type { CallIqNamedWorkflow, SalesPlaybook } from '@/lib/telecaller/salesPlaybookDefaults';
import {
  ALL_CRM_LEAD_STATUS_NAMES,
  defaultCallIqNamedWorkflow,
  listCallIqWorkflows,
  persistCallIqWorkflows,
} from '@/lib/telecaller/salesPlaybookDefaults';

function IconBtn({
  title,
  onClick,
  disabled,
  children,
  light,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-40 ${
        light
          ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

export default function CallIqWorkflowPanel({
  helpHref,
  suiteHref,
  callIqHref,
}: {
  helpHref: string;
  suiteHref: string;
  callIqHref: string;
}) {
  const [playbook, setPlaybook] = useState<SalesPlaybook | null>(null);
  const [workflows, setWorkflows] = useState<CallIqNamedWorkflow[]>(() => listCallIqWorkflows(null));
  const [crmStatuses, setCrmStatuses] = useState<string[]>([...ALL_CRM_LEAD_STATUS_NAMES]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CallIqNamedWorkflow | null>(null);
  const [agentName, setAgentName] = useState('Call Audit SOP New');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pbRes, stRes, agRes] = await Promise.all([
        fetch('/api/super_admin/ai-suite/playbook', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/lead-manager/statuses', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/super_admin/call-iq-agents', { credentials: 'include', cache: 'no-store' }),
      ]);
      const pb = await pbRes.json().catch(() => ({}));
      const st = await stRes.json().catch(() => ({}));
      const ag = await agRes.json().catch(() => ({}));
      if (pb?.playbook) {
        setPlaybook(pb.playbook);
        setWorkflows(listCallIqWorkflows(pb.playbook.call_iq_workflow));
      }
      const names = (Array.isArray(st?.statuses) ? st.statuses : [])
        .filter((s: any) => s?.is_active !== false)
        .map((s: any) => String(s.name || s.code || '').trim())
        .filter(Boolean);
      if (names.length) setCrmStatuses(names);
      const agents = Array.isArray(ag?.agents) && ag.agents.length ? ag.agents : defaultCallIqAgents();
      const live = agents.find((a: any) => a.is_active) || agents[0];
      if (live?.name) setAgentName(String(live.name));
    } catch (e: any) {
      setError(e?.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function persist(nextList: CallIqNamedWorkflow[], opts?: { keepOpen?: boolean }) {
    if (!playbook) return false;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/super_admin/ai-suite/playbook', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...playbook, call_iq_workflow: persistCallIqWorkflows(nextList) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      setPlaybook(json.playbook);
      const savedList = listCallIqWorkflows(json.playbook?.call_iq_workflow);
      setWorkflows(savedList);
      setSaved(true);
      if (!opts?.keepOpen) {
        setEditing(false);
      }
      return true;
    } catch (e: any) {
      setError(e?.message || 'Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openEditor(flow: CallIqNamedWorkflow, startEdit = false) {
    setOpenId(flow.id);
    setDraft({ ...flow, lead_statuses: [...flow.lead_statuses] });
    setEditing(startEdit);
    setSaved(false);
  }

  async function addWorkflow() {
    const created = defaultCallIqNamedWorkflow({
      name: `Workflow ${workflows.length + 1}`,
      enabled: false,
      canvas: { nodes: [], edges: [] },
    });
    const next = [...workflows, created];
    setWorkflows(next);
    openEditor(created, true);
    await persist(next, { keepOpen: true });
  }

  async function duplicate(flow: CallIqNamedWorkflow) {
    const copy = defaultCallIqNamedWorkflow({
      ...flow,
      id: undefined,
      name: `${flow.name.replace(/\s*\(copy\)\s*$/i, '')} (copy)`,
      enabled: false,
    });
    const next = [...workflows, copy];
    setWorkflows(next);
    openEditor(copy, true);
    await persist(next, { keepOpen: true });
  }

  async function remove(flow: CallIqNamedWorkflow) {
    if (workflows.length <= 1) {
      setError('Keep at least one workflow.');
      return;
    }
    if (!window.confirm(`Delete “${flow.name}”?`)) return;
    const next = workflows.filter((w) => w.id !== flow.id);
    if (openId === flow.id) {
      setOpenId(null);
      setDraft(null);
      setEditing(false);
    }
    setWorkflows(next);
    await persist(next);
  }

  async function setEnabled(flow: CallIqNamedWorkflow, enabled: boolean) {
    const next = workflows.map((w) => (w.id === flow.id ? { ...w, enabled } : w));
    setWorkflows(next);
    if (draft?.id === flow.id) setDraft({ ...draft, enabled });
    await persist(next, { keepOpen: true });
  }

  async function saveDraft() {
    if (!draft) return;
    const next = workflows.some((w) => w.id === draft.id)
      ? workflows.map((w) => (w.id === draft.id ? draft : w))
      : [...workflows, draft];
    const ok = await persist(next, { keepOpen: true });
    if (ok) setEditing(false);
  }

  const updateDraft = useCallback((next: CallIqNamedWorkflow) => {
    setDraft(next);
  }, []);

  const live = workflows.filter((w) => w.enabled).length;

  if (draft) {
    return (
      <CallIqTelecrmFlowEditor
        draft={draft}
        editing={editing}
        saving={saving}
        crmStatuses={crmStatuses}
        agentName={agentName}
        onChange={updateDraft}
        onBack={() => {
          setOpenId(null);
          setDraft(null);
          setEditing(false);
        }}
        onEdit={() => setEditing(true)}
        onPublish={() => void saveDraft()}
        onDelete={() => void remove(draft)}
        onToggleEnabled={(enabled) => {
          setDraft({ ...draft, enabled });
          void setEnabled({ ...draft, enabled }, enabled);
        }}
        onStartEdit={() => setEditing(true)}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(1200px_500px_at_10%_-10%,rgba(124,58,237,0.12),transparent_50%),radial-gradient(900px_400px_at_90%_0%,rgba(16,185,129,0.08),transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      <div className="mx-auto max-w-[1440px] space-y-6 p-4 sm:p-6 lg:p-8">
        <header className="relative overflow-hidden rounded-3xl border border-white/60 bg-slate-950 px-5 py-6 text-white shadow-[0_20px_60px_-28px_rgba(15,23,42,0.65)] sm:px-8 sm:py-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200/80">AI Suite</p>
              <h1 className="mt-1 flex flex-wrap items-center gap-3 font-serif text-3xl tracking-tight text-white sm:text-4xl">
                <GitBranch className="h-8 w-8 text-amber-100" />
                Workflows
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                Recording complete → CRM lead status → duration → Sales SOP. Add as many flows as you need.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PageHelpIcon href={helpHref} label="Workflow" />
              <Link
                href={suiteHref}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-100 hover:bg-white/10"
              >
                AI Suite
              </Link>
              <Link
                href={callIqHref}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-100 hover:bg-white/10"
              >
                Call IQ
              </Link>
            </div>
          </div>
          <div className="relative mt-5 flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-amber-200" />
            {live} live · {workflows.length} flows · first matching enabled flow runs Deep AI
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">Edit a flow or create a new automation rule.</p>
          <button
            type="button"
            onClick={() => void addWorkflow()}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-slate-950/20 hover:bg-slate-800 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add workflow
          </button>
        </div>

        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        ) : null}
        {saved && !error ? <p className="text-xs text-emerald-700">Workflow saved.</p> : null}

        <div className="space-y-3">
            {loading && !workflows.length ? (
              <div className="flex justify-center rounded-3xl border border-white/70 bg-white/70 py-16">
                <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
              </div>
            ) : null}
            {workflows.map((flow) => {
              const selected = flow.id === openId;
              const initial = flow.name.replace(/^AI Workflow\s+[—-]\s+/i, '').trim().slice(0, 1).toUpperCase() || 'W';
              return (
                <article
                  key={flow.id}
                  className={`group relative overflow-hidden rounded-3xl border bg-white/80 p-4 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10 ${
                    selected
                      ? 'border-violet-300 ring-2 ring-violet-200/80'
                      : flow.enabled
                        ? 'border-emerald-200/80'
                        : 'border-white/80'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => openEditor(flow)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-serif text-lg ${
                          flow.enabled ? 'bg-slate-950 text-amber-100' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {initial}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900">{flow.name}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              flow.enabled
                                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {flow.enabled ? 'On' : 'Off'}
                          </span>
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                            ≥ {flow.min_duration_sec}s
                          </span>
                          {flow.use_deep_ai ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              <Sparkles className="h-3 w-3" /> Deep AI
                            </span>
                          ) : null}
                          <span className="text-[11px] text-slate-400">
                            {flow.lead_statuses.length} statuses
                          </span>
                        </span>
                      </span>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void setEnabled(flow, !flow.enabled)}
                        className="rounded-full px-3 py-1.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {flow.enabled ? 'Turn off' : 'Turn on'}
                      </button>
                      <IconBtn light title="Edit" onClick={() => openEditor(flow, true)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn light title="Duplicate" disabled={saving} onClick={() => void duplicate(flow)}>
                        <Copy className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn light title="Delete" disabled={saving || workflows.length <= 1} onClick={() => void remove(flow)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconBtn>
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      </div>
    </div>
  );
}
