'use client';

import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateDMY } from "@/lib/utils";

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
    <div className="p-3 sm:p-4 md:p-5 lg:p-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-5 md:mb-6">Workshop Payouts</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 mb-4 sm:mb-5 md:mb-6">
        <div className="bg-white p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg shadow">
          <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
            <Clock className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow-600 flex-shrink-0" />
            <h3 className="font-semibold text-xs sm:text-sm md:text-base">Pending</h3>
          </div>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold">{payouts.filter(p => p.status === 'PENDING').length}</p>
        </div>
        <div className="bg-white p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg shadow">
          <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
            <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-600 flex-shrink-0" />
            <h3 className="font-semibold text-xs sm:text-sm md:text-base">Approved</h3>
          </div>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold">{payouts.filter(p => p.status === 'APPROVED').length}</p>
        </div>
        <div className="bg-white p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg shadow">
          <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
            <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-green-600 flex-shrink-0" />
            <h3 className="font-semibold text-xs sm:text-sm md:text-base">Completed</h3>
          </div>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold">{payouts.filter(p => p.status === 'COMPLETED').length}</p>
        </div>
        <div className="bg-white p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg shadow">
          <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
            <DollarSign className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-purple-600 flex-shrink-0" />
            <h3 className="font-semibold text-xs sm:text-sm md:text-base">Total Amount</h3>
          </div>
          <p className="text-lg sm:text-xl md:text-2xl font-bold">
            ₹{payouts.reduce((sum, p) => sum + parseFloat(p.net_amount_after_tax || 0), 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-5 md:mb-6">
        {['PENDING', 'APPROVED', 'COMPLETED', 'FAILED'].map(status => (
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

      {/* Payouts List */}
      {loading ? (
        <div className="text-center py-8 sm:py-10 md:py-12">
          <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : payouts.length === 0 ? (
        <div className="text-center py-8 sm:py-10 md:py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-xs sm:text-sm md:text-base">No payouts found</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {payouts.map(payout => (
            <div key={payout.id} className="bg-white p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg border shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <h3 className="font-bold text-base sm:text-lg">{payout.workshop?.name || 'Workshop'}</h3>
                    <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm ${
                      payout.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      payout.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                      payout.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {payout.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm mb-3 sm:mb-4">
                    <div>
                      <p className="text-gray-600">Period</p>
                      <p className="font-medium">
                        {formatDateDMY(payout.payout_period_start)} - {formatDateDMY(payout.payout_period_end)}
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
                    <div className="p-2.5 sm:p-3 bg-gray-50 rounded text-xs sm:text-sm">
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
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs sm:text-sm w-full sm:w-auto"
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
