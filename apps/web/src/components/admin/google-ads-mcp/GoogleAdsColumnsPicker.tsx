'use client';

import { useMemo, useState } from 'react';
import { Columns3, X } from 'lucide-react';
import { ADS_COLUMNS, DEFAULT_CAMPAIGN_COLUMNS, UNAVAILABLE_COLUMN_GROUPS, type AdsColumn } from '@/lib/google-ads/columns';

export default function GoogleAdsColumnsPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const map = new Map<string, AdsColumn[]>();
    for (const col of ADS_COLUMNS) {
      if (q && !col.label.toLowerCase().includes(q.toLowerCase())) continue;
      const list = map.get(col.category) || [];
      list.push(col);
      map.set(col.category, list);
    }
    return map;
  }, [q]);

  const toggle = (key: string, always?: boolean) => {
    if (always) return;
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  };

  const move = (key: string, dir: -1 | 1) => {
    const i = selected.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
      >
        <Columns3 className="h-3.5 w-3.5" />
        Columns
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 p-4 pt-16">
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <p className="text-lg font-extrabold text-slate-900">Modify columns</p>
                <p className="text-xs text-slate-500">Google Ads API se jo fields milte hain — drag order right side pe.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
              <div className="min-h-0 overflow-y-auto border-r border-slate-100 p-4">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search columns…"
                  className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                {Array.from(groups.entries()).map(([cat, cols]) => (
                  <div key={cat} className="mb-4">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{cat}</p>
                    {cols.map((col) => (
                      <label key={col.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={selected.includes(col.key)}
                          disabled={col.always}
                          onChange={() => toggle(col.key, col.always)}
                        />
                        {col.label}
                      </label>
                    ))}
                  </div>
                ))}
                <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  {UNAVAILABLE_COLUMN_GROUPS.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
              <div className="min-h-0 overflow-y-auto p-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Your columns</p>
                {selected.map((key) => {
                  const col = ADS_COLUMNS.find((c) => c.key === key);
                  if (!col) return null;
                  return (
                    <div key={key} className="mb-1 flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <span className="font-semibold text-slate-800">{col.label}</span>
                      <span className="flex gap-1">
                        <button type="button" onClick={() => move(key, -1)} className="rounded border px-1.5 text-xs">
                          ↑
                        </button>
                        <button type="button" onClick={() => move(key, 1)} className="rounded border px-1.5 text-xs">
                          ↓
                        </button>
                        {!col.always && (
                          <button type="button" onClick={() => toggle(key)} className="rounded border px-1.5 text-xs text-rose-600">
                            ✕
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => onChange(DEFAULT_CAMPAIGN_COLUMNS)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
              >
                Recommended
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-[#004AAD] px-4 py-2 text-sm font-bold text-white">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
