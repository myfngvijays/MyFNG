'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { Calendar, Clock, Phone, CheckCircle, XCircle, Filter, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { formatDateTime } from "@/lib/utils";
import { istYmd, istDayBounds } from '@/lib/telecaller/crmDateRange';

function formatYmdShort(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

export default function FollowUpsPage() {
  const pathname = usePathname();
  const { base, layoutRole } = getCrmDashboardBase(pathname);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [pendingLeadIds, setPendingLeadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'today' | 'calendar' | 'completed'>('pending');
  const [typeFilter, setTypeFilter] = useState<'all' | 'CALLBACK'>('all');
  const [pickMode, setPickMode] = useState<'single' | 'range'>('single');
  const [customStart, setCustomStart] = useState(istYmd());
  const [customEnd, setCustomEnd] = useState(istYmd());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchFollowUps();
  }, [filter, customStart, customEnd, pickMode]);

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

      const { data: pendingRows } = await supabase
        .from('telecaller_follow_ups')
        .select('lead_id')
        .eq('telecaller_id', userProfile?.id)
        .eq('status', 'PENDING');
      const pendingIds = new Set((pendingRows || []).map((r: any) => String(r.lead_id)));
      setPendingLeadIds(pendingIds);

      let query = supabase
        .from('telecaller_follow_ups')
        .select(`
          *,
          lead:service_leads(lead_number, customer_name, customer_phone, vehicle_make, vehicle_model)
        `)
        .eq('telecaller_id', userProfile?.id);

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

      const { data, error } = await query;

      if (error) throw error;
      setFollowUps(data || []);
    } catch (error) {
      console.error('Error fetching follow-ups:', error);
    } finally {
      setLoading(false);
    }
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
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading">Reminders / Follow-ups</h1>
          <p className="text-text-body text-xs sm:text-sm mt-1 sm:mt-2">Scheduled follow-ups — clock icon se yahan aate ho</p>
        </div>

        {/* Filters & Search */}
        <div className="card">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 min-w-0 relative">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  placeholder="Search by customer name, phone, lead number..."
                  className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2 items-center">
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
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm whitespace-nowrap ${
                      filter === f.id
                        ? 'bg-[#004AAD] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
                <label className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-700">
                  <Filter className="w-3.5 h-3.5 text-[#004AAD]" />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as 'all' | 'CALLBACK')}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs sm:text-sm font-semibold"
                  >
                    <option value="all">All types</option>
                    <option value="CALLBACK">Follow-up only</option>
                  </select>
                </label>
              </div>
            </div>

            {filter === 'calendar' ? (
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 items-stretch sm:items-center rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                <div className="inline-flex rounded-lg bg-white border border-gray-200 p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPickMode('single');
                      setCustomEnd(customStart);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold ${
                      pickMode === 'single' ? 'bg-[#004AAD] text-white' : 'text-gray-600'
                    }`}
                  >
                    Single date
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickMode('range')}
                    className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold ${
                      pickMode === 'range' ? 'bg-[#004AAD] text-white' : 'text-gray-600'
                    }`}
                  >
                    Date range
                  </button>
                </div>
                <label className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-700">
                  <Calendar className="w-3.5 h-3.5 text-[#004AAD]" />
                  <span>{pickMode === 'range' ? 'From' : 'Date'}</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => {
                      const v = e.target.value || istYmd();
                      setCustomStart(v);
                      if (pickMode === 'single') setCustomEnd(v);
                    }}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs sm:text-sm font-semibold"
                  />
                </label>
                {pickMode === 'range' ? (
                  <label className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-700">
                    <span>To</span>
                    <input
                      type="date"
                      value={customEnd}
                      min={customStart}
                      onChange={(e) => setCustomEnd(e.target.value || customStart)}
                      className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs sm:text-sm font-semibold"
                    />
                  </label>
                ) : null}
                <span className="text-[11px] sm:text-xs text-gray-500 font-medium">{calendarLabel}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Follow-ups List */}
        <div className="space-y-3 sm:space-y-4">
          {filteredFollowUps.length === 0 ? (
            <div className="card text-center py-8 sm:py-10 md:py-12">
              <Calendar className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-500 text-sm sm:text-base">No follow-ups found</p>
            </div>
          ) : (
            filteredFollowUps.map((followUp) => {
              const timeStatus = getTimeStatus(followUp.scheduled_time);
              
              return (
                <div 
                  key={followUp.id} 
                  className={`card hover:shadow-lg transition ${
                    timeStatus.urgent ? 'ring-2 ring-orange-500' : ''
                  }`}
                >
                  <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <h3 className="text-base sm:text-lg font-semibold truncate">
                              {followUp.lead?.customer_name || 'Unknown'}
                            </h3>
                            <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 rounded font-mono">
                              {followUp.lead?.lead_number}
                            </span>
                            <span className={`text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 rounded-full font-semibold ${
                              followUp.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                              followUp.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                              followUp.priority === 'LOW' ? 'bg-gray-100 text-gray-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {followUp.priority}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1 truncate">
                            {followUp.lead?.vehicle_make} {followUp.lead?.vehicle_model} • {followUp.lead?.customer_phone}
                          </p>
                        </div>
                        <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap flex-shrink-0 ${
                          timeStatus.color === 'red' ? 'bg-red-100 text-red-700' :
                          timeStatus.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                          timeStatus.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {timeStatus.label}
                        </span>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-semibold">Type:</span>
                          <span className="text-gray-700 truncate">{followUp.follow_up_type}</span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-semibold">Scheduled:</span>
                          <span className="text-gray-700">
                            {formatDateTime(followUp.scheduled_time)}
                          </span>
                        </div>

                        {followUp.reason && (
                          <div className="text-xs sm:text-sm">
                            <span className="font-semibold">Reason:</span>
                            <p className="text-gray-700 mt-0.5 sm:mt-1">{followUp.reason}</p>
                          </div>
                        )}

                        {followUp.context_notes && (
                          <div className="text-xs sm:text-sm">
                            <span className="font-semibold">Context:</span>
                            <p className="text-gray-600 italic mt-0.5 sm:mt-1">{followUp.context_notes}</p>
                          </div>
                        )}

                        {followUp.status === 'COMPLETED' && followUp.completion_notes && (
                          <div className="bg-green-50 p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm mt-1.5 sm:mt-2">
                            <p className="font-semibold text-green-700 mb-0.5 sm:mb-1">Completion Notes:</p>
                            <p className="text-gray-700">{followUp.completion_notes}</p>
                            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                              Completed on {formatDateTime(followUp.completed_at)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {followUp.status === 'PENDING' && (
                      <div className="flex flex-row sm:flex-col gap-2 lg:w-48">
                        <a 
                          href={`tel:${followUp.lead?.customer_phone}`}
                          className="btn btn-primary flex-1 sm:w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                        >
                          <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                          Call Now
                        </a>
                        <Link 
                          href={`${base}/leads/${followUp.lead_id}`}
                          className="btn btn-outline flex-1 sm:w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                        >
                          View Lead
                        </Link>
                        <button
                          onClick={() => {
                            const notes = prompt('Add completion notes (optional):');
                            if (notes !== null) {
                              markAsCompleted(followUp.id, notes);
                            }
                          }}
                          className="btn btn-outline flex-1 sm:w-full text-green-600 hover:bg-green-50 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                        >
                          <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                          Mark Done
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Cancel this follow-up?')) {
                              cancelFollowUp(followUp.id);
                            }
                          }}
                          className="btn btn-outline flex-1 sm:w-full text-red-600 hover:bg-red-50 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                        >
                          <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                          Cancel
                        </button>
                      </div>
                    )}

                    {followUp.status === 'COMPLETED' && (
                      <div className="flex items-center justify-center lg:w-48">
                        <div className="text-center">
                          <CheckCircle className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-green-500 mx-auto mb-1.5 sm:mb-2" />
                          <p className="text-xs sm:text-sm font-semibold text-green-700">Completed</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
