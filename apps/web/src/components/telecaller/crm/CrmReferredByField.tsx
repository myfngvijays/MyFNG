'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, UserPlus, X } from 'lucide-react';
import type { CrmReferredBy } from '@/lib/telecaller/crmLeadReference';
import { referredByLabel } from '@/lib/telecaller/crmLeadReference';

type Hit = {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  status?: string;
};

export default function CrmReferredByField({
  leadId,
  value,
  onChange,
  referredTo,
  leadHref,
}: {
  leadId: string;
  value: CrmReferredBy | null;
  onChange: (next: CrmReferredBy | null) => void;
  referredTo: Hit[];
  leadHref: (id: string) => string;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 4) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/telecaller/crm/lead-reference?q=${encodeURIComponent(term)}&exclude=${encodeURIComponent(leadId)}`,
        );
        const json = await res.json().catch(() => ({}));
        setHits(Array.isArray(json.results) ? json.results : []);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, leadId]);

  return (
    <div className="sm:col-span-2 lg:col-span-4 space-y-3">
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
          Referred by
        </label>
        {value ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2">
            <UserPlus className="h-4 w-4 text-violet-700" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">{referredByLabel(value)}</p>
              {value.lead_number ? (
                <p className="text-[11px] text-slate-500">{value.lead_number}</p>
              ) : null}
            </div>
            {value.lead_id ? (
              <Link
                href={leadHref(value.lead_id)}
                className="text-xs font-bold text-violet-700 hover:underline"
              >
                Open lead
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-lg p-1 text-slate-500 hover:bg-white hover:text-rose-600"
              aria-label="Clear referred by"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search referrer by phone or name"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#023D95] focus:ring-2 focus:ring-[#023D95]/15"
            />
            {searching ? (
              <p className="mt-1 text-[11px] text-slate-500">Searching…</p>
            ) : null}
            {hits.length > 0 ? (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {hits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      onChange({
                        lead_id: hit.id,
                        customer_name: hit.customer_name,
                        customer_phone: hit.customer_phone,
                        lead_number: hit.lead_number,
                      });
                      setQ('');
                      setHits([]);
                    }}
                  >
                    <span>
                      <span className="block text-sm font-bold text-slate-900">
                        {hit.customer_name || 'Unknown'}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {hit.customer_phone}
                        {hit.lead_number ? ` · ${hit.lead_number}` : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {referredTo.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
            References given
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Number</th>
                  <th className="px-3 py-2">Lead</th>
                </tr>
              </thead>
              <tbody>
                {referredTo.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-slate-800">
                      {row.customer_name || '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.customer_phone || '—'}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={leadHref(row.id)}
                        className="font-bold text-[#023D95] hover:underline"
                      >
                        {row.lead_number || 'Open'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
