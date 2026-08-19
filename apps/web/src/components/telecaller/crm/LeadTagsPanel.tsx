'use client';

import { useEffect, useState } from 'react';
import { Loader2, Tag } from 'lucide-react';

type TagRow = { id: string; name: string; color: string };

export default function LeadTagsPanel({
  leadId,
  canManage,
}: {
  leadId: string;
  canManage: boolean;
}) {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lead-manager/tags?lead_id=${encodeURIComponent(leadId)}`);
      const json = await res.json().catch(() => ({}));
      setTags(Array.isArray(json?.tags) ? json.tags : []);
      setSelected(new Set(Array.isArray(json?.lead_tag_ids) ? json.lead_tag_ids.map(String) : []));
    } catch {
      setTags([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [leadId]);

  const persist = async (next: Set<string>) => {
    setSaving(true);
    try {
      await fetch('/api/lead-manager/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_lead_tags',
          lead_id: leadId,
          tag_ids: Array.from(next),
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      void persist(next);
      return next;
    });
  };

  const createTag = async () => {
    if (!canManage || !newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_tag', name: newName.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setNewName('');
      await load();
    } catch (e: any) {
      alert(e?.message || 'Create tag failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <h3 className="font-black text-[#023D95] mb-3 flex items-center gap-1.5">
        <Tag className="w-4 h-4" /> Tags
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : null}
      </h3>
      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : tags.length === 0 ? (
        <p className="text-xs text-slate-500 mb-2">No tags yet</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((t) => {
            const on = selected.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 transition ${
                  on ? 'text-white' : 'bg-white text-slate-600 ring-slate-200'
                }`}
                style={
                  on
                    ? { backgroundColor: t.color || '#004AAD', borderColor: t.color || '#004AAD' }
                    : undefined
                }
              >
                {t.name}
              </button>
            );
          })}
        </div>
      )}
      {canManage ? (
        <div className="flex gap-2 mt-2">
          <input
            className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            placeholder="New tag name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            type="button"
            disabled={saving || !newName.trim()}
            onClick={() => void createTag()}
            className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
      ) : null}
    </div>
  );
}
