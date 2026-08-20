'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import PageHelpIcon from '@/components/PageHelpIcon';

type Chat = {
  phone: string;
  assignees: Array<{ id: string; full_name: string | null }>;
  last_message: { direction: string; preview: string; at: string; status?: string } | null;
  unanswered_inbound: boolean;
  unanswered_hours: number | null;
};

export default function LeadManagerTeamWhatsAppPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [telecallers, setTelecallers] = useState<Array<{ id: string; full_name: string | null }>>(
    [],
  );
  const [telecallerId, setTelecallerId] = useState('');
  const [unansweredHours, setUnansweredHours] = useState('0');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = (await import('@/lib/supabase/client')).createClient();
        const { data } = await supabase
          .from('users_login')
          .select('id, full_name, roles!role_id(role_code)')
          .eq('is_active', true);
        if (cancelled) return;
        setTelecallers(
          (data || [])
            .filter((u: any) => String(u?.roles?.role_code || '').toUpperCase() === 'TELECALLER')
            .map((u: any) => ({ id: String(u.id), full_name: u.full_name || null })),
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (telecallerId) params.set('telecaller_id', telecallerId);
      if (unansweredHours && unansweredHours !== '0') params.set('unanswered_hours', unansweredHours);
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/lead-manager/team-whatsapp?${params}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setChats(json.chats || []);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, [telecallerId, unansweredHours, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const openChat = (phone: string) => {
    window.dispatchEvent(
      new CustomEvent('myfng:open-wa-chat', {
        detail: { phone },
      }),
    );
  };

  return (
    <DashboardLayout role="LEAD_MANAGER">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-[#023D95] flex items-center gap-2">
              <MessageCircle className="h-6 w-6" /> Team WhatsApp
              <PageHelpIcon href="/dashboard/lead_manager/team-whatsapp" label="Team WA" />
            </h1>
            <p className="text-sm text-slate-500">
              Oversight of assigned chats — open any conversation in the inbox.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
            value={telecallerId}
            onChange={(e) => setTelecallerId(e.target.value)}
          >
            <option value="">All assignees</option>
            {telecallers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name || t.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
            value={unansweredHours}
            onChange={(e) => setUnansweredHours(e.target.value)}
          >
            <option value="0">Any reply state</option>
            <option value="2">Unanswered ≥ 2h</option>
            <option value="6">Unanswered ≥ 6h</option>
            <option value="24">Unanswered ≥ 24h</option>
          </select>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Search phone / name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
          />
        </div>

        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

        {loading && !chats.length ? (
          <div className="flex justify-center py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : chats.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-12">No chats match</p>
        ) : (
          <ul className="space-y-2">
            {chats.map((c, idx) => (
              <li key={`${c.phone}-${c.assignees.map((a) => a.id).join('_') || idx}`}>
                <button
                  type="button"
                  onClick={() => openChat(c.phone)}
                  className="w-full text-left rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-blue-300 transition"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-[#023D95]">{c.phone}</p>
                      <p className="text-xs text-indigo-700 font-semibold">
                        {c.assignees.map((a) => a.full_name || a.id.slice(0, 6)).join(', ') ||
                          'Unassigned'}
                      </p>
                      <p className="mt-1 text-sm text-slate-600 truncate">
                        {c.last_message?.preview || 'No messages'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {c.unanswered_inbound ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Unanswered{c.unanswered_hours != null ? ` · ${c.unanswered_hours}h` : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 uppercase">OK</span>
                      )}
                      {c.last_message?.at ? (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {new Date(c.last_message.at).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}
