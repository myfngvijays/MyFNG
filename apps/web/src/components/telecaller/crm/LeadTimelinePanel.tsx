'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Clock,
  History,
  Loader2,
  MessageCircle,
  PhoneCall,
  Plus,
  Car,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

type Item = {
  id: string;
  kind: 'call' | 'followup' | 'whatsapp' | 'system' | 'booking';
  at: string;
  title: string;
  body?: string | null;
  meta?: Record<string, unknown>;
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

/**
 * TeleCRM-style Activity History + Task tabs on lead detail.
 */
export default function LeadTimelinePanel({ leadId }: { leadId: string }) {
  const [tab, setTab] = useState<'history' | 'tasks'>('history');
  const [items, setItems] = useState<Item[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    follow_up_type: 'CALLBACK',
    scheduled_time: '',
    reason: '',
    priority: 'NORMAL',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/telecaller/crm/lead-timeline?lead_id=${encodeURIComponent(leadId)}`,
      );
      const json = await res.json().catch(() => ({}));
      setItems(Array.isArray(json?.items) ? json.items : []);
      setTasks(Array.isArray(json?.tasks) ? json.tasks : []);
    } catch {
      setItems([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed to create task');
    } finally {
      setSavingTask(false);
    }
  };

  const icon = (kind: string) => {
    if (kind === 'whatsapp') return <MessageCircle className="h-3.5 w-3.5 text-[#128C7E]" />;
    if (kind === 'call') return <PhoneCall className="h-3.5 w-3.5 text-[#004AAD]" />;
    if (kind === 'booking') return <Car className="h-3.5 w-3.5 text-violet-600" />;
    if (kind === 'followup') return <CheckSquare className="h-3.5 w-3.5 text-amber-600" />;
    return <Clock className="h-3.5 w-3.5 text-slate-400" />;
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
                  Due {t.scheduled_time ? formatDateTime(t.scheduled_time) : '—'}
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
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex rounded-xl bg-slate-100 p-0.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 ${
              tab === 'history' ? 'bg-white text-[#023D95] shadow-sm' : 'text-slate-500'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Activity History
          </button>
          <button
            type="button"
            onClick={() => setTab('tasks')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 ${
              tab === 'tasks' ? 'bg-white text-[#023D95] shadow-sm' : 'text-slate-500'
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

      {loading ? (
        <div className="flex justify-center py-6 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : tab === 'history' ? (
        items.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No activity yet</p>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {items.map((it) => (
              <li
                key={it.id}
                className={`rounded-xl border p-2.5 ${
                  it.kind === 'booking'
                    ? 'border-violet-200 bg-violet-50/70'
                    : 'border-slate-100 bg-slate-50/80'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">{icon(it.kind)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800">{it.title}</p>
                    {it.body ? (
                      <p className="text-[11px] text-slate-600 mt-0.5 whitespace-pre-wrap">
                        {it.body}
                      </p>
                    ) : null}
                    <p className="text-[10px] text-slate-400 mt-1">{formatDateTime(it.at)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="space-y-2">
          {showAddTask ? (
            <div className="mb-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
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
