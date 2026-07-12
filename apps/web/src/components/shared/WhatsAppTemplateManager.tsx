'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, Grid3X3, List, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react';
import ToggleSwitch from '@/components/shared/ToggleSwitch';

type TemplateRow = {
  id: string;
  template_name: string;
  display_name: string | null;
  language_code: string;
  category: string;
  body_text: string;
  variable_keys: string[];
  example_values: string[];
  is_active: boolean;
  meta?: { status?: string; template_id?: string } | null;
  created_at: string;
  updated_at: string;
};

type TemplateLanguage = {
  code: string;
  label: string;
};

const SUPPORTED_TEMPLATE_LANGUAGES: TemplateLanguage[] = [
  { code: 'en', label: 'English (India-friendly)' },
  { code: 'en_IN', label: 'English (India)' },
  { code: 'hi', label: 'Hindi' },
  { code: 'mr', label: 'Marathi' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'bn', label: 'Bengali' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'ur', label: 'Urdu' },
  { code: 'as', label: 'Assamese' },
  { code: 'or', label: 'Odia' },
];

function normalizeTemplateNameClient(input: string) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export default function WhatsAppTemplateManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [languageFilter, setLanguageFilter] = useState('ALL');
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    template_name: '',
    display_name: '',
    language_code: 'en',
    category: 'UTILITY',
    body_text: '',
    variable_keys: '',
    example_values: '',
  });

  const templatePreview = useMemo(() => {
    let output = form.body_text;
    const keys = form.variable_keys
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    keys.forEach((key, idx) => {
      output = output.replaceAll(`{{${idx + 1}}}`, `{${key}}`);
    });
    return output;
  }, [form.body_text, form.variable_keys]);
  const templateLanguageLabel = useMemo(() => {
    return (
      SUPPORTED_TEMPLATE_LANGUAGES.find((item) => item.code === form.language_code)?.label || form.language_code
    );
  }, [form.language_code]);
  const isStep1Complete = useMemo(() => {
    return Boolean(form.template_name.trim() && form.category.trim() && form.language_code.trim());
  }, [form.template_name, form.category, form.language_code]);
  const isStep2Complete = useMemo(() => {
    return Boolean(form.body_text.trim());
  }, [form.body_text]);
  const canOpenStep = (step: 1 | 2 | 3) => {
    if (step === 1) return true;
    if (step === 2) return isStep1Complete;
    return isStep1Complete && isStep2Complete;
  };
  const utilityNameSuggestions = useMemo(() => {
    if (form.category !== 'UTILITY') return [];

    const existing = new Set(templates.map((row) => row.template_name.toLowerCase()));
    const base = [
      'myfng_service_booking_confirm_v1',
      'myfng_booking_status_update_v1',
      'myfng_pickup_assigned_v1',
      'myfng_job_completion_update_v1',
      'myfng_invoice_share_v1',
      'myfng_payment_reminder_v1',
      'myfng_otp_verification_v1',
      'myfng_feedback_request_v1',
    ];

    const fromDisplay = normalizeTemplateNameClient(form.display_name || form.template_name);
    const dynamic = fromDisplay ? [`myfng_${fromDisplay}_v1`, `${fromDisplay}_utility_v1`] : [];

    return [...dynamic, ...base]
      .map((item) => normalizeTemplateNameClient(item))
      .filter(Boolean)
      .filter((item, idx, arr) => arr.indexOf(item) === idx)
      .filter((item) => !existing.has(item))
      .slice(0, 8);
  }, [form.category, form.display_name, form.template_name, templates]);

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((row) => {
      const matchesSearch =
        !q ||
        row.template_name.toLowerCase().includes(q) ||
        String(row.display_name || '')
          .toLowerCase()
          .includes(q) ||
        row.body_text.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && row.is_active) ||
        (statusFilter === 'INACTIVE' && !row.is_active);
      const matchesCategory = categoryFilter === 'ALL' || row.category === categoryFilter;
      const matchesLanguage = languageFilter === 'ALL' || row.language_code === languageFilter;
      return matchesSearch && matchesStatus && matchesCategory && matchesLanguage;
    });
  }, [templates, search, statusFilter, categoryFilter, languageFilter]);

  const categories = useMemo(() => {
    const values = Array.from(new Set(templates.map((row) => row.category).filter(Boolean)));
    return values.sort();
  }, [templates]);

  const languages = useMemo(() => {
    const values = Array.from(new Set(templates.map((row) => row.language_code).filter(Boolean)));
    return values.sort();
  }, [templates]);

  const loadTemplates = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/templates');
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to fetch templates');
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch (error: any) {
      if (!silent) {
        toast.error(error?.message || 'Failed to fetch templates');
        setTemplates([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleCreate = async () => {
    if (!form.template_name.trim()) {
      toast.error('Template name required');
      return;
    }
    if (!form.body_text.trim()) {
      toast.error('Template body required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        template_name: form.template_name,
        display_name: form.display_name || undefined,
        language_code: form.language_code,
        category: form.category,
        body_text: form.body_text,
        variable_keys: form.variable_keys
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
        example_values: form.example_values
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      };
      const res = await fetch('/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to create template');
      toast.success(data?.message || 'Template created');
      setForm({
        template_name: '',
        display_name: '',
        language_code: 'en',
        category: 'UTILITY',
        body_text: '',
        variable_keys: '',
        example_values: '',
      });
      setShowCreateForm(false);
      await loadTemplates(true);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (row: TemplateRow, nextActive: boolean) => {
    setTogglingId(row.id);
    setTemplates((prev) => prev.map((item) => (item.id === row.id ? { ...item, is_active: nextActive } : item)));
    try {
      const res = await fetch(`/api/whatsapp/templates/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to update template');
    } catch (error: any) {
      setTemplates((prev) => prev.map((item) => (item.id === row.id ? { ...item, is_active: row.is_active } : item)));
      toast.error(error?.message || 'Failed to update template');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      const res = await fetch(`/api/whatsapp/templates/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to delete template');
      setTemplates((prev) => prev.filter((item) => item.id !== id));
      toast.success('Template deleted');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete template');
    }
  };

  const handlePushToMeta = async (row: TemplateRow) => {
    try {
      const res = await fetch(`/api/whatsapp/templates/${row.id}/push`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to push template to Meta');
      toast.success(data?.message || 'Template pushed to Meta');
      await loadTemplates(true);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to push template to Meta');
    }
  };

  const handleSyncTemplates = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/whatsapp/templates/sync', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to sync templates');
      const parts: string[] = [];
      if (data?.synced != null) parts.push(`Synced ${data.synced} templates`);
      if (data?.deleted) parts.push(`Deleted ${data.deleted} stale`);
      toast.success(parts.length > 0 ? parts.join(', ') : 'Templates synced from Meta successfully');
      await loadTemplates(true);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to sync templates');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-900">Templates</h2>
          <button
            type="button"
            onClick={() => {
              setShowCreateForm((v) => !v);
              setCreateStep(1);
            }}
            className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="mr-1 h-4 w-4" />
            {showCreateForm ? 'Close Form' : 'New Template'}
          </button>
        </div>

        {showCreateForm ? (
          <div className="mb-4 rounded-xl border bg-gray-50 p-4">
            <h3 className="text-base font-semibold text-gray-900">Create New Template</h3>
            <p className="mt-1 text-xs text-gray-600">
              Meta approval is still required before production sending.
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              {[
                { id: 1, label: 'Basic Info' },
                { id: 2, label: 'Content' },
                { id: 3, label: 'Buttons' },
              ].map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    const target = step.id as 1 | 2 | 3;
                    if (!canOpenStep(target)) {
                      toast.error(
                        target === 2
                          ? 'Complete Basic Info first'
                          : 'Complete Basic Info and Content first'
                      );
                      return;
                    }
                    setCreateStep(target);
                  }}
                  disabled={!canOpenStep(step.id as 1 | 2 | 3)}
                  className={`rounded-md border px-2 py-1.5 font-semibold ${
                    createStep === step.id
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : canOpenStep(step.id as 1 | 2 | 3)
                        ? 'border-gray-200 bg-white text-gray-600'
                        : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                  }`}
                >
                  {step.id}. {step.label}
                  {step.id === 1 && isStep1Complete ? ' ✓' : ''}
                  {step.id === 2 && isStep2Complete ? ' ✓' : ''}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="space-y-3 xl:col-span-2">
                {createStep === 1 ? (
                  <div className="rounded-lg border bg-white p-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-semibold text-gray-700">Template Name</label>
                        <input
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                          placeholder="payment_reminder_v1"
                          value={form.template_name}
                          onChange={(e) => setForm((f) => ({ ...f, template_name: e.target.value }))}
                        />
                        {form.category === 'UTILITY' ? (
                          <div className="mt-2">
                            <p className="mb-1 text-[11px] text-gray-500">
                              Suggested Utility names (Meta-friendly, lowercase + underscore):
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {utilityNameSuggestions.length === 0 ? (
                                <span className="text-[11px] text-gray-400">No new suggestions available.</span>
                              ) : (
                                utilityNameSuggestions.map((name) => (
                                  <button
                                    key={name}
                                    type="button"
                                    onClick={() => setForm((f) => ({ ...f, template_name: name }))}
                                    className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                                  >
                                    {name}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">Display Name</label>
                        <input
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                          placeholder="Optional"
                          value={form.display_name}
                          onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">Category</label>
                        <select
                          className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                          value={form.category}
                          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                        >
                          <option value="UTILITY">UTILITY</option>
                          <option value="MARKETING">MARKETING</option>
                          <option value="AUTHENTICATION">AUTHENTICATION</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-semibold text-gray-700">
                          Language (Supported)
                        </label>
                        <select
                          className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                          value={form.language_code}
                          onChange={(e) => setForm((f) => ({ ...f, language_code: e.target.value }))}
                        >
                          {SUPPORTED_TEMPLATE_LANGUAGES.map((item) => (
                            <option key={item.code} value={item.code}>
                              {item.label} ({item.code})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : null}

                {createStep === 2 ? (
                  <div className="rounded-lg border bg-white p-3">
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">
                          Template Body (use {'{{1}}'}, {'{{2}}'})
                        </label>
                        <textarea
                          className="h-32 w-full rounded-lg border px-3 py-2 text-sm"
                          placeholder="Hello {{1}}, your booking {{2}} is confirmed."
                          value={form.body_text}
                          onChange={(e) => setForm((f) => ({ ...f, body_text: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">Variable Keys</label>
                        <input
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                          placeholder="customer_name, booking_id"
                          value={form.variable_keys}
                          onChange={(e) => setForm((f) => ({ ...f, variable_keys: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">Example Values</label>
                        <input
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                          placeholder="Rahul, BK-1234"
                          value={form.example_values}
                          onChange={(e) => setForm((f) => ({ ...f, example_values: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                {createStep === 3 ? (
                  <div className="rounded-lg border bg-white p-3">
                    <p className="text-sm font-semibold text-gray-900">Buttons</p>
                    <p className="mt-1 text-xs text-gray-600">
                      Quick reply or CTA buttons can be extended in next update. For now, base template can be
                      created and synced/published.
                    </p>
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateStep((prev) => (prev === 1 ? 1 : ((prev - 1) as 1 | 2 | 3)))}
                      className="rounded-lg border px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      disabled={createStep === 1}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (createStep === 1 && !isStep1Complete) {
                          toast.error('Please complete Basic Info');
                          return;
                        }
                        if (createStep === 2 && !isStep2Complete) {
                          toast.error('Please complete Content step');
                          return;
                        }
                        setCreateStep((prev) => (prev === 3 ? 3 : ((prev + 1) as 1 | 2 | 3)));
                      }}
                      className="rounded-lg border px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      disabled={createStep === 3}
                    >
                      Next
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={saving || !isStep1Complete || !isStep2Complete}
                    className="inline-flex items-center rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {saving ? 'Creating...' : 'Submit Template'}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border bg-white p-3">
                <p className="text-sm font-semibold text-gray-900">Template Preview</p>
                <div className="mt-3 rounded-2xl border bg-[#f7f5f3] p-3">
                  <div className="rounded-xl bg-white p-2 text-xs text-gray-700 shadow-sm">
                    {templatePreview || 'Type template body to preview message...'}
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-600">
                  <p>
                    <span className="font-semibold">Language:</span> {templateLanguageLabel}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold">Category:</span> {form.category}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <input
              className="w-full rounded-lg border px-8 py-2 text-sm"
              placeholder="Search template..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
          >
            <option value="ALL">Status</option>
            <option value="ACTIVE">Approved</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
          >
            <option value="ALL">All languages</option>
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang.toUpperCase()}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleSyncTemplates}
            disabled={syncing}
            className="inline-flex items-center rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            title="Sync templates from Meta"
          >
            <RefreshCcw className="mr-1 h-4 w-4" />
            {syncing ? 'Syncing...' : 'Sync'}
          </button>

          <button
            type="button"
            className="inline-flex items-center rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Eye className="mr-1 h-4 w-4" />
            View Options
          </button>
          <div className="inline-flex items-center overflow-hidden rounded-lg border">
            <button type="button" className="bg-gray-100 px-2 py-2 text-gray-700">
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button type="button" className="px-2 py-2 text-gray-700">
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Template Name</th>
                <th className="px-3 py-2">Preview</th>
                <th className="px-3 py-2">WABA</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created by</th>
                <th className="px-3 py-2">Created on</th>
                <th className="px-3 py-2">Last updated</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && templates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    Loading templates...
                  </td>
                </tr>
              ) : filteredTemplates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    No templates found for current filters.
                  </td>
                </tr>
              ) : (
                filteredTemplates.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-gray-900">{row.display_name || row.template_name}</p>
                      <p className="mt-1 text-xs text-gray-500">{row.template_name}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                          {row.category}
                        </span>
                        <span className="text-xs text-gray-500">{row.language_code.toUpperCase()}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="max-w-[260px] rounded-md border bg-gray-50 p-2 text-xs text-gray-700">
                        {row.body_text.slice(0, 140)}
                        {row.body_text.length > 140 ? '...' : ''}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-700">
                      <p className="font-medium">My FNG Car Service</p>
                      <p className="mt-1 text-xs text-gray-500">1 Number</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-2">
                        <div className="flex items-center gap-2">
                          <ToggleSwitch
                            enabled={row.is_active}
                            busy={togglingId === row.id}
                            size="sm"
                            onChange={(next) => handleToggleActive(row, next)}
                            label={`Toggle ${row.template_name}`}
                          />
                          <span className={`text-xs font-semibold ${row.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {togglingId === row.id ? 'Saving...' : row.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            row.is_active
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : 'border-gray-300 bg-gray-50 text-gray-600'
                          }`}
                        >
                          {String(row.meta?.status || 'NOT_SYNCED').toUpperCase() === 'APPROVED'
                            ? 'Meta Approved'
                            : `Meta: ${String(row.meta?.status || 'NOT_SYNCED').toUpperCase()}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-600">Admin</td>
                    <td className="px-3 py-3 text-gray-600">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-gray-600">
                      {new Date(row.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {['', 'NOT_SYNCED'].includes(String(row.meta?.status || '').toUpperCase()) ? (
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
                            onClick={() => handlePushToMeta(row)}
                            title="Push this local template to Meta"
                          >
                            Push
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(row.id)}
                          title="Delete template"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          Showing {filteredTemplates.length} of {templates.length} templates
        </div>
      </div>
    </div>
  );
}
