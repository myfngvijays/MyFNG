'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { WebPhoneCallLink } from '@/components/telecaller/PhoneDialHandoff';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { Calendar, Phone, CheckCircle, XCircle, Filter, Search, ChevronLeft, ChevronRight, Eye, Flag, RefreshCw } from 'lucide-react';
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

function quoteIlike(value: string) {
  return `"%${value.replace(/"/g, '')}%"`;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { base, layoutRole, scopeAll } = getCrmDashboardBase(pathname);
  const viewParam = searchParams?.get('view');
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [pendingLeadIds, setPendingLeadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'today' | 'calendar' | 'completed'>(
    viewParam === 'today' || viewParam === 'calendar' || viewParam === 'completed' ? viewParam : 'pending',
  );
  const [typeFilter, setTypeFilter] = useState<'all' | 'CALLBACK'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  // Calendar dates live in the URL (start/end/mode) so they survive opening a lead and coming back.
  const ymdParam = (key: string) => {
    const v = String(searchParams?.get(key) || '');
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
  };
  const initialStart = ymdParam('start') || istYmd();
  const initialEnd = ymdParam('end') && ymdParam('end') >= initialStart ? ymdParam('end') : initialStart;
  const [pickMode, setPickMode] = useState<'single' | 'range'>(
    searchParams?.get('mode') === 'range' ? 'range' : 'single',
  );
  const [customStart, setCustomStart] = useState(initialStart);
  const [customEnd, setCustomEnd] = useState(initialEnd);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const todayYmd = istYmd();
  const [viewYear, setViewYear] = useState(() => Number(initialStart.slice(0, 4)));
  const [viewMonth0, setViewMonth0] = useState(() => Number(initialStart.slice(5, 7)) - 1);
  const [rangeTap, setRangeTap] = useState<'start' | 'end'>('start');
  const [priorityMenuId, setPriorityMenuId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<25 | 50 | 75 | 100>(25);

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
    const view = searchParams?.get('view');
    if (view === 'today' || view === 'calendar' || view === 'completed' || view === 'pending') {
      setFilter(view);
    }
  }, [searchParams]);

  const openFilter = (next: 'pending' | 'today' | 'calendar' | 'completed') => {
    setFilter(next);
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (next === 'pending') params.delete('view');
    else params.set('view', next);
    if (next === 'calendar') {
      params.set('start', customStart);
      params.set('end', customEnd);
      params.set('mode', pickMode);
    } else {
      params.delete('start');
      params.delete('end');
      params.delete('mode');
    }
    const qs = params.toString();
    router.replace(`${base}/followups${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  // Keep the picked calendar dates in the URL while the calendar view is on.
  useEffect(() => {
    if (filter !== 'calendar') return;
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (
      params.get('start') === customStart &&
      params.get('end') === customEnd &&
      params.get('mode') === pickMode
    ) {
      return;
    }
    params.set('view', 'calendar');
    params.set('start', customStart);
    params.set('end', customEnd);
    params.set('mode', pickMode);
    router.replace(`${base}/followups?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, customStart, customEnd, pickMode]);

  const leadHref = (leadId: string) => {
    const params = new URLSearchParams({ from: 'followups', view: filter });
    if (filter === 'calendar') {
      params.set('start', customStart);
      params.set('end', customEnd);
      params.set('mode', pickMode);
    }
    return `${base}/leads/${leadId}?${params.toString()}`;
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [filter, customStart, customEnd, pickMode, debouncedSearch, typeFilter, priorityFilter, pageSize]);

  useEffect(() => {
    fetchFollowUps();
  }, [filter, customStart, customEnd, pickMode, scopeAll, debouncedSearch, typeFilter, priorityFilter, page, pageSize]);

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
    if (!debouncedSearch.trim()) setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile, error: profileError } = await supabase
        .from('users_login')
        .select('id')
        .ilike('email', user.email || '')
        .maybeSingle();

      if (profileError) throw profileError;

      const searchText = debouncedSearch.replace(/[%_,]/g, ' ').trim();
      const searching = searchText.length >= 2;
      const todayBounds = istDayBounds(istYmd());
      let searchLeadIds: string[] | null = null;

      const scopeFollowUps = (q: any) => {
        if (!scopeAll && userProfile?.id) {
          return q.eq('telecaller_id', userProfile.id);
        }
        return q;
      };

      const applyFollowUpFilters = (q: any) => {
        let next = scopeFollowUps(q);
        if (filter === 'completed') {
          next = next.eq('status', 'COMPLETED');
        } else {
          next = next.eq('status', 'PENDING');
        }
        if (!searching && filter !== 'completed') {
          if (filter === 'today') {
            next = next.gte('scheduled_time', todayBounds.start).lte('scheduled_time', todayBounds.end);
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
            next = next.gte('scheduled_time', startBound).lte('scheduled_time', endBound);
          }
        }
        if (typeFilter === 'CALLBACK') {
          next = next.eq('follow_up_type', 'CALLBACK');
        }
        if (priorityFilter !== 'ALL') {
          next = next.eq('priority', priorityFilter);
        }
        return next;
      };

      // Name/phone search only looks at this caller's reminders. Skip the full pending scan.
      if (!searching) {
        let pendingQ = supabase
          .from('telecaller_follow_ups')
          .select('lead_id')
          .eq('status', 'PENDING');
        if (!scopeAll && userProfile?.id) {
          pendingQ = pendingQ.eq('telecaller_id', userProfile.id);
        }
        const { data: pendingRows } = await pendingQ.limit(500);
        const pendingIds = new Set((pendingRows || []).map((r: any) => String(r.lead_id)));
        setPendingLeadIds(pendingIds);
      }

      const leadSelect =
        'lead:service_leads!lead_id(lead_number, customer_name, customer_phone, vehicle_make, vehicle_model, status, coupon_meta, deleted_at)';

      if (searching) {
        const digits = searchText.replace(/\D/g, '');
        const phone = digits.length >= 10 ? digits.slice(-10) : digits;
        const parts = [
          `customer_name.ilike.${quoteIlike(searchText)}`,
          `lead_number.ilike.${quoteIlike(searchText)}`,
        ];
        if (phone.length >= 4) parts.push(`customer_phone.ilike.${quoteIlike(phone)}`);
        const { data: leadHits, error: leadSearchErr } = await supabase
          .from('service_leads')
          .select('id')
          .is('deleted_at', null)
          .or(parts.join(','))
          .limit(120);
        if (leadSearchErr) throw leadSearchErr;
        searchLeadIds = (leadHits || []).map((row: { id?: string }) => String(row.id || '')).filter(Boolean);
        if (!searchLeadIds.length) {
          setFollowUps([]);
          setResultCount(0);
          return;
        }
      }

      let query = applyFollowUpFilters(
        supabase.from('telecaller_follow_ups').select(`
          *,
          ${leadSelect},
          telecaller:users_login!telecaller_id(id, full_name)
        `),
      );
      if (searchLeadIds?.length) {
        query = query.in('lead_id', searchLeadIds);
      }

      if (filter === 'completed') {
        query = query.order('completed_at', { ascending: false });
      } else {
        query = query.order('scheduled_time', { ascending: true });
      }

      const offset = (page - 1) * pageSize;
      let countQ = applyFollowUpFilters(
        supabase.from('telecaller_follow_ups').select('id', { count: 'exact', head: true }),
      );
      if (searchLeadIds?.length) {
        countQ = countQ.in('lead_id', searchLeadIds);
      }
      const [listRes, countRes] = await Promise.all([
        query.range(offset, offset + pageSize - 1),
        countQ,
      ]);
      const { data, error } = listRes;

      if (error) throw error;
      const count = countRes.count;
      if (countRes.error) {
        console.warn('Follow-up count unavailable:', countRes.error.message || countRes.error);
      }
      const { crmLeadClosedForFollowUp } = await import('@/lib/telecaller/crmFollowUpClose');
      const rows = (data || []).filter((fu: any) => {
        if (fu.lead?.deleted_at) return false;
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
      setResultCount(typeof count === 'number' ? count : rows.length);
    } catch (error) {
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: string }).message)
          : String(error);
      console.error('Error fetching follow-ups:', msg || error);
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

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filter, debouncedSearch, typeFilter, priorityFilter, customStart, customEnd, pickMode, page]);

  const filteredFollowUps = useMemo(() => {
    return followUps.filter((fu) => {
      if (filter === 'completed' && pendingLeadIds.has(String(fu.lead_id))) return false;
      return true;
    });
  }, [followUps, filter, pendingLeadIds]);

  const totalPages = Math.max(1, Math.ceil(resultCount / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const pageStart = resultCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, resultCount);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const followUpsPager = (
    <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold text-slate-500">
        {resultCount === 0
          ? 'No reminders'
          : `Showing ${pageStart}–${pageEnd} of ${resultCount.toLocaleString('en-IN')}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
          Per page
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) as 25 | 50 | 75 | 100)}
          >
            {[25, 50, 75, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={safePage <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-xs font-bold text-slate-600 tabular-nums">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages || loading}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );

  const selectableRows = useMemo(
    () => filteredFollowUps.filter((fu) => fu.status === 'PENDING'),
    [filteredFollowUps],
  );

  const allPageSelected =
    selectableRows.length > 0 && selectableRows.every((fu) => selectedIds.has(String(fu.id)));

  const somePageSelected = selectableRows.some((fu) => selectedIds.has(String(fu.id)));

  function toggleSelectRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const fu of selectableRows) next.delete(String(fu.id));
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const fu of selectableRows) next.add(String(fu.id));
      return next;
    });
  }

  async function resolveProfileId(supabase: ReturnType<typeof createClient>) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return null;
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id')
      .ilike('email', user.email)
      .maybeSingle();
    return userProfile?.id ? String(userProfile.id) : null;
  }

  async function bulkMarkCompleted() {
    const ids = Array.from(selectedIds);
    if (!ids.length || bulkBusy) return;
    const notes = prompt(`Mark ${ids.length} reminder(s) as done. Notes (optional, same for all):`);
    if (notes === null) return;

    const supabase = createClient();
    setBulkBusy(true);
    try {
      const completedBy = await resolveProfileId(supabase);
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('telecaller_follow_ups')
        .update({
          status: 'COMPLETED',
          completed_at: now,
          completed_by: completedBy,
          completion_notes: notes.trim() || null,
          updated_at: now,
        })
        .in('id', ids)
        .eq('status', 'PENDING');

      if (error) throw error;
      setSelectedIds(new Set());
      await fetchFollowUps();
      alert(`${ids.length} reminder(s) marked done.`);
    } catch (error) {
      console.error('Bulk complete follow-ups:', error);
      alert('Bulk complete failed. Try again or fewer items.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkCancelFollowUps() {
    const ids = Array.from(selectedIds);
    if (!ids.length || bulkBusy) return;
    if (!confirm(`Cancel ${ids.length} selected reminder(s)?`)) return;

    const supabase = createClient();
    setBulkBusy(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('telecaller_follow_ups')
        .update({
          status: 'CANCELLED',
          updated_at: now,
        })
        .in('id', ids)
        .eq('status', 'PENDING');

      if (error) throw error;
      setSelectedIds(new Set());
      await fetchFollowUps();
      alert(`${ids.length} reminder(s) cancelled.`);
    } catch (error) {
      console.error('Bulk cancel follow-ups:', error);
      alert('Bulk cancel failed. Try again or fewer items.');
    } finally {
      setBulkBusy(false);
    }
  }

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
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-text-heading">Reminders / Follow-ups</h1>
            <p className="text-text-body text-xs sm:text-sm mt-1">
              {scopeAll ? 'Team reminders & follow-ups' : 'Your scheduled follow-ups'}
              {` · ${resultCount}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchFollowUps()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#023D95] hover:bg-slate-50"
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
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
                          openFilter('calendar');
                          setCalendarOpen((open) => !open);
                          return;
                        }
                        setCalendarOpen(false);
                        openFilter(f.id);
                      }}
                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs whitespace-nowrap ${
                        filter === f.id
                          ? 'bg-[#004AAD] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {f.id === 'calendar' && filter === 'calendar'
                        ? `${calendarLabel} (${resultCount})`
                        : filter === f.id
                          ? `${f.label} (${resultCount})`
                          : f.label}
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

        {filter !== 'completed' && selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#004AAD]/25 bg-blue-50 px-3 py-2.5 sm:px-4">
            <span className="text-sm font-extrabold text-[#004AAD]">{selectedIds.size} selected</span>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void bulkMarkCompleted()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Mark done
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void bulkCancelFollowUps()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Clear
            </button>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {resultCount > 0 ? followUpsPager : null}
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
                    {filter !== 'completed' ? (
                      <th className="w-10 px-2 py-2 font-bold text-center">
                        <input
                          type="checkbox"
                          aria-label="Select all on page"
                          checked={allPageSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = somePageSelected && !allPageSelected;
                          }}
                          onChange={toggleSelectAllOnPage}
                          className="h-4 w-4 cursor-pointer rounded border-white/40 accent-emerald-500"
                        />
                      </th>
                    ) : null}
                    <th className="w-12 px-2 py-2 font-bold text-center">Sr No</th>
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
            {filteredFollowUps.map((followUp, rowIndex) => {
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
              const note = String(followUp.reason || '').trim();
              const noteLong = note.length > 72;
              return (
                <tr
                  key={followUp.id}
                  className={`h-16 hover:bg-slate-50 ${selectedIds.has(String(followUp.id)) ? 'bg-blue-50/80' : ''}`}
                >
                  {filter !== 'completed' ? (
                    <td className="px-2 align-middle text-center">
                      {pending ? (
                        <input
                          type="checkbox"
                          aria-label={`Select ${followUp.lead?.customer_name || 'reminder'}`}
                          checked={selectedIds.has(String(followUp.id))}
                          onChange={() => toggleSelectRow(followUp.id)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-[#004AAD]"
                        />
                      ) : (
                        <span className="inline-block w-4" />
                      )}
                    </td>
                  ) : null}
                  <td className="px-2 align-middle text-center text-xs font-bold text-slate-500 tabular-nums">
                    {(safePage - 1) * pageSize + rowIndex + 1}
                  </td>
                  <td className="px-3 align-middle">
                    <Link href={leadHref(followUp.lead_id)} className="line-clamp-1 font-bold text-slate-900 hover:underline">
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
                      <WebPhoneCallLink
                        phone={String(followUp.lead.customer_phone)}
                        leadId={String(followUp.lead_id || '')}
                        title="Call"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#004AAD] text-white"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </WebPhoneCallLink>
                    ) : null}
                    <Link
                      href={leadHref(followUp.lead_id)}
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
          {resultCount > 0 ? followUpsPager : null}
        </div>
      </div>
    </DashboardLayout>
  );
}
