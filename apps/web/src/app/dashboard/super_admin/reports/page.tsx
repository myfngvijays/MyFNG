'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Download, TrendingUp, Users, DollarSign, Award, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';

function formatInK(value: number): string {
  const k = value / 1000;
  if (k === 0) return '0K';
  return k >= 1 ? `${k.toFixed(1)}K` : `${k.toFixed(2)}K`;
}

type Period = 'today' | 'week' | 'month' | 'year';

interface ReportStats {
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  totalRevenue: number;
  avgOrderValue: number;
  activeWorkshops: number;
  avgRating: number;
  slaCompliance: number;
  totalComplaints: number;
}

interface DepartmentRow {
  name: string;
  leads: number;
  converted: number;
  score: number;
}

const DEFAULT_STATS: ReportStats = {
  totalLeads: 0,
  convertedLeads: 0,
  conversionRate: 0,
  totalRevenue: 0,
  avgOrderValue: 0,
  activeWorkshops: 0,
  avgRating: 0,
  slaCompliance: 0,
  totalComplaints: 0,
};

export default function ReportsAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [stats, setStats] = useState<ReportStats>(DEFAULT_STATS);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);

  const fetchReportData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/super_admin/reports?period=${period}`);
      const data = await response.json();

      if (!response.ok) {
        const msg = data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to load reports');
        setError(msg);
        toast.error(msg);
        setStats(DEFAULT_STATS);
        setDepartments([]);
        return;
      }

      setStats(data.stats ?? DEFAULT_STATS);
      setDepartments(data.departments ?? []);
    } catch (e) {
      const msg = 'Failed to load reports';
      setError(msg);
      toast.error(msg);
      setStats(DEFAULT_STATS);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const buildReportRows = () => [
    ['Period', period],
    ['Generated', new Date().toISOString()],
    [],
    ['Operational', ''],
    ['Total Leads', stats.totalLeads],
    ['Converted', stats.convertedLeads],
    ['Conversion Rate %', stats.conversionRate.toFixed(1)],
    ['Active Workshops', stats.activeWorkshops],
    [],
    ['Financial', ''],
    ['Total Revenue (₹)', stats.totalRevenue],
    ['Avg Order Value (₹)', stats.avgOrderValue.toFixed(0)],
    [],
    ['Quality', ''],
    ['Avg Rating', stats.avgRating],
    ['SLA Compliance %', stats.slaCompliance],
    ['Total Complaints', stats.totalComplaints],
    [],
    ['Department', 'Leads', 'Converted', 'Score %'],
    ...departments.map((d) => [d.name, d.leads, d.converted, d.score]),
  ];

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (format: string) => {
    const stamp = new Date().toISOString().slice(0, 10);
    const rows = buildReportRows();

    if (format === 'csv' || format === 'excel') {
      const csv = rows
        .map((r) =>
          r
            .map((cell) => {
              const value = String(cell ?? '');
              return value.includes(',') || value.includes('"') || value.includes('\n')
                ? `"${value.replace(/"/g, '""')}"`
                : value;
            })
            .join(','),
        )
        .join('\n');
      const isExcel = format === 'excel';
      downloadBlob(
        new Blob(['\uFEFF' + csv], {
          type: isExcel ? 'application/vnd.ms-excel;charset=utf-8' : 'text/csv;charset=utf-8',
        }),
        `reports-${period}-${stamp}.${isExcel ? 'xls' : 'csv'}`,
      );
      toast.success(isExcel ? 'Report exported for Excel' : 'Report exported as CSV');
      return;
    }

    if (format === 'pdf') {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>MyFNG Reports</title>
        <style>
          body{font-family:Arial,sans-serif;padding:24px;color:#111}
          h1{font-size:20px;margin:0 0 8px}
          p{color:#555;margin:0 0 16px;font-size:12px}
          table{border-collapse:collapse;width:100%;font-size:12px}
          td,th{border:1px solid #ddd;padding:8px;text-align:left}
          th{background:#f3f4f6}
        </style></head><body>
        <h1>MyFNG Reports & Analytics</h1>
        <p>Period: ${period} · Generated: ${new Date().toLocaleString('en-IN')}</p>
        <table><tbody>
        ${rows
          .filter((r) => r.length > 0)
          .map((r) => `<tr>${r.map((c) => `<td>${String(c ?? '')}</td>`).join('')}</tr>`)
          .join('')}
        </tbody></table>
        <script>window.onload=function(){window.print();}</script>
        </body></html>`;
      const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
      if (!win) {
        toast.error('Allow popups to export PDF');
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      toast.success('PDF print dialog opened');
      return;
    }

    toast.error('Unsupported export format');
  };

  if (loading && stats.totalLeads === 0 && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 animate-spin text-blue-600 mx-auto mb-3 sm:mb-4" />
          <p className="text-gray-600 text-xs sm:text-sm md:text-base">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                <span className="truncate">Reports & Analytics</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
                Comprehensive performance and financial reports
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => fetchReportData()}
                disabled={loading}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => handleExport('csv')}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none justify-center"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                CSV
              </button>
              <button
                type="button"
                onClick={() => handleExport('pdf')}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none justify-center"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                PDF
              </button>
              <button
                type="button"
                onClick={() => handleExport('excel')}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none justify-center"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Excel
              </button>
            </div>
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
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex flex-wrap gap-2">
            {(['today', 'week', 'month', 'year'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-4 sm:px-5 md:px-6 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  period === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Operational Performance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
              <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-600 mb-1.5 sm:mb-2" />
              <p className="text-xs sm:text-sm text-gray-600">Total Leads</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{stats.totalLeads}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
              <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-green-600 mb-1.5 sm:mb-2" />
              <p className="text-xs sm:text-sm text-gray-600">Converted</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">{stats.convertedLeads}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
              <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-purple-600 mb-1.5 sm:mb-2" />
              <p className="text-xs sm:text-sm text-gray-600">Conversion Rate</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-600">{stats.conversionRate.toFixed(1)}%</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
              <Users className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-orange-600 mb-1.5 sm:mb-2" />
              <p className="text-xs sm:text-sm text-gray-600">Active Workshops</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-600">{stats.activeWorkshops}</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Financial Performance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-4 sm:p-5 md:p-6 text-white">
              <DollarSign className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 mb-1.5 sm:mb-2" />
              <p className="text-xs sm:text-sm opacity-90">Total Revenue</p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold">₹{formatInK(stats.totalRevenue)}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-4 sm:p-5 md:p-6 text-white">
              <DollarSign className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 mb-1.5 sm:mb-2" />
              <p className="text-xs sm:text-sm opacity-90">Avg Order Value</p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold">₹{formatInK(stats.avgOrderValue)}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-4 sm:p-5 md:p-6 text-white sm:col-span-2 lg:col-span-1">
              <Award className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 mb-1.5 sm:mb-2" />
              <p className="text-xs sm:text-sm opacity-90">Avg Rating</p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold">{stats.avgRating ? `${stats.avgRating}⭐` : '—'}</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Quality Metrics</h2>
          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
              <div className="text-center">
                <Award className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-orange-500 mx-auto mb-1.5 sm:mb-2" />
                <p className="text-2xl sm:text-2.5xl md:text-3xl font-bold text-gray-900">{stats.avgRating ? `${stats.avgRating}⭐` : '—'}</p>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Average Rating</p>
              </div>
              <div className="text-center">
                <TrendingUp className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-blue-500 mx-auto mb-1.5 sm:mb-2" />
                <p className="text-2xl sm:text-2.5xl md:text-3xl font-bold text-gray-900">{stats.slaCompliance}%</p>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">SLA Compliance</p>
              </div>
              <div className="text-center">
                <Users className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-red-500 mx-auto mb-1.5 sm:mb-2" />
                <p className="text-2xl sm:text-2.5xl md:text-3xl font-bold text-gray-900">{stats.totalComplaints}</p>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Total Complaints</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Department Performance</h2>
          <div className="bg-white rounded-lg shadow divide-y">
            {departments.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">No department data for this period.</div>
            ) : (
              departments.map((dept) => (
                <div key={dept.name} className="p-4 sm:p-5 md:p-6">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <h3 className="font-semibold text-sm sm:text-base text-gray-900">{dept.name}</h3>
                    <span className="text-lg sm:text-xl font-bold text-gray-900">{dept.score}/100</span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-2">
                    {dept.leads} leads · {dept.converted} converted
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, dept.score)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
