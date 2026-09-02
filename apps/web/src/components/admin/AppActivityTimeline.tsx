'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Smartphone, Wallet, ClipboardList, Crown } from 'lucide-react';
import { formatDateTimeIST } from '@/lib/utils';
import type { AppActivityItem, AppActivityKind } from '@/lib/app-activity';

function fmtAt(value?: string | null) {
  const raw = formatDateTimeIST(value || null);
  if (!raw || raw === '—') return '—';
  const m = raw.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return raw;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(m[2]) - 1] || m[2];
  return `${m[1]} ${month}, ${Number(m[4])}:${m[5]} ${m[6].toUpperCase()}`;
}

const KIND_STYLE: Record<
  AppActivityKind,
  { wrap: string; icon: typeof Smartphone; label: string }
> = {
  event: { wrap: 'bg-indigo-100 text-indigo-800', icon: Smartphone, label: 'App' },
  wallet: { wrap: 'bg-emerald-100 text-emerald-800', icon: Wallet, label: 'Wallet' },
  booking: { wrap: 'bg-blue-100 text-blue-800', icon: ClipboardList, label: 'Booking' },
  membership: { wrap: 'bg-amber-100 text-amber-800', icon: Crown, label: 'Membership' },
};

export default function AppActivityTimeline({
  leadId,
  customerId,
  phone,
}: {
  leadId?: string | null;
  customerId?: string | null;
  phone?: string | null;
}) {
  const [items, setItems] = useState<AppActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (leadId) params.set('lead_id', leadId);
    if (customerId) params.set('customer_id', customerId);
    if (phone) params.set('phone', phone);
    if (![...params.keys()].length) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/super_admin/app-activity?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      setItems(Array.isArray(json?.items) ? json.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [leadId, customerId, phone]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = showAll ? items : items.slice(0, 10);

  return (
    <div className="min-w-0 w-full rounded-2xl border border-indigo-200 bg-indigo-50/50 p-3 shadow-sm sm:p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-indigo-900">
          <Smartphone className="h-4 w-4 shrink-0" />
          App activity
          {items.length > 0 ? (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
              {items.length}
            </span>
          ) : null}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-6 text-indigo-600">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-[11px] text-slate-500 py-4">
          No app activity for this customer yet.
        </p>
      ) : (
        <div className="relative max-h-[28rem] overflow-y-auto overflow-x-hidden pr-0.5">
          <div
            className="pointer-events-none absolute bottom-2 left-[9px] top-2 w-0.5 bg-indigo-200"
            aria-hidden
          />
          <ul className="relative space-y-2">
            {visible.map((row) => {
              const spec = KIND_STYLE[row.kind] || KIND_STYLE.event;
              const Icon = spec.icon;
              return (
                <li key={row.id} className="relative flex items-start gap-2.5">
                  <span
                    className={`relative z-10 mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-2 ring-indigo-50 ${spec.wrap}`}
                  >
                    <Icon className="h-2.5 w-2.5" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-lg border border-indigo-100 bg-white px-2.5 py-2 shadow-sm">
                    <div className="flex items-start gap-2">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                        <span className="shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-800 ring-1 ring-indigo-200">
                          {spec.label}
                        </span>
                        <span className="break-words text-[11px] font-semibold text-gray-900">
                          {row.title}
                        </span>
                      </div>
                      <span className="shrink-0 whitespace-nowrap pt-0.5 text-[9px] tabular-nums text-gray-400">
                        {fmtAt(row.at)}
                      </span>
                    </div>
                    {row.body ? (
                      <p className="mt-0.5 break-words text-[11px] leading-snug text-gray-600">
                        {row.body}
                      </p>
                    ) : null}
                    {row.group && row.kind === 'event' ? (
                      <p className="mt-0.5 text-[9px] uppercase tracking-wide text-gray-400">
                        {row.group}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {items.length > 10 ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 w-full py-1.5 text-center text-[12px] font-bold text-[#004AAD]"
            >
              {showAll ? 'View less' : `View more (${items.length - 10})`}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
