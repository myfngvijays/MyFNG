'use client';

import { useState, useEffect } from 'react';

export default function ReportsDashboard() {
  const [activeTab, setActiveTab] = useState<'kpis' | 'revenue' | 'collections'>('kpis');
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [kpis, setKpis] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [collections, setCollections] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab, period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'kpis') {
        const res = await fetch(`/api/reports/kpis?period=${period}`);
        const data = await res.json();
        setKpis(data.kpis);
      } else if (activeTab === 'revenue') {
        const res = await fetch(`/api/reports/revenue?period=${period}`);
        const data = await res.json();
        setRevenue(data);
      } else if (activeTab === 'collections') {
        const res = await fetch(`/api/reports/collections?date=${new Date().toISOString().split('T')[0]}`);
        const data = await res.json();
        setCollections(data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">View KPIs, revenue, and collection reports</p>
        </div>
        <div className="flex space-x-2">
          {['daily', 'weekly', 'monthly'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p as any)}
              className={`px-4 py-2 rounded-lg ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex space-x-4">
          {['kpis', 'revenue', 'collections'].map((tab) => (
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
      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : activeTab === 'kpis' && kpis ? (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold">₹{kpis.revenue?.total_revenue?.toLocaleString() || '0'}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">DSO</p>
              <p className="text-2xl font-bold">{kpis.efficiency?.dso || '0'} days</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">Average CSAT</p>
              <p className="text-2xl font-bold">{kpis.customer_satisfaction?.average_csat || '0'}/5</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">Refund Rate</p>
              <p className="text-2xl font-bold">{kpis.financial?.refund_rate || '0'}%</p>
            </div>
          </div>
        </div>
      ) : activeTab === 'revenue' && revenue ? (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">Total Invoiced</p>
              <p className="text-2xl font-bold">₹{revenue.revenue?.total_invoiced?.toLocaleString() || '0'}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">₹{revenue.revenue?.total_paid?.toLocaleString() || '0'}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">Collection Rate</p>
              <p className="text-2xl font-bold">{revenue.revenue?.collection_rate?.toFixed(1) || '0'}%</p>
            </div>
          </div>
        </div>
      ) : activeTab === 'collections' && collections ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">Total Collections</p>
              <p className="text-2xl font-bold">₹{collections.summary?.total_collections?.toLocaleString() || '0'}</p>
              <p className="text-sm text-gray-500 mt-1">{collections.summary?.total_transactions || 0} transactions</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">Cash vs Online</p>
              <div className="mt-2 space-y-1">
                <p className="text-sm">Cash: ₹{collections.summary?.cash?.amount?.toLocaleString() || '0'} ({collections.summary?.cash?.percentage?.toFixed(1) || '0'}%)</p>
                <p className="text-sm">Online: ₹{collections.summary?.online?.amount?.toLocaleString() || '0'} ({collections.summary?.online?.percentage?.toFixed(1) || '0'}%)</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">No data available</div>
      )}
    </div>
  );
}

