'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDateDMY } from "@/lib/utils";

export default function ReconciliationDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'exceptions' | 'gl-entries'>('overview');
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [glEntries, setGlEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalExceptions: 0,
    pendingExceptions: 0,
    totalGlEntries: 0,
  });

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'exceptions') {
        const { data } = await fetch('/api/reconciliation/exceptions?status=PENDING').then(r => r.json());
        setExceptions(data?.exceptions || []);
        setStats(prev => ({
          ...prev,
          totalExceptions: data?.exceptions?.length || 0,
          pendingExceptions: data?.exceptions?.filter((e: any) => e.status === 'PENDING').length || 0,
        }));
      } else if (activeTab === 'gl-entries') {
        const { data: entries } = await supabase
          .from('gl_entries')
          .select('*')
          .order('posted_at', { ascending: false })
          .limit(100);
        setGlEntries(entries || []);
        setStats(prev => ({ ...prev, totalGlEntries: entries?.length || 0 }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveException = async (exceptionId: string, action: string) => {
    if (!confirm(`Resolve exception with action: ${action}?`)) return;

    try {
      const res = await fetch('/api/reconciliation/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exception_id: exceptionId,
          resolution_action: action,
          resolution_notes: `Resolved via ${action}`,
        }),
      });

      if (res.ok) {
        alert('Exception resolved!');
        fetchData();
      }
    } catch (error) {
      alert('Failed to resolve exception');
    }
  };

  const handleImportStatement = async () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.xlsx';
    fileInput.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      // Parse CSV (simplified - in production use proper CSV parser)
      const text = await file.text();
      const lines = text.split('\n');
      const transactions = lines.slice(1).map((line: string) => {
        const [txnId, amount, date] = line.split(',');
        return {
          transaction_id: txnId,
          amount: parseFloat(amount),
          date: date,
        };
      }).filter((t: any) => t.transaction_id);

      try {
        const res = await fetch('/api/reconciliation/import-statement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report_date: new Date().toISOString().split('T')[0],
            report_type: 'DAILY',
            provider: 'RAZORPAY',
            transactions: transactions,
            file_name: file.name,
          }),
        });

        if (res.ok) {
          alert('Statement imported successfully!');
          fetchData();
        }
      } catch (error) {
        alert('Failed to import statement');
      }
    };
    fileInput.click();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Reconciliation Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage payment reconciliation and GL entries</p>
        </div>
        <button
          onClick={handleImportStatement}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Import Statement
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Exceptions</p>
          <p className="text-2xl font-bold">{stats.totalExceptions}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Pending Exceptions</p>
          <p className="text-2xl font-bold text-orange-600">{stats.pendingExceptions}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">GL Entries</p>
          <p className="text-2xl font-bold">{stats.totalGlEntries}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex space-x-4">
          {['overview', 'exceptions', 'gl-entries'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 border-b-2 ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600'
              }`}
            >
              {tab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : activeTab === 'exceptions' ? (
        <div className="space-y-4">
          {exceptions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No exceptions found</div>
          ) : (
            exceptions.map((exception) => (
              <div key={exception.id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{exception.exception_type}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {exception.exception_data?.reason || 'No reason provided'}
                    </p>
                    {exception.payment && (
                      <p className="text-sm mt-1">
                        Payment: ₹{exception.payment.amount} - {exception.payment.transaction_id}
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleResolveException(exception.id, 'MATCH_PAYMENT')}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                    >
                      Match
                    </button>
                    <button
                      onClick={() => handleResolveException(exception.id, 'IGNORE')}
                      className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'gl-entries' ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Account</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Reference</th>
              </tr>
            </thead>
            <tbody>
              {glEntries.map((entry) => (
                <tr key={entry.id} className="border-t">
                  <td className="px-4 py-3 text-sm">
                    {formatDateDMY(entry.posted_at)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded ${
                      entry.entry_type === 'DEBIT' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {entry.entry_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{entry.account_name}</td>
                  <td className="px-4 py-3 text-sm">₹{parseFloat(entry.amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{entry.reference_number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Reconciliation Overview</h2>
          <p className="text-gray-600">
            Use the tabs above to manage exceptions and view GL entries.
          </p>
        </div>
      )}
    </div>
  );
}

