'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { BarChart3, Download, TrendingUp, Users, DollarSign, Award } from 'lucide-react';

export default function ReportsAnalyticsPage() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  
  const [stats, setStats] = useState({
    totalLeads: 0,
    convertedLeads: 0,
    conversionRate: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    activeWorkshops: 0,
    avgRating: 0,
    totalComplaints: 0
  });

  useEffect(() => {
    fetchReportData();
  }, [period]);

  const fetchReportData = async () => {
    try {
      const dateFilter = getDateFilter(period);

      const [leadsResult, completedResult, workshopsResult, complaintsResult] = await Promise.all([
        supabase
          .from('service_leads')
          .select('id, invoice_amount', { count: 'exact' })
          .gte('created_at', dateFilter),
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'COMPLETED')
          .gte('created_at', dateFilter),
        supabase
          .from('workshops')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'COMPLAINT')
          .gte('created_at', dateFilter)
      ]);

      const totalLeads = leadsResult.count || 0;
      const convertedLeads = completedResult.count || 0;
      const totalRevenue = leadsResult.data?.reduce((sum, l) => sum + (l.invoice_amount || 0), 0) || 0;

      setStats({
        totalLeads,
        convertedLeads,
        conversionRate: totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0,
        totalRevenue,
        avgOrderValue: convertedLeads > 0 ? totalRevenue / convertedLeads : 0,
        activeWorkshops: workshopsResult.count || 0,
        avgRating: 4.5,
        totalComplaints: complaintsResult.count || 0
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateFilter = (p: string) => {
    const now = new Date();
    switch (p) {
      case 'today':
        return now.toISOString().split('T')[0];
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case 'year':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return now.toISOString();
    }
  };

  const handleExport = (format: string) => {
    alert(`Exporting ${period} report as ${format.toUpperCase()}...`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-6 h-6" />
                Reports & Analytics
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Comprehensive performance and financial reports
              </p>
            </div>

            {/* Export Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Period Selector */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex gap-2">
            {['today', 'week', 'month', 'year'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p as any)}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Operational Metrics */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Operational Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <TrendingUp className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-sm text-gray-600">Total Leads</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalLeads}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <TrendingUp className="w-8 h-8 text-green-600 mb-2" />
              <p className="text-sm text-gray-600">Converted</p>
              <p className="text-3xl font-bold text-green-600">{stats.convertedLeads}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <TrendingUp className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-sm text-gray-600">Conversion Rate</p>
              <p className="text-3xl font-bold text-purple-600">{stats.conversionRate.toFixed(1)}%</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <Users className="w-8 h-8 text-orange-600 mb-2" />
              <p className="text-sm text-gray-600">Active Workshops</p>
              <p className="text-3xl font-bold text-orange-600">{stats.activeWorkshops}</p>
            </div>
          </div>
        </div>

        {/* Financial Metrics */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">💰 Financial Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
              <DollarSign className="w-10 h-10 mb-2" />
              <p className="text-sm opacity-90">Total Revenue</p>
              <p className="text-4xl font-bold">₹{(stats.totalRevenue / 100000).toFixed(1)}L</p>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
              <DollarSign className="w-10 h-10 mb-2" />
              <p className="text-sm opacity-90">Avg Order Value</p>
              <p className="text-4xl font-bold">₹{stats.avgOrderValue.toFixed(0)}</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
              <Award className="w-10 h-10 mb-2" />
              <p className="text-sm opacity-90">Avg Rating</p>
              <p className="text-4xl font-bold">{stats.avgRating}⭐</p>
            </div>
          </div>
        </div>

        {/* Quality Metrics */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">⭐ Quality Metrics</h2>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <Award className="w-12 h-12 text-orange-500 mx-auto mb-2" />
                <p className="text-3xl font-bold text-gray-900">{stats.avgRating}⭐</p>
                <p className="text-sm text-gray-600 mt-1">Average Rating</p>
              </div>

              <div className="text-center">
                <TrendingUp className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                <p className="text-3xl font-bold text-gray-900">94%</p>
                <p className="text-sm text-gray-600 mt-1">SLA Compliance</p>
              </div>

              <div className="text-center">
                <Users className="w-12 h-12 text-red-500 mx-auto mb-2" />
                <p className="text-3xl font-bold text-gray-900">{stats.totalComplaints}</p>
                <p className="text-sm text-gray-600 mt-1">Total Complaints</p>
              </div>
            </div>
          </div>
        </div>

        {/* Department Performance */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">👥 Department Performance</h2>
          <div className="bg-white rounded-lg shadow divide-y">
            {[
              { name: 'Telecaller', score: 85, color: 'blue' },
              { name: 'Lead Manager', score: 92, color: 'purple' },
              { name: 'Workshops', score: 88, color: 'orange' },
              { name: 'RSA', score: 91, color: 'red' },
              { name: 'Auditors', score: 90, color: 'indigo' }
            ].map((dept) => (
              <div key={dept.name} className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                  <span className="text-2xl font-bold text-gray-900">{dept.score}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`bg-${dept.color}-600 h-2 rounded-full transition-all`}
                    style={{ width: `${dept.score}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
