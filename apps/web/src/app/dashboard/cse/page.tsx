'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  Phone, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  Star,
  MessageSquare,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Truck,
  Wrench,
  FileText,
  AlertTriangle,
  TrendingUp,
  Loader2,
  Eye,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface CSELead {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  status: string;
  final_amount?: number;
  payment_status?: string;
  customer_satisfaction_score?: number;
  customer_feedback?: string;
  follow_up_required?: boolean;
  next_follow_up_at?: string;
  cse_followup_completed?: boolean;
  closed_at?: string;
  created_at: string;
  updated_at: string;
  workshop?: { name: string; phone: string };
  priority?: string;
}

export default function CSEDashboard() {
  const router = useRouter();
  const [leads, setLeads] = useState<CSELead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'priority' | 'workshop' | 'escalated' | 'sla_breach' | 'closed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<CSELead | null>(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    open_complaints: 0,
    pending_resolutions: 0,
    pending_callbacks: 0,
    vehicle_pickup_issues: 0,
    delivery_issues: 0,
    repair_complaints: 0,
    billing_invoice_queries: 0,
    customer_ratings_pending: 0,
  });

  useEffect(() => {
    fetchCSEData();
  }, [filter, searchTerm]);

  async function fetchCSEData() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch dashboard stats
      const statsResponse = await fetch('/api/cse/dashboard');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats || stats);
      }

      // Fetch leads from API
      const params = new URLSearchParams();
      params.append('filter', filter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/cse/leads?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setLeads(result.leads || []);
      } else {
        toast.error('Failed to fetch leads');
      }
    } catch (error) {
      console.error('Error fetching CSE data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }

  const filterButtons = [
    { value: 'all', label: 'All', icon: Filter, color: 'bg-gray-500' },
    { value: 'today', label: 'Today', icon: Clock, color: 'bg-blue-500' },
    { value: 'priority', label: 'Priority', icon: AlertTriangle, color: 'bg-red-500' },
    { value: 'workshop', label: 'Workshop', icon: Truck, color: 'bg-purple-500' },
    { value: 'escalated', label: 'Escalated', icon: AlertCircle, color: 'bg-orange-500' },
    { value: 'sla_breach', label: 'SLA Breach', icon: XCircle, color: 'bg-red-600' },
    { value: 'closed', label: 'Closed', icon: CheckCircle, color: 'bg-green-500' },
  ];

  return (
    <DashboardLayout role="customer_service_executive">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
              <Phone className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-indigo-600 flex-shrink-0" />
              <span>CSE Dashboard</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Customer Service Executive - Manage all customer interactions</p>
          </div>
          <Link
            href="/dashboard/cse/call-panel"
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs sm:text-sm whitespace-nowrap w-full sm:w-auto justify-center"
          >
            <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Call Panel</span>
          </Link>
        </div>

        {/* Dashboard Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Open Complaints</p>
                <p className="text-3xl font-bold text-gray-900">{stats.open_complaints}</p>
              </div>
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <Link href="/dashboard/cse/tickets?status=OPEN" className="text-sm text-indigo-600 hover:underline mt-2 block">
              View all →
            </Link>
          </div>

          <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow border-l-4 border-yellow-500">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Pending Resolutions</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.pending_resolutions}</p>
              </div>
              <Clock className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-yellow-500 flex-shrink-0" />
            </div>
            <Link href="/dashboard/cse/tickets?status=IN_PROGRESS" className="text-xs sm:text-sm text-indigo-600 hover:underline mt-1.5 sm:mt-2 block">
              View all →
            </Link>
          </div>

          <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow border-l-4 border-blue-500">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Pending Callbacks</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.pending_callbacks}</p>
              </div>
              <Phone className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-blue-500 flex-shrink-0" />
            </div>
            <Link href="/dashboard/cse/callbacks" className="text-xs sm:text-sm text-indigo-600 hover:underline mt-1.5 sm:mt-2 block">
              View all →
            </Link>
          </div>

          <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow border-l-4 border-purple-500">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Vehicle Pickup Issues</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.vehicle_pickup_issues}</p>
              </div>
              <Truck className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-purple-500 flex-shrink-0" />
            </div>
            <Link href="/dashboard/cse/tickets?category=PICKUP_DELAY" className="text-xs sm:text-sm text-indigo-600 hover:underline mt-1.5 sm:mt-2 block">
              View all →
            </Link>
          </div>

          <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow border-l-4 border-orange-500">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Delivery Issues</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.delivery_issues}</p>
              </div>
              <Truck className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-orange-500 flex-shrink-0" />
            </div>
            <Link href="/dashboard/cse/tickets?category=DROP_DELAY" className="text-xs sm:text-sm text-indigo-600 hover:underline mt-1.5 sm:mt-2 block">
              View all →
            </Link>
          </div>

          <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow border-l-4 border-red-600">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Repair Complaints</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.repair_complaints}</p>
              </div>
              <Wrench className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-red-600 flex-shrink-0" />
            </div>
            <Link href="/dashboard/cse/tickets?category=SERVICE_QUALITY_COMPLAINT" className="text-xs sm:text-sm text-indigo-600 hover:underline mt-1.5 sm:mt-2 block">
              View all →
            </Link>
          </div>

          <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow border-l-4 border-green-500">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Billing/Invoice Queries</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.billing_invoice_queries}</p>
              </div>
              <DollarSign className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-green-500 flex-shrink-0" />
            </div>
            <Link href="/dashboard/cse/tickets?category=INVOICE_BILLING_ISSUE" className="text-xs sm:text-sm text-indigo-600 hover:underline mt-1.5 sm:mt-2 block">
              View all →
            </Link>
          </div>

          <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow border-l-4 border-yellow-600">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Ratings Pending</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.customer_ratings_pending}</p>
              </div>
              <Star className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-yellow-600 flex-shrink-0" />
            </div>
            <Link href="/dashboard/cse/ratings" className="text-xs sm:text-sm text-indigo-600 hover:underline mt-1.5 sm:mt-2 block">
              View all →
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
            {filterButtons.map((btn) => (
              <button
                key={btn.value}
                onClick={() => setFilter(btn.value as any)}
                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm ${
                  filter === btn.value
                    ? `${btn.color} text-white`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <btn.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{btn.label}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by phone, lead ID, vehicle number, or customer name..."
              className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Leads List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <h2 className="text-base sm:text-lg font-semibold">Customer Interactions</h2>
            <Link
              href="/dashboard/cse/tickets/create"
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs sm:text-sm w-full sm:w-auto justify-center"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Create Ticket
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48 sm:h-64">
              <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 animate-spin text-indigo-600" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-8 sm:py-10 md:py-12">
              <Phone className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-sm sm:text-base text-gray-600">No leads found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead #</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Workshop</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <div className="text-xs sm:text-sm font-medium text-gray-900">{lead.lead_number}</div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[150px]">{lead.customer_name}</div>
                          <div className="text-xs sm:text-sm text-gray-500 truncate">{lead.customer_phone}</div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <div className="text-xs sm:text-sm text-gray-900">-</div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${
                            lead.status === 'CLOSED' ? 'bg-green-100 text-green-800' :
                            lead.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="text-xs sm:text-sm text-gray-900 truncate max-w-[150px]">{lead.workshop?.name || 'N/A'}</div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <div className="text-xs sm:text-sm font-medium text-gray-900">
                            {lead.final_amount ? `₹${lead.final_amount.toLocaleString()}` : '-'}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <Link
                            href={`/dashboard/cse/leads/${lead.id}`}
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

              {/* Mobile/Tablet Cards */}
              <div className="lg:hidden space-y-3 sm:space-y-4 p-3 sm:p-4">
                {leads.map((lead) => (
                  <div key={lead.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm sm:text-base font-semibold text-gray-900">{lead.lead_number}</span>
                          <span className={`inline-flex px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full flex-shrink-0 ${
                            lead.status === 'CLOSED' ? 'bg-green-100 text-green-800' :
                            lead.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {lead.status}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs sm:text-sm">
                          <div>
                            <span className="text-gray-500">Customer: </span>
                            <span className="text-gray-900 font-medium">{lead.customer_name}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Phone: </span>
                            <span className="text-gray-900">{lead.customer_phone}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Workshop: </span>
                            <span className="text-gray-900">{lead.workshop?.name || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Amount: </span>
                            <span className="text-gray-900 font-medium">
                              {lead.final_amount ? `₹${lead.final_amount.toLocaleString()}` : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/cse/leads/${lead.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700 w-full justify-center"
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
