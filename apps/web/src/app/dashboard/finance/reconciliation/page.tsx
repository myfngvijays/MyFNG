'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateTime } from "@/lib/utils";

export default function ReconciliationDashboard() {
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');

  useEffect(() => {
    fetchExceptions();
  }, [filter]);

  const fetchExceptions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/reconciliation/exceptions?status=${filter}`);
      const data = await response.json();
      
      if (data.success) {
        setExceptions(data.exceptions || []);
      }
    } catch (error) {
      toast.error('Failed to load exceptions');
    } finally {
      setLoading(false);
    }
  };

  const resolveException = async (exceptionId: string, notes: string) => {
    try {
      const response = await fetch(`/api/reconciliation/exceptions/${exceptionId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_notes: notes })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Exception resolved');
        fetchExceptions();
      }
    } catch (error) {
      toast.error('Failed to resolve exception');
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-5 lg:p-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-5 md:mb-6">Payment Reconciliation</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-5 md:mb-6">
        {['PENDING', 'RESOLVED', 'ESCALATED'].map(status => (
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

      {/* Exceptions List */}
      {loading ? (
        <div className="text-center py-8 sm:py-10 md:py-12">
          <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : exceptions.length === 0 ? (
        <div className="text-center py-8 sm:py-10 md:py-12 bg-gray-50 rounded-lg">
          <CheckCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-green-600 mx-auto mb-2 sm:mb-3 md:mb-4" />
          <p className="text-gray-600 text-xs sm:text-sm md:text-base">No exceptions found</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {exceptions.map(exception => (
            <div key={exception.id} className="bg-white p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg border shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0" />
                    <h3 className="font-bold text-sm sm:text-base md:text-lg">{exception.exception_type}</h3>
                    <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm ${
                      exception.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                      exception.status === 'ESCALATED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {exception.status}
                    </span>
                  </div>

                  {exception.payment && (
                    <div className="text-xs sm:text-sm space-y-1 mb-2 sm:mb-3">
                      <p><strong>Transaction ID:</strong> {exception.payment.transaction_id}</p>
                      <p><strong>Amount:</strong> ₹{parseFloat(exception.payment.amount).toLocaleString()}</p>
                      <p><strong>Date:</strong> {formatDateTime(exception.payment.completed_at)}</p>
                    </div>
                  )}

                  <div className="text-xs sm:text-sm text-gray-600">
                    <pre className="bg-gray-50 p-2 sm:p-3 rounded overflow-x-auto text-[10px] sm:text-xs">
                      {JSON.stringify(exception.exception_data, null, 2)}
                    </pre>
                  </div>
                </div>

                {exception.status === 'PENDING' && (
                  <button
                    onClick={() => {
                      const notes = prompt('Resolution notes:');
                      if (notes) resolveException(exception.id, notes);
                    }}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs sm:text-sm w-full sm:w-auto"
                  >
                    Resolve
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

