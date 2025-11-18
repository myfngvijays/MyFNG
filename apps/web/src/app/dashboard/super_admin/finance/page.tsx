'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { DollarSign, TrendingUp, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function FinanceManagementPage() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'payouts' | 'refunds'>('overview');
  
  const [stats, setStats] = useState({
    pendingPayouts: 0,
    pendingPayoutsAmount: 0,
    pendingRefunds: 0,
    pendingRefundsAmount: 0,
    todayRevenue: 0,
    monthlyRevenue: 0
  });

  const [payouts, setPayouts] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const fetchFinanceData = async () => {
    try {
      // Fetch payouts
      const { data: payoutsData } = await supabase
        .from('workshop_payouts')
        .select('*, workshop:workshops(name)')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      // Fetch refunds
      const { data: refundsData } = await supabase
        .from('refund_requests')
        .select('*, lead:service_leads(customer_name)')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      setPayouts(payoutsData || []);
      setRefunds(refundsData || []);

      // Calculate stats
      const payoutsSum = (payoutsData || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const refundsSum = (refundsData || []).reduce((sum, r) => sum + (r.amount || 0), 0);

      setStats({
        pendingPayouts: payoutsData?.length || 0,
        pendingPayoutsAmount: payoutsSum,
        pendingRefunds: refundsData?.length || 0,
        pendingRefundsAmount: refundsSum,
        todayRevenue: 125000,
        monthlyRevenue: 2450000
      });
    } catch (error) {
      console.error('Error fetching finance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePayout = async (id: string) => {
    if (!confirm('Approve this payout?')) return;

    try {
      const { error } = await supabase
        .from('workshop_payouts')
        .update({ 
          status: 'APPROVED',
          approved_at: new Date().toISOString()
        })
        .eq('id', id);

      if (!error) {
        alert('Payout approved!');
        fetchFinanceData();
      }
    } catch (error) {
      alert('Failed to approve payout');
    }
  };

  const handleApproveRefund = async (id: string) => {
    if (!confirm('Approve this refund?')) return;

    try {
      const { error } = await supabase
        .from('refund_requests')
        .update({ 
          status: 'APPROVED',
          approved_at: new Date().toISOString()
        })
        .eq('id', id);

      if (!error) {
        alert('Refund approved!');
        fetchFinanceData();
      }
    } catch (error) {
      alert('Failed to approve refund');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading finance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6" />
            Finance & Payout Control
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage payouts, refunds, and financial operations
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('payouts')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'payouts'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Payouts ({stats.pendingPayouts})
              </button>
              <button
                onClick={() => setActiveTab('refunds')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'refunds'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Refunds ({stats.pendingRefunds})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Revenue Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
                    <TrendingUp className="w-8 h-8 mb-2" />
                    <p className="text-sm opacity-90">Today's Revenue</p>
                    <p className="text-3xl font-bold">₹{(stats.todayRevenue / 1000).toFixed(1)}K</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                    <DollarSign className="w-8 h-8 mb-2" />
                    <p className="text-sm opacity-90">Monthly Revenue</p>
                    <p className="text-3xl font-bold">₹{(stats.monthlyRevenue / 100000).toFixed(1)}L</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white">
                    <Clock className="w-8 h-8 mb-2" />
                    <p className="text-sm opacity-90">Pending Approvals</p>
                    <p className="text-3xl font-bold">{stats.pendingPayouts + stats.pendingRefunds}</p>
                  </div>
                </div>

                {/* Pending Items */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border rounded-lg p-6">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Pending Payouts
                    </h3>
                    <div className="text-3xl font-bold text-gray-900">
                      ₹{(stats.pendingPayoutsAmount / 1000).toFixed(1)}K
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{stats.pendingPayouts} requests</p>
                    <button
                      onClick={() => setActiveTab('payouts')}
                      className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View All →
                    </button>
                  </div>

                  <div className="border rounded-lg p-6">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      Pending Refunds
                    </h3>
                    <div className="text-3xl font-bold text-gray-900">
                      ₹{(stats.pendingRefundsAmount / 1000).toFixed(1)}K
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{stats.pendingRefunds} requests</p>
                    <button
                      onClick={() => setActiveTab('refunds')}
                      className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View All →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'payouts' && (
              <div className="space-y-4">
                {payouts.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No pending payouts
                  </div>
                ) : (
                  payouts.map((payout) => (
                    <div key={payout.id} className="border rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{payout.workshop?.name || 'Workshop'}</h4>
                        <p className="text-sm text-gray-600">
                          {new Date(payout.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <div className="text-xl font-bold text-gray-900">
                            ₹{payout.amount?.toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">{payout.total_jobs || 0} jobs</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprovePayout(payout.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'refunds' && (
              <div className="space-y-4">
                {refunds.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No pending refunds
                  </div>
                ) : (
                  refunds.map((refund) => (
                    <div key={refund.id} className="border rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{refund.lead?.customer_name || 'Customer'}</h4>
                        <p className="text-sm text-gray-600">{refund.reason}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(refund.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <div className="text-xl font-bold text-red-600">
                            ₹{refund.amount?.toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">{refund.refund_type}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveRefund(refund.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

