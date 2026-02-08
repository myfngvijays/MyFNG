'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, CheckCircle, XCircle, Clock, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDateDMY } from '@/lib/utils';

function formatInK(value: number): string {
  const k = value / 1000;
  if (k === 0) return '0K';
  return k >= 1 ? `${k.toFixed(1)}K` : `${k.toFixed(2)}K`;
}

type Tab = 'overview' | 'payouts' | 'refunds';

interface FinanceStats {
  todayRevenue: number;
  monthlyRevenue: number;
  pendingPayouts: number;
  pendingPayoutsAmount: number;
  pendingRefunds: number;
  pendingRefundsAmount: number;
}

interface PayoutRow {
  id: string;
  amount: number;
  total_jobs?: number;
  created_at: string;
  workshop?: { name: string | null };
}

interface RefundRow {
  id: string;
  amount: number;
  reason?: string;
  refund_type?: string;
  created_at: string;
  lead?: { customer_name: string | null };
}

export default function FinanceManagementPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<FinanceStats>({
    pendingPayouts: 0,
    pendingPayoutsAmount: 0,
    pendingRefunds: 0,
    pendingRefundsAmount: 0,
    todayRevenue: 0,
    monthlyRevenue: 0,
  });
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchFinanceData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/super_admin/finance');
      const data = await response.json();

      if (!response.ok) {
        const msg = data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to load finance data');
        setError(msg);
        toast.error(msg);
        setStats((s) => ({ ...s, pendingPayouts: 0, pendingPayoutsAmount: 0, pendingRefunds: 0, pendingRefundsAmount: 0, todayRevenue: 0, monthlyRevenue: 0 }));
        setPayouts([]);
        setRefunds([]);
        return;
      }

      setStats(data.stats ?? stats);
      setPayouts(data.payouts ?? []);
      setRefunds(data.refunds ?? []);
    } catch (e) {
      const msg = 'Failed to load finance data';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFinanceData();
  }, [fetchFinanceData]);

  const handleApprovePayout = async (id: string) => {
    setActionId(id);
    try {
      const response = await fetch(`/api/super_admin/finance/payouts/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      if (response.ok) {
        toast.success('Payout approved');
        fetchFinanceData();
      } else {
        toast.error(data.error || 'Failed to approve payout');
      }
    } catch {
      toast.error('Failed to approve payout');
    } finally {
      setActionId(null);
    }
  };

  const handleRejectPayout = async (id: string) => {
    if (!confirm('Reject this payout?')) return;
    setActionId(id);
    try {
      const response = await fetch(`/api/super_admin/finance/payouts/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: 'Rejected from Finance dashboard' }),
      });
      const data = await response.json();

      if (response.ok) {
        toast.success('Payout rejected');
        fetchFinanceData();
      } else {
        toast.error(data.error || 'Failed to reject payout');
      }
    } catch {
      toast.error('Failed to reject payout');
    } finally {
      setActionId(null);
    }
  };

  const handleApproveRefund = async (id: string) => {
    setActionId(id);
    try {
      const response = await fetch(`/api/refunds/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_notes: 'Approved from Finance dashboard', process_immediately: false }),
      });
      const data = await response.json();

      if (response.ok) {
        toast.success('Refund approved');
        fetchFinanceData();
      } else {
        toast.error(data.error || 'Failed to approve refund');
      }
    } catch {
      toast.error('Failed to approve refund');
    } finally {
      setActionId(null);
    }
  };

  const handleRejectRefund = async (id: string) => {
    if (!confirm('Reject this refund?')) return;
    setActionId(id);
    try {
      const response = await fetch(`/api/super_admin/finance/refunds/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: 'Rejected from Finance dashboard' }),
      });
      const data = await response.json();

      if (response.ok) {
        toast.success('Refund rejected');
        fetchFinanceData();
      } else {
        toast.error(data.error || 'Failed to reject refund');
      }
    } catch {
      toast.error('Failed to reject refund');
    } finally {
      setActionId(null);
    }
  };

  if (loading && payouts.length === 0 && refunds.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 animate-spin text-blue-600 mx-auto mb-3 sm:mb-4" />
          <p className="text-gray-600 text-xs sm:text-sm md:text-base">Loading finance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                <span className="truncate">Finance & Payout Control</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
                Manage payouts, refunds, and financial operations
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchFinanceData()}
              disabled={loading}
              className="btn-secondary flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 pt-3 sm:pt-4">
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button type="button" onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800 text-sm font-medium">Dismiss</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-5 md:py-6 space-y-4 sm:space-y-5 md:space-y-6">
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="flex -mb-px min-w-max sm:min-w-0">
              {(['overview', 'payouts', 'refunds'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab === 'overview' && 'Overview'}
                  {tab === 'payouts' && `Payouts (${stats.pendingPayouts})`}
                  {tab === 'refunds' && `Refunds (${stats.pendingRefunds})`}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-4 sm:p-5 md:p-6">
            {activeTab === 'overview' && (
              <div className="space-y-4 sm:space-y-5 md:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 sm:p-5 md:p-6 text-white">
                    <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 mb-1.5 sm:mb-2" />
                    <p className="text-xs sm:text-sm opacity-90">Today&apos;s Revenue</p>
                    <p className="text-2xl sm:text-2.5xl md:text-3xl font-bold">₹{formatInK(stats.todayRevenue)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 sm:p-5 md:p-6 text-white">
                    <DollarSign className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 mb-1.5 sm:mb-2" />
                    <p className="text-xs sm:text-sm opacity-90">Monthly Revenue</p>
                    <p className="text-2xl sm:text-2.5xl md:text-3xl font-bold">₹{formatInK(stats.monthlyRevenue)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-4 sm:p-5 md:p-6 text-white sm:col-span-2 lg:col-span-1">
                    <Clock className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 mb-1.5 sm:mb-2" />
                    <p className="text-xs sm:text-sm opacity-90">Pending Lead Approval</p>
                    <p className="text-2xl sm:text-2.5xl md:text-3xl font-bold">{stats.pendingPayouts + stats.pendingRefunds}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                  <div className="border rounded-lg p-4 sm:p-5 md:p-6">
                    <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                      <span>Pending Payouts</span>
                    </h3>
                    <div className="text-2xl sm:text-2.5xl md:text-3xl font-bold text-gray-900">
                      ₹{formatInK(stats.pendingPayoutsAmount)}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">{stats.pendingPayouts} requests</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('payouts')}
                      className="mt-3 sm:mt-4 text-blue-600 hover:text-blue-700 text-xs sm:text-sm font-medium"
                    >
                      View All →
                    </button>
                  </div>

                  <div className="border rounded-lg p-4 sm:p-5 md:p-6">
                    <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                      <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0" />
                      <span>Pending Refunds</span>
                    </h3>
                    <div className="text-2xl sm:text-2.5xl md:text-3xl font-bold text-gray-900">
                      ₹{formatInK(stats.pendingRefundsAmount)}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">{stats.pendingRefunds} requests</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('refunds')}
                      className="mt-3 sm:mt-4 text-blue-600 hover:text-blue-700 text-xs sm:text-sm font-medium"
                    >
                      View All →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'payouts' && (
              <div className="space-y-3 sm:space-y-4">
                {payouts.length === 0 ? (
                  <div className="text-center py-8 sm:py-10 md:py-12 text-gray-500 text-sm sm:text-base">
                    No pending payouts
                  </div>
                ) : (
                  payouts.map((payout) => (
                    <div key={payout.id} className="border rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-sm sm:text-base truncate">{payout.workshop?.name ?? 'Workshop'}</h4>
                        <p className="text-xs sm:text-sm text-gray-600">{formatDateDMY(payout.created_at)}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                        <div className="text-left sm:text-right">
                          <div className="text-lg sm:text-xl font-bold text-gray-900">₹{formatInK(Number(payout.amount || 0))}</div>
                          <div className="text-xs sm:text-sm text-gray-500">{payout.total_jobs ?? 0} jobs</div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => handleApprovePayout(payout.id)}
                            disabled={actionId === payout.id}
                            className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white text-xs sm:text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {actionId === payout.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectPayout(payout.id)}
                            disabled={actionId === payout.id}
                            className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white text-xs sm:text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                          >
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
              <div className="space-y-3 sm:space-y-4">
                {refunds.length === 0 ? (
                  <div className="text-center py-8 sm:py-10 md:py-12 text-gray-500 text-sm sm:text-base">
                    No pending refunds
                  </div>
                ) : (
                  refunds.map((refund) => (
                    <div key={refund.id} className="border rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-sm sm:text-base truncate">{refund.lead?.customer_name ?? 'Customer'}</h4>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{refund.reason}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">{formatDateDMY(refund.created_at)}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                        <div className="text-left sm:text-right">
                          <div className="text-lg sm:text-xl font-bold text-red-600">₹{formatInK(Number(refund.amount || 0))}</div>
                          <div className="text-xs sm:text-sm text-gray-500">{refund.refund_type ?? '—'}</div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => handleApproveRefund(refund.id)}
                            disabled={actionId === refund.id}
                            className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white text-xs sm:text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {actionId === refund.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectRefund(refund.id)}
                            disabled={actionId === refund.id}
                            className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white text-xs sm:text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                          >
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
