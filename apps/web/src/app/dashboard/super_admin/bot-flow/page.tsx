'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Brain,
  Edit3,
  FlaskConical,
  Plus,
  Power,
  RefreshCw,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { splitWhatsAppPreviewParts } from '@/lib/whatsappBotFlow/formatReply';
import PeriodicPlansPreview from '@/components/shared/bot-flow/PeriodicPlansPreview';
import { extractCarModelFromMessage, type PricingPlanItem } from '@/lib/whatsappBotFlow/periodicPlansUi';
import AgentTabs, { type AgentTabId } from './components/AgentTabs';
import BookingAgentPanel from './components/BookingAgentPanel';
import FollowupAgentPanel from './components/FollowupAgentPanel';
import ChaseAgentPanel from './components/ChaseAgentPanel';
import AgentMonitoringPanel from './components/AgentMonitoringPanel';
import AgentEnvSettingsPanel from './components/AgentEnvSettingsPanel';
import BookingAgentTestModal from './components/BookingAgentTestModal';
import AgentDryRunTestModal from './components/AgentDryRunTestModal';

type TestModalId = null | 'brain' | 'misa' | 'followup' | 'chase';

const TAB_TEST_CONFIG: Partial<Record<AgentTabId, { modal: Exclude<TestModalId, null>; label: string }>> = {
  brain: { modal: 'brain', label: 'Test Brain' },
  booking: { modal: 'misa', label: 'Test MISA AI' },
  followup: { modal: 'followup', label: 'Test Follow-up Bot' },
  chase: { modal: 'chase', label: 'Test Chase Bot' },
};

type BotFlow = {
  id: string;
  name: string;
  status: string;
  channel?: string;
  updated_at?: string;
  created_at?: string;
};

type BrainTools = {
  pricing: boolean;
  workshops: boolean;
  service_details: boolean;
  booking: boolean;
};

type BrainConfig = {
  enabled: boolean;
  mode: 'AI_FIRST' | 'FLOW_FIRST' | 'HYBRID';
  model: 'gpt-4o' | 'gpt-4o-mini';
  active_flow_id: string | null;
  system_prompt_addon: string;
  fallback_message: string;
  skip_assigned_chats: boolean;
  session_window_hours?: number;
  reopen_template_name?: string | null;
  reopen_template_language?: string;
  reopen_template_params?: string[];
  tools: BrainTools;
};

type BrainRuntime = {
  connected: boolean;
  openai_configured: boolean;
  whatsapp_configured: boolean;
  phase: string;
  mode?: string;
  flow_executor_ready?: boolean;
  active_flow_published?: boolean;
};

type CityPinRow = {
  id: string;
  name: string;
  state?: string | null;
  city_pincodes?: string | null;
  is_active?: boolean;
};

const DEFAULT_CONFIG: BrainConfig = {
  enabled: false,
  mode: 'AI_FIRST',
  model: 'gpt-4o',
  active_flow_id: null,
  system_prompt_addon:
    'MISA = MyFNG Instant Service Assistant. Keep replies short. No long intros. List every service plan from pricing tool. Never use ** markdown.',
  fallback_message:
    'Thanks for reaching out to MyFNG! Our team will get back to you shortly. For urgent help, call 9152307030.',
  skip_assigned_chats: true,
  session_window_hours: 24,
  reopen_template_name: 'lead_enquiry_account_update',
  reopen_template_language: 'en',
  reopen_template_params: [],
  tools: {
    pricing: true,
    workshops: true,
    service_details: true,
    booking: true,
  },
};

