'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarCheck, Loader2 } from 'lucide-react';
import { istYmd, type BookingConfirmedRow } from './BookingConfirmedPanel';

/** Dashboard card: today's booking-confirmed leads (count + latest few). */
export default function BookingConfirmedTodayCard({
  viewAllHref,
  leadHref,
  max = 5,
}: {
  viewAllHref: string;
  leadHref: (row: BookingConfirmedRow) => string;
  max?: number;
}) {
  const [rows, setRows] = useState<BookingConfirmedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const today = istYmd();
    const load = async () => {
      try {
        const res = await fetch(`/api/crm/booking-confirmed?from=${today}&to=${today}&limit=${max}`, {
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!alive || !res.ok) return;
        setRows(Array.isArray(json.leads) ? json.leads : []);
        setTotal(Number(json.total || 0));
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [max]);

  return (
    <div className="rounded-2xl border-l-4 border-teal-600 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarCheck className="h-5 w-5 shrink-0 text-teal-700" />
          <h3 className="truncate font-black text-teal-800">Booking confirmed today</h3>
          <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-black text-white">{total}</span>
        </div>
        <Link href={viewAllHref} className="shrink-0 rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800 hover:bg-teal-100">
          View all
        </Link>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="py-3 text-sm text-slate-500">No booking confirmed yet today.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <Link href={leadHref(r)} className="block truncate text-sm font-bold text-slate-900 hover:text-teal-800 hover:underline">
                  {r.customer_name || 'Unnamed'}
                </Link>
                <p className="truncate text-xs text-slate-500">
                  {[
                    [r.vehicle_make, r.vehicle_model].filter(Boolean).join(' '),
                    r.workshop,
                    r.telecaller,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-slate-500">
                {new Date(r.confirmed_at).toLocaleTimeString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
