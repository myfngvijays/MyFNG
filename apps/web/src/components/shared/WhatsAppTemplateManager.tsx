'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Calendar, ChevronDown, Eye, Grid3X3, List, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react';
import ToggleSwitch from '@/components/shared/ToggleSwitch';
import WhatsAppTemplatePreviewModal, {
  WhatsAppTemplateBubble,
} from '@/components/shared/WhatsAppTemplatePreviewModal';

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
  meta?: { status?: string; template_id?: string; source?: string } | null;
  created_at: string;
  updated_at: string;
};

/** Push is for drafts not yet linked / rejected by Meta / missing on current WABA. */
function canPushTemplateToMeta(row: TemplateRow) {
  const status = String(row.meta?.status || '').toUpperCase();
  const source = String(row.meta?.source || '').toLowerCase();
  if (status === 'NOT_ON_WABA') return true;
  if (['APPROVED', 'PENDING', 'IN_APPEAL', 'PAUSED', 'DISABLED'].includes(status)) {
    return false;
  }
  return (
    ['', 'NOT_SYNCED', 'REJECTED', 'LOCAL_DRAFT'].includes(status) ||
    source === 'local_draft'
  );
}

type ViewMode = 'list' | 'grid';
type DateField = 'created' | 'updated';

type ColumnVisibility = {
  preview: boolean;
  waba: boolean;
  createdBy: boolean;
  createdOn: boolean;
  lastUpdated: boolean;
};

const DEFAULT_COLUMNS: ColumnVisibility = {
  preview: true,
  waba: true,
  createdBy: true,
  createdOn: true,
  lastUpdated: true,
};

function toYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseRowDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return toYmd(date);
}

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
  const [repushing, setRepushing] = useState(false);
  const [ensuringOtp, setEnsuringOtp] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [languageFilter, setLanguageFilter] = useState('ALL');
  const [dateField, setDateField] = useState<DateField>('updated');
  const [filterDate, setFilterDate] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showViewOptions, setShowViewOptions] = useState(false);
  const [columns, setColumns] = useState<ColumnVisibility>(DEFAULT_COLUMNS);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateRow | null>(null);
  const viewOptionsRef = useRef<HTMLDivElement | null>(null);
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
      const rowDate = parseRowDate(dateField === 'created' ? row.created_at : row.updated_at);
      const matchesDate = !filterDate || rowDate === filterDate;
      return matchesSearch && matchesStatus && matchesCategory && matchesLanguage && matchesDate;
    });
  }, [templates, search, statusFilter, categoryFilter, languageFilter, dateField, filterDate]);

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

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!viewOptionsRef.current?.contains(event.target as Node)) {
        setShowViewOptions(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const openTemplatePreview = (row: TemplateRow) => {
    setPreviewTemplate(row);
  };

  const toggleColumn = (key: keyof ColumnVisibility) => {
    setColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const clearDateFilter = () => {
    setFilterDate('');
  };

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

  const handleEnsureOtpTemplate = async () => {
    const confirmed = window.confirm(
      'Create/link the AUTHENTICATION template "otp" on the current WABA in Meta?\n\nThis is required for booking + app login OTP.'
    );
    if (!confirmed) return;

    setEnsuringOtp(true);
    try {
      const res = await fetch('/api/whatsapp/templates/ensure-otp', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to create OTP template on Meta');
      toast.success(data?.message || 'OTP template submitted to Meta');
      await loadTemplates(true);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create OTP template on Meta');
    } finally {
      setEnsuringOtp(false);
    }
  };

  const handleRepushAllTemplates = async () => {
    const confirmed = window.confirm(
      'Repush all templates to Meta using current env credentials (WHATSAPP_BUSINESS_ACCOUNT_ID + WHATSAPP_ACCESS_TOKEN).\n\nUpdate env first, then run this. Templates go to the WABA in env — not the old account.\n\nContinue?'
    );
    if (!confirmed) return;

    setRepushing(true);
    try {
      const res = await fetch('/api/whatsapp/templates/repush-all', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to repush templates');
      toast.success(
        data?.message ||
          `Repush done: ${data?.created ?? 0} submitted, ${data?.linked ?? 0} linked, ${data?.failed ?? 0} failed.`
      );
      if (Number(data?.failed) > 0) {
        const failedNames = (data?.results || [])
          .filter((row: { ok?: boolean }) => !row.ok)
          .map((row: { template_name?: string }) => row.template_name)
          .filter(Boolean)
          .slice(0, 5)
          .join(', ');
        if (failedNames) toast.error(`Failed: ${failedNames}${Number(data?.failed) > 5 ? '…' : ''}`);
      }
      await loadTemplates(true);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to repush templates');
    } finally {
      setRepushing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Templates</h2>
            <p className="text-xs text-gray-500">Use Preview to see WhatsApp-style message on phone mockup</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleEnsureOtpTemplate}
              disabled={ensuringOtp || repushing || syncing}
              className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
              title="Create AUTHENTICATION otp template on current Meta WABA"
            >
              <RefreshCcw className="mr-1 h-4 w-4" />
              {ensuringOtp ? 'Creating OTP...' : 'Fix OTP on Meta'}
            </button>
            <button
              type="button"
              onClick={handleRepushAllTemplates}
              disabled={repushing || syncing || ensuringOtp}
              className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
              title="Push all local templates to the WABA in env (after updating credentials)"
            >
              <RefreshCcw className="mr-1 h-4 w-4" />
              {repushing ? 'Repushing...' : 'Repush all'}
            </button>
            <button
              type="button"
              onClick={handleSyncTemplates}
              disabled={syncing || repushing}
              className="inline-flex items-center rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              title="Sync templates from Meta"
            >
              <RefreshCcw className="mr-1 h-4 w-4" />
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
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
                <div className="mt-3">
                  <WhatsAppTemplateBubble
                    template={{
                      template_name: form.template_name || 'new_template',
                      body_text: templatePreview || 'Type template body to preview message...',
                      example_values: [],
                    }}
                  />
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

          <div className="flex items-center gap-1 rounded-lg border px-2 py-1">
            <Calendar className="h-4 w-4 text-gray-400" />
            <select
              className="border-0 bg-transparent py-1 text-sm outline-none"
              value={dateField}
              onChange={(e) => setDateField(e.target.value as DateField)}
            >
              <option value="updated">Updated</option>
              <option value="created">Created</option>
            </select>
            <input
              type="date"
              className="w-[130px] border-0 bg-transparent py-1 text-sm outline-none"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              title="Filter by date"
            />
            {filterDate ? (
              <button
                type="button"
                onClick={clearDateFilter}
                className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="relative" ref={viewOptionsRef}>
            <button
              type="button"
              onClick={() => setShowViewOptions((value) => !value)}
              className="inline-flex items-center rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Eye className="mr-1 h-4 w-4" />
              View Options
              <ChevronDown className="ml-1 h-4 w-4" />
            </button>
            {showViewOptions ? (
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border bg-white p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Columns</p>
                {(
                  [
                    ['preview', 'Preview'],
                    ['waba', 'WABA'],
                    ['createdBy', 'Created by'],
                    ['createdOn', 'Created on'],
                    ['lastUpdated', 'Last updated'],
                  ] as Array<[keyof ColumnVisibility, string]>
                ).map(([key, label]) => (
                  <label key={key} className="mb-2 flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={columns[key]}
                      onChange={() => toggleColumn(key)}
                      className="rounded border-gray-300"
                    />
                    {label}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <div className="inline-flex items-center overflow-hidden rounded-lg border">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2 py-2 ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-700'}`}
              title="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-2 py-2 ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-700'}`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {loading && templates.length === 0 ? (
              <div className="col-span-full rounded-lg border px-3 py-8 text-center text-gray-500">
                Loading templates...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="col-span-full rounded-lg border px-3 py-8 text-center text-gray-500">
                No templates found for current filters.
              </div>
            ) : (
              filteredTemplates.map((row) => (
                <div
                  key={row.id}
                  className="rounded-xl border bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{row.display_name || row.template_name}</p>
                      <p className="text-xs text-gray-500">{row.template_name}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        row.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {String(row.meta?.status || 'NOT_SYNCED').toUpperCase() === 'APPROVED'
                        ? 'Approved'
                        : String(row.meta?.status || 'NOT_SYNCED')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openTemplatePreview(row)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </button>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {row.category} · {row.language_code.toUpperCase()}
                    </span>
                    <span>{new Date(row.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Template Name</th>
                {columns.preview ? <th className="px-3 py-2">Preview</th> : null}
                {columns.waba ? <th className="px-3 py-2">WABA</th> : null}
                <th className="px-3 py-2">Status</th>
                {columns.createdBy ? <th className="px-3 py-2">Created by</th> : null}
                {columns.createdOn ? <th className="px-3 py-2">Created on</th> : null}
                {columns.lastUpdated ? <th className="px-3 py-2">Last updated</th> : null}
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
                  <tr key={row.id} className="border-t align-top hover:bg-gray-50/60">
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
                    {columns.preview ? (
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => openTemplatePreview(row)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </button>
                      </td>
                    ) : null}
                    {columns.waba ? (
                      <td className="px-3 py-3 text-gray-700">
                        <p className="font-medium">My FNG Car Service</p>
                        <p className="mt-1 text-xs text-gray-500">1 Number</p>
                      </td>
                    ) : null}
                    <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
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
                            : String(row.meta?.status || 'NOT_SYNCED').toUpperCase() === 'NOT_ON_WABA'
                              ? 'Missing on Meta WABA'
                            : `Meta: ${String(row.meta?.status || 'NOT_SYNCED').toUpperCase()}`}
                        </span>
                      </div>
                    </td>
                    {columns.createdBy ? <td className="px-3 py-3 text-gray-600">Admin</td> : null}
                    {columns.createdOn ? (
                      <td className="px-3 py-3 text-gray-600">{new Date(row.created_at).toLocaleDateString()}</td>
                    ) : null}
                    {columns.lastUpdated ? (
                      <td className="px-3 py-3 text-gray-600">{new Date(row.updated_at).toLocaleDateString()}</td>
                    ) : null}
                    <td className="px-3 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                      <div className="inline-flex items-center gap-2">
                        {canPushTemplateToMeta(row) ? (
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
                            onClick={() => handlePushToMeta(row)}
                            title={
                              String(row.meta?.status || '').toUpperCase() === 'REJECTED'
                                ? 'Re-submit to Meta (delete rejected template from Meta Manager first if push fails)'
                                : 'Push this local template to Meta'
                            }
                          >
                            {String(row.meta?.status || '').toUpperCase() === 'REJECTED' ? 'Re-push' : 'Push'}
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
        )}

        <div className="mt-3 text-xs text-gray-500">
          Showing {filteredTemplates.length} of {templates.length} templates
          {filterDate ? (
            <span>
              {' '}
              · Date filter ({dateField}): {filterDate}
            </span>
          ) : null}
        </div>
      </div>

      <WhatsAppTemplatePreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
    </div>
  );
}
