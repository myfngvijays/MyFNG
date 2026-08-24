'use client';

import { useCallback, useEffect, useState } from 'react';
import { Phone, Filter, Timer, Sparkles, Loader2, Save } from 'lucide-react';
import type { CallIqWorkflowConfig, SalesPlaybook } from '@/lib/telecaller/salesPlaybookDefaults';
import { ALL_CRM_LEAD_STATUS_NAMES, defaultCallIqWorkflow } from '@/lib/telecaller/salesPlaybookDefaults';

function Node({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: typeof Phone;
  title: string;
  body: string;
  tone: 'trigger' | 'filter' | 'ai';
}) {
  const ring =
    tone === 'trigger'
      ? 'border-sky-200 bg-sky-50'
      : tone === 'ai'
        ? 'border-violet-200 bg-violet-50'
        : 'border-amber-200 bg-amber-50';
  return (
    <div className={`rounded-2xl border ${ring} p-3 shadow-sm min-w-0`}>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
          <Icon className="h-4 w-4 text-slate-700" />
        </span>
        <p className="text-sm font-bold text-slate-900">{title}</p>
      </div>
      <p className="mt-2 text-xs text-slate-600 leading-relaxed">{body}</p>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex justify-center py-1">
      <div className="h-6 w-px bg-slate-300" />
    </div>
  );
}

export default function CallIqFlowchart({ editable }: { editable?: boolean }) {
  const [wf, setWf] = useState<CallIqWorkflowConfig>(defaultCallIqWorkflow());
  const [crmStatuses, setCrmStatuses] = useState<string[]>([...ALL_CRM_LEAD_STATUS_NAMES]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [playbook, setPlaybook] = useState<SalesPlaybook | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pbRes, stRes] = await Promise.all([
        fetch('/api/super_admin/ai-suite/playbook', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/lead-manager/statuses', { credentials: 'include', cache: 'no-store' }),
      ]);
      const pb = await pbRes.json().catch(() => ({}));
      const st = await stRes.json().catch(() => ({}));
      if (pb?.playbook) {
        setPlaybook(pb.playbook);
        if (pb.playbook.call_iq_workflow) setWf(pb.playbook.call_iq_workflow);
      }
      const names = (Array.isArray(st?.statuses) ? st.statuses : [])
        .filter((s: any) => s?.is_active !== false)
        .map((s: any) => String(s.name || s.code || '').trim())
        .filter(Boolean);
      if (names.length) setCrmStatuses(names);
    } catch (e: any) {
      setError(e?.message || 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!playbook) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/super_admin/ai-suite/playbook', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...playbook, call_iq_workflow: wf }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      setPlaybook(json.playbook);
      if (json.playbook?.call_iq_workflow) setWf(json.playbook.call_iq_workflow);
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function toggleStatus(name: string) {
    setWf((prev) => {
      const has = prev.lead_statuses.some((s) => s.toLowerCase() === name.toLowerCase());
      return {
        ...prev,
        lead_statuses: has
          ? prev.lead_statuses.filter((s) => s.toLowerCase() !== name.toLowerCase())
          : [...prev.lead_statuses, name],
      };
    });
  }

  const selected = wf.lead_statuses.slice(0, 3).join(', ');
  const extra = Math.max(0, wf.lead_statuses.length - 3);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">AI Workflow — Call Audit</h2>
          <p className="text-[11px] text-slate-500">
            Recording complete → your CRM lead status → duration ≥ {wf.min_duration_sec}s → SOP
          </p>
        </div>
        {editable ? (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save flow
          </button>
        ) : null}
      </div>

      {error ? <p className="text-xs text-amber-800">{error}</p> : null}
      {saved ? <p className="text-xs text-emerald-800">Workflow saved.</p> : null}

      <div>
        <Node
          icon={Phone}
          tone="trigger"
          title="On call recording completed"
          body="Smartflo webhook / recordings cron attaches the recording."
        />
        <Arrow />
        <Node
          icon={Filter}
          tone="filter"
          title="Check If Lead"
          body={`Lead status is ${selected || '—'}${extra ? ` +${extra}` : ''}.`}
        />
        <Arrow />
        <Node
          icon={Timer}
          tone="filter"
          title="Duration check"
          body={`call_duration ≥ ${wf.min_duration_sec} seconds.`}
        />
        <Arrow />
        <Node
          icon={Sparkles}
          tone="ai"
          title="Call Audit SOP"
          body={
            wf.use_deep_ai
              ? 'Deep AI: recording → transcript → SOP. Free fallback if no audio.'
              : 'Free SOP from notes only (no listen).'
          }
        />
      </div>

      {editable ? (
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap gap-3">
            <label className="text-xs font-semibold text-slate-500 flex items-center gap-2">
              <input
                type="checkbox"
                checked={wf.enabled}
                onChange={(e) => setWf({ ...wf, enabled: e.target.checked })}
              />
              Workflow enabled
            </label>
            <label className="text-xs font-semibold text-slate-500 flex items-center gap-2">
              <input
                type="checkbox"
                checked={wf.use_deep_ai}
                onChange={(e) => setWf({ ...wf, use_deep_ai: e.target.checked })}
              />
              Deep AI
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Min sec
              <input
                type="number"
                min={0}
                className="ml-2 w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                value={wf.min_duration_sec}
                onChange={(e) => setWf({ ...wf, min_duration_sec: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">
              Lead statuses (from your CRM — same as Lead Status)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {crmStatuses.map((name) => {
                const on = wf.lead_statuses.some((s) => s.toLowerCase() === name.toLowerCase());
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleStatus(name)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                      on
                        ? 'bg-violet-700 text-white ring-violet-700'
                        : 'bg-white text-slate-600 ring-slate-200'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
