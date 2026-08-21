'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Loader2, Search, Tag, X } from 'lucide-react';

type TagRow = { id: string; name: string; color: string };

const FALLBACK_COLORS = [
  '#DDD6FE',
  '#BFDBFE',
  '#FECACA',
  '#BBF7D0',
  '#FED7AA',
  '#E5E7EB',
  '#FBCFE8',
  '#A5F3FC',
];

function contrastText(bg: string) {
  const hex = String(bg || '').replace('#', '');
  if (hex.length < 6) return '#1e293b';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? '#1e293b' : '#ffffff';
}

/**
 * TeleCRM-style lead tags: selected pills + searchable dropdown.
 * Telecallers can apply existing tags; managers/admins can also create.
 *
 * `fieldTrigger` — embed under Source (or similar): click trigger to open tag picker
 * (no separate Lead tags block).
 */
export default function LeadTagsPanel({
  leadId,
  canManage,
  compact = false,
  label = 'Lead tags',
  fieldTrigger,
}: {
  leadId: string;
  canManage: boolean;
  compact?: boolean;
  label?: string;
  /** When set, UI is a clickable field (e.g. Source badges) that opens the tag picker. */
  fieldTrigger?: ReactNode;
}) {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!leadId) {
      setTags([]);
      setSelected(new Set());
      setLoading(false);
      return;
    }
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

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open && fieldTrigger) {
      const t = window.setTimeout(() => searchRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [open, fieldTrigger]);

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
      const createdId = String(json?.tag?.id || '');
      setNewName('');
      await load();
      if (createdId) {
        setSelected((prev) => {
          const next = new Set(prev);
          next.add(createdId);
          void persist(next);
          return next;
        });
      }
    } catch (e: any) {
      alert(e?.message || 'Create tag failed');
    } finally {
      setSaving(false);
    }
  };

  const selectedTags = useMemo(
    () => tags.filter((t) => selected.has(t.id)),
    [tags, selected],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tags.filter((t) => !q || t.name.toLowerCase().includes(q));
  }, [tags, query]);

  const pickerBody = (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          ref={searchRef}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-2 py-2 text-xs outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          placeholder="Search for a tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <p className="px-3 py-3 text-xs text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-3 text-xs text-slate-500">No tags match</p>
        ) : (
          filtered.map((t, idx) => {
            const on = selected.has(t.id);
            const bg = t.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span
                  className="rounded-md px-2 py-0.5 text-[11px] font-bold"
                  style={{ backgroundColor: bg, color: contrastText(bg) }}
                >
                  {t.name}
                </span>
                {on ? <Check className="h-4 w-4 text-violet-600" /> : null}
              </button>
            );
          })
        )}
      </div>

      {canManage ? (
        <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2">
          <input
            className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            placeholder="Create new tag…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void createTag();
            }}
          />
          <button
            type="button"
            disabled={saving || !newName.trim()}
            onClick={() => void createTag()}
            className="rounded-lg bg-[#004AAD] px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
      ) : null}
    </>
  );

  // Source / field embed: click badges → open tag picker
  if (fieldTrigger) {
    return (
      <div className="relative min-w-0" ref={rootRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full min-w-0 flex-wrap items-center gap-1.5 rounded-md text-left hover:bg-slate-50/80 -mx-0.5 px-0.5 py-0.5"
          title="Click to edit lead tags"
        >
          {fieldTrigger}
          {selectedTags.map((t, idx) => {
            const bg = t.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
            return (
              <span
                key={t.id}
                className="inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: bg, color: contrastText(bg) }}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                }}
              >
                <span className="truncate">{t.name}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="opacity-70 hover:opacity-100"
                  aria-label={`Remove ${t.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(t.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(t.id);
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            );
          })}
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : null}
        </button>

        {open ? (
          <div className="absolute left-0 right-0 top-full z-40 mt-1 min-w-[240px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
            <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Tag className="h-3 w-3" /> Lead tags
            </p>
            {pickerBody}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? 'rounded-md border border-gray-200/80 bg-white px-2.5 py-1.5'
          : 'rounded-2xl border border-slate-100 bg-white p-4 shadow-sm'
      }
      ref={rootRef}
    >
      <h3
        className={
          compact
            ? 'mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500'
            : 'mb-3 flex items-center gap-1.5 font-black text-[#023D95]'
        }
      >
        <Tag className={compact ? 'h-3 w-3' : 'w-4 h-4'} /> {label}
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : null}
      </h3>

      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : (
        <>
          <div
            className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50/80 px-2 py-1.5 flex flex-wrap items-center gap-1.5 cursor-text"
            onClick={() => setOpen(true)}
          >
            {selectedTags.map((t, idx) => {
              const bg = t.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
              return (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold"
                  style={{ backgroundColor: bg, color: contrastText(bg) }}
                >
                  {t.name}
                  <button
                    type="button"
                    className="opacity-70 hover:opacity-100"
                    aria-label={`Remove ${t.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(t.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
            <div className="relative flex-1 min-w-[120px]">
              <Search className="pointer-events-none absolute left-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full bg-transparent pl-6 pr-1 py-1 text-xs outline-none placeholder:text-slate-400"
                placeholder="Search for a tag…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
              />
            </div>
          </div>

          {open ? (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-xs text-slate-500">No tags match</p>
              ) : (
                filtered.map((t, idx) => {
                  const on = selected.has(t.id);
                  const bg = t.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggle(t.id)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <span
                        className="rounded-md px-2 py-0.5 text-[11px] font-bold"
                        style={{ backgroundColor: bg, color: contrastText(bg) }}
                      >
                        {t.name}
                      </span>
                      {on ? <Check className="h-4 w-4 text-violet-600" /> : null}
                    </button>
                  );
                })
              )}
            </div>
          ) : null}

          {canManage ? (
            <div
              className={`flex gap-2 ${compact ? 'mt-2 pt-2 border-t border-slate-100' : 'mt-3 border-t border-slate-100 pt-3'}`}
            >
              <input
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                placeholder="Create new tag…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void createTag();
                }}
              />
              <button
                type="button"
                disabled={saving || !newName.trim()}
                onClick={() => void createTag()}
                className="rounded-lg bg-[#004AAD] px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                Add
              </button>
            </div>
          ) : compact ? null : (
            <p className="mt-2 text-[10px] text-slate-400">
              Select tags for Google / Meta / WhatsApp reference. Managers create new tags.
            </p>
          )}
        </>
      )}
    </div>
  );
}
