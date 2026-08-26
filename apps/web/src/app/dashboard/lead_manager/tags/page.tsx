'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';
import { Check, Loader2, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';

type TagRow = { id: string; name: string; color: string; parent_tag_id?: string | null };

const COLORS = [
  '#DDD6FE',
  '#BFDBFE',
  '#FECACA',
  '#BBF7D0',
  '#FED7AA',
  '#FBCFE8',
  '#A5F3FC',
  '#FEF08A',
  '#C7D2FE',
  '#99F6E4',
  '#FDE68A',
  '#E9D5FF',
];

export default function LeadManagerTagsPage() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(COLORS[0]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/lead-manager/tags');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setTags(Array.isArray(json?.tags) ? json.tags : []);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_tag',
          name: name.trim(),
          parent_tag_id: parentId || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Create failed');
      setName('');
      setParentId('');
      await load();
    } catch (e: any) {
      alert(e?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (t: TagRow) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditColor(t.color || COLORS[0]);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_tag',
          id: editingId,
          name: editName.trim(),
          color: editColor,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Update failed');
      setEditingId(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: TagRow) => {
    if (!confirm(`Delete tag "${t.name}"? Yeh saari leads se bhi hat jayega.`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_tag', id: t.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Delete failed');
      if (editingId === t.id) setEditingId(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout role="LEAD_MANAGER">
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-4">
        <div>
          <h1 className="text-2xl font-black text-[#023D95] flex items-center gap-2">
            <Tag className="h-6 w-6" /> Lead tags
            <PageHelpIcon href="/dashboard/lead_manager/tags" label="Lead tags" />
          </h1>
          <p className="text-sm text-slate-500">
            Create / edit / delete tags. Lead sources (Website, App Booking, MISA…) bhi tags ki tarah
            use kar sakte ho — naya tag har baar alag color leta hai.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Create tag</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Tag name e.g. Meta Ads A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void create()}
            />
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:max-w-[200px]"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              aria-label="Common / parent tag"
            >
              <option value="">No parent (common)</option>
              {tags
                .filter((t) => !t.parent_tag_id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    Under: {t.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={saving || !name.trim()}
              onClick={() => void create()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#004AAD] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Meta Ads A/B/C ko parent “Meta Ads” ke under banao — apply pe common + specific dono lagenge.
          </p>
        </div>

        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

        {loading ? (
          <div className="flex justify-center py-12 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : tags.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-10">No tags yet — create one above</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {tags.map((t) =>
              editingId === t.id ? (
                <li
                  key={t.id}
                  className="sm:col-span-2 rounded-xl border border-blue-200 bg-blue-50/40 px-4 py-3 shadow-sm space-y-3"
                >
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className={`h-7 w-7 rounded-md ring-2 ${
                          editColor === c ? 'ring-[#004AAD]' : 'ring-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="min-w-[160px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void saveEdit()}
                    />
                    <button
                      type="button"
                      disabled={saving || !editName.trim()}
                      onClick={() => void saveEdit()}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#004AAD] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                    >
                      <X className="h-3.5 w-3.5" /> Cancel
                    </button>
                  </div>
                </li>
              ) : (
                <li
                  key={t.id}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
                >
                  <div className="min-w-0 flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-md px-2.5 py-1 text-xs font-bold text-slate-900"
                      style={{ backgroundColor: t.color || '#E5E7EB' }}
                    >
                      {t.name}
                    </span>
                    {t.parent_tag_id ? (
                      <span className="text-[10px] font-semibold text-slate-400">
                        under{' '}
                        {tags.find((p) => p.id === t.parent_tag_id)?.name || 'parent'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase text-slate-400">
                        common
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                      title="Edit"
                      aria-label={`Edit ${t.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(t)}
                      disabled={saving}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      title="Delete"
                      aria-label={`Delete ${t.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}
