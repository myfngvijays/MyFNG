'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  AlertTriangle, 
  Search,
  Filter,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Flag,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function AuditorEscalationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [stats, setStats] = useState({
    open: 0,
    in_progress: 0,
    resolved: 0,
    critical: 0,
  });
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    type: 'all',
    search: '',
  });

  useEffect(() => {
    fetchEscalations();
  }, [filters]);

  const fetchEscalations = async () => {
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
      if (filters.priority !== 'all') {
        params.append('priority', filters.priority);
      }
      if (filters.type !== 'all') {
        params.append('type', filters.type);
      }

      const response = await fetch(`/api/auditor/escalations?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch escalations');
      }

      const data = await response.json();
      
      // Filter by search term if provided
      let filteredEscalations = data.escalations || [];
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredEscalations = filteredEscalations.filter((esc: any) => {
          return (
            esc.escalation_number?.toLowerCase().includes(searchLower) ||
            esc.lead?.lead_number?.toLowerCase().includes(searchLower) ||
            esc.reason?.toLowerCase().includes(searchLower) ||
            esc.description?.toLowerCase().includes(searchLower)
          );
        });
      }
      
      setEscalations(filteredEscalations);
      setStats(data.stats || {
        open: 0,
        in_progress: 0,
        resolved: 0,
        critical: 0,
      });
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching escalations:', error);
      toast.error('Failed to load escalations');
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'OPEN': 'bg-red-100 text-red-800',
      'ACKNOWLEDGED': 'bg-yellow-100 text-yellow-800',
      'IN_PROGRESS': 'bg-blue-100 text-blue-800',
      'RESOLVED': 'bg-green-100 text-green-800',
      'CLOSED': 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'CRITICAL': 'bg-red-600 text-white',
      'URGENT': 'bg-orange-600 text-white',
      'HIGH': 'bg-yellow-600 text-white',
      'MEDIUM': 'bg-blue-600 text-white',
      'LOW': 'bg-gray-600 text-white',
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  return (
    <DashboardLayout role="auditor">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
            <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-red-600 flex-shrink-0" />
            <span>Escalations</span>
          </h1>
          <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">Manage audit-related escalations and issues</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Open</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.open}</p>
              </div>
              <XCircle className="w-7 h-7 sm:w-8 sm:h-8 text-red-500 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">In Progress</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.in_progress}</p>
              </div>
              <Clock className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Resolved</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.resolved}</p>
              </div>
              <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-green-500 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow border-l-4 border-red-600 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Critical</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.critical}</p>
              </div>
              <Flag className="w-7 h-7 sm:w-8 sm:h-8 text-red-600 flex-shrink-0" />
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
                  placeholder="Search escalations..."
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
                <option value="OPEN">Open</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
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
                <option value="CUSTOMER">Customer</option>
                <option value="WORKSHOP">Workshop</option>
                <option value="TEAM_MEMBER">Team Member</option>
                <option value="SLA_BREACH">SLA Breach</option>
              </select>
            </div>
          </div>
        </div>

        {/* Escalations List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <h2 className="text-base sm:text-lg font-semibold">My Escalations</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48 sm:h-64">
              <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-indigo-600" />
            </div>
          ) : escalations.length === 0 ? (
            <div className="text-center py-8 sm:py-10 md:py-12">
              <AlertTriangle className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-600 text-sm sm:text-base">No escalations found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Escalation #</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {escalations.map((escalation) => (
                      <tr key={escalation.id} className="hover:bg-gray-50">
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <div className="text-xs sm:text-sm font-medium text-gray-900">
                            {escalation.escalation_number || `ESC-${escalation.id.slice(0, 8)}`}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          {escalation.lead ? (
                            <div>
                              <div className="text-xs sm:text-sm font-medium text-gray-900">
                                {escalation.lead.lead_number}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-500">
                                {escalation.lead.customer_name} • {escalation.lead.vehicle_number}
                              </div>
                              {escalation.lead.workshop && (
                                <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">
                                  {escalation.lead.workshop.name}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs sm:text-sm text-gray-500">N/A</span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <span className="text-xs sm:text-sm text-gray-900">
                            {escalation.escalation_type?.replace('_', ' ') || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getPriorityColor(escalation.priority)}`}>
                            {escalation.priority}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getStatusColor(escalation.status)}`}>
                            {escalation.status}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="text-xs sm:text-sm text-gray-900 max-w-xs truncate">
                            {escalation.reason || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <div className="text-xs sm:text-sm text-gray-900">
                            {new Date(escalation.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-[10px] sm:text-xs text-gray-500">
                            {new Date(escalation.created_at).toLocaleTimeString()}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          {escalation.audit_id && (
                            <Link
                              href={`/dashboard/auditor/audits/${escalation.audit_id}`}
                              className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700"
                            >
                              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              View Audit
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-200">
                {escalations.map((escalation) => (
                  <div key={escalation.id} className="p-4 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {escalation.escalation_number || `ESC-${escalation.id.slice(0, 8)}`}
                        </div>
                        {escalation.lead && (
                          <div className="text-xs text-gray-500 truncate">
                            {escalation.lead.lead_number} • {escalation.lead.customer_name}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${getPriorityColor(escalation.priority)}`}>
                          {escalation.priority}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${getStatusColor(escalation.status)}`}>
                          {escalation.status}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs sm:text-sm mb-3">
                      <div>
                        <span className="text-gray-500">Type: </span>
                        <span className="text-gray-900">{escalation.escalation_type?.replace('_', ' ') || 'N/A'}</span>
                      </div>
                      {escalation.reason && (
                        <div>
                          <span className="text-gray-500">Reason: </span>
                          <span className="text-gray-900">{escalation.reason}</span>
                        </div>
                      )}
                      {escalation.lead?.workshop && (
                        <div>
                          <span className="text-gray-500">Workshop: </span>
                          <span className="text-gray-900">{escalation.lead.workshop.name}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Created: </span>
                        <span className="text-gray-900">
                          {new Date(escalation.created_at).toLocaleDateString()} {new Date(escalation.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    {escalation.audit_id && (
                      <Link
                        href={`/dashboard/auditor/audits/${escalation.audit_id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700"
                      >
                        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        View Audit
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

