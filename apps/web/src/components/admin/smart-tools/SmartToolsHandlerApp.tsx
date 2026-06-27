'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, RefreshCw, Save, Smartphone, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  DEFAULT_SMART_TOOLS_HANDLER,
  type SmartToolRow,
  type SmartToolsHandlerConfig,
} from '@/lib/smart-tools-config';
import { countEnabledSmartToolPlacements, listEnabledSmartToolPlacementLabels } from '@/lib/smart-tools-placements';
import SmartToolAdvancedFields from './SmartToolAdvancedFields';

type MembershipPlanOption = {
  id: string;
  name: string;
  code: string;
  membership_type: string;
  active: boolean;
};

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
      />
      <span className="text-xs font-semibold text-gray-700">{label}</span>
    </label>
  );
}

export default function SmartToolsHandlerApp() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SmartToolsHandlerConfig>(DEFAULT_SMART_TOOLS_HANDLER);
  const [plans, setPlans] = useState<MembershipPlanOption[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [toolsRes, plansRes] = await Promise.all([
        fetch('/api/super_admin/smart-tools', { cache: 'no-store' }),
        fetch('/api/super_admin/membership-plans', { cache: 'no-store' }),
      ]);
      const toolsJson = await toolsRes.json().catch(() => ({}));
      const plansJson = await plansRes.json().catch(() => ({}));

      if (!toolsRes.ok) {
        throw new Error(
          [toolsJson?.hint, toolsJson?.error].filter(Boolean).join(' — ') || 'Failed to load smart tools settings',
        );
      }

      setConfig(toolsJson.config || DEFAULT_SMART_TOOLS_HANDLER);
      setPlans(
        Array.isArray(plansJson?.data)
          ? plansJson.data.map((plan: any) => ({
              id: String(plan.id),
              name: String(plan.name || plan.code || 'Plan'),
              code: String(plan.code || ''),
              membership_type: String(plan.membership_type || 'SERVICE'),
              active: Boolean(plan.active),
            }))
          : [],
      );
    } catch (err: any) {
      toast.error(err?.message || 'Could not load Smart Tools settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/super_admin/smart-tools', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error([json?.hint, json?.error].filter(Boolean).join(' — ') || 'Save failed');
      }
      setConfig(json.config || config);
      toast.success('Smart Tools settings saved');
    } catch (err: any) {
      toast.error(err?.message || 'Could not save Smart Tools settings');
    } finally {
      setSaving(false);
    }
  };

  const updateTool = (toolId: string, patch: Partial<SmartToolRow>) => {
    setConfig((prev) => ({
      ...prev,
      tools: prev.tools.map((tool) => (tool.tool_id === toolId ? { ...tool, ...patch } : tool)),
    }));
  };

  const sortedTools = useMemo(
    () => [...config.tools].sort((a, b) => a.display_order - b.display_order || a.title.localeCompare(b.title)),
    [config.tools],
  );

  const enabledCount = sortedTools.filter((tool) => tool.enabled).length;
  const restrictedCount = sortedTools.filter(
    (tool) => tool.membership_only || (tool.allowed_membership_plan_ids || []).length > 0,
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Smartphone className="h-4 w-4" />
              Mobile App
            </div>
            <h1 className="mt-1 text-2xl font-black text-gray-900">Smart Tools Handler</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Enable tools, pick membership plans, and place each tool on Home, Search, Services, or RSA screens.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wide text-gray-500">Section settings</h2>
            <p className="mt-1 text-xs text-gray-500">Heading for the main Smart Tools grid block (main_grid slot).</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Toggle
                checked={config.section.enabled}
                onChange={(enabled) => setConfig((prev) => ({ ...prev, section: { ...prev.section, enabled } }))}
                label="Show Smart Tools section"
              />
              <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <span className="font-bold text-gray-900">{enabledCount}</span> enabled ·{' '}
                <span className="font-bold text-amber-700">{restrictedCount}</span> membership-restricted
              </div>
              <label className="block sm:col-span-2">
                <span className="text-sm font-bold text-gray-900">Section title</span>
                <input
                  value={config.section.title}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, section: { ...prev.section, title: e.target.value } }))
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  maxLength={80}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-bold text-gray-900">Section subtitle</span>
                <input
                  value={config.section.subtitle}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, section: { ...prev.section, subtitle: e.target.value } }))
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  maxLength={160}
                />
              </label>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-black uppercase tracking-wide text-gray-500">Tools</h2>
              <p className="mt-1 text-xs text-gray-500">
                Pick exact membership plans (RSA Basic, Family, Prime, etc.) and screen placements per tool.
              </p>
            </div>

            {loading ? (
              <div className="px-5 py-10 text-center text-sm text-gray-500">Loading tools…</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {sortedTools.map((tool) => {
                  const planCount = (tool.allowed_membership_plan_ids || []).length;
                  const placementCount = countEnabledSmartToolPlacements(tool.placements);
                  const placementLabels = listEnabledSmartToolPlacementLabels(tool.placements);

                  return (
                    <div key={tool.tool_id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Sparkles className="h-4 w-4 text-blue-600" />
                            <h3 className="text-base font-black text-gray-900">{tool.title}</h3>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">
                              {tool.tool_type}
                            </span>
                            {tool.membership_only || planCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                                <Crown className="h-3 w-3" />
                                {planCount > 0 ? `${planCount} plan${planCount === 1 ? '' : 's'}` : 'Members'}
                              </span>
                            ) : null}
                            {placementCount > 0 ? (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-800">
                                {placementCount} slot{placementCount === 1 ? '' : 's'}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-gray-500">{tool.subtitle || tool.tool_id}</p>
                          {placementLabels.length ? (
                            <p className="mt-1 text-[11px] text-gray-400">{placementLabels.slice(0, 3).join(' · ')}</p>
                          ) : null}
                        </div>
                        <label className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5">
                          <span className="text-xs font-bold text-gray-600">Order</span>
                          <input
                            type="number"
                            min={0}
                            max={99}
                            value={tool.display_order}
                            onChange={(e) =>
                              updateTool(tool.tool_id, {
                                display_order: Math.max(0, Number(e.target.value || 0)),
                              })
                            }
                            className="w-14 rounded-lg border border-gray-200 px-2 py-1 text-sm"
                          />
                        </label>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-4">
                        <Toggle
                          checked={tool.enabled}
                          onChange={(enabled) => updateTool(tool.tool_id, { enabled })}
                          label="Enabled"
                        />
                        <Toggle
                          checked={tool.requires_login}
                          onChange={(requires_login) => updateTool(tool.tool_id, { requires_login })}
                          label="Requires login"
                        />
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-xs font-bold text-gray-700">Title override (optional)</span>
                          <input
                            value={tool.title_override || ''}
                            onChange={(e) => updateTool(tool.tool_id, { title_override: e.target.value })}
                            placeholder={tool.title}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            maxLength={120}
                          />
                        </label>
                        {tool.tool_type === 'webview' ? (
                          <label className="block">
                            <span className="text-xs font-bold text-gray-700">Web URL override</span>
                            <input
                              value={tool.web_url_override || ''}
                              onChange={(e) => updateTool(tool.tool_id, { web_url_override: e.target.value })}
                              placeholder={tool.default_web_url || 'https://'}
                              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            />
                          </label>
                        ) : null}
                      </div>

                      <SmartToolAdvancedFields
                        tool={tool}
                        plans={plans}
                        onChange={(patch) => updateTool(tool.tool_id, patch)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside>
          <div className="sticky top-6 space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wide text-gray-500">What you can control</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li><strong>Enabled</strong> — hide a tool completely.</li>
                <li><strong>Any membership</strong> — all active Prime / RSA members.</li>
                <li><strong>Specific plans</strong> — RSA Basic, Family, Prime, etc.</li>
                <li><strong>Placements</strong> — Home, Search, Services, RSA, Settings slots.</li>
                <li><strong>Requires login</strong> — login before opening.</li>
                <li><strong>Order</strong> — lower numbers appear first in a slot.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
              <h3 className="text-xs font-black uppercase tracking-wide text-blue-700">Visibility logic</h3>
              <p className="mt-2 text-sm leading-6 text-blue-900">
                No plan selected and no &quot;Any membership&quot; = everyone sees the tool. Specific plans = only those members. Main grid slot shows the section heading.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-900">
              Run migrations <code className="rounded bg-white px-1 py-0.5">235</code> and{' '}
              <code className="rounded bg-white px-1 py-0.5">236</code> in Supabase if save fails.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
