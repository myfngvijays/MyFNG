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
  CarFront
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  
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

  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/super_admin/dashboard');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load dashboard');

      const gm = json?.globalMetrics || {};
      const dm = json?.departmentMetrics || {};
      setGlobalMetrics((prev) => ({ ...prev, ...gm }));
      setDepartmentMetrics((prev) => ({ ...prev, ...dm }));

      // Generate Critical Alerts (derived from real metrics)
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
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary mx-auto mb-3 sm:mb-4"></div>
          <p className="text-text-body text-xs sm:text-sm md:text-base">Loading Super Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-grey">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-300 drop-shadow-lg">🏆 Super Admin Control Panel</h1>
        <p className="text-white font-medium text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">Ultimate System Control & Governance</p>
      </div>

      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 md:space-y-6">
        {/* Critical Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2 sm:space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">🚨 Critical Alerts</h2>
            {alerts.map((alert) => (
              <div key={alert.id} className={`${alert.bg} border ${alert.border} rounded-lg p-3 sm:p-4 flex items-start gap-2 sm:gap-3`}>
                <AlertCircle className={`w-4 h-4 sm:w-5 sm:h-5 ${alert.color} mt-0.5 flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold text-sm sm:text-base ${alert.color}`}>{alert.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Global Metrics */}
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-text-heading mb-3 sm:mb-4">🌍 Global Metrics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard
              icon={<Phone className="w-6 h-6 text-brand-primary" />}
              label="Leads Today"
              value={globalMetrics.totalLeadsToday}
              color="bg-blue-50 border-brand-primary/30"
            />
            <MetricCard
              icon={<CheckCircle className="w-6 h-6 text-green-600" />}
              label="Accepted"
              value={globalMetrics.acceptedLeads}
              color="bg-green-50 border-green-200"
            />
            <MetricCard
              icon={<XCircle className="w-6 h-6 text-red-600" />}
              label="Rejected"
              value={globalMetrics.rejectedLeads}
              color="bg-red-50 border-red-200"
            />
            <MetricCard
              icon={<Clock className="w-6 h-6 text-orange-600" />}
              label="SLA Breach"
              value={globalMetrics.slaBreaches}
              color="bg-orange-50 border-orange-200"
            />
            <MetricCard
              icon={<Store className="w-6 h-6 text-brand-secondary" />}
              label="Workshops"
              value={globalMetrics.activeWorkshops}
              color="bg-blue-50 border-brand-secondary/30"
            />
            <MetricCard
              icon={<Users className="w-6 h-6 text-brand-primary" />}
              label="Customers"
              value={globalMetrics.totalCustomers}
              color="bg-blue-50 border-brand-primary/30"
            />
            <MetricCard
              icon={<AlertCircle className="w-6 h-6 text-brand-secondary" />}
              label="Complaints"
              value={globalMetrics.complaintVolume}
              color="bg-blue-50 border-brand-secondary/30"
            />
            <MetricCard
              icon={<CarFront className="w-6 h-6 text-red-600" />}
              label="RSA Active"
              value={globalMetrics.rsaActive}
              color="bg-red-50 border-red-200"
            />
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-text-heading mb-3 sm:mb-4">💰 Revenue Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
            <div className="text-center">
              <p className="text-xs sm:text-sm text-text-body mb-1">Daily Revenue</p>
              <p className="text-2xl sm:text-2.5xl md:text-3xl font-bold text-green-600">
                ₹{(globalMetrics.dailyRevenue / 1000).toFixed(1)}K
              </p>
            </div>
            <div className="text-center border-x border-gray-200">
              <p className="text-xs sm:text-sm text-text-body mb-1">This Month</p>
              <p className="text-2xl sm:text-2.5xl md:text-3xl font-bold text-brand-primary">
                ₹{(globalMetrics.monthlyRevenue / 1000).toFixed(1)}K
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs sm:text-sm text-text-body mb-1">Avg Rating (30d)</p>
              <p className="text-2xl sm:text-2.5xl md:text-3xl font-bold text-orange-600">
                {globalMetrics.avgRating}⭐
              </p>
            </div>
          </div>
        </div>

        {/* Department Performance */}
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-text-heading mb-3 sm:mb-4">📊 Department Performance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <DepartmentCard
              icon={<Phone className="w-6 h-6 text-brand-primary" />}
              title="Telecaller"
              metrics={[
                { label: 'Leads (7d)', value: departmentMetrics.telecaller.leads7d },
                { label: 'Follow-ups', value: departmentMetrics.telecaller.followUpsToday },
                { label: 'Conversion (7d)', value: `${departmentMetrics.telecaller.conversion7d}%`, highlight: true }
              ]}
            />
            <DepartmentCard
              icon={<UserCheck className="w-6 h-6 text-brand-secondary" />}
              title="Lead Manager"
              metrics={[
                { label: 'Assigned (7d)', value: departmentMetrics.leadManager.assigned7d },
                { label: 'Avg Time', value: `${departmentMetrics.leadManager.avgAssignMins7d}m` },
                { label: 'Accuracy', value: `${departmentMetrics.leadManager.accuracy7d}%`, highlight: true }
              ]}
            />
            <DepartmentCard
              icon={<Store className="w-6 h-6 text-brand-primary" />}
              title="Workshops"
              metrics={[
                { label: 'Active', value: departmentMetrics.workshops.active },
                { label: 'Busy', value: departmentMetrics.workshops.busy },
                { label: 'Avg Time', value: `${departmentMetrics.workshops.avgCompletionHours7d}h` }
              ]}
            />
            <DepartmentCard
              icon={<CarFront className="w-6 h-6 text-red-600" />}
              title="RSA"
              metrics={[
                { label: 'Active', value: departmentMetrics.rsa.active },
                { label: 'Dispatch', value: `${departmentMetrics.rsa.avgDispatchMins7d}m` },
                { label: 'Complete (7d)', value: `${departmentMetrics.rsa.completion7d}%`, highlight: true }
              ]}
            />
            <DepartmentCard
              icon={<Shield className="w-6 h-6 text-brand-secondary" />}
              title="Quality Auditors"
              metrics={[
                { label: 'Audits', value: departmentMetrics.auditors.auditsToday },
                { label: 'Fraud', value: departmentMetrics.auditors.fraudOpen },
                { label: 'Avg Score', value: `${departmentMetrics.auditors.avgScore10}/10` }
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: any) {
  return (
    <div className={`${color} border rounded-lg p-3 sm:p-4`}>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex-shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xl sm:text-2xl font-bold text-text-heading">{value}</p>
          <p className="text-xs sm:text-sm text-text-body truncate">{label}</p>
        </div>
      </div>
    </div>
  );
}

function DepartmentCard({ icon, title, metrics }: any) {
  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-5">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b">
        <div className="flex-shrink-0">{icon}</div>
        <h3 className="font-bold text-sm sm:text-base text-text-heading truncate">{title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
        {metrics.map((metric: any, index: number) => (
          <div key={index} className="text-center">
            <p className={`text-base sm:text-lg font-bold ${metric.highlight ? 'text-green-600' : 'text-text-heading'}`}>
              {metric.value}
            </p>
            <p className="text-[10px] sm:text-xs text-text-body mt-0.5 sm:mt-1">{metric.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// (Super Admin Actions section removed)
