'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Loader2,
  Plus,
  Save,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  X,
  Zap,
} from 'lucide-react';
import { PUSH_ROLE_OPTIONS } from '@/lib/push/push-admin-constants';

type TemplateRow = {
  id: string;
  name: string;
  title: string;
  body: string;
  target_role?: string;
  priority?: string;
  category?: string;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
};

type AutomationRule = {
  id: string;
  template_id: string;
  trigger_type: string;
  schedule_mode: 'once_at_days' | 'daily_range' | string;
  days_min: number;
  days_max: number;
  is_active?: boolean;
};

function scheduleLabel(rule?: AutomationRule | null): string {
  if (!rule) return 'No schedule set — configure when this should auto-send';
  if (rule.schedule_mode === 'once_at_days' || rule.days_min === rule.days_max) {
    if (Number(rule.days_min) === 0) return 'Auto: once on expiry day';
    if (Number(rule.days_min) === 1) return 'Auto: once when 1 day left';
    return `Auto: once when ${rule.days_min} days left`;
  }
  return `Auto: daily when ${rule.days_min}–${rule.days_max} days left`;
}

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'system', label: 'System' },
  { value: 'operations', label: 'Operations' },
  { value: 'automation', label: 'Automation' },
] as const;

const EMPTY_CREATE = {
  name: '',
  title: '',
  body: '',
  description: '',
  target_role: 'CUSTOMER',
  priority: 'default',
  category: 'general',
  is_active: true,
};

