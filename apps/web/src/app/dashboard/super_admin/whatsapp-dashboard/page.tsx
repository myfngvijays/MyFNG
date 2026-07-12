'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Download,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { EXPORT_DATE_PRESETS, enumerateYmdRange, resolveReportDateRange, type ReportDatePreset } from '@/lib/report-date-range';

const WHATSAPP_DASHBOARD_DATE_PRESETS = EXPORT_DATE_PRESETS.map((option) => {
  if (option.value === 'all_time') return { ...option, label: 'Maximum' };
  if (option.value === 'custom') return { ...option, label: 'Custom range' };
  return option;
});

type DailyChartPreset = 'today' | 'yesterday' | 'last_7_days' | 'last_14_days' | 'last_30_days' | 'custom';

const DAILY_CHART_PRESETS: Array<{ value: DailyChartPreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_14_days', label: 'Last 14 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];

const MAX_DAILY_CHART_DAYS = 30;

type DailyVolumeRow = {
  date: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
};

type DailyChartData = {
  range_label: string;
  shown_days: number;
  sent_total: number;
  daily_volume: DailyVolumeRow[];
};

type StatusCounts = {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
};

type TemplateStat = {
  name: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  automation: number;
  delivery_rate: number;
  read_rate: number;
};

type AutomationTriggerStat = {
  trigger_key: string;
  display_name: string;
  configured_template: string | null;
  is_enabled: boolean;
  sent: number;
  failed: number;
  skipped: number;
  total_attempts: number;
};

type DashboardOverview = {
  preset?: string;
  range_label?: string;
  from?: string;
  to?: string;
  start_ymd?: string;
  end_ymd?: string;
  kpis: {
    outbound_total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    pending: number;
    delivery_rate: number;
    read_rate: number;
    failure_rate: number;
    automation_sent: number;
    manual_sent: number;
    enabled_automation_triggers: number;
    total_automation_triggers: number;
    total_templates: number;
    approved_templates: number;
    utility_templates: number;
    marketing_templates: number;
  };
  sources: {
    automation: StatusCounts;
    manual: StatusCounts;
  };
  template_stats: TemplateStat[];
  top_templates: Array<{ name: string; count: number; delivered: number; delivery_rate: number }>;
  automation_triggers: AutomationTriggerStat[];
  daily_volume: Array<{ date: string; sent: number; delivered: number; read: number; failed: number }>;
  daily_volume_meta?: {
    max_days: number;
    shown_days: number;
    total_range_days: number;
    truncated: boolean;
    chart_start_ymd: string;
    chart_end_ymd: string;
  };
  status_breakdown?: {
    read: number;
    delivered_only: number;
    sent_pending: number;
    failed: number;
  };
  source_breakdown?: {
    automation: number;
    manual: number;
  };
  template_share?: Array<{ name: string; value: number }>;
  recent_messages: Array<{
    id: string;
    time: string;
    template_name: string | null;
    phone: string;
    status: string;
    source: string;
    trigger_key: string | null;
    error_message: string | null;
  }>;
  recent_failures: Array<{
    time: string;
    template_name: string | null;
    phone: string;
    error_message: string;
    source: string;
  }>;
  recent_events: Array<{ id: string; status: string; note: string | null; time: string }>;
};

function statusTone(status: string) {
  const value = status.toUpperCase();
  if (value === 'DELIVERED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (value === 'VIEWED') return 'bg-violet-50 text-violet-700 border-violet-200';
  if (value === 'FAILED') return 'bg-red-50 text-red-700 border-red-200';
  if (value === 'SKIPPED') return 'bg-gray-50 text-gray-600 border-gray-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T12:00:00+05:30`);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

type DonutSegment = { label: string; value: number; color: string };

function DonutChart({
  segments,
  centerLabel,
  size = 168,
}: {
  segments: DonutSegment[];
  centerLabel: string;
  size?: number;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) {
    return (
      <div
        className="relative mx-auto flex items-center justify-center rounded-full bg-gray-100 text-sm text-gray-500"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );
  }

  let cumulative = 0;
  const gradientParts = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const start = (cumulative / total) * 100;
      cumulative += segment.value;
      const end = (cumulative / total) * 100;
      return `${segment.color} ${start}% ${end}%`;
    });

  const hole = Math.round(size * 0.36);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <div
        className="h-full w-full rounded-full"
        style={{ background: `conic-gradient(${gradientParts.join(', ')})` }}
      />
      <div
        className="absolute flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner"
        style={{
          inset: hole / 2,
        }}
      >
        <span className="text-xl font-bold text-gray-900">{centerLabel}</span>
        <span className="text-[10px] uppercase tracking-wide text-gray-500">Total</span>
      </div>
    </div>
  );
}

