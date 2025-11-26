'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function PayoutsDashboard() {
  const [activeTab, setActiveTab] = useState<'calculate' | 'batches' | 'history'>('batches');
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [workshopId, setWorkshopId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [calculation, setCalculation] = useState<any>(null);

  const supabase = createClient();

  useEffect(() => {
    if (activeTab === 'batches') {
      fetchPayouts();
    }
  }, [activeTab]);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('workshop_payouts')
        .select(`
          *,
          workshop:workshops(id, name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      setPayouts(data || []);
    } catch (error) {
      console.error('Error fetching payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    if (!workshopId || !periodStart || !periodEnd) {
      alert('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/payouts/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workshop_id: workshopId,
          period_start: periodStart,
          period_end: periodEnd,
          commission_percentage: 15.00,
          tds_percentage: 0,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCalculation(data.payout_calculation);
      } else {
        alert(data.error || 'Failed to calculate payout');
      }
    } catch (error) {
      alert('Failed to calculate payout');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBatch = async () => {
    if (!calculation) {
      alert('Please calculate payout first');
      return;
    }

    if (!confirm('Create payout batch?')) return;

    setLoading(true);
    try {
      const res = await fetch('/api/payouts/batch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calculation),
      });

      if (res.ok) {
        alert('Payout batch created! Awaiting approval.');
        setCalculation(null);
        setActiveTab('batches');
        fetchPayouts();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create batch');
      }
    } catch (error) {
      alert('Failed to create batch');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (payoutId: string) => {
    if (!confirm('Approve this payout batch?')) return;

    try {
      const res = await fetch(`/api/payouts/batch/${payoutId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_notes: 'Approved via dashboard' }),
      });

      if (res.ok) {
        alert('Payout approved!');
        fetchPayouts();
      } else {
        alert('Failed to approve payout');
      }
    } catch (error) {
      alert('Failed to approve payout');
    }
  };

  const handleExecute = async (payoutId: string) => {
    const bankTxnId = prompt('Enter bank transaction ID:');
    if (!bankTxnId) return;

    if (!confirm('Execute payout transfer?')) return;

    try {
      const res = await fetch(`/api/payouts/batch/${payoutId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_transaction_id: bankTxnId,
          payment_date: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        alert('Payout executed successfully!');
        fetchPayouts();
      } else {
        alert('Failed to execute payout');
      }
    } catch (error) {
      alert('Failed to execute payout');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payout Management</h1>
        <p className="text-gray-600 mt-1">Calculate, approve, and execute workshop payouts</p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex space-x-4">
          {['calculate', 'batches', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 border-b-2 ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'calculate' ? (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-xl font-bold">Calculate Payout</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Workshop ID</label>
              <input
                type="text"
                value={workshopId}
                onChange={(e) => setWorkshopId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Enter workshop UUID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Period Start</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Period End</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
          <button
            onClick={handleCalculate}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Calculating...' : 'Calculate Payout'}
          </button>

          {calculation && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-bold mb-2">Calculation Result</h3>
              <div className="space-y-2 text-sm">
                <p>Total Invoices: {calculation.total_invoices}</p>
                <p>Total Amount: ₹{calculation.total_invoice_amount.toLocaleString()}</p>
                <p>Commission: ₹{calculation.commission_amount.toLocaleString()}</p>
                <p>Net Payout: ₹{calculation.net_payout_amount.toLocaleString()}</p>
              </div>
              <button
                onClick={handleCreateBatch}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Create Payout Batch
              </button>
            </div>
          )}
        </div>
      ) : activeTab === 'batches' ? (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : payouts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No payouts found</div>
          ) : (
            payouts.map((payout) => (
              <div key={payout.id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{payout.workshop?.name || 'Workshop'}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Period: {new Date(payout.payout_period_start).toLocaleDateString()} - {new Date(payout.payout_period_end).toLocaleDateString()}
                    </p>
                    <p className="text-lg font-bold mt-2">₹{parseFloat(payout.amount || '0').toLocaleString()}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Status: <span className={`font-medium ${
                        payout.status === 'PENDING' ? 'text-orange-600' :
                        payout.status === 'APPROVED' ? 'text-blue-600' :
                        payout.status === 'COMPLETED' ? 'text-green-600' : 'text-gray-600'
                      }`}>{payout.status}</span>
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    {payout.status === 'PENDING' && (
                      <button
                        onClick={() => handleApprove(payout.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                      >
                        Approve
                      </button>
                    )}
                    {payout.status === 'APPROVED' && (
                      <button
                        onClick={() => handleExecute(payout.id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                      >
                        Execute
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Payout History</h2>
          <p className="text-gray-600">View completed payouts here.</p>
        </div>
      )}
    </div>
  );
}

