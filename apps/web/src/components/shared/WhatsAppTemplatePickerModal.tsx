'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export type WaTemplateRow = {
  id: string;
  template_name: string;
  display_name?: string | null;
  language_code?: string | null;
  category?: string | null;
  body_text?: string | null;
  variable_keys?: string[] | null;
  example_values?: string[] | null;
  is_active?: boolean;
  meta?: Record<string, unknown> | null;
};

function humanizeTemplateKey(name: string): string {
  return String(name || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function templateTitle(row: WaTemplateRow): string {
  return String(row.display_name || '').trim() || humanizeTemplateKey(row.template_name);
}

function categoryMeta(category?: string | null): { label: string; className: string } {
  const c = String(category || '').toUpperCase();
  if (c.includes('UTIL')) return { label: 'Utility', className: 'bg-blue-100 text-blue-800' };
  if (c.includes('MARKET')) return { label: 'Marketing', className: 'bg-purple-100 text-purple-800' };
  return { label: c || 'Template', className: 'bg-slate-100 text-slate-700' };
}

function nameKey(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

function isAuthTemplate(row: WaTemplateRow): boolean {
  const cat = String(row.category || '').toLowerCase();
  const name = nameKey(row.template_name);
  return cat.includes('auth') || name.includes('otp') || name.startsWith('auth_');
}

type Props = {
  open: boolean;
  onClose: () => void;
  templates: WaTemplateRow[];
  loading?: boolean;
  selectedName: string;
  onSelect: (templateName: string) => void;
  telecallerScoped?: boolean;
};

/**
 * Grid-only catalog. Preview lives in Template Mode panel (right) — not here.
 * Click a card → select + close.
 */
export default function WhatsAppTemplatePickerModal({
  open,
  onClose,
  templates,
  loading,
  selectedName,
  onSelect,
  telecallerScoped = false,
}: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | 'utility' | 'marketing'>('all');

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setCategory('all');
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  const safeTemplates = Array.isArray(templates) ? templates : [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return safeTemplates.filter((row) => {
      if (!row || isAuthTemplate(row)) return false;
      const cat = String(row.category || '').toLowerCase();
      if (category === 'utility' && !cat.includes('util')) return false;
      if (category === 'marketing' && !cat.includes('market')) return false;
      if (!q) return true;
      const name = nameKey(row.template_name);
      const display = nameKey(row.display_name);
      const body = String(row.body_text || '').toLowerCase();
      const human = humanizeTemplateKey(String(row.template_name || '')).toLowerCase();
      return name.includes(q) || display.includes(q) || body.includes(q) || human.includes(q);
    });
  }, [safeTemplates, search, category]);

  if (!open) return null;

  const pick = (name: string) => {
    onSelect(String(name || ''));
    onClose();
  };

  return (
    <div
      data-wa-template-picker="1"
      className="absolute inset-y-0 left-0 z-[90] flex w-[calc(100%-380px)] max-w-[calc(100%-380px)] flex-col overflow-hidden border-r border-slate-200 bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Choose WhatsApp template"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Choose template</p>
          <p className="text-xs text-slate-500">
            {telecallerScoped
              ? 'Basic CRM templates only — preview on the right'
              : 'Click a card — preview opens in Template mode (right)'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        {(
          [
            ['all', 'All'],
            ['utility', 'Utility'],
            ['marketing', 'Marketing'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setCategory(key)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              category === key ? 'bg-[#004AAD] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex min-w-[160px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 sm:max-w-xs">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"
            autoFocus
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <p className="px-2 py-8 text-center text-xs text-slate-500">Loading templates…</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-slate-500">No templates found</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            {filtered.map((row) => {
              const active = nameKey(row?.template_name) === nameKey(selectedName);
              const cat = categoryMeta(row.category);
              return (
                <button
                  key={row.id || row.template_name}
                  type="button"
                  onClick={() => pick(String(row.template_name || ''))}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    active
                      ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300/50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${cat.className}`}>
                    {cat.label}
                  </span>
                  <p className="mt-1.5 line-clamp-2 text-[12px] font-bold leading-snug text-slate-900">
                    {templateTitle(row)}
                  </p>
                  <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-slate-600">
                    {String(row.body_text || '').replace(/\s+/g, ' ').trim() || '—'}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
