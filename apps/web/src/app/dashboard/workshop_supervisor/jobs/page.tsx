'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
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
  const [pvCounts, setPvCounts] = useState<Record<string, { required_uploaded: number; required_total: number }>>({});
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
        const nextJobs = result.data.jobs as Job[];
        setJobs(nextJobs);
        setTotal(result.data.pagination.total);
        setTotalPages(result.data.pagination.totalPages);

        // Fetch Pickup/Visit (PV) image completion using service-role backed API (schema + RLS tolerant)
        try {
          const leadIds = (nextJobs || []).map((j: any) => String(j?.id || '').trim()).filter(Boolean);
          if (leadIds.length > 0) {
            const pvRes = await fetch('/api/leads/media-counts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lead_ids: leadIds }),
            });
            const pvJson = await pvRes.json().catch(() => ({}));
            if (pvRes.ok && (pvJson as any)?.success) {
              setPvCounts(((pvJson as any)?.counts || {}) as any);
            } else {
              // keep existing pvCounts; non-blocking
            }
          } else {
            setPvCounts({});
          }
        } catch {
          // ignore
        }
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
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-3 sm:mt-4 text-gray-600 text-xs sm:text-sm md:text-base">Loading jobs...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading">Manage Jobs</h1>
            <p className="text-text-body mt-1 sm:mt-2 text-xs sm:text-sm md:text-base">
              Monitor job progress, assign mechanics, and perform quality control
            </p>
          </div>
          <button
            onClick={() => fetchJobs(true)}
            disabled={refreshing}
            className="btn btn-outline flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
            <span className="sm:hidden">Refresh</span>
          </button>
        </div>

        {/* Stats Bar */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
            <div>
              <p className="text-xs sm:text-sm text-gray-600">Total Jobs</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600">{total}</p>
            </div>
            <div className="text-xs sm:text-sm text-gray-600">
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
          <div className="card bg-red-50 border-red-200 p-3 sm:p-4">
            <p className="text-red-600 font-semibold text-xs sm:text-sm md:text-base">Error loading jobs</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">{error}</p>
            <button
              onClick={() => fetchJobs()}
              className="btn btn-primary mt-2 sm:mt-3 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* Jobs Table */}
        {jobs.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead #</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mechanic</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Images</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLA</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobs.map((job) => {
                    const getStatusColor = () => {
                      switch (job.status) {
                        case 'NEW': return 'bg-blue-100 text-blue-700';
                        case 'INCOMPLETE': return 'bg-yellow-100 text-yellow-700';
                        case 'VALIDATED': return 'bg-cyan-100 text-cyan-700';
                        case 'ASSIGNED_TO_WORKSHOP': return 'bg-purple-100 text-purple-700';
                        case 'ACCEPTED': return 'bg-indigo-100 text-indigo-700';
                        case 'IN_PROGRESS': return 'bg-green-100 text-green-700';
                        case 'HOLD':
                        case 'ON_HOLD': return 'bg-orange-100 text-orange-700';
                        case 'COMPLETED':
                        case 'WORK_COMPLETED': return 'bg-teal-100 text-teal-700';
                        case 'QC_PENDING': return 'bg-purple-100 text-purple-700';
                        case 'READY_FOR_DELIVERY': return 'bg-emerald-100 text-emerald-700';
                        case 'DELIVERED': return 'bg-lime-100 text-lime-700';
                        case 'CANCELLED': return 'bg-red-100 text-red-700';
                        case 'REJECTED': return 'bg-rose-100 text-rose-700';
                        default: return 'bg-gray-100 text-gray-700';
                      }
                    };

                    const getPriorityBadge = () => {
                      const colors = {
                        LOW: 'bg-gray-100 text-gray-600',
                        MEDIUM: 'bg-blue-100 text-blue-600',
                        HIGH: 'bg-orange-100 text-orange-600',
                        URGENT: 'bg-red-100 text-red-600'
                      };
                      return colors[job.priority as keyof typeof colors] || colors.MEDIUM;
                    };

                    const getSLAColor = () => {
                      switch (job.sla_status) {
                        case 'ON_TIME': return 'bg-green-100 text-green-700';
                        case 'AT_RISK': return 'bg-yellow-100 text-yellow-700';
                        case 'BREACHED': return 'bg-red-100 text-red-700';
                        default: return 'bg-gray-100 text-gray-700';
                      }
                    };

                    const getStatusDisplay = () => {
                      if (job.status === 'ON_HOLD') return 'HOLD';
                      return job.status.replace(/_/g, ' ');
                    };

                    return (
                      <tr key={job.id} className="hover:bg-gray-50">
                        {/* Lead Number */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs sm:text-sm font-medium text-gray-900">#{job.lead_number}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold w-fit ${getPriorityBadge()}`}>
                              {job.priority}
                            </span>
                          </div>
                        </td>

                        {/* Service */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="text-xs sm:text-sm text-gray-900 truncate max-w-[150px]">
                            {job.service_type}
                          </div>
                          {job.extra_work_pending && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-semibold">
                              Extra Work
                            </span>
                          )}
                        </td>

                        {/* Customer */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div>
                            <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[120px]">
                              {job.customer_name}
                            </div>
                            <div className="text-[10px] sm:text-xs text-gray-500 truncate">
                              {job.customer_phone_masked}
                            </div>
                          </div>
                        </td>

                        {/* Vehicle */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div>
                            <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[120px]">
                              {job.vehicle_number}
                            </div>
                            <div className="text-[10px] sm:text-xs text-gray-500 truncate">
                              {job.vehicle_make} {job.vehicle_model}
                            </div>
                            {job.pickup_required && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-semibold">
                                🚗 Pickup
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold w-fit ${getStatusColor()}`}>
                              {getStatusDisplay()}
                            </span>
                            {job.qc_status === 'PENDING' && (job.status === 'COMPLETED' || job.status === 'QC_PENDING' || job.status === 'WORK_COMPLETED') && (
                              <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded w-fit">
                                QC Required
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Mechanic */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          {job.mechanic ? (
                            <div className="text-xs sm:text-sm text-gray-900 truncate max-w-[120px]">
                              {job.mechanic.name}
                            </div>
                          ) : (
                            <span className="text-xs text-orange-600 font-medium">Not Assigned</span>
                          )}
                          {job.pickup_boy && (
                            <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                              Pickup: {job.pickup_boy.name}
                            </div>
                          )}
                        </td>

                        {/* Images */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-0.5">
                              {(() => {
                                const c = pvCounts[String(job.id || '').trim()];
                                const ok = c ? Number(c.required_uploaded || 0) >= Number(c.required_total || 6) : false;
                                // Fallback to old "before" flag if counts not available
                                const done = c ? ok : Boolean(job.images.before);
                                return done ? (
                                <span className="text-green-600 text-xs">✓</span>
                              ) : (
                                <span className="text-gray-300 text-xs">✗</span>
                                );
                              })()}
                              <span className="text-[10px] text-gray-600">PV</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              {job.images.progress ? (
                                <span className="text-green-600 text-xs">✓</span>
                              ) : (
                                <span className="text-gray-300 text-xs">✗</span>
                              )}
                              <span className="text-[10px] text-gray-600">P</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              {job.images.after ? (
                                <span className="text-green-600 text-xs">✓</span>
                              ) : (
                                <span className="text-gray-300 text-xs">✗</span>
                              )}
                              <span className="text-[10px] text-gray-600">A</span>
                            </div>
                          </div>
                        </td>

                        {/* SLA */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          {job.time_remaining ? (
                            <div className={`text-[10px] sm:text-xs px-2 py-0.5 rounded font-semibold w-fit ${getSLAColor()}`}>
                              {job.time_remaining}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">N/A</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => window.location.href = `/dashboard/workshop_supervisor/jobs/${job.id}`}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded font-medium transition-colors"
                            >
                              View
                            </button>
                            {!job.mechanic && job.status === 'ASSIGNED' && (
                              <button
                                onClick={() => handleQuickAction('assign', job.id)}
                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded font-medium transition-colors"
                              >
                                Assign
                              </button>
                            )}
                            {job.mechanic && job.status !== 'COMPLETED' && job.status !== 'WORK_COMPLETED' && job.status !== 'DELIVERED' && job.status !== 'CLOSED' && (
                              <button
                                onClick={() => handleQuickAction('reassign', job.id)}
                                className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded font-medium transition-colors"
                              >
                                Reassign
                              </button>
                            )}
                            {(job.status === 'COMPLETED' || job.status === 'WORK_COMPLETED' || job.status === 'QC_PENDING') && job.qc_status === 'PENDING' && (
                              <button
                                onClick={() => window.location.href = `/dashboard/workshop_supervisor/jobs/${job.id}/review`}
                                className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded font-medium transition-colors"
                              >
                                QC Review
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card text-center py-8 sm:py-10 md:py-12">
            <p className="text-gray-500 text-base sm:text-lg md:text-xl">No jobs found</p>
            <p className="text-xs sm:text-sm text-gray-400 mt-1.5 sm:mt-2">
              Try adjusting your filters or search criteria
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="card p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn btn-outline flex items-center gap-1.5 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </button>

              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`
                        px-2.5 sm:px-3 py-1 rounded text-xs sm:text-sm
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
                {totalPages > 5 && <span className="text-gray-500 text-xs sm:text-sm">...</span>}
                {totalPages > 5 && (
                  <button
                    onClick={() => setPage(totalPages)}
                    className={`
                      px-2.5 sm:px-3 py-1 rounded text-xs sm:text-sm
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
                className="btn btn-outline flex items-center gap-1.5 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto"
              >
                <span className="hidden sm:inline">Next</span>
                <span className="sm:hidden">Next</span>
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
          <div className="animate-spin rounded-full h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-3 sm:mt-4 text-gray-600 text-xs sm:text-sm md:text-base">Loading jobs...</p>
        </div>
      </div>
    }>
      <SupervisorJobsContent />
    </Suspense>
  );
}

