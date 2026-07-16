'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Car, Search } from 'lucide-react';

type CarModel = {
  id: string;
  make: string;
  model: string;
  variant?: string | null;
};

type Props = {
  onSelect: (message: string, label: string) => void;
};

export function assistantAsksForCar(text: string): boolean {
  const t = String(text || '').toLowerCase();
  return /which car|car do you have|car model|aapki car|gaadi|gadi|vehicle model|kon si car/i.test(t);
}

export function MisaCarPicker({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CarModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/car-models/search?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        setSuggestions(Array.isArray(json?.models) ? json.models : []);
        setOpen(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(car: CarModel) {
    const label = `${car.make} ${car.model}${car.variant ? ` ${car.variant}` : ''}`.trim();
    onSelect(label, label);
    setQuery(label);
    setOpen(false);
  }

  return (
    <div className="mb-4 pl-10">
      <div ref={wrapRef} className="rounded-2xl border border-brand-primary/15 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-2.5 flex items-center gap-2">
          <Car className="h-4 w-4 text-brand-primary" />
          <p className="text-sm font-semibold text-brand-secondary">Select your car</p>
        </div>

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
            placeholder="Search model (Swift, City, WagonR…)"
            className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>

        {open && suggestions.length > 0 && (
          <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-brand-secondary/20 bg-brand-secondary shadow-lg">
            {suggestions.map((car) => (
              <button
                key={car.id}
                type="button"
                onClick={() => pick(car)}
                className="flex w-full items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 text-left last:border-b-0 hover:bg-white/10"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{car.make}</p>
                  <p className="truncate text-xs text-white/70">
                    {car.model}
                    {car.variant ? ` (${car.variant})` : ''}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-white/80" />
              </button>
            ))}
          </div>
        )}

        {loading && <p className="mt-2 text-xs text-gray-400">Searching…</p>}
      </div>
    </div>
  );
}
