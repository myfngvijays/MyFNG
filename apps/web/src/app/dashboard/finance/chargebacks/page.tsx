'use client';

import { useEffect, useState } from 'react';
import { AlertOctagon, Shield, FileText, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChargebackManagementDashboard() {
  const [chargebacks, setChargebacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('RECEIVED');

  useEffect(() => {
    fetchChargebacks();
  }, [filter]);

  const fetchChargebacks = async () => {
    setLoading(true);
    try {
      // Assuming this endpoint needs to be created
      const response = await fetch(`/api/chargebacks?status=${filter}`);
      const data = await response.json();
      
      if (data.success) {
        setChargebacks(data.cases || []);
      }
    } catch (error) {
      toast.error('Failed to load chargebacks');
    } finally {
      setLoading(false);
    }
  };

  const submitEvidence = async (chargebackId: string) => {
    const response = prompt('Enter defense summary:');
    if (!response) return;

    try {
      const apiResponse = await fetch(`/api/chargebacks/${chargebackId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          our_response: response,
          defense_summary: response,
          defense_strength: 'STRONG'
        })
      });

      const data = await apiResponse.json();

      if (data.success) {
        toast.success('Evidence submitted');
        fetchChargebacks();
      } else {
        toast.error(data.error || 'Failed to submit evidence');
      }
    } catch (error) {
      toast.error('Error submitting evidence');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Chargeback Management</h1>
        <p className="text-gray-600">Manage payment disputes and chargebacks</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        {[
          { label: 'New', status: 'RECEIVED', icon: AlertOctagon, color: 'red' },
          { label: 'In Progress', status: 'EVIDENCE_SUBMITTED', icon: FileText, color: 'yellow' },
          { label: 'Won', status: 'WON', icon: CheckCircle, color: 'green' },
          { label: 'Lost', status: 'LOST', icon: XCircle, color: 'gray' }
        ].map(stat => (
          <div key={stat.status} className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center gap-3 mb-2">
              <stat.icon className={`w-8 h-8 text-${stat.color}-600`} />
              <h3 className="font-semibold">{stat.label}</h3>
            </div>
            <p className="text-3xl font-bold">
              {chargebacks.filter(c => c.status === stat.status).length}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        {['RECEIVED', 'EVIDENCE_SUBMITTED', 'WON', 'LOST'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Chargebacks List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : chargebacks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Shield className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">No chargebacks found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {chargebacks.map(chargeback => (
            <div key={chargeback.id} className="bg-white p-6 rounded-lg border shadow-sm border-l-4 border-l-red-500">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertOctagon className="w-6 h-6 text-red-600" />
                    <h3 className="font-bold text-lg">Case #{chargeback.pg_case_id}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      chargeback.status === 'WON' ? 'bg-green-100 text-green-800' :
                      chargeback.status === 'LOST' ? 'bg-gray-100 text-gray-800' :
                      chargeback.status === 'EVIDENCE_SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {chargeback.status}
                    </span>
                    {chargeback.priority === 'CRITICAL' && (
                      <span className="px-3 py-1 bg-red-600 text-white rounded-full text-sm font-bold">
                        CRITICAL
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                    <div>
                      <p className="text-gray-600">Amount</p>
                      <p className="font-bold text-red-600">₹{parseFloat(chargeback.chargeback_amount).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Customer</p>
                      <p className="font-medium">{chargeback.customer_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Response Due</p>
                      <p className="font-medium text-orange-600">
                        {new Date(chargeback.response_due_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-red-50 rounded text-sm mb-3">
                    <p className="font-medium mb-1">Reason:</p>
                    <p>{chargeback.chargeback_reason || 'Not specified'}</p>
                    {chargeback.customer_statement && (
                      <>
                        <p className="font-medium mt-2 mb-1">Customer Statement:</p>
                        <p className="italic">{chargeback.customer_statement}</p>
                      </>
                    )}
                  </div>

                  {chargeback.our_response && (
                    <div className="p-3 bg-blue-50 rounded text-sm">
                      <p className="font-medium mb-1">Our Defense:</p>
                      <p>{chargeback.defense_summary}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {chargeback.status === 'RECEIVED' && (
                    <>
                      <button
                        onClick={() => submitEvidence(chargeback.id)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                      >
                        Submit Evidence
                      </button>
                      <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg">
                        View Details
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

