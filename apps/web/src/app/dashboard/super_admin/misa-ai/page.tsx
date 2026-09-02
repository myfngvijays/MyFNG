'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Coins,
  Download,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { EXPORT_DATE_PRESETS } from '@/lib/report-date-range';

type OverviewData = {
  range_label: string;
  usage_tracking_available: boolean;
  kpis: {
    conversations: number;
    messages: number;
    user_messages: number;
    assistant_messages: number;
    avg_messages_per_conversation: number;
    with_booking_progress: number;
    with_phone: number;
    ai_requests: number;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    estimated_cost_usd: number;
    estimated_cost_inr: number;
    bookings_total: number;
    bookings_completed: number;
    bookings_pending: number;
    kb_events: number;
    kb_new: number;
    conversion_rate: number;
  };
  channels: Array<{ channel: string; requests: number; tokens: number; cost_usd: number }>;
  models: Array<{ model: string; requests: number; tokens: number; cost_usd: number }>;
  daily_volume: Array<{ date: string; requests: number; tokens: number; cost_usd: number; cost_inr: number }>;
  recent_bookings: Array<{
    id: string;
    status: string;
    created_at: string;
    source: string | null;
    service_name: string | null;
    city: string | null;
  }>;
  billing: {
    usd_inr_rate: number;
    note: string;
    model_pricing_usd: Record<string, { inputPer1M: number; outputPer1M: number }>;
  };
};

type OpenAiLiveData = {
  configured: boolean;
  error?: string;
  range_label: string;
  fetched_at: string;
  admin_key_hint?: string;
  total_spend_usd: number;
  total_spend_inr: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  total_requests: number;
  cached_tokens: number;
  daily_costs: Array<{ date: string; cost_usd: number; cost_inr: number }>;
  daily_usage: Array<{ date: string; requests: number; tokens: number }>;
  by_model: Array<{ model: string; requests: number; tokens: number; input_tokens: number; output_tokens: number }>;
  by_user: Array<{ user_id: string; requests: number; tokens: number }>;
  by_line_item: Array<{ line_item: string; cost_usd: number }>;
  completions_summary: { requests: number; input_tokens: number; output_tokens: number; total_tokens: number };
};

type UsageRow = {
  id: string;
  created_at: string;
  channel: string;
  model: string;
  session_id: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  tool_calls_count: number;
  iterations: number;
  estimated_cost_usd: number;
  estimated_cost_inr: number;
  user_message_preview: string | null;
};

type BalanceAlertData = {
  configured: boolean;
  admin_api_available: boolean;
  settings: {
    baseline_usd: number | null;
    baseline_at: string | null;
    alert_threshold_usd: number;
    alert_milestones_usd: number[];
    alert_milestones_sent: number[];
    alert_enabled: boolean;
    last_alert_sent_at: string | null;
  };
  spend_since_baseline_usd: number | null;
  estimated_remaining_usd: number | null;
  estimated_remaining_inr: number | null;
  is_low: boolean;
  alert_ready: boolean;
  pending_milestones_usd?: number[];
  whatsapp_configured: boolean;
  error?: string;
  note: string;
  template_status?: {
    canSendTemplate: boolean;
    metaStatus: string | null;
    templateName: string;
    exists?: boolean;
  };
};

