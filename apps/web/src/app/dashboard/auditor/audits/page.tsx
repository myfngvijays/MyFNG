'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  Shield, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  MapPin,
  Search,
  Filter,
  Loader2,
  ArrowRight,
  RefreshCw,
  Calendar,
  FileText,
  Building2,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function AuditorAuditsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [audits, setAudits] = useState<any[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    in_progress: 0,
    completed: 0,
    sla_at_risk: 0,
    sla_breached: 0,
  });
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    date: '',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchAudits();
  }, [filters, page]);

  const fetchAudits = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Build query params
      const params = new URLSearchParams();
      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.type !== 'all') {
        params.append('type', filters.type);
      }
      if (filters.date) {
        params.append('date', filters.date);
      }
      params.append('page', page.toString());
      params.append('limit', '20');

      const response = await fetch(`/api/auditor/audits?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch audits');
      }

      const data = await response.json();
      
      // Filter by search term if provided
      let filteredAudits = data.audits || [];
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredAudits = filteredAudits.filter((audit: any) => {
          return (
            audit.lead?.lead_number?.toLowerCase().includes(searchLower) ||
            audit.lead?.customer_name?.toLowerCase().includes(searchLower) ||
            audit.lead?.vehicle_number?.toLowerCase().includes(searchLower) ||
            audit.workshop?.name?.toLowerCase().includes(searchLower)
          );
        });
      }
      
      setAudits(filteredAudits);
      setStats(data.stats || {
        pending: 0,
        in_progress: 0,
        completed: 0,
        sla_at_risk: 0,
        sla_breached: 0,
      });
      setTotalPages(data.pagination?.total_pages || 1);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching audits:', error);
      toast.error('Failed to load audits');
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'SCHEDULED': 'bg-blue-100 text-blue-800',
      'IN_PROGRESS': 'bg-indigo-100 text-indigo-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'CANCELLED': 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSLAColor = (slaStatus?: string) => {
    if (!slaStatus) return 'bg-gray-100 text-gray-800';
    const colors: Record<string, string> = {
      'ON_TIME': 'bg-green-100 text-green-800',
      'AT_RISK': 'bg-yellow-100 text-yellow-800',
      'BREACHED': 'bg-red-100 text-red-800',
    };
    return colors[slaStatus] || 'bg-gray-100 text-gray-800';
  };

  return (
    <DashboardLayout role="auditor">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
              <Shield className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-indigo-600 flex-shrink-0" />
              <span>My Audits</span>
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">View and manage all your assigned audits</p>
          </div>
          <button
            onClick={fetchAudits}
            className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs sm:text-sm w-full sm:w-auto"
          >
            <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Pending</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.pending}</p>
              </div>
              <Clock className="w-7 h-7 sm:w-8 sm:h-8 text-yellow-500 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow border-l-4 border-indigo-500">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">In Progress</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.in_progress}</p>
              </div>
              <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-500 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Completed</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.completed}</p>
              </div>
              <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-green-500 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">SLA At Risk</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.sla_at_risk}</p>
              </div>
              <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 text-yellow-500 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow border-l-4 border-red-500 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">SLA Breached</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.sla_breached}</p>
              </div>
              <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 text-red-500 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Search audits..."
                  className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Types</option>
                <option value="JOB_CARD">Job Card Audit</option>
                <option value="WORKSHOP_FACILITY">Workshop Facility</option>
                <option value="SURPRISE">Surprise Audit</option>
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Audits List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <h2 className="text-base sm:text-lg font-semibold">All Audits</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48 sm:h-64">
              <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-indigo-600" />
            </div>
          ) : audits.length === 0 ? (
            <div className="text-center py-8 sm:py-10 md:py-12">
              <Shield className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-600 text-sm sm:text-base">No audits found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Workshop</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">SLA</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {audits.map((audit) => (
                      <tr key={audit.id} className="hover:bg-gray-50">
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            {audit.type === 'JOB_CARD' ? (
                              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                            ) : (
                              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 flex-shrink-0" />
                            )}
                            <span className="text-xs sm:text-sm font-medium text-gray-900">
                              {audit.type === 'JOB_CARD' ? 'Job Card' : 'Workshop'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          {audit.type === 'JOB_CARD' && audit.lead ? (
                            <div>
                              <div className="text-xs sm:text-sm font-medium text-gray-900">
                                {audit.lead.lead_number || 'N/A'}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-500">
                                {audit.lead.customer_name} • {audit.lead.vehicle_number}
                              </div>
                            </div>
                          ) : audit.workshop ? (
                            <div>
                              <div className="text-xs sm:text-sm font-medium text-gray-900">
                                {audit.workshop.name}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-500 flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                                {audit.workshop.city || 'N/A'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs sm:text-sm text-gray-500">N/A</span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          {audit.workshop ? (
                            <div>
                              <div className="text-xs sm:text-sm font-medium text-gray-900">
                                {audit.workshop.name}
                              </div>
                              {audit.workshop.audit_score && (
                                <div className="text-[10px] sm:text-xs text-gray-500">
                                  Score: {audit.workshop.audit_score.toFixed(1)}/5
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs sm:text-sm text-gray-500">N/A</span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getStatusColor(audit.status)}`}>
                            {audit.status || 'PENDING'}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          {audit.sla_status ? (
                            <span className={`inline-flex px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getSLAColor(audit.sla_status)}`}>
                              {audit.sla_status}
                            </span>
                          ) : (
                            <span className="text-xs sm:text-sm text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          {audit.score || audit.score_percentage ? (
                            <div className="text-xs sm:text-sm font-medium text-gray-900">
                              {audit.score_percentage ? `${audit.score_percentage.toFixed(1)}%` : `${audit.score}/100`}
                            </div>
                          ) : (
                            <span className="text-xs sm:text-sm text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <Link
                            href={`/dashboard/auditor/audits/${audit.id}`}
                            className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700"
                          >
                            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-200">
                {audits.map((audit) => (
                  <div key={audit.id} className="p-4 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {audit.type === 'JOB_CARD' ? (
                          <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        ) : (
                          <Building2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {audit.type === 'JOB_CARD' ? 'Job Card' : 'Workshop'} Audit
                          </div>
                          {audit.type === 'JOB_CARD' && audit.lead ? (
                            <div className="text-xs text-gray-500 truncate">{audit.lead.lead_number || 'N/A'}</div>
                          ) : audit.workshop ? (
                            <div className="text-xs text-gray-500 truncate">{audit.workshop.name}</div>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${getStatusColor(audit.status)}`}>
                          {audit.status || 'PENDING'}
                        </span>
                        {audit.sla_status && (
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${getSLAColor(audit.sla_status)}`}>
                            {audit.sla_status}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs sm:text-sm mb-3">
                      {audit.type === 'JOB_CARD' && audit.lead && (
                        <>
                          <div>
                            <span className="text-gray-500">Customer: </span>
                            <span className="text-gray-900">{audit.lead.customer_name}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Vehicle: </span>
                            <span className="text-gray-900">{audit.lead.vehicle_number}</span>
                          </div>
                        </>
                      )}
                      {audit.workshop && (
                        <div>
                          <span className="text-gray-500">Workshop: </span>
                          <span className="text-gray-900 truncate">{audit.workshop.name}</span>
                          {audit.workshop.city && (
                            <span className="text-gray-500">, {audit.workshop.city}</span>
                          )}
                        </div>
                      )}
                      {(audit.score || audit.score_percentage) && (
                        <div>
                          <span className="text-gray-500">Score: </span>
                          <span className="font-medium text-gray-900">
                            {audit.score_percentage ? `${audit.score_percentage.toFixed(1)}%` : `${audit.score}/100`}
                          </span>
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/dashboard/auditor/audits/${audit.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700"
                    >
                      <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      View Details
                    </Link>
                  </div>
                ))}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs sm:text-sm text-gray-700">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

