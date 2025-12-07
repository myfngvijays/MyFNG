'use client';

import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PayoutDashboard() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');

  useEffect(() => {
    fetchPayouts();
  }, [filter]);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      // This endpoint needs to be created or use existing
      const response = await fetch(`/api/payouts?status=${filter}`);
      const data = await response.json();
      
      if (data.success) {
        setPayouts(data.payouts || []);
      }
    } catch (error) {
      toast.error('Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  const executePayout = async (payoutId: string) => {
    try {
      const response = await fetch(`/api/payouts/${payoutId}/execute`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Payout executed successfully');
        fetchPayouts();
      } else {
        toast.error(data.error || 'Failed to execute payout');
      }
    } catch (error) {
      toast.error('Error executing payout');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Workshop Payouts</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-8 h-8 text-yellow-600" />
            <h3 className="font-semibold">Pending</h3>
          </div>
          <p className="text-3xl font-bold">{payouts.filter(p => p.status === 'PENDING').length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            <h3 className="font-semibold">Approved</h3>
          </div>
          <p className="text-3xl font-bold">{payouts.filter(p => p.status === 'APPROVED').length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <h3 className="font-semibold">Completed</h3>
          </div>
          <p className="text-3xl font-bold">{payouts.filter(p => p.status === 'COMPLETED').length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-8 h-8 text-purple-600" />
            <h3 className="font-semibold">Total Amount</h3>
          </div>
          <p className="text-2xl font-bold">
            ₹{payouts.reduce((sum, p) => sum + parseFloat(p.net_amount_after_tax || 0), 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        {['PENDING', 'APPROVED', 'COMPLETED', 'FAILED'].map(status => (
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

      {/* Payouts List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : payouts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No payouts found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {payouts.map(payout => (
            <div key={payout.id} className="bg-white p-6 rounded-lg border shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-lg">{payout.workshop?.name || 'Workshop'}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      payout.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      payout.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                      payout.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {payout.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-600">Period</p>
                      <p className="font-medium">
                        {new Date(payout.payout_period_start).toLocaleDateString()} - {new Date(payout.payout_period_end).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Jobs</p>
                      <p className="font-medium">{payout.total_jobs}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Net Amount</p>
                      <p className="font-bold text-green-600">₹{parseFloat(payout.net_amount_after_tax).toLocaleString()}</p>
                    </div>
                  </div>

                  {payout.calculation_breakdown && (
                    <div className="p-3 bg-gray-50 rounded text-sm">
                      <p><strong>Gross:</strong> ₹{parseFloat(payout.calculation_breakdown.gross_amount).toLocaleString()}</p>
                      <p><strong>Commission ({payout.calculation_breakdown.commission_percentage}%):</strong> -₹{parseFloat(payout.calculation_breakdown.commission_amount).toLocaleString()}</p>
                      <p><strong>TDS ({payout.tds_percentage}%):</strong> -₹{parseFloat(payout.tds_amount).toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {payout.status === 'APPROVED' && (
                  <button
                    onClick={() => {
                      if (confirm('Execute payout?')) {
                        executePayout(payout.id);
                      }
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                  >
                    Execute
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
