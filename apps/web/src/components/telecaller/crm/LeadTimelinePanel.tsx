'use client';

import { useEffect, useState } from 'react';
import { Clock, Loader2, MessageCircle, PhoneCall } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

type Item = {
  id: string;
  kind: 'call' | 'followup' | 'whatsapp' | 'system';
  at: string;
  title: string;
  body?: string | null;
  meta?: Record<string, unknown>;
};

export default function LeadTimelinePanel({ leadId }: { leadId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/telecaller/crm/lead-timeline?lead_id=${encodeURIComponent(leadId)}`,
        );
        const json = await res.json().catch(() => ({}));
        if (!cancelled) setItems(Array.isArray(json?.items) ? json.items : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const icon = (kind: string) => {
    if (kind === 'whatsapp') return <MessageCircle className="h-3.5 w-3.5 text-[#128C7E]" />;
    if (kind === 'call') return <PhoneCall className="h-3.5 w-3.5 text-[#004AAD]" />;
    return <Clock className="h-3.5 w-3.5 text-slate-400" />;
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <h3 className="font-black text-[#023D95] mb-3">Activity timeline</h3>
      {loading ? (
        <div className="flex justify-center py-6 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-4">No activity yet</p>
      ) : (
        <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {items.map((it) => (
            <li key={it.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">{icon(it.kind)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800">{it.title}</p>
                  {it.body ? (
                    <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-3 whitespace-pre-wrap">
                      {it.body}
                    </p>
                  ) : null}
                  <p className="text-[10px] text-slate-400 mt-1">{formatDateTime(it.at)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
