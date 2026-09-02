'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Copy,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  CALL_IQ_FIELD_TYPE_LABELS,
  CALL_IQ_OPTION_CHIP_CLASSES,
  displayCallIqProvider,
  getAgentVersion,
  newFieldId,
  type CallIqAgent,
  type CallIqAgentField,
  type CallIqFieldType,
  defaultCallIqAgents,
} from '@/lib/telecaller/callIqAgents';

export default function CallIqAgentsPanel({
  workflowHref,
}: {
  workflowHref: string;
}) {
  const [agents, setAgents] = useState<CallIqAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftInstruction, setDraftInstruction] = useState('');
  const [draftFields, setDraftFields] = useState<CallIqAgentField[]>([]);
  const [localOnly, setLocalOnly] = useState(false);

  const applyAgents = (list: CallIqAgent[], persisted = true) => {
    const next = [...list].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name));
    if (!next.some((a) => a.is_active) && next[0]) next[0] = { ...next[0], is_active: true };
    setAgents(next);
    setLocalOnly(!persisted);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/call-iq-agents', { cache: 'no-store', credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      const list = Array.isArray(json.agents) && json.agents.length ? json.agents : defaultCallIqAgents();
      applyAgents(list, json.persisted !== false && res.ok);
      setWarning(
        json.warning && !/database\/|\.sql/i.test(String(json.warning))
          ? json.warning
          : json.persisted === false || !res.ok
            ? 'Showing default Call-IQ agents. Refresh if edits do not save.'
            : null,
      );
    } catch {
      applyAgents(defaultCallIqAgents(), false);
      setWarning('Showing default Call-IQ agents. Refresh after the database is reachable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAgent = agents.find((a) => a.id === openId) || null;
  const version = useMemo(() => {
    if (!openAgent) return null;
    return getAgentVersion(openAgent, viewVersion);
  }, [openAgent, viewVersion]);

  const openDrawer = (agent: CallIqAgent, startInEdit = false) => {
    setOpenId(agent.id);
    setViewVersion(agent.current_version);
    const ver = getAgentVersion(agent, agent.current_version);
    setDraftName(agent.name);
    setDraftInstruction(ver?.instruction || '');
    setDraftFields((ver?.fields || []).map((f) => ({ ...f, options: f.options ? [...f.options] : undefined })));
    setEditing(startInEdit);
  };

  const startEdit = () => {
    if (!openAgent || !version) return;
    setDraftName(openAgent.name);
    setDraftInstruction(version.instruction);
    setDraftFields(version.fields.map((f) => ({ ...f, options: f.options ? [...f.options] : undefined })));
    setEditing(true);
  };

  const saveVersion = async () => {
    if (!openAgent) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/call-iq-agents', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: openAgent.id,
          name: draftName,
          instruction: draftInstruction,
          fields: draftFields,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      const next = Array.isArray(json.agents) ? json.agents : [];
      if (next.length) applyAgents(next, true);
      const updated = next.find((a: CallIqAgent) => a.id === openAgent.id);
      if (updated) {
        setViewVersion(updated.current_version);
        setOpenId(updated.id);
      }
      setEditing(false);
      setWarning(json.warning && !/database\/|\.sql/i.test(String(json.warning)) ? json.warning : null);
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async (agent: CallIqAgent) => {
    setSaving(true);
    try {
      const res = await fetch('/api/super_admin/call-iq-agents', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', agent_id: agent.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Duplicate failed');
      if (Array.isArray(json.agents)) applyAgents(json.agents, true);
      if (json.created_id) {
        const created = (json.agents || []).find((a: CallIqAgent) => a.id === json.created_id);
        if (created) openDrawer(created, true);
      }
    } catch (e: any) {
      setError(e?.message || 'Duplicate failed');
    } finally {
      setSaving(false);
    }
  };

  const createAgent = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/super_admin/call-iq-agents', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: 'New Call-IQ agent' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Create failed');
      if (Array.isArray(json.agents)) applyAgents(json.agents, true);
      const created = (json.agents || []).find((a: CallIqAgent) => a.id === json.created_id);
      if (created) openDrawer(created, true);
    } catch (e: any) {
      setError(e?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (agent: CallIqAgent) => {
    if (agent.is_active) return;
    if (localOnly || agent.id.startsWith('seed-')) {
      applyAgents(
        agents.map((a) => ({ ...a, is_active: a.id === agent.id })),
        false,
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/call-iq-agents', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_active', agent_id: agent.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not activate');
      if (Array.isArray(json.agents)) applyAgents(json.agents, true);
    } catch (e: any) {
      applyAgents(
        agents.map((a) => ({ ...a, is_active: a.id === agent.id })),
        false,
      );
      setWarning(e?.message || 'Activated locally — run 351 SQL to persist.');
    } finally {
      setSaving(false);
    }
  };

  const deleteAgent = async (agent: CallIqAgent) => {
    if (agent.is_active) {
      setError('Active agent cannot be deleted. Set another agent Active first.');
      return;
    }
    if (agents.length <= 1) {
      setError('At least one agent is required.');
      return;
    }
    if (!window.confirm(`Delete “${agent.name}”? This cannot be undone.`)) return;
    if (localOnly || agent.id.startsWith('seed-')) {
      applyAgents(agents.filter((a) => a.id !== agent.id), false);
      if (openId === agent.id) setOpenId(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/super_admin/call-iq-agents?id=${encodeURIComponent(agent.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Delete failed');
      if (Array.isArray(json.agents)) applyAgents(json.agents, true);
      if (openId === agent.id) setOpenId(null);
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  const switchVersion = async (ver: number) => {
    setViewVersion(ver);
    setEditing(false);
    if (!openAgent || !openAgent.id.startsWith('seed-')) {
      try {
        await fetch('/api/super_admin/call-iq-agents', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id: openAgent?.id, version: ver }),
        });
      } catch {
        /* view-only if persist fails */
      }
    }
  };

  const fields = editing ? draftFields : version?.fields || [];
  const instruction = editing ? draftInstruction : version?.instruction || '';

  const AgentEditor = openAgent && version ? (
    <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 text-slate-100 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.8)] lg:h-[calc(100vh-14rem)]">
      <div className="border-b border-white/10 bg-gradient-to-r from-violet-600/20 to-transparent px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {editing ? (
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-base font-semibold text-white outline-none focus:border-amber-200/40"
              />
            ) : (
              <h2 className="truncate font-serif text-2xl tracking-tight text-white">{openAgent.name}</h2>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  openAgent.is_active
                    ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/30'
                    : 'bg-white/5 text-slate-400 ring-1 ring-white/10'
                }`}
              >
                {openAgent.is_active ? 'Live' : 'Inactive'}
              </span>
              <select
                value={viewVersion || openAgent.current_version}
                onChange={(e) => void switchVersion(Number(e.target.value))}
                className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200"
                disabled={editing}
              >
                {openAgent.versions.map((v) => (
                  <option key={v.version} value={v.version} className="text-slate-900">
                    Version {v.version}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconBtn title="Edit" onClick={startEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn title="Duplicate" onClick={() => void duplicate(openAgent)}>
              <Copy className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn title="Close" onClick={() => setOpenId(null)}>
              <X className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Instruction
          </span>
          {editing ? (
            <textarea
              value={draftInstruction}
              onChange={(e) => setDraftInstruction(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-300/40"
            />
          ) : (
            <p className="whitespace-pre-wrap rounded-2xl border border-white/5 bg-white/[0.04] px-3 py-2.5 text-sm leading-relaxed text-slate-300">
              {instruction || '—'}
            </p>
          )}
        </label>

        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Output fields</p>
          <div className="space-y-2.5">
            {fields.map((field, idx) => (
              <FieldRow
                key={field.id}
                field={field}
                editing={editing}
                onChange={(next) => setDraftFields((prev) => prev.map((x, i) => (i === idx ? next : x)))}
                onRemove={() => setDraftFields((prev) => prev.filter((_, i) => i !== idx))}
              />
            ))}
          </div>
          {editing ? (
            <button
              type="button"
              onClick={() =>
                setDraftFields((prev) => [
                  ...prev,
                  { id: newFieldId(), key: `field_${prev.length + 1}`, name: 'New Field', response_type: 'text' },
                ])
              }
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-200 hover:text-amber-100"
            >
              <Plus className="h-3.5 w-3.5" /> Add field
            </button>
          ) : null}
        </div>

        <Link
          href={workflowHref}
          className="block rounded-2xl border border-amber-200/15 bg-gradient-to-br from-amber-200/10 to-transparent p-4 transition hover:border-amber-200/30"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-100">
            <GitBranch className="h-4 w-4" /> Automation flowchart
          </p>
          <p className="mt-1 text-xs text-slate-400">Add / edit automation flows · View flowchart</p>
        </Link>
      </div>

      {editing ? (
        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-slate-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveVersion()}
            className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-4 py-1.5 text-sm font-bold text-slate-950 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save version
          </button>
        </div>
      ) : null}
    </aside>
  ) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {agents.filter((a) => a.is_active).length} live · {agents.length} assistants
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => void createAgent()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-slate-950/20 hover:bg-slate-800 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> New agent
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      ) : warning ? (
        <p className="text-[11px] text-slate-400">{warning}</p>
      ) : null}

      <div className={`grid items-start gap-5 ${openAgent ? 'xl:grid-cols-[minmax(0,1fr)_minmax(380px,440px)]' : ''}`}>
        <div className="space-y-3">
          {loading && !agents.length ? (
            <div className="flex justify-center rounded-3xl border border-white/70 bg-white/70 py-16">
              <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
            </div>
          ) : null}
          {agents.map((agent) => {
            const selected = agent.id === openId;
            const initial = agent.name.replace(/^Call\s+/i, '').trim().slice(0, 1).toUpperCase() || 'A';
            return (
              <article
                key={agent.id}
                className={`group relative overflow-hidden rounded-3xl border bg-white/80 p-4 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10 ${
                  selected
                    ? 'border-violet-300 ring-2 ring-violet-200/80'
                    : agent.is_active
                      ? 'border-emerald-200/80'
                      : 'border-white/80'
                }`}
              >
                <div className="flex flex-wrap items-center gap-4">
                  <button type="button" onClick={() => openDrawer(agent)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-serif text-lg ${
                        agent.is_active
                          ? 'bg-slate-950 text-amber-100'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {initial}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-900">{agent.name}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            agent.is_active
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {agent.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                          <Sparkles className="h-3 w-3" />
                          {displayCallIqProvider(agent.provider)}
                        </span>
                        <span className="text-[11px] text-slate-400">{agent.agent_type}</span>
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center gap-1">
                    {!agent.is_active ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void setActive(agent)}
                        className="rounded-full px-3 py-1.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Activate
                      </button>
                    ) : null}
                    <IconBtn light title="Edit" onClick={() => openDrawer(agent, true)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn light title="Duplicate" disabled={saving} onClick={() => void duplicate(agent)}>
                      <Copy className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn
                      light
                      title={agent.is_active ? 'Activate another first' : 'Delete'}
                      disabled={saving || agent.is_active}
                      onClick={() => void deleteAgent(agent)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="min-w-0 xl:sticky xl:top-4">{AgentEditor}</div>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  light,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  light?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full p-2 disabled:opacity-30 ${
        light
          ? 'text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900'
          : 'text-slate-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function FieldRow({
  field,
  editing,
  onChange,
  onRemove,
}: {
  field: CallIqAgentField;
  editing: boolean;
  onChange: (next: CallIqAgentField) => void;
  onRemove: () => void;
}) {
  const [optDraft, setOptDraft] = useState('');
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Type</span>
          {editing ? (
            <select
              value={field.response_type}
              onChange={(e) =>
                onChange({
                  ...field,
                  response_type: e.target.value as CallIqFieldType,
                  options: e.target.value === 'dropdown' ? field.options || ['Yes', 'No'] : undefined,
                })
              }
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            >
              {Object.entries(CALL_IQ_FIELD_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm font-medium text-slate-300">{CALL_IQ_FIELD_TYPE_LABELS[field.response_type]}</p>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Field</span>
          {editing ? (
            <div className="flex gap-1">
              <input
                value={field.name}
                onChange={(e) =>
                  onChange({
                    ...field,
                    name: e.target.value,
                    key:
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '_')
                        .replace(/^_|_$/g, '') || field.key,
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-2 py-1.5 text-sm font-semibold text-white"
              />
              <button type="button" onClick={onRemove} className="rounded-xl p-1.5 text-slate-500 hover:text-rose-300">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="text-sm font-semibold text-white">{field.name}</p>
          )}
        </label>
      </div>
      {field.response_type === 'dropdown' ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {(field.options || []).map((opt, i) => (
            <span
              key={`${opt}-${i}`}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                CALL_IQ_OPTION_CHIP_CLASSES[i % CALL_IQ_OPTION_CHIP_CLASSES.length]
              }`}
            >
              {opt}
              {editing ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...field, options: (field.options || []).filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
          {editing ? (
            <form
              className="inline-flex"
              onSubmit={(e) => {
                e.preventDefault();
                const v = optDraft.trim();
                if (!v) return;
                onChange({ ...field, options: [...(field.options || []), v] });
                setOptDraft('');
              }}
            >
              <input
                value={optDraft}
                onChange={(e) => setOptDraft(e.target.value)}
                placeholder="Add"
                className="w-24 rounded-full border border-dashed border-white/20 bg-transparent px-2 py-0.5 text-[11px] text-slate-200"
              />
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