function DonutLegend({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <div className="mt-4 space-y-2">
      {segments.map((segment) => (
        <div key={segment.label} className="flex items-center justify-between gap-3 text-xs">
          <span className="inline-flex items-center gap-2 text-gray-700">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
            {segment.label}
          </span>
          <span className="font-semibold text-gray-900">
            {segment.value}
            {total > 0 ? ` (${formatPct((segment.value / total) * 100)})` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function customChartSpanDays(start: string, end: string) {
  if (!start || !end) return 0;
  return enumerateYmdRange(start, end).length;
}

function exportCsv(data: DashboardOverview, preset: string, rangeLabel: string) {
  const lines = [
    ['WhatsApp Delivery Report', rangeLabel || preset].join(','),
    [],
    ['Template', 'Sent', 'Delivered', 'Read', 'Failed', 'Delivery Rate', 'Automation Sends'].join(','),
    ...data.template_stats.map((row) =>
      [
        row.name,
        row.sent,
        row.delivered,
        row.read,
        row.failed,
        formatPct(row.delivery_rate),
        row.automation,
      ].join(',')
    ),
    [],
    ['Automation Trigger', 'Enabled', 'Sent', 'Failed', 'Skipped', 'Template'].join(','),
    ...data.automation_triggers.map((row) =>
      [
        row.display_name,
        row.is_enabled ? 'yes' : 'no',
        row.sent,
        row.failed,
        row.skipped,
        row.configured_template || '',
      ].join(',')
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `whatsapp-delivery-report-${preset}-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SuperAdminWhatsAppDashboardPage() {
  const [preset, setPreset] = useState<ReportDatePreset>('last_7_days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [templateFilter, setTemplateFilter] = useState<'all' | 'automation'>('all');
  const [chartPreset, setChartPreset] = useState<DailyChartPreset>('last_7_days');
  const [chartCustomStart, setChartCustomStart] = useState('');
  const [chartCustomEnd, setChartCustomEnd] = useState('');
  const [chartData, setChartData] = useState<DailyChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [recentPage, setRecentPage] = useState(1);
  const [recentMessages, setRecentMessages] = useState<DashboardOverview['recent_messages']>([]);
  const [recentTotalPages, setRecentTotalPages] = useState(1);
  const [recentTotal, setRecentTotal] = useState(0);
  const [recentLoading, setRecentLoading] = useState(true);

  const chartCustomSpanDays = useMemo(
    () => (chartPreset === 'custom' ? customChartSpanDays(chartCustomStart, chartCustomEnd) : 0),
    [chartCustomEnd, chartCustomStart, chartPreset]
  );

  const chartCustomInvalid =
    chartPreset === 'custom' &&
    (!chartCustomStart || !chartCustomEnd || chartCustomSpanDays > MAX_DAILY_CHART_DAYS);

  const rangeLabel = useMemo(
    () => resolveReportDateRange(preset, customStart, customEnd).label,
    [customEnd, customStart, preset]
  );

  const loadRecentMessages = useCallback(async () => {
    if (preset === 'custom' && (!customStart || !customEnd)) {
      setRecentLoading(false);
      return;
    }

    setRecentLoading(true);
    try {
      const params = new URLSearchParams({
        preset,
        page: String(recentPage),
        limit: '10',
        status: 'all',
        source: 'all',
      });
      if (preset === 'custom') {
        if (customStart) params.set('start', customStart);
        if (customEnd) params.set('end', customEnd);
      }
      const res = await fetch(`/api/whatsapp/dashboard/messages?${params.toString()}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load recent messages');
      setRecentMessages(json.rows || []);
      setRecentTotalPages(json.total_pages || 1);
      setRecentTotal(json.total || 0);
    } catch {
      setRecentMessages([]);
      setRecentTotalPages(1);
      setRecentTotal(0);
    } finally {
      setRecentLoading(false);
    }
  }, [customEnd, customStart, preset, recentPage]);

  const buildDailyChartUrl = useCallback(() => {
    const params = new URLSearchParams({ preset: chartPreset });
    if (chartPreset === 'custom') {
      if (chartCustomStart) params.set('start', chartCustomStart);
      if (chartCustomEnd) params.set('end', chartCustomEnd);
    }
    return `/api/whatsapp/dashboard/daily-volume?${params.toString()}`;
  }, [chartCustomEnd, chartCustomStart, chartPreset]);

  const loadDailyChart = useCallback(async () => {
    if (chartCustomInvalid) {
      setChartLoading(false);
      return;
    }

    setChartLoading(true);
    setChartError(null);
    try {
      const res = await fetch(buildDailyChartUrl(), { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to load daily chart');
      }
      setChartData({
        range_label: json.range_label,
        shown_days: json.shown_days,
        sent_total: json.sent_total,
        daily_volume: json.daily_volume || [],
      });
    } catch (error: any) {
      setChartData(null);
      setChartError(error?.message || 'Failed to load daily chart');
    } finally {
      setChartLoading(false);
    }
  }, [buildDailyChartUrl, chartCustomInvalid]);

  const buildOverviewUrl = useCallback(() => {
    const params = new URLSearchParams({ preset });
    if (preset === 'custom') {
      if (customStart) params.set('start', customStart);
      if (customEnd) params.set('end', customEnd);
    }
    return `/api/whatsapp/dashboard/overview?${params.toString()}`;
  }, [customEnd, customStart, preset]);

  const loadDashboard = useCallback(async (silent = false) => {
    if (preset === 'custom' && (!customStart || !customEnd)) {
      if (!silent) setLoading(false);
      return;
    }

    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(buildOverviewUrl(), {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || 'Failed to load dashboard');
      setData(json);
    } catch {
      setData(null);
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [buildOverviewUrl, customEnd, customStart, preset]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadDashboard(true), loadDailyChart(), loadRecentMessages()]);
  }, [loadDailyChart, loadDashboard, loadRecentMessages]);

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  useEffect(() => {
    loadDailyChart();
  }, [loadDailyChart]);

  useEffect(() => {
    setRecentPage(1);
  }, [preset, customStart, customEnd]);

  useEffect(() => {
    loadRecentMessages();
  }, [loadRecentMessages]);

  const filteredTemplateStats = useMemo(() => {
    const rows = data?.template_stats || [];
    if (templateFilter === 'automation') {
      return rows.filter((row) => row.automation > 0);
    }
    return rows;
  }, [data, templateFilter]);

  const chartDailyVolume = chartData?.daily_volume || [];

  const maxDailySent = useMemo(() => {
    return Math.max(1, ...chartDailyVolume.map((row) => row.sent));
  }, [chartDailyVolume]);

  const dailyVolumeTotal = chartData?.sent_total || 0;

  const deliverySegments = useMemo<DonutSegment[]>(() => {
    const breakdown = data?.status_breakdown;
    return [
      { label: 'Read', value: breakdown?.read || 0, color: '#8b5cf6' },
      { label: 'Delivered', value: breakdown?.delivered_only || 0, color: '#10b981' },
      { label: 'Sent (pending)', value: breakdown?.sent_pending || 0, color: '#3b82f6' },
      { label: 'Failed', value: breakdown?.failed || 0, color: '#ef4444' },
    ];
  }, [data]);

  const sourceSegments = useMemo<DonutSegment[]>(() => {
    const breakdown = data?.source_breakdown;
    return [
      { label: 'Automation', value: breakdown?.automation || 0, color: '#6366f1' },
      { label: 'Manual / Other', value: breakdown?.manual || 0, color: '#64748b' },
    ];
  }, [data]);

  const templateSegments = useMemo<DonutSegment[]>(() => {
    const palette = ['#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#84cc16', '#a855f7', '#94a3b8'];
    return (data?.template_share || []).map((row, index) => ({
      label: row.name,
      value: row.value,
      color: palette[index % palette.length],
    }));
  }, [data]);

  const kpiCards = useMemo(
    () => [
      {
        title: 'Outbound Templates',
        value: String(data?.kpis.outbound_total || 0),
        delta: `${data?.kpis.sent || 0} sent · ${data?.kpis.pending || 0} pending`,
        icon: MessageSquare,
        tone: 'text-blue-600 bg-blue-50',
      },
      {
        title: 'Delivered',
        value: String(data?.kpis.delivered || 0),
        delta: formatPct(data?.kpis.delivery_rate || 0),
        icon: Activity,
        tone: 'text-emerald-600 bg-emerald-50',
      },
      {
        title: 'Read / Viewed',
        value: String(data?.kpis.read || 0),
        delta: formatPct(data?.kpis.read_rate || 0),
        icon: TrendingUp,
        tone: 'text-violet-600 bg-violet-50',
      },
      {
        title: 'Failed',
        value: String(data?.kpis.failed || 0),
        delta: formatPct(data?.kpis.failure_rate || 0),
        icon: AlertTriangle,
        tone: 'text-red-600 bg-red-50',
      },
      {
        title: 'Automation Live',
        value: `${data?.kpis.enabled_automation_triggers || 0}/${data?.kpis.total_automation_triggers || 0}`,
        delta: `${data?.kpis.automation_sent || 0} automation sends`,
        icon: Bot,
        tone: 'text-indigo-600 bg-indigo-50',
      },
      {
        title: 'Template Health',
        value: `${data?.kpis.approved_templates || 0}/${data?.kpis.total_templates || 0}`,
        delta: `${data?.kpis.utility_templates || 0} UTILITY · ${data?.kpis.marketing_templates || 0} MARKETING`,
        icon: ShieldCheck,
        tone: 'text-amber-600 bg-amber-50',
      },
    ],
    [data]
  );

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6 p-4 sm:p-6">
      <div className="rounded-xl bg-gradient-to-r from-brand-secondary to-brand-primary p-5 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-yellow-300">WhatsApp Dashboard</h1>
            <p className="mt-1 text-sm text-blue-100">
              Template delivery analytics, automation performance, and channel health — outbound templates only.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/super_admin/whatsapp-automation"
              className="inline-flex items-center rounded-lg bg-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/30"
            >
              WhatsApp Automation
            </Link>
            <Link
              href="/dashboard/super_admin/whatsapp-templates"
              className="inline-flex items-center rounded-lg bg-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/30"
            >
              Manage Templates
            </Link>
            <Link
              href="/dashboard/super_admin/bot-flow"
              className="inline-flex items-center rounded-lg bg-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/30"
            >
              Bot Flow
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            {preset === 'custom' && (!customStart || !customEnd)
              ? 'Select start and end dates for custom range'
              : (
                <span>
                  Showing: <span className="font-semibold text-gray-900">{data?.range_label || rangeLabel}</span>
                </span>
              )}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {preset === 'custom' ? (
              <>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  aria-label="From date"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  aria-label="To date"
                />
              </>
            ) : null}

            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={refreshing || loading || (preset === 'custom' && (!customStart || !customEnd))}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as ReportDatePreset)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 min-w-[150px]"
              aria-label="Time range"
            >
              {WHATSAPP_DASHBOARD_DATE_PRESETS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => data && exportCsv(data, preset, data.range_label || rangeLabel)}
              disabled={!data || loading || (preset === 'custom' && (!customStart || !customEnd))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-500">{card.title}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{loading ? '—' : card.value}</p>
                  <p className="mt-1 text-xs font-semibold text-gray-600">{loading ? 'Loading...' : card.delta}</p>
                </div>
                <div className={`rounded-lg p-2 ${card.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Daily Outbound Volume</h2>
              <p className="text-xs text-gray-500">
                {chartLoading
                  ? 'Loading chart...'
                  : chartError
                    ? chartError
                    : `${chartData?.shown_days || chartDailyVolume.length} days · ${dailyVolumeTotal} sent · ${chartData?.range_label || ''}`}
              </p>
            </div>

            <div className="flex flex-wrap items-end justify-end gap-2">
              {chartPreset === 'custom' ? (
                <>
                  <input
                    type="date"
                    value={chartCustomStart}
                    onChange={(e) => setChartCustomStart(e.target.value)}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                    aria-label="Chart from date"
                  />
                  <span className="pb-1.5 text-xs text-gray-400">to</span>
                  <input
                    type="date"
                    value={chartCustomEnd}
                    onChange={(e) => setChartCustomEnd(e.target.value)}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                    aria-label="Chart to date"
                  />
                </>
              ) : null}

              <select
                value={chartPreset}
                onChange={(e) => setChartPreset(e.target.value as DailyChartPreset)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 min-w-[130px]"
                aria-label="Daily chart range"
              >
                {DAILY_CHART_PRESETS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {chartPreset === 'custom' && chartCustomStart && chartCustomEnd && chartCustomSpanDays > MAX_DAILY_CHART_DAYS ? (
            <p className="mt-2 text-xs font-medium text-red-600">
              Custom range can be up to {MAX_DAILY_CHART_DAYS} days. Selected: {chartCustomSpanDays} days.
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap justify-end gap-3 text-xs text-gray-600">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500" /> Sent</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Delivered</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-violet-500" /> Read</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-400" /> Failed</span>
          </div>

          <div
            className="mt-4 grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, chartDailyVolume.length || 1)}, minmax(0, 1fr))`,
            }}
          >
            {chartCustomInvalid ? (
              <p className="col-span-full text-sm text-gray-500">
                Pick a custom date range (max {MAX_DAILY_CHART_DAYS} days), e.g. 01 Jun to 30 Jun.
              </p>
            ) : chartDailyVolume.length === 0 ? (
              <p className="col-span-full text-sm text-gray-500">
                {chartLoading ? 'Loading daily chart...' : 'No outbound template messages in selected chart range.'}
              </p>
            ) : (
              chartDailyVolume.map((row) => (
                <div key={row.date} className="flex min-w-0 flex-col items-center gap-2">
                  <div className="flex h-40 w-full max-w-[72px] items-end justify-center gap-1 rounded-lg bg-gray-50 p-2">
                    <div
                      className="w-2 rounded-t bg-blue-500 transition-all"
                      style={{ height: row.sent > 0 ? `${Math.max(10, (row.sent / maxDailySent) * 100)}%` : '4px', opacity: row.sent > 0 ? 1 : 0.25 }}
                      title={`Sent: ${row.sent}`}
                    />
                    <div
                      className="w-2 rounded-t bg-emerald-500 transition-all"
                      style={{ height: row.delivered > 0 ? `${Math.max(8, (row.delivered / maxDailySent) * 100)}%` : '4px', opacity: row.delivered > 0 ? 1 : 0.25 }}
                      title={`Delivered: ${row.delivered}`}
                    />
                    <div
                      className="w-2 rounded-t bg-violet-500 transition-all"
                      style={{ height: row.read > 0 ? `${Math.max(8, (row.read / maxDailySent) * 100)}%` : '4px', opacity: row.read > 0 ? 1 : 0.25 }}
                      title={`Read: ${row.read}`}
                    />
                    <div
                      className="w-2 rounded-t bg-red-400 transition-all"
                      style={{ height: row.failed > 0 ? `${Math.max(8, (row.failed / maxDailySent) * 100)}%` : '4px', opacity: row.failed > 0 ? 1 : 0.25 }}
                      title={`Failed: ${row.failed}`}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-semibold text-gray-700">{formatDateLabel(row.date)}</p>
                    <p className="text-[10px] text-gray-500">{row.sent} sent</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Delivery Status</h3>
          <p className="text-xs text-gray-500">Message outcome breakdown</p>
          <div className="mt-4">
            <DonutChart
              segments={deliverySegments}
              centerLabel={String(data?.kpis.outbound_total || 0)}
            />
            <DonutLegend segments={deliverySegments} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Source Split</h3>
          <p className="text-xs text-gray-500">Automation vs manual sends</p>
          <div className="mt-4">
            <DonutChart
              segments={sourceSegments}
              centerLabel={String((data?.source_breakdown?.automation || 0) + (data?.source_breakdown?.manual || 0))}
            />
            <DonutLegend segments={sourceSegments} />
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm md:col-span-1 xl:col-span-2">
          <h3 className="text-base font-semibold text-gray-900">Template Share</h3>
          <p className="text-xs text-gray-500">Top templates by sent volume</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
            <DonutChart
              segments={templateSegments}
              centerLabel={String(templateSegments.reduce((sum, row) => sum + row.value, 0))}
              size={180}
            />
            <DonutLegend segments={templateSegments} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Template Performance</h2>
            <p className="text-xs text-gray-500">Per-template sent, delivered, read, failed, and delivery rate</p>
          </div>
          <div className="flex gap-2">
            {(['all', 'automation'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setTemplateFilter(filter)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  templateFilter === filter ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter === 'all' ? 'All Templates' : 'Automation Only'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3">Template</th>
                <th className="py-2 pr-3">Sent</th>
                <th className="py-2 pr-3">Delivered</th>
                <th className="py-2 pr-3">Read</th>
                <th className="py-2 pr-3">Failed</th>
                <th className="py-2 pr-3">Delivery %</th>
                <th className="py-2">Automation</th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplateStats.map((row) => (
                <tr key={row.name} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium text-gray-900">{row.name}</td>
                  <td className="py-2 pr-3 text-gray-700">{row.sent}</td>
                  <td className="py-2 pr-3 text-emerald-700">{row.delivered}</td>
                  <td className="py-2 pr-3 text-violet-700">{row.read}</td>
                  <td className="py-2 pr-3 text-red-700">{row.failed}</td>
                  <td className="py-2 pr-3 font-semibold text-gray-800">{formatPct(row.delivery_rate)}</td>
                  <td className="py-2 text-gray-600">{row.automation}</td>
                </tr>
              ))}
              {!loading && filteredTemplateStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">
                    No template delivery data in selected range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Bot className="h-4 w-4 text-indigo-600" />
            <h3 className="text-base font-semibold text-gray-900">Automation Trigger Stats</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3">Trigger</th>
                  <th className="py-2 pr-3">Live</th>
                  <th className="py-2 pr-3">Sent</th>
                  <th className="py-2 pr-3">Failed</th>
                  <th className="py-2">Skipped</th>
                </tr>
              </thead>
              <tbody>
                {(data?.automation_triggers || []).map((row) => (
                  <tr key={row.trigger_key} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-gray-900">{row.display_name}</p>
                      <p className="text-xs text-gray-500">{row.configured_template}</p>
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          row.is_enabled
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 bg-gray-50 text-gray-600'
                        }`}
                      >
                        {row.is_enabled ? 'ON' : 'OFF'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-emerald-700">{row.sent}</td>
                    <td className="py-2 pr-3 text-red-700">{row.failed}</td>
                    <td className="py-2 text-gray-600">{row.skipped}</td>
                  </tr>
                ))}
                {!loading && (data?.automation_triggers || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-500">
                      No automation trigger activity in selected range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <h3 className="text-base font-semibold text-gray-900">Recent Failures</h3>
          </div>
          <div className="space-y-3">
            {(data?.recent_failures || []).length === 0 ? (
              <p className="text-sm text-gray-500">{loading ? 'Loading...' : 'No failed deliveries in this range.'}</p>
            ) : (
              (data?.recent_failures || []).map((row, index) => (
                <div key={`${row.time}-${index}`} className="rounded-lg border border-red-100 bg-red-50/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{row.template_name || 'Unknown template'}</p>
                    <span className="text-xs text-gray-500">{new Date(row.time).toLocaleString('en-IN')}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    {row.phone} · {row.source}
                  </p>
                  <p className="mt-1 text-xs text-red-700">{row.error_message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            <h3 className="text-base font-semibold text-gray-900">Recent Outbound Messages</h3>
          </div>
          <Link
            href={`/dashboard/super_admin/whatsapp-messages?preset=${encodeURIComponent(preset)}${
              preset === 'custom' && customStart && customEnd
                ? `&start=${encodeURIComponent(customStart)}&end=${encodeURIComponent(customEnd)}`
                : ''
            }`}
            className="text-xs font-semibold text-brand-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Template</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {recentMessages.map((row) => (
                <tr key={row.id} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-3 text-gray-600">{new Date(row.time).toLocaleString('en-IN')}</td>
                  <td className="py-2 pr-3">
                    <p className="font-medium text-gray-900">{row.template_name || '—'}</p>
                    {row.trigger_key ? <p className="text-xs text-gray-500">{row.trigger_key}</p> : null}
                  </td>
                  <td className="py-2 pr-3 text-gray-700">{row.phone}</td>
                  <td className="py-2 pr-3 capitalize text-gray-600">{row.source}</td>
                  <td className="py-2 pr-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-red-700">
                    {row.status === 'FAILED' && row.error_message ? row.error_message : '—'}
                  </td>
                </tr>
              ))}
              {!recentLoading && recentMessages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">
                    No outbound messages in selected range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            {recentLoading ? 'Loading...' : `Page ${recentPage} of ${recentTotalPages} · ${recentTotal} total`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRecentPage((current) => Math.max(1, current - 1))}
              disabled={recentLoading || recentPage <= 1}
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setRecentPage((current) => Math.min(recentTotalPages, current + 1))}
              disabled={recentLoading || recentPage >= recentTotalPages}
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-600" />
          <h3 className="text-base font-semibold text-gray-900">Webhook Activity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Event</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent_events || []).map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 text-gray-600">{new Date(row.time).toLocaleString('en-IN')}</td>
                  <td className="py-2 pr-3 text-gray-800">{row.note || 'Webhook event processed'}</td>
                  <td className="py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone(String(row.status || 'OK'))}`}>
                      {String(row.status || '').toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && (data?.recent_events || []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-sm text-gray-500">
                    No recent webhook activity for selected range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
