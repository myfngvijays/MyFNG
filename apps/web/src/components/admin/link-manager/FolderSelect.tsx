'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export default function FolderSelect({
  value,
  options,
  onChange,
  placeholder = 'Select folder',
  allowCreate = true,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  allowCreate?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = value.trim();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((name) => name.toLowerCase().includes(q));
  }, [options, query]);

  const canCreate =
    allowCreate &&
    Boolean(query.trim()) &&
    !options.some((name) => name.toLowerCase() === query.trim().toLowerCase());

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-sm outline-none focus:border-blue-500"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>{selected || placeholder}</span>
        <ChevronDown className={`h-4 w-4 text-gray-400 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="relative border-b border-gray-100">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search folders…"
              className="w-full py-2.5 pl-9 pr-3 text-sm outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => pick('')}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              <span className="text-gray-500">No folder</span>
              {!selected ? <Check className="h-3.5 w-3.5 text-blue-600" /> : null}
            </button>
            {filtered.map((name) => {
              const active = selected.toLowerCase() === name.toLowerCase();
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => pick(name)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                    active ? 'bg-blue-50 font-semibold text-blue-800' : 'text-gray-800'
                  }`}
                >
                  {name}
                  {active ? <Check className="h-3.5 w-3.5 text-blue-600" /> : null}
                </button>
              );
            })}
            {canCreate ? (
              <button
                type="button"
                onClick={() => pick(query.trim())}
                className="flex w-full px-3 py-2 text-left text-sm font-semibold text-amber-800 hover:bg-amber-50"
              >
                Create “{query.trim()}”
              </button>
            ) : null}
            {!filtered.length && !canCreate ? (
              <p className="px-3 py-2 text-sm text-gray-500">No folder found</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
