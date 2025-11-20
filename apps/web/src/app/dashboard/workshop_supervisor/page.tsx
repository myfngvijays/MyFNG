'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import DashboardMetrics from '@/components/supervisor/DashboardMetrics';
import MechanicPerformancePanel from '@/components/supervisor/MechanicPerformancePanel';
import QuickFilters from '@/components/supervisor/QuickFilters';
import { RefreshCw, CheckCircle, DollarSign, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface DashboardData {
  metrics: {
    totalJobsToday: number;
    assignedJobs: number;
    inProgressJobs: number;
    jobsOnHold: number;
    jobsAwaitingQC: number;
    pendingPickups: number;
    pendingExtraWorkApprovals: number;
    slaAtRiskJobs: number;
  };
  mechanics: Array<{
    id: string;
    name: string;
    profileImage?: string | null;
    activeJobs: number;
    completedToday: number;
    efficiency: number;
  }>;
}

export default function WorkshopSupervisorDashboard() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 30000);

    // Set up real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel('supervisor-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads'
        },
        () => {
          fetchDashboardData(true);
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, []);

  async function fetchDashboardData(isRefresh = false) {
    try {
      if (!isRefresh) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      const response = await fetch('/api/supervisor/dashboard');
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const result = await response.json();

      if (result.success) {
        setDashboardData(result.data);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleMechanicClick(mechanicId: string) {
    // Navigate to jobs list filtered by mechanic
    router.push(`/dashboard/workshop_supervisor/jobs?mechanic_id=${mechanicId}`);
  }

  function handleFilterChange(filter: string) {
    setActiveFilter(filter);
    // Navigate to jobs list with filter
    if (filter) {
      router.push(`/dashboard/workshop_supervisor/jobs?status=${filter}`);
    } else {
      router.push('/dashboard/workshop_supervisor/jobs');
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-text-body">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="card bg-red-50 border-red-200">
          <div className="text-center py-8">
            <p className="text-red-600 font-semibold">Error loading dashboard</p>
            <p className="text-sm text-gray-600 mt-2">{error}</p>
            <button
              onClick={() => fetchDashboardData()}
              className="btn btn-primary mt-4"
            >
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-6 rounded-lg shadow-lg -mx-6 -mt-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg">🔍 Supervisor Dashboard</h1>
              <p className="text-white font-medium mt-1">Monitor operations, manage mechanics, and oversee quality control</p>
            </div>
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="btn bg-white text-blue-700 hover:bg-blue-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Metrics Cards */}
        {dashboardData && (
          <DashboardMetrics 
            metrics={dashboardData.metrics}
            loading={loading}
          />
        )}

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            onClick={() => router.push('/dashboard/workshop_supervisor/qc-queue')}
            className="card bg-gradient-to-br from-green-50 to-green-100 hover:shadow-xl transition-all cursor-pointer border-2 border-green-200 hover:border-green-400"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500 text-white rounded-full">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">QC Queue</h3>
                  <p className="text-sm text-gray-600">
                    {dashboardData?.metrics.jobsAwaitingQC || 0} jobs waiting for quality check
                  </p>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-green-600" />
            </div>
          </div>

          <div 
            onClick={() => router.push('/dashboard/workshop_supervisor/extra-work')}
            className="card bg-gradient-to-br from-orange-50 to-orange-100 hover:shadow-xl transition-all cursor-pointer border-2 border-orange-200 hover:border-orange-400"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500 text-white rounded-full">
                  <DollarSign className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Extra Work Approvals</h3>
                  <p className="text-sm text-gray-600">
                    {dashboardData?.metrics.pendingExtraWorkApprovals || 0} requests pending
                  </p>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Quick Filters */}
        <QuickFilters
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
        />

        {/* Mechanic Performance Panel */}
        {dashboardData && (
          <MechanicPerformancePanel
            mechanics={dashboardData.mechanics}
            onMechanicClick={handleMechanicClick}
            loading={loading}
          />
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/dashboard/workshop_supervisor/jobs')}
            className="card hover:shadow-lg transition-shadow duration-200 cursor-pointer"
          >
            <div className="text-left">
              <h3 className="text-lg font-semibold text-text-heading">View All Jobs</h3>
              <p className="text-sm text-gray-600 mt-1">
                Manage job assignments, view progress, and perform quality control
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/workshop_supervisor/analytics')}
            className="card hover:shadow-lg transition-shadow duration-200 cursor-pointer"
          >
            <div className="text-left">
              <h3 className="text-lg font-semibold text-text-heading">View Analytics</h3>
              <p className="text-sm text-gray-600 mt-1">
                Track performance metrics, KPIs, and team efficiency
              </p>
            </div>
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

