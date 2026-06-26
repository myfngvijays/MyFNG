'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  HelpCircle,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import ContentBulkPanel from '@/components/admin/ContentBulkPanel';
import {
  PUBLIC_FAQS_CSV_TEMPLATE,
  PUBLIC_FAQS_EDIT_CSV_TEMPLATE,
  parsePublicFaqsCsv,
  parsePublicFaqsEditCsv,
} from '@/lib/public-faqs-admin';
import { SERVICE_FAQ_SECTIONS, type PublicFaqGroup } from '@/lib/public-faqs-db';

type FaqRow = {
  id: string;
  faq_group: PublicFaqGroup;
  section_key: string;
  section_title: string;
  question: string;
  answer: string;
  display_order: number;
  active: boolean;
  visible_android: boolean;
  visible_ios: boolean;
  visible_app: boolean;
  visible_web: boolean;
};

function syncFaqVisibility(row: FaqRow): FaqRow {
  const visible_app = row.visible_android || row.visible_ios;
  return {
    ...row,
    visible_app,
    active: visible_app || row.visible_web,
  };
}

const TAB_META: Record<
  PublicFaqGroup,
  { label: string; subtitle: string; accent: string; sectionKey: string; sectionTitle: string }
> = {
  GENERAL: {
    label: 'General FAQs',
    subtitle: 'Home screen, website /faq, and app service pages',
    accent: 'bg-blue-600',
    sectionKey: 'general',
    sectionTitle: 'General Car Service',
  },
  SERVICE: {
    label: 'Service FAQs',
    subtitle: 'Service package detail pages (Periodic, AC, Engine, etc.)',
    accent: 'bg-indigo-600',
    sectionKey: 'periodic-car-service',
    sectionTitle: 'Periodic Car Service',
  },
  RSA: {
    label: 'RSA FAQs',
    subtitle: 'Roadside Assistance screen + RSA website landing',
    accent: 'bg-orange-600',
    sectionKey: 'rsa',
    sectionTitle: 'RSA',
  },
};

