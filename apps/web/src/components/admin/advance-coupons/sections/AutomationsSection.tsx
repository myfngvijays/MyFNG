'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Zap,
  Plus,
  Play,
  Pause,
  Trash2,
  ArrowRight,
  Sparkles,
  History,
  Settings2,
  Ticket,
} from 'lucide-react';
import {
  ACTION_LABELS,
  AUTOMATION_PLATFORM_CHANNELS,
  channelsForAutomationForm,
  formatAutomationChannelLabels,
  formatAutomationConditions,
  TRIGGER_LABELS,
} from '@/lib/coupon-automation-templates';
import { PcmEmptyState, PcmPageHeader, PcmStatCard, PcmStatusBadge } from '../shared';

type TabId = 'rules' | 'templates' | 'history' | 'coupon-rules';

const TRIGGER_OPTIONS = Object.entries(TRIGGER_LABELS).map(([value, label]) => ({ value, label }));
const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }));

type ModalMode = 'create' | 'template' | 'edit';

const emptyForm = {
  name: '',
  description: '',
  trigger_type: 'NEW_SIGNUP',
  action_type: 'ASSIGN_COUPON',
  coupon_id: '',
  channels: [] as string[],
  is_active: true,
};

export default function PcmAutomationsSection() {
  const [tab, setTab] = useState<TabId>('rules');
  const [automations, setAutomations] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [autoRes, couponRes] = await Promise.all([
        fetch('/api/admin/coupons/automations'),
        fetch('/api/admin/coupons'),
      ]);
      const autoJson = await autoRes.json();
      const couponJson = await couponRes.json();
      if (!autoRes.ok) throw new Error(autoJson?.error || 'Failed to load automations');
      setAutomations(autoJson.automations || []);
      setRuns(autoJson.runs || []);
      setTemplates(autoJson.templates || []);
      setSummary(autoJson.summary || null);
      setMigrationRequired(Boolean(autoJson.migration_required));
      if (couponRes.ok) setCoupons(couponJson.coupons || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const couponRules = useMemo(() => {
    return coupons
      .filter((c) => {
        const hasRule =
          c.first_order_only ||
          (Array.isArray(c.applicable_channels) && c.applicable_channels.length && !c.applicable_channels.includes('ALL')) ||
          (Array.isArray(c.applicable_city_ids) && c.applicable_city_ids.length) ||
          (Array.isArray(c.applicable_service_type_ids) && c.applicable_service_type_ids.length) ||
          c.usage_limit_per_customer ||
          c.is_public === false;
        return hasRule;
      })
      .map((c) => ({
        id: c.id,
        code: c.code,
        trigger: c.first_order_only ? 'First order only' : 'Checkout apply',
        conditions: [
          formatAutomationChannelLabels(c.applicable_channels),
          c.min_order_value ? `Min ₹${c.min_order_value}` : null,
          Array.isArray(c.applicable_city_ids) && c.applicable_city_ids.length ? `${c.applicable_city_ids.length} cities` : null,
          c.is_public === false ? 'Assigned customers only' : null,
          c.usage_limit_per_customer ? `Max ${c.usage_limit_per_customer}/customer` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        status: c.is_active ? 'Active' : 'Inactive',
      }));
  }, [coupons]);

  const toggleChannel = (channel: string) => {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(channel)
        ? f.channels.filter((c) => c !== channel)
        : [...f.channels, channel],
    }));
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingRuleId(null);
    setSelectedTemplateKey(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openTemplateModal = (tpl: any) => {
    setModalMode('template');
    setEditingRuleId(null);
    setSelectedTemplateKey(tpl.key);
    setForm({
      name: tpl.name,
      description: tpl.description,
      trigger_type: tpl.trigger_type,
      action_type: tpl.action_type,
      coupon_id: '',
      channels: channelsForAutomationForm(tpl.conditions?.channels),
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (rule: any) => {
    setModalMode('edit');
    setEditingRuleId(rule.id);
    setSelectedTemplateKey(rule.template_key || null);
    setForm({
      name: rule.name || '',
      description: rule.description || '',
      trigger_type: rule.trigger_type || 'NEW_SIGNUP',
      action_type: rule.action_type || 'ASSIGN_COUPON',
      coupon_id: rule.coupon_id || rule.coupon?.id || '',
      channels: channelsForAutomationForm(rule.conditions?.channels),
      is_active: rule.is_active !== false,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalMode('create');
    setEditingRuleId(null);
    setSelectedTemplateKey(null);
    setForm(emptyForm);
  };

  const buildConditionsPayload = () => {
    const base =
      modalMode === 'template' && selectedTemplateKey
        ? (templates.find((t) => t.key === selectedTemplateKey)?.conditions as Record<string, unknown>) || {}
        : {};
    return {
      ...base,
      channels: form.channels.length ? form.channels : ['ALL'],
    };
  };

  const saveAutomation = async () => {
    setSaving(true);
    setError('');
    try {
      const conditions = buildConditionsPayload();
      if (modalMode === 'edit' && editingRuleId) {
        const res = await fetch(`/api/admin/coupons/automations/${editingRuleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            description: form.description,
            trigger_type: form.trigger_type,
            action_type: form.action_type,
            coupon_id: form.coupon_id || null,
            conditions,
            is_active: form.is_active,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Could not update automation');
      } else {
        const res = await fetch('/api/admin/coupons/automations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            description: form.description,
            trigger_type: form.trigger_type,
            action_type: form.action_type,
            coupon_id: form.coupon_id || null,
            conditions,
            is_active: form.is_active,
            ...(modalMode === 'template' && selectedTemplateKey ? { template_key: selectedTemplateKey } : {}),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Could not create automation');
      }
      closeModal();
      await load();
      if (modalMode === 'template') setTab('rules');
    } catch (err: any) {
      setError(err?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleAutomation = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/coupons/automations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Update failed');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed');
    }
  };

  const deleteAutomation = async (id: string) => {
    if (!window.confirm('Delete this automation rule?')) return;
    try {
      const res = await fetch(`/api/admin/coupons/automations/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Delete failed');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed');
    }
  };

  if (loading) return <div className="h-40 pcm-card rounded-xl border animate-pulse" />;

  return (
    <div>
      <PcmPageHeader
        title="Automation Engine"
        description="Rule engine — auto-assign & auto-apply coupons based on triggers"
        actions={
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white pcm-btn-primary"
            onClick={openCreateModal}
            disabled={migrationRequired}
          >
            <Plus className="w-4 h-4" />
            Create Rule
          </button>
        }
      />

      {migrationRequired ? (
        <div className="mb-4 pcm-card rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Migration required:</strong> Run <code className="bg-white px-1 rounded">database/158_coupon_automations.sql</code> in Supabase to enable saving automation rules. Templates are visible below — activate after migration.
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 pcm-card rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <PcmStatCard label="Active Rules" value={summary?.active || 0} icon={<Zap className="w-5 h-5" />} accent="primary" />
        <PcmStatCard label="Total Rules" value={summary?.total || 0} icon={<Settings2 className="w-5 h-5" />} accent="violet" />
        <PcmStatCard label="Total Runs" value={summary?.total_runs || 0} icon={<Play className="w-5 h-5" />} accent="emerald" />
        <PcmStatCard label="Templates" value={templates.length} icon={<Sparkles className="w-5 h-5" />} accent="amber" />
      </div>

      <div className="flex gap-2 border-b border-[#e6e0da] mb-5 overflow-x-auto">
        {[
          { id: 'rules' as TabId, label: 'My Rules', icon: Zap },
          { id: 'templates' as TabId, label: 'Templates', icon: Sparkles },
          { id: 'history' as TabId, label: 'Run History', icon: History },
          { id: 'coupon-rules' as TabId, label: 'Coupon Eligibility', icon: Ticket },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                tab === item.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'rules' ? (
        automations.length === 0 ? (
          <PcmEmptyState
            title="No automation rules yet"
            description="Start from a ready-made template or create a custom rule to auto-assign coupons on signup, first order, inactivity, and more."
            action={
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'var(--pcm-primary)' }}
                onClick={() => setTab('templates')}
              >
                Browse Templates
              </button>
            }
          />
        ) : (
          <div className="grid gap-4">
            {automations.map((rule) => (
              <div key={rule.id} className="pcm-card rounded-xl border p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-[#15110d]">{rule.name}</h3>
                        <PcmStatusBadge status={rule.is_active ? 'Active' : 'Paused'} />
                      </div>
                      {rule.description ? <p className="text-sm text-[#72665e] mt-1">{rule.description}</p> : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2 py-1 rounded-full bg-[#f7f3ec] font-medium">
                          IF {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#72665e]" />
                        <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-800 font-medium">
                          THEN {ACTION_LABELS[rule.action_type] || rule.action_type}
                        </span>
                        {rule.coupon?.code ? (
                          <>
                            <ArrowRight className="w-3.5 h-3.5 text-[#72665e]" />
                            <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 font-semibold">
                              {rule.coupon.code}
                            </span>
                          </>
                        ) : (
                          <span className="text-amber-700">· No coupon linked</span>
                        )}
                      </div>
                      <p className="text-xs text-[#72665e] mt-2">
                        {formatAutomationConditions(rule.conditions || {})}
                        {rule.run_count ? ` · ${rule.run_count} runs` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="p-2 rounded-lg border border-[#e6e0da] hover:bg-[#f7f3ec]"
                      title="Edit rule"
                      onClick={() => openEditModal(rule)}
                    >
                      <Settings2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="p-2 rounded-lg border border-[#e6e0da] hover:bg-[#f7f3ec]"
                      title={rule.is_active ? 'Pause' : 'Activate'}
                      onClick={() => toggleAutomation(rule.id, !rule.is_active)}
                    >
                      {rule.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                      title="Delete"
                      onClick={() => deleteAutomation(rule.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}

      {tab === 'templates' ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div key={tpl.key} className="pcm-card rounded-xl border p-5 flex flex-col">
              <div className="text-3xl mb-2">{tpl.icon}</div>
              <h3 className="font-bold">{tpl.name}</h3>
              <p className="text-sm text-[#72665e] mt-1 flex-1">{tpl.description}</p>
              <div className="mt-3 text-xs text-[#72665e] space-y-1">
                <p><strong>Trigger:</strong> {TRIGGER_LABELS[tpl.trigger_type]}</p>
                <p><strong>Action:</strong> {ACTION_LABELS[tpl.action_type]}</p>
                <p><strong>Channels:</strong> {formatAutomationChannelLabels(tpl.conditions?.channels)}</p>
              </div>
              <button
                type="button"
                disabled={saving || migrationRequired || tpl.already_used}
                className="mt-4 w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: tpl.already_used ? '#9ca3af' : 'var(--pcm-primary)' }}
                onClick={() => openTemplateModal(tpl)}
              >
                {tpl.already_used ? 'Already Added' : 'Use Template'}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="pcm-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f3ec]">
              <tr>
                <th className="px-4 py-3 text-left">When</th>
                <th className="px-4 py-3 text-left">Rule</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Message</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#72665e]">
                    No automation runs yet. Runs appear when rules execute on signup, checkout, etc.
                  </td>
                </tr>
              ) : (
                runs.map((row) => (
                  <tr key={row.id} className="border-t border-[#e6e0da]">
                    <td className="px-4 py-3">{new Date(row.created_at).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">{row.automation?.name || '—'}</td>
                    <td className="px-4 py-3">{row.customer_phone || '—'}</td>
                    <td className="px-4 py-3"><PcmStatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 text-xs text-[#72665e]">{row.message || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'coupon-rules' ? (
        couponRules.length === 0 ? (
          <PcmEmptyState
            title="No coupon eligibility rules"
            description="Coupons with channel, city, first-order or per-customer limits appear here as checkout eligibility rules."
          />
        ) : (
          <div className="grid gap-4">
            {couponRules.map((rule) => (
              <div key={rule.id} className="pcm-card rounded-xl border p-4">
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold">{rule.code}</h3>
                  <PcmStatusBadge status={rule.status} />
                </div>
                <p className="text-sm text-[#72665e] mt-2"><strong>Trigger:</strong> {rule.trigger}</p>
                <p className="text-sm text-[#72665e]"><strong>Conditions:</strong> {rule.conditions || '—'}</p>
              </div>
            ))}
          </div>
        )
      ) : null}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="pcm-card rounded-xl border w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-1">
              {modalMode === 'template' ? 'Activate Template' : modalMode === 'edit' ? 'Edit Automation Rule' : 'Create Automation Rule'}
            </h3>
            {modalMode === 'template' ? (
              <p className="text-sm text-[#72665e] mb-4">Pick a coupon and platforms before activating this template.</p>
            ) : null}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#72665e]">Rule name</label>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e6e0da] text-sm"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Mumbai welcome offer"
                  readOnly={modalMode === 'template'}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#72665e]">Description</label>
                <textarea
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e6e0da] text-sm"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  readOnly={modalMode === 'template'}
                />
              </div>
              {modalMode === 'create' || modalMode === 'edit' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#72665e]">Trigger</label>
                    <select
                      className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e6e0da] text-sm"
                      value={form.trigger_type}
                      onChange={(e) => setForm((f) => ({ ...f, trigger_type: e.target.value }))}
                    >
                      {TRIGGER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#72665e]">Action</label>
                    <select
                      className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e6e0da] text-sm"
                      value={form.action_type}
                      onChange={(e) => setForm((f) => ({ ...f, action_type: e.target.value }))}
                    >
                      {ACTION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-[#f7f3ec] px-3 py-2 text-xs text-[#72665e] space-y-1">
                  <p><strong>Trigger:</strong> {TRIGGER_LABELS[form.trigger_type]}</p>
                  <p><strong>Action:</strong> {ACTION_LABELS[form.action_type]}</p>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-[#72665e]">
                  Link coupon {modalMode === 'template' ? '(required)' : '(optional)'}
                </label>
                <select
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e6e0da] text-sm"
                  value={form.coupon_id}
                  onChange={(e) => setForm((f) => ({ ...f, coupon_id: e.target.value }))}
                >
                  <option value="">Select coupon…</option>
                  {coupons.filter((c) => c.is_active).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}{c.description ? ` · ${c.description}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#72665e] mb-2 block">
                  Platforms (select one or more; leave empty for all)
                </label>
                <div className="flex flex-wrap gap-2">
                  {AUTOMATION_PLATFORM_CHANNELS.map((ch) => {
                    const active = form.channels.includes(ch.id);
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                          active
                            ? 'bg-[#e54800] text-white border-[#e54800]'
                            : 'bg-white text-gray-700 border-gray-300'
                        }`}
                        onClick={() => toggleChannel(ch.id)}
                      >
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="px-4 py-2 rounded-lg border text-sm" onClick={closeModal}>
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  saving
                  || !form.name.trim()
                  || (modalMode === 'template' && !form.coupon_id)
                }
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--pcm-primary)' }}
                onClick={saveAutomation}
              >
                {saving
                  ? 'Saving…'
                  : modalMode === 'template'
                    ? 'Activate Template'
                    : modalMode === 'edit'
                      ? 'Save Changes'
                      : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