export default function PushTemplatesSection() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fallback, setFallback] = useState(false);
  const [filter, setFilter] = useState<'all' | 'automation' | 'manual'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; body: string; description: string }>({
    title: '',
    body: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);
  const [rulesByTemplate, setRulesByTemplate] = useState<Record<string, AutomationRule>>({});
  const [scheduleTpl, setScheduleTpl] = useState<TemplateRow | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    trigger_type: 'welcome_bonus_expiry',
    schedule_mode: 'once_at_days' as 'once_at_days' | 'daily_range',
    days_min: 15,
    days_max: 15,
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      const res = await fetch('/api/super_admin/notifications/automation-rules');
      const json = await res.json();
      if (!res.ok) return;
      const map: Record<string, AutomationRule> = {};
      for (const r of json.rules || []) {
        if (r?.template_id) map[String(r.template_id)] = r;
      }
      setRulesByTemplate(map);
    } catch {
      /* optional until SQL 293 */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/super_admin/notifications/templates?all=1');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load templates');
      setTemplates(Array.isArray(json.templates) ? json.templates : []);
      setFallback(Boolean(json.fallback));
      await loadRules();
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [loadRules]);

  useEffect(() => {
    void load();
  }, [load]);

  const openSchedule = (t: TemplateRow) => {
    const existing = rulesByTemplate[t.id];
    setScheduleTpl(t);
    if (existing) {
      setScheduleForm({
        trigger_type: existing.trigger_type || 'welcome_bonus_expiry',
        schedule_mode:
          existing.schedule_mode === 'daily_range' ? 'daily_range' : 'once_at_days',
        days_min: Number(existing.days_min) || 0,
        days_max: Number(existing.days_max) || 0,
      });
    } else {
      setScheduleForm({
        trigger_type: 'welcome_bonus_expiry',
        schedule_mode: 'once_at_days',
        days_min: 15,
        days_max: 15,
      });
    }
    setError('');
    setSuccess('');
  };

  const saveSchedule = async () => {
    if (!scheduleTpl) return;
    setScheduleSaving(true);
    setError('');
    try {
      const res = await fetch('/api/super_admin/notifications/automation-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: scheduleTpl.id,
          trigger_type: scheduleForm.trigger_type || 'welcome_bonus_expiry',
          schedule_mode: scheduleForm.schedule_mode,
          days_min: scheduleForm.days_min,
          days_max:
            scheduleForm.schedule_mode === 'once_at_days'
              ? scheduleForm.days_min
              : scheduleForm.days_max,
          is_active: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to save schedule');
      setTemplates((prev) =>
        prev.map((row) =>
          row.id === scheduleTpl.id ? { ...row, category: 'automation' } : row,
        ),
      );
      if (json.rule) {
        setRulesByTemplate((prev) => ({ ...prev, [scheduleTpl.id]: json.rule }));
      } else {
        await loadRules();
      }
      setScheduleTpl(null);
      setSuccess(`Automation schedule saved for “${scheduleTpl.name}”`);
    } catch (e: any) {
      setError(e?.message || 'Failed to save schedule');
    } finally {
      setScheduleSaving(false);
    }
  };

  const removeAutomation = async (t: TemplateRow) => {
    if (!confirm(`Remove automation from “${t.name}”? It will become Manual again.`)) return;
    setError('');
    try {
      const res = await fetch(
        `/api/super_admin/notifications/automation-rules?template_id=${encodeURIComponent(t.id)}`,
        { method: 'DELETE' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setTemplates((prev) =>
        prev.map((row) => (row.id === t.id ? { ...row, category: 'general' } : row)),
      );
      setRulesByTemplate((prev) => {
        const next = { ...prev };
        delete next[t.id];
        return next;
      });
      setSuccess(`“${t.name}” moved to Manual`);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    }
  };

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      const cat = String(t.category || '').toLowerCase();
      if (filter === 'automation') return cat === 'automation';
      if (filter === 'manual') return cat !== 'automation';
      return true;
    });
  }, [templates, filter]);

  const startEdit = (t: TemplateRow) => {
    setEditingId(t.id);
    setDraft({
      title: t.title || '',
      body: t.body || '',
      description: t.description || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({ title: '', body: '', description: '' });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/super_admin/notifications/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          title: draft.title,
          body: draft.body,
          description: draft.description,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      setTemplates((prev) =>
        prev.map((t) => (t.id === editingId ? { ...t, ...json.template } : t)),
      );
      cancelEdit();
      setSuccess('Template updated');
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (t: TemplateRow) => {
    setError('');
    try {
      const res = await fetch('/api/super_admin/notifications/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, is_active: !t.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Update failed');
      setTemplates((prev) =>
        prev.map((row) => (row.id === t.id ? { ...row, ...json.template } : row)),
      );
    } catch (e: any) {
      setError(e?.message || 'Update failed');
    }
  };

  const createTemplate = async () => {
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/super_admin/notifications/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Create failed');
      if (json.template) {
        setTemplates((prev) => [...prev, json.template].sort(
          (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0),
        ));
      } else {
        await load();
      }
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE);
      setSuccess('Template created');
    } catch (e: any) {
      setError(e?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        Loading templates…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Notification Templates
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Manual broadcast copy + automated reminders. Use{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">{'{{amount}}'}</code> and{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">{'{{days_left}}'}</code> in automation
            templates.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'all' as const, label: 'All' },
              { id: 'automation' as const, label: 'Automation' },
              { id: 'manual' as const, label: 'Manual' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold border ${
                filter === f.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
              setError('');
              setSuccess('');
            }}
            disabled={fallback}
            className="push-btn-primary inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
            title={fallback ? 'Run SQL migrations first' : 'Create template'}
          >
            <Plus className="w-3.5 h-3.5" />
            New Template
          </button>
        </div>
      </div>

      {fallback ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Showing fallback templates. Run{' '}
          <code className="bg-white px-1 rounded">database/219_push_notification_management.sql</code> in
          Supabase to enable create/edit.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((t) => {
          const isAuto = String(t.category || '').toLowerCase() === 'automation';
          const editing = editingId === t.id;
          return (
            <div
              key={t.id}
              className={`push-card p-4 border ${
                t.is_active === false ? 'opacity-70 border-gray-200' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-gray-900 truncate">{t.name}</h3>
                    {isAuto ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                        <Zap className="w-3 h-3" /> Automation
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        <Bell className="w-3 h-3" /> Manual
                      </span>
                    )}
                    {t.priority === 'high' ? (
                      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                        High
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {t.target_role || 'CUSTOMER'} · {t.category || 'general'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleActive(t)}
                  disabled={fallback || String(t.id).startsWith('fallback')}
                  className="shrink-0 text-gray-600 hover:text-blue-600 disabled:opacity-40"
                  title={t.is_active === false ? 'Enable' : 'Disable'}
                >
                  {t.is_active === false ? (
                    <ToggleLeft className="w-7 h-7" />
                  ) : (
                    <ToggleRight className="w-7 h-7 text-blue-600" />
                  )}
                </button>
              </div>

              {editing ? (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase">Title</label>
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"
                  />
                  <label className="block text-xs font-bold text-gray-500 uppercase">Body</label>
                  <textarea
                    value={draft.body}
                    onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                  <label className="block text-xs font-bold text-gray-500 uppercase">Notes</label>
                  <input
                    value={draft.description}
                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      disabled={saving}
                      className="push-btn-primary inline-flex items-center gap-1.5 text-xs"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save
                    </button>
                    <button type="button" onClick={cancelEdit} className="push-btn-secondary text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-bold text-gray-900">{t.title}</p>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{t.body}</p>
                  {t.description ? (
                    <p className="text-xs text-gray-400 mt-2">{t.description}</p>
                  ) : null}
                  {(isAuto || rulesByTemplate[t.id]) && (
                    <p className="mt-2 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-800">
                      {scheduleLabel(rulesByTemplate[t.id])}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      disabled={fallback || String(t.id).startsWith('fallback')}
                      className="text-xs font-bold text-blue-600 hover:underline disabled:opacity-40"
                    >
                      Edit copy
                    </button>
                    <button
                      type="button"
                      onClick={() => openSchedule(t)}
                      disabled={fallback || String(t.id).startsWith('fallback')}
                      className="text-xs font-bold text-violet-700 hover:underline disabled:opacity-40"
                    >
                      {isAuto || rulesByTemplate[t.id]
                        ? 'Configure schedule'
                        : 'Mark as Automation'}
                    </button>
                    {(isAuto || rulesByTemplate[t.id]) && (
                      <button
                        type="button"
                        onClick={() => void removeAutomation(t)}
                        disabled={fallback || String(t.id).startsWith('fallback')}
                        className="text-xs font-bold text-slate-500 hover:underline disabled:opacity-40"
                      >
                        Move to Manual
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-gray-500">
          No templates in this filter.
        </div>
      ) : null}

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="font-bold text-gray-900">New notification template</h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto px-4 py-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  Internal name *
                </label>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Summer Service Offer"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  Push title *
                </label>
                <input
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Notification title"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  Push body *
                </label>
                <textarea
                  value={createForm.body}
                  onChange={(e) => setCreateForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Notification message"
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    Target role
                  </label>
                  <select
                    value={createForm.target_role}
                    onChange={(e) => setCreateForm((f) => ({ ...f, target_role: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    {PUSH_ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    Category
                  </label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    Priority
                  </label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm((f) => ({ ...f, priority: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="default">Default</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={createForm.is_active}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, is_active: e.target.checked }))
                      }
                      className="rounded border-gray-300"
                    />
                    Active
                  </label>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  Notes (optional)
                </label>
                <input
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="When / how this template is used"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createTemplate()}
                disabled={
                  creating ||
                  !createForm.name.trim() ||
                  !createForm.title.trim() ||
                  !createForm.body.trim()
                }
                className="flex-[2] push-btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Create template
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {scheduleTpl ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <h3 className="font-bold text-gray-900">Automation schedule</h3>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[280px]">
                  {scheduleTpl.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScheduleTpl(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 px-4 py-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  Trigger
                </label>
                <select
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                  value={scheduleForm.trigger_type}
                  onChange={(e) =>
                    setScheduleForm((f) => ({ ...f, trigger_type: e.target.value }))
                  }
                >
                  <option value="welcome_bonus_expiry">Welcome bonus wallet expiry</option>
                  <option value="membership_expiry">Membership plan expiry</option>
                  <option value="inactive_customer">Inactive customer (no booking)</option>
                  <option value="booking_completed_followup">Booking completed follow-up</option>
                </select>
                <p className="mt-1 text-[11px] text-gray-500">
                  Welcome bonus runs on daily cron (~10:00 AM IST). Other triggers use the same
                  day window against membership / booking activity.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">
                  When to send
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 rounded-xl border border-gray-200 p-3 cursor-pointer has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50">
                    <input
                      type="radio"
                      className="mt-1"
                      checked={scheduleForm.schedule_mode === 'once_at_days'}
                      onChange={() =>
                        setScheduleForm((f) => ({
                          ...f,
                          schedule_mode: 'once_at_days',
                          days_max: f.days_min,
                        }))
                      }
                    />
                    <span>
                      <span className="block text-sm font-bold text-gray-900">
                        Once — exact days left
                      </span>
                      <span className="text-xs text-gray-500">
                        e.g. only when 15 days remain (one push)
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 rounded-xl border border-gray-200 p-3 cursor-pointer has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50">
                    <input
                      type="radio"
                      className="mt-1"
                      checked={scheduleForm.schedule_mode === 'daily_range'}
                      onChange={() =>
                        setScheduleForm((f) => ({ ...f, schedule_mode: 'daily_range' }))
                      }
                    />
                    <span>
                      <span className="block text-sm font-bold text-gray-900">
                        Daily — days-left range
                      </span>
                      <span className="text-xs text-gray-500">
                        e.g. every day when 2–7 days left
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              {scheduleForm.schedule_mode === 'once_at_days' ? (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    Days before expiry
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={scheduleForm.days_min}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(365, Number(e.target.value) || 0));
                      setScheduleForm((f) => ({ ...f, days_min: v, days_max: v }));
                    }}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"
                  />
                  <p className="mt-1 text-[11px] text-gray-500">0 = expiry day itself</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                      From (min days)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={scheduleForm.days_min}
                      onChange={(e) =>
                        setScheduleForm((f) => ({
                          ...f,
                          days_min: Math.max(0, Math.min(365, Number(e.target.value) || 0)),
                        }))
                      }
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                      To (max days)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={scheduleForm.days_max}
                      onChange={(e) =>
                        setScheduleForm((f) => ({
                          ...f,
                          days_max: Math.max(0, Math.min(365, Number(e.target.value) || 0)),
                        }))
                      }
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"
                    />
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Preview:{' '}
                <strong className="text-slate-900">
                  {scheduleLabel({
                    id: '',
                    template_id: scheduleTpl.id,
                    trigger_type: scheduleForm.trigger_type || 'welcome_bonus_expiry',
                    schedule_mode: scheduleForm.schedule_mode,
                    days_min: scheduleForm.days_min,
                    days_max:
                      scheduleForm.schedule_mode === 'once_at_days'
                        ? scheduleForm.days_min
                        : scheduleForm.days_max,
                  })}
                </strong>
              </div>
            </div>
            <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
              <button
                type="button"
                onClick={() => setScheduleTpl(null)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveSchedule()}
                disabled={
                  scheduleSaving ||
                  (scheduleForm.schedule_mode === 'daily_range' &&
                    scheduleForm.days_min > scheduleForm.days_max)
                }
                className="flex-[2] push-btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {scheduleSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Save schedule
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
