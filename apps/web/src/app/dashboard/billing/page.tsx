'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { DollarSign, FileText, Clock, CheckCircle, AlertCircle, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface BillingLead {
  id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  estimated_cost: number;
  total_price: number;
  invoice_id: string | null;
  invoice_amount: number | null;
  invoice_number: string | null;
  status: string;
  qc_approved_at: string;
}

export default function BillingDashboard() {
  const router = useRouter();
  const [leads, setLeads] = useState<BillingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'invoiced' | 'all'>('pending');
  
  const [stats, setStats] = useState({
    pendingInvoices: 0,
    totalPending: 0,
    invoicesGenerated: 0,
    totalInvoiced: 0
  });

  useEffect(() => {
    fetchBillingData();
  }, [filter]);

  async function fetchBillingData() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Build query based on filter
      let query = supabase
        .from('service_leads')
        .select('*')
        .in('status', ['QC_APPROVED', 'PAYMENT_AWAITING', 'INVOICE_GENERATED', 'INVOICE_SENT', 'AWAITING_PAYMENT', 'PAID'])
        .order('qc_approved_at', { ascending: false });

      if (filter === 'pending') {
        query = query.in('status', ['QC_APPROVED', 'PAYMENT_AWAITING']);
      } else if (filter === 'invoiced') {
        query = query.in('status', ['INVOICE_GENERATED', 'INVOICE_SENT', 'AWAITING_PAYMENT', 'PAID']);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching billing data:', error);
        toast.error('Failed to fetch billing data');
        return;
      }

      setLeads(data || []);

      // Calculate stats
      const pending = data?.filter(l => ['QC_APPROVED', 'PAYMENT_AWAITING'].includes(l.status)) || [];
      const invoiced = data?.filter(l => ['INVOICE_GENERATED', 'INVOICE_SENT'].includes(l.status)) || [];

      setStats({
        pendingInvoices: pending.length,
        totalPending: pending.reduce((sum, l) => sum + (l.estimated_cost || 0), 0),
        invoicesGenerated: invoiced.length,
        totalInvoiced: invoiced.reduce((sum, l) => sum + (l.invoice_amount || 0), 0)
      });

    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      'QC_APPROVED': 'badge-yellow',
      'PAYMENT_AWAITING': 'badge-yellow',
      'INVOICE_GENERATED': 'badge-blue',
      'INVOICE_SENT': 'badge-green',
      'AWAITING_PAYMENT': 'badge-orange',
      'PAID': 'badge-green',
    };
    return badges[status] || 'badge-gray';
  };

  if (loading) {
    return (
      <DashboardLayout role="billing">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="billing">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-300 drop-shadow-lg">💰 Billing Dashboard</h1>
          <p className="text-white font-medium mt-0.5 sm:mt-1 text-xs sm:text-sm md:text-base">Generate invoices and manage payments</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100 p-3 sm:p-4 md:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <Clock className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 text-yellow-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Pending Invoices</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">{stats.pendingInvoices}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-orange-50 to-orange-100 p-3 sm:p-4 md:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <DollarSign className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 text-orange-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Pending Amount</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">₹{stats.totalPending.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 p-3 sm:p-4 md:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <FileText className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 text-blue-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Invoices Generated</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">{stats.invoicesGenerated}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100 p-3 sm:p-4 md:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 text-green-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Total Invoiced</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">₹{stats.totalInvoiced.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="card p-3 sm:p-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
                filter === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending ({stats.pendingInvoices})
            </button>
            <button
              onClick={() => setFilter('invoiced')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
                filter === 'invoiced'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Invoiced ({stats.invoicesGenerated})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
                filter === 'all'
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Leads List */}
        {leads.length === 0 ? (
          <div className="card text-center py-8 sm:py-10 md:py-12">
            <CheckCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-2 sm:mb-3 md:mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-1.5 sm:mb-2">No Records</h3>
            <p className="text-gray-500 text-xs sm:text-sm">
              {filter === 'pending' 
                ? 'No leads pending invoice generation.' 
                : 'No invoiced leads found.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {leads.map((lead) => (
              <div 
                key={lead.id} 
                className={`card hover:shadow-xl transition-shadow border-l-4 p-3 sm:p-4 md:p-5 ${
                  lead.status === 'QC_APPROVED' ? 'border-yellow-500' : 'border-green-500'
                }`}
              >
                <div className="space-y-3 sm:space-y-4">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                      <span className="badge-blue text-sm sm:text-base md:text-lg">{lead.lead_number}</span>
                      <span className={getStatusBadge(lead.status)}>
                        {lead.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-left sm:text-right w-full sm:w-auto">
                      {lead.invoice_number ? (
                        <>
                          <p className="text-xs sm:text-sm text-gray-600">Invoice #</p>
                          <p className="font-semibold text-xs sm:text-sm">{lead.invoice_number}</p>
                        </>
                      ) : (
                        <p className="text-lg sm:text-xl md:text-2xl font-bold text-orange-600">
                          ₹{(lead.total_price || lead.estimated_cost || 0).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Customer</p>
                      <p className="font-semibold text-xs sm:text-sm md:text-base">{lead.customer_name}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Vehicle</p>
                      <p className="font-semibold text-xs sm:text-sm md:text-base">{lead.vehicle_number}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">
                        {lead.invoice_amount ? 'Invoice Amount' : 'Estimated Cost'}
                      </p>
                      <p className="text-base sm:text-lg font-bold text-green-600">
                        ₹{(lead.invoice_amount || lead.total_price || lead.estimated_cost || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 sm:pt-3 border-t">
                    {['QC_APPROVED', 'PAYMENT_AWAITING'].includes(lead.status) && (
                      <button
                        onClick={() => router.push(`/dashboard/billing/leads/${lead.id}/generate-invoice`)}
                        className="btn-primary flex-1 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                      >
                        <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Finalize Bill</span>
                        <span className="sm:hidden">Finalize</span>
                      </button>
                    )}
                    {lead.status === 'INVOICE_GENERATED' && (
                      <>
                        <button
                          onClick={() => router.push(`/dashboard/billing/invoices/${lead.invoice_id}/review`)}
                          className="btn-secondary bg-purple-600 hover:bg-purple-700 text-white flex-1 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                        >
                          <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Review</span>
                          <span className="sm:hidden">Review</span>
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/billing/invoices/${lead.invoice_id}`)}
                          className="btn-secondary bg-blue-600 hover:bg-blue-700 text-white flex-1 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                        >
                          <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Send</span>
                          <span className="sm:hidden">Send</span>
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => router.push(`/dashboard/billing/leads/${lead.id}`)}
                      className="btn-secondary flex-1 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                    >
                      <span className="hidden sm:inline">View Details</span>
                      <span className="sm:hidden">View</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