export default function SuperAdminBotFlowPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AgentTabId>('brain');
  const [flows, setFlows] = useState<BotFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [brainConfig, setBrainConfig] = useState<BrainConfig>(DEFAULT_CONFIG);
  const [brainRuntime, setBrainRuntime] = useState<BrainRuntime | null>(null);
  const [brainLoading, setBrainLoading] = useState(true);
  const [brainSaving, setBrainSaving] = useState(false);
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);
  const [activeTestModal, setActiveTestModal] = useState<TestModalId>(null);
  const [brainTestMessage, setBrainTestMessage] = useState('Hi, periodic service price for Swift in 400001?');
  const [brainTestPhone, setBrainTestPhone] = useState('919999999999');
  const [brainTestLoading, setBrainTestLoading] = useState(false);
  const [brainTestReply, setBrainTestReply] = useState('');
  const [brainTestPricing, setBrainTestPricing] = useState<PricingPlanItem[]>([]);
  const [brainTestRoute, setBrainTestRoute] = useState('');
  const [cityPins, setCityPins] = useState<CityPinRow[]>([]);
  const [cityPinsLoading, setCityPinsLoading] = useState(false);
  const [cityPinSavingId, setCityPinSavingId] = useState<string | null>(null);
  const [seedingPresets, setSeedingPresets] = useState(false);

  const dedupedFlows = useMemo(() => {
    const byName = new Map<string, BotFlow>();
    for (const flow of flows) {
      const key = String(flow.name || flow.id).trim().toLowerCase();
      const current = byName.get(key);
      if (!current) {
        byName.set(key, flow);
        continue;
      }

      const score = (item: BotFlow) => {
        let points = 0;
        if (item.id === brainConfig.active_flow_id) points += 100;
        if (String(item.status || '').toUpperCase() === 'PUBLISHED') points += 20;
        if (item.updated_at) points += new Date(item.updated_at).getTime() / 1_000_000_000_000;
        return points;
      };

      if (score(flow) >= score(current)) {
        byName.set(key, flow);
      }
    }

    return Array.from(byName.values()).sort((a, b) => {
      const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [flows, brainConfig.active_flow_id]);

  const hiddenDuplicateCount = Math.max(0, flows.length - dedupedFlows.length);

  const activeFlow = useMemo(
    () => dedupedFlows.find((flow) => flow.id === brainConfig.active_flow_id) || null,
    [dedupedFlows, brainConfig.active_flow_id],
  );

  const citiesWithPincodes = useMemo(
    () =>
      cityPins.filter((city) => {
        const pincodes = String(city.city_pincodes || '').trim();
        return pincodes.length > 0;
      }),
    [cityPins],
  );

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

  const loadBrain = async () => {
    setBrainLoading(true);
    try {
      const res = await fetch('/api/whatsapp/bot-flow/brain');
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load AI brain config');
      setBrainConfig({ ...DEFAULT_CONFIG, ...(json.config || {}) });
      setBrainRuntime(json.runtime || null);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load AI brain config');
    } finally {
      setBrainLoading(false);
    }
  };

  useEffect(() => {
    loadFlows();
    loadBrain();
    loadCityPincodes();
  }, []);

  useEffect(() => {
    if (!activeTestModal) return;
    const expected = TAB_TEST_CONFIG[activeTab]?.modal;
    if (expected && activeTestModal !== expected) {
      setActiveTestModal(null);
    }
  }, [activeTab, activeTestModal]);

  const activeTabTest = TAB_TEST_CONFIG[activeTab];

  const loadCityPincodes = async () => {
    setCityPinsLoading(true);
    try {
      const res = await fetch('/api/super_admin/cities/pincodes');
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load city pincodes');
      setCityPins(Array.isArray(json.cities) ? json.cities : []);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load city pincodes');
    } finally {
      setCityPinsLoading(false);
    }
  };

  const saveCityPincodes = async (cityId: string, cityPincodes: string) => {
    setCityPinSavingId(cityId);
    try {
      const res = await fetch('/api/super_admin/cities/pincodes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city_id: cityId, city_pincodes: cityPincodes }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to save pincodes');
      setCityPins((prev) => prev.map((city) => (city.id === cityId ? { ...city, ...json.city } : city)));
      toast.success('City pincodes updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save pincodes');
    } finally {
      setCityPinSavingId(null);
    }
  };

  const saveBrain = async (patch: Partial<BrainConfig>) => {
    setBrainSaving(true);
    try {
      const next = { ...brainConfig, ...patch, tools: { ...brainConfig.tools, ...(patch.tools || {}) } };
      const res = await fetch('/api/whatsapp/bot-flow/brain', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: next }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to save AI brain');
      setBrainConfig({ ...DEFAULT_CONFIG, ...(json.config || {}) });
      toast.success('AI brain settings saved');
      await loadBrain();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save AI brain');
    } finally {
      setBrainSaving(false);
    }
  };

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

  const handleSetActive = async (flowId: string) => {
    setSettingActiveId(flowId);
    try {
      const res = await fetch(`/api/whatsapp/bot-flow/${flowId}/set-active`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to set active flow');
      setBrainConfig((prev) => ({ ...prev, active_flow_id: flowId }));
      toast.success(json?.note || 'Active flow updated');
      await loadBrain();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to set active flow');
    } finally {
      setSettingActiveId(null);
    }
  };

  const runBrainTest = async () => {
    setBrainTestLoading(true);
    setBrainTestReply('');
    setBrainTestPricing([]);
    try {
      const res = await fetch('/api/whatsapp/bot-flow/brain/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: brainTestMessage, phone: brainTestPhone }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Brain test failed');
      setBrainTestReply(json?.result?.reply || json?.result?.skippedReason || 'No reply generated');
      setBrainTestPricing(Array.isArray(json?.result?.pricing) ? json.result.pricing : []);
      setBrainTestRoute(String(json?.result?.route || ''));
    } catch (error: any) {
      toast.error(error?.message || 'Brain test failed');
    } finally {
      setBrainTestLoading(false);
    }
  };

  const handleSeedPresets = async () => {
    setSeedingPresets(true);
    try {
      const res = await fetch('/api/whatsapp/bot-flow/seed-presets', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to install preset flows');
      toast.success('Preset flows installed (Router v1 published + active)');
      await loadFlows();
      await loadBrain();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to install preset flows');
    } finally {
      setSeedingPresets(false);
    }
  };

  const runtimeLabel = brainConfig.enabled
    ? brainRuntime?.connected
      ? 'Live'
      : 'Enabled (check OpenAI / WhatsApp env)'
    : 'Disabled';

  return (
    <div className="space-y-4 p-4 sm:space-y-5 sm:p-6 md:space-y-6">
      <div className="rounded-xl bg-gradient-to-r from-brand-secondary to-brand-primary p-5 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-yellow-300 sm:text-3xl">Bot Flows</h1>
            <p className="mt-1 text-sm text-blue-100">
              Manage flows, AI brain, and WhatsApp agents — MISA AI, Follow-up, and Chase bots.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded-full px-2.5 py-1 font-semibold ${
                  brainConfig.enabled && brainRuntime?.connected
                    ? 'bg-emerald-500/20 text-emerald-100'
                    : 'bg-white/15 text-blue-100'
                }`}
              >
                Brain: {runtimeLabel}
              </span>
              <span className="rounded-full bg-white/15 px-2.5 py-1 font-semibold text-blue-100">
                Active flow: {activeFlow?.name || 'None'}
              </span>
              <span className="rounded-full bg-white/15 px-2.5 py-1 font-semibold text-blue-100">
                Mode: {brainRuntime?.mode || brainConfig.mode}
              </span>
              <span className="rounded-full bg-white/15 px-2.5 py-1 font-semibold text-blue-100">
                Phase: {brainRuntime?.phase || 'PHASE_2'}
              </span>
              {brainRuntime?.flow_executor_ready ? (
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 font-semibold text-emerald-100">
                  Flow executor ready
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                loadFlows();
                loadBrain();
              }}
              disabled={loading || brainLoading}
              className="inline-flex items-center rounded-lg bg-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/30 disabled:opacity-60"
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleSeedPresets}
              disabled={seedingPresets}
              className="inline-flex items-center rounded-lg bg-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/30 disabled:opacity-60"
            >
              <Workflow className="mr-1 h-4 w-4" />
              {seedingPresets ? 'Installing...' : 'Install Preset Flows'}
            </button>
            {activeTabTest ? (
              <button
                type="button"
                onClick={() =>
                  setActiveTestModal((prev) => (prev === activeTabTest.modal ? null : activeTabTest.modal))
                }
                className={`inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold ${
                  activeTestModal === activeTabTest.modal
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                <FlaskConical className="mr-1 h-4 w-4" />
                {activeTabTest.label}
              </button>
            ) : null}
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

      <AgentTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'booking' ? <BookingAgentPanel /> : null}
      {activeTab === 'followup' ? <FollowupAgentPanel /> : null}
      {activeTab === 'chase' ? <ChaseAgentPanel /> : null}
      {activeTab === 'monitoring' ? <AgentMonitoringPanel /> : null}
      {activeTab === 'settings' ? <AgentEnvSettingsPanel /> : null}

      {activeTab === 'brain' ? (
      <>
      <div className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Brain className="h-4 w-4 text-violet-600" />
            WhatsApp AI Brain
          </div>
          <button
            type="button"
            onClick={() => saveBrain({ enabled: !brainConfig.enabled })}
            disabled={brainSaving || brainLoading}
            className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
              brainConfig.enabled
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Power className="mr-1 h-3.5 w-3.5" />
            {brainConfig.enabled ? 'Enabled' : 'Enable Brain'}
          </button>
        </div>

        {brainLoading ? (
          <div className="py-6 text-sm text-gray-500">Loading brain settings...</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Mode
                </label>
                <select
                  value={brainConfig.mode}
                  onChange={(e) =>
                    setBrainConfig((prev) => ({
                      ...prev,
                      mode: e.target.value as BrainConfig['mode'],
                    }))
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="AI_FIRST">AI First</option>
                  <option value="HYBRID">Hybrid (Flow → AI fallback)</option>
                  <option value="FLOW_FIRST">Flow First</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Model
                </label>
                <select
                  value={brainConfig.model}
                  onChange={(e) =>
                    setBrainConfig((prev) => ({
                      ...prev,
                      model: e.target.value as BrainConfig['model'],
                    }))
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="gpt-4o">gpt-4o (MISA default)</option>
                  <option value="gpt-4o-mini">gpt-4o-mini (faster / cheaper)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  WhatsApp prompt add-on
                </label>
                <textarea
                  value={brainConfig.system_prompt_addon}
                  onChange={(e) =>
                    setBrainConfig((prev) => ({ ...prev, system_prompt_addon: e.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Fallback message
                </label>
                <textarea
                  value={brainConfig.fallback_message}
                  onChange={(e) =>
                    setBrainConfig((prev) => ({ ...prev, fallback_message: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  MISA Tools
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {(
                    [
                      ['pricing', 'Pricing & PIN'],
                      ['workshops', 'Workshops'],
                      ['service_details', 'Service details'],
                      ['booking', 'Create booking'],
                    ] as Array<[keyof BrainTools, string]>
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 rounded-md bg-white px-2 py-2">
                      <input
                        type="checkbox"
                        checked={brainConfig.tools[key]}
                        onChange={(e) =>
                          setBrainConfig((prev) => ({
                            ...prev,
                            tools: { ...prev.tools, [key]: e.target.checked },
                          }))
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">24h Window Reopen Template</label>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={brainConfig.reopen_template_name || ''}
                  onChange={(e) =>
                    setBrainConfig((prev) => ({
                      ...prev,
                      reopen_template_name: e.target.value.trim() || null,
                    }))
                  }
                  placeholder="e.g. lead_enquiry_account_update (Meta-approved UTILITY template)"
                />
                <p className="text-[11px] text-gray-500">
                  Used when free-text reply fails outside WhatsApp 24h session. Default:{' '}
                  <span className="font-mono">lead_enquiry_account_update</span> — customer name as {'{{1}}'}.
                  Customer reply reopens the 24h window for MISA free text.
                </p>
              </div>

              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={brainConfig.skip_assigned_chats}
                  onChange={(e) =>
                    setBrainConfig((prev) => ({ ...prev, skip_assigned_chats: e.target.checked }))
                  }
                />
                Skip auto-reply when chat is assigned to a human agent
              </label>

              <div className="rounded-lg border border-dashed p-3 text-xs text-gray-600">
                <div className="mb-1 font-semibold text-gray-800">Runtime checks</div>
                <div>OpenAI: {brainRuntime?.openai_configured ? '✅ configured' : '❌ missing OPENAI_API_KEY'}</div>
                <div>
                  WhatsApp send:{' '}
                  {brainRuntime?.whatsapp_configured ? '✅ configured' : '❌ missing WhatsApp env'}
                </div>
                <div>
                  Flow executor:{' '}
                  {brainRuntime?.flow_executor_ready ? '✅ published active flow' : '❌ publish active flow'}
                </div>
                <div className="mt-2 text-gray-500">
                  Mode {brainConfig.mode}: inbound messages route through flow executor and/or MISA AI brain.
                </div>
              </div>

              <button
                type="button"
                onClick={() => saveBrain(brainConfig)}
                disabled={brainSaving}
                className="inline-flex w-full items-center justify-center rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                {brainSaving ? 'Saving...' : 'Save Brain Settings'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Workflow className="h-4 w-4 text-gray-500" />
            Created Flow List
          </div>
          {hiddenDuplicateCount > 0 ? (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
              {hiddenDuplicateCount} duplicate copies hidden
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-500">Loading flows...</div>
        ) : dedupedFlows.length === 0 ? (
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
                {dedupedFlows.map((flow) => {
                  const isActive = brainConfig.active_flow_id === flow.id;
                  return (
                    <tr key={flow.id} className="border-b last:border-0">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-gray-800">{flow.name}</div>
                          {isActive ? (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                              ACTIVE
                            </span>
                          ) : null}
                        </div>
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
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleSetActive(flow.id)}
                            disabled={settingActiveId === flow.id || isActive}
                            className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-60"
                          >
                            {settingActiveId === flow.id ? 'Setting...' : isActive ? 'Active' : 'Set Active'}
                          </button>
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
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">City Pincodes (validate_pincode)</h3>
            <p className="text-xs text-gray-500 mt-1">
              Only cities with pincodes configured are shown. Edit existing service areas (e.g. 400001).
            </p>
          </div>
          <button
            type="button"
            onClick={loadCityPincodes}
            disabled={cityPinsLoading}
            className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {cityPinsLoading ? (
          <div className="py-6 text-sm text-gray-500">Loading cities...</div>
        ) : citiesWithPincodes.length === 0 ? (
          <div className="py-6 text-sm text-gray-500">No cities with pincodes configured yet.</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {citiesWithPincodes.map((city) => (
              <div key={city.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[160px_1fr_auto] sm:items-center">
                <div>
                  <div className="text-sm font-semibold text-gray-800">{city.name}</div>
                  <div className="text-[11px] text-gray-500">{city.state || '—'}</div>
                </div>
                <input
                  className="w-full rounded-lg border px-2 py-1.5 text-xs font-mono"
                  defaultValue={city.city_pincodes || ''}
                  placeholder="400001, 400002, 400601"
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next !== String(city.city_pincodes || '').trim()) {
                      saveCityPincodes(city.id, next);
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={cityPinSavingId === city.id}
                  onClick={(e) => {
                    const input = (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement) || null;
                    if (input) saveCityPincodes(city.id, input.value);
                  }}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {cityPinSavingId === city.id ? 'Saving...' : 'Save'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      </>
      ) : null}

      {activeTestModal === 'brain' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Test WhatsApp AI Brain</h3>
              <button
                type="button"
                onClick={() => setActiveTestModal(null)}
                className="text-sm font-semibold text-gray-500 hover:text-gray-800"
              >
                Close
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Test phone</label>
                <input
                  value={brainTestPhone}
                  onChange={(e) => setBrainTestPhone(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Customer message</label>
                <textarea
                  value={brainTestMessage}
                  onChange={(e) => setBrainTestMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={runBrainTest}
                disabled={brainTestLoading}
                className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <FlaskConical className="mr-1.5 h-4 w-4" />
                {brainTestLoading ? 'Running...' : 'Run dry test (no WhatsApp send)'}
              </button>
              {brainTestRoute ? (
                <p className="text-xs font-semibold text-violet-700">Route: {brainTestRoute}</p>
              ) : null}
              {brainTestPricing.length > 0 ? (
                <PeriodicPlansPreview
                  plans={brainTestPricing}
                  carLabel={extractCarModelFromMessage(brainTestMessage) || undefined}
                />
              ) : null}
              {brainTestReply ? (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">WhatsApp text reply</p>
                  <div className="rounded-lg border bg-slate-50 p-3 text-sm text-gray-800 whitespace-pre-wrap">
                    {splitWhatsAppPreviewParts(brainTestReply).map((part, index) =>
                      part.type === 'bold' ? (
                        <strong key={index}>{part.value}</strong>
                      ) : (
                        <span key={index}>{part.value}</span>
                      ),
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {activeTestModal === 'misa' ? (
        <BookingAgentTestModal title="MISA AI" onClose={() => setActiveTestModal(null)} />
      ) : null}

      {activeTestModal === 'followup' ? (
        <AgentDryRunTestModal
          title="Follow-up Bot"
          agentType="FOLLOWUP"
          onClose={() => setActiveTestModal(null)}
        />
      ) : null}

      {activeTestModal === 'chase' ? (
        <AgentDryRunTestModal title="Chase Bot" agentType="CHASE" onClose={() => setActiveTestModal(null)} />
      ) : null}
    </div>
  );
}
