'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { CalendarCheck, Check, ChevronDown, Download, FileSpreadsheet, FileText, Filter, Loader2, RefreshCw, Search, X } from 'lucide-react';

export type BookingConfirmedRow = {
  id: string;
  lead_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  area: string | null;
  vehicle_number: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_class: string | null;
  package: string | null;
  amount: number | null;
  workshop: string | null;
  visit_type: string;
  preferred_slot: string | null;
  telecaller: string | null;
  confirmed_by: string | null;
  remark: string | null;
  note: string | null;
  city: string | null;
  current_status: string;
  on_sheet: boolean;
  confirmed_at: string;
};

type Preset = 'today' | 'yesterday' | '7d' | 'month' | 'custom';

const PRESETS: Array<{ id: Preset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

/** YYYY-MM-DD for an IST calendar day, `offset` days from today. */
export function istYmd(offset = 0): string {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

function presetRange(preset: Preset, customFrom: string, customTo: string) {
  const today = istYmd();
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'yesterday') return { from: istYmd(-1), to: istYmd(-1) };
  if (preset === '7d') return { from: istYmd(-6), to: today };
  if (preset === 'month') return { from: `${today.slice(0, 8)}01`, to: today };
  return { from: customFrom || today, to: customTo || customFrom || today };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function statusTone(status: string) {
  if (status === 'Service Done') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'In Service') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (status === 'Lost') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-teal-50 text-teal-700 border-teal-200';
}

function csvCell(v: unknown) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function BookingConfirmedPanel({
  leadHref,
}: {
  /** Where a customer name links to (role-specific lead page). */
  leadHref: (row: BookingConfirmedRow) => string;
}) {
  const [preset, setPreset] = useState<Preset>('today');
  const [customFrom, setCustomFrom] = useState(istYmd());
  const [customTo, setCustomTo] = useState(istYmd());
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [rows, setRows] = useState<BookingConfirmedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Advanced filters (applied on the loaded date range).
  const [showFilters, setShowFilters] = useState(false);
  const [fTelecaller, setFTelecaller] = useState('');
  const [fWorkshop, setFWorkshop] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fVisit, setFVisit] = useState('');
  const [fCity, setFCity] = useState('');
  const [fHasNote, setFHasNote] = useState(false);

  const range = useMemo(() => presetRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Searching looks across all dates; the date chips apply only when the search box is empty.
      const params = new URLSearchParams({ limit: '2000' });
      if (debounced) params.set('q', debounced);
      else {
        params.set('from', range.from);
        params.set('to', range.to);
      }
      const res = await fetch(`/api/crm/booking-confirmed?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not load bookings');
      setRows(Array.isArray(json.leads) ? json.leads : []);
      setTotal(Number(json.total || 0));
    } catch (e: any) {
      setError(e?.message || 'Could not load bookings');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const options = useMemo(() => {
    const uniq = (pick: (r: BookingConfirmedRow) => string | null | undefined) =>
      Array.from(new Set(rows.map(pick).map((v) => String(v || '').trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      );
    return {
      telecaller: uniq((r) => r.telecaller),
      workshop: uniq((r) => r.workshop),
      status: uniq((r) => r.current_status),
      city: uniq((r) => r.city),
    };
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (fTelecaller && (r.telecaller || '') !== fTelecaller) return false;
        if (fWorkshop && (r.workshop || '') !== fWorkshop) return false;
        if (fStatus && r.current_status !== fStatus) return false;
        if (fVisit && r.visit_type !== fVisit) return false;
        if (fCity && (r.city || '') !== fCity) return false;
        if (fHasNote && !String(r.remark || r.note || '').trim()) return false;
        return true;
      }),
    [rows, fTelecaller, fWorkshop, fStatus, fVisit, fCity, fHasNote],
  );
  const activeFilters = [fTelecaller, fWorkshop, fStatus, fVisit, fCity].filter(Boolean).length + (fHasNote ? 1 : 0);
  const clearFilters = () => {
    setFTelecaller('');
    setFWorkshop('');
    setFStatus('');
    setFVisit('');
    setFCity('');
    setFHasNote(false);
  };

  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.current_status, (m.get(r.current_status) || 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const [exportOpen, setExportOpen] = useState(false);

  const exportRows = (format: 'csv' | 'xlsx') => {
    setExportOpen(false);
    const header = [
      'Confirmed date', 'Confirmed time', 'Name', 'Number', 'Lead no', 'Address', 'Area', 'Car no', 'Make', 'Model',
      'Class', 'Package', 'Amount', 'Workshop', 'Visit/Pickup', 'Telecaller', 'Confirmed by', 'Telecaller remark',
      'Note', 'Current status',
    ];
    const data = filtered.map((r) => [
      fmtDate(r.confirmed_at), fmtTime(r.confirmed_at), r.customer_name || '', r.customer_phone || '',
      r.lead_number || '', r.address || '', r.area || '', r.vehicle_number || '', r.vehicle_make || '',
      r.vehicle_model || '', r.vehicle_class || '', r.package || '', r.amount ?? '', r.workshop || '', r.visit_type,
      r.telecaller || '', r.confirmed_by || '', r.remark || '', r.note || '', r.current_status,
    ]);
    const base = `booking-confirmed-${range.from}${range.to !== range.from ? `-to-${range.to}` : ''}`;

    if (format === 'xlsx') {
      void (async () => {
        const XLSX = await import('xlsx');
        const sheet = XLSX.utils.aoa_to_sheet([header, ...data]);
        // Readable column widths in Excel.
        sheet['!cols'] = header.map((h, i) => ({
          wch: Math.min(45, Math.max(h.length, ...data.map((row) => String(row[i] ?? '').length)) + 2),
        }));
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheet, 'Booking Confirmed');
        XLSX.writeFile(book, `${base}.xlsx`);
      })();
      return;
    }

    const csv = [header, ...data].map((row) => row.map(csvCell).join(',')).join('\n');
    // BOM so Excel opens the CSV as UTF-8 (₹, names in Hindi/Marathi stay readable).
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-none space-y-4 pb-8">
      <div className="rounded-2xl bg-[#004AAD] px-4 py-4 text-white shadow-md sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <CalendarCheck className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold leading-tight !text-white sm:text-2xl">Booking Confirmed</h1>
              <p className="text-xs font-semibold text-blue-100">
                Leads marked “Booking confirmed” — same list that goes to the Today send lead sheet
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-[#023D95]"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportOpen((v) => !v)}
                onBlur={() => setTimeout(() => setExportOpen(false), 150)}
                disabled={!filtered.length}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-[#023D95] disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Export <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {exportOpen ? (
                <div className="absolute right-0 top-full z-30 mt-1.5 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-slate-800 shadow-xl">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exportRows('xlsx')}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-700" /> Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exportRows('csv')}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50"
                  >
                    <FileText className="h-4 w-4 text-slate-500" /> CSV (.csv)
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPreset(p.id);
                setSearch('');
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                preset === p.id && !debounced
                  ? 'bg-[#004AAD] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' ? (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5"
            />
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold lg:ml-auto ${
            showFilters || activeFilters ? 'bg-[#004AAD] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Filter className="h-3.5 w-3.5" /> Filters{activeFilters ? ` (${activeFilters})` : ''}
        </button>
        <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all dates: name, phone, car…"
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-[#004AAD] focus:outline-none"
          />
        </div>
      </div>

      {showFilters ? (
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
          <FilterSelect label="Telecaller" value={fTelecaller} onChange={setFTelecaller} options={options.telecaller} />
          <FilterSelect label="Workshop" value={fWorkshop} onChange={setFWorkshop} options={options.workshop} />
          <FilterSelect label="Status now" value={fStatus} onChange={setFStatus} options={options.status} />
          <FilterSelect label="Visit / Pickup" value={fVisit} onChange={setFVisit} options={['Visit', 'Pickup']} />
          <FilterSelect label="City" value={fCity} onChange={setFCity} options={options.city} />
          <div className="flex items-end gap-2">
            <label className="flex h-[38px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={fHasNote} onChange={(e) => setFHasNote(e.target.checked)} />
              Has note
            </label>
            <button
              type="button"
              onClick={clearFilters}
              disabled={!activeFilters}
              className="inline-flex h-[38px] items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <span className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-800">
          {activeFilters ? `${filtered.length} of ${total}` : total} booking{total === 1 ? '' : 's'} confirmed
          {debounced ? <span className="font-semibold text-teal-700"> · search in all dates</span> : null}
        </span>
        {byStatus.map(([label, count]) => (
          <span key={label} className={`rounded-xl border px-3 py-2 text-xs font-bold ${statusTone(label)}`}>
            Now {label}: {count}
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading bookings…
          </div>
        ) : error ? (
          <p className="py-16 text-center text-sm font-semibold text-rose-600">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">
            {rows.length ? 'No booking matches these filters.' : 'No booking confirmed in this date range.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1540px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[110px]" />
                <col className="w-[160px]" />
                <col className="w-[120px]" />
                <col className="w-[130px]" />
                <col className="w-[170px]" />
                <col className="w-[220px]" />
                <col className="w-[150px]" />
                <col className="w-[190px]" />
                <col className="w-[70px]" />
                <col className="w-[110px]" />
                <col className="w-[260px]" />
                <col className="w-[190px]" />
              </colgroup>
              <thead className="bg-[#004AAD] text-xs uppercase tracking-wide text-white">
                <tr>
                  <th className="px-3 py-2.5 font-bold">Confirmed</th>
                  <th className="px-3 py-2.5 font-bold">Name</th>
                  <th className="px-3 py-2.5 font-bold">Number</th>
                  <th className="px-3 py-2.5 font-bold">Lead no.</th>
                  <th className="px-3 py-2.5 font-bold">Car</th>
                  <th className="px-3 py-2.5 font-bold">Address</th>
                  <th className="px-3 py-2.5 font-bold">Workshop</th>
                  <th className="px-3 py-2.5 font-bold">Package</th>
                  <th className="px-3 py-2.5 font-bold">Visit</th>
                  <th className="px-3 py-2.5 font-bold">Telecaller</th>
                  <th className="px-3 py-2.5 font-bold">Note</th>
                  <th className="px-3 py-2.5 font-bold">Status now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const car = [r.vehicle_make, r.vehicle_model].filter(Boolean).join(' ');
                  const carSub = [r.vehicle_number && r.vehicle_number !== 'NA' ? r.vehicle_number : null, r.vehicle_class]
                    .filter(Boolean)
                    .join(' · ');
                  const note = [r.remark, r.note && r.note !== r.remark ? `Note: ${r.note}` : null].filter(Boolean).join('\n');
                  return (
                    // Every cell is one or two fixed lines (truncated, full text on hover) → same row height.
                    <tr key={r.id} className="h-[60px] hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <p className="truncate text-xs font-bold text-slate-800">{fmtDate(r.confirmed_at)}</p>
                        <p className="truncate text-xs text-slate-500">{fmtTime(r.confirmed_at)}</p>
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={leadHref(r)}
                          title={r.customer_name || ''}
                          className="block truncate font-bold text-slate-900 hover:text-[#004AAD] hover:underline"
                        >
                          {r.customer_name || 'Unnamed'}
                        </Link>
                      </td>
                      <td className="truncate px-3 py-2 text-xs font-semibold text-slate-700">{r.customer_phone || '—'}</td>
                      <td className="truncate px-3 py-2 text-xs text-slate-600">{r.lead_number || '—'}</td>
                      <td className="px-3 py-2">
                        <p className="truncate font-semibold text-slate-800" title={car}>{car || '—'}</p>
                        <p className="truncate text-xs text-slate-500" title={carSub}>{carSub || '\u00a0'}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        <p className="line-clamp-2" title={r.address || r.area || ''}>{r.address || r.area || '—'}</p>
                      </td>
                      <td className="truncate px-3 py-2 text-xs font-semibold text-slate-700" title={r.workshop || ''}>
                        {r.workshop || '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        <p className="truncate" title={r.package || ''}>{r.package || '—'}</p>
                        <p className="truncate font-bold text-slate-900">
                          {r.amount ? `₹${Number(r.amount).toLocaleString('en-IN')}` : '\u00a0'}
                        </p>
                      </td>
                      <td className="truncate px-3 py-2 text-xs font-semibold text-slate-700">{r.visit_type}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        <p className="truncate font-semibold" title={r.telecaller || ''}>{r.telecaller || '—'}</p>
                        <p className="truncate text-slate-500">
                          {r.confirmed_by && r.confirmed_by !== r.telecaller ? `by ${r.confirmed_by}` : '\u00a0'}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        <p className="line-clamp-2 whitespace-pre-line" title={note}>{note || '—'}</p>
                      </td>
                      <td className="px-3 py-2">
                        <StatusMenu
                          row={r}
                          onChanged={(label) =>
                            setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, current_status: label } : x)))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
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
  options: string[];
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[38px] w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:border-[#004AAD] focus:outline-none"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Next steps after Booking confirmed, in pipeline order. */
const NEXT_STEPS: Array<{ id: 'IN_SERVICE' | 'SERVICE_DONE'; label: string; leadStatus: string }> = [
  { id: 'IN_SERVICE', label: 'In Service', leadStatus: 'IN_PROGRESS' },
  { id: 'SERVICE_DONE', label: 'Service Done', leadStatus: 'COMPLETED' },
];

function nextStepsFor(current: string) {
  if (current === 'Booking confirmed') return NEXT_STEPS;
  if (current === 'In Service') return NEXT_STEPS.filter((s) => s.id === 'SERVICE_DONE');
  return [];
}

/** Status badge; click it to move the lead on to In Service / Service Done right from this list. */
function StatusMenu({ row, onChanged }: { row: BookingConfirmedRow; onChanged: (label: string) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const steps = nextStepsFor(row.current_status);
  // Step waiting for confirmation in the popup (Service Done also asks for its date).
  const [pending, setPending] = useState<(typeof NEXT_STEPS)[number] | null>(null);
  const todayYmd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const [doneDate, setDoneDate] = useState(todayYmd);


  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const badge = (
    <span
      className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border pl-2.5 text-[11px] font-bold ${
        steps.length ? 'pr-1.5' : 'pr-2.5'
      } ${statusTone(row.current_status)}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden />
      {row.current_status}
      {saving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : steps.length ? (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/80">
          <ChevronDown className="h-3 w-3" />
        </span>
      ) : null}
    </span>
  );
  if (!steps.length) return badge;

  const move = async (step: (typeof NEXT_STEPS)[number], serviceDoneDate?: string) => {
    setPending(null);
    setSaving(true);
    try {
      const now = new Date();
      const coupon_meta: Record<string, unknown> = {
        last_call_result: step.id,
        last_call_label: step.label,
        last_call_at: now.toISOString(),
      };
      if (step.id === 'SERVICE_DONE') {
        coupon_meta.service_done_at = serviceDoneDate || todayYmd;
      }
      const res = await fetch(`/api/telecaller/leads/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disposition_only: true,
          status: step.leadStatus,
          coupon_meta,
          history_entry: {
            status: step.id,
            previous_label: row.current_status,
            summary:
              step.id === 'SERVICE_DONE'
                ? `Status: ${row.current_status} → ${step.label}\nService done date: ${serviceDoneDate || todayYmd}`
                : `Status: ${row.current_status} → ${step.label}`,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not update status');
      onChanged(step.label);
      toast.success(`${row.customer_name || 'Lead'} → ${step.label}`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not update status');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={saving}
        onClick={() => {
          const rect = btnRef.current?.getBoundingClientRect();
          if (rect) setPos({ top: rect.bottom + 6, left: Math.max(8, rect.right - 176) });
          setOpen((v) => !v);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        title="Change status"
        className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004AAD]"
      >
        {badge}
      </button>
      {open && pos
        ? createPortal(
            // Portal: the table scrolls sideways, which would clip a normal dropdown.
            <div
              style={{ top: pos.top, left: pos.left }}
              className="fixed z-[90] w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
            >
              <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Move to</p>
              {steps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setOpen(false);
                    setDoneDate(todayYmd);
                    setPending(step);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Check className={`h-4 w-4 ${step.id === 'SERVICE_DONE' ? 'text-emerald-600' : 'text-sky-600'}`} />
                  {step.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
      {pending
        ? createPortal(
            <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setPending(null)}>
              <div
                role="dialog"
                aria-modal="true"
                className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-base font-black text-slate-900">Mark as {pending.label}?</p>
                <p className="mt-1 text-sm text-slate-600">
                  {row.customer_name || 'This lead'}
                  {row.vehicle_model ? ` · ${[row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ')}` : ''}
                </p>
                {pending.id === 'SERVICE_DONE' ? (
                  <label className="mt-4 block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Service done date
                    </span>
                    <input
                      type="date"
                      value={doneDate}
                      max={todayYmd}
                      onChange={(e) => setDoneDate(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#004AAD] focus:outline-none"
                    />
                  </label>
                ) : null}
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPending(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pending.id === 'SERVICE_DONE' && !doneDate}
                    onClick={() => void move(pending, pending.id === 'SERVICE_DONE' ? doneDate : undefined)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${
                      pending.id === 'SERVICE_DONE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-sky-600 hover:bg-sky-700'
                    }`}
                  >
                    Mark {pending.label}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
