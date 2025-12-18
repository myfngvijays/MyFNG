'use client';

import { useEffect, useState } from 'react';
import { DollarSign, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateTime } from "@/lib/utils";

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
    <div className="p-3 sm:p-4 md:p-5 lg:p-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-5 md:mb-6">Refund Management</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 mb-4 sm:mb-5 md:mb-6">
        {[
          { label: 'Pending', status: 'PENDING', icon: Clock, color: 'yellow' },
          { label: 'Approved', status: 'APPROVED', icon: CheckCircle, color: 'green' },
          { label: 'Completed', status: 'COMPLETED', icon: CheckCircle, color: 'blue' },
          { label: 'Rejected', status: 'REJECTED', icon: XCircle, color: 'red' }
        ].map(stat => (
          <div key={stat.status} className="bg-white p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg shadow">
            <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
              <stat.icon className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-${stat.color}-600 flex-shrink-0`} />
              <h3 className="font-semibold text-xs sm:text-sm md:text-base">{stat.label}</h3>
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold">
              {refunds.filter(r => r.status === stat.status).length}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-5 md:mb-6">
        {['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm ${
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
        <div className="text-center py-8 sm:py-10 md:py-12">
          <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : refunds.length === 0 ? (
        <div className="text-center py-8 sm:py-10 md:py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-xs sm:text-sm md:text-base">No refunds found</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {refunds.map(refund => (
            <div key={refund.id} className="bg-white p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg border shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0" />
                    <h3 className="font-bold text-base sm:text-lg truncate">Refund Request #{refund.id.substr(0, 8)}</h3>
                    <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm ${
                      refund.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      refund.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                      refund.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {refund.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm mb-2 sm:mb-3">
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

                  <div className="p-2.5 sm:p-3 bg-gray-50 rounded text-xs sm:text-sm">
                    <p className="font-medium mb-0.5 sm:mb-1">Reason:</p>
                    <p>{refund.reason || 'No reason provided'}</p>
                  </div>

                  {refund.approved_at && (
                    <div className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-gray-600">
                      Approved: {formatDateTime(refund.approved_at)}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-shrink-0">
                  {refund.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => approveRefund(refund.id)}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs sm:text-sm w-full sm:w-auto"
                      >
                        Approve
                      </button>
                      <button
                        className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs sm:text-sm w-full sm:w-auto"
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
