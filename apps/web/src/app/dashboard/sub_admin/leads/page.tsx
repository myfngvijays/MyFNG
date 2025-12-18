'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { formatDateDMY } from '@/lib/utils';
import {
  FileText,
  Search,
  Filter,
  Loader2,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function SubAdminLeadsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<any[]>([]);
  const [department, setDepartment] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchDepartment();
  }, []);

  useEffect(() => {
    if (department) {
      fetchLeads();
    }
  }, [department, filters, page]);

  const fetchDepartment = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('users_login')
      .select('department')
      .eq('id', user.id)
      .single();

    setDepartment(profile?.department || null);
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.search) {
        params.append('search', filters.search);
      }
      params.append('page', page.toString());
      params.append('limit', '20');

      const response = await fetch(`/api/subadmin/leads?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch leads');
      }

      const data = await response.json();
      setLeads(data.leads || []);
      setTotalPages(data.pagination?.total_pages || 1);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching leads:', error);
      toast.error('Failed to load leads');
      setLoading(false);
    }
  };

  if (!department) {
    return (
      <DashboardLayout role="sub_admin">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="sub_admin">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                <span>{department} Leads</span>
              </h1>
              <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">View and manage {department.toLowerCase()} leads</p>
            </div>
            <button
              onClick={fetchLeads}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
            >
              <option value="all">All Status</option>
              <option value="OPEN,IN_PROGRESS">Active</option>
              <option value="COMPLETED,CLOSED">Completed</option>
            </select>
          </div>
        </div>

        {/* Leads List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48 sm:h-64">
              <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-blue-600" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-8 sm:py-10 md:py-12">
              <FileText className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-600 text-sm sm:text-base">No leads found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                          {lead.lead_number || lead.complaint_number || lead.id.slice(0, 8)}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="text-xs sm:text-sm text-gray-900">
                            {lead.customer_name || lead.customer?.full_name || 'N/A'}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-500">
                            {lead.customer_phone || lead.customer?.phone || ''}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {lead.status || lead.audit_status || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                          {formatDateDMY(lead.created_at)}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                          <Link
                            href={`/dashboard/sub_admin/${department.toLowerCase()}/leads/${lead.id}`}
                            className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                          >
                            View <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-200">
                {leads.map((lead) => (
                  <div key={lead.id} className="p-4 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {lead.lead_number || lead.complaint_number || lead.id.slice(0, 8)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {lead.customer_name || lead.customer?.full_name || 'N/A'}
                        </div>
                        {lead.customer_phone || lead.customer?.phone ? (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {lead.customer_phone || lead.customer?.phone}
                          </div>
                        ) : null}
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-800 flex-shrink-0">
                        {lead.status || lead.audit_status || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-xs text-gray-500">
                        Created: {formatDateDMY(lead.created_at)}
                      </div>
                      <Link
                        href={`/dashboard/sub_admin/${department.toLowerCase()}/leads/${lead.id}`}
                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1 text-xs sm:text-sm font-medium"
                      >
                        View <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
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
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

