'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';

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
  created_at: string;
  updated_at: string;
};

export default function WhatsAppTemplateManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
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

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/templates');
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to fetch templates');
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to fetch templates');
      setTemplates([]);
    } finally {
      setLoading(false);
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
      toast.success('Template created');
      setForm({
        template_name: '',
        display_name: '',
        language_code: 'en',
        category: 'UTILITY',
        body_text: '',
        variable_keys: '',
        example_values: '',
      });
      await loadTemplates();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (row: TemplateRow) => {
    try {
      const res = await fetch(`/api/whatsapp/templates/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !row.is_active }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to update template');
      setTemplates((prev) => prev.map((item) => (item.id === row.id ? { ...item, is_active: !item.is_active } : item)));
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update template');
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

  return (
    <div className="space-y-6">
      <div className="card p-4 sm:p-5 md:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">Create WhatsApp Template</h2>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          Note: Meta approval still required for production template messaging.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Template Name (e.g. payment_reminder_v1)"
            value={form.template_name}
            onChange={(e) => setForm((f) => ({ ...f, template_name: e.target.value }))}
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Display Name (optional)"
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Language (en)"
            value={form.language_code}
            onChange={(e) => setForm((f) => ({ ...f, language_code: e.target.value }))}
          />
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="UTILITY">UTILITY</option>
            <option value="MARKETING">MARKETING</option>
            <option value="AUTHENTICATION">AUTHENTICATION</option>
          </select>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm md:col-span-2"
            placeholder="Variable Keys (comma separated, e.g. customer_name, amount)"
            value={form.variable_keys}
            onChange={(e) => setForm((f) => ({ ...f, variable_keys: e.target.value }))}
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm md:col-span-2"
            placeholder="Example Values (comma separated)"
            value={form.example_values}
            onChange={(e) => setForm((f) => ({ ...f, example_values: e.target.value }))}
          />
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm md:col-span-2 h-28"
            placeholder="Template body (use {{1}}, {{2}} placeholders)"
            value={form.body_text}
            onChange={(e) => setForm((f) => ({ ...f, body_text: e.target.value }))}
          />
        </div>

        {templatePreview ? (
          <div className="mt-3 rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <span className="font-semibold">Preview:</span> {templatePreview}
          </div>
        ) : null}

        <div className="mt-4">
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="btn btn-primary text-sm px-4 py-2 disabled:opacity-60"
          >
            {saving ? 'Creating...' : 'Create Template'}
          </button>
        </div>
      </div>

      <div className="card p-4 sm:p-5 md:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Saved Templates</h3>
          <span className="text-xs text-gray-500">{templates.length} templates</span>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500 py-6">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="text-sm text-gray-500 py-6">No templates created yet.</div>
        ) : (
          <div className="mt-4 space-y-3">
            {templates.map((row) => (
              <div key={row.id} className="rounded-lg border px-3 py-3 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 break-all">{row.display_name || row.template_name}</p>
                    <p className="text-xs text-gray-500 break-all">
                      {row.template_name} • {row.language_code} • {row.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`text-xs px-2.5 py-1 rounded-full border ${
                        row.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-gray-50 text-gray-600 border-gray-300'
                      }`}
                      onClick={() => handleToggleActive(row)}
                    >
                      {row.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(row.id)}
                      title="Delete template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{row.body_text}</div>
                {Array.isArray(row.variable_keys) && row.variable_keys.length > 0 ? (
                  <div className="mt-2 text-xs text-gray-500">
                    Variables: {row.variable_keys.join(', ')}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
