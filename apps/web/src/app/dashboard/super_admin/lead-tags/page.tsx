'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Check, Loader2, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';

type TagRow = { id: string; name: string; color: string };

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

/** Super Admin — create / edit / delete CRM lead tags */
export default function SuperAdminLeadTagsPage() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(COLORS[0]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lead-manager/tags');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setTags(Array.isArray(json?.tags) ? json.tags : []);
    } catch {
      setTags([]);
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
        body: JSON.stringify({ action: 'create_tag', name: name.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Create failed');
      setName('');
      await load();
    } catch (e: any) {
      alert(e?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
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
    if (!confirm(`Delete tag "${t.name}"?`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_tag', id: t.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Delete failed');
      await load();
    } catch (e: any) {
      alert(e?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout role="SUPER_ADMIN">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-4">
        <div>
          <h1 className="text-2xl font-black text-[#023D95] flex items-center gap-2">
            <Tag className="h-6 w-6" /> Lead tags
          </h1>
          <p className="text-sm text-slate-500">
            Create / edit / delete. Lead sources (Website, App Booking, MISA…) seed as tags. Auto color on new tags.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="New tag name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void create()}
            />
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
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <ul className="space-y-2">
            {tags.map((t) =>
              editingId === t.id ? (
                <li key={t.id} className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-2">
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
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-lg border px-3 py-2 text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      className="rounded-lg bg-[#004AAD] px-3 py-2 text-xs font-bold text-white"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border px-3 py-2"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ) : (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <span
                    className="rounded-md px-2.5 py-1 text-xs font-bold"
                    style={{ backgroundColor: t.color || '#E5E7EB' }}
                  >
                    {t.name}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(t.id);
                        setEditName(t.name);
                        setEditColor(t.color || COLORS[0]);
                      }}
                      className="h-8 w-8 rounded-lg border border-slate-200 inline-flex items-center justify-center"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(t)}
                      className="h-8 w-8 rounded-lg border border-rose-200 text-rose-600 inline-flex items-center justify-center"
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
