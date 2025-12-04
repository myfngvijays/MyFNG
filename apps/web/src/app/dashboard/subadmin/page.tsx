'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  Users, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  CheckCircle,
  MessageSquare,
  FileText,
  Shield,
  Loader2,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import TeamPerformanceWidget from '@/components/subadmin/TeamPerformanceWidget';
import SLAMonitoringWidget from '@/components/subadmin/SLAMonitoringWidget';
import EscalationCorner from '@/components/subadmin/EscalationCorner';

export default function SubAdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const supabase = createClient();
      
      // Get user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('users_login')
        .select('id, full_name, department, roles!inner(role_code, role_name)')
        .eq('id', user.id)
        .single();

      if (!profile || (profile.roles as any)?.role_code !== 'SUB_ADMIN') {
        router.push('/dashboard');
        return;
      }

      setUserProfile(profile);
      const dept = profile.department;
      setDepartment(dept);

      // Fetch dashboard data
      const response = await fetch('/api/subadmin/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      setDashboardData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="subadmin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboardData || !department) {
    return (
      <DashboardLayout role="subadmin">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-600">Unable to load dashboard data</p>
        </div>
      </DashboardLayout>
    );
  }

  const { team_overview, department_metrics, alerts } = dashboardData;

  // Department-specific colors and icons
  const deptConfig: Record<string, { color: string; bgGradient: string; icon: any }> = {
    CSE: {
      color: 'blue',
      bgGradient: 'from-blue-600 to-blue-800',
      icon: MessageSquare,
    },
    TELECALLER: {
      color: 'green',
      bgGradient: 'from-green-600 to-green-800',
      icon: Users,
    },
    AUDITOR: {
      color: 'purple',
      bgGradient: 'from-purple-600 to-purple-800',
      icon: Shield,
    },
  };

  const config = deptConfig[department] || deptConfig.CSE;
  const DeptIcon = config.icon;

  return (
    <DashboardLayout role="subadmin">
      <div className="space-y-6">
        {/* Header */}
        <div className={`bg-gradient-to-r ${config.bgGradient} rounded-lg p-6 text-white shadow-lg`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <DeptIcon className="w-8 h-8" />
                {department} Sub Admin Dashboard
              </h1>
              <p className="text-white/90 mt-1">Welcome back, {userProfile?.full_name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-white/80">Quality Score</p>
              <p className="text-3xl font-bold">{team_overview?.quality_score || 0}</p>
            </div>
          </div>
        </div>

        {/* Alerts Section */}
        {alerts && alerts.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-red-800">
                  {alerts.length} Alert{alerts.length > 1 ? 's' : ''} Require Attention
                </h3>
              </div>
              <Link
                href={`/dashboard/subadmin/${department.toLowerCase()}/alerts`}
                className="text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Staff</p>
                <p className="text-3xl font-bold text-gray-900">{team_overview?.total_staff || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {team_overview?.online_staff || 0} online
                </p>
              </div>
              <div className={`bg-${config.color}-100 p-3 rounded-full`}>
                <Users className={`w-6 h-6 text-${config.color}-600`} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">SLA Breaches</p>
                <p className="text-3xl font-bold text-red-600">{team_overview?.sla_breaches || 0}</p>
                <p className="text-xs text-yellow-600 mt-1">
                  {team_overview?.sla_at_risk || 0} at risk
                </p>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Escalations</p>
                <p className="text-3xl font-bold text-orange-600">{team_overview?.pending_escalations || 0}</p>
                <p className="text-xs text-red-600 mt-1">
                  {team_overview?.urgent_escalations || 0} urgent
                </p>
              </div>
              <div className="bg-orange-100 p-3 rounded-full">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tasks Assigned Today</p>
                <p className="text-3xl font-bold text-blue-600">{team_overview?.tasks_assigned_today || 0}</p>
                <p className="text-xs text-gray-500 mt-1">New assignments</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Widgets Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Performance Widget */}
          <TeamPerformanceWidget 
            teamOverview={team_overview} 
            department={department}
          />

          {/* SLA Monitoring Widget */}
          <SLAMonitoringWidget 
            slaBreaches={team_overview?.sla_breaches || 0}
            slaAtRisk={team_overview?.sla_at_risk || 0}
            department={department}
          />

          {/* Escalation Corner */}
          <EscalationCorner
            escalations={alerts || []}
            pendingCount={team_overview?.pending_escalations || 0}
            urgentCount={team_overview?.urgent_escalations || 0}
            department={department}
          />
        </div>

        {/* Department-Specific Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Department Metrics Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-600" />
              Department Metrics
            </h2>
            <div className="space-y-3">
              {Object.entries(department_metrics || {}).map(([key, value]: [string, any]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              Quick Actions
            </h2>
            <div className="space-y-2">
              <Link
                href={`/dashboard/subadmin/${department.toLowerCase()}/team`}
                className="block p-3 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Manage Team</span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              </Link>
              <Link
                href={`/dashboard/subadmin/${department.toLowerCase()}/leads`}
                className="block p-3 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">View Leads</span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              </Link>
              <Link
                href={`/dashboard/subadmin/${department.toLowerCase()}/escalations`}
                className="block p-3 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Escalations</span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              </Link>
              <Link
                href={`/dashboard/subadmin/${department.toLowerCase()}/performance`}
                className="block p-3 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Team Performance</span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Alerts */}
        {alerts && alerts.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Recent Alerts
            </h2>
            <div className="space-y-2">
              {alerts.slice(0, 5).map((alert: any, index: number) => (
                <div
                  key={index}
                  className={`p-3 rounded border-l-4 ${
                    alert.severity === 'CRITICAL' || alert.severity === 'URGENT'
                      ? 'border-red-500 bg-red-50'
                      : alert.severity === 'HIGH'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-yellow-500 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{alert.message}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      alert.severity === 'CRITICAL' || alert.severity === 'URGENT'
                        ? 'bg-red-200 text-red-800'
                        : alert.severity === 'HIGH'
                        ? 'bg-orange-200 text-orange-800'
                        : 'bg-yellow-200 text-yellow-800'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

