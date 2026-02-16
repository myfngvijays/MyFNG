'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { RSAManagerService } from '@/lib/services/rsaManagerService';
import { formatDateDMY, formatDateTimeISTAssumeUTC } from '@/lib/utils';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock3,
  RefreshCw,
  XCircle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

type DatePreset = '7d' | '30d' | '90d' | 'custom';

function getISTDateInput(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function pickLeadDate(lead: any): string {
  return String(lead?.lead_registered_at || lead?.requested_at || lead?.created_at || '');
}

function safeStatus(raw: any): string {
  return String(raw || '').toLowerCase();
}

function isCompleted(raw: any): boolean {
  const s = safeStatus(raw);
  return s === 'completed' || s === 'closed';
}

function isCancelled(raw: any): boolean {
  return safeStatus(raw) === 'cancelled';
}

function isPending(raw: any): boolean {
  return !isCompleted(raw) && !isCancelled(raw);
}

export default function RSAManagerReportsPage() {
  const supabase = getBrowserClient();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [managerId, setManagerId] = useState<string>('');
  const [leads, setLeads] = useState<any[]>([]);

  const today = useMemo(() => new Date(), []);
  const [preset, setPreset] = useState<DatePreset>('30d');
  const [fromDate, setFromDate] = useState(() => getISTDateInput(addDays(today, -29)));
  const [toDate, setToDate] = useState(() => getISTDateInput(today));

  const loadManagerAndReports = async () => {
    setError('');
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setManagerId('');
        setLeads([]);
        setError('Please login again to view reports.');
        return;
      }
      setManagerId(user.id);

      const rows = await RSAManagerService.getAllLeads(user.id, '', false);
      const assignedOnly = (Array.isArray(rows) ? rows : []).filter(
        (lead: any) => String(lead?.assigned_manager_id || '') === String(user.id)
      );
      setLeads(assignedOnly);
    } catch (e: any) {
      console.error('Failed to load RSA reports:', e);
      setError(e?.message || 'Failed to load reports');
      setLeads([]);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await loadManagerAndReports();
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadManagerAndReports();
    setRefreshing(false);
  };

  const onPresetChange = (next: DatePreset) => {
    setPreset(next);
    if (next === 'custom') return;
    const now = new Date();
    const days = next === '7d' ? 6 : next === '30d' ? 29 : 89;
    setFromDate(getISTDateInput(addDays(now, -days)));
    setToDate(getISTDateInput(now));
  };

  const filteredLeads = useMemo(() => {
    const fromMs = new Date(`${fromDate}T00:00:00`).getTime();
    const toMs = new Date(`${toDate}T23:59:59`).getTime();
    return leads.filter((lead) => {
      const raw = pickLeadDate(lead);
      const ms = new Date(raw).getTime();
      if (!Number.isFinite(ms)) return false;
      return ms >= fromMs && ms <= toMs;
    });
  }, [leads, fromDate, toDate]);

  const reportStats = useMemo(() => {
    const total = filteredLeads.length;
    const completed = filteredLeads.filter((l) => isCompleted(l?.lead_status || l?.complaint_status)).length;
    const cancelled = filteredLeads.filter((l) => isCancelled(l?.lead_status || l?.complaint_status)).length;
    const pending = filteredLeads.filter((l) => isPending(l?.lead_status || l?.complaint_status)).length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;

    const serviceMap: Record<string, number> = {};
    const dailyMap: Record<string, number> = {};
    for (const lead of filteredLeads) {
      const service = String(lead?.service_type || 'Other').trim() || 'Other';
      serviceMap[service] = (serviceMap[service] || 0) + 1;

      const d = pickLeadDate(lead);
      const dayKey = d ? d.slice(0, 10) : '';
      if (dayKey) dailyMap[dayKey] = (dailyMap[dayKey] || 0) + 1;
    }

    const serviceBreakdown = Object.entries(serviceMap)
      .map(([name, count]) => ({
        name,
        count,
        percent: total ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const dailyTrend = Object.entries(dailyMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);

    const recent = [...filteredLeads]
      .sort((a, b) => new Date(pickLeadDate(b)).getTime() - new Date(pickLeadDate(a)).getTime())
      .slice(0, 10);

    return { total, pending, completed, cancelled, completionRate, serviceBreakdown, dailyTrend, recent };
  }, [filteredLeads]);

  const maxDaily = Math.max(1, ...reportStats.dailyTrend.map((d) => d.count));

  return (
    <DashboardLayout role="rsa_manager">
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-5 md:space-y-6">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Reports</h1>
              <p className="text-white/90 text-xs sm:text-sm mt-1">RSA manager performance and complaint analytics</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onRefresh}
                className="btn btn-outline bg-white/10 border-white/30 text-white hover:bg-white/20 text-xs sm:text-sm"
                disabled={refreshing || loading}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">Date Range</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['7d', '30d', '90d', 'custom'] as DatePreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPresetChange(p)}
                  className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition ${
                    preset === p ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {p === 'custom' ? 'Custom' : `Last ${p.replace('d', ' days')}`}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center lg:ml-auto">
              <input
                type="date"
                className="border rounded-md px-3 py-2 text-sm"
                value={fromDate}
                onChange={(e) => {
                  setPreset('custom');
                  setFromDate(e.target.value);
                }}
              />
              <span className="text-sm text-gray-500 hidden sm:block">to</span>
              <input
                type="date"
                className="border rounded-md px-3 py-2 text-sm"
                value={toDate}
                onChange={(e) => {
                  setPreset('custom');
                  setToDate(e.target.value);
                }}
              />
            </div>
          </div>
        </div>

        {error ? <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div> : null}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{loading ? '—' : reportStats.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500">Pending</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{loading ? '—' : reportStats.pending}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500">Completed</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{loading ? '—' : reportStats.completed}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500">Cancelled</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{loading ? '—' : reportStats.cancelled}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500">Completion Rate</div>
            <div className="text-2xl font-bold text-indigo-600 mt-1">{loading ? '—' : `${reportStats.completionRate}%`}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          <div className="bg-white rounded-lg shadow p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Service Type Distribution</h2>
            </div>
            {reportStats.serviceBreakdown.length ? (
              <div className="space-y-3">
                {reportStats.serviceBreakdown.map((row) => (
                  <div key={row.name}>
                    <div className="flex items-center justify-between text-xs sm:text-sm mb-1">
                      <span className="text-gray-700">{row.name}</span>
                      <span className="font-semibold text-gray-900">
                        {row.count} ({row.percent}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-2 bg-indigo-500 rounded-full" style={{ width: `${row.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 py-6 text-center">No data in selected range.</div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock3 className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Daily Complaint Trend (Last 14)</h2>
            </div>
            {reportStats.dailyTrend.length ? (
              <div className="space-y-2">
                {reportStats.dailyTrend.map((row) => (
                  <div key={row.date} className="grid grid-cols-[72px_1fr_36px] items-center gap-2 text-xs sm:text-sm">
                    <div className="text-gray-600">{formatDateDMY(row.date)}</div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-sky-500 rounded-full"
                        style={{ width: `${Math.max(6, Math.round((row.count / maxDaily) * 100))}%` }}
                      />
                    </div>
                    <div className="text-right font-semibold text-gray-900">{row.count}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 py-6 text-center">No trend data in selected range.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-4">Recent Complaints</h2>
          {!reportStats.recent.length ? (
            <div className="text-sm text-gray-500 py-6 text-center">No complaints found for selected dates.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left border-b text-gray-600">
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">Service</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Mechanic</th>
                    <th className="py-2 pr-3">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {reportStats.recent.map((lead) => {
                    const status = safeStatus(lead?.lead_status || lead?.complaint_status);
                    const statusClass = isCompleted(status)
                      ? 'bg-green-100 text-green-700'
                      : isCancelled(status)
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700';
                    return (
                      <tr key={lead.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-3">
                          <div className="font-semibold text-gray-900">{lead.customer_name || '—'}</div>
                          <div className="text-[11px] text-gray-500">{lead.contact_number || '—'}</div>
                        </td>
                        <td className="py-2 pr-3">{lead.service_type || '—'}</td>
                        <td className="py-2 pr-3">
                          <span className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-semibold ${statusClass}`}>
                            {status || 'pending'}
                          </span>
                        </td>
                        <td className="py-2 pr-3">{lead.assigned_mechanic_name || '—'}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {formatDateTimeISTAssumeUTC(pickLeadDate(lead))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="text-[11px] text-gray-500 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Showing assigned complaints for manager: {managerId || '—'}
          <XCircle className="w-3.5 h-3.5 ml-2 text-red-400" />
          Timezone display: IST
        </div>
      </div>
    </DashboardLayout>
  );
}

