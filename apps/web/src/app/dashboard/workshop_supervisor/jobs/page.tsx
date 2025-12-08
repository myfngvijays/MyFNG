'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import JobCard from '@/components/supervisor/JobCard';
import JobFilters, { FilterState } from '@/components/supervisor/JobFilters';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Job {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone_masked: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_variant?: string;
  service_type: string;
  service_type_names?: string[];
  service_type_ids?: any[];
  status: string;
  priority: string;
  sla_status: string;
  time_remaining: string | null;
  pickup_required: boolean;
  pickup_status: string | null;
  qc_status: string;
  mechanic: {
    id: string;
    name: string;
    profileImage?: string | null;
  } | null;
  pickup_boy: {
    id: string;
    name: string;
    profileImage?: string | null;
  } | null;
  images: {
    before: boolean;
    progress: boolean;
    after: boolean;
  };
  extra_work_pending: boolean;
  created_at: string;
  updated_at: string;
}

function SupervisorJobsContent() {
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mechanics, setMechanics] = useState<Array<{ id: string; name: string }>>([]);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    status: searchParams.get('status') || '',
    mechanicId: searchParams.get('mechanic_id') || '',
    serviceType: '',
    slaStatus: '',
    search: ''
  });

  useEffect(() => {
    fetchMechanics();
    fetchJobs();

    // Set up real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel('supervisor-jobs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads'
        },
        () => {
          fetchJobs(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_jobs'
        },
        (payload) => {
          // Refresh when mechanic_jobs changes (e.g., mechanic completes, puts on hold)
          console.log('🔄 Mechanic job updated:', payload);
          // Add small delay to ensure database commit is complete
          setTimeout(() => {
            fetchJobs(true);
          }, 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_checklists'
        },
        () => {
          // Refresh when checklist is updated (e.g., mechanic ticks items)
          fetchJobs(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_job_photos'
        },
        () => {
          // Refresh when photos are uploaded
          fetchJobs(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_media'
        },
        () => {
          // Refresh when media is uploaded
          fetchJobs(true);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [page, filters]);

  async function fetchMechanics() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('id', user.id)
        .single();

      if (!userProfile?.workshop_id) return;

      const { data: mechanicsData } = await supabase
        .from('users_login')
        .select(`
          id,
          full_name,
          roles!inner(role_code)
        `)
        .eq('workshop_id', userProfile.workshop_id)
        .eq('roles.role_code', 'WORKSHOP_MECHANIC')
        .eq('is_active', true);

      if (mechanicsData) {
        setMechanics(mechanicsData.map((m: any) => ({ id: m.id, name: m.full_name })));
      }
    } catch (error) {
      console.error('Error fetching mechanics:', error);
    }
  }

  async function fetchJobs(isRefresh = false) {
    try {
      if (!isRefresh) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      // Build query params
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.status && { status: filters.status }),
        ...(filters.mechanicId && { mechanic_id: filters.mechanicId }),
        ...(filters.serviceType && { service_type: filters.serviceType }),
        ...(filters.slaStatus && { sla_status: filters.slaStatus }),
        ...(filters.search && { search: filters.search })
      });

      const response = await fetch(`/api/supervisor/jobs?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }

      const result = await response.json();

      if (result.success) {
        // Debug: Check if any job has ON_HOLD status
        const holdJobs = result.data.jobs.filter((j: any) => j.status === 'ON_HOLD' || j.status === 'HOLD');
        if (holdJobs.length > 0) {
          console.log('📋 Jobs with HOLD status:', holdJobs.map((j: any) => ({ id: j.id, status: j.status })));
        }
        setJobs(result.data.jobs);
        setTotal(result.data.pagination.total);
        setTotalPages(result.data.pagination.totalPages);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Jobs fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleFilterChange(newFilters: FilterState) {
    console.log('Filter changed:', newFilters);
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  }

  function handleQuickAction(action: string, jobId: string) {
    // TODO: Implement quick actions (assign, reassign, approve, QC)
    console.log('Quick action:', action, jobId);
    // For now, just navigate to detail page
    window.location.href = `/dashboard/workshop_supervisor/jobs/${jobId}`;
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading jobs...</p>
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
            <h1 className="text-3xl font-bold text-text-heading">Manage Jobs</h1>
            <p className="text-text-body mt-2">
              Monitor job progress, assign mechanics, and perform quality control
            </p>
          </div>
          <button
            onClick={() => fetchJobs(true)}
            disabled={refreshing}
            className="btn btn-outline flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Bar */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Jobs</p>
              <p className="text-2xl font-bold text-blue-600">{total}</p>
            </div>
            <div className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </div>
          </div>
        </div>

        {/* Filters */}
        <JobFilters
          onFilterChange={handleFilterChange}
          mechanics={mechanics}
        />

        {/* Error State */}
        {error && (
          <div className="card bg-red-50 border-red-200">
            <p className="text-red-600 font-semibold">Error loading jobs</p>
            <p className="text-sm text-gray-600 mt-1">{error}</p>
            <button
              onClick={() => fetchJobs()}
              className="btn btn-primary mt-3"
            >
              Retry
            </button>
          </div>
        )}

        {/* Jobs List */}
        {jobs.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onQuickAction={handleQuickAction}
              />
            ))}
          </div>
        ) : (
          <div className="card text-center py-12">
            <p className="text-gray-500 text-lg">No jobs found</p>
            <p className="text-sm text-gray-400 mt-2">
              Try adjusting your filters or search criteria
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="card">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn btn-outline flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="flex items-center gap-2">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`
                        px-3 py-1 rounded
                        ${page === pageNum 
                          ? 'bg-brand-primary text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }
                      `}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                {totalPages > 5 && <span className="text-gray-500">...</span>}
                {totalPages > 5 && (
                  <button
                    onClick={() => setPage(totalPages)}
                    className={`
                      px-3 py-1 rounded
                      ${page === totalPages 
                        ? 'bg-brand-primary text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }
                    `}
                  >
                    {totalPages}
                  </button>
                )}
              </div>

              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="btn btn-outline flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function SupervisorJobsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading jobs...</p>
        </div>
      </div>
    }>
      <SupervisorJobsContent />
    </Suspense>
  );
}

