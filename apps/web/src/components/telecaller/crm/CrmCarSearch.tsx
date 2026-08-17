'use client';

import { useEffect, useRef, useState } from 'react';
import { Car, Search, X } from 'lucide-react';

export type CrmCarSelection = {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  vehicleClass: string | null;
};

type Props = {
  label?: string;
  placeholder?: string;
  displayValue?: string;
  onSelect: (car: CrmCarSelection) => void;
  onClear?: () => void;
};

export default function CrmCarSearch({
  label = 'Select Car Model',
  placeholder = 'Enter model (e.g. Rapid, Swift, City)',
  displayValue = '',
  onSelect,
  onClear,
}: Props) {
  const [query, setQuery] = useState(displayValue);
  const [suggestions, setSuggestions] = useState<CrmCarSelection[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(displayValue);
  }, [displayValue]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || q === displayValue) {
      if (q.length < 2) setSuggestions([]);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/car-models/search?q=${encodeURIComponent(q)}`);
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const models = Array.isArray(json?.models) ? json.models : [];
        setSuggestions(
          models.map((m: any) => ({
            id: String(m.id),
            make: String(m.make || ''),
            model: String(m.model || m.model_name || ''),
            variant: m.variant ? String(m.variant) : null,
            vehicleClass: m.vehicleClass ?? m.class ?? null,
          })),
        );
        setOpen(true);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, displayValue]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (car: CrmCarSelection) => {
    const labelText = [car.make, car.model].filter(Boolean).join(' ');
    setQuery(labelText);
    setOpen(false);
    onSelect(car);
  };

  const clear = () => {
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    onClear?.();
  };

  return (
    <div ref={wrapRef}>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#004AAD] focus:outline-none focus:ring-2 focus:ring-[#004AAD]/20"
        />
        {query ? (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Clear car selection"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-2 text-xs text-gray-500">Searching models…</p>
      ) : null}

      {open && suggestions.length > 0 ? (
        <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-[#023D95]/20 bg-[#023D95] shadow-lg">
          {suggestions.map((car) => (
            <button
              key={car.id}
              type="button"
              onClick={() => pick(car)}
              className="flex w-full items-center gap-2 border-b border-white/10 px-3 py-2.5 text-left last:border-0 hover:bg-white/10"
            >
              <Car className="h-4 w-4 shrink-0 text-white/80" />
              <span className="text-sm font-semibold text-white">
                {[car.make, car.model].filter(Boolean).join(' ')}
                {car.vehicleClass ? (
                  <span className="ml-1 text-xs font-normal text-white/70">({car.vehicleClass})</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
