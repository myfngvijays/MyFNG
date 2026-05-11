'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/utils';
import {
  Phone,
  Search,
  Loader2,
  RefreshCw,
  PhoneCall,
  CalendarDays,
  Heart,
  ListChecks,
  Download,
  ChevronLeft,
  ChevronRight,
  Play,
  X,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import toast from 'react-hot-toast';

type DialerLead = {
  id: string;
  phone_no: string;
  name: string | null;
  address: string | null;
  regdate: string | null;
  car_number: string | null;
  make: string | null;
  model: string | null;
  disposition: string | null;
  remark: string | null;
  dialer_id: string | null;
  recording_url: string | null;
  intrested_customer_date: string | null;
  created_at: string;
};

type Stats = {
  total: number;
  today: number;
  interested: number;
  by_disposition: { disposition: string; count: number }[];
  by_dialer: { dialer_id: string; count: number }[];
};

const DEFAULT_STATS: Stats = {
  total: 0,
  today: 0,
  interested: 0,
  by_disposition: [],
  by_dialer: [],
};

// Stable, colour-friendly palette for pie chart slices.
const PIE_COLORS = [
  '#4f46e5', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#ec4899', // pink
  '#6b7280', // gray
  '#14b8a6', // teal
  '#eab308', // yellow
  '#7c3aed', // violet
  '#0ea5e9', // sky
];

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Some upstream dialers push the same number duplicated as
 * "9870970300,9870970300". Render a clean, de-duplicated string but keep the
 * original value intact for tel: links so the call still dials the right number.
 */
function displayPhone(phone: string | null | undefined): string {
  if (!phone) return '-';
  const parts = String(phone)
    .split(/[,;|/\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return String(phone);
  const unique: string[] = [];
  for (const p of parts) {
    if (!unique.includes(p)) unique.push(p);
  }
  return unique.join(', ');
}

function primaryPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const parts = String(phone)
    .split(/[,;|/\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts[0] || String(phone);
}

export default function SubAdminDialerLeadsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<DialerLead[]>([]);
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [disposition, setDisposition] = useState('');
  const [dialerId, setDialerId] = useState('');
  // Default to today so the dashboard opens on the freshest data, but user can
  // widen the range (or clear it) any time.
  const initialDate = useMemo(() => todayIsoDate(), []);
  const [fromDate, setFromDate] = useState<string>(initialDate);
  const [toDate, setToDate] = useState<string>(initialDate);

  const [recordingOpen, setRecordingOpen] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingTitle, setRecordingTitle] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
        const { data: profile } = await supabase
          .from('users_login')
          .select('department, roles!inner(role_code)')
          .eq('id', user.id)
          .single();
        const roleCode = ((profile as any)?.roles)?.role_code;
        const dept = (profile as any)?.department;
        const ok = roleCode === 'SUPER_ADMIN' || (roleCode === 'SUB_ADMIN' && dept === 'CSE');
        if (!cancelled) {
          setAllowed(ok);
          setAuthChecked(true);
          if (!ok) {
            toast.error('Access denied. CSE Sub Admin only.');
            router.push('/dashboard/sub_admin');
          }
        }
      } catch (e) {
        if (!cancelled) {
          setAuthChecked(true);
          setAllowed(false);
          router.push('/dashboard/sub_admin');
        }
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (disposition) params.set('disposition', disposition);
      if (dialerId) params.set('dialer_id', dialerId);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await fetch(`/api/subadmin/dialer-leads?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Failed to fetch dialer leads');
      }
      const data = await res.json();
      setLeads(data.leads || []);
      setStats({
        total: data.stats?.total || 0,
        today: data.stats?.today || 0,
        interested: data.stats?.interested || 0,
        by_disposition: data.stats?.by_disposition || [],
        by_dialer: data.stats?.by_dialer || [],
      });
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.total_pages || 1);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to load dialer leads');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, disposition, dialerId, fromDate, toDate]);

  useEffect(() => {
    if (allowed) void fetchData();
  }, [allowed, fetchData]);

  const dispositionOptions = useMemo(
    () => stats.by_disposition,
    [stats.by_disposition]
  );
  const dialerOptions = useMemo(() => stats.by_dialer, [stats.by_dialer]);

  // Group small slices into "Other" so the pie stays readable.
  const pieData = useMemo(() => {
    const list = stats.by_disposition;
    if (list.length === 0) return [] as { name: string; value: number }[];
    const TOP = 8;
    if (list.length <= TOP) {
      return list.map((d) => ({ name: d.disposition || 'Unknown', value: d.count }));
    }
    const top = list.slice(0, TOP);
    const otherCount = list.slice(TOP).reduce((s, d) => s + d.count, 0);
    const result = top.map((d) => ({ name: d.disposition || 'Unknown', value: d.count }));
    if (otherCount > 0) result.push({ name: 'Other', value: otherCount });
    return result;
  }, [stats.by_disposition]);

  const pieTotal = useMemo(() => pieData.reduce((s, d) => s + d.value, 0), [pieData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setDisposition('');
    setDialerId('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const handleResetToToday = () => {
    const t = todayIsoDate();
    setFromDate(t);
    setToDate(t);
    setPage(1);
  };

  const handleExportCsv = () => {
    if (!leads.length) {
      toast.error('No rows to export on this page');
      return;
    }
    const headers = [
      'Created At',
      'Phone',
      'Name',
      'Car Number',
      'Make',
      'Model',
      'Disposition',
      'Remark',
      'Dialer ID',
      'Reg Date',
      'Address',
      'Interested Date',
      'Recording URL',
    ];
    const csvLines = [headers.join(',')];
    const esc = (v: any) => {
      const s = v == null ? '' : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    for (const l of leads) {
      csvLines.push(
        [
          esc(formatDateTime(l.created_at)),
          esc(displayPhone(l.phone_no)),
          esc(l.name),
          esc(l.car_number),
          esc(l.make),
          esc(l.model),
          esc(l.disposition),
          esc(l.remark),
          esc(l.dialer_id),
          esc(l.regdate),
          esc(l.address),
          esc(l.intrested_customer_date),
          esc(l.recording_url),
        ].join(',')
      );
    }
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dialer-leads-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openRecording = (l: DialerLead) => {
    if (!l.recording_url) return;
    setRecordingUrl(l.recording_url);
    setRecordingTitle(
      `${l.name || 'Unknown'} (${displayPhone(l.phone_no)})${l.disposition ? ' • ' + l.disposition : ''}`
    );
    setRecordingOpen(true);
  };

  const closeRecording = () => {
    setRecordingOpen(false);
    setRecordingUrl(null);
    setRecordingTitle('');
  };

  if (!authChecked || !allowed) {
    return (
      <DashboardLayout role="sub_admin">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="sub_admin">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-700 rounded-lg p-4 sm:p-5 md:p-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2">
                <Phone className="w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0" />
                Dialer Leads
              </h1>
              <p className="text-white/90 text-xs sm:text-sm mt-0.5">
                Disposition data pushed from the local dialer. Live view from{' '}
                <span className="font-mono">dialer_leads</span>.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs sm:text-sm font-medium"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Refresh
              </button>
              <button
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-700 hover:bg-white/90 rounded-lg text-xs sm:text-sm font-semibold"
                title="Export current page as CSV"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Export
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Leads"
            value={stats.total}
            icon={<ListChecks className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />}
            tone="blue"
          />
          <StatCard
            label="Today"
            value={stats.today}
            icon={<CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />}
            tone="emerald"
          />
          <StatCard
            label="Interested"
            value={stats.interested}
            icon={<Heart className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600" />}
            tone="rose"
          />
          <StatCard
            label="Dispositions"
            value={stats.by_disposition.length}
            icon={<PhoneCall className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />}
            tone="amber"
          />
        </div>

        {/* Pie chart + Disposition Breakdown chips */}
        {stats.by_disposition.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row gap-5">
              {/* Pie chart */}
              <div className="lg:w-1/2">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-indigo-600" />
                    Disposition Pie
                  </h2>
                  <span className="text-xs text-gray-500">
                    {pieTotal.toLocaleString()} leads in range
                  </span>
                </div>
                <div className="h-64 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius="78%"
                        innerRadius="46%"
                        paddingAngle={1}
                        label={({ percent }) =>
                          percent && percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ''
                        }
                        labelLine={false}
                      >
                        {pieData.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          `${Number(value).toLocaleString()} leads`,
                          name,
                        ]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chip list */}
              <div className="lg:w-1/2">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm sm:text-base font-semibold text-gray-800">
                    Disposition Breakdown
                  </h2>
                  <span className="text-xs text-gray-500">
                    {stats.by_disposition.length} unique
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto pr-1">
                  {stats.by_disposition.map((d, idx) => {
                    const active = disposition === d.disposition;
                    const dotColor = PIE_COLORS[idx % PIE_COLORS.length];
                    return (
                      <button
                        key={d.disposition}
                        onClick={() => {
                          setPage(1);
                          setDisposition(active ? '' : d.disposition);
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs sm:text-sm border transition ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                        title={active ? 'Click to clear filter' : `Filter: ${d.disposition}`}
                      >
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span className="font-medium">{d.disposition || 'Unknown'}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] sm:text-xs ${
                            active ? 'bg-white/25' : 'bg-white border border-gray-200 text-gray-600'
                          }`}
                        >
                          {d.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <form
            onSubmit={handleSearchSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3 items-end"
          >
            <div className="lg:col-span-2">
              <label className="block text-[11px] sm:text-xs font-medium text-gray-600 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Phone, name, car number, dialer id..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] sm:text-xs font-medium text-gray-600 mb-1">
                Disposition
              </label>
              <select
                value={disposition}
                onChange={(e) => {
                  setPage(1);
                  setDisposition(e.target.value);
                }}
                className="w-full px-2 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All</option>
                {dispositionOptions.map((d) => (
                  <option key={d.disposition} value={d.disposition}>
                    {d.disposition} ({d.count})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] sm:text-xs font-medium text-gray-600 mb-1">
                Dialer ID
              </label>
              <select
                value={dialerId}
                onChange={(e) => {
                  setPage(1);
                  setDialerId(e.target.value);
                }}
                className="w-full px-2 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All</option>
                {dialerOptions.map((d) => (
                  <option key={d.dialer_id} value={d.dialer_id}>
                    {d.dialer_id} ({d.count})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] sm:text-xs font-medium text-gray-600 mb-1">
                From
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setPage(1);
                  setFromDate(e.target.value);
                }}
                className="w-full px-2 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] sm:text-xs font-medium text-gray-600 mb-1">
                To
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setPage(1);
                  setToDate(e.target.value);
                }}
                className="w-full px-2 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-6">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-indigo-700"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={handleResetToToday}
                className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs sm:text-sm font-medium hover:bg-emerald-100"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-200"
              >
                Clear
              </button>
              <div className="ml-auto text-xs sm:text-sm text-gray-500 self-center">
                {loading ? 'Loading...' : `Showing ${leads.length} of ${total.toLocaleString()} leads`}
              </div>
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48 sm:h-64">
              <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-indigo-600" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-10 md:py-12">
              <Phone className="w-10 h-10 md:w-12 md:h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">No dialer leads found.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Date / Time</Th>
                      <Th>Phone</Th>
                      <Th>Name</Th>
                      <Th>Car</Th>
                      <Th>Make / Model</Th>
                      <Th>Disposition</Th>
                      <Th>Dialer ID</Th>
                      <Th>Remark</Th>
                      <Th>Interested</Th>
                      <Th>Recording</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leads.map((l) => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <Td className="whitespace-nowrap text-gray-600">
                          {formatDateTime(l.created_at)}
                        </Td>
                        <Td className="whitespace-nowrap font-medium text-gray-900">
                          <a
                            href={`tel:${primaryPhone(l.phone_no)}`}
                            className="text-indigo-700 hover:underline"
                          >
                            {displayPhone(l.phone_no)}
                          </a>
                        </Td>
                        <Td className="text-gray-800">{l.name || '-'}</Td>
                        <Td className="text-gray-800 font-mono uppercase">{l.car_number || '-'}</Td>
                        <Td className="text-gray-700">
                          {[l.make, l.model].filter(Boolean).join(' / ') || '-'}
                        </Td>
                        <Td>
                          {l.disposition ? (
                            <span className={dispositionBadgeClass(l.disposition)}>
                              {l.disposition}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </Td>
                        <Td className="text-gray-700">{l.dialer_id || '-'}</Td>
                        <Td className="max-w-[18rem] text-gray-700">
                          <span className="line-clamp-2" title={l.remark || ''}>
                            {l.remark || '-'}
                          </span>
                        </Td>
                        <Td className="whitespace-nowrap text-gray-700">
                          {l.intrested_customer_date || '-'}
                        </Td>
                        <Td>
                          {l.recording_url ? (
                            <button
                              onClick={() => openRecording(l)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-medium"
                            >
                              <Play className="w-3.5 h-3.5" /> Play
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs">No audio</span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {leads.map((l) => (
                  <div key={l.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900 text-sm truncate">
                          {l.name || 'Unknown'}
                        </div>
                        <a
                          href={`tel:${primaryPhone(l.phone_no)}`}
                          className="text-indigo-700 text-xs hover:underline"
                        >
                          {displayPhone(l.phone_no)}
                        </a>
                      </div>
                      {l.disposition && (
                        <span className={dispositionBadgeClass(l.disposition)}>{l.disposition}</span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                      <div>
                        <span className="text-gray-400">Car:</span>{' '}
                        <span className="font-mono uppercase">{l.car_number || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Make/Model:</span>{' '}
                        {[l.make, l.model].filter(Boolean).join('/') || '-'}
                      </div>
                      <div>
                        <span className="text-gray-400">Dialer:</span> {l.dialer_id || '-'}
                      </div>
                      <div>
                        <span className="text-gray-400">Interested:</span>{' '}
                        {l.intrested_customer_date || '-'}
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-400">Created:</span>{' '}
                        {formatDateTime(l.created_at)}
                      </div>
                      {l.remark && (
                        <div className="col-span-2">
                          <span className="text-gray-400">Remark:</span> {l.remark}
                        </div>
                      )}
                    </div>
                    {l.recording_url && (
                      <button
                        onClick={() => openRecording(l)}
                        className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-medium"
                      >
                        <Play className="w-3.5 h-3.5" /> Play recording
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="px-4 sm:px-6 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="text-xs sm:text-sm text-gray-600">
                  Page <span className="font-semibold">{page}</span> of{' '}
                  <span className="font-semibold">{totalPages}</span> ({total.toLocaleString()} total)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recording modal */}
      {recordingOpen && recordingUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeRecording}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                {recordingTitle || 'Call Recording'}
              </h3>
              <button
                onClick={closeRecording}
                className="p-1.5 rounded hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <audio
              src={recordingUrl}
              controls
              autoPlay
              className="w-full"
              preload="auto"
            />
            <div className="mt-3 flex items-center justify-end">
              <a
                href={recordingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs sm:text-sm text-indigo-600 hover:underline inline-flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Open / Download
              </a>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className || ''}`}>{children}</td>;
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: 'blue' | 'emerald' | 'rose' | 'amber';
}) {
  const toneMap: Record<string, string> = {
    blue: 'bg-blue-50',
    emerald: 'bg-emerald-50',
    rose: 'bg-rose-50',
    amber: 'bg-amber-50',
  };
  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-gray-600">{label}</p>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
            {value.toLocaleString()}
          </p>
        </div>
        <div className={`p-2.5 sm:p-3 rounded-full ${toneMap[tone]} flex-shrink-0`}>{icon}</div>
      </div>
    </div>
  );
}

function dispositionBadgeClass(disposition: string): string {
  const d = disposition.toLowerCase();
  const base =
    'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium border';
  if (d.includes('interest') || d.includes('hot') || d.includes('confirm')) {
    return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
  }
  if (d.includes('callback') || d.includes('call back') || d.includes('later') || d.includes('busy')) {
    return `${base} bg-amber-50 text-amber-700 border-amber-200`;
  }
  if (d.includes('not interest') || d.includes('no') || d.includes('reject') || d.includes('dnd')) {
    return `${base} bg-rose-50 text-rose-700 border-rose-200`;
  }
  if (d.includes('wrong') || d.includes('invalid') || d.includes('switch')) {
    return `${base} bg-gray-100 text-gray-700 border-gray-200`;
  }
  return `${base} bg-indigo-50 text-indigo-700 border-indigo-200`;
}
