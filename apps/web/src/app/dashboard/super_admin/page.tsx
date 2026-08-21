'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Store,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Phone,
  UserCheck,
  Shield,
  CarFront,
  Crown,
  Wallet,
  Bell,
  Sparkles,
  Activity,
  RefreshCw,
  Download,
  ExternalLink,
  BarChart3,
  FileText,
  Percent,
  LogOut,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

const CHART_COLORS = ['#004AAD', '#0066FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

type DashboardPeriod =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | '90d'
  | 'this_month'
  | '1y'
  | 'all'
  | 'custom';

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '1y', label: 'Last Year' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
];

const QUICK_LINKS = [
  { href: '/dashboard/super_admin/bookings', label: 'Bookings & Leads', icon: Phone },
  { href: '/dashboard/super_admin/reports', label: 'Reports', icon: FileText },
  { href: '/dashboard/super_admin/customer-insights', label: 'Customer Insights', icon: Users },
  { href: '/dashboard/super_admin/analytics-hub', label: 'Analytics Hub', icon: BarChart3 },
  { href: '/dashboard/super_admin/workshops', label: 'Workshops', icon: Store },
  { href: '/dashboard/super_admin/advance-notifications?section=dashboard', label: 'Push Dashboard', icon: Bell },
];

function todayInputValue() {
  const d = new Date();
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function formatInr(amount: number) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function alertStyles(type: string) {
  if (type === 'CRITICAL') {
    return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
  }
  if (type === 'WARNING') {
    return { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
  }
  return { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>('today');
  const [periodLabel, setPeriodLabel] = useState('Today');
  const [customStart, setCustomStart] = useState(todayInputValue());
  const [customEnd, setCustomEnd] = useState(todayInputValue());
  const [chartSampleNote, setChartSampleNote] = useState<string | null>(null);

  const [globalMetrics, setGlobalMetrics] = useState({
    totalLeadsToday: 0,
    acceptedLeads: 0,
    rejectedLeads: 0,
    conversionRate: 0,
    slaBreaches: 0,
    dailyRevenue: 0,
    monthlyRevenue: 0,
    activeWorkshops: 0,
    totalCustomers: 0,
    newCustomers: 0,
    avgRating: 0,
    complaintVolume: 0,
    rsaActive: 0,
  });

  const [departmentMetrics, setDepartmentMetrics] = useState({
    telecaller: { leads7d: 0, followUpsToday: 0, conversion7d: 0 },
    leadManager: { assigned7d: 0, avgAssignMins7d: 0, accuracy7d: 0 },
    workshops: { active: 0, busy: 0, avgCompletionHours7d: 0 },
    rsa: { active: 0, avgDispatchMins7d: 0, completion7d: 0 },
    auditors: { auditsToday: 0, fraudOpen: 0, avgScore10: 0 },
  });

  const [appMetrics, setAppMetrics] = useState({
    activeMemberships: 0,
    newMemberships7d: 0,
    membershipRevenueMonth: 0,
    healthReports30d: 0,
    resaleReports30d: 0,
    totalWalletCredits30d: 0,
    pushDevices: 0,
  });

  const [charts, setCharts] = useState({
    dailyLeadsTrend: [] as any[],
    dailyRevenueTrend: [] as any[],
    serviceTypeBreakdown: [] as any[],
    leadSourceBreakdown: [] as any[],
    membershipPlanDistribution: [] as any[],
    leadStatusDistribution: [] as any[],
  });

  const [topWorkshops, setTopWorkshops] = useState<{ id: string; name: string; leads: number }[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (period === 'custom') return;
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    if (period !== 'custom') return;
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customStart, customEnd]);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period });
      if (period === 'custom') {
        params.set('start', customStart);
        params.set('end', customEnd);
      }
      const res = await fetch(`/api/super_admin/dashboard?${params.toString()}`, {
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Soft fail — avoid Next.js error overlay from throw + console.error(Error)
        setError(String(json?.error || json?.details || 'Failed to load dashboard'));
        return;
      }

      const gm = json?.globalMetrics || {};
      const dm = json?.departmentMetrics || {};
      const am = json?.appMetrics || {};
      const ch = json?.charts || {};
      setPeriodLabel(json?.periodLabel || PERIOD_OPTIONS.find((p) => p.value === period)?.label || 'Today');
      setChartSampleNote(json?.chartSampleNote || null);
      setGlobalMetrics((prev) => ({ ...prev, ...gm }));
      setDepartmentMetrics((prev) => ({ ...prev, ...dm }));
      setAppMetrics((prev) => ({ ...prev, ...am }));
      setCharts((prev) => ({ ...prev, ...ch }));
      setTopWorkshops(Array.isArray(json?.topWorkshops) ? json.topWorkshops : []);
      setRecentLeads(Array.isArray(json?.recentLeads) ? json.recentLeads : []);
      setAlerts(Array.isArray(json?.alerts) ? json.alerts : []);
    } catch (err: any) {
      console.warn('Dashboard fetch failed:', err?.message || err);
      setError(err?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const exportCsv = () => {
    const lines: string[] = [];
    lines.push(['Section', 'Metric', 'Value'].join(','));
    lines.push(['Period', 'Label', `"${periodLabel}"`].join(','));
    lines.push(['Key Metrics', 'Leads', String(globalMetrics.totalLeadsToday)].join(','));
    lines.push(['Key Metrics', 'Accepted (pipeline)', String(globalMetrics.acceptedLeads)].join(','));
    lines.push(['Key Metrics', 'Rejected', String(globalMetrics.rejectedLeads)].join(','));
    lines.push(['Key Metrics', 'Conversion %', String(globalMetrics.conversionRate)].join(','));
    lines.push(['Key Metrics', 'SLA Breaches (open)', String(globalMetrics.slaBreaches)].join(','));
    lines.push(['Key Metrics', 'Period Revenue', String(globalMetrics.dailyRevenue)].join(','));
    lines.push(['Key Metrics', 'This Month Revenue', String(globalMetrics.monthlyRevenue)].join(','));
    lines.push(['Key Metrics', 'Workshops (verified)', String(globalMetrics.activeWorkshops)].join(','));
    lines.push(['Key Metrics', 'Customers (total)', String(globalMetrics.totalCustomers)].join(','));
    lines.push(['Key Metrics', 'New Customers', String(globalMetrics.newCustomers)].join(','));
    lines.push(['Key Metrics', 'Open Complaints', String(globalMetrics.complaintVolume)].join(','));
    lines.push(['Key Metrics', 'RSA Active', String(globalMetrics.rsaActive)].join(','));
    lines.push(['Key Metrics', 'Avg Rating', String(globalMetrics.avgRating)].join(','));
    for (const row of charts.leadSourceBreakdown) {
      lines.push(['Lead Source', `"${row.name}"`, String(row.value)].join(','));
    }
    for (const row of topWorkshops) {
      lines.push(['Top Workshop', `"${row.name}"`, String(row.leads)].join(','));
    }
    for (const lead of recentLeads) {
      lines.push(
        [
          'Recent Lead',
          `"${lead.customer_name || ''}"`,
          `"${lead.source || ''} | ${lead.status || ''} | ${lead.created_at || ''}"`,
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `super-admin-dashboard-${period}-${todayInputValue()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white p-5 md:p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-white/90 text-sm">Welcome back, Super Admin 👋</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white mt-1">Super Admin Dashboard</h1>
            <p className="text-blue-100 text-sm mt-1">Real-time business intelligence &amp; analytics</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!confirm('Are you sure you want to logout?')) return;
                try {
                  const { clearTelecallerCrmFilterPrefs } = await import(
                    '@/lib/telecaller/crmFilterPrefs'
                  );
                  clearTelecallerCrmFilterPrefs();
                } catch {
                  /* ignore */
                }
                const supabase = createClient();
                await supabase.auth.signOut();
                router.push('/login');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm font-semibold text-white shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-2 flex-1">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Dashboard failed to load</p>
                <p className="text-sm text-red-700 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fetchDashboardData(true)}
              className="px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : null}

        {/* Date range */}
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm font-medium text-gray-700">Time Period:</span>
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPeriod(option.value)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
                    period === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {period === 'custom' ? (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1 border-t border-gray-100">
              <label className="text-xs text-gray-600 font-medium">From</label>
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs sm:text-sm"
              />
              <label className="text-xs text-gray-600 font-medium">To</label>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={todayInputValue()}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs sm:text-sm"
              />
            </div>
          ) : null}
          {chartSampleNote ? <p className="text-[11px] text-gray-500">{chartSampleNote}</p> : null}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="bg-white border rounded-xl px-3 py-3 flex items-center gap-2 hover:border-blue-300 hover:shadow-sm transition"
              >
                <Icon className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-medium text-gray-800 truncate">{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert) => {
              const styles = alertStyles(alert.type);
              return (
                <div
                  key={alert.id}
                  className={`${styles.bg} border ${styles.border} rounded-xl p-4 flex items-start gap-3`}
                >
                  <AlertCircle className={`w-5 h-5 ${styles.color} mt-0.5 flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold ${styles.color}`}>{alert.title}</h3>
                    <p className="text-sm text-gray-600 mt-0.5">{alert.message}</p>
                  </div>
                  {alert.href ? (
                    <Link
                      href={alert.href}
                      className={`text-xs font-semibold ${styles.color} inline-flex items-center gap-1 shrink-0`}
                    >
                      Open <ExternalLink className="w-3 h-3" />
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {/* Key Metrics */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">
            Key Metrics — <span className="text-blue-600">{periodLabel}</span>
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            Leads / Accepted / Rejected / New customers follow the selected period. Workshops, total customers,
            complaints, SLA &amp; RSA Active are live snapshots.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              icon={<Phone className="w-5 h-5" />}
              label={`Leads (${periodLabel})`}
              value={globalMetrics.totalLeadsToday}
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
            />
            <MetricCard
              icon={<CheckCircle className="w-5 h-5" />}
              label="Accepted (pipeline)"
              value={globalMetrics.acceptedLeads}
              iconBg="bg-green-100"
              iconColor="text-green-600"
            />
            <MetricCard
              icon={<XCircle className="w-5 h-5" />}
              label="Rejected"
              value={globalMetrics.rejectedLeads}
              iconBg="bg-red-100"
              iconColor="text-red-600"
            />
            <MetricCard
              icon={<Percent className="w-5 h-5" />}
              label="Conversion"
              value={`${globalMetrics.conversionRate}%`}
              iconBg="bg-emerald-100"
              iconColor="text-emerald-600"
            />
            <MetricCard
              icon={<Clock className="w-5 h-5" />}
              label="SLA Breach (open)"
              value={globalMetrics.slaBreaches}
              iconBg="bg-orange-100"
              iconColor="text-orange-600"
            />
            <MetricCard
              icon={<Store className="w-5 h-5" />}
              label="Workshops (live)"
              value={globalMetrics.activeWorkshops}
              iconBg="bg-indigo-100"
              iconColor="text-indigo-600"
            />
            <MetricCard
              icon={<Users className="w-5 h-5" />}
              label={`New customers (${periodLabel})`}
              value={globalMetrics.newCustomers}
              sublabel={`Total: ${globalMetrics.totalCustomers}`}
              iconBg="bg-purple-100"
              iconColor="text-purple-600"
            />
            <MetricCard
              icon={<AlertCircle className="w-5 h-5" />}
              label="Complaints (open)"
              value={globalMetrics.complaintVolume}
              iconBg="bg-yellow-100"
              iconColor="text-yellow-600"
            />
            <MetricCard
              icon={<CarFront className="w-5 h-5" />}
              label="RSA Active (live)"
              value={globalMetrics.rsaActive}
              iconBg="bg-red-100"
              iconColor="text-red-600"
            />
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title={`Leads Trend (${periodLabel})`} subtitle="New leads, accepted into pipeline & rejected">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={charts.dailyLeadsTrend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" fontSize={11} tick={{ fill: '#6B7280' }} />
                <YAxis fontSize={11} tick={{ fill: '#6B7280' }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="total" name="Total" fill="#004AAD" radius={[4, 4, 0, 0]} />
                <Bar dataKey="accepted" name="Accepted" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rejected" name="Rejected" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={`Revenue Trend (${periodLabel})`} subtitle="Paid invoice revenue">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={charts.dailyRevenueTrend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" fontSize={11} tick={{ fill: '#6B7280' }} />
                <YAxis fontSize={11} tick={{ fill: '#6B7280' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']}
                />
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#004AAD" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#004AAD" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="revenue" stroke="#004AAD" strokeWidth={2} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Lead Sources */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title={`Lead Sources (${periodLabel})`}
            subtitle="Where leads came from (App, Website, Ads, MISA…)"
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={charts.leadSourceBreakdown}
                layout="vertical"
                margin={{ top: 5, right: 16, left: 8, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" fontSize={11} tick={{ fill: '#6B7280' }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} fontSize={10} tick={{ fill: '#374151' }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" name="Leads" fill="#004AAD" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h3 className="text-sm font-bold text-gray-900">Lead Source Breakdown</h3>
            <p className="text-xs text-gray-500 mt-0.5 mb-4">Count by origin for {periodLabel}</p>
            {charts.leadSourceBreakdown.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">No leads in this period</p>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {charts.leadSourceBreakdown.map((row: any, i: number) => {
                  const total =
                    charts.leadSourceBreakdown.reduce((s: number, r: any) => s + (r.value || 0), 0) || 1;
                  const pct = Math.round(((row.value || 0) / total) * 100);
                  return (
                    <div key={row.name} className="flex items-center gap-3">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-800 truncate">{row.name}</span>
                          <span className="text-xs text-gray-500 shrink-0">
                            {row.value} · {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pie charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ChartCard title={`Lead Status (${periodLabel})`} subtitle="Distribution by status">
            <DonutWithLegend data={charts.leadStatusDistribution} />
          </ChartCard>
          <ChartCard title={`Service Types (${periodLabel})`} subtitle="Leads by service category">
            <DonutWithLegend data={charts.serviceTypeBreakdown} />
          </ChartCard>
          <ChartCard title="Membership Plans" subtitle="Active plan distribution (live)">
            <DonutWithLegend data={charts.membershipPlanDistribution} />
          </ChartCard>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Revenue Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">
                Period Revenue ({periodLabel})
              </p>
              <p className="text-3xl font-bold text-green-600">{formatInr(globalMetrics.dailyRevenue)}</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">This Month (live)</p>
              <p className="text-3xl font-bold text-blue-600">{formatInr(globalMetrics.monthlyRevenue)}</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">
                Avg Rating ({periodLabel})
              </p>
              <p className="text-3xl font-bold text-yellow-600">{globalMetrics.avgRating} ⭐</p>
            </div>
          </div>
        </div>

        {/* Top workshops + recent leads */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Top Workshops</h3>
                <p className="text-xs text-gray-500">By leads in chart sample ({periodLabel})</p>
              </div>
              <Link href="/dashboard/super_admin/workshops" className="text-xs font-semibold text-blue-600">
                View all
              </Link>
            </div>
            {topWorkshops.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">No workshop leads in this period</p>
            ) : (
              <div className="space-y-2">
                {topWorkshops.map((w, i) => (
                  <div key={w.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                    <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm text-gray-800 truncate">{w.name}</span>
                    <span className="text-sm font-semibold text-gray-900">{w.leads}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Recent Leads</h3>
                <p className="text-xs text-gray-500">Latest with source ({periodLabel})</p>
              </div>
              <Link href="/dashboard/super_admin/bookings" className="text-xs font-semibold text-blue-600">
                View all
              </Link>
            </div>
            {recentLeads.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">No leads in this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 pr-2 font-medium">Customer</th>
                      <th className="pb-2 pr-2 font-medium">Source</th>
                      <th className="pb-2 pr-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLeads.map((lead) => (
                      <tr key={lead.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-2">
                          <p className="font-medium text-gray-800 truncate max-w-[120px]">{lead.customer_name}</p>
                          <p className="text-gray-400">{lead.customer_phone}</p>
                        </td>
                        <td className="py-2 pr-2 text-gray-700">{lead.source}</td>
                        <td className="py-2 pr-2 text-gray-700">{lead.status}</td>
                        <td className="py-2 text-gray-500 whitespace-nowrap">
                          {lead.created_at
                            ? new Date(lead.created_at).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Departments */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Department Performance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DepartmentCard
              icon={<Phone className="w-5 h-5 text-blue-600" />}
              title="Telecaller"
              metrics={[
                { label: `Leads (${periodLabel})`, value: departmentMetrics.telecaller.leads7d },
                { label: 'Follow-ups', value: departmentMetrics.telecaller.followUpsToday },
                { label: 'Conversion', value: `${departmentMetrics.telecaller.conversion7d}%`, highlight: true },
              ]}
            />
            <DepartmentCard
              icon={<UserCheck className="w-5 h-5 text-indigo-600" />}
              title="Lead Manager"
              metrics={[
                { label: `Assigned (${periodLabel})`, value: departmentMetrics.leadManager.assigned7d },
                { label: 'Avg Time', value: `${departmentMetrics.leadManager.avgAssignMins7d}m` },
                { label: 'Accuracy', value: `${departmentMetrics.leadManager.accuracy7d}%`, highlight: true },
              ]}
            />
            <DepartmentCard
              icon={<Store className="w-5 h-5 text-blue-600" />}
              title="Workshops"
              metrics={[
                { label: 'Active (live)', value: departmentMetrics.workshops.active },
                { label: 'Busy (live)', value: departmentMetrics.workshops.busy },
                { label: 'Avg Time', value: `${departmentMetrics.workshops.avgCompletionHours7d}h` },
              ]}
            />
            <DepartmentCard
              icon={<CarFront className="w-5 h-5 text-red-600" />}
              title="RSA"
              metrics={[
                { label: 'Active (live)', value: departmentMetrics.rsa.active },
                { label: 'Dispatch', value: `${departmentMetrics.rsa.avgDispatchMins7d}m` },
                { label: 'Complete', value: `${departmentMetrics.rsa.completion7d}%`, highlight: true },
              ]}
            />
            <DepartmentCard
              icon={<Shield className="w-5 h-5 text-purple-600" />}
              title="Quality Auditors"
              metrics={[
                { label: `Audits (${periodLabel})`, value: departmentMetrics.auditors.auditsToday },
                { label: 'Fraud (open)', value: departmentMetrics.auditors.fraudOpen },
                { label: 'Score', value: `${departmentMetrics.auditors.avgScore10}/10` },
              ]}
            />
          </div>
        </div>

        {/* App & Membership */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Mobile App & Membership</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              icon={<Crown className="w-5 h-5" />}
              label="Active Members (live)"
              value={appMetrics.activeMemberships}
              iconBg="bg-yellow-100"
              iconColor="text-yellow-600"
            />
            <MetricCard
              icon={<Crown className="w-5 h-5" />}
              label={`New (${periodLabel})`}
              value={appMetrics.newMemberships7d}
              iconBg="bg-green-100"
              iconColor="text-green-600"
            />
            <MetricCard
              icon={<TrendingUp className="w-5 h-5" />}
              label={`Membership Rev (${periodLabel})`}
              value={formatInr(appMetrics.membershipRevenueMonth)}
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
            />
            <MetricCard
              icon={<Bell className="w-5 h-5" />}
              label="Push Devices (live)"
              value={appMetrics.pushDevices}
              iconBg="bg-purple-100"
              iconColor="text-purple-600"
            />
            <MetricCard
              icon={<Activity className="w-5 h-5" />}
              label={`Health Reports (${periodLabel})`}
              value={appMetrics.healthReports30d}
              iconBg="bg-teal-100"
              iconColor="text-teal-600"
            />
            <MetricCard
              icon={<Sparkles className="w-5 h-5" />}
              label={`Resale Reports (${periodLabel})`}
              value={appMetrics.resaleReports30d}
              iconBg="bg-indigo-100"
              iconColor="text-indigo-600"
            />
            <MetricCard
              icon={<Wallet className="w-5 h-5" />}
              label={`Wallet Credits (${periodLabel})`}
              value={formatInr(appMetrics.totalWalletCredits30d)}
              iconBg="bg-emerald-100"
              iconColor="text-emerald-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sublabel, iconBg, iconColor }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
          <p className="text-xs text-gray-500 truncate">{label}</p>
          {sublabel ? <p className="text-[10px] text-gray-400 truncate">{sublabel}</p> : null}
        </div>
      </div>
    </div>
  );
}

function DepartmentCard({ icon, title, metrics }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
        {icon}
        <h3 className="font-bold text-sm text-gray-900">{title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {metrics.map((metric: any, index: number) => (
          <div key={index} className="text-center">
            <p className={`text-base font-bold ${metric.highlight ? 'text-green-600' : 'text-gray-900'}`}>
              {metric.value}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">{metric.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="mb-3">
        <h3 className="font-bold text-sm text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function DonutWithLegend({ data }: { data: { name: string; value: number }[] }) {
  const rows = (data || []).filter((d) => (d?.value || 0) > 0);
  const total = rows.reduce((s, r) => s + (r.value || 0), 0) || 1;

  if (!rows.length) {
    return <p className="text-sm text-gray-500 py-10 text-center">No data</p>;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={rows}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={72}
            paddingAngle={2}
            dataKey="value"
            label={({ percent }) => (percent >= 0.08 ? `${(percent * 100).toFixed(0)}%` : '')}
            labelLine={false}
            fontSize={11}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
            formatter={(value: any, name: any) => {
              const n = Number(value) || 0;
              return [`${n} (${Math.round((n / total) * 100)}%)`, name];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="w-full sm:w-40 space-y-1.5 shrink-0 max-h-[180px] overflow-y-auto">
        {rows.map((row, i) => (
          <div key={row.name} className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="text-gray-700 truncate flex-1" title={row.name}>
              {row.name}
            </span>
            <span className="text-gray-500 shrink-0">{Math.round((row.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
