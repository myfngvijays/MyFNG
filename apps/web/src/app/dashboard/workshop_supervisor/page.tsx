'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import DashboardMetrics from '@/components/supervisor/DashboardMetrics';
import MechanicPerformancePanel from '@/components/supervisor/MechanicPerformancePanel';
import QuickFilters from '@/components/supervisor/QuickFilters';
import { RefreshCw } from 'lucide-react';
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-heading">Supervisor Dashboard</h1>
            <p className="text-text-body mt-2">Monitor operations, manage mechanics, and oversee quality control</p>
          </div>
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="btn btn-outline flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Metrics Cards */}
        {dashboardData && (
          <DashboardMetrics 
            metrics={dashboardData.metrics}
            loading={loading}
          />
        )}

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

