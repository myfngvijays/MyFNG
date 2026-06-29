'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
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

export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [globalMetrics, setGlobalMetrics] = useState({
    totalLeadsToday: 0,
    acceptedLeads: 0,
    rejectedLeads: 0,
    slaBreaches: 0,
    dailyRevenue: 0,
    monthlyRevenue: 0,
    activeWorkshops: 0,
    totalCustomers: 0,
    avgRating: 0,
    complaintVolume: 0,
    rsaActive: 0
  });

  const [departmentMetrics, setDepartmentMetrics] = useState({
    telecaller: { leads7d: 0, followUpsToday: 0, conversion7d: 0 },
    leadManager: { assigned7d: 0, avgAssignMins7d: 0, accuracy7d: 0 },
    workshops: { active: 0, busy: 0, avgCompletionHours7d: 0 },
    rsa: { active: 0, avgDispatchMins7d: 0, completion7d: 0 },
    auditors: { auditsToday: 0, fraudOpen: 0, avgScore10: 0 }
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
    membershipPlanDistribution: [] as any[],
    leadStatusDistribution: [] as any[],
  });

  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/super_admin/dashboard');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load dashboard');

      const gm = json?.globalMetrics || {};
      const dm = json?.departmentMetrics || {};
      const am = json?.appMetrics || {};
      const ch = json?.charts || {};
      setGlobalMetrics((prev) => ({ ...prev, ...gm }));
      setDepartmentMetrics((prev) => ({ ...prev, ...dm }));
      setAppMetrics((prev) => ({ ...prev, ...am }));
      setCharts((prev) => ({ ...prev, ...ch }));

      const criticalAlerts: any[] = [];
      if (gm?.slaBreaches && gm.slaBreaches > 0) {
        criticalAlerts.push({
          id: 'sla',
          type: 'CRITICAL',
          title: 'SLA Breaches',
          message: `${gm.slaBreaches} leads have breached SLA`,
          color: 'text-red-600',
          bg: 'bg-red-50',
          border: 'border-red-200'
        });
      }
      setAlerts(criticalAlerts);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white p-5 md:p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-white/90 text-sm">Welcome back, Super Admin 👋</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white mt-1">Super Admin Dashboard</h1>
            <p className="text-blue-100 text-sm mt-1">Real-time business intelligence &amp; analytics</p>
          </div>
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Critical Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className={`${alert.bg} border ${alert.border} rounded-xl p-4 flex items-start gap-3`}>
                <AlertCircle className={`w-5 h-5 ${alert.color} mt-0.5 flex-shrink-0`} />
                <div>
                  <h3 className={`font-semibold ${alert.color}`}>{alert.title}</h3>
                  <p className="text-sm text-gray-600 mt-0.5">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Global Metrics Grid */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Key Metrics — Today</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard icon={<Phone className="w-5 h-5" />} label="Leads Today" value={globalMetrics.totalLeadsToday} iconBg="bg-blue-100" iconColor="text-blue-600" />
            <MetricCard icon={<CheckCircle className="w-5 h-5" />} label="Accepted" value={globalMetrics.acceptedLeads} iconBg="bg-green-100" iconColor="text-green-600" />
            <MetricCard icon={<XCircle className="w-5 h-5" />} label="Rejected" value={globalMetrics.rejectedLeads} iconBg="bg-red-100" iconColor="text-red-600" />
            <MetricCard icon={<Clock className="w-5 h-5" />} label="SLA Breach" value={globalMetrics.slaBreaches} iconBg="bg-orange-100" iconColor="text-orange-600" />
            <MetricCard icon={<Store className="w-5 h-5" />} label="Workshops" value={globalMetrics.activeWorkshops} iconBg="bg-indigo-100" iconColor="text-indigo-600" />
            <MetricCard icon={<Users className="w-5 h-5" />} label="Customers" value={globalMetrics.totalCustomers} iconBg="bg-purple-100" iconColor="text-purple-600" />
            <MetricCard icon={<AlertCircle className="w-5 h-5" />} label="Complaints" value={globalMetrics.complaintVolume} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
            <MetricCard icon={<CarFront className="w-5 h-5" />} label="RSA Active" value={globalMetrics.rsaActive} iconBg="bg-red-100" iconColor="text-red-600" />
          </div>
        </div>

        {/* Charts Row 1: Leads Trend + Revenue Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Leads Trend (7 Days)" subtitle="Daily new leads, accepted & rejected">
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

          <ChartCard title="Revenue Trend (7 Days)" subtitle="Daily paid invoice revenue">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={charts.dailyRevenueTrend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" fontSize={11} tick={{ fill: '#6B7280' }} />
                <YAxis fontSize={11} tick={{ fill: '#6B7280' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
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

        {/* Charts Row 2: Pie Charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ChartCard title="Lead Status (7d)" subtitle="Distribution by current status">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={charts.leadStatusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  fontSize={9}
                >
                  {charts.leadStatusDistribution.map((_: any, i: number) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Service Types (30d)" subtitle="Leads by service category">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={charts.serviceTypeBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  fontSize={9}
                >
                  {charts.serviceTypeBreakdown.map((_: any, i: number) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Membership Plans" subtitle="Active plan distribution">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={charts.membershipPlanDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  fontSize={9}
                >
                  {charts.membershipPlanDistribution.map((_: any, i: number) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Revenue Summary */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Revenue Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">Daily Revenue</p>
              <p className="text-3xl font-bold text-green-600">₹{(globalMetrics.dailyRevenue / 1000).toFixed(1)}K</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">Monthly Revenue</p>
              <p className="text-3xl font-bold text-blue-600">₹{(globalMetrics.monthlyRevenue / 1000).toFixed(1)}K</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">Avg Rating (30d)</p>
              <p className="text-3xl font-bold text-yellow-600">{globalMetrics.avgRating} ⭐</p>
            </div>
          </div>
        </div>

        {/* Department Performance */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Department Performance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DepartmentCard
              icon={<Phone className="w-5 h-5 text-blue-600" />}
              title="Telecaller"
              metrics={[
                { label: 'Leads (7d)', value: departmentMetrics.telecaller.leads7d },
                { label: 'Follow-ups', value: departmentMetrics.telecaller.followUpsToday },
                { label: 'Conversion', value: `${departmentMetrics.telecaller.conversion7d}%`, highlight: true }
              ]}
            />
            <DepartmentCard
              icon={<UserCheck className="w-5 h-5 text-indigo-600" />}
              title="Lead Manager"
              metrics={[
                { label: 'Assigned (7d)', value: departmentMetrics.leadManager.assigned7d },
                { label: 'Avg Time', value: `${departmentMetrics.leadManager.avgAssignMins7d}m` },
                { label: 'Accuracy', value: `${departmentMetrics.leadManager.accuracy7d}%`, highlight: true }
              ]}
            />
            <DepartmentCard
              icon={<Store className="w-5 h-5 text-blue-600" />}
              title="Workshops"
              metrics={[
                { label: 'Active', value: departmentMetrics.workshops.active },
                { label: 'Busy', value: departmentMetrics.workshops.busy },
                { label: 'Avg Time', value: `${departmentMetrics.workshops.avgCompletionHours7d}h` }
              ]}
            />
            <DepartmentCard
              icon={<CarFront className="w-5 h-5 text-red-600" />}
              title="RSA"
              metrics={[
                { label: 'Active', value: departmentMetrics.rsa.active },
                { label: 'Dispatch', value: `${departmentMetrics.rsa.avgDispatchMins7d}m` },
                { label: 'Complete', value: `${departmentMetrics.rsa.completion7d}%`, highlight: true }
              ]}
            />
            <DepartmentCard
              icon={<Shield className="w-5 h-5 text-purple-600" />}
              title="Quality Auditors"
              metrics={[
                { label: 'Audits', value: departmentMetrics.auditors.auditsToday },
                { label: 'Fraud', value: departmentMetrics.auditors.fraudOpen },
                { label: 'Score', value: `${departmentMetrics.auditors.avgScore10}/10` }
              ]}
            />
          </div>
        </div>

        {/* App & Membership Metrics */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Mobile App & Membership</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard icon={<Crown className="w-5 h-5" />} label="Active Members" value={appMetrics.activeMemberships} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
            <MetricCard icon={<Crown className="w-5 h-5" />} label="New (7d)" value={appMetrics.newMemberships7d} iconBg="bg-green-100" iconColor="text-green-600" />
            <MetricCard icon={<TrendingUp className="w-5 h-5" />} label="Membership Rev" value={`₹${(appMetrics.membershipRevenueMonth / 1000).toFixed(1)}K`} iconBg="bg-blue-100" iconColor="text-blue-600" />
            <MetricCard icon={<Bell className="w-5 h-5" />} label="Push Devices" value={appMetrics.pushDevices} iconBg="bg-purple-100" iconColor="text-purple-600" />
            <MetricCard icon={<Activity className="w-5 h-5" />} label="Health Reports" value={appMetrics.healthReports30d} iconBg="bg-teal-100" iconColor="text-teal-600" />
            <MetricCard icon={<Sparkles className="w-5 h-5" />} label="Resale Reports" value={appMetrics.resaleReports30d} iconBg="bg-indigo-100" iconColor="text-indigo-600" />
            <MetricCard icon={<Wallet className="w-5 h-5" />} label="Wallet Credits" value={`₹${(appMetrics.totalWalletCredits30d / 1000).toFixed(1)}K`} iconBg="bg-emerald-100" iconColor="text-emerald-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, iconBg, iconColor }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
          <p className="text-xs text-gray-500 truncate">{label}</p>
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
