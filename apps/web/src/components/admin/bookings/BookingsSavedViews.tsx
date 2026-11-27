'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  Filter,
  Loader2,
  Plus,
  Save,
  Search,
  Share2,
  Tag,
  Ticket,
  Trash2,
  UserRound,
  X,
  Phone,
  Hash,
  ClipboardList,
  Globe,
  MessageCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { REPORT_DATE_PRESETS, type ReportDatePreset } from '@/lib/report-date-range';
import {
  bookingsViewFiltersEqual,
  conditionsFromSnapshot,
  EMPTY_BOOKINGS_VIEW,
  normalizeBookingsViewFilters,
  resetCondition,
  type BookingsViewConditionKey,
  type BookingsViewSnapshot,
} from '@/lib/bookings/savedViewFilters';

type SavedViewRow = {
  id: string;
  name: string;
  owner_id: string;
  is_shared: boolean;
  filters: unknown;
  created_at?: string;
  updated_at?: string;
};

type TagRow = { id: string; name: string; color?: string };
type Option = { value: string; label: string };

const CONDITION_CATALOG: Array<{
  key: BookingsViewConditionKey;
  label: string;
  hint: string;
  icon: typeof Tag;
}> = [
  { key: 'lead_tag', label: 'LEADTAG', hint: 'Filter by one or more lead tags', icon: Tag },
  { key: 'created_on', label: 'Created On', hint: 'When the lead was created', icon: Calendar },
  { key: 'assignee', label: 'Assignee', hint: 'Assigned telecaller', icon: UserRound },
  { key: 'message_trigger', label: 'Message Trigger', hint: 'Meta / WhatsApp prefill campaign', icon: MessageCircle },
  { key: 'status', label: 'Booking Status', hint: 'NEW, ASSIGNED, REJECTED…', icon: ClipboardList },
  { key: 'lead_status', label: 'Lead Status', hint: 'Fresh, Ringing, Follow-up, Lost…', icon: ClipboardList },
  { key: 'source', label: 'Source', hint: 'App, Website, MISA, Sarv…', icon: Globe },
  { key: 'discount', label: 'Discount', hint: 'Promo / referral / none', icon: Ticket },
  { key: 'recording', label: 'Recording', hint: 'Has a call recording', icon: Phone },
  { key: 'lead_type', label: 'Lead Type', hint: 'Lead type text', icon: Hash },
];

