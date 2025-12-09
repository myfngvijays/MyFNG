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

      const { data: profile, error: profileError } = await supabase
        .from('users_login')
        .select('id, full_name, department, roles!inner(role_code, role_name)')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Profile fetch error:', profileError);
        router.push('/dashboard');
        return;
      }

      if ((profile.roles as any)?.role_code !== 'SUB_ADMIN') {
        router.push('/dashboard');
        return;
      }

      // Check if department is set
      if (!profile.department || !['CSE', 'TELECALLER', 'AUDITOR'].includes(profile.department)) {
        console.error('Department not set or invalid:', profile.department);
        // Don't redirect, show error message instead
        setLoading(false);
        return;
      }

      setUserProfile(profile);
      const dept = profile.department;
      setDepartment(dept);

      // Fetch dashboard data
      const response = await fetch('/api/subadmin/dashboard');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Failed to fetch dashboard data');
      }

      const data = await response.json();
      setDashboardData(data);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching dashboard:', error);
      setLoading(false);
      // Show error message to user
      if (error.message) {
        alert(`Error: ${error.message}`);
      }
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="sub_admin">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-brand-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboardData || !department) {
    return (
      <DashboardLayout role="sub_admin">
        <div className="text-center py-8 sm:py-10 md:py-12">
          <AlertTriangle className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-yellow-500 mx-auto mb-3 sm:mb-4" />
          <p className="text-gray-600 text-sm sm:text-base mb-1.5 sm:mb-2">Unable to load dashboard data</p>
          {!department && (
            <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
              <p className="text-red-800 font-semibold text-sm sm:text-base">Department Not Assigned</p>
              <p className="text-red-600 text-xs sm:text-sm mt-1">
                Your profile does not have a department assigned. Please contact administrator to assign a department (CSE, TELECALLER, or AUDITOR).
              </p>
            </div>
          )}
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
    <DashboardLayout role="sub_admin">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className={`bg-gradient-to-r ${config.bgGradient} rounded-lg p-4 sm:p-5 md:p-6 text-white shadow-lg`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2 sm:gap-3">
                <DeptIcon className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex-shrink-0" />
                <span className="truncate">{department} Sub Admin Dashboard</span>
              </h1>
              <p className="text-white/90 text-xs sm:text-sm mt-0.5 sm:mt-1">Welcome back, {userProfile?.full_name}</p>
            </div>
            <div className="text-left sm:text-right flex-shrink-0">
              <p className="text-xs sm:text-sm text-white/80">Quality Score</p>
              <p className="text-2xl sm:text-3xl font-bold">{team_overview?.quality_score || 0}</p>
            </div>
          </div>
        </div>

        {/* Alerts Section */}
        {alerts && alerts.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 sm:p-4 rounded">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0" />
                <h3 className="font-semibold text-red-800 text-sm sm:text-base">
                  {alerts.length} Alert{alerts.length > 1 ? 's' : ''} Require Attention
                </h3>
              </div>
              <Link
                href={`/dashboard/sub_admin/${department.toLowerCase()}/alerts`}
                className="text-red-600 hover:text-red-800 font-medium flex items-center gap-1 text-xs sm:text-sm"
              >
                View All <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Total Staff</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{team_overview?.total_staff || 0}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                  {team_overview?.online_staff || 0} online
                </p>
              </div>
              <div className={`bg-${config.color}-100 p-2 sm:p-3 rounded-full flex-shrink-0`}>
                <Users className={`w-5 h-5 sm:w-6 sm:h-6 text-${config.color}-600`} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">SLA Breaches</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-red-600">{team_overview?.sla_breaches || 0}</p>
                <p className="text-[10px] sm:text-xs text-yellow-600 mt-0.5 sm:mt-1">
                  {team_overview?.sla_at_risk || 0} at risk
                </p>
              </div>
              <div className="bg-red-100 p-2 sm:p-3 rounded-full flex-shrink-0">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Pending Escalations</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-600">{team_overview?.pending_escalations || 0}</p>
                <p className="text-[10px] sm:text-xs text-red-600 mt-0.5 sm:mt-1">
                  {team_overview?.urgent_escalations || 0} urgent
                </p>
              </div>
              <div className="bg-orange-100 p-2 sm:p-3 rounded-full flex-shrink-0">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Tasks Assigned Today</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600">{team_overview?.tasks_assigned_today || 0}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">New assignments</p>
              </div>
              <div className="bg-blue-100 p-2 sm:p-3 rounded-full flex-shrink-0">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Widgets Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          {/* Department Metrics Card */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" />
              Department Metrics
            </h2>
            <div className="space-y-2 sm:space-y-3">
              {Object.entries(department_metrics || {}).map(([key, value]: [string, any]) => (
                <div key={key} className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 rounded">
                  <span className="text-xs sm:text-sm font-medium text-gray-700 capitalize truncate">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-base sm:text-lg font-bold text-gray-900 flex-shrink-0 ml-2">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" />
              Quick Actions
            </h2>
            <div className="space-y-1.5 sm:space-y-2">
              <Link
                href="/dashboard/sub_admin/team"
                className="block p-2.5 sm:p-3 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs sm:text-sm">Manage Team</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                </div>
              </Link>
              <Link
                href="/dashboard/sub_admin/leads"
                className="block p-2.5 sm:p-3 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs sm:text-sm">View Leads</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                </div>
              </Link>
              <Link
                href="/dashboard/sub_admin/escalations"
                className="block p-2.5 sm:p-3 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs sm:text-sm">Escalations</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                </div>
              </Link>
              <Link
                href="/dashboard/sub_admin/performance"
                className="block p-2.5 sm:p-3 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs sm:text-sm">Team Performance</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Alerts */}
        {alerts && alerts.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0" />
              Recent Alerts
            </h2>
            <div className="space-y-1.5 sm:space-y-2">
              {alerts.slice(0, 5).map((alert: any, index: number) => (
                <div
                  key={index}
                  className={`p-2.5 sm:p-3 rounded border-l-4 ${
                    alert.severity === 'CRITICAL' || alert.severity === 'URGENT'
                      ? 'border-red-500 bg-red-50'
                      : alert.severity === 'HIGH'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-yellow-500 bg-yellow-50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <span className="font-medium text-xs sm:text-sm">{alert.message}</span>
                    <span className={`text-[10px] sm:text-xs px-2 py-0.5 sm:py-1 rounded flex-shrink-0 ${
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

