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
  TrendingUp,
  Search,
  Filter,
  Loader2,
  ArrowRight,
  RefreshCw,
  Calendar,
  FileText,
  Building2
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function AuditorDashboard() {
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
      setAudits(data.audits || []);
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
      'IN_PROGRESS': 'bg-purple-100 text-purple-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'FAILED': 'bg-red-100 text-red-800',
      'FOLLOW_UP_REQUIRED': 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSLAColor = (slaStatus: string) => {
    const colors: Record<string, string> = {
      'ON_TIME': 'text-green-600',
      'AT_RISK': 'text-yellow-600',
      'BREACHED': 'text-red-600',
    };
    return colors[slaStatus] || 'text-gray-600';
  };

  return (
    <DashboardLayout role="auditor">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-800 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Shield className="w-8 h-8" />
                Auditor Dashboard
              </h1>
              <p className="text-white/90 mt-1">Workshop Verification & Audit Scoring</p>
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Audits</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-3xl font-bold text-purple-600">{stats.in_progress}</p>
              </div>
              <FileText className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">SLA At Risk</p>
                <p className="text-3xl font-bold text-orange-600">{stats.sla_at_risk}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">SLA Breached</p>
                <p className="text-3xl font-bold text-red-600">{stats.sla_breached}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
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
                  placeholder="Search audits..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Types</option>
              <option value="JOB_CARD">Job Card Audit</option>
              <option value="WORKSHOP_FACILITY">Workshop Facility</option>
              <option value="SURPRISE">Surprise Audit</option>
            </select>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Alerts Section */}
        {(stats.sla_at_risk > 0 || stats.sla_breached > 0) && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">SLA Alerts</p>
                <p className="text-sm text-red-700">
                  {stats.sla_breached} audits breached SLA, {stats.sla_at_risk} at risk
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Audits List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Assigned Audits</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : audits.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No audits assigned</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workshop</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SLA</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {audits.map((audit) => (
                      <tr key={audit.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {audit.type === 'JOB_CARD' ? (
                              <FileText className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Building2 className="w-5 h-5 text-purple-600" />
                            )}
                            <span className="text-sm font-medium text-gray-900">
                              {audit.type === 'JOB_CARD' ? 'Job Card' : 'Workshop'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {audit.audit_type || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {audit.type === 'JOB_CARD' && audit.lead ? (
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {audit.lead.lead_number || audit.lead.id.slice(0, 8)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {audit.lead.customer_name || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-400">
                                {audit.lead.vehicle_number || ''}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-900">
                              {audit.workshop?.name || 'N/A'}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            {audit.audit_mode === 'ON_GROUND' ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                On-Ground
                              </span>
                            ) : (
                              'Digital'
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {audit.workshop ? (
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {audit.workshop.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {audit.workshop.city || ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(audit.status)}`}>
                            {audit.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {audit.sla_status && (
                            <div className={`text-sm font-medium ${getSLAColor(audit.sla_status)}`}>
                              {audit.sla_status}
                            </div>
                          )}
                          {audit.sla_deadline && (
                            <div className="text-xs text-gray-500">
                              {new Date(audit.sla_deadline).toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {audit.score !== undefined ? (
                            <div className="text-sm font-medium text-gray-900">
                              {audit.score}/5
                            </div>
                          ) : audit.score_percentage !== undefined ? (
                            <div className="text-sm font-medium text-gray-900">
                              {audit.score_percentage}%
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                          {audit.audit_grade && (
                            <div className="text-xs text-gray-500">
                              Grade: {audit.audit_grade}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            href={`/dashboard/auditor/audits/${audit.id}`}
                            className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1"
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
