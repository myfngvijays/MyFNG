'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Car, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import CrmCarSearch, { type CrmCarSelection } from '@/components/telecaller/crm/CrmCarSearch';

export const FUEL_OPTIONS = [
  { value: 'PETROL', label: 'Petrol' },
  { value: 'DIESEL', label: 'Diesel' },
  { value: 'CNG', label: 'CNG' },
  { value: 'ELECTRIC', label: 'Electric' },
  { value: 'HYBRID', label: 'Hybrid' },
] as const;

export const EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'rediffmail.com',
] as const;

export type CityOption = { id: string; name: string; state?: string | null };

export function parseAddressParts(
  raw: string,
  meta: Record<string, unknown> | null | undefined,
): { flat_number: string; area: string; landmark: string } {
  if (meta && typeof meta === 'object') {
    const flat = String(meta.flat_number || '').trim();
    const area = String(meta.area || meta.pickup_address || '').trim();
    const landmark = String(meta.landmark || '')
      .replace(/^Near\s+/i, '')
      .trim();
    if (flat || area || landmark) return { flat_number: flat, area, landmark };
  }
  const parts = String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return { flat_number: '', area: '', landmark: '' };
  if (parts.length === 1) return { flat_number: '', area: parts[0], landmark: '' };
  const landmarkPart = parts.find((p) => /^near\s+/i.test(p));
  const landmark = landmarkPart ? landmarkPart.replace(/^Near\s+/i, '').trim() : '';
  const withoutLandmark = parts.filter((p) => p !== landmarkPart);
  const maybeCityPin = withoutLandmark[withoutLandmark.length - 1] || '';
  const rest =
    /\d{6}/.test(maybeCityPin) && withoutLandmark.length > 1
      ? withoutLandmark.slice(0, -1)
      : withoutLandmark;
  if (rest.length === 1) return { flat_number: '', area: rest[0], landmark };
  return {
    flat_number: rest[0] || '',
    area: rest.slice(1).join(', '),
    landmark,
  };
}

export function useServiceCities() {
  const [cities, setCities] = useState<CityOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('cities')
          .select('id, name, state')
          .eq('is_active', true)
          .order('name', { ascending: true })
          .limit(500);
        if (!cancelled) {
          setCities(
            (data || []).map((c: any) => ({
              id: String(c.id),
              name: String(c.name || ''),
              state: c.state ? String(c.state) : null,
            })),
          );
        }
      } catch {
        if (!cancelled) setCities([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return cities;
}

type PatchFn = (patch: Record<string, unknown>) => Promise<void>;

const shell =
  'rounded-md border border-gray-200/80 bg-white px-2.5 py-1.5 hover:border-indigo-300 hover:bg-indigo-50/40';
const labelCls = 'text-[10px] font-semibold uppercase tracking-wide text-gray-500 leading-tight';
const inputCls =
  'w-full rounded border border-indigo-200 bg-white px-1.5 py-1 text-[13px] text-gray-900 focus:outline-none';

function FieldShell({
  label,
  className = '',
  children,
  editing,
}: {
  label: string;
  className?: string;
  children: ReactNode;
  editing?: boolean;
}) {
  return (
    <div
      className={`${shell} ${editing ? 'ring-2 ring-indigo-300 border-indigo-300' : ''} ${className}`}
    >
      <p className={labelCls}>{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

export function InlineTextField({
  label,
  field,
  value,
  onPatch,
  className,
  multiline,
  placeholder,
}: {
  label: string;
  field: string;
  value: unknown;
  onPatch: PatchFn;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const raw = value == null || value === '' ? '' : String(value);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = async () => {
    if (busy) return;
    if (draft === raw) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onPatch({ [field]: draft });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FieldShell label={label} className={className} editing={editing}>
      {editing ? (
        multiline ? (
          <textarea
            ref={(el) => {
              ref.current = el;
            }}
            rows={3}
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false);
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void commit();
              }
            }}
            className={inputCls}
            placeholder={placeholder}
          />
        ) : (
          <input
            ref={(el) => {
              ref.current = el;
            }}
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false);
              if (e.key === 'Enter') {
                e.preventDefault();
                void commit();
              }
            }}
            className={inputCls}
            placeholder={placeholder}
          />
        )
      ) : (
        <button
          type="button"
          className={`w-full text-left text-[13px] leading-snug break-words ${
            raw ? 'text-gray-900' : 'text-indigo-400 italic'
          }`}
          onClick={() => {
            setDraft(raw);
            setEditing(true);
          }}
        >
          {raw || 'Empty'}
        </button>
      )}
      {busy ? <p className="text-[10px] text-indigo-600">Saving…</p> : null}
    </FieldShell>
  );
}