function ChipMenu({
  open,
  onClose,
  children,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={`absolute left-0 top-full z-50 mt-1 max-h-64 min-w-[180px] overflow-y-auto rounded-xl border border-indigo-100 bg-white py-1 shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}

function MultiPick({
  options,
  selected,
  onChange,
  allLabel,
  searchable,
}: {
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  allLabel: string;
  searchable?: boolean;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)) : options;
  return (
    <div className="min-w-[220px]">
      <button
        type="button"
        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50 ${
          selected.length === 0 ? 'bg-indigo-50 font-semibold text-indigo-800' : 'text-gray-700'
        }`}
        onClick={() => onChange([])}
      >
        <span className="flex h-4 w-4 items-center justify-center rounded border border-gray-300 text-[10px]">
          {selected.length === 0 ? '✓' : ''}
        </span>
        {allLabel}
      </button>
      {searchable !== false && options.length > 4 ? (
        <div className="px-2 pb-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg border border-indigo-100 py-1.5 pl-7 pr-2 text-xs outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      ) : null}
      {shown.map((opt) => {
        const checked = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50 ${
              checked ? 'bg-indigo-50 font-semibold text-indigo-800' : 'text-gray-700'
            }`}
            onClick={() =>
              onChange(checked ? selected.filter((item) => item !== opt.value) : [...selected, opt.value])
            }
          >
            <span className="flex h-4 w-4 items-center justify-center rounded border border-gray-300 text-[10px]">
              {checked ? '✓' : ''}
            </span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function BookingsSavedViews({
  snapshot,
  onApply,
  sourceOptions,
  statusOptions,
  leadStatusOptions,
  couponOptions,
  recordingOptions,
  assigneeOptions,
  messageTriggerOptions,
}: {
  snapshot: BookingsViewSnapshot;
  onApply: (next: BookingsViewSnapshot) => void;
  sourceOptions: Option[];
  statusOptions: Option[];
  leadStatusOptions: Option[];
  couponOptions: Option[];
  recordingOptions: Option[];
  assigneeOptions: Option[];
  messageTriggerOptions: Option[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [views, setViews] = useState<SavedViewRow[]>([]);
  const [me, setMe] = useState('');
  const [canShare, setCanShare] = useState(false);
  const [loadingViews, setLoadingViews] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('All Leads');
  const [shareOnSave, setShareOnSave] = useState(true);
  const [visibleConditions, setVisibleConditions] = useState<BookingsViewConditionKey[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [tags, setTags] = useState<TagRow[]>([]);
  const addRef = useRef<HTMLDivElement>(null);

  const loadViews = useCallback(async () => {
    setLoadingViews(true);
    try {
      const res = await fetch('/api/lead-manager/saved-views', { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not load views');
      setViews(Array.isArray(json.views) ? json.views : []);
      setMe(String(json.me || ''));
      setCanShare(Boolean(json.can_share));
    } catch (err: any) {
      toast.error(err?.message || 'Could not load saved views');
      setViews([]);
    } finally {
      setLoadingViews(false);
    }
  }, []);

  useEffect(() => {
    void loadViews();
  }, [loadViews]);

  useEffect(() => {
    fetch('/api/lead-manager/tags', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => setTags(Array.isArray(json?.tags) ? json.tags : []))
      .catch(() => setTags([]));
  }, []);

  useEffect(() => {
    if (!addOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(event.target as Node)) setAddOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [addOpen]);

  const selectedView = views.find((view) => view.id === selectedId) || null;
  const savedSnapshot = selectedView
    ? normalizeBookingsViewFilters(selectedView.filters)
    : EMPTY_BOOKINGS_VIEW;
  const dirty = selectedView
    ? !bookingsViewFiltersEqual(snapshot, savedSnapshot) || draftName.trim() !== selectedView.name
    : draftName.trim() !== 'All Leads' || !bookingsViewFiltersEqual(snapshot, EMPTY_BOOKINGS_VIEW);

  const owned = !selectedView || (me && selectedView.owner_id === me);

  const tagOptions = useMemo(
    () => tags.map((tag) => ({ value: tag.id, label: tag.name })),
    [tags],
  );

  const patch = (partial: Partial<BookingsViewSnapshot>) => {
    onApply(normalizeBookingsViewFilters({ ...snapshot, ...partial }));
  };

  const applyAllLeads = () => {
    setSelectedId(null);
    setDraftName('All Leads');
    setVisibleConditions([]);
    onApply({ ...EMPTY_BOOKINGS_VIEW });
  };

  const applyView = (view: SavedViewRow) => {
    const next = normalizeBookingsViewFilters(view.filters);
    setSelectedId(view.id);
    setDraftName(view.name);
    setShareOnSave(Boolean(view.is_shared));
    setVisibleConditions(conditionsFromSnapshot(next));
    onApply(next);
    setDrawerOpen(false);
  };

  const createNew = () => {
    setSelectedId(null);
    setDraftName(draftName.trim() && draftName !== 'All Leads' ? `${draftName.trim()} Copy` : 'Untitled view');
    setVisibleConditions((prev) => {
      const fromSnap = conditionsFromSnapshot(snapshot);
      return fromSnap.includes('created_on') ? fromSnap : [...fromSnap, 'created_on'];
    });
    setDrawerOpen(false);
  };

  const addCondition = (key: BookingsViewConditionKey) => {
    setVisibleConditions((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setAddOpen(false);
    setAddQuery('');
    setOpenChip(key);
  };

  const removeCondition = (key: BookingsViewConditionKey) => {
    setVisibleConditions((prev) => prev.filter((item) => item !== key));
    onApply(resetCondition(snapshot, key));
    if (openChip === key) setOpenChip(null);
  };

  const saveView = async () => {
    const name = draftName.trim();
    if (!name || name === 'All Leads') {
      toast.error('Give this view a name first');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/saved-views', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedId && owned ? selectedId : undefined,
          name,
          filters: snapshot,
          is_shared: canShare && shareOnSave,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      const view = json.view as SavedViewRow;
      toast.success(selectedId && owned ? 'View updated' : 'View saved');
      await loadViews();
      if (view?.id) {
        setSelectedId(view.id);
        setDraftName(view.name);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not save view');
    } finally {
      setSaving(false);
    }
  };

  const deleteView = async (view: SavedViewRow) => {
    if (!window.confirm(`Delete view “${view.name}”?`)) return;
    try {
      const res = await fetch(`/api/lead-manager/saved-views?id=${encodeURIComponent(view.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Delete failed');
      toast.success('View deleted');
      if (selectedId === view.id) applyAllLeads();
      await loadViews();
    } catch (err: any) {
      toast.error(err?.message || 'Could not delete view');
    }
  };

  const unusedConditions = CONDITION_CATALOG.filter((item) => !visibleConditions.includes(item.key));
  const filteredConditions = unusedConditions.filter((item) => {
    const q = addQuery.trim().toLowerCase();
    if (!q) return true;
    return item.label.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q);
  });

  const createdOnLabel =
    REPORT_DATE_PRESETS.find((p) => p.value === snapshot.datePreset)?.label ||
    (snapshot.datePreset === 'all_time' ? 'Any' : snapshot.datePreset);

  return (
    <div className="relative">
      {drawerOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/30 md:bg-slate-900/20"
          aria-label="Close filters"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(100%,300px)] flex-col border-r border-indigo-100 bg-white shadow-xl transition-transform duration-200 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2 font-bold text-gray-900">
            <Filter className="h-4 w-4 text-indigo-600" />
            Filters
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2 px-3 py-3">
          <button
            type="button"
            onClick={createNew}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#4F46E5] px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Create New
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <button
            type="button"
            onClick={applyAllLeads}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm ${
              !selectedId ? 'bg-indigo-50 font-semibold text-indigo-800' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4 shrink-0 text-indigo-500" />
            <span className="flex-1 truncate">All Leads</span>
          </button>
          {loadingViews ? (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading views…
            </div>
          ) : null}
          {views.map((view) => {
            const active = view.id === selectedId;
            const mine = me && view.owner_id === me;
            return (
              <div
                key={view.id}
                className={`group flex items-center gap-1 rounded-lg ${
                  active ? 'bg-indigo-50' : 'hover:bg-gray-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => applyView(view)}
                  className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm ${
                    active ? 'font-semibold text-indigo-800' : 'text-gray-700'
                  }`}
                >
                  <Filter className="h-4 w-4 shrink-0 text-indigo-400" />
                  <span className="truncate">{view.name}</span>
                  {view.is_shared ? (
                    <Share2 className="h-3 w-3 shrink-0 text-indigo-400" aria-label="Shared with team" />
                  ) : null}
                </button>
                <BarChart3 className="mr-1 hidden h-3.5 w-3.5 text-gray-300 group-hover:block" />
                {mine ? (
                  <button
                    type="button"
                    className="mr-1 hidden rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600 group-hover:block"
                    onClick={() => void deleteView(view)}
                    aria-label={`Delete ${view.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>

      <div className="flex w-full flex-wrap items-center gap-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Filter className="h-3.5 w-3.5 text-[#004AAD]" />
              Views
            </button>
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="h-8 w-[140px] rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#004AAD] sm:w-[180px]"
              placeholder="View name"
            />
            <button
              type="button"
              onClick={() => void saveView()}
              disabled={saving || !dirty || draftName.trim() === 'All Leads'}
              title="Save view"
              className="inline-flex h-8 items-center gap-1 rounded-md bg-[#004AAD] px-2 text-xs font-semibold text-white hover:bg-[#003A8C] disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </button>
            {canShare ? (
              <label className="hidden items-center gap-1 text-[11px] font-medium text-slate-500 sm:inline-flex">
                <input
                  type="checkbox"
                  checked={shareOnSave}
                  onChange={(e) => setShareOnSave(e.target.checked)}
                  className="rounded border-gray-300 text-[#004AAD] focus:ring-[#004AAD]"
                />
                Share
              </label>
            ) : null}
            {dirty && draftName !== 'All Leads' ? (
              <span className="text-[10px] font-semibold text-amber-600">Unsaved</span>
            ) : null}
          </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <select
            value={snapshot.sort}
            onChange={(e) => patch({ sort: e.target.value === 'oldest' ? 'oldest' : 'newest' })}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600"
            aria-label="Sort"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </div>
    </div>
  );
}
