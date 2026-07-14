'use client';

import { useCallback, useEffect, useState } from 'react';
import { Power, RefreshCw, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AgentConfig, AgentRuntime, AgentType } from '@/lib/whatsappAgents/shared/types';
import AgentRulesEditor from './AgentRulesEditor';

const API_SLUG: Record<AgentType, string> = {
  BOOKING: 'booking',
  FOLLOWUP: 'followup',
  CHASE: 'chase',
};

type Props = {
  agentType: AgentType;
  title: string;
  subtitle: string;
  showTools?: boolean;
  showTriggers?: boolean;
  triggerFields?: Array<{ key: string; label: string; type: 'boolean' | 'number' | 'string'; placeholder?: string }>;
};

export default function AgentConfigPanel({
  agentType,
  title,
  subtitle,
  showTools = false,
  showTriggers = false,
  triggerFields = [],
}: Props) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [runtime, setRuntime] = useState<AgentRuntime | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const slug = API_SLUG[agentType];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/agents/${slug}/config`);
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load config');
      setConfig(json.config);
      setRuntime(json.runtime);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load agent config');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (patch?: Partial<AgentConfig>) => {
    if (!config) return;
    setSaving(true);
    try {
      const next = { ...config, ...patch };
      const res = await fetch(`/api/whatsapp/agents/${slug}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: next }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to save');
      setConfig(json.config);
      toast.success(`${title} settings saved`);
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">Loading {title}...</div>;
  }

  const runtimeLabel = config.enabled
    ? runtime?.openai_configured && runtime?.whatsapp_configured
      ? 'Ready'
      : 'Enabled (check env)'
    : 'Disabled';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  config.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {runtimeLabel}
              </span>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-700">
                Active instances: {runtime?.active_instances ?? 0}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => save({ enabled: !config.enabled })}
              disabled={saving}
              className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold ${
                config.enabled
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Power className="mr-1 h-3.5 w-3.5" />
              {config.enabled ? 'Enabled' : 'Enable'}
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Model
              </label>
              <select
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value as AgentConfig['model'] })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="gpt-4o">gpt-4o</option>
                <option value="gpt-4o-mini">gpt-4o-mini (recommended)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Goal prompt
              </label>
              <textarea
                value={config.goal_prompt}
                onChange={(e) => setConfig({ ...config, goal_prompt: e.target.value })}
                rows={5}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Channel add-on
              </label>
              <textarea
                value={config.system_prompt_addon}
                onChange={(e) => setConfig({ ...config, system_prompt_addon: e.target.value })}
                rows={2}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Fallback message
              </label>
              <textarea
                value={config.fallback_message}
                onChange={(e) => setConfig({ ...config, fallback_message: e.target.value })}
                rows={2}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-3">
            <AgentRulesEditor
              rules={config.rules_json}
              onChange={(rules_json) => setConfig({ ...config, rules_json })}
            />

            {showTools ? (
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                  MISA Tools
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {(
                    [
                      ['pricing', 'Pricing & PIN'],
                      ['workshops', 'Workshops'],
                      ['service_details', 'Service details'],
                      ['booking', 'Create booking'],
                    ] as Array<[keyof AgentConfig['tools_json'], string]>
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 rounded-md bg-white px-2 py-2">
                      <input
                        type="checkbox"
                        checked={config.tools_json[key]}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            tools_json: { ...config.tools_json, [key]: e.target.checked },
                          })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {showTriggers && triggerFields.length > 0 ? (
              <div className="rounded-lg border bg-slate-50 p-3 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">Triggers</div>
                {triggerFields.map((field) => {
                  const val = (config.triggers_json as Record<string, unknown>)[field.key];
                  if (field.type === 'boolean') {
                    const obj = (val as { enabled?: boolean }) || {};
                    return (
                      <label key={field.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(obj.enabled)}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              triggers_json: {
                                ...config.triggers_json,
                                [field.key]: { ...(obj as object), enabled: e.target.checked },
                              },
                            })
                          }
                        />
                        {field.label}
                      </label>
                    );
                  }
                  if (field.type === 'string') {
                    return (
                      <label key={field.key} className="block text-xs text-gray-600">
                        {field.label}
                        <input
                          type="text"
                          value={String(val ?? '')}
                          placeholder={field.placeholder}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              triggers_json: {
                                ...config.triggers_json,
                                [field.key]: e.target.value.trim() || null,
                              },
                            })
                          }
                          className="mt-1 w-full rounded border px-2 py-1.5 text-sm font-mono"
                        />
                      </label>
                    );
                  }
                  return (
                    <label key={field.key} className="block text-xs text-gray-600">
                      {field.label}
                      <input
                        type="number"
                        value={Number(val ?? 0)}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            triggers_json: {
                              ...config.triggers_json,
                              [field.key]: Number(e.target.value),
                            },
                          })
                        }
                        className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                      />
                    </label>
                  );
                })}
              </div>
            ) : null}

            <div className="rounded-lg border border-dashed p-3 text-xs text-gray-600">
              <div className="mb-1 font-semibold text-gray-800">Runtime</div>
              <div>OpenAI: {runtime?.openai_configured ? '✅' : '❌ OPENAI_API_KEY'}</div>
              <div>WhatsApp: {runtime?.whatsapp_configured ? '✅' : '❌ WhatsApp env'}</div>
            </div>

            <button
              type="button"
              onClick={() => save(config)}
              disabled={saving}
              className="inline-flex w-full items-center justify-center rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {saving ? 'Saving...' : `Save ${title}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
