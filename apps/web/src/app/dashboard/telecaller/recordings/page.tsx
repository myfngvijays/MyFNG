'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';

type Row = {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  phone: string;
  created_at: string;
  duration: number;
};

function stamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export default function RecordingsPage() {
  const pathname = usePathname();
  const { layoutRole, base } = getCrmDashboardBase(pathname);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      setError('');
      void fetch(`/api/telecaller/calls/recordings?q=${encodeURIComponent(q.trim())}`, { credentials: 'include' })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || 'Could not load recordings');
          if (!cancelled) setRows(Array.isArray(data.items) ? data.items : []);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load recordings');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <DashboardLayout role={layoutRole}>
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-extrabold" style={{ color: '#0F172A' }}>
          Recordings
        </h1>
        <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, lead"
            className="w-full py-3 text-sm outline-none"
          />
        </label>
        {loading ? <p className="mt-4 text-sm text-slate-500">Loading…</p> : null}
        {error ? <p className="mt-4 text-sm text-amber-800">{error}</p> : null}
        {!loading && !error && rows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No recordings yet</p>
        ) : null}
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setPlaying(playing === row.id ? null : row.id)}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1D4ED8] text-xs font-bold text-white">
                  {playing === row.id ? 'II' : '▶'}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold text-slate-900">{row.customer_name || 'Customer'}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {[row.lead_number ? `#${row.lead_number}` : '', row.phone, stamp(row.created_at)].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
              {playing === row.id ? (
                <audio className="mt-3 w-full" controls autoPlay src={`/api/telecaller/calls/recording/${row.id}`} />
              ) : null}
              {row.lead_id ? (
                <a href={`${base}/leads/${row.lead_id}`} className="mt-2 inline-block text-xs font-bold text-[#1D4ED8]">
                  Open lead
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
