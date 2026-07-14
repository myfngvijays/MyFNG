'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AgentConfig, TelecrmDispositionRule } from '@/lib/whatsappAgents/shared/types';

const DEFAULT_RULES: TelecrmDispositionRule[] = [
  {
    id: 'interested',
    disposition: 'Interested',
    enabled: true,
    trigger_on: 'both',
    bot: 'CHASE',
    message_mode: 'ai',
    ai_prompt_addon:
      'TeleCRM stage: Interested. Customer showed interest — offer car service booking, share value, one clear CTA.',
  },
  {
    id: 'follow-up',
    disposition: 'Follow-up',
    enabled: true,
    trigger_on: 'both',
    bot: 'FOLLOWUP',
    message_mode: 'ai',
    ai_prompt_addon:
      'TeleCRM stage: Follow-up. Telecaller marked callback needed — gentle reminder, ask best time for car service.',
  },
  {
    id: 'attempted-contact',
    disposition: 'Attempted Contact',
    enabled: true,
    trigger_on: 'both',
    bot: 'CHASE',
    message_mode: 'fixed',
    message:
      'Hi {{name}}, we tried reaching you about your car service enquiry with MyFNG. When is a good time to connect?',
  },
  {
    id: 'not-interested',
    disposition: 'Not Interested',
    enabled: true,
    trigger_on: 'disposition_change',
    bot: 'NONE',
    message_mode: 'skip',
    end_active_bots: true,
  },
];

const STAGE_PRESETS = [
  'Fresh',
  'Interested',
  'Follow-up',
  'Attempted Contact',
  'Appointment Scheduled',
  'He Will Visit',
  'Service Due',
  'Not Interested',
  'DO NOT CALL',
  'Lost',
  'WON',
];

function newRule(): TelecrmDispositionRule {
  return {
    id: `rule_${Date.now()}`,
    disposition: 'Interested',
    enabled: true,
    trigger_on: 'both',
    bot: 'CHASE',
    message_mode: 'ai',
    ai_prompt_addon: '',
  };
}

