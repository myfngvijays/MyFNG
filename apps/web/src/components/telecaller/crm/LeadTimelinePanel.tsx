'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Clock,
  History,
  Loader2,
  Phone,
  Plus,
} from 'lucide-react';
import { formatDateTimeIST } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  CallRecordingCardRow,
  formatCallLogDuration,
} from '@/components/telecaller/CallRecordingPlayer';
import { leadStatusCardColors } from '@/lib/telecaller/leadDisplayStatus';

type ProfileHistoryItem = {
  at?: string;
  summary?: string;
  remark?: string | null;
  status?: string | null;
  event?: string | null;
  previous_status?: string | null;
  previous_label?: string | null;
  workshop_name?: string | null;
  city?: string | null;
  pincode?: string | null;
  lost_reason?: string | null;
};

type TaskRow = {
  id: string;
  follow_up_type: string;
  status: string;
  scheduled_time: string | null;
  reason: string | null;
  priority: string;
  bucket: 'late' | 'active' | 'closed';
};

type CallLog = {
  id: string;
  call_status?: string | null;
  call_duration?: number | null;
  outcome?: string | null;
  notes?: string | null;
  customer_response?: string | null;
  created_at?: string | null;
  call_recording_url?: string | null;
  telecaller?: { full_name?: string | null } | null;
  telecaller_name?: string | null;
};

function getLeadCouponMeta(lead: Record<string, any> | null | undefined) {
  return lead?.coupon_meta && typeof lead.coupon_meta === 'object' && !Array.isArray(lead.coupon_meta)
    ? (lead.coupon_meta as Record<string, unknown>)
    : {};
}

function getProfileHistory(lead: Record<string, any> | null | undefined): ProfileHistoryItem[] {
  const meta = getLeadCouponMeta(lead);
  return Array.isArray(meta.profile_history) ? (meta.profile_history as ProfileHistoryItem[]) : [];
}

function prettifyDisposition(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.replace(/_/g, ' ');
}

function dispositionBadgeStyle(statusLabel?: string | null) {
  const c = leadStatusCardColors(String(statusLabel || ''));
  return {
    backgroundColor: c.badgeBg,
    color: c.badgeText,
    boxShadow: `inset 0 0 0 1px ${c.border}`,
  } as React.CSSProperties;
}

