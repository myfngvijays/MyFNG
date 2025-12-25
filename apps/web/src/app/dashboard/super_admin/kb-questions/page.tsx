'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCcw, CheckCircle2, XCircle, PlusCircle, Save } from 'lucide-react';

type Status = 'new' | 'triaged' | 'answered' | 'added_to_kb' | 'ignored';

type KbQuestionEvent = {
  id: string;
  conversation_id?: string | null;
  user_message: string;
  assistant_message?: string | null;
  intent?: any;
  context?: any;
  status: Status;
  triage_notes?: string | null;
  resolved_answer?: string | null;
  created_at: string;
  updated_at: string;
};

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export default function KbQuestionsAdminPage() {
  const [items, setItems] = useState<KbQuestionEvent[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [authBanner, setAuthBanner] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('new');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorNotes, setEditorNotes] = useState('');
  const [editorAnswer, setEditorAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const selected = useMemo(() => items.find((x) => x.id === selectedId) || null, [items, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setEditorNotes(selected.triage_notes || '');
    setEditorAnswer(selected.resolved_answer || '');
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchItems = async () => {
    setLoading(true);
    try {
      setAuthBanner(null);
      const params = new URLSearchParams();
      params.set('status', status);
      if (q.trim()) params.set('q', q.trim());
      params.set('limit', '80');
      params.set('offset', '0');
      const res = await fetch(`/api/admin/kb-question-events?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401) {
          setAuthBanner('Unauthorized. Please login as SUPER_ADMIN to view the AI Learning Inbox.');
          setItems([]);
          setCount(null);
          setSelectedId(null);
          return;
        }
        if (res.status === 403) {
          setAuthBanner('Forbidden. SUPER_ADMIN access required.');
          setItems([]);
          setCount(null);
          setSelectedId(null);
          return;
        }
        throw new Error(data?.error || 'Failed to load');
      }
      setItems(Array.isArray(data?.items) ? data.items : []);
      setCount(typeof data?.count === 'number' ? data.count : null);
      // auto-select first row
      if (!selectedId && Array.isArray(data?.items) && data.items.length) setSelectedId(data.items[0].id);
    } catch (e: any) {
      setToast(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 2500);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const patchEvent = async (id: string, patch: Partial<KbQuestionEvent>) => {
    const res = await fetch(`/api/admin/kb-question-events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Update failed');
    const updated = data?.item as KbQuestionEvent;
    setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
    return updated;
  };

  const saveDraft = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await patchEvent(selected.id, {
        status: selected.status === 'new' ? 'triaged' : selected.status,
        triage_notes: editorNotes,
        resolved_answer: editorAnswer,
      });
      setToast('Saved');
    } catch (e: any) {
      setToast(e?.message || 'Save failed');
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2000);
    }
  };

  const setStatusOnly = async (next: Status) => {
    if (!selected) return;
    setSaving(true);
    try {
      await patchEvent(selected.id, {
        status: next,
        triage_notes: editorNotes,
        resolved_answer: editorAnswer,
      });
      setToast(`Status: ${next}`);
    } catch (e: any) {
      setToast(e?.message || 'Update failed');
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2000);
    }
  };

  const addToKb = async () => {
    if (!selected) return;
    if (!editorAnswer.trim()) {
      setToast('Please write Resolved Answer first');
      setTimeout(() => setToast(null), 2000);
      return;
    }
    setSaving(true);
    try {
      // Ensure answer saved before add-to-kb action
      await patchEvent(selected.id, { triage_notes: editorNotes, resolved_answer: editorAnswer });
      const res = await fetch(`/api/admin/kb-question-events/${selected.id}/add-to-kb`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Add to KB failed');
      const updated = data?.item as KbQuestionEvent;
      setItems((prev) => prev.map((x) => (x.id === selected.id ? updated : x)));
      setToast('Added to KB (run kb-ingest to apply)');
    } catch (e: any) {
      setToast(e?.message || 'Add to KB failed');
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xl font-bold text-gray-900">AI Learning Inbox</div>
              <div className="text-xs text-gray-600">
                Review unknown questions, add verified answers to KB. {typeof count === 'number' ? `(${count})` : ''}
              </div>
            </div>
            <button
              onClick={fetchItems}
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border bg-white text-sm"
            >
              <option value="new">new</option>
              <option value="triaged">triaged</option>
              <option value="answered">answered</option>
              <option value="added_to_kb">added_to_kb</option>
              <option value="ignored">ignored</option>
              <option value="all">all</option>
            </select>

            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border bg-white">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchItems();
                }}
                placeholder="Search user question..."
                className="w-full outline-none text-sm"
              />
            </div>

            <button
              onClick={fetchItems}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {toast && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-black text-white text-sm inline-block">
            {toast}
          </div>
        )}
        {authBanner && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-900 text-sm">
            {authBanner}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* List */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b text-sm font-semibold text-gray-900">
              Events {loading ? '(loading...)' : ''}
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {items.length === 0 && !loading && <div className="p-4 text-sm text-gray-600">No items</div>}
              {items.map((it) => {
                const active = it.id === selectedId;
                return (
                  <button
                    key={it.id}
                    onClick={() => setSelectedId(it.id)}
                    className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 ${
                      active ? 'bg-blue-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-gray-700">{it.status}</div>
                      <div className="text-xs text-gray-500">{fmt(it.created_at)}</div>
                    </div>
                    <div className="mt-1 text-sm text-gray-900 line-clamp-2">{it.user_message}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail */}
          <div className="lg:col-span-2 bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-gray-900">
                {selected ? 'Details' : 'Select an event'}
              </div>
              {selected && (
                <div className="text-xs text-gray-500">
                  {selected.status} • updated {fmt(selected.updated_at)}
                </div>
              )}
            </div>

            {!selected ? (
              <div className="p-6 text-sm text-gray-600">Select an event from the left list.</div>
            ) : (
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-gray-700">Customer question</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm text-gray-900 border rounded-lg p-3 bg-gray-50">
                    {selected.user_message}
                  </div>
                </div>

                {selected.assistant_message && (
                  <div>
                    <div className="text-xs font-semibold text-gray-700">Bot reply (as sent)</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-gray-900 border rounded-lg p-3 bg-white">
                      {selected.assistant_message}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-semibold text-gray-700">Triage notes</div>
                    <textarea
                      value={editorNotes}
                      onChange={(e) => setEditorNotes(e.target.value)}
                      rows={6}
                      className="mt-1 w-full border rounded-lg p-2 text-sm"
                      placeholder="Internal notes..."
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-700">Resolved answer (what bot should say)</div>
                    <textarea
                      value={editorAnswer}
                      onChange={(e) => setEditorAnswer(e.target.value)}
                      rows={6}
                      className="mt-1 w-full border rounded-lg p-2 text-sm"
                      placeholder="Write a short verified answer..."
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={saveDraft}
                    disabled={saving}
                    className="px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-black disabled:opacity-60 flex items-center gap-2 text-sm"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={() => setStatusOnly('ignored')}
                    disabled={saving}
                    className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-60 flex items-center gap-2 text-sm"
                  >
                    <XCircle className="w-4 h-4" />
                    Ignore
                  </button>
                  <button
                    onClick={() => setStatusOnly('answered')}
                    disabled={saving}
                    className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-60 flex items-center gap-2 text-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark answered
                  </button>
                  <button
                    onClick={addToKb}
                    disabled={saving}
                    className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 text-sm"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Add to KB
                  </button>
                </div>

                <div className="text-xs text-gray-500">
                  Note: “Add to KB” writes to `kb_manual_faqs`. To make answers appear in RAG, run the `kb-ingest` function after adding items.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
