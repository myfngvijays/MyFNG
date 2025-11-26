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
        .in('status', ['QC_APPROVED', 'INVOICE_GENERATED', 'INVOICE_SENT'])
        .order('qc_approved_at', { ascending: false });

      if (filter === 'pending') {
        query = query.eq('status', 'QC_APPROVED');
      } else if (filter === 'invoiced') {
        query = query.in('status', ['INVOICE_GENERATED', 'INVOICE_SENT']);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching billing data:', error);
        toast.error('Failed to fetch billing data');
        return;
      }

      setLeads(data || []);

      // Calculate stats
      const pending = data?.filter(l => l.status === 'QC_APPROVED') || [];
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
      'INVOICE_GENERATED': 'badge-blue',
      'INVOICE_SENT': 'badge-green'
    };
    return badges[status] || 'badge-gray';
  };

  if (loading) {
    return (
      <DashboardLayout role="billing">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="billing">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-6 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg">💰 Billing Dashboard</h1>
          <p className="text-white font-medium mt-1">Generate invoices and manage payments</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100">
            <div className="flex items-center gap-3">
              <Clock className="w-10 h-10 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">Pending Invoices</p>
                <p className="text-3xl font-bold text-gray-800">{stats.pendingInvoices}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-orange-50 to-orange-100">
            <div className="flex items-center gap-3">
              <DollarSign className="w-10 h-10 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">Pending Amount</p>
                <p className="text-2xl font-bold text-gray-800">₹{stats.totalPending.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="flex items-center gap-3">
              <FileText className="w-10 h-10 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Invoices Generated</p>
                <p className="text-3xl font-bold text-gray-800">{stats.invoicesGenerated}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-10 h-10 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Total Invoiced</p>
                <p className="text-2xl font-bold text-gray-800">₹{stats.totalInvoiced.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="card">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending ({stats.pendingInvoices})
            </button>
            <button
              onClick={() => setFilter('invoiced')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'invoiced'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Invoiced ({stats.invoicesGenerated})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
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
          <div className="card text-center py-12">
            <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Records</h3>
            <p className="text-gray-500">
              {filter === 'pending' 
                ? 'No leads pending invoice generation.' 
                : 'No invoiced leads found.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {leads.map((lead) => (
              <div 
                key={lead.id} 
                className={`card hover:shadow-xl transition-shadow border-l-4 ${
                  lead.status === 'QC_APPROVED' ? 'border-yellow-500' : 'border-green-500'
                }`}
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="badge-blue text-lg">{lead.lead_number}</span>
                      <span className={getStatusBadge(lead.status)}>
                        {lead.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-right">
                      {lead.invoice_number ? (
                        <>
                          <p className="text-sm text-gray-600">Invoice #</p>
                          <p className="font-semibold">{lead.invoice_number}</p>
                        </>
                      ) : (
                        <p className="text-2xl font-bold text-orange-600">
                          ₹{(lead.total_price || lead.estimated_cost || 0).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Customer</p>
                      <p className="font-semibold">{lead.customer_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Vehicle</p>
                      <p className="font-semibold">{lead.vehicle_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">
                        {lead.invoice_amount ? 'Invoice Amount' : 'Estimated Cost'}
                      </p>
                      <p className="text-lg font-bold text-green-600">
                        ₹{(lead.invoice_amount || lead.total_price || lead.estimated_cost || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t">
                    {lead.status === 'QC_APPROVED' && (
                      <button
                        onClick={() => router.push(`/dashboard/billing/leads/${lead.id}/generate-invoice`)}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Generate Invoice
                      </button>
                    )}
                    {lead.status === 'INVOICE_GENERATED' && (
                      <>
                        <button
                          onClick={() => router.push(`/dashboard/billing/invoices/${lead.invoice_id}/review`)}
                          className="btn-secondary bg-purple-600 hover:bg-purple-700 text-white flex-1 flex items-center justify-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          Review
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/billing/invoices/${lead.invoice_id}`)}
                          className="btn-secondary bg-blue-600 hover:bg-blue-700 text-white flex-1 flex items-center justify-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          Send
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => router.push(`/dashboard/billing/leads/${lead.id}`)}
                      className="btn-secondary flex-1"
                    >
                      View Details
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