export function InlineYearField({
  label,
  value,
  onPatch,
  className,
}: {
  label: string;
  value: unknown;
  onPatch: PatchFn;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);
  const raw = value == null || value === '' ? '' : String(value).replace(/\D/g, '').slice(0, 4);
  const maxYear = new Date().getFullYear() + 1;

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = async () => {
    if (busy) return;
    const y = draft.replace(/\D/g, '').slice(0, 4);
    if (y && (y.length !== 4 || Number(y) < 1980 || Number(y) > maxYear)) {
      setDraft(raw);
      setEditing(false);
      return;
    }
    if (y === raw) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onPatch({ vehicle_year: y ? Number(y) : null });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FieldShell label={label} className={className} editing={editing}>
      {editing ? (
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={draft}
          disabled={busy}
          placeholder="e.g. 2019"
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
            if (e.key === 'Enter') {
              e.preventDefault();
              void commit();
            }
          }}
          className={inputCls}
        />
      ) : (
        <button
          type="button"
          className={`w-full text-left text-[13px] ${raw ? 'text-gray-900' : 'text-indigo-400 italic'}`}
          onClick={() => {
            setDraft(raw);
            setEditing(true);
          }}
        >
          {raw || 'Empty'}
        </button>
      )}
    </FieldShell>
  );
}

export function InlineEmailField({
  label,
  value,
  onPatch,
  className,
}: {
  label: string;
  value: unknown;
  onPatch: PatchFn;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);
  const raw = value == null || value === '' ? '' : String(value);

  const suggestions = useMemo(() => {
    const at = draft.indexOf('@');
    if (at < 0) return [] as string[];
    const local = draft.slice(0, at);
    const domainPart = draft.slice(at + 1).toLowerCase();
    if (!local) return [];
    return EMAIL_DOMAINS.filter((d) => d.startsWith(domainPart))
      .slice(0, 5)
      .map((d) => `${local}@${d}`);
  }, [draft]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = async (next = draft) => {
    if (busy) return;
    if (next === raw) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onPatch({ customer_email: next.trim() || null });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FieldShell label={label} className={`relative ${className || ''}`} editing={editing}>
      {editing ? (
        <>
          <input
            ref={ref}
            type="email"
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              // delay so suggestion click can fire
              window.setTimeout(() => void commit(), 120);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false);
              if (e.key === 'Enter') {
                e.preventDefault();
                void commit();
              }
            }}
            className={inputCls}
            placeholder="name@gmail.com"
          />
          {suggestions.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-indigo-200 bg-white shadow-lg">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="block w-full px-2.5 py-1.5 text-left text-xs font-medium text-slate-800 hover:bg-indigo-50"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDraft(s);
                    void commit(s);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <button
          type="button"
          className={`w-full text-left text-[13px] ${raw ? 'text-gray-900' : 'text-indigo-400 italic'}`}
          onClick={() => {
            setDraft(raw);
            setEditing(true);
          }}
        >
          {raw || 'Empty'}
        </button>
      )}
    </FieldShell>
  );
}

