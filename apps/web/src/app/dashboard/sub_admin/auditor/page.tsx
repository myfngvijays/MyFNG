'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { formatDateDMY } from "@/lib/utils";
import { 
  Shield, 
  AlertTriangle, 
  Clock, 
  CheckCircle,
  XCircle,
  Search,
  Loader2,
  ArrowRight,
  RefreshCw,
  Calendar,
  FileCheck
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function AuditorSubAdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [audits, setAudits] = useState<any[]>([]);
  const [stats, setStats] = useState({
    audits_scheduled: 0,
    audits_completed: 0,
    failed_audits: 0,
    pending_approvals: 0,
  });
  const [filters, setFilters] = useState({
    status: 'all',
    audit_type: 'all',
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
      if (filters.audit_type !== 'all') {
        params.append('audit_type', filters.audit_type);
      }
      if (filters.search) {
        params.append('search', filters.search);
      }
      params.append('page', page.toString());
      params.append('limit', '20');

      const response = await fetch(`/api/subadmin/auditor/audits?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch audits');
      }

      const data = await response.json();
      setAudits(data.audits || []);
      setTotalPages(data.pagination?.total_pages || 1);

      // Calculate stats
      const scheduled = data.audits?.filter((a: any) => a.audit_status === 'SCHEDULED').length || 0;
      const completed = data.audits?.filter((a: any) => a.audit_status === 'COMPLETED').length || 0;
      const failed = data.audits?.filter((a: any) => ['D', 'F'].includes(a.audit_grade)).length || 0;
      const pendingApproval = data.audits?.filter((a: any) => a.audit_status === 'COMPLETED' && !a.approved_by).length || 0;

      setStats({
        audits_scheduled: scheduled,
        audits_completed: completed,
        failed_audits: failed,
        pending_approvals: pendingApproval,
      });

      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching audits:', error);
      toast.error('Failed to load audits');
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'SCHEDULED': 'bg-blue-100 text-blue-800',
      'IN_PROGRESS': 'bg-yellow-100 text-yellow-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'CANCELLED': 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getGradeColor = (grade: string) => {
    const colors: Record<string, string> = {
      'A': 'bg-green-100 text-green-800',
      'B': 'bg-blue-100 text-blue-800',
      'C': 'bg-yellow-100 text-yellow-800',
      'D': 'bg-orange-100 text-orange-800',
      'F': 'bg-red-100 text-red-800',
    };
    return colors[grade] || 'bg-gray-100 text-gray-800';
  };

  return (
    <DashboardLayout role="sub_admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Shield className="w-8 h-8" />
                Auditor Manager Dashboard
              </h1>
              <p className="text-white/90 mt-1">Workshop Audit Management</p>
            </div>
            <button
              onClick={fetchAudits}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Scheduled</p>
                <p className="text-3xl font-bold text-blue-600">{stats.audits_scheduled}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-green-600">{stats.audits_completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-3xl font-bold text-red-600">{stats.failed_audits}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Lead Approval</p>
                <p className="text-3xl font-bold text-orange-600">{stats.pending_approvals}</p>
              </div>
              <FileCheck className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search workshops..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Status</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select
              value={filters.audit_type}
              onChange={(e) => setFilters({ ...filters, audit_type: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Types</option>
              <option value="RANDOM">Random</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="COMPLAINT_BASED">Complaint Based</option>
            </select>
          </div>
        </div>

        {/* Audits Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Audits</h2>
            <Link
              href="/dashboard/sub_admin/auditor/audits/schedule"
              className="btn btn-outline btn-sm flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Schedule Audit
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : audits.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No audits found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Workshop
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Grade
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Auditor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Scheduled Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {audits.map((audit) => (
                      <tr key={audit.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {audit.workshop?.name || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {audit.workshop?.city || ''}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {audit.audit_type || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(audit.audit_status)}`}>
                            {audit.audit_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {audit.audit_grade ? (
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getGradeColor(audit.audit_grade)}`}>
                              {audit.audit_grade}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {audit.score_percentage ? `${audit.score_percentage}%` : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {audit.auditor?.full_name || 'Unassigned'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {audit.scheduled_date 
                            ? formatDateDMY(audit.scheduled_date)
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            href={`/dashboard/sub_admin/auditor/audits/${audit.id}`}
                            className="text-purple-600 hover:text-purple-900 flex items-center gap-1"
                          >
                            View <ArrowRight className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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

