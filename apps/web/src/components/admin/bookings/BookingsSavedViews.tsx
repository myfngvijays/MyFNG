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
  { key: 'status', label: 'Lead Status', hint: 'Booking status', icon: ClipboardList },
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
}: {
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  allLabel: string;
}) {
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
      {options.map((opt) => {
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
  couponOptions,
  recordingOptions,
  assigneeOptions,
  messageTriggerOptions,
}: {
  snapshot: BookingsViewSnapshot;
  onApply: (next: BookingsViewSnapshot) => void;
  sourceOptions: Option[];
  statusOptions: Option[];
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

      <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
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

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <div className="relative" ref={addRef}>
            <button
              type="button"
              onClick={() => setAddOpen((open) => !open)}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-[#004AAD] hover:bg-blue-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Condition
            </button>
            {addOpen ? (
              <div className="absolute left-0 top-full z-50 mt-1 w-[min(100vw-2rem,320px)] rounded-xl border border-indigo-100 bg-white p-2 shadow-xl">
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    value={addQuery}
                    onChange={(e) => setAddQuery(e.target.value)}
                    placeholder="Add a new condition"
                    className="w-full rounded-lg border border-indigo-200 py-2 pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                    autoFocus
                  />
                </div>
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Fields</p>
                <div className="max-h-64 overflow-y-auto">
                  {filteredConditions.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-gray-500">All conditions are already added.</p>
                  ) : (
                    filteredConditions.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => addCondition(item.key)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-indigo-50"
                        >
                          <Icon className="h-4 w-4 text-indigo-500" />
                          <span>
                            <span className="block text-sm font-semibold text-gray-800">{item.label}</span>
                            <span className="block text-[11px] text-gray-500">{item.hint}</span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {visibleConditions.map((key) => {
            const meta = CONDITION_CATALOG.find((item) => item.key === key);
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <div
                key={key}
                className="relative flex min-h-[36px] max-w-full items-center gap-1.5 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-900 ring-1 ring-indigo-100"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                <span className="shrink-0">{meta.label}</span>
                {key === 'lead_tag' ? (
                  <select
                    value={snapshot.tagMode}
                    onChange={(e) => patch({ tagMode: e.target.value === 'all' ? 'all' : 'any' })}
                    className="rounded border-0 bg-white/80 py-0.5 text-xs font-semibold text-indigo-800"
                  >
                    <option value="any">Is Any</option>
                    <option value="all">Is All</option>
                  </select>
                ) : (
                  <span className="text-indigo-400">Is</span>
                )}
                {key === 'lead_tag' ? (
                  <button
                    type="button"
                    onClick={() => setOpenChip(openChip === key ? null : key)}
                    className="inline-flex max-w-[200px] items-center gap-1 truncate rounded bg-white px-1.5 py-0.5"
                  >
                    {snapshot.tagIds.length === 0
                      ? 'Any'
                      : snapshot.tagIds
                          .map((id) => tags.find((tag) => tag.id === id)?.name || id)
                          .slice(0, 3)
                          .join(' | ') + (snapshot.tagIds.length > 3 ? '…' : '')}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                ) : null}
                {key === 'created_on' ? (
                  <button
                    type="button"
                    onClick={() => setOpenChip(openChip === key ? null : key)}
                    className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5"
                  >
                    <Calendar className="h-3 w-3" />
                    {snapshot.datePreset === 'all_time' ? 'Any' : createdOnLabel}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                ) : null}
                {key === 'assignee' ? (
                  <button
                    type="button"
                    onClick={() => setOpenChip(openChip === key ? null : key)}
                    className="inline-flex max-w-[180px] truncate rounded bg-white px-1.5 py-0.5"
                  >
                    {snapshot.assignees.length === 0
                      ? 'Any'
                      : snapshot.assignees.length === 1
                        ? snapshot.assignees[0]
                        : `${snapshot.assignees[0]} +${snapshot.assignees.length - 1}`}
                    <ChevronDown className="ml-1 inline h-3 w-3" />
                  </button>
                ) : null}
                {key === 'message_trigger' ? (
                  <button
                    type="button"
                    onClick={() => setOpenChip(openChip === key ? null : key)}
                    className="inline-flex max-w-[200px] truncate rounded bg-white px-1.5 py-0.5"
                  >
                    {snapshot.messageTriggers.length === 0
                      ? 'Any'
                      : snapshot.messageTriggers.length === 1
                        ? messageTriggerOptions.find((opt) => opt.value === snapshot.messageTriggers[0])?.label ||
                          snapshot.messageTriggers[0]
                        : `${
                            messageTriggerOptions.find((opt) => opt.value === snapshot.messageTriggers[0])?.label ||
                            snapshot.messageTriggers[0]
                          } +${snapshot.messageTriggers.length - 1}`}
                    <ChevronDown className="ml-1 inline h-3 w-3" />
                  </button>
                ) : null}
                {key === 'status' ? (
                  <select
                    value={snapshot.status}
                    onChange={(e) => patch({ status: e.target.value })}
                    className="max-w-[160px] rounded border-0 bg-white py-0.5 text-xs font-semibold"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                {key === 'source' ? (
                  <select
                    value={snapshot.source}
                    onChange={(e) => patch({ source: e.target.value })}
                    className="max-w-[160px] rounded border-0 bg-white py-0.5 text-xs font-semibold"
                  >
                    {sourceOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                {key === 'discount' ? (
                  <select
                    value={snapshot.coupon}
                    onChange={(e) => patch({ coupon: e.target.value })}
                    className="max-w-[160px] rounded border-0 bg-white py-0.5 text-xs font-semibold"
                  >
                    {couponOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                {key === 'recording' ? (
                  <select
                    value={snapshot.recording}
                    onChange={(e) => patch({ recording: e.target.value })}
                    className="max-w-[160px] rounded border-0 bg-white py-0.5 text-xs font-semibold"
                  >
                    {recordingOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                {key === 'lead_type' ? (
                  <input
                    value={snapshot.leadType}
                    onChange={(e) => patch({ leadType: e.target.value.toUpperCase() })}
                    placeholder="Type"
                    className="w-24 rounded border-0 bg-white px-1.5 py-0.5 text-xs font-semibold outline-none"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => removeCondition(key)}
                  className="rounded-full bg-indigo-200 p-0.5 text-indigo-800 hover:bg-indigo-300"
                  aria-label={`Remove ${meta.label}`}
                >
                  <X className="h-3 w-3" />
                </button>

                {key === 'lead_tag' ? (
                  <ChipMenu open={openChip === key} onClose={() => setOpenChip(null)} className="min-w-[240px]">
                    <MultiPick
                      options={tagOptions}
                      selected={snapshot.tagIds}
                      onChange={(tagIds) => patch({ tagIds })}
                      allLabel="Any tag"
                    />
                  </ChipMenu>
                ) : null}
                {key === 'created_on' ? (
                  <ChipMenu open={openChip === key} onClose={() => setOpenChip(null)}>
                    <button
                      type="button"
                      className={`flex w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 ${
                        snapshot.datePreset === 'all_time' ? 'bg-indigo-50 font-semibold text-indigo-800' : 'text-gray-700'
                      }`}
                      onClick={() => {
                        patch({ datePreset: 'all_time', customStart: '', customEnd: '' });
                        setOpenChip(null);
                      }}
                    >
                      Any
                    </button>
                    {REPORT_DATE_PRESETS.filter((p) => p.value !== 'all_time').map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        className={`flex w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 ${
                          snapshot.datePreset === preset.value
                            ? 'bg-indigo-50 font-semibold text-indigo-800'
                            : 'text-gray-700'
                        }`}
                        onClick={() => {
                          patch({ datePreset: preset.value as ReportDatePreset });
                          setOpenChip(null);
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                    {snapshot.datePreset === 'custom' ? (
                      <div className="flex gap-2 border-t border-gray-100 px-3 py-2">
                        <input
                          type="date"
                          value={snapshot.customStart}
                          onChange={(e) => patch({ datePreset: 'custom', customStart: e.target.value })}
                          className="w-full rounded border border-gray-200 px-1 py-1 text-xs"
                        />
                        <input
                          type="date"
                          value={snapshot.customEnd}
                          onChange={(e) => patch({ datePreset: 'custom', customEnd: e.target.value })}
                          className="w-full rounded border border-gray-200 px-1 py-1 text-xs"
                        />
                      </div>
                    ) : null}
                  </ChipMenu>
                ) : null}
                {key === 'assignee' ? (
                  <ChipMenu open={openChip === key} onClose={() => setOpenChip(null)}>
                    <MultiPick
                      options={assigneeOptions}
                      selected={snapshot.assignees}
                      onChange={(assignees) => patch({ assignees })}
                      allLabel="Any assignee"
                    />
                  </ChipMenu>
                ) : null}
                {key === 'message_trigger' ? (
                  <ChipMenu open={openChip === key} onClose={() => setOpenChip(null)}>
                    <MultiPick
                      options={messageTriggerOptions}
                      selected={snapshot.messageTriggers}
                      onChange={(messageTriggers) => patch({ messageTriggers })}
                      allLabel="Any trigger"
                    />
                  </ChipMenu>
                ) : null}
              </div>
            );
          })}
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