function fmtDate(value: string) {
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof Bot;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {sub ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : null}
        </div>
        <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function MisaAiAdminDashboardPage() {
  const [preset, setPreset] = useState('last_7_days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [usageRows, setUsageRows] = useState<UsageRow[]>([]);
  const [usagePage, setUsagePage] = useState(1);
  const [usageTotalPages, setUsageTotalPages] = useState(1);
  const [usageTrackingAvailable, setUsageTrackingAvailable] = useState(true);
  const [usageError, setUsageError] = useState('');
  const [usageTotalAllTime, setUsageTotalAllTime] = useState(0);
  const [openAiData, setOpenAiData] = useState<OpenAiLiveData | null>(null);
  const [openAiLoading, setOpenAiLoading] = useState(true);
  const [openAiError, setOpenAiError] = useState('');
  const [loading, setLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [error, setError] = useState('');
  const [balanceData, setBalanceData] = useState<BalanceAlertData | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [balanceTesting, setBalanceTesting] = useState(false);
  const [balanceTemplateWorking, setBalanceTemplateWorking] = useState(false);
  const [balanceMessage, setBalanceMessage] = useState('');
  const [baselineInput, setBaselineInput] = useState('');
  const [alertEnabledInput, setAlertEnabledInput] = useState(true);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ preset });
    if (preset === 'custom') {
      if (customStart) params.set('start', customStart);
      if (customEnd) params.set('end', customEnd);
    }
    return params;
  }, [customEnd, customStart, preset]);

  const loadOpenAiUsage = useCallback(async (force = false) => {
    if (preset === 'custom' && (!customStart || !customEnd)) {
      setOpenAiLoading(false);
      return;
    }
    setOpenAiLoading(true);
    setOpenAiError('');
    try {
      const params = buildParams();
      if (force) params.set('force', '1');
      const res = await fetch(`/api/super_admin/misa-ai/openai-usage?${params.toString()}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to load OpenAI usage');
      }
      setOpenAiData(json);
    } catch (e: any) {
      setOpenAiError(e.message || 'Failed to load OpenAI usage');
      setOpenAiData(null);
    } finally {
      setOpenAiLoading(false);
    }
  }, [buildParams, customEnd, customStart, preset]);

  const loadOverview = useCallback(async () => {
    if (preset === 'custom' && (!customStart || !customEnd)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/super_admin/misa-ai/overview?${buildParams().toString()}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load overview');
      setOverview(json);
    } catch (e: any) {
      setError(e.message || 'Failed to load overview');
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [buildParams, customEnd, customStart, preset]);

  const loadUsage = useCallback(async () => {
    if (preset === 'custom' && (!customStart || !customEnd)) {
      setUsageLoading(false);
      return;
    }
    setUsageLoading(true);
    setUsageError('');
    try {
      const params = buildParams();
      params.set('page', String(usagePage));
      params.set('limit', '25');
      const res = await fetch(`/api/super_admin/misa-ai/usage?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load usage');
      setUsageRows(Array.isArray(json.rows) ? json.rows : []);
      setUsageTotalPages(json.total_pages || 1);
      setUsageTrackingAvailable(json.usage_tracking_available !== false);
      setUsageTotalAllTime(Number(json.total_all_time || 0));
    } catch (e: any) {
      setUsageRows([]);
      setUsageTotalPages(1);
      setUsageTrackingAvailable(true);
      setUsageTotalAllTime(0);
      setUsageError(e?.message || 'Failed to load usage logs');
    } finally {
      setUsageLoading(false);
    }
  }, [buildParams, customEnd, customStart, preset, usagePage]);

  const loadBalanceAlert = useCallback(async () => {
    setBalanceLoading(true);
    setBalanceMessage('');
    try {
      const res = await fetch('/api/super_admin/misa-ai/balance-alert', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to load balance monitor');
      }
      setBalanceData(json);
      setBaselineInput(json.settings?.baseline_usd != null ? String(json.settings.baseline_usd) : '');
      setAlertEnabledInput(json.settings?.alert_enabled !== false);
    } catch (e: any) {
      setBalanceData(null);
      setBalanceMessage(e.message || 'Failed to load balance monitor');
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const saveBalanceSettings = async () => {
    setBalanceSaving(true);
    setBalanceMessage('');
    try {
      const res = await fetch('/api/super_admin/misa-ai/balance-alert', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseline_usd: Number(baselineInput),
          alert_enabled: alertEnabledInput,
          reset_baseline: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.error || 'Save failed');
      setBalanceData(json);
      setBalanceMessage('Balance monitor saved. Baseline reset to now — spend tracking starts from this moment.');
      await loadBalanceAlert();
    } catch (e: any) {
      setBalanceMessage(e.message || 'Save failed');
    } finally {
      setBalanceSaving(false);
    }
  };

  const testBalanceAlert = async () => {
    setBalanceTesting(true);
    setBalanceMessage('');
    try {
      const res = await fetch('/api/super_admin/misa-ai/balance-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-alert' }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        const failed = Array.isArray(json.results)
          ? json.results.filter((row: { success?: boolean }) => !row.success)
          : [];
        const detail =
          failed.length > 0
            ? failed.map((row: { number?: string; error?: string }) => `${row.number}: ${row.error || 'failed'}`).join(' · ')
            : json.message || json.reason || json.error || 'Test failed';
        throw new Error(detail);
      }
      const mode = json.deliveryMode === 'template' ? 'template' : 'text';
      setBalanceMessage(
        `${json.message || `Test alert sent to ${json.sent || 0} WhatsApp number(s)`} (${mode})`,
      );
    } catch (e: any) {
      setBalanceMessage(e.message || 'Test alert failed');
    } finally {
      setBalanceTesting(false);
    }
  };

  const handleBalanceTemplateAction = async (action: 'create-template' | 'sync-template') => {
    setBalanceTemplateWorking(true);
    setBalanceMessage('');
    try {
      const res = await fetch('/api/super_admin/misa-ai/balance-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.error || json.message || 'Template action failed');
      setBalanceMessage(json.message || 'Template action completed');
      await loadBalanceAlert();
    } catch (e: any) {
      setBalanceMessage(e.message || 'Template action failed');
    } finally {
      setBalanceTemplateWorking(false);
    }
  };

  useEffect(() => {
    loadOpenAiUsage();
  }, [loadOpenAiUsage]);

  useEffect(() => {
    loadBalanceAlert();
  }, [loadBalanceAlert]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const maxOpenAiDailyCost = useMemo(
    () => Math.max(1, ...(openAiData?.daily_costs || []).map((row) => row.cost_usd)),
    [openAiData?.daily_costs],
  );

  const maxDailyCost = useMemo(
    () => Math.max(1, ...(overview?.daily_volume || []).map((row) => row.cost_inr)),
    [overview?.daily_volume],
  );

  const exportUsageCsv = () => {
    const params = buildParams();
    params.set('export', '1');
    window.open(`/api/super_admin/misa-ai/usage?${params.toString()}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">MISA AI Control Center</h1>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Dashboard, conversations, usage, billing and performance for MyFNG Instant Service Assistant.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {EXPORT_DATE_PRESETS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {preset === 'custom' ? (
                <>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  loadOpenAiUsage(true);
                  loadOverview();
                  loadUsage();
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading || openAiLoading ? 'animate-spin' : ''}`} />
                Refresh live
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/super_admin/kb-questions"
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              <MessageSquare className="h-4 w-4" />
              AI Learning Inbox
            </Link>
            <Link
              href="/dashboard/super_admin/admin-ai-chat"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Bot className="h-4 w-4" />
              Admin AI Chat
            </Link>
            <Link
              href="/misa-ai"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" />
              Open Public MISA
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        {openAiError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{openAiError}</div>
        ) : null}

        {!openAiData?.configured ? (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            <strong>OpenAI realtime billing:</strong> Server par{' '}
            <code className="rounded bg-white px-1">OPENAI_ADMIN_API_KEY</code> add karo (OpenAI Platform → Settings →
            Admin keys). Normal <code className="rounded bg-white px-1">OPENAI_API_KEY</code> se org usage nahi aata.
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Live OpenAI org usage connected
            {openAiData.admin_key_hint ? ` · key ${openAiData.admin_key_hint}` : ''}
            {openAiData.fetched_at ? ` · updated ${fmtDate(openAiData.fetched_at)}` : ''}
          </div>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-bold text-gray-900">OpenAI Credit Balance Alert</h2>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Top-up ke baad baseline set karo — hum org usage subtract karke remaining estimate karte hain.
                WhatsApp alerts at <strong>$5, $4, $3, $2, $1</strong> milestones.
              </p>
            </div>
            {balanceData?.is_low ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                Low balance
              </span>
            ) : balanceData?.configured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                OK
              </span>
            ) : null}
          </div>

          {balanceMessage ? (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              {balanceMessage}
            </div>
          ) : null}

          {balanceLoading ? (
            <p className="text-sm text-gray-500">Loading balance monitor…</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estimated remaining</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">
                      {balanceData?.estimated_remaining_usd != null
                        ? `$${balanceData.estimated_remaining_usd.toFixed(2)}`
                        : '—'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {balanceData?.estimated_remaining_inr != null
                        ? `≈ ₹${balanceData.estimated_remaining_inr.toLocaleString('en-IN')}`
                        : 'Set baseline to start tracking'}
                    </p>
                    {balanceData?.spend_since_baseline_usd != null ? (
                      <p className="mt-2 text-xs text-gray-500">
                        Spent since baseline: ${balanceData.spend_since_baseline_usd.toFixed(2)}
                        {balanceData.settings.baseline_at
                          ? ` · baseline ${fmtDate(balanceData.settings.baseline_at)}`
                          : ''}
                      </p>
                    ) : null}
                    {balanceData?.error ? (
                      <p className="mt-2 text-xs text-red-600">{balanceData.error}</p>
                    ) : null}
                  </div>

                  <div className="hidden w-px shrink-0 self-stretch bg-gray-200 lg:block" aria-hidden />

                  <div className="min-w-0 flex-1 space-y-3">
                    <label className="block text-sm">
                      <span className="font-medium text-gray-700">Current prepaid balance (USD)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={baselineInput}
                        onChange={(e) => setBaselineInput(e.target.value)}
                        placeholder="11.81"
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                      />
                      <span className="mt-1 block text-xs text-gray-500">
                        OpenAI billing page se copy karo — har top-up ke baad update karo.
                      </span>
                    </label>

                    <div>
                      <p className="text-xs font-medium text-gray-700">Alert milestones (USD)</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {(balanceData?.settings.alert_milestones_usd || [5, 4, 3, 2, 1]).map((milestone) => {
                          const sent = balanceData?.settings.alert_milestones_sent?.includes(milestone);
                          const pending = balanceData?.pending_milestones_usd?.includes(milestone);
                          return (
                            <span
                              key={milestone}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                sent
                                  ? 'bg-gray-200 text-gray-500 line-through'
                                  : pending
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-white text-emerald-700 ring-1 ring-emerald-200'
                              }`}
                            >
                              ${milestone}
                              {sent ? ' ✓' : pending ? ' …' : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {!balanceData?.whatsapp_configured ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <code className="rounded bg-white px-1">SYSTEM_ALERT_WHATSAPP_NUMBERS</code> env mein admin numbers add karo.
                </div>
              ) : null}

              {balanceData?.template_status && !balanceData.template_status.canSendTemplate ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-2">
                  <p>
                    WhatsApp template <strong>openai_balance_alert</strong> (UTILITY) approved nahi hai (
                    {balanceData.template_status.metaStatus || 'not created'}). Neeche se Meta pe submit karo.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleBalanceTemplateAction('create-template')}
                      disabled={balanceTemplateWorking}
                      className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {balanceTemplateWorking ? 'Working…' : 'Create on Meta'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBalanceTemplateAction('sync-template')}
                      disabled={balanceTemplateWorking}
                      className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                    >
                      Refresh Meta status
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={alertEnabledInput}
                    onChange={(e) => setAlertEnabledInput(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Enable WhatsApp low-balance alerts (daily cron + manual test)
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveBalanceSettings}
                    disabled={balanceSaving || !baselineInput}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {balanceSaving ? 'Saving…' : 'Save baseline'}
                  </button>
                  <button
                    type="button"
                    onClick={testBalanceAlert}
                    disabled={balanceTesting || !balanceData?.whatsapp_configured}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {balanceTesting ? 'Sending…' : 'Test WhatsApp alert'}
                  </button>
                  <button
                    type="button"
                    onClick={loadBalanceAlert}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh estimate
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500">{balanceData?.note}</p>
              {balanceData?.settings.last_alert_sent_at ? (
                <p className="text-xs text-gray-400">
                  Last alert sent: {fmtDate(balanceData.settings.last_alert_sent_at)}
                </p>
              ) : null}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">OpenAI Live Usage & Billing</h2>
              <p className="text-sm text-gray-500">
                Same data as platform.openai.com/usage · Range: {openAiData?.range_label || overview?.range_label || '—'} (UTC days)
                {openAiData?.project_filter ? ` · Project: ${openAiData.project_filter}` : ' · All org projects'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                OpenAI dashboard &quot;Default project&quot; filter ke liye env mein{' '}
                <code className="rounded bg-gray-100 px-1">OPENAI_ORG_PROJECT_ID=proj_xxx</code> set karo.
              </p>
            </div>
            <a
              href="https://platform.openai.com/usage"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Open OpenAI dashboard
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-8 space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-500">Total spend</p>
                <p className="mt-1 text-4xl font-bold text-brand-primary">
                  {openAiLoading
                    ? '…'
                    : `$${(openAiData?.total_spend_usd ?? 0).toFixed(2)}`}
                </p>
                <p className="text-sm text-gray-500">
                  {openAiLoading ? 'Loading…' : `₹${(openAiData?.total_spend_inr ?? 0).toLocaleString('en-IN')} INR`}
                </p>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Daily spend (USD)</p>
                {openAiLoading ? (
                  <p className="text-sm text-gray-500">Loading chart…</p>
                ) : (openAiData?.daily_costs || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No cost data in this range.</p>
                ) : (
                  <div className="flex h-32 items-end gap-1.5">
                    {openAiData?.daily_costs.map((row) => (
                      <div key={row.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t bg-gradient-to-t from-brand-secondary to-brand-primary transition-opacity hover:opacity-90"
                          style={{ height: `${Math.max(8, (row.cost_usd / maxOpenAiDailyCost) * 112)}px` }}
                          title={`${row.date}: $${row.cost_usd.toFixed(2)}`}
                        />
                        <span className="truncate text-[10px] text-gray-400">{row.date.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-gray-100 p-4">
                  <p className="text-sm font-bold text-gray-900">Responses & Chat Completions</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Requests</p>
                      <p className="text-xl font-bold">{openAiData?.completions_summary.requests.toLocaleString('en-IN') ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Input tokens</p>
                      <p className="text-xl font-bold">
                        {openAiData
                          ? `${(openAiData.completions_summary.input_tokens / 1_000_000).toFixed(3)}M`
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Output tokens</p>
                      <p className="text-xl font-bold">
                        {openAiData
                          ? `${(openAiData.completions_summary.output_tokens / 1_000).toFixed(1)}K`
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Cached tokens</p>
                      <p className="text-xl font-bold">{openAiData?.cached_tokens.toLocaleString('en-IN') ?? '—'}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 p-4">
                  <p className="text-sm font-bold text-gray-900">Spend by line item</p>
                  <div className="mt-3 space-y-2">
                    {(openAiData?.by_line_item || []).slice(0, 5).length === 0 ? (
                      <p className="text-sm text-gray-500">No line items.</p>
                    ) : (
                      openAiData?.by_line_item.slice(0, 5).map((row) => (
                        <div key={row.line_item} className="flex items-center justify-between text-sm">
                          <span className="truncate text-gray-700">{row.line_item}</span>
                          <span className="font-semibold">${row.cost_usd.toFixed(2)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4">
              <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                <div className="grid grid-cols-2 gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total tokens</p>
                    <p className="mt-0.5 text-xl font-bold text-brand-primary">
                      {openAiData ? openAiData.total_tokens.toLocaleString('en-IN') : '—'}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      In {(openAiData?.input_tokens ?? 0).toLocaleString('en-IN')} · Out{' '}
                      {(openAiData?.output_tokens ?? 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total requests</p>
                    <p className="mt-0.5 text-xl font-bold text-brand-primary">
                      {openAiData ? openAiData.total_requests.toLocaleString('en-IN') : '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-xs font-bold text-gray-900">Users</p>
                    <div className="space-y-1">
                      {(openAiData?.by_user || []).slice(0, 5).length === 0 ? (
                        <p className="text-xs text-gray-500">No user breakdown.</p>
                      ) : (
                        openAiData?.by_user.slice(0, 5).map((row) => (
                          <div key={row.user_id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-gray-600">
                              {row.user_id === 'unknown' ? 'Default user' : row.user_id}
                            </span>
                            <span className="shrink-0 font-semibold text-brand-secondary">
                              {row.requests.toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-bold text-gray-900">Models</p>
                    <div className="space-y-1">
                      {(openAiData?.by_model || []).slice(0, 5).length === 0 ? (
                        <p className="text-xs text-gray-500">No model breakdown.</p>
                      ) : (
                        openAiData?.by_model.slice(0, 5).map((row) => (
                          <div key={row.model} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-gray-600">{row.model}</span>
                            <span className="shrink-0 font-semibold text-brand-secondary">
                              {row.requests.toLocaleString('en-IN')} req
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-gray-200 pt-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">MISA product analytics</h2>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Range: {overview?.range_label || '—'}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Conversations"
            value={overview?.kpis.conversations ?? '—'}
            sub={`${overview?.kpis.messages ?? 0} total messages`}
            icon={Users}
          />
          <KpiCard
            label="AI Requests"
            value={overview?.kpis.ai_requests ?? '—'}
            sub={`${overview?.kpis.total_tokens?.toLocaleString('en-IN') ?? 0} tokens`}
            icon={Activity}
          />
          <KpiCard
            label="Est. AI Cost"
            value={overview ? `₹${overview.kpis.estimated_cost_inr.toLocaleString('en-IN')}` : '—'}
            sub={overview ? `$${overview.kpis.estimated_cost_usd.toFixed(2)} USD` : undefined}
            icon={Coins}
          />
          <KpiCard
            label="Bookings"
            value={overview?.kpis.bookings_total ?? '—'}
            sub={`${overview?.kpis.bookings_completed ?? 0} completed · ${overview?.kpis.conversion_rate ?? 0}% conv.`}
            icon={TrendingUp}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Daily AI spend (INR)</h2>
              <BarChart3 className="h-4 w-4 text-gray-400" />
            </div>
            {loading ? (
              <p className="text-sm text-gray-500">Loading chart...</p>
            ) : (
              <div className="flex h-44 items-end gap-2">
                {(overview?.daily_volume || []).map((row) => (
                  <div key={row.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-brand-secondary to-brand-primary"
                      style={{ height: `${Math.max(8, (row.cost_inr / maxDailyCost) * 140)}px` }}
                      title={`${row.date}: ₹${row.cost_inr} · ${row.tokens} tokens`}
                    />
                    <span className="truncate text-[10px] text-gray-400">{row.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-gray-900">Funnel</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Conversations</span><strong>{overview?.kpis.conversations ?? 0}</strong></div>
              <div className="flex justify-between"><span className="text-gray-600">With phone / OTP progress</span><strong>{overview?.kpis.with_phone ?? 0}</strong></div>
              <div className="flex justify-between"><span className="text-gray-600">Booking in progress</span><strong>{overview?.kpis.with_booking_progress ?? 0}</strong></div>
              <div className="flex justify-between"><span className="text-gray-600">Bookings created</span><strong>{overview?.kpis.bookings_total ?? 0}</strong></div>
              <div className="flex justify-between"><span className="text-gray-600">KB learning events</span><strong>{overview?.kpis.kb_events ?? 0}</strong></div>
              <div className="flex justify-between"><span className="text-gray-600">New KB questions</span><strong>{overview?.kpis.kb_new ?? 0}</strong></div>
              <div className="flex justify-between"><span className="text-gray-600">Avg msgs / chat</span><strong>{overview?.kpis.avg_messages_per_conversation ?? 0}</strong></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-gray-900">Usage by channel</h2>
            <div className="space-y-3">
              {(overview?.channels || []).length === 0 ? (
                <p className="text-sm text-gray-500">No usage logged yet.</p>
              ) : (
                overview?.channels.map((row) => (
                  <div key={row.channel} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{row.channel}</p>
                      <p className="text-xs text-gray-500">{row.requests} requests · {row.tokens.toLocaleString('en-IN')} tokens</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">${row.cost_usd.toFixed(2)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-gray-900">Usage by model</h2>
            <div className="space-y-3">
              {(overview?.models || []).length === 0 ? (
                <p className="text-sm text-gray-500">No model usage yet.</p>
              ) : (
                overview?.models.map((row) => (
                  <div key={row.model} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{row.model}</p>
                      <p className="text-xs text-gray-500">{row.requests} requests · {row.tokens.toLocaleString('en-IN')} tokens</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">${row.cost_usd.toFixed(2)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Billing reference</h2>
              <p className="text-xs text-gray-500">{overview?.billing.note}</p>
            </div>
            <p className="text-xs text-gray-500">USD→INR: {overview?.billing.usd_inr_rate ?? 85}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Object.entries(overview?.billing.model_pricing_usd || {}).map(([model, pricing]) => (
              <div key={model} className="rounded-lg border border-gray-100 px-3 py-2 text-sm">
                <p className="font-semibold text-gray-900">{model}</p>
                <p className="text-xs text-gray-500">
                  Input ${pricing.inputPer1M}/1M · Output ${pricing.outputPer1M}/1M
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Recent AI usage logs</h2>
              <p className="text-xs text-gray-500">Token-level billing trail for each MISA request</p>
            </div>
            <button
              type="button"
              onClick={exportUsageCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Tokens</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Preview</th>
                </tr>
              </thead>
              <tbody>
                {usageLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-gray-500">Loading usage...</td>
                  </tr>
                ) : usageError ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-red-600">{usageError}</td>
                  </tr>
                ) : !usageTrackingAvailable ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                      No usage logs yet.
                    </td>
                  </tr>
                ) : usageRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                      {usageTotalAllTime > 0
                        ? 'No logs in this date range. Try “All time” or a wider range.'
                        : 'No logs yet. Send a new MISA chat on website/app — each request logs here after this fix is deployed.'}
                    </td>
                  </tr>
                ) : (
                  usageRows.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{fmtDate(row.created_at)}</td>
                      <td className="px-4 py-3">{row.channel}</td>
                      <td className="px-4 py-3">{row.model}</td>
                      <td className="px-4 py-3">{row.total_tokens.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">₹{row.estimated_cost_inr.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 max-w-xs truncate text-gray-600">{row.user_message_preview || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
            <button
              type="button"
              disabled={usagePage <= 1}
              onClick={() => setUsagePage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">Page {usagePage} / {usageTotalPages}</span>
            <button
              type="button"
              disabled={usagePage >= usageTotalPages}
              onClick={() => setUsagePage((p) => p + 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-gray-900">Recent MISA bookings</h2>
          <div className="space-y-2">
            {(overview?.recent_bookings || []).length === 0 ? (
              <p className="text-sm text-gray-500">No bookings in this range.</p>
            ) : (
              overview?.recent_bookings.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{row.service_name || 'Service booking'}</p>
                    <p className="text-xs text-gray-500">{row.city || '—'} · {row.source || 'MISA AI'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold capitalize text-gray-800">{row.status}</p>
                    <p className="text-xs text-gray-500">{fmtDate(row.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
