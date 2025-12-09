'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  AlertTriangle, 
  Search,
  Loader2,
  ArrowRight,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function SubAdminEscalationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchEscalations();
  }, [filters, page]);

  const fetchEscalations = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.priority !== 'all') {
        params.append('priority', filters.priority);
      }
      if (filters.search) {
        params.append('search', filters.search);
      }
      params.append('page', page.toString());
      params.append('limit', '20');

      const response = await fetch(`/api/subadmin/escalate?${params.toString()}`);
      
      // Check content-type before parsing JSON
      const contentType = response.headers.get('content-type');
      let data: any = null;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // If not JSON, get text response
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch escalations');
      }

      setEscalations(data.escalations || []);
      setTotalPages(data.pagination?.total_pages || 1);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching escalations:', error);
      toast.error(error.message || 'Failed to load escalations');
      setLoading(false);
    }
  };

  const handleEscalationAction = async (escalationId: string, action: string, data?: any) => {
    try {
      const response = await fetch('/api/subadmin/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          escalation_id: escalationId,
          ...data,
        }),
      });

      // Check content-type before parsing JSON
      const contentType = response.headers.get('content-type');
      let errorData: any = null;
      
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        // If not JSON, get text response
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(errorData.error || 'Failed to process escalation');
      }

      toast.success(`Escalation ${action.toLowerCase()}d successfully`);
      fetchEscalations();
    } catch (error: any) {
      console.error('Error processing escalation:', error);
      toast.error(error.message || 'Failed to process escalation');
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'LOW': 'bg-gray-100 text-gray-800',
      'MEDIUM': 'bg-yellow-100 text-yellow-800',
      'HIGH': 'bg-orange-100 text-orange-800',
      'URGENT': 'bg-red-100 text-red-800',
      'CRITICAL': 'bg-red-200 text-red-900',
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
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

  return (
    <DashboardLayout role="sub_admin">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0" />
                <span>Escalations</span>
              </h1>
              <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">Manage and resolve escalations</p>
            </div>
            <button
              onClick={fetchEscalations}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="relative">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  placeholder="Search escalations..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Status</option>
              <option value="OPEN">Open</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
            </select>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>

        {/* Escalations List */}
        <div className="space-y-3 sm:space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-48 sm:h-64">
              <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-red-600" />
            </div>
          ) : escalations.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 sm:p-10 md:p-12 text-center">
              <CheckCircle className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-green-500 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-600 text-sm sm:text-base">No escalations found</p>
            </div>
          ) : (
            escalations.map((escalation) => (
              <div
                key={escalation.id}
                className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 border-l-4 border-red-500"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="text-base sm:text-lg font-semibold">{escalation.escalation_number || escalation.id.slice(0, 8)}</h3>
                      <span className={`px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getPriorityColor(escalation.priority)}`}>
                        {escalation.priority}
                      </span>
                      <span className={`px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getStatusColor(escalation.status)}`}>
                        {escalation.status}
                      </span>
                    </div>
                    <p className="text-sm sm:text-base text-gray-700 mb-2">{escalation.escalation_reason}</p>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                      <span>Type: {escalation.escalation_type}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>Created: {new Date(escalation.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto">
                    {escalation.status === 'OPEN' && (
                      <button
                        onClick={() => handleEscalationAction(escalation.id, 'ACKNOWLEDGE')}
                        className="btn btn-outline btn-sm text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex-1 sm:flex-none"
                      >
                        Acknowledge
                      </button>
                    )}
                    {escalation.status !== 'RESOLVED' && escalation.status !== 'CLOSED' && (
                      <button
                        onClick={() => {
                          const notes = prompt('Enter resolution notes:');
                          if (notes) {
                            handleEscalationAction(escalation.id, 'RESOLVE', { resolution_notes: notes });
                          }
                        }}
                        className="btn btn-primary btn-sm text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex-1 sm:flex-none"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-gray-700">Page {page} of {totalPages}</div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

