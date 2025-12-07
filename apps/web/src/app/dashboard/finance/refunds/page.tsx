'use client';

import { useEffect, useState } from 'react';
import { DollarSign, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RefundManagementDashboard() {
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');

  useEffect(() => {
    fetchRefunds();
  }, [filter]);

  const fetchRefunds = async () => {
    setLoading(true);
    try {
      // Assuming this endpoint exists or needs to be created
      const response = await fetch(`/api/refunds?status=${filter}`);
      const data = await response.json();
      
      if (data.success) {
        setRefunds(data.refunds || []);
      }
    } catch (error) {
      toast.error('Failed to load refunds');
    } finally {
      setLoading(false);
    }
  };

  const approveRefund = async (refundId: string) => {
    const notes = prompt('Approval notes:');
    if (!notes) return;

    try {
      const response = await fetch(`/api/refunds/${refundId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approval_notes: notes,
          process_immediately: true
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Refund approved and processed');
        fetchRefunds();
      } else {
        toast.error(data.error || 'Failed to approve refund');
      }
    } catch (error) {
      toast.error('Error approving refund');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Refund Management</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        {[
          { label: 'Pending', status: 'PENDING', icon: Clock, color: 'yellow' },
          { label: 'Approved', status: 'APPROVED', icon: CheckCircle, color: 'green' },
          { label: 'Completed', status: 'COMPLETED', icon: CheckCircle, color: 'blue' },
          { label: 'Rejected', status: 'REJECTED', icon: XCircle, color: 'red' }
        ].map(stat => (
          <div key={stat.status} className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center gap-3 mb-2">
              <stat.icon className={`w-8 h-8 text-${stat.color}-600`} />
              <h3 className="font-semibold">{stat.label}</h3>
            </div>
            <p className="text-3xl font-bold">
              {refunds.filter(r => r.status === stat.status).length}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        {['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Refunds List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : refunds.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No refunds found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {refunds.map(refund => (
            <div key={refund.id} className="bg-white p-6 rounded-lg border shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <DollarSign className="w-6 h-6 text-red-600" />
                    <h3 className="font-bold text-lg">Refund Request #{refund.id.substr(0, 8)}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      refund.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      refund.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                      refund.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {refund.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                    <div>
                      <p className="text-gray-600">Lead</p>
                      <p className="font-medium">{refund.lead?.lead_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Customer</p>
                      <p className="font-medium">{refund.lead?.customer_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Amount</p>
                      <p className="font-bold text-red-600">₹{parseFloat(refund.amount).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded text-sm">
                    <p className="font-medium mb-1">Reason:</p>
                    <p>{refund.reason || 'No reason provided'}</p>
                  </div>

                  {refund.approved_at && (
                    <div className="mt-2 text-sm text-gray-600">
                      Approved: {new Date(refund.approved_at).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {refund.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => approveRefund(refund.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                      >
                        Approve
                      </button>
                      <button
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                      >
                        Review
                      </button>
                    </>
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
