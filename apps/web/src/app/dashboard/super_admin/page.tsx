'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Users,
  Store,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Phone,
  UserCheck,
  Shield,
  CarFront
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  
  const [globalMetrics, setGlobalMetrics] = useState({
    totalLeadsToday: 0,
    acceptedLeads: 0,
    rejectedLeads: 0,
    slaBreaches: 0,
    totalRevenue: 0,
    dailyRevenue: 0,
    activeWorkshops: 0,
    totalCustomers: 0,
    avgWorkshopRating: 0,
    complaintVolume: 0,
    rsaEmergencies: 0,
    systemUptime: 99.9
  });

  const [departmentMetrics, setDepartmentMetrics] = useState({
    telecaller: { leads: 0, followUps: 0, conversion: 0 },
    leadManager: { assigned: 0, avgTime: 0, accuracy: 0 },
    workshops: { active: 0, busy: 0, avgCompletion: 0 },
    rsa: { active: 0, avgDispatch: 0, completion: 0 },
    auditors: { auditsToday: 0, fraudFound: 0, avgScore: 0 }
  });

  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch Global Metrics
      const [
        totalLeadsResult,
        acceptedResult,
        rejectedResult,
        slaBreachedResult,
        workshopsResult,
        customersResult
      ] = await Promise.all([
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .gte('created_at', `${today}T00:00:00`),
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .eq('status', 'ACCEPTED'),
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .eq('status', 'REJECTED'),
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .eq('sla_state', 'BREACHED')
          .not('status', 'in', '(COMPLETED,CANCELLED,CLOSED)'),
        supabase.from('workshops').select('id', { count: 'exact', head: true })
          .eq('is_verified', true),
        supabase.from('users_login').select('id', { count: 'exact', head: true })
      ]);

      setGlobalMetrics({
        totalLeadsToday: totalLeadsResult.count || 0,
        acceptedLeads: acceptedResult.count || 0,
        rejectedLeads: rejectedResult.count || 0,
        slaBreaches: slaBreachedResult.count || 0,
        totalRevenue: 2450000,
        dailyRevenue: 125000,
        activeWorkshops: workshopsResult.count || 0,
        totalCustomers: customersResult.count || 0,
        avgWorkshopRating: 4.5,
        complaintVolume: 0,
        rsaEmergencies: 3,
        systemUptime: 99.9
      });

      // Fetch Department Metrics
      const [telecallerLeads, assignedLeads] = await Promise.all([
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .not('assigned_telecaller_id', 'is', null),
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .not('workshop_id', 'is', null)
      ]);

      setDepartmentMetrics({
        telecaller: {
          leads: telecallerLeads.count || 0,
          followUps: 45,
          conversion: 72
        },
        leadManager: {
          assigned: assignedLeads.count || 0,
          avgTime: 12,
          accuracy: 94
        },
        workshops: {
          active: workshopsResult.count || 0,
          busy: 8,
          avgCompletion: 4.5
        },
        rsa: {
          active: 12,
          avgDispatch: 18,
          completion: 89
        },
        auditors: {
          auditsToday: 5,
          fraudFound: 1,
          avgScore: 8.2
        }
      });

      // Generate Critical Alerts
      const criticalAlerts = [];
      if (slaBreachedResult.count && slaBreachedResult.count > 0) {
        criticalAlerts.push({
          id: 'sla',
          type: 'CRITICAL',
          title: 'SLA Breaches',
          message: `${slaBreachedResult.count} leads have breached SLA`,
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Super Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
        <h1 className="text-3xl font-bold">🏆 Super Admin Control Panel</h1>
        <p className="text-purple-100 mt-1">Ultimate System Control & Governance</p>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* System Status */}
        <div className={`${globalMetrics.systemUptime > 99 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-lg p-4 flex justify-between items-center`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${globalMetrics.systemUptime > 99 ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
            <span className={`font-semibold ${globalMetrics.systemUptime > 99 ? 'text-green-700' : 'text-red-700'}`}>
              System Operational
            </span>
          </div>
          <span className="text-sm text-gray-600">{globalMetrics.systemUptime}% Uptime</span>
        </div>

        {/* Critical Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-gray-900">🚨 Critical Alerts</h2>
            {alerts.map((alert) => (
              <div key={alert.id} className={`${alert.bg} border ${alert.border} rounded-lg p-4 flex items-start gap-3`}>
                <AlertCircle className={`w-5 h-5 ${alert.color} mt-0.5`} />
                <div className="flex-1">
                  <h3 className={`font-semibold ${alert.color}`}>{alert.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Global Metrics */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">🌍 Global Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={<Phone className="w-6 h-6 text-blue-600" />}
              label="Leads Today"
              value={globalMetrics.totalLeadsToday}
              color="bg-blue-50 border-blue-200"
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
              icon={<Store className="w-6 h-6 text-purple-600" />}
              label="Workshops"
              value={globalMetrics.activeWorkshops}
              color="bg-purple-50 border-purple-200"
            />
            <MetricCard
              icon={<Users className="w-6 h-6 text-teal-600" />}
              label="Customers"
              value={globalMetrics.totalCustomers}
              color="bg-teal-50 border-teal-200"
            />
            <MetricCard
              icon={<AlertCircle className="w-6 h-6 text-indigo-600" />}
              label="Complaints"
              value={globalMetrics.complaintVolume}
              color="bg-indigo-50 border-indigo-200"
            />
            <MetricCard
              icon={<CarFront className="w-6 h-6 text-red-600" />}
              label="RSA Active"
              value={globalMetrics.rsaEmergencies}
              color="bg-red-50 border-red-200"
            />
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">💰 Revenue Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Daily Revenue</p>
              <p className="text-3xl font-bold text-green-600">
                ₹{(globalMetrics.dailyRevenue / 1000).toFixed(1)}K
              </p>
            </div>
            <div className="text-center border-x">
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-3xl font-bold text-blue-600">
                ₹{(globalMetrics.totalRevenue / 100000).toFixed(1)}L
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Avg Rating</p>
              <p className="text-3xl font-bold text-orange-600">
                {globalMetrics.avgWorkshopRating}⭐
              </p>
            </div>
          </div>
        </div>

        {/* Department Performance */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Department Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <DepartmentCard
              icon={<Phone className="w-6 h-6 text-blue-600" />}
              title="Telecaller"
              metrics={[
                { label: 'Leads', value: departmentMetrics.telecaller.leads },
                { label: 'Follow-ups', value: departmentMetrics.telecaller.followUps },
                { label: 'Conversion', value: `${departmentMetrics.telecaller.conversion}%`, highlight: true }
              ]}
            />
            <DepartmentCard
              icon={<UserCheck className="w-6 h-6 text-purple-600" />}
              title="Lead Manager"
              metrics={[
                { label: 'Assigned', value: departmentMetrics.leadManager.assigned },
                { label: 'Avg Time', value: `${departmentMetrics.leadManager.avgTime}m` },
                { label: 'Accuracy', value: `${departmentMetrics.leadManager.accuracy}%`, highlight: true }
              ]}
            />
            <DepartmentCard
              icon={<Store className="w-6 h-6 text-orange-600" />}
              title="Workshops"
              metrics={[
                { label: 'Active', value: departmentMetrics.workshops.active },
                { label: 'Busy', value: departmentMetrics.workshops.busy },
                { label: 'Avg Time', value: `${departmentMetrics.workshops.avgCompletion}h` }
              ]}
            />
            <DepartmentCard
              icon={<CarFront className="w-6 h-6 text-red-600" />}
              title="RSA"
              metrics={[
                { label: 'Active', value: departmentMetrics.rsa.active },
                { label: 'Dispatch', value: `${departmentMetrics.rsa.avgDispatch}m` },
                { label: 'Complete', value: `${departmentMetrics.rsa.completion}%`, highlight: true }
              ]}
            />
            <DepartmentCard
              icon={<Shield className="w-6 h-6 text-indigo-600" />}
              title="Quality Auditors"
              metrics={[
                { label: 'Audits', value: departmentMetrics.auditors.auditsToday },
                { label: 'Fraud', value: departmentMetrics.auditors.fraudFound },
                { label: 'Avg Score', value: `${departmentMetrics.auditors.avgScore}/10` }
              ]}
            />
          </div>
        </div>

        {/* Quick Admin Actions */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">⚡ Super Admin Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <ActionButton href="/dashboard/super_admin/workshops" icon="🏪" label="Workshops" color="bg-blue-500" />
            <ActionButton href="/dashboard/super_admin/users" icon="👥" label="Users" color="bg-purple-500" />
            <ActionButton href="/dashboard/super_admin/finance" icon="💰" label="Finance" color="bg-green-500" />
            <ActionButton href="/dashboard/super_admin/settings" icon="⚙️" label="Settings" color="bg-orange-500" />
            <ActionButton href="/dashboard/super_admin/fraud" icon="🚨" label="Fraud" color="bg-red-500" />
            <ActionButton href="/dashboard/super_admin/reports" icon="📊" label="Reports" color="bg-indigo-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: any) {
  return (
    <div className={`${color} border rounded-lg p-4`}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-600">{label}</p>
        </div>
      </div>
    </div>
  );
}

function DepartmentCard({ icon, title, metrics }: any) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b">
        {icon}
        <h3 className="font-bold text-gray-900">{title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {metrics.map((metric: any, index: number) => (
          <div key={index} className="text-center">
            <p className={`text-lg font-bold ${metric.highlight ? 'text-green-600' : 'text-gray-900'}`}>
              {metric.value}
            </p>
            <p className="text-xs text-gray-600 mt-1">{metric.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionButton({ href, icon, label, color }: any) {
  return (
    <a
      href={href}
      className={`${color} hover:opacity-90 text-white rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all hover:scale-105 shadow-lg`}
    >
      <span className="text-3xl">{icon}</span>
      <span className="font-semibold text-sm">{label}</span>
    </a>
  );
}