export function InlineSelectField({
  label,
  field,
  value,
  options,
  onPatch,
  className,
}: {
  label: string;
  field: string;
  value: unknown;
  options: Array<{ value: string; label: string }>;
  onPatch: PatchFn;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const raw = value == null || value === '' ? '' : String(value);
  const display = options.find((o) => o.value.toUpperCase() === raw.toUpperCase())?.label || raw;

  const commit = async (next: string) => {
    if (busy) return;
    if (next === raw) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onPatch({ [field]: next || null });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FieldShell label={label} className={className} editing={editing}>
      {editing ? (
        <select
          autoFocus
          disabled={busy}
          defaultValue={raw}
          onBlur={(e) => void commit(e.target.value)}
          onChange={(e) => void commit(e.target.value)}
          className={inputCls}
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <button
          type="button"
          className={`w-full text-left text-[13px] ${display ? 'text-gray-900' : 'text-indigo-400 italic'}`}
          onClick={() => setEditing(true)}
        >
          {display || 'Empty'}
        </button>
      )}
    </FieldShell>
  );
}

export function InlineCityField({
  label,
  value,
  cityId,
  cities,
  onPatch,
  className,
}: {
  label: string;
  value: unknown;
  cityId?: string | null;
  cities: CityOption[];
  onPatch: PatchFn;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const raw = value == null || value === '' ? '' : String(value);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return cities.slice(0, 40);
    return cities.filter((c) => c.name.toLowerCase().includes(needle)).slice(0, 40);
  }, [cities, q]);

  useEffect(() => {
    if (!editing) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setEditing(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [editing]);

  const pick = async (c: CityOption) => {
    setBusy(true);
    try {
      await onPatch({ city: c.name, city_id: c.id });
      setEditing(false);
      setQ('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className || ''}`}>
      <FieldShell label={label} editing={editing}>
        {editing ? (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={q}
                disabled={busy}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search city…"
                className={`${inputCls} pl-7`}
              />
            </div>
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-indigo-200 bg-white shadow-lg">
              {filtered.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-slate-400">No cities</p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`block w-full px-2.5 py-1.5 text-left text-xs hover:bg-indigo-50 ${
                      c.id === cityId || c.name === raw ? 'bg-indigo-50 font-semibold text-indigo-900' : 'text-slate-800'
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      void pick(c);
                    }}
                  >
                    {c.name}
                    {c.state ? <span className="text-slate-400"> · {c.state}</span> : null}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            className={`w-full text-left text-[13px] ${raw ? 'text-gray-900' : 'text-indigo-400 italic'}`}
            onClick={() => {
              setQ('');
              setEditing(true);
            }}
          >
            {raw || 'Empty'}
          </button>
        )}
      </FieldShell>
    </div>
  );
}

export function InlineCarField({
  label,
  make,
  model,
  onPatch,
  className,
}: {
  label: string;
  make: unknown;
  model: unknown;
  onPatch: PatchFn;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const display = [make, model].filter(Boolean).join(' ');

  return (
    <FieldShell label={label} className={className} editing={editing}>
      {editing ? (
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          <CrmCarSearch
            label=""
            placeholder="Type model (e.g. Rapid, Swift)"
            displayValue={display}
            onSelect={async (car: CrmCarSelection) => {
              await onPatch({
                vehicle_make: car.make,
                vehicle_model: car.model,
                model_id: car.id,
                vehicle_variant: car.variant || '',
              });
              setEditing(false);
            }}
            onClear={() => {
              void onPatch({
                vehicle_make: '',
                vehicle_model: '',
                model_id: null,
              });
            }}
          />
          <button
            type="button"
            className="mt-1 text-[10px] font-semibold text-slate-500 hover:text-slate-700"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`flex w-full items-center gap-1.5 text-left text-[13px] ${
            display ? 'text-gray-900' : 'text-indigo-400 italic'
          }`}
          onClick={() => setEditing(true)}
        >
          <Car className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          {display || 'Empty — search model'}
        </button>
      )}
    </FieldShell>
  );
}

export function InlineDateField({
  label,
  field,
  value,
  onPatch,
  className,
}: {
  label: string;
  field: string;
  value: unknown;
  onPatch: PatchFn;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const raw = value == null || value === '' ? '' : String(value).slice(0, 10);

  const commit = async (next: string) => {
    if (busy) return;
    if (next === raw) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onPatch({ [field]: next || null });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FieldShell label={label} className={className} editing={editing}>
      {editing ? (
        <input
          type="date"
          autoFocus
          disabled={busy}
          defaultValue={raw}
          onBlur={(e) => void commit(e.target.value)}
          onChange={(e) => void commit(e.target.value)}
          className={inputCls}
        />
      ) : (
        <button
          type="button"
          className={`w-full text-left text-[13px] ${raw ? 'text-gray-900' : 'text-indigo-400 italic'}`}
          onClick={() => setEditing(true)}
        >
          {raw || 'Empty'}
        </button>
      )}
    </FieldShell>
  );
}

export function InlineTimeField({
  label,
  field,
  value,
  onPatch,
  className,
}: {
  label: string;
  field: string;
  value: unknown;
  onPatch: PatchFn;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const raw = value == null || value === '' ? '' : String(value).slice(0, 5);

  const commit = async (next: string) => {
    if (busy) return;
    if (next === raw) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onPatch({ [field]: next || null });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FieldShell label={label} className={className} editing={editing}>
      {editing ? (
        <input
          type="time"
          autoFocus
          disabled={busy}
          defaultValue={raw}
          onBlur={(e) => void commit(e.target.value)}
          onChange={(e) => void commit(e.target.value)}
          className={inputCls}
        />
      ) : (
        <button
          type="button"
          className={`w-full text-left text-[13px] ${raw ? 'text-gray-900' : 'text-indigo-400 italic'}`}
          onClick={() => setEditing(true)}
        >
          {raw || 'Empty'}
        </button>
      )}
    </FieldShell>
  );
}

export function InlineBooleanField({
  label,
  field,
  value,
  onPatch,
  className,
}: {
  label: string;
  field: string;
  value: unknown;
  onPatch: PatchFn;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const boolVal = value === true || value === 'true' || value === 'Yes' || value === 1;

  const commit = async (next: boolean) => {
    if (busy) return;
    if (next === boolVal) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onPatch({ [field]: next });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FieldShell label={label} className={className} editing={editing}>
      {editing ? (
        <select
          autoFocus
          disabled={busy}
          defaultValue={boolVal ? 'true' : 'false'}
          onBlur={(e) => void commit(e.target.value === 'true')}
          onChange={(e) => void commit(e.target.value === 'true')}
          className={inputCls}
        >
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      ) : (
        <button type="button" className="w-full text-left text-[13px] text-gray-900" onClick={() => setEditing(true)}>
          {boolVal ? 'Yes' : 'No'}
        </button>
      )}
    </FieldShell>
  );
}
