'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Crown,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react';
import ContentBulkPanel from '@/components/admin/ContentBulkPanel';
import {
  MEMBERSHIP_TERMS_CSV_TEMPLATE,
  MEMBERSHIP_TERMS_EDIT_CSV_TEMPLATE,
  parseMembershipTermsCsv,
  parseMembershipTermsEditCsv,
} from '@/lib/membership-terms-admin';
import type { MembershipType } from '@/lib/membership-placements';

type TermRow = {
  id: string;
  membership_type: MembershipType;
  body: string;
  display_order: number;
  active: boolean;
  visible_android: boolean;
  visible_ios: boolean;
  visible_app: boolean;
  visible_web: boolean;
};

function syncTermVisibility(row: TermRow): TermRow {
  const visible_app = row.visible_android || row.visible_ios;
  return {
    ...row,
    visible_app,
    active: visible_app || row.visible_web,
  };
}

const TAB_META: Record<
  MembershipType,
  { label: string; short: string; subtitle: string; accent: string; previewBg: string; bullet: string }
> = {
  RSA: {
    label: 'RSA Membership',
    short: 'RSA',
    subtitle: 'Roadside Assistance screen (app) + RSA website landing page',
    accent: 'bg-orange-600',
    previewBg: 'from-orange-50 to-sky-50',
    bullet: 'text-orange-600',
  },
  SERVICE: {
    label: 'MyFNG Prime',
    short: 'Prime',
    subtitle: 'Membership page in Android & iOS app',
    accent: 'bg-blue-600',
    previewBg: 'from-blue-50 to-sky-50',
    bullet: 'text-[#023D95]',
  },
};

function TermsPreview({
  terms,
  expanded,
  onToggle,
  bulletClass,
}: {
  terms: string[];
  expanded: boolean;
  onToggle: () => void;
  bulletClass: string;
}) {
  if (!terms.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
        Active terms will appear here exactly like the app wallet card.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E5EEF9] bg-white p-4 shadow-sm">
      <div className="text-[15px] font-extrabold text-[#0F172A] mb-3">Terms & Conditions</div>
      <div className="flex gap-2 items-start">
        <span className={`text-[11px] italic leading-4 ${bulletClass}`}>•</span>
        <p className="flex-1 text-[11px] italic leading-4 text-[#475569]">{terms[0]}</p>
      </div>
      {expanded
        ? terms.slice(1).map((term) => (
            <div key={term} className="flex gap-2 items-start mt-2.5">
              <span className={`text-[11px] italic leading-4 ${bulletClass}`}>•</span>
              <p className="flex-1 text-[11px] italic leading-4 text-[#475569]">{term}</p>
            </div>
          ))
        : null}
      {terms.length > 1 ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-3 w-full flex items-center justify-center gap-1 text-[12px] font-bold text-[#023D95]"
        >
          {expanded ? 'Show less' : 'View all terms'}
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      ) : null}
    </div>
  );
}

