'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function RefundsDashboard() {
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'completed'>('pending');

  const supabase = createClient();

  useEffect(() => {
    fetchRefunds();
  }, [filter]);

  const fetchRefunds = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('refund_requests')
        .select(`
          *,
          invoice:invoices(id, invoice_number),
          lead:service_leads(id, lead_number, customer_name, customer_phone)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter !== 'all') {
        query = query.eq('status', filter.toUpperCase());
      }

      const { data } = await query;
      setRefunds(data || []);
    } catch (error) {
      console.error('Error fetching refunds:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (refundId: string) => {
    if (!confirm('Approve this refund request?')) return;

    try {
      const res = await fetch(`/api/refunds/${refundId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_notes: 'Approved via dashboard' }),
      });

      if (res.ok) {
        alert('Refund approved!');
        fetchRefunds();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to approve refund');
      }
    } catch (error) {
      alert('Failed to approve refund');
    }
  };

  const handleProcess = async (refundId: string) => {
    if (!confirm('Process this refund?')) return;

    try {
      const res = await fetch(`/api/refunds/${refundId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        alert('Refund processing initiated!');
        fetchRefunds();
      } else {
        alert('Failed to process refund');
      }
    } catch (error) {
      alert('Failed to process refund');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Refund Management</h1>
        <p className="text-gray-600 mt-1">Manage refund requests and chargebacks</p>
      </div>

      {/* Filters */}
      <div className="flex space-x-2">
        {['all', 'pending', 'approved', 'completed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-2 rounded-lg ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Refunds List */}
      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : refunds.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No refunds found</div>
      ) : (
        <div className="space-y-4">
          {refunds.map((refund) => (
            <div key={refund.id} className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{refund.lead?.customer_name || 'Customer'}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Invoice: {refund.invoice?.invoice_number || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Reason: {refund.reason}
                  </p>
                  {refund.description && (
                    <p className="text-sm text-gray-500 mt-1">{refund.description}</p>
                  )}
                  <p className="text-lg font-bold mt-2">
                    ₹{parseFloat(refund.refund_amount || '0').toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Type: {refund.refund_type} | Status: <span className={`font-medium ${
                      refund.status === 'PENDING' ? 'text-orange-600' :
                      refund.status === 'APPROVED' ? 'text-blue-600' :
                      refund.status === 'COMPLETED' ? 'text-green-600' : 'text-gray-600'
                    }`}>{refund.status}</span>
                  </p>
                </div>
                <div className="flex space-x-2">
                  {refund.status === 'PENDING' && (
                    <button
                      onClick={() => handleApprove(refund.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                    >
                      Approve
                    </button>
                  )}
                  {refund.status === 'APPROVED' && (
                    <button
                      onClick={() => handleProcess(refund.id)}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                    >
                      Process
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

