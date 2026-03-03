'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import WhatsAppMobilePreviewModal from '@/components/shared/WhatsAppMobilePreviewModal';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { RSAManagerService } from '@/lib/services/rsaManagerService';
import { formatDateDMY, formatDateTimeISTAssumeUTC } from '@/lib/utils';
import Link from 'next/link';
import {
  BarChart3,
  Calendar,
  Clock3,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  UserCheck,
  PhoneCall,
  Award,
} from 'lucide-react';

type PerformanceData = {
  avgFirstActionMinutes: number | null;
  pendingAgingBuckets: { key: string; label: string; count: number }[];
  mechanicAssignmentWithinSlaPercent: number | null;
  mechanicAssignedTotal: number;
  repeatContactCount: number;
  topDelayReasons: { name: string; count: number }[];
  auditSnapshot: {
    auditedCount: number;
    avgScore: number | null;
    lowScoreCalls: { sarv_call_id: string; audit_score: number; feedback: string | null }[];
  };
  needsAttention: { id: string; customer_name: string; contact_number: string; lead_status: string; lead_registered_at: string }[];
};

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
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [hoveredService, setHoveredService] = useState<{ name: string; count: number; percent: number } | null>(null);
  const [hoveredBar, setHoveredBar] = useState<{ date: string; count: number; completed: number; pending: number; cancelled: number } | null>(null);
  const [waPreviewOpen, setWaPreviewOpen] = useState(false);
  const [waPreviewPhone, setWaPreviewPhone] = useState('');

  const openWhatsAppPreview = (phone: string | null | undefined) => {
    const value = String(phone || '').trim();
    if (!value) return;
    setWaPreviewPhone(value);
    setWaPreviewOpen(true);
  };

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

  useEffect(() => {
    let mounted = true;
    const fromISO = new Date(`${fromDate}T00:00:00`).toISOString();
    const toISO = new Date(`${toDate}T23:59:59.999`).toISOString();
    setPerformanceLoading(true);
    fetch(`/api/rsa/manager-performance?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`)
      .then((res) => res.json())
      .then((data) => {
        if (mounted && !data.error) setPerformance(data);
      })
      .catch(() => {
        if (mounted) setPerformance(null);
      })
      .finally(() => {
        if (mounted) setPerformanceLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [fromDate, toDate]);

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
    const dailyMap: Record<string, { completed: number; pending: number; cancelled: number }> = {};
    for (const lead of filteredLeads) {
      const service = String(lead?.service_type || 'Other').trim() || 'Other';
      serviceMap[service] = (serviceMap[service] || 0) + 1;

      const d = pickLeadDate(lead);
      const dayKey = d ? d.slice(0, 10) : '';
      if (!dayKey) continue;
      if (!dailyMap[dayKey]) dailyMap[dayKey] = { completed: 0, pending: 0, cancelled: 0 };
      const status = (lead?.lead_status || lead?.complaint_status || '').toString().toLowerCase();
      if (isCompleted(lead?.lead_status || lead?.complaint_status)) dailyMap[dayKey].completed += 1;
      else if (isCancelled(lead?.lead_status || lead?.complaint_status)) dailyMap[dayKey].cancelled += 1;
      else dailyMap[dayKey].pending += 1;
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
      .map(([date, breakdown]) => ({
        date,
        count: breakdown.completed + breakdown.pending + breakdown.cancelled,
        completed: breakdown.completed,
        pending: breakdown.pending,
        cancelled: breakdown.cancelled,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { total, pending, completed, cancelled, completionRate, serviceBreakdown, dailyTrend };
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

        {/* Actionable Performance */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            Actionable Performance
          </h2>
          {performanceLoading ? (
            <div className="text-sm text-gray-500 py-6 text-center">Loading performance metrics…</div>
          ) : performance ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1">
                    <Clock3 className="w-3 h-3" />
                    Avg first action (min)
                  </div>
                  <div className="text-lg font-bold text-gray-900 mt-0.5">
                    {performance.avgFirstActionMinutes != null ? performance.avgFirstActionMinutes : '—'}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    Mechanic SLA %
                  </div>
                  <div className="text-lg font-bold text-indigo-600 mt-0.5">
                    {performance.mechanicAssignmentWithinSlaPercent != null
                      ? `${performance.mechanicAssignmentWithinSlaPercent}%`
                      : '—'}
                  </div>
                  {performance.mechanicAssignedTotal > 0 && (
                    <div className="text-[10px] text-gray-400">of {performance.mechanicAssignedTotal} assigned</div>
                  )}
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1">
                    <PhoneCall className="w-3 h-3" />
                    Repeat contacts
                  </div>
                  <div className="text-lg font-bold text-amber-600 mt-0.5">{performance.repeatContactCount}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    Audited / avg score
                  </div>
                  <div className="text-lg font-bold text-gray-900 mt-0.5">
                    {performance.auditSnapshot.auditedCount}
                    {performance.auditSnapshot.avgScore != null ? ` / ${performance.auditSnapshot.avgScore}` : ''}
                  </div>
                </div>
                <div className="rounded-lg border p-3 col-span-2 sm:col-span-1">
                  <div className="text-[10px] sm:text-xs text-gray-500">Pending aging</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {performance.pendingAgingBuckets.map((b) => (
                      <span
                        key={b.key}
                        className="text-xs font-semibold text-gray-700"
                        title={b.label}
                      >
                        {b.key}: {b.count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {performance.topDelayReasons.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-2">Top delay reasons (disposition)</div>
                  <div className="flex flex-wrap gap-2">
                    {performance.topDelayReasons.map((r) => (
                      <span
                        key={r.name}
                        className="px-2 py-1 rounded-md bg-gray-100 text-xs font-medium text-gray-800"
                      >
                        {r.name}: {r.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {performance.auditSnapshot.lowScoreCalls.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Low audit score (coaching)
                  </div>
                  <ul className="text-xs text-gray-700 space-y-1">
                    {performance.auditSnapshot.lowScoreCalls.slice(0, 5).map((c) => (
                      <li key={c.sarv_call_id}>
                        Call {c.sarv_call_id.slice(0, 8)}… — Score: {c.audit_score}
                        {c.feedback ? ` — ${c.feedback.slice(0, 60)}…` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {performance.needsAttention.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-2">Needs attention (oldest pending)</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left border-b text-gray-600">
                          <th className="py-1.5 pr-2">Customer</th>
                          <th className="py-1.5 pr-2">Phone</th>
                          <th className="py-1.5 pr-2">Status</th>
                          <th className="py-1.5 pr-2">Registered</th>
                          <th className="py-1.5 pr-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {performance.needsAttention.slice(0, 10).map((row) => (
                          <tr key={row.id} className="border-b last:border-b-0">
                            <td className="py-1.5 pr-2 font-medium">{row.customer_name || '—'}</td>
                            <td className="py-1.5 pr-2">
                              {row.contact_number ? (
                                <button
                                  type="button"
                                  className="text-green-700 hover:text-green-800 underline underline-offset-2"
                                  onClick={() => openWhatsAppPreview(row.contact_number)}
                                >
                                  {row.contact_number}
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-1.5 pr-2">{row.lead_status || '—'}</td>
                            <td className="py-1.5 pr-2 whitespace-nowrap">
                              {formatDateTimeISTAssumeUTC(row.lead_registered_at)}
                            </td>
                            <td className="py-1.5 pr-2">
                              <Link
                                href={`/dashboard/rsa_manager/leads/${row.id}`}
                                className="text-indigo-600 hover:text-indigo-700 font-semibold"
                              >
                                Open
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500 py-4 text-center">Performance data unavailable for this range.</div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          <div className="bg-white rounded-lg shadow p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Service Type Distribution</h2>
            </div>
            {reportStats.serviceBreakdown.length ? (
              (() => {
                const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                const size = 176;
                const cx = size / 2;
                const cy = size / 2;
                const r = (size / 2) - 8;
                const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
                const getXY = (angleDeg: number) => ({
                  x: cx + r * Math.cos(toRad(angleDeg)),
                  y: cy + r * Math.sin(toRad(angleDeg)),
                });
                let acc = 0;
                const slices = reportStats.serviceBreakdown.map((row, i) => {
                  const startDeg = acc * 3.6;
                  acc += row.percent;
                  const endDeg = acc * 3.6;
                  const start = getXY(startDeg);
                  const end = getXY(endDeg);
                  const large = row.percent > 50 ? 1 : 0;
                  const d = `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
                  return { ...row, d, color: colors[i % colors.length] };
                });
                return (
                  <div className="flex flex-col sm:flex-row items-center gap-4 relative">
                    <div
                      className="relative flex-shrink-0"
                      onMouseLeave={() => setHoveredService(null)}
                    >
                      <svg width={size} height={size} className="drop-shadow-md">
                        {slices.map((slice, i) => (
                          <path
                            key={slice.name}
                            d={slice.d}
                            fill={slice.color}
                            className="cursor-pointer transition-opacity hover:opacity-90"
                            onMouseEnter={() => setHoveredService({ name: slice.name, count: slice.count, percent: slice.percent })}
                          />
                        ))}
                      </svg>
                      {hoveredService && (
                        <div
                          className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full pointer-events-none z-10 mb-1"
                        >
                          <div className="bg-gray-900 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                            <div className="font-semibold">{hoveredService.name}</div>
                            <div>Count: {hoveredService.count}</div>
                            <div>{hoveredService.percent}% of total</div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 min-w-0">
                      {reportStats.serviceBreakdown.map((row, i) => (
                        <div
                          key={row.name}
                          className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-gray-100"
                          onMouseEnter={() => setHoveredService({ name: row.name, count: row.count, percent: row.percent })}
                          onMouseLeave={() => setHoveredService(null)}
                        >
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: colors[i % colors.length] }}
                          />
                          <span className="text-gray-700 truncate">{row.name}</span>
                          <span className="font-semibold text-gray-900 whitespace-nowrap">
                            {row.count} ({row.percent}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-sm text-gray-500 py-6 text-center">No data in selected range.</div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Clock3 className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm sm:text-base font-bold text-gray-900">Daily Complaint Trend (Selected range)</h2>
              </div>
              <div className="flex items-center gap-4 text-[10px] sm:text-xs text-gray-600">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Completed</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Pending</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Cancelled</span>
              </div>
            </div>
            {reportStats.dailyTrend.length ? (
              <div
                className="flex gap-1 sm:gap-2 min-h-[160px] relative"
                style={{ alignItems: 'flex-end' }}
                onMouseLeave={() => setHoveredBar(null)}
              >
                {reportStats.dailyTrend.map((row) => {
                  const isHovered = hoveredBar?.date === row.date;
                  const totalHeight = Math.max(8, Math.round((row.count / maxDaily) * 120));
                  const scale = row.count > 0 ? totalHeight / row.count : 0;
                  const hCompleted = Math.round(row.completed * scale);
                  const hPending = Math.round(row.pending * scale);
                  const hCancelled = Math.round(row.cancelled * scale);
                  return (
                    <div
                      key={row.date}
                      className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1 relative"
                      onMouseEnter={() => setHoveredBar({ date: row.date, count: row.count, completed: row.completed, pending: row.pending, cancelled: row.cancelled })}
                    >
                      {isHovered && hoveredBar && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10 pointer-events-none">
                          <div className="bg-gray-900 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                            <div className="font-semibold">{formatDateDMY(row.date)}</div>
                            <div className="text-green-300">Completed: {hoveredBar.completed}</div>
                            <div className="text-amber-300">Pending: {hoveredBar.pending}</div>
                            <div className="text-red-300">Cancelled: {hoveredBar.cancelled}</div>
                            <div className="border-t border-gray-600 mt-1 pt-1">Total: {hoveredBar.count}</div>
                          </div>
                        </div>
                      )}
                      <span className="text-[10px] sm:text-xs font-semibold text-gray-700">
                        {row.count}
                      </span>
                      <div
                        className={`w-full min-w-[8px] min-h-[4px] transition-all cursor-pointer flex flex-col-reverse rounded-t overflow-hidden ${isHovered ? 'ring-2 ring-sky-300' : ''}`}
                        style={{ height: `${totalHeight}px` }}
                      >
                        {row.cancelled > 0 && (
                          <div
                            className="w-full bg-red-500 flex-shrink-0"
                            style={{ height: `${Math.max(1, hCancelled)}px` }}
                          />
                        )}
                        {row.pending > 0 && (
                          <div
                            className="w-full bg-amber-500 flex-shrink-0"
                            style={{ height: `${Math.max(1, hPending)}px` }}
                          />
                        )}
                        {row.completed > 0 && (
                          <div
                            className="w-full bg-green-500 flex-shrink-0"
                            style={{ height: `${Math.max(1, hCompleted)}px` }}
                          />
                        )}
                      </div>
                      <span
                        className="text-[10px] sm:text-xs text-gray-600 text-center truncate w-full"
                        title={formatDateDMY(row.date)}
                      >
                        {formatDateDMY(row.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-500 py-6 text-center">No trend data in selected range.</div>
            )}
          </div>
        </div>

      </div>
      <WhatsAppMobilePreviewModal
        isOpen={waPreviewOpen}
        phoneNumber={waPreviewPhone}
        title="WhatsApp Chat"
        onClose={() => setWaPreviewOpen(false)}
      />
    </DashboardLayout>
  );
}

