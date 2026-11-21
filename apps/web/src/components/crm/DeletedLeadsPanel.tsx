'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArchiveRestore,
  Bot,
  CalendarX,
  ChevronDown,
  Filter,
  HelpCircle,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  UserX,
  X,
} from 'lucide-react';

export type DeletedLeadRow = {
  id: string;
  lead_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  vehicle: string | null;
  city: string | null;
  lead_source: string | null;
  status_label: string;
  telecaller: string | null;
  created_at: string;
  deleted_at: string;
  deleted_by: string;
  deleted_by_role: string | null;
  deleted_kind: 'PANEL' | 'AUTO' | 'UNKNOWN';
  deleted_reason: string | null;
  merged_into: string | null;
  active_lead: { id: string; lead_number: string | null } | null;
};

const WINDOWS = [
  { days: 1, label: 'Today' },
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last year' },
];

const KIND_LABEL: Record<DeletedLeadRow['deleted_kind'], string> = {
  PANEL: 'Deleted by a person',
  AUTO: 'Auto (system merge)',
  UNKNOWN: 'Not recorded',
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function istDay(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(iso));
}

function kindTone(kind: DeletedLeadRow['deleted_kind']) {
  if (kind === 'PANEL') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (kind === 'AUTO') return 'bg-sky-50 text-sky-700 border-sky-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

/** Page buttons around the current page, with null for a gap: 1 … 4 5 6 … 12 */
function pageNumbers(page: number, count: number): Array<number | null> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: Array<number | null> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(count - 1, page + 1);
  if (start > 2) out.push(null);
  for (let n = start; n <= end; n += 1) out.push(n);
  if (end < count - 1) out.push(null);
  out.push(count);
  return out;
}

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((v) => String(v || '').trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`h-10 w-full appearance-none rounded-xl border pl-3 pr-8 text-sm font-semibold ${
            value ? 'border-[#004AAD] bg-blue-50 text-[#023D95]' : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          <option value="">All</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  );
}

export default function DeletedLeadsPanel({
  leadHref,
  padded = false,
  canRestore = true,
}: {
  /** Where a lead number links to once it is open (role-specific lead page). */
  leadHref: (lead: { id: string; lead_number: string | null }) => string;
  /** Add page gutters (Super Admin layout has none; Lead Manager layout already pads). */
  padded?: boolean;
  /** false = view-only (telecallers): no checkboxes or Restore buttons. */
  canRestore?: boolean;
}) {
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [rows, setRows] = useState<DeletedLeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Advanced filters (applied on the loaded rows).
  const [showFilters, setShowFilters] = useState(false);
  const [fDeletedBy, setFDeletedBy] = useState('');
  const [fKind, setFKind] = useState('');
  const [fRestorable, setFRestorable] = useState('');
  const [fTelecaller, setFTelecaller] = useState('');
  const [fSource, setFSource] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fCity, setFCity] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (debounced) params.set('q', debounced);
      const res = await fetch(`/api/crm/deleted-leads?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not load deleted leads');
      setRows(Array.isArray(json.leads) ? json.leads : []);
    } catch (e: any) {
      setError(e?.message || 'Could not load deleted leads');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [days, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const options = useMemo(
    () => ({
      deletedBy: uniq(rows.map((r) => r.deleted_by)),
      telecaller: uniq(rows.map((r) => r.telecaller)),
      source: uniq(rows.map((r) => r.lead_source)),
      status: uniq(rows.map((r) => r.status_label)),
      city: uniq(rows.map((r) => r.city)),
    }),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (fDeletedBy && r.deleted_by !== fDeletedBy) return false;
        if (fKind && r.deleted_kind !== fKind) return false;
        if (fRestorable === 'yes' && r.active_lead) return false;
        if (fRestorable === 'no' && !r.active_lead) return false;
        if (fTelecaller && (r.telecaller || '') !== fTelecaller) return false;
        if (fSource && (r.lead_source || '') !== fSource) return false;
        if (fStatus && r.status_label !== fStatus) return false;
        if (fCity && (r.city || '') !== fCity) return false;
        return true;
      }),
    [rows, fDeletedBy, fKind, fRestorable, fTelecaller, fSource, fStatus, fCity],
  );

  // Pagination (client-side over the filtered rows).
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    setPage(1);
  }, [days, debounced, fDeletedBy, fKind, fRestorable, fTelecaller, fSource, fStatus, fCity, pageSize]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  // Drop selections that are no longer in the filtered list (new load, filter change, restored).
  useEffect(() => {
    setSelected((prev) => {
      if (!prev.size) return prev;
      const visible = new Set(filtered.map((r) => r.id));
      const next = new Set(Array.from(prev).filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  // Header checkbox works on the current page.
  const allSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const someSelected = !allSelected && pageRows.some((r) => selected.has(r.id));
  const selectedRows = useMemo(() => filtered.filter((r) => selected.has(r.id)), [filtered, selected]);
  const selectedRestorable = selectedRows.filter((r) => !r.active_lead);
  const selectedBlocked = selectedRows.length - selectedRestorable.length;

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) pageRows.forEach((r) => next.delete(r.id));
      else pageRows.forEach((r) => next.add(r.id));
      return next;
    });
  const selectAllFiltered = () => setSelected(new Set(filtered.map((r) => r.id)));

  const restoreSelected = async () => {
    // Leads whose number already has an open lead are skipped (restoring would duplicate it).
    const ids = selectedRestorable.map((r) => r.id);
    if (!ids.length) {
      toast.error('None of the selected leads can be restored — their numbers already have an open lead.');
      return;
    }
    const skipNote = selectedBlocked
      ? `\n\n${selectedBlocked} selected lead${selectedBlocked > 1 ? 's' : ''} will be skipped (number already has an open lead).`
      : '';
    if (
      !window.confirm(
        `Restore ${ids.length} lead${ids.length > 1 ? 's' : ''}? They will show again in Bookings & Leads and the telecaller lists.${skipNote}`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    const done: string[] = [];
    const failed: string[] = [];
    try {
      for (let i = 0; i < ids.length; i += 5) {
        const batch = ids.slice(i, i + 5);
        await Promise.all(
          batch.map(async (id) => {
            try {
              const res = await fetch('/api/crm/deleted-leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id }),
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(json?.error || 'Restore failed');
              done.push(id);
            } catch (e: any) {
              const row = rows.find((r) => r.id === id);
              failed.push(`${row?.lead_number || id}: ${e?.message || 'failed'}`);
            }
          }),
        );
      }
    } finally {
      setBulkBusy(false);
    }
    if (done.length) {
      const gone = new Set(done);
      setRows((prev) => prev.filter((r) => !gone.has(r.id)));
      toast.success(`${done.length} lead${done.length > 1 ? 's' : ''} restored`);
    }
    if (failed.length) {
      toast.error(`${failed.length} not restored — ${failed.slice(0, 2).join('; ')}${failed.length > 2 ? '…' : ''}`, {
        duration: 6000,
      });
      // Another lead on the same number may have opened meanwhile — refresh the list.
      void load();
    }
    setSelected(new Set());
  };

  const activeFilters = [fDeletedBy, fKind, fRestorable, fTelecaller, fSource, fStatus, fCity].filter(Boolean).length;
  const clearFilters = () => {
    setFDeletedBy('');
    setFKind('');
    setFRestorable('');
    setFTelecaller('');
    setFSource('');
    setFStatus('');
    setFCity('');
  };

  const stats = useMemo(() => {
    const today = istDay(new Date().toISOString());
    const byPerson = new Map<string, number>();
    let todayCount = 0;
    let restorable = 0;
    let panel = 0;
    let auto = 0;
    let unknown = 0;
    for (const r of filtered) {
      if (istDay(r.deleted_at) === today) todayCount += 1;
      if (!r.active_lead) restorable += 1;
      if (r.deleted_kind === 'PANEL') panel += 1;
      else if (r.deleted_kind === 'AUTO') auto += 1;
      else unknown += 1;
      byPerson.set(r.deleted_by, (byPerson.get(r.deleted_by) || 0) + 1);
    }
    return {
      total: filtered.length,
      today: todayCount,
      restorable,
      panel,
      auto,
      unknown,
      byPerson: Array.from(byPerson.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [filtered]);

  const restore = async (row: DeletedLeadRow) => {
    const label = `${row.lead_number || 'this lead'} (${row.customer_name || row.customer_phone || '—'})`;
    if (!window.confirm(`Restore ${label}? It will show again in Bookings & Leads and the telecaller's list.`)) return;
    setRestoringId(row.id);
    try {
      const res = await fetch('/api/crm/deleted-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: row.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Restore failed');
      toast.success(`${row.lead_number || 'Lead'} restored`);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e: any) {
      toast.error(e?.message || 'Restore failed');
      void load();
    } finally {
      setRestoringId(null);
    }
  };

  const tiles: Array<{
    label: string;
    value: number;
    icon: React.ReactNode;
    active: boolean;
    onClick?: () => void;
  }> = [
    { label: 'Deleted', value: stats.total, icon: <Trash2 className="h-5 w-5" />, active: false },
    { label: 'Deleted today', value: stats.today, icon: <CalendarX className="h-5 w-5" />, active: false },
    {
      label: 'Can restore',
      value: stats.restorable,
      icon: <ArchiveRestore className="h-5 w-5" />,
      active: fRestorable === 'yes',
      onClick: () => setFRestorable((v) => (v === 'yes' ? '' : 'yes')),
    },
    {
      label: 'By a person',
      value: stats.panel,
      icon: <UserX className="h-5 w-5" />,
      active: fKind === 'PANEL',
      onClick: () => setFKind((v) => (v === 'PANEL' ? '' : 'PANEL')),
    },
    {
      label: 'Auto merge',
      value: stats.auto,
      icon: <Bot className="h-5 w-5" />,
      active: fKind === 'AUTO',
      onClick: () => setFKind((v) => (v === 'AUTO' ? '' : 'AUTO')),
    },
    {
      label: 'Not recorded',
      value: stats.unknown,
      icon: <HelpCircle className="h-5 w-5" />,
      active: fKind === 'UNKNOWN',
      onClick: () => setFKind((v) => (v === 'UNKNOWN' ? '' : 'UNKNOWN')),
    },
  ];

  return (
    <div className={`w-full max-w-none space-y-4 pb-8 ${padded ? 'px-3 pt-4 sm:px-6 sm:pt-6' : ''}`}>
      <div className="rounded-2xl bg-[#004AAD] px-4 py-4 text-white shadow-md sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Trash2 className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold leading-tight !text-white sm:text-2xl">Deleted Leads</h1>
              <p className="text-xs font-semibold text-blue-100">
                {canRestore
                  ? 'Who deleted what, and when — restore a lead to bring it back with its full history'
                  : 'Your leads that were deleted — who deleted them and when. Ask your manager to restore one.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 self-start rounded-xl bg-white px-3 text-xs font-bold text-[#023D95] sm:self-auto"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => {
          const clickable = Boolean(t.onClick);
          return (
            <button
              key={t.label}
              type="button"
              disabled={!clickable}
              onClick={t.onClick}
              className={`flex items-center justify-between gap-2 rounded-2xl border p-3 text-left shadow-sm transition ${
                t.active
                  ? 'border-[#004AAD] bg-[#004AAD] text-white'
                  : 'border-slate-100 bg-white text-slate-800'
              } ${clickable ? 'hover:border-[#004AAD]' : 'cursor-default'}`}
            >
              <div className="min-w-0">
                <div className={`text-[11px] font-bold uppercase tracking-wide ${t.active ? 'text-blue-100' : 'text-slate-500'}`}>
                  {t.label}
                </div>
                <div className="text-2xl font-black">{loading ? '…' : t.value}</div>
              </div>
              <span
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  t.active ? 'bg-white/15' : 'bg-blue-50 text-[#004AAD]'
                }`}
              >
                {t.icon}
              </span>
            </button>
          );
        })}
      </div>

      {stats.byPerson.length ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Deleted by</div>
          <div className="flex flex-wrap gap-1.5">
            {stats.byPerson.map(([name, count]) => (
              <button
                key={name}
                type="button"
                onClick={() => setFDeletedBy((v) => (v === name ? '' : name))}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                  fDeletedBy === name
                    ? 'border-[#004AAD] bg-[#004AAD] text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-[#004AAD]'
                }`}
              >
                {name}
                <span className={`rounded-md px-1.5 ${fDeletedBy === name ? 'bg-white/20' : 'bg-white text-slate-500'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-1.5">
            {WINDOWS.map((w) => (
              <button
                key={w.days}
                type="button"
                onClick={() => {
                  setDays(w.days);
                  setSearch('');
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  days === w.days && !debounced ? 'bg-[#004AAD] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:justify-end">
            <div className="relative min-w-0 flex-1 lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Phone, name, lead no, car no"
                className="h-10 w-full min-w-0 rounded-xl border border-slate-200 pl-9 pr-8 text-sm"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${
                showFilters || activeFilters
                  ? 'border-[#004AAD] bg-blue-50 text-[#023D95]'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <Filter className="h-4 w-4" /> Filters{activeFilters ? ` (${activeFilters})` : ''}
            </button>
          </div>
        </div>

        {showFilters ? (
          <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              label="Deleted by"
              value={fDeletedBy}
              onChange={setFDeletedBy}
              options={options.deletedBy.map((v) => ({ value: v, label: v }))}
            />
            <FilterSelect
              label="Delete type"
              value={fKind}
              onChange={setFKind}
              options={(Object.keys(KIND_LABEL) as Array<DeletedLeadRow['deleted_kind']>).map((k) => ({
                value: k,
                label: KIND_LABEL[k],
              }))}
            />
            <FilterSelect
              label="Restore"
              value={fRestorable}
              onChange={setFRestorable}
              options={[
                { value: 'yes', label: 'Can restore' },
                { value: 'no', label: 'Number has an open lead' },
              ]}
            />
            <FilterSelect
              label="Telecaller"
              value={fTelecaller}
              onChange={setFTelecaller}
              options={options.telecaller.map((v) => ({ value: v, label: v }))}
            />
            <FilterSelect
              label="Source"
              value={fSource}
              onChange={setFSource}
              options={options.source.map((v) => ({ value: v, label: v }))}
            />
            <FilterSelect
              label="Last status"
              value={fStatus}
              onChange={setFStatus}
              options={options.status.map((v) => ({ value: v, label: v }))}
            />
            <FilterSelect
              label="City"
              value={fCity}
              onChange={setFCity}
              options={options.city.map((v) => ({ value: v, label: v }))}
            />
            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                disabled={!activeFilters}
                className="h-10 w-full rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40"
              >
                Clear filters
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="px-1 text-xs font-semibold text-slate-500">
        {loading
          ? 'Loading…'
          : `${filtered.length} of ${rows.length} deleted lead${rows.length === 1 ? '' : 's'}`}
        {debounced ? ` matching “${debounced}” (all dates)` : ''}
      </div>

      {canRestore && selected.size ? (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 shadow-sm">
          <span className="text-sm font-bold text-emerald-800">{selected.size} selected</span>
          {selectedBlocked ? (
            <span className="text-xs font-semibold text-amber-700">
              {selectedBlocked} ha{selectedBlocked > 1 ? 've' : 's'} an open lead — will be skipped
            </span>
          ) : null}
          {selected.size < filtered.length ? (
            <button
              type="button"
              onClick={selectAllFiltered}
              disabled={bulkBusy}
              className="text-xs font-bold text-[#023D95] underline"
            >
              Select all {filtered.length}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void restoreSelected()}
            disabled={bulkBusy || !selectedRestorable.length}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
            Restore {selectedRestorable.length}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={bulkBusy}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-emerald-200 bg-white px-3 text-xs font-bold text-emerald-800 disabled:opacity-60"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          No deleted leads {debounced || activeFilters ? 'match these filters' : 'in this period'}.
        </div>
      ) : null}

      {filtered.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                {canRestore ? (
                <th className="w-10 py-2.5 pl-4 pr-1">
                  <input
                    type="checkbox"
                    aria-label="Select all leads on this page"
                    title="Select all on this page"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    disabled={!pageRows.length || bulkBusy}
                    onChange={toggleAll}
                    className="h-4 w-4 cursor-pointer accent-[#004AAD] disabled:cursor-not-allowed"
                  />
                </th>
                ) : null}
                <th className={`${canRestore ? 'px-3' : 'px-4'} py-2.5`}>Lead</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5">Car</th>
                <th className="px-3 py-2.5">Last status</th>
                <th className="px-3 py-2.5">Telecaller</th>
                <th className="px-3 py-2.5">Deleted on</th>
                <th className="px-3 py-2.5">Deleted by</th>
                <th className="px-4 py-2.5 text-right">{canRestore ? 'Action' : 'Open lead'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((r) => (
                <tr key={r.id} className={`align-top ${selected.has(r.id) ? 'bg-emerald-50/60' : ''}`}>
                  {canRestore ? (
                  <td className="py-2.5 pl-4 pr-1">
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.lead_number || 'lead'}`}
                      checked={selected.has(r.id)}
                      disabled={bulkBusy}
                      onChange={() => toggleOne(r.id)}
                      className="mt-0.5 h-4 w-4 cursor-pointer accent-[#004AAD] disabled:cursor-not-allowed"
                    />
                  </td>
                  ) : null}
                  <td className={`${canRestore ? 'px-3' : 'px-4'} py-2.5`}>
                    <div className="font-bold text-slate-800">{r.lead_number || '—'}</div>
                    <div className="text-xs text-slate-500">{r.lead_source || '—'}</div>
                    <div className="text-[11px] text-slate-400">Created {fmtDateTime(r.created_at)}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-slate-800">{r.customer_name || '—'}</div>
                    <div className="text-xs text-slate-600">{r.customer_phone || '—'}</div>
                    {r.city ? <div className="text-[11px] text-slate-400">{r.city}</div> : null}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-700">{r.vehicle || '—'}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-slate-700">{r.status_label}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-700">{r.telecaller || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-slate-800">
                    {fmtDateTime(r.deleted_at)}
                  </td>
                  <td className="max-w-[240px] px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-bold ${kindTone(r.deleted_kind)}`}
                    >
                      {r.deleted_by}
                    </span>
                    {r.deleted_by_role && r.deleted_by_role !== 'SYSTEM' ? (
                      <div className="mt-0.5 text-[11px] text-slate-400">{r.deleted_by_role.replace(/_/g, ' ')}</div>
                    ) : null}
                    {r.deleted_reason ? <div className="mt-0.5 text-[11px] text-slate-500">{r.deleted_reason}</div> : null}
                    {r.merged_into ? (
                      <div className="mt-0.5 text-[11px] text-slate-500">Merged into {r.merged_into}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.active_lead ? (
                      <div className="text-[11px] font-semibold text-amber-700">
                        Number has open lead
                        <br />
                        <Link href={leadHref(r.active_lead)} className="whitespace-nowrap underline">
                          {r.active_lead.lead_number || 'Open lead'}
                        </Link>
                      </div>
                    ) : !canRestore ? (
                      <span className="text-[11px] font-semibold text-slate-400">—</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void restore(r)}
                        disabled={restoringId === r.id}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {restoringId === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArchiveRestore className="h-4 w-4" />
                        )}
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs font-semibold text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span>
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
              </span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold"
                aria-label="Rows per page"
              >
                {[25, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="h-8 rounded-lg border border-slate-200 px-2.5 disabled:opacity-40"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 rounded-lg border border-slate-200 px-2.5 disabled:opacity-40"
              >
                Prev
              </button>
              {pageNumbers(page, pageCount).map((n, i) =>
                n === null ? (
                  <span key={`gap-${i}`} className="px-1 text-slate-400">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`h-8 min-w-8 rounded-lg px-2.5 ${
                      n === page ? 'bg-[#004AAD] text-white' : 'border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {n}
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                className="h-8 rounded-lg border border-slate-200 px-2.5 disabled:opacity-40"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => setPage(pageCount)}
                disabled={page >= pageCount}
                className="h-8 rounded-lg border border-slate-200 px-2.5 disabled:opacity-40"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
