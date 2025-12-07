'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

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
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Payment Reconciliation</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        {['PENDING', 'RESOLVED', 'ESCALATED'].map(status => (
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

      {/* Exceptions List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : exceptions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">No exceptions found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {exceptions.map(exception => (
            <div key={exception.id} className="bg-white p-6 rounded-lg border shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    <h3 className="font-bold">{exception.exception_type}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      exception.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                      exception.status === 'ESCALATED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {exception.status}
                    </span>
                  </div>

                  {exception.payment && (
                    <div className="text-sm space-y-1 mb-3">
                      <p><strong>Transaction ID:</strong> {exception.payment.transaction_id}</p>
                      <p><strong>Amount:</strong> ₹{parseFloat(exception.payment.amount).toLocaleString()}</p>
                      <p><strong>Date:</strong> {new Date(exception.payment.completed_at).toLocaleString()}</p>
                    </div>
                  )}

                  <div className="text-sm text-gray-600">
                    <pre className="bg-gray-50 p-3 rounded overflow-x-auto">
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
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
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