export default function DispositionRulesEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [rules, setRules] = useState<TelecrmDispositionRule[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/agents/chase/config');
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load');
      const config = json.config as AgentConfig;
      const block = (config.triggers_json?.disposition_rules || {}) as {
        enabled?: boolean;
        rules?: TelecrmDispositionRule[];
      };
      setEnabled(block.enabled !== false);
      setRules(Array.isArray(block.rules) && block.rules.length ? block.rules : [...DEFAULT_RULES]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Load failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRule = (index: number, patch: Partial<TelecrmDispositionRule>) => {
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/whatsapp/agents/chase/config');
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load config');
      const config = json.config as AgentConfig;
      const next = {
        ...config,
        triggers_json: {
          ...config.triggers_json,
          disposition_rules: { enabled, rules },
        },
      };
      const saveRes = await fetch('/api/whatsapp/agents/chase/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: next }),
      });
      const saveJson = await saveRes.json();
      if (!saveRes.ok || !saveJson?.success) throw new Error(saveJson?.error || 'Save failed');
      toast.success('TeleCRM stage rules saved');
      await load();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Save failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl border bg-white" />;
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">TeleCRM Stage → WhatsApp Messages</h3>
          <p className="mt-1 text-xs text-gray-500">
            Har TeleCRM field (Interested, Follow-up, Not Interested…) ke liye alag bot aur message set karo.
            Placeholders: <code className="text-[10px]">{'{{name}}'}</code>,{' '}
            <code className="text-[10px]">{'{{city}}'}</code>,{' '}
            <code className="text-[10px]">{'{{vehicle_model}}'}</code>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setRules([...DEFAULT_RULES])}
            className="inline-flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Reset defaults
          </button>
          <button
            type="button"
            onClick={() => setRules((prev) => [...prev, newRule()])}
            className="inline-flex items-center rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add stage
          </button>
        </div>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-800">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="rounded border-gray-300"
        />
        Enable TeleCRM stage rules (overrides default chase dispositions)
      </label>

      <div className="space-y-3">
        {rules.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-xs text-gray-500">
            No rules yet. Add stage ya Save ke baad defaults load honge (Interested, Follow-up, etc.).
          </p>
        ) : null}

        {rules.map((rule, index) => (
          <div key={rule.id || index} className="rounded-lg border bg-slate-50 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={rule.enabled !== false}
                  onChange={(e) => updateRule(index, { enabled: e.target.checked })}
                />
                Enabled
              </label>
              <button
                type="button"
                onClick={() => setRules((prev) => prev.filter((_, i) => i !== index))}
                className="inline-flex items-center text-xs text-red-600 hover:text-red-800"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Remove
              </button>
            </div>

            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-gray-500">
                  TeleCRM stage
                </label>
                <input
                  list={`stages-${index}`}
                  className="w-full rounded border px-2 py-1.5 text-xs"
                  value={rule.disposition}
                  onChange={(e) => updateRule(index, { disposition: e.target.value })}
                  placeholder="e.g. Interested"
                />
                <datalist id={`stages-${index}`}>
                  {STAGE_PRESETS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-gray-500">Trigger</label>
                <select
                  className="w-full rounded border px-2 py-1.5 text-xs"
                  value={rule.trigger_on || 'both'}
                  onChange={(e) =>
                    updateRule(index, {
                      trigger_on: e.target.value as TelecrmDispositionRule['trigger_on'],
                    })
                  }
                >
                  <option value="both">New lead + stage change</option>
                  <option value="new_lead">New lead only</option>
                  <option value="disposition_change">Stage change only</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-gray-500">Bot</label>
                <select
                  className="w-full rounded border px-2 py-1.5 text-xs"
                  value={rule.bot || 'CHASE'}
                  onChange={(e) => updateRule(index, { bot: e.target.value as TelecrmDispositionRule['bot'] })}
                >
                  <option value="CHASE">Chase Bot</option>
                  <option value="FOLLOWUP">Follow-up Bot</option>
                  <option value="NONE">None (stop only)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-gray-500">Message type</label>
                <select
                  className="w-full rounded border px-2 py-1.5 text-xs"
                  value={rule.message_mode || 'ai'}
                  onChange={(e) =>
                    updateRule(index, {
                      message_mode: e.target.value as TelecrmDispositionRule['message_mode'],
                    })
                  }
                >
                  <option value="ai">AI (custom prompt)</option>
                  <option value="fixed">Fixed text</option>
                  <option value="template">Meta template</option>
                  <option value="skip">Skip message</option>
                </select>
              </div>
            </div>

            {rule.message_mode === 'fixed' ? (
              <textarea
                className="w-full rounded border px-2 py-1.5 text-xs"
                rows={2}
                value={rule.message || ''}
                onChange={(e) => updateRule(index, { message: e.target.value })}
                placeholder="Hi {{name}}, ..."
              />
            ) : null}

            {rule.message_mode === 'template' ? (
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className="w-full rounded border px-2 py-1.5 text-xs font-mono"
                  value={rule.template_name || ''}
                  onChange={(e) => updateRule(index, { template_name: e.target.value })}
                  placeholder="Meta template name"
                />
                <input
                  className="w-full rounded border px-2 py-1.5 text-xs"
                  value={rule.template_language || 'en'}
                  onChange={(e) => updateRule(index, { template_language: e.target.value })}
                  placeholder="en"
                />
              </div>
            ) : null}

            {rule.message_mode === 'ai' ? (
              <textarea
                className="w-full rounded border px-2 py-1.5 text-xs"
                rows={2}
                value={rule.ai_prompt_addon || ''}
                onChange={(e) => updateRule(index, { ai_prompt_addon: e.target.value })}
                placeholder="AI instruction for this stage..."
              />
            ) : null}

            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(rule.end_active_bots)}
                onChange={(e) => updateRule(index, { end_active_bots: e.target.checked })}
              />
              Stop all active Chase/Follow-up bots (e.g. Not Interested, DO NOT CALL)
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-4 inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
      >
        <Save className="mr-1.5 h-3.5 w-3.5" />
        {saving ? 'Saving...' : 'Save stage rules'}
      </button>
    </div>
  );
}
