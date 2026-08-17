'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import {
  CRM_PERMISSION_LABELS,
  normalizeCrmPermissions,
  type CrmPermissionKey,
  type CrmPermissions,
} from '@/lib/telecaller/crmPermissions';
import { Loader2, Phone, RefreshCw, Save, Shield, Users } from 'lucide-react';

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

  return (
    <DashboardLayout role="lead_manager">
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[#023D95] flex items-center gap-2">
              <Users className="h-6 w-6" /> Telecaller Team
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Phones + TeleCRM-style access templates (who can export, see team board, etc.).
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
        ) : accessLoading ? (
          <div className="flex items-center gap-2 text-slate-500 py-16 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading access…
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border bg-white p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-extrabold text-[#023D95] flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Templates
                </h2>
                <button
                  type="button"
                  className="text-xs font-bold text-[#004AAD]"
                  onClick={() =>
                    setEditTemplate({
                      id: `new-${Date.now()}`,
                      name: 'New template',
                      description: '',
                      permissions: normalizeCrmPermissions({}),
                      is_default: false,
                    })
                  }
                >
                  + New template
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setEditTemplate(t)}
                    className="text-left rounded-xl border border-slate-200 p-3 hover:border-[#004AAD]/40"
                  >
                    <p className="font-bold text-sm text-slate-900">
                      {t.name}
                      {t.is_default ? (
                        <span className="ml-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          Default
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{t.description || '—'}</p>
                    <p className="text-[10px] text-slate-400 mt-2">
                      Export {t.permissions.reports_export ? 'ON' : 'OFF'} · Team board{' '}
                      {t.permissions.reports_team_leaderboard ? 'ON' : 'OFF'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border bg-white divide-y overflow-hidden">
              <div className="px-4 py-3 font-extrabold text-[#023D95] text-sm">Assign to telecallers</div>
              {assigned.map((t) => (
                <div
                  key={t.id}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between"
                >
                  <div>
                    <p className="font-semibold text-sm">{t.full_name || 'Telecaller'}</p>
                    <p className="text-[11px] text-slate-500">{t.phone || 'No phone'}</p>
                  </div>
                  <select
                    className="border rounded-lg px-2 py-1.5 text-sm min-w-[200px]"
                    value={t.template_id || ''}
                    disabled={savingId === t.id}
                    onChange={(e) => void assignTemplate(t.id, e.target.value)}
                  >
                    <option value="">Use default template</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {editTemplate ? (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
            <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto">
              <h3 className="font-extrabold text-[#023D95]">Edit template</h3>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={editTemplate.name}
                onChange={(e) => setEditTemplate({ ...editTemplate, name: e.target.value })}
                placeholder="Template name"
              />
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm"
                rows={2}
                value={editTemplate.description || ''}
                onChange={(e) => setEditTemplate({ ...editTemplate, description: e.target.value })}
                placeholder="Description"
              />
              <div className="space-y-2">
                {(Object.keys(CRM_PERMISSION_LABELS) as CrmPermissionKey[]).map((key) => (
                  <label key={key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-700">{CRM_PERMISSION_LABELS[key]}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(editTemplate.permissions[key])}
                      onChange={(e) =>
                        setEditTemplate({
                          ...editTemplate,
                          permissions: {
                            ...editTemplate.permissions,
                            [key]: e.target.checked,
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={editTemplate.is_default}
                  onChange={(e) =>
                    setEditTemplate({ ...editTemplate, is_default: e.target.checked })
                  }
                />
                Set as default for new / unassigned callers
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl border px-3 py-2 text-sm font-bold"
                  onClick={() => setEditTemplate(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingId === 'template'}
                  className="flex-1 rounded-xl bg-[#004AAD] text-white px-3 py-2 text-sm font-bold disabled:opacity-50"
                  onClick={() => void saveTemplate()}
                >
                  {savingId === 'template' ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