/** Hide vendor tag in call notes shown to CRM users. */
function displayCallNotes(notes: string | null | undefined): string {
  return String(notes || '')
    .replace(/\[Smartflo\]\s*/gi, '')
    .replace(/\bSmartflo\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function fmtAt(value?: string | null) {
  const raw = formatDateTimeIST(value || null);
  if (!raw || raw === '—') return '—';
  // Compact: "11-08-2026 06:55 PM" → "11 Aug, 6:55 PM"
  const m = raw.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return raw;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(m[2]) - 1] || m[2];
  const hour = String(Number(m[4]));
  return `${m[1]} ${month}, ${hour}:${m[5]} ${m[6].toUpperCase()}`;
}

/**
 * TeleCRM / Admin-style Activity timeline + Task tabs on lead detail.
 * Merges profile_history updates + call logs (with recording Play) newest-first.
 */
export default function LeadTimelinePanel({
  leadId,
  lead = null,
  callLogs: callLogsProp,
  refreshKey = 0,
}: {
  leadId: string;
  /** Lead row — used for coupon_meta.profile_history + latest status summary */
  lead?: Record<string, any> | null;
  /** Optional prefetched logs; otherwise fetched from /api/telecaller/calls */
  callLogs?: CallLog[];
  /** Bump from parent after logging a call / follow-up so feed reloads. */
  refreshKey?: number;
}) {
  const [tab, setTab] = useState<'history' | 'tasks'>('history');
  const [callLogs, setCallLogs] = useState<CallLog[]>(
    Array.isArray(callLogsProp) ? callLogsProp : [],
  );
  const [loadingLogs, setLoadingLogs] = useState(!Array.isArray(callLogsProp));
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [activityShowAll, setActivityShowAll] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    follow_up_type: 'CALLBACK',
    scheduled_time: '',
    reason: '',
    priority: 'NORMAL',
  });

  const loadCalls = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/telecaller/calls/${encodeURIComponent(leadId)}`);
      const json = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(json?.call_logs)) {
        setCallLogs(json.call_logs);
      } else if (Array.isArray(callLogsProp)) {
        setCallLogs(callLogsProp);
      } else {
        setCallLogs([]);
      }
    } catch {
      setCallLogs(Array.isArray(callLogsProp) ? callLogsProp : []);
    } finally {
      setLoadingLogs(false);
    }
  }, [leadId, callLogsProp]);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch(
        `/api/telecaller/crm/lead-timeline?lead_id=${encodeURIComponent(leadId)}`,
      );
      const json = await res.json().catch(() => ({}));
      setTasks(Array.isArray(json?.tasks) ? json.tasks : []);
    } catch {
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [leadId]);

  useEffect(() => {
    void loadCalls();
    void loadTasks();
  }, [loadCalls, loadTasks, refreshKey]);

  useEffect(() => {
    if (Array.isArray(callLogsProp) && callLogsProp.length > 0 && callLogs.length === 0) {
      setCallLogs(callLogsProp);
    }
  }, [callLogsProp, callLogs.length]);

  const couponMeta = getLeadCouponMeta(lead);
  const profileHistory = getProfileHistory(lead);
  const latestLabel = prettifyDisposition(
    (couponMeta.last_call_label as string) || (couponMeta.last_call_result as string) || null,
  );
  const latestRemark =
    String((lead as any)?.telecaller_remarks || couponMeta.telecaller_remarks || '').trim() || null;

  const activityFeed = useMemo(() => {
    type FeedItem =
      | { kind: 'update'; at: number; key: string; entry: ProfileHistoryItem }
      | { kind: 'call'; at: number; key: string; log: CallLog };

    const items: FeedItem[] = [];

    profileHistory.forEach((entry, index) => {
      const t = entry.at ? Date.parse(String(entry.at)) : NaN;
      items.push({
        kind: 'update',
        at: Number.isFinite(t) ? t : 0,
        key: `upd-${entry.at || 'x'}-${index}`,
        entry,
      });
    });

    callLogs.forEach((log, index) => {
      const t = log?.created_at ? Date.parse(String(log.created_at)) : NaN;
      items.push({
        kind: 'call',
        at: Number.isFinite(t) ? t : 0,
        key: `call-${log?.id || index}`,
        log,
      });
    });

    items.sort((a, b) => b.at - a.at);
    return items;
  }, [profileHistory, callLogs]);

  const hasAny =
    activityFeed.length > 0 || Boolean(latestLabel) || Boolean(latestRemark);

  const taskBuckets = useMemo(() => {
    const late = tasks.filter((t) => t.bucket === 'late');
    const active = tasks.filter((t) => t.bucket === 'active');
    const closed = tasks.filter((t) => t.bucket === 'closed');
    return { late, active, closed };
  }, [tasks]);

  const addTask = async () => {
    if (!taskForm.scheduled_time) {
      alert('Pick due date/time');
      return;
    }
    setSavingTask(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const phone = String(user.phone || '').replace(/\D/g, '').slice(-10);
      const email = String(user.email || '').trim();
      let telecallerId: string | null = null;
      if (email) {
        const { data } = await supabase.from('users_login').select('id').eq('email', email).maybeSingle();
        telecallerId = data?.id ? String(data.id) : null;
      }
      if (!telecallerId && phone) {
        const { data } = await supabase.from('users_login').select('id').eq('phone', phone).maybeSingle();
        telecallerId = data?.id ? String(data.id) : null;
      }
      if (!telecallerId) {
        const { data } = await supabase.from('users_login').select('id').eq('id', user.id).maybeSingle();
        telecallerId = data?.id ? String(data.id) : user.id;
      }

      const scheduledIso = new Date(taskForm.scheduled_time).toISOString();
      const { error } = await supabase.from('telecaller_follow_ups').insert([
        {
          lead_id: leadId,
          telecaller_id: telecallerId,
          follow_up_type: taskForm.follow_up_type,
          scheduled_time: scheduledIso,
          reason: taskForm.reason || null,
          priority: taskForm.priority,
          status: 'PENDING',
        },
      ]);
      if (error) throw new Error(error.message);

      await supabase
        .from('service_leads')
        .update({ follow_up_required: true, next_follow_up_at: scheduledIso })
        .eq('id', leadId);

      setTaskForm({
        follow_up_type: 'CALLBACK',
        scheduled_time: '',
        reason: '',
        priority: 'NORMAL',
      });
      setShowAddTask(false);
      setTab('tasks');
      await loadTasks();
    } catch (e: any) {
      alert(e?.message || 'Failed to create task');
    } finally {
      setSavingTask(false);
    }
  };

  const renderTaskGroup = (
    label: string,
    color: string,
    rows: TaskRow[],
    defaultOpen?: boolean,
  ) => (
    <details open={defaultOpen || rows.length > 0} className="rounded-xl border border-slate-200 bg-white">
      <summary className={`cursor-pointer select-none px-3 py-2 text-xs font-black uppercase tracking-wide ${color}`}>
        {label} ({rows.length})
      </summary>
      {rows.length === 0 ? (
        <p className="px-3 pb-3 text-[11px] text-slate-400">None</p>
      ) : (
        <ul className="divide-y divide-slate-100 px-1 pb-2">
          {rows.map((t) => (
            <li key={t.id} className="flex items-start gap-2 px-2 py-2.5">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800">
                  {String(t.follow_up_type || 'Task').replace(/_/g, ' ')}
                </p>
                {t.reason ? (
                  <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{t.reason}</p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-0.5">No description</p>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  Due {t.scheduled_time ? fmtAt(t.scheduled_time) : '—'}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                {t.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );

  return (
    <div className="min-w-0 w-full rounded-2xl border border-teal-200 bg-teal-50/50 p-3 shadow-sm sm:p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex rounded-xl bg-white/80 p-0.5 text-[11px] font-bold ring-1 ring-teal-100">
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 ${
              tab === 'history' ? 'bg-teal-700 text-white shadow-sm' : 'text-teal-900'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Activity
            {activityFeed.length > 0 ? (
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  tab === 'history' ? 'bg-teal-600 text-white' : 'bg-teal-100 text-teal-800'
                }`}
              >
                {activityFeed.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTab('tasks')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 ${
              tab === 'tasks' ? 'bg-teal-700 text-white shadow-sm' : 'text-teal-900'
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Task
            {tasks.filter((t) => t.bucket !== 'closed').length > 0 ? (
              <span className="rounded-full bg-[#004AAD] px-1.5 text-[10px] text-white">
                {tasks.filter((t) => t.bucket !== 'closed').length}
              </span>
            ) : null}
          </button>
        </div>
        {tab === 'tasks' ? (
          <button
            type="button"
            onClick={() => setShowAddTask((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg bg-[#004AAD] px-2 py-1 text-[11px] font-bold text-white"
          >
            <Plus className="h-3.5 w-3.5" /> Action
          </button>
        ) : null}
      </div>

      {tab === 'history' ? (
        <>
          {(latestLabel || latestRemark || couponMeta.last_call_at) && (
            <div className="mb-2.5 grid grid-cols-1 gap-1.5">
              <div className="rounded-lg border border-teal-100 bg-white px-2 py-1.5">
                <p className="text-[8px] font-bold uppercase tracking-wide text-teal-700">Latest status</p>
                <p className="mt-0.5 break-words text-[11px] font-semibold text-slate-900">{latestLabel || '—'}</p>
              </div>
              <div className="rounded-lg border border-teal-100 bg-white px-2 py-1.5">
                <p className="text-[8px] font-bold uppercase tracking-wide text-teal-700">Latest remark</p>
                <p className="mt-0.5 break-words text-[11px] font-semibold text-slate-900 line-clamp-2">
                  {latestRemark || '—'}
                </p>
              </div>
              <div className="rounded-lg border border-teal-100 bg-white px-2 py-1.5">
                <p className="text-[8px] font-bold uppercase tracking-wide text-teal-700">Last activity</p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-900">
                  {fmtAt(
                    String(
                      couponMeta.last_call_at ||
                        profileHistory[0]?.at ||
                        callLogs[0]?.created_at ||
                        '',
                    ) || null,
                  )}
                </p>
              </div>
            </div>
          )}

          {loadingLogs ? (
            <div className="flex justify-center py-6 text-teal-600">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !hasAny ? (
            <p className="text-center text-[11px] text-slate-500 py-4">
              No telecaller activity logged for this lead yet.
            </p>
          ) : (
            <div className="relative max-h-[28rem] overflow-y-auto overflow-x-hidden pr-0.5">
              {/* Vertical rail — centered through the 20px icon column */}
              <div
                className="pointer-events-none absolute bottom-2 left-[9px] top-2 w-0.5 bg-teal-200"
                aria-hidden
              />
              <ul className="relative space-y-2">
              {(activityShowAll ? activityFeed : activityFeed.slice(0, 10)).map((item) => {
                if (item.kind === 'update') {
                  const entry = item.entry;
                  const status = prettifyDisposition(entry.status || entry.previous_label || null);
                  return (
                    <li key={item.key} className="relative flex items-start gap-2.5">
                      <span className="relative z-10 mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 ring-2 ring-teal-50">
                        <History className="h-2.5 w-2.5" />
                      </span>
                      <div className="min-w-0 flex-1 rounded-lg border border-teal-100 bg-white px-2.5 py-2 shadow-sm">
                        <div className="flex items-start gap-2">
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                            {status ? (
                              <span
                                className="inline-flex max-w-full rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                                style={dispositionBadgeStyle(status)}
                              >
                                {status}
                              </span>
                            ) : null}
                            {entry.event ? (
                              <span className="max-w-full break-words text-[9px] font-medium uppercase tracking-wide text-gray-400">
                                {String(entry.event).replace(/_/g, ' ')}
                              </span>
                            ) : null}
                          </div>
                          <span className="shrink-0 whitespace-nowrap pt-0.5 text-[9px] tabular-nums text-gray-400">
                            {fmtAt(entry.at || null)}
                          </span>
                        </div>
                        {entry.summary ? (
                          <p className="mt-1 break-words text-[11px] font-medium leading-snug text-gray-900">
                            {entry.summary}
                          </p>
                        ) : null}
                        {entry.remark ? (
                          <p className="mt-0.5 break-words text-[10px] leading-snug text-gray-600">
                            <span className="font-semibold text-gray-500">Remark:</span> {entry.remark}
                          </p>
                        ) : null}
                        {entry.lost_reason ? (
                          <p className="mt-0.5 text-[9px] text-gray-500">
                            Lost reason: {entry.lost_reason}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                }

                const log = item.log;
                const telecallerName = log?.telecaller?.full_name || log?.telecaller_name || null;
                const hasRec =
                  Boolean(log.call_recording_url) || Boolean((log as any).has_call_recording);
                const durLabel = formatCallLogDuration(log.call_duration);
                const notesText = displayCallNotes(log.notes);
                return (
                  <li key={item.key} className="relative flex items-start gap-2.5">
                    <span className="relative z-10 mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800 ring-2 ring-teal-50">
                      <Phone className="h-2.5 w-2.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <CallRecordingCardRow
                        callLogId={String(log.id || '')}
                        hasRecording={hasRec}
                        durationSeconds={
                          log.call_duration != null ? Number(log.call_duration) : null
                        }
                      >
                        <div className="flex flex-wrap items-center gap-1 text-[10px]">
                          <span className="shrink-0 rounded-full bg-violet-50 px-1.5 py-0.5 font-bold uppercase tracking-wide text-violet-800 ring-1 ring-violet-200">
                            Call
                          </span>
                          {log.call_status ? (
                            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700">
                              {String(log.call_status).replace(/_/g, ' ')}
                            </span>
                          ) : null}
                          {log.outcome ? (
                            <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-800 ring-1 ring-amber-200">
                              {String(log.outcome).replace(/_/g, ' ')}
                            </span>
                          ) : null}
                          <span className="shrink-0 rounded-full bg-slate-50 px-1.5 py-0.5 font-semibold text-slate-600 ring-1 ring-slate-200">
                            {durLabel === '—' ? 'Duration —' : durLabel}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                          {telecallerName ? (
                            <span className="whitespace-nowrap font-medium text-teal-800">{telecallerName}</span>
                          ) : null}
                          <span className="whitespace-nowrap text-gray-400">
                            {fmtAt(log.created_at || null)}
                          </span>
                        </div>
                        {notesText ? (
                          <p className="mt-0.5 break-words text-[11px] leading-snug text-gray-700">{notesText}</p>
                        ) : null}
                        {log.customer_response ? (
                          <p className="mt-0.5 text-[10px] text-gray-500">Response: {log.customer_response}</p>
                        ) : null}
                        {!hasRec ? (
                          <p className="mt-0.5 text-[9px] text-gray-400">No recording yet</p>
                        ) : null}
                      </CallRecordingCardRow>
                    </div>
                  </li>
                );
              })}
              </ul>
              {activityFeed.length > 10 ? (
                <button
                  type="button"
                  onClick={() => setActivityShowAll((v) => !v)}
                  className="mt-2 w-full py-1.5 text-center text-[12px] font-bold text-[#004AAD]"
                >
                  {activityShowAll
                    ? 'View less'
                    : `View more (${activityFeed.length - 10})`}
                </button>
              ) : null}
            </div>
          )}
        </>
      ) : loadingTasks ? (
        <div className="flex justify-center py-6 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {showAddTask ? (
            <div className="mb-2 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <select
                className="w-full rounded-lg border px-2 py-1.5 text-sm"
                value={taskForm.follow_up_type}
                onChange={(e) => setTaskForm({ ...taskForm, follow_up_type: e.target.value })}
              >
                <option value="CALLBACK">Call reminder / Follow-up</option>
                <option value="PRICE_CONFIRMATION">Price confirmation</option>
                <option value="INFO_PENDING">Info pending</option>
                <option value="SLOT_CONFIRMATION">Slot confirmation</option>
              </select>
              <input
                type="datetime-local"
                className="w-full rounded-lg border px-2 py-1.5 text-sm"
                value={taskForm.scheduled_time}
                onChange={(e) => setTaskForm({ ...taskForm, scheduled_time: e.target.value })}
              />
              <textarea
                className="w-full rounded-lg border px-2 py-1.5 text-sm"
                rows={2}
                placeholder="Description / note…"
                value={taskForm.reason}
                onChange={(e) => setTaskForm({ ...taskForm, reason: e.target.value })}
              />
              <button
                type="button"
                disabled={savingTask}
                onClick={() => void addTask()}
                className="w-full rounded-lg bg-[#004AAD] py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {savingTask ? 'Saving…' : 'Create task'}
              </button>
            </div>
          ) : null}
          {renderTaskGroup('Late', 'text-rose-700', taskBuckets.late)}
          {renderTaskGroup('Active', 'text-violet-700', taskBuckets.active, true)}
          {renderTaskGroup('Closed', 'text-emerald-700', taskBuckets.closed)}
        </div>
      )}
    </div>
  );
}