export default function MembershipTermsPage() {
  const [rows, setRows] = useState<TermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<MembershipType>('RSA');
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [previewExpandedAndroid, setPreviewExpandedAndroid] = useState(false);
  const [previewExpandedIos, setPreviewExpandedIos] = useState(false);
  const [previewExpandedWeb, setPreviewExpandedWeb] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/membership-terms');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.details || json?.error || 'Failed to load terms');
      setRows(json.data || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load terms');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPreviewExpandedAndroid(false);
    setPreviewExpandedIos(false);
    setPreviewExpandedWeb(false);
    setSelectedIds([]);
  }, [tab]);

  const filtered = useMemo(
    () => rows.filter((r) => r.membership_type === tab).sort((a, b) => a.display_order - b.display_order),
    [rows, tab],
  );

  const androidPreviewTerms = useMemo(
    () => filtered.filter((r) => r.visible_android && r.body.trim()).map((r) => r.body.trim()),
    [filtered],
  );

  const iosPreviewTerms = useMemo(
    () => filtered.filter((r) => r.visible_ios && r.body.trim()).map((r) => r.body.trim()),
    [filtered],
  );

  const webPreviewTerms = useMemo(
    () => filtered.filter((r) => r.visible_web && r.body.trim()).map((r) => r.body.trim()),
    [filtered],
  );

  const meta = TAB_META[tab];

  async function createTerm() {
    const body = draft.trim();
    if (!body) return;
    setAdding(true);
    try {
      const res = await fetch('/api/super_admin/membership-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membership_type: tab,
          body,
          display_order: filtered.length + 1,
          active: true,
          visible_android: true,
          visible_ios: true,
          visible_web: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.details || json?.error || 'Create failed');
      setDraft('');
      await load();
    } catch (e: any) {
      alert(e?.message || 'Could not add term');
    } finally {
      setAdding(false);
    }
  }

  async function persistTerm(row: TermRow) {
    setSavingId(row.id);
    try {
      const res = await fetch(`/api/super_admin/membership-terms/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.details || json?.error || 'Save failed');
      setRows((prev) => prev.map((r) => (r.id === row.id ? json.data : r)));
    } catch (e: any) {
      alert(e?.message || 'Could not save term');
    } finally {
      setSavingId(null);
    }
  }

  async function deleteTerm(id: string) {
    if (!confirm('Delete this term?')) return;
    try {
      const res = await fetch(`/api/super_admin/membership-terms/${id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.details || json?.error || 'Delete failed');
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      alert(e?.message || 'Could not delete term');
    }
  }

  async function moveTerm(row: TermRow, direction: 'up' | 'down') {
    const idx = filtered.findIndex((r) => r.id === row.id);
    const swap = direction === 'up' ? filtered[idx - 1] : filtered[idx + 1];
    if (!swap) return;
    await Promise.all([
      fetch(`/api/super_admin/membership-terms/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...row, display_order: swap.display_order }),
      }),
      fetch(`/api/super_admin/membership-terms/${swap.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...swap, display_order: row.display_order }),
      }),
    ]);
    await load();
  }

  function patchRow(id: string, patch: Partial<TermRow>) {
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
            <Crown className="h-6 w-6 text-amber-500" />
            Membership Terms &amp; Conditions
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Manage bullet points for Android, iOS, and website separately.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ContentBulkPanel
            entityLabel="term"
            apiBase="/api/super_admin/membership-terms/bulk"
            uploadContext={{ membership_type: tab }}
            csvTemplate={MEMBERSHIP_TERMS_CSV_TEMPLATE}
            editCsvTemplate={MEMBERSHIP_TERMS_EDIT_CSV_TEMPLATE}
            parseUploadCsv={parseMembershipTermsCsv}
            parseEditCsv={parseMembershipTermsEditCsv}
            uploadPayloadKey="terms"
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

      <div className="inline-flex rounded-2xl border border-gray-200 bg-gray-100 p-1">
        {(Object.keys(TAB_META) as MembershipType[]).map((type) => {
          const active = tab === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setTab(type)}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                active ? `${TAB_META[type].accent} text-white shadow-sm` : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {TAB_META[type].label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="grid lg:grid-cols-5 gap-5 items-start">
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 bg-gray-50/80">
              <div>
                <div className="text-sm font-bold text-gray-900">{meta.label} terms</div>
                <div className="text-xs text-gray-500">{meta.subtitle}</div>
              </div>
              <div className="text-xs font-semibold text-gray-500">
                Android {filtered.filter((r) => r.visible_android).length} · iOS {filtered.filter((r) => r.visible_ios).length} · Web {filtered.filter((r) => r.visible_web).length} ·{' '}
                {filtered.length} total
              </div>
            </div>

            <div className="p-4 border-b border-gray-100">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Add a new bullet point…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void createTerm();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={adding || !draft.trim()}
                  onClick={createTerm}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 ${meta.accent}`}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
              <p className="mt-2 text-[11px] text-gray-400">Press Enter to add quickly</p>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-gray-400">Loading terms…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No terms yet. Add your first bullet above.</div>
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
                          onClick={() => moveTerm(row, 'up')}
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-30"
                          disabled={idx === filtered.length - 1}
                          onClick={() => moveTerm(row, 'down')}
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <textarea
                          rows={2}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y min-h-[52px]"
                          value={row.body}
                          onChange={(e) => patchRow(row.id, { body: e.target.value })}
                          onBlur={() => {
                            const current = rows.find((r) => r.id === row.id);
                            if (current) void persistTerm(current);
                          }}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const next = syncTermVisibility({
                                ...row,
                                visible_android: !row.visible_android,
                              });
                              patchRow(row.id, {
                                visible_android: next.visible_android,
                                visible_app: next.visible_app,
                                active: next.active,
                              });
                              void persistTerm(next);
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
                              const next = syncTermVisibility({
                                ...row,
                                visible_ios: !row.visible_ios,
                              });
                              patchRow(row.id, {
                                visible_ios: next.visible_ios,
                                visible_app: next.visible_app,
                                active: next.active,
                              });
                              void persistTerm(next);
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
                              const next = syncTermVisibility({
                                ...row,
                                visible_web: !row.visible_web,
                              });
                              patchRow(row.id, { visible_web: next.visible_web, active: next.active });
                              void persistTerm(next);
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
                            {savingId === row.id ? (
                              <span className="text-[11px] text-gray-400">Saving…</span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => deleteTerm(row.id)}
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

        <div className="lg:col-span-2 lg:sticky lg:top-6 space-y-3">
          <div className={`rounded-2xl border border-gray-200 bg-gradient-to-br ${meta.previewBg} p-4 space-y-3`}>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold uppercase tracking-wide text-gray-600">Android preview</span>
            </div>
            <TermsPreview
              terms={androidPreviewTerms}
              expanded={previewExpandedAndroid}
              onToggle={() => setPreviewExpandedAndroid((v) => !v)}
              bulletClass={meta.bullet}
            />
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-violet-50 to-sky-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-600" />
              <span className="text-xs font-bold uppercase tracking-wide text-gray-600">iOS preview</span>
            </div>
            <TermsPreview
              terms={iosPreviewTerms}
              expanded={previewExpandedIos}
              onToggle={() => setPreviewExpandedIos((v) => !v)}
              bulletClass={meta.bullet}
            />
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-slate-900 to-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-200">Website preview</span>
            </div>
            {webPreviewTerms.length ? (
              <ul className="membership-terms-list membership-terms-list-dark space-y-2.5">
                {(previewExpandedWeb ? webPreviewTerms : webPreviewTerms.slice(0, 1)).map((term) => (
                  <li key={term} className="flex gap-2.5 items-start text-sm leading-relaxed text-white/80">
                    <span className="membership-terms-check text-emerald-400">✓</span>
                    <span>{term}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-white/40 text-center py-4">No web-visible terms</p>
            )}
            {webPreviewTerms.length > 1 ? (
              <button
                type="button"
                onClick={() => setPreviewExpandedWeb((v) => !v)}
                className="w-full text-center text-xs font-bold text-emerald-300"
              >
                {previewExpandedWeb ? 'Show less' : 'View all terms'}
              </button>
            ) : null}
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed px-1">
            Toggle <strong>Android</strong>, <strong>iOS</strong>, and <strong>Website</strong> independently.
          </p>
        </div>
      </div>
    </div>
  );
}