export default function PublicFaqsPage() {
  const [rows, setRows] = useState<FaqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<PublicFaqGroup>('GENERAL');
  const [serviceSection, setServiceSection] = useState(SERVICE_FAQ_SECTIONS[0].key);
  const [draftQ, setDraftQ] = useState('');
  const [draftA, setDraftA] = useState('');
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const meta = TAB_META[tab];
  const activeSectionKey = tab === 'SERVICE' ? serviceSection : meta.sectionKey;
  const activeSectionTitle =
    tab === 'SERVICE'
      ? SERVICE_FAQ_SECTIONS.find((s) => s.key === serviceSection)?.title || meta.sectionTitle
      : meta.sectionTitle;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/public-faqs');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.details || json?.error || 'Failed to load FAQs');
      setRows(json.data || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [tab, serviceSection]);

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => r.faq_group === tab && r.section_key === activeSectionKey)
        .sort((a, b) => a.display_order - b.display_order),
    [rows, tab, activeSectionKey],
  );

  async function createFaq() {
    const question = draftQ.trim();
    const answer = draftA.trim();
    if (!question || !answer) return;
    setAdding(true);
    try {
      const res = await fetch('/api/super_admin/public-faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faq_group: tab,
          section_key: activeSectionKey,
          section_title: activeSectionTitle,
          question,
          answer,
          display_order: filtered.length + 1,
          visible_android: true,
          visible_ios: true,
          visible_web: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.details || json?.error || 'Create failed');
      setDraftQ('');
      setDraftA('');
      await load();
    } catch (e: any) {
      alert(e?.message || 'Could not add FAQ');
    } finally {
      setAdding(false);
    }
  }

  async function persistRow(row: FaqRow) {
    setSavingId(row.id);
    try {
      const res = await fetch(`/api/super_admin/public-faqs/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.details || json?.error || 'Save failed');
      setRows((prev) => prev.map((r) => (r.id === row.id ? json.data : r)));
    } catch (e: any) {
      alert(e?.message || 'Could not save FAQ');
    } finally {
      setSavingId(null);
    }
  }

  async function deleteRow(id: string) {
    if (!confirm('Delete this FAQ?')) return;
    try {
      const res = await fetch(`/api/super_admin/public-faqs/${id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.details || json?.error || 'Delete failed');
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      alert(e?.message || 'Could not delete FAQ');
    }
  }

  async function moveRow(row: FaqRow, direction: 'up' | 'down') {
    const idx = filtered.findIndex((r) => r.id === row.id);
    const swap = direction === 'up' ? filtered[idx - 1] : filtered[idx + 1];
    if (!swap) return;
    await Promise.all([
      fetch(`/api/super_admin/public-faqs/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...row, display_order: swap.display_order }),
      }),
      fetch(`/api/super_admin/public-faqs/${swap.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...swap, display_order: row.display_order }),
      }),
    ]);
    await load();
  }

  function patchRow(id: string, patch: Partial<FaqRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(filtered.map((r) => r.id));
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-blue-600" />
            FAQs (App + Website)
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            One place for General, Service-based, and RSA FAQs. Control Android, iOS, and website separately.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ContentBulkPanel
            entityLabel="FAQ"
            apiBase="/api/super_admin/public-faqs/bulk"
            uploadContext={{
              faq_group: tab,
              section_key: activeSectionKey,
              section_title: activeSectionTitle,
            }}
            csvTemplate={PUBLIC_FAQS_CSV_TEMPLATE}
            editCsvTemplate={PUBLIC_FAQS_EDIT_CSV_TEMPLATE}
            parseUploadCsv={parsePublicFaqsCsv}
            parseEditCsv={parsePublicFaqsEditCsv}
            uploadPayloadKey="faqs"
            selectedIds={selectedIds}
            onClearSelection={() => setSelectedIds([])}
            onComplete={load}
          />
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="inline-flex flex-wrap rounded-2xl border border-gray-200 bg-gray-100 p-1 gap-1">
        {(Object.keys(TAB_META) as PublicFaqGroup[]).map((group) => (
          <button
            key={group}
            type="button"
            onClick={() => setTab(group)}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              tab === group ? `${TAB_META[group].accent} text-white shadow-sm` : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {TAB_META[group].label}
          </button>
        ))}
      </div>

      {tab === 'SERVICE' ? (
        <div className="flex flex-wrap gap-2">
          {SERVICE_FAQ_SECTIONS.map((sec) => (
            <button
              key={sec.key}
              type="button"
              onClick={() => setServiceSection(sec.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold border ${
                serviceSection === sec.key
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {sec.title}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 bg-gray-50/80">
          <div>
            <div className="text-sm font-bold text-gray-900">{activeSectionTitle}</div>
            <div className="text-xs text-gray-500">{meta.subtitle}</div>
          </div>
          <div className="text-xs font-semibold text-gray-500">
            Android {filtered.filter((r) => r.visible_android).length} · iOS {filtered.filter((r) => r.visible_ios).length} · Web {filtered.filter((r) => r.visible_web).length} ·{' '}
            {filtered.length} total
          </div>
        </div>

        <div className="p-4 border-b border-gray-100 space-y-2">
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Question…"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
          />
          <textarea
            rows={2}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y"
            placeholder="Answer…"
            value={draftA}
            onChange={(e) => setDraftA(e.target.value)}
          />
          <button
            type="button"
            disabled={adding || !draftQ.trim() || !draftA.trim()}
            onClick={createFaq}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 ${meta.accent}`}
          >
            <Plus className="h-4 w-4" />
            Add FAQ
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading FAQs…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No FAQs yet. Add your first question above.</div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50/50">
              <input
                type="checkbox"
                checked={filtered.length > 0 && selectedIds.length === filtered.length}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-xs font-semibold text-gray-500">
                {selectedIds.length ? `${selectedIds.length} selected` : 'Select all'}
              </span>
            </div>
            <ul className="divide-y divide-gray-100">
            {filtered.map((row, idx) => (
              <li
                key={row.id}
                className={`p-3 sm:p-4 ${selectedIds.includes(row.id) ? 'bg-blue-50/40' : !row.visible_android && !row.visible_ios && !row.visible_web ? 'bg-gray-50/70' : 'bg-white'}`}
              >
                <div className="flex gap-2 sm:gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={() => toggleSelected(row.id)}
                    className="mt-2 h-4 w-4 shrink-0 rounded border-gray-300"
                  />
                  <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
                    <GripVertical className="h-4 w-4 text-gray-300 hidden sm:block" />
                    <span className="text-[10px] font-bold text-gray-400 w-6 text-center">{idx + 1}</span>
                    <button
                      type="button"
                      className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-30"
                      disabled={idx === 0}
                      onClick={() => moveRow(row, 'up')}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-30"
                      disabled={idx === filtered.length - 1}
                      onClick={() => moveRow(row, 'down')}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <input
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-200"
                      value={row.question}
                      onChange={(e) => patchRow(row.id, { question: e.target.value })}
                      onBlur={() => {
                        const current = rows.find((r) => r.id === row.id);
                        if (current) void persistRow(current);
                      }}
                    />
                    <textarea
                      rows={3}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y"
                      value={row.answer}
                      onChange={(e) => patchRow(row.id, { answer: e.target.value })}
                      onBlur={() => {
                        const current = rows.find((r) => r.id === row.id);
                        if (current) void persistRow(current);
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next = syncFaqVisibility({ ...row, visible_android: !row.visible_android });
                          patchRow(row.id, {
                            visible_android: next.visible_android,
                            visible_app: next.visible_app,
                            active: next.active,
                          });
                          void persistRow(next);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${
                          row.visible_android
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {row.visible_android ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        Android
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = syncFaqVisibility({ ...row, visible_ios: !row.visible_ios });
                          patchRow(row.id, {
                            visible_ios: next.visible_ios,
                            visible_app: next.visible_app,
                            active: next.active,
                          });
                          void persistRow(next);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${
                          row.visible_ios
                            ? 'bg-violet-50 text-violet-700 border border-violet-100'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {row.visible_ios ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        iOS
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = syncFaqVisibility({ ...row, visible_web: !row.visible_web });
                          patchRow(row.id, { visible_web: next.visible_web, active: next.active });
                          void persistRow(next);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${
                          row.visible_web
                            ? 'bg-sky-50 text-sky-700 border border-sky-100'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {row.visible_web ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        Website
                      </button>
                      <div className="flex items-center gap-2 ml-auto">
                        {savingId === row.id ? <span className="text-[11px] text-gray-400">Saving…</span> : null}
                        <button
                          type="button"
                          onClick={() => deleteRow(row.id)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
