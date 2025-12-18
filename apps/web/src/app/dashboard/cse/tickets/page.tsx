'use client';

import { formatDateDMY, formatTime12h } from "@/lib/utils";
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  FileText, 
  Search,
  Filter,
  Loader2,
  Plus,
  Eye,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

function CSETicketsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || 'all',
    category: searchParams.get('category') || 'all',
    severity: 'all',
    search: '',
  });

  useEffect(() => {
    fetchTickets();
  }, [filters]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const params = new URLSearchParams();
      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.category !== 'all') {
        params.append('category', filters.category);
      }
      if (filters.severity !== 'all') {
        params.append('severity', filters.severity);
      }

      const response = await fetch(`/api/cse/tickets?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        let filteredTickets = data.tickets || [];
        
        // Client-side search filter
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filteredTickets = filteredTickets.filter((ticket: any) => {
            return (
              ticket.ticket_number?.toLowerCase().includes(searchLower) ||
              ticket.title?.toLowerCase().includes(searchLower) ||
              ticket.description?.toLowerCase().includes(searchLower) ||
              ticket.lead?.lead_number?.toLowerCase().includes(searchLower) ||
              ticket.lead?.customer_name?.toLowerCase().includes(searchLower)
            );
          });
        }
        
        setTickets(filteredTickets);
      } else {
        toast.error('Failed to fetch tickets');
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
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
      'ESCALATED': 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      'CRITICAL': 'bg-red-600 text-white',
      'URGENT': 'bg-orange-600 text-white',
      'HIGH': 'bg-yellow-600 text-white',
      'MEDIUM': 'bg-blue-600 text-white',
      'LOW': 'bg-gray-600 text-white',
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  return (
    <DashboardLayout role="customer_service_executive">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
              <FileText className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-indigo-600 flex-shrink-0" />
              <span className="truncate">Support Tickets</span>
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">Manage customer support tickets</p>
          </div>
          <Link
            href="/dashboard/cse/tickets/create"
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs sm:text-sm whitespace-nowrap w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span className="hidden sm:inline">Create Ticket</span>
            <span className="sm:hidden">Create</span>
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end">
            <div className="flex-1 min-w-0">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Search tickets..."
                  className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="w-full sm:min-w-[150px] sm:w-auto">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="OPEN">Open</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
                <option value="ESCALATED">Escalated</option>
              </select>
            </div>
            <div className="w-full sm:min-w-[150px] sm:w-auto">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Categories</option>
                <option value="PICKUP_DELAY">Pickup Delay</option>
                <option value="DROP_DELAY">Drop Delay</option>
                <option value="JOB_PROGRESS_INQUIRY">Job Progress</option>
                <option value="EXTRA_CHARGES_DISPUTE">Extra Charges</option>
                <option value="INVOICE_BILLING_ISSUE">Billing Issue</option>
                <option value="SERVICE_QUALITY_COMPLAINT">Service Quality</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="w-full sm:min-w-[150px] sm:w-auto">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tickets List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <h2 className="text-base sm:text-lg font-semibold">Tickets ({tickets.length})</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48 sm:h-64">
              <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 animate-spin text-indigo-600" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8 sm:py-10 md:py-12">
              <FileText className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-600 text-sm sm:text-base">No tickets found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="overflow-x-auto hidden lg:block">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket #</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-gray-50">
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <div className="text-xs sm:text-sm font-medium text-gray-900">{ticket.ticket_number}</div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          {ticket.lead ? (
                            <div>
                              <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[200px]">{ticket.lead.lead_number}</div>
                              <div className="text-xs sm:text-sm text-gray-500 truncate">{ticket.lead.customer_name}</div>
                            </div>
                          ) : (
                            <span className="text-xs sm:text-sm text-gray-500">N/A</span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <span className="text-xs sm:text-sm text-gray-900">
                            {ticket.issue_category?.replace(/_/g, ' ') || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getSeverityColor(ticket.severity)}`}>
                            {ticket.severity}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                            {ticket.status}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <div className="text-xs sm:text-sm text-gray-900">
                            {formatDateDMY(ticket.created_at)}
                          </div>
                          <div className="text-[10px] sm:text-xs text-gray-500">
                            {formatTime12h(ticket.created_at)}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <Link
                            href={`/dashboard/cse/tickets/${ticket.id}`}
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
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="p-3 sm:p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3 mb-2 sm:mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm sm:text-base font-medium text-gray-900 truncate mb-1">{ticket.ticket_number}</div>
                        {ticket.lead && (
                          <div className="text-xs sm:text-sm text-gray-600 truncate">
                            {ticket.lead.lead_number} - {ticket.lead.customer_name}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className={`inline-flex px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getSeverityColor(ticket.severity)}`}>
                          {ticket.severity}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-1.5 sm:space-y-2 mb-2 sm:mb-3">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-gray-500">Category:</span>
                        <span className="text-gray-900">{ticket.issue_category?.replace(/_/g, ' ') || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-gray-500">Created:</span>
                        <span className="text-gray-900">{formatDateDMY(ticket.created_at)}</span>
                      </div>
                    </div>

                    <Link
                      href={`/dashboard/cse/tickets/${ticket.id}`}
                      className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700"
                    >
                      <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      View Details
                    </Link>
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

export default function CSETicketsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout role="CUSTOMER_SERVICE_EXECUTIVE">
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    }>
      <CSETicketsContent />
    </Suspense>
  );
}
