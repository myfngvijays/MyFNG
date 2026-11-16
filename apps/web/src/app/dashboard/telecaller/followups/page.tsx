'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { Calendar, Phone, CheckCircle, XCircle, Filter, Search, ChevronLeft, ChevronRight, Eye, Flag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { istYmd, istDayBounds } from '@/lib/telecaller/crmDateRange';

function formatFollowUpDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function dueAgo(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const min = Math.max(1, Math.round(abs / 60000));
  const hr = Math.round(abs / 3600000);
  const day = Math.round(abs / 86400000);
  const month = Math.round(abs / (86400000 * 30));
  const unit = month >= 1 ? `${month}M` : day >= 1 ? `${day}d` : hr >= 1 ? `${hr}h` : `${min}m`;
  return diff >= 0 ? `${unit} ago` : `in ${unit}`;
}

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
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [pickMode, setPickMode] = useState<'single' | 'range'>('single');
  const [customStart, setCustomStart] = useState(istYmd());
  const [customEnd, setCustomEnd] = useState(istYmd());
  const [searchTerm, setSearchTerm] = useState('');
  const todayYmd = istYmd();
  const [viewYear, setViewYear] = useState(() => Number(todayYmd.slice(0, 4)));
  const [viewMonth0, setViewMonth0] = useState(() => Number(todayYmd.slice(5, 7)) - 1);
  const [rangeTap, setRangeTap] = useState<'start' | 'end'>('start');
  const [priorityMenuId, setPriorityMenuId] = useState<string | null>(null);

  async function setFollowUpPriority(followUpId: string, priority: string) {
    const supabase = createClient();
    const next = priority || 'NORMAL';
    const { error } = await supabase.from('telecaller_follow_ups').update({ priority: next }).eq('id', followUpId);
    if (error) {
      alert('Could not update priority');
      return;
    }
    setFollowUps((prev) => prev.map((row) => (row.id === followUpId ? { ...row, priority: next } : row)));
    setPriorityMenuId(null);
  }

  useEffect(() => {
    fetchFollowUps();
  }, [filter, customStart, customEnd, pickMode, scopeAll]);

  useEffect(() => {
    if (!calendarOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!calendarRef.current?.contains(event.target as Node)) setCalendarOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [calendarOpen]);

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
          lead:service_leads(lead_number, customer_name, customer_phone, vehicle_make, vehicle_model, status, coupon_meta),
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
      const { crmLeadClosedForFollowUp } = await import('@/lib/telecaller/crmFollowUpClose');
      const rows = (data || []).filter((fu: any) => {
        if (filter === 'completed') return true;
        return !crmLeadClosedForFollowUp(fu.lead);
      });
      const stale = (data || []).filter(
        (fu: any) => filter !== 'completed' && crmLeadClosedForFollowUp(fu.lead),
      );
      if (stale.length) {
        void Promise.allSettled(
          stale.map((fu: any) =>
            supabase
              .from('telecaller_follow_ups')
              .update({
                status: 'COMPLETED',
                completed_at: new Date().toISOString(),
                completion_notes: 'Auto-closed — lead already In Service / Service Done / Lost',
                updated_at: new Date().toISOString(),
              })
              .eq('id', fu.id)
              .eq('status', 'PENDING'),
          ),
        );
      }
      setFollowUps(rows);
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
      if (priorityFilter !== 'ALL' && String(fu.priority || 'NORMAL').toUpperCase() !== priorityFilter) return false;
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        fu.lead?.customer_name?.toLowerCase().includes(search) ||
        fu.lead?.customer_phone?.includes(search) ||
        fu.lead?.lead_number?.toLowerCase().includes(search) ||
        fu.reason?.toLowerCase().includes(search)
      );
    });
  }, [followUps, searchTerm, typeFilter, priorityFilter, filter, pendingLeadIds]);

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
      <div className="mx-auto w-full min-w-0 max-w-none space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-text-heading">Reminders / Follow-ups</h1>
          <p className="text-text-body text-xs sm:text-sm mt-1">
            {scopeAll ? 'Team reminders & follow-ups' : 'Your scheduled follow-ups'}
          </p>
        </div>

        {/* Filters & Search */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 min-w-0">
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
                ).map((f) => {
                  const button = (
                    <button
                      type="button"
                      onClick={() => {
                        if (f.id === 'calendar') {
                          setFilter('calendar');
                          setCalendarOpen((open) => !open);
                          return;
                        }
                        setCalendarOpen(false);
                        setFilter(f.id);
                      }}
                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs whitespace-nowrap ${
                        filter === f.id
                          ? 'bg-[#004AAD] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {f.id === 'calendar' && filter === 'calendar' ? calendarLabel : f.label}
                    </button>
                  );
                  if (f.id !== 'calendar') return <span key={f.id}>{button}</span>;
                  return (
                    <div key="calendar" ref={calendarRef} className="relative">
                      {button}
                      {calendarOpen ? (
                        <div className="absolute right-0 top-full z-40 mt-2 w-[300px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                          <div className="mb-3 inline-flex rounded-lg border border-gray-200 bg-slate-50 p-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setPickMode('single');
                                setCustomEnd(customStart);
                                setRangeTap('start');
                              }}
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
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
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                                pickMode === 'range' ? 'bg-[#004AAD] text-white' : 'text-gray-600'
                              }`}
                            >
                              Date range
                            </button>
                          </div>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              className="rounded-lg p-1.5 hover:bg-slate-100"
                              onClick={() => {
                                const next = addMonthsYm(viewYear, viewMonth0, -1);
                                setViewYear(next.year);
                                setViewMonth0(next.month0);
                              }}
                              aria-label="Previous month"
                            >
                              <ChevronLeft className="h-4 w-4 text-[#004AAD]" />
                            </button>
                            <p className="text-sm font-extrabold text-slate-800">
                              {MONTH_NAMES[viewMonth0]} {viewYear}
                            </p>
                            <button
                              type="button"
                              className="rounded-lg p-1.5 hover:bg-slate-100"
                              onClick={() => {
                                const next = addMonthsYm(viewYear, viewMonth0, 1);
                                setViewYear(next.year);
                                setViewMonth0(next.month0);
                              }}
                              aria-label="Next month"
                            >
                              <ChevronRight className="h-4 w-4 text-[#004AAD]" />
                            </button>
                          </div>
                          <div className="mb-1 grid grid-cols-7 gap-1">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                              <div key={`${d}-${i}`} className="py-1 text-center text-[11px] font-bold text-slate-400">
                                {d}
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {buildMonthCells(viewYear, viewMonth0).map((cell, idx) => {
                              if (!cell.ymd) return <div key={`e-${idx}`} className="h-8" />;
                              const ymd = cell.ymd;
                              const lo = customStart <= customEnd ? customStart : customEnd;
                              const hi = customStart <= customEnd ? customEnd : customStart;
                              const selected = pickMode === 'single' ? ymd === customStart : ymd === lo || ymd === hi;
                              const inRange = pickMode === 'range' && ymd > lo && ymd < hi;
                              const isToday = ymd === todayYmd;
                              return (
                                <button
                                  key={ymd}
                                  type="button"
                                  onClick={() => onCalendarDayPress(ymd)}
                                  className={`h-8 rounded-lg text-sm font-semibold ${
                                    selected
                                      ? 'bg-[#004AAD] text-white shadow-sm'
                                      : inRange
                                        ? 'bg-blue-100 text-[#004AAD]'
                                        : isToday
                                          ? 'font-extrabold text-[#004AAD] hover:bg-slate-50'
                                          : 'text-slate-800 hover:bg-slate-50'
                                  }`}
                                >
                                  {cell.day}
                                </button>
                              );
                            })}
                          </div>
                          <p className="mt-2 text-center text-xs font-semibold text-slate-500">
                            {pickMode === 'single'
                              ? `Selected: ${formatYmdShort(customStart)}`
                              : rangeTap === 'end' && customStart === customEnd
                                ? `Start: ${formatYmdShort(customStart)} · ab end date choose karo`
                                : calendarLabel}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
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
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                  <Flag className="w-3.5 h-3.5 text-[#004AAD]" />
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
                    className="max-w-[140px] rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-semibold"
                  >
                    <option value="ALL">All priorities</option>
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {filteredFollowUps.length === 0 ? (
            <div className="py-10 text-center">
              <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No follow-ups found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1040px] w-full text-left text-sm">
                <thead className="bg-[#004AAD] text-white">
                  <tr>
                    <th className="px-3 py-2 font-bold">Name</th>
                    <th className="px-3 py-2 font-bold">Description</th>
                    <th className="px-3 py-2 font-bold">Assignee</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="px-3 py-2 font-bold">Date</th>
                    <th className="px-3 py-2 font-bold">Due date</th>
                    <th className="px-3 py-2 font-bold">Priority</th>
                    <th className="px-3 py-2 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
            {filteredFollowUps.map((followUp) => {
              const timeStatus = getTimeStatus(followUp.scheduled_time);
              const pending = followUp.status === 'PENDING';
              const late = pending && timeStatus.urgent && timeStatus.color === 'red';
              const pill = late
                ? 'LATE'
                : followUp.status === 'COMPLETED'
                  ? 'DONE'
                  : followUp.status === 'CANCELLED'
                    ? 'CANCELLED'
                    : 'PENDING';
              const pillClass = late
                ? 'text-red-600'
                : followUp.status === 'COMPLETED'
                  ? 'text-emerald-700'
                  : followUp.status === 'CANCELLED'
                    ? 'text-slate-500'
                    : 'text-amber-700';
              const note = String(followUp.reason || followUp.follow_up_type || 'Follow-up');
              const noteLong = note.length > 72;
              return (
                <tr key={followUp.id} className="h-16 hover:bg-slate-50">
                  <td className="px-3 align-middle">
                    <Link href={`${base}/leads/${followUp.lead_id}`} className="line-clamp-1 font-bold text-slate-900 hover:underline">
                      {followUp.lead?.customer_name || 'Unknown'}
                    </Link>
                    <p className="text-xs text-slate-500">{followUp.lead?.customer_phone || '—'}</p>
                  </td>
                  <td className="max-w-[280px] px-3 align-middle text-slate-700">
                    <p className="line-clamp-2 text-xs">{note}</p>
                    {noteLong ? (
                      <button
                        type="button"
                        className="mt-0.5 block text-[11px] font-bold text-[#004AAD]"
                        onClick={() => setNoteOpenId((id) => (id === followUp.id ? null : followUp.id))}
                      >
                        {noteOpenId === followUp.id ? 'Less' : 'Read more'}
                      </button>
                    ) : (
                      <span className="mt-0.5 block text-[11px] invisible">Read more</span>
                    )}
                    {noteOpenId === followUp.id ? (
                      <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
                        onClick={() => setNoteOpenId(null)}
                      >
                        <div
                          className="max-h-[60vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 text-sm text-slate-800 shadow-xl"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {note}
                        </div>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 align-middle text-xs font-semibold text-indigo-700">
                    {followUp.telecaller?.full_name || '—'}
                  </td>
                  <td className={`px-3 align-middle text-xs font-extrabold ${pillClass}`}>{pill}</td>
                  <td className="whitespace-nowrap px-3 align-middle text-xs text-slate-700">{formatFollowUpDate(followUp.scheduled_time)}</td>
                  <td className="whitespace-nowrap px-3 align-middle text-xs text-slate-700">{dueAgo(followUp.scheduled_time)}</td>
                  <td className="relative px-3 align-middle">
                    <button
                      type="button"
                      title="Priority"
                      onClick={() => setPriorityMenuId((id) => (id === followUp.id ? null : followUp.id))}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100"
                    >
                      <Flag
                        className={`h-4 w-4 ${
                          String(followUp.priority || '').toUpperCase() === 'URGENT'
                            ? 'fill-red-500 text-red-500'
                            : String(followUp.priority || '').toUpperCase() === 'HIGH'
                              ? 'fill-orange-500 text-orange-500'
                              : String(followUp.priority || '').toUpperCase() === 'MEDIUM'
                                ? 'fill-blue-500 text-blue-500'
                                : String(followUp.priority || '').toUpperCase() === 'LOW'
                                  ? 'fill-slate-400 text-slate-400'
                                  : 'text-slate-300'
                        }`}
                      />
                    </button>
                    {priorityMenuId === followUp.id ? (
                      <div className="absolute right-2 z-20 mt-1 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                        {[
                          { id: 'URGENT', label: 'Urgent', dot: 'bg-red-500' },
                          { id: 'HIGH', label: 'High', dot: 'bg-orange-500' },
                          { id: 'MEDIUM', label: 'Medium', dot: 'bg-blue-500' },
                          { id: 'LOW', label: 'Low', dot: 'bg-slate-400' },
                          { id: 'NORMAL', label: 'Clear', dot: 'bg-white border border-slate-300' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => void setFollowUpPriority(followUp.id, opt.id)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                          >
                            <span className={`h-2.5 w-2.5 rounded-sm ${opt.dot}`} />
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 align-middle">
                  <div className="flex shrink-0 items-center justify-end gap-1">
                    {followUp.lead?.customer_phone ? (
                      <a
                        href={`tel:${followUp.lead.customer_phone}`}
                        title="Call"
                        aria-label="Call"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#004AAD] text-white"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                    <Link
                      href={`${base}/leads/${followUp.lead_id}`}
                      title="Open"
                      aria-label="Open"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#004AAD]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                    {pending ? (
                      <button
                        type="button"
                        title="Mark done"
                        aria-label="Mark done"
                        onClick={() => {
                          const notes = prompt('Add completion notes (optional):');
                          if (notes !== null) markAsCompleted(followUp.id, notes);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {pending ? (
                      <button
                        type="button"
                        title="Cancel"
                        aria-label="Cancel"
                        onClick={() => {
                          if (confirm('Cancel this follow-up?')) cancelFollowUp(followUp.id);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  </td>
                </tr>
              );
            })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
