'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';
import { createClient } from '@/lib/supabase/client';
import {
  CRM_PERMISSION_CATALOG,
  CRM_PERMISSION_GROUPS,
  CRM_PERMISSION_KEYS,
  normalizeCrmPermissions,
  type CrmPermissionGroup,
  type CrmPermissionKey,
  type CrmPermissions,
} from '@/lib/telecaller/crmPermissions';
import { Loader2, Phone, Plus, RefreshCw, Save, Shield, Trash2, Users, X } from 'lucide-react';

type TelecallerRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  open_leads?: number;
};

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  permissions: CrmPermissions;
  is_default: boolean;
  /** Permissions added after this template was last saved. */
  missing_keys: CrmPermissionKey[];
};

type AssignedTc = {
  id: string;
  full_name: string | null;
  phone: string | null;
  template_id: string | null;
};

export default function LeadManagerTeamPage() {
  const [tab, setTab] = useState<'phones' | 'access'>('phones');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TelecallerRow[]>([]);
  const [phoneDrafts, setPhoneDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [assigned, setAssigned] = useState<AssignedTc[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [editTemplate, setEditTemplate] = useState<TemplateRow | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: telecallers, error: tcErr } = await supabase
        .from('users_login')
        .select('id, full_name, phone, email, is_active, roles!role_id(role_code)')
        .order('full_name', { ascending: true });
      if (tcErr) throw tcErr;

      const list = (telecallers || [])
        .filter((t: any) => String(t?.roles?.role_code || '').toUpperCase() === 'TELECALLER')
        .map((t: any) => ({
          id: String(t.id),
          full_name: t.full_name ? String(t.full_name) : null,
          phone: t.phone ? String(t.phone) : null,
          email: t.email ? String(t.email) : null,
          is_active: Boolean(t.is_active),
        }));

      const withCounts: TelecallerRow[] = [];
      for (const row of list) {
        const { count } = await supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_telecaller_id', row.id)
          .is('deleted_at', null);
        withCounts.push({ ...row, open_leads: count || 0 });
      }

      setRows(withCounts);
      setPhoneDrafts(Object.fromEntries(withCounts.map((r) => [r.id, r.phone || ''])));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  };

  const loadAccess = async () => {
    setAccessLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/lead-manager/crm-permissions');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load permissions');
      setTemplates(
        (json.templates || []).map((t: any) => ({
          id: String(t.id),
          name: String(t.name),
          description: t.description ? String(t.description) : null,
          permissions: normalizeCrmPermissions(t.permissions),
          is_default: Boolean(t.is_default),
          missing_keys: Array.isArray(t.missing_keys) ? t.missing_keys : [],
        })),
      );
      setAssigned(
        (json.telecallers || []).map((t: any) => ({
          id: String(t.id),
          full_name: t.full_name,
          phone: t.phone,
          template_id: t.template_id,
        })),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load access');
    } finally {
      setAccessLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (tab === 'access') void loadAccess();
  }, [tab]);

  const savePhone = async (id: string) => {
    const phone = String(phoneDrafts[id] || '').replace(/\D/g, '');
    if (phone.length < 10) {
      setError('Enter at least 10 digits');
      return;
    }
    setSavingId(id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/telecaller-lead-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-telecaller-phone', telecaller_id: id, phone }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Save failed');
      setMessage(json.message || 'Saved');
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, phone } : r)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingId(null);
    }
  };

  const assignTemplate = async (telecallerId: string, templateId: string) => {
    setSavingId(telecallerId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/lead-manager/crm-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          telecaller_id: telecallerId,
          template_id: templateId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Assign failed');
      setAssigned((prev) =>
        prev.map((t) => (t.id === telecallerId ? { ...t, template_id: templateId || null } : t)),
      );
      setMessage('Access template updated');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setSavingId(null);
    }
  };

  const saveTemplate = async () => {
    if (!editTemplate) return;
    setSavingId('template');
    setError(null);
    try {
      const res = await fetch('/api/lead-manager/crm-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert_template',
          id: editTemplate.id.startsWith('new-') ? undefined : editTemplate.id,
          name: editTemplate.name,
          description: editTemplate.description,
          permissions: editTemplate.permissions,
          is_default: editTemplate.is_default,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setEditTemplate(null);
      setMessage('Template saved');
      await loadAccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingId(null);
    }
  };

  const deleteTemplate = async () => {
    if (!editTemplate || editTemplate.id.startsWith('new-')) return;
    if (!confirm(`Delete template "${editTemplate.name}"? Iske telecallers Default template pe aa jayenge.`)) return;
    setSavingId('template');
    setError(null);
    try {
      const res = await fetch('/api/lead-manager/crm-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_template', id: editTemplate.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      setEditTemplate(null);
      setMessage('Template deleted');
      await loadAccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setSavingId(null);
    }
  };

  const groupCount = (g: CrmPermissionGroup) => CRM_PERMISSION_CATALOG.filter((p) => p.group === g).length;
  const defaultTemplate = templates.find((t) => t.is_default) || null;
  const effectiveTemplate = (t: AssignedTc) =>
    (t.template_id ? templates.find((x) => x.id === t.template_id) : null) || defaultTemplate;
  const assignedCount = (tpl: TemplateRow) =>
    assigned.filter((a) => (a.template_id ? a.template_id === tpl.id : tpl.is_default)).length;

  return (
    <DashboardLayout role="lead_manager">
      <div className="w-full min-w-0 max-w-5xl mx-auto space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[#023D95] flex items-center gap-2">
              <Users className="h-6 w-6" /> Telecaller Team
              <PageHelpIcon href="/dashboard/lead_manager/team" label="Team" />
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Telecallers ke phone numbers aur access templates — kaun kya dekh / kar sakta hai.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void (tab === 'access' ? loadAccess() : load())}
            className="btn btn-secondary text-xs flex items-center gap-1"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-200">
          {(
            [
              ['phones', 'Users / phones'],
              ['access', 'Permission templates'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-2 text-sm font-bold border-b-2 ${
                tab === id
                  ? 'border-[#004AAD] text-[#023D95]'
                  : 'border-transparent text-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {message ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>
        ) : null}

        {tab === 'phones' ? (
          loading ? (
            <div className="flex items-center gap-2 text-slate-500 py-16 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading team…
            </div>
          ) : (
            <div className="bg-white rounded-xl border divide-y overflow-hidden">
              {rows.length === 0 ? (
                <p className="p-6 text-sm text-slate-400">No telecallers found.</p>
              ) : (
                rows.map((t) => (
                  <div key={t.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="sm:w-48 shrink-0">
                      <div className="font-semibold text-sm text-slate-900">{t.full_name || 'Telecaller'}</div>
                      <div className="text-[11px] text-slate-500">{t.email || t.id.slice(0, 8)}</div>
                      <div className="text-[11px] font-bold text-indigo-700 mt-0.5">
                        {t.open_leads ?? 0} assigned leads
                      </div>
                    </div>
                    <div className="flex-1 flex gap-2 items-center">
                      <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                      <input
                        className="border rounded-md px-2 py-1.5 text-sm flex-1"
                        value={phoneDrafts[t.id] ?? ''}
                        onChange={(e) => setPhoneDrafts((p) => ({ ...p, [t.id]: e.target.value }))}
                        placeholder="WhatsApp / phone"
                      />
                      <button
                        type="button"
                        disabled={savingId === t.id}
                        onClick={() => void savePhone(t.id)}
                        className="btn btn-secondary text-xs flex items-center gap-1 disabled:opacity-50"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {savingId === t.id ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )
        ) : accessLoading && !templates.length ? (
          <div className="flex items-center gap-2 text-slate-500 py-16 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading access…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-slate-600">
              <Shield className="h-4 w-4 shrink-0 text-[#023D95]" />
              <p className="min-w-0 flex-1">
                <span className="font-bold text-slate-800">{CRM_PERMISSION_CATALOG.length} permissions</span> ·{' '}
                {CRM_PERMISSION_GROUPS.map((g) => `${g.label} ${groupCount(g.id)}`).join(' · ')}. Naya feature
                add hote hi yahan apne aap dikhega (<span className="font-bold text-amber-700">New</span> tag ke saath).
                Lead Manager / Admin ko hamesha full access.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-black text-slate-800">
                  <Shield className="h-4 w-4 text-[#023D95]" /> Templates
                </h2>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-xl bg-[#023D95] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#012f73]"
                  onClick={() =>
                    setEditTemplate({
                      id: `new-${Date.now()}`,
                      name: 'New template',
                      description: '',
                      permissions: normalizeCrmPermissions({}),
                      is_default: false,
                      missing_keys: [],
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> New template
                </button>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-2">
                {templates.map((t) => {
                  const on = CRM_PERMISSION_KEYS.filter((k) => t.permissions[k]).length;
                  const users = assignedCount(t);
                  return (
                    <div key={t.id} className="flex flex-col rounded-xl border border-slate-200 p-4 hover:border-[#004AAD]/40">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-1.5 font-bold text-slate-900">
                            {t.name}
                            {t.is_default ? (
                              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Default</span>
                            ) : null}
                            {t.missing_keys.length ? (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                {t.missing_keys.length} new to review
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">{t.description || '—'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditTemplate(t)}
                          className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-[#023D95] hover:bg-blue-50"
                        >
                          Edit
                        </button>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#023D95]"
                            style={{ width: `${Math.round((on / CRM_PERMISSION_KEYS.length) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-600">
                          {on}/{CRM_PERMISSION_KEYS.length} ON
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {CRM_PERMISSION_GROUPS.map((g) => {
                          const keys = CRM_PERMISSION_CATALOG.filter((p) => p.group === g.id).map((p) => p.key);
                          const n = keys.filter((k) => t.permissions[k]).length;
                          return (
                            <span key={g.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {g.label} {n}/{keys.length}
                            </span>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">
                        {users} telecaller{users === 1 ? '' : 's'} on this template
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-black text-slate-800">Assign to telecallers</h2>
                <p className="text-xs text-slate-500">"Default" chuno toh jo template Default hai wahi lagega</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">Telecaller</th>
                      <th className="px-4 py-2.5">Template</th>
                      <th className="px-4 py-2.5">Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assigned.map((t) => {
                      const tpl = effectiveTemplate(t);
                      const offLabels = tpl
                        ? CRM_PERMISSION_CATALOG.filter((p) => !tpl.permissions[p.key]).map((p) => p.label)
                        : [];
                      return (
                        <tr key={t.id}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{t.full_name || 'Telecaller'}</p>
                            <p className="text-[11px] text-slate-500">{t.phone || 'No phone'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              className="min-w-[200px] rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
                              value={t.template_id || ''}
                              disabled={savingId === t.id}
                              onChange={(e) => void assignTemplate(t.id, e.target.value)}
                            >
                              <option value="">Default ({defaultTemplate?.name || 'built-in'})</option>
                              {templates.map((tpl2) => (
                                <option key={tpl2.id} value={tpl2.id}>
                                  {tpl2.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {tpl ? (
                              <>
                                <span className="font-bold text-slate-800">
                                  {CRM_PERMISSION_KEYS.length - offLabels.length}/{CRM_PERMISSION_KEYS.length} ON
                                </span>
                                {offLabels.length ? (
                                  <p className="mt-0.5 max-w-[360px] truncate text-slate-400" title={offLabels.join(', ')}>
                                    Off: {offLabels.join(', ')}
                                  </p>
                                ) : (
                                  <p className="mt-0.5 text-emerald-700">Sab ON</p>
                                )}
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {!assigned.length ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">
                          No active telecallers.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {editTemplate ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 sm:items-center">
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-5 py-4">
                <div>
                  <h3 className="text-lg font-black text-[#023D95]">
                    {editTemplate.id.startsWith('new-') ? 'New template' : 'Edit template'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {CRM_PERMISSION_KEYS.filter((k) => editTemplate.permissions[k]).length}/{CRM_PERMISSION_KEYS.length} ON
                    {editTemplate.missing_keys.length
                      ? ` · ${editTemplate.missing_keys.length} naye permissions — check karke Save karo`
                      : ''}
                  </p>
                </div>
                <button type="button" onClick={() => setEditTemplate(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto px-5 py-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
                    value={editTemplate.name}
                    onChange={(e) => setEditTemplate({ ...editTemplate, name: e.target.value })}
                    placeholder="Template name"
                  />
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={editTemplate.description || ''}
                    onChange={(e) => setEditTemplate({ ...editTemplate, description: e.target.value })}
                    placeholder="Short description"
                  />
                </div>

                {CRM_PERMISSION_GROUPS.map((g) => {
                  const items = CRM_PERMISSION_CATALOG.filter((p) => p.group === g.id);
                  const allOn = items.every((p) => editTemplate.permissions[p.key]);
                  return (
                    <div key={g.id} className="rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-slate-700">{g.label}</p>
                          <p className="text-[11px] text-slate-500">{g.hint}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setEditTemplate({
                              ...editTemplate,
                              permissions: {
                                ...editTemplate.permissions,
                                ...Object.fromEntries(items.map((p) => [p.key, !allOn])),
                              },
                            })
                          }
                          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600"
                        >
                          {allOn ? 'All off' : 'All on'}
                        </button>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {items.map((p) => {
                          const on = Boolean(editTemplate.permissions[p.key]);
                          const isNew = editTemplate.missing_keys.includes(p.key);
                          return (
                            <label key={p.key} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50/70">
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                                  {p.label}
                                  {isNew ? (
                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">New</span>
                                  ) : null}
                                </span>
                                <span className="block text-[11px] text-slate-500">{p.description}</span>
                              </span>
                              <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={on}
                                onChange={(e) =>
                                  setEditTemplate({
                                    ...editTemplate,
                                    permissions: { ...editTemplate.permissions, [p.key]: e.target.checked },
                                  })
                                }
                              />
                              <span
                                aria-hidden
                                className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-[#023D95]' : 'bg-slate-300'}`}
                              >
                                <span
                                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                                    on ? 'left-[18px]' : 'left-0.5'
                                  }`}
                                />
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editTemplate.is_default}
                    onChange={(e) => setEditTemplate({ ...editTemplate, is_default: e.target.checked })}
                  />
                  Default template (naye / bina template wale telecallers ke liye)
                </label>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-3">
                {!editTemplate.id.startsWith('new-') && !editTemplate.is_default ? (
                  <button
                    type="button"
                    disabled={savingId === 'template'}
                    onClick={() => void deleteTemplate()}
                    className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                ) : null}
                <div className="flex flex-1 justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
                    onClick={() => setEditTemplate(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingId === 'template' || !editTemplate.name.trim()}
                    className="rounded-xl bg-[#023D95] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    onClick={() => void saveTemplate()}
                  >
                    {savingId === 'template' ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
