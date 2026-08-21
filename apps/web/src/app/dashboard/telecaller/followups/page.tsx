'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { Calendar, Clock, Phone, CheckCircle, XCircle, Filter, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { formatDateTime } from "@/lib/utils";
import { istYmd, istDayBounds } from '@/lib/telecaller/crmDateRange';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';

function formatYmdShort(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

function addMonthsYm(year: number, month0: number, delta: number) {
  const d = new Date(year, month0 + delta, 1);
  return { year: d.getFullYear(), month0: d.getMonth() };
}

function ymdFromParts(y: number, m0: number, day: number) {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildMonthCells(year: number, month0: number) {
  const firstDow = new Date(year, month0, 1).getDay();
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const cells: Array<{ ymd: string | null; day: number | null }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ ymd: null, day: null });
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ ymd: ymdFromParts(year, month0, day), day });
  }
  while (cells.length % 7 !== 0) cells.push({ ymd: null, day: null });
  return cells;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function FollowUpsPage() {
  const pathname = usePathname();
  const { base, layoutRole, scopeAll } = getCrmDashboardBase(pathname);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [pendingLeadIds, setPendingLeadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'today' | 'calendar' | 'completed'>('pending');
  const [typeFilter, setTypeFilter] = useState<'all' | 'CALLBACK'>('all');
  const [pickMode, setPickMode] = useState<'single' | 'range'>('single');
  const [customStart, setCustomStart] = useState(istYmd());
  const [customEnd, setCustomEnd] = useState(istYmd());
  const [searchTerm, setSearchTerm] = useState('');
  const todayYmd = istYmd();
  const [viewYear, setViewYear] = useState(() => Number(todayYmd.slice(0, 4)));
  const [viewMonth0, setViewMonth0] = useState(() => Number(todayYmd.slice(5, 7)) - 1);
  const [rangeTap, setRangeTap] = useState<'start' | 'end'>('start');

  useEffect(() => {
    fetchFollowUps();
  }, [filter, customStart, customEnd, pickMode, scopeAll]);

  async function fetchFollowUps() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      // Lead Manager / admin: all team reminders. Telecaller: only own.
      let pendingQ = supabase
        .from('telecaller_follow_ups')
        .select('lead_id')
        .eq('status', 'PENDING');
      if (!scopeAll && userProfile?.id) {
        pendingQ = pendingQ.eq('telecaller_id', userProfile.id);
      }
      const { data: pendingRows } = await pendingQ;
      const pendingIds = new Set((pendingRows || []).map((r: any) => String(r.lead_id)));
      setPendingLeadIds(pendingIds);

      let query = supabase
        .from('telecaller_follow_ups')
        .select(`
          *,
          lead:service_leads(lead_number, customer_name, customer_phone, vehicle_make, vehicle_model),
          telecaller:users_login!telecaller_id(id, full_name)
        `);

      if (!scopeAll && userProfile?.id) {
        query = query.eq('telecaller_id', userProfile.id);
      }

      const todayBounds = istDayBounds(istYmd());

      if (filter === 'completed') {
        query = query.eq('status', 'COMPLETED').order('completed_at', { ascending: false });
      } else {
        query = query.eq('status', 'PENDING');
        if (filter === 'today') {
          query = query
            .gte('scheduled_time', todayBounds.start)
            .lte('scheduled_time', todayBounds.end);
        } else if (filter === 'calendar') {
          let start = customStart;
          let end = pickMode === 'single' ? customStart : customEnd;
          if (start > end) {
            const tmp = start;
            start = end;
            end = tmp;
          }
          const startBound = istDayBounds(start).start;
          const endBound = istDayBounds(end).end;
          query = query.gte('scheduled_time', startBound).lte('scheduled_time', endBound);
        }
        query = query.order('scheduled_time', { ascending: true });
      }

      const { data, error } = await query.limit(scopeAll ? 500 : 200);

      if (error) throw error;
      setFollowUps(data || []);
    } catch (error) {
      console.error('Error fetching follow-ups:', error);
    } finally {
      setLoading(false);
    }
  }

  function onCalendarDayPress(ymd: string) {
    if (pickMode === 'single') {
      setCustomStart(ymd);
      setCustomEnd(ymd);
      return;
    }
    if (rangeTap === 'start') {
      setCustomStart(ymd);
      setCustomEnd(ymd);
      setRangeTap('end');
      return;
    }
    if (ymd < customStart) {
      setCustomEnd(customStart);
      setCustomStart(ymd);
    } else {
      setCustomEnd(ymd);
    }
    setRangeTap('start');
  }
  async function markAsCompleted(followUpId: string, notes: string = '') {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      const { error } = await supabase
        .from('telecaller_follow_ups')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          completed_by: userProfile?.id,
          completion_notes: notes
        })
        .eq('id', followUpId);

      if (!error) {
        fetchFollowUps();
        alert('Follow-up marked as completed!');
      }
    } catch (error) {
      console.error('Error marking follow-up:', error);
      alert('Failed to update follow-up');
    }
  }

  async function cancelFollowUp(followUpId: string) {
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('telecaller_follow_ups')
        .update({
          status: 'CANCELLED'
        })
        .eq('id', followUpId);

      if (!error) {
        fetchFollowUps();
        alert('Follow-up cancelled');
      }
    } catch (error) {
      console.error('Error cancelling follow-up:', error);
      alert('Failed to cancel follow-up');
    }
  }

  const filteredFollowUps = useMemo(() => {
    return followUps.filter((fu) => {
      if (filter === 'completed' && pendingLeadIds.has(String(fu.lead_id))) return false;
      if (typeFilter === 'CALLBACK') {
        if (String(fu.follow_up_type || '').toUpperCase() !== 'CALLBACK') return false;
      }
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        fu.lead?.customer_name?.toLowerCase().includes(search) ||
        fu.lead?.customer_phone?.includes(search) ||
        fu.lead?.lead_number?.toLowerCase().includes(search) ||
        fu.reason?.toLowerCase().includes(search)
      );
    });
  }, [followUps, searchTerm, typeFilter, filter, pendingLeadIds]);

  const calendarLabel =
    pickMode === 'single' || customStart === customEnd
      ? formatYmdShort(customStart)
      : `${formatYmdShort(customStart)} – ${formatYmdShort(customEnd)}`;

  const getTimeStatus = (scheduledTime: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledTime);
    const diff = scheduled.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (diff < 0) return { label: 'Overdue', color: 'red', urgent: true };
    if (hours < 1) return { label: 'Due Soon', color: 'orange', urgent: true };
    if (hours < 24) return { label: 'Today', color: 'blue', urgent: false };
    return { label: 'Upcoming', color: 'gray', urgent: false };
  };

  if (loading) {
    return (
      <DashboardLayout role={layoutRole}>
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">Loading follow-ups...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={layoutRole}>
      <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-clip space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-text-heading">Reminders / Follow-ups</h1>
          <p className="text-text-body text-xs sm:text-sm mt-1">
            {scopeAll ? 'Team reminders & follow-ups' : 'Your scheduled follow-ups'}
          </p>
        </div>

        {/* Filters & Search */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 min-w-0 overflow-hidden">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row gap-3 min-w-0">
              <div className="flex-1 min-w-0 relative">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by customer name, phone, lead number..."
                  className="w-full min-w-0 pl-8 sm:pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2 items-center shrink-0">
                {(
                  [
                    { id: 'pending' as const, label: 'All Pending' },
                    { id: 'today' as const, label: 'Today' },
                    { id: 'calendar' as const, label: 'Calendar' },
                    { id: 'completed' as const, label: 'Done' },
                  ]
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-xs whitespace-nowrap ${
                      filter === f.id
                        ? 'bg-[#004AAD] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                  <Filter className="w-3.5 h-3.5 text-[#004AAD]" />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as 'all' | 'CALLBACK')}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-semibold max-w-[140px]"
                  >
                    <option value="all">All types</option>
                    <option value="CALLBACK">Follow-up only</option>
                  </select>
                </label>
              </div>
            </div>

            {filter === 'calendar' ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 sm:p-4 space-y-3">
                <div className="inline-flex rounded-lg bg-white border border-gray-200 p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPickMode('single');
                      setCustomEnd(customStart);
                      setRangeTap('start');
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold ${
                      pickMode === 'single' ? 'bg-[#004AAD] text-white' : 'text-gray-600'
                    }`}
                  >
                    Single date
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPickMode('range');
                      setRangeTap('start');
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold ${
                      pickMode === 'range' ? 'bg-[#004AAD] text-white' : 'text-gray-600'
                    }`}
                  >
                    Date range
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 max-w-md">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="rounded-lg p-2 hover:bg-slate-100"
                      onClick={() => {
                        const next = addMonthsYm(viewYear, viewMonth0, -1);
                        setViewYear(next.year);
                        setViewMonth0(next.month0);
                      }}
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-5 w-5 text-[#004AAD]" />
                    </button>
                    <p className="text-sm font-extrabold text-slate-800">
                      {MONTH_NAMES[viewMonth0]} {viewYear}
                    </p>
                    <button
                      type="button"
                      className="rounded-lg p-2 hover:bg-slate-100"
                      onClick={() => {
                        const next = addMonthsYm(viewYear, viewMonth0, 1);
                        setViewYear(next.year);
                        setViewMonth0(next.month0);
                      }}
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-5 w-5 text-[#004AAD]" />
                    </button>
                  </div>
                  <div className="mb-1 grid grid-cols-7 gap-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                      <div
                        key={`${d}-${i}`}
                        className="text-center text-[11px] font-bold text-slate-400 py-1"
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {buildMonthCells(viewYear, viewMonth0).map((cell, idx) => {
                      if (!cell.ymd) {
                        return <div key={`e-${idx}`} className="aspect-square" />;
                      }
                      const ymd = cell.ymd;
                      const lo = customStart <= customEnd ? customStart : customEnd;
                      const hi = customStart <= customEnd ? customEnd : customStart;
                      const selected =
                        pickMode === 'single'
                          ? ymd === customStart
                          : ymd === lo || ymd === hi;
                      const inRange = pickMode === 'range' && ymd > lo && ymd < hi;
                      const isToday = ymd === todayYmd;
                      return (
                        <button
                          key={ymd}
                          type="button"
                          onClick={() => onCalendarDayPress(ymd)}
                          className={`aspect-square rounded-lg text-sm font-semibold flex items-center justify-center transition ${
                            selected
                              ? 'bg-[#004AAD] text-white shadow-sm'
                              : inRange
                                ? 'bg-blue-100 text-[#004AAD]'
                                : isToday
                                  ? 'text-[#004AAD] font-extrabold hover:bg-slate-50'
                                  : 'text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          {cell.day}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-center text-xs font-semibold text-slate-500">
                    {pickMode === 'single'
                      ? `Selected: ${formatYmdShort(customStart)}`
                      : rangeTap === 'end' && customStart === customEnd
                        ? `Start: ${formatYmdShort(customStart)} · ab end date choose karo`
                        : calendarLabel}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Follow-ups — single-column list (leads-style rows) */}
        <div className="space-y-2">
          {filteredFollowUps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-10 text-center">
              <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No follow-ups found</p>
            </div>
          ) : (
            filteredFollowUps.map((followUp) => {
              const timeStatus = getTimeStatus(followUp.scheduled_time);

              return (
                <div
                  key={followUp.id}
                  className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:px-4 shadow-sm hover:bg-slate-50/80 transition"
                >
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-2 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <h3 className="text-sm sm:text-base font-bold text-[#023D95] truncate">
                          {followUp.lead?.customer_name || 'Unknown'}
                        </h3>
                        {followUp.lead?.lead_number ? (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-mono shrink-0">
                            {followUp.lead.lead_number}
                          </span>
                        ) : null}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                            followUp.priority === 'URGENT'
                              ? 'bg-red-100 text-red-700'
                              : followUp.priority === 'HIGH'
                                ? 'bg-orange-100 text-orange-700'
                                : followUp.priority === 'LOW'
                                  ? 'bg-gray-100 text-gray-700'
                                  : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {followUp.priority}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap shrink-0 ${
                            timeStatus.color === 'red'
                              ? 'bg-red-100 text-red-700'
                              : timeStatus.color === 'orange'
                                ? 'bg-orange-100 text-orange-700'
                                : timeStatus.color === 'blue'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {timeStatus.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 truncate">
                        {[followUp.lead?.customer_phone, followUp.telecaller?.full_name]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </p>
                      <div className="mt-1.5 flex flex-col gap-0.5 text-xs text-slate-700 min-w-0">
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-500">Type</span>
                          <span className="truncate">{followUp.follow_up_type}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-500 shrink-0">When</span>
                          <span className="truncate">{formatDateTime(followUp.scheduled_time)}</span>
                        </span>
                        {followUp.reason ? (
                          <span className="text-slate-600 min-w-0" title={followUp.reason}>
                            <span className="font-semibold text-slate-500">Reason</span>{' '}
                            {followUp.reason}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {followUp.status === 'PENDING' ? (
                      <div className="flex flex-row flex-wrap gap-1.5 shrink-0 ml-auto">
                        {followUp.lead?.customer_phone ? (
                          <a
                            href={`tel:${followUp.lead.customer_phone}`}
                            title="Call"
                            aria-label="Call"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#004AAD] text-white"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        ) : null}
                        {followUp.lead?.customer_phone ? (
                          <button
                            type="button"
                            title="WhatsApp"
                            aria-label="WhatsApp"
                            onClick={() => {
                              const phone = String(followUp.lead?.customer_phone || '').replace(/\D/g, '');
                              if (!phone) return;
                              window.dispatchEvent(
                                new CustomEvent('myfng:open-wa-chat', {
                                  detail: { phone },
                                }),
                              );
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366] text-white"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                        <Link
                          href={`${base}/leads/${followUp.lead_id}`}
                          title="View lead"
                          aria-label="View lead"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#004AAD] text-[#004AAD]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          type="button"
                          title="Mark done"
                          aria-label="Mark done"
                          onClick={() => {
                            const notes = prompt('Add completion notes (optional):');
                            if (notes !== null) {
                              markAsCompleted(followUp.id, notes);
                            }
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500 text-emerald-700"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Cancel"
                          aria-label="Cancel"
                          onClick={() => {
                            if (confirm('Cancel this follow-up?')) {
                              cancelFollowUp(followUp.id);
                            }
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-400 text-red-600"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0 ml-auto text-green-700">
                        <CheckCircle className="w-4 h-4" />
                        <p className="text-xs font-semibold">Completed</p>
                      </div>
                    )}
                  </div>
                  {followUp.context_notes ? (
                    <p className="mt-1.5 text-xs text-slate-500 italic truncate">{followUp.context_notes}</p>
                  ) : null}
                  {followUp.status === 'COMPLETED' && followUp.completion_notes ? (
                    <p className="mt-1.5 text-xs text-emerald-700 truncate">
                      Done: {followUp.completion_notes}
                      {followUp.completed_at ? ` · ${formatDateTime(followUp.completed_at)}` : ''}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
