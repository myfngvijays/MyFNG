'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { loadCrmWorkshops } from '@/lib/telecaller/loadCrmWorkshops';

type Workshop = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  pincode?: string | null;
};

export default function CrmWorkshopPicker({
  compact = false,
  pincode,
  city,
  cityId,
  workshopId,
  workshopName,
  onPick,
}: {
  compact?: boolean;
  pincode: string;
  city?: string;
  cityId?: string;
  workshopId: string;
  workshopName?: string;
  onPick: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(false);
  const [browsing, setBrowsing] = useState(!workshopId);
  const selected = rows.find((row) => row.id === workshopId);
  const selectedLabel = selected?.name || workshopName || '';

  useEffect(() => {
    const pin = String(pincode || '').replace(/\D/g, '');
    const q = query.trim();
    if (pin.length !== 6 && q.length < 2) {
      setRows([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const list = await loadCrmWorkshops({
          pincode: pin,
          city,
          cityId,
          q,
        });
        if (!cancelled) setRows(list);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pincode, city, cityId, query]);

  const addressLine = selected
    ? [selected.address, selected.city, selected.pincode].filter(Boolean).join(' · ')
    : '';

  if (workshopId && selectedLabel && !browsing && !query.trim()) {
    if (compact) {
      return (
        <div className="rounded-lg border border-[#004AAD]/40 bg-[#004AAD]/5 px-2 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs font-bold text-slate-900">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#004AAD]">Workshop · </span>
              {selectedLabel}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setBrowsing(true)}
                className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-[#004AAD]"
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => onPick('', '')}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white text-slate-500 hover:text-rose-600"
                aria-label="Remove workshop"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {addressLine ? <p className="mt-0.5 truncate text-[10px] text-slate-500">{addressLine}</p> : null}
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-[#004AAD] bg-[#004AAD]/5 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#004AAD]">Workshop</p>
            <p className="text-sm font-bold text-slate-900">{selectedLabel}</p>
            {addressLine ? <p className="text-[11px] text-slate-500">{addressLine}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setBrowsing(true)}
              className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-[#004AAD]"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => onPick('', '')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-500 hover:text-rose-600"
              aria-label="Remove workshop"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const shellCls = compact
    ? 'rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5'
  : 'rounded-xl border border-slate-200 bg-slate-50 p-3';

  return (
    <div className={shellCls}>
      <div className={`flex items-center justify-between gap-2 ${compact ? 'mb-1' : 'mb-2'}`}>
        <p className={`font-bold uppercase tracking-wide text-slate-600 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          Workshop
        </p>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : null}
      </div>
      <div className={`relative ${compact ? 'mb-1' : 'mb-2'}`}>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={compact ? 'Search workshop…' : 'Search workshop, ya nearest PIN se'}
          className={`w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-sm ${
            compact ? 'h-8 text-xs' : 'h-9'
          }`}
        />
      </div>
      {rows.length === 0 && !loading ? (
        <p className={`text-slate-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          {String(pincode || '').length === 6
            ? 'Is PIN ke paas workshop nahi mila. Search se naam likho.'
            : '6-digit pincode daalo, nearest workshop yahin aayenge.'}
        </p>
      ) : (
        <div className={`space-y-1 overflow-y-auto ${compact ? 'max-h-28' : 'max-h-40'}`}>
          {rows.map((row) => {
            const active = workshopId === row.id;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  onPick(row.id, row.name);
                  setBrowsing(false);
                  setQuery('');
                }}
                className={`flex w-full items-start justify-between gap-2 rounded-lg border text-left ${
                  compact ? 'px-2 py-1.5' : 'px-2.5 py-2'
                } ${active ? 'border-[#004AAD] bg-[#004AAD]/5' : 'border-slate-200 bg-white'}`}
              >
                <span className="min-w-0">
                  <span className={`block font-bold text-slate-900 ${compact ? 'text-xs' : 'text-sm'}`}>{row.name}</span>
                  <span className={`block text-slate-500 ${compact ? 'truncate text-[10px]' : 'text-[11px]'}`}>
                    {[row.address, row.city, row.pincode].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full border-2 ${compact ? 'mt-0.5 h-3 w-3' : 'mt-1 h-3.5 w-3.5'} ${
                    active ? 'border-[#004AAD] bg-[#004AAD]' : 'border-slate-300'
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
